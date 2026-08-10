#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notif_checker_poller.py — Poller hasil checker report.gs.js (action=checkerStatus).

Fase 2 konsolidasi ntfy: checker Apps Script (checkMissingReports,
checkDuplicatesAnomaliesForSheet) TIDAK lagi kirim ntfy langsung dari GAS
(Fase 1). Poller ini mengambil alih pengiriman notif untuk hasil checker tsb:

  - Fetch Web App  ?action=checkerStatus&token=<token>  (atau --mock fixture).
  - Untuk tiap checker: hitung fingerprint (checker + sheet + isi problems).
  - ok=false DAN fingerprint beda dari yang tersimpan (atau belum pernah ada)
    -> kirim ntfy + simpan fingerprint.
  - ok=true untuk checker -> hapus entry checker dari state (muncul lagi nanti
    = issue baru).

Mode:
  (default)  : fetch webapp nyata + kirim ntfy nyata + update state.
  --dry-run  : fetch BOLEH nyata (kalau endpoint sudah live nanti), tapi TIDAK
               kirim ntfy nyata (hanya print keputusan) & TIDAK update state.
  --mock PATH: baca response dari file fixture lokal, tanpa network sama sekali.

PENTING (fase development): endpoint action=checkerStatus BELUM live (Fase 1
belum di-deploy). Semua testing WAJIB pakai --mock. DILARANG menjalankan tanpa
--mock selama endpoint belum hidup — fetch sungguhan akan gagal/salah data.

Config dibaca dari config.local.env di folder yang sama — SUMBER CONFIG YANG
SAMA dengan notif_total_harian.py (jangan bikin config terpisah):
  WEBAPP_URL, WEBAPP_TOKEN, NTFY_TOPIC, NTFY_BASE_URL
Env override: DRY_RUN (setara --dry-run).

State file: state/checker-poller-state.json (di state/, folder runtime yang
di-gitignore, sama konvensi state notif_total_harian.py). Isi:
  { "<checker-key>": "<fingerprint-sha256>" }
Checker key: "<checker>" (tanpa sheet) atau "<checker>::<sheet>".

Pola retry ntfy: MAX_ATTEMPT=2 / RETRY_DELAY_MS=2000 — PERSIS sama dengan
send_ntfy() di notif_total_harian.py dan report_kirimNotif_() di report.gs.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Konstanta
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_FILE = SCRIPT_DIR / "config.local.env"
STATE_DIR = SCRIPT_DIR / "state"
STATE_FILE = STATE_DIR / "checker-poller-state.json"

# Retry ntfy — pola sama dengan notif_total_harian.py / report_kirimNotif_
MAX_ATTEMPT = 2
RETRY_DELAY_MS = 2000

DEFAULT_NTFY_TOPIC = "report-checker"
DEFAULT_NTFY_BASE_URL = "https://ntfy.sh"


# ---------------------------------------------------------------------------
# Config loader (gaya persis notif_total_harian.py)
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


def is_dry_run():
    return os.environ.get("DRY_RUN") == "1"


# ---------------------------------------------------------------------------
# State file (JSON: key checker -> fingerprint)
# ---------------------------------------------------------------------------
def read_state():
    if not STATE_FILE.exists():
        return {}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        # State korup -> mulai kosong (aman: akan dinotif ulang sekali)
        print(f"[notif] State file tidak terbaca ({STATE_FILE}) — mulai kosong.")
        return {}


def write_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Network: fetch webapp action=checkerStatus
# ---------------------------------------------------------------------------
def fetch_checker_status(mock_path=None):
    """Fetch ?action=checkerStatus&token=... (atau baca fixture kalau --mock)."""
    if mock_path:
        p = Path(mock_path)
        print(f"[mock] Baca response dari fixture: {p}")
        if not p.exists():
            print(f"[notif] Fixture tidak ditemukan: {p}")
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as err:
            print(f"[notif] Fixture JSON tidak valid ({p}): {err}")
            return None

    url = cfg_get("WEBAPP_URL", "").strip()
    token = cfg_get("WEBAPP_TOKEN", "").strip()

    if not url:
        print("[notif] WEBAPP_URL kosong — isi config.local.env. Exit 0 tanpa efek.")
        return None
    if not token:
        print("[notif] WEBAPP_TOKEN kosong — isi config.local.env. Exit 0 tanpa efek.")
        return None

    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}action=checkerStatus&token={urllib.parse.quote(token)}"

    if is_dry_run():
        print(f"[DRY_RUN] fetch webapp BOLEH dijalankan (endpoint sudah live) — {full_url}")

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
def send_ntfy(pesan, judul):
    base = cfg_get("NTFY_BASE_URL", DEFAULT_NTFY_BASE_URL).strip().rstrip("/")
    topic = cfg_get("NTFY_TOPIC", DEFAULT_NTFY_TOPIC).strip()
    url = f"{base}/{topic}"

    if is_dry_run():
        print(f"[DRY_RUN] kirim ntfy ke {url}")
        print(f"[DRY_RUN]   Title: {judul}")
        print(f"[DRY_RUN]   Body : {pesan}")
        return True

    headers = {"Title": judul}

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
# Fingerprint & dedup
# ---------------------------------------------------------------------------

