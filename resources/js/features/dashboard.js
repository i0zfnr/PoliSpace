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
