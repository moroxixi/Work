# Progres Business — Wonton, Mie Jebew & Tempura

Dokumen ini merangkum apa yang sudah dikerjakan sejauh ini sebagai referensi progres proyek.

## 1. Konteks Bisnis

- 4 cabang street food: 2x Wonton & Mie Jebew, 1x Wonton, 1x Tempura.
- Satu cabang Wonton & Mie Jebew dikelola pihak eksternal — pemilik hanya menerima total setoran hasil penjualan, tanpa visibilitas operasional.
- Semua belanja bahan baku dilakukan terpusat oleh pemilik dalam transaksi gabungan (tidak dipisah per cabang saat belanja).
- Pemilik punya waktu terbatas untuk pencatatan detail, sehingga sistem harus low-maintenance.

## 2. Pendekatan Akuntansi yang Dipilih

Dari beberapa opsi yang dibahas, disepakati mulai dari **Opsi 1: Buku Kas Gabungan**:

- Semua cabang (termasuk cabang eksternal) diperlakukan sementara sebagai **satu kesatuan kas**.
- Uang masuk = semua penjualan cabang yang dikelola sendiri + setoran dari cabang eksternal.
- Uang keluar = semua belanja & biaya operasional, tanpa dipilah per cabang.
- Kelemahan: belum bisa lihat performa per cabang. Ini disadari dan diterima untuk tahap awal.
- Opsi lanjutan (alokasi belanja per cabang via piutang/talangan) didokumentasikan untuk dipakai nanti setelah pencatatan harian jadi kebiasaan (~2-4 minggu).

### Catatan penting: Modal Kembalian (Floating Cash)
- Modal kembalian ±Rp200.000 yang disiapkan tiap pagi untuk karyawan **bukan pendapatan** dan tidak dicatat sebagai Uang Masuk.
- Karena modal ini ditarik balik tiap hari (diberi pagi, ditarik sore), pergerakannya **tidak perlu dicatat sama sekali** di buku kas — dampaknya netral (keluar-masuk sama besar).
- Yang dicatat sebagai kategori "Penjualan" adalah **omset bersih** = uang tunai dibawa pulang dikurangi modal kembalian.

## 3. Struktur Spreadsheet (Google Sheets)

File: `Buku_Kas_Harian_Gabungan.xlsx` (dipakai sebagai Google Sheet setelah di-upload & dibuka dengan Google Sheets).

| Sheet | Fungsi |
|---|---|
| **Petunjuk** | Panduan pemakaian & penjelasan kategori |
| **Input** | Log mentah, terisi otomatis dari form HTML lewat Apps Script. Kolom: Timestamp, Keterangan, Kategori, Belanja Di, Jumlah (Rp) |
| **Buku Kas Harian** | Otomatis membaca dari sheet Input via formula. Tanggal diambil dari `INT(Timestamp)` — tidak ada kolom Tanggal terpisah. Kolom Saldo terhitung otomatis (running balance) |
| **Rekap Bulanan** | Otomatis merangkum total Uang Masuk, Uang Keluar, Laba/Rugi Bersih Usaha, Dividen Owner (Prive), Sisa Kas/Laba Ditahan per bulan dari sheet Buku Kas Harian (pakai `SUMIFS` dengan rentang tanggal, bukan `SUMPRODUCT`+`MONTH`/`YEAR` supaya tidak error kalau ada baris kosong)  |

### Kategori Transaksi

**Uang Masuk:**
- Setoran Cabang Tempura *(otomatis via form setoran, lihat Section 14)*
- Setoran Cabang Babakan *(otomatis via form setoran, lihat Section 14)*
- Setoran Cabang Leweung Gajah *(otomatis via form setoran, lihat Section 14)*
- Sterofoam Tempura *(otomatis via form setoran, lihat Section 14)*
- MAO Frozen — pesanan custom produk frozen di luar stok outlet harian (input manual)
- MAO Instan — pesanan custom produk instan di luar stok outlet harian (input manual)
- Outlet — **kategori ganda**, dipakai untuk dua kondisi berbeda:
  1. **Fallback darurat** kalau sistem kirim-otomatis (`kirimKeBukuKas`) sedang bermasalah. Lihat aturan wajib di Section 14 sebelum pakai untuk kondisi ini.
  2. **Jalur reguler** untuk **Setoran Cabang Depan RS** (cabang eksternal, tidak ada form setoran otomatis sama sekali) — lihat Section 14.

  Di form `index.html`, memilih kategori "Outlet" memunculkan sub-pilihan cabang
  (Babakan / Depan RS / Leweung Gajah / Tempura). Kategori yang tersimpan di sheet
  tetap **"Outlet"** (bukan "Setoran Cabang Depan RS" atau nama cabang lain), kolom
  **Belanja Di** diisi nama cabang yang dipilih (untuk audit), dan kolom **Keterangan**
  otomatis terisi `"Setoran Outlet - <cabang>"` (bisa ditimpa manual kalau owner
  ketik catatan sendiri).
- Lainnya — placeholder sementara untuk pendapatan yang belum sempat
  dikategorikan; reklasifikasi ke kategori yang benar begitu sempat.

**Uang Keluar:**
- Belanja
- Gaji/Upah *(juga tersedia manual di form untuk kasus di luar form setoran, mis. gaji karyawan non-cabang — lihat Section 14)*
- Sewa Tempat
- Tunjangan *(juga tersedia manual di form untuk kasus di luar form setoran)*
- Bonus
- Parkir
- Dividen
- Pengeluaran Operasional *(otomatis via form setoran, lihat Section 14)*
- Uang Jajan Karyawan *(otomatis via form setoran, lihat Section 14)*

## 4. Form Input (HTML/CSS/JS)

Tiga file terpisah: `index.html`, `style.css`, `script.js`.

**Desain:**
- Dua kartu terpisah: **Uang Masuk** (aksen hijau) dan **Uang Keluar** (aksen terracotta), masing-masing berisi kategori dalam bentuk **chip/checklist** (bukan dropdown) — minim klik.
- **Uang Masuk**: chip MAO Frozen, MAO Instan, Outlet (dengan sub-pilihan cabang), Lainnya.
- **Uang Keluar**: pakai segmented tab **Belanja** (default aktif, tampil daftar toko) vs **Lainnya** (tampil sub-kategori: Bonus, Dividen, Gaji/Upah, Parkir, Sewa Tempat, Tunjangan, + input manual "Lainnya…").
- **Arsitektur radio tunggal**: seluruh kategori (Masuk & Keluar) berada dalam **satu grup radio `kategoriUtama`** lintas kedua kartu, dibedakan lewat `data-arah="masuk"/"keluar"` di tiap input. Ini perbaikan dari desain awal yang pakai beberapa grup radio terpisah — grup terpisah pernah menyebabkan subsection (mis. daftar toko atau sub-cabang Outlet) tidak sinkron dengan kategori yang benar-benar aktif.
- Field **"Belanja di"** muncul otomatis hanya saat kategori "Belanja" dipilih, berupa daftar chip toko: Ayam Ma'mun, Ayam Depan Pasar, Ayam Bi Warsih, **Baso Adib, Gas Abah**, Kulit Pangsit, Mega Frozen, Mini Frozen, Ngena-Q Frozen, Plastik DA, Plastik Pasar, Sayur, **Surya, Telor** + opsi "Toko lain…" untuk input manual.
- Field **Keterangan** bersifat **opsional** secara umum, tapi otomatis terisi saat kategori "Outlet" dipilih (lihat Section 3).
- Field **Jumlah (Rp)** dengan format ribuan otomatis saat mengetik.
- Timestamp tercatat otomatis saat submit — tidak perlu diisi manual.
- Dioptimalkan untuk iPhone: `viewport-fit=cover`, `env(safe-area-inset)`, font input 16px (mencegah auto-zoom iOS), touch target ≥40px.
- Tetap nyaman dipakai di laptop (max-width 460px, center-aligned).

