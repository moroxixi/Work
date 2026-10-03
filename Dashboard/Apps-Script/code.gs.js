/**
 * Dashboard — backend Google Apps Script (salinan SETIA dari editor).
 *
 * File ini disimpan di repo AGAR REPO = VERSI YANG ADA DI EDITOR Apps Script
 * (riwayat perubahan backend ikut tercatat di git).
 *
 * CATATAN DEPLOY:
 * - Fitur section di front-end TIDAK mengharuskan deploy ulang: doGet
 *   meneruskan SEMUA kolom apa adanya, sehingga kolom baru di Sheet otomatis
 *   ikut terbawa ke respons {projects, bookmarks}.
 * - Kolom opsional `section` (kosong -> fallback business/projects) ditambah
 *   oleh USER MANUAL di Sheet. Tidak ada kode yang mengubah format Sheet,
 *   dan tidak ada fungsi backfill.
 * - Deploy ulang HANYA perlu bila ingin menyamakan isi editor Apps Script
 *   dengan file ini: tempel kode -> simpan -> Deploy > Kelola deployment >
 *   ikon pensil (Edit) > Versi: "Versi baru" > Deploy (URL tetap sama).
 *
 * TIDAK ada doPost dan TIDAK ada trigger (time-based/installable) di file ini.
 *
 * Kontrak respons: {projects:[...], bookmarks:[...]}
 * (atau {error:"..."} bila SHEET_NAME diisi tetapi tab-nya tidak ada).
 */

/**
 * Nama tab sheet.
 * - "" (kosong) -> memakai sheet aktif lewat getActiveSheet(), persis seperti
 *   perilaku aslinya.
 * - Terisi nama tab -> getSheetByName; bila tab tidak ada, kembalikan JSON
 *   {error:...} (bukan exception).
 */
const SHEET_NAME = "";

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet;
  if (SHEET_NAME) {
    sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: `Tab sheet '${SHEET_NAME}' tidak ditemukan.` })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } else {
    sheet = ss.getActiveSheet();
  }

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const projects = [];
  const bookmarks = [];
  data.forEach(row => {
    // Lewati baris yang semua selnya kosong.
    const kosong = row.every(c =>
      c === '' || c === null || c === undefined ||
      (typeof c === 'string' && c.trim() === '')
    );
    if (kosong) return;

    let obj = {};
    headers.forEach((header, i) => obj[String(header).trim().toLowerCase()] = row[i]);
    if (obj.type === 'bookmark') { bookmarks.push(obj); } else { projects.push(obj); }
  });
  const result = { projects: projects, bookmarks: bookmarks };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
