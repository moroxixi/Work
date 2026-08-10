/**
 * ============================================================
 *  CONFIG Report
 * ============================================================
 */
const SPREADSHEET_ID = "1eGJG0wxFsSMCFdTz87qHzaikrS8uT3PEpi9ECdJEPaI";
const BUKU_KAS_SPREADSHEET_ID = "15MZYZOhqY2dTGBeZoAe1yqwJWTh43e9qPdgotM4DuCM";
const BUKU_KAS_SHEET_NAME = "Input";

const ITEMS_TEMPURA = [
  "Scallop", "Tempura", "Sukoi", "Bintang", "Basreng", "Otak", "NagetOren", "Sosis",
  "Cireng", "Puyam", "Chelsy", "TahuBulat", "Dimsum", "Kornet", "NagetAyam", "BasoSapi",
  "Wonton", "Fishroll", "Bolado", "Kentang"
];
const SHEET_NAME_TEMPURA = "Input_Tempura";
const SHEET_GID_TEMPURA = "60039558";

const ITEMS_WONTON = [
  "Wonton", "WontonLebih", "Mie", "Creamy", "Cirawang", "Baso", "Pilus", "Balungan"
];
const SHEET_NAME_WONTON = "Input_Wonton";
const SHEET_GID_WONTON = "76341395";

const CHECK_STATUS_COL_NAME = "Check_Status";
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 jam — dipakai submission-time guard & checker berkala

// Notifikasi ntfy — channel baru pengganti channel notifikasi chat lama (topic khusus "report-checker").
const REPORT_NTFY_TOPIC = "report-checker";
const REPORT_NTFY_URL = "https://ntfy.sh/" + REPORT_NTFY_TOPIC;

// ============ BAGIAN A — konstanta (taruh di area CONFIG) ============
// Token proteksi endpoint totalHarian.
// Ganti <TOKEN_DI_SINI> dengan nilai WEBAPP_TOKEN dari config.local.env
// (file itu TIDAK di-commit — isi token-nya tidak boleh ditulis di sini).
// Wajib SAMA PERSIS dengan WEBAPP_TOKEN di Work/Script/config.local.env.
const TOTAL_HARIAN_TOKEN = "zpfadasXcgUdqMxz_rmMGNg5NVri61gN";

/**
 * ============================================================
 *  ENTRY POINT — POST dari form (Tempura / Wonton)
 * ============================================================
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.tipe === "Tempura") {
      simpanDataTempura(data);
    } else if (data.tipe === "Wonton") {
      simpanDataWonton(data);
    } else {
      return responseJSON({ status: "error", message: "Tipe data '" + data.tipe + "' belum didukung." });
    }

    return responseJSON({ status: "success" });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function doGet(e) {
  const params = e.parameter || {};

  if (params.action === "stok") {
    return handleStok_(params.tanggal, params.cabang);
  }

  if (params.action === "totalHarian") {
    return handleTotalHarian_(params.token);
  }

  return ContentService
    .createTextOutput("Form endpoint aktif (Tempura & Wonton). Kirim data lewat POST dari form HTML.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/* ============================================================
 *  TEMPURA
 * ============================================================ */

function simpanDataTempura(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_TEMPURA);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_TEMPURA);
    sheet.appendRow(buildHeaderTempura());
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold");
  }

  const row = buildRowTempura(data);
  const guard = checkSubmissionAgainstSheet_(sheet, row);

  if (guard && guard.type === "Duplikat") {
    Logger.log("Duplikat Tempura diblokir: " + JSON.stringify(data));
    report_kirimNotif_("🚫 Submission duplikat Tempura diblokir (cabang: " + (data.cabang || "-") + "). Data TIDAK disimpan. Baris pembanding: " + guard.rowNum + ".", "Buku Kas — Duplikat Tempura");
    return; // blokir total: tidak appendRow, tidak kirim ke Buku Kas
  }

  sheet.appendRow(row);

  if (guard && guard.type === "Anomali") {
    flagAnomaliRow_(sheet, guard, SHEET_NAME_TEMPURA, SHEET_GID_TEMPURA, data.cabang);
  }

  kirimSetoranTempuraKeBukuKas(data);
}