## 5. Integrasi Google Apps Script (`Code.gs`)

- Berfungsi sebagai backend penerima data dari form, di-deploy sebagai **Web App** dari dalam Google Sheet (Extensions → Apps Script).
- `doPost(e)` menerima JSON dari form, lalu `appendRow()` ke sheet **Input**. Kalau field `keterangan` kosong, server otomatis isi `"-"` supaya sel tidak kosong (memudahkan baca & filter data nanti).
- Deployment: Execute as **Me**, Who has access **Anyone**.
- Endpoint aktif saat ini: `https://script.google.com/macros/s/AKfycbzxGbX_ptTbEbze7rk2NMTCfq5wnNqkv3MuhBX6wIZbjQA8sNSK0Ucp8gp45HXMbl7B/exec`
- **Penting:** setiap edit `Code.gs`, harus **Deploy ulang** (Manage deployments → Edit → New version → Deploy) supaya perubahan aktif di URL yang sama.

### Catatan Teknis: `mode: "no-cors"`
- Fetch dari form ke Apps Script pakai `mode: "no-cors"` karena Apps Script tidak mengirim header CORS di responsnya.
- Konsekuensi: browser **selalu** menampilkan pesan sukses di form, walau sebenarnya request bisa saja gagal di sisi server.
- Cara verifikasi data benar-benar masuk: cek langsung sheet **Input**, atau cek log **Executions** di Apps Script editor.

## 6. Troubleshooting Data Tidak Masuk ke Sheet

Checklist yang sudah disusun kalau form bilang "Tersimpan ✓" tapi data tidak muncul di sheet:
1. Buka URL Web App langsung di browser — harus muncul "Form endpoint aktif...", bukan halaman login Google.
2. Cek menu **Executions** di Apps Script editor untuk lihat log error (atau ketiadaan log = request tidak sampai).
3. Pastikan sudah **Deploy ulang** (New version) setelah edit kode — URL lama tidak otomatis ambil kode baru.
4. Pastikan `SHEET_NAME` di `Code.gs` sama persis dengan nama tab di spreadsheet (case-sensitive).
5. Pastikan Apps Script dibuka dari **dalam** spreadsheet (Extensions → Apps Script), bukan project standalone terpisah — karena kode pakai `SpreadsheetApp.getActiveSpreadsheet()`.

## 7. Perubahan Struktur: Menghapus Kolom Tanggal Terpisah

- Awalnya sheet Input punya kolom Tanggal terpisah dari Timestamp — dianggap mubazir.
- **Fix:** kolom Tanggal dihapus dari sheet Input. Sheet Buku Kas Harian sekarang mengambil tanggal dengan formula `INT(Timestamp)` untuk membuang bagian jam.
- `Code.gs` dan `script.js` disesuaikan — payload form tidak lagi mengirim field `tanggal` terpisah, cukup `timestamp`.

## 8. Version Control (GitHub)

- Folder kerja: `/home/moroxixi/HomeLab/Work`.
- Dibuatkan script `work-push.sh` (adaptasi dari `homelab-push.sh` yang sudah ada sebelumnya) untuk auto commit & push:
  - Cek SSH agent aktif.
  - Cek syntax semua file `.py` sebelum commit (push dibatalkan kalau ada `SyntaxError`).
  - Skip kalau tidak ada perubahan.
  - `git add -A` → commit → `git push origin main`.
  - Log ke `push.log` + notifikasi desktop via `notify-send`.
- Panduan setup SSH key (`ssh-keygen`, `ssh-agent`, daftar public key ke GitHub, ganti remote ke URL SSH) sudah diberikan supaya push tidak perlu password manual tiap kali.
- **Repo di-serve juga lewat GitHub Pages**, folder kerja `Work` bisa diakses sebagai web statis di
  `https://moroxixi.github.io/Work/...` — inilah yang dipakai untuk hosting form-form HTML
  (`index.html`, `Scan-Struk/index.html`, dsb) supaya bisa dibuka langsung dari HP tanpa server sendiri.

## 9. Yang Masih Perlu Dikerjakan / Dipantau

- [x] Pastikan hasil rebuild sheet (kolom Tanggal dihapus dari Input) sudah di-upload ulang ke Google Sheets, dan data lama (kalau ada) dipindahkan/dibackup dulu.
- [x] Pastikan `Code.gs` versi terbaru sudah di-deploy ulang di Apps Script.
- [x] Pastikan `script.js` versi terbaru (tanpa field `tanggal`, Keterangan tidak wajib) sudah dipakai di form yang aktif.
- [x] Verifikasi end-to-end: submit dari form → cek data masuk ke sheet Input → cek Buku Kas Harian & Rekap Bulanan terhitung benar.
- [ ] Setelah pencatatan harian jadi kebiasaan (~2-4 minggu), evaluasi apakah sudah siap naik ke Opsi 2/3 (pemisahan biaya per cabang, sistem piutang untuk cabang eksternal).
- [ ] Fitur Scan Struk Belanja (Section 15) baru selesai dibangun, **belum diverifikasi end-to-end** oleh pemilik — perlu didebug/dites dulu (lihat checklist di Section 15).

## 10. Update — Redesign Form & Simplifikasi Sheet

- **Form input dirombak total**: dari dropdown jadi checklist chip, dipisah 2 kartu terpisah
  (Uang Masuk aksen hijau, Uang Keluar aksen terracotta) — minim klik, lebih nyaman dipakai
  satu tangan di iPhone.
- **Kolom Tanggal dihapus** dari sheet Input — dianggap redundan karena Timestamp sudah
  mengandung tanggal. Sheet Buku Kas Harian sekarang pakai formula `INT(Timestamp)` untuk
  ambil tanggal saja.
- **Field Keterangan jadi opsional** — kategori transaksi sudah cukup jelas sebagai identitas,
  jadi tidak wajib diisi lagi (kecuali kategori "Outlet", yang otomatis terisi — lihat Section 3).
- **Endpoint Apps Script sudah aktif dan terpasang** di `script.js`, form siap dites langsung
  ke sheet.
- **Version control**: dibuat `work-push.sh` untuk auto commit & push folder kerja ke GitHub,
  plus setup SSH key supaya push tidak perlu password manual.

## 11. Sistem Terpisah untuk Setoran Tempura (`setoran-tempura.html`)

Selain sistem Buku Kas Gabungan (bulanan/lintas cabang), dibuat form khusus harian untuk cabang **Tempura** yang menghitung penjualan per item (bukan cuma total nominal), lalu mengecek kecocokan uang fisik vs sistem.

### Alur Form
- Input **Berangkat** (stok dibawa) dan **Pulang** (sisa) per item → otomatis hitung **Laku** = Berangkat - Pulang, dikali harga per item (`daftarHarga`) → jadi **Omset Kotor**.
- Input Keuangan: **QRIS, Gaji, Pengeluaran** (pengurang kas), **Uang Modal, Sterofoam** (penambah kas), **Uang Tunai** (uang fisik di laci).
- Tombol **"CEK HASIL PENJUALAN"** menampilkan laporan rinci sebelum data dikirim, supaya bisa dicek dulu sebelum submit ke database.
- Ada tombol **"AMBIL SCREENSHOT"** (pakai `html2canvas`) untuk simpan laporan sebagai gambar, terpisah dari kirim ke database.

