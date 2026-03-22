
const MODEL_LABELS = {
  "openrouter/free":                            "OpenRouter Free",
  "qwen/qwen3-next-80b-a3b-instruct:free":      "Qwen3 80B · Free",
  "meta-llama/llama-3.3-70b-instruct:free":     "Llama 3.3 70B · Free",
  "mistralai/mistral-small-3.1-24b-instruct:free": "Mistral Small 3.1 · Free",
  "google/gemma-3-27b-it:free":                 "Gemma 3 27B · Free",
  "nvidia/nemotron-3-super-120b-a12b:free":     "Nemotron 120B · Free",
  "gemini-2.0-flash":                           "Gemini 2.0 Flash",
  "gemini-1.5-flash":                           "Gemini 1.5 Flash",
  "gemini-1.5-pro":                             "Gemini 1.5 Pro"
};

// ── State ─────────────────────────────────────────────────
let history     = [];
let bookmarks   = [];
let notes       = [];
let busy        = false;
let ctx         = null;
let activePanel = "chat";
let aiMode      = "general";
let focusModeOn = false;
let lastPrompt  = null;
let lastLabel   = null;

// ── DOM helpers ───────────────────────────────────────────
const $  = id => document.getElementById(id);
const msgs        = $("messages");
const input       = $("input");
const sendBtn     = $("send");
const typing      = $("typing");
const typLbl      = $("typing-label");
const nokey       = $("nokey");
const ctxBar      = $("ctx-bar");
const ctxText     = $("ctx-text");
const modelBadge  = $("model-badge");
const modelFoot   = $("model-foot");
const charCount   = $("chars");
const welcome     = $("welcome");
const pdfModal    = $("pdf-modal");
const pdfPreview  = $("pdf-preview");

// ── Init ──────────────────────────────────────────────────
async function init() {
  const stored = await chrome.storage.local.get([
    "apiKey", "geminiKey", "chatHistory", "darkMode", "bookmarks", "notes", "thinkyMode"
  ]);

  // Theme
  const isDark = stored.darkMode !== false;
  setTheme(isDark);

  // API key check — hide warning if either key is present
  if (!stored.apiKey && !stored.geminiKey) {
    nokey.classList.remove("hidden");
  }

  // Load history
  history = stored.chatHistory || [];
  if (history.length > 0) {
    welcome.style.display = "none";
    history.slice(-30).forEach(m => renderMsg(m.role, m.content, m.label, m.ts, m.starred));
    scrollDown();
  }

  // Load bookmarks & notes
  bookmarks = stored.bookmarks || [];
  notes     = stored.notes || [];
  if (stored.thinkyMode) setMode(stored.thinkyMode);

  renderBookmarks();
  renderNotes();
  bindEvents();
  await refreshModelLabel();
}

// ── Theme ─────────────────────────────────────────────────
function setTheme(dark) {
  document.body.classList.toggle("dark",  dark);
  document.body.classList.toggle("light", !dark);
  $("icon-moon").classList.toggle("hidden",  !dark);
  $("icon-sun").classList.toggle("hidden",    dark);
}

// ── AI Mode ───────────────────────────────────────────────
function setMode(mode) {
  aiMode = mode;
  document.querySelectorAll(".mode-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  const placeholders = {
    general: "Ask anything…",
    explain: "What do you want explained?",
    summary: "What should I summarize?",
    notes:   "What should I turn into notes?"
  };
  input.placeholder = placeholders[mode] || "Ask anything…";
  chrome.storage.local.set({ thinkyMode: mode });
}

