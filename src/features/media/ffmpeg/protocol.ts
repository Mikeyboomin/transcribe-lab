import type { PipelineStage } from "../../pipeline/types";

export type FFmpegRequestType =
  | "INIT"
  | "EXTRACT_AUDIO"
  | "NORMALIZE_16K_WAV"
  | "SPLIT_30M"
  | "COMPRESS";

export type FFmpegEventType = "READY" | "PROGRESS" | "DONE" | "ERROR";

export type BinaryPayload = {
  name: string;
  type: string;
  data: ArrayBuffer;
};

export type CompressionPreset = "voice" | "balanced" | "high";

export type FFmpegProgressPayload = {
  stage: PipelineStage;
  stagePct: number;
  overallPct: number;
  message: string;
};

export type FFmpegRequest =
  | { type: "INIT"; jobId: string }
  | { type: "EXTRACT_AUDIO"; jobId: string; payload: { input: BinaryPayload } }
  | { type: "NORMALIZE_16K_WAV"; jobId: string; payload: { input: BinaryPayload } }
  | { type: "SPLIT_30M"; jobId: string; payload: { input: BinaryPayload } }
  | {
      type: "COMPRESS";
      jobId: string;
      payload: { input: BinaryPayload; preset: CompressionPreset };
    };

export type FFmpegDonePayload =
  | { type: "INIT"; jobId: string }
  | { type: "EXTRACT_AUDIO"; jobId: string; output: BinaryPayload }
  | { type: "NORMALIZE_16K_WAV"; jobId: string; output: BinaryPayload }
  | {
      type: "SPLIT_30M";
      jobId: string;
      outputs: BinaryPayload[];
      manifest: string[];
    }
  | {
      type: "COMPRESS";
      jobId: string;
      output: BinaryPayload;
      preset: CompressionPreset;
    };

export type FFmpegEvent =
  | { type: "READY"; jobId: string }
  | { type: "PROGRESS"; jobId: string; payload: FFmpegProgressPayload }
  | { type: "DONE"; jobId: string; payload: FFmpegDonePayload }
  | {
      type: "ERROR";
      jobId: string;
      payload: { code: string; message: string; details?: unknown };
    };
