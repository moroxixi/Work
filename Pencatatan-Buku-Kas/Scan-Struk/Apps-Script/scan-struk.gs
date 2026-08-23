/**
 * ============================================================
 * SCAN STRUK BELANJA — Backend terpisah, khusus riwayat harga.
 * TIDAK terhubung ke Buku Kas Gabungan / Tempura / Wonton.
 * ============================================================
 *
 * SETUP SEKALI JALAN:
 * 1. Buka spreadsheet baru (kosong), kasih nama misal "Data Harga Belanja".
 * 2. Extensions -> Apps Script, hapus isi default, paste file ini.
 * 3. Project Settings (ikon gerigi kiri) -> Script Properties -> Add script property
 *    UNTUK MASING-MASING dari 6 API key (idealnya dari akun/project Google
 *    berbeda-beda supaya kuota benar-benar terpisah):
 *      Key   : GEMINI_API_KEY_1   Value: (api key ke-1)
 *      Key   : GEMINI_API_KEY_2   Value: (api key ke-2)
 *      Key   : GEMINI_API_KEY_3   Value: (api key ke-3)
 *      Key   : GEMINI_API_KEY_4   Value: (api key ke-4)
 *      Key   : GEMINI_API_KEY_5   Value: (api key ke-5)
 *      Key   : GEMINI_API_KEY_6   Value: (api key ke-6)
 * 4. Deploy -> New deployment -> Web app:
 *      Execute as   : Me
 *      Who has access: Anyone
 * 5. Copy URL Web App yang muncul, tempel ke SCRIPT_URL di scan-struk.html.
 * 6. Setiap edit file ini, WAJIB Deploy ulang (Manage deployments -> Edit -> New version).
 */

const SHEET_NAME = "Input Harga Belanja";
const GEMINI_MODEL = "gemini-3.5-flash"; // cek aistudio.google.com kalau nama model berubah/error 404
const JUMLAH_API_KEY = 6; // sesuaikan kalau nambah/kurang key di Script Properties

function doGet(e) {
  return ContentService.createTextOutput("Endpoint Scan Struk aktif...");
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "scan") {
      const items = callGeminiOCR_(body.imageBase64, body.mimeType);
      return jsonResponse_({ ok: true, items: items });
    }

    if (action === "save") {
      const result = saveItems_(body.toko, body.items);
      return jsonResponse_({ ok: true, saved: result.saved, skipped: result.skipped });
    }

    if (action === "list") {
      // READ-ONLY: baca semua baris histori harga, tanpa menulis apapun ke sheet.
      return jsonResponse_({ ok: true, items: listItems_() });
    }

    if (action === "edit") {
      const result = handleEditItem_(body);
      return jsonResponse_(result);
    }

    if (action === "delete") {
      const result = handleDeleteItem_(body);
      return jsonResponse_(result);
    }

    return jsonResponse_({ ok: false, error: "Action tidak dikenali: " + action });

  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function jsonResponse_(obj) {
  // text/plain sengaja dipakai (bukan application/json) supaya browser TIDAK
  // trigger CORS preflight (OPTIONS) yang tidak didukung Apps Script.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ambil semua API key Gemini yang terdaftar di Script Properties
 * (GEMINI_API_KEY_1 s/d GEMINI_API_KEY_6).
 */
function getGeminiApiKeys_() {
  const props = PropertiesService.getScriptProperties();
  const keys = [];
  for (let i = 1; i <= JUMLAH_API_KEY; i++) {
    const k = props.getProperty("GEMINI_API_KEY_" + i);
    if (k) keys.push(k);
  }
  if (keys.length === 0) {
    throw new Error("Tidak ada GEMINI_API_KEY_1..." + JUMLAH_API_KEY + " yang diset di Script Properties.");
  }
  return keys;
}

/**
 * Panggil Gemini generateContent dengan fallback antar API key.
 * Key ke-1 dicoba dulu; kalau gagal karena overload/limit (retryable),
 * otomatis pindah ke key berikutnya. Kalau errornya bukan soal
 * overload/limit (misal request salah format), langsung stop tanpa
 * mencoba key lain.
 */
function callGeminiGenerateContent_(payload) {
  const keys = getGeminiApiKeys_();
  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODEL + ":generateContent?key=" + keys[i];

    let res;
    try {
      res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (fetchErr) {
      lastError = "Key ke-" + (i + 1) + " gagal fetch: " + fetchErr;
      Logger.log(lastError);
      continue; // coba key berikutnya
    }

    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code === 200) {
      Logger.log("Sukses pakai key ke-" + (i + 1));
      return JSON.parse(text);
    }

    const isRetryable = code === 429 || code === 503 ||
      text.indexOf("high demand") !== -1 ||
      text.indexOf("quota") !== -1 ||
      text.indexOf("RESOURCE_EXHAUSTED") !== -1 ||
      text.indexOf("UNAVAILABLE") !== -1;

    lastError = "Key ke-" + (i + 1) + " gagal (HTTP " + code + "): " + text;
    Logger.log(lastError);

    if (!isRetryable) {
      // Error permanen (misal API key salah/invalid, request salah format)
      // — tidak ada gunanya coba key lain, langsung lempar error.
      throw new Error(lastError);
    }
    // Kalau retryable, lanjut ke key berikutnya di iterasi berikutnya.
  }

  // Semua key sudah dicoba dan tetap gagal.
  throw new Error("Semua " + keys.length + " API key Gemini gagal dicoba. Error terakhir: " + lastError);
}

