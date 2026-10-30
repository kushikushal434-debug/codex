import React, { useState, useRef } from "react";
import { 
  Upload, 
  File, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Eye, 
  Globe, 
  Copy, 
  Check, 
  ShieldCheck, 
  FileText, 
  ArrowRight,
  Info
} from "lucide-react";
import { filesApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import HashDisplay from "../components/HashDisplay";

export default function RegisterFile({ setActiveTab, onRegistrationComplete }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [privacyLevel, setPrivacyLevel] = useState("PRIVATE"); // PRIVATE BY DEFAULT
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "txt", "docx"];

  const handleFileChange = (file) => {
    setError(null);
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setError(`Unsupported file type '.${ext}'. Allowed types: ${allowedExtensions.join(", ")}`);
      setSelectedFile(null);
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      setError("File size exceeds maximum allowed limit of 16 MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a file to register.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("privacy_level", privacyLevel);
      formData.append("tags", tags);
      formData.append("description", description);

      const res = await filesApi.register(formData);
      setSuccessReceipt(res);
      if (onRegistrationComplete) onRegistrationComplete(res);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRegId = (regId) => {
    navigator.clipboard.writeText(regId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPrivacyLevel("PRIVATE");
    setTags("");
    setDescription("");
    setError(null);
    setSuccessReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          <Upload className="h-3.5 w-3.5 text-cyan-400" />
          <span>Cryptographic Asset Registration</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
          Register & Digitally Sign Asset Provenance
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Generate an immutable SHA-256 fingerprint, establish ownership, create an RSA-PSS signed provenance payload, and chain the transaction into the tamper-evident audit ledger.
        </p>
      </div>

      {/* Main Registration Form or Success Receipt */}
      {!successReceipt ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* File Upload Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 ${
              dragOver
                ? "border-cyan-400 bg-cyan-500/10 glow-cyan"
                : selectedFile
                ? "border-cyan-500/60 bg-[#0E1726]/90"
                : "border-slate-700 bg-[#0B1120]/70 hover:border-slate-600 hover:bg-slate-900/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              accept=".pdf,.jpg,.jpeg,.png,.txt,.docx"
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "application/octet-stream"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Change File
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-cyan-400 border border-slate-700">
                  <Upload className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag and drop your file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supported: PDF, JPG, PNG, TXT, DOCX (Max 16 MB)
                  </p>
                </div>
                <div className="flex justify-center items-center space-x-2 text-[11px] text-slate-500">
                  <span>🔒 Binary stored in secure isolated storage with UUID</span>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Controls (Private by Default) */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Privacy & Verification Disclosure Tier</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero-knowledge & privacy preservation controls. Defaults strictly to <strong>PRIVATE</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: PRIVATE */}
              <label className={`cursor-pointer rounded-xl border p-4 transition ${
                privacyLevel === "PRIVATE"
                  ? "border-purple-500 bg-purple-500/10 shadow-sm shadow-purple-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">PRIVATE (Default)</span>
                  </div>
                  <input
                    type="radio"
                    name="privacy"
                    value="PRIVATE"
                    checked={privacyLevel === "PRIVATE"}
                    onChange={(e) => setPrivacyLevel(e.target.value)}
                    className="accent-purple-500 mt-0.5"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Only you (and system admin) can verify or view details. External verification queries are restricted (403).
                </p>
              </label>

              {/* Option 2: VERIFY_ONLY */}
              <label className={`cursor-pointer rounded-xl border p-4 transition ${
                privacyLevel === "VERIFY_ONLY"
                  ? "border-cyan-500 bg-cyan-500/10 shadow-sm shadow-cyan-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">VERIFY_ONLY</span>
                  </div>
                  <input
                    type="radio"
                    name="privacy"
                    value="VERIFY_ONLY"
                    checked={privacyLevel === "VERIFY_ONLY"}
                    onChange={(e) => setPrivacyLevel(e.target.value)}
                    className="accent-cyan-500 mt-0.5"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Anyone with the ID can verify bitstream integrity, but owner identity and filename are <strong>REDACTED</strong>.
                </p>
              </label>

              {/* Option 3: PUBLIC */}
              <label className={`cursor-pointer rounded-xl border p-4 transition ${
                privacyLevel === "PUBLIC"
                  ? "border-emerald-500 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">PUBLIC</span>
                  </div>
                  <input
                    type="radio"
                    name="privacy"
                    value="PUBLIC"
                    checked={privacyLevel === "PUBLIC"}
                    onChange={(e) => setPrivacyLevel(e.target.value)}
                    className="accent-emerald-500 mt-0.5"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Publicly verifiable with full metadata and ownership disclosure on the provenance timeline.
                </p>
              </label>
            </div>
          </div>

          {/* Optional Metadata */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Optional Metadata & Classification</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. legal, research-v1, certified"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Master reference copy of final college dissertation"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{loading ? "Computing Hash & Signing..." : "Register & Sign Asset"}</span>
            </button>
          </div>

        </form>
      ) : (
        /* Success Provenance Certificate */
        <div className="rounded-2xl border border-emerald-500/30 bg-[#0E1726]/95 p-6 sm:p-8 space-y-6 shadow-xl glow-emerald">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center space-x-3">
              <div className="rounded-xl bg-emerald-500/20 p-3 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Cryptographic Registration Complete
                </span>
                <h2 className="text-xl font-bold text-white">
                  Provenance Record Sealed & Signed
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleCopyRegId(successReceipt.file.registration_id)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
              >
                {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId ? "Copied ID!" : "Copy Registration ID"}</span>
              </button>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                Registration Identifier
              </span>
              <div className="text-base font-mono font-bold text-white select-all">
                {successReceipt.file.registration_id}
              </div>
              <span className="text-[11px] text-slate-400 block">
                Share this ID with third parties to let them verify their copy of this asset.
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                SHA-256 Bitstream Hash
              </span>
              <HashDisplay hash={successReceipt.file.file_hash} truncate={false} />
              <span className="text-[11px] text-slate-400 block">
                Streaming deterministic SHA-256 digest calculated server-side.
              </span>
            </div>
          </div>

          {/* Provenance Signature Payload */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-xs flex items-center space-x-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span>RSA-PSS 2048 Digital Provenance Signature (Base64)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                AUDIT BLOCK #{successReceipt.provenance.audit_block_index}
              </span>
            </div>
            <div className="rounded bg-slate-900/90 p-2 text-[10px] font-mono text-cyan-300 break-all border border-slate-800 select-all">
              {successReceipt.provenance.rsa_signature}
            </div>
            <div className="text-[10px] text-slate-500">
              Authority Public Key Fingerprint: <span className="font-mono text-slate-400">{successReceipt.provenance.public_key_fingerprint}</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Register Another Asset
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab("my-files")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                View in My Assets
              </button>
              <button
                onClick={() => setActiveTab("verify")}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                <span>Test Verification</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
