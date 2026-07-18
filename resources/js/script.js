// ==================== API CONFIGURATION ====================
const APP_ROOT = '/PoliSpace';
const ROUTES = {
  home: `${APP_ROOT}/resources/views/welcome.html`,
  booking: `${APP_ROOT}/resources/views/booking/index.html`,
  status: `${APP_ROOT}/resources/views/status/index.html`,
  login: `${APP_ROOT}/resources/views/auth/login.html`,
  signup: `${APP_ROOT}/resources/views/auth/signup.html`,
  dashboard: `${APP_ROOT}/resources/views/dashboard/index.html`,
  adminDashboard: `${APP_ROOT}/resources/views/admin/dashboard.html`,
  adminLogin: `${APP_ROOT}/resources/views/admin/login.html`,
};
const API_BASE = `${APP_ROOT}/backend/api`;
let apiOnline = true;
let facilitiesCache = [];
let landingCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let bookingCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const FALLBACK_FACILITIES = [
  { id: 1, name: 'Dewan Utama', icon: 'bi-bank', capacity: 800, price_per_hour: 450, description: 'Kemudahan: Econ, PA system, projector.', is_available: true },
  { id: 2, name: 'Dewan Syarahan', icon: 'bi-mortarboard', capacity: 120, price_per_hour: 400, description: 'Kemudahan: Econ, PA system, projector.', is_available: true },
  { id: 3, name: 'Bilik Persidangan', icon: 'bi-people', capacity: 60, price_per_hour: 350, description: 'Kemudahan: LCD, projector, econ.', is_available: true },
  { id: 4, name: 'Bilik Seminar', icon: 'bi-easel', capacity: 45, price_per_hour: 250, description: 'Kemudahan: TV besar, econ.', is_available: true },
];

// ==================== API HELPERS ====================
async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method, credentials: 'include', headers: {} };
  if (data !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.error || 'API request failed');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function tryApi(endpoint, method = 'GET', data = null) {
  if (!apiOnline) throw new Error('API offline');
  try {
    return await apiRequest(endpoint, method, data);
  } catch (error) {
    apiOnline = false;
    throw error;
  }
}

async function loadFacilities() {
  try {
    const result = await tryApi('facilities.php');
    facilitiesCache = normalizeFacilities(result.data || []);
  } catch (error) {
    facilitiesCache = normalizeFacilities(FALLBACK_FACILITIES);
  }
  return facilitiesCache;
}

async function createBookingApi(data) {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    formData.append(key, data[key]);
  });

  const response = await fetch(`${API_BASE}/bookings.php`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error || 'Failed to create booking');
  }
  return result;
}

async function adminLogin(email, password) {
  return await authRequest('login', { email, password });
}

async function userLogin(email) {
  const password = document.getElementById('user-pass')?.value || '';
  return await authRequest('user', { email, password });
}

