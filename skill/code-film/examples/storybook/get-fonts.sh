#!/usr/bin/env bash
# Fetches the two typefaces the storybook example is set in: C059 (a Century Schoolbook clone) and URW Bookman Demi.
# They are not in this repository because their licence is the AGPL with a font exception, not an open font licence.
# Each file is copied from Ghostscript's fonts if the system has them, or downloaded from URW's official repository,
# and is only kept if it matches the checksum of the file the film was made with.
#   cd <your film folder> && bash <path to the skill>/examples/storybook/get-fonts.sh
set -euo pipefail
DEST="${1:-assets/fonts}"
[ -d "$DEST" ] || { echo "no $DEST here: run this from the folder new-film.sh made"; exit 1; }
BASE="https://raw.githubusercontent.com/ArtifexSoftware/urw-base35-fonts/20200910"
FONTS="
e00cc7b88f0cf25ae43f0e48de39d0043fe042b55719a3ac32669ab3369542ec C059-Roman.otf
75dea10068264324522e7b96612083582eee0158eb728fa9c219279890f33e26 C059-Bold.otf
77852deabd3a84f7d0213932239de522410309374c2255ccbd510f01dc7c6e80 C059-Italic.otf
ab8b2fe57cbea9783c6179188dc013c76cfc5717c22cf59bbf3016ef2d7d93ee URWBookman-Demi.otf
"
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
right() { [ -f "$1" ] && [ "$(sha "$1")" = "$2" ]; }
echo "$FONTS" | while read -r want name; do
  [ -n "$name" ] || continue
  if right "$DEST/$name" "$want"; then echo "have    $name"; continue; fi
  for dir in /usr/share/fonts/gsfonts /usr/share/fonts/opentype/urw-base35 /usr/share/fonts/urw-base35 /usr/share/ghostscript/fonts; do
    if right "$dir/$name" "$want"; then cp "$dir/$name" "$DEST/$name"; echo "copied  $name  (from $dir)"; continue 2; fi
  done
  curl -fsSL -o "$DEST/$name.part" "$BASE/fonts/$name" || { rm -f "$DEST/$name.part"; echo "could not download $name from $BASE/fonts/"; exit 1; }
  if right "$DEST/$name.part" "$want"; then mv "$DEST/$name.part" "$DEST/$name"; echo "fetched $name"
  else rm -f "$DEST/$name.part"; echo "$name: the download does not match the expected checksum, not kept"; exit 1; fi
done
# the licence travels with the fonts
[ -f "$DEST/LICENSE-URW.txt" ] || curl -fsSL -o "$DEST/LICENSE-URW.txt" "$BASE/LICENSE" || echo "note: could not fetch the fonts' licence text ($BASE/LICENSE)"
echo "done: the storybook's fonts are in $DEST (AGPL 3 with a font exception: see LICENSE-URW.txt)"
