// Endpoint sama persis dengan form Kas Harian (Code.gs yang sudah diupdate
// mendukung action=list / action=edit / action=delete / action=ping).

const PING_INTERVAL_MS = 10000; // cek penanda perubahan tiap 10 detik

// Daftar kategori dikenal (buat dropdown edit). Kalau kategori baris yang
// diedit ternyata custom (bukan dari daftar ini, misal hasil ketik manual di
// "Lainnya…"), tetap ditambahkan sebagai opsi supaya tidak hilang.
const KATEGORI_MASUK = ["MAO Frozen", "MAO Instan", "Outlet", "Lainnya",
  "Setoran Cabang Tempura", "Sterofoam Tempura",
  "Setoran Cabang Babakan", "Setoran Cabang Leweung Gajah"];
const KATEGORI_KELUAR = ["Belanja", "Gaji/Upah", "Sewa Tempat", "Tunjangan",
  "Bonus", "Parkir", "Dividen", "Pengeluaran Operasional", "Uang Jajan Karyawan"];

// ===== State =====
let currentDate = new Date(); // selalu dihitung ulang, tidak pernah di-hardcode
let currentRows = [];
let lastSeenMarker = null;
let modalOpen = false;
let pendingEditRow = null;
let pendingDeleteRow = null;

// "YYYY-MM" saat mode bulanan aktif; null = mode harian (default).
// Ini yang membedakan periode tampilan & key cache antara harian vs bulanan.
let currentMonthKey = null;

// === Fase 3: optimasi fetch ===
let activeFetchController = null;           // AbortController untuk cancel request lama
const fetchCache = new Map();               // key = tanggalStr, value = data.rows
const CACHE_MAX_AGE = 30 * 60 * 1000;       // 30 menit — cache dianggap stale
const cacheTimestamps = new Map();          // key = tanggalStr, value = Date.now()

// ===== Elemen =====
const tanggalLabel = document.getElementById("tanggalLabel");
const datePicker = document.getElementById("datePicker");
const monthPicker = document.getElementById("monthPicker");
const btnBulanIni = document.getElementById("btnBulanIni");
const btnKemarin = document.getElementById("btnKemarin");
const btnHariIni = document.getElementById("btnHariIni");
const btnRefresh = document.getElementById("btnRefresh");
const refreshIcon = document.getElementById("refreshIcon");
const liveStatus = document.getElementById("liveStatus");
const btnDownload = document.getElementById("btnDownload");

const loadingMsg = document.getElementById("loadingMsg");
const emptyMsg = document.getElementById("emptyMsg");
const errorMsg = document.getElementById("errorMsg");
const cardList = document.getElementById("cardList");
const summaryBar = document.getElementById("summaryBar");
const summaryMasuk = document.getElementById("summaryMasuk");
const summaryKeluar = document.getElementById("summaryKeluar");
const summaryDividen = document.getElementById("summaryDividen");

const editModal = document.getElementById("editModal");
const editWarning = document.getElementById("editWarning");
const editKategori = document.getElementById("editKategori");
const editBelanjaDi = document.getElementById("editBelanjaDi");
const editKeterangan = document.getElementById("editKeterangan");
const editJumlah = document.getElementById("editJumlah");
const editStatus = document.getElementById("editStatus");
const btnBatalEdit = document.getElementById("btnBatalEdit");
const btnSimpanEdit = document.getElementById("btnSimpanEdit");

const deleteModal = document.getElementById("deleteModal");
const deleteWarning = document.getElementById("deleteWarning");
const deleteDetail = document.getElementById("deleteDetail");
const deleteStatus = document.getElementById("deleteStatus");
const btnBatalHapus = document.getElementById("btnBatalHapus");
const btnKonfirmHapus = document.getElementById("btnKonfirmHapus");

// ===== Util tanggal =====
// formatTanggalApi, formatTanggalLabel, toDateInputValue, escapeHtml
// sekarang ada di shared-utils.js (dimuat sebelum file ini).

