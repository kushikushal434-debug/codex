import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Key, 
  FileText, 
  UserCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Ban, 
  Copy, 
  Download, 
  Upload, 
  RefreshCw, 
  Plus, 
  Trash2, 
  ExternalLink,
  Info,
  Shield,
  Layers,
  FileSearch,
  Check
} from "lucide-react";
import { certificateApi } from "../services/api";

export default function CertificateVerification() {
  const [activeSection, setActiveSection] = useState("verifier"); // 'issuer', 'holder', 'verifier'
  
  // Shared state for seamless demo flow
  const [sharedCredential, setSharedCredential] = useState(null);
  const [sharedPresentation, setSharedPresentation] = useState(null);
  const [activeNonce, setActiveNonce] = useState("");
  
  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-[#0C1527] to-blue-950/40 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 shadow-md">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Privacy-Preserving Certificate Verification System
              </h1>
            </div>
            <p className="text-sm font-medium text-cyan-300">
              Prove It Without Showing It &bull; Cryptographic Selective Disclosure &amp; Ed25519 Nonce-Bound Provenance
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Demonstrate genuine qualifications and credentials without revealing the whole document, unneeded personal details, or persistent tracking IDs. Powered by salted SHA-256 attribute commitments and Ed25519 digital signatures.
            </p>
          </div>

          {/* Quick Flow Pills */}
          <div className="flex items-center gap-2 bg-[#0B1222]/80 p-1.5 rounded-xl border border-slate-800 self-start md:self-center">
            <button
              onClick={() => setActiveSection("issuer")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "issuer"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Key className="h-3.5 w-3.5" />
              <span>1. Issuer Dashboard</span>
            </button>
            <button
              onClick={() => setActiveSection("holder")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "holder"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>2. Holder Dashboard</span>
            </button>
            <button
              onClick={() => setActiveSection("verifier")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "verifier"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>3. Verifier Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      {activeSection === "issuer" && (
        <IssuerDashboard 
          onCertificateIssued={(cert) => {
            setSharedCredential(cert);
          }}
          goToHolder={() => setActiveSection("holder")}
        />
      )}

      {activeSection === "holder" && (
        <HolderDashboard 
          credential={sharedCredential}
          setCredential={setSharedCredential}
          activeNonce={activeNonce}
          setActiveNonce={setActiveNonce}
          onPresentationCreated={(pres) => {
            setSharedPresentation(pres);
          }}
          goToVerifier={() => setActiveSection("verifier")}
        />
      )}

      {activeSection === "verifier" && (
        <VerifierDashboard 
          presentation={sharedPresentation}
          setPresentation={setSharedPresentation}
          activeNonce={activeNonce}
          setActiveNonce={setActiveNonce}
          goToHolder={() => setActiveSection("holder")}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SECTION 1: ISSUER DASHBOARD
// ------------------------------------------------------------------------------------------------
function IssuerDashboard({ onCertificateIssued, goToHolder }) {
  const [issuerKeys, setIssuerKeys] = useState(null);
  const [issuedCerts, setIssuedCerts] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Issue Form State
  const [certId, setCertId] = useState("");
  const [issuerId, setIssuerId] = useState("Stanford School of Engineering");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [claimsList, setClaimsList] = useState([
    { key: "recipient_name", value: "Alex Mercer" },
    { key: "degree", value: "Master of Science in Cybersecurity" },
    { key: "major", value: "Computer Science & Cryptography" },
    { key: "grade_gpa", value: "3.94 / 4.00" },
    { key: "honors", value: "With Highest Distinction" },
    { key: "certificate_authority", value: "Academic Credential Registry" }
  ]);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  // Revocation Modal / State
  const [revokeCertId, setRevokeCertId] = useState("");
  const [revokeReason, setRevokeReason] = useState("Administrative Revocation / Policy Breach");
  const [isRevoking, setIsRevoking] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchKeys();
    fetchIssuedCertificates();
  }, []);

  const fetchKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await certificateApi.getIssuerKeys();
      setIssuerKeys(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchIssuedCertificates = async () => {
    try {
      const res = await certificateApi.getIssuedCertificates();
      if (res.success) {
        setIssuedCerts(res.certificates);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateFreshKeys = async () => {
    if (!confirm("Generate a brand new Ed25519 Issuer Keypair? Previous certificates will need to be verified against the older key.")) return;
    try {
      const res = await certificateApi.generateIssuerKeys();
      if (res.success) {
        setIssuerKeys(res);
        setStatusMessage({ type: "success", text: "New Ed25519 keypair activated." });
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: e.message });
    }
  };

  const handleAddClaim = () => {
    if (!newKey.trim()) return;
    setClaimsList([...claimsList, { key: newKey.trim().toLowerCase().replace(/\s+/g, "_"), value: newVal.trim() }]);
    setNewKey("");
    setNewVal("");
  };

  const handleRemoveClaim = (idx) => {
    setClaimsList(claimsList.filter((_, i) => i !== idx));
  };

  const handleUpdateClaim = (idx, field, value) => {
    const updated = [...claimsList];
    updated[idx][field] = value;
    setClaimsList(updated);
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    setLoadingIssue(true);
    setStatusMessage(null);

    try {
      // Build claims object
      const claimsObj = {};
      claimsList.forEach(c => {
        if (c.key.trim()) {
          claimsObj[c.key.trim()] = c.value.trim();
        }
      });

      let res;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("certificate_id", certId.trim());
        fd.append("issuer_id", issuerId.trim());
        fd.append("issue_date", issueDate);
        if (expiryDate) fd.append("expiry_date", expiryDate);
        fd.append("claims", JSON.stringify(claimsObj));
        fd.append("file", selectedFile);
        res = await certificateApi.issueCertificate(fd);
      } else {
        res = await certificateApi.issueCertificate({
          certificate_id: certId.trim(),
          issuer_id: issuerId.trim(),
          issue_date: issueDate,
          expiry_date: expiryDate || null,
          claims: claimsObj
        });
      }

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Certificate ${res.certificate_id} issued successfully with cryptographic commitments!`
        });
        onCertificateIssued(res.credential_package);
        fetchIssuedCertificates();
        setCertId("");
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setLoadingIssue(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeCertId) return;
    setIsRevoking(true);
    try {
      const res = await certificateApi.revokeCertificate(revokeCertId, revokeReason);
      if (res.success) {
        setStatusMessage({ type: "success", text: `Certificate ${revokeCertId} marked as REVOKED.` });
        setRevokeCertId("");
        fetchIssuedCertificates();
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: e.message });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDownloadRevocationList = async () => {
    try {
      const res = await certificateApi.getRevocationList();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "issuer_revocation_list.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export revocation list: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          statusMessage.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
        }`}>
          <div className="flex items-center space-x-2 text-sm">
            {statusMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Top Grid: Key Management & Security Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ed25519 Issuer Keys Card */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Issuer Signing Keys</h3>
              </div>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono border border-cyan-500/20">
                Ed25519
              </span>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">
              The Issuer uses a private Ed25519 key to sign the cryptographic root commitment of every issued certificate. The private key remains secure and is never exposed.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Public Verification Key (Hex / 32 bytes)
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  rows={2}
                  value={issuerKeys?.public_key_hex || "Loading public key..."}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-cyan-300 resize-none focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(issuerKeys?.public_key_hex || "");
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="absolute top-2 right-2 p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs flex items-center space-x-1"
                >
                  {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
            <button
              onClick={handleGenerateFreshKeys}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Rotate Issuer Keypair</span>
            </button>
            <button
              onClick={handleDownloadRevocationList}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Revocation List</span>
            </button>
          </div>
        </div>

        {/* Issue Certificate Form */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Issue Verifiable Certificate
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Zero-knowledge salted attribute commitments
            </span>
          </div>

          <form onSubmit={handleIssue} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Certificate ID <span className="text-slate-500">(Optional, auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CERT-2026-9810"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Issuing Authority / Institution
                </label>
                <input
                  type="text"
                  required
                  value={issuerId}
                  onChange={(e) => setIssuerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expiry Date <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* File Upload Option */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Certificate Document (PDF or Image, optional)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
                />
                {selectedFile && (
                  <span className="text-xs text-emerald-400 font-mono">
                    SHA-256 computed on upload
                  </span>
                )}
              </div>
            </div>

            {/* Certificate Attributes / Claims Editor */}
            <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Certificate Attributes &amp; Data Fields
                </span>
                <span className="text-[11px] text-slate-400">
                  Each attribute gets a cryptographically unique 32-byte salt
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {claimsList.map((claim, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={claim.key}
                      onChange={(e) => handleUpdateClaim(idx, "key", e.target.value)}
                      placeholder="Field Name"
                      className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={claim.value}
                      onChange={(e) => handleUpdateClaim(idx, "value", e.target.value)}
                      placeholder="Field Value"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveClaim(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove attribute"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Claim Row */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="New Field (e.g. license_num)"
                  className="w-1/3 bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder="New Value"
                  className="flex-1 bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddClaim}
                  className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded text-xs hover:bg-cyan-500/20 flex items-center space-x-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loadingIssue || claimsList.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-lg text-xs hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20 flex items-center space-x-2 disabled:opacity-50"
              >
                {loadingIssue ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing Credential...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Issue Verifiable Certificate</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Issued Certificates & Revocation Registry */}
      <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Issued Certificates &amp; Revocation Registry ({issuedCerts.length})
            </h3>
          </div>
          <button
            onClick={fetchIssuedCertificates}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </div>

        {issuedCerts.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            No certificates issued yet. Fill out the form above to issue your first credential!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Certificate ID</th>
                  <th className="py-2.5 px-3">Issuing Authority</th>
                  <th className="py-2.5 px-3">Claims Summary</th>
                  <th className="py-2.5 px-3">Issue / Expiry</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {issuedCerts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">
                      {c.certificate_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">
                      {c.issuer_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans max-w-xs truncate">
                      {Object.keys(c.claims || {}).slice(0, 3).join(", ")}
                      {Object.keys(c.claims || {}).length > 3 ? "..." : ""}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      <div>Issued: {c.issue_date}</div>
                      <div className="text-slate-500">Exp: {c.expiry_date}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {c.is_revoked ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <Ban className="h-3 w-3" />
                          <span>REVOKED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>ACTIVE</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {!c.is_revoked && (
                        <button
                          onClick={() => {
                            setRevokeCertId(c.certificate_id);
                          }}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[11px] font-sans font-medium transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Revoke Action Modal / Section */}
        {revokeCertId && (
          <div className="mt-4 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <span className="text-xs font-bold text-rose-300">
                Confirm Revocation of Certificate: <span className="font-mono text-white">{revokeCertId}</span>
              </span>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revocation"
                className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setRevokeCertId("")}
                className="px-3 py-1 bg-slate-800 text-slate-300 hover:text-white rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors"
              >
                {isRevoking ? "Revoking..." : "Revoke Certificate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SECTION 2: CERTIFICATE HOLDER DASHBOARD (SELECTIVE DISCLOSURE)
// ------------------------------------------------------------------------------------------------
function HolderDashboard({ credential, setCredential, activeNonce, setActiveNonce, onPresentationCreated, goToVerifier }) {
  const [selectedDisclosures, setSelectedDisclosures] = useState({});
  const [nonceInput, setNonceInput] = useState(activeNonce || "");
  const [presentation, setPresentation] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [fileInspection, setFileInspection] = useState(null);
  const [inspectingFile, setInspectingFile] = useState(false);
  const [copiedPresentation, setCopiedPresentation] = useState(false);

  // Initialize disclosure toggles when credential changes
  useEffect(() => {
    if (credential && credential.claims) {
      const initial = {};
      Object.keys(credential.claims).forEach(key => {
        // By default, suggest disclosing degree and institution, keeping recipient_name private for demo
        if (key === "recipient_name" || key === "grade_gpa") {
          initial[key] = false;
        } else {
          initial[key] = true;
        }
      });
      setSelectedDisclosures(initial);
    }
  }, [credential]);

  // Keep nonce input in sync
  useEffect(() => {
    if (activeNonce) setNonceInput(activeNonce);
  }, [activeNonce]);

  const handleToggleClaim = (key) => {
    setSelectedDisclosures(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleFetchNonceFromVerifier = async () => {
    try {
      const res = await certificateApi.generateNonce("Holder Test Client");
      if (res.success) {
        setNonceInput(res.nonce);
        setActiveNonce(res.nonce);
      }
    } catch (e) {
      alert("Failed to fetch nonce: " + e.message);
    }
  };

  const handleGeneratePresentation = async () => {
    if (!credential) {
      alert("Please load or issue a credential package first.");
      return;
    }
    if (!nonceInput.trim()) {
      alert("A verifier challenge nonce is required to prevent replay attacks.");
      return;
    }

    setGenerating(true);
    try {
      const disclosedKeys = Object.keys(selectedDisclosures).filter(k => selectedDisclosures[k]);
      const res = await certificateApi.createPresentation(credential, disclosedKeys, nonceInput.trim());
      if (res.success) {
        setPresentation(res.presentation);
        onPresentationCreated(res.presentation);
      }
    } catch (e) {
      alert("Failed to create presentation: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadCredentialJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (!json.manifest || !json.claims) {
          alert("Invalid credential package JSON. Missing manifest or claims.");
          return;
        }
        setCredential(json);
      } catch (err) {
        alert("Failed to parse JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleInspectRawDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInspectingFile(true);
    try {
      const res = await certificateApi.inspectFile(file);
      setFileInspection(res);
    } catch (err) {
      alert("Failed to inspect file: " + err.message);
    } finally {
      setInspectingFile(false);
    }
  };

  const handleDownloadCredential = () => {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${credential.manifest?.certificate_id || "certificate"}_credential.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Credential Loader & Raw Document Explainer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload / Load Credential Package */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Holder's Cryptographic Credential
              </h3>
            </div>
            {credential && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                LOADED: {credential.manifest?.certificate_id}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Upload your personal Credential Package file (<span className="text-cyan-300 font-mono">.json</span>). It contains the Issuer's Ed25519 digital signature, the root commitment, and your private salted attribute claims.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center space-x-2 transition-colors">
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Load Credential (.json)</span>
              <input type="file" accept=".json" onChange={handleUploadCredentialJson} className="hidden" />
            </label>

            {credential && (
              <button
                onClick={handleDownloadCredential}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 flex items-center space-x-2 transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>Save Credential Backup</span>
              </button>
            )}
          </div>

          {/* Credential Metadata Box */}
          {credential && credential.manifest && (
            <div className="mt-4 p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Certificate ID</span>
                <span className="font-mono text-cyan-300 font-bold">{credential.manifest.certificate_id}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Issuer</span>
                <span className="text-slate-300 truncate block">{credential.manifest.issuer_id}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Issue Date</span>
                <span className="text-slate-300">{credential.manifest.issue_date}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Expiry Date</span>
                <span className="text-slate-300">{credential.manifest.expiry_date}</span>
              </div>
            </div>
          )}
        </div>

        {/* Raw File Inspector (Fulfills: "Do not assume uploaded PDF is digitally signed") */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <FileSearch className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Raw Certificate File Inspector
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Upload any raw certificate (PDF or image) to inspect its cryptographic status.
            </p>

            <label className="cursor-pointer block text-center p-3 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl bg-slate-950/40 text-xs text-slate-400 transition-colors">
              <Upload className="h-4 w-4 mx-auto mb-1 text-slate-500" />
              <span>Select PDF or Image to inspect</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleInspectRawDocument} className="hidden" />
            </label>

            {inspectingFile && <p className="text-xs text-cyan-400 mt-2">Computing SHA-256 digest...</p>}

            {fileInspection && (
              <div className="mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{fileInspection.filename}</span>
                  <span className="font-mono text-[10px] text-amber-400">{fileInspection.format}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 break-all">
                  SHA-256: {fileInspection.sha256_hash.substring(0, 16)}...
                </div>
                <p className="text-[11px] text-amber-300/90 leading-relaxed pt-1">
                  {fileInspection.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selective Disclosure Attributes Checklist */}
      {credential && credential.claims ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <EyeOff className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Selective Disclosure Control Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select which attributes you wish to prove. Unchecked attributes will remain strictly private; the verifier will only receive a one-way salted commitment hash.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const allTrue = {};
                  Object.keys(credential.claims).forEach(k => allTrue[k] = true);
                  setSelectedDisclosures(allTrue);
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-900 rounded"
              >
                Disclose All
              </button>
              <button
                type="button"
                onClick={() => {
                  const allFalse = {};
                  Object.keys(credential.claims).forEach(k => allFalse[k] = false);
                  setSelectedDisclosures(allFalse);
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-900 rounded"
              >
                Hide All
              </button>
            </div>
          </div>

          {/* Claims Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.keys(credential.claims).map((key) => {
              const claim = credential.claims[key];
              const isDisclosed = Boolean(selectedDisclosures[key]);

              return (
                <div
                  key={key}
                  onClick={() => handleToggleClaim(key)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                    isDisclosed
                      ? "bg-cyan-950/20 border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                      : "bg-slate-950/40 border-slate-800 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      {key}
                    </span>
                    {isDisclosed ? (
                      <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        <Eye className="h-3 w-3" />
                        <span>DISCLOSED</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                        <Lock className="h-3 w-3" />
                        <span>HIDDEN (COMMITMENT ONLY)</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-white font-medium mb-1 truncate">
                    {claim.value}
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    Salt: {claim.salt.substring(0, 14)}...
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anti-Replay Nonce & Generate Presentation Box */}
          <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-auto flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Verifier Challenge Nonce <span className="text-slate-500">(Required to prevent replay attacks)</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  required
                  placeholder="Paste challenge nonce provided by Verifier (e.g. chlg_9f8a...)"
                  value={nonceInput}
                  onChange={(e) => {
                    setNonceInput(e.target.value);
                    setActiveNonce(e.target.value);
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleFetchNonceFromVerifier}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg whitespace-nowrap"
                >
                  Fetch Test Nonce
                </button>
              </div>
            </div>

            <button
              onClick={handleGeneratePresentation}
              disabled={generating || !nonceInput.trim()}
              className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Computing Selective Proof...</span>
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  <span>Generate Selective Presentation</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-8 text-center">
          <Shield className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-300 mb-1">No Credential Loaded</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            You must first issue a certificate in the <strong>Issuer Dashboard</strong> or upload an existing Credential Package (<span className="font-mono text-cyan-400">.json</span>).
          </p>
        </div>
      )}

      {/* Generated Presentation Preview */}
      {presentation && (
        <div className="rounded-2xl border border-cyan-500/30 bg-[#0B1222] p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Selective Disclosure Presentation Ready
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(presentation, null, 2));
                  setCopiedPresentation(true);
                  setTimeout(() => setCopiedPresentation(false), 2000);
                }}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded text-xs flex items-center space-x-1"
              >
                {copiedPresentation ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedPresentation ? "Copied" : "Copy JSON"}</span>
              </button>
              <button
                onClick={goToVerifier}
                className="px-3 py-1 bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 rounded text-xs flex items-center space-x-1"
              >
                <span>Send to Verifier</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Ephemeral Presentation ID</span>
              <span className="font-mono text-cyan-300 text-[11px] truncate block">{presentation.presentation_id}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Prevents verifiers from tracking user ID</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Disclosed Attributes</span>
              <span className="font-bold text-emerald-400 text-sm">{Object.keys(presentation.disclosed_claims).length} Attributes</span>
              <span className="text-[10px] text-slate-500 block mt-1">Full values revealed to verifier</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Redacted / Hidden Claims</span>
              <span className="font-bold text-purple-400 text-sm">{Object.keys(presentation.hidden_claims).length} Attributes</span>
              <span className="text-[10px] text-slate-500 block mt-1">Proven via SHA-256 commitments only</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
            <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap">
              {JSON.stringify(presentation, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SECTION 3: VERIFIER DASHBOARD
// ------------------------------------------------------------------------------------------------
function VerifierDashboard({ presentation, setPresentation, activeNonce, setActiveNonce, goToHolder }) {
  const [nonce, setNonce] = useState(activeNonce || "");
  const [nonceData, setNonceData] = useState(null);
  const [presentationJson, setPresentationJson] = useState(presentation ? JSON.stringify(presentation, null, 2) : "");
  const [trustedPubkey, setTrustedPubkey] = useState("");
  const [revocationListJson, setRevocationListJson] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tampering, setTampering] = useState(false);

  useEffect(() => {
    if (presentation) {
      setPresentationJson(JSON.stringify(presentation, null, 2));
    }
  }, [presentation]);

  const handleGenerateChallengeNonce = async () => {
    try {
      const res = await certificateApi.generateNonce("Enterprise Employment Verifier");
      if (res.success) {
        setNonce(res.nonce);
        setActiveNonce(res.nonce);
        setNonceData(res);
      }
    } catch (e) {
      alert("Failed to generate challenge: " + e.message);
    }
  };

  const handleVerify = async () => {
    if (!presentationJson.trim()) {
      alert("Please paste or load a Presentation JSON.");
      return;
    }

    let parsedPres;
    try {
      parsedPres = JSON.parse(presentationJson);
    } catch (err) {
      alert("Invalid JSON format in presentation payload: " + err.message);
      return;
    }

    let parsedRevList = null;
    if (revocationListJson.trim()) {
      try {
        parsedRevList = JSON.parse(revocationListJson);
      } catch (e) {
        // Assume comma separated
        parsedRevList = revocationListJson.split(",").map(s => s.trim());
      }
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await certificateApi.verifyPresentation(
        parsedPres,
        trustedPubkey.trim() || null,
        parsedRevList
      );
      if (res.success) {
        setVerificationResult(res.verification);
      }
    } catch (err) {
      alert("Verification request failed: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = () => {
    if (!presentationJson.trim()) {
      alert("Load a presentation first before simulating tampering.");
      return;
    }
    try {
      const obj = JSON.parse(presentationJson);
      if (obj.disclosed_claims && Object.keys(obj.disclosed_claims).length > 0) {
        const firstKey = Object.keys(obj.disclosed_claims)[0];
        obj.disclosed_claims[firstKey].value = obj.disclosed_claims[firstKey].value + " [TAMPERED]";
      } else if (obj.hidden_claims && Object.keys(obj.hidden_claims).length > 0) {
        const firstKey = Object.keys(obj.hidden_claims)[0];
        obj.hidden_claims[firstKey] = "0" * 64;
      }
      setPresentationJson(JSON.stringify(obj, null, 2));
      alert("Tampered with presentation claims! Now click 'Run Cryptographic Verification' to observe tamper detection.");
    } catch (e) {
      alert("Failed to tamper: " + e.message);
    }
  };

  const handleLoadSamplePresentation = () => {
    if (!presentation) {
      alert("No active presentation created yet. Please go to Holder Dashboard to create one.");
      return;
    }
    setPresentationJson(JSON.stringify(presentation, null, 2));
  };

  return (
    <div className="space-y-6">
      {/* Verifier Challenge Nonce Generator */}
      <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Step 1: Generate Fresh Verification Challenge (Anti-Replay Nonce)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Valid for 10 minutes &bull; Single-use only
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          To prevent replay attacks, the Verifier issues a high-entropy random nonce. The Holder's presentation must cryptographically bind to this challenge. Once verified, the nonce cannot be re-used.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateChallengeNonce}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-cyan-500/20 flex items-center space-x-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Generate New Challenge Nonce</span>
          </button>

          {nonce && (
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="text-xs font-mono text-cyan-300 font-bold">{nonce}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nonce);
                  alert("Nonce copied to clipboard!");
                }}
                className="text-slate-400 hover:text-white"
                title="Copy Nonce"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Verification Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Presentation Payload Input */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Step 2: Presentation Payload
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSimulateTamper}
                className="text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded"
              >
                ⚠️ Simulate Tampering
              </button>
              {presentation && (
                <button
                  type="button"
                  onClick={handleLoadSamplePresentation}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded"
                >
                  Reload from Holder
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={10}
            value={presentationJson}
            onChange={(e) => setPresentationJson(e.target.value)}
            placeholder="Paste the Selective Disclosure Presentation JSON here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
          />

          <div className="flex items-center justify-between pt-2">
            <label className="cursor-pointer text-xs text-slate-400 hover:text-white flex items-center space-x-1.5">
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload Presentation File (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = (evt) => setPresentationJson(evt.target.result);
                  r.readAsText(f);
                }}
                className="hidden"
              />
            </label>

            <button
              onClick={handleVerify}
              disabled={verifying || !presentationJson.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-2 disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying Cryptographic Proofs...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Run Cryptographic Verification</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Local Verification Parameters (No server call required / Offline trust) */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B1222] p-5 shadow-lg space-y-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Key className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Issuer Privacy &amp; Local Verification
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              The Issuer is never contacted during verification. The verifier validates proofs purely mathematically using the Issuer's public key and revocation list.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Custom Trusted Issuer Public Key <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={trustedPubkey}
              onChange={(e) => setTrustedPubkey(e.target.value)}
              placeholder="Leave blank to use default authority key"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Offline Revocation Registry Data <span className="text-slate-500">(Optional JSON)</span>
            </label>
            <textarea
              rows={4}
              value={revocationListJson}
              onChange={(e) => setRevocationListJson(e.target.value)}
              placeholder="Paste revocation JSON or revoked certificate IDs"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Verification Result Section */}
      {verificationResult && (
        <VerificationResultCard result={verificationResult} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// VERIFICATION RESULT CARD (Clean, Professional, Comprehensive)
// ------------------------------------------------------------------------------------------------
function VerificationResultCard({ result }) {
  const statusCode = result.status_code || "INVALID";
  
  // Status Banner Configurations
  const configs = {
    VALID: {
      title: "VALID CERTIFICATE",
      subtitle: "Authenticity & Integrity Mathematically Proven",
      color: "emerald",
      icon: CheckCircle2,
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    },
    TAMPERED: {
      title: "TAMPERED CERTIFICATE",
      subtitle: "Cryptographic Hash Commitment Mismatch",
      color: "rose",
      icon: AlertTriangle,
      border: "border-rose-500/40",
      bg: "bg-rose-500/10",
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/30"
    },
    INVALID: {
      title: "INVALID CERTIFICATE",
      subtitle: "Ed25519 Digital Signature Failed to Verify",
      color: "rose",
      icon: XCircle,
      border: "border-rose-500/40",
      bg: "bg-rose-500/10",
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/30"
    },
    EXPIRED: {
      title: "EXPIRED CERTIFICATE",
      subtitle: "Certificate Expiration Date Has Passed",
      color: "amber",
      icon: Clock,
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30"
    },
    REVOKED: {
      title: "REVOKED CERTIFICATE",
      subtitle: "Listed in Issuer's Revocation Registry",
      color: "purple",
      icon: Ban,
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      badge: "bg-purple-500/20 text-purple-300 border-purple-500/30"
    },
    REPLAY_OR_INVALID_NONCE: {
      title: "REPLAY ATTACK DETECTED / EXPIRED NONCE",
      subtitle: "Challenge Nonce Missing, Expired, or Already Used",
      color: "orange",
      icon: AlertTriangle,
      border: "border-orange-500/40",
      bg: "bg-orange-500/10",
      badge: "bg-orange-500/20 text-orange-300 border-orange-500/30"
    }
  };

  const currentConfig = configs[statusCode] || configs.INVALID;
  const Icon = currentConfig.icon;
  const checks = result.checks || {};

  return (
    <div className={`rounded-2xl border ${currentConfig.border} bg-[#0B1222] p-6 shadow-2xl space-y-6 transition-all`}>
      {/* Top Banner */}
      <div className={`p-4 rounded-xl ${currentConfig.bg} border ${currentConfig.border} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center space-x-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${currentConfig.badge}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>{currentConfig.title}</span>
            </h2>
            <p className="text-xs font-medium text-slate-300">
              {result.message || currentConfig.subtitle}
            </p>
          </div>
        </div>

        {result.certificate_id && (
          <div className="text-right font-mono text-xs">
            <span className="text-slate-400 text-[10px] block uppercase">Certificate ID</span>
            <span className="text-white font-bold">{result.certificate_id}</span>
          </div>
        )}
      </div>

      {/* Cryptographic Verification Checklist */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Cryptographic Verification Checklist
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <CheckItem
            label="Challenge Nonce Check"
            passed={checks.nonce_fresh}
            desc="One-time use &amp; fresh"
          />
          <CheckItem
            label="Root Integrity"
            passed={checks.claims_integrity}
            desc="Commitments match root"
          />
          <CheckItem
            label="Ed25519 Signature"
            passed={checks.signature_authentic}
            desc="Authentic issuer signature"
          />
          <CheckItem
            label="Expiration Check"
            passed={checks.not_expired}
            desc="Within validity window"
          />
          <CheckItem
            label="Revocation Check"
            passed={checks.not_revoked}
            desc="Clear of revocation registry"
          />
        </div>
      </div>

      {/* Disclosed vs Hidden Claims Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verified Disclosed Claims */}
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Disclosed Attributes ({Object.keys(result.disclosed_fields || {}).length})
              </h4>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">
              Cryptographically Verified
            </span>
          </div>

          {Object.keys(result.disclosed_fields || {}).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No attributes were disclosed by holder.</p>
          ) : (
            <div className="space-y-2">
              {Object.keys(result.disclosed_fields).map((k) => (
                <div key={k} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-cyan-300 block">{k}</span>
                    <span className="text-xs font-bold text-white">{result.disclosed_fields[k].value}</span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cryptographically Proven Hidden Claims */}
        <div className="rounded-xl border border-purple-500/20 bg-slate-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Protected / Undisclosed Attributes ({result.hidden_fields_count || 0})
              </h4>
            </div>
            <span className="text-[10px] text-purple-400 font-mono">
              Zero-Knowledge Salted Hash
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The holder chose to keep <strong className="text-white">{result.hidden_fields_count || 0} personal fields private</strong>. Their validity is mathematically guaranteed by the SHA-256 root commitment without exposing any names, grades, or personal identifiers.
          </p>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Root Commitment (Signed by Authority)</span>
            <span className="text-cyan-300 break-all">{result.root_commitment || "Reconstructed from disclosed & blinded hashes"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, passed, desc }) {
  return (
    <div className={`p-2.5 rounded-lg border ${
      passed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
    }`}>
      <div className="flex items-center space-x-1.5 mb-1">
        {passed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className="text-[11px] font-bold text-slate-200">{label}</span>
      </div>
      <p className="text-[10px] text-slate-400">{desc}</p>
    </div>
  );
}

