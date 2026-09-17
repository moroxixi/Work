/**
 * MAO Membership — Submit Pesanan (Client-side)
 *
 * Fetches kode membership + menu list from GAS on load,
 * renders menu stepper, compresses photo client-side via
 * MAO_CONFIG.compressImageToBase64 (shared, di ../config.js),
 * and POSTs order data via URLSearchParams.
 *
 * Setelah submit SUKSES: form disembunyikan dan muncul "Laporan Pesanan"
 * (ala struk) yang bisa di-download jadi PNG via html2canvas — pola sama
 * dengan kartu membership di Pendaftaran. Foto di laporan memakai Blob LOKAL
 * (hasil kompresi yang sama dengan yang dikirim ke server), BUKAN URL Drive,
 * supaya aman dari CORS/tainted canvas saat html2canvas capture.
 * Tidak ada integrasi Web Share API / WhatsApp gateway.
 */

// ─── ENDPOINT ───────────────────────────────────────────────────────────────
// URL GAS Web App kini terpusat di ../config.js (global MAO_CONFIG),
// di-load sebelum script ini via index.html.

// ─── DOM REFERENCES ─────────────────────────────────────────────────────────
const loadingState     = document.getElementById("loadingState");
const formSection      = document.getElementById("formSection");
const orderForm        = document.getElementById("orderForm");
const kodeSelect       = document.getElementById("kodeMembership");
const menuListEl       = document.getElementById("menuList");
const menuEmptyMsg     = document.getElementById("menuEmptyMsg");
const fotoInput        = document.getElementById("fotoInput");
const uploadArea       = document.getElementById("uploadArea");
const fotoPreview      = document.getElementById("fotoPreview");
const submitBtn        = document.getElementById("submitBtn");
const btnText          = submitBtn.querySelector(".btn-text");
const btnLoading       = submitBtn.querySelector(".btn-loading");
const errorMsg         = document.getElementById("errorMsg");

// Laporan Pesanan
const reportSection    = document.getElementById("reportSection");
const laporanCard      = document.getElementById("laporanCard");
const laporanKode      = document.getElementById("laporanKode");
const laporanWaktu     = document.getElementById("laporanWaktu");
const laporanPoin      = document.getElementById("laporanPoin");
const laporanItems     = document.getElementById("laporanItems");
const laporanFoto      = document.getElementById("laporanFoto");
const downloadLaporanBtn = document.getElementById("downloadLaporanBtn");
const newOrderBtn      = document.getElementById("newOrderBtn");
const reportErrorMsg   = document.getElementById("reportErrorMsg");

// ─── STATE ──────────────────────────────────────────────────────────────────
let menuData = [];       // [{namaMenu, qty}] — qty starts at 0
let compressedBase64 = null; // foto terkompresi (base64) sebelum submit
let compressedMimeType = "";
let compressedFileName = "";

let previewObjectUrl = null; // object URL preview di form (di-revoke saat ganti/reset)
let reportObjectUrl = null;  // object URL foto di laporan (di-revoke saat "Buat Pesanan Baru")
let reportKode = "";         // snapshot kode membership untuk nama file laporan
let reportWaktu = null;      // snapshot waktu submit (Date)

// ─── INIT: fetch kode list + menu list ─────────────────────────────────────

(async function init() {
  try {
    const resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL + "?action=getFormData");
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
  compressedBase64 = null;

  try {
    // Kompresi via shared function di ../config.js
    var result = await MAO_CONFIG.compressImageToBase64(file);
    compressedBase64 = result.base64;
    compressedMimeType = result.mimeType;
    compressedFileName = (kodeSelect.value || "unknown") + "_" + Date.now() + ".jpg";
  } catch (err) {
    console.error("Compression error:", err);
    // Fallback: pakai file asli kalau canvas gagal
    try {
      compressedBase64 = await blobToBase64(file);
      compressedMimeType = file.type || "image/jpeg";
      compressedFileName = file.name || "foto.jpg";
    } catch (fallbackErr) {
      console.error("Fallback base64 error:", fallbackErr);
    }
  }

  // Preview lokal (object URL lama di-revoke supaya tidak menumpuk / leak)
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  fotoPreview.src = previewObjectUrl;
  uploadArea.classList.add("has-photo");
});