function isSameDate(a, b) {
  return formatTanggalApi(a) === formatTanggalApi(b);
}

function formatRupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

// ===== Render =====
function setLoading(isLoading) {
  loadingMsg.hidden = !isLoading;
  if (isLoading) {
    emptyMsg.hidden = true;
    errorMsg.hidden = true;
  }
}

// Elemen filter kategori
const kategoriFilterBar = document.getElementById("kategoriFilterBar");

// Data mentah periode aktif (belum difilter) — berisi transaksi hari itu
// (mode harian) ATAU satu bulan penuh (mode bulanan) + kategori yang lagi
// aktif difilter.
let allRowsToday = [];
let activeKategoriFilter = null; // null = "Semua"

function renderList(rows) {
  allRowsToday = rows;
  renderKategoriFilterBar(rows);
  applyFilterAndRenderCards();
}

// Bikin chip kategori otomatis dari data hari ini, urut dari paling sering
function renderKategoriFilterBar(rows) {
  if (rows.length === 0) {
    kategoriFilterBar.hidden = true;
    kategoriFilterBar.innerHTML = "";
    activeKategoriFilter = null;
    return;
  }

  const counts = {};
  rows.forEach((r) => { counts[r.kategori] = (counts[r.kategori] || 0) + 1; });
  const kategoriList = Object.keys(counts).sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return a.localeCompare(b, "id");
  });

  if (activeKategoriFilter && !kategoriList.includes(activeKategoriFilter)) {
    activeKategoriFilter = null; // kategori yang lagi difilter sudah tidak ada di hari ini
  }

  kategoriFilterBar.hidden = false;
  kategoriFilterBar.innerHTML = "";

  const chipSemua = document.createElement("button");
  chipSemua.type = "button";
  chipSemua.className = "kategori-chip" + (activeKategoriFilter === null ? " is-active" : "");
  chipSemua.textContent = "Semua (" + rows.length + ")";
  chipSemua.addEventListener("click", () => {
    activeKategoriFilter = null;
    renderKategoriFilterBar(allRowsToday);
    applyFilterAndRenderCards();
  });
  kategoriFilterBar.appendChild(chipSemua);

  kategoriList.forEach((kat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "kategori-chip" + (activeKategoriFilter === kat ? " is-active" : "");
    chip.textContent = kat + " (" + counts[kat] + ")";
    chip.addEventListener("click", () => {
      activeKategoriFilter = activeKategoriFilter === kat ? null : kat;
      renderKategoriFilterBar(allRowsToday);
      applyFilterAndRenderCards();
    });
    kategoriFilterBar.appendChild(chip);
  });
}

