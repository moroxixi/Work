/**
 * MAO Membership — Admin Quicknav (Check-Pesanan ↔ Member)
 *
 * Di-load oleh semua halaman di bawah Membership/Admin/ SEBELUM script.js
 * masing-masing, setelah admin-auth.js.
 *
 * Render SETELAH login terpusat lolos (via MAO_ADMIN.onReady) + DOM ready.
 * onReady() di admin-auth.js akan redirect ke ../index.html kalau belum login.
 * Dark theme konsisten dengan nav.js publik.
 *
 * Markup minimum yang wajib ada di HTML:
 *   <nav class="admin-nav" aria-label="Navigasi admin"></nav>
 */
(function () {
  'use strict';

  var NAV_ITEMS = [
    {
      key: 'check-pesanan',
      label: 'Pesanan',
      href: '../Check-Pesanan/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>'
    },
    {
      key: 'member',
      label: 'Member',
      href: '../Member/index.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'
    }
  ];

  function detectPage() {
    var path = window.location.pathname;
    if (path.indexOf('/Check-Pesanan/') !== -1) return 'check-pesanan';
    if (path.indexOf('/Member/') !== -1) return 'member';
    return '';
  }

  function renderAdminNav() {
    var nav = document.querySelector('nav.admin-nav');
    if (!nav) return;

    var currentPage = detectPage();
    nav.innerHTML = '';

    NAV_ITEMS.forEach(function (item) {
      var isActive = item.key === currentPage;
      var el = isActive ? document.createElement('div') : document.createElement('a');
      el.className = 'admin-nav-item' + (isActive ? ' is-active' : '');
      if (isActive) el.setAttribute('aria-current', 'page');
      if (!isActive) el.setAttribute('href', item.href);
      el.innerHTML =
        '<span class="admin-nav-icon" aria-hidden="true">' + item.icon + '</span>' +
        '<span class="admin-nav-label">' + item.label + '</span>';
      nav.appendChild(el);
    });
  }

  // Wait for both DOM ready AND login terverifikasi
  function whenReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // Register with MAO_ADMIN.onReady (called after PIN verification)
  // MAO_ADMIN is guaranteed to exist because admin-auth.js loads before this script.
  if (typeof MAO_ADMIN !== 'undefined' && MAO_ADMIN.onReady) {
    MAO_ADMIN.onReady(function () {
      whenReady(renderAdminNav);
    });
  } else {
    // Fallback: render directly when DOM ready
    whenReady(renderAdminNav);
  }
})();