// ── Bind Events ───────────────────────────────────────────
function bindEvents() {
  // Send
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    const n = input.value.length;
    charCount.textContent = `${n} / 4000`;
    sendBtn.disabled = n === 0 || busy;
  });

  // Header buttons
  $("btn-close").addEventListener("click",     () => window.parent.postMessage({ type: "THINKY_CLOSE" }, "*"));
  $("btn-settings").addEventListener("click",  () => chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" }));
  $("btn-pdf").addEventListener("click",       openPdfModal);
  $("nokey-btn").addEventListener("click",     () => chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" }));
  $("ctx-clear").addEventListener("click",     clearCtx);
  $("btn-clear-chat").addEventListener("click", clearChat);

  // Theme toggle
  $("btn-theme").addEventListener("click", async () => {
    const isDark = document.body.classList.contains("dark");
    setTheme(!isDark);
    await chrome.storage.local.set({ darkMode: !isDark });
  });

  // Focus mode
  $("btn-focus").addEventListener("click", () => {
    focusModeOn = !focusModeOn;
    $("btn-focus").style.color = focusModeOn ? "var(--primary)" : "";
    $("btn-focus").style.background = focusModeOn ? "var(--primary-dim)" : "";
    window.parent.postMessage({ type: "THINKY_FOCUS_MODE", enabled: focusModeOn }, "*");
  });

  // Notes panel
  $("btn-notes-panel").addEventListener("click", () => showPanel("notes"));
  $("btn-bookmarks").addEventListener("click",   () => showPanel("bookmarks"));

  // Notes
  $("btn-add-note").addEventListener("click", addNote);
  $("btn-clear-bookmarks").addEventListener("click", clearBookmarks);

  // AI Mode buttons
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setMode(btn.dataset.mode);
      showPanel("chat");
    });
  });

  // Quick chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const p = chip.dataset.p;
      if (p === "summarize-page") {
        window.parent.postMessage({ type: "THINKY_NEED_CONTENT" }, "*");
      } else {
        handleChip(p);
      }
    });
  });

  // PDF modal
  $("pdf-modal-overlay").addEventListener("click", closePdfModal);
  $("pdf-modal-close").addEventListener("click",   closePdfModal);
  $("pdf-modal-cancel").addEventListener("click",  closePdfModal);
  $("pdf-download").addEventListener("click",      downloadPdf);

  // Messages from parent (content.js)
  window.addEventListener("message", onParentMsg);
}

// ── Panel management ──────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  const panel = $("panel-" + name);
  if (panel) {
    panel.classList.remove("hidden");
    panel.classList.add("active");
  }
  activePanel = name;

  // Update nav button highlights
  const navMap = {
    notes:     "btn-notes-panel",
    bookmarks: "btn-bookmarks"
  };
  ["btn-notes-panel", "btn-bookmarks"].forEach(id => {
    const btn = $(id);
    if (btn) btn.style.color = "";
  });

  if (name !== "chat" && navMap[name]) {
    const btn = $(navMap[name]);
    if (btn) btn.style.color = "var(--primary)";
  }
}

// ── Parent messages ───────────────────────────────────────
function onParentMsg(e) {
  const d = e.data || {};
  if (d.type === "RUN_PROMPT")   runPrompt(d.prompt, d.label);
  if (d.type === "SET_CONTEXT")  setContext(d.text);
  if (d.type === "PAGE_CONTENT") {
    runPrompt(
      `Summarize this page and list the key points:\n\nTitle: ${d.title}\nURL: ${d.url}\n\n${(d.content||"").slice(0,6000)}`,
      "📄 Page Summary"
    );
  }
}

function setContext(text) {
  ctx = text;
  ctxText.textContent = `"${text.slice(0, 55)}${text.length > 55 ? "…" : ""}"`;
  ctxBar.classList.remove("hidden");
  input.placeholder = "Ask about this selection…";
  input.focus();
  showPanel("chat");
}

function clearCtx() {
  ctx = null;
  ctxBar.classList.add("hidden");
  input.placeholder = aiMode === "general" ? "Ask anything…" : input.placeholder;
}

// ── Send & Run ────────────────────────────────────────────
async function send() {
  const raw = input.value.trim();
  if (!raw || busy) return;

  const { apiKey, geminiKey } = await chrome.storage.local.get(["apiKey", "geminiKey"]);
  if (!apiKey && !geminiKey) { nokey.classList.remove("hidden"); return; }

  // Apply mode prefix to prompt
  let prompt = applyModeToPrompt(raw);
  if (ctx) { prompt = `Regarding this text:\n\n"${ctx}"\n\n${prompt}`; clearCtx(); }

  input.value = "";
  input.style.height = "auto";
  charCount.textContent = "0 / 4000";
  sendBtn.disabled = true;

  await runPrompt(prompt, null, raw);
}