function buildHeaderTempura() {
  const header = ["Timestamp", "Cabang"];

  ITEMS_TEMPURA.forEach(item => {
    header.push(item + " (Sisa)");
    header.push(item + " (Laku)");
  });

  header.push(
    "QRIS", "Gaji", "Pengeluaran", "Uang Modal", "Sterofoam",
    "Omset Kotor", "Wajib Setor", "Uang Tunai", "Selisih", "Status",
    CHECK_STATUS_COL_NAME
  );

  return header;
}

function buildRowTempura(data) {
  const row = [new Date(), data.cabang || ""];

  ITEMS_TEMPURA.forEach(item => {
    const key = item.toLowerCase().replace(/\s/g, "");
    row.push(Number(data[`s_${key}`]) || 0); // Sisa
    row.push(Number(data[`t_${key}`]) || 0); // Laku
  });

  row.push(
    Number(data.qris) || 0,
    Number(data.gaji) || 0,
    Number(data.pengeluaran) || 0,
    Number(data.uModal) || 0,
    Number(data.sterofoam) || 0,
    Number(data.omsetTempura) || 0,
    Number(data.wajibSetor) || 0,
    Number(data.uTunai) || 0,
    Number(data.selisih) || 0,
    data.status || "",
    "" // Check_Status kosong, diisi otomatis
  );

  return row;
}

/* ============================================================
 *  WONTON & MIE JEBEW
 * ============================================================ */

function simpanDataWonton(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_WONTON);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_WONTON);
    sheet.appendRow(buildHeaderWonton());
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold");
  }

  const row = buildRowWonton(data);
  const guard = checkSubmissionAgainstSheet_(sheet, row);

  if (guard && guard.type === "Duplikat") {
    Logger.log("Duplikat Wonton diblokir: " + JSON.stringify(data));
    report_kirimNotif_("🚫 Submission duplikat Wonton diblokir (cabang: " + (data.cabang || "-") + "). Data TIDAK disimpan. Baris pembanding: " + guard.rowNum + ".", "Buku Kas — Duplikat Wonton");
    return;
  }

  sheet.appendRow(row);

  if (guard && guard.type === "Anomali") {
    flagAnomaliRow_(sheet, guard, SHEET_NAME_WONTON, SHEET_GID_WONTON, data.cabang);
  }

  kirimSetoranWontonKeBukuKas(data);
}

function buildHeaderWonton() {
  const header = ["Timestamp", "Cabang"];

  ITEMS_WONTON.forEach(item => {
    header.push(item + " (Sisa)");
    header.push(item + " (Laku)");
  });

  header.push(
    "QRIS", "Gofood", "Gaji", "Pengeluaran", "Uang Jajan", "Dimakan",
    "Uang Modal", "Omset Kotor", "Wajib Setor", "Uang Tunai", "Selisih", "Status",
    CHECK_STATUS_COL_NAME
  );

  return header;
}

function buildRowWonton(data) {
  const row = [new Date(), data.cabang || ""];

  ITEMS_WONTON.forEach(item => {
    const key = item.toLowerCase().replace(/\s/g, "");
    row.push(Number(data[`sw_${key}`]) || 0); // Sisa
    row.push(Number(data[`w_${key}`]) || 0);  // Laku
  });

  row.push(
    Number(data.qris) || 0,
    Number(data.gofood) || 0,
    Number(data.gaji) || 0,
    Number(data.pengeluaran) || 0,
    Number(data.uangJajan) || 0,
    Number(data.dimakan) || 0,
    Number(data.uModal) || 0,
    Number(data.omsetWonton) || 0,
    Number(data.wajibSetor) || 0,
    Number(data.uTunai) || 0,
    Number(data.selisih) || 0,
    data.status || "",
    "" // Check_Status kosong
  );

  return row;
}

/**
 * ============================================================
 *  KIRIM OTOMATIS KE BUKU KAS GABUNGAN
 * ============================================================
 */

