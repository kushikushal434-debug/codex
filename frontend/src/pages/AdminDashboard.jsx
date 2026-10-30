import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Users, 
  HardDrive, 
  Files, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  UserCheck, 
  ShieldCheck, 
  RefreshCw,
  FolderLock
} from "lucide-react";
import { adminApi, filesApi } from "../services/api";
import { PrivacyBadge } from "../components/StatusBadges";
import HashDisplay from "../components/HashDisplay";

export default function AdminDashboard({ setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [sRes, uRes, fRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers(),
        filesApi.list(true) // all files
      ]);

      setStats(sRes);
      setUsers(uRes.users || []);
      setAllFiles(fRes.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Are you sure you want to change user role to '${newRole}'?`)) return;

    try {
      setUpdatingUserId(userId);
      await adminApi.updateUserRole(userId, newRole);
      await loadAdminData();
    } catch (err) {
      alert("Role update error: " + err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
            <span>Role-Based Access Control (RBAC)</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            System Administration & Security Console
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor system storage, manage users & roles, inspect global provenance records, and oversee cryptographic audit integrity.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          disabled={loading}
          className="inline-flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Console</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Users</span>
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-white">{stats.total_users}</p>
            <span className="text-xs text-slate-500">Registered platform accounts</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">System Files</span>
              <Files className="h-5 w-5 text-blue-400" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-white">{stats.total_files}</p>
            <span className="text-xs text-slate-500">Across all registered owners</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Verifications Ratio</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-xl font-extrabold text-emerald-400">{stats.verifications_breakdown?.MATCH || 0} Match</span>
              <span className="text-slate-500">/</span>
              <span className="text-sm font-bold text-rose-400">{stats.verifications_breakdown?.MODIFIED || 0} Mod</span>
            </div>
            <span className="text-xs text-slate-500">{stats.total_verifications} Total Queries Executed</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0E1726]/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Storage Used</span>
              <HardDrive className="h-5 w-5 text-purple-400" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-white">
              {(stats.storage_bytes_used / 1024).toFixed(1)} KB
            </p>
            <span className="text-xs text-slate-500">In isolated storage directory</span>
          </div>
        </div>
      )}

      {/* User Management Section */}
      <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 space-y-4 shadow-md">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <Users className="h-5 w-5 text-cyan-400" />
          <span>User Role & Access Management</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60">
              <tr>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Assets Owned</th>
                <th className="py-2.5 px-3">Joined</th>
                <th className="py-2.5 px-3 text-right">Role Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {u.username}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {u.email}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      u.role === "admin"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-cyan-300">
                    {u.files_count}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleRoleChange(u.id, u.role)}
                      disabled={updatingUserId === u.id}
                      className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-50"
                    >
                      {u.role === "admin" ? "Demote to User" : "Promote to Admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Assets Registry (Admin View) */}
      <div className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 space-y-4 shadow-md">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <FolderLock className="h-5 w-5 text-cyan-400" />
          <span>Global Registered Assets Registry ({allFiles.length})</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60">
              <tr>
                <th className="py-2.5 px-3">Filename</th>
                <th className="py-2.5 px-3">Registration ID</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3">SHA-256 Digest</th>
                <th className="py-2.5 px-3">Privacy Level</th>
                <th className="py-2.5 px-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {file.original_filename}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-cyan-300 text-[11px]">
                    {file.registration_id}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {file.owner_username}
                  </td>
                  <td className="py-2.5 px-3">
                    <HashDisplay hash={file.file_hash} truncate={true} />
                  </td>
                  <td className="py-2.5 px-3">
                    <PrivacyBadge level={file.privacy_level} size="sm" />
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(file.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
