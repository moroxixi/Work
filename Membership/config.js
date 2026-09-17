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
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxHQDRGmuZOvM5fNQW0Ov5cdH0efFgcLfPVdNt7XbnOur3Z9PWphbHGPs95Y1LeJ8pwnA/exec"
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
