// ============================================================
// GANTI dengan URL Web App dari deployment Code.gs scan struk
// (SCRIPT_URL didefinisikan di config.js, di-load sebelum file ini)
// ============================================================

let selectedToko = null;
let compressedBase64 = null;
let compressedMime = "image/jpeg";
let items = []; // {nama, qty, satuan, harga_satuan, removed}
let manualItems = []; // {id, nama, qty, satuan, harga_satuan}
let currentTab = "scan";
let _origTitle = "";
let _origSub = "";

// --- Toko chip selection ---
document.getElementById("tokoChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#tokoChips .chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  const lainInput = document.getElementById("tokoLainInput");
  if (chip.dataset.toko === "__lain__") {
    lainInput.style.display = "block";
    lainInput.focus();
    selectedToko = lainInput.value.trim();
  } else {
    lainInput.style.display = "none";
    selectedToko = chip.dataset.toko;
  }
  updateScanBtnState();
});
document.getElementById("tokoLainInput").addEventListener("input", (e) => {
  selectedToko = e.target.value.trim();
  updateScanBtnState();
});

// --- Photo select + compress ---
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById("scanStatus");
  status.textContent = "";
  status.className = "status";
  try {
    const { base64, mime } = await compressImage(file, 1_200_000);
    compressedBase64 = base64;
    compressedMime = mime;
    document.getElementById("photoPreviewWrap").innerHTML =
      `<img src="data:${mime};base64,${base64}" alt="preview struk" />`;
  } catch (err) {
    compressedBase64 = null;
    status.textContent = "Gagal proses foto (coba format JPEG/PNG, atau ambil langsung dari kamera).";
    status.className = "status err";
  }
  updateScanBtnState();
});

function updateScanBtnState() {
  document.getElementById("scanBtn").disabled = !(selectedToko && compressedBase64);
}

function compressImage(file, maxPixels) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      const pixels = width * height;
      if (pixels > maxPixels) {
        const scale = Math.sqrt(maxPixels / pixels);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ base64: dataUrl.split(",")[1], mime: "image/jpeg" });
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Scan struk ---
document.getElementById("scanBtn").addEventListener("click", async () => {
  const btn = document.getElementById("scanBtn");
  const status = document.getElementById("scanStatus");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Membaca struk…';
  status.textContent = "";
  status.className = "status";

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // hindari CORS preflight
      body: JSON.stringify({
        action: "scan",
        imageBase64: compressedBase64,
        mimeType: compressedMime
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal scan.");

    items = data.items.map(it => ({
      nama: it.nama || "",
      qty: it.qty || 0,
      satuan: it.satuan || "",
      harga_satuan: it.harga_satuan || 0,
      removed: false
    }));
    renderItems();
    document.getElementById("receiptCard").classList.remove("hidden");
    document.getElementById("saveZone").classList.remove("hidden");
    status.textContent = `${items.length} barang terbaca. Cek & edit di bawah sebelum simpan.`;
    status.className = "status ok";
  } catch (err) {
    status.textContent = "Gagal: " + err.message;
    status.className = "status err";
  } finally {
    btn.disabled = false;
    btn.textContent = "Scan Struk";
  }
});

// --- Render editable receipt list ---
function renderItems() {
  const list = document.getElementById("itemList");
  list.innerHTML = "";
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "item-row" + (item.removed ? " removed" : "");
    row.dataset.i = i;
    row.innerHTML = `
      <div class="item-top">
        <input class="item-name" data-i="${i}" data-f="nama" value="${escapeAttr(item.nama)}" />
        <button class="item-remove" data-i="${i}">${item.removed ? "batal" : "hapus"}</button>
      </div>
      <div class="item-fields">
        <div class="f"><label>Qty</label><input type="number" step="any" data-i="${i}" data-f="qty" value="${item.qty}" /></div>
        <div class="f"><label>Satuan</label><input data-i="${i}" data-f="satuan" value="${escapeAttr(item.satuan)}" /></div>
        <div class="f"><label>Harga satuan</label><input type="number" step="any" data-i="${i}" data-f="harga_satuan" value="${item.harga_satuan}" /></div>
      </div>
      <div class="item-total">${formatRp((item.qty||0) * (item.harga_satuan||0))}</div>
    `;
    list.appendChild(row);
  });
  updateTotals(); // hitung count & grand total tanpa rebuild input

  // Listener input: update data + angka total SAJA, TIDAK rebuild DOM
  list.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      items[i][f] = (f === "qty" || f === "harga_satuan") ? Number(e.target.value) : e.target.value;

      // update total per-baris tanpa re-render seluruh list
      const row = e.target.closest(".item-row");
      const totalEl = row.querySelector(".item-total");
      totalEl.textContent = formatRp((items[i].qty||0) * (items[i].harga_satuan||0));

      updateTotals(); // update grand total & count saja
    });
  });

  // Listener hapus/batal: ini BOLEH rebuild karena struktur baris berubah (class removed)
  list.querySelectorAll(".item-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.i);
      items[i].removed = !items[i].removed;
      renderItems(); // aman di-rebuild, tidak sedang fokus mengetik
    });
  });
}

