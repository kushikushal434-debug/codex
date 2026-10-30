import React, { useState, useRef, useEffect } from "react";
import { 
  FileCheck, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Eye, 
  FileText, 
  Hash, 
  RefreshCw,
  AlertCircle,
  Copy,
  Info
} from "lucide-react";
import { verifyApi } from "../services/api";
import { ResultBadge, PrivacyBadge } from "../components/StatusBadges";
import HashDisplay from "../components/HashDisplay";

export default function VerifyFile({ prefilledRegId }) {
  const fileInputRef = useRef(null);

  const [registrationId, setRegistrationId] = useState(prefilledRegId || "");
  const [candidateFile, setCandidateFile] = useState(null);
  const [candidateHash, setCandidateHash] = useState("");
  const [verificationMode, setVerificationMode] = useState("file"); // 'file' or 'hash'
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (prefilledRegId) {
      setRegistrationId(prefilledRegId);
    }
  }, [prefilledRegId]);

  const handleFileDrop = (file) => {
    setError(null);
    if (!file) return;
    setCandidateFile(file);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (verificationMode === "file" && !candidateFile && !candidateHash) {
      setError("Please select a candidate file to verify.");
      return;
    }
    if (verificationMode === "hash" && !candidateHash) {
      setError("Please input a candidate SHA-256 hash.");
      return;
    }

    try {
      setLoading(true);

      let res;
      if (verificationMode === "file" && candidateFile) {
        const formData = new FormData();
        if (registrationId.trim()) formData.append("registration_id", registrationId.trim());
        formData.append("file", candidateFile);
        res = await verifyApi.verify(formData);
      } else {
        const payload = {
          candidate_hash: candidateHash.trim()
        };
        if (registrationId.trim()) payload.registration_id = registrationId.trim();
        res = await verifyApi.verify(payload);
      }

      setResult(res);

      // If registration ID was provided or discovered, load verification history
      const targetRegId = res.registration_id || (res.provenance && res.provenance.registration_id);
      if (targetRegId) {
        loadHistory(targetRegId);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError(err.message || "Verification check failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (regId) => {
    try {
      setLoadingHistory(true);
      const hRes = await verifyApi.getHistory(regId);
      setHistory(hRes.history || []);
    } catch (err) {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          <FileCheck className="h-3.5 w-3.5 text-cyan-400" />
          <span>Tri-State Cryptographic Integrity Engine</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
          Verify File Consistency & Provenance
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Test candidate files against registered SHA-256 baselines and verify RSA-PSS digital signatures.
        </p>
      </div>

      {/* Verification Input Form */}
      <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 sm:p-8 space-y-6 shadow-md">
        
        {/* Registration ID Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Reference Registration ID (Optional for standalone hash lookup)
          </label>
          <input
            type="text"
            value={registrationId}
            onChange={(e) => setRegistrationId(e.target.value)}
            placeholder="e.g. REG-20261030-XXXXXXXX (leave empty to search by file digest)"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-mono text-cyan-300 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Comparing against a known Registration ID allows testing for <strong>MODIFIED</strong> status. Without an ID, an unknown file is labeled <strong>UNKNOWN</strong>.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-800 space-x-4">
          <button
            type="button"
            onClick={() => setVerificationMode("file")}
            className={`pb-2.5 text-xs font-bold transition flex items-center space-x-1.5 ${
              verificationMode === "file"
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Candidate File</span>
          </button>
          <button
            type="button"
            onClick={() => setVerificationMode("hash")}
            className={`pb-2.5 text-xs font-bold transition flex items-center space-x-1.5 ${
              verificationMode === "hash"
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            <span>Paste Candidate SHA-256 Hash</span>
          </button>
        </div>

        {/* Mode A: File Drop Zone */}
        {verificationMode === "file" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileDrop(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
              dragOver
                ? "border-cyan-400 bg-cyan-500/10 glow-cyan"
                : candidateFile
                ? "border-cyan-500/60 bg-slate-950/60"
                : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileDrop(e.target.files?.[0])}
              accept=".pdf,.jpg,.jpeg,.png,.txt,.docx"
              className="hidden"
            />
            {candidateFile ? (
              <div className="space-y-2">
                <FileText className="mx-auto h-8 w-8 text-cyan-400" />
                <p className="text-sm font-bold text-white">{candidateFile.name}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {(candidateFile.size / 1024).toFixed(1)} KB • Candidate file ready for hashing
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                >
                  Change File
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto h-7 w-7 text-slate-400" />
                <p className="text-xs font-semibold text-slate-200">
                  Select or drop candidate file to verify
                </p>
                <p className="text-[11px] text-slate-500">
                  Hash is computed securely server-side using streaming SHA-256
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Mode B: Hash Input */
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Candidate SHA-256 Hex Digest (64 characters)
            </label>
            <input
              type="text"
              value={candidateHash}
              onChange={(e) => setCandidateHash(e.target.value)}
              placeholder="e.g. 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleVerify}
            disabled={loading}
            className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{loading ? "Computing & Verifying..." : "Run Cryptographic Verification"}</span>
          </button>
        </div>
      </div>

      {/* Verification Result Display */}
      {result && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-6 sm:p-8 space-y-5 shadow-xl transition-all ${
            result.result === "MATCH"
              ? "border-emerald-500/40 bg-[#0A1A17] glow-emerald"
              : result.result === "MODIFIED"
              ? "border-rose-500/40 bg-[#1F0E14] glow-rose"
              : "border-slate-700 bg-[#0E1726]"
          }`}>
            
            {/* Result Header Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center space-x-3">
                <ResultBadge result={result.result} size="md" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {result.result === "MATCH" && "Cryptographic Integrity Verified"}
                    {result.result === "MODIFIED" && "Integrity Violation: File Has Been Altered"}
                    {result.result === "UNKNOWN" && "Unregistered Asset: Status Unknown"}
                  </h2>
                </div>
              </div>

              {result.signature_valid !== undefined && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">RSA-PSS Signature:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    result.signature_valid 
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                      : "bg-slate-800 text-slate-400"
                  }`}>
                    {result.signature_valid ? "CRYPTOGRAPHICALLY VALID" : "NOT APPLICABLE"}
                  </span>
                </div>
              )}
            </div>

            {/* Explanation Box */}
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800 space-y-2">
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {result.explanation}
              </p>
              
              {/* Academic Disclaimer Notice */}
              {result.academic_disclaimer && (
                <div className="border-t border-slate-800/80 pt-2 text-[11px] text-amber-300/90 flex items-start space-x-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <span className="italic">{result.academic_disclaimer}</span>
                </div>
              )}
            </div>

            {/* Candidate vs Registered Digest Comparison Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cryptographic Digest Comparison
              </h4>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60 text-xs">
                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-slate-400 font-semibold w-40">Candidate SHA-256:</span>
                  <div className="flex-1 font-mono text-cyan-300 break-all select-all">
                    {result.candidate_hash}
                  </div>
                </div>

                {result.provenance && (
                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 font-semibold w-40">Reference SHA-256:</span>
                    <div className="flex-1 font-mono text-emerald-400 break-all select-all">
                      {result.provenance.registered_hash}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Provenance Metadata (if available) */}
            {result.provenance && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Registered Provenance Metadata</span>
                  <PrivacyBadge level={result.provenance.privacy_level} size="sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Registration ID:</span>
                    <span className="font-mono text-white font-bold">{result.provenance.registration_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registered At:</span>
                    <span className="text-slate-300">{new Date(result.provenance.registered_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registered Owner:</span>
                    <span className="text-slate-300">{result.provenance.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Original Filename:</span>
                    <span className="text-slate-300 font-mono">{result.provenance.original_filename}</span>
                  </div>
                </div>

                {result.provenance.redacted && (
                  <div className="rounded bg-cyan-950/30 border border-cyan-800/40 p-2.5 text-[11px] text-cyan-300">
                    🔒 <strong>Privacy preservation notice:</strong> Owner username and original filename are masked as REDACTED according to user privacy preference (VERIFY_ONLY tier).
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verification History & Provenance Timeline */}
          {history.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span>Verification Audit Trail & History ({history.length} Queries)</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/50">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3">Verifier</th>
                      <th className="py-2.5 px-3">IP Hash</th>
                      <th className="py-2.5 px-3">Candidate Digest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-900/30">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                          {new Date(h.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <ResultBadge result={h.result} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-300">
                          {h.verifier}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {h.verifier_ip_hash}
                        </td>
                        <td className="py-2.5 px-3">
                          <HashDisplay hash={h.candidate_hash} truncate={true} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
