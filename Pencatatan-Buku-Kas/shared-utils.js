// ============================================================
// shared-utils.js — Fungsi utilitas bersama untuk halaman
// Riwayat dan Stok Pencatatan Buku Kas (MAO Group).
// Dimuat via <script> sebelum script.js masing-masing halaman.
// ============================================================

/**
 * Format tanggal ke dd/MM/yyyy (zona Asia/Jakarta).
 * Dipakai untuk query ke server dan pencocokan timestamp.
 */
function formatTanggalApi(date) {
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric"
  });
}

/**
 * Format tanggal ke label panjang (mis. "Senin, 10 Juli 2026").
 * Dipakai untuk tampilan judul halaman.
 */
function formatTanggalLabel(date) {
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

/**
 * Format tanggal ke yyyy-MM-dd (zona Asia/Jakarta).
 * Dipakai untuk mengisi <input type="date">.
 */
function toDateInputValue(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Escape HTML entities untuk mencegah XSS.
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