### Perubahan Logika Perhitungan
- **Total Potongan (1 baris) dihapus**, diganti rincian lengkap tiap komponen: `+ Uang Modal`, `+ Sterofoam`, `- QRIS`, `- Gaji`, `- Pengeluaran`, baru total `Wajib Setor`. Tujuannya supaya semua angka kelihatan, bukan cuma total gabungan.
- **Field baru: Sterofoam** — dianggap seperti "kantong plastik berbayar" (uang tambahan yang dipungut dari pembeli di luar harga makanan), sehingga nilainya **ditambahkan** ke Wajib Setor (bukan dikurangi), sama seperti Uang Modal.
- Rumus akhir: `Wajib Setor = Omset Kotor - (QRIS + Gaji + Pengeluaran) + (Uang Modal + Sterofoam)`.
- **Selisih** = Uang Tunai fisik - Wajib Setor → status otomatis **PAS / KURANG / LEBIH**.

### Perubahan Payload (data yang dikirim ke sheet)
- Sebelumnya cuma kirim `laku` per item (`t_namaitem`) dan omset — sekarang juga kirim `sisa` per item (`s_namaitem`), plus `wajibSetor`, `selisih`, dan `status` supaya semua angka di laporan tersimpan utuh untuk audit (bukan cuma hasil akhirnya).

### Perubahan Apps Script (`Code.gs`)
- **`doGet` (dashboard baca data harian) dihapus total** — sudah tidak dipakai lagi.
- **`doPost` ditulis ulang khusus untuk data Tempura**:
  - Menulis ke sheet baru **`Input_Tempura`** (terpisah dari sheet `Input` yang dipakai Buku Kas Gabungan).
  - Kalau sheet `Input_Tempura` belum ada, **dibuat otomatis** lengkap dengan **header otomatis** (nama kolom sesuai isinya, misal `Scallop (Sisa)`, `Scallop (Laku)`, `QRIS`, `Wajib Setor`, dst) — jadi tidak perlu bikin header manual.
  - Struktur kolom: Timestamp, Cabang, lalu Sisa+Laku tiap item (urut sesuai daftar item di HTML), lalu QRIS, Gaji, Pengeluaran, Uang Modal, Sterofoam, Omset Kotor, Wajib Setor, Uang Tunai, Selisih, Status.
- Direncanakan sheet **`Input_Wonton`** menyusul dengan pola serupa (form & `Code.gs` terpisah dari Tempura), belum dikerjakan.

### Hal yang Masih Perlu Dicek/Divalidasi (belum tentu bug, tapi asumsi yang perlu dikonfirmasi pemilik)
- [x] Harga per item di `daftarHarga` masih banyak placeholder (`1000` untuk sebagian besar item) — perlu diisi harga jual asli.
- [x] Asumsi Gaji & Pengeluaran **selalu** dibayar tunai dari laci hari itu (kalau kadang via transfer, seharusnya tidak dikurangi dari kas fisik).
- [x] Asumsi Sterofoam **selalu** dibayar tunai terpisah, tidak pernah tergabung dalam pembayaran QRIS — kalau bisa campur, berpotensi dihitung dobel (masuk QRIS + ditambahkan lagi sebagai Sterofoam) sehingga selisih "LEBIH" jadi palsu.
- [x] Konfirmasi ulang logika Uang Modal: diasumsikan modal yang harus dikembalikan utuh bareng hasil jualan (makanya ditambahkan ke Wajib Setor).

## 12. Sistem Terpisah untuk Setoran Wonton & Mie Jebew (`setoran-wonton.html`)

Mengikuti pola yang sama dengan Tempura (bagian 11), form khusus harian dibuat juga
untuk cabang **Wonton & Mie Jebew** yang menghitung penjualan per item, lalu
mengecek kecocokan uang fisik vs sistem.

### Perubahan pada Form
- Rincian keuangan diubah dari "Total Potongan" satu baris menjadi rincian per
  komponen (`+ Uang Modal`, `- QRIS`, `- Gofood`, `- Gaji`, `- Pengeluaran`,
  `- Uang Jajan`, `- Dimakan`), lalu baru total `Wajib Setor` — mengikuti gaya
  tampilan Tempura, supaya semua angka terlihat sebelum total akhir.
- Payload dilengkapi: sebelumnya cuma kirim `laku` per item (`w_namaitem`) —
  sekarang juga kirim `sisa` per item (`sw_namaitem`), plus `wajibSetor`,
  `selisih`, dan `status`, supaya semua angka di laporan tersimpan utuh untuk
  audit (sama seperti Tempura).
- Field & formula milik Wonton (Gofood, Uang Jajan, Dimakan) **tetap dipertahankan
  sesuai aslinya** — ini memang beda dari Tempura karena beda karakteristik
  penjualan, bukan disamakan begitu saja.
- Formula: `Wajib Setor = Omset Kotor - (QRIS + Gofood + Gaji + Pengeluaran +
  Uang Jajan + Dimakan) + Uang Modal`.
- **Selisih** = Uang Tunai fisik - Wajib Setor → status otomatis **PAS / KURANG / LEBIH**.

### Perubahan Apps Script (`Code.gs`)
- `Code.gs` sekarang **satu file gabungan** yang menangani dua tipe data lewat
  `doPost`: `tipe: "Tempura"` → sheet `Input_Tempura`, `tipe: "Wonton"` → sheet
  **`Input_Wonton`** (baru, terpisah total dari Tempura).
- Kalau sheet `Input_Wonton` belum ada, **dibuat otomatis** lengkap dengan header
  otomatis (`Wonton (Sisa)`, `Wonton (Laku)`, dst, sesuai urutan item di
  `ITEMS_WONTON`).
- Struktur kolom `Input_Wonton`: Timestamp, Cabang, lalu Sisa+Laku tiap item,
  kemudian QRIS, Gofood, Gaji, Pengeluaran, Uang Jajan, Dimakan, Uang Modal,
  Omset Kotor, Wajib Setor, Uang Tunai, Selisih, Status.
- Kedua sheet (`Input_Tempura` & `Input_Wonton`) berbagi satu Web App / satu
  `SCRIPT_URL` yang sama — dibedakan lewat field `tipe` di payload, bukan lewat
  endpoint terpisah.

### Hal yang Masih Perlu Dicek/Divalidasi (belum tentu bug, tapi asumsi yang perlu dikonfirmasi pemilik)
- [x] "Omset" yang ditampilkan di laporan Wonton sudah dikurangi `Dimakan`,
  sedangkan "Omset" di laporan Tempura masih kotor mentah — perlu diingat saat
  membandingkan angka omset lintas cabang di rekap nanti (dua definisi berbeda).
- [x] Asumsi Gofood **selalu** settle terpisah dari kas fisik (tidak pernah
  dipegang tunai) — sama seperti asumsi QRIS di Tempura.
- [x] Asumsi Uang Jajan & Dimakan **selalu** tunai dari laci hari itu.
- [x] Konfirmasi kenapa tidak ada field **Sterofoam** di Wonton (beda karakter
  penjualan dari Tempura, atau memang belum ditambahkan).
- [x] Harga per item di `daftarHarga` (Wonton, WontonLebih, Mie, dst.) perlu
  dicek ulang apakah sudah sesuai harga jual aktual.

## 13. Formulir Onboarding Karyawan Baru

