<?php
/**
 * Products API Endpoint
 * All-Inkl Webserver kompatibel
 */

require_once '../config/config.php';

// Login erforderlich
requireLogin();

// Rate Limiting
if (!checkRateLimit('products_api', 120)) {
    sendErrorResponse('Zu viele Anfragen. Bitte versuchen Sie es später erneut.', 429);
}

$method = $_SERVER['REQUEST_METHOD'];
$userId = $_SESSION['user_id'];
$pdo = getDBConnection();

try {
    switch ($method) {
        case 'GET':
            handleGetProducts($pdo, $userId);
            break;
            
        case 'POST':
            handleCreateProduct($pdo, $userId);
            break;
            
        case 'PUT':
            handleUpdateProduct($pdo, $userId);
            break;
            
        case 'DELETE':
            handleDeleteProduct($pdo, $userId);
            break;
            
        default:
            sendErrorResponse('Method not allowed', 405);
    }
} catch (PDOException $e) {
    logMessage("Database error in products API: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Datenbankfehler', 500);
} catch (Exception $e) {
    logMessage("General error in products API: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Ein Fehler ist aufgetreten', 500);
}

/**
 * Produkte abrufen (GET)
 */
function handleGetProducts($pdo, $userId) {
    $productId = $_GET['id'] ?? null;
    $search = $_GET['search'] ?? null;
    $limit = min((int)($_GET['limit'] ?? ITEMS_PER_PAGE), 100); // Max 100 items
    $offset = (int)($_GET['offset'] ?? 0);
    
    if ($productId) {
        // Einzelnes Produkt abrufen
        $stmt = $pdo->prepare("
            SELECT p.*, 
                   pi.ingredient_id, pi.amount as ingredient_amount, pi.unit as ingredient_unit,
                   i.name as ingredient_name, i.category as ingredient_category
            FROM products p
            LEFT JOIN product_ingredients pi ON p.id = pi.product_id
            LEFT JOIN ingredients i ON pi.ingredient_id = i.id
            WHERE p.id = ? AND p.user_id = ?
        ");
        $stmt->execute([$productId, $userId]);
        $rows = $stmt->fetchAll();
        
        if (empty($rows)) {
            sendErrorResponse('Produkt nicht gefunden', 404);
        }
        
        // Produkt-Daten zusammensetzen
        $product = [
            'id' => $rows[0]['id'],
            'name' => $rows[0]['name'],
            'brand' => $rows[0]['brand'],
            'description' => $rows[0]['description'],
            'serving_size' => $rows[0]['serving_size'],
            'servings_per_container' => $rows[0]['servings_per_container'],
            'unit' => $rows[0]['unit'],
            'unit_cost' => $rows[0]['unit_cost'],
            'total_cost' => $rows[0]['total_cost'],
            'purchase_date' => $rows[0]['purchase_date'],
            'expiry_date' => $rows[0]['expiry_date'],
            'notes' => $rows[0]['notes'],
            'created_at' => $rows[0]['created_at'],
            'updated_at' => $rows[0]['updated_at'],
            'ingredients' => []
        ];
        
        foreach ($rows as $row) {
            if ($row['ingredient_id']) {
                $product['ingredients'][] = [
                    'ingredient_id' => $row['ingredient_id'],
                    'name' => $row['ingredient_name'],
                    'category' => $row['ingredient_category'],
                    'amount' => $row['ingredient_amount'],
                    'unit' => $row['ingredient_unit']
                ];
            }
        }
        
        sendSuccessResponse($product);
        
    } else {
        // Produktliste abrufen
        $whereClause = "WHERE p.user_id = ?";
        $params = [$userId];
        
        if ($search) {
            $whereClause .= " AND (p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        // Anzahl für Pagination
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM products p $whereClause");
        $countStmt->execute($params);
        $totalCount = $countStmt->fetchColumn();
        
        // Produkte abrufen
        $stmt = $pdo->prepare("
            SELECT p.*, COUNT(pi.id) as ingredients_count
            FROM products p
            LEFT JOIN product_ingredients pi ON p.id = pi.product_id
            $whereClause
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            LIMIT ? OFFSET ?
        ");
        
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $products = $stmt->fetchAll();
        
        sendSuccessResponse([
            'products' => $products,
            'total_count' => $totalCount,
            'limit' => $limit,
            'offset' => $offset
        ]);
    }
}

/**
 * Produkt erstellen (POST)
 */
function handleCreateProduct($pdo, $userId) {
    // CSRF Token prüfen
    $headers = getallheaders();
    $csrfToken = $headers['X-CSRF-Token'] ?? '';
    
    if (!validateCSRFToken($csrfToken)) {
        sendErrorResponse('CSRF Token ungültig', 403);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validierung
    $requiredFields = ['name'];
    foreach ($requiredFields as $field) {
        if (empty($input[$field])) {
            sendErrorResponse("Feld '$field' ist erforderlich", 400);
        }
    }
    
    $pdo->beginTransaction();
    
    try {
        // Produkt erstellen
        $stmt = $pdo->prepare("
            INSERT INTO products 
            (user_id, name, brand, description, serving_size, servings_per_container, 
             unit, unit_cost, total_cost, purchase_date, expiry_date, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $userId,
            sanitizeInput($input['name']),
            sanitizeInput($input['brand'] ?? null),
            sanitizeInput($input['description'] ?? null),
            sanitizeInput($input['serving_size'] ?? null),
            (int)($input['servings_per_container'] ?? null),
            sanitizeInput($input['unit'] ?? 'Portion'),
            (float)($input['unit_cost'] ?? null),
            (float)($input['total_cost'] ?? null),
            $input['purchase_date'] ?? null,
            $input['expiry_date'] ?? null,
            sanitizeInput($input['notes'] ?? null)
        ]);
        
        $productId = $pdo->lastInsertId();
        
        // Ingredients hinzufügen
        if (!empty($input['ingredients']) && is_array($input['ingredients'])) {
            $ingredientStmt = $pdo->prepare("
                INSERT INTO product_ingredients (product_id, ingredient_id, amount, unit) 
                VALUES (?, ?, ?, ?)
            ");
            
            foreach ($input['ingredients'] as $ingredient) {
                if (!empty($ingredient['ingredient_id']) && !empty($ingredient['amount'])) {
                    $ingredientStmt->execute([
                        $productId,
                        (int)$ingredient['ingredient_id'],
                        (float)$ingredient['amount'],
                        sanitizeInput($ingredient['unit'] ?? 'mg')
                    ]);
                }
            }
        }
        
        $pdo->commit();
        
        // Aktivitäts-Log
        logActivity($userId, 'create_product', 'product', $productId, "Produkt erstellt: " . $input['name']);
        
        sendSuccessResponse(['id' => $productId], 'Produkt erfolgreich erstellt');
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}

/**
 * Produkt aktualisieren (PUT)
 */
function handleUpdateProduct($pdo, $userId) {
    $productId = $_GET['id'] ?? null;
    if (!$productId) {
        sendErrorResponse('Produkt-ID erforderlich', 400);
    }
    
    // CSRF Token prüfen
    $headers = getallheaders();
    $csrfToken = $headers['X-CSRF-Token'] ?? '';
    
    if (!validateCSRFToken($csrfToken)) {
        sendErrorResponse('CSRF Token ungültig', 403);
    }
    
    // Berechtigung prüfen
    $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? AND user_id = ?");
    $stmt->execute([$productId, $userId]);
    if (!$stmt->fetch()) {
        sendErrorResponse('Produkt nicht gefunden', 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $pdo->beginTransaction();
    
    try {
        // Produkt aktualisieren
        $stmt = $pdo->prepare("
            UPDATE products SET 
                name = ?, brand = ?, description = ?, serving_size = ?, 
                servings_per_container = ?, unit = ?, unit_cost = ?, total_cost = ?, 
                purchase_date = ?, expiry_date = ?, notes = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ?
        ");
        
        $stmt->execute([
            sanitizeInput($input['name']),
            sanitizeInput($input['brand'] ?? null),
            sanitizeInput($input['description'] ?? null),
            sanitizeInput($input['serving_size'] ?? null),
            (int)($input['servings_per_container'] ?? null),
            sanitizeInput($input['unit'] ?? 'Portion'),
            (float)($input['unit_cost'] ?? null),
            (float)($input['total_cost'] ?? null),
            $input['purchase_date'] ?? null,
            $input['expiry_date'] ?? null,
            sanitizeInput($input['notes'] ?? null),
            $productId,
            $userId
        ]);
        
        // Ingredients neu setzen
        if (isset($input['ingredients']) && is_array($input['ingredients'])) {
            // Alte Ingredients löschen
            $stmt = $pdo->prepare("DELETE FROM product_ingredients WHERE product_id = ?");
            $stmt->execute([$productId]);
            
            // Neue Ingredients hinzufügen
            if (!empty($input['ingredients'])) {
                $ingredientStmt = $pdo->prepare("
                    INSERT INTO product_ingredients (product_id, ingredient_id, amount, unit) 
                    VALUES (?, ?, ?, ?)
                ");
                
                foreach ($input['ingredients'] as $ingredient) {
                    if (!empty($ingredient['ingredient_id']) && !empty($ingredient['amount'])) {
                        $ingredientStmt->execute([
                            $productId,
                            (int)$ingredient['ingredient_id'],
                            (float)$ingredient['amount'],
                            sanitizeInput($ingredient['unit'] ?? 'mg')
                        ]);
                    }
                }
            }
        }
        
        $pdo->commit();
        
        // Aktivitäts-Log
        logActivity($userId, 'update_product', 'product', $productId, "Produkt aktualisiert: " . $input['name']);
        
        sendSuccessResponse(null, 'Produkt erfolgreich aktualisiert');
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}

/**
 * Produkt löschen (DELETE)
 */
function handleDeleteProduct($pdo, $userId) {
    $productId = $_GET['id'] ?? null;
    if (!$productId) {
        sendErrorResponse('Produkt-ID erforderlich', 400);
    }
    
    // Berechtigung prüfen
    $stmt = $pdo->prepare("SELECT name FROM products WHERE id = ? AND user_id = ?");
    $stmt->execute([$productId, $userId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        sendErrorResponse('Produkt nicht gefunden', 404);
    }
    
    // Prüfen ob Produkt in Stacks verwendet wird
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM stack_items si
        JOIN stacks s ON si.stack_id = s.id
        WHERE si.product_id = ? AND s.user_id = ?
    ");
    $stmt->execute([$productId, $userId]);
    $stackUsage = $stmt->fetchColumn();
    
    if ($stackUsage > 0) {
        sendErrorResponse('Produkt wird in ' . $stackUsage . ' Stack(s) verwendet und kann nicht gelöscht werden', 400);
    }
    
    $pdo->beginTransaction();
    
    try {
        // Product Ingredients löschen (CASCADE sollte das automatisch machen)
        $stmt = $pdo->prepare("DELETE FROM product_ingredients WHERE product_id = ?");
        $stmt->execute([$productId]);
        
        // Produkt löschen
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        
        $pdo->commit();
        
        // Aktivitäts-Log
        logActivity($userId, 'delete_product', 'product', $productId, "Produkt gelöscht: " . $product['name']);
        
        sendSuccessResponse(null, 'Produkt erfolgreich gelöscht');
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}
?>