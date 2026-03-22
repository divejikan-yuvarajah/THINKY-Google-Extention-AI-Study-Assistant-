// popup/popup.js v2
document.addEventListener("DOMContentLoaded", async () => {
  await checkStatus();
  bindEvents();
});

async function checkStatus() {
  const { apiKey, geminiKey } = await chrome.storage.local.get(["apiKey", "geminiKey"]);
  const dot    = document.querySelector(".dot");
  const label  = document.querySelector(".label");
  const notice = document.getElementById("nokey-notice");

  if (!apiKey && !geminiKey) {
    dot.className   = "dot missing";
    label.className = "label missing";
    label.textContent = "No API Key";
    notice.classList.remove("hidden");
  } else {
    dot.className   = "dot ready";
    label.className = "label ready";
    if (apiKey && geminiKey) label.textContent = "Qwen3 + Gemini ✓";
    else if (apiKey)         label.textContent = "Qwen3 Ready ✓";
    else                     label.textContent = "Gemini Ready ✓";
    notice.classList.add("hidden");
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch (_) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["styles/content.css"] });
    await new Promise(r => setTimeout(r, 200));
  }
}

function bindEvents() {
  document.getElementById("btn-sidebar").addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
    window.close();
  });

  document.getElementById("btn-summary").addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "THINKY_ACTION", action: "page-summary" });
    window.close();
  });

  document.querySelectorAll(".tool").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: "THINKY_TOOL", tool: btn.dataset.tool });
      window.close();
    });
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings/settings.html") });
    window.close();
  });

  document.getElementById("btn-clear").addEventListener("click", async () => {
    if (confirm("Clear all chat history?")) {
      await chrome.storage.local.set({ chatHistory: [] });
      const btn = document.getElementById("btn-clear");
      btn.textContent = "✓ Cleared";
      setTimeout(() => window.close(), 800);
    }
  });
}
