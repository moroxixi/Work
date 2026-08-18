// ============================================================
// nav.js — Quicknav bersama untuk 5 halaman Pencatatan-Buku-Kas
// (Kas Harian, Scan Struk, Scan Struk/Rekap, Riwayat, Stok).
//
// Single source of truth untuk navigasi: tiap halaman cukup
// menaruh placeholder di HTML:
//
//   <nav class="quicknav" aria-label="Navigasi cepat"
//        data-page="kas|scan|rekap|riwayat|stok" data-depth="0|1|2"></nav>
//
// Script ini mengisi item nav utama + sub-nav alur Scan Struk
// (Scan Struk <-> Rekap Harga) dengan path relatif yang dihitung
// dari kedalaman folder (data-depth). Item halaman aktif dirender
// sebagai elemen non-link (sesuai pola yang sudah ada), item lain
// sebagai <a>.
// ============================================================
(function () {
  'use strict';

  // 4 item utama. `href` relatif terhadap ROOT Pencatatan-Buku-Kas/;
  // prefix '../' ditambahkan sesuai data-depth halaman pemuat.
  var MAIN_ITEMS = [
    {
      key: 'kas',
      label: 'Kas Harian',
      href: 'index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1"/></svg>'
    },
    {
      key: 'scan',
      label: 'Scan Struk',
      href: 'Scan-Struk/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M20 7V5a1 1 0 0 0-1-1h-2"/><path d="M4 17v2a1 1 0 0 0 1 1h2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><rect x="7" y="8" width="10" height="8" rx="1"/></svg>'
    },
    {
      key: 'riwayat',
      label: 'Riwayat',
      href: 'Riwayat/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M9 3h6"/></svg>'
    },
    {
      key: 'stok',
      label: 'Stok',
      href: 'Stok/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z"/><path d="M3.5 8v8L12 20l8.5-4V8"/><path d="M12 12v8"/></svg>'
    }
  ];

  // Sub-nav alur Scan Struk — hanya dirender di halaman Scan Struk & Rekap.
  // Href relatif terhadap folder tempat halaman itu berada; `href: null`
  // berarti item = halaman aktif (dirender sebagai elemen non-link).
  var SUB_NAV = {
    scan: [
      { key: 'scan', label: 'Scan Struk', href: null },
      { key: 'rekap', label: 'Rekap Harga', href: 'Rekap/index.html' }
    ],
    rekap: [
      { key: 'scan', label: 'Scan Struk', href: '../index.html' },
      { key: 'rekap', label: 'Rekap Harga', href: null }
    ]
  };

  /**
   * Bangun satu item nav.
   * @param {string} className  kelas item (tanpa state aktif)
   * @param {boolean} isActive  true -> elemen non-link + aria-current="page"
   * @param {string|null} href  href untuk item non-aktif
   * @param {string} label      teks item (dipakai kalau `html` null)
   * @param {string|null} html  HTML ikon+label (item utama); null -> textContent
   */
  function buildItem(className, isActive, href, label, html) {
    var el = isActive ? document.createElement('div') : document.createElement('a');
    el.className = className + (isActive ? ' is-active' : '');
    if (isActive) el.setAttribute('aria-current', 'page');
    if (!isActive && href) el.setAttribute('href', href);
    if (html) el.innerHTML = html;
    else el.textContent = label;
    return el;
  }

  function init() {
    var nav = document.querySelector('nav.quicknav');
    if (!nav) return;

    var page = nav.getAttribute('data-page') || '';
    var depth = parseInt(nav.getAttribute('data-depth') || '0', 10);
    if (isNaN(depth) || depth < 0) depth = 0;
    var prefix = depth === 0 ? '' : new Array(depth + 1).join('../');

    // ---- Item utama ----
    MAIN_ITEMS.forEach(function (item) {
      var isActive = item.key === page;
      var href = isActive ? null : prefix + item.href;
      var el = buildItem(
        'quicknav-item quicknav-' + item.key,
        isActive,
        href,
        item.label,
        '<span class="quicknav-icon" aria-hidden="true">' + item.icon + '</span>' +
          '<span class="quicknav-label">' + item.label + '</span>'
      );

      // Halaman Rekap berada di dalam alur Scan Struk: tandai item Scan Struk
      // sebagai "section aktif" — tampil nonaktif/abu-abu konsisten dengan is-active.
      if (!isActive && item.key === 'scan' && page === 'rekap') {
        el.classList.add('is-section');
      }
      nav.appendChild(el);
    });

    // ---- Sub-nav alur Scan Struk (hanya di halaman scan/rekap) ----
    var subDef = SUB_NAV[page];
    if (!subDef) return;

    var sub = document.createElement('div');
    sub.className = 'subnav';
    sub.setAttribute('role', 'navigation');
    sub.setAttribute('aria-label', 'Sub-navigasi Scan Struk');
    subDef.forEach(function (item) {
      var isActive = item.key === page;
      var el = buildItem('subnav-item', isActive, item.href, item.label, null);
      // Di halaman Scan Struk, item utama quicknav sudah punya aria-current;
      // penanda sub-nav yang sama cuma redundan. Hanya halaman Rekap (yang
      // tidak punya item utama aktif) yang butuh aria-current di sub-nav.
      if (isActive && page !== 'rekap') el.removeAttribute('aria-current');
      sub.appendChild(el);
    });
    nav.insertAdjacentElement('afterend', sub);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
