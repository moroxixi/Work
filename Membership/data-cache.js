/**
 * MAO Membership — Shared Data Cache (stale-while-revalidate)
 *
 * Generic cache layer berbasis sessionStorage untuk halaman-halaman
 * yang fetch data dinamis saat load. Pola:
 *
 *   1. Page load → baca cache → render LANGSUNG dari cache (tanpa spinner)
 *   2. Fetch fresh data di background → kalau beda dari cache → update render
 *      diam-diam (tanpa flicker/scroll reset) + update cache
 *   3. Kalau tidak ada cache → tampilkan loading, fetch, render, simpan cache
 *
 * TIDAK dipakai untuk halaman Admin (data harus selalu fresh dari server).
 * TIDAK ada TTL/expiry — cache selalu dianggap valid selama sesi browser.
 */
(function () {
  'use strict';

  /**
   * Baca data dari cache.
   * @param {string} key — nama key cache (mis. "submit_formData", "leaderboard_data")
   * @returns {any|null} data yang di-cache, atau null kalau tidak ada / parse gagal
   */
  function getCached(key) {
    try {
      var raw = sessionStorage.getItem('mao_cache_' + key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Simpan data ke cache.
   * @param {string} key — nama key cache
   * @param {any} data — data yang akan di-cache (harus JSON-serializable)
   */
  function setCached(key, data) {
    try {
      sessionStorage.setItem('mao_cache_' + key, JSON.stringify(data));
    } catch (e) {
      /* storage penuh/blocked → cache tidak kritis, biarkan saja */
    }
  }

  /**
   * Hapus entry cache tertentu.
   * @param {string} key
   */
  function clearCache(key) {
    try {
      sessionStorage.removeItem('mao_cache_' + key);
    } catch (e) { /* noop */ }
  }

  // Expose global
  window.MAO_CACHE = {
    get: getCached,
    set: setCached,
    clear: clearCache
  };
})();
