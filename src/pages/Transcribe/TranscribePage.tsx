import { useEffect, useMemo, useRef, useState } from "react";
import { usePipelineDispatch, usePipelineState } from "../../features/pipeline/PipelineContext";
import { transcriptToSrt } from "../../features/transcription/formats/srt";
import { transcriptToTxt } from "../../features/transcription/formats/text";
import { transcriptToVtt } from "../../features/transcription/formats/vtt";
import type { TranscriptResult } from "../../features/transcription/engine/protocol";
import { cancel, dispose, initModel, transcribeWav } from "../../features/transcription/transcribeService";
import { Button } from "../../shared/ui/Button";

type ExportUrls = {
  txt: string;
  srt: string;
  vtt: string;
};

export function TranscribePage() {
  const state = usePipelineState();
  const dispatch = usePipelineDispatch();
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJobRef = useRef<string | null>(null);

  useEffect(() => {
    activeJobRef.current = activeJobId;
  }, [activeJobId]);

  const exportUrls = useMemo<ExportUrls | null>(() => {
    if (!transcript) return null;
    return {
      txt: URL.createObjectURL(new Blob([transcriptToTxt(transcript)], { type: "text/plain" })),
      srt: URL.createObjectURL(new Blob([transcriptToSrt(transcript)], { type: "application/x-subrip" })),
      vtt: URL.createObjectURL(new Blob([transcriptToVtt(transcript)], { type: "text/vtt" })),
    };
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (activeJobRef.current) {
        void dispose(activeJobRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!exportUrls) return;
      URL.revokeObjectURL(exportUrls.txt);
      URL.revokeObjectURL(exportUrls.srt);
      URL.revokeObjectURL(exportUrls.vtt);
    };
  }, [exportUrls]);

  const onCancel = async () => {
    if (!activeJobRef.current) return;
    const jobId = activeJobRef.current;
    cancel(jobId);
    dispatch({ type: "PIPELINE/CANCEL" });
    await dispose(jobId);
    setActiveJobId(null);
  };

  const onTranscribe = async () => {
    if (!wavBlob) return;

    const jobId = crypto.randomUUID();
    setActiveJobId(jobId);
    activeJobRef.current = jobId;
    setTranscript(null);

    dispatch({ type: "PIPELINE/START", jobId });

    try {
      await initModel(jobId, {
        modelProfile: "fast",
        onProgress(progress) {
          if (activeJobRef.current !== jobId) return;
          dispatch({ type: "PIPELINE/STAGE_SET", stage: progress.stage });
          dispatch({
            type: "PIPELINE/PROGRESS",
            progress: {
              stagePct: progress.stagePct,
              overallPct: progress.overallPct,
              message: progress.message,
            },
          });
        },
      });

      const result = await transcribeWav(jobId, wavBlob, (progress) => {
        if (activeJobRef.current !== jobId) return;
        dispatch({ type: "PIPELINE/STAGE_SET", stage: progress.stage });
        dispatch({
          type: "PIPELINE/PROGRESS",
          progress: {
            stagePct: progress.stagePct,
            overallPct: progress.overallPct,
            message: progress.message,
          },
        });
      });

      if (activeJobRef.current !== jobId) return;

      setTranscript(result);
      dispatch({ type: "PIPELINE/STAGE_SET", stage: "done", canCancel: false });
      dispatch({
        type: "PIPELINE/PROGRESS",
        progress: { stagePct: 100, overallPct: 100, message: "Transcription complete" },
      });
    } catch (error) {
      if (activeJobRef.current !== jobId) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      dispatch({
        type: "PIPELINE/ERROR",
        error: {
          code: "TRANSCRIBE_FAILED",
          message: error instanceof Error ? error.message : "Unknown transcription error",
          details: error,
        },
      });
    } finally {
      await dispose(jobId);
      if (activeJobRef.current === jobId) {
        setActiveJobId(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Transcribe</h1>
        <p className="text-sm text-zinc-300">
          Upload a normalized mono 16kHz WAV segment. Processing runs locally in your browser worker.
        </p>
        <p className="text-xs text-zinc-400">
          Expected throughput: roughly 0.3x–0.8x realtime on WASM and near realtime with WebGPU on mid-range laptops.
          Accuracy and stability can drop on mobile browsers.
        </p>
      </header>

      <div className="rounded border border-zinc-800 p-4 space-y-3">
        <label className="text-sm block space-y-2">
          <span>Select normalized WAV from media prep:</span>
          <input
            type="file"
            accept="audio/wav,.wav"
            onChange={(event) => setWavBlob(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="text-sm">Stage: {state.stage}</div>
        <div className="text-sm">
          Progress: {state.progress.overallPct}% {state.progress.message ? `— ${state.progress.message}` : ""}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={onTranscribe} disabled={!wavBlob || state.canCancel}>
            Transcribe (test)
          </Button>
          <Button variant="secondary" disabled={!state.canCancel} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (activeJobRef.current) {
                cancel(activeJobRef.current);
                await dispose(activeJobRef.current);
                setActiveJobId(null);
              }
              setTranscript(null);
              dispatch({ type: "PIPELINE/RESET" });
            }}
          >
            Reset
          </Button>
        </div>

        {transcript ? (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <a className="underline text-sm" href={exportUrls?.txt} download="transcript.txt">
                Download TXT
              </a>
              <a className="underline text-sm" href={exportUrls?.srt} download="transcript.srt">
                Download SRT
              </a>
              <a className="underline text-sm" href={exportUrls?.vtt} download="transcript.vtt">
                Download VTT
              </a>
            </div>
            <pre className="text-sm whitespace-pre-wrap rounded bg-zinc-900 p-3 max-h-72 overflow-auto">
              {transcript.fullText}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
