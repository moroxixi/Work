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

  function driveImageUrl(url, big) {
    var m = String(url || '').match(/\/file\/d\/([A-Za-z0-9_-]+)/);
    if (!m) return String(url || '');
    var id = m[1];
    return big
      ? 'https://drive.google.com/uc?export=view&id=' + id
      : 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
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

    pesananCount.textContent =
      totalOrders + ' pesanan tercatat (' +
      result.groups.length + ' order, ' +
      result.legacy.length + ' baris lama).';

    if (totalOrders === 0) {
      pesananCount.textContent = 'Belum ada pesanan tercatat.';
      showState('list');
      return;
    }

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

  /** Build receipt-style card for a grouped order */
  function buildReceiptCard(group) {
    var items = group.items;
    var first = items[0];

    var card = document.createElement('div');
    card.className = 'pesanan-card receipt-card';

    // Foto bukti (ambil dari baris pertama — semua baris 1 order punya foto sama)
    var fotoWrap = document.createElement('div');
    fotoWrap.className = 'pesanan-foto-wrap';
    if (first.fotoUrl) {
      var img = document.createElement('img');
      img.className = 'pesanan-foto';
      img.alt = 'Foto bukti ' + first.kodeMembership;
      img.loading = 'lazy';
      img.src = driveImageUrl(first.fotoUrl, false);
      img.addEventListener('click', function () { openLightbox(first.fotoUrl); });
      fotoWrap.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'pesanan-foto pesanan-foto-empty';
      ph.textContent = '📷';
      fotoWrap.appendChild(ph);
    }
    card.appendChild(fotoWrap);

    // Info: header + items list
    var info = document.createElement('div');
    info.className = 'pesanan-info';

    // Header
    var header = document.createElement('div');
    header.className = 'receipt-header';
    header.innerHTML =
      '<div class="pesanan-kode">' + escapeHtml(first.kodeMembership) + '</div>' +
      '<div class="pesanan-meta">' + escapeHtml(formatWaktu(first.timestamp)) + '</div>' +
      '<div class="pesanan-orderid">Order: ' + escapeHtml(group.orderId.slice(0, 8)) + '…</div>';
    info.appendChild(header);

    // Items list
    var itemsList = document.createElement('div');
    itemsList.className = 'receipt-items';
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'receipt-item';
      row.innerHTML =
        '<span class="receipt-item-name">' + escapeHtml(item.namaMenu) + '</span>' +
        '<span class="receipt-item-qty">× ' + escapeHtml(String(item.qty)) + '</span>';
      itemsList.appendChild(row);
    });
    info.appendChild(itemsList);

    card.appendChild(info);

    // Action buttons: Edit & Hapus (order-level)
    var actions = document.createElement('div');
    actions.className = 'receipt-actions';

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-edit';
    editBtn.textContent = '✏️ Edit';
    editBtn.addEventListener('click', function () { openEditModal(group); });
    actions.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.textContent = '🗑️ Hapus';
    delBtn.addEventListener('click', function () { openDeleteModal(group); });
    actions.appendChild(delBtn);

    card.appendChild(actions);

    return card;
  }

  /** Build legacy card (no orderId — 1 card per row, like before) */
  function buildLegacyCard(p) {
    var card = document.createElement('div');
    card.className = 'pesanan-card legacy-card';

    var fotoWrap = document.createElement('div');
    fotoWrap.className = 'pesanan-foto-wrap';
    if (p.fotoUrl) {
      var img = document.createElement('img');
      img.className = 'pesanan-foto';
      img.alt = 'Foto bukti ' + p.kodeMembership;
      img.loading = 'lazy';
      img.src = driveImageUrl(p.fotoUrl, false);
      img.addEventListener('click', function () { openLightbox(p.fotoUrl); });
      fotoWrap.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'pesanan-foto pesanan-foto-empty';
      ph.textContent = '📷';
      fotoWrap.appendChild(ph);
    }
    card.appendChild(fotoWrap);

    var info = document.createElement('div');
    info.className = 'pesanan-info';
    info.innerHTML =
      '<div class="pesanan-kode">' + escapeHtml(p.kodeMembership) + '</div>' +
      '<div class="pesanan-menu">' + escapeHtml(p.namaMenu) + '</div>' +
      '<div class="pesanan-meta">× ' + escapeHtml(String(p.qty)) +
      ' &nbsp;•&nbsp; ' + escapeHtml(formatWaktu(p.timestamp)) + '</div>' +
      '<div class="pesanan-legacy-label">order lama</div>';
    card.appendChild(info);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.textContent = '🗑️ Hapus';
    delBtn.addEventListener('click', function () { openDeleteModal(p); });
    card.appendChild(delBtn);

    return card;
  }

  // ─── LIGHTBOX ────────────────────────────────────────────────────────────

  function openLightbox(url) {
    lightboxImg.src = driveImageUrl(url, true);
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
    var formCard = document.querySelector('.form-card');
    if (formCard) { formCard.prepend(btn); }
  })();

  // ─── INIT (lewat PIN gate) ───────────────────────────────────────────────

  MAO_ADMIN.onReady(async function () {
    await loadMenuList();
    await loadList();
  });
})();
