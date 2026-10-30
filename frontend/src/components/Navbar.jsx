import React from "react";
import { useAuth } from "../context/AuthContext";
import { 
  ShieldCheck, 
  FileCheck, 
  Upload, 
  FolderLock, 
  History, 
  ShieldAlert, 
  LogOut, 
  LogIn, 
  UserPlus, 
  User 
} from "lucide-react";

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: ShieldCheck },
    { id: "verify", label: "Verify Integrity", icon: FileCheck },
    { id: "register-file", label: "Register Asset", icon: Upload, authRequired: true },
    { id: "my-files", label: "My Assets", icon: FolderLock, authRequired: true },
    { id: "audit", label: "Audit Ledger", icon: History },
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: "Admin Console", icon: ShieldAlert });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-950/60 bg-[#0B1120]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        
        {/* Brand */}
        <div 
          onClick={() => setActiveTab("dashboard")} 
          className="flex cursor-pointer items-center space-x-3 transition-opacity hover:opacity-90"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="h-6 w-6 text-white" />
            <div className="absolute -inset-0.5 rounded-xl bg-cyan-400 opacity-20 blur"></div>
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center space-x-2">
              <span>TRUST, PRIVACY & PROVENANCE</span>
              <span className="hidden sm:inline-block rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/30">
                PROV-SEC
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Privacy-Preserving Digital Provenance & Tamper-Evident Ledger
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            // If tab requires auth and user is logged out, clicking it opens login
            const handleClick = () => {
              if (item.authRequired && !isAuthenticated) {
                setActiveTab("login");
              } else {
                setActiveTab(item.id);
              }
            };

            return (
              <button
                key={item.id}
                onClick={handleClick}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Session Area */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 flex items-center justify-end space-x-1">
                  <User className="h-3.5 w-3.5 text-cyan-400 inline" />
                  <span>{user.username}</span>
                </span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-400">
                  {user.role === "admin" ? "🛡️ System Admin" : "🔑 Registered User"}
                </span>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === "login"
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex items-center space-x-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500 hover:text-slate-950`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-800 px-2 py-1.5 space-x-1 scrollbar-none bg-[#090E1A]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.authRequired && !isAuthenticated) {
                  setActiveTab("login");
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={`flex shrink-0 items-center space-x-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                isActive ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
