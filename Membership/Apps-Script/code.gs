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

// Header untuk tab "Daftar Menu"
var COLUMNS_DAFTAR_MENU = ["Nama Menu"];

// Header untuk tab "Submit Pesanan"
var COLUMNS_SUBMIT_PESANAN = [
  "Timestamp",
  "Kode Membership",
  "Nama Menu",
  "Qty",
  "Foto Produk (URL Drive)"
];

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

// ─── SETUP SHEET TAMBAHAN ───────────────────────────────────────────────────

/**
 * Jalankan MANUAL sekali dari editor Apps Script untuk membuat tab "Daftar Menu"
 * dan "Submit Pesanan" beserta header-nya. Idempotent — skip kalau sudah ada.
 */
function setupSheetTambahanMembership() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // ── Tab "Daftar Menu" ──
  var sheetMenu = ss.getSheetByName("Daftar Menu");
  if (!sheetMenu) {
    sheetMenu = ss.insertSheet("Daftar Menu");
    sheetMenu.getRange(1, 1, 1, COLUMNS_DAFTAR_MENU.length).setValues([COLUMNS_DAFTAR_MENU]);
    Logger.log("✅ Tab 'Daftar Menu' dibuat dengan header.");
  } else {
    var firstRow = sheetMenu.getRange(1, 1, 1, COLUMNS_DAFTAR_MENU.length).getValues()[0];
    var hasContent = firstRow.some(function (cell) {
      return cell !== "" && cell !== null && cell !== undefined;
    });
    if (hasContent) {
      Logger.log("⚠️ Tab 'Daftar Menu' sudah ada isi. Skip.");
    } else {
      sheetMenu.getRange(1, 1, 1, COLUMNS_DAFTAR_MENU.length).setValues([COLUMNS_DAFTAR_MENU]);
      Logger.log("✅ Header 'Daftar Menu' ditulis.");
    }
  }

  // ── Tab "Submit Pesanan" ──
  var sheetSubmit = ss.getSheetByName("Submit Pesanan");
  if (!sheetSubmit) {
    sheetSubmit = ss.insertSheet("Submit Pesanan");
    sheetSubmit.getRange(1, 1, 1, COLUMNS_SUBMIT_PESANAN.length).setValues([COLUMNS_SUBMIT_PESANAN]);
    Logger.log("✅ Tab 'Submit Pesanan' dibuat dengan header.");
  } else {
    var firstRow2 = sheetSubmit.getRange(1, 1, 1, COLUMNS_SUBMIT_PESANAN.length).getValues()[0];
    var hasContent2 = firstRow2.some(function (cell) {
      return cell !== "" && cell !== null && cell !== undefined;
    });
    if (hasContent2) {
      Logger.log("⚠️ Tab 'Submit Pesanan' sudah ada isi. Skip.");
    } else {
      sheetSubmit.getRange(1, 1, 1, COLUMNS_SUBMIT_PESANAN.length).setValues([COLUMNS_SUBMIT_PESANAN]);
      Logger.log("✅ Header 'Submit Pesanan' ditulis.");
    }
  }
}

// ─── FOTO FOLDER ───────────────────────────────────────────────────────────

/**
 * Dapatkan atau buat folder "MAO Membership - Bukti Foto" di Drive.
 * Cache folder ID di Script Properties supaya tidak search berulang.
 */
function getOrCreateFotoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty("FOTO_PRODUK_FOLDER_ID");

  // Coba pakai cached ID dulu
  if (cachedId) {
    try {
      var folder = DriveApp.getFolderById(cachedId);
      return folder;
    } catch (e) {
      // ID tidak valid / folder dihapus — lanjut cari/buat baru
      Logger.log("⚠️ Cached folder ID invalid, mencari ulang...");
    }
  }

  // Cari folder by name
  var folders = DriveApp.getFoldersByName("MAO Membership - Bukti Foto");
  if (folders.hasNext()) {
    var folder = folders.next();
    props.setProperty("FOTO_PRODUK_FOLDER_ID", folder.getId());
    return folder;
  }

  // Belum ada → buat baru
  var newFolder = DriveApp.createFolder("MAO Membership - Bukti Foto");
  props.setProperty("FOTO_PRODUK_FOLDER_ID", newFolder.getId());
  Logger.log("✅ Folder 'MAO Membership - Bukti Foto' dibuat: " + newFolder.getId());
  return newFolder;
}

// ─── doPost ─────────────────────────────────────────────────────────────────

function doPost(e) {
  var action = trim_(e.parameter.action);

  // ── Routing: submitOrder vs daftar (atau default tanpa action) ──
  if (action === "submitOrder") {
    return doPostSubmitOrder_(e);
  }

  // Default: registrasi Pendaftaran (backward-compat tanpa action atau action=daftar)
  return doPostPendaftaran_(e);
}

// ─── doPost: REGISTRASI PENDAFTARAN ────────────────────────────────────────

