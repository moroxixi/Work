#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notif_total_harian.py — Poller kolom Z (Bbkn) & AB (Total) sheet "Report 2026".

Dua mode (--mode):
  cek-z          : dipanggil tiap 15 menit oleh notif-cek-kolom-z.timer.
                   Gating WAKTU DI DALAM SCRIPT (Asia/Jakarta): hanya memproses
                   kalau 21:30 <= now < 23:00 (window final). Di luar window
                   exit 0 tanpa efek (bukan error). Fetch webapp
                   (action=totalHarian&token=...). Kalau kolomZ terisi
                   (bukan null/kosong) DAN state file belum berisi tanggal
                   hari ini -> kirim notif ntfy topic "report-checker" dan
                   tulis tanggal ke state file. Kalau sudah pernah kirim
                   hari ini -> skip (tidak dobel).
  fallback-2300  : dipanggil tepat jam 23:00 oleh notif-fallback-2300.timer.
                   Kalau state file sudah berisi tanggal hari ini -> skip
                   (sudah kekirim via cek-z). Kalau belum -> kirim notif
                   fallback "Rekap Jam 23:00 (Kolom Z belum terisi)" + total
                   apa adanya + link, lalu tulis tanggal ke state.

Config dibaca dari config.local.env di folder yang sama (KEY=VALUE per baris,
# = komentar). Env var override: DRY_RUN, MOCK_NOW, MOCK_WEBAPP_JSON,
WEBAPP_URL, WEBAPP_TOKEN, NTFY_TOPIC, NTFY_BASE_URL.

DRY_RUN=1  -> semua network call (webapp & ntfy) hanya di-print, tidak ada
              request sungguhan. Dipakai untuk testing.
MOCK_NOW   -> (testing, hanya aktif saat DRY_RUN=1) waktu sekarang palsu,
              format ISO mis. "2026-08-09T22:00:00+07:00", supaya window
              gate bisa diuji di luar jam asli.
MOCK_WEBAPP_JSON -> (testing, hanya aktif saat DRY_RUN=1) response JSON webapp
              palsu, mis. '{"ok":true,"tanggal":"09/08/2026","kolomZ":123,"total":456,"link":"..."}'.

State file: state/last-sent-date.txt (isi: YYYY-MM-DD). Folder state/ di-gitignore.
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# ---------------------------------------------------------------------------
# Konstanta
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_FILE = SCRIPT_DIR / "config.local.env"
STATE_DIR = SCRIPT_DIR / "state"
STATE_FILE = STATE_DIR / "last-sent-date.txt"

TZ_WIB = ZoneInfo("Asia/Jakarta")

WINDOW_START = (21, 30)  # 21:30
WINDOW_END = (23, 0)     # 23:00 (eksklusif)

# Retry ntfy — pola sama dengan report_kirimNotif_() di report.gs
MAX_ATTEMPT = 2
RETRY_DELAY_MS = 2000

DEFAULT_NTFY_TOPIC = "report-checker"
DEFAULT_NTFY_BASE_URL = "https://ntfy.sh"


# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------
def load_config():
    cfg = {}
    if CONFIG_FILE.exists():
        for line in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            cfg[key.strip()] = val.strip()
    return cfg


CFG = load_config()


def cfg_get(key, default=""):
    """Env var override duluan, baru config file."""
    return os.environ.get(key, CFG.get(key, default))


# ---------------------------------------------------------------------------
# Waktu
# ---------------------------------------------------------------------------
def now_wib():
    mock = os.environ.get("MOCK_NOW")
    if is_dry_run() and mock:
        # Parse ISO 8601, paksa ke zona Asia/Jakarta
        return datetime.fromisoformat(mock).astimezone(TZ_WIB)
    return datetime.now(TZ_WIB)


def today_key():
    return now_wib().strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# State file
# ---------------------------------------------------------------------------
def read_state():
    if not STATE_FILE.exists():
        return None
    return STATE_FILE.read_text(encoding="utf-8").strip() or None


def write_state(value):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(value + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Dry-run helper
# ---------------------------------------------------------------------------
def is_dry_run():
    return os.environ.get("DRY_RUN") == "1"


# ---------------------------------------------------------------------------
# Network: fetch webapp
# ---------------------------------------------------------------------------
def fetch_webapp():
    mock = os.environ.get("MOCK_WEBAPP_JSON")
    # Mode testing: mock response dipakai tanpa perlu URL sungguhan.
    if is_dry_run() and mock:
        print("[DRY_RUN] fetch webapp (pakai MOCK_WEBAPP_JSON, tanpa request sungguhan)")
        return json.loads(mock)

    url = cfg_get("WEBAPP_URL", "").strip()
    token = cfg_get("WEBAPP_TOKEN", "").strip()

    if not url:
        print("[notif] WEBAPP_URL kosong — isi config.local.env setelah deploy. Exit 0 tanpa efek.")
        return None
    if not token:
        print("[notif] WEBAPP_TOKEN kosong — isi config.local.env. Exit 0 tanpa efek.")
        return None

    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}action=totalHarian&token={urllib.parse.quote(token)}"

    if is_dry_run():
        print(f"[DRY_RUN] fetch webapp (TIDAK dijalankan): {full_url}")
        return None

    try:
        req = urllib.request.Request(full_url)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as err:
        print(f"[notif] Gagal fetch webapp: {err}")
        return None


# ---------------------------------------------------------------------------
# Network: kirim ntfy (retry 2x / delay 2s, pola report_kirimNotif_)
# ---------------------------------------------------------------------------
def send_ntfy(pesan, judul, link=""):
    base = cfg_get("NTFY_BASE_URL", DEFAULT_NTFY_BASE_URL).strip().rstrip("/")
    topic = cfg_get("NTFY_TOPIC", DEFAULT_NTFY_TOPIC).strip()
    url = f"{base}/{topic}"

    if is_dry_run():
        print(f"[DRY_RUN] kirim ntfy ke {url}")
        print(f"[DRY_RUN]   Title: {judul}")
        if link:
            print(f"[DRY_RUN]   Click: {link}")
        print(f"[DRY_RUN]   Body : {pesan}")
        return True

    headers = {"Title": judul}
    if link:
        headers["Click"] = link

    for attempt in range(1, MAX_ATTEMPT + 1):
        try:
            req = urllib.request.Request(
                url,
                data=pesan.encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                code = resp.getcode()
            if 200 <= code < 300:
                print(f"[notif] Notif terkirim (HTTP {code}) ke {url} (percobaan {attempt}/{MAX_ATTEMPT})")
                return True
            print(f"[notif] Percobaan {attempt}/{MAX_ATTEMPT} gagal, HTTP {code}")
        except Exception as err:
            print(f"[notif] Percobaan {attempt}/{MAX_ATTEMPT} error: {err}")
        if attempt < MAX_ATTEMPT:
            time.sleep(RETRY_DELAY_MS / 1000.0)

    print(f"[notif] Gagal kirim notif ntfy setelah {MAX_ATTEMPT} percobaan.")
    return False


# ---------------------------------------------------------------------------
# Mode cek-z
# ---------------------------------------------------------------------------
def mode_cek_z():
    now = now_wib()
    start = now.replace(hour=WINDOW_START[0], minute=WINDOW_START[1], second=0, microsecond=0)
    end = now.replace(hour=WINDOW_END[0], minute=WINDOW_END[1], second=0, microsecond=0)

    if not (start <= now < end):
        print(f"[notif] Di luar window 21:30-23:00 (sekarang {now.strftime('%H:%M')} WIB) — exit 0 tanpa efek.")
        return 0

    data = fetch_webapp()
    if data is None:
        return 0
    if not data.get("ok"):
        print(f"[notif] Webapp error: {data.get('error')}")
        return 0

    kolom_z = data.get("kolomZ")
    tanggal = data.get("tanggal", "")
    total = data.get("total")
    link = data.get("link", "")

    # Kolom Z belum terisi -> tunggu fallback jam 23:00
    if kolom_z is None or str(kolom_z).strip() == "":
        print("[notif] Kolom Z (Bbkn) belum terisi — tunggu fallback 23:00. Exit 0.")
        return 0

    # Sudah pernah kirim hari ini?
    if read_state() == today_key():
        print(f"[notif] State sudah berisi {today_key()} — skip (tidak dobel).")
        return 0

    pesan = f"Kolom Bbkn (Z) terisi untuk {tanggal}.\nTotal (AB): {total}"
    ok_kirim = send_ntfy(pesan, "Kolom Bbkn Terisi", link)
    if ok_kirim:
        write_state(today_key())
        print(f"[notif] State ditulis: {today_key()}")
    else:
        print("[notif] Kirim gagal — state TIDAK ditulis, poll berikutnya akan coba lagi.")
    return 0


# ---------------------------------------------------------------------------
# Mode fallback-2300
# ---------------------------------------------------------------------------
def mode_fallback_2300():
    # Sudah kekirim via cek-z?
    if read_state() == today_key():
        print(f"[notif] State sudah berisi {today_key()} — skip (sudah kekirim via cek-z).")
        return 0

    data = fetch_webapp()
    total = "-"
    tanggal = today_key()
    link = ""
    if data and data.get("ok"):
        total = data.get("total") if data.get("total") is not None else "-"
        tanggal = data.get("tanggal") or today_key()
        link = data.get("link", "")

    pesan = f"Rekap Jam 23:00 — kolom Z (Bbkn) belum terisi.\nTotal (AB): {total}"
    ok_kirim = send_ntfy(pesan, "Rekap Jam 23:00 (Kolom Z belum terisi)", link)
    if ok_kirim:
        write_state(today_key())
        print(f"[notif] State ditulis: {today_key()}")
    else:
        print("[notif] Kirim gagal — state TIDAK ditulis (fallback besok masih bisa coba lagi).")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Poller notif kolom Z/AB sheet Report 2026")
    parser.add_argument("--mode", required=True, choices=["cek-z", "fallback-2300"])
    args = parser.parse_args()

    if args.mode == "cek-z":
        return mode_cek_z()
    return mode_fallback_2300()


if __name__ == "__main__":
    sys.exit(main())