Selain sistem setoran harian (Tempura, Wonton & Mie Jebew), dibuat form terpisah
untuk **onboarding karyawan baru** — diisi sendiri oleh karyawan sekali di awal,
bukan oleh pemilik. Tujuannya mengumpulkan data dasar karyawan yang selama ini
tidak tercatat lengkap, karena pemilik sudah mengenal semua karyawan secara
personal (sehingga field seperti cabang & posisi sengaja **tidak** dimasukkan
ke form ini — dianggap sudah diketahui pemilik).

### Struktur Form (`formulir-karyawan.html`)

**Data Pribadi:**
- Nama Lengkap, Nama Panggilan, No HP/WhatsApp, Tanggal Lahir
- Alamat (wajib diisi, bukan opsional)
- Upload Foto KTP
- Upload Foto Diri (santai/non-formal, tidak perlu foto resmi)

**Cerita Kamu** (menggantikan pertanyaan Data Pekerjaan standar — pemilik lebih
tertarik menggali motivasi & karakter karyawan daripada data administratif):
- Apa motivasi kamu bekerja?
- Mengapa memilih pekerjaan ini dibanding yang lain?
- Apa harapan kamu terhadap pekerjaan ini?
- Apakah kamu punya rencana sampai kapan bekerja di sini?

**Kontak Darurat:**
- Nama, No HP, Hubungan (chip select: Orang Tua/Pasangan/Saudara/Lainnya)

### Upload Foto: Perjalanan Teknis

- **Percobaan 1 — foto ditempel langsung ke sel sheet** (`sheet.insertImage()`):
  supaya pemilik tidak perlu buka aplikasi/link lain. Gagal karena Google Sheets
  membatasi gambar yang di-*embed* langsung ke sel maksimal **1 juta piksel dan
  2 MB** — jauh di bawah resolusi foto HP modern meski sudah dikompresi di
  browser.
- **Solusi final — kembali ke Google Drive + link di sheet**: foto disimpan ke
  folder Drive `Foto_Karyawan`, lalu kolom `Foto KTP`/`Foto Diri` di sheet berisi
  formula `=HYPERLINK(...)` berlabel "Lihat Foto" (bukan link mentah) supaya
  tetap rapi dan bisa diklik langsung dari sheet.
- **Penamaan file dibuat unik & deskriptif**: format
  `NamaLengkap_KTP_yyyyMMdd_HHmmss_SSS` dan `NamaLengkap_Foto_yyyyMMdd_HHmmss_SSS`
  — supaya file mudah dicari manual di Drive dan tidak pernah bentrok nama
  walau ada submit di waktu yang berdekatan.
- **Kompresi gambar di sisi browser** (client-side, sebelum dikirim ke Apps
  Script): pakai `<canvas>`, dibatasi berdasarkan **total piksel** (lebar ×
  tinggi), bukan cuma lebar — penting untuk foto potret (KTP/selfie) yang
  biasanya lebih tinggi daripada lebar.
- **Pilihan kamera vs galeri**: awalnya field upload foto pakai atribut
  `capture` yang memaksa browser langsung buka kamera. Dihapus supaya browser
  menampilkan pilihan "Ambil Foto" atau "Pilih dari Galeri".

### Apps Script (`Code.gs`) — Sengaja Terpisah dari Tempura/Wonton

- **Keputusan desain**: form karyawan pakai `Code.gs` & deployment Web App
  **sendiri**, terpisah total dari `Code.gs` gabungan Tempura/Wonton (yang
  pakai pola percabangan `tipe`). Alasannya: tujuan datanya beda karakter
  (data SDM vs data keuangan harian), jadi tidak digabung ke satu endpoint
  meski secara teknis bisa.
- Sheet tujuan: **`Data_Karyawan`** — dibuat otomatis lengkap dengan header
  kalau belum ada (pola sama seperti `Input_Tempura`/`Input_Wonton`).
- **Error handling per-foto**: kalau upload salah satu foto gagal, pesan
  error ditulis langsung ke sel kolom foto terkait (misal `GAGAL: ...`) —
  bukan cuma gagal diam-diam — supaya masalah kelihatan langsung dari sheet
  tanpa perlu buka log Executions di Apps Script.

### Status

- [x] Form, styling, dan Apps Script sudah selesai dan diverifikasi
  end-to-end oleh pemilik — berjalan lancar dan normal.

## 14. Integrasi Otomatis: Setoran Harian → Buku Kas Gabungan

Sebelumnya, hasil setoran harian (Tempura, Wonton & Mie Jebew) yang sudah masuk ke
`Input_Tempura`/`Input_Wonton` masih harus dicatat manual oleh pemilik ke Buku Kas
Gabungan (sheet `Input` di spreadsheet yang berbeda). Sekarang proses ini otomatis:
begitu karyawan submit form setoran, data langsung diteruskan juga ke Buku Kas
Gabungan secara real-time — tanpa input manual.

### Keputusan Skema: Gross, bukan Net

Sempat dipertimbangkan dua opsi:
- **Net** — cuma kirim `Wajib Setor` (uang tunai fisik yang sampai ke pemilik) sebagai
  satu baris "Penjualan".
- **Gross** — kirim rincian: Omset penuh sebagai Masuk, lalu Gaji/Pengeluaran/dll
  sebagai Keluar terpisah.

**Dipilih Gross**, karena kalau cuma pakai Wajib Setor, penjualan yang dibayar lewat
QRIS/Gofood jadi tidak pernah tercatat sama sekali di Buku Kas Gabungan (Wajib Setor
sudah mengurangi QRIS/Gofood, karena itu memang tidak pernah dipegang tunai) —
datanya jadi kurang akurat untuk melihat omset & biaya asli usaha.

**Catatan penting supaya tidak dobel hitung**: `Omset Kotor`/`Omset Wonton` yang
dihitung form (Laku × Harga per item) **sudah termasuk** penjualan yang dibayar
QRIS/Gofood di dalamnya — field `qris`/`gofood` di form cuma dipakai untuk tahu
berapa yang tidak masuk laci fisik (dipakai di rumus Wajib Setor), bukan pendapatan
tambahan di luar Omset. Jadi QRIS/Gofood **tidak** dikirim sebagai baris terpisah ke
Buku Kas — sudah terhitung dalam Omset.

### Apa yang dikirim, apa yang tidak

| Data dari form setoran | Dikirim ke Buku Kas? | Kategori |
|---|---|---|
| Omset Tempura (`omsetTempura`) | ✅ Masuk | `Setoran Cabang Tempura` |
| Sterofoam (`sterofoam`, khusus Tempura) | ✅ Masuk | `Sterofoam Tempura` |
| Omset Wonton (`omsetWonton`, sudah dikurangi Dimakan) | ✅ Masuk | `Setoran Cabang Babakan` / `Setoran Cabang Leweung Gajah` (dipilih otomatis dari huruf pertama field `cabang`) |
| Gaji (`gaji`) | ✅ Keluar | `Gaji/Upah` |
| Pengeluaran (`pengeluaran`) | ✅ Keluar | `Pengeluaran Operasional` *(kategori baru)* |
| Uang Jajan (`uangJajan`, khusus Wonton) | ✅ Keluar | `Uang Jajan Karyawan` *(kategori baru)* |
| Uang Modal (`uModal`) | ❌ tidak dikirim | Netral, sesuai aturan modal kembalian yang sudah disepakati sebelumnya — jangan dicatat sama sekali |
| Dimakan (`dimakan`) | ❌ tidak dikirim | Bukan transaksi kas (barang habis tanpa pembayaran), sudah dikeluarkan dari `omsetWonton` |
| QRIS, Gofood | ❌ tidak dikirim terpisah | Sudah termasuk dalam nilai Omset — kalau dikirim lagi jadi dobel hitung |
| Uang Tunai, Wajib Setor, Selisih, Status | ❌ tidak dikirim | Alat rekonsiliasi kas fisik harian, bukan transaksi — tetap tersimpan lengkap di `Input_Tempura`/`Input_Wonton` untuk audit |

