#!/usr/bin/env bash
# Scaffold a new code film from the kit.   bash new-film.sh ~/Work/my-film
set -euo pipefail
DEST="${1:?usage: new-film.sh <folder>}"
SKILL="$(cd "$(dirname "$0")" && pwd)"
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then echo "$DEST exists and is not empty"; exit 1; fi
mkdir -p "$DEST"
cp -R "$SKILL/kit/." "$DEST/"
cd "$DEST"
[ -f .env ] || printf '# Paste your ElevenLabs API key after the = sign (no quotes), then save.\nELEVENLABS_API_KEY=\n' > .env
chmod 600 .env
if command -v pnpm >/dev/null 2>&1; then pnpm install; else npm install; fi
node harness/render.mjs film --stills 0.5,2 && echo "ready: $DEST (stills in film/out/stills)"
