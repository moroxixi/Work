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
const cardTanggal     = document.getElementById("cardTanggal");
const downloadBtn     = document.getElementById("downloadBtn");
const backBtn         = document.getElementById("backBtn");
const fotoInput       = document.getElementById("fotoInput");
const uploadArea      = document.getElementById("uploadArea");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const fotoPreview     = document.getElementById("fotoPreview");
const cardDomisili    = document.getElementById("cardDomisili");
const cardUmur        = document.getElementById("cardUmur");

// ─── STATE ──────────────────────────────────────────────────────────────
let compressedBase64 = null;   // foto profil terkompresi (base64, via config.js)
let compressedMimeType = "";
let compressedFileName = "";

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

  try {
    const params = new URLSearchParams({
      action:        "daftar",
      Nama:          validation.data.Nama,
      Domisili:      validation.data.Domisili,
      TanggalLahir:  validation.data.TanggalLahir,
      JenisKelamin:  validation.data.JenisKelamin,
      Status:        validation.data.Status,
      NomorWhatsApp: validation.data.NomorWhatsApp,
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
      showError(json.error || "Terjadi kesalahan di server. Silakan coba lagi.");
    }
  } catch (err) {
    console.error("Submit error:", err);
    showError(
      "Gagal mengirim data. Periksa koneksi internet atau hubungi admin. (" +
        err.message +
        ")"
    );
  } finally {
    setLoading(false);
  }
});

// ─── DISPLAY MEMBERSHIP CARD ───────────────────────────────────────────────

function showCard(data) {
  cardKode.textContent = data.kodeMembership;
  cardNama.textContent = data.nama;
  cardDomisili.textContent = data.domisili;
  cardUmur.textContent = data.umur + " tahun";

  // Tanggal daftar = hari ini
  const now = new Date();
  const opts = { day: "numeric", month: "long", year: "numeric" };
  cardTanggal.textContent = now.toLocaleDateString("id-ID", opts);

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
  cardSection.hidden = true;
  formSection.hidden = false;
  form.reset();
  resetFotoState();
  hideError();
});

// ─── FOTO PROFIL: UPLOAD + KOMPRESI (shared fn di ../config.js) ───────────

// Tap area upload → buka picker / kamera depan (capture="user" di HTML)
uploadArea.addEventListener("click", function () {
  fotoInput.click();
});

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
  resetFotoState();

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
  var previewUrl = URL.createObjectURL(file);
  fotoPreview.src = previewUrl;
  fotoPreview.hidden = false;
  uploadPlaceholder.hidden = true;
  uploadArea.classList.add("has-photo");
});

function resetFotoState() {
  fotoInput.value = "";
  compressedBase64 = null;
  compressedMimeType = "";
  compressedFileName = "";
  fotoPreview.hidden = true;
  fotoPreview.src = "";
  uploadPlaceholder.hidden = false;
  uploadArea.classList.remove("has-photo");
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