function updateTotals() {
  let total = 0;
  items.forEach(item => {
    if (!item.removed) total += (Number(item.qty) || 0) * (Number(item.harga_satuan) || 0);
  });
  document.getElementById("itemCount").textContent = items.filter(it => !it.removed).length;
  document.getElementById("grandTotal").textContent = formatRp(total);
}

document.getElementById("addRowBtn").addEventListener("click", () => {
  items.push({ nama: "", qty: 1, satuan: "", harga_satuan: 0, removed: false });
  document.getElementById("receiptCard").classList.remove("hidden");
  renderItems();
});

// --- Save (scan tab) ---
async function saveScanItems() {
  const btn = document.getElementById("saveBtn");
  const status = document.getElementById("saveStatus");
  const toSave = items.filter(it => !it.removed && it.nama.trim() !== "");

  if (toSave.length === 0) {
    status.textContent = "Tidak ada baris untuk disimpan.";
    status.className = "status err";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
  status.textContent = "";

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", toko: selectedToko, items: toSave })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal simpan.");

    status.textContent = `Tersimpan \u2713 (${data.saved} baris ditambahkan ke Riwayat Harga).`;
    status.className = "status ok";
  } catch (err) {
    status.textContent = "Gagal: " + err.message;
    status.className = "status err";
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Riwayat Harga";
  }
}

function formatRp(n) {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}
function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

// ============================================================
// Tab switching (Scan Struk | Input Manual | Rekap Harga)
// ============================================================
(function initTab() {
  // nav.js no longer generates subnav for data-page="scan" (scoped skip in nav.js).
  // The #tabSwitcher in HTML provides 3 tabs (Scan Struk | Input Manual | Rekap Harga).
  var titleEl = document.querySelector("header h1");
  var subEl = document.querySelector("header .sub");
  _origTitle = titleEl ? titleEl.textContent : "";
  _origSub = subEl ? subEl.textContent : "";
  var hash = location.hash.replace("#", "");
  if (hash === "manual") {
    switchTab("manual");
  } else {
    switchTab("scan");
  }
  window.addEventListener("hashchange", function () {
    var h = location.hash.replace("#", "");
    if (h === "manual") switchTab("manual");
    else switchTab("scan");
  });
})();

document.getElementById("tabSwitcher").addEventListener("click", function (e) {
  var btn = e.target.closest(".tab-btn");
  if (!btn || btn.classList.contains("is-active")) return;
  var tab = btn.dataset.tab;
  if (tab) {
    location.hash = tab === "scan" ? "" : tab;
  }
});

