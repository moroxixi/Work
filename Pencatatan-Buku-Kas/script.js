const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbw_xEVOdcxehdm1yUHmT6TK2zAgbcYG2m-7mlvQW1QlIkKzctWhMgwL248kfq23jQpB/exec";

const form = document.getElementById("cashForm");

const outletWrap = document.getElementById("outletWrap");
const belanjaDiWrap = document.getElementById("belanjaDiWrap");
const belanjaDiLainnyaInput = document.getElementById("belanjaDiLainnyaInput");
const tokoLainnyaRadio = document.getElementById("tokoLainnya");

const kategoriLainWrap = document.getElementById("kategoriLainWrap");
const kategoriLainnyaInput = document.getElementById("kategoriLainnyaInput");
const kategoriLainnyaRadio = document.getElementById("kategoriLainnyaRadio");

const jumlahEl = document.getElementById("jumlah");
const keteranganEl = document.getElementById("keterangan");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// Menandai apakah isi field Keterangan saat ini adalah hasil auto-fill dari
// pilihan Outlet ATAU pilihan toko Belanja (bukan ketikan manual owner).
// Dipakai supaya auto-fill tidak menimpa catatan manual yang sudah diketik,
// tapi tetap update kalau owner ganti-ganti pilihan cabang Outlet / toko Belanja.
let keteranganAutoFilled = false;

// ============================================================
// Semua kategori (Uang Masuk & Uang Keluar) sekarang ada dalam
// SATU grup radio: name="kategoriUtama". Ini sumber kebenaran
// tunggal untuk state yang aktif -- menghindari bug lama di mana
// beberapa grup radio terpisah bisa membuat subsection (Outlet /
// Lainnya toko) tidak sinkron dengan kategori yang benar-benar
// terpilih.
//
// Nilai khusus:
//  - "Outlet"            -> Uang Masuk, munculkan pilihan cabang
//  - "Belanja"            -> Uang Keluar (default aktif), munculkan daftar toko
//  - "__lainnyaKeluar__"  -> Uang Keluar, munculkan 6 sub-kategori + input manual
// ============================================================

function resetRadioGroup(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((r) => (r.checked = false));
}

function updateVisibility() {
  const checked = document.querySelector('input[name="kategoriUtama"]:checked');
  const val = checked ? checked.value : "";

  const isOutlet = val === "Outlet";
  const isBelanja = val === "Belanja";
  const isLainnyaKeluar = val === "__lainnyaKeluar__";

  // --- Outlet (Uang Masuk) ---
  outletWrap.hidden = !isOutlet;
  if (!isOutlet) {
    resetRadioGroup("outletDari");
    if (keteranganAutoFilled) {
      keteranganEl.value = "";
      keteranganAutoFilled = false;
    }
  }

  // --- Belanja (Uang Keluar, default) ---
  belanjaDiWrap.hidden = !isBelanja;
  if (!isBelanja) {
    resetRadioGroup("belanjaDi");
    belanjaDiLainnyaInput.hidden = true;
    belanjaDiLainnyaInput.value = "";
    if (keteranganAutoFilled) {
      keteranganEl.value = "";
      keteranganAutoFilled = false;
    }
  }

  // --- Lainnya (Uang Keluar) ---
  kategoriLainWrap.hidden = !isLainnyaKeluar;
  if (!isLainnyaKeluar) {
    resetRadioGroup("kategoriLain");
    kategoriLainnyaInput.hidden = true;
    kategoriLainnyaInput.value = "";
  }
}

document.querySelectorAll('input[name="kategoriUtama"]').forEach((radio) => {
  radio.addEventListener("change", updateVisibility);
});

// Set tampilan awal sesuai default (tab "Belanja" sudah checked di HTML)
updateVisibility();

// Pilih cabang di dalam kategori "Outlet" -> otomatis isi Keterangan
// (mis. "Setoran Outlet - Babakan"), tapi tidak menimpa kalau owner sudah
// ketik catatan manual sendiri.
document.querySelectorAll('input[name="outletDari"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const autoText = `Setoran Outlet - ${radio.value}`;
    if (keteranganEl.value === "" || keteranganAutoFilled) {
      keteranganEl.value = autoText;
      keteranganAutoFilled = true;
    }
  });
});

// Kalau owner ketik manual di Keterangan, berhenti anggap sebagai auto-fill
// supaya tidak ketimpa lagi kalau ganti-ganti pilihan cabang Outlet.
keteranganEl.addEventListener("input", () => {
  keteranganAutoFilled = false;
});

// Pilih toko di dalam kategori "Belanja" -> otomatis isi Keterangan
// (mis. "Belanja di Ayam Ma'mun"), tapi tidak menimpa kalau owner sudah
// ketik catatan manual sendiri. Sama polanya dengan auto-fill Outlet.
function applyBelanjaKeterangan(tokoName) {
  if (!tokoName) return;
  const autoText = `Belanja di ${tokoName}`;
  if (keteranganEl.value === "" || keteranganAutoFilled) {
    keteranganEl.value = autoText;
    keteranganAutoFilled = true;
  }
}

