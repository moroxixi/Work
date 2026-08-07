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
      "<span class=\"item-sisa\">Sisa: " + item.sisa + "</span>" +
      "<span class=\"item-rekomendasi\">Rekom: \u2013</span>" +
      "<span class=\"item-catatan\">Catatan: \u2013</span>";
    itemList.appendChild(row);
  });
}

// ============================================================
// REKOMENDASI & CATATAN — agregasi histori (fungsi murni, tanpa DOM)
// Semua fungsi di blok ini bisa diuji via node (dummy data).
// fetchStok() TIDAK disentuh: histori diambil lewat fetchStokHistori()
// yang memanggil endpoint yang sama secara paralel + cache sendiri.
// ============================================================

function rataRata(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Standar deviasi POPULASI (dibagi N). N < 2 -> 0 supaya tidak NaN.
function stdDevPop(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = rataRata(arr);
  const variance = arr.reduce((acc, x) => acc + (x - m) * (x - m), 0) / arr.length;
  return Math.sqrt(variance);
}

function proporsiSamaDengan(arr, nilai) {
  if (!arr || !arr.length) return 0;
  return arr.filter(x => x === nilai).length / arr.length;
}

// Hari (0=Minggu..6=Sabtu) versi Asia/Jakarta — pola sama dengan toDateInputValue() di shared-utils.js.
function weekdayJakarta(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return d.getDay();
}

function lakuItem(row, nama) {
  const it = row.items.find(x => x.nama === nama);
  return it ? Number(it.laku) || 0 : 0;
}

function sisaItem(row, nama) {
  const it = row.items.find(x => x.nama === nama);
  return it ? Number(it.sisa) || 0 : 0;
}

// CATATAN — prioritas tertinggi yang terpenuhi, cek berurutan dari atas.
function buatCatatan(stockoutRateHariSama, stockoutRateSemua, rata7hari, rataSemua) {
  if (stockoutRateHariSama >= 0.5) return "\u26a0 sering habis di hari ini";
  if (stockoutRateHariSama >= 0.25 || stockoutRateSemua >= 0.3) return "\u26a0 kadang habis, sudah ditambah buffer";
  if (rata7hari < rataSemua * 0.7) return "tren menurun";
  if (rata7hari > rataSemua * 1.3) return "tren naik";
  if (rataSemua === 0) return "belum pernah laku \u2014 cek apakah produk masih dijual";
  return "stok biasanya cukup";
}

/**
 * Hitung Rekomendasi + Catatan per produk dari histori.
 * @param {Array} histori  [{ tanggal: Date, found: bool, items: [{nama,sisa,laku}] }]
 *                         urut MENURUN — tanggalTarget di index 0.
 * @param {Date} tanggalTarget  hari yang sedang ditampilkan.
 * @returns {Map<string, {rekomendasi, catatan, rataHariSama, rata7, rataSemua, stdSemua, stockoutHariSama, stockoutSemua}>}
 */
function hitungRekomendasiProduk(histori, tanggalTarget) {
  const hariTarget = weekdayJakarta(tanggalTarget);
  const rows = histori.filter(h => h.found); // hanya hari yang punya laporan

  const dataSemua = rows;                                              // seluruh baris dalam window
  const data7 = rows
    .filter(r => r.tanggal.getTime() < tanggalTarget.getTime())        // STRICT sebelum tanggal_target
    .slice(0, 7);                                                      // 7 baris historis terakhir
  const dataHariSama = rows.filter(r => weekdayJakarta(r.tanggal) === hariTarget);

  const namaSet = new Set();
  rows.forEach(r => r.items.forEach(it => namaSet.add(it.nama)));

  const hasil = new Map();
  namaSet.forEach(nama => {
    const lakuHariSama = dataHariSama.map(r => lakuItem(r, nama));
    const laku7 = data7.map(r => lakuItem(r, nama));
    const lakuSemua = dataSemua.map(r => lakuItem(r, nama));
    const sisaHariSama = dataHariSama.map(r => sisaItem(r, nama));
    const sisaSemua = dataSemua.map(r => sisaItem(r, nama));

    const rataHariSama = rataRata(lakuHariSama);
    const rata7 = rataRata(laku7);
    const rataSemua = rataRata(lakuSemua);
    const stdSemua = stdDevPop(lakuSemua);
    const stockoutHariSama = proporsiSamaDengan(sisaHariSama, 0);
    const stockoutSemua = proporsiSamaDengan(sisaSemua, 0);

    let rekomendasi;
    if (rataSemua === 0 && stdSemua === 0) {
      rekomendasi = 0;                                                // belum pernah laku sama sekali
    } else if (dataHariSama.length === 0) {
      rekomendasi = Math.ceil(rata7 + 0.5 * stdSemua);                // fallback: tanpa bonus
    } else {
      const blended = 0.45 * rataHariSama + 0.35 * rata7 + 0.20 * rataSemua;
      const buffer = 0.5 * stdSemua;
      const bonus = (stockoutHariSama >= 0.5 || stockoutSemua >= 0.3) ? blended * 0.15 : 0;
      rekomendasi = Math.ceil(blended + buffer + bonus);
    }

    hasil.set(nama, {
      rekomendasi,
      catatan: buatCatatan(stockoutHariSama, stockoutSemua, rata7, rataSemua),
      rataHariSama, rata7, rataSemua, stdSemua,
      stockoutHariSama, stockoutSemua
    });
  });
  return hasil;
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

// ============================================================
// REKOMENDASI & CATATAN — pengambilan histori & tampilan
// fetchStok() TIDAK diubah: histori di-fetch paralel di sini,
// dengan cache in-memory per sesi (reset tiap reload halaman).
// ============================================================
const historiCache = new Map();        // key = "dd/MM/yyyy::cabang" -> payload
let historiRequestId = 0;              // guard: hasil lama jangan menimpa hari/cabang baru
let rekomendasiMap = new Map();        // nama produk -> { rekomendasi, catatan }

function getStokCacheKeyFor(tanggalStr, cabang) {
  return tanggalStr + "::" + cabang;
}

async function fetchStokHistori(cabang, tanggalTarget, jumlahHari = 30) {
  // Daftar tanggal mundur dari tanggalTarget (index 0 = target).
  const dates = [];
  for (let i = 0; i < jumlahHari; i++) {
    const d = new Date(tanggalTarget);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }

  const perTanggal = dates.map(async (d) => {
    const tanggalStr = formatTanggalApi(d);
    const cacheKey = tanggalStr + "::" + cabang;

    if (historiCache.has(cacheKey)) return historiCache.get(cacheKey);

    // Reuse cache utama fetchStok() (read-only) kalau tanggal ini sudah fresh di sana,
    // supaya tanggal yang sama tidak di-fetch ulang dalam satu sesi.
    const mainKey = getStokCacheKeyFor(tanggalStr, cabang);
    if (stokCache.has(mainKey) && isStokCacheValid(mainKey)) {
      const payload = stokCache.get(mainKey);
      historiCache.set(cacheKey, payload);
      return payload;
    }

    const url = STOK_SCRIPT_URL + "?action=stok&tanggal=" + encodeURIComponent(tanggalStr) + "&cabang=" + cabang;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat histori.");
    historiCache.set(cacheKey, data);
    return data;
  });

  // Promise.allSettled: satu tanggal gagal tidak membatalkan hari lain.
  const settled = await Promise.allSettled(perTanggal);
  return dates.map((d, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      const p = r.value;
      return { tanggal: d, found: !!p.found, timestamp: p.timestamp, cabang: p.cabang, items: p.items || [] };
    }
    return { tanggal: d, found: false, items: [], error: true };
  });
}

async function loadRekomendasi(cabang, tanggalTarget) {
  const myId = ++historiRequestId;
  try {
    const histori = await fetchStokHistori(cabang, tanggalTarget);
    if (myId !== historiRequestId) return; // user sudah pindah hari/cabang — abaikan hasil lama
    rekomendasiMap = hitungRekomendasiProduk(histori, tanggalTarget);
    applyRekomendasiToDom();
  } catch (err) {
    // Histori gagal TIDAK boleh merusak halaman utama (Laku/Sisa tetap tampil).
  }
}

function applyRekomendasiToDom() {
  document.querySelectorAll(".item-row").forEach(row => {
    const namaEl = row.querySelector(".item-nama");
    if (!namaEl) return;
    const info = rekomendasiMap.get(namaEl.textContent);
    if (!info) return;
    const elR = row.querySelector(".item-rekomendasi");
    const elC = row.querySelector(".item-catatan");
    if (elR) elR.textContent = "Rekom: " + info.rekomendasi;
    if (elC) elC.textContent = "Catatan: " + info.catatan;
  });
}

function goToDate(date) {
  currentDate = date;
  tanggalLabel.textContent = formatTanggalLabel(currentDate);
  datePicker.value = toDateInputValue(currentDate);
  fetchStok();
  loadRekomendasi(currentCabang, currentDate); // async, fire-and-forget
}

function switchCabang(kode) {
  currentCabang = kode;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cabang === kode);
  });
  fetchStok();
  loadRekomendasi(currentCabang, currentDate); // async, fire-and-forget
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
  historiCache.delete(getStokCacheKey()); // histori tanggal/cabang ini ikut fresh (bukan cache sesi lama)
  await fetchStok({ force: true });
  loadRekomendasi(currentCabang, currentDate); // kolom Rekomendasi & Catatan ikut dihitung ulang
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// Init: buka di Tempura, default ke tanggal kemarin
// (laporan stok diinput malam hari, jadi saat dibuka pagi/siang
// stok "hari ini" pasti masih kosong — defaultkan ke H-1)
const initDate = new Date();
initDate.setDate(initDate.getDate() - 1);
goToDate(initDate);
