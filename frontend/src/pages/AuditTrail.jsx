import React, { useState, useEffect } from "react";
import { 
  History, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  RefreshCw, 
  ShieldAlert, 
  Info,
  ChevronRight,
  Database,
  ArrowDown
} from "lucide-react";
import { auditApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import HashDisplay from "../components/HashDisplay";

export default function AuditTrail() {
  const { isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState("blocks"); // 'blocks' or 'checkpoints' or 'tamper-demo'
  const [logs, setLogs] = useState([]);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [checkpoints, setCheckpoints] = useState([]);
  const [chainValidation, setChainValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [tamperTargetBlock, setTamperTargetBlock] = useState(1);
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperMessage, setTamperMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsRes, cpRes, chainRes] = await Promise.all([
        auditApi.getLogs(50, 0),
        auditApi.getCheckpoints(),
        auditApi.verifyChain()
      ]);

      setLogs(logsRes.blocks || []);
      setTotalBlocks(logsRes.total_blocks || 0);
      setCheckpoints(cpRes.checkpoints || []);
      setChainValidation(chainRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyChain = async () => {
    try {
      setValidating(true);
      const res = await auditApi.verifyChain();
      setChainValidation(res);
    } catch (err) {
      alert("Chain verification failed: " + err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleVerifyCheckpoint = async (cpId) => {
    try {
      const res = await auditApi.verifyCheckpoint(cpId);
      if (res.is_valid) {
        alert(`Checkpoint ${cpId} verified successfully! RSA-PSS signature is VALID and root hash matches the database head.`);
      } else {
        alert(`Checkpoint ${cpId} verification failed! Error: ${res.error || "Signature or root mismatch"}`);
      }
    } catch (err) {
      alert("Error verifying checkpoint: " + err.message);
    }
  };

  const handleCreateCheckpoint = async () => {
    try {
      await auditApi.createCheckpoint();
      alert("New signed checkpoint generated!");
      await loadData();
    } catch (err) {
      alert("Failed to create checkpoint: " + err.message);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      setTamperLoading(true);
      setTamperMessage(null);
      const res = await auditApi.simulateTamper(parseInt(tamperTargetBlock));
      setTamperMessage(`Tamper simulated on Block #${tamperTargetBlock}. Re-verifying ledger...`);
      setChainValidation(res.verification_after_tamper);
      await loadData();
    } catch (err) {
      alert("Tamper simulation failed: " + err.message);
    } finally {
      setTamperLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span>Tamper-Evident Ledger</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            Sequential Hash Chain & Audit Trail
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every file registration, verification, and privacy change is sequentially bound using cryptographic hash pointers: H_i = SHA256(H_i-1 || data).
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={validating}
          className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${validating ? "animate-spin" : ""}`} />
          <span>{validating ? "Validating Full Ledger..." : "Validate Entire Audit Chain"}</span>
        </button>
      </div>

      {/* Validation Status Banner */}
      {chainValidation && (
        <div className={`rounded-2xl border p-5 sm:p-6 transition-all shadow-md ${
          chainValidation.is_valid
            ? "border-emerald-500/30 bg-[#0C1A17] glow-emerald"
            : "border-rose-500/40 bg-[#1F0E14] glow-rose"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              {chainValidation.is_valid ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-rose-400 shrink-0" />
              )}
              <div>
                <h3 className="text-base font-bold text-white">
                  {chainValidation.is_valid ? "Audit Chain Integrity Fully Intact" : "LEDGER INTEGRITY BREACH DETECTED"}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {chainValidation.is_valid
                    ? `Verified all ${chainValidation.total_blocks} chained blocks from genesis (00000000...) to head.`
                    : `Tampering localized at Block #${chainValidation.broken_at_block}. ${chainValidation.error_details}`}
                </p>
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-slate-400 block font-mono">
                Ledger Length: {chainValidation.total_blocks} Blocks
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex border-b border-slate-800 space-x-6">
        <button
          onClick={() => setActiveSubTab("blocks")}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-1.5 ${
            activeSubTab === "blocks"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Chained Audit Blocks ({totalBlocks})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("checkpoints")}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-1.5 ${
            activeSubTab === "checkpoints"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Key className="h-4 w-4" />
          <span>Signed Checkpoints ({checkpoints.length})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab("tamper-demo")}
            className={`pb-3 text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === "tamper-demo"
                ? "border-b-2 border-rose-400 text-rose-400"
                : "text-slate-400 hover:text-rose-300"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Academic Tamper Defense Demo</span>
          </button>
        )}
      </div>

      {/* Tab A: Chained Audit Blocks Visualizer */}
      {activeSubTab === "blocks" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Each entry contains the hash of the preceding block, forming a strict Merkle-style chronological dependency chain.
          </p>

          <div className="space-y-3">
            {logs.map((block, idx) => {
              const isGenesis = block.block_index === 0;
              return (
                <div key={block.id} className="relative">
                  {/* Block Card */}
                  <div className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-4 shadow-sm hover:border-slate-700 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/30">
                          BLOCK #{block.block_index}
                        </span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {block.action}
                        </span>
                        {isGenesis && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold text-purple-300 border border-purple-500/40">
                            GENESIS
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(block.timestamp).toLocaleString()} • Actor: <span className="text-slate-300 font-semibold">{block.actor_username}</span>
                      </div>
                    </div>

                    {/* Hash Pointers */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          Pointer to Previous Block (prev_hash):
                        </span>
                        <HashDisplay hash={block.prev_hash} truncate={true} />
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          Current Block Digest (entry_hash):
                        </span>
                        <HashDisplay hash={block.entry_hash} truncate={true} />
                      </div>
                    </div>

                    {/* Block Payload Details */}
                    <div className="mt-2 rounded bg-slate-950/70 p-2 text-[11px] font-mono text-slate-400 border border-slate-900 overflow-x-auto">
                      <span className="text-slate-600 block text-[10px]">PAYLOAD DETAILS:</span>
                      <code>{block.details}</code>
                    </div>
                  </div>

                  {/* Visual connector line between blocks */}
                  {idx < logs.length - 1 && (
                    <div className="flex justify-center py-1 text-cyan-500/40">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab B: Signed Checkpoints */}
      {activeSubTab === "checkpoints" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Checkpoints bind the audit chain root at a given block index using the authority's RSA-PSS private key.
            </p>
            {isAdmin && (
              <button
                onClick={handleCreateCheckpoint}
                className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                + Seal New Checkpoint
              </button>
            )}
          </div>

          <div className="space-y-3">
            {checkpoints.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No checkpoints created yet.
              </div>
            ) : (
              checkpoints.map((cp) => (
                <div key={cp.id} className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center space-x-2">
                      <Key className="h-4 w-4 text-purple-400" />
                      <span className="font-mono text-xs font-bold text-white">{cp.checkpoint_id}</span>
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                        Blocks #{cp.block_start} to #{cp.block_end}
                      </span>
                    </div>

                    <button
                      onClick={() => handleVerifyCheckpoint(cp.checkpoint_id)}
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                    >
                      Verify Checkpoint Signature
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Root Hash at Head:</span>
                      <HashDisplay hash={cp.root_hash} truncate={true} />
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Sealed At:</span>
                      <span className="text-slate-300">{new Date(cp.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">
                      RSA-PSS Digital Checkpoint Signature:
                    </span>
                    <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-purple-300 break-all border border-slate-900 select-all">
                      {cp.rsa_signature}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab C: Academic Tamper Defense Demo */}
      {activeSubTab === "tamper-demo" && isAdmin && (
        <div className="rounded-2xl border border-rose-500/30 bg-[#150F18] p-6 space-y-4">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <span>Academic Demonstration: Live Tamper Detection in Hash Chain</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In college project defenses and security evaluations, examiners often ask: <em>"What happens if an unauthorized attacker modifies a record directly in the SQLite database?"</em>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use this tool to simulate modifying Block payload details in the database without recomputing the SHA-256 block hash. You can observe the chain traversal algorithm immediately catching the tampering and pinpointing the exact compromised block.
          </p>

          <div className="flex items-center space-x-3 pt-2">
            <label className="text-xs text-slate-300 font-medium">Target Block Index to Alter:</label>
            <input
              type="number"
              min="0"
              max={Math.max(0, totalBlocks - 1)}
              value={tamperTargetBlock}
              onChange={(e) => setTamperTargetBlock(e.target.value)}
              className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none"
            />
            <button
              onClick={handleSimulateTamper}
              disabled={tamperLoading}
              className="rounded-lg bg-rose-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-400 disabled:opacity-50"
            >
              {tamperLoading ? "Simulating..." : "Inject Database Modification"}
            </button>
          </div>

          {tamperMessage && (
            <div className="rounded-lg bg-slate-900 p-3 text-xs text-amber-300 border border-slate-800">
              {tamperMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
