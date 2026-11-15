#!/usr/bin/env bash
# One command from source to a finished file: refresh the cue list, mix the sound, render every frame, encode for X.
#   bash tools/build.sh v2          -> film/out/<filmName>_v2.mp4 (+ poster, contact sheet); filmName is in package.json
#   bash tools/build.sh             -> film/out/<filmName>.mp4, the finished film
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-}"; SUF="${V:+_$V}"; NAME="${NAME:-$(node -p "require('./package.json').filmName || require('path').basename(process.cwd())")}"
node harness/render.mjs film --info film/out/film.json 2>&1 | grep -v 'ERR_ABORTED\|404' || true
A=audio/mix.wav
node tools/mix.mjs | tail -4 || { echo "no sound yet: building a silent file"; A=none; }
node harness/render.mjs film --workers "${WORKERS:-3}" --lossless "film/out/master${SUF}.mkv" 2>&1 | grep -v 'ERR_ABORTED\|404' | tail -1
bash tools/finish.sh "film/out/master${SUF}.mkv" "$A" "film/out/${NAME}${SUF}.mp4"
