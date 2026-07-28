/* ─── Config ─── */
const NTFY_TOPIC = 'reminderme';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;
const DEFAULT_MSG = 'Waktunya! ⏰';
const MIN_SECONDS = 10;
const MAX_SECONDS = 259200; // 3 days

/* ─── DOM refs ─── */
const el = {
  quickBtns: document.querySelectorAll('.quick-btn'),
  hoursInp: document.getElementById('hoursInp'),
  minsInp: document.getElementById('minsInp'),
  totalDisplay: document.getElementById('totalDisplay'),
  timePicker: document.getElementById('timePicker'),
  piBadge: document.getElementById('piBadge'),
  timeHint: document.getElementById('timeHint'),
  msgInp: document.getElementById('msgInp'),
  setBtn: document.getElementById('setBtn'),
  statusBox: document.getElementById('statusBox'),
  statusIcon: document.getElementById('statusIcon'),
  statusMsg: document.getElementById('statusMsg'),
  infoLine: document.getElementById('infoLine'),
};

/* ─── Helpers ─── */

/** Format seconds into human-readable string */
function fmtDuration(sec) {
  if (sec < 60) return `${sec} detik`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `${h} jam`;
  return `${h} jam ${rm} menit`;
}

/** Show status message */
function showStatus(type, icon, msg) {
  el.statusBox.className = `status-box ${type}`;
  el.statusIcon.className = `ti ${icon}`;
  el.statusMsg.innerHTML = msg;
  // Force reflow to restart transition
  void el.statusBox.offsetWidth;
  el.statusBox.classList.remove('hidden');
}

/** Hide status */
function hideStatus() {
  el.statusBox.classList.add('hidden');
}

/** Update total display from hours/mins inputs */
function updateTotal() {
  const h = parseInt(el.hoursInp.value) || 0;
  const m = parseInt(el.minsInp.value) || 0;
  const totalMin = h * 60 + m;
  el.totalDisplay.textContent = totalMin > 0 ? `${totalMin} menit` : '0 menit';
}

/** Get seconds delta from hours+mins inputs */
function getCustomSeconds() {
  const h = parseInt(el.hoursInp.value) || 0;
  const m = parseInt(el.minsInp.value) || 0;
  return h * 3600 + m * 60;
}

/** Calculate seconds from now until the time picker value */
function getTimePickerSeconds() {
  const val = el.timePicker.value;
  if (!val) return null;

  const [hh, mm] = val.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);

  let diff = Math.floor((target.getTime() - now.getTime()) / 1000);

  if (diff < 0) {
    // Already passed today → schedule for tomorrow
    target.setDate(target.getDate() + 1);
    diff = Math.floor((target.getTime() - now.getTime()) / 1000);
    el.piBadge.className = 'pi-badge tomorrow';
    el.piBadge.textContent = `besok ${val}`;
  } else {
    el.piBadge.className = 'pi-badge active';
    el.piBadge.textContent = fmtDuration(diff);
  }
  return diff;
}

/** Validate and return seconds, or null + show error */
function validateAndGetSeconds() {
  // Determine which input mode to use
  const customSec = getCustomSeconds();
  const timeSec = getTimePickerSeconds();
  const hasCustom = customSec > 0;
  const hasTime = !!el.timePicker.value;

  let seconds;

  if (hasTime) {
    // Time picker takes priority when set
    seconds = timeSec;
    if (seconds === 0) {
      showStatus('error', 'ti-alert-circle', 'Waktu yang dipilih adalah <strong>sekarang</strong> atau sudah lewat. Pilih waktu lain.');
      return null;
    }
  } else if (hasCustom) {
    seconds = customSec;
  } else {
    showStatus('error', 'ti-alert-circle', 'Isi durasi (jam/menit) atau pilih waktu pasti.');
    return null;
  }

  if (seconds < MIN_SECONDS) {
    showStatus('error', 'ti-alert-circle', `Terlalu pendek! Minimal <strong>${fmtDuration(MIN_SECONDS)}</strong> (dapatkan ${fmtDuration(seconds)}).`);
    return null;
  }

  if (seconds > MAX_SECONDS) {
    showStatus('error', 'ti-alert-circle', `Terlalu lama! Maksimal <strong>${fmtDuration(MAX_SECONDS)}</strong> (dapatkan ${fmtDuration(seconds)}).`);
    return null;
  }

  return seconds;
}

