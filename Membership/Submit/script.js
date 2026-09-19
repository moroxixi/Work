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
const kodeSearch       = document.getElementById("kodeSearch");
const kodeHidden       = document.getElementById("kodeMembership"); // nilai terpilih (hidden input — id/name & kontrak submit tetap sama)
const kodeDropdown     = document.getElementById("kodeDropdown");
const menuListEl       = document.getElementById("menuList");
const menuEmptyMsg     = document.getElementById("menuEmptyMsg");
const fotoInput        = document.getElementById("fotoInput");
const fotoInputCamera  = document.getElementById("fotoInputCamera");
const uploadArea       = document.getElementById("uploadArea");
const fotoPreview      = document.getElementById("fotoPreview");
const photoPickerModal = document.getElementById("photoPickerModal");
const photoPickerCamera = document.getElementById("photoPickerCamera");
const photoPickerGallery = document.getElementById("photoPickerGallery");
const photoPickerCancel = document.getElementById("photoPickerCancel");
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
const shareLaporanBtn  = document.getElementById("shareLaporanBtn");
const newOrderBtn      = document.getElementById("newOrderBtn");
const reportInfoMsg    = document.getElementById("reportInfoMsg");
const reportErrorMsg   = document.getElementById("reportErrorMsg");

// Caption share general — TIDAK menyebut data pribadi apa pun.
const SHARE_CAPTION =
  "Saya telah membeli beberapa porsi di MAO Wonton dan Mie Jebew 🌶️";

// ─── STATE ──────────────────────────────────────────────────────────────────
let menuData = [];       // [{namaMenu, qty}] — qty starts at 0
let compressedBase64 = null; // foto terkompresi (base64) sebelum submit
let compressedMimeType = "";
let compressedFileName = "";

let previewObjectUrl = null; // object URL preview di form (di-revoke saat ganti/reset)
let reportObjectUrl = null;  // object URL foto di laporan (di-revoke saat "Buat Pesanan Baru")
let reportKode = "";         // snapshot kode membership untuk nama file laporan
let reportWaktu = null;      // snapshot waktu submit (Date)
let lastOrderId = "";        // Order ID terakhir yang dikirim di POST (untuk recovery)

// ─── INIT: fetch kode list + menu list ─────────────────────────────────────

// ─── INIT: fetch kode list + menu list (dengan cache) ─────────────────
var CACHE_KEY = 'submit_formData';

function applyFormData(data) {
  renderKodeList(data.memberList || []);
  renderMenuList(data.menuList || []);
  loadingState.hidden = true;
  orderForm.hidden = false;
}

(async function init() {
  // Render dari cache dulu (instan, tanpa spinner)
  if (typeof MAO_CACHE !== 'undefined') {
    var cached = MAO_CACHE.get(CACHE_KEY);
    if (cached) {
      applyFormData(cached);
    }
  }

  try {
    const resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL + "?action=getFormData");
    const json = await resp.json();

    if (!json.success) {
      throw new Error(json.error || "Gagal memuat data");
    }

    var data = { memberList: json.memberList || [], menuList: json.menuList || [] };
    if (typeof MAO_CACHE !== 'undefined') MAO_CACHE.set(CACHE_KEY, data);

    applyFormData(data);

  } catch (err) {
    console.error("Init error:", err);
    if (typeof MAO_CACHE === 'undefined' || !MAO_CACHE.get(CACHE_KEY)) {
      loadingState.innerHTML =
        '<p style="color:var(--danger)">Gagal memuat data: ' + escapeHtml(err.message) + "</p>";
    }
  }
})();

