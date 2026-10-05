function normalizeBase(base) {
  return String(base ?? "").replace(/\/+$/, "");
}

function apiUrl(base, endpoint) {
  const normalizedBase = normalizeBase(base);
  const versionedBase = normalizedBase.endsWith("/api")
    ? `${normalizedBase}/v1`
    : normalizedBase;
  return `${versionedBase}${endpoint}`;
}

function encodeFilePath(path) {
  return String(path ?? "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function apiRequest(base, route, options = {}, token, allowNotFound = false) {
  const url = apiUrl(base, route.startsWith("/") ? route : `/${route}`);
  const headers = {
    ...(options.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      detail = payload?.error ?? payload?.message ?? detail;
    } catch {
      try {
        detail = await response.text();
      } catch {
        detail = response.statusText || detail;
      }
    }
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response;
}

export async function login(apiBase, username, password) {
  const response = await fetch(apiUrl(apiBase, "/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let message = "Login failed";
    try {
      const payload = await response.json();
      message = payload?.error ?? payload?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const payload = await response.json();
  if (typeof payload.token !== "string" || !payload.token) {
    throw new Error("The server did not return a login token.");
  }
  return payload;
}

export async function listFiles(apiBase, token) {
  const response = await apiRequest(apiBase, "/files", { method: "GET" }, token);
  const payload = await response.json();
  if (
    !Array.isArray(payload.files) ||
    !payload.files.every((path) => typeof path === "string")
  ) {
    throw new Error("The server returned an invalid file listing.");
  }
  return payload.files;
}

export async function readFile(apiBase, token, path) {
  const response = await apiRequest(
    apiBase,
    `/files/${encodeFilePath(path)}`,
    { method: "GET" },
    token,
    true,
  );
  if (response.status === 404) {
    return { content: "", etag: null, exists: false };
  }
  return {
    content: await response.text(),
    etag: response.headers.get("ETag"),
    exists: true,
  };
}

export async function writeFile(apiBase, token, path, content, ifMatch) {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
  };

  if (ifMatch) {
    headers["If-Match"] = ifMatch;
  }

  const response = await apiRequest(
    apiBase,
    `/files/${encodeFilePath(path)}`,
    {
      method: "PUT",
      headers,
      body: content,
    },
    token,
  );

  const payload = await response.json();
  return {
    version: payload.version,
    etag: payload.etag,
    updatedAt: new Date().toISOString(),
  };
}
