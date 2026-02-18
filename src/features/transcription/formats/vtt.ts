import type { TranscriptResult } from "../engine/protocol";

function toVttTimestamp(totalSec: number) {
  const ms = Math.max(0, Math.round(totalSec * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function transcriptToVtt(result: TranscriptResult) {
  const body = result.segments
    .map((segment) => `${toVttTimestamp(segment.startSec)} --> ${toVttTimestamp(segment.endSec)}\n${segment.text}`)
    .join("\n\n");

  return `WEBVTT\n\n${body}`;
}