// ─── HARD REFRESH (TUGAS 10) ─────────────────────────────────────────────
(function () {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hard-refresh-btn';
  btn.textContent = '↻';
  btn.title = 'Refresh data';
  btn.addEventListener('click', async function () {
    btn.disabled = true;
    btn.textContent = '⏳';
    if (typeof MAO_CACHE !== 'undefined') MAO_CACHE.clear(CACHE_KEY);
    try {
      var resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL + "?action=getFormData");
      var json = await resp.json();
      if (json.success) {
        var data = { memberList: json.memberList || [], menuList: json.menuList || [] };
        if (typeof MAO_CACHE !== 'undefined') MAO_CACHE.set(CACHE_KEY, data);
        applyFormData(data);
      }
    } catch (e) { /* keep current state */ }
    btn.disabled = false;
    btn.textContent = '↻';
  });
  var formCard = document.querySelector('.form-card');
  if (formCard) { formCard.style.position = 'relative'; formCard.prepend(btn); }
})();

// ─── RENDER KODE MEMBERSHIP: SEARCHABLE COMBOBOX ───────────────────────────
// Sumber data: memberList hasil fetch getFormData (backend) — cara fetch
// TIDAK diubah. Filter combobox jalan di atas struktur data ini.

let memberData = []; // [{kode, username}] — sumber filter #kodeSearch

function renderKodeList(memberList) {
  // Filter: skip kosong, skip header-like values
  memberData = (memberList || []).filter(function (m) {
    return m.kode !== "" && m.kode !== "Kode Membership";
  });

  if (memberData.length === 0) {
    kodeSearch.disabled = true;
    kodeSearch.placeholder = "Belum ada kode membership terdaftar";
    submitBtn.disabled = true;
    return;
  }

  renderKodeOptions("");
}

/** Render isi dropdown hasil filter. Query kosong = tampilkan semua. */
function renderKodeOptions(query) {
  var q = String(query || "").trim().toLowerCase();
  var filtered = memberData.filter(function (m) {
    if (!q) return true;
    return m.kode.toLowerCase().indexOf(q) !== -1 ||
      (m.username || "").toLowerCase().indexOf(q) !== -1;
  });

  kodeDropdown.innerHTML = "";

  if (filtered.length === 0) {
    var empty = document.createElement("div");
    empty.className = "kode-option-empty";
    empty.textContent = "Tidak ada kode yang cocok.";
    kodeDropdown.appendChild(empty);
    return;
  }

  filtered.forEach(function (m) {
    var opt = document.createElement("div");
    opt.className = "kode-option";
    opt.setAttribute("data-kode", m.kode);

    var kodeEl = document.createElement("span");
    kodeEl.textContent = m.kode;

    var unameEl = document.createElement("span");
    unameEl.className = "kode-username";
    unameEl.textContent = m.username ? "@" + m.username : "";

    opt.appendChild(kodeEl);
    opt.appendChild(unameEl);
    kodeDropdown.appendChild(opt);
  });
}

/** Set nilai terpilih: hidden input diisi kode murni (yang dikirim ke backend). */
function selectKode(kode) {
  var member = null;
  for (var i = 0; i < memberData.length; i++) {
    if (memberData[i].kode === kode) { member = memberData[i]; break; }
  }

  kodeHidden.value = kode;
  kodeSearch.value = (member && member.username) ? kode + " - " + member.username : kode;
  hideKodeDropdown();
}

function openKodeDropdown() { kodeDropdown.hidden = false; }
function hideKodeDropdown() { kodeDropdown.hidden = true; }

// Filter realtime saat mengetik; nilai terpilih lama dibatalkan
kodeSearch.addEventListener("input", function () {
  kodeHidden.value = "";
  renderKodeOptions(kodeSearch.value);
  openKodeDropdown();
});

// Fokus (tap) input → tampilkan daftar
kodeSearch.addEventListener("focus", function () {
  renderKodeOptions(kodeSearch.value);
  openKodeDropdown();
});

// Blur → tutup dropdown (delay 150ms sebagai fallback;
// jalur utama penutupan adalah mousedown option di bawah)
kodeSearch.addEventListener("blur", function () {
  setTimeout(hideKodeDropdown, 150);
});

