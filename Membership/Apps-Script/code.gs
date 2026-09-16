/**
 * MAO Membership — Google Apps Script Backend
 *
 * Deploy as Web App dengan doPost & doGet.
 * Jalankan setupSheetHeaders() sekali manual lewat editor untuk menulis header.
 */

// ─── KONFIGURASI ────────────────────────────────────────────────────────────
var SHEET_ID = "17s9Y-lL07n-mN0fWmezQvVqMIcY8MaqjpESx_x6TcFA";

// Urutan kolom FINAL — dipakai bersama oleh setupSheetHeaders() DAN doPost()
var COLUMNS = [
  "Timestamp",
  "Kode Membership",
  "Nama",
  "Domisili",
  "Tanggal Lahir",
  "Umur",
  "Jenis Kelamin",
  "Status",
  "Nomor WhatsApp"
];

// Charset untuk kode unik (hindari karakter ambigu: 0/O/1/I)
var CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ─── SETUP HEADER ───────────────────────────────────────────────────────────

/**
 * Jalankan MANUAL sekali dari editor Apps Script untuk menulis header.
 * Cek dulu apakah baris 1 sudah ada isi — kalau sudah, skip & log peringatan.
 */
function setupSheetHeaders() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var firstRow = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];

  // Defensive check: kalau semua sel di baris 1 kosong, lanjut tulis
  var hasContent = firstRow.some(function (cell) {
    return cell !== "" && cell !== null && cell !== undefined;
  });

  if (hasContent) {
    Logger.log(
      "⚠️ Baris 1 sudah ada isi. Header TIDAK ditulis ulang. Data existing: " +
        JSON.stringify(firstRow)
    );
    return;
  }

  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  Logger.log("✅ Header berhasil ditulis: " + COLUMNS.join(", "));
}

// ─── GENERATE KODE UNIK ─────────────────────────────────────────────────────

/**
 * Generate kode membership unik: "MAO-" + 6 karakter dari CHARSET.
 * Cek uniqueness terhadap kolom "Kode Membership" yang sudah ada.
 * Retry maksimal 10 kali; kalau tetap gagal, lempar error.
 */
function generateKodeMembership_(sheet) {
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1; // 1-indexed
  var lastRow = sheet.getLastRow();

  // Ambil semua kode yang sudah ada (kolom B dari baris 2 ke bawah)
  var existingCodes = [];
  if (lastRow >= 2) {
    existingCodes = sheet
      .getRange(2, kodeCol, lastRow - 1, 1)
      .getValues()
      .map(function (r) {
        return String(r[0]).trim();
      })
      .filter(function (v) {
        return v !== "";
      });
  }

  var MAX_RETRY = 10;

  for (var attempt = 0; attempt < MAX_RETRY; attempt++) {
    var code = "MAO-";
    for (var i = 0; i < 6; i++) {
      code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }

    if (existingCodes.indexOf(code) === -1) {
      return code; // unik
    }
    Logger.log("⚠️ Collision attempt " + (attempt + 1) + ": " + code + ", regenerate...");
  }

  throw new Error(
    "Gagal generate kode unik setelah " + MAX_RETRY + " percobaan. " +
    "Kemungkinan sangat kecil — cek sheet secara manual."
  );
}

// ─── HITUNG UMUR ────────────────────────────────────────────────────────────

/**
 * Hitung umur dalam tahun penuh dari tanggal lahir ke tanggal hari ini (server-side).
 * @param {string} tanggalLahirString - format "YYYY-MM-DD" dari input type="date"
 * @returns {number} umur dalam tahun penuh
 */
function hitungUmur_(tanggalLahirString) {
  var parts = String(tanggalLahirString).split("-");
  var tglLahir = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
  var today = new Date();
  var umur = today.getFullYear() - tglLahir.getFullYear();

  // Kurangi 1 kalau belum lewat ulang tahun tahun ini
  var bulanHari = today.getMonth() * 100 + today.getDate();
  var bulanLahir = tglLahir.getMonth() * 100 + tglLahir.getDate();
  if (bulanHari < bulanLahir) {
    umur--;
  }

  return umur;
}

// ─── doPost ─────────────────────────────────────────────────────────────────

function doPost(e) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

  // Ambil parameter (URLSearchParams → e.parameter)
  var nama = trim_(e.parameter.Nama);
  var domisili = trim_(e.parameter.Domisili);
  var tanggalLahir = trim_(e.parameter.TanggalLahir);
  var jenisKelamin = trim_(e.parameter.JenisKelamin);
  var status = trim_(e.parameter.Status);
  var nomorWhatsApp = trim_(e.parameter.NomorWhatsApp);

  // Validasi semua field required
  var errors = [];
  if (!nama) errors.push("Nama wajib diisi");
  if (!domisili) errors.push("Domisili wajib diisi");
  if (!tanggalLahir) errors.push("Tanggal Lahir wajib diisi");
  if (!jenisKelamin) errors.push("Jenis Kelamin wajib diisi");
  if (!status) errors.push("Status wajib diisi");
  if (!nomorWhatsApp) errors.push("Nomor WhatsApp wajib diisi");

  if (errors.length > 0) {
    return json_({
      success: false,
      error: "Field tidak lengkap: " + errors.join("; ")
    });
  }

  // Generate kode unik
  var kodeMembership = generateKodeMembership_(sheet);

  // Hitung umur server-side (single source of truth)
  var umur = hitungUmur_(tanggalLahir);

  // Timestamp
  var timestamp = new Date();

  // Susun baris sesuai urutan COLUMNS
  var row = [
    timestamp,         // Timestamp
    kodeMembership,    // Kode Membership
    nama,              // Nama
    domisili,          // Domisili
    tanggalLahir,      // Tanggal Lahir
    umur,              // Umur (dihitung server-side)
    jenisKelamin,      // Jenis Kelamin
    status,            // Status
    nomorWhatsApp      // Nomor WhatsApp
  ];

  sheet.appendRow(row);
  Logger.log("✅ Pendaftaran baru: " + nama + " → " + kodeMembership);

  return json_({
    success: true,
    kodeMembership: kodeMembership,
    nama: nama
  });
}

// ─── doGet ──────────────────────────────────────────────────────────────────

function doGet(e) {
  return json_({ status: "MAO Membership API OK" });
}

// ─── HELPER ─────────────────────────────────────────────────────────────────

function trim_(val) {
  return String(val || "").trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
