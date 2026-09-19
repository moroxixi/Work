/**
 * MAO Membership — Client-side Registration Script
 *
 * Validates form (termasuk foto profil wajib), POSTs to Apps Script Web App
 * via URLSearchParams, displays membership card on success, and enables PNG
 * download. Kompresi foto pakai shared function di ../config.js.
 */

// ─── ENDPOINT ───────────────────────────────────────────────────────────────
// URL GAS Web App kini terpusat di ../config.js (global MAO_CONFIG),
// di-load sebelum script ini via index.html.

// ─── DOM REFERENCES ─────────────────────────────────────────────────────────
const form            = document.getElementById("pendaftaranForm");
const submitBtn       = document.getElementById("submitBtn");
const btnText         = submitBtn.querySelector(".btn-text");
const btnLoading      = submitBtn.querySelector(".btn-loading");
const errorMsg        = document.getElementById("errorMsg");
const formSection     = document.getElementById("form-section");
const cardSection     = document.getElementById("card-section");
const cardKode        = document.getElementById("cardKode");
const cardNama        = document.getElementById("cardNama");
const cardDomisili    = document.getElementById("cardDomisili");
const cardTanggal     = document.getElementById("cardTanggal");
const cardFotoProfil  = document.getElementById("cardFotoProfil");
const downloadBtn     = document.getElementById("downloadBtn");
const backBtn         = document.getElementById("backBtn");
const cardUsername    = document.getElementById("cardUsername");
const fotoInput       = document.getElementById("fotoInput");
const fotoInputCamera = document.getElementById("fotoInputCamera");
const uploadArea      = document.getElementById("uploadArea");
const fotoPreview     = document.getElementById("fotoPreview");
const photoPickerModal = document.getElementById("photoPickerModal");
const photoPickerCamera = document.getElementById("photoPickerCamera");
const photoPickerGallery = document.getElementById("photoPickerGallery");
const photoPickerCancel = document.getElementById("photoPickerCancel");

// ─── STATE ──────────────────────────────────────────────────────────────
let compressedBase64 = null;   // foto profil terkompresi (base64, via config.js)
let compressedMimeType = "";
let compressedFileName = "";
let previewObjectUrl = null;    // object URL preview aktif (di-revoke saat ganti/reset)
let fotoBlob = null;            // File asli terpilih — Blob SAMA yang di-compress & dikirim; dipakai ulang untuk foto di kartu
let cardObjectUrl = null;       // object URL foto di kartu membership (di-revoke saat "Kembali ke Form")
let cardDownloaded = false;     // true setelah Download Kartu berhasil dipicu (guard konfirmasi tinggalkan kartu)

// ─── SET MAX DATE (tidak boleh masa depan) ──────────────────────────────────
(function setMaxDate() {
  const dateInput = document.getElementById("TanggalLahir");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("max", today);
  }
})();

// ─── CLIENT-SIDE VALIDATION ─────────────────────────────────────────────────

function validateForm() {
  const fields = {
    Nama:          document.getElementById("Nama").value.trim(),
    Domisili:      document.getElementById("Domisili").value.trim(),
    TanggalLahir:  document.getElementById("TanggalLahir").value,
    JenisKelamin:  document.getElementById("JenisKelamin").value,
    Status:        document.getElementById("Status").value,
    NomorWhatsApp: document.getElementById("NomorWhatsApp").value.trim(),
    Username:      document.getElementById("Username").value.trim(),
  };

  // Required: semua harus ada
  for (const [key, val] of Object.entries(fields)) {
    if (!val) {
      return { ok: false, msg: `Field "${key}" wajib diisi.` };
    }
  }

  // Tanggal lahir: tidak boleh masa depan (double-check, max attribute sudah set)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dob = new Date(fields.TanggalLahir);
  if (dob > today) {
    return { ok: false, msg: "Tanggal lahir tidak boleh di masa depan." };
  }

  // Nomor WhatsApp: hanya digit, diawali 08 atau 62, panjang 9–15 digit
  const phone = fields.NomorWhatsApp.replace(/[\s\-()]/g, "");
  if (!/^\d+$/.test(phone)) {
    return { ok: false, msg: "Nomor WhatsApp hanya boleh berisi digit angka." };
  }
  if (!/^08\d/.test(phone) && !/^62\d/.test(phone)) {
    return { ok: false, msg: "Nomor WhatsApp harus diawali 08 atau 62." };
  }
  if (phone.length < 9 || phone.length > 15) {
    return { ok: false, msg: "Nomor WhatsApp harus 9–15 digit." };
  }

  // Username: huruf, angka, underscore, 3–20 karakter
  if (!/^[A-Za-z0-9_]{3,20}$/.test(fields.Username)) {
    return { ok: false, msg: "Username hanya boleh berisi huruf, angka, dan underscore (3–20 karakter)." };
  }

  // Checkbox persetujuan
  const persetujuan = document.getElementById("persetujuan").checked;
  if (!persetujuan) {
    return { ok: false, msg: "Anda harus menyetujui penggunaan data untuk melanjutkan." };
  }

  // Foto profil wajib dipilih (dan berhasil dikompresi)
  if (!compressedBase64) {
    return { ok: false, msg: "Foto profil wajib diupload." };
  }

  return { ok: true, data: fields };
}

