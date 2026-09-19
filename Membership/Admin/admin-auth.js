/**
 * MAO Membership — Admin Auth (guard terpusat + session token)
 *
 * Di-load oleh SEMUA halaman admin (Admin/index.html [login], Admin/Member/,
 * Admin/Check-Pesanan/) SEBELUM script.js masing-masing.
 *
 * ARSITEKTUR (sejak 2026-09-20):
 *   - SATU pintu masuk resmi: Admin/index.html. Halaman itu yang menampilkan
 *     form PIN; setelah PIN valid, backend membalas TOKEN sesi acak
 *     (doPostVerifyAdminPin_ di Apps-Script/code.gs.js) dan client menyimpan
 *     TOKEN itu — BUKAN PIN mentahnya.
 *   - Halaman admin lain TIDAK punya gate/overlay PIN sendiri lagi (markup
 *     #adminPinGate lama sudah dihapus). Cukup panggil MAO_ADMIN.onReady(fn):
 *     kalau belum login → redirect ke Admin/index.html.
 *   - Backend TETAP re-validasi kredensial di SETIAP action admin (checkAdminPin_
 *     menerima token sesi atau PIN mentah), jadi menembus guard UI tetap ditolak.
 *
 * MIGRASI / KOMPATIBILITAS:
 *   Kalau backend yang ter-deploy BELUM versi token (deploy Apps Script manual
 *   oleh Rofi), verifyAdminPin cuma membalas { success: true } tanpa token.
 *   Admin/index.html memakai fallback markAuthedWithPin() supaya area admin
 *   TIDAK terkunci total di jendela antara "source di-push" → "backend
 *   di-deploy". Setelah redeploy, login otomatis pakai mode token dan PIN
 *   mentah TIDAK lagi disimpan (markAuthed() selalu menghapus key legacy).
 *
 * Storage yang dipakai (sessionStorage, per-tab, hilang saat tab ditutup):
 *   adminSessionToken     → token sesi  (mode normal; BUKAN rahasia panjang-umur)
 *   adminPin              → PIN mentah (HANYA mode kompatibilitas backend lama)
 *   adminPostLoginTarget  → halaman tujuan setelah login (biar tidak selalu
 *                           dilempar ke Member kalau tadi buka Check-Pesanan)
 *
 * Pemakaian di halaman admin (BUKAN Admin/index.html):
 *   <script src="../../config.js"></script>
 *   <script src="../admin-auth.js"></script>
 *   <script src="script.js"></script>
 *   ... lalu di script.js: MAO_ADMIN.onReady(function () { ... });
 */
