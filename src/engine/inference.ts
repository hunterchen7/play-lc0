import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;
let inputName = "/input/planes";
let outputNames: string[] = [];

export async function initModel(modelData: ArrayBuffer): Promise<void> {
  // Configure ONNX Runtime
  ort.env.wasm.wasmPaths = "/";
  ort.env.wasm.numThreads = 4; // Use multi-threading

  // Try WebGPU first, fallback to WASM
  const providers: ort.InferenceSession.ExecutionProviderConfig[] = [];
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    providers.push("webgpu");
  }
  providers.push("wasm");

  session = await ort.InferenceSession.create(new Uint8Array(modelData), {
    executionProviders: providers,
  });

  // Discover tensor names dynamically
  inputName = session.inputNames[0] || inputName;
  outputNames = [...session.outputNames];
}

export interface InferenceResult {
  policy: Float32Array;
  wdl: [number, number, number];
  value: number;
}

export async function runInference(
  inputTensor: Float32Array,
): Promise<InferenceResult> {
  if (!session) throw new Error("Model not initialized");

  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", inputTensor, [1, 112, 8, 8]),
  };

  const results = await session.run(feeds);

  // Extract policy output
  let policy = new Float32Array(1858);
  for (const name of outputNames) {
    if (name.toLowerCase().includes("policy")) {
      policy = new Float32Array(results[name].data as ArrayLike<number>);
      break;
    }
  }

  // Extract WDL (win/draw/loss) output
  let wdl: [number, number, number] = [0.5, 0, 0.5];
  for (const name of outputNames) {
    if (name.toLowerCase().includes("wdl")) {
      const data = results[name].data as Float32Array;
      wdl = [data[0], data[1], data[2]];
      break;
    }
  }

  // Extract value output (fallback if no WDL)
  let value = 0;
  for (const name of outputNames) {
    if (
      name.toLowerCase().includes("value") &&
      !name.toLowerCase().includes("wdl")
    ) {
      const data = results[name].data as Float32Array;
      value = data[0];
      // Convert tanh value [-1, 1] to win probability [0, 1]
      if (wdl[0] === 0.5 && wdl[2] === 0.5) {
        // No WDL output; synthesize from value
        wdl = [(value + 1) / 2, 0, (1 - value) / 2];
      }
      break;
    }
  }

  return { policy, wdl, value };
}
