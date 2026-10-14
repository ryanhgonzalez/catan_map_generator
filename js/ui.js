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

// When DOM is ready, run the existing init() from catan.js
// ----- Theme (light / dark) -----
// A saved choice wins; otherwise follow the OS preference. Runs while the
// <head> is parsing so the page never flashes the wrong theme.

const THEME_STORAGE_KEY = "theme";
const THEME_COLORS = { dark: "#0f172a", light: "#ffffff" };
const prefersLight = window.matchMedia("(prefers-color-scheme: light)");

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    const next = theme === "light" ? "dark" : "light";
    toggle.setAttribute("aria-label", "Switch to " + next + " theme");
  }
}

function resolveTheme() {
  const saved = getSavedTheme();
  if (saved === "light" || saved === "dark") return saved;
  return prefersLight.matches ? "light" : "dark";
}

applyTheme(resolveTheme());

// Track OS changes until the user picks a theme themselves
prefersLight.addEventListener("change", () => {
  if (!getSavedTheme()) applyTheme(resolveTheme());
});

document.addEventListener("DOMContentLoaded", () => {
  // Re-apply now that the toggle button exists so its label is right
  applyTheme(resolveTheme());

  $("#theme-toggle").click(() => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    saveTheme(next);
    applyTheme(next);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // Initialize board history
  window.boardHistory = [];
  window.currentBoardIndex = -1;
  
  if (typeof init === "function") {
    init();
    
    // Hide loading overlay after a brief delay to let first render complete
    setTimeout(() => {
      const mapLoading = document.getElementById("map-loading-state");
      if (mapLoading) {
        mapLoading.style.opacity = "0";
        mapLoading.style.transition = "opacity 300ms ease-out";
        mapLoading.style.pointerEvents = "none";
        setTimeout(() => {
          mapLoading.remove();
        }, 300);
      }
    }, 500);
  }
});

// Register the service worker for offline support (needs http(s), not file://)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
