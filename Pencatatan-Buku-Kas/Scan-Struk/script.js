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
  // nav.js generates a 2-tab subnav (Scan Struk | Rekap Harga) for data-page="scan".
  // The #tabSwitcher in HTML replaces it with a 3-tab version (Scan Struk | Input Manual | Rekap Harga).
  // Remove the duplicate subnav to avoid two rows of tabs.
  var oldSubnav = document.querySelector('.subnav');
  if (oldSubnav) oldSubnav.remove();

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
  } catch (err) {
    status.textContent = "Gagal: " + err.message;
    status.className = "status err";
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Riwayat Harga";
  }
}
