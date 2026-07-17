<?php
declare(strict_types=1);

define('DB_HOST', 'localhost');
define('DB_NAME', 'polspace');
define('DB_USER', 'root');
define('DB_PASS', '');

define('APP_NAME', 'PoliSpace');
define('APP_URL', 'http://localhost/PoliSpace');
define('UPLOAD_DIR', dirname(__DIR__) . '/uploads/payments/');

ini_set('session.cookie_httponly', '1');
ini_set('session.use_only_cookies', '1');
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
?>
