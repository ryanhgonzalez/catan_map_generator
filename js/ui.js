// ui.js – Enhanced vanilla jQuery-like helper for catan.js

function $(selectorOrElement) {
  let elements;
  
  if (typeof selectorOrElement === "string") {
    elements = Array.from(document.querySelectorAll(selectorOrElement));
  } else if (selectorOrElement instanceof Element) {
    elements = [selectorOrElement];
  } else {
    elements = [];
  }

  // Create a wrapper object that acts like jQuery
  const wrapper = Object.assign(elements, {
    // Element access via index (e.g., $("button")[0])
    // This is already handled by the array structure
    
    // .click(handler)
    click(handler) {
      elements.forEach((el) => el.addEventListener("click", handler));
      return wrapper;
    },
    
    // .attr(name, value)
    attr(name, value) {
      if (value === undefined) {
        return elements[0] ? elements[0].getAttribute(name) : null;
      }
      elements.forEach((el) => el.setAttribute(name, value));
      return wrapper;
    },
    
    // .width() - returns clientWidth of first element
    width() {
      return elements[0] ? elements[0].clientWidth : 0;
    },
    
    // .height() - returns clientHeight of first element
    height() {
      return elements[0] ? elements[0].clientHeight : 0;
    },
    
    // .val() - get/set value of form elements
    val(value) {
      if (value === undefined) {
        return elements[0] ? elements[0].value : null;
      }
      elements.forEach((el) => {
        el.value = value;
      });
      return wrapper;
    }
  });

  return wrapper;
}

// ----- Theme (system / light / dark) -----
// The saved choice is "system" (the default), "light" or "dark"; "system"
// follows the OS setting, including live changes. Runs while the <head> is
// parsing so the page never flashes the wrong theme.

const THEME_STORAGE_KEY = "theme";
const THEME_CHOICES = ["system", "light", "dark"];
// Match --page-top in the CSS so the browser bar blends into the page
const THEME_COLORS = { dark: "#111827", light: "#ffffff" };
const prefersLight = window.matchMedia("(prefers-color-scheme: light)");

function getThemeChoice() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_CHOICES.includes(saved) ? saved : "system";
  } catch (err) {
    return "system";
  }
}

function saveThemeChoice(choice) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch (err) {
    // Storage unavailable (e.g. private mode); the choice lasts this visit only
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
  }
}

function resolveTheme(choice) {
  if (choice === "light" || choice === "dark") return choice;
  return prefersLight.matches ? "light" : "dark";
}

applyTheme(resolveTheme(getThemeChoice()));

prefersLight.addEventListener("change", () => {
  if (getThemeChoice() === "system") applyTheme(resolveTheme("system"));
});

document.addEventListener("DOMContentLoaded", () => {
  // Re-apply now that <meta name="theme-color"> has been parsed
  applyTheme(resolveTheme(getThemeChoice()));

  // The Appearance radios in Settings
  const choice = getThemeChoice();
  document.querySelectorAll('input[name="theme-choice"]').forEach((input) => {
    input.checked = input.value === choice;
    input.addEventListener("change", () => {
      saveThemeChoice(input.value);
      applyTheme(resolveTheme(input.value));
    });
  });
});

// ----- Dialogs -----

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Exit animations per dialog (see "Dialog transitions" in the CSS)
const DIALOG_EXIT_ANIMATIONS = ["slide-out-right", "slide-out-down", "pop-out"];

/**
 * Close a modal <dialog> after its exit animation. Browsers animate a
 * dialog opening but close it instantly, so this adds .is-closing, waits
 * for the animation, then closes. A timer backs up the animationend event.
 */
function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains("is-closing")) return;
  if (prefersReducedMotion.matches) {
    dialog.close();
    return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    dialog.removeEventListener("animationend", onEnd);
    dialog.classList.remove("is-closing");
    dialog.close();
  };
  // Only the dialog's own exit animation, not its ::backdrop's
  const onEnd = (event) => {
    if (event.target === dialog && DIALOG_EXIT_ANIMATIONS.includes(event.animationName)) {
      finish();
    }
  };
  dialog.addEventListener("animationend", onEnd);
  dialog.classList.add("is-closing");
  setTimeout(finish, 400);
}

/**
 * Route a dialog's other ways of closing through closeDialog() so they
 * animate too:
 * - Esc (the "cancel" event, which would otherwise close it instantly)
 * - a click on the backdrop. Backdrop clicks target the dialog element
 *   itself, but so do clicks on its own padding, so this also checks the
 *   click was outside the dialog's box.
 */
function setUpDialogClosing(dialog) {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dialog);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom;
    if (outside) closeDialog(dialog);
  });
}

// ----- Settings dialog -----
// A full page on phones and a side panel on wider screens (see the CSS);
// a native <dialog> handles focus.

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("settings-dialog");

  $("#settings-button").click(() => dialog.showModal());
  $("#settings-close").click(() => closeDialog(dialog));

  // Esc, and on wider screens a click on the dimmed backdrop
  setUpDialogClosing(dialog);
});

// When DOM is ready, run the existing init() from catan.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize board history
  window.boardHistory = [];
  window.currentBoardIndex = -1;
  
  // catan.js hides the loading overlay once the first board is ready
  if (typeof init === "function") init();
});

// Register the service worker for offline support (needs http(s), not file://)
if ("serviceWorker" in navigator) {
  // When an updated service worker takes over a page it didn't serve,
  // reload once so the page matches the new version (this also rescues
  // devices stuck on a stale page from the first service worker)
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
