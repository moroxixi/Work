// ============================================================
// Rekap Harga Barang — browse & cari histori harga.
// Data diambil READ-ONLY dari action "list" di scan-struk.gs
// (backend Apps Script). SCRIPT_URL sama persis dengan halaman
// Scan-Struk: didefinisikan di config.js, di-load sebelum file ini.
// escapeHtml diambil dari shared-utils.js (di-load sebelum file ini,
// konvensi sama dengan halaman Riwayat/Stok).
// ============================================================

let allItems = [];       // data mentah dari backend, sudah diurut terbaru dulu
let tokoFilter = "__semua__";
let searchQuery = "";
let fetchSeq = 0;        // penjaga respon basi: hanya respon fetch paling baru yang dipakai

const listEl = document.getElementById("itemList");
const loadingMsg = document.getElementById("loadingMsg");
const emptyMsg = document.getElementById("emptyMsg");
const errorMsg = document.getElementById("errorMsg");
const searchInput = document.getElementById("searchInput");
const tokoSelect = document.getElementById("tokoSelect");
const summaryLabel = document.getElementById("summaryLabel");
const refreshBtn = document.getElementById("refreshBtn");

// ===== Util =====
function formatRp(n) {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

// Timestamp dari backend: "dd/MM/yyyy HH:mm:ss". Fallback ke format lain
// (mis. ISO kalau ada baris diedit manual di Sheets) biar urutan tetap benar.
function parseTimestamp(s) {
  if (!s) return new Date(0);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(s));
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function setLoading(isLoading) {
  loadingMsg.hidden = !isLoading;
  if (isLoading) {
    emptyMsg.hidden = true;
    errorMsg.hidden = true;
  }
}

// ===== Fetch data (action "list") =====
async function fetchItems() {
  const seq = ++fetchSeq;
  setLoading(true);

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // hindari CORS preflight
      body: JSON.stringify({ action: "list" })
    });
    const data = await res.json();
    if (seq !== fetchSeq) return; // respon basi (sudah ada fetch yang lebih baru), abaikan
    if (!data.ok) throw new Error(data.error || "Gagal memuat data.");

    // Buang baris kosong (sheet bisa menyisakan blank row)
    allItems = (data.items || []).filter(it => String(it.nama || "").trim() !== "");

    // Default urutan: terbaru dulu (by timestamp)
    allItems.sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));

    populateTokoSelect();
    applyFilters();
  } catch (err) {
    if (seq !== fetchSeq) return; // respon basi — jangan tampilkan error yang sudah usang
    errorMsg.textContent = "Gagal memuat data: " + err.message;
    errorMsg.hidden = false;
    listEl.innerHTML = "";
    summaryLabel.textContent = "";
  } finally {
    if (seq === fetchSeq) setLoading(false); // jangan matikan loading buat fetch yang basi
  }
}

// ===== Dropdown Toko (isi otomatis dari data unik) =====
function populateTokoSelect() {
  const tokoSet = new Set();
  allItems.forEach(it => {
    const t = String(it.toko || "").trim();
    if (t) tokoSet.add(t);
  });
  const tokoList = Array.from(tokoSet).sort((a, b) => a.localeCompare(b, "id"));

  const prev = tokoFilter;
  tokoSelect.innerHTML = "";

  const optSemua = document.createElement("option");
  optSemua.value = "__semua__";
  optSemua.textContent = "Semua Toko (" + allItems.length + ")";
  tokoSelect.appendChild(optSemua);

  tokoList.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tokoSelect.appendChild(opt);
  });

  // Pertahankan pilihan user selama tokonya masih ada di data
  tokoFilter = tokoList.includes(prev) ? prev : "__semua__";
  tokoSelect.value = tokoFilter;
}

// ===== Filter client-side (toko + substring nama) =====
function applyFilters() {
  const q = searchQuery.toLowerCase();
  const filtered = allItems.filter(it => {
    if (tokoFilter !== "__semua__" && String(it.toko || "") !== tokoFilter) return false;
    if (q && String(it.nama || "").toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  renderList(filtered);
}

// ===== Render card =====
function renderList(rows) {
  listEl.innerHTML = "";

  if (allItems.length === 0) {
    emptyMsg.textContent = "Belum ada data. Coba scan & simpan struk dulu.";
    emptyMsg.hidden = false;
    summaryLabel.textContent = "";
    return;
  }
  emptyMsg.hidden = true;

  summaryLabel.textContent = rows.length + " catatan" +
    (tokoFilter !== "__semua__" ? " · " + tokoFilter : "") +
    (searchQuery ? " · cari \"" + searchQuery + "\"" : "");

  if (rows.length === 0) {
    emptyMsg.textContent = "Tidak ada barang yang cocok dengan filter.";
    emptyMsg.hidden = false;
    return;
  }

  const total = rows.reduce((sum, it) => sum + (Number(it.harga_total) || 0), 0);
  const totalEl = document.createElement("p");
  totalEl.className = "total-line";
  totalEl.textContent = "Total nilai tampil: " + formatRp(total);
  listEl.appendChild(totalEl);

  rows.forEach(it => {
    const qty = Number(it.qty) || 0;
    const satuan = String(it.satuan || "").trim();
    const hargaSatuan = Number(it.harga_satuan) || 0;
    const hargaTotal = Number(it.harga_total) || 0;

    const card = document.createElement("article");
    card.className = "harga-card";

    card.innerHTML =
      '<header class="hc-top">' +
        '<h2 class="hc-nama">' + escapeHtml(it.nama) + '</h2>' +
        '<span class="hc-total">' + formatRp(hargaTotal) + '</span>' +
      '</header>' +
      '<div class="hc-meta">' +
        '<span class="hc-toko">' + escapeHtml(it.toko) + '</span>' +
        '<span class="hc-qty">' + qty + (satuan ? " " + escapeHtml(satuan) : "") + '</span>' +
        '<span class="hc-satuan">' + formatRp(hargaSatuan) + (satuan ? "/" + escapeHtml(satuan) : "/unit") + '</span>' +
      '</div>' +
      '<footer class="hc-time">' + escapeHtml(it.timestamp) + '</footer>';

    listEl.appendChild(card);
  });
}

// ===== Events =====
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  applyFilters(); // murni client-side, tidak panggil backend tiap ketik
});

tokoSelect.addEventListener("change", (e) => {
  tokoFilter = e.target.value;
  applyFilters();
});

refreshBtn.addEventListener("click", fetchItems);

// ===== Init =====
fetchItems();
