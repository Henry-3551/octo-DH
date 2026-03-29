const sourceLang = document.getElementById("sourceLang");
const targetLang = document.getElementById("targetLang");
const swapBtn = document.getElementById("swapBtn");
const translateBtn = document.getElementById("translateBtn");
const sourceText = document.getElementById("sourceText");
const translatedText = document.getElementById("translatedText");
const statusLine = document.getElementById("statusLine");
const metaLine = document.getElementById("metaLine");
const clearBtn = document.getElementById("clearBtn");
const pasteBtn = document.getElementById("pasteBtn");
const copyBtn = document.getElementById("copyBtn");
const dictateBtn = document.getElementById("dictateBtn");
const speakBtn = document.getElementById("speakBtn");
const toastStack = document.getElementById("toastStack");
const themeToggle = document.getElementById("themeToggle");
const installBanner = document.getElementById("installBanner");
const dismissInstall = document.getElementById("dismissInstall");
const confirmInstall = document.getElementById("confirmInstall");
const installTrigger = document.getElementById("installTrigger");
const phraseList = document.getElementById("phraseList");
const phraseEmpty = document.getElementById("phraseEmpty");
const clearPhrasebookBtn = document.getElementById("clearPhrasebook");
const autoTranslateToggle = document.getElementById("autoTranslateToggle");
const phrasebookToggle = document.getElementById("phrasebookToggle");
const fontFamilySelect = document.getElementById("fontFamilySelect");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const fontSizeValue = document.getElementById("fontSizeValue");

