<?php
/**
 * Gemeinsamer Header für alle Seiten
 * All-Inkl Webserver kompatibel
 */

if (!defined('CONFIG_LOADED')) {
    require_once __DIR__ . '/../config/config.php';
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($pageTitle) ? e($pageTitle) : e(SITE_NAME); ?></title>
    
    <!-- Meta Tags -->
    <meta name="description" content="<?php echo isset($pageDescription) ? e($pageDescription) : 'Intelligente Supplement-Verwaltung mit Dosierungsempfehlungen und Interaktionswarnungen'; ?>">
    <meta name="keywords" content="Nahrungsergänzungsmittel, Supplemente, Dosierung, Gesundheit, Vitamine">
    <meta name="author" content="<?php echo e(SITE_NAME); ?>">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph -->
    <meta property="og:title" content="<?php echo isset($pageTitle) ? e($pageTitle) : e(SITE_NAME); ?>">
    <meta property="og:description" content="<?php echo isset($pageDescription) ? e($pageDescription) : 'Intelligente Supplement-Verwaltung'; ?>">
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo e(SITE_URL . $_SERVER['REQUEST_URI']); ?>">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo asset('images/favicon-32x32.png'); ?>">
    <link rel="icon" type="image/png" sizes="16x16" href="<?php echo asset('images/favicon-16x16.png'); ?>">
    <link rel="apple-touch-icon" sizes="180x180" href="<?php echo asset('images/apple-touch-icon.png'); ?>">
    <link rel="manifest" href="<?php echo asset('images/site.webmanifest'); ?>">
    
    <!-- CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="<?php echo asset('css/style.css'); ?>" rel="stylesheet">
    
    <!-- Theme Color -->
    <meta name="theme-color" content="#2563eb">
    
    <!-- Preload kritische Ressourcen -->
    <link rel="preload" href="https://cdn.tailwindcss.com" as="script">
    <link rel="preload" href="<?php echo asset('css/style.css'); ?>" as="style">
</head>
<body class="bg-gray-50 min-h-screen">