function switchTab(tab) {
  currentTab = tab;
  var scanContent = document.getElementById("scanContent");
  var manualContent = document.getElementById("manualContent");
  var receiptCard = document.getElementById("receiptCard");
  var saveZone = document.getElementById("saveZone");
  var addRowBtn = document.getElementById("addRowBtn");
  var titleEl = document.querySelector("header h1");
  var subEl = document.querySelector("header .sub");

  document.querySelectorAll("#tabSwitcher .tab-btn").forEach(function (b) {
    var isActive = (b.dataset.tab === tab) || (!b.dataset.tab && tab === "rekap");
    b.classList.toggle("is-active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (tab === "scan") {
    scanContent.classList.remove("hidden");
    manualContent.classList.add("hidden");
    document.getElementById("savedSection").classList.add("hidden");
    if (items.length > 0) {
      receiptCard.classList.remove("hidden");
      saveZone.classList.remove("hidden");
      addRowBtn.classList.remove("hidden");
    }
    titleEl.textContent = _origTitle;
    subEl.textContent = _origSub;
  } else if (tab === "manual") {
    scanContent.classList.add("hidden");
    manualContent.classList.remove("hidden");
    receiptCard.classList.add("hidden");
    if (manualItems.length > 0) {
      saveZone.classList.remove("hidden");
      addRowBtn.classList.add("hidden");
    } else {
      saveZone.classList.add("hidden");
      addRowBtn.classList.add("hidden");
    }
    // Show saved section & fetch data
    document.getElementById("savedSection").classList.remove("hidden");
    fetchSavedItems();
    titleEl.textContent = "Input Manual Harga";
    subEl.textContent = "Isi data belanja secara manual tanpa foto struk — data masuk ke Riwayat Harga yang sama.";
  }
}

// ============================================================
// Manual input items
// ============================================================
var _manualId = 0;

function renderManualItems() {
  var list = document.getElementById("manualItems");
  list.innerHTML = "";
  manualItems.forEach(function (item, i) {
    var row = document.createElement("div");
    row.className = "manual-item";
    row.dataset.idx = i;
    row.innerHTML =
      '<div class="manual-item-top">' +
        '<input class="manual-item-name" data-i="' + i + '" data-f="nama" value="' + escapeAttr(item.nama) + '" placeholder="Nama barang" />' +
        '<button class="manual-item-remove" data-i="' + i + '">hapus</button>' +
      '</div>' +
      '<div class="manual-item-fields">' +
        '<div class="f"><label>Qty</label><input type="number" step="any" data-i="' + i + '" data-f="qty" value="' + item.qty + '" /></div>' +
        '<div class="f"><label>Satuan</label><input data-i="' + i + '" data-f="satuan" value="' + escapeAttr(item.satuan) + '" placeholder="pcs/kg" /></div>' +
        '<div class="f"><label>Harga satuan</label><input type="number" step="any" data-i="' + i + '" data-f="harga_satuan" value="' + item.harga_satuan + '" /></div>' +
      '</div>' +
      '<div class="manual-item-total">' + formatRp((item.qty || 0) * (item.harga_satuan || 0)) + '</div>';
    list.appendChild(row);
  });

  // Update totals
  var total = 0;
  var count = manualItems.length;
  manualItems.forEach(function (it) {
    total += (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0);
  });
  document.getElementById("manualItemCount").textContent = count;
  document.getElementById("manualGrandTotal").textContent = formatRp(total);

  // Input listeners
  list.querySelectorAll("input").forEach(function (inp) {
    inp.addEventListener("input", function (e) {
      var idx = Number(e.target.dataset.i);
      var f = e.target.dataset.f;
      manualItems[idx][f] = (f === "qty" || f === "harga_satuan") ? Number(e.target.value) : e.target.value;
      var row = e.target.closest(".manual-item");
      var totalEl = row.querySelector(".manual-item-total");
      totalEl.textContent = formatRp((manualItems[idx].qty || 0) * (manualItems[idx].harga_satuan || 0));
      var grandTotal = 0;
      manualItems.forEach(function (it) {
        grandTotal += (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0);
      });
      document.getElementById("manualGrandTotal").textContent = formatRp(grandTotal);
    });
  });

  // Remove listeners
  list.querySelectorAll(".manual-item-remove").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var idx = Number(e.target.dataset.i);
      manualItems.splice(idx, 1);
      renderManualItems();
      if (manualItems.length === 0) {
        document.getElementById("saveZone").classList.add("hidden");
      }
    });
  });
}