async function authRequest(action, data) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => formData.append(key, value));

  const response = await fetch(`${API_BASE}/auth.php?action=${encodeURIComponent(action)}&t=${Date.now()}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.error || 'API request failed');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function autoLogin(email, password) {
  return await authRequest('auto', { email, password });
}

async function signupClient(data) {
  return await authRequest('signup', data);
}

// ==================== LOCAL FALLBACK ====================
function getBookings() {
  return JSON.parse(localStorage.getItem('ps_bookings') || '[]');
}

function saveBookings(bookings) {
  localStorage.setItem('ps_bookings', JSON.stringify(bookings));
}

function generateId() {
  return 'PS-' + String(getBookings().length + 1).padStart(4, '0');
}

function ensureFallbackSeed() {
  if (getBookings().length > 0) return;
  saveBookings([{
    id: 'PS-0001',
    booking_ref: 'PS-0001',
    name: 'Ahmad Faris',
    org: 'Kelab Sukan',
    email: 'a@poli.my',
    phone: '012-345',
    facilityId: '1',
    facilityName: 'Dewan Utama',
    facilityIcon: '<i class="bi bi-bank"></i>',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    start: '09:00',
    end: '13:00',
    duration: '4',
    purpose: 'Majlis',
    setup: 'full',
    pax: '300',
    paymentFile: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    adminNote: '',
  }]);
}

// ==================== AUTH ====================
async function doAutoLogin() {
  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  const errorEl = document.getElementById('loginError');

  if (errorEl) errorEl.classList.remove('show');

  if (!isValidEmail(email) || !password) {
    if (errorEl) {
      errorEl.textContent = 'Sila masukkan e-mel dan kata laluan yang sah.';
      errorEl.classList.add('show');
    } else {
      showToast('Sila masukkan e-mel dan kata laluan yang sah.', 'error');
    }
    return;
  }

  try {
    const result = await autoLogin(email, password);
    if (result.role === 'admin') {
      localStorage.setItem('ps_admin_logged_in', '1');
      localStorage.removeItem('ps_user_email');
    } else {
      localStorage.removeItem('ps_admin_logged_in');
      localStorage.setItem('ps_user_email', result.email || email);
    }
    window.location.href = result.role === 'admin' ? ROUTES.adminDashboard : ROUTES.dashboard;
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'E-mel atau kata laluan tidak sah.';
      errorEl.classList.add('show');
    } else {
      showToast(error.message || 'Log masuk gagal.', 'error');
    }
  }
}

async function doLogin() {
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const errorEl = document.getElementById('loginError');
  const rawUser = userEl?.value.trim() || '';
  const password = passEl?.value || '';
  const email = rawUser.includes('@') ? rawUser : 'admin@polspace.com';

  try {
    await adminLogin(email, password);
    localStorage.setItem('ps_admin_logged_in', '1');
    window.location.href = ROUTES.adminDashboard;
  } catch (error) {
    if ((!error.status || error.status === 405 || error.status >= 500) && (rawUser === 'admin' || rawUser === 'admin@polspace.com') && password === 'admin123') {
      localStorage.setItem('ps_admin_logged_in', '1');
      window.location.href = ROUTES.adminDashboard;
      return;
    }
    if (errorEl) {
      errorEl.classList.add('show');
      errorEl.style.display = 'block';
    }
  }
}

async function doUserLogin() {
  const email = document.getElementById('user-email')?.value.trim() || '';
  const password = document.getElementById('user-pass')?.value || '';
  if (!isValidEmail(email)) {
    showToast('Sila masukkan alamat e-mel yang sah.', 'error');
    return;
  }
  if (!password) {
    showToast('Sila masukkan kata laluan pelanggan.', 'error');
    return;
  }

  try {
    await userLogin(email);
    localStorage.setItem('ps_user_email', email);
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    showToast(error.message || 'Log masuk pengguna gagal.', 'error');
    return;
  }
}

function doLogout() {
  localStorage.removeItem('ps_admin_logged_in');
  window.location.href = ROUTES.home;
}

function logoutUser() {
  localStorage.removeItem('ps_user_email');
  window.location.href = ROUTES.login;
}

// ==================== FACILITIES ====================
function normalizeFacilities(facilities) {
  return facilities.map((f) => ({
    id: String(f.id),
    name: f.name,
    icon: f.icon || 'bi-building',
    capacity: Number(f.capacity || f.cap || 0),
    price_per_hour: Number(f.price_per_hour || f.pricePerHour || 0),
    description: f.description || f.desc || '',
    is_available: Boolean(Number(f.is_available ?? f.available ?? 1)),
  }));
}

function facilityIconHtml(facility) {
  return `<i class="bi ${escapeAttr(facility.icon)}"></i>`;
}

async function renderFacilities() {
  const grid = document.getElementById('facilitiesGrid');
  if (!grid) return;

  const facilities = await loadFacilities();
  grid.innerHTML = facilities.map((f) => `
    <div class="facility-card" onclick="selectFacilityAndBook('${escapeAttr(f.id)}')">
      <div class="facility-card-accent"></div>
      <div class="facility-arrow"><i class="bi bi-arrow-up-right"></i></div>
      <div class="facility-icon">${facilityIconHtml(f)}</div>
      <div class="facility-name">${escapeHtml(f.name)}</div>
      <div class="facility-desc">${escapeHtml(f.description)}</div>
      <div class="facility-meta">
        <div class="facility-cap">Kapasiti: <span>${f.capacity} orang</span></div>
        <div class="${f.is_available ? 'status-badge status-available' : 'status-badge status-booked'}">
          ${f.is_available ? '<i class="bi bi-check-circle"></i> Tersedia' : '<i class="bi bi-x-circle"></i> Ditempah'}
        </div>
      </div>
    </div>
  `).join('');

  setText('stat-facilities', facilities.filter((f) => f.is_available).length);
  try {
    const stats = await tryApi('bookings.php?action=public-stats');
    setText('stat-bookings', stats.data.today);
  } catch (error) {
    const today = new Date().toISOString().split('T')[0];
    setText('stat-bookings', getBookings().filter((b) => b.date === today).length);
  }
}

function selectFacilityAndBook(fid) {
  localStorage.setItem('ps_selected_facility', fid);
  window.location.href = ROUTES.booking;
}

async function loadPublicCalendarBookings(year, month) {
  try {
    const result = await apiRequest(`bookings.php?action=calendar&year=${year}&month=${month}`);
    return result.data || [];
  } catch (error) {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    return getBookings()
      .filter((b) => (b.date || '').startsWith(monthPrefix))
      .filter((b) => ['pending', 'approved'].includes(b.status))
      .map((b) => ({
        id: b.id || b.booking_ref,
        facilityId: b.facilityId || b.facility_id || '',
        date: b.date,
        start: b.start,
        end: b.end,
        status: b.status,
        facilityName: b.facilityName || 'Fasiliti',
        facilityIcon: b.facilityIcon || '<i class="bi bi-building"></i>',
      }));
  }
}

async function renderLandingCalendar() {
  const calendar = document.getElementById('landingCalendar');
  const title = document.getElementById('landingCalendarTitle');
  const list = document.getElementById('landingCalendarList');
  if (!calendar || !title || !list) return;

  const year = landingCalendarDate.getFullYear();
  const month = landingCalendarDate.getMonth();
  const displayMonth = month + 1;
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const weekdays = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
  const bookings = await loadPublicCalendarBookings(year, displayMonth);
  const bookingsByDate = bookings.reduce((groups, booking) => {
    if (!groups[booking.date]) groups[booking.date] = [];
    groups[booking.date].push(booking);
    return groups;
  }, {});

  title.textContent = `${monthNames[month]} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let html = weekdays.map((day) => `<div class="landing-calendar-weekday">${day}</div>`).join('');

  for (let i = 0; i < firstDay; i += 1) {
    html += '<div class="landing-calendar-blank"></div>';
  }

  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(displayMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookingsByDate[date] || [];
    const bookedFacilityCount = new Set(dayBookings.map((booking) => String(booking.facilityId || '')).filter(Boolean)).size;
    const availableFacilityCount = facilitiesCache.filter((facility) => facility.is_available).length || facilitiesCache.length || 4;
    const isFullyBooked = bookedFacilityCount >= availableFacilityCount;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const markers = dayBookings.slice(0, 4).map((booking) =>
      `<span class="landing-calendar-marker ${escapeAttr(booking.status)}"></span>`
    ).join('');
    const fullMarker = isFullyBooked ? '<span class="landing-calendar-marker full"></span>' : '';
    const calendarDayClass = `landing-calendar-day${isToday ? ' today' : ''}${dayBookings.length ? ' has-booking' : ''}${isFullyBooked ? ' fully-booked' : ''}`;
    html += `
      <div class="${calendarDayClass}" title="${isFullyBooked ? 'Penuh' : dayBookings.length ? `${dayBookings.length} tempahan` : ''}">
        <div class="landing-calendar-date">${day}</div>
        <div class="landing-calendar-markers">${isFullyBooked ? fullMarker : markers}</div>
      </div>
    `;
  }

  calendar.innerHTML = html;
  const visibleBookings = bookings
    .slice()
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .slice(0, 4);

  if (!visibleBookings.length) {
    list.innerHTML = '<div class="landing-calendar-empty">Tiada tempahan untuk bulan ini.</div>';
    return;
  }

  list.innerHTML = visibleBookings.map((booking) => `
    <div class="landing-calendar-event">
      <div>${booking.facilityIcon || '<i class="bi bi-building"></i>'}</div>
      <div>
        <div class="landing-calendar-event-title">${escapeHtml(booking.facilityName)}</div>
        <div class="landing-calendar-event-meta">${formatDate(booking.date)} - ${escapeHtml(booking.start)}${booking.end ? ` - ${escapeHtml(booking.end)}` : ''}</div>
      </div>
      ${statusBadgeHtml(booking.status)}
    </div>
  `).join('');
}