Cabang Depan RS (dikelola eksternal) tidak pakai form setoran ini — setorannya masih
dicatat manual oleh pemilik lewat form `index.html`, kategori **"Outlet"** dengan
sub-pilihan cabang "Depan RS" (lihat Section 3). Ini bukan pemakaian "Outlet" sebagai
fallback darurat, tapi memang jalur reguler satu-satunya untuk cabang ini karena tidak
ada form setoran otomatis (`setoran-tempura.html`/`setoran-wonton.html`) untuknya.

### Kenapa kategori "Sterofoam Tempura", bukan cuma "Sterofoam"

Formula klasifikasi Masuk/Keluar di sheet `Buku Kas Harian` bersifat **whitelist**
(kolom Uang Masuk pakai `REGEXMATCH` terhadap kata kunci: `Transfer ke BRI|Penjualan
Cirawang|Tempura|Babakan|Leweung Gajah|RS`; selain itu otomatis dianggap Keluar).
Supaya Sterofoam (yang sebenarnya pendapatan) otomatis kehitung sebagai Masuk **tanpa
perlu ubah formula sama sekali**, nama kategorinya sengaja dibuat mengandung kata
kunci `Tempura` yang sudah dikenali formula. Kategori Keluar baru
(`Pengeluaran Operasional`, `Uang Jajan Karyawan`) sudah dicek aman — tidak mengandung
kata kunci apa pun di whitelist, jadi otomatis jatuh ke kolom Keluar seperti
seharusnya.

### Implementasi Teknis

- `Input_Tempura`/`Input_Wonton` berada di spreadsheet **terpisah** dari Buku Kas
  Gabungan. Penulisan lintas-spreadsheet pakai `SpreadsheetApp.openById()` dengan ID
  Buku Kas Gabungan: `15MZYZOhqY2dTGBeZoAe1yqwJWTh43e9qPdgotM4DuCM`, sheet target
  `Input`.
- Ditambahkan fungsi baru di `Code.gs` (gabungan Tempura/Wonton): `kirimKeBukuKas()`
  (helper generik, batch-write pakai `setValues` bukan `appendRow` berkali-kali),
  `kirimSetoranTempuraKeBukuKas()`, `kirimSetoranWontonKeBukuKas()`,
  `kategoriSetoranWonton()` (deteksi cabang dari huruf pertama), dan
  `formatTimestampWIB()` (format timestamp konsisten dengan yang dipakai form Buku
  Kas Gabungan, `dd/MM/yyyy HH:mm:ss` WIB, supaya cocok dengan formula `INT(VALUE(...))`
  di kolom Tanggal `Buku Kas Harian`).
- Baris dengan nominal 0 tidak dikirim (skip), supaya tidak mengotori Buku Kas dengan
  entri kosong.
- Kalau cabang Wonton tidak terdeteksi (bukan huruf B/L, kemungkinan salah ketik atau
  memang cabang RS yang nyasar pakai form ini), sistem **tidak menebak** kategorinya
  — omset tidak dikirim otomatis, dan alert dikirim ke Telegram supaya pemilik input
  manual.
- Kegagalan kirim ke Buku Kas Gabungan (misalnya masalah izin akses) tidak
  menggagalkan penyimpanan ke `Input_Tempura`/`Input_Wonton` — errornya ditangkap
  terpisah dan dikirim sebagai alert Telegram.

### Setup Sekali Jalan (Belum/Sudah Dilakukan)

- [x] Deploy ulang Web App setelah `Code.gs` diupdate (New version).
- [x] Jalankan salah satu fungsi baru sekali secara manual dari Apps Script editor
  untuk approve izin akses ke spreadsheet Buku Kas Gabungan (beda file dari
  `Input_Tempura`/`Input_Wonton`, perlu otorisasi tambahan).
- [x] Pastikan formula kolom A–F di `Buku Kas Harian` sudah ditarik ke bawah cukup
  jauh (misal 1000+ baris) — sekarang satu kali submit form bisa menambah 2–4 baris
  sekaligus ke `Input`, jadi baris terpakai lebih cepat dari sebelumnya.
- [x] Verifikasi end-to-end: submit form Tempura & Wonton → cek baris baru muncul
  benar di sheet `Input` Buku Kas Gabungan (kategori & nominal sesuai tabel di atas).

### Dipertimbangkan tapi tidak dikerjakan

- Rekap Bulanan tidak perlu diubah — begitu data baru masuk ke `Input` dan terhitung
  di `Buku Kas Harian` (asal formula sudah ditarik cukup jauh), SUMIFS di Rekap
  Bulanan otomatis ikut menangkap tanpa perubahan apa pun.

### Dua Jalur Entri ke Sheet `Input` (Buku Kas Gabungan)

Penting dipahami: sheet `Input` menerima data dari **dua sumber berbeda**, jangan
disamakan:

1. **Otomatis** — dikirim sistem lewat `kirimKeBukuKas()` begitu karyawan submit
   form setoran Tempura/Wonton. Kategori yang lahir dari jalur ini:
   `Setoran Cabang Tempura`, `Sterofoam Tempura`, `Setoran Cabang Babakan`,
   `Setoran Cabang Leweung Gajah`, `Gaji/Upah`, `Pengeluaran Operasional`,
   `Uang Jajan Karyawan`. **Tidak perlu — dan tidak boleh — diinput ulang manual
   untuk transaksi yang sama.**

2. **Manual** — diinput pemilik sendiri lewat form chip Buku Kas Gabungan
   (`index.html`). Dipakai untuk kategori yang memang tidak ada form
   setoran otomatisnya, atau kasus di luar cakupan form setoran:
   `MAO Frozen`, `MAO Instan`, `Outlet` (fallback darurat **dan** jalur reguler
   Setoran Cabang Depan RS), `Lainnya`, `Dividen`, `Sewa Tempat`, `Bonus`,
   `Parkir`, `Belanja`, serta `Gaji/Upah` & `Tunjangan` untuk kasus yang tidak
   lewat form setoran (mis. gaji karyawan non-cabang).

   **Perhatian:** karena `Gaji/Upah` bisa masuk lewat jalur otomatis (setoran
   cabang) *maupun* manual, pastikan tidak input manual untuk gaji yang sudah
   otomatis terkirim lewat form setoran — cek dulu di `Input_Tempura`/
   `Input_Wonton` kalau ragu.

### Kategori "Outlet" — Dua Kegunaan, Jangan Tertukar

`Outlet` di form manual punya **dua fungsi berbeda**, penting untuk tidak
mencampur prosedurnya:

**A. Fallback darurat** (setoran Tempura/Babakan/Leweung Gajah yang harusnya lewat
form setoran otomatis, tapi `kirimKeBukuKas()` gagal). **Sebelum input manual untuk
kasus ini, wajib cek dulu:**

1. Buka `Input_Tempura` / `Input_Wonton` untuk tanggal & cabang yang sama.
2. Kalau baris setoran hari itu **sudah ada** di sana — cek juga apakah baris
   itu **sudah berhasil** terkirim ke `Input` Buku Kas Gabungan (lihat kolom
   Timestamp yang matching, atau cek notifikasi Telegram alert kegagalan).
