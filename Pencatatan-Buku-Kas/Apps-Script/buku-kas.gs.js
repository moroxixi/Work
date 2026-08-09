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

// ============================================================================
// ==== CHECK POLA TRANSAKSI HARIAN (ADDITIVE — tidak mengubah alur submit) ====
// ============================================================================
// Cek otomatis 2x sehari via time-based trigger:
//   - checkPolaPagi()  → 07:00, tanggalTarget = kemarin (H-1)
//   - checkPolaMalam() → 21:00, tanggalTarget = hari ini (H)
// Kalau ada transaksi yang biasanya rutin tapi belum tercatat di tanggalTarget,
// kirim SATU notif ntfy gabungan (topic khusus "buku-kas-checker", tidak
// dicampur dengan topic reminder manual "reminderme").
// Semua nama baru pakai prefix pola_/POLA_ supaya tidak bentrok dengan
// report.gs (satu project Apps Script berbagi global scope).

const POLA_NTFY_TOPIC = "buku-kas-checker";
const POLA_NTFY_URL = "https://ntfy.sh/" + POLA_NTFY_TOPIC;
const POLA_WINDOW_HARI = 14; // window 14 hari kalender ke belakang
const POLA_THRESHOLD = 0.5;  // muncul >= 50% hari window => pola rutin
// Kategori yang WAJIB ada di tanggalTarget (case-insensitive), TERLEPAS dari
// histori/threshold pola 14 hari. Tambah kategori baru di sini kalau mau dicek
// sebagai aturan tetap juga.
const POLA_KATEGORI_WAJIB = [
  "Tunjangan",
  "Setoran Cabang Babakan",
  "Setoran Cabang Depan RS"
];
// Versi ternormalisasi (trim+lowercase) — dihitung sekali supaya tidak
// normalize ulang tiap baris data.
const POLA_KATEGORI_WAJIB_NORM = POLA_KATEGORI_WAJIB.map(pola_normalize_);
// Kombinasi kategori+toko yang wajib dicek TIAP HARI, terpisah dari
// POLA_KATEGORI_WAJIB (yang cuma per-kategori tanpa peduli toko).
// Tambah baris baru di sini kalau ada toko/mitra lain yang mau dipantau serupa.
const POLA_KOMBINASI_WAJIB = [
  { kategori: "Belanja", belanjaDi: "Surya" }
];
const POLA_KOMBINASI_WAJIB_NORM = POLA_KOMBINASI_WAJIB.map(function(k) {
  return {
    key: pola_normalize_(k.kategori) + "|" + pola_normalize_(k.belanjaDi),
    kategori: k.kategori,
    belanjaDi: k.belanjaDi
  };
});
const POLA_DRY_RUN = false;  // notif dikirim langsung ke ntfy, bukan cuma di-log

const POLA_BULAN_ID = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
};

/**
 * Parse Timestamp sheet yang formatnya tidak konsisten.
 * Format yang didukung:
 *   1. "Kamis, 16 Juli 2026"          (nama hari opsional, bulan Indonesia)
 *   2. "29/07/2026 12:57:11"          (dd/MM/yyyy [HH:mm:ss])
 *   3. Date object langsung (hasil getValues() untuk cell berformat tanggal)
 * Return Date, atau null kalau tidak bisa di-parse.
 */
function pola_parseTanggal_(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const s = String(value || "").trim();
  if (!s) return null;

  // Format 2: "29/07/2026 12:57:11" (jam/menit opsional)
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10);
    const year = parseInt(m2[3], 10);
    if (!day || !month || !year) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // Anchor di UTC noon: hanya tanggal yang dipakai utk day key, jadi aman
    // dari pergeseran hari kalau timezone script bukan Asia/Jakarta.
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  // Format 1: "Kamis, 16 Juli 2026" atau "16 Juli 2026"
  const m1 = s.match(/^(?:[^,]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = POLA_BULAN_ID[m1[2].toLowerCase()];
    const year = parseInt(m1[3], 10);
    if (!day || !month || !year) return null;
    if (day < 1 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  return null;
}

/** Trim + lowercase untuk normalisasi key pola. */
function pola_normalize_(s) {
  return String(s || "").trim().toLowerCase();
}

/** Key hari "yyyy-MM-dd" (timezone Asia/Jakarta, konsisten dgn data sheet). */
function pola_dayKey_(date) {
  return Utilities.formatDate(date, "Asia/Jakarta", "yyyy-MM-dd");
}

/** Bangun Date dari dayKey "yyyy-MM-dd" (UTC noon, aman lintas timezone). */
function pola_dateFromDayKey_(dayKey) {
  const p = String(dayKey).split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12, 0, 0));
}

