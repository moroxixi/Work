/**
 * MAO Membership — Google Apps Script Backend
 *
 * Deploy as Web App dengan doPost & doGet.
 * Jalankan setupSheetHeaders() sekali manual lewat editor untuk menulis header
 * (sekaligus rename tab pertama menjadi "Member" — hanya jika baris 1 kosong).
 *
 * PENTING: setelah update ini, jalankan ULANG setupSheetHeaders() sekali dari
 * editor — jumlah kolom header adalah 11 (termasuk kolom "Username" di ujung).
 *
 * 2026-09-18: fitur Request Hadiah. Tab "Hadiah" sekarang punya 5 kolom
 * (COLUMNS_HADIAH). Untuk sheet yang SUDAH berjalan dengan header lama (3
 * kolom), jalankan setupSheetTambahanMembership() sekali dari editor — dia
 * akan meng-extend baris header tab "Hadiah" ke 5 kolom.
 */

// ─── KONFIGURASI ────────────────────────────────────────────────────────────
var SHEET_ID = "17s9Y-lL07n-mN0fWmezQvVqMIcY8MaqjpESx_x6TcFA";

// Nama tab untuk data Pendaftaran/Member (di-rename oleh setupSheetHeaders)
var SHEET_NAME_MEMBER = "Member";

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
  "Nomor WhatsApp",
  "Foto Profil (URL Drive)",
  "Username"
];

// Charset untuk kode unik (hindari karakter ambigu: 0/O/1/I)
var CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Header untuk tab "Daftar Menu"
var COLUMNS_DAFTAR_MENU = ["Nama Menu"];

// Header untuk tab "Submit Pesanan"
// Kolom "Order ID" (index 6) di-append di belakang supaya tidak menggeser
// index kolom lama yang sudah diakses oleh kode existing via hardcoded index.
var COLUMNS_SUBMIT_PESANAN = [
  "Timestamp",
  "Kode Membership",
  "Nama Menu",
  "Qty",
  "Foto Produk (URL Drive)",
  "Order ID"
];

// Header untuk tab "Hadiah" — 3 kolom katalog + 2 kolom request (2026-09-18).
// Kolom katalog (A–C) = katalog hadiah yang dirender ke halaman Hadiah.
// Kolom request (D–E) = baris hasil fitur "Request Hadiah" (kode member +
// teks permintaan); kolom katalog A–C SENGAJA dikosongkan pada baris request.
// doGetHadiah_ hanya me-render baris dengan Judul + Poin terisi, jadi baris
// request TIDAK muncul di katalog.
var COLUMNS_HADIAH = ["Judul", "Poin Dibutuhkan", "URL Foto Hadiah", "Kode Membership", "Request Cust"];

// Konversi poin: 1 Qty = 100 poin
var POIN_PER_QTY = 100;

// ─── SETUP HEADER ───────────────────────────────────────────────────────────

/**
 * Jalankan MANUAL sekali dari editor Apps Script untuk menulis header.
 * Sekalian me-rename tab pertama menjadi "Member" — HANYA jika baris 1
 * masih kosong (idempoten: kalau baris 1 sudah ada isi, skip & log peringatan,
 * rename pun tidak dilakukan).
 */
function setupSheetHeaders() {
  var sheet = getMemberSheet_();
  var firstRow = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];

  // Defensive check: kalau semua sel di baris 1 kosong, lanjut tulis
  var hasContent = firstRow.some(function (cell) {
    return cell !== "" && cell !== null && cell !== undefined;
  });

  if (hasContent) {
    Logger.log(
      "⚠️ Baris 1 sudah ada isi. Header TIDAK ditulis ulang & tab TIDAK di-rename. Data existing: " +
        JSON.stringify(firstRow)
    );
    return;
  }

  // Baris 1 masih kosong → aman rename tab ke "Member"
  if (sheet.getName() !== SHEET_NAME_MEMBER) {
    sheet.setName(SHEET_NAME_MEMBER);
    Logger.log("✅ Tab pertama di-rename menjadi '" + SHEET_NAME_MEMBER + "'.");
  }

  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  Logger.log("✅ Header berhasil ditulis (" + COLUMNS.length + " kolom): " + COLUMNS.join(", "));
}

// ─── SHEET ACCESS (tab Member) ──────────────────────────────────────────────

/**
 * Single point of access untuk tab Pendaftaran/Member.
 * Coba by name dulu ("Member"), fallback ke tab pertama kalau belum di-rename
 * (misal setupSheetHeaders belum pernah dijalankan).
 */
function getMemberSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME_MEMBER);
  if (!sheet) {
    console.log(
      "⚠️ Tab '" + SHEET_NAME_MEMBER + "' tidak ditemukan — fallback ke tab pertama (getSheets()[0])."
    );
    sheet = ss.getSheets()[0];
  }
  return sheet;
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
      // Header existing mungkin belum punya kolom "Order ID" (index 6).
      // Kalau baris header kurang panjang dari COLUMNS_SUBMIT_PESANAN, extend
      // supaya kolom "Order ID" ada header-nya. Data baris 2+ tidak disentuh.
      var currentHeaderLen = firstRow2.length;
      if (currentHeaderLen < COLUMNS_SUBMIT_PESANAN.length) {
        sheetSubmit.getRange(1, 1, 1, COLUMNS_SUBMIT_PESANAN.length).setValues([COLUMNS_SUBMIT_PESANAN]);
        Logger.log("✅ Header 'Submit Pesanan' di-extend ke " + COLUMNS_SUBMIT_PESANAN.length + " kolom (tambah 'Order ID').");
      } else {
        Logger.log("⚠️ Tab 'Submit Pesanan' sudah ada isi. Skip.");
      }
    } else {
      sheetSubmit.getRange(1, 1, 1, COLUMNS_SUBMIT_PESANAN.length).setValues([COLUMNS_SUBMIT_PESANAN]);
      Logger.log("✅ Header 'Submit Pesanan' ditulis.");
    }
  }

  // ── Tab "Hadiah" ──
  // Header sekarang 5 kolom (katalog + request). Untuk sheet yang sudah ada
  // dgn header lama 3 kolom: baris 1 di-EXTEND ke COLUMNS_HADIAH (data katalog
  // di baris 2+ tidak disentuh), bukan sekadar skip — supaya kolom
  // "Kode Membership" & "Request Cust" punya header sebelum request masuk.
  var sheetHadiah = ss.getSheetByName("Hadiah");
  if (!sheetHadiah) {
    sheetHadiah = ss.insertSheet("Hadiah");
    sheetHadiah.getRange(1, 1, 1, COLUMNS_HADIAH.length).setValues([COLUMNS_HADIAH]);
    Logger.log("✅ Tab 'Hadiah' dibuat dengan header.");
  } else {
    var headerRow3 = sheetHadiah.getRange(1, 1, 1, COLUMNS_HADIAH.length).getValues()[0];
    var headerMatch = COLUMNS_HADIAH.every(function (col, i) {
      return String(headerRow3[i] || "").trim() === col;
    });
    if (headerMatch) {
      Logger.log("✅ Header tab 'Hadiah' sudah sesuai. Skip.");
    } else {
      sheetHadiah.getRange(1, 1, 1, COLUMNS_HADIAH.length).setValues([COLUMNS_HADIAH]);
      Logger.log("✅ Header tab 'Hadiah' di-extend/diperbarui ke " + COLUMNS_HADIAH.length + " kolom.");
    }
  }
}

