/// <reference lib="webworker" />

import {
  buildCompressArgs,
  buildExtractAudioArgs,
  buildNormalize16kWavArgs,
  buildSplit30MinArgs,
} from "./commands";
import type {
  BinaryPayload,
  FFmpegDonePayload,
  FFmpegEvent,
  FFmpegProgressPayload,
  FFmpegRequest,
} from "./protocol";

type FFmpegInstance = {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  on: (event: "progress", callback: (event: { progress: number }) => void) => void;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  exec: (args: string[]) => Promise<number>;
  deleteFile?: (name: string) => Promise<void>;
  listDir?: (path: string) => Promise<Array<{ name: string; isDir: boolean }>>;
};

let ffmpeg: FFmpegInstance | null = null;

type FFmpegModule = {
  FFmpeg: new () => FFmpegInstance;
};

type FFmpegUtilModule = {
  toBlobURL: (url: string, mimeType: string) => Promise<string>;
};

function postEvent(message: FFmpegEvent, transferables: Transferable[] = []): void {
  self.postMessage(message, transferables);
}

async function ensureFFmpegLoaded(jobId: string): Promise<FFmpegInstance> {
  if (ffmpeg) {
    return ffmpeg;
  }

  const dynamicImport = (path: string) =>
    new Function("p", "return import(/* @vite-ignore */ p)")(path) as Promise<unknown>;

  const [ffmpegModule, utilModule] = await Promise.all([
    dynamicImport("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js"),
    dynamicImport("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js"),
  ]);

  const { FFmpeg } = ffmpegModule as FFmpegModule;
  const { toBlobURL } = utilModule as FFmpegUtilModule;

  const coreURL = await toBlobURL(
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
    "text/javascript"
  );
  const wasmURL = await toBlobURL(
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    "application/wasm"
  );

  ffmpeg = new FFmpeg() as FFmpegInstance;
  await ffmpeg.load({ coreURL, wasmURL });

  ffmpeg.on("progress", ({ progress }) => {
    const payload: FFmpegProgressPayload = {
      stage: "preparing",
      stagePct: Math.round(progress * 100),
      overallPct: Math.round(progress * 100),
      message: "ffmpeg processing",
    };
    postEvent({ type: "PROGRESS", jobId, payload });
  });

  return ffmpeg;
}

function bufferFromPayload(payload: BinaryPayload): Uint8Array {
  return new Uint8Array(payload.data);
}

function buildPayload(name: string, type: string, data: Uint8Array): BinaryPayload {
  return {
    name,
    type,
    data: Uint8Array.from(data).buffer,
  };
}

function sendStageProgress(
  jobId: string,
  payload: Pick<FFmpegProgressPayload, "stage" | "message">,
  stagePct: number,
  overallPct: number
): void {
  postEvent({
    type: "PROGRESS",
    jobId,
    payload: {
      ...payload,
      stagePct,
      overallPct,
    },
  });
}

function normalizeError(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof Error) {
    return { code: "FFMPEG_ERROR", message: error.message, details: error.stack };
  }
  return { code: "FFMPEG_ERROR", message: "Unknown ffmpeg worker error", details: error };
}

async function maybeDeleteFile(instance: FFmpegInstance, ...fileNames: string[]): Promise<void> {
  if (!instance.deleteFile) {
    return;
  }
  await Promise.all(fileNames.map(async (name) => {
    try {
      await instance.deleteFile?.(name);
    } catch {
      // ignore cleanup failures
    }
  }));
}

