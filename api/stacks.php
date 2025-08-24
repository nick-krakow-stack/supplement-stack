<?php
/**
 * Stacks API Endpoint
 * All-Inkl Webserver kompatibel
 */

require_once '../config/config.php';

// Login erforderlich
requireLogin();

// Rate Limiting
if (!checkRateLimit('stacks_api', 120)) {
    sendErrorResponse('Zu viele Anfragen. Bitte versuchen Sie es später erneut.', 429);
}

$method = $_SERVER['REQUEST_METHOD'];
$userId = $_SESSION['user_id'];
$pdo = getDBConnection();

try {
    switch ($method) {
        case 'GET':
            handleGetStacks($pdo, $userId);
            break;
            
        case 'POST':
            handleCreateStack($pdo, $userId);
            break;
            
        case 'PUT':
            handleUpdateStack($pdo, $userId);
            break;
            
        case 'DELETE':
            handleDeleteStack($pdo, $userId);
            break;
            
        default:
            sendErrorResponse('Method not allowed', 405);
    }
} catch (PDOException $e) {
    logMessage("Database error in stacks API: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Datenbankfehler', 500);
} catch (Exception $e) {
    logMessage("General error in stacks API: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Ein Fehler ist aufgetreten', 500);
}

/**
 * Stacks abrufen (GET)
 */
function handleGetStacks($pdo, $userId) {
    $stackId = $_GET['id'] ?? null;
    $search = $_GET['search'] ?? null;
    $active_only = $_GET['active_only'] ?? true;
    $limit = min((int)($_GET['limit'] ?? ITEMS_PER_PAGE), 100);
    $offset = (int)($_GET['offset'] ?? 0);
    
    if ($stackId) {
        // Einzelnen Stack mit Items abrufen
        $stmt = $pdo->prepare("
            SELECT s.*, 
                   si.id as item_id, si.dosage, si.unit as item_unit, si.frequency_per_day, 
                   si.timing, si.notes as item_notes, si.is_active as item_active,
                   p.id as product_id, p.name as product_name, p.brand as product_brand,
                   p.unit as product_unit, p.unit_cost
            FROM stacks s
            LEFT JOIN stack_items si ON s.id = si.stack_id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE s.id = ? AND s.user_id = ?
            ORDER BY si.created_at ASC
        ");
        $stmt->execute([$stackId, $userId]);
        $rows = $stmt->fetchAll();
        
        if (empty($rows)) {
            sendErrorResponse('Stack nicht gefunden', 404);
        }
        
        // Stack-Daten zusammensetzen
        $stack = [
            'id' => $rows[0]['id'],
            'name' => $rows[0]['name'],
            'description' => $rows[0]['description'],
            'target_goal' => $rows[0]['target_goal'],
            'is_active' => $rows[0]['is_active'],
            'created_at' => $rows[0]['created_at'],
            'updated_at' => $rows[0]['updated_at'],
            'items' => []
        ];
        
        foreach ($rows as $row) {
            if ($row['item_id']) {
                $stack['items'][] = [
                    'id' => $row['item_id'],
                    'product_id' => $row['product_id'],
                    'product_name' => $row['product_name'],
                    'product_brand' => $row['product_brand'],
                    'product_unit' => $row['product_unit'],
                    'unit_cost' => $row['unit_cost'],
                    'dosage' => $row['dosage'],
                    'unit' => $row['item_unit'],
                    'frequency_per_day' => $row['frequency_per_day'],
                    'timing' => $row['timing'],
                    'notes' => $row['item_notes'],
                    'is_active' => $row['item_active']
                ];
            }
        }
        
        sendSuccessResponse($stack);
        
    } else {
        // Stack-Liste abrufen
        $whereClause = "WHERE s.user_id = ?";
        $params = [$userId];
        
        if ($active_only) {
            $whereClause .= " AND s.is_active = 1";
        }
        
        if ($search) {
            $whereClause .= " AND (s.name LIKE ? OR s.description LIKE ? OR s.target_goal LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        // Anzahl für Pagination
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM stacks s $whereClause");
        $countStmt->execute($params);
        $totalCount = $countStmt->fetchColumn();
        
        // Stacks abrufen
        $stmt = $pdo->prepare("
            SELECT s.*, 
                   COUNT(si.id) as item_count,
                   SUM(CASE WHEN si.is_active = 1 THEN 1 ELSE 0 END) as active_items,
                   SUM(CASE WHEN si.is_active = 1 AND p.unit_cost IS NOT NULL 
                            THEN p.unit_cost * si.dosage * si.frequency_per_day 
                            ELSE 0 END) as daily_cost
            FROM stacks s
            LEFT JOIN stack_items si ON s.id = si.stack_id
            LEFT JOIN products p ON si.product_id = p.id
            $whereClause
            GROUP BY s.id
            ORDER BY s.updated_at DESC
            LIMIT ? OFFSET ?
        ");
        
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $stacks = $stmt->fetchAll();
        
        sendSuccessResponse([
            'stacks' => $stacks,
            'total_count' => $totalCount,
            'limit' => $limit,
            'offset' => $offset
        ]);
    }
}

/**
 * Stack erstellen (POST)
 */
function handleCreateStack($pdo, $userId) {
    // CSRF Token prüfen
    $headers = getallheaders();
    $csrfToken = $headers['X-CSRF-Token'] ?? '';
    
    if (!validateCSRFToken($csrfToken)) {
        sendErrorResponse('CSRF Token ungültig', 403);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validierung
    if (empty($input['name'])) {
        sendErrorResponse('Stack-Name ist erforderlich', 400);
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO stacks (user_id, name, description, target_goal, is_active) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $userId,
            sanitizeInput($input['name']),
            sanitizeInput($input['description'] ?? null),
            sanitizeInput($input['target_goal'] ?? null),
            (bool)($input['is_active'] ?? true)
        ]);
        
        $stackId = $pdo->lastInsertId();
        
        // Aktivitäts-Log
        logActivity($userId, 'create_stack', 'stack', $stackId, "Stack erstellt: " . $input['name']);
        
        sendSuccessResponse(['id' => $stackId], 'Stack erfolgreich erstellt');
        
    } catch (Exception $e) {
        throw $e;
    }
}

/**
 * Stack aktualisieren (PUT)
 */
function handleUpdateStack($pdo, $userId) {
    $stackId = $_GET['id'] ?? null;
    if (!$stackId) {
        sendErrorResponse('Stack-ID erforderlich', 400);
    }
    
    // CSRF Token prüfen
    $headers = getallheaders();
    $csrfToken = $headers['X-CSRF-Token'] ?? '';
    
    if (!validateCSRFToken($csrfToken)) {
        sendErrorResponse('CSRF Token ungültig', 403);
    }
    
    // Berechtigung prüfen
    $stmt = $pdo->prepare("SELECT id FROM stacks WHERE id = ? AND user_id = ?");
    $stmt->execute([$stackId, $userId]);
    if (!$stmt->fetch()) {
        sendErrorResponse('Stack nicht gefunden', 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        $stmt = $pdo->prepare("
            UPDATE stacks SET 
                name = ?, description = ?, target_goal = ?, is_active = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ?
        ");
        
        $stmt->execute([
            sanitizeInput($input['name']),
            sanitizeInput($input['description'] ?? null),
            sanitizeInput($input['target_goal'] ?? null),
            (bool)($input['is_active'] ?? true),
            $stackId,
            $userId
        ]);
        
        // Aktivitäts-Log
        logActivity($userId, 'update_stack', 'stack', $stackId, "Stack aktualisiert: " . $input['name']);
        
        sendSuccessResponse(null, 'Stack erfolgreich aktualisiert');
        
    } catch (Exception $e) {
        throw $e;
    }
}

/**
 * Stack löschen (DELETE)
 */
function handleDeleteStack($pdo, $userId) {
    $stackId = $_GET['id'] ?? null;
    if (!$stackId) {
        sendErrorResponse('Stack-ID erforderlich', 400);
    }
    
    // Berechtigung prüfen
    $stmt = $pdo->prepare("SELECT name FROM stacks WHERE id = ? AND user_id = ?");
    $stmt->execute([$stackId, $userId]);
    $stack = $stmt->fetch();
    
    if (!$stack) {
        sendErrorResponse('Stack nicht gefunden', 404);
    }
    
    $pdo->beginTransaction();
    
    try {
        // Stack Items löschen (CASCADE sollte das automatisch machen)
        $stmt = $pdo->prepare("DELETE FROM stack_items WHERE stack_id = ?");
        $stmt->execute([$stackId]);
        
        // Stack löschen
        $stmt = $pdo->prepare("DELETE FROM stacks WHERE id = ? AND user_id = ?");
        $stmt->execute([$stackId, $userId]);
        
        $pdo->commit();
        
        // Aktivitäts-Log
        logActivity($userId, 'delete_stack', 'stack', $stackId, "Stack gelöscht: " . $stack['name']);
        
        sendSuccessResponse(null, 'Stack erfolgreich gelöscht');
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}
?>