function applyModeToPrompt(text) {
  const prefixes = {
    explain: `Explain the following clearly, step by step with examples:\n\n`,
    summary: `Summarize the following concisely with key points:\n\n`,
    notes:   `Convert the following into structured study notes with headings, bullets, and exam tips:\n\n`
  };
  return (prefixes[aiMode] || "") + text;
}

async function runPrompt(prompt, label, displayText) {
  if (busy) return;
  busy = true;
  sendBtn.disabled = true;
  showPanel("chat");
  welcome.style.display = "none";
  lastPrompt = prompt;
  lastLabel  = label;

  // Render user bubble
  const ts = Date.now();
  renderMsg("user", displayText || prompt, label, ts);
  history.push({ role: "user", content: prompt, label, ts });

  const qtype = detectType(prompt);
  await refreshModelLabel(qtype);
  showTyping(qtype);

  try {
    const result = await chrome.runtime.sendMessage({ type: "AI_REQUEST", prompt, queryType: qtype });
    hideTyping();

    if (!result || result.error) {
      renderError(result?.error || "UNKNOWN", true);
    } else {
      const aiTs = Date.now();
      renderMsg("ai", result.text, null, aiTs);
      history.push({ role: "ai", content: result.text, model: result.model, ts: aiTs });

      // Show which model/provider was used
      const usedModel = result.fallbackModel || result.model;
      if (usedModel) {
        const name = MODEL_LABELS[usedModel] || usedModel.split("/").pop();
        const suffix = result.fallback ? " · Gemini" : result.fallbackModel ? " · fallback" : "";
        modelBadge.textContent = name + suffix;
        modelFoot.textContent  = "via " + (result.provider === "gemini" ? "Google AI Studio" : "OpenRouter");
      }
      await chrome.storage.local.set({ chatHistory: history.slice(-100) });
    }
  } catch (err) {
    hideTyping();
    renderError("NETWORK_ERROR", true);
  }

  busy = false;
  sendBtn.disabled = input.value.length === 0;
  scrollDown();
}

// ── Chips ─────────────────────────────────────────────────
function handleChip(type) {
  window.parent.postMessage({ type: "THINKY_NEED_CONTENT" }, "*");
  const wait = (e) => {
    if (e.data?.type !== "PAGE_CONTENT") return;
    window.removeEventListener("message", wait);
    clearTimeout(timer);
    const { content, title } = e.data;
    const page = (content || "").slice(0, 5000);
    const prompts = {
      "explain-page": `Explain this page clearly for a student:\n\nTitle: ${title}\n\n${page}`,
      "key-points":   `List the 8 most important key points:\n\nTitle: ${title}\n\n${page}`,
      "flashcards":   `Create 10 Q&A flashcards:\n**Q:** …\n**A:** …\n\nTitle: ${title}\n\n${page}`,
      "quiz":         `Create 10 multiple-choice questions (A/B/C/D):\n\nTitle: ${title}\n\n${page}`
    };
    const labels = {
      "explain-page":"📖 Explain Page",
      "key-points":"🎯 Key Points",
      "flashcards":"🃏 Flashcards",
      "quiz":"❓ Quiz"
    };
    if (prompts[type]) runPrompt(prompts[type], labels[type]);
  };
  const timer = setTimeout(() => window.removeEventListener("message", wait), 4000);
  window.addEventListener("message", wait);
}

