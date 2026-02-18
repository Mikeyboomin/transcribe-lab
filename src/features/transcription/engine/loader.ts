import { modelForProfile, pickRuntime } from "./runtime";
import type { ModelProfile, RuntimePreference } from "./protocol";

type PipelineFactory = (task: string, model: string, options?: Record<string, unknown>) => Promise<any>;

let cachedPipeline: any | null = null;
let cachedModelId: string | null = null;
let cachedBackend: RuntimePreference | null = null;

export async function loadModel(args: {
  modelProfile?: ModelProfile;
  preferredBackend?: RuntimePreference;
  onProgress?: (progress: { file?: string; progress?: number; loaded?: number; total?: number; text?: string }) => void;
}) {
  const backend = pickRuntime(args.preferredBackend);
  const modelId = modelForProfile(args.modelProfile ?? "fast");

  if (cachedPipeline && cachedModelId === modelId && cachedBackend === backend) {
    return { pipeline: cachedPipeline, modelId, backend };
  }

  const transformersEntry = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
  const mod = await import(/* @vite-ignore */ transformersEntry);
  const env = mod.env as { allowLocalModels?: boolean; cacheDir?: string; backends?: any };
  // Strategy note: transformers.js gives a maintained browser stack with a single API, webgpu acceleration
  // when available, and wasm fallback otherwise, which is practical for fully client-side deployments.
  env.allowLocalModels = false;
  env.cacheDir = "transcribe-lab-model-cache";
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
  }

  const pipelineFactory = mod.pipeline as PipelineFactory;
  const instance = await pipelineFactory("automatic-speech-recognition", modelId, {
    dtype: backend === "webgpu" ? "fp16" : "q8",
    device: backend,
    progress_callback: args.onProgress,
  });

  cachedPipeline = instance;
  cachedModelId = modelId;
  cachedBackend = backend;

  return { pipeline: instance, modelId, backend };
}

export async function disposeModel() {
  if (cachedPipeline?.dispose) {
    await cachedPipeline.dispose();
  }
  cachedPipeline = null;
  cachedModelId = null;
  cachedBackend = null;
}