async function renderPublicCalendarView() {
  const calendar = document.getElementById('calendarView');
  if (!calendar || document.getElementById('admin')) return;

  const year = bookingCalendarDate.getFullYear();
  const month = bookingCalendarDate.getMonth() + 1;
  let bookings = [];
  try {
    bookings = await loadPublicCalendarBookings(year, month);
  } catch (error) {
    bookings = getBookings();
  }
  renderCalendar(bookings, bookingCalendarDate);
}

function changeLandingCalendarMonth(delta) {
  landingCalendarDate = new Date(landingCalendarDate.getFullYear(), landingCalendarDate.getMonth() + delta, 1);
  renderLandingCalendar();
}

async function refreshBookingCalendar() {
  const calendar = document.getElementById('calendarView');
  if (!calendar) return;

  if (!document.getElementById('admin')) {
    await renderPublicCalendarView();
    return;
  }

  let bookings = [];
  try {
    const result = await tryApi('bookings.php');
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings();
  }
  renderCalendar(bookings, bookingCalendarDate);
}

function changeBookingCalendarMonth(delta) {
  bookingCalendarDate = new Date(bookingCalendarDate.getFullYear(), bookingCalendarDate.getMonth() + delta, 1);
  refreshBookingCalendar();
}

function resetBookingCalendarMonth() {
  const now = new Date();
  bookingCalendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
  refreshBookingCalendar();
}

async function populateBookingFacilities() {
  const select = document.getElementById('f-facility');
  if (!select) return;

  const facilities = await loadFacilities();
  select.innerHTML = '<option value="">-- Pilih Fasiliti --</option>' + facilities.map((f) =>
    `<option value="${escapeAttr(f.id)}" ${!f.is_available ? 'disabled' : ''}>${escapeHtml(f.name)}${!f.is_available ? ' (Tidak Tersedia)' : ''}</option>`
  ).join('');

  const list = document.getElementById('facilitySelectorList');
  if (list) {
    list.innerHTML = facilities.map((f) => `
      <div class="facility-select-item" data-fid="${escapeAttr(f.id)}" onclick="sidebarSelectFacility('${escapeAttr(f.id)}')">
        <div>
          <div class="fsi-name">${facilityIconHtml(f)} ${escapeHtml(f.name)}</div>
          <div class="fsi-cap">Maks. ${f.capacity} orang - RM${f.price_per_hour}</div>
        </div>
        <div class="${f.is_available ? 'status-badge status-available' : 'status-badge status-booked'}" style="font-size:10px">
          ${f.is_available ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-x-lg"></i>'}
        </div>
      </div>
    `).join('');
  }

  const selected = localStorage.getItem('ps_selected_facility');
  if (selected) {
    select.value = selected;
    localStorage.removeItem('ps_selected_facility');
  }
  updateFacilityInfo();
}

function sidebarSelectFacility(fid) {
  document.getElementById('f-facility').value = fid;
  updateFacilityInfo();
}

function updateFacilityInfo() {
  const fid = document.getElementById('f-facility')?.value || '';
  document.querySelectorAll('.facility-select-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.fid === fid);
  });
  updateSetupOptions();
  updatePricing();
}

function getSelectedFacility() {
  const fid = document.getElementById('f-facility')?.value || '';
  return facilitiesCache.find((f) => f.id === fid);
}

function updateSetupOptions() {
  const setup = document.getElementById('f-setup');
  if (!setup) return;

  const facility = getSelectedFacility();
  const packageOnlyFacilities = ['dewan utama', 'dewan syarahan', 'bilik persidangan', 'bilik seminar'];
  const isPackageOnly = packageOnlyFacilities.includes(facility?.name?.toLowerCase() || '');
  const options = isPackageOnly
    ? [{ value: 'full', label: 'Pakej Lengkap' }]
    : [
      { value: 'none', label: 'Tiada' },
      { value: 'projector', label: 'Projektor' },
      { value: 'sound', label: 'Sistem Bunyi' },
      { value: 'tables', label: 'Meja & Kerusi' },
      { value: 'full', label: 'Pakej Lengkap' },
    ];

  const currentValue = setup.value;
  setup.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  setup.value = options.some((option) => option.value === currentValue) ? currentValue : options[0].value;
}

function calculateCost() {
  const facility = getSelectedFacility();
  const base = facility ? facility.price_per_hour : 0;
  const extra = 0;
  return { base, extra, total: base + extra };
}