// Pilih option pakai mousedown + preventDefault supaya input TIDAK kehilangan
// fokus (blur) sebelum nilai ter-set — pola combobox vanilla standar.
kodeDropdown.addEventListener("mousedown", function (e) {
  var opt = e.target.closest(".kode-option");
  if (!opt) return;
  e.preventDefault();
  selectKode(opt.getAttribute("data-kode"));
});

// Klik di luar combobox → tutup dropdown
document.addEventListener("click", function (e) {
  if (!kodeDropdown.hidden && !e.target.closest("#kodeCombo")) {
    hideKodeDropdown();
  }
});

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
}

// Event delegation for stepper buttons — di-attach SEKALI di load, bukan di
// dalam renderMenuList(). renderMenuList() bisa dipanggil ulang (cache refresh)
// dan kalau listener ada di dalamnya, akan menumpuk → qty berubah 2x per klik.
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

// ─── PHOTO UPLOAD + COMPRESSION ─────────────────────────────────────────────
//
// ROOT CAUSE BUG PICKER DOBEL (sudah diperbaiki) — pola yang sama dengan
// Pendaftaran/script.js: modal picker DAN kedua <input type="file"> berada
// DI DALAM #uploadArea. Semua klik di dalamnya (tombol Galeri/Kamera,
// backdrop, Batal — termasuk klik programatik .click() pada input file)
// dulu BUBBLE naik ke handler #uploadArea yang membuka modal lagi. Akibatnya:
// modal "ditutup" lalu langsung terbuka ulang saat picker native muncul →
// action sheet iOS tampil dobel, dan setelah memilih foto modal tetap
// menutupi layar → user stuck.
//
// FIX: hanya #uploadArea yang membuka modal; SEMUA handler lain memanggil
// e.stopPropagation() supaya klik mereka tidak pernah sampai ke #uploadArea.
// Reset input.value dilakukan di AWAL change handler (pola halaman Ibridge:
// Ibridge/templates/index.html mengosongkan e.target.value segera setelah
// membaca e.target.files) supaya memilih file yang sama lagi tetap
// memicu event change.

// Click upload area → show photo picker modal
uploadArea.addEventListener("click", function () {
  photoPickerModal.hidden = false;
});

// Photo picker: Ambil Foto → open camera
photoPickerCamera.addEventListener("click", function (e) {
  e.stopPropagation(); // jangan bubble ke #uploadArea (buka modal lagi)
  photoPickerModal.hidden = true;
  fotoInputCamera.click();
});

// Photo picker: Pilih dari Galeri → open file picker
photoPickerGallery.addEventListener("click", function (e) {
  e.stopPropagation(); // jangan bubble ke #uploadArea (buka modal lagi)
  photoPickerModal.hidden = true;
  fotoInput.click();
});

// Photo picker: Batal
photoPickerCancel.addEventListener("click", function (e) {
  e.stopPropagation(); // jangan bubble ke #uploadArea (buka modal lagi)
  photoPickerModal.hidden = true;
});

// Close modal when tapping backdrop
photoPickerModal.querySelector(".photo-picker-backdrop").addEventListener("click", function (e) {
  e.stopPropagation(); // jangan bubble ke #uploadArea (buka modal lagi)
  photoPickerModal.hidden = true;
});

// Camera input change handler — same logic as gallery fotoInput
fotoInputCamera.addEventListener("change", async function () {
  var file = fotoInputCamera.files[0];
  if (!file) return;

  // Reset input SEKARANG (bukan nanti): pilih file yang sama lagi tetap
  // memicu change, dan file di bawah sudah diamankan di variabel `file`.
  fotoInputCamera.value = "";
  fotoInput.value = "";

  if (file.size > 10 * 1024 * 1024) {
    showError("Ukuran foto terlalu besar (maksimal 10MB). Silakan pilih foto lain.");
    return;
  }

  hideError();
  compressedBase64 = null;

  try {
    var result = await MAO_CONFIG.compressImageToBase64(file);
    compressedBase64 = result.base64;
    compressedMimeType = result.mimeType;
    compressedFileName = (kodeHidden.value || "unknown") + "_" + Date.now() + ".jpg";
  } catch (err) {
    console.error("Compression error:", err);
    try {
      compressedBase64 = await blobToBase64(file);
      compressedMimeType = file.type || "image/jpeg";
      compressedFileName = file.name || "foto.jpg";
    } catch (fallbackErr) {
      console.error("Fallback base64 error:", fallbackErr);
    }
  }

  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  fotoPreview.src = previewObjectUrl;
  uploadArea.classList.add("has-photo");
});

