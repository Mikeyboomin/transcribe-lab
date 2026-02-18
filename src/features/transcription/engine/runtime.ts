import type { RuntimePreference } from "./protocol";

export function pickRuntime(preferred?: RuntimePreference): RuntimePreference {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (preferred === "webgpu" && hasWebGpu) return "webgpu";
  if (preferred === "wasm") return "wasm";
  return hasWebGpu ? "webgpu" : "wasm";
}

export function modelForProfile(profile: "fast" | "balanced" = "fast") {
  return profile === "balanced" ? "Xenova/whisper-base" : "Xenova/whisper-tiny.en";
}