function kirimSetoranTempuraKeBukuKas(data) {
  const ts = formatTimestampWIB(new Date());
  const cabang = data.cabang || "Tempura";
  const rows = [];

  const omset = Number(data.omsetTempura) || 0;
  if (omset > 0) {
    rows.push([ts, "Setoran harian - " + cabang, "Setoran Cabang Tempura", "", omset]);
  }

  const sterofoam = Number(data.sterofoam) || 0;
  if (sterofoam > 0) {
    rows.push([ts, "Sterofoam - " + cabang, "Sterofoam Tempura", "", sterofoam]);
  }

  const gaji = Number(data.gaji) || 0;
  if (gaji > 0) {
    rows.push([ts, "Gaji harian - " + cabang, "Gaji/Upah", "", gaji]);
  }

  const pengeluaran = Number(data.pengeluaran) || 0;
  if (pengeluaran > 0) {
    rows.push([ts, "Pengeluaran harian - " + cabang, "Pengeluaran Operasional", "", pengeluaran]);
  }

  kirimKeBukuKas(rows);
}

function kirimSetoranWontonKeBukuKas(data) {
  const ts = formatTimestampWIB(new Date());
  const cabang = data.cabang || "";
  const kategoriMasuk = kategoriSetoranWonton(cabang);
  const rows = [];
  const hurufPertama = (cabang || "").trim().charAt(0).toUpperCase();

  // Cabang R (Depan RS) tidak punya data omset barang — pakai selisih (uang tunai) sebagai nilai setoran
  const nilaiSetoran = hurufPertama === "R"
    ? (Number(data.selisih) || 0)
    : (Number(data.omsetWonton) || 0);

  if (kategoriMasuk) {
    if (nilaiSetoran > 0) {
      rows.push([ts, "Setoran harian - " + cabang, kategoriMasuk, "", nilaiSetoran]);
    }
  } else if (nilaiSetoran > 0) {
    report_kirimNotif_(
      "⚠️ Cabang '" + cabang + "' tidak dikenali sistem (bukan Babakan/Leweung Gajah/Depan RS).\n" +
      "Nilai Rp" + nilaiSetoran.toLocaleString("id-ID") + " TIDAK otomatis masuk Buku Kas.\n" +
      "Mohon input manual kategori Penjualan-nya.",
      "Buku Kas — Cabang Tidak Dikenali"
    );
  }

  const gaji = Number(data.gaji) || 0;
  if (gaji > 0) {
    rows.push([ts, "Gaji harian - " + cabang, "Gaji/Upah", "", gaji]);
  }

  const pengeluaran = Number(data.pengeluaran) || 0;
  if (pengeluaran > 0) {
    rows.push([ts, "Pengeluaran harian - " + cabang, "Pengeluaran Operasional", "", pengeluaran]);
  }

  const uangJajan = Number(data.uangJajan) || 0;
  if (uangJajan > 0) {
    rows.push([ts, "Uang jajan karyawan - " + cabang, "Uang Jajan Karyawan", "", uangJajan]);
  }

  kirimKeBukuKas(rows);
}

function kategoriSetoranWonton(cabang) {
  const huruf = (cabang || "").trim().charAt(0).toUpperCase();
  if (huruf === "B") return "Setoran Cabang Babakan";
  if (huruf === "L") return "Setoran Cabang Leweung Gajah";
  if (huruf === "R") return "Setoran Cabang Depan RS";
  return null;
}

function kirimKeBukuKas(rows) {
  if (!rows || rows.length === 0) return;
  try {
    const ss = SpreadsheetApp.openById(BUKU_KAS_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(BUKU_KAS_SHEET_NAME);
    if (!sheet) {
      Logger.log("Sheet '" + BUKU_KAS_SHEET_NAME + "' tidak ditemukan di Buku Kas Gabungan.");
      return;
    }
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 5).setValues(rows);
  } catch (err) {
    Logger.log("Gagal kirim ke Buku Kas Gabungan: " + err);
    report_kirimNotif_("⚠️ Gagal kirim data setoran ke Buku Kas Gabungan: " + err, "Buku Kas — Gagal Kirim");
  }
}

