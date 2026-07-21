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

// ============================================================
// ANTREAN PENGIRIMAN (queue)
//
// Tujuan: begitu tombol Simpan ditekan, form langsung kosong lagi
// dan siap terima inputan berikutnya -- tidak perlu nunggu request
// ke Apps Script selesai. Data yang menunggu/​sedang/​gagal dikirim
// ditampilkan sebagai list di bawah tombol Simpan.
//
// Status tiap item: "pending" (menunggu giliran kirim),
// "sending" (lagi dalam proses fetch), "failed" (gagal, nunggu user
// pencet Kirim Ulang manual -- TIDAK auto-retry).
//
// Disimpan di localStorage supaya kalau HP di-lock / app ditutup /
// halaman di-reload, antrean yang belum kekirim tidak hilang.
// ============================================================

const QUEUE_STORAGE_KEY = "kasHarianQueue";
const queueSection = document.getElementById("queueSection");
const queueListEl = document.getElementById("queueList");

let queue = loadQueue();
let isProcessingQueue = false;

function loadQueue() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY)) || [];
  } catch (err) {
    saved = [];
  }
  // Item yang statusnya masih "sending" saat halaman terakhir ditutup
  // berarti hasilnya tidak diketahui (request mungkin terputus).
  // Dikembalikan ke "pending" supaya otomatis dicoba lagi, bukan
  // dianggap "failed" yang butuh aksi manual.
  saved.forEach((item) => {
    if (item.status === "sending") item.status = "pending";
  });
  return saved;
}

function saveQueue() {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

function queueItemLabel(payload) {
  return payload.belanjaDi ? `${payload.kategori} - ${payload.belanjaDi}` : payload.kategori;
}

function queueItemTime(payload) {
  // payload.timestamp formatnya "dd/MM/yyyy HH:mm:ss" -> ambil jam:menit saja
  const parts = payload.timestamp.split(" ");
  return parts[1] ? parts[1].slice(0, 5) : "";
}

function renderQueue() {
  queueSection.hidden = queue.length === 0;
  queueListEl.innerHTML = "";

  queue.forEach((item) => {
    const row = document.createElement("div");
    row.className = "queue-item";
    row.dataset.id = item.id;

    const info = document.createElement("div");
    info.className = "queue-item-info";
    info.innerHTML = `
      <span class="queue-item-title">${queueItemLabel(item.payload)} · Rp ${item.payload.jumlah.toLocaleString("id-ID")}</span>
      <span class="queue-item-time">${queueItemTime(item.payload)}</span>
    `;

    const right = document.createElement("div");
    right.className = "queue-item-right";

    if (item.status === "pending") {
      right.innerHTML = `<span class="queue-badge queue-badge--pending">Menunggu…</span>`;
    } else if (item.status === "sending") {
      right.innerHTML = `<span class="queue-badge queue-badge--sending">Mengirim…</span>`;
    } else if (item.status === "failed") {
      right.innerHTML = `
        <span class="queue-badge queue-badge--failed">Gagal</span>
        <div class="queue-item-actions">
          <button type="button" class="queue-btn queue-retry-btn" data-action="retry">Kirim Ulang</button>
          <button type="button" class="queue-btn queue-delete-btn" data-action="delete">Hapus</button>
        </div>
      `;
    }

    row.appendChild(info);
    row.appendChild(right);
    queueListEl.appendChild(row);
  });
}

// Klik tombol Kirim Ulang / Hapus di dalam list (delegasi event,
// karena elemen list dibuat ulang tiap kali render)
queueListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const row = btn.closest(".queue-item");
  const id = row.dataset.id;
  const item = queue.find((q) => q.id === id);
  if (!item) return;

  if (btn.dataset.action === "retry") {
    item.status = "pending";
    saveQueue();
    renderQueue();
    processQueue();
  } else if (btn.dataset.action === "delete") {
    queue = queue.filter((q) => q.id !== id);
    saveQueue();
    renderQueue();
  }
});

function addToQueue(payload) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ id, payload, status: "pending" });
  saveQueue();
  renderQueue();
  processQueue();
}

// Kirim antrean satu-satu (bukan bersamaan), supaya urutan ke sheet
// tetap rapi dan gampang dilacak kalau ada yang gagal.
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (true) {
    const item = queue.find((q) => q.status === "pending");
    if (!item) break;

    item.status = "sending";
    saveQueue();
    renderQueue();

    try {
      // mode "no-cors" dipakai karena Apps Script Web App tidak mengirim
      // header CORS di responsnya. Data tetap terkirim & tersimpan meski
      // respons tidak bisa dibaca balik oleh browser (ini normal).
      await fetch(ENDPOINT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(item.payload)
      });

      queue = queue.filter((q) => q.id !== item.id);
      saveQueue();
      renderQueue();
    } catch (err) {
      item.status = "failed";
      saveQueue();
      renderQueue();
      // Lanjut ke item pending berikutnya (kalau ada), item yang gagal
      // ini nunggu ditekan "Kirim Ulang" manual.
    }
  }

  isProcessingQueue = false;
}

// Coba lanjutkan antrean yang tersisa dari sesi sebelumnya (kalau ada)
renderQueue();
processQueue();

form.addEventListener("submit", (e) => {
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

  // Langsung masuk antrean & form langsung kosong lagi -- tidak nunggu
  // kirim selesai. Pengiriman sebenarnya ditangani processQueue().
  addToQueue(payload);

  setStatus("Ditambahkan ke antrean ✓", "ok");
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
});
