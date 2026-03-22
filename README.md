# 🧠 Thinky — Smart AI Study Assistant

<div align="center">

![Thinky Banner](https://img.shields.io/badge/Thinky-Smart%20AI%20Study%20Assistant-DB3818?style=for-the-badge&logo=googlechrome&logoColor=white)

[![Version](https://img.shields.io/badge/Version-2.0.0-22C55E?style=flat-square)](https://github.com/yourusername/thinky-extension/releases)
[![Manifest](https://img.shields.io/badge/Manifest-V3-818CF8?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-FACC15?style=flat-square)](LICENSE)
[![Free](https://img.shields.io/badge/API-100%25%20Free-34D399?style=flat-square)](https://openrouter.ai)

**A premium Chrome Extension that turns any webpage into an interactive AI study session.**
Explain concepts, generate flashcards, chat with page content, and export everything as PDF — all for free.

[✨ Features](#-features) • [🚀 Installation](#-installation) • [🔑 API Setup](#-api-key-setup) • [📁 Project Structure](#-project-structure) • [🖼️ Screenshots](#%EF%B8%8F-screenshots) • [🛠️ Tech Stack](#%EF%B8%8F-tech-stack)

</div>

---

## ✨ Features

### 🔍 Smart Text Selection
Highlight any text on any webpage → a floating **Thinky** button appears instantly.

| Action | What it does |
|---|---|
| 💡 **Explain** | Step-by-step explanation with examples |
| 📋 **Summarize** | Concise summary with key points |
| 📚 **Study Notes** | Structured notes with headings and exam tips |
| 💬 **Chat** | Set as context and ask follow-up questions |
| ❓ **Quiz Me** | Generates MCQ questions from the selection |

---

### 💬 AI Chat Sidebar
A collapsible glassmorphism-style sidebar with:
- Full chat history stored locally
- Clean user/AI chat bubbles with timestamps
- Auto-scroll and typing indicator
- Context bar — ask questions about highlighted text
- **AI Mode Selector** — Chat / Explain / Summarize / Notes

---

### 📄 Page Analysis Tools
One-click chips to analyze the entire page:
- 📖 **Explain Page** — student-friendly breakdown
- 🎯 **Key Points** — 8–10 most important takeaways
- 🃏 **Flashcards** — 10 Q&A flashcards
- ❓ **Quiz** — 10 multiple-choice questions
- 📝 **Outline** — structured study outline

---

### 🧠 Smart Notes Panel
- Create and edit personal notes
- Save any AI response directly as a note
- Notes persist across sessions (stored locally)
- Editable inline with auto-save

---

### 📌 Bookmark Responses
- Star any AI response to save it
- Dedicated Bookmarks panel
- Copy or remove bookmarks anytime

---

### 📥 PDF Export
- Preview your full study session before downloading
- Exports with clean formatting — title, timestamps, Q&A structure
- Opens in a new tab ready to Print → Save as PDF

---

### 🌗 Theme Toggle
- **Dark Theme** — Deep navy (`#0B1220`) — premium night study experience
- **Light Theme** — Soft gray (`#F8FAFC`) — calm daytime reading
- Smooth instant toggle with sun/moon icon

---

### 📊 Reading Progress Bar
- Gradient progress bar at the top of every page
- Shows how far you've scrolled through the content
- Colors: `#F54927` → `#34D399`

---

### ⏱️ Focus Mode
- Dims the webpage behind the sidebar
- Helps eliminate distractions during deep study

---

## 🚀 Installation

> No Chrome Web Store needed — load it directly in 4 steps.

**Step 1 —** Download and unzip `thinky-extension-v2.zip`

**Step 2 —** Open Chrome and go to:
```
chrome://extensions
```

**Step 3 —** Enable **Developer Mode** using the toggle in the top-right corner

**Step 4 —** Click **Load Unpacked** → select the `thinky-extension` folder

✅ The Thinky icon will appear in your Chrome toolbar. You're ready!

---

## 🔑 API Key Setup

Thinky is **100% free** to use. You need at least one API key:

### Option A — OpenRouter (Recommended Primary)
1. Go to **[openrouter.ai/keys](https://openrouter.ai/keys)**
2. Sign up free (no credit card required)
3. Click **Create Key** → copy it
4. Open Thinky → **Settings** → paste under **OpenRouter API Key** → Save

> Uses `openrouter/free` smart router — automatically picks the best available free model from Llama 3.3 70B, Qwen3 80B, Mistral Small 3.1, Gemma 3 27B, and more.

---

### Option B — Google AI Studio (Recommended Backup)
1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
2. Sign in with your Google account
3. Click **Create API Key** → copy it
4. Open Thinky → **Settings** → paste under **Google AI Studio Key** → Save

> Uses **Gemini 2.0 Flash** — free tier gives **60 req/min** and **300K tokens/day**. Much more generous than OpenRouter free tier.

---

### 💡 Pro Tip — Add Both Keys
Thinky uses a **3-layer fallback system**:
```
OpenRouter Free Router → 5 individual free models → Gemini 2.0 Flash
```
If one hits a rate limit, it automatically switches to the next. Adding both keys means **you'll almost never see an error**.

---

## 📁 Project Structure

```
thinky-extension/
│
├── manifest.json              # Chrome Extension config (Manifest V3)
├── background.js              # Service worker — AI API calls, fallback logic
├── content.js                 # Injected into pages — floating button, sidebar
│
├── sidebar/
│   ├── sidebar.html           # Main sidebar UI
│   ├── sidebar.css            # Premium dark/light theme styles
│   └── sidebar.js             # Chat logic, notes, bookmarks, PDF export
│
├── popup/
│   ├── popup.html             # Toolbar popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup interactions
│
├── settings/
│   ├── settings.html          # Settings page UI
│   ├── settings.css           # Settings styles
│   └── settings.js            # API key save/validate logic
│
├── styles/
│   └── content.css            # Floating button & context menu styles
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Extension** | Chrome Extension Manifest V3 |
| **Frontend** | Vanilla JavaScript (no frameworks) |
| **Styling** | Pure CSS with CSS Variables |
| **Fonts** | DM Sans + Sora (Google Fonts) |
| **AI — Primary** | OpenRouter Free (`openrouter/free` router) |
| **AI — Backup** | Google Gemini 2.0 Flash (Google AI Studio) |
| **Storage** | `chrome.storage.local` — all data stays on your device |
| **PDF Export** | Native browser Print API |

---

## 🎨 Design System

### Dark Theme (Default)
| Token | Color | Usage |
|---|---|---|
| Background | `#0B1220` | Main app background |
| Card | `#111827` | Chat bubbles, panels |
| Primary | `#DB3818` | Buttons, active states |
| Secondary | `#22C55E` | Success, chips |
| Accent | `#FACC15` | Stars, highlights |
| Text | `#E5E7EB` | Primary text |
| Muted | `#9CA3AF` | Secondary text |
| Border | `#1F2937` | Dividers, borders |

### Light Theme
| Token | Color | Usage |
|---|---|---|
| Background | `#F8FAFC` | Main app background |
| Card | `#FFFFFF` | Chat bubbles, panels |
| Primary | `#F54927` | Buttons, active states |
| Secondary | `#34D399` | Success, chips |
| Accent | `#FBBF24` | Stars, highlights |
| Text | `#1F2937` | Primary text |
| Muted | `#6B7280` | Secondary text |
| Border | `#E5E7EB` | Dividers, borders |

---

## 🔐 Privacy & Security

- ✅ **No data collection** — Thinky has no backend server
- ✅ **Keys stored locally** — API keys never leave your browser (`chrome.storage.local`)
- ✅ **No tracking** — no analytics, no telemetry, no cookies
- ✅ **Open source** — inspect every line of code yourself
- ⚠️ Your prompts are sent directly to OpenRouter / Google AI Studio — check their privacy policies

---

## ⚡ AI Fallback System

Thinky uses a smart 3-layer fallback to ensure you always get a response:

```
Layer 1 — openrouter/free (smart router)
    ↓ fails?
Layer 2 — Individual free models (tried in order)
    • meta-llama/llama-3.3-70b-instruct:free
    • mistralai/mistral-small-3.1-24b-instruct:free
    • qwen/qwen3-next-80b-a3b-instruct:free
    • google/gemma-3-27b-it:free
    • nvidia/nemotron-3-super-120b-a12b:free
    ↓ all fail?
Layer 3 — Gemini 2.0 Flash (Google AI Studio)
```

---

## 🧩 Chrome Permissions Used

| Permission | Why it's needed |
|---|---|
| `activeTab` | Read content from the current tab |
| `scripting` | Inject the floating button into pages |
| `contextMenus` | Right-click menu options |
| `storage` | Save API keys and chat history locally |
| `tabs` | Open settings page in a new tab |

---

## 🙌 Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Fork and clone the repo
git clone https://github.com/yourusername/thinky-extension.git

# 2. Load in Chrome (no build step needed — pure JS)
# chrome://extensions → Developer Mode → Load Unpacked

# 3. Make your changes and reload the extension
# chrome://extensions → click the refresh icon on Thinky
```

Please open an issue first for major changes.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- [OpenRouter](https://openrouter.ai) — free AI model routing
- [Google AI Studio](https://aistudio.google.com) — free Gemini API
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) & [Sora](https://fonts.google.com/specimen/Sora) — Google Fonts
- [Lucide Icons](https://lucide.dev) — SVG icon inspiration

---

<div align="center">

Made with ❤️ for students everywhere

⭐ **Star this repo if Thinky helped you study better!**

</div>
