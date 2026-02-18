/// <reference lib="webworker" />
import { disposeModel, loadModel } from "./loader";
import type {
  ErrorEvent,
  ProgressEvent,
  TranscriptResult,
  TranscribeSegmentRequest,
  WorkerEvent,
  WorkerRequest,
} from "./protocol";

const ctx: DedicatedWorkerGlobalScope = self as never;
const canceledJobs = new Set<string>();

type WavData = {
  sampleRate: number;
  channelData: Float32Array;
};

function post(event: WorkerEvent) {
  ctx.postMessage(event);
}

function postProgress(jobId: string, payload: ProgressEvent["payload"]) {
  post({ type: "PROGRESS", jobId, payload });
}

function postError(jobId: string, payload: ErrorEvent["payload"]) {
  post({ type: "ERROR", jobId, payload });
}

function decodeMonoWav(buffer: ArrayBuffer): WavData {
  const view = new DataView(buffer);
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
    throw new Error("Unsupported WAV container");
  }

  let offset = 12;
  let audioFormat = 1;
  let channels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === 0x666d7420) {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkId === 0x64617461) {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) throw new Error("WAV data chunk missing");
  if (channels !== 1) throw new Error("Expected mono WAV input");

  if (audioFormat === 1 && bitsPerSample === 16) {
    const samples = dataSize / 2;
    const output = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      output[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
    }
    return { sampleRate, channelData: output };
  }

  if (audioFormat === 3 && bitsPerSample === 32) {
    const samples = dataSize / 4;
    const output = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      output[i] = view.getFloat32(dataOffset + i * 4, true);
    }
    return { sampleRate, channelData: output };
  }

  throw new Error(`Unsupported WAV format: audioFormat=${audioFormat}, bitsPerSample=${bitsPerSample}`);
}

function sleepTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function extractSegments(output: any, chunkStartSec: number) {
  const pieces = Array.isArray(output?.chunks) ? output.chunks : [];
  if (pieces.length === 0) {
    const text = typeof output?.text === "string" ? output.text.trim() : "";
    return text ? [{ startSec: chunkStartSec, endSec: chunkStartSec, text }] : [];
  }

  return pieces
    .map((piece: any) => {
      const ts = piece.timestamp ?? [];
      const localStart = Number(ts[0] ?? 0);
      const localEnd = Number(ts[1] ?? localStart);
      return {
        startSec: chunkStartSec + Math.max(0, localStart),
        endSec: chunkStartSec + Math.max(localStart, localEnd),
        text: String(piece.text ?? "").trim(),
      };
    })
    .filter((segment: { text: string }) => segment.text.length > 0);
}

function mergeSegments(segments: { startSec: number; endSec: number; text: string }[]): TranscriptResult["segments"] {
  const merged: TranscriptResult["segments"] = [];
  for (const segment of segments) {
    const prev = merged[merged.length - 1];
    if (!prev || segment.startSec >= prev.endSec) {
      merged.push(segment);
      continue;
    }

    if (segment.endSec <= prev.endSec) {
      if (segment.text && !prev.text.includes(segment.text)) {
        prev.text = `${prev.text} ${segment.text}`.trim();
      }
    } else {
      prev.endSec = segment.endSec;
      prev.text = `${prev.text} ${segment.text}`.trim();
    }
  }
  return merged;
}

async function transcribe(jobId: string, request: TranscribeSegmentRequest) {
  const { pipeline } = await loadModel({
    onProgress(progress) {
      post({ type: "MODEL_PROGRESS", jobId, payload: progress });
    },
  });

  const { channelData, sampleRate } = decodeMonoWav(request.payload.wavBuffer);
  if (sampleRate !== 16000) {
    throw new Error(`Expected 16kHz WAV from media pipeline, got ${sampleRate}Hz`);
  }

  const windowSec = request.payload.chunkWindowSec ?? 45;
  const overlapSec = request.payload.overlapSec ?? 2;
  const windowSamples = Math.floor(windowSec * sampleRate);
  const overlapSamples = Math.floor(overlapSec * sampleRate);
  const stepSamples = Math.max(1, windowSamples - overlapSamples);
  const totalSamples = channelData.length;
  const segments: TranscriptResult["segments"] = [];

  for (let start = 0; start < totalSamples; start += stepSamples) {
    if (canceledJobs.has(jobId)) {
      canceledJobs.delete(jobId);
      throw new Error("CANCELED");
    }

    const end = Math.min(start + windowSamples, totalSamples);
    const chunk = channelData.slice(start, end);
    const localOutput = await pipeline(chunk, {
      chunk_length_s: windowSec,
      stride_length_s: overlapSec,
      return_timestamps: true,
      language: "english",
      task: "transcribe",
    });

    const chunkStartSec = start / sampleRate;
    segments.push(...extractSegments(localOutput, chunkStartSec));

    const stagePct = Math.round((end / totalSamples) * 100);
    postProgress(jobId, {
      stage: "transcribing",
      stagePct,
      overallPct: Math.round(15 + stagePct * 0.8),
      message: `Transcribed ${Math.round(end / sampleRate)}s / ${Math.round(totalSamples / sampleRate)}s`,
    });

    await sleepTick();
  }

  postProgress(jobId, {
    stage: "exporting",
    stagePct: 100,
    overallPct: 98,
    message: "Finalizing transcript",
  });

  const merged = mergeSegments(segments);
  const fullText = merged.map((segment) => segment.text).join(" ").trim();

  post({
    type: "RESULT",
    jobId,
    payload: {
      fullText,
      segments: merged,
    },
  });
}

ctx.onmessage = async (evt: MessageEvent<WorkerRequest>) => {
  const message = evt.data;
  const { jobId } = message;

  try {
    if (message.type === "INIT_MODEL") {
      postProgress(jobId, {
        stage: "model_loading",
        stagePct: 0,
        overallPct: 0,
        message: "Preparing transcription runtime",
      });

      const { backend, modelId } = await loadModel({
        modelProfile: message.payload?.modelProfile,
        preferredBackend: message.payload?.preferredBackend,
        onProgress(progress) {
          post({ type: "MODEL_PROGRESS", jobId, payload: progress });
          postProgress(jobId, {
            stage: "model_loading",
            stagePct: Math.round((progress.progress ?? 0) * 100),
            overallPct: Math.round((progress.progress ?? 0) * 15),
            message: progress.text ?? "Downloading model",
          });
        },
      });

      post({ type: "READY", jobId, payload: { backend, modelId } });
      postProgress(jobId, {
        stage: "model_loading",
        stagePct: 100,
        overallPct: 15,
        message: `Model ready (${backend})`,
      });
      return;
    }

    if (message.type === "TRANSCRIBE_SEGMENT") {
      await transcribe(jobId, message);
      return;
    }

    if (message.type === "CANCEL") {
      canceledJobs.add(jobId);
      return;
    }

    if (message.type === "DISPOSE") {
      canceledJobs.add(jobId);
      await disposeModel();
      return;
    }
  } catch (error) {
    const err = error as Error;
    const isCanceled = err.message === "CANCELED";
    postError(jobId, {
      code: isCanceled ? "CANCELED" : "TRANSCRIBE_FAILED",
      message: isCanceled ? "Transcription canceled" : err.message,
      details: err,
    });
  }
};