/**
 * Kirim foto struk ke Gemini, minta diekstrak jadi JSON list barang.
 */
function callGeminiOCR_(imageBase64, mimeType) {
  const prompt = "Ini foto struk belanja bahan baku. Baca semua baris barang di struk ini. " +
    "Balas HANYA dengan JSON array (tanpa markdown, tanpa penjelasan), format persis: " +
    '[{"nama":"nama barang","qty":angka,"satuan":"kg/pcs/ikat/dus/dll","harga_satuan":angka}]. ' +
    "harga_satuan = harga per satuan dalam Rupiah (angka murni tanpa titik/koma/Rp). " +
    "qty = jumlah satuan yang dibeli (angka, boleh desimal). " +
    "Kalau struk cuma menampilkan harga total per baris (bukan harga satuan), hitung harga_satuan = total / qty. " +
    "Kalau ada baris yang tidak jelas/tidak terbaca, lewati baris itu saja, jangan mengarang.";

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } }
      ]
    }],
    generationConfig: { temperature: 0 }
  };

  const data = callGeminiGenerateContent_(payload);
  if (data.error) throw new Error("Gemini error: " + data.error.message);

  let text = data.candidates[0].content.parts[0].text.trim();
  // Buang pembungkus ```json ... ``` kalau ada
  text = text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Gemini tidak mengembalikan JSON array yang valid.");

  const jsonStr = text.substring(start, end + 1);
  const items = JSON.parse(jsonStr);
  return items;
}

/**
 * Simpan item yang sudah dikonfirmasi user ke sheet "Input Harga Belanja".
 * Kombinasi Toko + Nama Barang + Harga Satuan yang SUDAH PERNAH tercatat
 * (kapan pun sebelumnya) tidak akan disimpan lagi — dianggap data yang
 * sama persis, tidak perlu diulang.
 */
function saveItems_(toko, items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", "Toko", "Nama Barang", "Qty", "Satuan",
      "Harga Satuan (Rp)", "Harga Total (Rp)"
    ]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
  }

  const existingKeys = getExistingKeys_(sheet);

  const timestamp = formatTimestampWIB_(new Date());
  const rows = [];
  let skipped = 0;

  items.forEach(function (item) {
    const qty = Number(item.qty) || 0;
    const harga = Number(item.harga_satuan) || 0;
    const key = normalizeKey_(toko, item.nama, harga);

    if (existingKeys.has(key)) {
      skipped++;
      return; // kombinasi sudah pernah ada, lewati
    }
    existingKeys.add(key); // biar duplikat DALAM satu batch scan yang sama juga ke-detect

    rows.push([timestamp, toko, item.nama, qty, item.satuan || "", harga, qty * harga]);
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  }

  return { saved: rows.length, skipped: skipped };
}