// ─── FOTO FOLDER ───────────────────────────────────────────────────────────

/**
 * Dapatkan atau buat folder Drive berdasarkan nama.
 * Cache folder ID di Script Properties (key = propKey) supaya tidak
 * search berulang.
 * @param {string} folderName - nama folder di Drive
 * @param {string} propKey - key Script Properties untuk cache folder ID
 */
function getOrCreateFolder_(folderName, propKey) {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty(propKey);

  // Coba pakai cached ID dulu
  if (cachedId) {
    try {
      var folder = DriveApp.getFolderById(cachedId);
      return folder;
    } catch (e) {
      // ID tidak valid / folder dihapus — lanjut cari/buat baru
      Logger.log("⚠️ Cached folder ID invalid (" + propKey + "), mencari ulang...");
    }
  }

  // Cari folder by name
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    var folder = folders.next();
    props.setProperty(propKey, folder.getId());
    return folder;
  }

  // Belum ada → buat baru
  var newFolder = DriveApp.createFolder(folderName);
  props.setProperty(propKey, newFolder.getId());
  Logger.log("✅ Folder '" + folderName + "' dibuat: " + newFolder.getId());
  return newFolder;
}

// ─── doPost ─────────────────────────────────────────────────────────────────

function doPost(e) {
  var action = trim_(e.parameter.action);

  // ── Routing: submitOrder / requestHadiah / daftar (default) ──
  if (action === "submitOrder") {
    return doPostSubmitOrder_(e);
  }

  if (action === "requestHadiah") {
    return doPostRequestHadiah_(e);
  }

  // ── Admin actions (setiap handler admin re-validasi PIN sendiri —
  //    lihat checkAdminPin_; PIN tidak pernah di-hardcode di source) ──
  if (action === "verifyAdminPin") {
    return doPostVerifyAdminPin_(e);
  }

  if (action === "adminListPesanan") {
    return doPostAdminListPesanan_(e);
  }

  if (action === "adminDeletePesanan") {
    return doPostAdminDeletePesanan_(e);
  }

  if (action === "adminGetMemberList") {
    return doPostAdminGetMemberList_(e);
  }

  if (action === "adminGetMemberDetail") {
    return doPostAdminGetMemberDetail_(e);
  }

  if (action === "adminUpdateMember") {
    return doPostAdminUpdateMember_(e);
  }

  // Default: registrasi Pendaftaran — HANYA untuk request tanpa action
  // atau action="daftar" secara eksplisit. Action lain yang tidak dikenal
  // TIDAK boleh jatuh ke sini: kalau client lebih baru dari deployment
  // (kasus nyata 2026-09-19: POST requestHadiah mendarat di backend lama
  // yang belum punya routing-nya), handler Pendaftaran mengembalikan error
  // "Field tidak lengkap: Nama wajib diisi; ..." yang tidak nyambung dengan
  // form yang disubmit user (bug salah sasaran).
  if (action === "" || action === "daftar") {
    return doPostPendaftaran_(e);
  }

  return json_({
    success: false,
    error: "Action \"" + action + "\" tidak dikenal oleh backend yang ter-deploy. " +
      "Kemungkinan backend perlu di-deploy ulang (versi client lebih baru dari versi backend).",
    errorType: "unknown_action"
  });
}

// ─── doPost: REGISTRASI PENDAFTARAN ────────────────────────────────────────

