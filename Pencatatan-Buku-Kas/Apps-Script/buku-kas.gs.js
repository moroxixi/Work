// ==== Code.gs — Kas Harian + Riwayat (edit/hapus) ====
//
// PENTING setelah paste kode ini:
// 1. Deploy ulang (Manage deployments > Edit > New version > Deploy) —
//    URL lama TIDAK otomatis ambil kode baru.
// 2. Jalankan fungsi setupOnChangeTrigger() SEKALI SAJA secara manual:
//    - Di editor Apps Script, pilih fungsi "setupOnChangeTrigger" di dropdown atas.
//    - Klik Run. Kalau diminta izin akses, Allow.
//    - Ini memasang "penanda" otomatis supaya halaman Riwayat tahu kapan ada
//      data baru masuk (dari form manapun), tanpa perlu polling berat.
//    - Cukup sekali, tidak perlu diulang kecuali trigger-nya kehapus manual
//      dari menu Triggers (ikon jam di sidebar Apps Script).

const SHEET_NAME = "Input";
const CHANGE_MARKER_KEY = "LAST_CHANGE_INPUT";

// Kategori yang PASTI otomatis dari setoran Tempura/Wonton (lihat Business.md Section 14)
const KATEGORI_OTOMATIS_PASTI = [
  "Setoran Cabang Tempura",
  "Sterofoam Tempura",
  "Setoran Cabang Babakan",
  "Setoran Cabang Leweung Gajah",
  "Pengeluaran Operasional",
  "Uang Jajan Karyawan"
];
// Bisa otomatis ATAU manual — perlu dicek dulu sebelum hapus (lihat Business.md)
const KATEGORI_CEK_DULU = ["Gaji/Upah"];

// Dipakai buat kasih warna Masuk/Keluar di kartu Riwayat.
// Dua mekanisme penentuan arah:
//   1. KATEGORI_MASUK_EXACT — nama kategori yang cocok persis (exact match).
//   2. KATEGORI_MASUK_SUBSTRING — kategori dianggap Masuk kalau namanya
//      MENGANDUNG salah satu keyword di bawah (mis. "Setoran Cabang Depan RS").
// Kalau ada kategori custom baru (dari "Lainnya…" di form) yang mestinya Masuk
// tapi kebaca Keluar, tinggal tambahkan namanya ke KATEGORI_MASUK_EXACT (atau
// keyword-nya ke KATEGORI_MASUK_SUBSTRING) di bawah.
const KATEGORI_MASUK_EXACT = ["MAO Frozen", "MAO Instan", "Outlet", "Lainnya"];
const KATEGORI_MASUK_SUBSTRING = ["RS", "Babakan", "Tempura", "Leweung", "LW"];

function isKategoriMasuk_(kategori) {
  if (KATEGORI_MASUK_EXACT.indexOf(kategori) !== -1) return true;
  return KATEGORI_MASUK_SUBSTRING.some(function(keyword) {
    return kategori.indexOf(keyword) !== -1;
  });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action || "create";

  if (action === "edit") return handleEdit_(data);
  if (action === "delete") return handleDelete_(data);

  // ==== Validasi input (lapisan pengaman terakhir di server) ====
  // Tolak payload tidak valid TANPA menulis apa pun ke sheet. Tidak throw
  // error mentah supaya execution log Apps Script tidak penuh error.
  const kategori = (data.kategori || "").toString().trim();
  if (kategori === "") {
    return jsonOut_({ ok: false, error: "Kategori wajib diisi." });
  }

  const jumlah = Number(data.jumlah);
  if (!isFinite(jumlah) || jumlah <= 0) {
    return jsonOut_({ ok: false, error: "Jumlah harus angka lebih dari 0." });
  }

  // ==== Perilaku LAMA, tidak diubah sama sekali ====
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
  const keteranganRaw = (data.keterangan || "").toString().trim();
  const keterangan = keteranganRaw === "" ? "-" : keteranganRaw;

  sheet.appendRow([
    timestamp,
    keterangan,
    data.kategori || "",
    data.belanjaDi || "",
    Number(data.jumlah) || 0
  ]);

  return jsonOut_({ status: "ok" });
}

