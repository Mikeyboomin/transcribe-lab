import type {
  ModelProfile,
  ProgressEvent,
  RuntimePreference,
  TranscriptResult,
  WorkerEvent,
  WorkerRequest,
} from "./engine/protocol";

type ProgressListener = (payload: ProgressEvent["payload"]) => void;

type Deferred = {
  resolve: (value: TranscriptResult) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
const pendingByJobId = new Map<string, Deferred>();
const progressByJobId = new Map<string, ProgressListener>();
const readyByJobId = new Map<string, { resolve: () => void; reject: (reason?: unknown) => void }>();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./engine/transcribe.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (evt: MessageEvent<WorkerEvent>) => {
    const message = evt.data;

    if (message.type === "PROGRESS") {
      progressByJobId.get(message.jobId)?.(message.payload);
      return;
    }

    if (message.type === "READY") {
      readyByJobId.get(message.jobId)?.resolve();
      readyByJobId.delete(message.jobId);
      return;
    }

    if (message.type === "RESULT") {
      pendingByJobId.get(message.jobId)?.resolve(message.payload);
      pendingByJobId.delete(message.jobId);
      progressByJobId.delete(message.jobId);
      return;
    }

    if (message.type === "ERROR") {
      if (message.payload.code === "CANCELED") {
        const canceledError = new DOMException("Transcription canceled", "AbortError");
        pendingByJobId.get(message.jobId)?.reject(canceledError);
        readyByJobId.get(message.jobId)?.reject(canceledError);
      } else {
        pendingByJobId.get(message.jobId)?.reject(message.payload);
        readyByJobId.get(message.jobId)?.reject(message.payload);
      }
      pendingByJobId.delete(message.jobId);
      readyByJobId.delete(message.jobId);
      progressByJobId.delete(message.jobId);
    }
  };
  return worker;
}

function postMessage(message: WorkerRequest, transfer: Transferable[] = []) {
  ensureWorker().postMessage(message, transfer);
}

export function initModel(
  jobId: string,
  opts?: { modelProfile?: ModelProfile; preferredBackend?: RuntimePreference; onProgress?: ProgressListener }
) {
  if (opts?.onProgress) progressByJobId.set(jobId, opts.onProgress);

  return new Promise<void>((resolve, reject) => {
    readyByJobId.set(jobId, { resolve, reject });
    postMessage({ type: "INIT_MODEL", jobId, payload: opts });
  });
}

export async function transcribeWav(jobId: string, wavBlob: Blob, onProgress?: ProgressListener) {
  if (onProgress) progressByJobId.set(jobId, onProgress);
  const wavBuffer = await wavBlob.arrayBuffer();

  const resultPromise = new Promise<TranscriptResult>((resolve, reject) => {
    pendingByJobId.set(jobId, { resolve, reject });
  });

  postMessage(
    {
      type: "TRANSCRIBE_SEGMENT",
      jobId,
      payload: { wavBuffer },
    },
    [wavBuffer]
  );

  return resultPromise;
}

export function cancel(jobId: string) {
  postMessage({ type: "CANCEL", jobId });
}

export async function dispose(jobId: string) {
  if (!worker) return;
  postMessage({ type: "DISPOSE", jobId });
  worker.terminate();
  worker = null;
  pendingByJobId.delete(jobId);
  progressByJobId.delete(jobId);
  readyByJobId.delete(jobId);
}
