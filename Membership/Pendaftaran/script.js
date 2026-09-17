/**
 * MAO Membership — Client-side Registration Script
 *
 * Validates form, POSTs to Apps Script Web App via URLSearchParams,
 * displays membership card on success, and enables PNG download.
 */

// ─── ENDPOINT ───────────────────────────────────────────────────────────────
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxpujqY0krSmEz7QoaetDJuL105ObmNTjRdnpb0KC7d7SR4JyMeEY4AsWf71KaM-uS6pw/exec";

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
    });

    const resp = await fetch(GAS_WEB_APP_URL, {
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
  hideError();
});

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