(function () {
  'use strict';

  var TOKEN_KEY  = 'adminSessionToken';      // sessionStorage: token sesi (utama)
  var PIN_KEY    = 'adminPin';               // sessionStorage: PIN mentah (fallback saja)
  var TARGET_KEY = 'adminPostLoginTarget';   // sessionStorage: kunci halaman tujuan login

  // Prefix token yang dikeluarkan backend (lihat ADMIN_TOKEN_PREFIX di code.gs.js).
  // Hanya dipakai untuk sanity-check bentuk kredensial, bukan sebagai otentikasi.
  var TOKEN_PREFIX = 'admin_sess_';

  // ─── LOKASI FILE (semua URL dihitung absolut dari posisi admin-auth.js) ────
  // Path relatif akan berbeda tergantung halaman pemanggil (Admin/ vs
  // Admin/Member/), jadi base-nya diturunkan dari URL script ini sendiri supaya
  // redirect SELALU menunjuk ke folder Admin/ yang benar.

  function resolveAuthBase() {
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute('src') || '';
        if (/(^|\/)admin-auth\.js(\?|#|$)/.test(src)) {
          return new URL('./', new URL(src, window.location.href)).href;
        }
      }
    } catch (e) { /* jatuh ke fallback di bawah */ }
    // Fallback (script src tidak ditemukan): asumsikan halaman ini satu level
    // di bawah Admin/ — yaitu Admin/Member/ atau Admin/Check-Pesanan/.
    try {
      return new URL('../', window.location.href).href;
    } catch (e2) {
      return '../';
    }
  }

  var AUTH_BASE  = resolveAuthBase();                        // .../Membership/Admin/
  var LOGIN_URL  = AUTH_BASE + 'index.html';                 // pintu masuk resmi

  // Halaman admin yang boleh jadi tujuan setelah login. Dipetakan per KEY
  // (bukan dari URL/query param) supaya tidak ada celah open-redirect.
  var PAGE_URLS = {
    'member':        AUTH_BASE + 'Member/index.html',
    'check-pesanan': AUTH_BASE + 'Check-Pesanan/index.html'
  };


  // ─── STATE KREDENSIAL ────────────────────────────────────────────────────
  function readStorage(key) {
    try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function writeStorage(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* storage blocked → sesi tidak persist */ }
  }

  function removeStorage(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* noop */ }
  }

  function isAuthed() {
    return getCredential() !== '';
  }

  /**
   * Kredensial yang dikirim ke backend: token sesi kalau ada, kalau tidak
   * PIN mentah (mode kompatibilitas backend lama).
   */
  function getCredential() {
    var token = readStorage(TOKEN_KEY);
    if (token) return token;
    return readStorage(PIN_KEY);
  }

  function authMode() {
    if (readStorage(TOKEN_KEY)) return 'token';
    if (readStorage(PIN_KEY)) return 'pin';
    return 'none';
  }

  /** Simpan TOKEN sesi (jalur normal). PIN mentah legacy langsung dibersihkan. */
  function markAuthed(token) {
    var value = String(token || '').trim();
    if (!value) return;
    writeStorage(TOKEN_KEY, value);
    removeStorage(PIN_KEY);
  }

  /**
   * Fallback HANYA untuk backend lama (verifyAdminPin belum mengembalikan
   * token). Menyimpan PIN mentah seperti mekanisme lama — lihat catatan
   * MIGRASI di header file.
   */
  function markAuthedWithPin(pin) {
    var value = String(pin || '').trim();
    if (!value) return;
    removeStorage(TOKEN_KEY);
    writeStorage(PIN_KEY, value);
  }

  function clearAuth() {
    removeStorage(TOKEN_KEY);
    removeStorage(PIN_KEY);
  }

  // ─── NAVIGASI ────────────────────────────────────────────────────────────

  function currentPageKey() {
    var path = window.location.pathname;
    if (path.indexOf('/Check-Pesanan/') !== -1) return 'check-pesanan';
    if (path.indexOf('/Member/') !== -1) return 'member';
    return '';
  }

  /** URL halaman tujuan setelah login (default: Member — perilaku lama). */
  function consumeTarget() {
    var key = readStorage(TARGET_KEY);
    removeStorage(TARGET_KEY);
    return PAGE_URLS[key] || PAGE_URLS['member'];
  }

  function goToLogin() {
    // Ingat halaman yang tadi dibuka supaya setelah login user kembali ke
    // sana (di-whitelist lewat PAGE_URLS — tidak dari query string).
    var key = currentPageKey();
    if (key) writeStorage(TARGET_KEY, key);
    window.location.replace(LOGIN_URL);
  }

  /**
   * Wajibkan login. Return true kalau boleh lanjut; kalau belum login →
   * redirect ke halaman login dan return false (halaman TIDAK boleh lanjut
   * memuat data).
   */
  function requireAuth() {
    if (isAuthed()) return true;
    goToLogin();
    return false;
  }

  // ─── PUBLIC API (global MAO_ADMIN) ───────────────────────────────────────

  window.MAO_ADMIN = {
    /**
     * Daftarkan init halaman. Callback langsung dipanggil kalau sudah login;
     * kalau belum → redirect ke Admin/index.html (guard terpusat, BUKAN gate
     * overlay lagi).
     */
    onReady: function (fn) {
      if (!isAuthed()) {
        goToLogin();
        return;
      }
      try { fn(); } catch (e) { console.error('admin onReady error:', e); }
    },

    isAuthed: isAuthed,
    authMode: authMode,
    /** Kredensial aktif (token sesi atau PIN legacy) — dipakai halaman login. */
    getCredential: getCredential,
    markAuthed: markAuthed,
    markAuthedWithPin: markAuthedWithPin,
    clearAuth: clearAuth,
    requireAuth: requireAuth,
    loginUrl: function () { return LOGIN_URL; },
    consumeTarget: consumeTarget,
    currentPageKey: currentPageKey,

    /**
     * Fetch admin: POST action + payload + kredensial (param "pin" — nama
     * parameter dipertahankan agar SELURUH handler backend lama tetap cocok;
     * isinya token sesi, bukan PIN).
     * Backend me-revalidasi kredensial di SETIAP action admin.
     *
     * @param {string} action  - nama action admin (mis. "adminListPesanan")
     * @param {Object} payload - parameter tambahan (tanpa action & pin)
     * @returns {Promise<Object>} JSON response dari backend
     */
    adminFetch: function (action, payload) {
      var params = { action: action, pin: getCredential() };
      if (payload) {
        Object.keys(payload).forEach(function (k) { params[k] = payload[k]; });
      }
      return fetch(MAO_CONFIG.GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      }).then(function (resp) { return resp.json(); });
    },

    /** True kalau error response adalah kredensial ditolak → paksa login ulang. */
    isUnauthorized: function (json) {
      return !!(json && json.errorType === 'unauthorized');
    },

    /** Sesi habis/ditolak → bersihkan kredensial + kembali ke halaman login. */
    relock: function () {
      clearAuth();
      removeStorage(TARGET_KEY);
      goToLogin();
    },

    /** Alias eksplisit untuk relock() (logout manual). */
    logout: function () {
      clearAuth();
      removeStorage(TARGET_KEY);
      window.location.replace(LOGIN_URL);
    }
  };

  // Tidak ada auto-guard di sini: halaman login sendiri (Admin/index.html)
  // juga memuat file ini dan TIDAK boleh di-redirect. Guard dijalankan lewat
  // MAO_ADMIN.onReady()/requireAuth() di halaman admin masing-masing.
})();
