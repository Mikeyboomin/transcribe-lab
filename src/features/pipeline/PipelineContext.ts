import React, { createContext, useContext } from "react";
import { PipelineState } from "./types";
import { PipelineAction } from "./actions";

export const PipelineStateCtx = createContext<PipelineState | null>(null);
export const PipelineDispatchCtx = createContext<React.Dispatch<PipelineAction> | null>(null);

export function usePipelineState() {
  const ctx = useContext(PipelineStateCtx);
  if (!ctx) throw new Error("usePipelineState must be used within PipelineProvider");
  return ctx;
}

export function usePipelineDispatch() {
  const ctx = useContext(PipelineDispatchCtx);
  if (!ctx) throw new Error("usePipelineDispatch must be used within PipelineProvider");
  return ctx;
}