function doPostPendaftaran_(e) {
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

// ─── doPost: SUBMIT ORDER ──────────────────────────────────────────────────

function doPostSubmitOrder_(e) {
  var kodeMembership = trim_(e.parameter.kodeMembership);
  var itemsJson = trim_(e.parameter.itemsJson);
  var fotoBase64 = trim_(e.parameter.fotoBase64);
  var fotoMimeType = trim_(e.parameter.fotoMimeType);
  var fotoNamaFile = trim_(e.parameter.fotoNamaFile);

  // a. Validasi kode membership & cross-check ke sheet
  if (!kodeMembership) {
    return json_({ success: false, error: "Kode membership wajib diisi" });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var pendaftaranSheet = ss.getSheets()[0];
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var lastRow = pendaftaranSheet.getLastRow();
  var kodeExists = false;

  if (lastRow >= 2) {
    var existingCodes = pendaftaranSheet
      .getRange(2, kodeCol, lastRow - 1, 1)
      .getValues()
      .map(function (r) { return String(r[0]).trim(); })
      .filter(function (v) { return v !== ""; });
    kodeExists = existingCodes.indexOf(kodeMembership) !== -1;
  }

  if (!kodeExists) {
    return json_({ success: false, error: "Kode membership tidak ditemukan" });
  }

  // b. Parse & validasi itemsJson
  var items;
  try {
    items = JSON.parse(itemsJson);
  } catch (err) {
    return json_({ success: false, error: "Format itemsJson tidak valid" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return json_({ success: false, error: "Tidak ada item yang dipesan" });
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item.namaMenu || !String(item.namaMenu).trim()) {
      return json_({ success: false, error: "Item ke-" + (i + 1) + " tidak memiliki nama menu" });
    }
    if (!item.qty || parseInt(item.qty, 10) <= 0) {
      return json_({ success: false, error: "Item ke-" + (i + 1) + " memiliki qty tidak valid" });
    }
  }

  // c. Validasi foto
  if (!fotoBase64) {
    return json_({ success: false, error: "Foto wajib diupload" });
  }

  // d. Decode & upload foto ke Drive
  var fotoBlob = Utilities.newBlob(
    Utilities.base64Decode(fotoBase64),
    fotoMimeType || "image/jpeg",
    fotoNamaFile || "foto.jpg"
  );
  var folder = getOrCreateFotoFolder_();
  var file = folder.createFile(fotoBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fotoUrl = file.getUrl();

  // e. Append 1 baris PER item ke tab "Submit Pesanan"
  var submitSheet = ss.getSheetByName("Submit Pesanan");
  if (!submitSheet) {
    return json_({ success: false, error: "Tab 'Submit Pesanan' belum dibuat. Jalankan setupSheetTambahanMembership() terlebih dahulu." });
  }

  var timestamp = new Date();
  var jumlahItem = 0;

  for (var j = 0; j < items.length; j++) {
    var row = [
      timestamp,           // Timestamp
      kodeMembership,      // Kode Membership
      String(items[j].namaMenu).trim(),  // Nama Menu
      parseInt(items[j].qty, 10),        // Qty
      fotoUrl              // Foto Produk (URL Drive)
    ];
    submitSheet.appendRow(row);
    jumlahItem++;
  }

  Logger.log("✅ Pesanan diterima: " + kodeMembership + ", " + jumlahItem + " item");

  return json_({
    success: true,
    jumlahItem: jumlahItem
  });
}

// ─── doGet ──────────────────────────────────────────────────────────────────

function doGet(e) {
  var action = trim_(e.parameter.action);

  if (action === "getFormData") {
    return doGetFormData_(e);
  }

  // Default: health check
  return json_({ status: "MAO Membership API OK" });
}

// ─── doGet: FORM DATA (kode list + menu list) ──────────────────────────────

function doGetFormData_(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Ambil daftar Kode Membership dari tab Pendaftaran (index 0)
  var pendaftaranSheet = ss.getSheets()[0];
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var lastRow = pendaftaranSheet.getLastRow();
  var kodeList = [];

  if (lastRow >= 2) {
    kodeList = pendaftaranSheet
      .getRange(2, kodeCol, lastRow - 1, 1)
      .getValues()
      .map(function (r) { return String(r[0]).trim(); })
      .filter(function (v) { return v !== ""; });
  }

  // Ambil daftar Nama Menu dari tab "Daftar Menu"
  var menuList = [];
  var menuSheet = ss.getSheetByName("Daftar Menu");
  if (menuSheet) {
    var menuLastRow = menuSheet.getLastRow();
    if (menuLastRow >= 2) {
      menuList = menuSheet
        .getRange(2, 1, menuLastRow - 1, 1)
        .getValues()
        .map(function (r) { return String(r[0]).trim(); })
        .filter(function (v) { return v !== ""; });
    }
  }

  return json_({
    success: true,
    kodeList: kodeList,
    menuList: menuList
  });
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