document.getElementById("manualAddBtn").addEventListener("click", function () {
  manualItems.push({ id: ++_manualId, nama: "", qty: 1, satuan: "", harga_satuan: 0 });
  renderManualItems();
  document.getElementById("saveZone").classList.remove("hidden");
  // Focus the new name field
  var lastRow = document.querySelector("#manualItems .manual-item:last-child .manual-item-name");
  if (lastRow) lastRow.focus();
});

// ============================================================
// Data Harga Tersimpan (saved items list + edit/delete)
// ============================================================

let savedItems = []; // all items from backend (with row numbers)
let savedTokoFilter = "__semua__";
let savedSearchQuery = "";
let savedTokoColors = {}; // "nama toko" -> { bg, fg }
let pendingEditItem = null;
let pendingDeleteItem = null;
let savedModalOpen = false;

async function fetchSavedItems() {
  var statusEl = document.getElementById("savedStatus");
  var listEl = document.getElementById("savedList");
  var emptyEl = document.getElementById("savedEmpty");

  statusEl.textContent = "Memuat...";
  statusEl.className = "status";
  statusEl.hidden = false;
  emptyEl.hidden = true;
  listEl.innerHTML = "";

  try {
    var res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "list" })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal memuat data.");

    savedItems = (data.items || []).filter(function (it) {
      return String(it.nama || "").trim() !== "";
    });
    // Urutkan: terbaru dulu (berdasarkan timestamp)
    savedItems.sort(function (a, b) {
      return parseSavedTimestamp(b.timestamp) - parseSavedTimestamp(a.timestamp);
    });

    statusEl.hidden = true;
    buildSavedTokoColors();
    populateSavedTokoSelect();
    renderSavedItems();
  } catch (err) {
    statusEl.textContent = "Gagal: " + err.message;
    statusEl.className = "status err";
    statusEl.hidden = false;
  }
}

function parseSavedTimestamp(s) {
  if (!s) return new Date(0);
  var m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(s));
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
  var d = new Date(String(s));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// ===== Toko color assignment (re-implemented from Rekap pattern) =====
function buildSavedTokoColors() {
  var tokoSet = new Set();
  savedItems.forEach(function (it) {
    var t = String(it.toko || "").trim();
    if (t) tokoSet.add(t);
  });
  var tokoList = Array.from(tokoSet).sort(function (a, b) { return a.localeCompare(b, "id"); });

  savedTokoColors = {};
  var n = tokoList.length;
  tokoList.forEach(function (name, i) {
    var hue = Math.round((360 / n) * i) % 360;
    var bg = "hsl(" + hue + ", 65%, 42%)";
    savedTokoColors[name] = { bg: bg, fg: textColorForSavedBg(bg) };
  });
}

function textColorForSavedBg(bg) {
  var m = /hsl\([^)]*,\s*[^)]*,\s*([\d.]+)%\)/.exec(bg);
  var lightness = m ? Number(m[1]) : 42;
  return lightness > 55 ? "#2B2420" : "#FFFFFF";
}

function populateSavedTokoSelect() {
  var tokoSet = new Set();
  savedItems.forEach(function (it) {
    var t = String(it.toko || "").trim();
    if (t) tokoSet.add(t);
  });
  var tokoList = Array.from(tokoSet).sort(function (a, b) { return a.localeCompare(b, "id"); });

  var prev = savedTokoFilter;
  var sel = document.getElementById("savedTokoSelect");
  sel.innerHTML = "";

  var optSemua = document.createElement("option");
  optSemua.value = "__semua__";
  optSemua.textContent = "Semua Toko (" + tokoList.length + ")";
  sel.appendChild(optSemua);

  tokoList.forEach(function (t) {
    var opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });

  savedTokoFilter = tokoList.indexOf(prev) !== -1 ? prev : "__semua__";
  sel.value = savedTokoFilter;
}

