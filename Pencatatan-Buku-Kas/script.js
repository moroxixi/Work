const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbzxGbX_ptTbEbze7rk2NMTCfq5wnNqkv3MuhBX6wIZbjQA8sNSK0Ucp8gp45HXMbl7B/exec";

const KATEGORI_MASUK = [
  "MAO Frozen",
  "MAO Instan",
  "Outlet",
  "Lainnya"
];

const form = document.getElementById("cashForm");
const belanjaDiWrap = document.getElementById("belanjaDiWrap");
const belanjaDiLainnyaInput = document.getElementById("belanjaDiLainnyaInput");
const tokoLainnyaRadio = document.getElementById("tokoLainnya");
const outletWrap = document.getElementById("outletWrap");
const jumlahEl = document.getElementById("jumlah");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// Tampilkan/sembunyikan section "Belanja di" atau "Outlet" berdasarkan kategori yang dicentang
// (kategori "Lainnya" muncul di Uang Masuk & Uang Keluar, tapi keduanya punya value yang sama
// "Lainnya" -- tidak masalah karena arah ditentukan lewat KATEGORI_MASUK, bukan lewat teks)
document.querySelectorAll('input[name="kategori"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isBelanja = radio.value === "Belanja";
    const isOutlet = radio.value === "Outlet";

    belanjaDiWrap.hidden = !isBelanja;
    if (!isBelanja) {
      document.querySelectorAll('input[name="belanjaDi"]').forEach((r) => (r.checked = false));
      belanjaDiLainnyaInput.hidden = true;
      belanjaDiLainnyaInput.value = "";
    }

    outletWrap.hidden = !isOutlet;
    if (!isOutlet) {
      document.querySelectorAll('input[name="outletDari"]').forEach((r) => (r.checked = false));
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

function getSelectedOutlet() {
  const el = document.querySelector('input[name="outletDari"]:checked');
  return el ? el.value : "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const kategori = getSelectedKategori();
  if (!kategori) {
    setStatus("Pilih salah satu kategori dulu (Uang Masuk atau Uang Keluar).", "err");
    return;
  }

  // "belanjaDi" dipakai sebagai kolom detail tambahan di sheet Input.
  // Untuk kategori "Belanja" -> isinya nama toko.
  // Untuk kategori "Outlet"  -> isinya nama cabang/outlet.
  // Kolom sheet TIDAK diubah/ditambah supaya struktur Input tetap sama.
  let detailTambahan = "";
  if (kategori === "Belanja") {
    detailTambahan = getSelectedBelanjaDi();
    if (!detailTambahan) {
      setStatus("Pilih atau isi nama toko dulu.", "err");
      return;
    }
  } else if (kategori === "Outlet") {
    detailTambahan = getSelectedOutlet();
    if (!detailTambahan) {
      setStatus("Pilih outlet-nya dulu.", "err");
      return;
    }
  }

  const jumlahAngka = Number(jumlahEl.value.replace(/\D/g, ""));
  if (!jumlahAngka) {
    setStatus("Isi jumlah uangnya dulu.", "err");
    return;
  }

  const now = new Date();

  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  const timeOptions = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

  const dateStr = now.toLocaleDateString('id-ID', options); // Hasil: 10/07/2026
  const timeStr = now.toLocaleTimeString('en-US', timeOptions); // Menggunakan en-US agar pasti pakai ":"

  const timestampWIB = `${dateStr} ${timeStr}`;

  const payload = {
    timestamp: timestampWIB,
    keterangan: document.getElementById("keterangan").value.trim(),
    kategori: kategori,
    belanjaDi: detailTambahan,
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
    outletWrap.hidden = true;
  } catch (err) {
    setStatus("Gagal mengirim. Cek koneksi internet lalu coba lagi.", "err");
  } finally {
    submitBtn.disabled = false;
  }
});
