import { PipelineState } from "./types";

export const initialPipelineState: PipelineState = {
  jobId: null,
  stage: "idle",
  progress: { overallPct: 0, stagePct: 0 },
  chunks: [],
  error: null,
  canCancel: false,
};
