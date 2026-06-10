(function () {
  if (window.__qrCodeAreaScanner?.start) {
    window.__qrCodeAreaScanner.start();
    return;
  }

  const MIN_SELECTION_SIZE = 18;
  let overlay = null;
  let selection = null;
  let hint = null;
  let toast = null;
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let activeBounds = null;

  window.__qrCodeAreaScanner = {
    start
  };

  start();

  function start() {
    removeToast();
    cleanupOverlay();

    overlay = document.createElement("div");
    overlay.id = "qr-scanner-overlay";

    hint = document.createElement("div");
    hint.id = "qr-scanner-hint";
    hint.textContent = "Drag to select the QR code area. Press Esc to cancel.";
    overlay.appendChild(hint);

    selection = document.createElement("div");
    selection.id = "qr-scanner-selection";
    document.documentElement.append(overlay, selection);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;

    isDrawing = true;
    startX = event.clientX;
    startY = event.clientY;
    activeBounds = makeBounds(startX, startY, startX, startY);
    drawSelection(activeBounds);
    event.preventDefault();
  }

  function onMouseMove(event) {
    if (!isDrawing) return;

    activeBounds = makeBounds(startX, startY, event.clientX, event.clientY);
    drawSelection(activeBounds);
    event.preventDefault();
  }

  async function onMouseUp(event) {
    if (!isDrawing) return;

    isDrawing = false;
    activeBounds = makeBounds(startX, startY, event.clientX, event.clientY);

    if (activeBounds.width < MIN_SELECTION_SIZE || activeBounds.height < MIN_SELECTION_SIZE) {
      cleanupOverlay();
      showToast({
        title: "Selection too small",
        message: "Select the whole QR code with a little margin around it.",
        actions: [{ label: "Try Again", primary: true, onClick: start }]
      });
      return;
    }

    selection.classList.add("is-processing");
    hideBeforeCapture();

    try {
      await delay(120);
      const response = await sendMessage({ type: "CAPTURE_TAB" });

      if (!response?.ok) {
        throw new Error(response?.error || "Screenshot capture failed.");
      }

      const result = await cropAndDecode(response.dataUrl, activeBounds);
      cleanupOverlay();

      if (!result) {
        showToast({
          title: "No QR code detected",
          message: "Try selecting a larger area, including the quiet white border around the QR code.",
          actions: [
            { label: "Try Again", primary: true, onClick: start },
            { label: "Close", onClick: removeToast }
          ]
        });
        return;
      }

      const copied = await copyToClipboard(result.data);
      showSuccess(result.data, copied);
    } catch (error) {
      cleanupOverlay();
      showToast({
        title: "QR scan failed",
        message: error.message || "Something went wrong while scanning this area.",
        actions: [
          { label: "Try Again", primary: true, onClick: start },
          { label: "Close", onClick: removeToast }
        ]
      });
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      cleanupOverlay();
    }
  }

  function makeBounds(x1, y1, x2, y2) {
    const left = clamp(Math.min(x1, x2), 0, window.innerWidth);
    const top = clamp(Math.min(y1, y2), 0, window.innerHeight);
    const right = clamp(Math.max(x1, x2), 0, window.innerWidth);
    const bottom = clamp(Math.max(y1, y2), 0, window.innerHeight);

    return {
      left,
      top,
      width: right - left,
      height: bottom - top
    };
  }

  function drawSelection(bounds) {
    selection.style.display = "block";
    selection.style.left = `${bounds.left}px`;
    selection.style.top = `${bounds.top}px`;
    selection.style.width = `${bounds.width}px`;
    selection.style.height = `${bounds.height}px`;
  }

  function hideBeforeCapture() {
    if (overlay) overlay.style.display = "none";
    if (hint) hint.style.display = "none";
    if (selection) selection.style.display = "none";
  }

  async function cropAndDecode(dataUrl, bounds) {
    const img = await loadImage(dataUrl);
    const scaleX = img.naturalWidth / window.innerWidth;
    const scaleY = img.naturalHeight / window.innerHeight;
    const sourceX = Math.round(bounds.left * scaleX);
    const sourceY = Math.round(bounds.top * scaleY);
    const sourceWidth = Math.max(1, Math.round(bounds.width * scaleX));
    const sourceHeight = Math.max(1, Math.round(bounds.height * scaleY));
    const canvas = document.createElement("canvas");

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);

    return window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });
  }

  function showSuccess(text, copied) {
    const isUrl = getHttpUrl(text);
    const actions = [];

    if (isUrl) {
      actions.push({
        label: "Open Link",
        primary: true,
        onClick: async () => {
          removeToast();

          try {
            await sendMessage({ type: "OPEN_URL", url: text });
          } catch (error) {
            showToast({
              title: "Could not open link",
              message: error.message || "The browser blocked this link.",
              actions: [{ label: "Close", onClick: removeToast }]
            });
          }
        }
      });
    }

    actions.push(
      {
        label: copied ? "Copied" : "Copy",
        onClick: async (button) => {
          const ok = await copyToClipboard(text);
          button.textContent = ok ? "Copied" : "Copy Failed";
        }
      },
      { label: "Scan Again", onClick: start },
      { label: "Close", onClick: removeToast }
    );

    showToast({
      title: "QR code found",
      result: text,
      message: copied ? "Result copied to clipboard." : "Copy the result from here if clipboard access is blocked.",
      actions
    });
  }

  function showToast({ title, message, result, actions = [] }) {
    removeToast();

    toast = document.createElement("div");
    toast.id = "qr-scanner-toast";

    const titleElement = document.createElement("h2");
    titleElement.className = "qr-scanner-title";
    titleElement.textContent = title;
    toast.appendChild(titleElement);

    if (result) {
      const resultElement = document.createElement("div");
      resultElement.className = "qr-scanner-result";
      resultElement.textContent = result;
      toast.appendChild(resultElement);
    }

    if (message) {
      const messageElement = document.createElement("p");
      messageElement.className = "qr-scanner-message";
      messageElement.textContent = message;
      toast.appendChild(messageElement);
    }

    const actionsElement = document.createElement("div");
    actionsElement.className = "qr-scanner-actions";

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;

      if (action.primary) {
        button.className = "qr-primary";
      }

      button.addEventListener("click", () => action.onClick(button));
      actionsElement.appendChild(button);
    }

    toast.appendChild(actionsElement);
    document.documentElement.appendChild(toast);
  }

  function cleanupOverlay() {
    isDrawing = false;
    activeBounds = null;

    if (overlay) {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      overlay.remove();
    }

    selection?.remove();
    document.removeEventListener("keydown", onKeyDown, true);
    overlay = null;
    selection = null;
    hint = null;
  }

  function removeToast() {
    toast?.remove();
    toast = null;
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the captured screenshot."));
      image.src = dataUrl;
    });
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.documentElement.appendChild(area);
    area.focus();
    area.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }

  function getHttpUrl(value) {
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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
