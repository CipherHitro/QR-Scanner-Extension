const INJECTED_FILES = ["jsqr.js", "content.js"];

chrome.action.onClicked.addListener((tab) => {
  activateScanner(tab).catch((error) => {
    console.error("Failed to activate QR scanner:", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ACTIVATE_SCANNER") {
    activateScanner()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CAPTURE_TAB") {
    const windowId = sender.tab?.windowId;

    if (!windowId) {
      sendResponse({ ok: false, error: "Could not identify the active browser window." });
      return false;
    }

    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true, dataUrl });
    });

    return true;
  }

  if (message.type === "OPEN_URL") {
    const url = normalizeHttpUrl(message.url);

    if (!url) {
      sendResponse({ ok: false, error: "That QR result is not a web URL." });
      return false;
    }

    chrome.tabs.create({ url }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true, tabId: tab.id });
    });

    return true;
  }

  return false;
});

async function activateScanner(currentTab) {
  const tab = currentTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  if (!canInjectIntoTab(tab.url)) {
    throw new Error("Chrome does not allow extensions to scan this browser page.");
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["content.css"]
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: INJECTED_FILES
  });
}

function canInjectIntoTab(url = "") {
  return /^(https?|file|ftp):/i.test(url);
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const withProtocol = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
