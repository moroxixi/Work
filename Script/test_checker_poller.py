#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_checker_poller.py — Test dedup logic notif_checker_poller.py.

TANPA network sama sekali: import modul langsung, monkeypatch send_ntfy dengan
simulasi, dan jalankan process_checkers() terhadap fixture lokal.

Menjalankan:
    python3 test_checker_poller.py

Skenario yang divalidasi:
  S1  Problem baru                -> notif "terkirim" (simulasi) + state diisi
  S2  Problem sama persis         -> TIDAK dikirim ulang (skip)
  S3  Problem resolved (ok=true)  -> entry state ke-clear
  S4  Problem sama muncul lagi
      setelah resolved            -> notif terkirim lagi + state diisi ulang
  S5  Semua ok dari awal          -> tidak ada notif & state tetap kosong

Exit code: 0 kalau semua lolos, 1 kalau ada yang gagal.
"""

import importlib.util
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

# Load modul poller sebagai modul biasa (bukan package)
spec = importlib.util.spec_from_file_location(
    "notif_checker_poller", SCRIPT_DIR / "notif_checker_poller.py"
)
ncp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ncp)

FIXTURES = SCRIPT_DIR / "fixtures"


def load_fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as f:
        return json.load(f)


def run():
    results = []

    def check(name, cond, extra=""):
        status = "PASS" if cond else "FAIL"
        results.append(cond)
        print(f"[{status}] {name}" + (f" — {extra}" if extra else ""))

    all_ok = load_fixture("checker-status-all-ok.json")
    problem = load_fixture("checker-status-problem-missing.json")
    resolved = load_fixture("checker-status-resolved.json")

    # Simulasi pengiriman ntfy: catat judul yang "terkirim"
    sent_juduls = []

    def fake_send_ntfy(pesan, judul):
        sent_juduls.append(judul)
        return True  # simulasi berhasil terkirim

    ncp.send_ntfy = fake_send_ntfy

    # ------------------------------------------------------------ S1
    state = {}
    decisions = ncp.process_checkers(problem, state)
    s1_sent = len(sent_juduls)
    s1_state_keys = sorted(state.keys())
    check(
        "S1 Problem baru -> notif terkirim (1x) + state diisi",
        s1_sent == 1 and len(state) == 1,
        f"sent={s1_sent}, state={s1_state_keys}, action={[d['action'] for d in decisions]}",
    )

    # ------------------------------------------------------------ S2
    sent_juduls.clear()
    decisions2 = ncp.process_checkers(problem, state)
    check(
        "S2 Problem sama persis -> TIDAK dikirim ulang (skip, state tetap)",
        len(sent_juduls) == 0 and len(state) == 1,
        f"sent={len(sent_juduls)}, state={sorted(state.keys())}, action={[d['action'] for d in decisions2]}",
    )

    # ------------------------------------------------------------ S3
    sent_juduls.clear()
    decisions3 = ncp.process_checkers(resolved, state)
    check(
        "S3 Problem resolved (ok=true) -> state ke-clear",
        len(state) == 0,
        f"state={sorted(state.keys())}, action={[d['action'] for d in decisions3]}",
    )

    # ------------------------------------------------------------ S4
    sent_juduls.clear()
    decisions4 = ncp.process_checkers(problem, state)
    check(
        "S4 Problem sama muncul lagi setelah resolved -> notif terkirim lagi",
        len(sent_juduls) == 1 and len(state) == 1,
        f"sent={len(sent_juduls)}, state={sorted(state.keys())}, action={[d['action'] for d in decisions4]}",
    )

    # ------------------------------------------------------------ S5
    sent_juduls.clear()
    state5 = {}
    decisions5 = ncp.process_checkers(all_ok, state5)
    check(
        "S5 Semua ok dari awal -> tidak ada notif & state tetap kosong",
        len(sent_juduls) == 0 and len(state5) == 0,
        f"sent={len(sent_juduls)}, state={sorted(state5.keys())}, action={[d['action'] for d in decisions5]}",
    )

    # Fingerprint deterministik? (faktor penting untuk dedup)
    fp1 = ncp.compute_fingerprint(problem["checkers"][0])
    fp2 = ncp.compute_fingerprint(problem["checkers"][0])
    check("S6 Fingerprint deterministik (input sama -> hash sama)", fp1 == fp2, fp1[:16] + "...")

    # ------------------------------------------------------------ S7
    # Kasus produksi nyata (temuan code review): detail problem memuat waktu cek
    # ("cek jam 14:35") yang berubah tiap run. Normalisasi harus membuat dua entry
    # dengan masalah sama persis tapi waktu berbeda -> fingerprint SAMA (tidak
    # re-notify tiap poll).
    problem_late = json.loads(json.dumps(problem))
    problem_late["checkers"][0]["problems"][0]["detail"] = (
        problem_late["checkers"][0]["problems"][0]["detail"].replace(
            "cek jam 14:35", "cek jam 15:05"
        )
    )
    fp_same_issue = ncp.compute_fingerprint(problem["checkers"][0])
    fp_later_issue = ncp.compute_fingerprint(problem_late["checkers"][0])
    check(
        "S7 Masalah sama tapi waktu cek beda -> fingerprint sama (tidak re-notify)",
        fp_same_issue == fp_later_issue,
        f"{fp_same_issue[:16]}... == {fp_later_issue[:16]}...",
    )

    # ------------------------------------------------------------ S8
    # End-to-end: masalah sama persis tapi datang di poll berikutnya dengan waktu
    # beda -> harus SKIP (tidak kirim ulang), setelah S1-S2 menyimpan fingerprint.
    state = {}
    ncp.process_checkers(problem, state)  # notif pertama
    sent_juduls.clear()
    decisions8 = ncp.process_checkers(problem_late, state)  # poll berikutnya, jam beda
    check(
        "S8 Poll berikutnya dengan waktu cek beda -> SKIP (tidak kirim ulang)",
        len(sent_juduls) == 0 and len(state) == 1,
        f"sent={len(sent_juduls)}, action={[d['action'] for d in decisions8]}",
    )

    passed = sum(results)
    total = len(results)
    print(f"\nHasil: {passed}/{total} skenario lolos")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run())
