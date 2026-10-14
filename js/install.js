// install.js – Offer to install the app (PWA) when it's open in a browser.
//
// - Chrome, Edge and Android fire "beforeinstallprompt"; we keep the event
//   and show our own screen whose Install button triggers the browser's
//   real install prompt.
// - iPhone and iPad can't install from a button, so the screen shows the
//   Share > Add to Home Screen steps instead.
// - Other browsers (desktop Firefox, desktop Safari) get nothing.
//
// The screen shows itself once a short while after load, then stays away
// for a month after it's dismissed. Settings > App > Install app reopens it
// any time it's available.

const INSTALL_DISMISSED_KEY = "installPromptDismissedAt";
const INSTALL_REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const INSTALL_AUTO_SHOW_DELAY_MS = 2000;

// The browser's deferred install prompt (Chrome / Edge / Android only)
let deferredInstallPrompt = null;
let installAutoShowScheduled = false;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true; // iOS Safari's own flag
}

function isIOSDevice() {
  // iPadOS reports itself as a Mac, but Macs have no touch screen
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function installDismissedRecently() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return dismissedAt > 0 && Date.now() - dismissedAt < INSTALL_REMIND_AFTER_MS;
  } catch (err) {
    return false;
  }
}

function rememberInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  } catch (err) {
    // Storage unavailable; the screen may show again next visit
  }
}

/**
 * Show the install screen: an Install button when the browser can prompt,
 * otherwise (iOS) the Add to Home Screen steps.
 */
function openInstallDialog() {
  const dialog = document.getElementById("install-dialog");
  if (!dialog || dialog.open) return;

  const canPrompt = !!deferredInstallPrompt;
  if (!canPrompt && !isIOSDevice()) return;
  document.getElementById("install-ios-steps").hidden = canPrompt;
  document.getElementById("install-confirm").hidden = !canPrompt;
  const dismiss = document.getElementById("install-dismiss");
  dismiss.textContent = canPrompt ? "Not now" : "Got it";
  dismiss.className = "btn " + (canPrompt ? "btn-secondary" : "btn-primary");

  dialog.showModal();
}

/**
 * Called once installing is possible: reveal the Settings entry and, unless
 * dismissed recently, show the screen after a short delay.
 */
function offerInstall() {
  if (isAppInstalled()) return;

  document.getElementById("install-section").hidden = false;

  if (installAutoShowScheduled || installDismissedRecently()) return;
  installAutoShowScheduled = true;
  setTimeout(() => {
    // Don't stack it on top of settings or the share card
    if (!document.querySelector("dialog[open]") && !isAppInstalled()) {
      openInstallDialog();
    }
  }, INSTALL_AUTO_SHOW_DELAY_MS);
}

function whenDomReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  // Keep the browser's own mini prompt from showing; ours replaces it
  event.preventDefault();
  deferredInstallPrompt = event;
  whenDomReady(offerInstall);
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  const section = document.getElementById("install-section");
  if (section) section.hidden = true;
  const dialog = document.getElementById("install-dialog");
  if (dialog && dialog.open) closeDialog(dialog);
});

whenDomReady(() => {
  const dialog = document.getElementById("install-dialog");

  // Closing without installing (Not now, Got it, Esc, backdrop) counts as
  // dismissing, which pauses the automatic prompt for a month
  setUpDialogClosing(dialog);
  dialog.addEventListener("close", rememberInstallDismissed);

  $("#install-dismiss").click(() => closeDialog(dialog));
  $("#install-open").click(openInstallDialog);

  $("#install-confirm").click(async () => {
    if (!deferredInstallPrompt) return;
    const promptEvent = deferredInstallPrompt;
    // A prompt can only be used once
    deferredInstallPrompt = null;
    closeDialog(dialog);
    promptEvent.prompt();
    await promptEvent.userChoice;
    // Installed or cancelled, this prompt is spent. If the browser offers
    // install again later, beforeinstallprompt brings the entry back.
    document.getElementById("install-section").hidden = true;
  });

  // iOS never fires beforeinstallprompt; it can always add to home screen
  if (isIOSDevice()) offerInstall();
});
