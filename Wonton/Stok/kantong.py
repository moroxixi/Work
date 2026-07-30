import sys
from datetime import datetime

def hitung_pesanan_ayam():
    # Rasio: 20kg ayam = 7.5 kantong
    RASIO_KG_PER_KANTONG = 20 / 7.5

    try:
        # Input target kantong yang diinginkan
        target_input = input("Masukkan jumlah kantong yang diinginkan: ").strip()
        target_kantong = float(target_input) if target_input else 0.0

        # Input sisa kantong yang ada saat ini
        sisa_input = input("Masukkan sisa kantong saat ini: ").strip()
        sisa_kantong = float(sisa_input) if sisa_input else 0.0

        # Kalkulasi
        kekurangan_kantong = target_kantong - sisa_kantong
        
        if kekurangan_kantong <= 0:
            print("\nStok masih cukup. Tidak perlu pesan ayam tambahan.")
        else:
            total_kg_pesanan = kekurangan_kantong * RASIO_KG_PER_KANTONG
            print("-" * 30)
            print(f"Kekurangan: {kekurangan_kantong} kantong")
            print(f"Total ayam yang harus dipesan: {total_kg_pesanan:.2f} kg")
            print("-" * 30)

    except ValueError:
        print("Error: Harap masukkan angka yang valid (gunakan titik untuk desimal, misal: 0.5)")

def _dalam_range_reminder():
    """Cek apakah waktu sekarang masuk Range A (Kamis 20:00 - Jumat 05:00)
    atau Range B (Jumat 20:00 - Sabtu 05:00).

    Range A: Kamis (weekday=3) 20:00:00 s.d. Jumat (4) 05:00:00 (05:00 tidak termasuk)
    Range B: Jumat (4) 20:00:00 s.d. Sabtu (5) 05:00:00 (05:00 tidak termasuk)
    """
    now = datetime.now()
    hari = now.weekday()   # Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    jam = now.hour

    # Range A: Kamis (3) 20:00:00 s.d. Jumat (4) 05:00:00 (05:00 tidak termasuk)
    in_range_a = (hari == 3 and jam >= 20) or (hari == 4 and jam < 5)

    # Range B: Jumat (4) 20:00:00 s.d. Sabtu (5) 05:00:00 (05:00 tidak termasuk)
    in_range_b = (hari == 4 and jam >= 20) or (hari == 5 and jam < 5)

    return in_range_a or in_range_b

if __name__ == "__main__":
    hitung_pesanan_ayam()

    # Reminder stok untuk besok pagi
    if _dalam_range_reminder():
        print()
        print("Tambahkan 1-2 kantong lagi untuk stok besok pagi")