function doGet(e) {
  const params = e.parameter || {};

  if (params.action === "list") return handleList_(params.tanggal);
  if (params.action === "ping") {
    const marker = PropertiesService.getScriptProperties().getProperty(CHANGE_MARKER_KEY) || "";
    return jsonOut_({ lastChange: marker });
  }

  // Perilaku lama (cek endpoint aktif dari browser)
  return ContentService
    .createTextOutput("Form endpoint aktif. Kirim data lewat POST dari form HTML.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function handleList_(tanggalStr) {
  if (!tanggalStr) {
    return jsonOut_({ status: "error", message: "Parameter tanggal wajib diisi (format dd/MM/yyyy)." });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOut_({ status: "ok", rows: [] });

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const rows = [];

  values.forEach((row, i) => {
    const rowNumber = i + 2; // baris asli di sheet, header = baris 1
    const timestampStr = formatTimestampCell_(row[0]);
    const tanggalBaris = timestampStr.substring(0, 10); // "dd/MM/yyyy"
    if (tanggalBaris !== tanggalStr) return;

    const kategori = row[2] || "";
    let sumber = "manual";
    if (KATEGORI_OTOMATIS_PASTI.indexOf(kategori) !== -1) sumber = "otomatis";
    else if (KATEGORI_CEK_DULU.indexOf(kategori) !== -1) sumber = "cek-dulu";

    rows.push({
      row: rowNumber,
      timestamp: timestampStr,
      keterangan: row[1] || "",
      kategori: kategori,
      belanjaDi: row[3] || "",
      jumlah: row[4] || 0,
      sumber: sumber,
      arah: isKategoriMasuk_(kategori) ? "Masuk" : "Keluar"
    });
  });

  // Urut dari yang paling baru
  rows.sort((a, b) => b.row - a.row);

  return jsonOut_({ status: "ok", rows: rows });
}

function handleEdit_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const row = Number(data.row);
  if (!row || row < 2) return jsonOut_({ status: "error", message: "Nomor baris tidak valid." });

  // Cegah edit baris yang salah kalau data sudah berubah sejak terakhir di-refresh
  const currentTimestamp = formatTimestampCell_(sheet.getRange(row, 1).getValue());
  if (data.timestampCheck && currentTimestamp !== data.timestampCheck) {
    return jsonOut_({ status: "error", message: "Data baris ini sudah berubah. Refresh dulu sebelum edit." });
  }

  const keteranganRaw = (data.keterangan || "").toString().trim();
  const keterangan = keteranganRaw === "" ? "-" : keteranganRaw;

  sheet.getRange(row, 2).setValue(keterangan);
  sheet.getRange(row, 3).setValue(data.kategori || "");
  sheet.getRange(row, 4).setValue(data.belanjaDi || "");
  sheet.getRange(row, 5).setValue(Number(data.jumlah) || 0);

  return jsonOut_({ status: "ok" });
}

function handleDelete_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const row = Number(data.row);
  if (!row || row < 2) return jsonOut_({ status: "error", message: "Nomor baris tidak valid." });

  const currentTimestamp = formatTimestampCell_(sheet.getRange(row, 1).getValue());
  if (data.timestampCheck && currentTimestamp !== data.timestampCheck) {
    return jsonOut_({ status: "error", message: "Data baris ini sudah berubah. Refresh dulu sebelum hapus." });
  }

  sheet.deleteRow(row);
  return jsonOut_({ status: "ok" });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatTimestampCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
  }
  return value ? value.toString() : "";
}

// ==== Trigger onChange — dipasang sekali, lihat instruksi di atas ====
function onSheetChangeInstallable(e) {
  PropertiesService.getScriptProperties().setProperty(CHANGE_MARKER_KEY, new Date().getTime().toString());
}

function setupOnChangeTrigger() {
  // Hapus dulu kalau ada duplikat (jaga-jaga kalau fungsi ini dijalankan berkali-kali)
  const existing = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "onSheetChangeInstallable");
  existing.forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("onSheetChangeInstallable")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
}

