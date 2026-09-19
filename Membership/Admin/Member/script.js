/**
 * MAO Admin — Member (client)
 *
 * Flow: PIN gate (../admin-auth.js) → daftar member ringkas (kode +
 * username saja, via adminGetMemberList — data pribadi baru keluar lewat
 * adminGetMemberDetail setelah admin memilih, tetap di balik PIN) →
 * searchable dropdown (pola combobox Submit; dibuat versi sendiri karena
 * combobox Submit embedded di script halaman live — ekstraksi/reuse
 * berisiko regresi ke halaman produksi) → pilih member →
 * adminGetMemberDetail → form edit (Kode Membership read-only) →
 * Simpan → adminUpdateMember.
 *
 * Backend yang revalidasi: PIN per request, snapshot rowIndex+kode saat
 * update, username unik (exclude member yang sedang diedit), dan Kode
 * Membership di backend SENGAJA tidak dibaca dari payload (tidak bisa
 * diubah lewat endpoint ini — defense-in-depth di sisi server).
 */
(function () {
  'use strict';

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var loadingState = document.getElementById('loadingState');
  var errorState   = document.getElementById('errorState');
  var errorMsg     = document.getElementById('errorMsg');
  var retryBtn     = document.getElementById('retryBtn');
  var searchSection = document.getElementById('searchSection');

  var kodeSearch   = document.getElementById('kodeSearch');
  var kodeDropdown = document.getElementById('kodeDropdown');

  var memberForm   = document.getElementById('memberForm');
  var formStatus   = document.getElementById('formStatus');
  var kodeInput    = document.getElementById('kodeMembership');
  var namaInput    = document.getElementById('Nama');
  var usernameInput = document.getElementById('Username');
  var domisiliInput = document.getElementById('Domisili');
  var tanggalInput = document.getElementById('TanggalLahir');
  var jkSelect     = document.getElementById('JenisKelamin');
  var statusSelect = document.getElementById('Status');
  var waInput      = document.getElementById('NomorWhatsApp');
  var formMsg      = document.getElementById('formMsg');
  var saveBtn      = document.getElementById('saveBtn');
  var btnText      = saveBtn.querySelector('.btn-text');
  var btnLoading   = saveBtn.querySelector('.btn-loading');
  var cancelBtn    = document.getElementById('cancelBtn');

  // ─── STATE ───────────────────────────────────────────────────────────────
  var memberList = [];        // [{kode, username}] ringkas (tanpa data pribadi)
  var currentDetail = null;   // hasil adminGetMemberDetail (termasuk rowIndex)
  var saveBusy = false;

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showState(state) {
    loadingState.hidden = state !== 'loading';
    errorState.hidden = state !== 'error';
    searchSection.hidden = state !== 'search';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    showState('error');
  }

  function showFormMsg(msg) {
    formMsg.textContent = msg;
    formMsg.hidden = false;
  }

  function hideFormMsg() {
    formMsg.hidden = true;
    formMsg.textContent = '';
  }

  /**
   * Normalisasi tanggal dari sheet ke YYYY-MM-DD untuk <input type="date">.
   * Sheet bisa memberi Date-serialize ("Sat Mar 01 2026 ...") atau ISO.
   */
  function toInputDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ─── LOAD DAFTAR MEMBER (ringkas: kode + username saja) ─────────────────

  async function loadMemberList() {
    showState('loading');
    try {
      var json = await MAO_ADMIN.adminFetch('adminGetMemberList');
      if (!json.success) {
        if (MAO_ADMIN.isUnauthorized(json)) { MAO_ADMIN.relock(); return; }
        throw new Error(json.error || 'Gagal memuat data');
      }
      memberList = json.memberList || [];
      showState('search');
    } catch (err) {
      console.error('Load member list error:', err);
      showError('Gagal memuat daftar member: ' + err.message);
    }
  }

  // ─── SEARCHABLE DROPDOWN (pola combobox Submit, versi halaman ini) ───────

  function renderOptions(query) {
    var q = String(query || '').trim().toLowerCase();
    var filtered = memberList.filter(function (m) {
      if (!q) return true;
      return m.kode.toLowerCase().indexOf(q) !== -1 ||
        (m.username || '').toLowerCase().indexOf(q) !== -1;
    });

    kodeDropdown.innerHTML = '';

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'kode-option-empty';
      empty.textContent = 'Tidak ada member yang cocok.';
      kodeDropdown.appendChild(empty);
      return;
    }

    filtered.forEach(function (m) {
      var opt = document.createElement('div');
      opt.className = 'kode-option';
      opt.setAttribute('data-kode', m.kode);

      var kodeEl = document.createElement('span');
      kodeEl.textContent = m.kode;

      var unameEl = document.createElement('span');
      unameEl.className = 'kode-username';
      unameEl.textContent = m.username ? '@' + m.username : '';

      opt.appendChild(kodeEl);
      opt.appendChild(unameEl);
      kodeDropdown.appendChild(opt);
    });
  }

  function openDropdown() { kodeDropdown.hidden = false; }
  function closeDropdown() { kodeDropdown.hidden = true; }

  kodeSearch.addEventListener('input', function () {
    renderOptions(kodeSearch.value);
    openDropdown();
  });

  kodeSearch.addEventListener('focus', function () {
    renderOptions(kodeSearch.value);
    openDropdown();
  });

  // Blur → tutup dropdown (delay 150ms fallback; jalur utama = mousedown)
  kodeSearch.addEventListener('blur', function () {
    setTimeout(closeDropdown, 150);
  });

  // mousedown + preventDefault: input tidak kehilangan fokus sebelum pilih
  kodeDropdown.addEventListener('mousedown', function (e) {
    var opt = e.target.closest('.kode-option');
    if (!opt) return;
    e.preventDefault();
    selectMember(opt.getAttribute('data-kode'));
  });

  document.addEventListener('click', function (e) {
    if (!kodeDropdown.hidden && !e.target.closest('.kode-combo')) {
      closeDropdown();
    }
  });

  // ─── PILIH MEMBER → DETAIL → ISI FORM ────────────────────────────────────

  async function selectMember(kode) {
    closeDropdown();
    kodeSearch.value = '';
    showState('loading');

    try {
      var json = await MAO_ADMIN.adminFetch('adminGetMemberDetail', {
        kodeMembership: kode
      });
      if (!json.success) {
        if (MAO_ADMIN.isUnauthorized(json)) { MAO_ADMIN.relock(); return; }
        throw new Error(json.error || 'Gagal memuat detail member');
      }
      fillForm(json.member);
    } catch (err) {
      console.error('Load member detail error:', err);
      showError('Gagal memuat detail member: ' + err.message);
    }
  }

  function fillForm(member) {
    currentDetail = member;

    // Kode Membership: READ-ONLY — hanya ditampilkan, tidak bisa diketik.
    kodeInput.value = member.kodeMembership;

    namaInput.value = member.nama || '';
    usernameInput.value = member.username || '';
    domisiliInput.value = member.domisili || '';
    tanggalInput.value = toInputDate(member.tanggalLahir);
    jkSelect.value = member.jenisKelamin || '';
    statusSelect.value = member.status || '';
    waInput.value = member.nomorWhatsApp || '';

    formStatus.textContent =
      'Mengedit: ' + member.kodeMembership +
      (member.username ? ' (@' + member.username + ')' : '') +
      ' — baris sheet #' + member.rowIndex;

    hideFormMsg();
    showState('search');
    searchSection.hidden = true;
    memberForm.hidden = false;
    memberForm.scrollIntoView({ behavior: 'smooth' });
  }

  cancelBtn.addEventListener('click', function () {
    currentDetail = null;
    memberForm.hidden = true;
    searchSection.hidden = false;
    hideFormMsg();
    kodeSearch.focus();
  });

  // ─── SIMPAN PERUBAHAN ────────────────────────────────────────────────────

  // Validasi client ringan (format saja); keputusan akhir selalu di backend.
  function validateClient() {
    var fields = {
      Nama: namaInput.value.trim(),
      Domisili: domisiliInput.value.trim(),
      TanggalLahir: tanggalInput.value,
      JenisKelamin: jkSelect.value,
      Status: statusSelect.value,
      NomorWhatsApp: waInput.value.trim(),
      Username: usernameInput.value.trim()
    };

    for (var key in fields) {
      if (!fields[key]) {
        return { ok: false, msg: 'Field "' + key + '" wajib diisi.' };
      }
    }

    var phone = fields.NomorWhatsApp.replace(/[\s\-()]/g, '');
    if (!/^\d+$/.test(phone)) {
      return { ok: false, msg: 'Nomor WhatsApp hanya boleh berisi digit angka.' };
    }
    if (!/^08\d/.test(phone) && !/^62\d/.test(phone)) {
      return { ok: false, msg: 'Nomor WhatsApp harus diawali 08 atau 62.' };
    }
    if (phone.length < 9 || phone.length > 15) {
      return { ok: false, msg: 'Nomor WhatsApp harus 9–15 digit.' };
    }

    if (!/^[A-Za-z0-9_]{3,20}$/.test(fields.Username)) {
      return { ok: false, msg: 'Username hanya boleh berisi huruf, angka, dan underscore (3–20 karakter).' };
    }

    return { ok: true, data: fields };
  }

  memberForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideFormMsg();

    if (!currentDetail || saveBusy) return;

    var validation = validateClient();
    if (!validation.ok) {
      showFormMsg(validation.msg);
      return;
    }

    saveBusy = true;
    saveBtn.disabled = true;
    btnText.hidden = true;
    btnLoading.hidden = false;

    try {
      var json = await MAO_ADMIN.adminFetch('adminUpdateMember', {
        rowIndex: currentDetail.rowIndex,
        snapKode: currentDetail.kodeMembership,
        // Kode Membership SENGAJA TIDAK dikirim — tidak bisa diubah.
        Nama: validation.data.Nama,
        Domisili: validation.data.Domisili,
        TanggalLahir: validation.data.TanggalLahir,
        JenisKelamin: validation.data.JenisKelamin,
        Status: validation.data.Status,
        NomorWhatsApp: validation.data.NomorWhatsApp,
        Username: validation.data.Username
      });

      if (json.success) {
        showFormMsg('✅ Perubahan tersimpan.');
        // Refresh list supaya dropdown pakai username terbaru.
        await refreshListQuietly();
      } else {
        if (MAO_ADMIN.isUnauthorized(json)) { MAO_ADMIN.relock(); return; }
        showFormMsg(json.error || 'Gagal menyimpan perubahan.');
      }
    } catch (err) {
      console.error('Update member error:', err);
      showFormMsg('Gagal menyimpan. Periksa koneksi internet lalu coba lagi.');
    } finally {
      saveBusy = false;
      saveBtn.disabled = false;
      btnText.hidden = false;
      btnLoading.hidden = true;
    }
  });

  /** Refresh list tanpa pindah state (form tetap terbuka). */
  async function refreshListQuietly() {
    try {
      var json = await MAO_ADMIN.adminFetch('adminGetMemberList');
      if (json && json.success) {
        memberList = json.memberList || [];
      }
    } catch (e) { /* list lama tetap dipakai */ }
  }

  retryBtn.addEventListener('click', loadMemberList);

  // ─── INIT (lewat PIN gate) ───────────────────────────────────────────────

  MAO_ADMIN.onReady(loadMemberList);
})();