// File selected
fotoInput.addEventListener("change", async function () {
  var file = fotoInput.files[0];
  if (!file) return;

  // Reset input SEKARANG (pola Ibridge): pilih file yang sama lagi tetap
  // memicu change, dan file di bawah sudah diamankan di variabel `file`.
  fotoInput.value = "";
  fotoInputCamera.value = "";

  // Validasi ukuran asli sebelum kompresi (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showError("Ukuran foto terlalu besar (maksimal 10MB). Silakan pilih foto lain.");
    return;
  }

  hideError();
  compressedBase64 = null;

  try {
    // Kompresi via shared function di ../config.js
    var result = await MAO_CONFIG.compressImageToBase64(file);
    compressedBase64 = result.base64;
    compressedMimeType = result.mimeType;
    compressedFileName = (kodeHidden.value || "unknown") + "_" + Date.now() + ".jpg";
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
  var kode = kodeHidden.value;
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
  showOverlay();

  // Generate Order ID unik untuk setiap attempt POST (BUKAN sekali per
  // page-load). ID yang SAMA dipakai oleh recovery check kalau POST gagal.
  lastOrderId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

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
      fotoNamaFile: compressedFileName,
      orderId: lastOrderId
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

      // Simpan hasil submit ke localStorage → redirect ke halaman Hasil.
      // Halaman Hasil akan membaca data dari sana dan merender laporan.
      // Data otomatis dibersihkan setelah 24 jam ( expiry check di Hasil ).
      try {
        localStorage.setItem("mao_submit_result", JSON.stringify({
          kodeMembership: reportData.kodeMembership,
          items: reportData.items,
          waktu: reportData.waktu.toISOString(),
          fotoBase64: reportData.fotoBase64,
          fotoMimeType: reportData.fotoMimeType,
          totalPoin: reportData.totalPoin,
          _savedAt: Date.now()
        }));
      } catch (storageErr) {
        console.error("localStorage save failed:", storageErr);
        // Fallback: tampilkan laporan di halaman ini kalau storage penuh
        resetForm();
        showReport(reportData);
        return;
      }

      // Bersihkan form, lalu redirect ke halaman Hasil
      resetForm();
      window.location.href = "../Hasil/index.html";
    } else {
      showError(json.error || "Terjadi kesalahan di server.");
    }

  } catch (err) {
    console.error("Submit error:", err);
    // POST gagal di level network/parse. Data MUNGKIN sudah masuk ke sheet
    // — cuma response yang hilang. Lakukan SATU kali cek read-only via GET
    // dengan Order ID yang SAMA (lastOrderId). Kalau ditemukan → treat sebagai
    // sukses. Tidak pernah ada retry POST otomatis.
    var recovered = await tryRecoverByOrderId(lastOrderId);
    if (recovered) {
      // Order sudah ada di sheet → lanjut ke flow sukses normal.
      // reportData sudah di-snapshot di atas (sebelum resetForm), termasuk
      // fotoBase64 lokal yang identik dengan yang dikirim ke server.
      try {
        localStorage.setItem("mao_submit_result", JSON.stringify({
          kodeMembership: reportData.kodeMembership,
          items: reportData.items,
          waktu: reportData.waktu.toISOString(),
          fotoBase64: reportData.fotoBase64,
          fotoMimeType: reportData.fotoMimeType,
          _savedAt: Date.now()
        }));
      } catch (storageErr) {
        console.error("localStorage save failed (recovery):", storageErr);
      }
      resetForm();
      window.location.href = "../Hasil/index.html";
    } else {
      showError(
        "Gagal mengirim pesanan. Periksa koneksi internet atau hubungi admin. (" +
        err.message + ")"
      );
    }
  } finally {
    hideOverlay();
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

  hideReportInfo();
  hideReportError();
  formSection.hidden = true;
  reportSection.hidden = false;
  reportSection.scrollIntoView({ behavior: "smooth" });
}

