// Report Harian — Rekap Pengeluaran (read-only).
// Baca sheet "Rekap Pengeluaran Harian" via action=rekapHarian (buku-kas.gs.js),
// render tiap kolom toko/kategori sebagai baris checklist.
// Pola fetch mengikuti Riwayat/Stok: Map cache + AbortController + CACHE_MAX_AGE.

const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 menit — cache dianggap stale
const fetchCache = new Map();         // key = "yyyy-MM-dd", value = payload
const cacheTimestamps = new Map();    // key = cacheKey, value = Date.now()
let activeFetchController = null;     // AbortController untuk cancel request lama

let currentDate = new Date();

const tanggalLabel = document.getElementById("tanggalLabel");
const datePicker = document.getElementById("datePicker");
const btnKemarin = document.getElementById("btnKemarin");
const btnHariIni = document.getElementById("btnHariIni");
const btnRefresh = document.getElementById("btnRefresh");
const refreshIcon = document.getElementById("refreshIcon");
const summaryBar = document.getElementById("summaryBar");
const summaryText = document.getElementById("summaryText");
const loadingMsg = document.getElementById("loadingMsg");
const emptyMsg = document.getElementById("emptyMsg");
const errorMsg = document.getElementById("errorMsg");
const itemList = document.getElementById("itemList");

// formatTanggalApi, formatTanggalLabel, toDateInputValue, escapeHtml
// sekarang ada di shared-utils.js (dimuat sebelum file ini).

function isCacheValid(key) {
  if (!fetchCache.has(key)) return false;
  const age = Date.now() - (cacheTimestamps.get(key) || 0);
  return age < CACHE_MAX_AGE;
}

function invalidateCache(key) {
  fetchCache.delete(key);
  cacheTimestamps.delete(key);
}

function formatRupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

// Tampilkan nilai sel: angka (atau string numerik berformat Rp) jadi Rupiah,
// teks non-numerik (mis. status/catatan) tampil apa adanya.
function formatNilai(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (s === "") return "";
  const n = Number(value);
  if (isFinite(n)) return formatRupiah(n);
  const cleaned = s.replace(/[Rp\s.]/gi, "").replace(",", ".");
  const n2 = Number(cleaned);
  if (isFinite(n2)) return formatRupiah(n2);
  return s;
}

function setLoading(isLoading) {
  loadingMsg.hidden = !isLoading;
  if (isLoading) {
    emptyMsg.hidden = true;
    errorMsg.hidden = true;
    summaryBar.hidden = true;
  }
}

function renderRekap(data) {
  if (!data.found || !Array.isArray(data.rows) || data.rows.length === 0) {
    emptyMsg.hidden = false;
    summaryBar.hidden = true;
    itemList.innerHTML = "";
    return;
  }

  // Urut: yang sudah terisi (filled=true) di atas, lalu A-Z per grup label.
  const rows = data.rows.slice().sort((a, b) => {
    if (a.filled !== b.filled) return a.filled ? -1 : 1;
    return String(a.label || "").localeCompare(String(b.label || ""), "id");
  });

  const filledCount = rows.filter(r => r.filled).length;
  summaryText.textContent = filledCount + " dari " + rows.length + " kolom terisi";
  summaryBar.hidden = false;

  itemList.innerHTML = "";
  rows.forEach(row => {
    const el = document.createElement("div");
    el.className = "check-row" + (row.filled ? " is-checked" : "");
    el.innerHTML =
      '<span class="check-box" aria-hidden="true">' + (row.filled ? "&#10003;" : "") + "</span>" +
      '<span class="check-label">' + escapeHtml(String(row.label || "")) + "</span>" +
      '<span class="check-value">' + escapeHtml(formatNilai(row.value)) + "</span>";
    itemList.appendChild(el);
  });
}

async function fetchRekap({ silent = false, force = false } = {}) {
  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  const key = toDateInputValue(currentDate); // "yyyy-MM-dd" (zona Asia/Jakarta)

  // Cache hit (kecuali force-refresh)
  if (!force && isCacheValid(key)) {
    renderRekap(fetchCache.get(key));
    if (!silent) setLoading(false);
    return;
  }

  // Cancel request sebelumnya kalau ada
  if (activeFetchController) {
    activeFetchController.abort();
  }
  activeFetchController = new AbortController();
  const signal = activeFetchController.signal;

  try {
    const url = ENDPOINT_URL + "?action=rekapHarian&tanggal=" + encodeURIComponent(key);
    const res = await fetch(url, { signal });
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat data.");

    // Simpan ke cache
    fetchCache.set(key, data);
    cacheTimestamps.set(key, Date.now());

    renderRekap(data);
  } catch (err) {
    if (err.name === "AbortError") return; // request dibatalkan karena ada fetch baru — silent
    errorMsg.textContent = "Gagal memuat data: " + err.message;
    errorMsg.hidden = false;
  } finally {
    if (!silent) setLoading(false);
  }
}

function goToDate(date) {
  currentDate = date;
  tanggalLabel.textContent = formatTanggalLabel(currentDate);
  datePicker.value = toDateInputValue(currentDate);
  fetchRekap();
}

btnHariIni.addEventListener("click", () => goToDate(new Date()));

btnKemarin.addEventListener("click", () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() - 1);
  goToDate(d);
});

datePicker.addEventListener("change", () => {
  if (!datePicker.value) return;
  const [y, m, d] = datePicker.value.split("-").map(Number);
  goToDate(new Date(y, m - 1, d));
});

btnRefresh.addEventListener("click", async () => {
  refreshIcon.classList.add("spin");
  invalidateCache(toDateInputValue(currentDate)); // paksa fresh
  await fetchRekap({ force: true });
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// Init: default hari ini
goToDate(new Date());