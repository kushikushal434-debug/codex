// Modern fetch-based API service with automatic CSRF management and cookie credentials

let inMemoryCsrfToken = null;

export const setCsrfToken = (token) => {
  inMemoryCsrfToken = token;
  if (token) {
    sessionStorage.setItem("tpdp_csrf", token);
  } else {
    sessionStorage.removeItem("tpdp_csrf");
  }
};

export const getStoredCsrfToken = () => {
  return inMemoryCsrfToken || sessionStorage.getItem("tpdp_csrf") || "";
};

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `/api${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const headers = new Headers(options.headers || {});

  // For state-changing methods, attach CSRF token if present
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = getStoredCsrfToken();
    if (token) {
      headers.set("X-CSRF-Token", token);
    }
  }

  // Set default JSON content-type if body is JSON string
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include" // Send and receive session cookies
  });

  // Handle file blob downloads
  if (options.responseType === "blob") {
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Download failed with HTTP ${response.status}`);
    }
    return response.blob();
  }

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const msg = (data && data.error) || (typeof data === "string" ? data : `Request failed with status ${response.status}`);
    const err = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  // Update CSRF token if returned in response
  if (data && data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }

  return data;
}

export const authApi = {
  fetchCsrf: async () => {
    const res = await request("/auth/csrf-token");
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res.csrf_token;
  },
  login: async (username_or_email, password) => {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username_or_email, password })
    });
  },
  register: async (username, email, password) => {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    });
  },
  logout: async () => {
    const res = await request("/auth/logout", { method: "POST" });
    setCsrfToken(null);
    return res;
  },
  getMe: async () => {
    return request("/auth/me");
  }
};

export const filesApi = {
  register: async (formData) => {
    return request("/files/register", {
      method: "POST",
      body: formData
    });
  },
  list: async (all = false) => {
    return request(`/files${all ? "?all=true" : ""}`);
  },
  getDetail: async (registrationId) => {
    return request(`/files/${registrationId}`);
  },
  update: async (registrationId, payload) => {
    return request(`/files/${registrationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  download: async (registrationId, filename) => {
    const blob = await request(`/files/${registrationId}/download`, { responseType: "blob" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "downloaded_file.bin";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
};

export const verifyApi = {
  verify: async (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return request("/verify", {
        method: "POST",
        body: formDataOrJson
      });
    }
    return request("/verify", {
      method: "POST",
      body: JSON.stringify(formDataOrJson)
    });
  },
  getHistory: async (registrationId) => {
    return request(`/verify/${registrationId}/history`);
  },
  getPublicKey: async () => {
    return request("/provenance/public-key");
  }
};

export const auditApi = {
  getLogs: async (limit = 50, offset = 0) => {
    return request(`/audit/logs?limit=${limit}&offset=${offset}`);
  },
  verifyChain: async () => {
    return request("/audit/verify-chain", { method: "POST" });
  },
  getCheckpoints: async () => {
    return request("/audit/checkpoints");
  },
  createCheckpoint: async () => {
    return request("/audit/checkpoint", { method: "POST" });
  },
  verifyCheckpoint: async (checkpointId) => {
    return request(`/audit/checkpoint/${checkpointId}/verify`, { method: "POST" });
  },
  simulateTamper: async (blockIndex) => {
    return request("/audit/simulate-tamper", {
      method: "POST",
      body: JSON.stringify({ block_index: blockIndex, action: "tamper" })
    });
  }
};

export const adminApi = {
  getStats: async () => {
    return request("/admin/stats");
  },
  getUsers: async () => {
    return request("/admin/users");
  },
  updateUserRole: async (userId, role) => {
    return request(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role })
    });
  }
};

export const certificateApi = {
  getIssuerKeys: async () => {
    return request("/certificates/issuer/keys");
  },
  generateIssuerKeys: async () => {
    return request("/certificates/issuer/generate-keys", { method: "POST" });
  },
  issueCertificate: async (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return request("/certificates/issuer/issue", {
        method: "POST",
        body: formDataOrJson
      });
    }
    return request("/certificates/issuer/issue", {
      method: "POST",
      body: JSON.stringify(formDataOrJson)
    });
  },
  getIssuedCertificates: async () => {
    return request("/certificates/issuer/certificates");
  },
  revokeCertificate: async (certificateId, reason) => {
    return request("/certificates/issuer/revoke", {
      method: "POST",
      body: JSON.stringify({ certificate_id: certificateId, reason })
    });
  },
  getRevocationList: async () => {
    return request("/certificates/issuer/revocation-list");
  },
  generateNonce: async (verifierLabel = "Online Verifier") => {
    return request("/certificates/verifier/nonce", {
      method: "POST",
      body: JSON.stringify({ verifier_label: verifierLabel })
    });
  },
  createPresentation: async (credentialPackage, disclosedKeys, nonce) => {
    return request("/certificates/holder/present", {
      method: "POST",
      body: JSON.stringify({
        credential_package: credentialPackage,
        disclosed_keys: disclosedKeys,
        nonce
      })
    });
  },
  verifyPresentation: async (presentation, trustedIssuerPubkey = null, revocationList = null) => {
    return request("/certificates/verifier/verify", {
      method: "POST",
      body: JSON.stringify({
        presentation,
        trusted_issuer_pubkey: trustedIssuerPubkey,
        revocation_list: revocationList
      })
    });
  },
  inspectFile: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/certificates/inspect-file", {
      method: "POST",
      body: fd
    });
  }
};
