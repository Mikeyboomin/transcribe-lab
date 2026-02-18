import { initialPipelineState } from "./constants";
import { PipelineAction } from "./actions";
import { PipelineState } from "./types";

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction
): PipelineState {
  switch (action.type) {
    case "PIPELINE/START":
      return {
        ...initialPipelineState,
        jobId: action.jobId,
        stage: "preparing",
        canCancel: true,
      };

    case "PIPELINE/STAGE_SET":
      return {
        ...state,
        stage: action.stage,
        canCancel: action.canCancel ?? state.canCancel,
      };

    case "PIPELINE/PROGRESS":
      return { ...state, progress: { ...state.progress, ...action.progress } };

    case "PIPELINE/CHUNKS_SET":
      return { ...state, chunks: action.chunks };

    case "PIPELINE/CHUNK_UPDATE":
      return {
        ...state,
        chunks: state.chunks.map((c) =>
          c.id === action.chunkId ? { ...c, ...action.patch } : c
        ),
      };

    case "PIPELINE/ERROR":
      return { ...state, stage: "error", error: action.error, canCancel: false };

    case "PIPELINE/CANCEL":
      return { ...state, stage: "canceled", canCancel: false };

    case "PIPELINE/RESET":
      return initialPipelineState;

    default:
      return state;
  }
}