function formatTimestampWIB(date) {
  return Utilities.formatDate(date, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
}

/**
 * ============================================================
 *  DETEKSI DUPLIKAT / ANOMALI — LOGIKA TUNGGAL (dipakai submit + checker)
 * ============================================================
 */

/**
 * Cari baris lain yang cocok cabang+hari, dalam jarak waktu windowMs dari targetRow.
 * existingRows = array baris data (tanpa header), targetRow ada di dalamnya di index
 * `selfIndex`, ATAU targetRow belum ada di dalamnya sama sekali -> pakai selfIndex = -1
 * (kasus submission-time, sebelum appendRow).
 * Return null kalau tidak ada yang cocok, atau { rowNum, type: "Duplikat"|"Anomali" }.
 */
function findDuplicateOrAnomaly_(header, targetRow, existingRows, selfIndex, tsCol, cabangCol, statusCol, windowMs) {
  const tz = Session.getScriptTimeZone();
  const targetTs = new Date(targetRow[tsCol]);
  if (!(targetTs instanceof Date) || isNaN(targetTs)) return null;
  const targetDayKey = Utilities.formatDate(targetTs, tz, "yyyy-MM-dd");
  const targetCabang = targetRow[cabangCol];

  for (let j = 0; j < existingRows.length; j++) {
    if (j === selfIndex) continue;
    const other = existingRows[j];
    const otherTs = new Date(other[tsCol]);
    if (!(otherTs instanceof Date) || isNaN(otherTs)) continue;

    const otherDayKey = Utilities.formatDate(otherTs, tz, "yyyy-MM-dd");
    if (otherDayKey !== targetDayKey) continue;
    if (other[cabangCol] !== targetCabang) continue;

    const diffMs = Math.abs(targetTs.getTime() - otherTs.getTime());
    if (diffMs > windowMs) continue;

    let allSame = true;
    for (let c = 0; c < header.length; c++) {
      if (c === tsCol || c === statusCol) continue;
      if (String(other[c]) !== String(targetRow[c])) { allSame = false; break; }
    }

    return { rowNum: j + 2, type: allSame ? "Duplikat" : "Anomali" };
  }
  return null;
}

/** Dipanggil saat submit (sebelum appendRow) — cek newRow terhadap semua baris yang sudah ada. */
function checkSubmissionAgainstSheet_(sheet, newRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tsCol = header.indexOf("Timestamp");
  const cabangCol = header.indexOf("Cabang");
  const statusCol = header.indexOf(CHECK_STATUS_COL_NAME);

  const existingRows = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();
  return findDuplicateOrAnomaly_(header, newRow, existingRows, -1, tsCol, cabangCol, statusCol, DUPLICATE_WINDOW_MS);
}

/** Tandai Check_Status = "Anomali" di baris baru & baris pembanding, lalu kirim alert. */
function flagAnomaliRow_(sheet, guard, sheetName, gid, cabang) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = header.indexOf(CHECK_STATUS_COL_NAME);
  const newRowNum = sheet.getLastRow();

  sheet.getRange(newRowNum, statusCol + 1).setValue("Anomali");
  sheet.getRange(guard.rowNum, statusCol + 1).setValue("Anomali");

  const link = buildRowLink(gid, newRowNum);
  const msg =
    `⚠️ Anomali terdeteksi!\n` +
    `Sheet: ${sheetName}\n` +
    `Baris baru: ${newRowNum} (Cabang: ${cabang || "-"})\n` +
    `Dibandingkan dengan baris: ${guard.rowNum}\n` +
    `Link: ${link}`;
  report_kirimNotif_(msg, "Buku Kas — Anomali");
}