// ─── RENDER LAPORAN (html2canvas) — dipakai bersama Download & Bagikan ─────

/**
 * Satu-satunya tempat html2canvas dipanggil untuk laporan. Dipakai bersama oleh
 * tombol "Download Laporan" dan "Bagikan" supaya capture hanya 1x per aksi.
 * Pastikan <img> foto selesai dimuat dulu (cegah gambar kosong).
 *
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderLaporanCanvas() {
  await waitForImage(laporanFoto);
  return html2canvas(laporanCard, {
    backgroundColor: "#0a0a0a",
    scale: 2
  });
}

/** Nama file laporan yang konsisten untuk Download maupun Bagikan. */
function buildLaporanFileName() {
  return (
    "Laporan-Pesanan-" +
    sanitizeFilePart(reportKode) +
    "-" +
    formatStampFile(reportWaktu) +
    ".png"
  );
}

/** Trigger download dari canvas yang SUDAH dirender (tidak render ulang). */
function triggerCanvasDownload(canvas, fileName) {
  var link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Promise wrapper untuk HTMLCanvasElement.toBlob. */
function canvasToBlob(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob);
      else reject(new Error("Gagal membuat Blob PNG dari canvas"));
    }, "image/png");
  });
}

// Download laporan sebagai PNG (pola sama dengan kartu Pendaftaran)
downloadLaporanBtn.addEventListener("click", async function () {
  try {
    downloadLaporanBtn.disabled = true;
    downloadLaporanBtn.textContent = "⏳ Generating…";

    var canvas = await renderLaporanCanvas();
    triggerCanvasDownload(canvas, buildLaporanFileName());
  } catch (err) {
    console.error("Download laporan error:", err);
    showReportError("Gagal membuat laporan. Coba screenshot manual atau ulangi.");
  } finally {
    downloadLaporanBtn.disabled = false;
    downloadLaporanBtn.textContent = "📥 Download Laporan";
  }
});

