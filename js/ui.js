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
const DIALOG_EXIT_ANIMATIONS = ["slide-out-right", "slide-out-down", "pop-out", "viewer-out"];

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

// ----- Header menu -----
// The menu button drops Rules and Settings down under it. A tap anywhere
// else, Esc, the back button or picking one of them closes it.

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".app-header");
  const toggle = document.getElementById("menu-button");
  const items = document.getElementById("header-menu-items");
  let hideTimer = null;

  function openMenu() {
    if (toggle.getAttribute("aria-expanded") === "true") return;
    clearTimeout(hideTimer);
    items.hidden = false;
    header.classList.add("menu-shown");
    // Let the hidden state render first, so the buttons slide in
    void items.offsetWidth;
    header.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    backOpened(closeMenu);
  }

  function closeMenu() {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    // Hide once the buttons have faded out (see .header-menu-item)
    hideTimer = setTimeout(() => {
      items.hidden = true;
      header.classList.remove("menu-shown");
    }, prefersReducedMotion.matches ? 0 : 220);
    backClosed(closeMenu);
  }

  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") closeMenu();
    else openMenu();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".header-menu")) closeMenu();
  });
  // Rules and Settings open their own pages (below) as the menu closes
  items.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      toggle.focus();
    }
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

// ----- Sliding panels -----

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

// ----- Rules page -----
// The official rulebooks word for word, opened from Rules in the header
// menu, with a switch between the base game and Cities & Knights
// (remembered). Each book loads from rulebook/<book>.html the first time it
// shows. A ✷ cross-reference jumps to its entry, and a button at the
// bottom goes back to where you were. Tapping an illustration shows it
// full screen.

// The book last shown (the key from when Rules had a short version)
var RULES_GAME_KEY = "rulesGame";

var RULEBOOK_TITLES = {
  base: "CATAN, word for word",
  ck: "Cities & Knights, word for word"
};

/**
 * Wrap each match of query (lowercase) in the element's text in <mark>,
 * leaving its links and other markup as they are.
 */
