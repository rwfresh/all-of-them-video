#!/usr/bin/env bash
# Final encode for X from the lossless picture and the mix: H.264 High, yuv420p, constant 30 fps, AAC 48 kHz stereo,
# moov atom first. Then a poster frame, a contact sheet (one frame a second) and a black-frame scan.
#   bash tools/finish.sh film/out/master.mkv audio/mix.wav film/out/name.mp4      (pass "none" as the audio for a silent file)
set -euo pipefail
IN="$1"; AUDIO="$2"; OUT="$3"; BASE="${OUT%.mp4}"
if [ "$AUDIO" = none ]; then AIN=(); AMAP=(-an); else AIN=(-i "$AUDIO"); AMAP=(-map 1:a:0 -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest); fi
ffmpeg -y -v error -i "$IN" "${AIN[@]}" -map 0:v:0 \
  -vf "fps=30,scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setsar=1" \
  -c:v libx264 -preset slow -crf "${CRF:-18}" -profile:v high -level:v 4.2 -maxrate 15M -bufsize 30M \
  -g 60 -keyint_min 30 -x264-params open-gop=0 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  "${AMAP[@]}" -movflags +faststart "$OUT"
ffmpeg -y -v error -ss 0 -i "$OUT" -frames:v 1 -q:v 2 "${BASE}_poster.jpg"
ROWS=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | awk '{print int(($1 + 5.999) / 6)}')
ffmpeg -y -v error -i "$OUT" -vf "fps=1,scale=320:-1,tile=6x${ROWS}" -frames:v 1 -q:v 3 "${BASE}_contact.jpg"
ffmpeg -y -v error -t 2 -i "$OUT" -vf "fps=4,scale=480:-1,tile=4x2" -frames:v 1 -q:v 3 "${BASE}_first2s.jpg"
echo "black frames (none listed = none found):"
ffmpeg -i "$OUT" -vf blackdetect=d=0.1:pix_th=0.02:pic_th=0.999 -an -f null - 2>&1 | grep black_start || true
[ "$AUDIO" = none ] || ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E '^ +(I|Peak):' | tail -2
ls -la "$OUT"
