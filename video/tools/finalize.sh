#!/usr/bin/env bash
# Loudness-normalise a rendered file for the web (-14 LUFS, -1 dBTP) and set
# the moov atom first so it starts playing before it has fully downloaded.
#
#   video/tools/finalize.sh <in.mp4> <out.mp4>
#
# Video is copied untouched; only the audio is re-encoded. A file with no
# audio track is passed through with faststart only.
set -euo pipefail
IN="${1:?input}"; OUT="${2:?output}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/project"
FF="npx remotion ffmpeg -hide_banner -loglevel error"
FP="npx remotion ffprobe -v quiet"
HAS_AUDIO=$($FP -select_streams a -show_entries stream=index -of csv=p=0 "$IN" | head -1 || true)
if [ -z "$HAS_AUDIO" ]; then
  $FF -y -i "$IN" -c copy -movflags +faststart "$OUT"
  echo "no audio track: faststart only -> $OUT"; exit 0
fi
# Pass 1: measure. loudnorm prints its JSON on stderr at the end.
MEAS=$(npx remotion ffmpeg -hide_banner -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
I=$(echo "$MEAS" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log([j.input_i,j.input_tp,j.input_lra,j.input_thresh,j.target_offset].join(" "))')
read -r MI MTP MLRA MTH MOFF <<< "$I"
# Pass 2: apply with the measured values (linear mode, no pumping).
$FF -y -i "$IN" -c:v copy -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$MOFF:linear=true:print_format=summary" -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
echo "normalised (was $MI LUFS, peak $MTP dBTP) -> $OUT"
