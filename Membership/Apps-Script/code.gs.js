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
var COLUMNS_SUBMIT_PESANAN = [
  "Timestamp",
  "Kode Membership",
  "Nama Menu",
  "Qty",
  "Foto Produk (URL Drive)"
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
      Logger.log("⚠️ Tab 'Submit Pesanan' sudah ada isi. Skip.");
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
      fotoUrl              // Foto Produk (URL Drive)
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

// ─── HELPER ─────────────────────────────────────────────────────────────────

function trim_(val) {
  return String(val || "").trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
