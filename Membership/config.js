/**
 * MAO Membership — Shared Config + Utilities
 *
 * Di-load oleh Pendaftaran/index.html dan Submit/index.html
 * SEBELUM script.js masing-masing, supaya global `MAO_CONFIG`
 * sudah terdefinisi saat script.js dipanggil.
 *
 * TODO(Rofi): isi GAS_WEB_APP_URL dengan URL Web App Apps Script
 * setelah deploy (format: https://script.google.com/macros/s/.../exec).
 */
const MAO_CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyg2riL55LTv-tiJcm-AhfGcyN0VaVN7HvkwXc6wyTxIw7NWbxZflES9PGdO0ry4a-Q/exec"
};

/**
 * Kompres gambar via canvas: resize sisi terpanjang ke max 1280px,
 * encode JPEG quality 0.7, lalu convert ke base64 (tanpa prefix data URL).
 * Dipakai bersama oleh Submit (foto pesanan) dan Pendaftaran (foto profil).
 *
 * @param {File} file - file gambar dari <input type="file">
 * @returns {Promise<{base64: string, mimeType: string}>}
 *   base64 tanpa prefix "data:...;base64," — siap dikirim via URLSearchParams.
 */
MAO_CONFIG.compressImageToBase64 = function (file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          var maxDim = 1280;
          var w = img.width;
          var h = img.height;

          if (w > h && w > maxDim) {
            h = Math.round(h * (maxDim / w));
            w = maxDim;
          } else if (h >= w && h > maxDim) {
            w = Math.round(w * (maxDim / h));
            h = maxDim;
          }

          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error("canvas.toBlob returned null"));
              return;
            }
            // Convert blob → base64 (tanpa prefix data URL)
            var blobReader = new FileReader();
            blobReader.onload = function () {
              var base64 = String(blobReader.result).split(",")[1];
              resolve({ base64: base64, mimeType: "image/jpeg" });
            };
            blobReader.onerror = function () {
              reject(new Error("Gagal convert blob ke base64"));
            };
            blobReader.readAsDataURL(blob);
          }, "image/jpeg", 0.7);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = function () { reject(new Error("Gagal memuat gambar")); };
      img.src = e.target.result;
    };
    reader.onerror = function () { reject(new Error("Gagal membaca file")); };
    reader.readAsDataURL(file);
  });
};

/**
 * Blob/File → base64 mentah (tanpa prefix "data:...;base64,").
 * Dipakai sebagai fallback kalau kompresi canvas tidak mungkin dilakukan.
 *
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
MAO_CONFIG.blobToBase64 = function (blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result).split(",")[1]);
    };
    reader.onerror = function () { reject(new Error("Gagal convert blob ke base64")); };
    reader.readAsDataURL(blob);
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE — URL GAMBAR (dipakai halaman Hadiah & Admin/Check-Pesanan)
// ═══════════════════════════════════════════════════════════════════════════
// Kolom "URL Foto" di sheet diisi link share Drive apa adanya, mis:
//   https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drivesdk
//   https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing
//   https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drive_link
//   https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp&usp=drivesdk
// Link semacam itu TIDAK bisa langsung jadi <img src> (itu halaman HTML,
// bukan file gambar). Yang bisa: /thumbnail?id=<ID> atau /d/<ID> (lh3).

/**
 * Ekstrak Google Drive file ID dari berbagai bentuk link share.
 * Sengaja HANYA memproses host Google/Drive — supaya URL gambar non-Drive
 * yang kebetulan punya parameter ?id= tidak ikut diubah jadi link Drive.
 *
 * @param {string} url
 * @returns {string} file ID, atau '' kalau tidak ada / bukan link Drive
 */
MAO_CONFIG.extractDriveFileId = function (url) {
  var s = String(url || "").trim();
  if (!s) return "";

  if (!/(drive|docs)\.google\.com|googleusercontent\.com/i.test(s)) return "";

  var patterns = [
    /\/file\/d\/([A-Za-z0-9_-]{10,})/,        // /file/d/<ID>/view?usp=drivesdk|sharing|drive_link
    /\/d\/([A-Za-z0-9_-]{10,})/,              // /d/<ID> (dan lh3.googleusercontent.com/d/<ID>)
    /[?&]id=([A-Za-z0-9_-]{10,})/,            // open?id=<ID>, uc?id=<ID>
    /\/document\/d\/([A-Za-z0-9_-]{10,})/     // link Docs/Sheets (defensif)
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = s.match(patterns[i]);
    if (m) return m[1];
  }

  return "";
};

/**
 * URL gambar yang bisa dipakai sebagai <img src>.
 * Link Drive → https://drive.google.com/thumbnail?id=<ID>&sz=<lebar>.
 * URL non-Drive dikembalikan apa adanya (mis. gambar statis lokal).
 *
 * @param {string} url
 * @param {string} [size] - 'big' (lightbox, w1600) atau default 'small' (w400)
 * @returns {string}
 */
MAO_CONFIG.driveImageUrl = function (url, size) {
  var id = MAO_CONFIG.extractDriveFileId(url);
  if (!id) return String(url || "");
  var width = (size === "big") ? "w1600" : "w400";
  return "https://drive.google.com/thumbnail?id=" + id + "&sz=" + width;
};

/**
 * URL cadangan kalau /thumbnail diblokir (mis. file Drive belum di-share
 * "Anyone with the link") — lh3.googleusercontent.com/d/<ID>.
 *
 * @param {string} url
 * @returns {string} URL cadangan, atau '' kalau bukan link Drive
 */
