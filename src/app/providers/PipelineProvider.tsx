import { PropsWithChildren, useReducer } from "react";
import { pipelineReducer } from "../../features/pipeline/reducer";
import { initialPipelineState } from "../../features/pipeline/constants";
import {
  PipelineDispatchCtx,
  PipelineStateCtx,
} from "../../features/pipeline/PipelineContext";

export function PipelineProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState);

  return (
    <PipelineStateCtx.Provider value={state}>
      <PipelineDispatchCtx.Provider value={dispatch}>
        {children}
      </PipelineDispatchCtx.Provider>
    </PipelineStateCtx.Provider>
  );
}
