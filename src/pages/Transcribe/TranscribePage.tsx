import { usePipelineDispatch, usePipelineState } from "../../features/pipeline/PipelineContext";
import { Button } from "../../shared/ui/Button";

export function TranscribePage() {
  const state = usePipelineState();
  const dispatch = usePipelineDispatch();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Transcribe</h1>
        <p className="text-sm text-zinc-300">
          Upload audio or video. Processing runs locally in your browser.
        </p>
      </header>

      <div className="rounded border border-zinc-800 p-4 space-y-3">
        <div className="text-sm">Stage: {state.stage}</div>
        <div className="text-sm">
          Progress: {state.progress.overallPct}%{" "}
          {state.progress.message ? `— ${state.progress.message}` : ""}
        </div>

        <div className="flex gap-2">
          <Button onClick={() => dispatch({ type: "PIPELINE/START", jobId: crypto.randomUUID() })}>
            Start (stub)
          </Button>
          <Button
            variant="secondary"
            disabled={!state.canCancel}
            onClick={() => dispatch({ type: "PIPELINE/CANCEL" })}
          >
            Cancel
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "PIPELINE/RESET" })}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