function doPostPendaftaran_(e) {
  var sheet = getMemberSheet_();

  // Ambil parameter (URLSearchParams → e.parameter)
  var nama = trim_(e.parameter.Nama);
  var domisili = trim_(e.parameter.Domisili);
  var tanggalLahir = trim_(e.parameter.TanggalLahir);
  var jenisKelamin = trim_(e.parameter.JenisKelamin);
  var status = trim_(e.parameter.Status);
  var nomorWhatsApp = trim_(e.parameter.NomorWhatsApp);
  var username = trim_(e.parameter.Username);
  var fotoBase64 = trim_(e.parameter.fotoBase64);
  var fotoMimeType = trim_(e.parameter.fotoMimeType);
  var fotoNamaFile = trim_(e.parameter.fotoNamaFile);

  // Validasi semua field required
  var errors = [];
  if (!nama) errors.push("Nama wajib diisi");
  if (!domisili) errors.push("Domisili wajib diisi");
  if (!tanggalLahir) errors.push("Tanggal Lahir wajib diisi");
  if (!jenisKelamin) errors.push("Jenis Kelamin wajib diisi");
  if (!status) errors.push("Status wajib diisi");
  if (!nomorWhatsApp) errors.push("Nomor WhatsApp wajib diisi");
  if (!username) errors.push("Username wajib diisi");

  // Validasi format username: huruf, angka, underscore, 3-20 karakter
  if (username && !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return json_({
      success: false,
      error: "Username hanya boleh berisi huruf, angka, dan underscore (3–20 karakter).",
      errorType: "username_format"
    });
  }

  if (errors.length > 0) {
    return json_({
      success: false,
      error: "Field tidak lengkap: " + errors.join("; ")
    });
  }

  // Foto profil wajib (pesan error persis sesuai kontrak)
  if (!fotoBase64) {
    return json_({ success: false, error: "Foto wajib diupload" });
  }

  // Validasi username UNIK — cek ke seluruh kolom Username di sheet
  var usernameCol = COLUMNS.indexOf("Username") + 1; // 1-indexed
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existingUsernames = sheet
      .getRange(2, usernameCol, lastRow - 1, 1)
      .getValues()
      .map(function (r) { return String(r[0]).trim().toLowerCase(); })
      .filter(function (v) { return v !== ""; });
    if (existingUsernames.indexOf(username.toLowerCase()) !== -1) {
      return json_({
        success: false,
        error: "Username \"" + username + "\" sudah dipakai. Silakan pilih username lain.",
        errorType: "username_taken"
      });
    }
  }

  // Generate kode unik
  var kodeMembership = generateKodeMembership_(sheet);

  // Hitung umur server-side (single source of truth)
  var umur = hitungUmur_(tanggalLahir);

  // Upload foto profil ke folder Drive khusus (terpisah dari foto produk Submit)
  var fotoBlob = Utilities.newBlob(
    Utilities.base64Decode(fotoBase64),
    fotoMimeType || "image/jpeg",
    fotoNamaFile || "foto.jpg"
  );
  var folder = getOrCreateFolder_("MAO Membership - Foto Profil", "FOTO_PROFIL_FOLDER_ID");
  var fotoFile = folder.createFile(fotoBlob);
  fotoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fotoUrl = fotoFile.getUrl();

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
    nomorWhatsApp,     // Nomor WhatsApp
    fotoUrl,           // Foto Profil (URL Drive)
    username           // Username
  ];

  sheet.appendRow(row);
  Logger.log("✅ Pendaftaran baru: " + nama + " (" + username + ") → " + kodeMembership);

  return json_({
    success: true,
    kodeMembership: kodeMembership,
    nama: nama,
    domisili: domisili,
    umur: umur,
    fotoUrl: fotoUrl,
    username: username
  });
}

// ─── doPost: SUBMIT ORDER ──────────────────────────────────────────────────

function doPostSubmitOrder_(e) {
  var kodeMembership = trim_(e.parameter.kodeMembership);
  var itemsJson = trim_(e.parameter.itemsJson);
  var fotoBase64 = trim_(e.parameter.fotoBase64);
  var fotoMimeType = trim_(e.parameter.fotoMimeType);
  var fotoNamaFile = trim_(e.parameter.fotoNamaFile);
  var orderId = trim_(e.parameter.orderId); // nullable — backward compat client lama

  // a. Validasi kode membership & cross-check ke sheet
  if (!kodeMembership) {
    return json_({ success: false, error: "Kode membership wajib diisi" });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var pendaftaranSheet = getMemberSheet_();
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
  var folder = getOrCreateFolder_("MAO Membership - Bukti Foto", "FOTO_PRODUK_FOLDER_ID");
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
      fotoUrl,             // Foto Produk (URL Drive)
      orderId              // Order ID (kosong kalau client lama tidak mengirim)
    ];
    submitSheet.appendRow(row);
    jumlahItem++;
  }

  // f. Hitung total poin KUMULATIF untuk kode ini — dipanggil SETELAH append
  // di atas supaya submission yang baru saja masuk ikut terhitung.
  var totalPoin = hitungTotalPoin_(submitSheet, kodeMembership);

  Logger.log("✅ Pesanan diterima: " + kodeMembership + ", " + jumlahItem + " item, total " + totalPoin + " poin");

  return json_({
    success: true,
    jumlahItem: jumlahItem,
    totalPoin: totalPoin
  });
}

// ─── HITUNG TOTAL POIN (kumulatif per Kode Membership) ─────────────────────

/**
 * Jumlahkan kolom "Qty" dari SELURUH riwayat di tab "Submit Pesanan" yang
 * Kode Membership-nya cocok, lalu konversi ke poin (1 Qty = POIN_PER_QTY).
 *
 * CATATAN: fungsi ini full-scan seluruh baris tiap kali dipanggil. Ini
 * keterbatasan yang diterima untuk skala data saat ini — kalau nanti data
 * sudah sangat banyak, scan ini bisa jadi lambat dan perlu cache/index.
 *
 * @param {Sheet} sheet - tab "Submit Pesanan"
 * @param {string} kodeMembership - kode yang dicari
 * @returns {number} total poin (integer)
 */
function hitungTotalPoin_(sheet, kodeMembership) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0; // hanya header / kosong

  // Ambil kolom "Kode Membership" & "Qty" sekaligus (2 kolom, 1-indexed)
  var kodeCol = COLUMNS_SUBMIT_PESANAN.indexOf("Kode Membership") + 1;
  var qtyCol = COLUMNS_SUBMIT_PESANAN.indexOf("Qty") + 1;
  var target = String(kodeMembership).trim();

  var values = sheet.getRange(2, kodeCol, lastRow - 1, qtyCol - kodeCol + 1).getValues();

  var totalQty = 0;
  for (var i = 0; i < values.length; i++) {
    var kodeRow = String(values[i][0]).trim();
    if (kodeRow !== target) continue;

    // Data Qty bisa kotor (non-angka/kosong) → anggap 0, jangan biarkan NaN
    var qtyNum = Number(values[i][values[i].length - 1]);
    if (!isNaN(qtyNum)) {
      totalQty += qtyNum;
    }
  }

  return totalQty * POIN_PER_QTY;
}

// ─── doGet ──────────────────────────────────────────────────────────────────

