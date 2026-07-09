// ==== GANTI dengan URL Web App Apps Script kamu ====
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxe_RItbyRh3g2VDLjsIWUgxN5WqdBynENxjyANsvjd-EaaZ2BDsj0FcUPkRWsDAzjjOA/exec";

const form = document.getElementById("employeeForm");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");
const successMsg = document.getElementById("successMsg");

// ---------- Chip select: Hubungan ----------
const hubunganChips = document.getElementById("hubunganChips");
const hubunganInput = document.getElementById("hubungan");
const hubunganLainnya = document.getElementById("hubunganLainnya");

hubunganChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;

  hubunganChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
  chip.classList.add("selected");

  const value = chip.dataset.value;
  if (value === "Lainnya") {
    hubunganLainnya.classList.remove("hidden");
    hubunganLainnya.focus();
    hubunganInput.value = "";
  } else {
    hubunganLainnya.classList.add("hidden");
    hubunganInput.value = value;
  }
});

hubunganLainnya.addEventListener("input", () => {
  hubunganInput.value = hubunganLainnya.value.trim();
});

// ---------- Upload preview + compress to base64 ----------
const uploadedImages = {}; // { fotoKtp: "data:image/jpeg;base64,...", fotoDiri: "..." }

// Google Sheets insertImage() punya batas: maks 1 juta piksel & 2 MB per gambar.
// Kita batasi berdasarkan TOTAL piksel (lebar x tinggi), bukan cuma lebar,
// supaya foto potret (lebih tinggi dari lebar) juga tetap aman di bawah limit.
function compressImage(file, maxPixels = 900000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const totalPixels = img.width * img.height;
        const scale = totalPixels > maxPixels ? Math.sqrt(maxPixels / totalPixels) : 1;

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.querySelectorAll(".upload-box").forEach((box) => {
  const key = box.dataset.target;
  const input = box.querySelector('input[type="file"]');
  const preview = box.querySelector(".upload-preview");

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const dataUrl = await compressImage(file);
      uploadedImages[key] = dataUrl;
      preview.src = dataUrl;
      preview.classList.remove("hidden");
      box.classList.add("has-image");
    } catch (err) {
      console.error("Gagal memproses gambar:", err);
      alert("Gagal memproses foto, coba pilih ulang.");
    }
  });
});

// ---------- Submit ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // manual validation for custom controls
  if (!hubunganInput.value) {
    alert("Mohon pilih atau isi hubungan kontak darurat.");
    return;
  }
  if (!uploadedImages.fotoKtp) {
    alert("Mohon upload foto KTP.");
    return;
  }
  if (!uploadedImages.fotoDiri) {
    alert("Mohon upload foto diri.");
    return;
  }
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  submitLabel.textContent = "Mengirim...";

  const payload = {
    timestamp: new Date().toISOString(),
    namaLengkap: form.namaLengkap.value.trim(),
    namaPanggilan: form.namaPanggilan.value.trim(),
    noHp: form.noHp.value.trim(),
    tanggalLahir: form.tanggalLahir.value,
    alamat: form.alamat.value.trim(),
    motivasi: form.motivasi.value.trim(),
    alasanPekerjaan: form.alasanPekerjaan.value.trim(),
    harapan: form.harapan.value.trim(),
    rencanaLama: form.rencanaLama.value.trim(),
    namaKontak: form.namaKontak.value.trim(),
    noHpKontak: form.noHpKontak.value.trim(),
    hubungan: hubunganInput.value,
    fotoKtp: uploadedImages.fotoKtp,
    fotoDiri: uploadedImages.fotoDiri,
  };

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    form.classList.add("hidden");
    successMsg.classList.remove("hidden");
  } catch (err) {
    console.error("Gagal mengirim data:", err);
    alert("Gagal mengirim data. Cek koneksi internet dan coba lagi.");
    submitBtn.disabled = false;
    submitLabel.textContent = "Kirim Data";
  }
});
