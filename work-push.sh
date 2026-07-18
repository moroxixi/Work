#!/bin/bash
# work-push.sh — Auto commit & push HomeLab/Work ke GitHub
# Simpan ke: /home/moroxixi/HomeLab/Work/work-push.sh (atau lokasi lain)
# chmod +x work-push.sh
HOMELAB_DIR="/home/moroxixi/HomeLab/Work"
LOG="$HOMELAB_DIR/push.log"
cd "$HOMELAB_DIR" || exit 1

# ── Pastikan strategi pull sudah diset (merge biasa, tanpa nanya-nanya) ────
git config pull.rebase false >/dev/null 2>&1
git config core.editor "true" >/dev/null 2>&1   # "true" = no-op, biar gak nyangkut nunggu editor kalau ada merge commit tanpa -m

# ── Cari SSH agent yang aktif ──────────────────────────────────────────────
# Kalau SSH_AUTH_SOCK sudah ke-set & valid (biasanya otomatis di sesi desktop normal),
# pakai itu dulu. Kalau tidak, cari socket manual di lokasi umum.
if [ -z "$SSH_AUTH_SOCK" ] || [ ! -S "$SSH_AUTH_SOCK" ]; then
    SSH_AGENT_SOCK=$(ls "$HOME"/.ssh/agent/s.*.agent.* 2>/dev/null | head -1)
    if [ -n "$SSH_AGENT_SOCK" ]; then
        export SSH_AUTH_SOCK="$SSH_AGENT_SOCK"
    fi
fi

# ── Cek syntax semua file Python sebelum commit ───────────────────────────
SYNTAX_ERRORS=""
while IFS= read -r -d '' pyfile; do
    ERR=$(python3 -m py_compile "$pyfile" 2>&1)
    if [ $? -ne 0 ]; then
        SYNTAX_ERRORS+="$pyfile: $ERR\n"
    fi
done < <(find "$HOMELAB_DIR" -name "*.py" -not -path "*/.git/*" -print0)
if [ -n "$SYNTAX_ERRORS" ]; then
    echo "$(date '+%H:%M') [Syntax] ERROR ditemukan:" >> "$LOG"
    echo -e "$SYNTAX_ERRORS" >> "$LOG"
    echo ""
    echo "❌ SyntaxError — push dibatalkan:"
    echo -e "$SYNTAX_ERRORS"
    notify-send "Work" "❌ SyntaxError! Push dibatalkan — cek terminal" --urgency=critical 2>/dev/null
    exit 1
fi
echo "$(date '+%H:%M') [Syntax] Semua file Python OK." >> "$LOG"

# ── Cek apakah ada perubahan ───────────────────────────────────────────────
if [ -z "$(git status --porcelain)" ]; then
    echo "$(date '+%H:%M') [Git] Tidak ada perubahan, skip." >> "$LOG"
    echo "ℹ️  Tidak ada perubahan."
    notify-send "Work" "Tidak ada perubahan" --urgency=low 2>/dev/null
    exit 0
fi

# ── Commit ──────────────────────────────────────────────────────────────
git add -A
COMMIT_MSG="${1:-auto: $(date '+%Y-%m-%d %H:%M')}"
git commit -m "$COMMIT_MSG"

# ── Pull dulu sebelum push, biar gak ketolak karena remote lebih maju ─────
PULL_OUTPUT=$(git pull origin main --no-edit 2>&1)
PULL_STATUS=$?
echo "$PULL_OUTPUT" >> "$LOG"

if [ $PULL_STATUS -ne 0 ]; then
    # Biasanya ini kejadian kalau ada conflict beneran (bukan cuma editor issue)
    echo "$(date '+%H:%M') [Git] Pull GAGAL / ada konflik:" >> "$LOG"
    echo ""
    echo "❌ Pull gagal / ada konflik — push dibatalkan:"
    echo "$PULL_OUTPUT"
    echo ""
    echo "👉 Beresin manual dulu: cek 'git status', selesaikan konflik di file yang ditandai,"
    echo "   lalu 'git add <file>' dan 'git commit', baru jalankan script ini lagi."
    notify-send "Work" "❌ Konflik saat pull! Perlu beresin manual" --urgency=critical 2>/dev/null
    exit 1
fi

# ── Push ────────────────────────────────────────────────────────────────
PUSH_OUTPUT=$(git push origin main 2>&1)
PUSH_STATUS=$?
echo "$PUSH_OUTPUT" >> "$LOG"
if [ $PUSH_STATUS -eq 0 ]; then
    echo "$(date '+%H:%M') [Git] Push berhasil: $COMMIT_MSG" >> "$LOG"
    echo "✅ Push berhasil: $COMMIT_MSG"
    notify-send "Work" "📤 HomeLab/Work di-push ke GitHub" --urgency=low 2>/dev/null
else
    echo "$(date '+%H:%M') [Git] Push GAGAL:" >> "$LOG"
    echo "$PUSH_OUTPUT" >> "$LOG"
    echo ""
    echo "❌ Push GAGAL:"
    echo "$PUSH_OUTPUT"
    notify-send "Work" "❌ Push gagal! $PUSH_OUTPUT" --urgency=critical 2>/dev/null
fi
