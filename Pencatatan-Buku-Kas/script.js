const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxQV9SiURK5bKibxzoUOr0pm1OdFFdUsoW1kQdiA4TVcJ6baGqgc6lhJIB9XYZ7cRjj/exec";

const KATEGORI_MASUK = [
  "Penjualan",
  "Setoran Cabang Tempura",
  "Setoran Cabang Babakan",
  "Setoran Cabang Leweung Gajah",
  "Setoran Cabang Depan RS"
];

const form = document.getElementById("cashForm");
const belanjaDiWrap = document.getElementById("belanjaDiWrap");
const belanjaDiLainnyaInput = document.getElementById("belanjaDiLainnyaInput");
const tokoLainnyaRadio = document.getElementById("tokoLainnya");
const jumlahEl = document.getElementById("jumlah");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// Tampilkan/sembunyikan section "Belanja di" berdasarkan kategori yang dicentang
document.querySelectorAll('input[name="kategori"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isBelanja = radio.value === "Belanja";
    belanjaDiWrap.hidden = !isBelanja;
    if (!isBelanja) {
      document.querySelectorAll('input[name="belanjaDi"]').forEach((r) => (r.checked = false));
      belanjaDiLainnyaInput.hidden = true;
      belanjaDiLainnyaInput.value = "";
    }
  });
});

// Tampilkan input manual kalau pilih "Toko lain…"
document.querySelectorAll('input[name="belanjaDi"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isLainnya = radio.value === "__lainnya__";
    belanjaDiLainnyaInput.hidden = !isLainnya;
    if (isLainnya) belanjaDiLainnyaInput.focus();
  });
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

function getSelectedKategori() {
  const el = document.querySelector('input[name="kategori"]:checked');
  return el ? el.value : "";
}

function getSelectedBelanjaDi() {
  const el = document.querySelector('input[name="belanjaDi"]:checked');
  if (!el) return "";
  return el.value === "__lainnya__" ? belanjaDiLainnyaInput.value.trim() : el.value;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const kategori = getSelectedKategori();
  if (!kategori) {
    setStatus("Pilih salah satu kategori dulu (Uang Masuk atau Uang Keluar).", "err");
    return;
  }

  let belanjaDi = "";
  if (kategori === "Belanja") {
    belanjaDi = getSelectedBelanjaDi();
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
    belanjaDiLainnyaInput.hidden = true;
  } catch (err) {
    setStatus("Gagal mengirim. Cek koneksi internet lalu coba lagi.", "err");
  } finally {
    submitBtn.disabled = false;
  }
});