function updatePricing() {
  const pricing = document.getElementById('pricingBreakdown');
  if (!pricing) return;
  const cost = calculateCost();
  pricing.innerHTML = `
    <div class="pricing-row"><span>Fasiliti</span><span>RM ${cost.base}</span></div>
    <div class="pricing-row"><span>Persediaan</span><span>Pakej Lengkap</span></div>
    <div class="pricing-row total"><span>Jumlah</span><span class="price">RM ${cost.total}</span></div>
  `;
}

// ==================== BOOKING FORM ====================
function setMinDate() {
  const el = document.getElementById('f-date');
  if (el) el.min = new Date().toISOString().split('T')[0];
}

function updateEndTime() {
  const start = document.getElementById('f-start')?.value;
  const duration = document.getElementById('f-duration')?.value || '1';
  if (!start) return;
  const durationMap = { '1': 60, '2': 120, '3': 180, '4': 240, halfday: 240, fullday: 480 };
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + (durationMap[duration] || 60);
  document.getElementById('f-end').value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function submitBooking() {
  const data = {
    full_name: document.getElementById('f-name')?.value.trim() || '',
    organization: '',
    email: document.getElementById('f-email')?.value.trim() || '',
    phone: document.getElementById('f-phone')?.value.trim() || '',
    facility_id: document.getElementById('f-facility')?.value || '',
    booking_date: document.getElementById('f-date')?.value || '',
    start_time: document.getElementById('f-start')?.value || '',
    end_time: document.getElementById('f-end')?.value || '',
    duration: document.getElementById('f-duration')?.value || '1',
    purpose: document.getElementById('f-purpose')?.value.trim() || '',
    participant_count: document.getElementById('f-pax')?.value || 0,
    setup_required: document.getElementById('f-setup')?.value || 'none',
    estimated_cost: calculateCost().total,
  };

  if (!data.full_name || !data.email || !data.phone || !data.facility_id || !data.booking_date || !data.start_time || !data.purpose) {
    showToast('Sila lengkapkan semua maklumat yang diperlukan.', 'error');
    return;
  }
  if (!isValidEmail(data.email)) {
    showToast('Format e-mel tidak sah.', 'error');
    return;
  }
  try {
    const result = apiOnline ? await createBookingApi(data) : null;
    redirectToSignup(result?.booking_ref, data);
  } catch (error) {
    apiOnline = false;
    const facility = getSelectedFacility();
    const id = generateId();
    const booking = {
      id,
      booking_ref: id,
      name: data.full_name,
      org: data.organization,
      email: data.email,
      phone: data.phone,
      facilityId: data.facility_id,
      facilityName: facility?.name || '',
      facilityIcon: facility ? facilityIconHtml(facility) : '',
      date: data.booking_date,
      start: data.start_time,
      end: data.end_time,
      duration: data.duration,
      purpose: data.purpose,
      setup: data.setup_required,
      pax: data.participant_count || '-',
      paymentFile: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      adminNote: '',
    };
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);
    redirectToSignup(id, data);
  }
}

function showBookingSuccess(ref) {
  document.getElementById('booking-form-wrap').style.display = 'none';
  document.getElementById('successScreen').classList.add('show');
  setText('refCode', ref || '');
}

function redirectToSignup(ref, bookingData) {
  localStorage.setItem('ps_pending_signup_ref', ref || '');
  localStorage.setItem('ps_pending_signup_email', bookingData.email || '');
  const params = new URLSearchParams({
    ref: ref || '',
    email: bookingData.email || '',
    name: bookingData.full_name || '',
    phone: bookingData.phone || '',
  });
  window.location.href = `${ROUTES.signup}?${params.toString()}`;
}

async function doSignup() {
  const fullName = document.getElementById('signup-name')?.value.trim() || '';
  const phone = document.getElementById('signup-phone')?.value.trim() || '';
  const email = document.getElementById('signup-email')?.value.trim() || '';
  const password = document.getElementById('signup-password')?.value || '';
  const passwordConfirm = document.getElementById('signup-password-confirm')?.value || '';
  const errorEl = document.getElementById('signupError');

  if (errorEl) errorEl.classList.remove('show');

  if (!fullName || !phone || !isValidEmail(email) || password.length < 6 || password !== passwordConfirm) {
    const message = password !== passwordConfirm ? 'Kata laluan pengesahan tidak sama.' : 'Sila lengkapkan semua ruangan dengan betul.';
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    } else {
      showToast(message, 'error');
    }
    return;
  }

  try {
    const result = await signupClient({
      full_name: fullName,
      phone,
      email,
      password,
      password_confirm: passwordConfirm,
    });
    localStorage.setItem('ps_user_email', result.email || email);
    localStorage.removeItem('ps_admin_logged_in');
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Pendaftaran gagal.';
      errorEl.classList.add('show');
    } else {
      showToast(error.message || 'Pendaftaran gagal.', 'error');
    }
  }
}

function initSignupPage() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || localStorage.getItem('ps_pending_signup_ref') || '';
  const email = params.get('email') || localStorage.getItem('ps_pending_signup_email') || '';
  const name = params.get('name') || '';
  const phone = params.get('phone') || '';

  setText('signupRef', ref || '-');
  const emailEl = document.getElementById('signup-email');
  const nameEl = document.getElementById('signup-name');
  const phoneEl = document.getElementById('signup-phone');
  if (emailEl) emailEl.value = email;
  if (nameEl) nameEl.value = name;
  if (phoneEl) phoneEl.value = phone;
}

