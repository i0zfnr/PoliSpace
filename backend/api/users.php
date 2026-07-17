<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = $db->fetchAll(
        "SELECT id, email, full_name, phone, role, password IS NOT NULL AS has_password, created_at, updated_at
         FROM users
         WHERE role = 'user'
         ORDER BY created_at DESC"
    );

    jsonResponse(['success' => true, 'data' => array_map(static function (array $user): array {
        $user['has_password'] = (bool)$user['has_password'];
        return $user;
    }, $users)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $password = (string)($input['password'] ?? '');

    if ($id <= 0) {
        jsonResponse(['success' => false, 'error' => 'Client ID required'], 400);
    }

    if (strlen($password) < 6) {
        jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db->update("UPDATE users SET password = ? WHERE id = ? AND role = 'user'", [$hash, $id]);

    jsonResponse(['success' => true, 'message' => 'Client password updated']);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
?>
