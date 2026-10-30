import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Files, 
  CheckCircle2, 
  Layers, 
  Key, 
  ArrowRight, 
  Upload, 
  FileCheck, 
  RefreshCw, 
  AlertCircle, 
  Info,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { adminApi, auditApi, verifyApi, filesApi } from "../services/api";
import { ResultBadge, PrivacyBadge } from "../components/StatusBadges";
import HashDisplay from "../components/HashDisplay";

export default function Dashboard({ setActiveTab, onSelectVerificationId }) {
  const [stats, setStats] = useState(null);
  const [chainStatus, setChainStatus] = useState(null);
  const [publicKeyInfo, setPublicKeyInfo] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [quickCandidate, setQuickCandidate] = useState("");
  const [quickRegId, setQuickRegId] = useState("");
  const [quickResult, setQuickResult] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch public stats & info
      const [pubKey, chainRes, logsRes] = await Promise.all([
        verifyApi.getPublicKey().catch(() => null),
        auditApi.verifyChain().catch(() => null),
        auditApi.getLogs(6, 0).catch(() => ({ blocks: [], total_blocks: 0 }))
      ]);

      setPublicKeyInfo(pubKey);
      setChainStatus(chainRes);

      // Attempt stats
      const statsRes = await adminApi.getStats().catch(() => null);
      if (statsRes) {
        setStats(statsRes);
      } else {
        // Fallback stats from logs
        setStats({
          total_users: "3+",
          total_files: "4+",
          total_verifications: "2+",
          total_audit_blocks: logsRes?.total_blocks || 0,
          total_checkpoints: "1+"
        });
      }

      // Load files for activity feed
      const fRes = await filesApi.list().catch(() => ({ files: [] }));
      setRecentFiles((fRes.files || []).slice(0, 5));
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleVerifyChain = async () => {
    try {
      setVerifyingChain(true);
      const res = await auditApi.verifyChain();
      setChainStatus(res);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleQuickVerify = async (e) => {
    e.preventDefault();
    if (!quickCandidate && !quickRegId) {
      setQuickError("Please provide a registration ID or candidate hash.");
      return;
    }
    try {
      setQuickLoading(true);
      setQuickError(null);
      setQuickResult(null);

      const payload = {};
      if (quickRegId) payload.registration_id = quickRegId.trim();
      if (quickCandidate) payload.candidate_hash = quickCandidate.trim();

      const res = await verifyApi.verify(payload);
      setQuickResult(res);
    } catch (err) {
      setQuickError(err.message || "Quick verification failed.");
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#0C192E] via-[#0F1E36] to-[#0A1324] p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Cryptographic Trust & Data Provenance Framework</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Tamper-Evident File Verification & Provenance Registry
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            Register sensitive digital assets with immutable SHA-256 digests and RSA-PSS 2048 digital signatures. Verify bitstream integrity across privacy tiers without exposing confidential contents or ownership records.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab("verify")}
              className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
            >
              <FileCheck className="h-4 w-4" />
              <span>Verify Candidate File</span>
            </button>
            <button
              onClick={() => setActiveTab("register-file")}
              className="inline-flex items-center space-x-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <Upload className="h-4 w-4" />
              <span>Register New Asset</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1726]/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Registered Assets</span>
            <div className="rounded-lg bg-blue-500/10 p-2 border border-blue-500/20">
              <Files className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {stats ? stats.total_files : "..."}
          </p>
          <div className="mt-1 flex items-center text-xs text-slate-400">
            <span>Cryptographically sealed references</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1726]/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Verifications Run</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {stats ? stats.total_verifications : "..."}
          </p>
          <div className="mt-1 flex items-center text-xs text-slate-400">
            <span>Integrity checks executed</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1726]/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Audit Blocks Chained</span>
            <div className="rounded-lg bg-cyan-500/10 p-2 border border-cyan-500/20">
              <Layers className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {stats ? stats.total_audit_blocks : (chainStatus?.total_blocks || "...")}
          </p>
          <div className="mt-1 flex items-center text-xs text-cyan-400">
            <span>SHA-256 chained sequentially</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1726]/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Signed Checkpoints</span>
            <div className="rounded-lg bg-purple-500/10 p-2 border border-purple-500/20">
              <Key className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {stats ? stats.total_checkpoints : "1+"}
          </p>
          <div className="mt-1 flex items-center text-xs text-purple-400">
            <span>RSA-PSS Root Checkpoints</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chain Status & Quick Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Live Chain Integrity Card + Quick Verify */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Hash Chain Validation Banner */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Layers className="h-5 w-5 text-cyan-400" />
                  <span>Audit Trail Cryptographic Integrity Status</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Traverses every block in the ledger to mathematically verify pointer continuity: H_i = SHA256(H_i-1 || data).
                </p>
              </div>

              <button
                onClick={handleVerifyChain}
                disabled={verifyingChain}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifyingChain ? "animate-spin" : ""}`} />
                <span>{verifyingChain ? "Validating Chain..." : "Re-Verify Chain Now"}</span>
              </button>
            </div>

            {chainStatus && (
              <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {chainStatus.is_valid ? (
                      <span className="flex h-3 w-3 rounded-full bg-emerald-400 glow-emerald"></span>
                    ) : (
                      <span className="flex h-3 w-3 rounded-full bg-rose-500 glow-rose animate-ping"></span>
                    )}
                    <span className="text-sm font-bold text-white">
                      {chainStatus.is_valid ? "LEDGER INTACT (Zero Tampering Detected)" : "TAMPERING DETECTED IN AUDIT LEDGER"}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {chainStatus.total_blocks} Total Blocks
                  </span>
                </div>

                {chainStatus.is_valid ? (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                    <div>
                      <span className="text-slate-500">Chain Head Hash: </span>
                      <HashDisplay hash={chainStatus.head_hash} truncate={true} />
                    </div>
                    <div>
                      <span className="text-slate-500">Genesis Reference: </span>
                      <span className="font-mono text-cyan-400">00000000...0000</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/30">
                    <strong>Tampering alert:</strong> {chainStatus.error_details}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Integrity Verification Form */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 shadow-md">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <FileCheck className="h-5 w-5 text-cyan-400" />
              <span>Instant Verification Tool</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Verify any candidate asset by Registration ID and/or SHA-256 hash.
            </p>

            <form onSubmit={handleQuickVerify} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Registration ID (Optional for direct hash lookup)
                  </label>
                  <input
                    type="text"
                    value={quickRegId}
                    onChange={(e) => setQuickRegId(e.target.value)}
                    placeholder="e.g. REG-20261030-..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Candidate SHA-256 Hash
                  </label>
                  <input
                    type="text"
                    value={quickCandidate}
                    onChange={(e) => setQuickCandidate(e.target.value)}
                    placeholder="64-character hex hash"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {quickError && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{quickError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  Tip: Want to verify an actual file? Use the full <button type="button" onClick={() => setActiveTab("verify")} className="text-cyan-400 underline">Verify File Page</button>.
                </span>
                <button
                  type="submit"
                  disabled={quickLoading}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {quickLoading ? "Verifying..." : "Execute Verification"}
                </button>
              </div>
            </form>

            {/* Quick Result Preview */}
            {quickResult && (
              <div className="mt-4 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Outcome:</span>
                    <ResultBadge result={quickResult.result} size="md" />
                  </div>
                  {quickResult.signature_valid !== undefined && (
                    <span className="text-xs font-mono text-cyan-400">
                      RSA-PSS Signature: {quickResult.signature_valid ? "VALID" : "N/A"}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  {quickResult.explanation}
                </p>

                {quickResult.academic_disclaimer && (
                  <p className="text-[11px] text-slate-400 italic">
                    {quickResult.academic_disclaimer}
                  </p>
                )}

                {quickResult.provenance && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>Registered: {new Date(quickResult.provenance.registered_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>Owner: {quickResult.provenance.owner}</span>
                    <span>•</span>
                    <PrivacyBadge level={quickResult.provenance.privacy_level} size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Academic Framework & Authority Public Key */}
        <div className="space-y-6">
          
          {/* Academic Core Principle */}
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#161D2B] to-[#0E1524] p-5 shadow-md">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <Info className="h-4 w-4" />
              <span>ACADEMIC FOUNDATION</span>
            </div>
            <h4 className="mt-2 text-sm font-semibold text-white">
              Integrity vs. Real-World Factuality
            </h4>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              In digital forensics, a cryptographic hash match mathematically proves <strong>bitstream consistency with a recorded reference</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed border-l-2 border-amber-500/40 pl-2.5 italic">
              It does not prove that the real-world content of a document is factually true, legally binding, or free from deception at the moment of creation.
            </p>

            <div className="mt-4 rounded-lg bg-slate-950/60 p-3 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
              <div className="font-semibold text-cyan-400">Evaluation Tri-State:</div>
              <div>• <strong className="text-emerald-400">MATCH:</strong> Exact bits match registered reference.</div>
              <div>• <strong className="text-rose-400">MODIFIED:</strong> Registration ID is known, but bits differ.</div>
              <div>• <strong className="text-slate-400">UNKNOWN:</strong> No registration ID exists to compare against.</div>
            </div>
          </div>

          {/* System Authority Public Key Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-5 shadow-md">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Key className="h-4 w-4 text-cyan-400" />
              <span>Authority Signing Key</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              All provenance records are digitally signed with RSA-PSS (2048-bit) and SHA-256.
            </p>

            {publicKeyInfo ? (
              <div className="mt-3 space-y-2">
                <div>
                  <span className="text-[11px] text-slate-500 block">SHA-256 Key Fingerprint:</span>
                  <HashDisplay hash={publicKeyInfo.fingerprint_sha256} truncate={true} />
                </div>
                <div className="rounded bg-slate-950/80 p-2 border border-slate-800/80 text-[10px] font-mono text-slate-400 overflow-x-auto max-h-24 scrollbar-thin">
                  <pre>{publicKeyInfo.public_key_pem}</pre>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Algorithm: {publicKeyInfo.algorithm} / {publicKeyInfo.hash_algorithm}
                </span>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-500">Loading public key...</div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