MAO_CONFIG.driveImageFallbackUrl = function (url) {
  var id = MAO_CONFIG.extractDriveFileId(url);
  return id ? "https://lh3.googleusercontent.com/d/" + id + "=w1000" : "";
};

/**
 * Pasang penanganan gagal-load berlapis pada <img> foto Drive:
 *   1. thumbnail?id=<ID> (src awal, di-set caller)
 *   2. lh3.googleusercontent.com/d/<ID> (sekali)
 *   3. onFail() → caller menampilkan placeholder
 *
 * Panggil SEBELUM men-set img.src supaya error pertama tetap tertangkap.
 *
 * @param {HTMLImageElement} img
 * @param {string} url - URL asli dari sheet (untuk ambil ID)
 * @param {function} [onFail] - dipanggil kalau semua URL gagal
 */
MAO_CONFIG.attachDriveImageFallback = function (img, url, onFail) {
  var alt = MAO_CONFIG.driveImageFallbackUrl(url);
  var triedAlt = false;

  img.addEventListener("error", function () {
    if (alt && !triedAlt) {
      triedAlt = true;
      img.src = alt;
      return;
    }
    if (typeof onFail === "function") onFail();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// FOTO UPLOAD — DETEKSI + PENYIAPAN (dipakai Pendaftaran & Submit)
// ═══════════════════════════════════════════════════════════════════════════
// Backend (validateFotoBase64_ di code.gs.js) HANYA menerima gambar dengan
// magic bytes JPEG (FF D8 FF) atau PNG (89 50 4E 47) — keputusan diambil dari
// isi file, bukan dari fotoMimeType. Helper di bawah memastikan apa yang
// dikirim client SELALU salah satu dari dua format itu, atau gagal dengan
// pesan yang jelas SEBELUM request dikirim.

/**
 * Deteksi jenis gambar ASLI dari beberapa byte pertama file (magic bytes).
 * Tidak bergantung pada File.type — di sebagian device (hasil capture kamera,
 * file manager tertentu) File.type bisa kosong, "image/jpg", atau salah.
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} 'jpeg'|'png'|'webp'|'gif'|'bmp'|'heic'|'' (tidak dikenal)
 */
MAO_CONFIG.detectImageKind = function (file) {
  return new Promise(function (resolve) {
    function bytesOf(buffer) {
      try { return new Uint8Array(buffer); } catch (e) { return null; }
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      var b = bytesOf(e.target.result);
      if (!b || b.length < 4) { resolve(""); return; }

      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) { resolve("jpeg"); return; }
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) { resolve("png"); return; }
      if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) { resolve("gif"); return; }
      if (b[0] === 0x42 && b[1] === 0x4d) { resolve("bmp"); return; }
      if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
        resolve("webp"); // "WEBP" di offset 8
        return;
      }

      // HEIC/HEIF/AVIF: box "ftyp" di offset 4 + brand 4 byte berikutnya.
      if (b.length >= 12) {
        var box = String.fromCharCode(b[4], b[5], b[6], b[7]);
        var brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
        if (box === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|avif)/.test(brand)) {
          resolve("heic");
          return;
        }
      }

      resolve("");
    };
    reader.onerror = function () { resolve(""); };

    try {
      reader.readAsArrayBuffer(file.slice(0, 16));
    } catch (err) {
      resolve("");
    }
  });
};

/**
 * Siapkan foto untuk dikirim ke backend (action daftar / submitOrder).
 *
 * Jaminan hasil: byte JPEG atau PNG — persis yang diterima
 * validateFotoBase64_() di code.gs.js.
 *
 * Jalur:
 *   1. Kompresi canvas → JPEG (selalu dicoba duluan; sekaligus perkecil payload).
 *   2. Canvas gagal TAPI file aslinya JPEG/PNG → pakai byte asli apa adanya
 *      (server tetap menerimanya via magic bytes).
 *   3. Selain itu (HEIC di browser non-Safari, WebP/GIF yang tidak bisa
 *      di-decode, atau file bukan gambar) → gagal dengan pesan jelas. File
 *      TIDAK dikirim, karena server pasti menolaknya dengan pesan generik
 *      "Format foto tidak didukung" yang membingungkan user.
 *
 * @param {File|Blob} file
 * @returns {Promise<{base64:string, mimeType:string, kind:string, compressed:boolean}>}
 */
MAO_CONFIG.prepareFotoForUpload = function (file) {
  return MAO_CONFIG.detectImageKind(file).then(function (kind) {
    return MAO_CONFIG.compressImageToBase64(file).then(
      function (result) {
        return {
          base64: result.base64,
          mimeType: result.mimeType,
          kind: kind || "jpeg",
          compressed: true
        };
      },
      function (compressErr) {
        if (kind === "jpeg" || kind === "png") {
          return MAO_CONFIG.blobToBase64(file).then(function (base64) {
            return {
              base64: base64,
              mimeType: kind === "png" ? "image/png" : "image/jpeg",
              kind: kind,
              compressed: false
            };
          });
        }

        var err = new Error(
          "Format foto tidak didukung browser ini. Gunakan foto JPG atau PNG " +
          "(foto HEIC dari iPhone bisa diubah ke JPG di pengaturan kamera)."
        );
        err.code = "unsupported_image_format";
        err.detectedKind = kind || "unknown";
        err.cause = compressErr;
        throw err;
      }
    );
  });
};
