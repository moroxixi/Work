// ==== GANTI URL INI dengan URL Web App hasil deploy Apps Script kamu ====
const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxQV9SiURK5bKibxzoUOr0pm1OdFFdUsoW1kQdiA4TVcJ6baGqgc6lhJIB9XYZ7cRjj/exec"

const KATEGORI_MASUK = [
  "Penjualan",
  "Setoran Cabang Tempura",
  "Setoran Cabang Babakan",
  "Setoran Cabang Leweung Gajah",
  "Setoran Cabang Depan RS"
];

const form = document.getElementById("cashForm");
const kategoriEl = document.getElementById("kategori");
const belanjaDiWrap = document.getElementById("belanjaDiWrap");
const belanjaDiEl = document.getElementById("belanjaDi");
const belanjaDiLainnyaEl = document.getElementById("belanjaDiLainnya");
const jumlahEl = document.getElementById("jumlah");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// Tampilkan field "Belanja di" hanya kalau kategori = Belanja
kategoriEl.addEventListener("change", () => {
  const isBelanja = kategoriEl.value === "Belanja";
  belanjaDiWrap.hidden = !isBelanja;
  belanjaDiEl.required = isBelanja;
  if (!isBelanja) {
    belanjaDiEl.value = "";
    belanjaDiLainnyaEl.hidden = true;
    belanjaDiLainnyaEl.value = "";
    belanjaDiLainnyaEl.required = false;
  }
});

// Tampilkan input manual kalau pilih "Toko lain"
belanjaDiEl.addEventListener("change", () => {
  const isLainnya = belanjaDiEl.value === "__lainnya__";
  belanjaDiLainnyaEl.hidden = !isLainnya;
  belanjaDiLainnyaEl.required = isLainnya;
  if (isLainnya) belanjaDiLainnyaEl.focus();
});

// Format angka jumlah pakai titik ribuan saat mengetik
jumlahEl.addEventListener("input", () => {
  const digits = jumlahEl.value.replace(/\D/g, "");
  jumlahEl.value = digits ? Number(digits).toLocaleString("id-ID") : "";
});

function setStatus(text, type) {
  statusMsg.textContent = text;
  statusMsg.className = "status" + (type ? " " + type : "");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (ENDPOINT_URL.startsWith("PASTE_URL")) {
    setStatus("Belum diatur: isi ENDPOINT_URL di script.js dengan URL Web App Apps Script.", "err");
    return;
  }

  const kategori = kategoriEl.value;
  let belanjaDi = "";
  if (kategori === "Belanja") {
    belanjaDi = belanjaDiEl.value === "__lainnya__" ? belanjaDiLainnyaEl.value.trim() : belanjaDiEl.value;
    if (!belanjaDi) {
      setStatus("Pilih atau isi nama toko dulu.", "err");
      return;
    }
  }

  const jumlahAngka = Number(jumlahEl.value.replace(/\D/g, ""));
  if (!jumlahAngka) {
    setStatus("Isi jumlah uangnya dulu.", "err");
    return;
  }

  const now = new Date();
  const payload = {
    timestamp: now.toISOString(),
    tanggal: now.toISOString().slice(0, 10),
    keterangan: document.getElementById("keterangan").value.trim(),
    kategori: kategori,
    belanjaDi: belanjaDi,
    jumlah: jumlahAngka,
    arah: KATEGORI_MASUK.includes(kategori) ? "Masuk" : "Keluar"
  };

  submitBtn.disabled = true;
  setStatus("Menyimpan…", "");

  try {
    // mode "no-cors" dipakai karena Apps Script Web App tidak mengirim header
    // CORS di responsnya. Data tetap terkirim & tersimpan meski respons
    // tidak bisa dibaca balik oleh browser (ini normal, bukan error).
    await fetch(ENDPOINT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    setStatus("Tersimpan ✓", "ok");
    form.reset();
    belanjaDiWrap.hidden = true;
    belanjaDiLainnyaEl.hidden = true;
  } catch (err) {
    setStatus("Gagal mengirim. Cek koneksi internet lalu coba lagi.", "err");
  } finally {
    submitBtn.disabled = false;
  }
});
