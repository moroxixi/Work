/**
 * MAO Admin — Member (client)
 *
 * Flow: PIN gate → daftar member ringkas → searchable dropdown → pilih member
 * → adminGetMemberDetail → form edit (Kode Membership read-only) → Simpan.
 *
 * TUGAS 4: Tombol "Generate Kartu Member" — reuse render logic dari
 * Pendaftaran/showCard() dengan data dari adminGetMemberDetail. Kartu
 * dirender client-side dari data mentah (bukan file/URL di sheet).
 *
 * TUGAS 5: Upload foto profil baru — compress via MAO_CONFIG.compressImageToBase64,
 * kirim ke backend bersama field lain. Backend upload ke Drive + update fotoUrl.
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

  // TUGAS 5: Photo upload elements
  var fotoUploadArea = document.getElementById('fotoUploadArea');
  var fotoInput      = document.getElementById('fotoInput');
  var fotoPreview    = document.getElementById('fotoPreview');
  var fotoPlaceholder = document.getElementById('fotoPlaceholder');
  var newFotoBase64 = null;
  var newFotoMimeType = '';
  var newFotoFileName = '';

  // TUGAS 4: Card elements
  var cardSection     = document.getElementById('cardSection');
  var membershipCard  = document.getElementById('membershipCard');
  var cardKode        = document.getElementById('cardKode');
  var cardNama        = document.getElementById('cardNama');
  var cardDomisili    = document.getElementById('cardDomisili');
  var cardUsername    = document.getElementById('cardUsername');
  var cardFotoProfil  = document.getElementById('cardFotoProfil');
  var downloadCardBtn = document.getElementById('downloadCardBtn');
  var closeCardBtn    = document.getElementById('closeCardBtn');
  var cardObjectUrl   = null;

  // ─── STATE ───────────────────────────────────────────────────────────────
  var memberList = [];
  var currentDetail = null;
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

  function toInputDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ─── LOAD DAFTAR MEMBER ────────────────────────────────────────────────

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

  // ─── SEARCHABLE DROPDOWN ────────────────────────────────────────────────

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

  kodeSearch.addEventListener('blur', function () {
    setTimeout(closeDropdown, 150);
  });

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

    // Reset photo upload state
    resetFotoUpload();

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
    resetFotoUpload();
    kodeSearch.focus();
  });

  // ─── PHOTO UPLOAD (TUGAS 5) ────────────────────────────────────────────

  fotoUploadArea.addEventListener('click', function () {
    fotoInput.click();
  });

  fotoInput.addEventListener('change', async function () {
    var file = fotoInput.files[0];
    if (!file) return;
    fotoInput.value = '';

    if (file.size > 10 * 1024 * 1024) {
      showFormMsg('Ukuran foto terlalu besar (maksimal 10MB).');
      return;
    }

    try {
      var result = await MAO_CONFIG.compressImageToBase64(file);
      newFotoBase64 = result.base64;
      newFotoMimeType = result.mimeType;
      newFotoFileName = (currentDetail ? currentDetail.kodeMembership : 'member') + '_' + Date.now() + '.jpg';

      // Show preview
      var blob = (function () {
        var byteChars = atob(result.base64);
        var sliceSize = 512;
        var byteArrays = [];
        for (var offset = 0; offset < byteChars.length; offset += sliceSize) {
          var slice = byteChars.slice(offset, offset + sliceSize);
          var bytes = new Uint8Array(slice.length);
          for (var i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
          byteArrays.push(bytes);
        }
        return new Blob(byteArrays, { type: result.mimeType || 'image/jpeg' });
      })();

      if (cardObjectUrl) URL.revokeObjectURL(cardObjectUrl);
      cardObjectUrl = URL.createObjectURL(blob);
      fotoPreview.src = cardObjectUrl;
      fotoPreview.hidden = false;
      fotoPlaceholder.hidden = true;
    } catch (err) {
      console.error('Compression error:', err);
      showFormMsg('Gagal memproses foto. Coba lagi dengan foto lain.');
    }
  });

  function resetFotoUpload() {
    newFotoBase64 = null;
    newFotoMimeType = '';
    newFotoFileName = '';
    fotoInput.value = '';
    fotoPreview.hidden = true;
    fotoPlaceholder.hidden = false;
    if (cardObjectUrl) {
      URL.revokeObjectURL(cardObjectUrl);
      cardObjectUrl = null;
    }
  }

  // ─── SIMPAN PERUBAHAN ────────────────────────────────────────────────────

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
      var payload = {
        rowIndex: currentDetail.rowIndex,
        snapKode: currentDetail.kodeMembership,
        Nama: validation.data.Nama,
        Domisili: validation.data.Domisili,
        TanggalLahir: validation.data.TanggalLahir,
        JenisKelamin: validation.data.JenisKelamin,
        Status: validation.data.Status,
        NomorWhatsApp: validation.data.NomorWhatsApp,
        Username: validation.data.Username
      };

      // Sertakan foto baru kalau ada
      if (newFotoBase64) {
        payload.fotoBase64 = newFotoBase64;
        payload.fotoMimeType = newFotoMimeType;
        payload.fotoNamaFile = newFotoFileName;
      }

      var json = await MAO_ADMIN.adminFetch('adminUpdateMember', payload);

      if (json.success) {
        showFormMsg('✅ Perubahan tersimpan.');
        resetFotoUpload();
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

  async function refreshListQuietly() {
    try {
      var json = await MAO_ADMIN.adminFetch('adminGetMemberList');
      if (json && json.success) {
        memberList = json.memberList || [];
      }
    } catch (e) { /* list lama tetap dipakai */ }
  }

  // ─── GENERATE KARTU MEMBER (TUGAS 4) ──────────────────────────────────
  // Investigasi: kartu di Pendaftaran dirender murni CLIENT-SIDE dari data
  // mentah (showCard: kode, nama, domisili, username, foto blob lokal via
  // object URL). Tidak ada file/URL yang disimpan di sheet. Maka tombol
  // ini reuse pola yang SAMA: isi elemen kartu dari data adminGetMemberDetail,
  // render foto via object URL dari Drive URL, lalu download via html2canvas.

  function showMemberCard(member) {
    cardKode.textContent = member.kodeMembership;
    cardNama.textContent = member.nama;
    cardDomisili.textContent = member.domisili;
    cardUsername.textContent = '@' + (member.username || '');

    // Foto profil: convert Drive URL ke gambar display
    if (cardObjectUrl) {
      URL.revokeObjectURL(cardObjectUrl);
      cardObjectUrl = null;
    }

    if (member.fotoUrl) {
      // Drive URL → direct image URL
      var m = String(member.fotoUrl).match(/\/file\/d\/([A-Za-z0-9_-]+)/);
      if (m) {
        cardFotoProfil.src = 'https://drive.google.com/uc?export=view&id=' + m[1];
      } else {
        cardFotoProfil.src = member.fotoUrl;
      }
    }

    memberForm.hidden = true;
    searchSection.hidden = true;
    cardSection.hidden = false;
    cardSection.scrollIntoView({ behavior: 'smooth' });
  }

  downloadCardBtn.addEventListener('click', async function () {
    try {
      downloadCardBtn.disabled = true;
      downloadCardBtn.textContent = '⏳ Generating…';

      await new Promise(function (resolve) {
        if (cardFotoProfil.complete && cardFotoProfil.naturalWidth > 0) resolve();
        else {
          cardFotoProfil.addEventListener('load', resolve, { once: true });
          cardFotoProfil.addEventListener('error', resolve, { once: true });
        }
      });

      var canvas = await html2canvas(membershipCard, {
        backgroundColor: '#0a0a0a',
        scale: 2
      });

      var link = document.createElement('a');
      link.download = 'Membership-' + cardKode.textContent + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download card error:', err);
      showFormMsg('Gagal membuat gambar kartu. Coba screenshot manual.');
    } finally {
      downloadCardBtn.disabled = false;
      downloadCardBtn.textContent = '📥 Download Kartu';
    }
  });

  closeCardBtn.addEventListener('click', function () {
    if (cardObjectUrl) {
      URL.revokeObjectURL(cardObjectUrl);
      cardObjectUrl = null;
    }
    cardFotoProfil.removeAttribute('src');
    cardSection.hidden = true;
    memberForm.hidden = false;
    memberForm.scrollIntoView({ behavior: 'smooth' });
  });

  // Expose showMemberCard for form submit flow (tombol Generate)
  // We add a Generate button after save success
  window._showMemberCard = showMemberCard;

  retryBtn.addEventListener('click', loadMemberList);

  // ─── HARD REFRESH (TUGAS 10) ──────────────────────────────────────────
  (function () {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hard-refresh-btn';
    btn.textContent = '↻';
    btn.title = 'Refresh data';
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      btn.textContent = '⏳';
      await loadMemberList();
      btn.disabled = false;
      btn.textContent = '↻';
    });
    var formCard = document.querySelector('.form-card');
    if (formCard) { formCard.prepend(btn); }
  })();

  // ─── INIT (lewat PIN gate) ───────────────────────────────────────────────

  MAO_ADMIN.onReady(loadMemberList);
})();