3. Kalau sudah berhasil terkirim otomatis → **jangan** input manual lagi, akan
   dobel hitung.
4. Kalau memang gagal (ada alert Telegram error, atau baris tidak ketemu di
   `Input`) → baru input manual pakai `Outlet`, dengan nominal & tanggal yang
   sesuai baris di `Input_Tempura`/`Input_Wonton` yang gagal terkirim tadi.

**B. Jalur reguler untuk Setoran Cabang Depan RS** — cabang ini **tidak punya**
form setoran otomatis sama sekali, jadi **tidak perlu** cek prosedur di atas
(poin 1–4 tidak berlaku, karena memang tidak ada `Input_Tempura`/`Input_Wonton`
untuk cabang ini). Setiap setoran Depan RS memang selalu manual lewat kategori
`Outlet` + sub-pilihan cabang "Depan RS", tanpa perlu validasi kegagalan sistem.

Kategori `Outlet` tetap dikenali sebagai Uang Masuk oleh formula `REGEXMATCH` di
`Buku Kas Harian` — *(isi whitelist lengkap menyusul setelah formula terbaru
dikonfirmasi)*.

## 15. Fitur Baru: Scan Struk Belanja → Riwayat Harga (`Scan-Struk/index.html`)

Fitur **terpisah total** dari Buku Kas Gabungan/Kas harian — tujuannya murni
mendata harga barang per toko dari foto struk, supaya ke depannya bisa dipantau
kalau ada perubahan harga. **Tidak menyentuh sheet `Input` (kas) sama sekali.**

### Alasan & Konteks
- Selama ini input harga bahan baku manual satu-satu, tidak ada histori harga
  per barang per toko.
- Dipilih pendekatan foto struk → OCR pakai **Gemini API** (model
  `gemini-2.5-flash`) untuk ekstrak daftar barang (nama, qty, satuan, harga
  satuan) langsung jadi JSON, alih-alih OCR teks mentah yang masih perlu
  di-parse manual.
- **Sengaja dipisah dari form kas** (`index.html`) — beda tujuan data (riwayat
  harga vs transaksi kas), jadi dibuatkan halaman, `Code.gs`, dan deployment
  Web App sendiri (pola sama seperti alasan pemisahan `formulir-karyawan.html`
  di Section 13).
- **Rekap/deteksi otomatis "harga berubah atau tidak" sengaja DITUNDA** — fokus
  dulu memastikan alur scan & simpan berjalan sempurna. Semua baris yang
  dikonfirmasi user saat ini langsung tersimpan apa adanya, belum ada logika
  bandingkan dengan harga sebelumnya per barang.

### Alur Kerja
1. Pemilik buka halaman scan (link dari `index.html`), pilih toko (pakai daftar
   chip yang sama dengan field "Belanja di" di form kas — Ayam Ma'mun, Ayam
   Depan Pasar, Ayam Bi Warsih, Baso Adib, Gas Abah, Kulit Pangsit, Mega Frozen,
   Mini Frozen, Ngena-Q Frozen, Plastik DA, Plastik Pasar, Sayur, Surya, Telor,
   + "Toko lain…").
2. Foto struk dipilih (bebas kamera/galeri, tidak dipaksa `capture`), dikompres
   di browser via `<canvas>` (dibatasi total piksel, sama seperti pola di
   `formulir-karyawan.html`) sebelum dikirim.
3. Tombol **"Scan Struk"** kirim foto (base64) ke Apps Script → Apps Script
   panggil Gemini API → dapat JSON list barang.
4. Hasil ditampilkan sebagai **preview bergaya struk (editable)** — tiap baris
   bisa diedit nama/qty/satuan/harga, dihapus, atau ditambah manual — supaya
   dicek dulu sebelum tersimpan (mengikuti pola "CEK HASIL" di form Tempura,
   Section 11).
5. Tombol **"Simpan ke Riwayat Harga"** kirim baris yang sudah dikonfirmasi →
   Apps Script `appendRow` (batch, `setValues`) ke sheet.

### Struktur Data
- Spreadsheet baru, terpisah dari Buku Kas Gabungan: **"Data Harga Belanja"**.
- Sheet/tab dibuat otomatis (kalau belum ada, sama pola seperti
  `Input_Tempura`/`Input_Wonton`): **`Input Harga Belanja`**.
- Kolom: `Timestamp, Toko, Nama Barang, Qty, Satuan, Harga Satuan (Rp), Harga
  Total (Rp)`.

### Implementasi Teknis
- **Backend**: `Code.gs` baru & terpisah, dua action lewat `doPost`:
  - `action: "scan"` → terima base64 gambar, panggil Gemini
    (`generateContent`), parse balikan jadi JSON array `{nama, qty, satuan,
    harga_satuan}`, kembalikan ke client.
  - `action: "save"` → terima `toko` + array item yang sudah dikonfirmasi user,
    `appendRow` batch ke sheet `Input Harga Belanja`.
  - API key Gemini disimpan di **Script Properties** (`GEMINI_API_KEY`), tidak
    pernah ada di kode client/HTML.
- **CORS**: karena butuh baca response (beda dari form kas yang pakai
  `no-cors`), fetch dari HTML pakai `Content-Type: text/plain;charset=utf-8`
  supaya browser tidak trigger CORS preflight (`OPTIONS`) yang tidak didukung
  Apps Script — bukan `application/json`.
- **Frontend**: satu file HTML mandiri (chip toko + upload foto + preview
  struk editable), font monospace untuk list item (gaya struk), aksen
  terracotta konsisten dengan tema Uang Keluar/Belanja di form kas.

### Hosting (GitHub Pages)
- Form kas (`index.html`) dan fitur scan struk sekarang di-*host* lewat GitHub
  Pages dari repo `Work`, folder `Pencatatan-Buku-Kas`:
  - Form kas: `https://moroxixi.github.io/Work/Pencatatan-Buku-Kas/index.html`
  - Scan struk: `https://moroxixi.github.io/Work/Pencatatan-Buku-Kas/Scan-Struk/index.html`
  - Artinya file `scan-struk.html` yang dibuat Claude **diganti nama jadi
    `index.html`** dan ditaruh di subfolder `Scan-Struk/` di dalam folder
    `Pencatatan-Buku-Kas/`.
  - Link balik dari halaman scan ke form kas (`<a href="index.html">`) perlu
    dicek ulang path-nya — karena sekarang beda folder (`Scan-Struk/` vs
    root `Pencatatan-Buku-Kas/`), link relatif `index.html` di halaman scan
    akan mengarah ke `Scan-Struk/index.html` itu sendiri (salah), seharusnya
    `../index.html`.

### Status & Yang Perlu Didebug
- [x] **Belum diverifikasi end-to-end.** Baru dibuatkan kode & panduan setup,
  pemilik belum sempat coba jalan penuh (isi API key, deploy Apps Script,
  scan struk asli, cek data masuk ke sheet).
- [x] Cek `SCRIPT_URL` di `Scan-Struk/index.html` sudah diisi URL Web App yang
  benar (bukan placeholder `PASTE_URL_WEB_APP_DI_SINI`).
- [x] Cek `GEMINI_API_KEY` sudah diset di Script Properties project Apps
  Script yang benar (project punya spreadsheet "Data Harga Belanja", bukan
  project kas/Tempura/Wonton).
- [ ] Cek fetch `text/plain` tidak kena CORS error di browser HP (beda
  behaviour dari `no-cors` yang dipakai form kas — kalau gagal, biasanya error
  muncul jelas di response, bukan diam-diam sukses palsu seperti form kas).
