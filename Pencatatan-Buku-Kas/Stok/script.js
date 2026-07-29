// Dipakai bareng cabang: P = Tempura, B = Babakan, L = Leweung Gajah, R = Depan RS
const NAMA_CABANG = { P: "Tempura", B: "Babakan", L: "Leweung Gajah", R: "Depan RS" };

let currentDate = new Date();
let currentCabang = "P";

// === Fase 3: optimasi fetch ===
let activeStokController = null;          // AbortController untuk cancel request lama
const stokCache = new Map();              // key = tanggalStr::cabang, value = data payload
const CACHE_MAX_AGE = 30 * 60 * 1000;     // 30 menit — cache dianggap stale
const stokCacheTimestamps = new Map();    // key = cacheKey, value = Date.now()

function getStokCacheKey() {
  return formatTanggalApi(currentDate) + "::" + currentCabang;
}

function isStokCacheValid(cacheKey) {
  if (!stokCache.has(cacheKey)) return false;
  const age = Date.now() - (stokCacheTimestamps.get(cacheKey) || 0);
  return age < CACHE_MAX_AGE;
}

function invalidateStokCache(cacheKey) {
  stokCache.delete(cacheKey);
  stokCacheTimestamps.delete(cacheKey);
}

const tanggalLabel = document.getElementById("tanggalLabel");
const datePicker = document.getElementById("datePicker");
const btnKemarin = document.getElementById("btnKemarin");
const btnHariIni = document.getElementById("btnHariIni");
const btnRefresh = document.getElementById("btnRefresh");
const refreshIcon = document.getElementById("refreshIcon");
const tabBar = document.getElementById("tabBar");

const loadingMsg = document.getElementById("loadingMsg");
const emptyMsg = document.getElementById("emptyMsg");
const errorMsg = document.getElementById("errorMsg");
const itemList = document.getElementById("itemList");
const reportInfo = document.getElementById("reportInfo");

// formatTanggalApi, formatTanggalLabel, toDateInputValue, escapeHtml
// sekarang ada di shared-utils.js (dimuat sebelum file ini).

function setLoading(isLoading) {
  loadingMsg.hidden = !isLoading;
  if (isLoading) {
    emptyMsg.hidden = true;
    errorMsg.hidden = true;
    reportInfo.hidden = true;
  }
}

function renderItems(payload) {
  itemList.innerHTML = "";

  if (!payload.found) {
    emptyMsg.hidden = false;
    reportInfo.hidden = true;
    return;
  }
  emptyMsg.hidden = true;

  reportInfo.hidden = false;
  reportInfo.textContent = "Laporan terakhir: " + payload.timestamp + " \u00b7 " + payload.cabang;

  payload.items.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML =
      "<span class=\"item-nama\">" + escapeHtml(item.nama) + "</span>" +
      "<span class=\"item-laku\">Laku: " + item.laku + "</span>" +
      "<span class=\"item-sisa\">Sisa: " + item.sisa + "</span>";
    itemList.appendChild(row);
  });
}

async function fetchStok({ silent = false, force = false } = {}) {
  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  const cacheKey = getStokCacheKey();

  // Cache hit (kecuali force-refresh)
  if (!force && isStokCacheValid(cacheKey)) {
    renderItems(stokCache.get(cacheKey));
    if (!silent) setLoading(false);
    return;
  }

  // Cancel request sebelumnya kalau ada
  if (activeStokController) {
    activeStokController.abort();
  }
  activeStokController = new AbortController();
  const signal = activeStokController.signal;

  try {
    const tanggalStr = formatTanggalApi(currentDate);
    const url = STOK_SCRIPT_URL + "?action=stok&tanggal=" + encodeURIComponent(tanggalStr) + "&cabang=" + currentCabang;
    const res = await fetch(url, { signal });
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat data.");

    // Simpan ke cache
    stokCache.set(cacheKey, data);
    stokCacheTimestamps.set(cacheKey, Date.now());

    renderItems(data);
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
  fetchStok();
}

function switchCabang(kode) {
  currentCabang = kode;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cabang === kode);
  });
  fetchStok();
}

tabBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  switchCabang(btn.dataset.cabang);
});

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
  invalidateStokCache(getStokCacheKey()); // paksa fresh
  await fetchStok({ force: true });
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// Init: buka di Tempura, default ke tanggal kemarin
// (laporan stok diinput malam hari, jadi saat dibuka pagi/siang
// stok "hari ini" pasti masih kosong — defaultkan ke H-1)
const initDate = new Date();
initDate.setDate(initDate.getDate() - 1);
goToDate(initDate);
