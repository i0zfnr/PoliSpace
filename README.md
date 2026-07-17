# PoliSpace

PoliSpace is a facility booking system with static HTML pages, a PHP REST API, MySQL persistence, and payment proof uploads.

## Project Structure

```text
PoliSpace/
  index.html
  booking.html
  status.html
  dashboard.html
  login.html
  admin-login.html
  admin-dashboard.html
  style.css
  script.js
  backend/
    config.php
    db.php
    api/
      auth.php
      bookings.php
      facilities.php
      messages.php
      users.php
    includes/
      functions.php
      validation.php
  database/
    polspace.sql
  uploads/
    payments/
```

## Local Setup

1. Put this folder under your Laragon web root:

```text
C:\laragon\www\PoliSpace
```
2. Create/import the database:

```bash
mysql -u root -p < database/polspace.sql
```

3. Update database credentials in `backend/config.php` if your MySQL user is not `root` with an empty password.
4. Make sure `uploads/payments` is writable by PHP.
5. Open the app through a web server, not directly as `file://`:

```text
http://localhost/PoliSpace/index.html
```

## Default Login

```text
Admin email: admin@polspace.com
Password: admin123
```

The frontend keeps a localStorage fallback so the pages still preview without PHP/MySQL, but the full system requires PHP and MySQL.

If you imported an older SQL seed and admin login still fails, re-import `database/polspace.sql` or run:

```sql
UPDATE users
SET password = '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56',
    full_name = 'Administrator',
    role = 'admin'
WHERE email = 'admin@polspace.com';
```

## Main API Endpoints

```text
POST   backend/api/auth.php?action=login
POST   backend/api/auth.php?action=user
GET    backend/api/facilities.php
PUT    backend/api/facilities.php?id=1
GET    backend/api/bookings.php
POST   backend/api/bookings.php
GET    backend/api/bookings.php?action=ref&ref=PS...
GET    backend/api/bookings.php?action=user&email=user@example.com
PUT    backend/api/bookings.php?action=status&id=PS...
POST   backend/api/messages.php
GET    backend/api/messages.php
```

## Production Notes

Change the default admin password, use HTTPS, restrict CORS, add CSRF protection, and use a limited MySQL user instead of `root`.

## Agent Handoff

See [HANDOFF.md](HANDOFF.md) for the implementation workflow, current auth/login fixes, verification commands, and known caveats for the next Codex agent.
