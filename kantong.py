import sys

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

if __name__ == "__main__":
    hitung_pesanan_ayam()