function resetBookingForm() {
  document.getElementById('booking-form-wrap').style.display = '';
  document.getElementById('successScreen').classList.remove('show');
  ['f-name', 'f-email', 'f-phone', 'f-facility', 'f-date', 'f-start', 'f-end', 'f-purpose', 'f-pax'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  updateSetupOptions();
  updatePricing();
}

// ==================== STATUS PAGE ====================
async function checkStatus() {
  const ref = document.getElementById('statusInput')?.value.trim().toUpperCase() || '';
  const card = document.getElementById('statusResultCard');
  if (!ref || !card) return;

  try {
    const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(ref)}`);
    renderStatusCard(result.data, card);
  } catch (error) {
    const booking = getBookings().find((b) => (b.id || b.booking_ref) === ref);
    if (!booking) {
      showToast('Nombor rujukan tidak dijumpai.', 'error');
      card.classList.remove('show');
      return;
    }
    renderStatusCard(booking, card);
  }
}

function renderStatusCard(booking, card) {
  card.classList.add('show');
  setText('statusRef', booking.id || booking.booking_ref);
  document.getElementById('statusBadge').innerHTML = statusBadgeHtml(booking.status);
  document.getElementById('statusDetails').innerHTML = `
    <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Fasiliti</span><span class="detail-value" style="display:flex;align-items:center;gap:6px">${booking.facilityIcon || ''} ${escapeHtml(booking.facilityName)}</span></div>
    <div class="detail-row"><span class="detail-label">Tarikh</span><span class="detail-value">${formatDate(booking.date)}</span></div>
    <div class="detail-row"><span class="detail-label">Masa</span><span class="detail-value">${escapeHtml(booking.start)} - ${escapeHtml(booking.end || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose)}</span></div>
    ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Admin</span><span class="detail-value" style="color:var(--amber)">${escapeHtml(booking.adminNote)}</span></div>` : ''}
  `;

  const steps = [
    { label: 'Permohonan Dihantar', done: true, time: formatDateTime(booking.createdAt) },
    { label: 'Semakan Permohonan', done: booking.status !== 'pending', active: booking.status === 'pending', time: booking.status !== 'pending' ? 'Selesai' : 'Dalam proses...' },
    { label: booking.status === 'rejected' ? 'Permohonan Ditolak' : 'Tempahan Disahkan', done: booking.status === 'approved', active: booking.status === 'rejected', time: booking.status === 'approved' ? 'E-mel pengesahan dihantar' : booking.status === 'rejected' ? 'Sila hubungi pentadbir' : 'Menunggu' },
  ];
  document.getElementById('statusTimeline').innerHTML = steps.map((s) => `
    <div class="timeline-step">
      <div class="timeline-dot ${s.done ? 'done' : s.active ? 'active' : 'pending'}">${s.done ? '<i class="bi bi-check-lg"></i>' : s.active ? '<i class="bi bi-three-dots"></i>' : '<i class="bi bi-circle"></i>'}</div>
      <div class="timeline-content"><div class="timeline-label">${s.label}</div><div class="timeline-time">${s.time}</div></div>
    </div>
  `).join('');
}

// ==================== DASHBOARD ====================
let psCurrentUserEmail = localStorage.getItem('ps_user_email') || '';

function initDashboard() {
  if (!psCurrentUserEmail) {
    window.location.href = ROUTES.login;
    return;
  }
  const input = document.getElementById('dashEmailInput');
  if (input) input.value = psCurrentUserEmail;
  updateUserDisplay();
  loadUserBookings();
}

function setUserEmail() {
  const email = document.getElementById('dashEmailInput')?.value.trim() || '';
  if (!isValidEmail(email)) {
    showToast('Format e-mel tidak sah.', 'error');
    return;
  }
  psCurrentUserEmail = email;
  localStorage.setItem('ps_user_email', email);
  updateUserDisplay();
  loadUserBookings();
  showToast('E-mel dikemas kini. Tempahan anda dimuatkan.', 'success');
}

function updateUserDisplay() {
  const el = document.getElementById('dashUserDisplay');
  if (!el) return;
  el.textContent = psCurrentUserEmail ? `OK ${psCurrentUserEmail}` : 'Sila masukkan e-mel';
  el.style.color = psCurrentUserEmail ? 'var(--gold)' : 'var(--grey-4)';
}

async function loadUserBookings() {
  const container = document.getElementById('dashBookingsContainer');
  if (!container) return;

  if (!psCurrentUserEmail) {
    setText('bookingCountLabel', '0 tempahan');
    container.innerHTML = `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-envelope"></i></div><div class="empty-title">Masukkan E-mel Anda</div><div class="empty-sub">Gunakan ruangan di atas untuk memuatkan tempahan anda.</div></div>`;
    return;
  }

  let bookings = [];
  try {
    const result = await tryApi(`bookings.php?action=user&email=${encodeURIComponent(psCurrentUserEmail)}`);
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings().filter((b) => b.email && b.email.toLowerCase() === psCurrentUserEmail.toLowerCase());
  }
  renderUserBookings(bookings, container);
}

function renderUserBookings(bookings, container) {
  bookings.sort((a, b) => (a.date > b.date ? -1 : 1));
  setText('bookingCountLabel', `${bookings.length} tempahan`);
  if (bookings.length === 0) {
    container.innerHTML = `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-calendar2-x"></i></div><div class="empty-title">Tiada Tempahan</div><div class="empty-sub">Anda belum membuat sebarang tempahan dengan e-mel ini.</div><button class="btn btn-primary" style="margin-top:20px;" onclick="window.location.href='${ROUTES.booking}'"><i class="bi bi-calendar-plus"></i> Buat Tempahan Sekarang</button></div>`;
    return;
  }
  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Rujukan</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>${bookings.map((b) => `
          <tr>
            <td><div class="booking-id">${escapeHtml(b.id)}</div></td>
            <td><span style="display:flex;align-items:center;gap:6px;">${b.facilityIcon || ''} ${escapeHtml(b.facilityName)}</span></td>
            <td>${formatDate(b.date)}</td>
            <td>${escapeHtml(b.start)} - ${escapeHtml(b.end || '-')}</td>
            <td>${statusBadgeHtml(b.status)}</td>
            <td><div class="booking-row-actions"><button class="btn btn-secondary btn-sm" onclick="viewBookingDetail('${escapeAttr(b.id)}')"><i class="bi bi-eye"></i></button>${b.status === 'pending' ? `<button class="btn-cancel" onclick="cancelUserBooking('${escapeAttr(b.id)}')"><i class="bi bi-x-lg"></i> Batal</button>` : ''}</div></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

async function cancelUserBooking(id) {
  if (!confirm('Anda pasti mahu membatalkan tempahan ini?')) return;
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status: 'cancelled', admin_note: 'Dibatalkan oleh pengguna.' });
  } catch (error) {
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === id);
    if (booking) {
      booking.status = 'cancelled';
      booking.adminNote = 'Dibatalkan oleh pengguna.';
      saveBookings(bookings);
    }
  }
  loadUserBookings();
  showToast(`Tempahan ${id} telah dibatalkan.`, 'success');
}

function openContactModal() {
  const emailInput = document.getElementById('contactEmail');
  if (emailInput) emailInput.value = psCurrentUserEmail || '';
  document.getElementById('contactModal')?.classList.add('active');
}

async function sendContactMessage() {
  const email = document.getElementById('contactEmail')?.value.trim() || '';
  const subject = document.getElementById('contactSubject')?.value.trim() || '';
  const message = document.getElementById('contactMessage')?.value.trim() || '';

  if (!isValidEmail(email) || !subject || !message) {
    showToast('Sila lengkapkan semua ruangan dengan e-mel yang sah.', 'error');
    return;
  }

  try {
    await tryApi('messages.php', 'POST', { email, subject, message });
  } catch (error) {
    const contacts = JSON.parse(localStorage.getItem('ps_contact_messages') || '[]');
    contacts.push({ id: `MSG-${String(contacts.length + 1).padStart(4, '0')}`, email, subject, message, createdAt: new Date().toISOString(), read: false });
    localStorage.setItem('ps_contact_messages', JSON.stringify(contacts));
  }

  closeModal('contactModal');
  const subjectEl = document.getElementById('contactSubject');
  const messageEl = document.getElementById('contactMessage');
  if (subjectEl) subjectEl.value = '';
  if (messageEl) messageEl.value = '';
  showToast('Mesej anda telah dihantar. Admin akan respon segera.', 'success');
}

// ==================== ADMIN ====================
async function renderAdminDashboard() {
  const dashDate = document.getElementById('dashDate');
  if (!dashDate) return;

  let bookings = [];
  let stats = null;
  const facilities = await loadFacilities();

  try {
    const statsResult = await tryApi('bookings.php?action=stats');
    const bookingsResult = await tryApi('bookings.php');
    stats = statsResult.data;
    bookings = bookingsResult.data || [];
  } catch (error) {
    bookings = getBookings();
    const today = new Date().toISOString().split('T')[0];
    stats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      approved: bookings.filter((b) => b.status === 'approved').length,
      today: bookings.filter((b) => b.date === today).length,
    };
  }

  setText('pendingBadge', stats.pending);
  dashDate.textContent = new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('adminStats').innerHTML = buildStatsHTML(stats);
  renderBookingsTable('recentBookingsTbody', bookings.slice(0, 5), true);
  renderBookingsTable('allBookingsTbody', bookings, false);
  renderFacilityManagement(facilities);
  renderCalendar(bookings, bookingCalendarDate);
  loadClients();
}

function buildStatsHTML(stats) {
  return `
    <div class="stat-card"><div class="stat-card-label">Jumlah Tempahan</div><div class="stat-card-value">${stats.total}</div></div>
    <div class="stat-card"><div class="stat-card-label">Menunggu Semakan</div><div class="stat-card-value" style="color:var(--amber)">${stats.pending}</div></div>
    <div class="stat-card"><div class="stat-card-label">Diluluskan</div><div class="stat-card-value" style="color:var(--green)">${stats.approved}</div></div>
    <div class="stat-card"><div class="stat-card-label">Hari Ini</div><div class="stat-card-value">${stats.today}</div></div>
  `;
}

function renderBookingsTable(tbodyId, bookings, isRecent = false) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-inbox"></i></div><div class="empty-state-title">Tiada Tempahan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><div class="booking-id">${escapeHtml(b.id)}</div></td>
      <td><div class="tenant-name">${escapeHtml(b.name)}</div><div class="tenant-org">${escapeHtml(b.org || '')}</div></td>
      <td><span style="display:flex;align-items:center;gap:6px">${b.facilityIcon || ''} ${escapeHtml(b.facilityName)}</span></td>
      <td>${formatDate(b.date)}</td>
      ${!isRecent ? `<td>${escapeHtml(b.start)} - ${escapeHtml(b.end || '?')}</td>` : ''}
      <td>${statusBadgeHtml(b.status)}</td>
      <td><div class="table-actions"><button class="btn btn-secondary btn-sm" onclick="viewBookingDetail('${escapeAttr(b.id)}')">Lihat</button>${b.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="approveBooking('${escapeAttr(b.id)}')"><i class="bi bi-check-lg"></i></button><button class="btn btn-danger btn-sm" onclick="rejectBookingPrompt('${escapeAttr(b.id)}')"><i class="bi bi-x-lg"></i></button>` : ''}</div></td>
    </tr>
  `).join('');
}

async function filterBookings(filter, btn) {
  document.querySelectorAll('#bookingFilterTabs .filter-tab').forEach((b) => b.classList.remove('active'));
  btn?.classList.add('active');
  let bookings = [];
  try {
    const suffix = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
    const result = await tryApi(`bookings.php${suffix}`);
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings();
    if (filter !== 'all') bookings = bookings.filter((b) => b.status === filter);
  }
  renderBookingsTable('allBookingsTbody', bookings, false);
}

function renderFacilityManagement(facilities) {
  const grid = document.getElementById('facilityManageGrid');
  if (!grid) return;
  grid.innerHTML = facilities.map((f) => `
    <div class="facility-manage-card">
      <div class="fmc-header"><div class="fmc-icon">${facilityIconHtml(f)}</div>${statusBadgeHtml(f.is_available ? 'available' : 'booked')}</div>
      <div class="fmc-name">${escapeHtml(f.name)}</div>
      <div class="fmc-cap">Kapasiti: ${f.capacity} orang - RM${f.price_per_hour}</div>
      <div class="fmc-footer"><span style="font-size:12px;color:var(--grey-4)">${f.is_available ? 'Aktif' : 'Tidak Tersedia'}</span><div class="toggle-switch ${f.is_available ? 'on' : ''}" onclick="toggleFacility('${escapeAttr(f.id)}')"></div></div>
    </div>
  `).join('');
}

async function toggleFacility(fid) {
  const facility = facilitiesCache.find((f) => f.id === fid);
  if (!facility) return;
  facility.is_available = !facility.is_available;
  try {
    await tryApi(`facilities.php?id=${encodeURIComponent(fid)}`, 'PUT', { is_available: facility.is_available });
  } catch (error) {
    apiOnline = false;
  }
  renderFacilityManagement(facilitiesCache);
  showToast(`${facility.name} dikemas kini.`, 'success');
}

async function loadClients() {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  try {
    const result = await tryApi('users.php');
    renderClientsTable(result.data || []);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-people"></i></div><div class="empty-state-title">Senarai pelanggan tidak dapat dimuatkan</div></div></td></tr>`;
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-person-x"></i></div><div class="empty-state-title">Tiada Pelanggan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map((client) => `
    <tr>
      <td><div class="tenant-name">${escapeHtml(client.full_name || '-')}</div></td>
      <td>${escapeHtml(client.email)}</td>
      <td>${escapeHtml(client.phone || '-')}</td>
      <td><span class="status-badge status-pending">${Number(client.booking_count || 0)} tempahan</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewClientDetail(${Number(client.id)})"><i class="bi bi-eye"></i> Lihat</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function viewClientDetail(id) {
  try {
    const result = await tryApi(`users.php?action=detail&id=${encodeURIComponent(id)}`);
    const user = result.data.user;
    const bookings = result.data.bookings || [];
    setText('modalTitle', `Butiran Pelanggan - ${user.full_name || user.email}`);
    document.getElementById('modalBody').innerHTML = `
      <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(user.full_name || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">E-mel</span><span class="detail-value">${escapeHtml(user.email)}</span></div>
      <div class="detail-row"><span class="detail-label">No Telefon</span><span class="detail-value">${escapeHtml(user.phone || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Akaun</span><span class="detail-value">${user.has_password ? 'Sudah daftar' : 'Belum daftar'}</span></div>
      <div class="detail-row"><span class="detail-label">Tarikh Daftar</span><span class="detail-value">${escapeHtml(user.created_at || '-')}</span></div>
      <div style="margin-top:24px">
        <div class="admin-card-title" style="margin-bottom:12px">Tempahan Pelanggan</div>
        ${bookings.length ? `
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr><th>Rujukan</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th></tr></thead>
              <tbody>${bookings.map((booking) => `
                <tr>
                  <td><div class="booking-id">${escapeHtml(booking.booking_ref)}</div></td>
                  <td>${escapeHtml(booking.facility_name || '-')}</td>
                  <td>${formatDate(booking.booking_date)}</td>
                  <td>${escapeHtml(String(booking.start_time || '').slice(0, 5))} - ${escapeHtml(String(booking.end_time || '').slice(0, 5) || '-')}</td>
                  <td>${statusBadgeHtml(booking.status)}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-state-title">Tiada Tempahan</div></div>'}
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
    document.getElementById('bookingModal')?.classList.add('active');
  } catch (error) {
    showToast(error.message || 'Butiran pelanggan gagal dimuatkan.', 'error');
  }
}

function renderCalendar(bookings = [], viewDate = bookingCalendarDate) {
  const calendar = document.getElementById('calendarView');
  if (!calendar) return;
  const now = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const bookedDates = {};
  bookings.forEach((b) => {
    if (!bookedDates[b.date]) bookedDates[b.date] = [];
    bookedDates[b.date].push(b);
  });

  let html = `
    <div class="booking-calendar-header">
      <h3>${monthNames[month]} ${year}</h3>
      <div class="booking-calendar-actions">
        <button type="button" class="calendar-nav-btn" onclick="changeBookingCalendarMonth(-1)" aria-label="Bulan sebelum"><i class="bi bi-chevron-left"></i></button>
        <button type="button" class="calendar-today-btn" onclick="resetBookingCalendarMonth()">Bulan Ini</button>
        <button type="button" class="calendar-nav-btn" onclick="changeBookingCalendarMonth(1)" aria-label="Bulan seterusnya"><i class="bi bi-chevron-right"></i></button>
      </div>
    </div>
    <div class="booking-calendar-weekdays">
  `;
  ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'].forEach((day) => { html += `<div>${day}</div>`; });
  html += '</div><div class="booking-calendar-grid">';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let day = 1; day <= days; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookedDates[dateStr] || [];
    const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    html += `<div class="booking-calendar-day ${isToday ? 'today' : ''}"><div class="booking-calendar-date">${day}</div>${calendarStatusLabels(dayBookings)}</div>`;
  }
  calendar.innerHTML = html + '</div>';
}

function calendarStatusLabels(bookings = []) {
  if (!bookings.length) return '';

  const statusConfig = {
    pending: { label: 'Pending', color: 'var(--amber)', bg: '#FDF3E3' },
    approved: { label: 'Booked', color: 'var(--green)', bg: '#EAF5EE' },
    rejected: { label: 'Rejected', color: 'var(--red)', bg: '#FDECEC' },
    cancelled: { label: 'Cancelled', color: 'var(--red)', bg: '#FDECEC' },
  };
  const counts = bookings.reduce((acc, booking) => {
    if (statusConfig[booking.status]) acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const order = ['pending', 'approved', 'rejected', 'cancelled'];
  const labels = order
    .filter((status) => counts[status])
    .map((status) => {
      const config = statusConfig[status];
      const count = counts[status] > 1 ? ` ${counts[status]}` : '';
      return `<span style="display:inline-flex;align-items:center;max-width:100%;padding:2px 6px;border-radius:999px;background:${config.bg};color:${config.color};font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;">${config.label}${count}</span>`;
    })
    .join('');

  return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;overflow:hidden;">${labels}</div>`;
}

function showAdminPanel(name, btn) {
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.admin-menu-item').forEach((b) => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  if (name === 'bookings') filterBookings('all', document.querySelector('#bookingFilterTabs .filter-tab'));
  if (name === 'clients') loadClients();
  if (name === 'calendar') renderAdminDashboard();
}

function findBooking(id) {
  return getBookings().find((b) => b.id === id || b.booking_ref === id);
}

async function viewBookingDetail(id) {
  let booking = findBooking(id);
  if (apiOnline) {
    try {
      const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(id)}`);
      booking = result.data;
    } catch (error) {
      apiOnline = false;
    }
  }
  if (!booking) return;

  setText('modalTitle', `Butiran Tempahan - ${booking.id}`);
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px;background:var(--surface-3);border-radius:8px">
      <div style="font-size:32px;color:var(--gold)">${booking.facilityIcon || ''}</div>
      <div><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700">${escapeHtml(booking.facilityName)}</div><div style="font-size:12px;color:var(--grey-4);margin-top:2px">${formatDate(booking.date)}</div></div>
      <div style="margin-left:auto">${statusBadgeHtml(booking.status)}</div>
    </div>
    <div class="detail-row"><span class="detail-label">Nama Penyewa</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${escapeHtml(booking.phone)}</span></div>
    ${booking.status === 'pending' ? '<div style="margin-top:20px"><label>Nota (pilihan)</label><textarea id="modalNote" style="min-height:80px"></textarea></div>' : ''}
  `;
  document.getElementById('modalFooter').innerHTML = booking.status === 'pending'
    ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Batal</button><button class="btn btn-danger" onclick="rejectBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-lg"></i> Tolak</button><button class="btn btn-success" onclick="approveBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-check-lg"></i> Luluskan</button>`
    : `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
  document.getElementById('bookingModal')?.classList.add('active');
}

async function updateStatus(id, status, note = '') {
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status, admin_note: note });
  } catch (error) {
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === id);
    if (booking) {
      booking.status = status;
      booking.adminNote = note;
      saveBookings(bookings);
    }
  }
  await renderAdminDashboard();
}

async function approveBooking(id) {
  await updateStatus(id, 'approved');
  showToast('Diluluskan', 'success');
}

async function approveBookingFromModal(id) {
  await updateStatus(id, 'approved', document.getElementById('modalNote')?.value || '');
  closeModal('bookingModal');
  showToast('Diluluskan', 'success');
}

function rejectBookingPrompt(id) {
  viewBookingDetail(id);
}

async function rejectBookingFromModal(id) {
  await updateStatus(id, 'rejected', document.getElementById('modalNote')?.value || 'Ditolak.');
  closeModal('bookingModal');
  showToast('Ditolak', 'error');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal-overlay')) event.target.classList.remove('active');
});

// ==================== HELPERS ====================
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>'}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function statusBadgeHtml(status) {
  const labels = {
    pending: '<div class="status-badge status-pending">Menunggu</div>',
    approved: '<div class="status-badge status-available">Diluluskan</div>',
    rejected: '<div class="status-badge status-booked">Ditolak</div>',
    cancelled: '<div class="status-badge status-booked">Dibatalkan</div>',
    available: '<div class="status-badge status-available">Tersedia</div>',
    booked: '<div class="status-badge status-booked">Ditempah</div>',
  };
  return labels[status] || '';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return `${formatDate(date.toISOString().split('T')[0])} ${date.toTimeString().slice(0, 5)}`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setText(id, value) {
  document.querySelectorAll(`[id="${id}"]`).forEach((el) => {
    el.textContent = value;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

// ==================== INIT ====================
async function init() {
  ensureFallbackSeed();
  if (document.getElementById('admin') && localStorage.getItem('ps_admin_logged_in') !== '1') {
    window.location.href = ROUTES.login;
    return;
  }
  await renderFacilities();
  await renderLandingCalendar();
  await renderPublicCalendarView();
  await populateBookingFacilities();
  setMinDate();
  await renderAdminDashboard();

  const startEl = document.getElementById('f-start');
  if (startEl) {
    startEl.addEventListener('change', updateEndTime);
    document.getElementById('f-duration')?.addEventListener('change', () => { updateEndTime(); updatePricing(); });
    document.getElementById('f-facility')?.addEventListener('change', updateFacilityInfo);
    document.getElementById('f-setup')?.addEventListener('change', updatePricing);
  }

  if (document.getElementById('dashboard')) {
    initDashboard();
    document.getElementById('dashEmailInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') setUserEmail();
    });
  }

  if (document.getElementById('signup-page')) {
    initSignupPage();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
