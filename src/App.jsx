import { useEffect, useMemo, useState } from "preact/hooks";
import {
  DEFAULT_BUDGET_CONTENT,
  formatCurrency,
  parseBudgetDocument,
  summarizeBudget,
  todayIso,
} from "./budgetTxt.js";
import { listFiles, login, readFile, writeFile } from "./server.js";

const DOCS_KEY = "budget.txt-web.documents";
const SETTINGS_KEY = "budget.txt-web.settings";
const LAST_LIST_KEY = "budget.txt-web.last-list";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultSettings() {
  return {
    apiBase: "http://127.0.0.1:3000/api/v1",
    username: "",
    password: "",
    token: "",
    knownFiles: [],
  };
}

function defaultDocuments() {
  return { "local:budget.txt": DEFAULT_BUDGET_CONTENT };
}

function buildLocalKey(name) {
  return `local:${String(name).trim()}`;
}

function getCurrentText(documents, key) {
  if (documents[key]) return documents[key];
  if (key.startsWith("local:")) return DEFAULT_BUDGET_CONTENT;
  return "";
}

function getListLabel(key) {
  if (key.startsWith("local:")) return key.slice("local:".length);
  return key.replace(/^server:/, "");
}

export default function App() {
  const [documents, setDocuments] = useState(() =>
    readStorage(DOCS_KEY, defaultDocuments()),
  );
  const [serverSettings, setServerSettings] = useState(() =>
    readStorage(SETTINGS_KEY, defaultSettings()),
  );
  const [currentKey, setCurrentKey] = useState(() =>
    readStorage(LAST_LIST_KEY, "local:budget.txt"),
  );
  const [panelMode, setPanelMode] = useState("none");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Local mode is active. Your file lives in this browser until you connect to a server.",
  );
  const [remotePath, setRemotePath] = useState("household/budget.txt");
  const [newLocalName, setNewLocalName] = useState("budget-2.txt");
  const [newEnvelopeName, setNewEnvelopeName] = useState("groceries");
  const [newEnvelopeBudget, setNewEnvelopeBudget] = useState("500");
  const [txType, setTxType] = useState("allocate");
  const [txAmount, setTxAmount] = useState("100");
  const [txEnvelope, setTxEnvelope] = useState("groceries");
  const [txTargetEnvelope, setTxTargetEnvelope] = useState("dining");
  const [rawMode, setRawMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const currentText = getCurrentText(documents, currentKey);
  const records = useMemo(() => parseBudgetDocument(currentText), [currentText]);
  const summary = useMemo(() => summarizeBudget(currentText), [currentText]);
  const localFiles = Object.keys(documents)
    .filter((key) => key.startsWith("local:"))
    .sort();
  const remoteFiles = (serverSettings.knownFiles || []).slice().sort();
  const currentName = getListLabel(currentKey);
  const envelopeNames = summary.envelopes.map((entry) => entry.name);

  useEffect(() => {
    saveStorage(DOCS_KEY, documents);
  }, [documents]);

  useEffect(() => {
    saveStorage(SETTINGS_KEY, serverSettings);
  }, [serverSettings]);

  useEffect(() => {
    saveStorage(LAST_LIST_KEY, currentKey);
  }, [currentKey]);

  useEffect(() => {
    if (serverSettings.token) {
      void refreshServerFiles();
    }
  }, [serverSettings.token]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function updateCurrentDocument(nextText) {
    setDocuments((prev) => ({ ...prev, [currentKey]: nextText }));
  }

  function switchToLocal(name) {
    const key = buildLocalKey(name);
    setCurrentKey(key);
    setNotice(`Opened local file ${name}.`);
  }

  function createLocalFile() {
    const name = newLocalName.trim();
    if (!name) {
      setNotice("Choose a local file name first.");
      return;
    }

    const key = buildLocalKey(name);
    if (documents[key]) {
      setCurrentKey(key);
      setNotice(`Switched to existing local file ${name}.`);
      return;
    }

    setDocuments((prev) => ({ ...prev, [key]: DEFAULT_BUDGET_CONTENT }));
    setCurrentKey(key);
    setNewLocalName("");
    setNotice(`Created local file ${name}.`);
  }

  async function refreshServerFiles(token = serverSettings.token, apiBase = serverSettings.apiBase) {
    if (!token) return false;
    try {
      const files = await listFiles(apiBase, token);
      setServerSettings((prev) => ({ ...prev, knownFiles: files }));
      return true;
    } catch (error) {
      setNotice(error.message || "Could not refresh the file list.");
      return false;
    }
  }

  async function handleLogin() {
    setBusy(true);
    try {
      const result = await login(
        serverSettings.apiBase,
        serverSettings.username,
        serverSettings.password || "",
      );
      const token = result.token;
      setServerSettings((prev) => ({
        ...prev,
        token,
      }));
      const filesLoaded = await refreshServerFiles(token, serverSettings.apiBase);
      setNotice(
        filesLoaded
          ? "Connected to Plain File Server."
          : "Connected to Plain File Server, but could not load the file list.",
      );
    } catch (error) {
      setNotice(error.message || "Could not sign in to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function openRemoteFile(path) {
    if (!serverSettings.token) {
      setNotice("Log in before opening a remote file.");
      return;
    }

    setBusy(true);
    try {
      const result = await readFile(
        serverSettings.apiBase,
        serverSettings.token,
        path,
      );
      const key = `server:${path}`;
      setDocuments((prev) => ({ ...prev, [key]: result.content }));
      setCurrentKey(key);
      setRemotePath(path);
      setNotice(
        result.exists
          ? `Loaded remote file ${path}.`
          : `Opened new remote file ${path}. Save it to create it on the server.`,
      );
    } catch (error) {
      setNotice(error.message || `Could not read ${path}.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveRemoteFile() {
    if (!serverSettings.token) {
      setNotice("Log in before saving a remote file.");
      return;
    }

    setBusy(true);
    try {
      await writeFile(
        serverSettings.apiBase,
        serverSettings.token,
        remotePath,
        currentText,
      );
      setNotice(`Saved remote file ${remotePath}.`);
    } catch (error) {
      setNotice(error.message || `Could not save ${remotePath}.`);
    } finally {
      setBusy(false);
    }
  }

  function addEnvelope() {
    const name = newEnvelopeName.trim();
    if (!name) {
      setNotice("Choose an envelope name first.");
      return;
    }

    const entryValue = Number(newEnvelopeBudget || 0);
    const nextText = `${currentText.trim()}\n${todayIso()} envelope ${name} budget=${entryValue}\n`;
    updateCurrentDocument(nextText);
    setNewEnvelopeName("");
    setNewEnvelopeBudget("500");
    setNotice(`Added the ${name} envelope.`);
  }

  function addTransaction() {
    const amount = Number(txAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Use a positive amount for this transaction.");
      return;
    }

    const date = todayIso();
    const sourceEnvelope = txEnvelope || "groceries";
    let line = "";
    if (txType === "move") {
      if (!txTargetEnvelope.trim()) {
        setNotice("Choose a destination envelope for the move.");
        return;
      }
      line = `${date} move ${amount} ${sourceEnvelope} ${txTargetEnvelope}`;
    } else {
      line = `${date} ${txType} ${amount} ${sourceEnvelope}`;
    }

    const nextText = `${currentText.trim()}\n${line}\n`;
    updateCurrentDocument(nextText);
    setNotice(`${txType} added for ${sourceEnvelope}.`);
  }

  function renderFilesPanel() {
    return (
      <section class="panel floating-panel">
        <div class="panel-header">
          <h2>Files</h2>
          <button type="button" class="button button-quiet" onClick={() => setPanelMode("none")}>Close</button>
        </div>

        <div class="panel-stack">
          <label>
            New local file
            <div class="inline-row compact">
              <input value={newLocalName} onInput={(event) => setNewLocalName(event.target.value)} />
              <button type="button" class="button button-primary" onClick={createLocalFile}>Create</button>
            </div>
          </label>

          <div>
            <h3>Local files</h3>
            <div class="button-list">
              {localFiles.length === 0 ? <p class="muted-text">No local files</p> : null}
              {localFiles.map((key) => {
                const name = key.replace(/^local:/, "");
                return (
                  <button
                    key={key}
                    type="button"
                    class={currentKey === key ? "tab active" : "tab"}
                    onClick={() => switchToLocal(name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3>Server files</h3>
            <label>
              Open or create a remote budget file
              <div class="inline-row compact">
                <input
                  value={remotePath}
                  onInput={(event) => setRemotePath(event.target.value)}
                  placeholder="household/budget.txt"
                />
                <button
                  type="button"
                  class="button button-primary"
                  onClick={() => openRemoteFile(remotePath)}
                  disabled={!serverSettings.token || busy}
                >
                  Open
                </button>
              </div>
            </label>
            <div class="button-list">
              {remoteFiles.length === 0 ? (
                <p class="muted-text">Log in to load server files.</p>
              ) : null}
              {remoteFiles.map((path) => (
                <button
                  key={`server:${path}`}
                  type="button"
                  class={currentKey === `server:${path}` ? "tab active" : "tab"}
                  onClick={() => openRemoteFile(path)}
                >
                  {path}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderSettingsPanel() {
    return (
      <section class="panel floating-panel">
        <div class="panel-header">
          <h2>Settings</h2>
          <button type="button" class="button button-quiet" onClick={() => setPanelMode("none")}>Close</button>
        </div>

        <div class="panel-stack">
          <label>
            Server URL
            <input
              value={serverSettings.apiBase}
              onInput={(event) =>
                setServerSettings((prev) => ({ ...prev, apiBase: event.target.value }))
              }
            />
          </label>

          <label>
            Username
            <input
              value={serverSettings.username}
              onInput={(event) =>
                setServerSettings((prev) => ({ ...prev, username: event.target.value }))
              }
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={serverSettings.password || ""}
              onInput={(event) =>
                setServerSettings((prev) => ({ ...prev, password: event.target.value }))
              }
            />
          </label>

          <div class="inline-row compact">
            <button type="button" class="button button-primary" disabled={busy} onClick={handleLogin}>
              {serverSettings.token ? "Reconnect" : "Log in"}
            </button>
            <button type="button" class="button button-secondary" onClick={refreshServerFiles} disabled={!serverSettings.token || busy}>
              Refresh
            </button>
          </div>

          <label>
            Remote path
            <input value={remotePath} onInput={(event) => setRemotePath(event.target.value)} />
          </label>

          <div class="inline-row compact">
            <button type="button" class="button button-secondary" onClick={() => openRemoteFile(remotePath)} disabled={!serverSettings.token || busy}>
              Open remote
            </button>
            <button type="button" class="button button-secondary" onClick={saveRemoteFile} disabled={!serverSettings.token || busy}>
              Save remote
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div class="shell">
      <header class="topbar">
        <div class="wordmark">
          <span class="brand-mark">b</span>
          <span>budget.txt</span>
        </div>

        <div class="top-actions">
          <div class={`status-pill ${serverSettings.token ? "server" : "local"}`}>
            <span class={`status-dot ${isOnline ? "online" : "offline"}`} />
            {serverSettings.token ? "Connected" : "Local only"}
          </div>
          <button
            type="button"
            class="button button-secondary"
            onClick={() => setPanelMode((value) => (value === "files" ? "none" : "files"))}
          >
            Files
          </button>
          <button
            type="button"
            class="button button-secondary"
            onClick={() => setPanelMode((value) => (value === "settings" ? "none" : "settings"))}
          >
            Settings
          </button>
        </div>
      </header>

      {panelMode === "files" && renderFilesPanel()}
      {panelMode === "settings" && renderSettingsPanel()}

      <div class="workspace">
        <aside class="sidebar panel">
          <div class="sidebar-header">
            <p class="eyebrow">Current file</p>
            <div class="current-file">
              <span class="file-badge">{currentName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{currentName}</strong>
                <small>{serverSettings.token && currentKey.startsWith("server:") ? "Server copy" : "Local copy"}</small>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <p class="eyebrow">Files</p>
            <div class="button-list stack-list">
              {localFiles.map((key) => {
                const name = key.replace(/^local:/, "");
                return (
                  <button
                    key={key}
                    type="button"
                    class={currentKey === key ? "list-item active" : "list-item"}
                    onClick={() => switchToLocal(name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div class="sidebar-section">
            <p class="eyebrow">Server</p>
            <div class="button-list stack-list">
              {remoteFiles.length === 0 ? <p class="muted-text">No server files</p> : null}
              {remoteFiles.map((path) => (
                <button
                  key={`server:${path}`}
                  type="button"
                  class={currentKey === `server:${path}` ? "list-item active" : "list-item"}
                  onClick={() => openRemoteFile(path)}
                >
                  {path}
                </button>
              ))}
            </div>
          </div>

          <div class="sidebar-section">
            <p class="eyebrow">Status</p>
            <div class="status-box">
              <div class="status-row">
                <span class={`status-dot ${isOnline ? "online" : "offline"}`} />
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>
              <div class="status-row muted-row">
                <span class="status-dot server" />
                <span>{serverSettings.token ? "Server authenticated" : "Local mode only"}</span>
              </div>
            </div>
          </div>
        </aside>

        <section class="main-panel panel">
          <div class="summary-grid">
            <div className="summary-card">
              <span>Total budget</span>
              <strong>{formatCurrency(summary.totalBudget)}</strong>
            </div>
            <div className="summary-card">
              <span>Total available</span>
              <strong>{formatCurrency(summary.totalAvailable)}</strong>
            </div>
            <div className="summary-card">
              <span>Envelopes</span>
              <strong>{summary.envelopes.length}</strong>
            </div>
          </div>

          <div class="entry-block">
            <h2>Add an envelope</h2>
            <div class="entry-grid">
              <input
                value={newEnvelopeName}
                onInput={(event) => setNewEnvelopeName(event.target.value)}
                placeholder="Envelope name"
              />
              <input
                value={newEnvelopeBudget}
                onInput={(event) => setNewEnvelopeBudget(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Budget"
              />
              <button type="button" class="button button-primary" onClick={addEnvelope}>Add</button>
            </div>
          </div>

          <div class="entry-block">
            <h2>Add a transaction</h2>
            <div class="entry-grid">
              <select value={txType} onInput={(event) => setTxType(event.target.value)}>
                <option value="allocate">Allocate</option>
                <option value="spend">Spend</option>
                <option value="move">Move</option>
              </select>
              <input
                value={txAmount}
                onInput={(event) => setTxAmount(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
              />
              <select value={txEnvelope} onInput={(event) => setTxEnvelope(event.target.value)}>
                {envelopeNames.length === 0 ? <option value="">No envelopes</option> : null}
                {envelopeNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {txType === "move" && (
                <select value={txTargetEnvelope} onInput={(event) => setTxTargetEnvelope(event.target.value)}>
                  {envelopeNames.length === 0 ? <option value="">No destination</option> : null}
                  {envelopeNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
              <button type="button" class="button button-primary" onClick={addTransaction}>Add</button>
            </div>
          </div>

          <div class="entry-block">
            <h2>Envelopes</h2>
            <div class="list-stack">
              {summary.envelopes.length === 0 ? (
                <p class="muted-text">No envelopes yet.</p>
              ) : (
                summary.envelopes.map((entry) => (
                  <div key={entry.name} class="row-item">
                    <div>
                      <strong>{entry.name}</strong>
                      <div class="muted-text">Budget: {formatCurrency(entry.budget)}</div>
                    </div>
                    <div class="money-box">
                      <span>Available</span>
                      <strong>{formatCurrency(entry.available)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div class="entry-block">
            <h2>Recent records</h2>
            <div class="list-stack">
              {records.length === 0 ? (
                <p class="muted-text">No records yet.</p>
              ) : (
                records
                  .slice(-8)
                  .reverse()
                  .map((record, index) => (
                    <div key={`${record.raw}-${index}`} class="record-row">
                      <span class="record-date">{record.date}</span>
                      <code>{record.raw}</code>
                    </div>
                  ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section class="panel raw-panel">
        <div class="panel-header">
          <h2>Raw file</h2>
          <button type="button" class="button button-quiet" onClick={() => setRawMode((value) => !value)}>
            {rawMode ? "Preview" : "Edit"}
          </button>
        </div>

        {rawMode ? (
          <textarea
            spellcheck={false}
            value={currentText}
            onInput={(event) => updateCurrentDocument(event.target.value)}
          />
        ) : (
          <pre>{currentText}</pre>
        )}
      </section>

      {notice && <div class="notice">{notice}</div>}
    </div>
  );
}
