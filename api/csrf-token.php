<?php
/**
 * CSRF Token API Endpoint
 * All-Inkl Webserver kompatibel
 */

require_once '../config/config.php';

// Nur GET-Requests erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    sendErrorResponse('Method not allowed', 405);
}

// CSRF Token generieren und zurückgeben
$token = generateCSRFToken();

sendSuccessResponse([
    'token' => $token
], 'CSRF Token generated');
?>