/**
 * MAO Admin — Check Pesanan (client)
 *
 * List semua baris tab "Submit Pesanan" via adminFetch('adminListPesanan'),
 * GROUP by Order ID jadi format struk (receipt), dengan tombol Edit & Hapus
 * level order. Baris lama TANPA Order ID ditampilkan sebagai card per-baris
 * (fallback, label "order lama").
 *
 * Edit order: modal form dengan dropdown menu (dari Daftar Menu sheet),
 * ubah qty, hapus item, tambah item baru. Snapshot revalidation wajib.
 *
 * Hapus order: hapus SEMUA baris dengan Order ID sama. Snapshot revalidation
 * mencakup seluruh set item.
 */
(function () {
  'use strict';

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var loadingState = document.getElementById('loadingState');
  var errorState   = document.getElementById('errorState');
  var errorMsg     = document.getElementById('errorMsg');
  var retryBtn     = document.getElementById('retryBtn');
  var listSection  = document.getElementById('listSection');
  var pesananCount = document.getElementById('pesananCount');
  var pesananList  = document.getElementById('pesananList');
  var summaryValue = document.getElementById('summaryValue');
  var summaryItems = document.getElementById('summaryItems');
  var emptyState   = document.getElementById('emptyState');

  var lightbox      = document.getElementById('lightbox');
  var lightboxImg   = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxCloseBtn');

  var deleteModal      = document.getElementById('deleteModal');
  var deleteModalText  = document.getElementById('deleteModalText');
  var deleteModalMsg   = document.getElementById('deleteModalMsg');
  var deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
  var deleteCancelBtn  = document.getElementById('deleteCancelBtn');

  // Edit modal
  var editModal      = document.getElementById('editModal');
  var editModalMsg   = document.getElementById('editModalMsg');
  var editModalItems = document.getElementById('editModalItems');
  var editAddItemBtn = document.getElementById('editAddItemBtn');
  var editConfirmBtn = document.getElementById('editConfirmBtn');
  var editCancelBtn  = document.getElementById('editCancelBtn');

  // ─── STATE ───────────────────────────────────────────────────────────────
  var pendingDelete = null;
  var deleteBusy = false;
  var pendingEdit = null;
  var editBusy = false;
  var allMenuNames = []; // daftar menu dari Daftar Menu sheet

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showState(state) {
    loadingState.hidden = state !== 'loading';
    errorState.hidden = state !== 'error';
    listSection.hidden = state !== 'list';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    showState('error');
  }

  /** "19 Sep 2026, 14:30" */
  function formatWaktu(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var tanggal = d.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    var jam = String(d.getHours()).padStart(2, '0');
    var menit = String(d.getMinutes()).padStart(2, '0');
    return tanggal + ', ' + jam + ':' + menit;
  }

  /**
   * URL gambar Drive dari kolom sheet. Ekstraksi ID + konversi URL dipusatkan
   * di config.js (MAO_CONFIG.driveImageUrl) supaya logikanya sama persis dengan
   * halaman Hadiah — varian link yang didukung: /file/d/<id>/view?usp=…,
   * open?id=<id>, uc?id=<id>, /d/<id>, lh3.googleusercontent.com/d/<id>.
   *
   * @param {string} url - nilai kolom URL foto dari sheet
   * @param {boolean} big - true untuk ukuran besar (lightbox)
   */
  function driveImageUrl(url, big) {
    if (typeof MAO_CONFIG !== 'undefined' && MAO_CONFIG.driveImageUrl) {
      return MAO_CONFIG.driveImageUrl(url, big ? 'big' : 'small');
    }
    return String(url || '');
  }

  // ─── GROUP BY ORDER ID ───────────────────────────────────────────────────

  function groupByOrderId(pesanan) {
    var groups = {};   // orderId → [items]
    var legacy = [];   // items without orderId

    pesanan.forEach(function (p) {
      if (p.orderId) {
        if (!groups[p.orderId]) groups[p.orderId] = [];
        groups[p.orderId].push(p);
      } else {
        legacy.push(p);
      }
    });

    // Sort groups by newest timestamp (descending)
    var groupList = Object.keys(groups).map(function (orderId) {
      var items = groups[orderId];
      // Use earliest timestamp for the group
      var ts = items.reduce(function (min, item) {
        var t = Date.parse(item.timestamp) || 0;
        return t < min ? t : min;
      }, Infinity);
      return { orderId: orderId, items: items, earliestTs: ts };
    });

    groupList.sort(function (a, b) { return b.earliestTs - a.earliestTs; });

    // Legacy items sorted by timestamp desc
    legacy.sort(function (a, b) {
      return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
    });

    return { groups: groupList, legacy: legacy };
  }

  // ─── LOAD DAFTAR MENU ───────────────────────────────────────────────────

  async function loadMenuList() {
    try {
      var resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL + '?action=getFormData');
      var json = await resp.json();
      if (json.success && json.menuList) {
        allMenuNames = json.menuList.filter(function (m) {
          return m && String(m).trim() !== '' && String(m).trim() !== 'Nama Menu';
        });
      }
    } catch (e) {
      // Menu list gagal di-load → edit form tetap jalan (dropdown mungkin kosong)
      console.error('Load menu list error:', e);
    }
  }

  // ─── LOAD & RENDER LIST ──────────────────────────────────────────────────

  async function loadList() {
    showState('loading');
    try {
      var json = await MAO_ADMIN.adminFetch('adminListPesanan');
      if (!json.success) {
        if (MAO_ADMIN.isUnauthorized(json)) { MAO_ADMIN.relock(); return; }
        throw new Error(json.error || 'Gagal memuat data');
      }
      renderList(json.pesanan || []);
    } catch (err) {
      console.error('Load pesanan error:', err);
      showError('Gagal memuat daftar pesanan: ' + err.message);
    }
  }

  function renderList(pesanan) {
    pesananList.innerHTML = '';

    var result = groupByOrderId(pesanan);
    var totalOrders = result.groups.length + result.legacy.length;

    // Summary strip (pola .profit-summary di MoroDuit/Admin/Riwayat):
    // angka besar + label kecil, bukan kalimat panjang seperti sebelumnya.
    summaryValue.textContent = totalOrders;
    summaryItems.textContent = pesanan.length;

    pesananCount.textContent =
      result.groups.length + ' order · ' +
      result.legacy.length + ' baris lama · ' +
      pesanan.length + ' baris item';

    if (totalOrders === 0) {
      pesananCount.textContent = '';
      emptyState.hidden = false;
      showState('list');
      return;
    }

    emptyState.hidden = true;

    // Render grouped orders (receipt format)
    result.groups.forEach(function (group) {
      pesananList.appendChild(buildReceiptCard(group));
    });

    // Render legacy rows (no orderId)
    result.legacy.forEach(function (p) {
      pesananList.appendChild(buildLegacyCard(p));
    });

    showState('list');
  }

  // ─── BUILDERS KARTU (anatomi kartu MoroDuit/Admin/Riwayat) ───────────────
  // Urutan informasi tiap kartu mengikuti .riwayat-card di Riwayat:
  //   baris 1 (header) : identitas utama (kiri, berwarna) + nilai ringkas (kanan)
  //   baris 2 (meta)   : atribut sekunder (kiri) + waktu (kanan)
  //   baris 3 (detail) : rincian item
  //   baris 4 (foot)   : catatan ringkas
  // Aksi (Edit/Hapus) ada di baris terpisah paling bawah.

  /** Placeholder saat foto tidak ada / semua sumber gambar gagal dimuat. */
  function buildFotoPlaceholder() {
    var ph = document.createElement('div');
    ph.className = 'pesanan-foto pesanan-foto-empty';
    ph.textContent = '📷';
    ph.title = 'Foto tidak bisa dimuat — pastikan file Drive di-share "Anyone with the link"';
    return ph;
  }

  /**
   * Pasang foto Drive pada <img> lewat jalur berlapis dari config.js:
   *   thumbnail?id=<ID> → lh3.googleusercontent.com/d/<ID> → onFail().
   * Listener dipasang SEBELUM src di-set supaya error pertama tertangkap.
   *
   * @param {HTMLImageElement} img
   * @param {string} url - nilai kolom URL foto dari sheet
   * @param {boolean} big - true untuk lightbox (w1600)
   * @param {function} [onFail] - dipanggil kalau kedua URL gagal
   */
  function setFotoDrive(img, url, big, onFail) {
    if (typeof MAO_CONFIG !== 'undefined' && MAO_CONFIG.attachDriveImageFallback) {
      MAO_CONFIG.attachDriveImageFallback(img, url, onFail);
    }
    img.src = driveImageUrl(url, big);
  }

  /** Foto bukti + lightbox. Klik foto TIDAK ikut membuka modal edit. */
  function buildFotoWrap(row) {
    var wrap = document.createElement('div');
    wrap.className = 'pesanan-foto-wrap';

    if (row.fotoUrl) {
      var img = document.createElement('img');
      img.className = 'pesanan-foto';
      img.alt = 'Foto bukti ' + row.kodeMembership;
      img.loading = 'lazy';
      img.addEventListener('click', function (e) {
        e.stopPropagation(); // jangan sampai ikut membuka modal edit kartu
        openLightbox(row.fotoUrl);
      });
      setFotoDrive(img, row.fotoUrl, false, function () {
        // thumbnail & lh3 dua-duanya gagal (mis. file Drive belum di-share
        // publik) → ganti dengan placeholder, bukan ikon gambar rusak.
        if (img.parentNode) img.parentNode.replaceChild(buildFotoPlaceholder(), img);
      });
      wrap.appendChild(img);
    } else {
      wrap.appendChild(buildFotoPlaceholder());
    }

    return wrap;
  }

  /** Daftar item (baris 3). */
  function buildItemsList(items) {
    var list = document.createElement('ul');
    list.className = 'card-items';

    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'card-item';
      li.innerHTML =
        '<span class="card-item-name">' + escapeHtml(item.namaMenu) + '</span>' +
        '<span class="card-item-qty">× ' + escapeHtml(String(item.qty)) + '</span>';
      list.appendChild(li);
    });

    return list;
  }

  /** Tombol aksi (Edit opsional + Hapus wajib). */
  function buildCardActions(onEdit, onDelete) {
    var actions = document.createElement('div');
    actions.className = 'card-actions';

    if (onEdit) {
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-edit';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation(); // kartu sendiri juga membuka edit — biar tidak dobel
        onEdit();
      });
      actions.appendChild(editBtn);
    }

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.textContent = '🗑️ Hapus';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onDelete();
    });
    actions.appendChild(delBtn);

    return actions;
  }

  /** Bikin kartu bisa diklik (pola card Riwayat: klik kartu = buka detail/edit). */
  function makeCardClickable(card, onClick, label) {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', label);
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });
  }

  /** Kartu 1 order (semua baris dengan Order ID sama digabung jadi 1 struk). */
  function buildReceiptCard(group) {
    var items = group.items;
    var first = items[0];
    var totalQty = items.reduce(function (acc, item) {
      return acc + (parseInt(item.qty, 10) || 0);
    }, 0);

    var card = document.createElement('article');
    card.className = 'pesanan-card';
    makeCardClickable(card, function () { openEditModal(group); },
      'Edit pesanan ' + first.kodeMembership);

    var main = document.createElement('div');
    main.className = 'card-main';
    main.appendChild(buildFotoWrap(first));

    var body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML =
      '<div class="card-head">' +
        '<span class="card-kode">' + escapeHtml(first.kodeMembership) + '</span>' +
        '<span class="card-total">' + escapeHtml(String(totalQty)) + ' item</span>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="card-order">Order: ' +
          escapeHtml(String(group.orderId).slice(0, 8)) + '…</span>' +
        '<span class="card-time">' + escapeHtml(formatWaktu(first.timestamp)) + '</span>' +
      '</div>';
    body.appendChild(buildItemsList(items));

    var foot = document.createElement('div');
    foot.className = 'card-foot';
    foot.innerHTML =
      '<span class="card-foot-label">Jumlah baris</span>' +
      '<span class="card-foot-label">' + items.length + ' baris</span>';
    body.appendChild(foot);

    main.appendChild(body);
    card.appendChild(main);
    card.appendChild(buildCardActions(
      function () { openEditModal(group); },
      function () { openDeleteModal(group); }
    ));

    return card;
  }

  /** Kartu baris lama (tanpa Order ID — 1 kartu per baris, tanpa Edit). */
  function buildLegacyCard(p) {
    var card = document.createElement('article');
    card.className = 'pesanan-card';

    var main = document.createElement('div');
    main.className = 'card-main';
    main.appendChild(buildFotoWrap(p));

    var body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML =
      '<div class="card-head">' +
        '<span class="card-kode">' + escapeHtml(p.kodeMembership) + '</span>' +
        '<span class="card-total">× ' + escapeHtml(String(p.qty)) + '</span>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="card-order">' + escapeHtml(p.namaMenu) + '</span>' +
        '<span class="card-time">' + escapeHtml(formatWaktu(p.timestamp)) + '</span>' +
      '</div>';

    var foot = document.createElement('div');
    foot.className = 'card-foot';
    foot.innerHTML =
      '<span class="badge-legacy">order lama</span>' +
      '<span class="card-foot-label">Baris #' + escapeHtml(String(p.rowIndex)) + '</span>';
    body.appendChild(foot);

    main.appendChild(body);
    card.appendChild(main);
    card.appendChild(buildCardActions(null, function () { openDeleteModal(p); }));

    return card;
  }

  // ─── LIGHTBOX ────────────────────────────────────────────────────────────

  function openLightbox(url) {
    setFotoDrive(lightboxImg, url, true, function () {
      // Versi besar gagal dimuat → tutup lightbox daripada menampilkan kotak
      // gambar rusak (foto di kartu sudah punya placeholder sendiri).
      closeLightbox();
    });
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.removeAttribute('src');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

  // ─── DELETE (order-level or single-row) ──────────────────────────────────

  function openDeleteModal(data) {
    pendingDelete = data;
    deleteModalMsg.hidden = true;
    deleteModalMsg.textContent = '';

    if (data.orderId) {
      // Order-level delete
      var itemSummary = data.items.map(function (i) {
        return i.namaMenu + ' × ' + i.qty;
      }).join(', ');
      deleteModalText.textContent =
        'Order ' + data.items[0].kodeMembership + ' — ' + itemSummary +
        ' (' + data.items.length + ' baris). Semua baris akan dihapus permanen.';
    } else {
      // Single-row delete (legacy)
      deleteModalText.textContent =
        data.kodeMembership + ' — ' + data.namaMenu + ' × ' + data.qty +
        ' (' + formatWaktu(data.timestamp) + '). Baris akan dihapus permanen.';
    }
    deleteModal.hidden = false;
  }

  function closeDeleteModal() {
    deleteModal.hidden = true;
    pendingDelete = null;
  }

  deleteCancelBtn.addEventListener('click', closeDeleteModal);
  deleteModal.querySelector('.sheet-modal-backdrop').addEventListener('click', closeDeleteModal);

  deleteConfirmBtn.addEventListener('click', async function () {
    if (!pendingDelete || deleteBusy) return;
    deleteBusy = true;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = '⏳ Menghapus…';
    deleteModalMsg.hidden = true;

    var data = pendingDelete;
    try {
      var payload;
      if (data.orderId) {
        // Order-level delete
        payload = {
          orderId: data.orderId,
          snapItems: JSON.stringify(data.items.map(function (i) {
            return { namaMenu: i.namaMenu, qty: String(i.qty) };
          }))
        };
      } else {
        // Single-row delete (legacy)
        payload = {
          rowIndex: data.rowIndex,
          snapTimestamp: data.timestamp,
          snapKode: data.kodeMembership,
          snapNamaMenu: data.namaMenu,
          snapQty: String(data.qty)
        };
      }

      var json = await MAO_ADMIN.adminFetch('adminDeletePesanan', payload);

      if (json.success) {
        closeDeleteModal();
        await loadList();
      } else {
        if (MAO_ADMIN.isUnauthorized(json)) { closeDeleteModal(); MAO_ADMIN.relock(); return; }
        deleteModalMsg.textContent = json.error || 'Gagal menghapus.';
        deleteModalMsg.hidden = false;
        if (json.errorType === 'stale') {
          closeDeleteModal();
          await loadList();
        }
      }
    } catch (err) {
      console.error('Delete pesanan error:', err);
      deleteModalMsg.textContent = 'Gagal menghapus. Periksa koneksi lalu coba lagi.';
      deleteModalMsg.hidden = false;
    } finally {
      deleteBusy = false;
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Ya, Hapus';
    }
  });

  // ─── EDIT ORDER ──────────────────────────────────────────────────────────

  function openEditModal(group) {
    pendingEdit = group;
    editModalMsg.hidden = true;
    editModalMsg.textContent = '';
    editModalItems.innerHTML = '';

    // Render current items as editable rows
    group.items.forEach(function (item) {
      addEditItemRow(item.namaMenu, item.qty);
    });

    editModal.hidden = false;
  }

  function closeEditModal() {
    editModal.hidden = true;
    pendingEdit = null;
  }

  function addEditItemRow(namaMenu, qty) {
    var row = document.createElement('div');
    row.className = 'edit-item-row';

    // Menu name: dropdown if menu list available, else text input
    var nameInput;
    if (allMenuNames.length > 0) {
      nameInput = document.createElement('select');
      nameInput.className = 'edit-item-name';
      // Add empty option
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '— Pilih menu —';
      nameInput.appendChild(emptyOpt);
      allMenuNames.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === namaMenu) opt.selected = true;
        nameInput.appendChild(opt);
      });
    } else {
      nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'edit-item-name';
      nameInput.placeholder = 'Nama menu';
      nameInput.value = namaMenu || '';
    }

    var qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'edit-item-qty';
    qtyInput.min = '1';
    qtyInput.value = qty || '1';

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'edit-item-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      row.remove();
    });

    row.appendChild(nameInput);
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    editModalItems.appendChild(row);
  }

  editAddItemBtn.addEventListener('click', function () {
    addEditItemRow('', '1');
  });

  editCancelBtn.addEventListener('click', closeEditModal);
  editModal.querySelector('.sheet-modal-backdrop').addEventListener('click', closeEditModal);

  editConfirmBtn.addEventListener('click', async function () {
    if (!pendingEdit || editBusy) return;

    // Collect items from form
    var rows = editModalItems.querySelectorAll('.edit-item-row');
    var newItems = [];
    for (var i = 0; i < rows.length; i++) {
      var nameEl = rows[i].querySelector('.edit-item-name');
      var qtyEl = rows[i].querySelector('.edit-item-qty');
      var name = (nameEl.value || '').trim();
      var qty = parseInt(qtyEl.value, 10);
      if (!name) continue; // skip empty rows
      if (isNaN(qty) || qty <= 0) qty = 1;
      newItems.push({ namaMenu: name, qty: qty });
    }

    if (newItems.length === 0) {
      editModalMsg.textContent = 'Minimal 1 item harus ada.';
      editModalMsg.hidden = false;
      return;
    }

    editBusy = true;
    editConfirmBtn.disabled = true;
    editConfirmBtn.textContent = '⏳ Menyimpan…';
    editModalMsg.hidden = true;

    try {
      var json = await MAO_ADMIN.adminFetch('adminUpdateOrder', {
        orderId: pendingEdit.orderId,
        snapItems: JSON.stringify(pendingEdit.items.map(function (i) {
          return { namaMenu: i.namaMenu, qty: String(i.qty) };
        })),
        newItems: JSON.stringify(newItems)
      });

      if (json.success) {
        closeEditModal();
        await loadList();
      } else {
        if (MAO_ADMIN.isUnauthorized(json)) { closeEditModal(); MAO_ADMIN.relock(); return; }
        editModalMsg.textContent = json.error || 'Gagal menyimpan perubahan.';
        editModalMsg.hidden = false;
        if (json.errorType === 'stale') {
          closeEditModal();
          await loadList();
        }
      }
    } catch (err) {
      console.error('Update order error:', err);
      editModalMsg.textContent = 'Gagal menyimpan. Periksa koneksi lalu coba lagi.';
      editModalMsg.hidden = false;
    } finally {
      editBusy = false;
      editConfirmBtn.disabled = false;
      editConfirmBtn.textContent = 'Simpan Perubahan';
    }
  });

  retryBtn.addEventListener('click', loadList);

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
      await loadList();
      btn.disabled = false;
      btn.textContent = '↻';
    });
    // Tombol refresh ditempel di header halaman (dulu di .form-card yang
    // sudah tidak dipakai lagi setelah redesign TUGAS #3).
    var header = document.querySelector('.page-header');
    if (header) { header.prepend(btn); }
  })();

  // ─── INIT (lewat guard login terpusat ../admin-auth.js) ───────────────────
  // onReady() akan REDIRECT ke ../index.html kalau belum login (gate PIN
  // embedded sudah dihapus), jadi loadMenuList/loadList hanya jalan authed.

  MAO_ADMIN.onReady(async function () {
    await loadMenuList();
    await loadList();
  });
})();
