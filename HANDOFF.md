# PoliSpace Handoff

This document is for the next Codex agent working on the PoliSpace project.

## Current State

PoliSpace started as a static HTML/CSS/JS booking prototype. It has been extended into a PHP/MySQL-backed app while keeping a localStorage fallback so the UI can still preview when PHP/MySQL is unavailable.

The project is in:

```text
C:\laragon\www\PoliSpace
```

Main files:

```text
index.html                 Landing page
booking.html               Booking form
status.html                Public booking status lookup
dashboard.html             User dashboard
login.html                 Combined admin/user login
admin-login.html           Legacy/simple admin login
admin-dashboard.html       Admin dashboard
style.css                  Global styles
script.js                  Frontend app logic
backend/config.php         DB/app/session config
backend/db.php             PDO database helper
backend/api/auth.php       Login/user auth/logout API
backend/api/bookings.php   Booking API
backend/api/facilities.php Facilities API
backend/api/messages.php   Contact messages API
backend/api/users.php      Admin users list API
database/polspace.sql      MySQL schema and seed data
uploads/payments/          Payment proof uploads
README.md                  User setup notes
HANDOFF.md                 This handoff
```

## Workflow Overview

### Public User Flow

1. User opens `index.html`.
2. `script.js` loads facilities from `backend/api/facilities.php`.
3. If API fails, it falls back to hardcoded facilities in `script.js`.
4. User creates a booking in `booking.html`.
5. Booking submission posts `FormData` to `backend/api/bookings.php`.
6. Payment proof is uploaded as `payment_file` into `uploads/payments/`.
7. Backend creates a `booking_ref`.
8. User can check the ref in `status.html`.
9. User dashboard uses email to query `backend/api/bookings.php?action=user&email=...`.

### Admin Flow

1. Admin opens `login.html` and selects Admin.
2. Frontend calls `backend/api/auth.php?action=login`.
3. Default credentials:

```text
admin@polspace.com
admin123
```

4. Successful login sets PHP session and frontend `localStorage.ps_admin_logged_in = 1`.
5. Admin dashboard then loads:
   - Stats: `backend/api/bookings.php?action=stats`
   - All bookings: `backend/api/bookings.php`
   - Facilities: `backend/api/facilities.php`
6. Admin can approve/reject bookings through:

```text
PUT backend/api/bookings.php?action=status&id=<booking_ref>
```

7. Admin can toggle facility availability through:

```text
PUT backend/api/facilities.php?id=<facility_id>
```

## Important Auth Notes

`backend/api/auth.php` was adjusted because the browser was repeatedly seeing `405` from `auth.php?action=login`.

Current behavior:

- `OPTIONS` returns success for preflight.
- The endpoint no longer hard-fails non-POST requests before reading the action.
- Input is read from `$_POST`, then `$_GET`, then JSON body.
- This makes the endpoint tolerant while debugging local server/proxy behavior.

The frontend auth call in `script.js` uses a `FormData` POST with a timestamp cache-buster:

```js
fetch(`${API_BASE}/auth.php?action=${encodeURIComponent(action)}&t=${Date.now()}`, {
  method: 'POST',
  body: formData,
  credentials: 'include',
  cache: 'no-store',
});
```

Login pages use:

```html
<script src="script.js?v=20260717-loginfix2"></script>
```

If the browser still shows old behavior, verify that this exact script URL is loaded in DevTools Network.

## Database Notes

Schema is in `database/polspace.sql`.

The admin seed hash was fixed. The original hash did not verify against `admin123`, and the old `ON DUPLICATE KEY UPDATE email = email` did not repair existing rows.

Current seed updates the admin row on re-import:

```sql
INSERT INTO users (email, password, full_name, role)
VALUES ('admin@polspace.com', '<valid admin123 bcrypt hash>', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE
    password = VALUES(password),
    full_name = VALUES(full_name),
    role = VALUES(role);
```

If an old DB still exists, run:

```sql
UPDATE users
SET password = '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56',
    full_name = 'Administrator',
    role = 'admin'
WHERE email = 'admin@polspace.com';
```

## Local Verification

With Laragon running Apache and MySQL, open:

```text
http://localhost/PoliSpace/login.html
```

If using the PHP built-in server instead of Laragon Apache, run from project root:

```powershell
php -S 127.0.0.1:8080
```

Syntax checks:

```powershell
node --check script.js
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```

Auth endpoint test:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Method Post `
  -ContentType 'application/x-www-form-urlencoded' `
  -Body 'email=admin%40polspace.com&password=admin123' `
  'http://127.0.0.1:8080/backend/api/auth.php?action=login'
```

Expected:

```json
{"success":true,"message":"Login successful","user":{"id":1,"name":"Administrator","email":"admin@polspace.com"}}
```

## Known Caveats

- The project now lives under Laragon at `C:\laragon\www\PoliSpace`.
- Full API behavior requires Laragon MySQL running, importing `database/polspace.sql`, and matching credentials in `backend/config.php`.
- `script.js` still contains localStorage fallback paths. This is intentional for preview mode, but should be removed or clearly disabled for production.
- `dashboard.html` still contains a legacy inline dashboard script. The shared `script.js` is loaded after it so the newer handlers win. A future cleanup should remove the legacy inline block completely.
- Browser visual QA could not be completed through the in-app browser because no browser surface was available in this session.

## Suggested Next Tasks

1. Confirm whether the user is running via Apache/XAMPP, PHP built-in server, or another local server.
2. If login still fails in browser, inspect DevTools Network:
   - Request URL
   - Request Method
   - Response body
   - Loaded script URL/version
3. Remove the legacy inline script block from `dashboard.html` to reduce duplicate function definitions.
4. Replace localStorage admin fallback with true session-only auth once backend setup is stable.
5. Add stronger production security:
   - Restrict CORS
   - CSRF token for state-changing API calls
   - HTTPS-only secure session cookies
   - Upload file scanning and non-web-root storage
   - Limited MySQL user
