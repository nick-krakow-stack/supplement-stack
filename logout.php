<?php
/**
 * Supplement Stack PHP - Logout
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Benutzer ausloggen
logoutUser();

// Redirect zur Startseite
header('Location: index.php?message=logout_success');
exit;
?>