/**
 * Baca semua baris existing di sheet, bikin Set kombinasi
 * "toko|nama barang|harga satuan" (dinormalisasi) yang sudah pernah tercatat.
 */
function getExistingKeys_(sheet) {
  const keys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys; // cuma header, belum ada data

  // Ambil kolom B:F (Toko, Nama Barang, Qty, Satuan, Harga Satuan)
  const data = sheet.getRange(2, 2, lastRow - 1, 5).getValues();
  data.forEach(function (row) {
    const toko = row[0];   // kolom B
    const nama = row[1];   // kolom C
    const harga = row[4];  // kolom F
    keys.add(normalizeKey_(toko, nama, harga));
  });
  return keys;
}

function normalizeKey_(toko, nama, harga) {
  return String(toko).trim().toLowerCase() + "|" +
         String(nama).trim().toLowerCase() + "|" +
         (Number(harga) || 0);
}

function formatTimestampWIB_(date) {
  return Utilities.formatDate(date, "GMT+7", "dd/MM/yyyy HH:mm:ss");
}

/**
 * READ-ONLY — baca semua baris sheet "Input Harga Belanja" (skip header row),
 * kembalikan array of object { timestamp, toko, nama, qty, satuan,
 * harga_satuan, harga_total }. Tidak mengubah/menulis apapun ke sheet.
 * Urutan sesuai urutan baris sheet (paling lama di atas); pengurutan
 * "terbaru dulu" dilakukan di frontend (Rekap) biar backend tetap murni read.
 */
function listItems_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return []; // sheet belum pernah dibuat

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // cuma header, belum ada data

  // Kolom A:G = Timestamp, Toko, Nama Barang, Qty, Satuan,
  // Harga Satuan (Rp), Harga Total (Rp) — sama dengan header yang ditulis saveItems_.
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const items = [];
  data.forEach(function (row, idx) {
    items.push({
      row: idx + 2,                     // nomor baris asli di sheet (header = baris 1)
      timestamp: String(row[0] || ""),   // kolom A
      toko: String(row[1] || ""),        // kolom B
      nama: String(row[2] || ""),        // kolom C
      qty: Number(row[3]) || 0,           // kolom D
      satuan: String(row[4] || ""),      // kolom E
      harga_satuan: Number(row[5]) || 0,  // kolom F
      harga_total: Number(row[6]) || 0    // kolom G
    });
  });
  return items;
}

/**
 * Edit satu baris item harga berdasarkan nomor baris di sheet.
 * Field yang bisa diubah: toko, nama, qty, satuan, harga_satuan.
 * harga_total dihitung ulang otomatis (qty * harga_satuan).
 * Timestamp asli dipertahankan (tidak diubah saat edit).
 */
function handleEditItem_(data) {
  const row = Number(data.row);
  if (!row || row < 2) return { ok: false, error: "Nomor baris tidak valid." };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: "Sheet tidak ditemukan." };

  if (row > sheet.getLastRow()) return { ok: false, error: "Baris tidak ditemukan." };

  const qty = Number(data.qty) || 0;
  const harga = Number(data.harga_satuan) || 0;

  sheet.getRange(row, 2).setValue((data.toko || "").toString().trim());       // B: Toko
  sheet.getRange(row, 3).setValue((data.nama || "").toString().trim());       // C: Nama Barang
  sheet.getRange(row, 4).setValue(qty);                                        // D: Qty
  sheet.getRange(row, 5).setValue((data.satuan || "").toString().trim());     // E: Satuan
  sheet.getRange(row, 6).setValue(harga);                                      // F: Harga Satuan
  sheet.getRange(row, 7).setValue(qty * harga);                               // G: Harga Total

  return { ok: true };
}

/**
 * Hapus satu baris item harga berdasarkan nomor baris di sheet.
 */
function handleDeleteItem_(data) {
  const row = Number(data.row);
  if (!row || row < 2) return { ok: false, error: "Nomor baris tidak valid." };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: "Sheet tidak ditemukan." };

  if (row > sheet.getLastRow()) return { ok: false, error: "Baris tidak ditemukan." };

  sheet.deleteRow(row);
  return { ok: true };
}
