#!/usr/bin/env bash
# Verify a rendered video: prints duration/size/fps and extracts 3 sample frames next to it (<name>_frame{1,2,3}.png).
set -euo pipefail
f="${1:?usage: verify.sh path/to/video.mp4}"
ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate -of default=nw=1 "$f"
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
base="${f%.*}"
i=1; for p in 0.15 0.5 0.85; do
  t=$(awk -v d="$d" -v p="$p" 'BEGIN{printf "%.2f", d*p}')
  ffmpeg -loglevel error -y -ss "$t" -i "$f" -frames:v 1 "${base}_frame${i}.png"; echo "frame at ${t}s -> ${base}_frame${i}.png"; i=$((i+1))
done