// Render kartu berdasarkan filter aktif, tapi ringkasan Masuk/Keluar tetap dari total hari itu
function applyFilterAndRenderCards() {
  currentRows = activeKategoriFilter
    ? allRowsToday.filter((r) => r.kategori === activeKategoriFilter)
    : allRowsToday;

  cardList.innerHTML = "";

  if (allRowsToday.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = currentMonthKey
      ? "Belum ada transaksi di bulan ini."
      : "Belum ada transaksi di tanggal ini.";
    summaryBar.hidden = true;
    return;
  }

  let totalMasuk = 0;
  let totalKeluar = 0;
  let totalDividen = 0;
  allRowsToday.forEach((row) => {
    // Dividen dihitung terpisah — TIDAK ikut ke total uang keluar
    if (row.kategori === "Dividen") totalDividen += Number(row.jumlah || 0);
    else if (row.arah === "Masuk") totalMasuk += Number(row.jumlah || 0);
    else totalKeluar += Number(row.jumlah || 0);
  });
  summaryBar.hidden = false;
  summaryMasuk.textContent = formatRupiah(totalMasuk);
  summaryKeluar.textContent = formatRupiah(totalKeluar);
  summaryDividen.textContent = formatRupiah(totalDividen);

  if (currentRows.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = "Tidak ada transaksi kategori \"" + activeKategoriFilter + "\"" +
      (currentMonthKey ? " di bulan ini." : " di tanggal ini.");
    return;
  }
  emptyMsg.hidden = true;

currentRows.forEach((row) => {
    const timestamp = row.timestamp || "";
    // Mode bulanan: tampilkan tanggal juga (dd/MM · HH:mm:ss) karena kartu
    // bisa berisi transaksi dari beberapa hari berbeda.
    const jamStr = currentMonthKey && timestamp.length >= 16
      ? timestamp.substring(0, 5) + " · " + timestamp.substring(11)
      : timestamp.substring(11); // ambil "HH:mm:ss"

    const card = document.createElement("div");
    card.className = "tx-card " + (row.arah === "Masuk" ? "arah-masuk" : "arah-keluar");

    let badgeHtml = "";
    if (row.sumber === "otomatis") {
      badgeHtml = "<span class=\"tx-badge badge-otomatis\">Otomatis dari Setoran</span>";
    } else if (row.sumber === "cek-dulu") {
      badgeHtml = "<span class=\"tx-badge badge-cekdulu\">Cek dulu sebelum hapus</span>";
    }

    card.innerHTML =
      "<div class=\"tx-top\">" +
        "<span class=\"tx-kategori\">" + escapeHtml(row.kategori) + "</span>" +
        "<span class=\"tx-jumlah\">" + (row.arah === "Masuk" ? "+" : "-") + " " + formatRupiah(row.jumlah) + "</span>" +
      "</div>" +
      "<div class=\"tx-meta\">" + jamStr + (row.belanjaDi ? " &middot; " + escapeHtml(row.belanjaDi) : "") + "</div>" +
      (row.keterangan && row.keterangan !== "-" ? "<div class=\"tx-keterangan\">" + escapeHtml(row.keterangan) + "</div>" : "") +
      badgeHtml +
      "<div class=\"tx-actions\">" +
        "<button type=\"button\" class=\"btn-edit-tx\">Edit</button>" +
        "<button type=\"button\" class=\"btn-hapus-tx\">Hapus</button>" +
      "</div>";

    card.querySelector(".btn-edit-tx").addEventListener("click", () => openEditModal(row));
    card.querySelector(".btn-hapus-tx").addEventListener("click", () => openDeleteModal(row));

    cardList.appendChild(card);
  });
}