// ─── SUBMIT HANDLER ─────────────────────────────────────────────────────────

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  hideError();

  const validation = validateForm();
  if (!validation.ok) {
    showError(validation.msg);
    return;
  }

  setLoading(true);
  showOverlay();
  startLoadingTextRotation();

  try {
    const params = new URLSearchParams({
      action:        "daftar",
      Nama:          validation.data.Nama,
      Domisili:      validation.data.Domisili,
      TanggalLahir:  validation.data.TanggalLahir,
      JenisKelamin:  validation.data.JenisKelamin,
      Status:        validation.data.Status,
      NomorWhatsApp: validation.data.NomorWhatsApp,
      Username:      validation.data.Username,
      fotoBase64:    compressedBase64,
      fotoMimeType:  compressedMimeType,
      fotoNamaFile:  compressedFileName,
    });

    const resp = await fetch(MAO_CONFIG.GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const json = await resp.json();

    if (json.success) {
      showCard(json);
    } else {
      // Pesan spesifik untuk error username_taken
      showError(json.error || "Terjadi kesalahan di server. Silakan coba lagi.");
    }
  } catch (err) {
    console.error("Submit error:", err);
    // POST gagal di level network/parse (timeout, koneksi putus, response
    // bukan JSON). Data MUNGKIN sudah masuk ke sheet — cuma response-nya
    // yang tidak sampai (kasus nyata: submit ulang dapat "username telah
    // dipakai"). SEBELUM menampilkan error, lakukan SATU kali cek read-only
    // via GET: kalau username yang barusan disubmit sudah terdaftar, treat
    // sebagai sukses dan tampilkan kartu seperti alur normal. Tidak pernah
    // ada retry POST otomatis di sini — recovery murni via GET/read.
    const recovered = await tryRecoverByUsername(validation.data.Username);
    if (recovered) {
      showCard(recovered);
    } else {
      showError(
        "Gagal mengirim data. Periksa koneksi internet atau hubungi admin. (" +
          err.message +
          ")"
      );
    }
  } finally {
    stopLoadingTextRotation();
    hideOverlay();
    setLoading(false);
  }
});

// ─── DISPLAY MEMBERSHIP CARD ───────────────────────────────────────────────

function showCard(data) {
  // Kartu baru dirender → status download di-reset (dipakai guard konfirmasi
  // "tinggalkan kartu member" — lihat requestLeaveCard di bawah).
  cardDownloaded = false;
  cardKode.textContent = data.kodeMembership;
  cardNama.textContent = data.nama;
  cardDomisili.textContent = data.domisili;   // dari response doPost (Umur TIDAK ditampilkan)
  cardUsername.textContent = "@" + (data.username || "");

  // Tanggal daftar = hari ini
  const now = new Date();
  const opts = { day: "numeric", month: "long", year: "numeric" };
  cardTanggal.textContent = now.toLocaleDateString("id-ID", opts);

  // Foto kartu: reuse Blob lokal yang sama dengan yang dikirim ke server
  // (bukan Drive URL) → aman dari CORS saat html2canvas capture. Object URL
  // ini TIDAK di-revoke di sini; baru dicabut saat "Kembali ke Form".
  if (cardObjectUrl) {
    URL.revokeObjectURL(cardObjectUrl);
    cardObjectUrl = null;
  }
  if (fotoBlob) {
    cardObjectUrl = URL.createObjectURL(fotoBlob);
    cardFotoProfil.src = cardObjectUrl;
  }

  formSection.hidden = true;
  cardSection.hidden = false;
  cardSection.scrollIntoView({ behavior: "smooth" });
}

