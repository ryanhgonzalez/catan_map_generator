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

// ----- Back button -----
// Android's back button (and the browser's) closes what's open on top (a
// page like Settings or Rules, a sheet, or the share card) instead of
// leaving the app. Each one adds a history entry when it opens; going back
// closes the newest, and closing one another way takes an entry off again.
// The entries are all alike, so only how many there are matters.

// How to close each thing that's open, newest last
const backStack = [];
// Our own history.back() calls still to arrive as popstate
let backSkips = 0;
// Entries to add once those have arrived: adding one while a back is still
// on its way can make the browser go back past it (e.g. Settings closing
// just before Settings > Share opens the share card)
let backPushesWaiting = 0;

function backOpened(close) {
  backStack.push(close);
  if (backSkips > 0) {
    backPushesWaiting += 1;
  } else {
    history.pushState({ overlay: true }, "");
  }
}

function backClosed(close) {
  const at = backStack.indexOf(close);
  // Already off the stack: it was closed by going back
  if (at === -1) return;
  backStack.splice(at, 1);
  if (backPushesWaiting > 0) {
    // Its entry was never added
    backPushesWaiting -= 1;
    return;
  }
  backSkips += 1;
  history.back();
}

window.addEventListener("popstate", () => {
  if (backSkips > 0) {
    backSkips -= 1;
    if (backSkips === 0) {
      for (; backPushesWaiting > 0; backPushesWaiting -= 1) {
        history.pushState({ overlay: true }, "");
      }
    }
  } else if (backStack.length > 0) {
    backStack.pop()();
  }
  // The entry gone back to may carry an older ?board=
  if (typeof syncAddressBar === "function") syncAddressBar();
});

// Every dialog (Settings, Rules, Install) joins in as it opens and closes
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("dialog").forEach((dialog) => {
    const close = () => closeDialog(dialog);
    new MutationObserver(() => {
      if (dialog.open && !backStack.includes(close)) backOpened(close);
    }).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    dialog.addEventListener("close", () => backClosed(close));
  });
});

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

// ----- Rules page -----
// Opened from the book button in the header, laid out like Settings, with
// a switch between the base game and Cities & Knights (remembered).
// Searching shows only the entries that match in the game showing, in
// their sections, with the matches highlighted.

var RULES_GAME_KEY = "rulesGame";

/**
 * Open or close a rules section, sliding its entries open or shut (from
 * wherever they are, if it's mid-slide). <details> alone just snaps.
 */
function toggleRulesSection(section, opening) {
  const body = section.querySelector(".rules-entries");
  section.classList.toggle("is-expanded", opening);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Mid-slide: start from the height it's at now
  const from = section.open ? body.getBoundingClientRect().height : 0;
  if (section.slide) section.slide.cancel();
  section.open = true;
  const to = opening ? body.scrollHeight : 0;
  if (reduced) {
    section.open = opening;
    return;
  }
  body.style.overflow = "hidden";
  const slide = body.animate([
    { height: `${from}px`, opacity: opening ? 0.4 : 1 },
    { height: `${to}px`, opacity: opening ? 1 : 0 }
  ], {
    duration: opening ? 320 : 260,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  });
  section.slide = slide;
  slide.onfinish = () => {
    section.slide = null;
    body.style.overflow = "";
    section.open = opening;
  };
}

/**
 * Slide a hidden panel open, or shut and hidden again, by animating its
 * height (from wherever it is, if it's mid-slide).
 */
function slidePanel(panel, opening) {
  const from = panel.hidden ? 0 : panel.getBoundingClientRect().height;
  if (panel.slide) panel.slide.cancel();
  panel.hidden = false;
  const to = opening ? panel.scrollHeight : 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    panel.hidden = !opening;
    return;
  }
  panel.style.overflow = "hidden";
  const slide = panel.animate([
    { height: `${from}px`, opacity: opening ? 0.4 : 1 },
    { height: `${to}px`, opacity: opening ? 1 : 0 }
  ], {
    duration: opening ? 320 : 260,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  });
  panel.slide = slide;
  slide.onfinish = () => {
    panel.slide = null;
    panel.style.overflow = "";
    panel.hidden = !opening;
  };
}

/** Set an element's text, wrapping each match of query in <mark>. */
function highlightText(element, text, query) {
  element.replaceChildren();
  if (!query) {
    element.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  let from = 0;
  let at = lower.indexOf(query);
  while (at !== -1) {
    element.append(text.slice(from, at));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(at, at + query.length);
    element.append(mark);
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  element.append(text.slice(from));
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("rules-dialog");
  const search = document.getElementById("rules-search");
  const empty = document.getElementById("rules-empty");
  const sections = Array.from(dialog.querySelectorAll(".rules-section"));
  // Each entry's heading and text, kept to search and re-highlight
  const entries = Array.from(dialog.querySelectorAll(".rules-entry")).map((entry) => ({
    entry: entry,
    section: entry.closest(".rules-section"),
    game: entry.closest(".rules-game"),
    parts: Array.from(entry.querySelectorAll("h4, p")).map((el) => ({ el: el, text: el.textContent }))
  }));
  const games = Array.from(dialog.querySelectorAll(".rules-game"));
  const gameChoices = Array.from(dialog.querySelectorAll('input[name="rules-game"]'));

  // Base game or Cities & Knights; the search applies to whichever shows
  const showGame = (game) => {
    games.forEach((el) => { el.hidden = el.dataset.game !== game; });
    gameChoices.forEach((input) => { input.checked = input.value === game; });
    try {
      localStorage.setItem(RULES_GAME_KEY, game);
    } catch (err) {
      // Not remembered; fine
    }
    search.dispatchEvent(new Event("input"));
  };
  gameChoices.forEach((input) => {
    input.addEventListener("change", () => showGame(input.value));
  });
  let savedGame = null;
  try {
    savedGame = localStorage.getItem(RULES_GAME_KEY);
  } catch (err) {
    // Storage blocked: start on the base game
  }

  // Sections slide open and shut instead of snapping
  sections.forEach((section) => {
    section.querySelector("summary").addEventListener("click", (event) => {
      event.preventDefault();
      toggleRulesSection(section, !section.classList.contains("is-expanded"));
    });
  });

  $("#rules-button").click(() => dialog.showModal());
  $("#rules-close").click(() => closeDialog(dialog));
  setUpDialogClosing(dialog);

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    dialog.classList.toggle("is-searching", query !== "");
    let found = 0;
    entries.forEach((item) => {
      const match = !query ||
        item.parts.some((part) => part.text.toLowerCase().includes(query));
      item.entry.hidden = !match;
      if (match && query && !item.game.hidden) found += 1;
      item.parts.forEach((part) => highlightText(part.el, part.text, match ? query : ""));
    });
    // Sections with matches open; the rest hide. Cleared, all close again.
    sections.forEach((section) => {
      const hasMatch = entries.some((item) => item.section === section && !item.entry.hidden);
      // Drop any slide in progress (cancel, unlike finish, skips its end)
      if (section.slide) {
        section.slide.cancel();
        section.slide = null;
        section.querySelector(".rules-entries").style.overflow = "";
      }
      section.hidden = query !== "" && !hasMatch;
      section.open = query !== "" && hasMatch;
      section.classList.toggle("is-expanded", section.open);
    });
    empty.hidden = !query || found > 0;
    empty.textContent = `No rules match “${search.value.trim()}”.`;
  });

  if (savedGame === "ck") showGame("ck");
});

// When DOM is ready, run init() from catan.js. It hides the loading
// overlay once the first board is ready.
document.addEventListener("DOMContentLoaded", () => {
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
