import React, { useState } from "react";
import { LogIn, ShieldCheck, AlertCircle, KeyRound, User, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login({ setActiveTab }) {
  const { login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError("Please fill in both fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(usernameOrEmail, password);
      setActiveTab("dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (uname, pwd) => {
    setUsernameOrEmail(uname);
    setPassword(pwd);
  };

  return (
    <div className="max-w-md mx-auto my-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 glow-cyan">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Sign In to Provenance Console</h1>
        <p className="text-xs text-slate-400">
          Enter your credentials to manage registered assets and sign provenance records.
        </p>
      </div>

      {/* Demo Credentials Quick-Select Card */}
      <div className="rounded-xl border border-cyan-500/30 bg-[#0C192E] p-4 text-xs space-y-2.5">
        <span className="text-cyan-300 font-bold block uppercase tracking-wider text-[10px]">
          Demo Quick-Fill Accounts:
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("admin", "AdminPass123!")}
            className="rounded-lg border border-slate-700 bg-slate-900/90 py-1.5 px-2 text-left hover:border-cyan-500/50 hover:bg-slate-800 transition"
          >
            <div className="font-bold text-white text-[11px]">admin</div>
            <div className="text-[10px] text-purple-400">System Admin</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("alice", "AlicePass123!")}
            className="rounded-lg border border-slate-700 bg-slate-900/90 py-1.5 px-2 text-left hover:border-cyan-500/50 hover:bg-slate-800 transition"
          >
            <div className="font-bold text-white text-[11px]">alice</div>
            <div className="text-[10px] text-cyan-400">User (Whitepapers)</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("bob", "BobPass123!")}
            className="rounded-lg border border-slate-700 bg-slate-900/90 py-1.5 px-2 text-left hover:border-cyan-500/50 hover:bg-slate-800 transition"
          >
            <div className="font-bold text-white text-[11px]">bob</div>
            <div className="text-[10px] text-emerald-400">User (Policies)</div>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-[#0E1726]/90 p-6 sm:p-8 space-y-4 shadow-xl">
        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Username or Email Address
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="e.g. admin or alice@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
          <span>{loading ? "Authenticating..." : "Sign In"}</span>
        </button>

        <div className="text-center pt-2 border-t border-slate-800/80">
          <p className="text-xs text-slate-400">
            Don't have an account yet?{" "}
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className="font-semibold text-cyan-400 hover:underline"
            >
              Register here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