async function handleRequest(message: FFmpegRequest): Promise<void> {
  const instance = await ensureFFmpegLoaded(message.jobId);

  if (message.type === "INIT") {
    postEvent({ type: "READY", jobId: message.jobId });
    return;
  }

  if (message.type === "EXTRACT_AUDIO") {
    const inputName = `extract_input_${message.jobId}`;
    const outputName = `extracted_${message.jobId}.wav`;

    sendStageProgress(message.jobId, { stage: "extracting", message: "Extracting audio from media" }, 0, 15);
    await instance.writeFile(inputName, bufferFromPayload(message.payload.input));
    await instance.exec(buildExtractAudioArgs(inputName, outputName));
    const output = await instance.readFile(outputName);

    const donePayload: FFmpegDonePayload = {
      type: "EXTRACT_AUDIO",
      jobId: message.jobId,
      output: buildPayload(outputName, "audio/wav", output),
    };
    postEvent({ type: "DONE", jobId: message.jobId, payload: donePayload }, [donePayload.output.data]);
    await maybeDeleteFile(instance, inputName, outputName);
    return;
  }

  if (message.type === "NORMALIZE_16K_WAV") {
    const inputName = `normalize_input_${message.jobId}`;
    const outputName = `normalized_${message.jobId}.wav`;

    sendStageProgress(message.jobId, { stage: "optimizing", message: "Normalizing to mono 16kHz WAV" }, 10, 60);
    await instance.writeFile(inputName, bufferFromPayload(message.payload.input));
    await instance.exec(buildNormalize16kWavArgs(inputName, outputName));
    const output = await instance.readFile(outputName);

    const donePayload: FFmpegDonePayload = {
      type: "NORMALIZE_16K_WAV",
      jobId: message.jobId,
      output: buildPayload(outputName, "audio/wav", output),
    };
    postEvent({ type: "DONE", jobId: message.jobId, payload: donePayload }, [donePayload.output.data]);
    await maybeDeleteFile(instance, inputName, outputName);
    return;
  }

  if (message.type === "SPLIT_30M") {
    const inputName = `split_input_${message.jobId}.wav`;
    const outputPattern = `segment_${message.jobId}_%03d.wav`;

    sendStageProgress(message.jobId, { stage: "splitting", message: "Splitting into 30 minute chunks" }, 20, 75);
    await instance.writeFile(inputName, bufferFromPayload(message.payload.input));
    await instance.exec(buildSplit30MinArgs(inputName, outputPattern));

    const entries = (await instance.listDir?.("/")) ?? [];
    const segmentNames = entries
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`segment_${message.jobId}_`) && name.endsWith(".wav"))
      .sort();

    const outputs: BinaryPayload[] = [];
    const transferables: Transferable[] = [];
    for (const name of segmentNames) {
      const bytes = await instance.readFile(name);
      const payload = buildPayload(name, "audio/wav", bytes);
      outputs.push(payload);
      transferables.push(payload.data);
    }

    const donePayload: FFmpegDonePayload = {
      type: "SPLIT_30M",
      jobId: message.jobId,
      outputs,
      manifest: segmentNames,
    };
    postEvent({ type: "DONE", jobId: message.jobId, payload: donePayload }, transferables);
    await maybeDeleteFile(instance, inputName, ...segmentNames);
    return;
  }

  const inputName = `compress_input_${message.jobId}`;
  const outputName = `compressed_${message.jobId}.m4a`;

  sendStageProgress(message.jobId, { stage: "optimizing", message: "Compressing audio" }, 20, 80);
  await instance.writeFile(inputName, bufferFromPayload(message.payload.input));
  await instance.exec(buildCompressArgs(inputName, outputName, message.payload.preset));
  const output = await instance.readFile(outputName);

  const donePayload: FFmpegDonePayload = {
    type: "COMPRESS",
    jobId: message.jobId,
    output: buildPayload(outputName, "audio/mp4", output),
    preset: message.payload.preset,
  };
  postEvent({ type: "DONE", jobId: message.jobId, payload: donePayload }, [donePayload.output.data]);
  await maybeDeleteFile(instance, inputName, outputName);
}

self.onmessage = (event: MessageEvent<FFmpegRequest>) => {
  void (async () => {
    try {
      await handleRequest(event.data);
    } catch (error) {
      postEvent({
        type: "ERROR",
        jobId: event.data.jobId,
        payload: normalizeError(error),
      });
    }
  })();
};