// ─── SUBMIT HANDLER ─────────────────────────────────────────────────────────

orderForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  hideError();

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

  if (!compressedBase64) {
    showError("Foto pesanan wajib diupload.");
    return;
  }

  setLoading(true);

  // Snapshot untuk laporan — dibuat SEBELUM resetForm() mengosongkan state.
  // fotoBase64/fotoMimeType di sini adalah data terkompresi yang SAMA dengan
  // yang dikirim ke server; tidak ada kompresi ulang untuk laporan.
  var reportData = {
    kodeMembership: kode,
    items: selectedItems.map(function (item) {
      return { namaMenu: item.namaMenu, qty: item.qty };
    }),
    waktu: new Date(),
    fotoBase64: compressedBase64,
    fotoMimeType: compressedMimeType
  };

  try {
    var itemsJson = JSON.stringify(reportData.items);

    var params = new URLSearchParams({
      action: "submitOrder",
      kodeMembership: kode,
      itemsJson: itemsJson,
      fotoBase64: compressedBase64,
      fotoMimeType: compressedMimeType,
      fotoNamaFile: compressedFileName
    });

    var resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    var json = await resp.json();

    if (json.success) {
      // totalPoin = poin KUMULATIF dari server (seluruh riwayat 1 kode, sudah
      // termasuk submit ini). Simpan di snapshot supaya ikut ter-render.
      reportData.totalPoin = json.totalPoin;

      // Form dibersihkan, lalu laporan ditampilkan pakai snapshot di atas.
      // resetForm() HANYA me-revoke previewObjectUrl (foto form), bukan
      // reportObjectUrl — jadi foto laporan tetap utuh sampai di-download.
      resetForm();
      showReport(reportData);
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

// ─── LAPORAN PESANAN ────────────────────────────────────────────────────────

/**
 * Render + tampilkan laporan. Foto digambar dari Blob LOKAL yang dibangun ulang
 * dari `compressedBase64` (byte persis sama dengan yang dikirim ke server),
 * bukan dari URL Google Drive — supaya html2canvas tidak kena CORS.
 *
 * @param {{kodeMembership:{string}, items:Array, waktu:Date, fotoBase64:string, fotoMimeType:string, totalPoin:number}} data
 */
function showReport(data) {
  reportKode = data.kodeMembership;
  reportWaktu = data.waktu;

  laporanKode.textContent = data.kodeMembership;
  laporanWaktu.textContent = formatWaktu(data.waktu);

  // Pemisah ribuan ala Indonesia ("1.200 poin") via toLocaleString('id-ID').
  // Fallback ke 0 kalau field tidak ada, supaya baris ini tidak pernah kosong.
  var poin = Number(data.totalPoin) || 0;
  laporanPoin.textContent = poin.toLocaleString("id-ID") + " poin";

  // Daftar item — hanya qty > 0, dari state form di client (tanpa fetch ulang)
  laporanItems.innerHTML = "";
  data.items.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "laporan-item";

    var nama = document.createElement("span");
    nama.className = "laporan-item-name";
    nama.textContent = item.namaMenu;

    var qty = document.createElement("span");
    qty.className = "laporan-item-qty";
    qty.textContent = "× " + item.qty;

    row.appendChild(nama);
    row.appendChild(qty);
    laporanItems.appendChild(row);
  });

  // Foto bukti: Blob lokal dari base64 terkompresi
  if (reportObjectUrl) {
    URL.revokeObjectURL(reportObjectUrl);
    reportObjectUrl = null;
  }
  reportObjectUrl = URL.createObjectURL(
    base64ToBlob(data.fotoBase64, data.fotoMimeType)
  );
  laporanFoto.src = reportObjectUrl;

  hideReportError();
  formSection.hidden = true;
  reportSection.hidden = false;
  reportSection.scrollIntoView({ behavior: "smooth" });
}

