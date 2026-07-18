// ============================================================
// GANTI dengan URL Web App dari deployment Code.gs scan struk
// (SCRIPT_URL didefinisikan di config.js, di-load sebelum file ini)
// ============================================================

let selectedToko = null;
let compressedBase64 = null;
let compressedMime = "image/jpeg";
let items = []; // {nama, qty, satuan, harga_satuan, removed}

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

// --- Save ---
document.getElementById("saveBtn").addEventListener("click", async () => {
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

    status.textContent = `Tersimpan ✓ (${data.saved} baris ditambahkan ke Riwayat Harga).`;
    status.className = "status ok";
  } catch (err) {
    status.textContent = "Gagal: " + err.message;
    status.className = "status err";
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Riwayat Harga";
  }
});

function formatRp(n) {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}
function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}
