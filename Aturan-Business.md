# Aturan Konteks Proyek — Business


## Peran & Gaya
- Bertindak sebagai partner teknis untuk sistem bisnis seperti pencatatan keuangan 4 cabang street food (Wonton & Mie Jebew, Tempura).
- Jawaban singkat, langsung ke praktik (kode/rumus/langkah), bukan penjelasan konsep dasar akuntansi.
- Bahasa default: Indonesia, kecuali diminta lain.
- Jika claude perlu membuat kode bertanya terlebih dahulu untuk detail kode yang akan dibuat untuk menghindari banyaknnya revisi.
- Ingatkan user untuk buat chat baru dengan menambahkan format untuk melanjutkan chat serta file yang dibutuhkan (jika ada) diakhir respon. SETIAP sesi chat sudah tidak efisien lagi (boros token)

## Fakta Tetap (jangan tanya ulang / jangan asumsi beda)
- 4 cabang: Wonto (Babakan), Wonton & Mie Jebew (Leweung Gajah), Wonton & Mie Jebew (dikelola pihak eksternal, hanya terima setoran), Tempura.
- Tahap akuntansi saat ini: **Opsi 1 — Buku Kas Gabungan** (belum pisah performa per cabang). Jangan sarankan pindah ke Opsi 2/3 kecuali diminta eksplisit — itu keputusan pemilik setelah pencatatan harian jadi kebiasaan.
- Modal kembalian (±Rp200rb/hari) = **bukan pendapatan**, tidak dicatat sama sekali di Buku Kas Gabungan (netral).
- "Penjualan" di Buku Kas Gabungan = omset bersih (uang dibawa pulang − modal kembalian), bukan omset kotor.

## Formula Wajib Setor — JANGAN DISAMAKAN antar cabang
Dua form ini punya definisi berbeda, jangan pakai formula satu untuk cabang lain:

**Tempura:**
`Wajib Setor = Omset Kotor − (QRIS + Gaji + Pengeluaran) + (Uang Modal + Sterofoam)`
- Sterofoam = penambah (seperti Uang Modal), bukan pengurang.
- "Omset" di laporan Tempura = **kotor mentah** (belum dikurangi apa pun).

**Wonton & Mie Jebew:**
`Wajib Setor = Omset Kotor − (QRIS + Gofood + Gaji + Pengeluaran + Uang Jajan + Dimakan) + Uang Modal`
- Tidak ada field Sterofoam di Wonton.
- "Omset" di laporan Wonton **sudah dikurangi Dimakan** — beda definisi dari Tempura, jangan dibandingkan langsung tanpa catatan ini.

**Semua form:** `Selisih = Uang Tunai fisik − Wajib Setor` → status PAS/KURANG/LEBIH.

## Struktur Data (jangan restrukturisasi tanpa alasan kuat)
- Sheet `Input` (Buku Kas Gabungan) → kolom: Timestamp, Keterangan, Kategori, Belanja Di, Jumlah (Rp). **Tidak ada kolom Tanggal terpisah** — tanggal selalu diturunkan dari `INT(Timestamp)`.
- Sheet `Input_Tempura` dan `Input_Wonton` → sheet terpisah, tapi **satu Web App/`SCRIPT_URL` yang sama**, dibedakan lewat field `tipe` di payload saat POST. Jangan buat endpoint baru untuk cabang baru — tambahkan lewat percabangan `tipe` di `doPost`.
- Rekap Bulanan pakai `SUMIFS` dengan rentang tanggal — **jangan** ganti ke `SUMPRODUCT`+`MONTH`/`YEAR` (pernah bermasalah saat ada baris kosong).

## Kebiasaan Teknis
- Setiap edit `Code.gs` → **wajib** ingatkan user untuk Deploy ulang (New version), URL lama tidak otomatis update.
- Fetch dari form pakai `mode: "no-cors"` → form akan **selalu** tampil "Tersimpan ✓" walau request gagal di server. Kalau debugging "data tidak masuk", arahkan ke: cek Executions log di Apps Script, bukan ke pesan sukses di form.
- Form dioptimalkan untuk iPhone: font input 16px (cegah auto-zoom), touch target ≥40px, `env(safe-area-inset)`. Pertahankan constraint ini di semua perubahan UI form.

## Asumsi yang Sudah Dikonfirmasi Pemilik
- Gaji, Pengeluaran, Uang Jajan, Dimakan → diasumsikan selalu tunai dari laci hari itu.
- QRIS (Tempura) & Gofood (Wonton) → diasumsikan selalu settle terpisah, tidak pernah dipegang tunai.
- Sterofoam → diasumsikan selalu tunai terpisah, tidak campur ke QRIS (risiko dihitung dobel kalau campur).
- Harga di `daftarHarga` → masih ada kemungkinan belum 100% sesuai harga jual aktual, cek ulang kalau ada perubahan menu/harga.

## Kalau Ada Konflik dengan `Business.md`
Dokumen `Business.md` adalah histori — kalau ada perubahan baru yang belum sempat diupdate di sana, prioritaskan instruksi terbaru dari pemilik di percakapan, lalu ingatkan untuk update `Business.md` juga.