const LANGUAGES = [
  { code: "auto", label: "Auto Detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "zh", label: "Chinese" },
  { code: "ig", label: "Igbo" },
  { code: "yo", label: "Yoruba" },
  { code: "ha", label: "Hausa" },
  { code: "tr", label: "Turkish" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" }
];

let debounceTimer;
let lastQuery = "";
let deferredPrompt = null;
let autoMode = true;
const supportsIndexedDB = "indexedDB" in window;
const PHRASEBOOK_DB = "henrifyPhrasebook";
const PHRASEBOOK_STORE = "phrases";
const PHRASEBOOK_VERSION = 1;
const PHRASEBOOK_DISPLAY_LIMIT = 6;
let phrasebookDbPromise = null;
const SETTINGS_KEY = "henrifySettings";
const DEFAULT_SETTINGS = {
  autoTranslate: true,
  phrasebookEnabled: true,
  fontFamily: "modern",
  fontSize: 100
};
const FONT_PRESETS = {
  modern: {
    heading: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif"
  },
  sans: {
    heading: "'DM Sans', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif"
  },
  system: {
    heading: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "system-ui, -apple-system, 'Segoe UI', sans-serif"
  }
};
let currentSettings = { ...DEFAULT_SETTINGS };
const PHRASE_EMPTY_DEFAULT = phraseEmpty ? phraseEmpty.textContent : "";
const LOCALE_MAP = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  hi: "hi-IN",
  ar: "ar-SA",
  he: "he-IL",
  zh: "zh-CN",
  ig: "ig-NG",
  yo: "yo-NG",
  ha: "ha-NG",
  tr: "tr-TR",
  ja: "ja-JP",
  ko: "ko-KR"
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supportsSpeechRecognition = Boolean(SpeechRecognition);
const supportsSpeechSynthesis = "speechSynthesis" in window;
let recognitionInstance = null;
let isRecording = false;
let currentUtterance = null;

const PROVIDERS = [
  {
    label: "MyMemory",
    buildUrl: params => `https://api.mymemory.translated.net/get?${params}`
  },
  {
    label: "MyMemory Mirror",
    buildUrl: params => `https://mymemory.translated.net/api/get?${params}`
  }
];

const getLabel = code => {
  const match = LANGUAGES.find(lang => lang.code === code);
  if (match) {
    return match.label;
  }
  return code ? code.toUpperCase() : "Unknown";
};

function populateLanguageSelects() {
  sourceLang.innerHTML = "";
  targetLang.innerHTML = "";

  LANGUAGES.forEach(({ code, label }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    sourceLang.appendChild(option);
  });

  LANGUAGES.filter(lang => lang.code !== "auto").forEach(({ code, label }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    targetLang.appendChild(option);
  });

  sourceLang.value = "auto";
  targetLang.value = "en";
}

function setStatus(message, meta = "") {
  statusLine.textContent = message;
  if (meta) {
    metaLine.textContent = meta;
  }
}

function pushToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`.trim();
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } else {
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.warn("Failed to load settings", error);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  if (!supportsIndexedDB) {
    currentSettings.phrasebookEnabled = false;
  }
  autoMode = currentSettings.autoTranslate;
}

function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
  } catch (error) {
    console.warn("Unable to save settings", error);
  }
}

function applyFontPreset(key) {
  const preset = FONT_PRESETS[key] || FONT_PRESETS.modern;
  document.documentElement.style.setProperty("--font-heading", preset.heading);
  document.documentElement.style.setProperty("--font-body", preset.body);
}

function applyFontSize(value) {
  document.documentElement.style.fontSize = `${value}%`;
  if (fontSizeValue) {
    fontSizeValue.textContent = `${value}%`;
  }
}

function applySettingsUI() {
  if (autoTranslateToggle) {
    autoTranslateToggle.checked = currentSettings.autoTranslate;
  }
  if (phrasebookToggle) {
    phrasebookToggle.checked = currentSettings.phrasebookEnabled;
    phrasebookToggle.disabled = !supportsIndexedDB;
    if (!supportsIndexedDB) {
      phrasebookToggle.title = "Phrasebook requires IndexedDB support.";
    }
  }
  if (fontFamilySelect) {
    fontFamilySelect.value = currentSettings.fontFamily;
  }
  if (fontSizeSlider) {
    fontSizeSlider.value = currentSettings.fontSize;
  }
  applyFontPreset(currentSettings.fontFamily);
  applyFontSize(currentSettings.fontSize);
}

function initSettingsPanel() {
  loadSettings();
  applySettingsUI();

  if (autoTranslateToggle) {
    autoTranslateToggle.addEventListener("change", event => {
      currentSettings.autoTranslate = event.target.checked;
      autoMode = currentSettings.autoTranslate;
      persistSettings();
      if (currentSettings.autoTranslate) {
        scheduleAutoTranslate();
        if (metaLine) {
          metaLine.textContent = "Auto mode • Listening";
        }
      } else {
        if (metaLine) {
          metaLine.textContent = "Auto mode • Manual";
        }
      }
    });
  }

  if (phrasebookToggle) {
    phrasebookToggle.addEventListener("change", event => {
      if (!supportsIndexedDB) {
        phrasebookToggle.checked = false;
        pushToast("Phrasebook not supported in this browser", "error");
        return;
      }
      currentSettings.phrasebookEnabled = event.target.checked;
      persistSettings();
      refreshPhrasebookUI();
      pushToast(currentSettings.phrasebookEnabled ? "Phrasebook resumed" : "Phrasebook paused");
    });
  }

  if (fontFamilySelect) {
    fontFamilySelect.addEventListener("change", event => {
      currentSettings.fontFamily = event.target.value;
      applyFontPreset(currentSettings.fontFamily);
      persistSettings();
    });
  }

  if (fontSizeSlider) {
    fontSizeSlider.addEventListener("input", event => {
      const value = Number(event.target.value);
      currentSettings.fontSize = value;
      applyFontSize(value);
      persistSettings();
    });
  }
}

function getPhrasebookDb() {
  if (!supportsIndexedDB) {
    return Promise.reject(new Error("IndexedDB not supported"));
  }
  if (phrasebookDbPromise) {
    return phrasebookDbPromise;
  }
  phrasebookDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(PHRASEBOOK_DB, PHRASEBOOK_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHRASEBOOK_STORE)) {
        db.createObjectStore(PHRASEBOOK_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return phrasebookDbPromise;
}

const getLocaleFromCode = (code, fallback = "en-US") => {
  if (!code || code === "auto") {
    return fallback;
  }
  return LOCALE_MAP[code] || fallback;
};

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function recordPhraseUsage(entry) {
  if (!supportsIndexedDB || !phraseList || !currentSettings.phrasebookEnabled) {
    return;
  }
  const normalized = entry.sourceText?.trim();
  if (!normalized || normalized.length < 2) {
    return;
  }
  const db = await getPhrasebookDb();
  const tx = db.transaction(PHRASEBOOK_STORE, "readwrite");
  const store = tx.objectStore(PHRASEBOOK_STORE);
  const id = `${entry.sourceLang}:${entry.targetLang}:${normalized.toLowerCase()}`;
  const existing = await idbRequest(store.get(id));
  const payload = existing || {
    id,
    sourceLang: entry.sourceLang,
    targetLang: entry.targetLang,
    sourceText: normalized,
    translatedText: entry.translatedText,
    detected: entry.detected,
    count: 0
  };
  payload.sourceText = normalized;
  payload.translatedText = entry.translatedText;
  payload.detected = entry.detected;
  payload.sourceLang = entry.sourceLang;
  payload.targetLang = entry.targetLang;
  payload.count = (payload.count || 0) + 1;
  payload.lastUsed = Date.now();
  await idbRequest(store.put(payload));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function fetchTopPhrases(limit = PHRASEBOOK_DISPLAY_LIMIT) {
  if (!supportsIndexedDB || !phraseList || !currentSettings.phrasebookEnabled) {
    return [];
  }
  const db = await getPhrasebookDb();
  const tx = db.transaction(PHRASEBOOK_STORE, "readonly");
  const store = tx.objectStore(PHRASEBOOK_STORE);
  const records = await idbRequest(store.getAll());
  records.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
  return records.filter(entry => entry.count >= 2).slice(0, limit);
}

function buildPhraseListItem(entry) {
  const li = document.createElement("li");
  li.className = "phrase-item";

  const row = document.createElement("div");
  row.className = "phrase-row";
  const phrase = document.createElement("p");
  phrase.className = "phrase-source";
  phrase.textContent = entry.sourceText;
  const stats = document.createElement("p");
  stats.className = "phrase-meta";
  const fromLabel = entry.sourceLang === "auto" && entry.detected ? entry.detected : getLabel(entry.sourceLang);
  stats.textContent = `${fromLabel} → ${getLabel(entry.targetLang)} • ${entry.count}×`;
  row.append(phrase, stats);

  const translation = document.createElement("p");
  translation.className = "phrase-translation";
  translation.textContent = entry.translatedText;

  const actions = document.createElement("div");
  actions.className = "phrase-actions";
  const reuseBtn = document.createElement("button");
  reuseBtn.className = "accent-btn";
  reuseBtn.textContent = "Use";
  reuseBtn.addEventListener("click", () => {
    sourceText.value = entry.sourceText;
    const allowableSource = LANGUAGES.some(lang => lang.code === entry.sourceLang) ? entry.sourceLang : "auto";
    sourceLang.value = allowableSource;
    targetLang.value = LANGUAGES.some(lang => lang.code === entry.targetLang) ? entry.targetLang : targetLang.value;
    translateText("manual");
  });

  const copyBtn = document.createElement("button");
  copyBtn.className = "ghost-btn";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(entry.translatedText);
      pushToast("Copied phrase");
    } catch (error) {
      pushToast("Copy blocked", "error");
    }
  });

  actions.append(reuseBtn, copyBtn);
  li.append(row, translation, actions);
  return li;
}

async function refreshPhrasebookUI() {
  if (!phraseList) {
    return;
  }
  if (!supportsIndexedDB) {
    phraseList.innerHTML = "";
    if (phraseEmpty) {
      phraseEmpty.hidden = false;
      phraseEmpty.textContent = "Phrasebook unavailable in this browser.";
    }
    if (clearPhrasebookBtn) {
      clearPhrasebookBtn.disabled = true;
    }
    return;
  }
  try {
    if (clearPhrasebookBtn) {
      clearPhrasebookBtn.disabled = !currentSettings.phrasebookEnabled;
    }
    if (!currentSettings.phrasebookEnabled) {
      phraseList.innerHTML = "";
      if (phraseEmpty) {
        phraseEmpty.hidden = false;
        phraseEmpty.textContent = "Phrasebook disabled in settings.";
      }
      return;
    }
    if (phraseEmpty && PHRASE_EMPTY_DEFAULT) {
      phraseEmpty.textContent = PHRASE_EMPTY_DEFAULT;
    }
    const entries = await fetchTopPhrases();
    phraseList.innerHTML = "";
    if (!entries.length) {
      if (phraseEmpty) {
        phraseEmpty.hidden = false;
      }
      return;
    }
    if (phraseEmpty) {
      phraseEmpty.hidden = true;
    }
    entries.forEach(entry => phraseList.appendChild(buildPhraseListItem(entry)));
  } catch (error) {
    console.warn("Phrasebook refresh failed", error);
  }
}

async function clearPhrasebookStore() {
  const db = await getPhrasebookDb();
  const tx = db.transaction(PHRASEBOOK_STORE, "readwrite");
  tx.objectStore(PHRASEBOOK_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function initPhrasebook() {
  if (!phraseList) {
    return;
  }
  if (!supportsIndexedDB) {
    if (phraseEmpty) {
      phraseEmpty.textContent = "Phrasebook unavailable in this browser.";
    }
    if (clearPhrasebookBtn) {
      clearPhrasebookBtn.disabled = true;
    }
    return;
  }
  refreshPhrasebookUI();
  if (clearPhrasebookBtn) {
    clearPhrasebookBtn.addEventListener("click", async () => {
      try {
        await clearPhrasebookStore();
        await refreshPhrasebookUI();
        pushToast("Phrasebook cleared");
      } catch (error) {
        pushToast("Unable to clear phrasebook", "error");
      }
    });
  }
}

function setDictationState(active) {
  isRecording = active;
  if (dictateBtn) {
    dictateBtn.classList.toggle("recording", active);
    dictateBtn.setAttribute("aria-pressed", active);
    dictateBtn.querySelector(".material-icons-round").textContent = active ? "stop_circle" : "keyboard_voice";
    dictateBtn.querySelector("span:last-child").textContent = active ? "Stop" : "Speak";
  }
}

function initSpeechControls() {
  if (dictateBtn) {
    if (!supportsSpeechRecognition) {
      dictateBtn.disabled = true;
      dictateBtn.title = "Voice input not supported in this browser.";
    } else {
      recognitionInstance = new SpeechRecognition();
      recognitionInstance.interimResults = false;
      recognitionInstance.continuous = false;
      recognitionInstance.maxAlternatives = 1;
      recognitionInstance.onresult = event => {
        const result = event.results[event.results.length - 1][0]?.transcript?.trim();
        if (result) {
          const existing = sourceText.value.trim();
          sourceText.value = existing ? `${existing} ${result}` : result;
          pushToast("Voice captured");
          scheduleAutoTranslate();
        }
      };
      recognitionInstance.onerror = event => {
        console.warn("Speech recognition error", event.error);
        pushToast("Voice capture failed", "error");
      };
      recognitionInstance.onstart = () => setDictationState(true);
      recognitionInstance.onend = () => setDictationState(false);
      dictateBtn.addEventListener("click", () => {
        if (!recognitionInstance) {
          return;
        }
        if (isRecording) {
          recognitionInstance.stop();
          return;
        }
        try {
          recognitionInstance.lang = getLocaleFromCode(sourceLang.value, "en-US");
          recognitionInstance.start();
        } catch (error) {
          console.warn("Unable to start recognition", error);
          pushToast("Microphone blocked", "error");
          setDictationState(false);
        }
      });
    }
  }

  if (speakBtn) {
    if (!supportsSpeechSynthesis) {
      speakBtn.disabled = true;
      speakBtn.title = "Speech output not supported in this browser.";
    } else {
      speakBtn.addEventListener("click", handleSpeakClick);
    }
  }
}

function handleSpeakClick() {
  if (!supportsSpeechSynthesis) {
    pushToast("Speech output unsupported", "error");
    return;
  }
  const payload = translatedText.textContent.trim();
  if (!payload) {
    pushToast("Nothing to speak", "error");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(payload);
  utterance.lang = getLocaleFromCode(targetLang.value, getLocaleFromCode(sourceLang.value, "en-US"));
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => {
    if (speakBtn) {
      speakBtn.setAttribute("aria-pressed", "false");
    }
  };
  utterance.onerror = event => {
    console.warn("Speech synthesis error", event.error);
    pushToast("Speech playback failed", "error");
    if (speakBtn) {
      speakBtn.setAttribute("aria-pressed", "false");
    }
  };
  if (speakBtn) {
    speakBtn.setAttribute("aria-pressed", "true");
  }
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

async function translateText(trigger = "auto") {
  const query = sourceText.value.trim();
  if (!query) {
    translatedText.textContent = "";
    setStatus("Waiting for input…", "Auto mode • Idle");
    return;
  }

  if (query === lastQuery && trigger === "auto") {
    return;
  }
  lastQuery = query;

  const target = targetLang.value;
  let lastError;
  setStatus("Translating…", `Sending request • ${new Date().toLocaleTimeString()}`);

  for (const provider of PROVIDERS) {
    try {
      const translated = await requestTranslation({ provider, query, source: sourceLang.value, target });
      translatedText.textContent = translated.text;
      const fromLabel = sourceLang.value === "auto" ? `${translated.detected || "Auto"} (auto)` : getLabel(sourceLang.value);
      setStatus(
        "Translated",
        `${fromLabel} → ${getLabel(target)} • ${provider.label} • ${
          trigger === "auto" ? "Auto" : "Manual"
        } @ ${new Date().toLocaleTimeString()}`
      );
      try {
        const sourceCodeForStore = sourceLang.value === "auto" ? translated.detectedCode || "auto" : sourceLang.value;
        await recordPhraseUsage({
          sourceLang: sourceCodeForStore,
          targetLang: target,
          sourceText: query,
          translatedText: translated.text,
          detected: translated.detected || getLabel(sourceCodeForStore)
        });
        await refreshPhrasebookUI();
      } catch (phraseError) {
        console.warn("Phrasebook store failed", phraseError);
      }
      return;
    } catch (error) {
      console.error(`Provider ${provider.label} failed`, error);
      lastError = error;
    }
  }

  pushToast("All translation providers failed", "error");
  setStatus("Unable to translate", lastError?.message || "Try again later");
}

async function requestTranslation({ provider, query, source, target }) {
  const params = new URLSearchParams({
    q: query,
    langpair: `${source === "auto" ? "autodetect" : source}|${target}`
  });

  const response = await fetch(provider.buildUrl(params.toString()));
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const data = await response.json();
  const translatedText = data?.responseData?.translatedText?.trim();
  if (!translatedText) {
    throw new Error("Empty translation response");
  }

  const detectedCodeRaw = data?.responseData?.detectedLanguage;
  const detectedCode = detectedCodeRaw ? detectedCodeRaw.toLowerCase() : undefined;
  return {
    text: translatedText,
    detected: getLabel(detectedCode),
    detectedCode
  };
}

function scheduleAutoTranslate() {
  if (!autoMode) {
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => translateText("auto"), 600);
}

function clearSource() {
  sourceText.value = "";
  translatedText.textContent = "";
  setStatus("Cleared", "Awaiting text");
  lastQuery = "";
  metaLine.textContent = "Auto mode • Idle";
  sourceText.focus();
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    sourceText.value = text;
    pushToast("Pasted from clipboard");
    scheduleAutoTranslate();
  } catch (error) {
    pushToast("Clipboard blocked", "error");
  }
}

async function copyToClipboard() {
  try {
    const payload = translatedText.textContent.trim();
    if (!payload) {
      pushToast("Nothing to copy", "error");
      return;
    }
    await navigator.clipboard.writeText(payload);
    pushToast("Copied translation");
  } catch (error) {
    pushToast("Copy failed", "error");
  }
}

function swapLanguages() {
  const src = sourceLang.value;
  const tgt = targetLang.value;

  if (src === "auto") {
    pushToast("Select a source language before swapping", "error");
    return;
  }

  sourceLang.value = tgt;
  targetLang.value = src;
  translateText("manual");
}

function initThemeToggle() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const stored = localStorage.getItem("theme");
  const darkMode = stored ? stored === "dark" : prefersDark;
  document.body.dataset.theme = darkMode ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", darkMode);
  themeToggle.querySelector(".material-icons-round").textContent = darkMode ? "light_mode" : "dark_mode";
  themeToggle.querySelector(".label").textContent = darkMode ? "Light" : "Dark";

  themeToggle.addEventListener("click", () => {
    const current = document.body.dataset.theme === "dark";
    document.body.dataset.theme = current ? "light" : "dark";
    localStorage.setItem("theme", current ? "light" : "dark");
    themeToggle.setAttribute("aria-pressed", !current);
    themeToggle.querySelector(".material-icons-round").textContent = current ? "dark_mode" : "light_mode";
    themeToggle.querySelector(".label").textContent = current ? "Dark" : "Light";
  });
}

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    installBanner.classList.remove("hidden");
  });

  const requestInstall = async () => {
    if (!deferredPrompt) {
      pushToast("Install not supported yet", "error");
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      pushToast("App installed");
      installBanner.classList.add("hidden");
    }
    deferredPrompt = null;
  };

  confirmInstall.addEventListener("click", requestInstall);
  installTrigger.addEventListener("click", requestInstall);
  dismissInstall.addEventListener("click", () => installBanner.classList.add("hidden"));
}

function initEvents() {
  populateLanguageSelects();
  sourceText.addEventListener("input", scheduleAutoTranslate);
  translateBtn.addEventListener("click", () => translateText("manual"));
  clearBtn.addEventListener("click", clearSource);
  pasteBtn.addEventListener("click", pasteFromClipboard);
  copyBtn.addEventListener("click", copyToClipboard);
  swapBtn.addEventListener("click", swapLanguages);
  sourceLang.addEventListener("change", () => translateText("manual"));
  targetLang.addEventListener("change", () => translateText("manual"));
  initThemeToggle();
  initInstallPrompt();
  initPhrasebook();
  setStatus("Ready", currentSettings.autoTranslate ? "Auto mode • Listening" : "Auto mode • Manual");
}

function initApp() {
  initSettingsPanel();
  initEvents();
  initSpeechControls();
}

initApp();