- [x] **Perbaiki link relatif** `<a href="index.html">` di halaman scan supaya
  jadi `<a href="../index.html">` (lihat catatan hosting di atas).
- [ ] Cek nama model Gemini (`gemini-2.5-flash`) masih valid — kalau error 404
  model not found, cek nama model terbaru di aistudio.google.com.
- [ ] Kalau hasil OCR sering salah baca nama/harga barang, evaluasi apakah
  perlu prompt lebih spesifik atau kompresi foto diturunkan (kualitas gambar
  vs ukuran payload).
- [ ] Rekap/deteksi perubahan harga per barang (ditunda sengaja) — belum
  dikerjakan, menyusul setelah alur scan-simpan stabil.


  ## 16. Update — Fix Model Gemini Deprecated & Multi-API-Key Fallback (`Scan-Struk/Code.gs`)

### Masalah yang Ditemukan
- Setelah percobaan pertama scan struk, muncul error: `models/gemini-2.5-flash is no longer
  available to new users` — model di `GEMINI_MODEL` sudah di-deprecate Google.
- Setelah ganti model, muncul error kedua: `This model is currently experiencing high demand` —
  ini bukan bug, tapi overload sementara di sisi server Gemini (mirip HTTP 503), sifatnya
  temporary spike, bisa hilang sendiri kalau dicoba ulang.

### Fix 1 — Ganti Model
- `GEMINI_MODEL` diganti dari `"gemini-2.5-flash"` (deprecated) ke `"gemini-3.5-flash"` (GA/stable,
  bukan preview, jadi tidak akan tiba-tiba di-shutdown dalam waktu dekat).
- Dipertimbangkan juga `gemini-2.5-flash-lite` tapi **tidak dipilih** karena EOL-nya sudah dekat
  (22 Juli 2026) — berpotensi error lagi dalam waktu singkat kalau dipakai.

### Fix 2 — Multi-API-Key dengan Fallback (untuk kasus overload/limit)
- Pemilik punya **6 API key Gemini** (idealnya dari akun/project Google berbeda-beda supaya kuota
  benar-benar terpisah, bukan digabung).
- **Strategi: Fallback**, bukan round-robin — key ke-1 selalu dicoba duluan di tiap request; kalau
  gagal karena kondisi *retryable* (HTTP 429/503, atau response mengandung `"high demand"`,
  `"quota"`, `"RESOURCE_EXHAUSTED"`, `"UNAVAILABLE"`), otomatis lanjut coba key ke-2, dst sampai
  key ke-6.
- Kalau error yang muncul **bukan** soal overload/limit (misal API key salah/invalid, request
  salah format) — sistem **tidak** buang waktu coba key lain, langsung lempar error apa adanya.
- Kalau **semua 6 key** gagal dicoba, baru dilempar error final ke `doPost` (ditangkap `try/catch`
  yang sudah ada, dikirim balik ke form sebagai `{ok: false, error: ...}`).

### Perubahan Struktur Script Properties
- **Sebelumnya**: satu property `GEMINI_API_KEY`.
- **Sekarang**: enam property `GEMINI_API_KEY_1` s/d `GEMINI_API_KEY_6` — wajib diisi semua di
  Script Properties project Apps Script "Data Harga Belanja" (bukan project kas/Tempura/Wonton).
- Property lama `GEMINI_API_KEY` boleh dihapus (opsional, sudah tidak dipakai lagi, tidak
  mengganggu kalau dibiarkan).

### Perubahan Kode (`Code.gs` Scan Struk)
- Fungsi baru `getGeminiApiKeys_()` — kumpulkan semua key `GEMINI_API_KEY_1..6` yang terisi dari
  Script Properties jadi array.
- Fungsi baru `callGeminiGenerateContent_(payload)` — bungkus `UrlFetchApp.fetch` ke Gemini
  dengan loop fallback di atas, menggantikan pemanggilan fetch langsung yang sebelumnya ada di
  `callGeminiOCR_()`.
- `callGeminiOCR_()` disesuaikan supaya manggil `callGeminiGenerateContent_()` — bagian
  prompt & parsing JSON hasil OCR **tidak berubah**.
- Fungsi `doGet`, `doPost`, `jsonResponse_`, `saveItems_`, `formatTimestampWIB_` **tidak diubah**.

