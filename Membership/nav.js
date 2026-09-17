// ============================================================
// nav.js — Quicknav bersama untuk Membership MAO
// (Pendaftaran, Submit Pesanan).
//
// Single source of truth untuk navigasi: tiap halaman cukup
// menaruh placeholder di HTML:
//
//   <nav class="quicknav" aria-label="Navigasi cepat"
//        data-page="pendaftaran|submit"></nav>
//
// Script ini mengisi item nav dengan path relatif yang dihitung
// dari kedalaman folder (data-depth). Item halaman aktif dirender
// sebagai elemen non-link (aria-current="page"), item lain
// sebagai <a>.
// ============================================================
(function () {
  'use strict';

  var MAIN_ITEMS = [
    {
      key: 'pendaftaran',
      label: 'Daftar',
      href: '../Pendaftaran/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    },
    {
      key: 'submit',
      label: 'Pesanan',
      href: '../Submit/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
    },
    {
      key: 'hasil',
      label: 'Laporan',
      href: '../Hasil/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>'
    },
    {
      key: 'leaderboard',
      label: 'Papan Skor',
      href: '../Leaderboard/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M8 4v10"/><path d="M16 4v10"/><path d="M7 14h10"/></svg>'
    },
    {
      key: 'hadiah',
      label: 'Hadiah',
      href: '../Hadiah/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>'
    }
  ];

  /**
   * Bangun satu item nav.
   * @param {string} className  kelas item (tanpa state aktif)
   * @param {boolean} isActive  true -> elemen non-link + aria-current="page"
   * @param {string|null} href  href untuk item non-aktif
   * @param {string} label      teks item
   * @param {string} html       HTML ikon+label
   */
  function buildItem(className, isActive, href, label, html) {
    var el = isActive ? document.createElement('div') : document.createElement('a');
    el.className = className + (isActive ? ' is-active' : '');
    if (isActive) el.setAttribute('aria-current', 'page');
    if (!isActive && href) el.setAttribute('href', href);
    el.innerHTML = html;
    return el;
  }

  function init() {
    var nav = document.querySelector('nav.quicknav');
    if (!nav) return;

    var page = nav.getAttribute('data-page') || '';
    var depth = parseInt(nav.getAttribute('data-depth') || '1', 10);
    if (isNaN(depth) || depth < 1) depth = 1;
    var prefix = new Array(depth + 1).join('../');

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
      nav.appendChild(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