// ─── DOWNLOAD KARTU via html2canvas ────────────────────────────────────────

downloadBtn.addEventListener("click", async function () {
  const card = document.getElementById("membershipCard");
  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "⏳ Generating…";

    const canvas = await html2canvas(card, {
      backgroundColor: "#0a0a0a",
      scale: 2,
    });

    const link = document.createElement("a");
    link.download = "Membership-" + cardKode.textContent + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    // Download berhasil dipicu → user dianggap sudah menyimpan kartu;
    // guard konfirmasi "tinggalkan kartu" tidak perlu muncul lagi.
    cardDownloaded = true;
  } catch (err) {
    console.error("Download error:", err);
    showError("Gagal membuat gambar kartu. Coba screenshot manual.");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "📥 Download Kartu";
  }
});

// ─── BACK TO FORM ──────────────────────────────────────────────────────────

backBtn.addEventListener("click", function () {
  // Guard: kalau kartu BELUM di-download, tampilkan modal konfirmasi dulu;
  // body handler hanya jalan setelah user konfirmasi (atau sudah download).
  requestLeaveCard(function () {
    // Kartu sudah tidak dipakai → cabut object URL foto kartu (cegah memory leak).
    // Baru di titik ini, bukan lebih awal, supaya foto tetap tampil saat render
    // maupun saat user men-download kartu lebih dulu.
    if (cardObjectUrl) {
      URL.revokeObjectURL(cardObjectUrl);
      cardObjectUrl = null;
    }
    cardFotoProfil.removeAttribute("src");

    cardSection.hidden = true;
    formSection.hidden = false;
    form.reset();
    resetFotoState();
    hideError();

    // Kembali ke form → status download kartu lama tidak berlaku lagi.
    cardDownloaded = false;
  });
});

// ─── FOTO PROFIL: UPLOAD + KOMPRESI (shared fn di ../config.js) ───────────
//
// ROOT CAUSE BUG PICKER DOBEL (sudah diperbaiki):
// Modal picker DAN kedua <input type="file"> berada DI DALAM #uploadArea.
// Semua klik di dalamnya (tombol Galeri/Kamera, backdrop, Batal — termasuk
// klik programatik .click() pada input file) dulu BUBBLE naik ke handler
// #uploadArea yang membuka modal lagi. Akibatnya: modal "ditutup" lalu
// langsung terbuka ulang saat picker native muncul → action sheet iOS
// tampil dobel, dan setelah memilih foto modal tetap menutupi layar.
//
// FIX: hanya #uploadArea yang membuka modal; SEMUA handler lain memanggil
// e.stopPropagation() supaya klik mereka tidak pernah sampai ke #uploadArea.
// Reset input.value dilakukan di AWAL change handler (pola halaman Ibridge:
// Ibridge/templates/index.html mengosongkan e.target.value segera setelah
// membaca e.target.files) supaya memilih file yang sama lagi tetap
// memicu event change.

// Tap area upload → tampilkan photo picker modal
uploadArea.addEventListener("click", function () {
  photoPickerModal.hidden = false;
});

// Photo picker: Ambil Foto → buka kamera
photoPickerCamera.addEventListener("click", function (e) {
  e.stopPropagation(); // jangan bubble ke #uploadArea (buka modal lagi)
  photoPickerModal.hidden = true;
  fotoInputCamera.click();
});

