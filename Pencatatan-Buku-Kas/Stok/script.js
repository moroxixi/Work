// Dipakai bareng cabang: P = Tempura, B = Babakan, L = Leweung Gajah, R = Depan RS
const NAMA_CABANG = { P: "Tempura", B: "Babakan", L: "Leweung Gajah", R: "Depan RS" };

let currentDate = new Date();
let currentCabang = "P";

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

function formatTanggalApi(date) {
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric"
  });
}

function formatTanggalLabel(date) {
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

function toDateInputValue(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

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
  reportInfo.textContent = `Laporan terakhir: ${payload.timestamp} \u00b7 ${payload.cabang}`;

  payload.items.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <span class="item-nama">${escapeHtml(item.nama)}</span>
      <span class="item-laku">Laku: ${item.laku}</span>
      <span class="item-sisa">Sisa: ${item.sisa}</span>
    `;
    itemList.appendChild(row);
  });
}

async function fetchStok({ silent = false } = {}) {
  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  try {
    const tanggalStr = formatTanggalApi(currentDate);
    const url = `${STOK_SCRIPT_URL}?action=stok&tanggal=${encodeURIComponent(tanggalStr)}&cabang=${currentCabang}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat data.");

    renderItems(data);
  } catch (err) {
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
  await fetchStok();
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// Init: buka di Tempura, tanggal hari ini
goToDate(new Date());