// ── Render messages ───────────────────────────────────────
function renderMsg(role, content, label, ts, starred) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.dataset.ts = ts || Date.now();

  const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";

  let html = "";
  if (label) html += `<div class="pill">${esc(label)}</div>`;
  html += `<div class="msg-label">${role === "user" ? "You" : "Thinky"}</div>`;
  html += `<div class="bubble">${role === "ai" ? md(content) : esc(content).replace(/\n/g,"<br>")}</div>`;
  if (ts) html += `<div class="msg-ts">${timeStr}</div>`;

  if (role === "ai") {
    const isStarred = starred ? "starred" : "";
    html += `<div class="msg-actions">
      <button class="mac copy-btn" title="Copy response">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy
      </button>
      <button class="mac star-btn ${isStarred}" title="Star response" data-starred="${!!starred}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="${starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${starred ? "Starred" : "Star"}
      </button>
      <button class="mac save-note-btn" title="Save to Notes">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Note
      </button>
    </div>`;
  }

  div.innerHTML = html;

  // Copy button
  div.querySelector(".copy-btn")?.addEventListener("click", () => {
    navigator.clipboard.writeText(content).then(() => {
      const b = div.querySelector(".copy-btn");
      b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => {
        b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
      }, 2000);
    });
  });

  // Star button
  div.querySelector(".star-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const isNowStarred = btn.dataset.starred !== "true";
    btn.dataset.starred = isNowStarred;
    btn.classList.toggle("starred", isNowStarred);
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="${isNowStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${isNowStarred ? "Starred" : "Star"}`;

    if (isNowStarred) {
      bookmarks.push({ content, ts: Date.now() });
    } else {
      bookmarks = bookmarks.filter(b => b.content !== content);
    }
    chrome.storage.local.set({ bookmarks });
    renderBookmarks();

    // Update history
    const idx = history.findIndex(h => h.content === content && h.role === "ai");
    if (idx !== -1) history[idx].starred = isNowStarred;
    chrome.storage.local.set({ chatHistory: history.slice(-100) });
  });

  // Save to notes
  div.querySelector(".save-note-btn")?.addEventListener("click", () => {
    addNote(content);
    const b = div.querySelector(".save-note-btn");
    b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Saved!`;
    setTimeout(() => {
      b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Note`;
    }, 2000);
  });

  msgs.appendChild(div);
  scrollDown();
}

function renderError(code, showRetry) {
  const map = {
    "NO_API_KEY":          "No API key found. Open Settings and add your OpenRouter or Google AI Studio key.",
    "NO_GEMINI_KEY":       "No Google AI Studio key found. Add it in Settings.",
    "INVALID_API_KEY":     "Invalid OpenRouter key. Double-check it in Settings.",
    "INVALID_GEMINI_KEY":  "Invalid Google AI Studio key. Double-check it in Settings.",
    "INSUFFICIENT_CREDITS":"OpenRouter account has no credits. Free tier limit reached — add Gemini key as backup.",
    "RATE_LIMIT":          "All free models are rate limited right now. Add your Google AI Studio key in Settings as a backup — it has 300K tokens/day free.",
    "MODEL_UNAVAILABLE":   "Free model unavailable. Please try again in a moment.",
    "CONTENT_BLOCKED":     "Response was blocked by safety filter. Try rephrasing.",
    "EMPTY_RESPONSE":      "Got an empty response. Try rephrasing your question.",
    "NETWORK_ERROR":       "Cannot reach the AI server. Check your internet connection."
  };

  const div = document.createElement("div");
  div.className = "msg ai";
  let html = `<div class="msg-label">System</div>
    <div class="bubble error-bubble">⚠️ ${map[code] || "Error: " + code}</div>`;

  if (showRetry) {
    html += `<button class="retry-btn">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
      Retry
    </button>`;
  }

  div.innerHTML = html;
  div.querySelector(".retry-btn")?.addEventListener("click", () => {
    div.remove();
    if (lastPrompt) runPrompt(lastPrompt, lastLabel);
  });

  if (code.includes("KEY")) nokey.classList.remove("hidden");
  msgs.appendChild(div);
  scrollDown();
}

function showTyping(qtype) {
  const labels = {
    general:  "Thinking…",
    code:     "Thinking…",
    advanced: "Thinking…"
  };
  chrome.storage.local.get(["modelOverride"]).then(({ modelOverride }) => {
    typLbl.textContent = modelOverride && MODEL_LABELS[modelOverride]
      ? `${MODEL_LABELS[modelOverride]} thinking…`
      : (labels[qtype] || "Thinking…");
  });
  typing.classList.remove("hidden");
  scrollDown();
}

function hideTyping() { typing.classList.add("hidden"); }

async function refreshModelLabel(qtype) {
  const { modelOverride } = await chrome.storage.local.get(["modelOverride"]);
  const mMap = { general:"OpenRouter Free", code:"OpenRouter Free", advanced:"OpenRouter Free" };
  const name = modelOverride && MODEL_LABELS[modelOverride]
    ? MODEL_LABELS[modelOverride]
    : (mMap[qtype] || "Qwen3 General");
  modelFoot.textContent = `Model: ${name}`;
}

