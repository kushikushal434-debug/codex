import React from "react";
import { Shield, Lock, FileCode, CheckCircle, Scale } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-[#070D19] py-8 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span>TRUST, PRIVACY & DIGITAL PROVENANCE</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Final-year computer science & cybersecurity project. Implements cryptographic file registration, SHA-256 integrity verification, RSA-PSS 2048 non-repudiation, privacy-preserving disclosure tiers, and tamper-evident hash-chained audit trails.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Security Architecture
            </h4>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3.5 w-3.5 text-cyan-400" />
                <span>SHA-256 Bitstream Streaming Digest</span>
              </li>
              <li className="flex items-center space-x-2">
                <Lock className="h-3.5 w-3.5 text-cyan-400" />
                <span>RSA-PSS Digital Provenance Signatures</span>
              </li>
              <li className="flex items-center space-x-2">
                <FileCode className="h-3.5 w-3.5 text-cyan-400" />
                <span>Sequential Hash-Chained Audit Ledger</span>
              </li>
              <li className="flex items-center space-x-2">
                <Scale className="h-3.5 w-3.5 text-cyan-400" />
                <span>Zero-Knowledge / Redacted Verification Tiers</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Academic & Security Clarification
            </h4>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed border-l-2 border-cyan-500/40 pl-3 italic">
              "A cryptographic hash match mathematically proves bit-level consistency with a previously recorded reference state. It does not attest to the real-world factual truth of the underlying document."
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800/60 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <span>Final Year Project Demo • Local Development Environment</span>
          <span className="mt-2 sm:mt-0 font-mono text-[11px] text-cyan-500/80">
            SHA256 • RSA-PSS • SQLite • Flask • React
          </span>
        </div>
      </div>
    </footer>
  );
}