### Belum Dikerjakan / Dipertimbangkan
- Alert Telegram untuk kasus "semua 6 key gagal" **belum ditambahkan** — project Scan Struk
  sengaja terpisah dari project Tempura/Wonton yang sudah punya integrasi Telegram
  (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`). Bisa ditambahkan kalau dibutuhkan, tinggal pakai pola
  Script Properties yang sama.
- [ ] **Belum ditest end-to-end** dengan 6 key yang sebenarnya — perlu diisi semua 6 property lalu
  dicoba scan struk asli untuk pastikan fallback jalan dan model baru tidak error lagi.


## 17. Fix Bug — Tombol Scan Struk Tidak Bisa Ditekan & Keyboard Turun Saat Edit (`Scan-Struk/index.html`)

### Bug 1 — Tombol "Scan Struk" tetap disabled setelah pilih foto
- **Penyebab**: `compressImage()` bisa reject (promise gagal) tanpa ada `try/catch`
  di handler `fileInput`, paling sering kalau foto diambil dari **galeri iPhone**
  dalam format **HEIC** (bukan JPEG) — `<img>` gagal decode, `img.onerror` fire,
  promise reject, sisa kode (update preview + `updateScanBtnState()`) tidak
  pernah jalan. Efeknya foto kelihatan "terpilih" tapi tombol tetap abu-abu
  tanpa pesan error apa pun.
- **Fix**: tambahkan `try/catch` di handler `fileInput` — kalau gagal, tampilkan
  pesan di `#scanStatus` ("Gagal proses foto...") supaya kelihatan, bukan gagal
  diam-diam.
- **Solusi tambahan untuk pemilik**: kalau masih gagal karena HEIC, ambil foto
  langsung dari kamera (auto-JPEG), atau ubah Settings → Camera → Formats →
  "Most Compatible" di iPhone supaya hasil galeri jadi JPEG.
- Ditambahkan juga hint teks di bawah tombol: "Pilih toko & foto struk dulu
  untuk mengaktifkan tombol" — supaya kalau tombol disabled karena toko belum
  dipilih (bukan soal foto), user tidak bingung.

### Bug 2 — Keyboard turun tiap 1 karakter saat edit nama/qty/harga di preview struk
- **Penyebab**: setiap event `input` pada field edit (nama/qty/satuan/harga)
  memanggil `renderItems()` yang **membangun ulang seluruh DOM list** lewat
  `list.innerHTML = ""`. Ini menghancurkan `<input>` yang sedang difokus dan
  membuat elemen baru — Safari/Chrome iOS membaca ini sebagai fokus hilang,
  jadi keyboard turun tiap 1 huruf diketik.
- **Fix**: pisahkan tanggung jawab render:
  - `renderItems()` (rebuild penuh DOM) hanya dipanggil di titik yang memang
    butuh struktur baru: setelah hasil scan pertama kali, setelah "Tambah
    Baris Manual", dan setelah klik hapus/batal baris — situasi ini user
    tidak sedang fokus mengetik di input lain, jadi aman di-rebuild.
  - Event `input` pada field edit **tidak lagi** memanggil `renderItems()`.
    Sebagai gantinya cuma update `items[i][f]` di data, lalu update teks
    total per-baris (`.item-total`) dan panggil fungsi baru `updateTotals()`
    (hitung ulang count & grand total) — tanpa menyentuh/rebuild elemen
    `<input>` itu sendiri, jadi fokus & keyboard tetap stabil.
- Fungsi baru: `updateTotals()` — cuma update `#itemCount` & `#grandTotal`,
  dipisah dari logika rebuild DOM di `renderItems()`.
- **Catatan**: fix ini murni di file HTML (frontend), tidak menyentuh
  `Code.gs` sama sekali — jadi cukup commit/push ulang HTML ke GitHub Pages,
  **tidak perlu** deploy ulang Apps Script.

### Status
- [x] Kedua bug sudah diperbaiki di `Scan-Struk/index.html`.
- [ ] Belum ada laporan lanjutan dari pemilik apakah HEIC memang jadi
  penyebab pasti Bug 1 (baru dugaan kuat berdasarkan pola iPhone + galeri) —
  perlu dikonfirmasi kalau muncul lagi.



## 18. Fitur Baru — Deteksi Duplikat Harga di Scan Struk (`Scan-Struk/Code.gs`)

### Tujuan
Mencegah sheet `Input Harga Belanja` dipenuhi baris duplikat untuk kombinasi
barang yang harganya belum berubah — supaya riwayat harga tetap bersih tanpa
perlu bersih-bersih manual.

### Kriteria Duplikat
Dua baris dianggap **kombinasi yang sama** kalau `Toko + Nama Barang + Harga
Satuan` cocok persis (dinormalisasi: `trim()` + lowercase, tapi data yang
tersimpan ke sheet tetap teks asli, normalisasi cuma dipakai untuk
pembanding).

### Aturan
- Kalau kombinasi **sudah pernah ada** di sheet (kapan pun sebelumnya, dicek
  dari histori total, bukan cuma dalam satu sesi scan) → **tidak disimpan
  lagi**, dilewati begitu saja.
- Tidak ada ambang batas jumlah (awalnya sempat dipertimbangkan skip setelah
  3x duplikat, tapi diputuskan skip sejak duplikat pertama — lebih aman dari
  risiko dobel yang tidak disadari).
- Kalau harga berubah, itu otomatis jadi kombinasi baru (karena harga adalah
  bagian dari kriteria "sama") — tidak perlu logika reset terpisah, cukup
  aturan skip di atas saja sudah menghasilkan perilaku itu dengan sendirinya.
- Duplikat **dalam satu batch scan yang sama** (misal Gemini kebaca dobel di
  satu struk) juga ikut ke-detect, tidak cuma dibandingkan ke data lama.
- Pengecekan berjalan **diam-diam di backend** (action `"save"`), tidak
  ditampilkan ke user di layar preview HP.

### Implementasi Teknis
- Fungsi `saveItems_()` diubah: sebelum `appendRow`, baca dulu seluruh data
  existing di sheet lewat fungsi baru `getExistingKeys_()` (baca kolom B–F,
  bikin `Set` kombinasi `toko|nama|harga`), lalu tiap item baru dicek ke
  situ sebelum disimpan.
- Fungsi baru `normalizeKey_(toko, nama, harga)` — bikin key pembanding yang
  konsisten (trim + lowercase + angka murni untuk harga).
- Return value `saveItems_()` berubah dari sekadar angka (`count`) jadi objek
  `{ saved, skipped }` — field `skipped` sudah dikirim balik lewat response
  JSON (`{ok:true, saved, skipped}`), tapi **belum dipakai di
  `Scan-Struk/index.html`** (sengaja diam-diam sesuai keputusan, tapi field-nya
  sudah tersedia kalau nanti mau ditampilkan).
- Fungsi lain (`doGet`, `callGeminiGenerateContent_`, `callGeminiOCR_`,
  `formatTimestampWIB_`) **tidak diubah**.

### Status
- [x] Kode sudah direvisi & siap deploy.
- [ ] Belum ditest end-to-end dengan data riil (scan struk yang barangnya
  sudah pernah tercatat sebelumnya, pastikan benar ke-skip dan tidak dobel).
- [ ] Pertimbangan lanjutan (belum dikerjakan): tampilkan info "X item
  dilewati karena harga sudah tercatat" di preview `index.html` — tinggal
  pakai field `skipped` yang sudah dikirim backend.

## 19. Fitur Baru — Rekap Riwayat & Katalog Harga (`Riwayat Harga`, `Katalog Toko`)

### Tujuan
Data mentah di `Input Harga Belanja` (hasil scan struk) dirapikan jadi 2 tab rekap
baru, murni pakai formula (link langsung, tidak ada input manual/appendRow baru).
Tujuannya: (1) bisa lihat riwayat & tren perubahan harga per barang per toko dari
waktu ke waktu, (2) bisa lihat "katalog" barang apa saja yang pernah dibeli di
tiap toko.

### Sheet `Riwayat Harga`
- Log lengkap semua transaksi dari `Input Harga Belanja`, urut tanggal (`QUERY`).
- Kolom tambahan otomatis: **Harga Sebelumnya** (harga terakhir sebelum baris ini
  untuk kombinasi Toko+Barang yang sama, pakai `SUMIFS`+`MAXIFS`), **Status**
  (Baru/Naik/Turun/Tetap), **Selisih (Rp)**, **Selisih (%)**.
- Bisa dipasang filter di kolom Status untuk cuma lihat baris "Naik"/"Turun" kalau
  mau fokus ke barang yang harganya berubah saja (filter view, data tetap utuh).

### Sheet `Katalog Toko`
- Rekap 1 baris per kombinasi Toko+Barang (`QUERY` dengan `group by`): Jumlah
  Beli, Tanggal Pertama, Tanggal Terakhir, Harga Terakhir, Harga Pertama, Jumlah
  Kali Harga Berubah (dihitung dari kolom Status di `Riwayat Harga`), Tren (naik/
  turun/stabil dari harga pertama ke terakhir).
- Fungsi seperti "katalog" — bisa lihat barang apa saja yang biasa dijual/dibeli
  di toko tertentu, tanpa perlu scroll data mentah.

### Catatan Penting: Locale Formula Pakai Titik Koma (`;`), Bukan Koma (`,`)
- Spreadsheet ini pakai locale yang menganggap `;` sebagai pemisah argumen
  formula (bukan `,` seperti default umum). Semua formula di kedua sheet baru
  ini **wajib** ditulis pakai `;` sebagai pemisah argumen.
- **Pengecualian:** koma **di dalam tanda kutip** (bagian query string function
  `QUERY`, misal `"select B, C, count(C)..."`) tetap pakai koma biasa — itu
  bahasa internal QUERY, bukan pemisah argumen Sheets, jangan ikut diganti jadi
  `;`.
- **Gejala kalau salah pemisah**: muncul error "Error mengurai formula" (parse
  error), bukan `#REF!` — jangan salah duga sebagai masalah spasi di nama sheet.
- **Perhatian saat copy-paste formula dari luar (misal dari chat/dokumen)**:
  tanda kutip ganda (`"`) kadang ikut ter-convert jadi *smart quotes* (`" "`)
  yang terlihat sama tapi beda karakter, bikin formula gagal di-parse. Solusi
  paling aman: ketik ulang manual di formula bar untuk bagian tanda kutipnya,
  bukan paste langsung.

### Status
- [x] Kedua sheet & semua formula sudah ditest end-to-end oleh pemilik — berjalan
  normal, otomatis update tiap ada data baru masuk ke `Input Harga Belanja`.
