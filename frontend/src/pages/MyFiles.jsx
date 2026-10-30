import React, { useState, useEffect } from "react";
import { 
  FolderLock, 
  Download, 
  FileCheck, 
  Eye, 
  Lock, 
  Search, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink,
  Edit2,
  X,
  AlertCircle
} from "lucide-react";
import { filesApi } from "../services/api";
import { PrivacyBadge } from "../components/StatusBadges";
import HashDisplay from "../components/HashDisplay";

export default function MyFiles({ setActiveTab, onSelectFileForVerify }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFileDetail, setSelectedFileDetail] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [newPrivacy, setNewPrivacy] = useState("PRIVATE");
  const [newTags, setNewTags] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const res = await filesApi.list();
      setFiles(res.files || []);
    } catch (err) {
      setError("Failed to load your assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleDownload = async (regId, filename) => {
    try {
      await filesApi.download(regId, filename);
    } catch (err) {
      alert("Download error: " + err.message);
    }
  };

  const openDetailModal = async (regId) => {
    try {
      const res = await filesApi.getDetail(regId);
      setSelectedFileDetail(res);
    } catch (err) {
      alert("Could not load provenance metadata: " + err.message);
    }
  };

  const openEditModal = (file) => {
    setEditingFile(file);
    setNewPrivacy(file.privacy_level);
    setNewTags(file.tags || "");
    setNewDesc(file.description || "");
  };

  const handleUpdateFile = async (e) => {
    e.preventDefault();
    if (!editingFile) return;
    try {
      setActionLoading(true);
      await filesApi.update(editingFile.registration_id, {
        privacy_level: newPrivacy,
        tags: newTags,
        description: newDesc
      });
      setEditingFile(null);
      await loadFiles();
    } catch (err) {
      alert("Update failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.original_filename.toLowerCase().includes(q) ||
      f.registration_id.toLowerCase().includes(q) ||
      (f.tags && f.tags.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <FolderLock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Asset Portfolio</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            My Registered Assets & Provenance
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your registered files, adjust zero-knowledge disclosure settings, and inspect RSA-PSS signatures.
          </p>
        </div>

        <button
          onClick={() => setActiveTab("register-file")}
          className="rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 shrink-0"
        >
          + Register New Asset
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#0E1726]/90 p-3">
        <Search className="h-4 w-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by filename, registration ID, or tags..."
          className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-slate-400 hover:text-white text-xs mr-2">
            Clear
          </button>
        )}
      </div>

      {/* Assets Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 overflow-hidden shadow-md">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
            <p>Loading registered assets...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <FolderLock className="mx-auto h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No assets registered yet</p>
            <p className="max-w-md mx-auto text-slate-500">
              Files you register will appear here along with their cryptographic signatures and privacy controls.
            </p>
            <button
              onClick={() => setActiveTab("register-file")}
              className="mt-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
            >
              Register First Asset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Registration ID</th>
                  <th className="py-3 px-4">SHA-256 Digest</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Privacy Level</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span className="truncate max-w-[180px]" title={file.original_filename}>
                        {file.original_filename}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-cyan-300">
                      {file.registration_id}
                    </td>
                    <td className="py-3 px-4">
                      <HashDisplay hash={file.file_hash} truncate={true} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {(file.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PrivacyBadge level={file.privacy_level} size="sm" />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {/* Verify button */}
                      <button
                        onClick={() => {
                          if (onSelectFileForVerify) onSelectFileForVerify(file.registration_id);
                          setActiveTab("verify");
                        }}
                        title="Verify against this registration"
                        className="rounded p-1.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40"
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                      </button>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(file.registration_id, file.original_filename)}
                        title="Secure download"
                        className="rounded p-1.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {/* View Details */}
                      <button
                        onClick={() => openDetailModal(file.registration_id)}
                        title="View Provenance Payload & Signature"
                        className="rounded p-1.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {/* Edit Privacy */}
                      <button
                        onClick={() => openEditModal(file)}
                        title="Change Privacy Settings"
                        className="rounded p-1.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-purple-400 hover:border-purple-500/40"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provenance Detail Modal */}
      {selectedFileDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-w-2xl w-full rounded-2xl border border-cyan-500/30 bg-[#0E1726] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Provenance Certificate Details</h3>
              </div>
              <button
                onClick={() => setSelectedFileDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Registration ID:</span>
                  <span className="font-mono text-cyan-300 font-bold">{selectedFileDetail.registration_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Original Filename:</span>
                  <span className="font-mono text-white">{selectedFileDetail.original_filename}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Owner:</span>
                  <span className="text-slate-300">{selectedFileDetail.owner_username}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Privacy Tier:</span>
                  <PrivacyBadge level={selectedFileDetail.privacy_level} size="sm" />
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">SHA-256 Bitstream Hash:</span>
                <HashDisplay hash={selectedFileDetail.file_hash} truncate={false} />
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">
                  Canonical Provenance JSON Payload (Signed):
                </span>
                <div className="rounded bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
                  <pre>{selectedFileDetail.canonical_payload}</pre>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">
                  RSA-PSS Digital Signature (Base64):
                </span>
                <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-cyan-300 break-all border border-slate-800 select-all max-h-24 overflow-y-auto">
                  {selectedFileDetail.rsa_signature}
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                Signing Public Key Fingerprint: <span className="font-mono text-slate-400">{selectedFileDetail.public_key_fingerprint}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedFileDetail(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Privacy & Metadata Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleUpdateFile}
            className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#0E1726] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Adjust Asset Disclosure & Privacy</h3>
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Privacy Level
                </label>
                <select
                  value={newPrivacy}
                  onChange={(e) => setNewPrivacy(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="PRIVATE">PRIVATE (Only Owner can verify/view)</option>
                  <option value="VERIFY_ONLY">VERIFY_ONLY (Public can verify; name & owner REDACTED)</option>
                  <option value="PUBLIC">PUBLIC (Full metadata publicly verifiable)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tags
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
