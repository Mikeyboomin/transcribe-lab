export function createFFmpegWorker(): Worker {
  return new Worker(new URL("./ffmpeg.worker.ts", import.meta.url), { type: "module" });
}
