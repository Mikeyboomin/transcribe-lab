import { useEffect, useRef, useState } from "react";
import { mediaService } from "../../features/media/mediaService";
import { usePipelineDispatch, usePipelineState } from "../../features/pipeline/PipelineContext";
import type { PipelineStage } from "../../features/pipeline/types";
import { MAX_MEDIA_FILE_SIZE_BYTES } from "../../shared/constants/limits";
import { Button } from "../../shared/ui/Button";

const stageMap: Record<string, PipelineStage> = {
  preparing: "preparing",
  extracting: "extracting",
  optimizing: "optimizing",
  splitting: "splitting",
};

export function TranscribePage() {
  const state = usePipelineState();
  const dispatch = usePipelineDispatch();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [normalizedBlob, setNormalizedBlob] = useState<Blob | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null);

  const activeJobIdRef = useRef<string | null>(null);
  const normalizedUrlRef = useRef<string | null>(null);
  const unsubscribeProgressRef = useRef<(() => void) | null>(null);

  const revokeNormalizedUrl = () => {
    if (normalizedUrlRef.current) {
      URL.revokeObjectURL(normalizedUrlRef.current);
      normalizedUrlRef.current = null;
      setNormalizedUrl(null);
    }
  };

  const clearJob = () => {
    if (activeJobIdRef.current) {
      mediaService.dispose(activeJobIdRef.current);
      activeJobIdRef.current = null;
    }
    unsubscribeProgressRef.current?.();
    unsubscribeProgressRef.current = null;
  };

  useEffect(() => () => {
    clearJob();
    if (normalizedUrlRef.current) {
      URL.revokeObjectURL(normalizedUrlRef.current);
      normalizedUrlRef.current = null;
    }
  }, []);

  const isCancellationError = (error: unknown, jobId: string) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalizedMessage = message.toLowerCase();
    return (
      normalizedMessage.includes("job canceled") ||
      (normalizedMessage.includes("stale") && message.includes(jobId)) ||
      normalizedMessage.includes("stale jobid")
    );
  };

  const onRunMediaPrep = async () => {
    if (!selectedFile) {
      return;
    }
    if (selectedFile.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      dispatch({
        type: "PIPELINE/ERROR",
        error: {
          code: "FILE_TOO_LARGE",
          message: `File exceeds limit of ${Math.round(MAX_MEDIA_FILE_SIZE_BYTES / (1024 * 1024))} MB`,
        },
      });
      return;
    }

    clearJob();
    revokeNormalizedUrl();
    setNormalizedBlob(null);

    const jobId = crypto.randomUUID();
    activeJobIdRef.current = jobId;

    dispatch({ type: "PIPELINE/START", jobId });

    unsubscribeProgressRef.current = mediaService.onProgress(jobId, (progress) => {
      dispatch({
        type: "PIPELINE/STAGE_SET",
        stage: stageMap[progress.stage] ?? "preparing",
      });
      dispatch({
        type: "PIPELINE/PROGRESS",
        progress: {
          stagePct: progress.stagePct,
          overallPct: progress.overallPct,
          message: progress.message,
        },
      });
    });

    try {
      await mediaService.init(jobId);
      let extracted: Blob | File = selectedFile;

      if (selectedFile.type.startsWith("video/")) {
        dispatch({ type: "PIPELINE/STAGE_SET", stage: "extracting" });
        extracted = await mediaService.extractAudio(jobId, selectedFile);
      }

      dispatch({ type: "PIPELINE/STAGE_SET", stage: "optimizing" });
      const normalized = await mediaService.normalize(jobId, extracted);
      setNormalizedBlob(normalized);
      const url = URL.createObjectURL(normalized);
      normalizedUrlRef.current = url;
      setNormalizedUrl(url);

      dispatch({ type: "PIPELINE/PROGRESS", progress: { overallPct: 100, stagePct: 100 } });
      dispatch({ type: "PIPELINE/STAGE_SET", stage: "done", canCancel: false });
      mediaService.dispose(jobId);
      activeJobIdRef.current = null;
    } catch (error) {
      if (isCancellationError(error, jobId)) {
        return;
      }
      dispatch({
        type: "PIPELINE/ERROR",
        error: {
          code: "MEDIA_PREP_FAILED",
          message: error instanceof Error ? error.message : "Media preparation failed",
          details: error,
        },
      });
    }
  };

  const onCancel = () => {
    clearJob();
    revokeNormalizedUrl();
    setNormalizedBlob(null);
    dispatch({ type: "PIPELINE/CANCEL" });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Transcribe</h1>
        <p className="text-sm text-zinc-300">
          Upload audio or video. Processing runs locally in your browser.
        </p>
      </header>

      <div className="rounded border border-zinc-800 p-4 space-y-3">
        <div className="space-y-2">
          <label className="text-sm block" htmlFor="transcribe-file-input">
            Media file
          </label>
          <input
            id="transcribe-file-input"
            type="file"
            accept="audio/*,video/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
          />
        </div>

        <div className="text-sm">Stage: {state.stage}</div>
        <div className="text-sm">
          Progress: {state.progress.overallPct}%{" "}
          {state.progress.message ? `— ${state.progress.message}` : ""}
        </div>

        <div className="flex gap-2">
          <Button disabled={!selectedFile} onClick={onRunMediaPrep}>
            Run Media Prep (test)
          </Button>
          <Button variant="secondary" disabled={!state.canCancel} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearJob();
              revokeNormalizedUrl();
              setNormalizedBlob(null);
              dispatch({ type: "PIPELINE/RESET" });
            }}
          >
            Reset
          </Button>
        </div>

        {normalizedUrl && normalizedBlob ? (
          <a
            className="inline-flex items-center text-sm underline text-zinc-200"
            href={normalizedUrl}
            download="normalized-16k.wav"
          >
            Download normalized WAV ({Math.round(normalizedBlob.size / 1024)} KB)
          </a>
        ) : null}
      </div>
    </div>
  );
}
