import type { TranscriptResult } from "../engine/protocol";

export function transcriptToTxt(result: TranscriptResult) {
  return result.fullText;
}