// Photo picker: Pilih dari Galeri → buka file picker
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
  resetFotoState(); // bersihkan state preview/kompresi LAMA (input sudah dikosongkan di atas)
  fotoBlob = file;

  try {
    var result = await MAO_CONFIG.compressImageToBase64(file);
    compressedBase64 = result.base64;
    compressedMimeType = result.mimeType;
    compressedFileName = (document.getElementById("Nama").value.trim() || "member") +
      "_" + Date.now() + ".jpg";
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

  showFotoPreview(file);
});

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
  resetFotoState(); // bersihkan state preview/kompresi LAMA (input sudah dikosongkan di atas)

  // Simpan referensi File/Blob utk dipakai ulang di kartu membership
  // (instance yang sama dengan yang di-compress & dikirim ke server).
  fotoBlob = file;

  try {
    var result = await MAO_CONFIG.compressImageToBase64(file);
    compressedBase64 = result.base64;
    compressedMimeType = result.mimeType;
    compressedFileName = (document.getElementById("Nama").value.trim() || "member") +
      "_" + Date.now() + ".jpg";
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

  // Tampilkan preview (dari file asli — visual identik dengan hasil kompresi)
  showFotoPreview(file);
});

/**
 * State terisi: ganti class .has-preview pada #uploadArea. CSS yang mengatur
 * placeholder disembunyikan (display:none) dan preview tampil mengisi kotak —
 * jadi tidak pernah ada dua elemen yang tampil bersamaan.
 */
function showFotoPreview(file) {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  fotoPreview.src = previewObjectUrl;
  uploadArea.classList.add("has-preview");
}

// State kosong: cabut class .has-preview → placeholder kembali tampil.
// CATATAN: input file TIDAK dikosongkan di sini — dikosongkan di awal change
// handler (sebelum await). Kalau dikosongkan setelah await, ada race dengan
// pemilihan berikutnya dan bisa menggagalkan event change berikutnya.
function resetFotoState() {
  compressedBase64 = null;
  compressedMimeType = "";
  compressedFileName = "";
  fotoBlob = null;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  fotoPreview.removeAttribute("src");
  uploadArea.classList.remove("has-preview");
}

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = function () { reject(new Error("Gagal convert blob ke base64")); };
    reader.readAsDataURL(blob);
  });
}

// ─── UI HELPERS ─────────────────────────────────────────────────────────────

const loadingOverlay     = document.getElementById("loadingOverlay");
const loadingOverlayText = document.getElementById("loadingOverlayText");

function showOverlay() {
  loadingOverlay.hidden = false;
}

function hideOverlay() {
  loadingOverlay.hidden = true;
}

// ─── ROTATING LOADING TEXT (overlay saat submit) ────────────────────────────
// Teks overlay dirotasi tiap 2000ms selama request masih pending. Satu
// interval global + stop() di awal start() supaya tidak pernah ada dua
// interval jalan bersamaan (tombol submit juga sudah di-disable saat
// loading, jadi tidak bisa dobel-submit). Semua jalur keluar submit handler
// (sukses, gagal, gagal-tapi-recovery-sukses) lewat SATU blok `finally` yang
// memanggil stopLoadingTextRotation() — `finally` tetap jalan meski ada
// `return` di try/catch, jadi tidak ada teks/interval yang nyangkut.
const LOADING_TEXTS = [
  "Mengirim data…",
  "Tunggu sebentar yaa…",
  "Data sedang dikirimkan…",
  "Jangan lupa nanti download/simpan kartu member kamu!",
];

let loadingTextTimer = null;
let loadingTextIdx = 0;

function startLoadingTextRotation() {
  stopLoadingTextRotation(); // defensive: pastikan tidak ada interval kembar
  loadingTextIdx = 0;
  loadingOverlayText.textContent = LOADING_TEXTS[0];
  loadingTextTimer = setInterval(function () {
    loadingTextIdx = (loadingTextIdx + 1) % LOADING_TEXTS.length;
    loadingOverlayText.textContent = LOADING_TEXTS[loadingTextIdx];
  }, 2000);
}

function stopLoadingTextRotation() {
  if (loadingTextTimer !== null) {
    clearInterval(loadingTextTimer);
    loadingTextTimer = null;
  }
  // Reset teks ke awal supaya submit berikutnya tidak mulai dari teks ke-N.
  loadingOverlayText.textContent = LOADING_TEXTS[0];
}

