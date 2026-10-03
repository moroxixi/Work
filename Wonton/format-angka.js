/**
 * format-angka.js — format angka ribuan (pemisah titik) untuk field
 * BILANGAN BULAT uang/jumlah. Salinan IDENTIK ada di:
 *   Work/Tempura/format-angka.js
 *   Work/Wonton/format-angka.js
 * (tidak ada util bersama yang dipakai kedua app — keduanya satu file HTML
 * mandiri, jadi tiap app memuat salinannya sendiri.)
 *
 * Yang ditampilkan: "1.000" / "1.000.000" (digit mentah 1000 / 1000000).
 * Yang dikirim ke backend / dipakai hitungan: TETAP digit mentah.
 *
 * Aturan:
 * - Titik SELALU dianggap pemisah ribuan (BUKAN desimal).
 * - Normalisasi: buang "Rp"/spasi; kalau diakhiri koma + 1-2 digit, buang
 *   bagian desimalnya; sisanya hanya digit.
 * - Buang nol di depan kecuali satu "0"; maksimal 15 digit.
 * - Tanda minus TIDAK dipertahankan (field uang/jumlah non-negatif;
 *   keputusan user 4B: "Default").
 *
 * Fungsi murni (bisa diuji di node): formatDigits, parseDisplay,
 * normalizeDigits. attach/getValue/setValue bekerja pada elemen input
 * (hanya butuh .value/.selectionStart/.setSelectionRange/.addEventListener).
 */
(function (global) {
  'use strict';

  var MAX_DIGIT = 15;

  /** Buang Rp/spasi, koma desimal 1-2 digit di akhir, sisanya digit saja. */
  function normalizeDigits(input) {
    var s = String(input === null || input === undefined ? '' : input);
    s = s.replace(/rp/gi, '');
    s = s.replace(/\s+/g, '');
    s = s.replace(/,(\d{1,2})$/, '');
    s = s.replace(/[^0-9]+/g, '');
    return s;
  }

  /** '1000000' -> '1.000.000'. Nol depan dibuang, maks 15 digit. */
  function formatDigits(input) {
    var d = normalizeDigits(input);
    d = d.replace(/^0+(?=[0-9])/, '');
    if (d.length > MAX_DIGIT) d = d.slice(0, MAX_DIGIT);
    if (d === '') return '';
    var out = '';
    for (var i = 0; i < d.length; i++) {
      if (i > 0 && (d.length - i) % 3 === 0) out += '.';
      out += d.charAt(i);
    }
    return out;
  }

  /** '1.000.000' -> 1000000. Kosong/tidak valid -> 0. */
  function parseDisplay(input) {
    var d = normalizeDigits(input);
    if (d === '') return 0;
    var n = parseInt(d, 10);
    return isNaN(n) ? 0 : n;
  }

  function countDigits(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) n++;
    }
    return n;
  }

  /** Posisi karakter tepat SETELAH digit ke-n dalam s (atau ujung). */
  function caretAfterDigits(s, n) {
    if (n <= 0) return 0;
    var seen = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) {
        seen++;
        if (seen === n) return i + 1;
      }
    }
    return s.length;
  }

  /**
   * Format ulang nilai elemen sambil MEMPERTAHANKAN posisi caret
   * berdasarkan JUMLAH DIGIT di kiri caret (bukan offset karakter),
   * sehingga: caret tidak terlempar ke ujung, backspace/delete di sebelah
   * titik tidak macet, dan select-all-lalu-ketik tetap benar.
   * @return {boolean} true bila nilai berubah
   */
  function formatElement(el) {
    var before = el.value;
    var caret =
      typeof el.selectionStart === 'number' ? el.selectionStart : before.length;
    var left = countDigits(before.slice(0, caret));
    var after = formatDigits(before);
    if (after === before) return false;
    el.value = after;
    var pos = caretAfterDigits(after, left);
    if (typeof el.setSelectionRange === 'function') {
      try {
        el.setSelectionRange(pos, pos);
      } catch (e) {
        /* elemen tertentu menolak setSelectionRange — abaikan */
      }
    }
    return true;
  }

  /**
   * Pasang formatter pada satu elemen input (idempoten — aman dipanggil
   * berkali-kotak; field dinamis yang dibuat belakangan tinggal dipanggil).
   */
  function attach(el) {
    if (!el || el.__angkaAttached) return el;
    el.__angkaAttached = true;
    el.addEventListener('input', function () {
      formatElement(el);
    });
    formatElement(el); // format nilai yang sudah terisi (prefill)
    return el;
  }

  /** Angka MENTAH dari elemen ("" / tak valid -> 0). */
  function getValue(el) {
    if (!el) return 0;
    return parseDisplay(el.value);
  }

  /** Tulis nilai terformat ke elemen. */
  function setValue(el, n) {
    if (!el) return;
    el.value = formatDigits(n);
  }

  var api = {
    MAX_DIGIT: MAX_DIGIT,
    normalizeDigits: normalizeDigits,
    formatDigits: formatDigits,
    parseDisplay: parseDisplay,
    formatElement: formatElement,
    attach: attach,
    getValue: getValue,
    setValue: setValue
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.FormatAngka = api;
    // Alias datar sesuai nama fungsi di spesifikasi.
    global.normalizeDigits = normalizeDigits;
    global.formatDigits = formatDigits;
    global.parseDisplay = parseDisplay;
    global.attach = attach;
    global.getValue = getValue;
    global.setValue = setValue;
  }
})(
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
      ? globalThis
      : this
);