// ── Clear chat ────────────────────────────────────────────
async function clearChat() {
  if (history.length === 0) return;
  if (!confirm("Clear all chat history?")) return;
  history = [];
  await chrome.storage.local.set({ chatHistory: [] });
  msgs.innerHTML = "";
  const w = document.createElement("div");
  w.id = "welcome";
  w.innerHTML = `
    <div class="welcome-art">
      <div class="welcome-orb"></div>
      <svg class="welcome-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.959 9.959 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
      </svg>
    </div>
    <h2>Chat cleared</h2>
    <p>Start a new study session by highlighting text or typing below.</p>`;
  msgs.appendChild(w);
}

function scrollDown() {
  requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
}

// ── Bookmarks ─────────────────────────────────────────────
function renderBookmarks() {
  const list = $("bookmarks-list");
  if (!list) return;
  list.innerHTML = "";

  if (bookmarks.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <p>No starred responses</p>
      <span>Star any AI response to save it here</span>
    </div>`;
    return;
  }

  [...bookmarks].reverse().forEach((bm, i) => {
    const card = document.createElement("div");
    card.className = "bookmark-card";
    const timeStr = new Date(bm.ts).toLocaleDateString([], { month:"short", day:"numeric" });
    card.innerHTML = `
      <div class="bookmark-card-content">${md(bm.content)}</div>
      <div class="bookmark-card-footer">
        <span class="note-ts">${timeStr}</span>
        <div style="display:flex;gap:5px;">
          <button class="mac copy-bm-btn">Copy</button>
          <button class="mac del-bm-btn" style="color:var(--danger)">Remove</button>
        </div>
      </div>`;

    card.querySelector(".copy-bm-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(bm.content);
    });
    card.querySelector(".del-bm-btn").addEventListener("click", () => {
      bookmarks.splice(bookmarks.length - 1 - i, 1);
      chrome.storage.local.set({ bookmarks });
      renderBookmarks();
    });

    list.appendChild(card);
  });
}

function clearBookmarks() {
  if (!confirm("Clear all starred responses?")) return;
  bookmarks = [];
  chrome.storage.local.set({ bookmarks: [] });
  renderBookmarks();
}

// ── Notes ─────────────────────────────────────────────────
function addNote(content) {
  const note = {
    id:      Date.now(),
    content: typeof content === "string" ? content : "",
    ts:      Date.now()
  };
  notes.unshift(note);
  chrome.storage.local.set({ notes });
  renderNotes();
  if (typeof content !== "string" || !content) showPanel("notes");
}

function renderNotes() {
  const list = $("notes-list");
  if (!list) return;
  list.innerHTML = "";

  if (notes.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <p>No notes yet</p>
      <span>Save AI responses or create your own notes here</span>
    </div>`;
    return;
  }

  notes.forEach((note, i) => {
    const card = document.createElement("div");
    card.className = "note-card";
    const timeStr = new Date(note.ts).toLocaleDateString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });

    const ta = document.createElement("textarea");
    ta.value = note.content;
    ta.placeholder = "Write your note here…";
    ta.rows = 3;

    let saveTimer;
    ta.addEventListener("input", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        notes[i].content = ta.value;
        chrome.storage.local.set({ notes });
      }, 600);
    });

    const footer = document.createElement("div");
    footer.className = "note-card-footer";
    footer.innerHTML = `
      <span class="note-ts">${timeStr}</span>
      <div style="display:flex;gap:5px;">
        <button class="mac">Copy</button>
        <button class="mac" style="color:var(--danger)">Delete</button>
      </div>`;

    footer.querySelector(".mac:first-child").addEventListener("click", () => {
      navigator.clipboard.writeText(note.content);
    });
    footer.querySelector(".mac:last-child").addEventListener("click", () => {
      notes.splice(i, 1);
      chrome.storage.local.set({ notes });
      renderNotes();
    });

    card.appendChild(ta);
    card.appendChild(footer);
    list.appendChild(card);
  });
}

