export type PipelineStage =
  | "idle"
  | "preparing"
  | "extracting"
  | "optimizing"
  | "splitting"
  | "model_loading"
  | "transcribing"
  | "exporting"
  | "done"
  | "error"
  | "canceled";

export type PipelineProgress = {
  overallPct: number; // 0..100
  stagePct: number; // 0..100
  message?: string;
};

export type ChunkStatus = "queued" | "processing" | "done" | "error";

export type ChunkItem = {
  id: string;
  label: string;
  status: ChunkStatus;
  progressPct: number;
};

export type PipelineError = {
  code: string;
  message: string;
  details?: unknown;
};

export type PipelineState = {
  jobId: string | null;
  stage: PipelineStage;
  progress: PipelineProgress;
  chunks: ChunkItem[];
  error: PipelineError | null;
  canCancel: boolean;
};
