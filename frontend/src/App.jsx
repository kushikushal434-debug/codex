import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CertificateVerification from "./pages/CertificateVerification";
import Dashboard from "./pages/Dashboard";
import RegisterFile from "./pages/RegisterFile";
import VerifyFile from "./pages/VerifyFile";
import MyFiles from "./pages/MyFiles";
import AuditTrail from "./pages/AuditTrail";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";

function MainApp() {
  const [activeTab, setActiveTab] = useState("certificates");
  const [selectedRegIdForVerify, setSelectedRegIdForVerify] = useState("");
  const { user, isAuthenticated, isAdmin } = useAuth();

  const handleSelectFileForVerify = (regId) => {
    setSelectedRegIdForVerify(regId);
    setActiveTab("verify");
  };

  return (
    <div className="min-h-screen bg-[#070D19] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "certificates" && (
          <CertificateVerification />
        )}

        {activeTab === "dashboard" && (
          <Dashboard
            setActiveTab={setActiveTab}
            onSelectVerificationId={handleSelectFileForVerify}
          />
        )}

        {activeTab === "register-file" && (
          <RegisterFile
            setActiveTab={setActiveTab}
            onRegistrationComplete={(res) => { }}
          />
        )}

        {activeTab === "verify" && (
          <VerifyFile
            prefilledRegId={selectedRegIdForVerify}
          />
        )}

        {activeTab === "my-files" && (
          <MyFiles
            setActiveTab={setActiveTab}
            onSelectFileForVerify={handleSelectFileForVerify}
          />
        )}

        {activeTab === "audit" && (
          <AuditTrail />
        )}

        {activeTab === "admin" && isAdmin && (
          <AdminDashboard
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "login" && (
          <Login
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "register" && (
          <Register
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
