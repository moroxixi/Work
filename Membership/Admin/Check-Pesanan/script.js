/**
 * MAO Admin — Check Pesanan (client)
 *
 * List semua baris tab "Submit Pesanan" via adminFetch('adminListPesanan')
 * (PIN otomatis disertakan + re-validated backend per request), render kartu
 * per pesanan dengan thumbnail foto bukti (klik → lightbox), dan tombol
 * Hapus per baris → modal konfirmasi dulu (destructive) → POST
 * adminDeletePesanan dengan rowIndex + snapshot (timestamp+kode+menu+qty)
 * untuk revalidasi backend sebelum deleteRow.
 *
 * Kalau backend bilang "stale" (baris sudah berubah/bergeser), list di-refresh
 * otomatis dan admin diminta ulangi — JANGAN pernah memaksa hapus.
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

  // ─── STATE ───────────────────────────────────────────────────────────────
  var pendingDelete = null; // snapshot pesanan yang menunggu konfirmasi hapus
  var deleteBusy = false;

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
   * URL foto bukti di sheet = link Drive ".../file/d/ID/view" — TIDAK bisa
   * dipakai langsung sebagai <img src>. Convert ke URL gambar Drive:
   *   thumbnail (w400) untuk list, uc?export=view untuk lightbox.
   * Kalau pattern tidak match (mis. admin isi link eksternal), pakai apa adanya.
   */
  function driveImageUrl(url, big) {
    var m = String(url || '').match(/\/file\/d\/([A-Za-z0-9_-]+)/);
    if (!m) return String(url || '');
    var id = m[1];
    return big
      ? 'https://drive.google.com/uc?export=view&id=' + id
      : 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
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
    pesananCount.textContent =
      pesanan.length + ' pesanan tercatat (terbaru di atas).';

    if (pesanan.length === 0) {
      pesananCount.textContent = 'Belum ada pesanan tercatat.';
      showState('list');
      return;
    }

    pesanan.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'pesanan-card';

      // Foto bukti: thumbnail klik-perbesar. Kalau URL kosong → placeholder.
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
        (p.orderId
          ? '<div class="pesanan-orderid">Order: ' + escapeHtml(p.orderId) + '</div>'
          : '');
      card.appendChild(info);

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete';
      delBtn.textContent = '🗑️ Hapus';
      delBtn.addEventListener('click', function () { openDeleteModal(p); });
      card.appendChild(delBtn);

      pesananList.appendChild(card);
    });

    showState('list');
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

  // ─── DELETE (dengan konfirmasi + snapshot revalidation) ─────────────────

  function openDeleteModal(p) {
    pendingDelete = p;
    deleteModalMsg.hidden = true;
    deleteModalMsg.textContent = '';
    deleteModalText.textContent =
      p.kodeMembership + ' — ' + p.namaMenu + ' × ' + p.qty +
      ' (' + formatWaktu(p.timestamp) + '). Baris akan dihapus permanen.';
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

    var p = pendingDelete;
    try {
      var json = await MAO_ADMIN.adminFetch('adminDeletePesanan', {
        rowIndex: p.rowIndex,
        // Snapshot untuk revalidasi backend: baris HARUS masih persis ini
        // saat deleteRow dieksekusi, kalau tidak → tolak (anti salah-hapus).
        snapTimestamp: p.timestamp,
        snapKode: p.kodeMembership,
        snapNamaMenu: p.namaMenu,
        snapQty: String(p.qty)
      });

      if (json.success) {
        closeDeleteModal();
        await loadList(); // refresh: rowIndex baris di bawahnya bergeser
      } else {
        if (MAO_ADMIN.isUnauthorized(json)) { closeDeleteModal(); MAO_ADMIN.relock(); return; }
        // stale / error lain → tampilkan pesan, JANGAN hapus.
        deleteModalMsg.textContent = json.error || 'Gagal menghapus.';
        deleteModalMsg.hidden = false;
        if (json.errorType === 'stale') {
          // Baris sudah bergeser → refresh list di belakang modal, admin
          // mengulang dari data terbaru.
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

  retryBtn.addEventListener('click', loadList);

  // ─── INIT (lewat PIN gate) ───────────────────────────────────────────────

  MAO_ADMIN.onReady(loadList);
})();
