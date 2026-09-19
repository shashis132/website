#!/usr/bin/env bash
# Render a composition at 1080p and 720p (or a watermarked 720p draft).
#
#   video/tools/render.sh <CompositionId> <slug>            # final: 1080p + 720p
#   video/tools/render.sh <CompositionId> <slug> --draft    # 720p, DRAFT overlay, fast encode
#   PROPS='{"headline":"..."}' video/tools/render.sh ...    # override composition props
#
# Output lands in video/renders/<slug>/ (git-ignored). Every composition is
# registered twice in src/Root.tsx: "<Id>" at 1080p and "<Id>-720p".
set -euo pipefail
ID="${1:?composition id}"; SLUG="${2:?project slug}"; MODE="${3:-final}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/renders/$SLUG"; mkdir -p "$OUT"
cd "$ROOT/project"
PROPS_JSON="${PROPS:-{\}}"
if [ "$MODE" = "--draft" ]; then
  DRAFT_PROPS=$(node -e 'const p=JSON.parse(process.argv[1]); p.draft=true; console.log(JSON.stringify(p))' "$PROPS_JSON")
  npx remotion render src/index.ts "${ID}-720p" "$OUT/${SLUG}-draft-720p.mp4" --props "$DRAFT_PROPS" --crf 28 --log=error
else
  npx remotion render src/index.ts "$ID" "$OUT/${SLUG}-1080p.mp4" --props "$PROPS_JSON" --crf 18 --log=error
  npx remotion render src/index.ts "${ID}-720p" "$OUT/${SLUG}-720p.mp4" --props "$PROPS_JSON" --crf 20 --log=error
fi
ls -la "$OUT"