/* ─── Submit ─── */

async function submitReminder() {
  hideStatus();

  const seconds = validateAndGetSeconds();
  if (seconds === null) return;

  const msg = (el.msgInp.value || '').trim() || DEFAULT_MSG;

  // Visual loading state
  el.setBtn.disabled = true;
  el.setBtn.innerHTML = '<i class="ti ti-loader"></i><span>Mengirim...</span>';
  showStatus('info', 'ti-loader', 'Mengirim reminder ke ntfy.sh...');

  try {
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      body: msg,
      headers: {
        'Title': 'Reminder',
        'In': `${seconds}s`,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    showStatus('success', 'ti-circle-check-filled',
      `Reminder akan berbunyi dalam <strong>${fmtDuration(seconds)}</strong>.<br>
       <span style="font-size:11px;opacity:0.7">Topic: ntfy.sh/${NTFY_TOPIC} &middot; ${new Date().toLocaleTimeString('id-ID')}</span>`
    );
  } catch (err) {
    showStatus('error', 'ti-alert-circle',
      `Gagal mengirim: <strong>${err.message}</strong>`
    );
  } finally {
    el.setBtn.disabled = false;
    el.setBtn.innerHTML = '<i class="ti ti-send"></i><span>Set Reminder</span>';
  }
}

/* ─── Events ─── */

// Quick buttons — fill fields and auto-submit
el.quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mins = parseInt(btn.dataset.minutes);
    el.hoursInp.value = 0;
    el.minsInp.value = mins;
    el.timePicker.value = '';
    el.piBadge.className = 'pi-badge';
    el.piBadge.textContent = '—';
    updateTotal();
    submitReminder();
  });
});

// Custom inputs → update total display
el.hoursInp.addEventListener('input', () => {
  updateTotal();
  hideStatus();
});
el.minsInp.addEventListener('input', () => {
  updateTotal();
  hideStatus();
});

// Time picker → show preview
el.timePicker.addEventListener('input', () => {
  hideStatus();
  const val = el.timePicker.value;
  if (!val) {
    el.piBadge.className = 'pi-badge';
    el.piBadge.textContent = '—';
    return;
  }
  // Just show the target time, detailed calc on submit
  const [hh, mm] = val.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  const diff = (target.getTime() - now.getTime()) / 1000;
  if (diff < 0) {
    el.piBadge.className = 'pi-badge tomorrow';
    el.piBadge.textContent = `besok ${val}`;
    // Calculate exact seconds for besok
    target.setDate(target.getDate() + 1);
    const besokDiff = Math.floor((target.getTime() - now.getTime()) / 1000);
    el.piBadge.title = `${fmtDuration(besokDiff)} lagi`;
  } else if (diff < 10) {
    el.piBadge.className = 'pi-badge';
    el.piBadge.textContent = `${val} (terlalu dekat)`;
  } else {
    el.piBadge.className = 'pi-badge active';
    el.piBadge.textContent = `${val} (${fmtDuration(Math.floor(diff))})`;
  }
});

// Message input → hide old status
el.msgInp.addEventListener('input', hideStatus);

// Submit button
el.setBtn.addEventListener('click', submitReminder);

// Keyboard: Enter to submit
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement !== el.timePicker) {
    // Don't auto-submit on time input to allow typing
    submitReminder();
  }
});

/* ─── Init ─── */
updateTotal();
el.infoLine.textContent = `ntfy.sh/${NTFY_TOPIC}`;
