/**
 * MAO Membership — Submit Pesanan (Client-side)
 *
 * Fetches kode membership + menu list from GAS on load,
 * renders menu stepper, compresses photo client-side,
 * and POSTs order data via URLSearchParams.
 */

// ─── ENDPOINT ───────────────────────────────────────────────────────────────
const GAS_WEB_APP_URL = "<GAS_WEB_APP_URL_DI_SINI>";

// ─── DOM REFERENCES ─────────────────────────────────────────────────────────
const loadingState     = document.getElementById("loadingState");
const orderForm        = document.getElementById("orderForm");
const kodeSelect       = document.getElementById("kodeMembership");
const kodeEmptyMsg     = document.getElementById("kodeEmptyMsg");
const menuListEl       = document.getElementById("menuList");
const menuEmptyMsg     = document.getElementById("menuEmptyMsg");
const fotoInput        = document.getElementById("fotoInput");
const uploadArea       = document.getElementById("uploadArea");
const uploadPlaceholder= document.getElementById("uploadPlaceholder");
const fotoPreview      = document.getElementById("fotoPreview");
const submitBtn        = document.getElementById("submitBtn");
const btnText          = submitBtn.querySelector(".btn-text");
const btnLoading       = submitBtn.querySelector(".btn-loading");
const errorMsg         = document.getElementById("errorMsg");
const successMsg       = document.getElementById("successMsg");

// ─── STATE ──────────────────────────────────────────────────────────────────
let menuData = [];       // [{namaMenu, qty}] — qty starts at 0
let compressedBlob = null; // compressed foto blob before submit
let compressedMimeType = "";
let compressedFileName = "";

// ─── INIT: fetch kode list + menu list ─────────────────────────────────────

(async function init() {
  try {
    const resp = await fetch(GAS_WEB_APP_URL + "?action=getFormData");
    const json = await resp.json();

    if (!json.success) {
      throw new Error(json.error || "Gagal memuat data");
    }

    renderKodeList(json.kodeList || []);
    renderMenuList(json.menuList || []);

    // Tampilkan form, sembunyikan loading
    loadingState.hidden = true;
    orderForm.hidden = false;

  } catch (err) {
    console.error("Init error:", err);
    loadingState.innerHTML =
      '<p style="color:var(--danger)">Gagal memuat data: ' + escapeHtml(err.message) + "</p>";
  }
})();

// ─── RENDER KODE MEMBERSHIP DROPDOWN ───────────────────────────────────────

function renderKodeList(kodeList) {
  // Filter: skip kosong, skip header-like values
  const clean = kodeList
    .map(function (k) { return String(k).trim(); })
    .filter(function (k) { return k !== "" && k !== "Kode Membership"; });

  if (clean.length === 0) {
    kodeSelect.disabled = true;
    kodeSelect.innerHTML =
      '<option value="" disabled selected>Belum ada kode membership terdaftar</option>';
    kodeEmptyMsg.hidden = false;
    submitBtn.disabled = true;
    return;
  }

  clean.forEach(function (kode) {
    var opt = document.createElement("option");
    opt.value = kode;
    opt.textContent = kode;
    kodeSelect.appendChild(opt);
  });
}

// ─── RENDER MENU LIST WITH STEPPER ─────────────────────────────────────────

function renderMenuList(menuList) {
  const clean = menuList
    .map(function (m) { return String(m).trim(); })
    .filter(function (m) { return m !== "" && m !== "Nama Menu"; });

  if (clean.length === 0) {
    menuEmptyMsg.hidden = false;
    submitBtn.disabled = true;
    return;
  }

  menuData = clean.map(function (nama) {
    return { namaMenu: nama, qty: 0 };
  });

  menuData.forEach(function (item, idx) {
    var div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML =
      '<span class="menu-name">' + escapeHtml(item.namaMenu) + "</span>" +
      '<div class="stepper">' +
        '<button type="button" class="btn-minus" data-idx="' + idx + '">−</button>' +
        '<span class="qty-value" id="qty-' + idx + '">0</span>' +
        '<button type="button" class="btn-plus" data-idx="' + idx + '">+</button>' +
      "</div>";
    menuListEl.appendChild(div);
  });

  // Event delegation for stepper buttons
  menuListEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".btn-minus, .btn-plus");
    if (!btn) return;
    var idx = parseInt(btn.getAttribute("data-idx"), 10);
    if (btn.classList.contains("btn-plus")) {
      menuData[idx].qty++;
    } else {
      if (menuData[idx].qty > 0) menuData[idx].qty--;
    }
    document.getElementById("qty-" + idx).textContent = menuData[idx].qty;
  });
}

// ─── PHOTO UPLOAD + COMPRESSION ─────────────────────────────────────────────

