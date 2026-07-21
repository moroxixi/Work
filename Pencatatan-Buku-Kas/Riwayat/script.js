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

// ===== Elemen =====
const tanggalLabel = document.getElementById("tanggalLabel");
const datePicker = document.getElementById("datePicker");
const btnKemarin = document.getElementById("btnKemarin");
const btnHariIni = document.getElementById("btnHariIni");
const btnRefresh = document.getElementById("btnRefresh");
const refreshIcon = document.getElementById("refreshIcon");
const liveStatus = document.getElementById("liveStatus");

const loadingMsg = document.getElementById("loadingMsg");
const emptyMsg = document.getElementById("emptyMsg");
const errorMsg = document.getElementById("errorMsg");
const cardList = document.getElementById("cardList");
const summaryBar = document.getElementById("summaryBar");
const summaryMasuk = document.getElementById("summaryMasuk");
const summaryKeluar = document.getElementById("summaryKeluar");

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
// Format dd/MM/yyyy sesuai zona Asia/Jakarta, dipakai buat query ke server
// dan buat cocokkan dengan format Timestamp di sheet.
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

// yyyy-MM-dd buat isi <input type="date">
function toDateInputValue(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

// Data mentah hari ini (belum difilter) + kategori yang lagi aktif difilter
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
  chipSemua.textContent = `Semua (${rows.length})`;
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
    chip.textContent = `${kat} (${counts[kat]})`;
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
    emptyMsg.textContent = "Belum ada transaksi di tanggal ini.";
    summaryBar.hidden = true;
    return;
  }

  let totalMasuk = 0;
  let totalKeluar = 0;
  allRowsToday.forEach((row) => {
    if (row.arah === "Masuk") totalMasuk += Number(row.jumlah || 0);
    else totalKeluar += Number(row.jumlah || 0);
  });
  summaryBar.hidden = false;
  summaryMasuk.textContent = formatRupiah(totalMasuk);
  summaryKeluar.textContent = formatRupiah(totalKeluar);

  if (currentRows.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = `Tidak ada transaksi kategori "${activeKategoriFilter}" di tanggal ini.`;
    return;
  }
  emptyMsg.hidden = true;

  currentRows.forEach((row) => {
    // ↓ isi loop kartu PERSIS SAMA seperti yang ada di renderList lama,
    // dari "const jamStr = ..." sampai "cardList.appendChild(card);"
    // tinggal copy-paste isi forEach lama ke sini, tidak ada yang berubah.
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ===== Fetch data =====
async function fetchList(date, { silent = false } = {}) {
  if (!silent) setLoading(true);
  errorMsg.hidden = true;

  try {
    const tanggalStr = formatTanggalApi(date);
    const url = `${ENDPOINT_URL}?action=list&tanggal=${encodeURIComponent(tanggalStr)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "ok") throw new Error(data.message || "Gagal memuat data.");

    renderList(data.rows);
  } catch (err) {
    errorMsg.textContent = "Gagal memuat data: " + err.message;
    errorMsg.hidden = false;
  } finally {
    if (!silent) setLoading(false);
  }
}

async function refreshCurrent({ silent = false } = {}) {
  await fetchList(currentDate, { silent });
}

function goToDate(date) {
  currentDate = date;
  tanggalLabel.textContent = formatTanggalLabel(currentDate);
  datePicker.value = toDateInputValue(currentDate);
  refreshCurrent();
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

btnRefresh.addEventListener("click", async () => {
  refreshIcon.classList.add("spin");
  await refreshCurrent();
  setTimeout(() => refreshIcon.classList.remove("spin"), 400);
});

// ===== Live update (polling penanda ringan, bukan seluruh data) =====
async function pollMarker() {
  try {
    const res = await fetch(`${ENDPOINT_URL}?action=ping`);
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
      await refreshCurrent({ silent: true });
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
    await refreshCurrent();
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
  deleteDetail.textContent = `${jamStr} \u00b7 ${row.kategori} \u00b7 ${formatRupiah(row.jumlah)}`;

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
    await refreshCurrent();
  } catch (err) {
    deleteStatus.textContent = err.message;
    deleteStatus.className = "status err";
  } finally {
    btnKonfirmHapus.disabled = false;
  }
});

// ===== Init: buka halaman selalu di tanggal hari ini (dihitung ulang tiap load) =====
goToDate(new Date());