function applySavedFilters() {
  var q = savedSearchQuery.toLowerCase();
  return savedItems.filter(function (it) {
    if (savedTokoFilter !== "__semua__" && String(it.toko || "") !== savedTokoFilter) return false;
    if (q && String(it.nama || "").toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function renderSavedItems() {
  var listEl = document.getElementById("savedList");
  var emptyEl = document.getElementById("savedEmpty");
  var summaryEl = document.getElementById("savedSummary");
  listEl.innerHTML = "";

  var filtered = applySavedFilters();

  if (savedItems.length === 0) {
    emptyEl.textContent = "Belum ada data tersimpan.";
    emptyEl.hidden = false;
    summaryEl.textContent = "";
    return;
  }
  emptyEl.hidden = true;

  summaryEl.textContent = filtered.length + " catatan" +
    (savedTokoFilter !== "__semua__" ? " \u00b7 " + savedTokoFilter : "") +
    (savedSearchQuery ? " \u00b7 cari \"" + savedSearchQuery + "\"" : "");

  if (filtered.length === 0) {
    emptyEl.textContent = "Tidak ada barang yang cocok dengan filter.";
    emptyEl.hidden = false;
    return;
  }

  filtered.forEach(function (item) {
    var satuan = String(item.satuan || "").trim();
    var hargaSatuan = Number(item.harga_satuan) || 0;
    var hargaTotal = Number(item.harga_total) || 0;

    var t = String(item.toko || "").trim();
    var pillStyle = (t && savedTokoColors[t])
      ? "background:" + savedTokoColors[t].bg + ";color:" + savedTokoColors[t].fg
      : "background:var(--keluar-soft);color:var(--terracotta-dark)";

    var card = document.createElement("div");
    card.className = "saved-card";
    card.innerHTML =
      '<div class="saved-card-top">' +
        '<span class="saved-card-nama">' + escapeHtml(item.nama) + '</span>' +
      '</div>' +
      '<span class="saved-card-toko" style="' + pillStyle + '">' + escapeHtml(item.toko) + '</span>' +
      '<div class="saved-card-fields">' +
        '<span>' + (item.qty || 0) + ' ' + escapeHtml(satuan || 'unit') + '</span>' +
        '<span>' + formatRp(hargaSatuan) + '/' + escapeHtml(satuan || 'unit') + '</span>' +
      '</div>' +
      '<div class="saved-card-bottom">' +
        '<span class="saved-card-price">' + formatRp(hargaTotal) + '</span>' +
        '<div class="saved-card-actions">' +
          '<button class="btn-edit-saved" data-row="' + item.row + '">Edit</button>' +
          '<button class="btn-hapus-saved" data-row="' + item.row + '">Hapus</button>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">' + escapeHtml(item.timestamp) + '</div>';

    card.querySelector(".btn-edit-saved").addEventListener("click", function () {
      openEditSavedModal(item);
    });
    card.querySelector(".btn-hapus-saved").addEventListener("click", function () {
      openDeleteSavedModal(item);
    });

    listEl.appendChild(card);
  });
}

// --- Edit modal for saved items ---
function openEditSavedModal(item) {
  pendingEditItem = item;
  savedModalOpen = true;

  document.getElementById("editToko").value = item.toko || "";
  document.getElementById("editNama").value = item.nama || "";
  document.getElementById("editQty").value = item.qty || 0;
  document.getElementById("editSatuan").value = item.satuan || "";
  document.getElementById("editHarga").value = item.harga_satuan || 0;
  updateEditTotalPreview();

  document.getElementById("editStatus").textContent = "";
  document.getElementById("editStatus").className = "status";
  document.getElementById("editModal").hidden = false;
}

function closeEditSavedModal() {
  document.getElementById("editModal").hidden = true;
  savedModalOpen = false;
  pendingEditItem = null;
}

function updateEditTotalPreview() {
  var qty = Number(document.getElementById("editQty").value) || 0;
  var harga = Number(document.getElementById("editHarga").value) || 0;
  document.getElementById("editTotalPreview").textContent = formatRp(qty * harga);
}

document.getElementById("editQty").addEventListener("input", updateEditTotalPreview);
document.getElementById("editHarga").addEventListener("input", updateEditTotalPreview);
document.getElementById("btnBatalEdit").addEventListener("click", closeEditSavedModal);

document.getElementById("btnSimpanEdit").addEventListener("click", async function () {
  if (!pendingEditItem) return;

  var btn = document.getElementById("btnSimpanEdit");
  var statusEl = document.getElementById("editStatus");
  var nama = document.getElementById("editNama").value.trim();
  var qty = Number(document.getElementById("editQty").value) || 0;
  var harga = Number(document.getElementById("editHarga").value) || 0;

  if (!nama) {
    statusEl.textContent = "Nama barang wajib diisi.";
    statusEl.className = "status err";
    return;
  }
  if (qty <= 0 || harga <= 0) {
    statusEl.textContent = "Qty dan harga satuan harus lebih dari 0.";
    statusEl.className = "status err";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "Menyimpan...";
  statusEl.className = "status";

  try {
    var res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "edit",
        row: pendingEditItem.row,
        toko: document.getElementById("editToko").value.trim(),
        nama: nama,
        qty: qty,
        satuan: document.getElementById("editSatuan").value.trim(),
        harga_satuan: harga
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal menyimpan.");

    closeEditSavedModal();
    await fetchSavedItems();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "status err";
  } finally {
    btn.disabled = false;
  }
});

// --- Delete modal for saved items ---
function openDeleteSavedModal(item) {
  pendingDeleteItem = item;
  savedModalOpen = true;

  var detail = (item.toko ? item.toko + " · " : "") + item.nama + " — " + formatRp(item.harga_total);
  document.getElementById("deleteDetail").textContent = detail;
  document.getElementById("deleteStatus").textContent = "";
  document.getElementById("deleteStatus").className = "status";
  document.getElementById("deleteModal").hidden = false;
}

function closeDeleteSavedModal() {
  document.getElementById("deleteModal").hidden = true;
  savedModalOpen = false;
  pendingDeleteItem = null;
}

document.getElementById("btnBatalHapus").addEventListener("click", closeDeleteSavedModal);

document.getElementById("btnKonfirmHapus").addEventListener("click", async function () {
  if (!pendingDeleteItem) return;

  var btn = document.getElementById("btnKonfirmHapus");
  var statusEl = document.getElementById("deleteStatus");

  btn.disabled = true;
  statusEl.textContent = "Menghapus...";
  statusEl.className = "status";

  try {
    var res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "delete",
        row: pendingDeleteItem.row
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal menghapus.");

    closeDeleteSavedModal();
    await fetchSavedItems();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "status err";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("refreshSavedBtn").addEventListener("click", fetchSavedItems);

document.getElementById("savedSearchInput").addEventListener("input", function (e) {
  savedSearchQuery = e.target.value.trim();
  renderSavedItems();
});

document.getElementById("savedTokoSelect").addEventListener("change", function (e) {
  savedTokoFilter = e.target.value;
  renderSavedItems();
});

// --- Manual save (reuses exact same endpoint & payload as scan save) ---
document.getElementById("saveBtn").addEventListener("click", async function () {
  if (currentTab === "manual") {
    await saveManualItems();
  } else {
    await saveScanItems();
  }
});

async function saveManualItems() {
  var btn = document.getElementById("saveBtn");
  var status = document.getElementById("saveStatus");
  var toSave = manualItems.filter(function (it) { return it.nama.trim() !== ""; });

  if (!selectedToko) {
    status.textContent = "Pilih toko dulu.";
    status.className = "status err";
    return;
  }
  if (toSave.length === 0) {
    status.textContent = "Tidak ada baris untuk disimpan.";
    status.className = "status err";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
  status.textContent = "";

  try {
    var res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", toko: selectedToko, items: toSave })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal simpan.");
    status.textContent = "Tersimpan \u2713 (" + data.saved + " baris ditambahkan ke Riwayat Harga).";
    status.className = "status ok";
    // Refresh saved list kalau visible
    if (!document.getElementById("savedSection").classList.contains("hidden")) {
      fetchSavedItems();
    }
  } catch (err) {
    status.textContent = "Gagal: " + err.message;
    status.className = "status err";
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Riwayat Harga";
  }
}