function doGet(e) {

  var action = trim_(e.parameter.action);

  if (action === "getFormData") {
    return doGetFormData_(e);
  }

  if (action === "getLeaderboard") {
    return doGetLeaderboard_(e);
  }

  if (action === "getHadiah") {
    return doGetHadiah_(e);
  }

  if (action === "getMemberByUsername") {
    return doGetMemberByUsername_(e);
  }

  if (action === "getOrderByOrderId") {
    return doGetOrderByOrderId_(e);
  }

  // Default: health check
  return json_({ status: "MAO Membership API OK" });
}

// ─── doGet: CEK MEMBER BY USERNAME (read-only, recovery Pendaftaran) ───────

/**
 * Lookup satu member berdasarkan username. MURNI READ-ONLY — tidak ada
 * appendRow/setValues/penulisan apa pun ke sheet.
 *
 * Tujuan utama: recovery di sisi client kalau POST Pendaftaran gagal/
 * timeout PADAHAL data sebenarnya sudah masuk ke sheet (response yang
 * hilang, bukan datanya). Client memanggil endpoint ini sebelum menampilkan
 * error; kalau username ditemukan → alur sukses normal (kartu member).
 *
 * Response DIKANALISASI dengan struktur kartu member yang dirender client
 * (showCard): kodeMembership, nama, domisili, umur, fotoUrl, username —
 * sama persis dengan response sukses doPostPendaftaran_.
 *
 * Param: username (wajib, case-insensitive).
 */
function doGetMemberByUsername_(e) {
  var username = trim_(e.parameter.username);

  if (!username) {
    return json_({ success: false, error: "Parameter username wajib diisi" });
  }

  var sheet = getMemberSheet_();
  var usernameCol = COLUMNS.indexOf("Username") + 1; // 1-indexed
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return json_({ success: true, found: false });
  }

  // Ambil SEMUA kolom sekaligus (A..K = 11 kolom, dari baris 2) supaya
  // cukup satu getRange untuk lookup + ambil data lengkap member.
  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  var target = username.toLowerCase();

  // Scan dari baris TERAKHIR: yang paling baru mendaftar yang menang kalau
  // (anehnya) ada duplikat username di sheet.
  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    if (String(row[usernameCol - 1]).trim().toLowerCase() !== target) continue;

    return json_({
      success: true,
      found: true,
      member: {
        kodeMembership: String(row[COLUMNS.indexOf("Kode Membership")]).trim(),
        nama: String(row[COLUMNS.indexOf("Nama")]).trim(),
        domisili: String(row[COLUMNS.indexOf("Domisili")]).trim(),
        umur: row[COLUMNS.indexOf("Umur")],
        fotoUrl: String(row[COLUMNS.indexOf("Foto Profil (URL Drive)")]).trim(),
        username: String(row[COLUMNS.indexOf("Username")]).trim()
      }
    });
  }

  return json_({ success: true, found: false });
}

// ─── doGet: FORM DATA (kode list + menu list) ──────────────────────────────

function doGetFormData_(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Ambil daftar Kode Membership + Username dari tab Member (Pendaftaran)
  var pendaftaranSheet = getMemberSheet_();
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var usernameCol = COLUMNS.indexOf("Username") + 1;
  var lastRow = pendaftaranSheet.getLastRow();
  var kodeList = [];
  var memberList = [];

  if (lastRow >= 2) {
    // Ambil kode (kolom B) dan username (kolom K) sekaligus
    var kodeLastCol = Math.max(kodeCol, usernameCol);
    var data = pendaftaranSheet
      .getRange(2, kodeCol, lastRow - 1, kodeLastCol - kodeCol + 1)
      .getValues();

    data.forEach(function (r) {
      var kode = String(r[0]).trim();
      var uname = String(r[kodeLastCol - kodeCol]).trim();
      if (kode !== "") {
        kodeList.push(kode);
        memberList.push({ kode: kode, username: uname || "" });
      }
    });
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
    memberList: memberList,
    menuList: menuList
  });
}

// ─── doGet: LEADERBOARD ────────────────────────────────────────────────────

/**
 * Return data leaderboard: username, kode member, poin.
 * HANYA 3 field ini — TIDAK expose nama, foto, kontak, dll (endpoint publik).
 * Urutan: poin DESC. Tie-break: timestamp transaksi paling awal ASC.
 */
function doGetLeaderboard_(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var pendaftaranSheet = getMemberSheet_();
  var submitSheet = ss.getSheetByName("Submit Pesanan");

  if (!submitSheet) {
    return json_({ success: true, leaderboard: [] });
  }

  // 1. Ambil semua member: kode + username
  var lastRow = pendaftaranSheet.getLastRow();
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var usernameCol = COLUMNS.indexOf("Username") + 1;
  var members = {};

  if (lastRow >= 2) {
    var kodeLastCol = Math.max(kodeCol, usernameCol);
    var data = pendaftaranSheet
      .getRange(2, kodeCol, lastRow - 1, kodeLastCol - kodeCol + 1)
      .getValues();
    data.forEach(function (r) {
      var kode = String(r[0]).trim();
      var uname = String(r[kodeLastCol - kodeCol]).trim();
      if (kode !== "") {
        members[kode] = uname || "";
      }
    });
  }

  // 2. Hitung poin + timestamp paling awal per kode dari Submit Pesanan
  var subLastRow = submitSheet.getLastRow();
  var subKodeCol = COLUMNS_SUBMIT_PESANAN.indexOf("Kode Membership") + 1;
  var subQtyCol = COLUMNS_SUBMIT_PESANAN.indexOf("Qty") + 1;
  var subTimeCol = COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp") + 1;

  var poinMap = {};    // kode → totalQty
  var firstTime = {};  // kode → Date paling awal

  if (subLastRow >= 2) {
    var subData = submitSheet
      .getRange(2, 1, subLastRow - 1, COLUMNS_SUBMIT_PESANAN.length)
      .getValues();
    subData.forEach(function (r) {
      var kode = String(r[subKodeCol - 1]).trim();
      if (!kode) return;
      var qty = Number(r[subQtyCol - 1]);
      if (isNaN(qty)) qty = 0;
      var ts = r[subTimeCol - 1];
      if (!(kode in poinMap)) {
        poinMap[kode] = 0;
        firstTime[kode] = ts;
      }
      poinMap[kode] += qty;
      // Simpan timestamp paling awal
      if (ts instanceof Date && (!firstTime[kode] || ts < firstTime[kode])) {
        firstTime[kode] = ts;
      }
    });
  }

  // 3. Susun leaderboard
  var leaderboard = [];
  Object.keys(members).forEach(function (kode) {
    var poin = (poinMap[kode] || 0) * POIN_PER_QTY;
    leaderboard.push({
      username: members[kode],
      kode: kode,
      poin: poin,
      _ts: firstTime[kode] || new Date(9999, 11, 31) // fallback: very late = sort last
    });
  });

  // 4. Sort: poin DESC, tie-break timestamp ASC (yang lebih awal di atas)
  leaderboard.sort(function (a, b) {
    if (b.poin !== a.poin) return b.poin - a.poin; // poin DESC
    var tA = a._ts instanceof Date ? a._ts.getTime() : 0;
    var tB = b._ts instanceof Date ? b._ts.getTime() : 0;
    return tA - tB; // timestamp ASC (lebih awal di atas)
  });

  // 5. Hapus field internal _ts sebelum return
  var result = leaderboard.map(function (item) {
    return { username: item.username, kode: item.kode, poin: item.poin };
  });

  return json_({ success: true, leaderboard: result });
}

