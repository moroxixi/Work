/**
 * sections.js — fungsi murni (tanpa DOM) untuk section dinamis Dashboard.
 *
 * Dipakai oleh script.js (window.DashboardSections) dan bisa diuji di node
 * (module.exports bila `module` ada).
 *
 * Aturan:
 * - compareTitle: urut A-Z memakai Intl.Collator('id', {sensitivity:'base',
 *   numeric:true}) sehingga "App 2" < "App 10" dan huruf kapital/aksen tidak
 *   mengacaukan urutan; judul kosong diurut PALING AKHIR; judul sama
 *   mempertahankan urutan awal (return 0 -> sort stabil); input TIDAK
 *   dimutasi oleh fungsi ini.
 * - buildSections(items, fallbackFn) -> [{key, label, items}]:
 *     * key = String(p.section||'').trim().toLowerCase(); kalau kosong ->
 *       key hasil fallbackFn(p) (di script.js: isBusiness(p.category) ?
 *       'business' : 'projects').
 *     * Kapitalisasi berbeda (Business/business/BUSINESS) menyatu jadi satu
 *       section; label = penulisan pertama yang muncul.
 *     * Section diurut A-Z (collator yang sama); item di dalam section diurut
 *       compareTitle.
 *     * Array input tidak dimutasi; aman untuk 30+ section.
 */
(function (global) {
  'use strict';

  var collator = new Intl.Collator('id', {
    sensitivity: 'base',
    numeric: true
  });

  function titleOf(item) {
    if (item === null || item === undefined) return '';
    var t = item.title;
    if (t === null || t === undefined) return '';
    return String(t);
  }

  /** Perbandingan dua item berdasarkan judulnya (lihat aturan di atas). */
  function compareTitle(a, b) {
    var ta = titleOf(a);
    var tb = titleOf(b);
    var ea = ta.trim() === '';
    var eb = tb.trim() === '';
    if (ea && eb) return 0; // sama-sama kosong -> urutan awal dipertahankan
    if (ea) return 1;       // judul kosong -> paling akhir
    if (eb) return -1;
    return collator.compare(ta, tb);
  }

  function fallbackKeyOf(fallbackFn, item) {
    var fb = '';
    if (typeof fallbackFn === 'function') {
      fb = fallbackFn(item);
    }
    return String(fb === null || fb === undefined ? '' : fb)
      .trim()
      .toLowerCase();
  }

  /**
   * Kelompokkan item menjadi section terurut A-Z.
   * @param {Array} items daftar item (tidak dimutasi)
   * @param {Function} fallbackFn penghasil key bila p.section kosong
   * @return {Array<{key:string,label:string,items:Array}>}
   */
  function buildSections(items, fallbackFn) {
    var list = Array.isArray(items) ? items : [];
    var order = []; // urutan kemunculan pertama: {key, label, entries:[{item,idx}]}
    var byKey = Object.create(null);

    list.forEach(function (item, idx) {
      var raw =
        item && item.section !== null && item.section !== undefined
          ? String(item.section)
          : '';
      var trimmed = raw.trim();
      var key = trimmed !== '' ? trimmed.toLowerCase() : fallbackKeyOf(fallbackFn, item);
      // Label = penulisan pertama (fallback memakai teks fallback-nya).
      var label = trimmed !== '' ? trimmed : String(
        typeof fallbackFn === 'function' ? fallbackFn(item) : ''
      ).trim();

      var entry = byKey[key];
      if (!entry) {
        entry = { key: key, label: label, pairs: [] };
        byKey[key] = entry;
        order.push(entry);
      }
      entry.pairs.push({ item: item, idx: idx });
    });

    // Item per section: judul A-Z, urutan awal dipertahankan (stabil via idx).
    var sections = order.map(function (entry) {
      var pairs = entry.pairs.slice(); // salinan: tidak menyentuh urutan asli
      pairs.sort(function (a, b) {
        var c = compareTitle(a.item, b.item);
        if (c !== 0) return c;
        return a.idx - b.idx; // stability
      });
      return {
        key: entry.key,
        label: entry.label,
        items: pairs.map(function (p) { return p.item; })
      };
    });

    // Section A-Z lewat collator yang sama (key sudah ternormalisasi).
    sections.sort(function (a, b) {
      return collator.compare(a.key, b.key);
    });

    return sections;
  }

  var api = {
    compareTitle: compareTitle,
    buildSections: buildSections
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.DashboardSections = api;
  }
})(
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
      ? globalThis
      : this
);
