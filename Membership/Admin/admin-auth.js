/**
 * MAO Membership — Admin Auth (shared PIN gate)
 *
 * Di-load oleh semua halaman di bawah Membership/Admin/ SEBELUM script.js
 * masing-masing, setelah ../../config.js.
 *
 * Perilaku:
 * 1. Saat halaman dimuat, cek flag sessionStorage "adminAuthed".
 *    - Ada → konten halaman langsung bisa dipakai.
 *    - Tidak ada → tampilkan overlay PIN (pola bottom-sheet modal yang sama
 *      dengan modal lain di codebase), konten halaman terblokir di baliknya.
 * 2. Submit PIN → POST action=verifyAdminPin ke backend. Backend mencocokkan
 *    ke Script Properties "ADMIN_PIN" (TIDAK di-hardcode di source manapun).
 *    Sukses → flag + PIN disimpan di sessionStorage (per-tab, hilang otomatis
 *    saat tab ditutup — sengaja: tidak ada "remember me" lintas tab/sesi).
 *    PIN ikut disimpan supaya helper adminFetch bisa menyertakannya ke semua
 *    request admin setelah navigasi antar halaman; backend TETAP
 *    re-validasi PIN di setiap action, jadi nilai basi tetap ditolak.
 * 3. Sediakan helper global MAO_ADMIN.adminFetch(action, payload) yang
 *    otomatis menyertakan PIN yang sudah terverifikasi ke SETIAP request
 *    admin berikutnya (list/detail/delete/update) — supaya backend bisa
 *    RE-VALIDASI PIN per-request, bukan cuma sekali di gate awal.
 *
 * Halaman memakai:
 *   <script src="../../config.js"></script>
 *   <script src="../admin-auth.js"></script>
 *   <script src="script.js"></script>
 * dan membungkus init-nya dengan MAO_ADMIN.onReady(function(){ ... }).
 *
 * Markup minimum yang wajib ada di setiap halaman admin (sudah disertakan
 * di Admin/Check-Pesanan dan Admin/Member):
 *   <div id="adminPinGate" class="pin-gate" hidden> ... </div>
 *   (lihat Admin/Check-Pesanan/index.html sebagai contoh lengkap)
 */
