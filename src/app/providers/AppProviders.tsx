import { PropsWithChildren } from "react";
import { PipelineProvider } from "./PipelineProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return <PipelineProvider>{children}</PipelineProvider>;
}
