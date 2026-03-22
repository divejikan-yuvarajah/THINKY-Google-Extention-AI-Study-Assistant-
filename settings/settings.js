
document.addEventListener("DOMContentLoaded", async () => {
  await load();
  bind();
});

async function load() {
  const s = await chrome.storage.local.get([
    "apiKey", "geminiKey", "showFloatingBtn", "darkMode", "progressBar"
  ]);

  if (s.apiKey)    { document.getElementById("or-key").value  = s.apiKey;    setStatus("or-status",  "ok", "✓ OpenRouter key saved"); }
  if (s.geminiKey) { document.getElementById("gem-key").value = s.geminiKey; setStatus("gem-status", "ok", "✓ Google AI Studio key saved"); }

  document.getElementById("tog-float").checked    = s.showFloatingBtn !== false;
  document.getElementById("tog-dark").checked     = s.darkMode !== false;
  document.getElementById("tog-progress").checked = s.progressBar !== false;
}

function bind() {
  // Eye toggle for both fields
  document.querySelectorAll(".eye-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const inp = document.getElementById(btn.dataset.for);
      const isPass = inp.type === "password";
      inp.type = isPass ? "text" : "password";
      btn.style.color = isPass ? "var(--primary)" : "";
    });
  });

  document.getElementById("or-validate").addEventListener("click",  validateOR);
  document.getElementById("or-save").addEventListener("click",       saveOR);
  document.getElementById("gem-validate").addEventListener("click",  validateGem);
  document.getElementById("gem-save").addEventListener("click",      saveGem);
  document.getElementById("save-all").addEventListener("click",      saveAll);
  document.getElementById("btn-clear").addEventListener("click",     clearHistory);
  document.getElementById("btn-export").addEventListener("click",    exportHistory);
  document.getElementById("btn-clear-all").addEventListener("click", clearAllData);
}

// ── OpenRouter ────────────────────────────────────────────
async function validateOR() {
  const key = document.getElementById("or-key").value.trim();
  if (!key) return toast("Enter your OpenRouter API key first.", "error");
  setStatus("or-status", "checking", "Testing key…");
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${key}` }
    });
    if (r.ok) {
      setStatus("or-status", "ok", "✓ Valid — ready to use");
      toast("✓ OpenRouter key is valid!", "success");
    } else if (r.status === 401) {
      setStatus("or-status", "error", "✗ Invalid key — check and try again");
      toast("✗ Invalid OpenRouter key.", "error");
    } else {
      setStatus("or-status", "checking", `HTTP ${r.status} — key may still work`);
    }
  } catch {
    setStatus("or-status", "error", "Network error");
    toast("Network error. Check your connection.", "error");
  }
}

async function saveOR() {
  const key = document.getElementById("or-key").value.trim();
  if (!key) return toast("Enter your OpenRouter API key.", "error");
  if (!key.startsWith("sk-")) return toast("OpenRouter keys start with 'sk-'.", "error");
  await chrome.storage.local.set({ apiKey: key });
  setStatus("or-status", "ok", "✓ Saved successfully");
  toast("✓ OpenRouter key saved!", "success");
}

// ── Google AI Studio ──────────────────────────────────────
async function validateGem() {
  const key = document.getElementById("gem-key").value.trim();
  if (!key) return toast("Enter your Google AI Studio key first.", "error");
  setStatus("gem-status", "checking", "Testing key…");
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (r.ok) {
      setStatus("gem-status", "ok", "✓ Valid — Gemini 2.0 Flash ready");
      toast("✓ Google AI Studio key is valid!", "success");
    } else if (r.status === 400 || r.status === 403) {
      setStatus("gem-status", "error", "✗ Invalid key — check and try again");
      toast("✗ Invalid Google AI Studio key.", "error");
    } else {
      setStatus("gem-status", "checking", `HTTP ${r.status} — key may still work`);
    }
  } catch {
    setStatus("gem-status", "error", "Network error");
    toast("Network error. Check your connection.", "error");
  }
}

async function saveGem() {
  const key = document.getElementById("gem-key").value.trim();
  if (!key) return toast("Enter your Google AI Studio key.", "error");
  if (!key.startsWith("AIza")) return toast("Google AI Studio keys start with 'AIza'.", "error");
  await chrome.storage.local.set({ geminiKey: key });
  setStatus("gem-status", "ok", "✓ Saved successfully");
  toast("✓ Google AI Studio key saved!", "success");
}

// ── Save All ──────────────────────────────────────────────
async function saveAll() {
  const orKey    = document.getElementById("or-key").value.trim();
  const gemKey   = document.getElementById("gem-key").value.trim();
  const fltBtn   = document.getElementById("tog-float").checked;
  const dark     = document.getElementById("tog-dark").checked;
  const progress = document.getElementById("tog-progress").checked;

  if (!orKey && !gemKey) return toast("Add at least one API key to continue.", "error");
  if (orKey  && !orKey.startsWith("sk-"))   return toast("OpenRouter keys start with 'sk-'.", "error");
  if (gemKey && !gemKey.startsWith("AIza")) return toast("Google AI Studio keys start with 'AIza'.", "error");

  const data = {
    showFloatingBtn: fltBtn,
    darkMode:        dark,
    progressBar:     progress,
    modelOverride:   null
  };
  if (orKey)  data.apiKey    = orKey;
  if (gemKey) data.geminiKey = gemKey;

  await chrome.storage.local.set(data);

  const btn = document.getElementById("save-all");
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Saved!`;
  setTimeout(() => {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save All Settings`;
  }, 2000);
  toast("✓ All settings saved!", "success");
}

// ── Data ──────────────────────────────────────────────────
async function clearHistory() {
  if (!confirm("Clear all chat history? This cannot be undone.")) return;
  await chrome.storage.local.set({ chatHistory: [] });
  toast("✓ Chat history cleared.", "success");
}

async function clearAllData() {
  if (!confirm("Clear ALL data — chat history, notes, bookmarks? Cannot be undone.")) return;
  await chrome.storage.local.set({ chatHistory: [], notes: [], bookmarks: [] });
  toast("✓ All data cleared.", "success");
}

async function exportHistory() {
  const { chatHistory: h } = await chrome.storage.local.get(["chatHistory"]);
  if (!h?.length) return toast("No history to export.", "error");
  let out = `# Thinky Chat Export\nDate: ${new Date().toLocaleString()}\n\n---\n\n`;
  h.forEach(m => {
    const time = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
    out += `**${m.role === "user" ? "You" : "Thinky"}** — ${time}\n`;
    if (m.label) out += `> ${m.label}\n\n`;
    out += `${m.content}\n\n---\n\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "text/markdown" }));
  a.download = `thinky-history-${Date.now()}.md`;
  a.click();
  toast("✓ History exported!", "success");
}

// ── Helpers ───────────────────────────────────────────────
function setStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.className = `key-status ${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function toast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.className = `toast ${type}`;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 3500);
}