/**
 * FUNGSI INTI. Deteksi pola transaksi harian untuk tanggalTarget.
 * @param {Date|string} tanggalTarget Hari yang dicek.
 * @param {boolean} [DRY_RUN] true = cuma Logger.log, false = kirim notif asli.
 *   Default diambil dari POLA_DRY_RUN.
 */
function checkPolaTransaksi(tanggalTarget, DRY_RUN) {
  const dryRun = typeof DRY_RUN === "boolean" ? DRY_RUN : POLA_DRY_RUN;

  const targetDate = tanggalTarget instanceof Date ? tanggalTarget : pola_parseTanggal_(tanggalTarget);
  if (!targetDate || isNaN(targetDate.getTime())) {
    Logger.log("[Pola] tanggalTarget tidak valid: " + JSON.stringify(tanggalTarget));
    return { status: "error", message: "tanggalTarget tidak valid" };
  }
  const targetKey = pola_dayKey_(targetDate);

  // Window 14 hari kalender ke belakang (TIDAK termasuk tanggalTarget).
  // Hitung pakai ms UTC murni supaya tidak tergantung timezone runtime.
  const windowKeys = {};
  const base = pola_dateFromDayKey_(targetKey);
  for (let i = 1; i <= POLA_WINDOW_HARI; i++) {
    windowKeys[pola_dayKey_(new Date(base.getTime() - i * 86400000))] = true;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("[Pola] Sheet '" + SHEET_NAME + "' tidak ditemukan.");
    return { status: "error", message: "Sheet tidak ditemukan" };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("[Pola] Tidak ada data baris di sheet '" + SHEET_NAME + "'.");
    return { status: "ok", reminders: [] };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  // mapKey: key pola -> { kategori, belanjaDi, hariUnik: { dayKey: true } }
  const mapKey = {};
  const munculTarget = {};
  const wajibMunculTarget = {}; // normalized kategori wajib yang tercatat di tanggalTarget
  let gagalParse = 0;

  values.forEach(row => {
    const tgl = pola_parseTanggal_(row[0]);
    if (!tgl) { gagalParse++; return; } // timestamp tak dikenal -> dihitung & di-log di bawah
    const dayKey = pola_dayKey_(tgl);
    const kategori = String(row[2] || "");
    const belanjaDi = String(row[3] || "");
    const key = pola_normalize_(kategori) + "|" + pola_normalize_(belanjaDi);

    if (dayKey === targetKey) {
      munculTarget[key] = true;
      const katNorm = pola_normalize_(kategori);
      if (POLA_KATEGORI_WAJIB_NORM.indexOf(katNorm) !== -1) wajibMunculTarget[katNorm] = true;
      return;
    }
    if (!windowKeys[dayKey]) return;

    if (!mapKey[key]) {
      mapKey[key] = { kategori: kategori, belanjaDi: belanjaDi, hariUnik: {} };
    }
    mapKey[key].hariUnik[dayKey] = true;
  });

  // Pola rutin: jumlah HARI UNIK dalam window / 14 >= 0.5, lalu cek ada di target
  const reminders = [];
  Object.keys(mapKey).forEach(key => {
    const jumlahHari = Object.keys(mapKey[key].hariUnik).length;
    if (jumlahHari / POLA_WINDOW_HARI >= POLA_THRESHOLD && !munculTarget[key]) {
      reminders.push({
        kategori: mapKey[key].kategori,
        belanjaDi: mapKey[key].belanjaDi,
        hariMuncul: jumlahHari
      });
    }
  });

  // Aturan tetap: setiap kategori di POLA_KATEGORI_WAJIB (case-insensitive)
  // wajib ada di tanggalTarget, TERLEPAS dari histori/threshold pola 14 hari.
  POLA_KATEGORI_WAJIB.forEach((kategoriWajib, i) => {
    const katNorm = POLA_KATEGORI_WAJIB_NORM[i];
    if (wajibMunculTarget[katNorm]) return; // sudah tercatat di target
    const sudahDiReminder = reminders.some(r => pola_normalize_(r.kategori) === katNorm);
    if (sudahDiReminder) return; // sudah masuk lewat mekanisme pola rutin
    reminders.push({
      kategori: kategoriWajib,
      belanjaDi: "",
      hariMuncul: null,
      wajib: true
    });
  });

  // Wajib kombinasi kategori+toko (mis. Belanja Surya) — cek terpisah,
  // pakai key gabungan supaya toko lain di kategori "Belanja" tidak ikut wajib.
  POLA_KOMBINASI_WAJIB_NORM.forEach(k => {
    if (munculTarget[k.key]) return; // sudah tercatat di target
    const sudahDiReminder = reminders.some(r =>
      pola_normalize_(r.kategori) === pola_normalize_(k.kategori) &&
      pola_normalize_(r.belanjaDi || "") === pola_normalize_(k.belanjaDi)
    );
    if (sudahDiReminder) return;
    reminders.push({
      kategori: k.kategori,
      belanjaDi: k.belanjaDi,
      hariMuncul: null,
      wajib: true
    });
  });

  Logger.log("[Pola] " + targetKey + " | baris dibaca=" + values.length + " | tak-terparse=" + gagalParse + " | dryRun=" + dryRun);

  if (reminders.length === 0) {
    Logger.log("[Pola] " + targetKey + ": tidak ada reminder (semua pola rutin sudah tercatat).");
    return { status: "ok", target: targetKey, reminders: [], dryRun: dryRun };
  }

  const pesan = pola_buildPesan_(targetKey, reminders);
  if (dryRun) {
    Logger.log("[Pola][DRY_RUN] Deteksi selesai. Isi notif (TIDAK dikirim):\n" + pesan);
  } else {
    pola_kirimNotif_(pesan);
  }

  return { status: "ok", target: targetKey, reminders: reminders, dryRun: dryRun };
}

/** Bangun SATU pesan gabungan untuk semua reminder. */
function pola_buildPesan_(targetKey, reminders) {
  const lines = reminders.map((r, i) => {
    if (r.wajib) {
      const tempat = r.belanjaDi ? " (" + r.belanjaDi + ")" : "";
      return (i + 1) + ". " + r.kategori + tempat + " — wajib (aturan tetap)";
    }
    const tempat = r.belanjaDi ? " (" + r.belanjaDi + ")" : "";
    return (i + 1) + ". " + r.kategori + tempat + " — muncul " + r.hariMuncul +
      "/" + POLA_WINDOW_HARI + " hari terakhir, belum tercatat";
  });
  return "📋 Pola transaksi belum tercatat — " + targetKey + "\n" + lines.join("\n");
}

/** Kirim SATU notif ntfy (pola request sama dengan Reminder/script.js). */
function pola_kirimNotif_(pesan) {
  const MAX_ATTEMPT = 2;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
    try {
      const res = UrlFetchApp.fetch(POLA_NTFY_URL, {
        method: "post",
        payload: pesan,
        headers: { "Title": "Buku Kas — Pola Transaksi" },
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        Logger.log("[Pola] Notif terkirim (HTTP " + code + ") ke " + POLA_NTFY_URL + " (percobaan " + attempt + "/" + MAX_ATTEMPT + ")");
        return;
      }
      Logger.log("[Pola] Percobaan " + attempt + "/" + MAX_ATTEMPT + " gagal, HTTP " + code);
    } catch (err) {
      Logger.log("[Pola] Percobaan " + attempt + "/" + MAX_ATTEMPT + " error: " + err);
    }
    if (attempt < MAX_ATTEMPT) Utilities.sleep(RETRY_DELAY_MS);
  }
  Logger.log("[Pola] Gagal kirim notif ntfy setelah " + MAX_ATTEMPT + " percobaan.");
}

// ==== TRIGGER (dipasang otomatis 2x sehari) ====

/** Trigger pagi 07:00 — cek transaksi KEMARIN (H-1). */
function checkPolaPagi() {
  const d = pola_dateFromDayKey_(pola_dayKey_(new Date()));
  checkPolaTransaksi(new Date(d.getTime() - 86400000));
}

/** Trigger malam 21:00 — cek transaksi HARI INI (H). */
function checkPolaMalam() {
  checkPolaTransaksi(pola_dateFromDayKey_(pola_dayKey_(new Date())));
}

/**
 * Pasang 2 time-based trigger (07:00 & 21:00).
 * ⚠️ JANGAN dijalankan oleh AI — user harus jalankan manual 1x lewat editor
 * Apps Script (script.google.com) karena butuh otorisasi trigger.
 */
function setupTriggersPolaTransaksi() {
  pola_deleteTriggersByHandler_("checkPolaPagi");
  pola_deleteTriggersByHandler_("checkPolaMalam");

  ScriptApp.newTrigger("checkPolaPagi")
    .timeBased()
    .atHour(7)
    .nearMinute(0)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger("checkPolaMalam")
    .timeBased()
    .atHour(21)
    .nearMinute(0)
    .everyDays(1)
    .create();

  Logger.log("[Pola] Trigger terpasang: checkPolaPagi (07:00) & checkPolaMalam (21:00).");
}

function pola_deleteTriggersByHandler_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}
