<?php
/**
 * Cost Calculator API Endpoint
 * All-Inkl Webserver kompatibel
 */

require_once '../config/config.php';

// Login erforderlich
requireLogin();

// Nur POST-Requests erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Rate Limiting
if (!checkRateLimit('cost_calculator', 60)) {
    sendErrorResponse('Zu viele Anfragen. Bitte versuchen Sie es später erneut.', 429);
}

$userId = $_SESSION['user_id'];
$pdo = getDBConnection();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['product_ids']) || !is_array($input['product_ids'])) {
        sendErrorResponse('Produkt-IDs sind erforderlich', 400);
    }
    
    $productIds = array_map('intval', $input['product_ids']);
    
    if (empty($productIds)) {
        sendErrorResponse('Keine gültigen Produkt-IDs', 400);
    }
    
    // Platzhalter für IN-Klausel erstellen
    $placeholders = str_repeat('?,', count($productIds) - 1) . '?';
    
    // Produkte mit Standard-Dosierung (1 Portion pro Tag) abrufen
    $stmt = $pdo->prepare("
        SELECT p.id, p.name, p.brand, p.unit, p.unit_cost, p.servings_per_container,
               COALESCE(p.unit_cost, 0) as cost_per_unit,
               1 as dosage,
               1 as frequency_per_day
        FROM products p
        WHERE p.id IN ($placeholders) AND p.user_id = ?
    ");
    
    $params = array_merge($productIds, [$userId]);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
    
    if (empty($products)) {
        sendErrorResponse('Keine Produkte gefunden', 404);
    }
    
    // Kosten berechnen
    $totalDailyCost = 0;
    $productCosts = [];
    
    foreach ($products as $product) {
        $dailyCost = $product['cost_per_unit'] * $product['dosage'] * $product['frequency_per_day'];
        $totalDailyCost += $dailyCost;
        
        $productCosts[] = [
            'id' => $product['id'],
            'name' => $product['name'],
            'brand' => $product['brand'],
            'unit' => $product['unit'],
            'dosage' => $product['dosage'],
            'frequency_per_day' => $product['frequency_per_day'],
            'unit_cost' => $product['cost_per_unit'],
            'daily_cost' => $dailyCost,
            'weekly_cost' => $dailyCost * 7,
            'monthly_cost' => $dailyCost * 30,
            'yearly_cost' => $dailyCost * 365
        ];
    }
    
    $costs = [
        'daily_cost' => $totalDailyCost,
        'weekly_cost' => $totalDailyCost * 7,
        'monthly_cost' => $totalDailyCost * 30,
        'yearly_cost' => $totalDailyCost * 365,
        'products' => $productCosts,
        'calculation_date' => date('Y-m-d H:i:s')
    ];
    
    // Aktivitäts-Log
    logActivity($userId, 'calculate_costs', null, null, 'Kostenberechnung für ' . count($productIds) . ' Produkte');
    
    sendSuccessResponse($costs, 'Kosten erfolgreich berechnet');
    
} catch (PDOException $e) {
    logMessage("Database error in cost calculator: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Datenbankfehler', 500);
} catch (Exception $e) {
    logMessage("General error in cost calculator: " . $e->getMessage(), 'ERROR');
    sendErrorResponse('Ein Fehler ist aufgetreten', 500);
}
?>