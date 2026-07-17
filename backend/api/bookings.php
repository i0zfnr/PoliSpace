<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if ($method === 'GET') {
        if ($action === 'user' && isset($_GET['email'])) {
            getUserBookings($db, (string)$_GET['email']);
        } elseif ($action === 'ref' && isset($_GET['ref'])) {
            getBookingByRef($db, (string)$_GET['ref']);
        } elseif ($action === 'public-stats') {
            getPublicStats($db);
        } elseif ($action === 'calendar') {
            getPublicCalendarBookings($db);
        } elseif ($action === 'stats') {
            requireAdmin();
            getDashboardStats($db);
        } else {
            requireAdmin();
            getAllBookings($db, $_GET['status'] ?? null);
        }
    }

    if ($method === 'POST') {
        createBooking($db);
    }

    if ($method === 'PUT' && $action === 'status' && isset($_GET['id'])) {
        requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        updateBookingStatus($db, (string)$_GET['id'], $input);
    }

    if ($method === 'DELETE' && isset($_GET['id'])) {
        requireAdmin();
        deleteBooking($db, (string)$_GET['id']);
    }

    jsonResponse(['success' => false, 'error' => 'Invalid booking request'], 400);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Booking request failed'], 500);
}

function getAllBookings(Database $db, mixed $status = null): void
{
    $sql = "SELECT b.*, f.name AS facility_name, f.icon
            FROM bookings b
            LEFT JOIN facilities f ON b.facility_id = f.id";
    $params = [];

    if ($status && in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
        $sql .= ' WHERE b.status = ?';
        $params[] = $status;
    }

    $sql .= ' ORDER BY b.created_at DESC';
    $bookings = array_map('formatBookingForFrontend', $db->fetchAll($sql, $params));
    jsonResponse(['success' => true, 'data' => $bookings]);
}

function getUserBookings(Database $db, string $email): void
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'Valid email required'], 400);
    }

    if (empty($_SESSION['user_email']) || strtolower((string)$_SESSION['user_email']) !== strtolower($email)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $bookings = $db->fetchAll(
        "SELECT b.*, f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.email = ?
         ORDER BY b.created_at DESC",
        [$email]
    );

    jsonResponse(['success' => true, 'data' => array_map('formatBookingForFrontend', $bookings)]);
}

function getBookingByRef(Database $db, string $ref): void
{
    $booking = $db->fetchOne(
        "SELECT b.*, f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_ref = ?",
        [$ref]
    );

    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    jsonResponse(['success' => true, 'data' => formatBookingForFrontend($booking)]);
}

function createBooking(Database $db): void
{
    $data = $_POST ?: (json_decode(file_get_contents('php://input'), true) ?? []);
    $errors = validateBookingData($data);

    if ($errors) {
        jsonResponse(['success' => false, 'error' => 'Validation failed', 'details' => $errors], 400);
    }

    $paymentFile = null;
    if (!empty($_FILES['payment_file']) && $_FILES['payment_file']['error'] === UPLOAD_ERR_OK) {
        $upload = handlePaymentUpload($_FILES['payment_file']);
        if (!empty($upload['error'])) {
            jsonResponse(['success' => false, 'error' => $upload['error']], 400);
        }
        $paymentFile = $upload['filename'];
    }

    $ref = generateBookingRef();
    $facility = $db->fetchOne('SELECT name FROM facilities WHERE id = ?', [$data['facility_id']]);
    $packageOnlyFacilities = ['dewan utama', 'dewan syarahan', 'bilik persidangan', 'bilik seminar'];
    if ($facility && in_array(strtolower((string)$facility['name']), $packageOnlyFacilities, true)) {
        $data['setup_required'] = 'full';
    }

    $existingUser = $db->fetchOne('SELECT id FROM users WHERE email = ?', [$data['email']]);
    $userId = $existingUser ? (int)$existingUser['id'] : null;

    if (!$userId) {
        $userId = (int)$db->insert(
            'INSERT INTO users (email, full_name, phone, role) VALUES (?, ?, ?, ?)',
            [$data['email'], $data['full_name'], $data['phone'], 'user']
        );
    } else {
        $db->update(
            "UPDATE users SET full_name = ?, phone = ?, role = 'user' WHERE id = ? AND role = 'user'",
            [$data['full_name'], $data['phone'], $userId]
        );
    }

    $db->insert(
        "INSERT INTO bookings (
            booking_ref, user_id, facility_id, full_name, organization, email, phone,
            booking_date, start_time, end_time, duration, purpose, participant_count,
            setup_required, payment_file, status, estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $ref,
            $userId,
            $data['facility_id'],
            $data['full_name'],
            $data['organization'] ?? '',
            $data['email'],
            $data['phone'],
            $data['booking_date'],
            $data['start_time'],
            $data['end_time'] ?? null,
            $data['duration'] ?? '1',
            $data['purpose'],
            $data['participant_count'] ?? 0,
            $data['setup_required'] ?? 'none',
            $paymentFile,
            'pending',
            $data['estimated_cost'] ?? 0,
        ]
    );

    jsonResponse(['success' => true, 'message' => 'Booking created successfully', 'booking_ref' => $ref]);
}

