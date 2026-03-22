const FREE_ROUTER = "openrouter/free";


const FREE_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-3-27b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free"
];

const GEMINI_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are Thinky, an intelligent AI study assistant built into a Chrome Extension. You help students understand content, summarize material, create study notes, explain concepts clearly, and assist with academic tasks. Keep responses clear, well-structured, and educational. Use markdown formatting (headers, bullets, bold) to improve readability.`;


chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "thinky-explain",      title: "🧠 Explain Selection",    contexts: ["selection"] });
    chrome.contextMenus.create({ id: "thinky-summarize",    title: "📋 Summarize Selection",  contexts: ["selection"] });
    chrome.contextMenus.create({ id: "thinky-notes",        title: "📚 Generate Study Notes", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "thinky-sep", type: "separator",                          contexts: ["selection"] });
    chrome.contextMenus.create({ id: "thinky-page-summary", title: "📄 Summarize This Page",  contexts: ["page", "selection"] });
    chrome.contextMenus.create({ id: "thinky-open-sidebar", title: "💬 Open Chat Sidebar",    contexts: ["page", "selection"] });
  });
  chrome.storage.local.get(["darkMode", "chatHistory"], (r) => {
    if (r.darkMode === undefined) chrome.storage.local.set({ darkMode: true });
    if (!r.chatHistory)           chrome.storage.local.set({ chatHistory: [] });
  });
});

// ── Context menu clicks ───────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const text = info.selectionText || "";
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles/content.css"] });
  } catch (_) {}
  const actions = {
    "thinky-explain":      { action: "explain", text },
    "thinky-summarize":    { action: "summarize", text },
    "thinky-notes":        { action: "notes", text },
    "thinky-page-summary": { action: "page-summary" },
    "thinky-open-sidebar": { action: "open-sidebar", text }
  };
  const msg = actions[info.menuItemId];
  if (msg) chrome.tabs.sendMessage(tab.id, { type: "THINKY_ACTION", ...msg });
});

// ── Message router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AI_REQUEST") {
    callAI(msg).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "OPEN_SETTINGS") {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings/settings.html") });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Main AI dispatcher ────────────────────────────────────
async function callAI({ prompt, queryType }) {
  const { apiKey, geminiKey } = await chrome.storage.local.get(["apiKey", "geminiKey"]);

  if (!apiKey && !geminiKey) return { error: "NO_API_KEY" };

  // STRATEGY:
  // 1. Try openrouter/free (smart router — never gets stuck on one model)
  // 2. If that fails, try each fallback model in order
  // 3. If all OpenRouter fails, use Gemini
  // 4. If no OpenRouter key at all, go straight to Gemini

  if (apiKey) {
    // Try the smart free router first
    const result = await callOpenRouter(prompt, FREE_ROUTER, apiKey);
    if (result.ok) return result;

    // Try individual free fallback models
    for (const model of FREE_FALLBACKS) {
      if (isRetryableError(result.error)) {
        const fb = await callOpenRouter(prompt, model, apiKey);
        if (fb.ok) return { ...fb, fallbackModel: model };
      } else {
        break; // Don't retry on auth errors
      }
    }

    // All OpenRouter failed — try Gemini if available
    if (geminiKey) {
      const gem = await callGemini(prompt, geminiKey);
      if (gem.ok) return { ...gem, fallback: true };
      return gem;
    }

    return result; // Return last OpenRouter error
  }

  // No OpenRouter key — use Gemini directly
  return await callGemini(prompt, geminiKey);
}

// ── OpenRouter call ───────────────────────────────────────
async function callOpenRouter(prompt, model, apiKey) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://thinky-extension.com",
        "X-Title":       "Thinky Study Assistant"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: prompt }
        ],
        temperature: 0.7,
        max_tokens:  2048
      })
    });

    if (res.status === 401) return { ok: false, error: "INVALID_API_KEY" };
    if (res.status === 402) return { ok: false, error: "INSUFFICIENT_CREDITS" };
    if (res.status === 429) return { ok: false, error: "RATE_LIMIT" };
    if (res.status === 503) return { ok: false, error: "MODEL_UNAVAILABLE" };

    if (!res.ok) {
      let msg = `API_ERROR:${res.status}`;
      try { const d = await res.json(); msg = d?.error?.message || msg; } catch (_) {}
      return { ok: false, error: `API_ERROR: ${msg}` };
    }

    const data = await res.json();

    // Some providers return 200 with an error body
    if (data?.error) {
      const errMsg = data.error.message || JSON.stringify(data.error);
      if (errMsg.includes("rate") || errMsg.includes("limit")) return { ok: false, error: "RATE_LIMIT" };
      return { ok: false, error: `API_ERROR: ${errMsg}` };
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "EMPTY_RESPONSE" };

    return { ok: true, text, model, provider: "openrouter" };

  } catch (e) {
    return { ok: false, error: "NETWORK_ERROR" };
  }
}

// ── Google AI Studio (Gemini) call ────────────────────────
async function callGemini(prompt, geminiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );

    if (res.status === 400 || res.status === 403) {
      const d = await res.json().catch(() => ({}));
      return { ok: false, error: d?.error?.message?.includes("key") ? "INVALID_GEMINI_KEY" : `API_ERROR:${res.status}` };
    }
    if (res.status === 429) return { ok: false, error: "RATE_LIMIT" };
    if (!res.ok)            return { ok: false, error: `API_ERROR:${res.status}` };

    const data = await res.json();
    if (data?.candidates?.[0]?.finishReason === "SAFETY") return { ok: false, error: "CONTENT_BLOCKED" };

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { ok: false, error: "EMPTY_RESPONSE" };

    return { ok: true, text, model: GEMINI_MODEL, provider: "gemini" };

  } catch (e) {
    return { ok: false, error: "NETWORK_ERROR" };
  }
}

// ── Helpers ───────────────────────────────────────────────
function isRetryableError(error) {
  return error === "RATE_LIMIT" || error === "MODEL_UNAVAILABLE" ||
         error === "EMPTY_RESPONSE" || (error || "").startsWith("API_ERROR");
}
