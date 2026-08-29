#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notif_total_harian.py — Poller Total (kolom AB) sheet "Report 2026".

Satu fungsi: cek_dan_kirim_total_harian() — dipanggil sekali sehari oleh
notif-total-harian.timer (jam 22:00 WIB). Fetch webapp
(action=totalHarian&token=...), ambil nilai Total (kolom AB) dari baris
tanggal hari ini, kirim notif ntfy. Anti-dobel via state file.

Config dibaca dari config.local.env di folder yang sama (KEY=VALUE per baris,
# = komentar). Env var override: DRY_RUN, MOCK_NOW, MOCK_WEBAPP_JSON,
WEBAPP_URL, WEBAPP_TOKEN, NTFY_TOPIC, NTFY_BASE_URL.

DRY_RUN=1  -> semua network call (webapp & ntfy) hanya di-print, tidak ada
              request sungguhan. Dipakai untuk testing.
MOCK_NOW   -> (testing, hanya aktif saat DRY_RUN=1) waktu sekarang palsu,
              format ISO mis. "2026-08-09T22:00:00+07:00".
MOCK_WEBAPP_JSON -> (testing, hanya aktif saat DRY_RUN=1) response JSON webapp
              palsu, mis. '{"ok":true,"tanggal":"09/08/2026","total":456,"link":"..."}'.

State file: state/last-sent-date.txt (isi: YYYY-MM-DD). Folder state/ di-gitignore.
"""

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
# Fungsi utama: cek Total (kolom AB) & kirim notif
# ---------------------------------------------------------------------------
def cek_dan_kirim_total_harian():
    """Ambil baris hari ini dari webapp, kirim Total (kolom AB) via ntfy."""
    # Anti-dobel: sudah kirim hari ini?
    if read_state() == today_key():
        print(f"[notif] State sudah berisi {today_key()} — skip (tidak dobel).")
        return 0

    data = fetch_webapp()
    if data is None:
        return 0
    if not data.get("ok"):
        print(f"[notif] Webapp error: {data.get('error')}")
        return 0

    total = data.get("total")
    tanggal = data.get("tanggal", "")
    link = data.get("link", "")

    # Baris hari ini tidak ditemukan di sheet — log saja, jangan kirim notif
    if total is None:
        print(f"[notif] Baris tanggal {today_key()} tidak ditemukan di sheet — exit 0.")
        return 0

    judul = f"Total Qris hari ini : {total}"
    pesan = f"Total (kolom AB) untuk tanggal {tanggal}: {total}"
    ok_kirim = send_ntfy(pesan, judul, link)

    if ok_kirim:
        write_state(today_key())
        print(f"[notif] State ditulis: {today_key()}")
    else:
        print("[notif] Kirim gagal — state TIDAK ditulis, poll berikutnya akan coba lagi.")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    cek_dan_kirim_total_harian()
    return 0


if __name__ == "__main__":
    sys.exit(main())