// ── PDF Export ────────────────────────────────────────────
function openPdfModal() {
  if (history.length === 0) {
    alert("No chat history to export.");
    return;
  }

  // Build preview
  const date = new Date().toLocaleString();
  let previewHTML = `
    <div class="preview-title">Thinky Study Session</div>
    <div class="preview-meta">Exported on ${date}</div>`;

  history.slice(-50).forEach(m => {
    const role = m.role === "user" ? "user" : "ai";
    const roleLabel = role === "user" ? "You" : "Thinky AI";
    const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
    previewHTML += `
      <div class="preview-item">
        <div class="preview-role ${role}">${roleLabel} · ${timeStr}</div>
        <div>${role === "ai" ? md(m.content) : esc(m.content).replace(/\n/g,"<br>")}</div>
      </div>`;
  });

  pdfPreview.innerHTML = previewHTML;
  pdfModal.classList.remove("hidden");
}

function closePdfModal() {
  pdfModal.classList.add("hidden");
}

async function downloadPdf() {
  // Build a clean HTML document for printing
  const date = new Date().toLocaleString();
  const lines = history.slice(-50).map(m => {
    const role = m.role === "user" ? "You" : "Thinky AI";
    const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
    const content = m.role === "ai" ? md(m.content) : esc(m.content).replace(/\n/g,"<br>");
    const color = m.role === "user" ? "#F54927" : "#22C55E";
    return `
      <div style="margin-bottom:18px; padding-bottom:16px; border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:${color}; margin-bottom:6px; font-family:sans-serif;">${role} · ${timeStr}</div>
        <div style="font-size:14px; line-height:1.7; color:#1f2937; font-family:sans-serif;">${content}</div>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    body { font-family: 'DM Sans', sans-serif; margin: 0; padding: 32px 48px; color: #1f2937; background: #fff; max-width: 760px; margin: auto; }
    h1 { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 28px; }
    .divider { height: 2px; background: linear-gradient(90deg, #F54927, #34D399); border: none; margin-bottom: 24px; border-radius: 2px; }
    h2 { font-size: 15px; font-weight: 700; margin: 10px 0 4px; }
    h3 { font-size: 14px; font-weight: 600; margin: 8px 0 3px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #DB3818; font-family: monospace; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
    ul { padding-left: 20px; } li { margin: 3px 0; }
    blockquote { border-left: 3px solid #F54927; padding-left: 12px; color: #6b7280; font-style: italic; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>🧠 Thinky Study Session</h1>
  <div class="meta">Exported on ${date}</div>
  <hr class="divider"/>
  ${lines}
</body>
</html>`;

  // Create blob and trigger print/save
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
    });
  } else {
    // Fallback: direct download
    const a = document.createElement("a");
    a.href = url;
    a.download = `thinky-session-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  closePdfModal();
}

// ── Markdown parser ───────────────────────────────────────
function md(raw) {
  if (!raw) return "";
  let s = esc(raw);

  // Fenced code blocks
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`);

  // Inline code
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Headers
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

  // Bold / italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g,         "<em>$1</em>");

  // HR
  s = s.replace(/^---$/gm, "<hr/>");

  // Blockquote
  s = s.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists
  s = s.replace(/^[ \t]*[-*+] (.+)$/gm, "<li>$1</li>");
  s = s.replace(/^[ \t]*\d+\. (.+)$/gm, "<li>$1</li>");
  s = s.replace(/((<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Paragraphs
  s = s.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (!p) return "";
    if (/^<(h\d|ul|ol|pre|blockquote|hr)/.test(p)) return p;
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return s;
}

function esc(t) {
  return (t || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Query type detection ──────────────────────────────────
function detectType(t) {
  const s = t.toLowerCase();
  if ([/\bcode\b/,/\bfunction\b/,/\bclass\b/,/\bdebugg?\b/,/```/,/\bjavascript\b/,/\bpython\b/,/\bsql\b/,/\bbug\b/,/\berror\b/,/\bsyntax\b/].some(r=>r.test(s))) return "code";
  if ([/\banalyze\b/,/\bcompare\b/,/\bprove\b/,/\bmath\b/,/\bcalculus\b/,/\btheor/].some(r=>r.test(s))) return "advanced";
  return "general";
}

// ── Start ─────────────────────────────────────────────────
init();