# Detail problem dari GAS bisa memuat waktu cek yang berubah tiap run, mis.
# "Cabang belum lapor hari ini (cek jam 14:35)". Kalau dipakai mentah untuk
# hash, masalah yang SAMA PERSIS akan punya fingerprint beda tiap poll
# (14:35 -> 15:05) -> poller re-notify tiap 30 menit. Normalisasi: semua
# pola waktu (HH:MM / HH:MM:SS) diganti token stabil <time> sebelum di-hash.
_TIME_RE = re.compile(r"\b\d{2}:\d{2}(?::\d{2})?\b")


def _normalize_problem_detail(text):
    if not isinstance(text, str):
        return text
    return _TIME_RE.sub("<time>", text)


def checker_key(entry):
    """Key unik per checker: 'checker' atau 'checker::sheet'."""
    checker = entry.get("checker", "")
    sheet = entry.get("sheet")
    return f"{checker}::{sheet}" if sheet else checker


def compute_fingerprint(entry):
    """SHA-256 dari checker + sheet + isi problems (canonical JSON).

    Field timestamp checker TIDAK ikut di-hash (berubah tiap run). Detail
    problem dinormalisasi dulu (waktu -> <time>) supaya masalah yang sama
    persis punya fingerprint stabil antar poll.
    """
    problems = entry.get("problems", [])
    normalized = []
    for p in problems:
        if isinstance(p, dict):
            np_ = dict(p)
            if isinstance(np_.get("detail"), str):
                np_["detail"] = _normalize_problem_detail(np_["detail"])
            normalized.append(np_)
        else:
            normalized.append(p)
    payload = {
        "checker": entry.get("checker", ""),
        "sheet": entry.get("sheet"),
        "problems": normalized,
    }
    canonical = json.dumps(
        payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_message(entry):
    """Susun pesan ntfy dari problems checker (detail problem sudah berisi info lengkap)."""
    checker = entry.get("checker", "?")
    sheet = entry.get("sheet")
    problems = entry.get("problems", [])

    judul = f"Report Checker — {checker}" + (f" ({sheet})" if sheet else "")
    if problems:
        pesan = "\n\n".join(
            p.get("detail", json.dumps(p)) if isinstance(p, dict) else str(p)
            for p in problems
        )
    else:
        pesan = f"Checker {checker} melaporkan masalah tanpa detail."
    return pesan, judul


# ---------------------------------------------------------------------------
# Logic inti (pure — bisa di-test tanpa network)
# ---------------------------------------------------------------------------
def process_checkers(data, state):
    """Evaluasi response checkerStatus terhadap state.

    data  : dict response JSON (harus punya kunci 'checkers': list entry).
    state : dict {checker_key: fingerprint} — DI-MUTASI in-place.

    Return list keputusan:
      {key, action: 'notified'|'skipped'|'cleared'|'ok'|'unknown', ...}
    """
    decisions = []
    checkers = data.get("checkers", []) if isinstance(data, dict) else []

    for entry in checkers:
        key = checker_key(entry)
        ok = entry.get("ok")

        if ok is True:
            if key in state:
                del state[key]
                decisions.append({"key": key, "action": "cleared"})
            else:
                decisions.append({"key": key, "action": "ok"})
            continue

        if ok is False:
            fp = compute_fingerprint(entry)
            if state.get(key) == fp:
                decisions.append({"key": key, "action": "skipped"})
                continue
            pesan, judul = build_message(entry)
            ok_send = send_ntfy(pesan, judul)
            if ok_send:
                state[key] = fp
            decisions.append({"key": key, "action": "notified", "sent": ok_send})
            continue

        decisions.append({"key": key, "action": "unknown"})

    return decisions


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Poller hasil checker report.gs.js (action=checkerStatus) -> ntfy"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch boleh jalan (kalau live), tapi TIDAK kirim ntfy nyata & TIDAK update state.",
    )
    parser.add_argument(
        "--mock",
        metavar="PATH",
        help="Baca response dari file fixture lokal — tanpa network sama sekali. WAJIB untuk testing fase ini.",
    )
    args = parser.parse_args()

    if args.dry_run:
        os.environ["DRY_RUN"] = "1"

    data = fetch_checker_status(mock_path=args.mock)
    if data is None:
        return 0

    if not data.get("ok"):
        print(f"[notif] Webapp error: {data.get('error')}")
        return 0

    state = read_state()
    decisions = process_checkers(data, state)

    for d in decisions:
        if d["action"] == "notified":
            print(f"[NOTIFIED] {d['key']} (sent={d.get('sent')})")
        elif d["action"] == "skipped":
            print(f"[SKIP] {d['key']} — fingerprint sama dengan yang sudah dinotif")
        elif d["action"] == "cleared":
            print(f"[CLEARED] {d['key']} — ok=true, state dihapus")
        elif d["action"] == "ok":
            print(f"[OK] {d['key']} — tidak ada masalah")
        else:
            print(f"[UNKNOWN] {d['key']} — field ok bukan boolean")

    if not is_dry_run():
        write_state(state)
        print(f"[notif] State ditulis: {STATE_FILE}")
    else:
        print("[DRY_RUN] State TIDAK ditulis (dry-run).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