function highlightMatches(element, query) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let at = lower.indexOf(query);
    if (at === -1) return;
    const parts = document.createDocumentFragment();
    let from = 0;
    while (at !== -1) {
      parts.append(text.slice(from, at));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(at, at + query.length);
      parts.append(mark);
      from = at + query.length;
      at = lower.indexOf(query, from);
    }
    parts.append(text.slice(from));
    node.replaceWith(parts);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("rulebook-dialog");
  const subtitle = document.getElementById("rulebook-subtitle");
  const search = document.getElementById("rulebook-search");
  const status = document.getElementById("rulebook-status");
  const returnButton = document.getElementById("rulebook-return");
  const books = Array.from(dialog.querySelectorAll(".rulebook-book"));
  const bookChoices = Array.from(dialog.querySelectorAll('input[name="rulebook-book"]'));
  const viewer = document.getElementById("rulebook-viewer");
  const viewerImg = document.getElementById("rulebook-viewer-img");
  const viewerCaption = document.getElementById("rulebook-viewer-caption");
  // Each loaded book's entries, with their markup kept to re-highlight
  const entriesByBook = {};
  let current = "base";
  // Where a cross-reference was followed from
  let returnTo = null;

  const bookEl = (book) => books.find((el) => el.dataset.book === book);

  async function loadBook(book) {
    if (entriesByBook[book]) return;
    const el = bookEl(book);
    status.hidden = false;
    status.textContent = "Loading the rulebook…";
    try {
      const response = await fetch(`rulebook/${book}.html`);
      if (!response.ok) throw new Error(response.status);
      el.innerHTML = await response.text();
      entriesByBook[book] = Array.from(el.querySelectorAll(".rulebook-entry")).map((entry) => ({
        entry: entry,
        html: entry.innerHTML,
        text: entry.textContent.toLowerCase()
      }));
      status.hidden = true;
    } catch (err) {
      status.textContent = "The rulebook couldn’t load. Check your connection and try again.";
    }
  }

  async function showBook(book) {
    current = book;
    books.forEach((el) => { el.hidden = el.dataset.book !== book; });
    bookChoices.forEach((input) => { input.checked = input.value === book; });
    subtitle.textContent = RULEBOOK_TITLES[book];
    try {
      localStorage.setItem(RULES_GAME_KEY, book);
    } catch (err) {
      // Not remembered; fine
    }
    hideReturn();
    await loadBook(book);
    applySearch();
  }

  function applySearch() {
    const entries = entriesByBook[current];
    if (!entries) return;
    const el = bookEl(current);
    const query = search.value.trim().toLowerCase();
    dialog.classList.toggle("is-searching", query !== "");
    let found = 0;
    entries.forEach((item) => {
      const match = !query || item.text.includes(query);
      item.entry.hidden = !match;
      item.entry.innerHTML = item.html;
      if (match && query) {
        found += 1;
        highlightMatches(item.entry, query);
      }
    });
    // Chapter titles and letters show only with a matching entry under them
    el.querySelectorAll(".rulebook-chapter").forEach((chapter) => {
      chapter.hidden = !chapter.querySelector(".rulebook-entry:not([hidden])");
    });
    el.querySelectorAll(".rulebook-letter").forEach((letter) => {
      let next = letter.nextElementSibling;
      let any = false;
      while (next && !next.classList.contains("rulebook-letter")) {
        if (next.classList.contains("rulebook-entry") && !next.hidden) any = true;
        next = next.nextElementSibling;
      }
      letter.hidden = !any;
    });
    status.hidden = !query || found > 0;
    if (query && found === 0) status.textContent = `Nothing in the rulebook matches “${search.value.trim()}”.`;
  }

  function hideReturn() {
    returnTo = null;
    returnButton.classList.remove("is-shown");
  }

  // Scroll an entry or chapter to the top, below the sticky header
  function jumpTo(target) {
    const header = dialog.querySelector(".settings-header");
    const top = target.getBoundingClientRect().top - dialog.getBoundingClientRect().top +
      dialog.scrollTop - header.offsetHeight - 12;
    dialog.scrollTo({ top: top, behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
    target.classList.remove("is-flashing");
    void target.offsetWidth;
    target.classList.add("is-flashing");
  }

  dialog.addEventListener("click", (event) => {
    const zoom = event.target.closest(".rulebook-zoom");
    if (zoom) {
      const img = zoom.querySelector("img");
      viewerImg.src = img.src;
      viewerImg.alt = img.alt;
      viewerCaption.textContent = img.alt;
      viewer.showModal();
      return;
    }
    const link = event.target.closest('.rulebook-book a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    // A link found while searching leads into the whole book again
    if (search.value) {
      search.value = "";
      applySearch();
    }
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    const from = link.closest(".rulebook-entry");
    returnTo = { top: dialog.scrollTop };
    returnButton.textContent = from ? `← Back to ${from.dataset.title}` : "← Back to contents";
    returnButton.classList.add("is-shown");
    returnButton.tabIndex = 0;
    jumpTo(target);
  });

  returnButton.addEventListener("click", () => {
    if (returnTo) {
      dialog.scrollTo({ top: returnTo.top, behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
    }
    hideReturn();
    returnButton.tabIndex = -1;
  });

  bookChoices.forEach((input) => {
    input.addEventListener("change", () => {
      showBook(input.value);
      dialog.scrollTo({ top: 0 });
    });
  });
  search.addEventListener("input", () => {
    hideReturn();
    applySearch();
  });

  $("#rules-button").click(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(RULES_GAME_KEY);
    } catch (err) {
      // Storage blocked: start on the base game
    }
    search.value = "";
    dialog.showModal();
    dialog.scrollTop = 0;
    showBook(saved === "ck" ? "ck" : "base");
  });
  $("#rulebook-close").click(() => closeDialog(dialog));
  setUpDialogClosing(dialog);

  // The illustration viewer closes with a tap anywhere, Esc or back
  viewer.addEventListener("click", () => closeDialog(viewer));
  viewer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(viewer);
  });
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