// Tampilkan input manual kalau pilih "Lainnya…" di daftar toko
document.querySelectorAll('input[name="belanjaDi"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isLainnya = radio.value === "__lainnya__";
    belanjaDiLainnyaInput.hidden = !isLainnya;
    if (isLainnya) {
      belanjaDiLainnyaInput.focus();
      // Belum ada nama toko manual yang diketik -> tunggu input berikutnya,
      // jangan auto-fill Keterangan dengan string kosong dulu.
    } else {
      applyBelanjaKeterangan(radio.value);
    }
  });
});

// Kalau owner pilih "Lainnya…" lalu ketik nama toko manual, update
// Keterangan mengikuti ketikan tersebut (selama masih berstatus auto-fill).
belanjaDiLainnyaInput.addEventListener("input", () => {
  if (tokoLainnyaRadio.checked) {
    applyBelanjaKeterangan(belanjaDiLainnyaInput.value.trim());
  }
});

// Tampilkan input manual kalau pilih "Lainnya…" di sub-kategori pengeluaran
document.querySelectorAll('input[name="kategoriLain"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isLainnya = radio.value === "__lainnya__";
    kategoriLainnyaInput.hidden = !isLainnya;
    if (isLainnya) kategoriLainnyaInput.focus();
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

function getSelectedOutlet() {
  const el = document.querySelector('input[name="outletDari"]:checked');
  return el ? el.value : "";
}

function getSelectedBelanjaDi() {
  const el = document.querySelector('input[name="belanjaDi"]:checked');
  if (!el) return "";
  return el.value === "__lainnya__" ? belanjaDiLainnyaInput.value.trim() : el.value;
}

function getSelectedKategoriLain() {
  const el = document.querySelector('input[name="kategoriLain"]:checked');
  if (!el) return "";
  return el.value === "__lainnya__" ? kategoriLainnyaInput.value.trim() : el.value;
}

// Menentukan kategori final, detail tambahan ("belanjaDi" di sheet), dan arah
// berdasarkan satu radio kategoriUtama yang terpilih.
function resolveKategori() {
  const checked = document.querySelector('input[name="kategoriUtama"]:checked');
  if (!checked) {
    return { error: "Pilih salah satu kategori dulu (Uang Masuk atau Uang Keluar)." };
  }

  const arah = checked.dataset.arah === "masuk" ? "Masuk" : "Keluar";
  const val = checked.value;

  if (val === "Outlet") {
    const outlet = getSelectedOutlet();
    if (!outlet) return { error: "Pilih outlet-nya dulu." };
    return { kategori: "Outlet", belanjaDi: outlet, arah };
  }

  if (val === "Belanja") {
    const toko = getSelectedBelanjaDi();
    if (!toko) return { error: "Pilih atau isi nama toko dulu." };
    return { kategori: "Belanja", belanjaDi: toko, arah };
  }

  if (val === "__lainnyaKeluar__") {
    const sub = getSelectedKategoriLain();
    if (!sub) return { error: "Pilih jenis pengeluarannya dulu." };
    return { kategori: sub, belanjaDi: "", arah };
  }

  // MAO Frozen / MAO Instan / Lainnya (Uang Masuk)
  return { kategori: val, belanjaDi: "", arah };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const resolved = resolveKategori();
  if (resolved.error) {
    setStatus(resolved.error, "err");
    return;
  }

  const jumlahAngka = Number(jumlahEl.value.replace(/\D/g, ""));
  if (!jumlahAngka) {
    setStatus("Isi jumlah uangnya dulu.", "err");
    return;
  }

  const now = new Date();

  const options = { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" };
  const timeOptions = { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };

  const dateStr = now.toLocaleDateString("id-ID", options); // Hasil: 10/07/2026
  const timeStr = now.toLocaleTimeString("en-US", timeOptions); // en-US supaya pasti pakai ":"

  const timestampWIB = `${dateStr} ${timeStr}`;

  const payload = {
    timestamp: timestampWIB,
    keterangan: document.getElementById("keterangan").value.trim(),
    kategori: resolved.kategori,
    belanjaDi: resolved.belanjaDi,
    jumlah: jumlahAngka,
    arah: resolved.arah
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

    // Reset manual (form.reset() tidak trigger event "change")
    outletWrap.hidden = true;
    belanjaDiLainnyaInput.hidden = true;
    belanjaDiLainnyaInput.value = "";
    kategoriLainWrap.hidden = true;
    kategoriLainnyaInput.hidden = true;
    kategoriLainnyaInput.value = "";
    keteranganAutoFilled = false;

    // Kembalikan ke default: tab "Belanja" aktif
    document.getElementById("tabBelanja").checked = true;
    updateVisibility();
  } catch (err) {
    setStatus("Gagal mengirim. Cek koneksi internet lalu coba lagi.", "err");
  } finally {
    submitBtn.disabled = false;
  }
});
