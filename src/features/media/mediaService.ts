import { createFFmpegWorker } from "./ffmpeg/createFFmpegWorker";
import type {
  BinaryPayload,
  CompressionPreset,
  FFmpegDonePayload,
  FFmpegEvent,
  FFmpegProgressPayload,
  FFmpegRequest,
} from "./ffmpeg/protocol";

type PendingRequest = {
  resolve: (payload: FFmpegDonePayload | { type: "INIT"; jobId: string }) => void;
  reject: (reason?: unknown) => void;
  requestType: FFmpegRequest["type"];
};

type JobRuntime = {
  worker: Worker;
  pending: PendingRequest[];
  progressListener?: (progress: FFmpegProgressPayload) => void;
};

const runtimes = new Map<string, JobRuntime>();

function toArrayBuffer(data: ArrayBufferLike): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  return Uint8Array.from(new Uint8Array(data)).buffer;
}

function toBinaryPayload(file: Blob | File, fallbackName: string): Promise<BinaryPayload> {
  return file.arrayBuffer().then((data) => ({
    name: file instanceof File ? file.name : fallbackName,
    type: file.type || "application/octet-stream",
    data: toArrayBuffer(data),
  }));
}

function fromBinaryPayload(payload: BinaryPayload): Blob {
  return new Blob([payload.data], { type: payload.type });
}

function ensureRuntime(jobId: string): JobRuntime {
  const existing = runtimes.get(jobId);
  if (existing) {
    return existing;
  }

  const worker = createFFmpegWorker();
  const runtime: JobRuntime = { worker, pending: [] };

  worker.onmessage = (event: MessageEvent<FFmpegEvent>) => {
    const message = event.data;
    if (message.type === "PROGRESS") {
      runtime.progressListener?.(message.payload);
      return;
    }

    const pending = runtime.pending.shift();
    if (!pending) {
      return;
    }

    if (message.type === "ERROR") {
      pending.reject(message.payload);
      return;
    }

    if (message.type === "READY") {
      if (pending.requestType === "INIT") {
        pending.resolve({ type: "INIT", jobId: message.jobId });
      } else {
        pending.reject(new Error("Received READY for non-init request"));
      }
      return;
    }

    pending.resolve(message.payload);
  };

  worker.onerror = (event) => {
    const pending = runtime.pending.shift();
    pending?.reject(new Error(event.message || "Worker error"));
  };

  runtimes.set(jobId, runtime);
  return runtime;
}

function request(jobId: string, message: FFmpegRequest, transferables: Transferable[] = []) {
  const runtime = ensureRuntime(jobId);
  return new Promise<FFmpegDonePayload | { type: "INIT"; jobId: string }>((resolve, reject) => {
    runtime.pending.push({ resolve, reject, requestType: message.type });
    runtime.worker.postMessage(message, transferables);
  });
}

export const mediaService = {
  onProgress(jobId: string, callback: (progress: FFmpegProgressPayload) => void): () => void {
    const runtime = ensureRuntime(jobId);
    runtime.progressListener = callback;
    return () => {
      const current = runtimes.get(jobId);
      if (current?.progressListener === callback) {
        current.progressListener = undefined;
      }
    };
  },

  async init(jobId: string): Promise<void> {
    await request(jobId, { type: "INIT", jobId });
  },

  async extractAudio(jobId: string, file: File): Promise<Blob> {
    const payload = await toBinaryPayload(file, `extract-input-${jobId}`);
    const result = await request(
      jobId,
      { type: "EXTRACT_AUDIO", jobId, payload: { input: payload } },
      [payload.data]
    );

    if (result.type !== "EXTRACT_AUDIO") {
      throw new Error("Unexpected extractAudio result");
    }
    return fromBinaryPayload(result.output);
  },

  async normalize(jobId: string, input: Blob | File): Promise<Blob> {
    const payload = await toBinaryPayload(input, `normalize-input-${jobId}.wav`);
    const result = await request(
      jobId,
      { type: "NORMALIZE_16K_WAV", jobId, payload: { input: payload } },
      [payload.data]
    );

    if (result.type !== "NORMALIZE_16K_WAV") {
      throw new Error("Unexpected normalize result");
    }
    return fromBinaryPayload(result.output);
  },

  async split(jobId: string, wav: Blob): Promise<{ parts: Blob[]; manifest: string[] }> {
    const payload = await toBinaryPayload(wav, `split-input-${jobId}.wav`);
    const result = await request(
      jobId,
      { type: "SPLIT_30M", jobId, payload: { input: payload } },
      [payload.data]
    );

    if (result.type !== "SPLIT_30M") {
      throw new Error("Unexpected split result");
    }

    return {
      manifest: result.manifest,
      parts: result.outputs.map(fromBinaryPayload),
    };
  },

  async compress(jobId: string, input: Blob | File, preset: CompressionPreset): Promise<Blob> {
    const payload = await toBinaryPayload(input, `compress-input-${jobId}.wav`);
    const result = await request(
      jobId,
      { type: "COMPRESS", jobId, payload: { input: payload, preset } },
      [payload.data]
    );

    if (result.type !== "COMPRESS") {
      throw new Error("Unexpected compress result");
    }
    return fromBinaryPayload(result.output);
  },

  cancel(jobId: string): void {
    this.dispose(jobId);
  },

  dispose(jobId: string): void {
    const runtime = runtimes.get(jobId);
    if (!runtime) {
      return;
    }
    runtime.worker.terminate();
    runtime.pending.forEach((pending) => pending.reject(new Error("Job canceled")));
    runtime.pending = [];
    runtimes.delete(jobId);
  },

  disposeAll(): void {
    for (const [jobId] of runtimes) {
      this.dispose(jobId);
    }
  },
};
