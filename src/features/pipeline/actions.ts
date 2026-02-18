import type { PipelineError, PipelineStage, ChunkItem, PipelineProgress } from "./types";

export type PipelineAction =
  | { type: "PIPELINE/START"; jobId: string }
  | { type: "PIPELINE/STAGE_SET"; stage: PipelineStage; canCancel?: boolean }
  | { type: "PIPELINE/PROGRESS"; progress: Partial<PipelineProgress> }
  | { type: "PIPELINE/CHUNKS_SET"; chunks: ChunkItem[] }
  | { type: "PIPELINE/CHUNK_UPDATE"; chunkId: string; patch: Partial<ChunkItem> }
  | { type: "PIPELINE/ERROR"; error: PipelineError }
  | { type: "PIPELINE/CANCEL" }
  | { type: "PIPELINE/RESET" };
