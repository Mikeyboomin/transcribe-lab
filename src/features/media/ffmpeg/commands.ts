import type { CompressionPreset } from "./protocol";

export const SEGMENT_SECONDS_30_MIN = 30 * 60;

const compressionProfiles: Record<CompressionPreset, { bitrate: string }> = {
  voice: { bitrate: "64k" },
  balanced: { bitrate: "96k" },
  high: { bitrate: "128k" },
};

export function buildExtractAudioArgs(inputName: string, outputName: string): string[] {
  return ["-i", inputName, "-vn", "-c:a", "pcm_s16le", outputName];
}

export function buildNormalize16kWavArgs(inputName: string, outputName: string): string[] {
  return [
    "-i",
    inputName,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputName,
  ];
}

export function buildSplit30MinArgs(inputName: string, outputPattern: string): string[] {
  return [
    "-i",
    inputName,
    "-f",
    "segment",
    "-segment_time",
    String(SEGMENT_SECONDS_30_MIN),
    "-c:a",
    "pcm_s16le",
    outputPattern,
  ];
}

export function buildCompressArgs(
  inputName: string,
  outputName: string,
  preset: CompressionPreset
): string[] {
  const profile = compressionProfiles[preset];
  return [
    "-i",
    inputName,
    "-c:a",
    "aac",
    "-b:a",
    profile.bitrate,
    "-movflags",
    "+faststart",
    outputName,
  ];
}
