import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function HashDisplay({ hash, truncate = true, label = null }) {
  const [copied, setCopied] = useState(false);

  if (!hash) return <span className="text-slate-500 font-mono text-xs">N/A</span>;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayText = truncate && hash.length > 20
    ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
    : hash;

  return (
    <div className="inline-flex items-center space-x-1.5 font-mono text-xs text-slate-300">
      {label && <span className="text-slate-400 font-sans text-xs">{label}:</span>}
      <code className="rounded bg-slate-900/90 px-1.5 py-0.5 text-cyan-300 border border-slate-700/60 select-all">
        {displayText}
      </code>
      <button
        onClick={handleCopy}
        title="Copy full hash digest"
        className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-400"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
