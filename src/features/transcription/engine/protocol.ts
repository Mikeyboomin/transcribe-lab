export type ProgressStage = "model_loading" | "transcribing" | "exporting";

export type RuntimePreference = "webgpu" | "wasm";
export type ModelProfile = "fast" | "balanced";

export type InitModelRequest = {
  type: "INIT_MODEL";
  jobId: string;
  payload?: {
    modelProfile?: ModelProfile;
    preferredBackend?: RuntimePreference;
  };
};

export type TranscribeSegmentRequest = {
  type: "TRANSCRIBE_SEGMENT";
  jobId: string;
  payload: {
    wavBuffer: ArrayBuffer;
    chunkWindowSec?: number;
    overlapSec?: number;
  };
};

export type CancelRequest = {
  type: "CANCEL";
  jobId: string;
};

export type DisposeRequest = {
  type: "DISPOSE";
  jobId: string;
};

export type WorkerRequest =
  | InitModelRequest
  | TranscribeSegmentRequest
  | CancelRequest
  | DisposeRequest;

export type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptResult = {
  fullText: string;
  segments: TranscriptSegment[];
};

export type ReadyEvent = {
  type: "READY";
  jobId: string;
  payload: {
    backend: RuntimePreference;
    modelId: string;
  };
};

export type ModelProgressEvent = {
  type: "MODEL_PROGRESS";
  jobId: string;
  payload: {
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
    text?: string;
  };
};

export type ProgressEvent = {
  type: "PROGRESS";
  jobId: string;
  payload: {
    stage: ProgressStage;
    stagePct: number;
    overallPct: number;
    message: string;
  };
};

export type ResultEvent = {
  type: "RESULT";
  jobId: string;
  payload: TranscriptResult;
};

export type ErrorEvent = {
  type: "ERROR";
  jobId: string;
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type WorkerEvent =
  | ReadyEvent
  | ModelProgressEvent
  | ProgressEvent
  | ResultEvent
  | ErrorEvent;