(function () {
  'use strict';

  var AUTH_FLAG = 'adminAuthed';  // sessionStorage key: sudah pernah verify
  var PIN_KEY   = 'adminPin';     // sessionStorage key: PIN terverifikasi

  // ─── STATE PIN ──────────────────────────────────────────────────────────
  // PIN disimpan di variabel modul (BUKAN sessionStorage — jangan meninggalkan
  // PIN di storage). Isinya terisi setelah verify sukses atau setelah dibaca
  // dari prompt di sesi yang sama (sessionStorage flag = sudah pernah verify
  // di tab ini, tapi PIN-nya tidak dipersist — makanya diminta ulang di
  // variabel lewat prompt internal jika hilang, lihat getPin()).
  var verifiedPin = null;

  var gateEl        = null;
  var pinInput      = null;
  var pinMsg        = null;
  var pinSubmitBtn  = null;
  var readyCallbacks = [];

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_FLAG) === '1';
    } catch (e) {
      return false;
    }
  }

  function getStoredPin() {
    try {
      return sessionStorage.getItem(PIN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function markAuthed(pin) {
    verifiedPin = pin;
    try {
      sessionStorage.setItem(AUTH_FLAG, '1');
      sessionStorage.setItem(PIN_KEY, pin);
    } catch (e) { /* storage penuh/blocked → PIN tetap hidup di variabel modul */ }
  }

  // ─── GATE UI ─────────────────────────────────────────────────────────────

  function showGate() {
    if (!gateEl) return;
    gateEl.hidden = false;
    setTimeout(function () { pinInput.focus(); }, 50);
  }

  function hideGate() {
    if (gateEl) gateEl.hidden = true;
  }

  function showGateMsg(msg) {
    pinMsg.textContent = msg;
    pinMsg.hidden = false;
  }

  function hideGateMsg() {
    pinMsg.hidden = true;
    pinMsg.textContent = '';
  }

  /** Kirim PIN ke backend. Return true kalau valid. */
  async function verifyPinAgainstBackend(pin) {
    var resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ action: 'verifyAdminPin', pin: pin }).toString()
    });
    var json = await resp.json();
    return !!(json && json.success);
  }

  async function handlePinSubmit() {
    var pin = pinInput.value.trim();
    if (!pin) {
      showGateMsg('PIN wajib diisi.');
      return;
    }

    pinSubmitBtn.disabled = true;
    pinSubmitBtn.textContent = '⏳ Memeriksa…';
    hideGateMsg();

    try {
      var ok = await verifyPinAgainstBackend(pin);
      if (!ok) {
        // Pesan generik dari backend ("PIN salah") — tidak bocorkan detail lain.
        showGateMsg('PIN salah.');
        pinInput.value = '';
        pinInput.focus();
        return;
      }

      markAuthed(pin);
      hideGate();
      runReadyCallbacks();
    } catch (err) {
      console.error('PIN verify error:', err);
      showGateMsg('Gagal memeriksa PIN. Periksa koneksi internet lalu coba lagi.');
    } finally {
      pinSubmitBtn.disabled = false;
      pinSubmitBtn.textContent = 'Buka Halaman Admin';
    }
  }

  function runReadyCallbacks() {
    readyCallbacks.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('admin onReady error:', e); }
    });
  }

  // ─── PUBLIC API (global MAO_ADMIN) ───────────────────────────────────────

  window.MAO_ADMIN = {
    /**
     * Daftarkan init halaman. Callback dipanggil begitu PIN terverifikasi
     * (langsung, kalau flag sessionStorage sudah ada dari sesi yang sama).
     */
    onReady: function (fn) {
      if (isAuthed() && (verifiedPin !== null || getStoredPin())) {
        // Sudah pernah verify di tab ini (flag + PIN di sessionStorage) →
        // gate dilewati, halaman init langsung. Backend tetap re-validasi
        // PIN di setiap request adminFetch.
        if (verifiedPin === null) verifiedPin = getStoredPin();
        fn();
      } else {
        readyCallbacks.push(fn);
        showGate();
      }
    },

    /**
     * Fetch admin: POST action + payload + PIN terverifikasi (param "pin").
     * Backend me-revalidasi PIN di SETIAP action admin — request tanpa PIN
     * valid ditolak dengan pesan generik.
     *
     * @param {string} action  - nama action admin (mis. "adminListPesanan")
     * @param {Object} payload - parameter tambahan (tanpa action & pin)
     * @returns {Promise<Object>} JSON response dari backend
     */
    adminFetch: function (action, payload) {
      var params = { action: action, pin: verifiedPin || '' };
      if (payload) {
        Object.keys(payload).forEach(function (k) { params[k] = payload[k]; });
      }
      return fetch(MAO_CONFIG.GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      }).then(function (resp) { return resp.json(); });
    },

    /** True kalau error response adalah PIN ditolak → tampilkan gate lagi. */
    isUnauthorized: function (json) {
      return !!(json && json.errorType === 'unauthorized');
    },

    /** Paksa gate muncul lagi (mis. setelah unauthorized di tengah sesi). */
    relock: function () {
      try {
        sessionStorage.removeItem(AUTH_FLAG);
        sessionStorage.removeItem(PIN_KEY);
      } catch (e) { /* noop */ }
      verifiedPin = null;
      showGate();
    }
  };

  // ─── INIT GATE MARKUP ────────────────────────────────────────────────────

  function init() {
    gateEl       = document.getElementById('adminPinGate');
    pinInput     = document.getElementById('adminPinInput');
    pinMsg       = document.getElementById('adminPinMsg');
    pinSubmitBtn = document.getElementById('adminPinSubmitBtn');

    if (!gateEl || !pinInput || !pinSubmitBtn) {
      console.error('admin-auth.js: markup PIN gate tidak lengkap di halaman ini.');
      return;
    }

    pinSubmitBtn.addEventListener('click', handlePinSubmit);
    pinInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handlePinSubmit();
    });

    // showGate() dari onReady() bisa no-op karena panggilannya terjadi
    // SEBELUM markup gate ter-wire (page script eval > DOMContentLoaded).
    // Setelah wire, kalau belum authed → pastikan gate tampil.
    if (!isAuthed()) showGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