// ─── RECOVERY CHECK (read-only) — POST gagal tapi data mungkin sudah masuk ─
// Dipanggil HANYA dari catch submit handler (POST gagal di level
// network/parse). Endpoint `getMemberByUsername` di backend MURNI read-only
// (tanpa penulisan apa pun ke sheet). Berbatas: satu kali fetch TANPA retry;
// kalau fetch/parse-nya sendiri gagal → return null → caller fallback ke
// tampilan error biasa. Tidak pernah melempar exception, tidak pernah hang
// lebih dari timeout fetch browser default.
//
// CATATAN VERSI: backend lama (belum di-deploy ulang) tidak mengenal action
// ini → balas health-check JSON tanpa `success` → fungsi ini return null →
// perilaku fallback tetap aman sampai Rofi deploy backend baru.
async function tryRecoverByUsername(username) {
  try {
    const resp = await fetch(
      MAO_CONFIG.GAS_WEB_APP_URL +
        "?action=getMemberByUsername&username=" +
        encodeURIComponent(username)
    );
    const json = await resp.json();
    if (json && json.success && json.found && json.member) {
      return json.member;
    }
    return null;
  } catch (checkErr) {
    console.error("Recovery check error:", checkErr);
    return null;
  }
}

// ─── GUARD: KONFIRMASI SEBELUM TINGGALKAN KARTU MEMBER ──────────────────────
// Kartu member cuma bisa di-generate sekali → kalau user BELUM klik
// "Download Kartu", kedua aksi navigasi keluar dari card-section wajib
// melewati modal konfirmasi dulu. Sudah download → aksi langsung jalan.
//
// Navigasi yang ADA di UI card-section (yang dipasangi guard):
//   1. #backBtn          — "← Kembali ke Form"
//   2. #submitPesananLink — "🛒 Submit Pesanan Sekarang"
// Tidak ada navigasi in-page lain di card-section (quicknav sengaja tidak
// dipasang di halaman Pendaftaran; browser back button di luar scope —
// lihat catatan OUTPUT).
const leaveCardModal    = document.getElementById("leaveCardModal");
const leaveCardConfirmBtn = document.getElementById("leaveCardConfirmBtn");
const leaveCardCancelBtn  = document.getElementById("leaveCardCancelBtn");
const submitPesananLink  = document.getElementById("submitPesananLink");

let pendingLeaveCardAction = null; // aksi navigasi yang menunggu konfirmasi

/**
 * Jalankan actionFn langsung kalau kartu sudah di-download; kalau belum,
 * tampilkan modal konfirmasi dan tahan aksinya sampai user konfirmasi.
 */
function requestLeaveCard(actionFn) {
  if (cardDownloaded) {
    actionFn();
    return;
  }
  pendingLeaveCardAction = actionFn;
  leaveCardModal.hidden = false;
}

// "Sudah, lanjutkan" → jalankan aksi navigasi yang tertunda
leaveCardConfirmBtn.addEventListener("click", function () {
  leaveCardModal.hidden = true;
  var action = pendingLeaveCardAction;
  pendingLeaveCardAction = null;
  if (action) action();
});

// "Belum, kembali ke kartu" → batal: tetap di kartu, tidak ada navigasi
leaveCardCancelBtn.addEventListener("click", function () {
  leaveCardModal.hidden = true;
  pendingLeaveCardAction = null;
});

// Tap backdrop = batal (pola sama dengan modal lain di codebase)
leaveCardModal
  .querySelector(".leave-card-backdrop")
  .addEventListener("click", function () {
    leaveCardModal.hidden = true;
    pendingLeaveCardAction = null;
  });

// Link "Submit Pesanan Sekarang": intercept klik → kalau belum download,
// cegah navigasi href dulu, lanjutkan lewat modal konfirmasi.
submitPesananLink.addEventListener("click", function (e) {
  if (cardDownloaded) return; // sudah download → biarkan href jalan normal
  e.preventDefault();
  requestLeaveCard(function () {
    window.location.href = submitPesananLink.getAttribute("href");
  });
});

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
