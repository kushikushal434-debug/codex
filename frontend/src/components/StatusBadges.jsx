import React from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, Lock, Eye, Globe } from "lucide-react";

export function ResultBadge({ result, size = "md" }) {
  const isSm = size === "sm";
  const baseClasses = isSm 
    ? "inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold font-mono tracking-wide"
    : "inline-flex items-center space-x-1.5 px-3 py-1 rounded-md text-sm font-bold font-mono tracking-wider";

  if (result === "MATCH") {
    return (
      <span className={`${baseClasses} bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 glow-emerald`}>
        <CheckCircle2 className={isSm ? "h-3.5 w-3.5 text-emerald-400" : "h-4 w-4 text-emerald-400"} />
        <span>MATCH</span>
      </span>
    );
  }

  if (result === "MODIFIED") {
    return (
      <span className={`${baseClasses} bg-rose-500/15 text-rose-400 border border-rose-500/40 glow-rose`}>
        <AlertTriangle className={isSm ? "h-3.5 w-3.5 text-rose-400" : "h-4 w-4 text-rose-400"} />
        <span>MODIFIED</span>
      </span>
    );
  }

  return (
    <span className={`${baseClasses} bg-slate-500/15 text-slate-300 border border-slate-500/40`}>
      <HelpCircle className={isSm ? "h-3.5 w-3.5 text-slate-400" : "h-4 w-4 text-slate-400"} />
      <span>UNKNOWN</span>
    </span>
  );
}

export function PrivacyBadge({ level, size = "sm" }) {
  const isSm = size === "sm";
  const base = isSm 
    ? "inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold"
    : "inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold";

  if (level === "PRIVATE") {
    return (
      <span className={`${base} bg-purple-500/15 text-purple-300 border border-purple-500/30`}>
        <Lock className="h-3 w-3 text-purple-400" />
        <span>Private (Owner Only)</span>
      </span>
    );
  }

  if (level === "VERIFY_ONLY") {
    return (
      <span className={`${base} bg-cyan-500/15 text-cyan-300 border border-cyan-500/30`}>
        <Eye className="h-3 w-3 text-cyan-400" />
        <span>Verify-Only (Redacted)</span>
      </span>
    );
  }

  return (
    <span className={`${base} bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`}>
      <Globe className="h-3 w-3 text-emerald-400" />
      <span>Public Provenance</span>
    </span>
  );
}