// ===== Util bulan (mode bulanan) =====
function monthKeyOf(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function formatBulanLabel(monthKey) {
  return formatBulanNama(monthKey) + " " + monthKey.split("-")[0];
}

// Key cache periode aktif. WAJIB dibedakan antara mode harian ("dd/MM/yyyy")
// dan mode bulanan ("bulan:YYYY-MM") supaya switching mode tidak menampilkan
// data stale/tertukar antar periode.
function currentViewKey() {
  return currentMonthKey ? "bulan:" + currentMonthKey : formatTanggalApi(currentDate);
}

// ===== Cache helpers =====
// Key cache bisa berupa tanggal harian ("dd/MM/yyyy") ATAU bulanan
// ("bulan:YYYY-MM") — kedua namespace sengaja dipisah supaya tidak saling
// tertukar saat switching mode harian ↔ bulanan.
function isCacheValid(key) {
  if (!fetchCache.has(key)) return false;
  const age = Date.now() - (cacheTimestamps.get(key) || 0);
  return age < CACHE_MAX_AGE;
}

function invalidateCache(key) {
  fetchCache.delete(key);
  cacheTimestamps.delete(key);
}

// ===== Fetch data =====
async function fetchList(date, { silent = false, force = false, mode = "day" } = {}) {
  // Mode bulanan punya jalur fetch sendiri (fetch tiap hari lalu gabung),
  // key cache-nya dipisah. Mode harian (default) di bawah TIDAK berubah.
  if (mode === "month") return fetchMonthList(date, { silent, force });

  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  const tanggalStr = formatTanggalApi(date);

  // Cache hit (kecuali force-refresh)
  if (!force && isCacheValid(tanggalStr)) {
    renderList(fetchCache.get(tanggalStr));
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
    const url = ENDPOINT_URL + "?action=list&tanggal=" + encodeURIComponent(tanggalStr);
    const res = await fetch(url, { signal });
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat data.");

    // Simpan ke cache
    fetchCache.set(tanggalStr, data.rows);
    cacheTimestamps.set(tanggalStr, Date.now());

    renderList(data.rows);
  } catch (err) {
    if (err.name === "AbortError") return; // request dibatalkan karena ada fetch baru — silent
    errorMsg.textContent = "Gagal memuat data: " + err.message;
    errorMsg.hidden = false;
  } finally {
    if (!silent) setLoading(false);
  }
}

// Mode bulanan: fetch data satu bulan penuh. Backend Apps Script hanya
// mendukung query per tanggal (action=list&tanggal=dd/MM/yyyy), jadi bulan
// diambil dengan mem-fetch tiap hari dalam bulan itu (per batch maks 10
// request paralel) lalu digabung — baris sheet unik per nomor baris.
// Cache pakai key terpisah ("bulan:YYYY-MM") supaya tidak tertukar dengan
// cache harian.
async function fetchMonthList(date, { silent = false, force = false } = {}) {
  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  const key = "bulan:" + monthKeyOf(date);

  // Cache hit (kecuali force-refresh)
  if (!force && isCacheValid(key)) {
    renderList(fetchCache.get(key));
    if (!silent) setLoading(false);
    return;
  }

  // Cancel request sebelumnya kalau ada
  if (activeFetchController) {
    activeFetchController.abort();
  }
  const controller = new AbortController();
  activeFetchController = controller;
  const signal = controller.signal;

  try {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Fetch per batch kecil supaya tidak membuka 30+ koneksi sekaligus.
    // Kalau yang dilihat bulan berjalan, hari-hari masa depan sudah pasti
    // kosong (timestamp selalu di-set saat input), jadi tidak perlu di-fetch.
    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const lastDayToFetch = isCurrentMonth ? today.getDate() : daysInMonth;
    const days = [];
    for (let day = 1; day <= lastDayToFetch; day++) {
      days.push(new Date(year, month, day));
    }
    const CHUNK = 10;
    const results = [];
    for (let i = 0; i < days.length; i += CHUNK) {
      const chunkDays = days.slice(i, i + CHUNK);
      const chunkResults = await Promise.all(chunkDays.map((d) => fetchDayRows(d, signal)));
      results.push(...chunkResults);
    }

    // Gabungkan semua hari; nomor baris sheet dipakai sebagai id unik
    const seen = new Set();
    const rows = [];
    results.forEach((res) => {
      if (res.status !== "ok") throw new Error(res.message || "Gagal memuat data.");
      (res.rows || []).forEach((row) => {
        if (!seen.has(row.row)) {
          seen.add(row.row);
          rows.push(row);
        }
      });
    });
    rows.sort((a, b) => b.row - a.row); // paling baru di atas, sama seperti harian

    fetchCache.set(key, rows);
    cacheTimestamps.set(key, Date.now());

    renderList(rows);
  } catch (err) {
    if (err.name === "AbortError") return; // dibatalkan karena ada fetch baru — silent
    errorMsg.textContent = "Gagal memuat data: " + err.message;
    errorMsg.hidden = false;
  } finally {
    if (!silent) setLoading(false);
  }
}

// Satu request harian (dipakai fetchMonthList). Pakai signal yang sama
// supaya ikut dibatalkan kalau user pindah periode sebelum selesai.
async function fetchDayRows(date, signal) {
  const tanggalStr = formatTanggalApi(date);
  const res = await fetch(ENDPOINT_URL + "?action=list&tanggal=" + encodeURIComponent(tanggalStr), { signal });
  return res.json();
}

async function refreshCurrent({ silent = false, force = false, mode } = {}) {
  await fetchList(currentDate, {
    silent,
    force,
    mode: mode || (currentMonthKey ? "month" : "day")
  });
}

function goToDate(date) {
  currentDate = date;
  currentMonthKey = null; // keluar dari mode bulanan
  activeKategoriFilter = null; // ganti tanggal → filter balik ke "Semua"
  tanggalLabel.textContent = formatTanggalLabel(currentDate);
  datePicker.value = toDateInputValue(currentDate);
  updateDownloadVisibility(); // tombol download hanya untuk mode bulanan
  refreshCurrent();
}

function goToMonth(date) {
  currentDate = date;
  currentMonthKey = monthKeyOf(date); // masuk mode bulanan
  activeKategoriFilter = null; // ganti bulan → filter balik ke "Semua"
  tanggalLabel.textContent = formatBulanLabel(currentMonthKey);
  monthPicker.value = currentMonthKey;
  updateDownloadVisibility(); // tombol download hanya untuk mode bulanan
  refreshCurrent({ mode: "month" });
}

// ===== Navigasi =====
btnHariIni.addEventListener("click", () => {
  goToDate(new Date()); // dihitung ulang tiap klik, selalu "hari ini" yang sebenarnya
});

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

btnBulanIni.addEventListener("click", () => {
  goToMonth(new Date()); // dihitung ulang tiap klik, selalu "bulan ini"
});

monthPicker.addEventListener("change", () => {
  if (!monthPicker.value) return;
  const [y, m] = monthPicker.value.split("-").map(Number);
  goToMonth(new Date(y, m - 1, 1));
});

// ===== Download CSV (mode bulanan) =====
// Muncul hanya saat mode bulanan aktif. Data diambil DARI state yang sudah
// dirender (currentRows = hasil filter bulan + kategori aktif), TIDAK fetch
// ulang ke backend — murni export dari yang sedang tampil di layar.

function updateDownloadVisibility() {
  btnDownload.hidden = !currentMonthKey;
}

// Nama bulan Indonesia (mis. "Juli") — konvensi sama dengan formatBulanLabel()
function formatBulanNama(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long" });
}

// Siapkan teks kategori supaya aman dipakai di nama file (ganti /, spasi, dll)
function sanitizeFilenamePart(str) {
  return String(str || "")
    .replace(/[\\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function downloadFileName() {
  const [tahun] = currentMonthKey.split("-");
  let name = "riwayat-kas-" + tahun + "-" + formatBulanNama(currentMonthKey);
  if (activeKategoriFilter) {
    name += "-" + sanitizeFilenamePart(activeKategoriFilter);
  }
  return name + ".csv";
}

// Escape RFC 4180: kutip field yang mengandung koma/quote/newline,
// dan gandakan quote di dalamnya supaya file tidak korup di Excel/Sheets.
function csvEscape(value) {
  const s = String(value == null ? "" : value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv() {
  // Pure addition: tidak boleh mengubah state filter/render yang sedang aktif.
  if (!currentMonthKey || currentRows.length === 0) {
    liveStatus.textContent = "Tidak ada data untuk di-download.";
    setTimeout(() => { liveStatus.textContent = ""; }, 2500);
    return;
  }

  try {
    const header = ["Tanggal", "Jam", "Kategori", "Detail", "Keterangan", "Jenis", "Jumlah", "Sumber"];
    const lines = [header.map(csvEscape).join(",")];

    currentRows.forEach((row) => {
      const timestamp = row.timestamp || "";
      const tanggal = timestamp.substring(0, 10); // "dd/MM/yyyy"
      const jam = timestamp.length >= 11 ? timestamp.substring(11, 19) : ""; // "HH:mm:ss"
      lines.push([
        tanggal,
        jam,
        row.kategori || "",
        row.belanjaDi || "",
        row.keterangan === "-" ? "" : (row.keterangan || ""),
        row.arah || "",
        Number(row.jumlah || 0),
        row.sumber || "manual"
      ].map(csvEscape).join(","));
    });

    // BOM supaya karakter non-ASCII terbaca benar di Excel; \r\n = Excel-friendly
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    liveStatus.textContent = "Download CSV dimulai (" + currentRows.length + " transaksi).";
    setTimeout(() => { liveStatus.textContent = ""; }, 2500);
  } catch (err) {
    liveStatus.textContent = "Gagal download: " + err.message;
    setTimeout(() => { liveStatus.textContent = ""; }, 2500);
  }
}

btnDownload.addEventListener("click", downloadCsv);

btnRefresh.addEventListener("click", async () => {
  refreshIcon.classList.add("spin");
  invalidateCache(currentViewKey()); // paksa fresh periode aktif
  await refreshCurrent({ force: true });
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// ===== Live update (polling penanda ringan, bukan seluruh data) =====
async function pollMarker() {
  try {
    const res = await fetch(ENDPOINT_URL + "?action=ping");
    const data = await res.json();
    const marker = data.lastChange || "";

    if (lastSeenMarker === null) {
      lastSeenMarker = marker; // baseline pertama kali load, jangan langsung dianggap "berubah"
      return;
    }

    if (marker !== lastSeenMarker) {
      lastSeenMarker = marker;
      if (modalOpen) {
        // Ada perubahan tapi user lagi edit/hapus -> jangan timpa, tunggu modal ditutup
        return;
      }
      liveStatus.textContent = "Ada data baru, memperbarui...";
      invalidateCache(currentViewKey()); // data di server berubah, cache stale
      await refreshCurrent({ silent: true, force: true });
      liveStatus.textContent = "Diperbarui otomatis";
      setTimeout(() => { liveStatus.textContent = ""; }, 2500);
    }
  } catch (err) {
    // Diamkan saja kalau ping gagal (mis. offline sebentar), tidak perlu ganggu user
  }
}

setInterval(pollMarker, PING_INTERVAL_MS);

// ===== Modal Edit =====
function populateKategoriSelect(currentKategori) {
  editKategori.innerHTML = "";

  const addOptGroup = (label, list) => {
    const group = document.createElement("optgroup");
    group.label = label;
    list.forEach((kat) => {
      const opt = document.createElement("option");
      opt.value = kat;
      opt.textContent = kat;
      group.appendChild(opt);
    });
    editKategori.appendChild(group);
  };

  addOptGroup("Uang Masuk", KATEGORI_MASUK);
  addOptGroup("Uang Keluar", KATEGORI_KELUAR);

  const known = KATEGORI_MASUK.concat(KATEGORI_KELUAR);
  if (currentKategori && known.indexOf(currentKategori) === -1) {
    const opt = document.createElement("option");
    opt.value = currentKategori;
    opt.textContent = currentKategori + " (custom)";
    editKategori.insertBefore(opt, editKategori.firstChild);
  }

  editKategori.value = currentKategori || "";
}

function openEditModal(row) {
  pendingEditRow = row;
  modalOpen = true;
  editStatus.textContent = "";
  editStatus.className = "status";

  if (row.sumber === "otomatis") {
    editWarning.hidden = false;
    editWarning.className = "edit-warning danger";
    editWarning.textContent = "Baris ini otomatis dari setoran Tempura/Wonton. Kalau diedit, datanya tidak akan sinkron lagi dengan Input_Tempura/Input_Wonton (buat audit).";
  } else if (row.sumber === "cek-dulu") {
    editWarning.hidden = false;
    editWarning.className = "edit-warning";
    editWarning.textContent = "Kategori ini bisa berasal dari setoran otomatis atau input manual. Cek dulu di Input_Tempura/Input_Wonton kalau ragu sebelum mengubah.";
  } else {
    editWarning.hidden = true;
  }

  populateKategoriSelect(row.kategori);
  editBelanjaDi.value = row.belanjaDi || "";
  editKeterangan.value = row.keterangan === "-" ? "" : (row.keterangan || "");
  editJumlah.value = Number(row.jumlah || 0).toLocaleString("id-ID");

  editModal.hidden = false;
}

function closeEditModal() {
  editModal.hidden = true;
  modalOpen = false;
  pendingEditRow = null;
}

btnBatalEdit.addEventListener("click", closeEditModal);

editJumlah.addEventListener("input", () => {
  const digits = editJumlah.value.replace(/\D/g, "");
  editJumlah.value = digits ? Number(digits).toLocaleString("id-ID") : "";
});

btnSimpanEdit.addEventListener("click", async () => {
  if (!pendingEditRow) return;

  const jumlahAngka = Number(editJumlah.value.replace(/\D/g, ""));
  if (!jumlahAngka) {
    editStatus.textContent = "Isi jumlah uangnya dulu.";
    editStatus.className = "status err";
    return;
  }

  btnSimpanEdit.disabled = true;
  editStatus.textContent = "Menyimpan...";
  editStatus.className = "status";

  try {
    const payload = {
      action: "edit",
      row: pendingEditRow.row,
      timestampCheck: pendingEditRow.timestamp,
      kategori: editKategori.value,
      belanjaDi: editBelanjaDi.value.trim(),
      keterangan: editKeterangan.value.trim(),
      jumlah: jumlahAngka
    };

    const res = await fetch(ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal menyimpan.");

    closeEditModal();
    invalidateCache(currentViewKey()); // data berubah, cache jadi stale
    await refreshCurrent({ force: true });
  } catch (err) {
    editStatus.textContent = err.message;
    editStatus.className = "status err";
  } finally {
    btnSimpanEdit.disabled = false;
  }
});

// ===== Modal Hapus =====
function openDeleteModal(row) {
  pendingDeleteRow = row;
  modalOpen = true;
  deleteStatus.textContent = "";
  deleteStatus.className = "status";

  if (row.sumber === "otomatis") {
    deleteWarning.hidden = false;
    deleteWarning.className = "edit-warning danger";
    deleteWarning.textContent = "PERHATIAN: baris ini otomatis dari setoran Tempura/Wonton. Menghapusnya di sini TIDAK ikut menghapus data di Input_Tempura/Input_Wonton, jadi audit bisa jadi tidak cocok. Pastikan ini memang perlu dihapus.";
  } else if (row.sumber === "cek-dulu") {
    deleteWarning.hidden = false;
    deleteWarning.className = "edit-warning";
    deleteWarning.textContent = "Kategori ini bisa berasal dari setoran otomatis. Cek dulu di Input_Tempura/Input_Wonton sebelum menghapus, supaya tidak menghapus data yang masih dipakai buat audit.";
  } else {
    deleteWarning.hidden = true;
  }

  const jamStr = (row.timestamp || "").substring(11);
  deleteDetail.textContent = jamStr + " \u00b7 " + row.kategori + " \u00b7 " + formatRupiah(row.jumlah);

  deleteModal.hidden = false;
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  modalOpen = false;
  pendingDeleteRow = null;
}

btnBatalHapus.addEventListener("click", closeDeleteModal);

btnKonfirmHapus.addEventListener("click", async () => {
  if (!pendingDeleteRow) return;

  btnKonfirmHapus.disabled = true;
  deleteStatus.textContent = "Menghapus...";
  deleteStatus.className = "status";

  try {
    const payload = {
      action: "delete",
      row: pendingDeleteRow.row,
      timestampCheck: pendingDeleteRow.timestamp
    };

    const res = await fetch(ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal menghapus.");

    closeDeleteModal();
    invalidateCache(currentViewKey()); // data berubah, cache jadi stale
    await refreshCurrent({ force: true });
  } catch (err) {
    deleteStatus.textContent = err.message;
    deleteStatus.className = "status err";
  } finally {
    btnKonfirmHapus.disabled = false;
  }
});

// ===== Init: buka halaman selalu di tanggal hari ini (dihitung ulang tiap load) =====
goToDate(new Date());