function buildRowLink(gid, rowNum) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${gid}&range=A${rowNum}`;
}

/**
 * ============================================================
 *  CHECKER BERKALA — jaring pengaman tambahan (30 menit sekali)
 *  Sekarang pakai findDuplicateOrAnomaly_ yang sama, bukan loop sendiri.
 *  Kebanyakan Duplikat sudah diblokir saat submit; ini terutama
 *  menangkap Anomali & kasus race-condition langka.
 * ============================================================
 */
function checkDuplicatesAnomalies() {
  checkDuplicatesAnomaliesForSheet(SHEET_NAME_TEMPURA, SHEET_GID_TEMPURA);
  checkDuplicatesAnomaliesForSheet(SHEET_NAME_WONTON, SHEET_GID_WONTON);
}

function checkDuplicatesAnomaliesForSheet(sheetName, gid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tsCol = header.indexOf("Timestamp");
  const cabangCol = header.indexOf("Cabang");
  let statusCol = header.indexOf(CHECK_STATUS_COL_NAME);

  if (statusCol === -1) {
    statusCol = header.length;
    sheet.getRange(1, statusCol + 1).setValue(CHECK_STATUS_COL_NAME);
    header.push(CHECK_STATUS_COL_NAME);
  }

  const values = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - DUPLICATE_WINDOW_MS);

  values.forEach((row, idx) => {
    if (row[statusCol]) return; // sudah pernah diproses

    const ts = new Date(row[tsCol]);
    if (!(ts instanceof Date) || isNaN(ts)) return;
    if (ts < oneHourAgo) return;

    const rowNum = idx + 2;
    const match = findDuplicateOrAnomaly_(header, row, values, idx, tsCol, cabangCol, statusCol, DUPLICATE_WINDOW_MS);

    if (match) {
      const link = buildRowLink(gid, rowNum);
      const msg =
        `⚠️ ${match.type} terdeteksi!\n` +
        `Sheet: ${sheetName}\n` +
        `Baris: ${rowNum} (Cabang: ${row[cabangCol] || "-"})\n` +
        `Dibandingkan dengan baris: ${match.rowNum}\n` +
        `Link: ${link}`;
      report_kirimNotif_(msg, "Buku Kas — " + match.type);
      sheet.getRange(rowNum, statusCol + 1).setValue(match.type);
    } else {
      sheet.getRange(rowNum, statusCol + 1).setValue("OK");
    }
  });
}

/**
 * ============================================================
 *  MISSING DAILY REPORT CHECKER
 * ============================================================
 */
function checkMissingReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  const reported = { P: false, L: false, B: false, R: false };
  const emptyCabangAlerts = [];

  const tempuraSheet = ss.getSheetByName(SHEET_NAME_TEMPURA);
  if (tempuraSheet) {
    scanSheetForReports(tempuraSheet, today, tz, reported, emptyCabangAlerts, ["P"]);
  }

  const wontonSheet = ss.getSheetByName(SHEET_NAME_WONTON);
  if (wontonSheet) {
    scanSheetForReports(wontonSheet, today, tz, reported, emptyCabangAlerts, ["L", "B", "R"]);
  }

  emptyCabangAlerts.forEach(msg => report_kirimNotif_(msg, "Buku Kas — Cabang Tanpa Nama"));

  const namaCabang = { P: "Tempura (Pabuaran)", L: "Leweung Gajah", B: "Babakan", R: "Depan RS (eksternal)" };
  const missing = Object.keys(reported).filter(k => !reported[k]);

  if (missing.length > 0) {
    const list = missing.map(k => `- ${namaCabang[k]}`).join("\n");
    const jamSekarang = Utilities.formatDate(new Date(), tz, "HH:mm");
    report_kirimNotif_(`🔔 Cabang belum lapor hari ini (cek jam ${jamSekarang}):\n${list}`, "Buku Kas — Cabang Belum Lapor");
  }
}

function scanSheetForReports(sheet, todayStr, tz, reported, emptyCabangAlerts, prefixes) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const header = data[0];
  const tsCol = header.indexOf("Timestamp");
  const cabangCol = header.indexOf("Cabang");

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ts = new Date(row[tsCol]);
    if (!(ts instanceof Date) || isNaN(ts)) continue;

    const dayStr = Utilities.formatDate(ts, tz, "yyyy-MM-dd");
    if (dayStr !== todayStr) continue;

    const cabang = (row[cabangCol] || "").toString().trim();
    if (!cabang) {
      emptyCabangAlerts.push(`⚠️ Cabang belum dicantumkan namanya (baris ${i + 1}, sheet ${sheet.getName()})`);
      continue;
    }

    const huruf = cabang.charAt(0).toUpperCase();
    if (prefixes.includes(huruf)) {
      reported[huruf] = true;
    }
  }
}

/**
 * ============================================================
 *  HALAMAN STOK — data Sisa & Laku per cabang per tanggal
 * ============================================================
 */
function handleStok_(tanggalStr, cabangKode) {
  if (!tanggalStr || !cabangKode) {
    return responseJSON({ status: "error", message: "Parameter tanggal & cabang wajib diisi." });
  }

  const isTempura = cabangKode === "P";
  const sheetName = isTempura ? SHEET_NAME_TEMPURA : SHEET_NAME_WONTON;
  const items = isTempura ? ITEMS_TEMPURA : ITEMS_WONTON;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return responseJSON({ status: "ok", found: false, items: [] });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return responseJSON({ status: "ok", found: false, items: [] });

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tsCol = header.indexOf("Timestamp");
  const cabangCol = header.indexOf("Cabang");

  const values = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  let found = null;

  // Scan dari baris paling bawah (paling baru) ke atas, ambil kecocokan pertama.
  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const ts = new Date(row[tsCol]);
    if (!(ts instanceof Date) || isNaN(ts)) continue;

    const tsStr = Utilities.formatDate(ts, "Asia/Jakarta", "dd/MM/yyyy");
    if (tsStr !== tanggalStr) continue;

    if (!isTempura) {
      const huruf = (row[cabangCol] || "").toString().trim().charAt(0).toUpperCase();
      if (huruf !== cabangKode) continue;
    }

    found = row;
    break;
  }

  if (!found) return responseJSON({ status: "ok", found: false, items: [] });

  const itemsResult = items.map(item => {
    const sisaCol = header.indexOf(item + " (Sisa)");
    const lakuCol = header.indexOf(item + " (Laku)");
    return {
      nama: item,
      sisa: Number(found[sisaCol]) || 0,
      laku: Number(found[lakuCol]) || 0
    };
  });

  return responseJSON({
    status: "ok",
    found: true,
    timestamp: formatTimestampWIB(new Date(found[tsCol])),
    cabang: found[cabangCol],
    items: itemsResult
  });
}

/**
 * Handle action "totalHarian" — expose kolom A (Tanggal), Z (Bbkn), AB (Total)
 * dari sheet "Report 2026" untuk baris TANGGAL HARI INI, untuk poller Python
 * eksternal. Diproteksi token sederhana.
 *
 * Catatan penting:
 * - Pakai ulang constant SPREADSHEET_ID yang SAMA dengan sheet
 *   Input_Tempura/Input_Wonton — sheet "Report 2026" adalah tab di spreadsheet
 *   yang sama. JANGAN ketik ulang ID dari mana pun (hindari typo I/l).
 */
function handleTotalHarian_(token) {
  // Validasi token
  if (token !== TOTAL_HARIAN_TOKEN) {
    return responseJSON({ ok: false, error: "unauthorized" });
  }

  // Buka spreadsheet pakai constant yang sama persis dengan fungsi lain
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Cari sheet "Report 2026"; fallback cari by gid 794081767 kalau nama beda
  let sheet = ss.getSheetByName("Report 2026");
  if (!sheet) {
    sheet = ss.getSheets().find(s => s.getSheetId() === 794081767);
  }
  if (!sheet) {
    // TODO(Rofi): verifikasi nama tab/gid sebenarnya setelah paste
    return responseJSON({ ok: false, error: "sheet 'Report 2026' tidak ditemukan" });
  }

  const tz = "Asia/Jakarta";
  const todayKey = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return responseJSON({ ok: false, error: "baris tanggal hari ini belum ada di sheet" });
  }

  // Baca kolom A..AB (28 kolom) semua baris mulai row 2. Row 2 = HEADER
  // (dikonfirmasi: Y="LW", Z="Bbkn", AA="Pabuaran", AB="Total"), data mulai row 3.
  // Kolom Z TIDAK dipakai index tetap (row[25]) — dicari DINAMIS lewat teks header
  // yang diawali huruf "B" (case-insensitive), pola sama dengan LEFT(text,1)="B"
  // di formula spreadsheet. Robust terhadap kolom yang pernah/disisipkan ke depan.
  const values = sheet.getRange(2, 1, lastRow - 1, 28).getValues();
  const headerRow = values[0]; // row 2 = header

  // Lookup kolom Z (Bbkn): cari header yang diawali "B". Ambigu / tidak ketemu
  // -> jangan diam-diam pilih salah satu; kolomZ null + columnLookupError eksplisit.
  const startsWithB = [];
  for (let c = 0; c < headerRow.length; c++) {
    const label = String(headerRow[c] || "").trim();
    if (label && label.charAt(0).toLowerCase() === "b") {
      startsWithB.push({ col: c, label: label });
    }
  }

  let kolomZIndex = -1;
  let columnLookupError = null;
  if (startsWithB.length === 0) {
    columnLookupError = "Not found: no column starts with B";
  } else if (startsWithB.length > 1) {
    columnLookupError = "Ambiguous: " + startsWithB.length + " columns start with B (" +
      startsWithB.map(m => "\"" + m.label + "\"").join(", ") + ")";
  } else {
    kolomZIndex = startsWithB[0].col;
  }

  // Data mulai index 1 (row 3) — index 0 (row 2) adalah header.
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cellA = row[0];

    // Cari baris dengan kolom A = tanggal hari ini.
    // 2 kemungkinan tipe kolom A:
    //   (a) Date object asli -> format langsung
    //   (b) string terformat Indonesia (mis. "09/08/2026 ...") -> fallback regex
    // TODO(Rofi): verifikasi tipe data kolom A asli setelah paste, sesuaikan kalau perlu
    let rowKey = null;
    if (cellA instanceof Date && !isNaN(cellA.getTime())) {
      rowKey = Utilities.formatDate(cellA, tz, "dd/MM/yyyy");
    } else {
      const m = String(cellA || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      // Zero-pad supaya cocok dengan todayKey "dd/MM/yyyy" (formatDate)
      if (m) rowKey = m[1].padStart(2, "0") + "/" + m[2].padStart(2, "0") + "/" + m[3];
    }
    if (rowKey !== todayKey) continue;

    const rowNumber = i + 2; // baris asli di sheet (header = baris 2, data mulai baris 3)

    // Kolom Z (Bbkn) diambil dari index hasil lookup header (kolomZIndex); kalau lookup
    // gagal (ambigu / tidak ketemu) kolomZ selalu null + columnLookupError disertakan.
    const kolomZ = (kolomZIndex >= 0 && row[kolomZIndex] !== "" && row[kolomZIndex] !== null && row[kolomZIndex] !== undefined)
      ? row[kolomZIndex] : null;
    // Kolom AB (Total) — tetap index tetap, null kalau kosong, selain itu value apa adanya
    const kolomAB = (row[27] !== "" && row[27] !== null && row[27] !== undefined) ? row[27] : null;

    const link = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID +
      "/edit?gid=794081767&range=A" + rowNumber;

    const out = {
      ok: true,
      tanggal: todayKey,
      kolomZ: kolomZ,
      total: kolomAB,
      rowNumber: rowNumber,
      link: link
    };
    if (columnLookupError !== null) {
      out.columnLookupError = columnLookupError;
    }
    return responseJSON(out);
  }

  return responseJSON({ ok: false, error: "baris tanggal hari ini belum ada di sheet" });
}

/**
 * ============================================================
 *  NOTIFIKASI NTFY — pengganti channel notifikasi chat lama (topic "report-checker")
 *  Pola request persis meniru pola_kirimNotif_() di buku-kas.gs.
 * ============================================================
 */
function report_kirimNotif_(pesan, judul) {
  const MAX_ATTEMPT = 2;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
    try {
      const res = UrlFetchApp.fetch(REPORT_NTFY_URL, {
        method: "post",
        payload: pesan,
        headers: { "Title": judul || "Report Checker" },
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        Logger.log("[Report] Notif terkirim (HTTP " + code + ") ke " + REPORT_NTFY_URL + " (percobaan " + attempt + "/" + MAX_ATTEMPT + ")");
        return;
      }
      Logger.log("[Report] Percobaan " + attempt + "/" + MAX_ATTEMPT + " gagal, HTTP " + code);
    } catch (err) {
      Logger.log("[Report] Percobaan " + attempt + "/" + MAX_ATTEMPT + " error: " + err);
    }
    if (attempt < MAX_ATTEMPT) Utilities.sleep(RETRY_DELAY_MS);
  }
  Logger.log("[Report] Gagal kirim notif ntfy setelah " + MAX_ATTEMPT + " percobaan.");
}

/**
 * ============================================================
 *  SETUP TRIGGERS — jalankan MANUAL 1x lewat editor Apps Script
 * ============================================================
 */
function setupTriggers() {
  deleteTriggersByHandler("checkDuplicatesAnomalies");
  deleteTriggersByHandler("checkMissingReports");

  ScriptApp.newTrigger("checkDuplicatesAnomalies")
    .timeBased()
    .everyMinutes(30)
    .create();

  ScriptApp.newTrigger("checkMissingReports")
    .timeBased()
    .atHour(22)
    .nearMinute(30)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger("checkMissingReports")
    .timeBased()
    .atHour(23)
    .nearMinute(59)
    .everyDays(1)
    .create();

  Logger.log("Trigger berhasil dipasang.");
}

function deleteTriggersByHandler(handlerName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