// Download laporan sebagai PNG (pola sama dengan kartu Pendaftaran)
downloadLaporanBtn.addEventListener("click", async function () {
  try {
    downloadLaporanBtn.disabled = true;
    downloadLaporanBtn.textContent = "⏳ Generating…";

    // Pastikan <img> foto selesai dimuat sebelum capture (cegah gambar kosong)
    await waitForImage(laporanFoto);

    var canvas = await html2canvas(laporanCard, {
      backgroundColor: "#0a0a0a",
      scale: 2
    });

    var link = document.createElement("a");
    link.download =
      "Laporan-Pesanan-" +
      sanitizeFilePart(reportKode) +
      "-" +
      formatStampFile(reportWaktu) +
      ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Download laporan error:", err);
    showReportError("Gagal membuat laporan. Coba screenshot manual atau ulangi.");
  } finally {
    downloadLaporanBtn.disabled = false;
    downloadLaporanBtn.textContent = "📥 Download Laporan";
  }
});

// Kembali ke form untuk pesanan baru (tanpa refetch kode/menu dari server)
newOrderBtn.addEventListener("click", function () {
  // Foto laporan sudah tidak dipakai → revoke supaya tidak menahan memori
  if (reportObjectUrl) {
    URL.revokeObjectURL(reportObjectUrl);
    reportObjectUrl = null;
  }
  laporanFoto.removeAttribute("src");
  laporanItems.innerHTML = "";
  laporanPoin.textContent = "0 poin";
  reportKode = "";
  reportWaktu = null;

  hideReportError();
  hideError();

  reportSection.hidden = true;
  formSection.hidden = false;

  // Reset qty ke 0 + buang foto preview (resetForm me-revoke previewObjectUrl),
  // lalu dropdown kode membership balik ke placeholder.
  resetForm();
  kodeSelect.value = "";

  formSection.scrollIntoView({ behavior: "smooth" });
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

/**
 * Bangun Blob dari base64 (tanpa prefix data URL) — byte identik dengan yang
 * diupload ke server. Dipakai untuk sumber gambar laporan via object URL lokal.
 */
function base64ToBlob(base64, mimeType) {
  var byteChars = atob(base64);
  var sliceSize = 512;
  var byteArrays = [];

  for (var offset = 0; offset < byteChars.length; offset += sliceSize) {
    var slice = byteChars.slice(offset, offset + sliceSize);
    var bytes = new Uint8Array(slice.length);
    for (var i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i);
    }
    byteArrays.push(bytes);
  }

  return new Blob(byteArrays, { type: mimeType || "image/jpeg" });
}

/** Tunggu <img> selesai decode sebelum html2canvas capture. */
function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise(function (resolve) {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", resolve, { once: true });
  });
}

/** "17 September 2026, 14:30" */
function formatWaktu(d) {
  var tanggal = d.toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });
  var jam = pad2(d.getHours());
  var menit = pad2(d.getMinutes());
  return tanggal + ", " + jam + ":" + menit;
}

/** "20260917-1430" */
function formatStampFile(d) {
  return (
    d.getFullYear() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "-" +
    pad2(d.getHours()) +
    pad2(d.getMinutes())
  );
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Buang karakter yang tidak aman untuk nama file. */
function sanitizeFilePart(str) {
  return String(str).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function resetForm() {
  // Reset qty semua ke 0
  menuData.forEach(function (item, idx) {
    item.qty = 0;
    var el = document.getElementById("qty-" + idx);
    if (el) el.textContent = "0";
  });

  // Reset foto (revoke object URL preview form; reportObjectUrl TIDAK disentuh)
  fotoInput.value = "";
  compressedBase64 = null;
  compressedMimeType = "";
  compressedFileName = "";
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  fotoPreview.removeAttribute("src");
  uploadArea.classList.remove("has-photo");

  // Kode membership sengaja TIDAK direset di sini; "Buat Pesanan Baru"
  // yang mengembalikannya ke placeholder (biar tetap bisa submit ulang
  // kalau form ini dipakai lagi tanpa lewat laporan).
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnText.hidden = isLoading;
  btnLoading.hidden = !isLoading;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function showReportError(msg) {
  reportErrorMsg.textContent = msg;
  reportErrorMsg.hidden = false;
}

function hideReportError() {
  reportErrorMsg.hidden = true;
  reportErrorMsg.textContent = "";
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