// Click upload area → trigger file input
uploadArea.addEventListener("click", function () {
  fotoInput.click();
});

// File selected
fotoInput.addEventListener("change", async function () {
  var file = fotoInput.files[0];
  if (!file) return;

  // Validasi ukuran asli sebelum kompresi (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showError("Ukuran foto terlalu besar (maksimal 10MB). Silakan pilih foto lain.");
    fotoInput.value = "";
    return;
  }

  hideError();
  compressedBlob = null;

  try {
    var result = await compressImage(file);
    compressedBlob = result.blob;
    compressedMimeType = result.mimeType;
    compressedFileName = result.fileName;

    // Tampilkan preview
    var previewUrl = URL.createObjectURL(result.blob);
    fotoPreview.src = previewUrl;
    fotoPreview.hidden = false;
    uploadPlaceholder.hidden = true;
    uploadArea.classList.add("has-photo");

  } catch (err) {
    console.error("Compression error:", err);
    // Fallback: pakai file asli kalau canvas gagal
    compressedBlob = file;
    compressedMimeType = file.type || "image/jpeg";
    compressedFileName = file.name || "foto.jpg";

    var previewUrl = URL.createObjectURL(file);
    fotoPreview.src = previewUrl;
    fotoPreview.hidden = false;
    uploadPlaceholder.hidden = true;
    uploadArea.classList.add("has-photo");
  }
});

/**
 * Compress image via canvas: resize max dimension to 1280px, JPEG quality 0.7
 * @returns {Promise<{blob: Blob, mimeType: string, fileName: string}>}
 */
function compressImage(file) {
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
            if (blob) {
              var ts = Date.now();
              var kode = kodeSelect.value || "unknown";
              resolve({
                blob: blob,
                mimeType: "image/jpeg",
                fileName: kode + "_" + ts + ".jpg"
              });
            } else {
              reject(new Error("canvas.toBlob returned null"));
            }
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
}

// ─── SUBMIT HANDLER ─────────────────────────────────────────────────────────

orderForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  hideError();
  hideSuccess();

  // Validasi
  var kode = kodeSelect.value;
  if (!kode) {
    showError("Pilih kode membership terlebih dahulu.");
    return;
  }

  var selectedItems = menuData.filter(function (item) { return item.qty > 0; });
  if (selectedItems.length === 0) {
    showError("Pilih minimal 1 menu dengan qty > 0.");
    return;
  }

  if (!compressedBlob) {
    showError("Foto pesanan wajib diupload.");
    return;
  }

  setLoading(true);

  try {
    // Convert blob ke base64
    var base64 = await blobToBase64(compressedBlob);

    var itemsJson = JSON.stringify(
      selectedItems.map(function (item) {
        return { namaMenu: item.namaMenu, qty: item.qty };
      })
    );

    var params = new URLSearchParams({
      action: "submitOrder",
      kodeMembership: kode,
      itemsJson: itemsJson,
      fotoBase64: base64,
      fotoMimeType: compressedMimeType,
      fotoNamaFile: compressedFileName
    });

    var resp = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    var json = await resp.json();

    if (json.success) {
      showSuccess("Pesanan berhasil dikirim! (" + json.jumlahItem + " item tercatat)");
      resetForm();
    } else {
      showError(json.error || "Terjadi kesalahan di server.");
    }

  } catch (err) {
    console.error("Submit error:", err);
    showError(
      "Gagal mengirim pesanan. Periksa koneksi internet atau hubungi admin. (" +
      err.message + ")"
    );
  } finally {
    setLoading(false);
  }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      // result = "data:image/jpeg;base64,xxxxx" → ambil bagian setelah koma
      var base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = function () { reject(new Error("Gagal convert blob ke base64")); };
    reader.readAsDataURL(blob);
  });
}

function resetForm() {
  // Reset qty semua ke 0
  menuData.forEach(function (item, idx) {
    item.qty = 0;
    var el = document.getElementById("qty-" + idx);
    if (el) el.textContent = "0";
  });

  // Reset foto
  fotoInput.value = "";
  compressedBlob = null;
  compressedMimeType = "";
  compressedFileName = "";
  fotoPreview.hidden = true;
  fotoPreview.src = "";
  uploadPlaceholder.hidden = false;
  uploadArea.classList.remove("has-photo");

  // Kode membership tidak di-reset (biar user bisa submit lagi dengan kode yang sama)
  // kodeSelect.value = "";
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnText.hidden = isLoading;
  btnLoading.hidden = !isLoading;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  successMsg.hidden = true;
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function showSuccess(msg) {
  successMsg.textContent = msg;
  successMsg.hidden = false;
  errorMsg.hidden = true;
}

function hideSuccess() {
  successMsg.hidden = true;
  successMsg.textContent = "";
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