// ─── doGet: ORDER BY ORDER ID (read-only, recovery Submit) ───────────────

/**
 * Lookup satu pesanan berdasarkan Order ID. MURNI READ-ONLY — tidak ada
 * appendRow/setValues/penulisan apa pun ke sheet.
 *
 * Tujuan utama: recovery di sisi client kalau POST Submit gagal/timeout
 * PADAHAL data sebenarnya sudah masuk ke sheet (response yang hilang).
 * Client memanggil endpoint ini sebelum menampilkan error; kalau Order ID
 * ditemukan → treat sebagai sukses. Tidak pernah ada retry POST otomatis.
 *
 * Response: semua kolom tab "Submit Pesanan" (Timestamp, Kode Membership,
 * Nama Menu, Qty, Foto URL, Order ID) supaya client bisa langsung lanjut
 * ke flow sukses tanpa re-fetch lain.
 *
 * Endpoint TIDAK di-gate PIN admin — dipakai oleh halaman publik Submit.
 * Risiko exposure rendah: hanya return data 1 order spesifik by exact-ID.
 *
 * Param: orderId (wajib, exact match case-sensitive).
 */
function doGetOrderByOrderId_(e) {
  var orderId = trim_(e.parameter.orderId);

  if (!orderId) {
    return json_({ success: false, error: "Parameter orderId wajib diisi" });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var submitSheet = ss.getSheetByName("Submit Pesanan");
  if (!submitSheet) {
    return json_({ success: true, found: false });
  }

  var lastRow = submitSheet.getLastRow();
  if (lastRow < 2) {
    return json_({ success: true, found: false });
  }

  var orderIdCol = COLUMNS_SUBMIT_PESANAN.indexOf("Order ID") + 1; // 1-indexed
  var data = submitSheet.getRange(2, 1, lastRow - 1, COLUMNS_SUBMIT_PESANAN.length).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    if (String(row[orderIdCol - 1]).trim() !== orderId) continue;

    return json_({
      success: true,
      found: true,
      pesanan: {
        timestamp: row[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")] instanceof Date
          ? row[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")].toISOString()
          : String(row[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")]),
        kodeMembership: String(row[COLUMNS_SUBMIT_PESANAN.indexOf("Kode Membership")]).trim(),
        namaMenu: String(row[COLUMNS_SUBMIT_PESANAN.indexOf("Nama Menu")]).trim(),
        qty: row[COLUMNS_SUBMIT_PESANAN.indexOf("Qty")],
        fotoUrl: String(row[COLUMNS_SUBMIT_PESANAN.indexOf("Foto Produk (URL Drive)")] || "").trim(),
        orderId: String(row[COLUMNS_SUBMIT_PESANAN.indexOf("Order ID")] || "").trim()
      }
    });
  }

  return json_({ success: true, found: false });
}

// ─── doPost: REQUEST HADIAH ────────────────────────────────────────────────

/**
 * Catat permintaan hadiah custom dari user ke tab "Hadiah" sebagai BARIS BARU:
 * kolom "Kode Membership" + "Request Cust" terisi, kolom katalog (Judul, Poin,
 * URL Foto) dikosongkan. Baris request ini TIDAK muncul di katalog halaman
 * Hadiah karena doGetHadiah_ hanya me-render baris yang Judul + Poinya valid.
 *
 * Kolom katalog bisa diisi admin belakangan kalau request disetujui — atau
 * baris request dipakai sebagai checklist admin. (Pola konsisten dgn
 * doPostPendaftaran_/doPostSubmitOrder_: validasi → validasi sheet → append.)
 *
 * Parameter: kodeMembership (wajib, harus terdaftar di tab Member),
 *            requestText (wajib, teks bebas).
 */
function doPostRequestHadiah_(e) {
  var kodeMembership = trim_(e.parameter.kodeMembership);
  var requestText = trim_(e.parameter.requestText);

  if (!kodeMembership) {
    return json_({ success: false, error: "Kode membership wajib diisi" });
  }
  if (!requestText) {
    return json_({ success: false, error: "Teks request hadiah wajib diisi" });
  }

  // Validasi kode member terdaftar (pola sama dengan doPostSubmitOrder_)
  var pendaftaranSheet = getMemberSheet_();
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

  var hadiahSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Hadiah");
  if (!hadiahSheet) {
    return json_({ success: false, error: "Tab 'Hadiah' belum dibuat. Jalankan setupSheetTambahanMembership() terlebih dahulu." });
  }

  // Baris request: katalog kosong ("") di kolom A–C, request di D–E
  var row = ["", "", "", kodeMembership, requestText];
  hadiahSheet.appendRow(row);

  Logger.log("🎁 Request hadiah: " + kodeMembership + " → " + requestText);

  return json_({ success: true });
}

// ─── doGet: HADIAH ──────────────────────────────────────────────────────────

/**
 * Return isi tab "Hadiah" (katalog) sebagai JSON.
 * Kalau tab belum ada → return array kosong (bukan error).
 *
 * Filter baris: hanya baris dengan Judul terisi DAN Poin angka yang masuk.
 * Baris "Request Cust" (kolom katalog kosong) otomatis ter-skip oleh filter
 * ini — aman meski tab Hadiah juga berisi baris request.
 */
function doGetHadiah_(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Hadiah");

  if (!sheet) {
    return json_({ success: true, hadiah: [] });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return json_({ success: true, hadiah: [] });
  }

  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS_HADIAH.length).getValues();
  var hadiah = [];

  data.forEach(function (r) {
    var judul = String(r[0]).trim();
    var poinDibutuhkan = parseInt(r[1], 10);
    var urlFoto = String(r[2] || "").trim();
    if (judul !== "" && !isNaN(poinDibutuhkan)) {
      hadiah.push({
        judul: judul,
        poinDibutuhkan: poinDibutuhkan,
        urlFoto: urlFoto
      });
    }
  });

  return json_({ success: true, hadiah: hadiah });
}

// ─── ADMIN: PIN GATE (shared) ────────────────────────────────────────────────
//
// PIN admin TIDAK PERNAH di-hardcode di source (client maupun server).
// Nilainya di-set manual oleh Rofi lewat editor Apps Script:
//   Project Settings → Script Properties → tambah property "ADMIN_PIN".
//
// Setiap action admin WAJIB memanggil checkAdminPin_() sebagai validasi
// PERTAMA — bukan cuma sekali di gate awal halaman — supaya client yang
// menembus gate UI tetap ditolak di level backend.

/**
 * Re-validasi PIN per request. Return null kalau PIN valid;
 * return response JSON "PIN salah" (generik, tanpa detail) kalau gagal.
 *
 * CATATAN: kalau property ADMIN_PIN belum di-set sama sekali, SEMUA request
 * admin ditolak (fail-closed) — bukan di-bypass. Pesan error tetap generik.
 *
 * @param {string} pin - PIN yang dikirim client (string mentah)
 * @return {Object|null} null = lolos; object = response tolak siap-return
 */
function checkAdminPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");

  // Fail-closed: property belum di-set / kosong → tolak semua.
  // String(expected) menjaga kalau ter-set sebagai angka dari UI properties.
  if (!expected || String(expected).length === 0) {
    return json_({ success: false, error: "PIN salah", errorType: "unauthorized" });
  }

  if (String(pin || "").trim() !== String(expected)) {
    return json_({ success: false, error: "PIN salah", errorType: "unauthorized" });
  }

  return null; // PIN valid
}

/**
 * Action: verifyAdminPin — dipanggil admin-auth.js saat gate dibuka.
 * Sukses → client menyimpan flag di sessionStorage (client-side only).
 * Backend tetap re-validasi PIN di SETIAP action admin berikutnya.
 */
function doPostVerifyAdminPin_(e) {
  var pin = trim_(e.parameter.pin);
  var reject = checkAdminPin_(pin);
  if (reject) return reject;

  // TIDAK mengembalikan PIN-nya, dan tidak ada info lain yang bocor.
  return json_({ success: true });
}

// ─── ADMIN: LIST PESANAN (Check-Pesanan) ───────────────────────────────────

/**
 * Action: adminListPesanan — seluruh isi tab "Submit Pesanan" untuk
 * verifikasi manual admin: Timestamp, Kode Membership, Nama Menu, Qty,
 * URL foto bukti, dan rowIndex absolut (baris sheet) sebagai row reference
 * untuk delete + snapshot revalidation.
 * PIN wajib valid.
 */
function doPostAdminListPesanan_(e) {
  var reject = checkAdminPin_(trim_(e.parameter.pin));
  if (reject) return reject;

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Submit Pesanan");
  if (!sheet) {
    return json_({ success: false, error: "Tab 'Submit Pesanan' belum dibuat. Jalankan setupSheetTambahanMembership() terlebih dahulu." });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return json_({ success: true, pesanan: [] });
  }

  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS_SUBMIT_PESANAN.length).getValues();
  var pesanan = [];

  data.forEach(function (r, i) {
    var kode = String(r[COLUMNS_SUBMIT_PESANAN.indexOf("Kode Membership")]).trim();
    var namaMenu = String(r[COLUMNS_SUBMIT_PESANAN.indexOf("Nama Menu")]).trim();
    // Skip baris kosong total (kode + menu kosong) — biasanya sisa hapus manual.
    if (!kode && !namaMenu) return;

    pesanan.push({
      rowIndex: i + 2, // baris sheet absolut (baris 1 = header)
      timestamp: r[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")] instanceof Date
        ? r[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")].toISOString()
        : String(r[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")]),
      kodeMembership: kode,
      namaMenu: namaMenu,
      qty: r[COLUMNS_SUBMIT_PESANAN.indexOf("Qty")],
      fotoUrl: String(r[COLUMNS_SUBMIT_PESANAN.indexOf("Foto Produk (URL Drive)")] || "").trim()
    });
  });

  // Terbaru dulu biar pesanan baru langsung terlihat di atas.
  pesanan.sort(function (a, b) {
    var ta = Date.parse(a.timestamp) || 0;
    var tb = Date.parse(b.timestamp) || 0;
    return tb - ta;
  });

  return json_({ success: true, pesanan: pesanan });
}

// ─── ADMIN: DELETE PESANAN ────────────────────────────────────────────────

/**
 * Action: adminDeletePesanan — hapus SATU baris pesanan.
 * Urutan wajib: validasi PIN → revalidasi snapshot baris (timestamp+kode
 * + nama menu + qty harus masih persis sama dengan yang client lihat) →
 * sheet.deleteRow(). Kalau snapshot tidak cocok → TOLAK (baris mungkin
 * sudah bergeser/diubah orang lain) dan minta client refresh list —
 * JANGAN pernah menghapus baris yang salah.
 *
 * Menggunakan deleteRow (baris terhapus betulan, baris di bawah naik),
 * BUKAN clearContent (yang menyisakan baris kosong di tengah data).
 */
function doPostAdminDeletePesanan_(e) {
  var reject = checkAdminPin_(trim_(e.parameter.pin));
  if (reject) return reject;

  var rowIndex = parseInt(e.parameter.rowIndex, 10);
  var snapTimestamp = trim_(e.parameter.snapTimestamp);
  var snapKode = trim_(e.parameter.snapKode);
  var snapNamaMenu = trim_(e.parameter.snapNamaMenu);
  var snapQty = trim_(e.parameter.snapQty);

  // Baris 1 = header → tidak boleh jadi target delete.
  if (isNaN(rowIndex) || rowIndex < 2) {
    return json_({ success: false, error: "rowIndex tidak valid" });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Submit Pesanan");
  if (!sheet) {
    return json_({ success: false, error: "Tab 'Submit Pesanan' belum dibuat. Jalankan setupSheetTambahanMembership() terlebih dahulu." });
  }

  if (rowIndex > sheet.getLastRow()) {
    return json_({ success: false, error: "Baris sudah tidak ada. Refresh list.", errorType: "stale" });
  }

  // Revalidasi snapshot: baca ulang baris target dan bandingkan.
  var cur = sheet.getRange(rowIndex, 1, 1, COLUMNS_SUBMIT_PESANAN.length).getValues()[0];
  var curTimestamp = cur[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")] instanceof Date
    ? cur[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")].toISOString()
    : String(cur[COLUMNS_SUBMIT_PESANAN.indexOf("Timestamp")]);
  var curKode = String(cur[COLUMNS_SUBMIT_PESANAN.indexOf("Kode Membership")]).trim();
  var curNamaMenu = String(cur[COLUMNS_SUBMIT_PESANAN.indexOf("Nama Menu")]).trim();
  var curQty = String(cur[COLUMNS_SUBMIT_PESANAN.indexOf("Qty")]).trim();

  var same =
    curTimestamp === snapTimestamp &&
    curKode === snapKode &&
    curNamaMenu === snapNamaMenu &&
    curQty === snapQty;

  if (!same) {
    return json_({
      success: false,
      error: "Data baris sudah berubah/bergeser. Refresh list lalu ulangi.",
      errorType: "stale"
    });
  }

  sheet.deleteRow(rowIndex);
  Logger.log("🗑️ Pesanan dihapus (admin): baris " + rowIndex + " — " + snapKode + " / " + snapNamaMenu);

  return json_({ success: true });
}

// ─── ADMIN: LIST MEMBER (ringkas, untuk dropdown halaman Admin/Member) ────

/**
 * Action: adminGetMemberList — daftar RINGKAS member (kode + username saja)
 * untuk isi searchable dropdown. Data pribadi (WA, tanggal lahir, domisili,
 * foto) TIDAK ikut — itu baru keluar via adminGetMemberDetail setelah admin
 * memilih member (dan tetap di balik PIN).
 * PIN wajib valid.
 */
function doPostAdminGetMemberList_(e) {
  var reject = checkAdminPin_(trim_(e.parameter.pin));
  if (reject) return reject;

  var sheet = getMemberSheet_();
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var usernameCol = COLUMNS.indexOf("Username") + 1;
  var lastRow = sheet.getLastRow();
  var memberList = [];

  if (lastRow >= 2) {
    var kodeLastCol = Math.max(kodeCol, usernameCol);
    var data = sheet.getRange(2, kodeCol, lastRow - 1, kodeLastCol - kodeCol + 1).getValues();
    data.forEach(function (r) {
      var kode = String(r[0]).trim();
      var uname = String(r[kodeLastCol - kodeCol]).trim();
      if (kode !== "") {
        memberList.push({ kode: kode, username: uname || "" });
      }
    });
  }

  return json_({ success: true, memberList: memberList });
}

// ─── ADMIN: DETAIL MEMBER ─────────────────────────────────────────────────

/**
 * Action: adminGetMemberDetail — data lengkap satu member (semua kolom
 * tab Member) untuk form edit di halaman Admin/Member.
 * Endpoint publik TIDAK boleh expose data pribadi tanpa PIN — makanya ini
 * POST + PIN, bukan GET publik.
 * PIN wajib valid. rowIndex absolut disertakan untuk revalidasi saat update.
 */
function doPostAdminGetMemberDetail_(e) {
  var reject = checkAdminPin_(trim_(e.parameter.pin));
  if (reject) return reject;

  var kode = trim_(e.parameter.kodeMembership);
  if (!kode) {
    return json_({ success: false, error: "Kode membership wajib diisi" });
  }

  var sheet = getMemberSheet_();
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return json_({ success: false, error: "Kode membership tidak ditemukan" });
  }

  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][kodeCol - 1]).trim() !== kode) continue;

    var sheetRow = i + 2; // baris sheet absolut
    var ts = data[i][COLUMNS.indexOf("Tanggal Lahir")];
    // Tanggal lahir dikirim apa adanya (string sheet); client menormalisasi
    // ke format YYYY-MM-DD untuk <input type="date">.
    return json_({
      success: true,
      member: {
        rowIndex: sheetRow,
        kodeMembership: kode,
        nama: String(data[i][COLUMNS.indexOf("Nama")]).trim(),
        domisili: String(data[i][COLUMNS.indexOf("Domisili")]).trim(),
        tanggalLahir: String(ts),
        umur: data[i][COLUMNS.indexOf("Umur")],
        jenisKelamin: String(data[i][COLUMNS.indexOf("Jenis Kelamin")]).trim(),
        status: String(data[i][COLUMNS.indexOf("Status")]).trim(),
        nomorWhatsApp: String(data[i][COLUMNS.indexOf("Nomor WhatsApp")]).trim(),
        fotoUrl: String(data[i][COLUMNS.indexOf("Foto Profil (URL Drive)")]).trim(),
        username: String(data[i][COLUMNS.indexOf("Username")]).trim()
      }
    });
  }

  return json_({ success: false, error: "Kode membership tidak ditemukan" });
}

// ─── ADMIN: UPDATE MEMBER ─────────────────────────────────────────────────

/**
 * Action: adminUpdateMember — update baris member di sheet.
 * Urutan wajib: validasi PIN → revalidasi snapshot rowIndex (kode+nama
 * harus masih cocok, cegah update ke baris yang salah) → validasi field →
 * KODE MEMBERSHIP DILARANG berubah (field-nya DIABAIKAN dari payload —
 * defense-in-depth, tidak percaya client) → username unik (exclude member
 * yang sedang diedit) → tulis ulang baris.
 */
function doPostAdminUpdateMember_(e) {
  var reject = checkAdminPin_(trim_(e.parameter.pin));
  if (reject) return reject;

  var rowIndex = parseInt(e.parameter.rowIndex, 10);
  var snapKode = trim_(e.parameter.snapKode);
  var nama = trim_(e.parameter.Nama);
  var domisili = trim_(e.parameter.Domisili);
  var tanggalLahir = trim_(e.parameter.TanggalLahir);
  var jenisKelamin = trim_(e.parameter.JenisKelamin);
  var status = trim_(e.parameter.Status);
  var nomorWhatsApp = trim_(e.parameter.NomorWhatsApp);
  var username = trim_(e.parameter.Username);
  // e.parameter.kodeMembership SENGAJA TIDAK dibaca — Kode Membership
  // tidak pernah bisa diubah lewat endpoint ini (defense-in-depth;
  // kalau client mengirimnya, field ini diabaikan total).

  if (isNaN(rowIndex) || rowIndex < 2) {
    return json_({ success: false, error: "rowIndex tidak valid" });
  }

  var sheet = getMemberSheet_();
  var lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) {
    return json_({ success: false, error: "Baris member sudah tidak ada. Muat ulang halaman.", errorType: "stale" });
  }

  // Revalidasi: baris di rowIndex harus masih baris member yang diedit.
  var kodeCol = COLUMNS.indexOf("Kode Membership") + 1;
  var namaCol = COLUMNS.indexOf("Nama") + 1;
  var curKode = String(sheet.getRange(rowIndex, kodeCol, 1, 1).getValues()[0][0]).trim();
  if (curKode !== snapKode) {
    return json_({
      success: false,
      error: "Data member sudah berubah/bergeser. Muat ulang halaman lalu ulangi.",
      errorType: "stale"
    });
  }

  // Validasi field required (pola doPostPendaftaran_)
  var errors = [];
  if (!nama) errors.push("Nama wajib diisi");
  if (!domisili) errors.push("Domisili wajib diisi");
  if (!tanggalLahir) errors.push("Tanggal Lahir wajib diisi");
  if (!jenisKelamin) errors.push("Jenis Kelamin wajib diisi");
  if (!status) errors.push("Status wajib diisi");
  if (!nomorWhatsApp) errors.push("Nomor WhatsApp wajib diisi");
  if (!username) errors.push("Username wajib diisi");
  if (errors.length > 0) {
    return json_({ success: false, error: "Field tidak lengkap: " + errors.join("; ") });
  }

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return json_({
      success: false,
      error: "Username hanya boleh berisi huruf, angka, dan underscore (3–20 karakter).",
      errorType: "username_format"
    });
  }

  if (!/^08\d/.test(nomorWhatsApp) && !/^62\d/.test(nomorWhatsApp)) {
    return json_({ success: false, error: "Nomor WhatsApp harus diawali 08 atau 62." });
  }

  // Username unik — EXCLUDE member yang sedang diedit sendiri: scan semua
  // baris, kecuali baris(rowIndex). Jadi admin boleh menyimpan username
  // yang memang milik member ini (tidak dianggap collision), tapi tidak
  // boleh menyamakan dengan username member LAIN.
  var usernameCol = COLUMNS.indexOf("Username") + 1;
  if (lastRow >= 2) {
    var unameData = sheet.getRange(2, usernameCol, lastRow - 1, 1).getValues();
    var target = username.toLowerCase();
    for (var i = 0; i < unameData.length; i++) {
      if (i + 2 === rowIndex) continue; // diri sendiri → skip
      if (String(unameData[i][0]).trim().toLowerCase() === target) {
        return json_({
          success: false,
          error: "Username \"" + username + "\" sudah dipakai member lain.",
          errorType: "username_taken"
        });
      }
    }
  }

  // Tanggal lahir: simpan sebagai Date object (konsisten format kolom);
  // umur dihitung ulang server-side (single source of truth).
  var parts = tanggalLahir.split("-");
  var tglLahirDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var umur = hitungUmur_(tanggalLahir);

  // Tulis ulang kolom member yang boleh diubah, urutan = COLUMNS:
  //   Nama(3), Domisili(4), TanggalLahir(5), Umur(6)  → 1x setValues (blok)
  //   JenisKelamin(7), Status(8)                      → 1x setValues (blok)
  //   NomorWhatsApp(9) dan Username(11) → sel tunggal (kolom Foto(10) di
  //   antaranya TIDAK disentuh — foto tidak termasuk field edit di sini).
  // Kolom Kode Membership (2) TIDAK disentuh — nilainya tetap.
  sheet.getRange(rowIndex, namaCol, 1, 4).setValues([[nama, domisili, tglLahirDate, umur]]);
  sheet.getRange(rowIndex, COLUMNS.indexOf("Jenis Kelamin") + 1, 1, 2)
    .setValues([[jenisKelamin, status]]);
  sheet.getRange(rowIndex, COLUMNS.indexOf("Nomor WhatsApp") + 1, 1, 1)
    .setValues([[nomorWhatsApp]]);
  sheet.getRange(rowIndex, COLUMNS.indexOf("Username") + 1, 1, 1)
    .setValues([[username]]);

  Logger.log("✏️ Member diupdate (admin): " + snapKode + " → " + username);

  return json_({ success: true });
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
