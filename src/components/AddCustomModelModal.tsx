import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, XCircle } from "lucide-react";
import type { CustomModelMeta } from "../utils/customModels";

type VerifyStatus = "idle" | "verifying" | "success" | "error";

interface AddCustomModelModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (meta: CustomModelMeta, data: ArrayBuffer) => Promise<void>;
}

export function AddCustomModelModal({
  open,
  onClose,
  onAdd,
}: AddCustomModelModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [elo, setElo] = useState("");
  const [arch, setArch] = useState("");
  const [source, setSource] = useState("");

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyError, setVerifyError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setFileData(null);
    setName("");
    setDescription("");
    setElo("");
    setArch("");
    setSource("");
    setVerifyStatus("idle");
    setVerifyError("");
    setSubmitting(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      setFile(selected);
      setFileData(null);
      setVerifyStatus("idle");
      setVerifyError("");

      if (selected) {
        selected.arrayBuffer().then(setFileData);
        if (!name) {
          const baseName = selected.name
            .replace(/\.onnx$/i, "")
            .replace(/[_-]/g, " ");
          setName(baseName);
        }
      }
    },
    [name],
  );

  const handleVerify = useCallback(async () => {
    if (!fileData) return;

    setVerifyStatus("verifying");
    setVerifyError("");

    try {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/";
      ort.env.wasm.numThreads = 1;

      const session = await ort.InferenceSession.create(
        new Uint8Array(fileData),
        { executionProviders: ["wasm"] },
      );

      // Check that at least one input exists
      if (session.inputNames.length === 0) {
        throw new Error("Model has no input tensors");
      }

      // Check for a policy output
      const policyName = session.outputNames.find((n) =>
        n.toLowerCase().includes("policy"),
      );
      if (!policyName) {
        throw new Error(
          "No policy output found. Expected an output tensor with 'policy' in its name.",
        );
      }

      // Run a test inference with zeroed input
      const inputName = session.inputNames[0];
      const testInput = new ort.Tensor(
        "float32",
        new Float32Array(1 * 112 * 8 * 8),
        [1, 112, 8, 8],
      );
      const results = await session.run({ [inputName]: testInput });

      const policyData = results[policyName].data as Float32Array;
      if (policyData.length !== 1858) {
        throw new Error(
          `Policy output has ${policyData.length} elements, expected 1858`,
        );
      }

      await session.release();
      setVerifyStatus("success");
    } catch (err) {
      setVerifyStatus("error");
      setVerifyError(
        err instanceof Error ? err.message : "Verification failed",
      );
    }
  }, [fileData]);

  const handleSubmit = useCallback(async () => {
    if (!fileData || !name.trim() || verifyStatus !== "success") return;

    setSubmitting(true);
    try {
      const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const meta: CustomModelMeta = {
        id,
        name: name.trim(),
        arch: arch.trim() || "Custom",
        elo: elo.trim() || "?",
        description: description.trim() || "Custom uploaded model",
        source: source.trim() || "",
        sizeBytes: fileData.byteLength,
        addedAt: Date.now(),
      };

      await onAdd(meta, fileData);
      handleClose();
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Failed to save model",
      );
      setSubmitting(false);
    }
  }, [
    fileData,
    name,
    arch,
    elo,
    description,
    source,
    verifyStatus,
    onAdd,
    handleClose,
  ]);

  const canVerify = fileData !== null && verifyStatus !== "verifying";
  const canSubmit =
    fileData !== null &&
    name.trim().length > 0 &&
    verifyStatus === "success" &&
    !submitting;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div
        className={`relative bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl transition-transform duration-200 max-h-[90vh] overflow-y-auto ${
          open ? "scale-100" : "scale-95"
        }`}
      >
        <h3 className="text-lg font-semibold text-gray-100 mb-4">
          Add Custom Model
        </h3>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            ONNX Weights File <span className="text-red-400">*</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-600 hover:border-emerald-500 rounded-lg p-4 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".onnx"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="text-sm text-gray-200">
                <span className="font-medium">{file.name}</span>
                <span className="text-gray-400 ml-2">
                  ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
            ) : (
              <div className="text-gray-400 flex flex-col items-center gap-1">
                <Upload className="w-6 h-6" />
                <span className="text-sm">
                  Click to select an .onnx file
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Network"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Custom uploaded model"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Elo + Architecture side by side */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Elo Rating
            </label>
            <input
              type="text"
              value={elo}
              onChange={(e) => setElo(e.target.value)}
              placeholder="?"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Architecture
            </label>
            <input
              type="text"
              value={arch}
              onChange={(e) => setArch(e.target.value)}
              placeholder="Custom"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Source URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Source URL
          </label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Verification */}
        <div className="mb-4">
          <button
            onClick={handleVerify}
            disabled={!canVerify}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-gray-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {verifyStatus === "verifying" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying model...
              </>
            ) : verifyStatus === "success" ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Model verified
              </>
            ) : verifyStatus === "error" ? (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                Retry verification
              </>
            ) : (
              "Verify Model"
            )}
          </button>
          {verifyStatus === "error" && verifyError && (
            <p className="mt-2 text-xs text-red-400">{verifyError}</p>
          )}
          {verifyStatus === "success" && (
            <p className="mt-2 text-xs text-emerald-400">
              Model is a valid Lc0 network with 1858-element policy output.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add Model"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
