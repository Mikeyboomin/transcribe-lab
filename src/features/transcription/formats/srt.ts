import type { TranscriptResult } from "../engine/protocol";

function toSrtTimestamp(totalSec: number) {
  const ms = Math.max(0, Math.round(totalSec * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function transcriptToSrt(result: TranscriptResult) {
  return result.segments
    .map((segment, idx) => {
      return `${idx + 1}\n${toSrtTimestamp(segment.startSec)} --> ${toSrtTimestamp(segment.endSec)}\n${segment.text}`;
    })
    .join("\n\n");
}