function updateBookingStatus(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    $adminNote = $data['admin_note'] ?? '';

    if (!in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid status'], 400);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $db->update("UPDATE bookings SET status = ?, admin_note = ? WHERE {$field} = ?", [$status, $adminNote, $id]);
    jsonResponse(['success' => true, 'message' => 'Booking status updated']);
}

function deleteBooking(Database $db, string $id): void
{
    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT payment_file FROM bookings WHERE {$field} = ?", [$id]);

    if ($booking && !empty($booking['payment_file'])) {
        $path = UPLOAD_DIR . basename((string)$booking['payment_file']);
        if (is_file($path)) {
            unlink($path);
        }
    }

    $db->update("DELETE FROM bookings WHERE {$field} = ?", [$id]);
    jsonResponse(['success' => true, 'message' => 'Booking deleted successfully']);
}

function getDashboardStats(Database $db): void
{
    $total = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings');
    $pending = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending'");
    $approved = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'approved'");
    $today = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE()');

    jsonResponse([
        'success' => true,
        'data' => [
            'total' => (int)$total['count'],
            'pending' => (int)$pending['count'],
            'approved' => (int)$approved['count'],
            'today' => (int)$today['count'],
        ],
    ]);
}

function getPublicStats(Database $db): void
{
    $today = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE()');
    jsonResponse(['success' => true, 'data' => ['today' => (int)$today['count']]]);
}

function getPublicCalendarBookings(Database $db): void
{
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');

    if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
        jsonResponse(['success' => false, 'error' => 'Invalid calendar month'], 400);
    }

    $start = sprintf('%04d-%02d-01', $year, $month);
    $end = date('Y-m-t', strtotime($start));
    $rows = $db->fetchAll(
        "SELECT b.booking_ref, b.facility_id, b.booking_date, b.start_time, b.end_time, b.status,
                f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_date BETWEEN ? AND ?
           AND b.status IN ('pending', 'approved')
         ORDER BY b.booking_date ASC, b.start_time ASC",
        [$start, $end]
    );

    $bookings = array_map(static function (array $booking): array {
        return [
            'id' => $booking['booking_ref'],
            'facilityId' => (string)$booking['facility_id'],
            'date' => $booking['booking_date'],
            'start' => substr((string)$booking['start_time'], 0, 5),
            'end' => $booking['end_time'] ? substr((string)$booking['end_time'], 0, 5) : '',
            'status' => $booking['status'],
            'facilityName' => $booking['facility_name'] ?? 'Fasiliti',
            'facilityIcon' => '<i class="bi ' . htmlspecialchars($booking['icon'] ?? 'bi-building', ENT_QUOTES, 'UTF-8') . '"></i>',
        ];
    }, $rows);

    jsonResponse(['success' => true, 'data' => $bookings]);
}
?>
