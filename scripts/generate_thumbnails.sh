#!/usr/bin/env bash
# Generate thumbnail images for all eval session videos that don't already have one.
# Captures a frame at 1 second into the video, saves as a .jpg next to the video file.

set -euo pipefail

RESOURCES_DIR="$(cd "$(dirname "$0")/../../evals/resources/data" && pwd)"
SESSIONS_DIR="$(cd "$(dirname "$0")/../../evals/results/sessions" && pwd)"

count=0
skipped=0

for session_dir in "$SESSIONS_DIR"/*/; do
  eval_file="$session_dir/eval.json"
  [ -f "$eval_file" ] || continue

  # Extract video_file path from eval.json
  video_path=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('video_file',''))" "$eval_file")
  [ -n "$video_path" ] || continue
  [ -f "$video_path" ] || continue

  # Derive thumbnail path: same dir, same stem, .jpg
  thumb_path="${video_path%.*}.jpg"

  if [ -f "$thumb_path" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  echo "Generating: $(basename "$thumb_path")"
  ffmpeg -y -i "$video_path" -vframes 1 -ss 00:00:01 -q:v 5 "$thumb_path" -loglevel error 2>&1 || {
    # If 1s fails (video too short), try frame 0
    ffmpeg -y -i "$video_path" -vframes 1 -q:v 5 "$thumb_path" -loglevel error 2>&1 || true
  }

  if [ -f "$thumb_path" ]; then
    count=$((count + 1))
  fi
done

echo "Done. Generated $count thumbnails, skipped $skipped existing."