// Bagikan laporan sebagai gambar via Web Share API, fallback → download + wa.me
// DIAGNOSIS (Task 4):
// Bug utama: handler punya early `return` di dalam `try` block (setelah
// menangkap AbortError saat user membatalkan share sheet). Return ini
// melewati `finally`, sehingga tombol stuck di "⏳ Menyiapkan…" +
// disabled=true secara permanen — user lihat tombol "tidak berfungsi".
//
// Perbaikan: hapus early return, gunakan flag `shared` supaya fallback
// hanya jalan kalau share BENAR-BENAR gagal (bukan cancel). Tambah
// try-catch di pembuatan File blob supaya error canvas/rendering
// menghasilkan pesan yang bisa dimengerti user.
shareLaporanBtn.addEventListener("click", async function () {
  try {
    shareLaporanBtn.disabled = true;
    shareLaporanBtn.textContent = "⏳ Menyiapkan…";
    hideReportInfo();

    var canvas = await renderLaporanCanvas();
    var fileName = buildLaporanFileName();

    // Buat File blob — wrap di try-catch supaya error canvas/rendering
    // tidak menghasilkan pesan error yang membingungkan.
    var blob;
    try {
      blob = await canvasToBlob(canvas);
    } catch (blobErr) {
      console.error("Canvas to blob error:", blobErr);
      showReportError("Gagal membuat gambar laporan. Coba screenshot manual.");
      return; // finally tetap jalan → tombol di-reset
    }
    var file = new File([blob], fileName, { type: "image/png" });

    var canShareFiles =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    var shared = false;

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: "Laporan Pesanan MAO",
          text: SHARE_CAPTION
        });
        shared = true;
      } catch (err) {
        // User membatalkan share sheet → AbortError. Ini perilaku NORMAL,
        // bukan kegagalan sistem → JANGAN tampilkan error, biarkan tombol
        // di-reset oleh finally block.
        if (err && err.name === "AbortError") {
          shared = true; // anggap "berhasil" supaya fallback tidak jalan
        } else {
          // Errorlain (bukan cancel) — fallback ke download
          console.error("Web Share API error:", err);
        }
      }
    }

    // Fallback: Web Share API tidak didukung, atau share gagal (bukan cancel)
    if (!shared) {
      // a. Auto-download gambar dari canvas yang sama (tanpa render ulang)
      triggerCanvasDownload(canvas, fileName);
      // b. Buka WhatsApp dengan caption teks (WA tidak bisa attach gambar via URL scheme)
      window.open(
        "https://wa.me/?text=" + encodeURIComponent(SHARE_CAPTION),
        "_blank"
      );
      // c. Instruksi singkat ke user
      showReportInfo(
        "Gambar laporan sudah didownload — silakan lampirkan manual di chat WhatsApp yang baru terbuka."
      );
    }
  } catch (err) {
    console.error("Bagikan laporan error:", err);
    showReportError("Gagal membagikan laporan. Coba screenshot manual atau ulangi.");
  } finally {
    shareLaporanBtn.disabled = false;
    shareLaporanBtn.textContent = "📤 Bagikan";
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

  hideReportInfo();
  hideReportError();
  hideError();

  reportSection.hidden = true;
  formSection.hidden = false;

  // Reset qty ke 0 + buang foto preview (resetForm me-revoke previewObjectUrl),
  // lalu combobox kode membership balik kosong.
  resetForm();
  kodeHidden.value = "";
  kodeSearch.value = "";

  formSection.scrollIntoView({ behavior: "smooth" });
});

// ─── RECOVERY (POST gagal, tapi data mungkin sudah masuk) ─────────────────

/**
 * Cek apakah order dengan Order ID tertentu sudah ada di sheet.
 * MURNI READ-ONLY via GET — satu kali fetch tanpa retry; kalau fetch/parse-
 * nya sendiri gagal → return null → caller fallback ke tampilan error biasa.
 * Tidak pernah melempar exception.
 *
 * CATATAN: backend lama (belum di-deploy ulang) tidak mengenal action ini
 * → balas health-check JSON tanpa `found` → return null → aman sampai deploy.
 *
 * @param {string} orderId — Order ID yang barusan dikirim di POST pertama
 * @returns {Promise<Object|null>} data pesanan atau null
 */
async function tryRecoverByOrderId(orderId) {
  if (!orderId) return null;
  try {
    var resp = await fetch(
      MAO_CONFIG.GAS_WEB_APP_URL +
        "?action=getOrderByOrderId&orderId=" +
        encodeURIComponent(orderId)
    );
    var json = await resp.json();
    if (json && json.success && json.found && json.pesanan) {
      return json.pesanan;
    }
    return null;
  } catch (checkErr) {
    console.error("Recovery check (Order ID) error:", checkErr);
    return null;
  }
}

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
  fotoInputCamera.value = "";
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

const loadingOverlay = document.getElementById("loadingOverlay");

function showOverlay() {
  loadingOverlay.hidden = false;
}

function hideOverlay() {
  loadingOverlay.hidden = true;
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

function showReportInfo(msg) {
  reportInfoMsg.textContent = msg;
  reportInfoMsg.hidden = false;
}

function hideReportInfo() {
  reportInfoMsg.hidden = true;
  reportInfoMsg.textContent = "";
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
