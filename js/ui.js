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
//
// The iPhone Home Screen app gets none: it has no back button, and iOS
// lets an edge swipe go back and forward through the entries, sliding the
// whole app aside over a white background. There, Back and the close
// buttons do the job. (navigator.standalone is set only in that app.)
const backUsesHistory = navigator.standalone !== true;

// How to close each thing that's open, newest last
const backStack = [];
// Our own history.back() calls still to arrive as popstate
let backSkips = 0;
// Entries to add once those have arrived: adding one while a back is still
// on its way can make the browser go back past it (e.g. Settings closing
// just before Settings > Share opens the share card)
let backPushesWaiting = 0;

function backOpened(close) {
  if (!backUsesHistory) return;
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
// menu. Rules opens on an index of the game picked last (remembered):
// every entry as a row by chapter. Typing shows matching entries instead.
// Tapping an entry shows it alone, with the entries it mentions; Back (or
// the device's back) returns to where it was opened from. Tapping an illustration shows the
// entry's illustrations full screen. Both books load from rulebook/ the
// first time Rules opens.

// The book last shown (the key from when Rules had a short version)
var RULES_GAME_KEY = "rulesGame";

var RULEBOOK_NAMES = {
  base: "Base game",
  ck: "Cities & Knights"
};

var RULEBOOK_CHEVRON = '<svg class="rules-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>';

/** Set an element's text, wrapping each match of query (lowercase) in <mark>. */
function setHighlightedText(element, text, query) {
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

/** A short piece of text around the first match of query, cut at words. */
function snippetAround(text, query) {
  const at = text.toLowerCase().indexOf(query);
  if (at === -1) return text.length > 140 ? `${text.slice(0, 140).replace(/\s+\S*$/, "")}…` : text;
  let start = Math.max(0, at - 50);
  let end = Math.min(text.length, at + query.length + 90);
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(" ", end) > at ? text.lastIndexOf(" ", end) : end;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/**
 * Read a loaded book: its chapters (with the Almanac's letter labels) and
 * its entries in order, each with its body markup and searchable text.
 */
function readRulebook(container, book) {
  const chapters = [];
  const entries = [];
  container.querySelectorAll(".rulebook-chapter").forEach((section) => {
    const chapter = {
      id: section.id,
      title: section.querySelector(".rulebook-chapter-title").textContent,
      items: []
    };
    Array.from(section.children).forEach((child) => {
      if (child.classList.contains("rulebook-letter")) {
        chapter.items.push({ label: child.textContent });
      } else if (child.classList.contains("rulebook-entry")) {
        const body = child.cloneNode(true);
        body.querySelector(".rulebook-entry-head").remove();
        const page = child.querySelector(".rulebook-page");
        const entry = {
          id: child.id,
          book: book,
          title: child.dataset.title,
          page: page ? page.textContent : "",
          chapter: chapter.title,
          html: body.innerHTML,
          text: body.textContent.replace(/\s+/g, " ").trim(),
          index: entries.length
        };
        entry.search = `${entry.title} ${entry.text}`.toLowerCase();
        entries.push(entry);
        chapter.items.push({ entry: entry });
      }
    });
    chapters.push(chapter);
  });
  const byId = {};
  entries.forEach((entry) => { byId[entry.id] = entry; });
  return { chapters: chapters, entries: entries, byId: byId };
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("rulebook-dialog");
  const search = document.getElementById("rulebook-search");
  const status = document.getElementById("rulebook-status");
  const bookChoices = Array.from(dialog.querySelectorAll('input[name="rulebook-book"]'));
  const indexView = document.getElementById("rulebook-index");
  const browse = document.getElementById("rulebook-browse");
  const lists = document.getElementById("rulebook-lists");
  const jump = document.getElementById("rulebook-jump");
  const results = document.getElementById("rulebook-results");
  const resultsCount = document.getElementById("rulebook-results-count");
  const resultsOther = document.getElementById("rulebook-results-other");
  const resultsList = document.getElementById("rulebook-results-list");
  const entryView = document.getElementById("rulebook-entry");
  const entryTitle = document.getElementById("rulebook-entry-title");
  const entryBody = document.getElementById("rulebook-entry-body");
  const mentions = document.getElementById("rulebook-mentions");
  const mentionsList = document.getElementById("rulebook-mentions-list");
  const backButton = document.getElementById("rulebook-back");
  const backLabel = document.getElementById("rulebook-back-label");
  const meta = document.getElementById("rulebook-meta");
  const viewer = document.getElementById("rulebook-viewer");
  const viewerImg = document.getElementById("rulebook-viewer-img");
  const viewerCaption = document.getElementById("rulebook-viewer-caption");
  const viewerMeta = document.getElementById("rulebook-viewer-meta");
  const viewerSteps = document.getElementById("rulebook-viewer-steps");
  const viewerDots = document.getElementById("rulebook-viewer-dots");
  const viewerPrev = document.getElementById("rulebook-viewer-prev");
  const viewerNext = document.getElementById("rulebook-viewer-next");

  const books = {};
  let loading = null;
  let book = "base";
  // What shows: { view: "index" } | { view: "entry", id }
  let shown = { view: "index" };
  // Where Back goes, newest last, each with its scroll and back-button entry
  const trail = [];

  function loadBooks() {
    if (!loading) {
      status.hidden = false;
      status.textContent = "Loading the rulebook…";
      loading = Promise.all(["base", "ck"].map(async (key) => {
        const response = await fetch(`rulebook/${key}.html`);
        if (!response.ok) throw new Error(response.status);
        const holder = dialog.querySelector(`#rulebook-data [data-book="${key}"]`);
        holder.innerHTML = await response.text();
        books[key] = readRulebook(holder, key);
        holder.replaceChildren();
      })).then(() => {
        status.hidden = true;
      }, (err) => {
        // Try again next time Rules opens
        loading = null;
        status.textContent = "The rulebook couldn’t load. Check your connection and try again.";
        throw err;
      });
    }
    return loading;
  }

  // ----- The index -----

  // The Almanac's letter labels in the list, for the jump bar
  let jumpLabels = [];

  // ----- The jump bar -----
  // The Almanac's letters down the right edge while browsing, like
  // Contacts: tap one, or slide along them, and the list jumps to that
  // letter, just under the header.

  function jumpToLetter(i) {
    const label = jumpLabels[i];
    if (!label) return;
    const header = dialog.querySelector(".settings-header");
    dialog.scrollTop += label.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 8;
    Array.from(jump.children).forEach((button, n) => button.classList.toggle("is-active", n === i));
  }

  // The letter at a height on the bar, the nearest one past either end
  function letterAt(y) {
    let at = 0;
    Array.from(jump.children).forEach((button, i) => {
      if (button.getBoundingClientRect().top <= y) at = i;
    });
    return at;
  }

  let scrubbing = null;
  jump.addEventListener("pointerdown", (event) => {
    if (!jump.children.length) return;
    // No focus ring or text selection from the press
    event.preventDefault();
    try {
      jump.setPointerCapture(event.pointerId);
    } catch (err) {
      // The pointer is already gone; the tap still jumps
    }
    scrubbing = { id: event.pointerId, at: letterAt(event.clientY) };
    jump.classList.add("is-scrubbing");
    jumpToLetter(scrubbing.at);
  });
  jump.addEventListener("pointermove", (event) => {
    if (!scrubbing || event.pointerId !== scrubbing.id) return;
    const at = letterAt(event.clientY);
    if (at === scrubbing.at) return;
    scrubbing.at = at;
    jumpToLetter(at);
  });
  const endScrub = (event) => {
    if (!scrubbing || event.pointerId !== scrubbing.id) return;
    scrubbing = null;
    jump.classList.remove("is-scrubbing");
    Array.from(jump.children).forEach((button) => button.classList.remove("is-active"));
  };
  jump.addEventListener("pointerup", endScrub);
  jump.addEventListener("pointercancel", endScrub);
  // From the keyboard (a pointer press has jumped already)
  jump.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button && event.detail === 0) jumpToLetter(Number(button.dataset.index));
  });

  function renderIndex() {
    const data = books[book];
    lists.replaceChildren();
    jumpLabels = [];
    data.chapters.forEach((chapter) => {
      const section = document.createElement("section");
      section.className = "rulebook-section";
      section.id = `${chapter.id}-list`;
      const heading = document.createElement("h3");
      heading.className = "settings-section-title";
      heading.textContent = chapter.title;
      const group = document.createElement("div");
      group.className = "rulebook-group";
      chapter.items.forEach((item) => {
        if (item.label) {
          const label = document.createElement("div");
          label.className = "rulebook-group-label";
          label.textContent = item.label;
          // The Almanac's letters (not C&K's deck names) go on the jump bar
          if (item.label.length === 1) jumpLabels.push(label);
          group.append(label);
        } else {
          group.append(entryRow(item.entry));
        }
      });
      section.append(heading, group);
      lists.append(section);
    });
    jump.replaceChildren(...jumpLabels.map((label, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = i;
      button.textContent = label.textContent;
      button.setAttribute("aria-label", `Almanac, ${label.textContent}`);
      return button;
    }));
  }

  function entryRow(entry) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rulebook-row";
    row.dataset.entry = entry.id;
    const title = document.createElement("span");
    title.className = "rulebook-row-title";
    title.textContent = entry.title;
    const page = document.createElement("span");
    page.className = "rulebook-row-page";
    page.textContent = entry.page;
    row.append(title, page);
    row.insertAdjacentHTML("beforeend", RULEBOOK_CHEVRON);
    return row;
  }

  const matchesIn = (key, query) => books[key].entries.filter((entry) => entry.search.includes(query));

  function renderSearch() {
    const query = search.value.trim().toLowerCase();
    browse.hidden = query !== "";
    results.hidden = query === "";
    jump.hidden = query !== "" || jumpLabels.length === 0;
    status.hidden = true;
    if (!query) return;
    // Entries with the words in their title first, then the rest in book order
    const found = matchesIn(book, query).sort((a, b) =>
      (b.title.toLowerCase().includes(query) - a.title.toLowerCase().includes(query)) || a.index - b.index);
    const other = book === "base" ? "ck" : "base";
    const otherCount = matchesIn(other, query).length;
    const inBook = (key) => (key === "base" ? "the base game" : "Cities & Knights");
    resultsCount.textContent = found.length ? `In ${inBook(book)}` : "";
    resultsOther.hidden = otherCount === 0;
    resultsOther.textContent = `${otherCount} in ${inBook(other)}`;
    resultsList.hidden = found.length === 0;
    resultsList.replaceChildren();
    found.forEach((entry) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "rulebook-row rulebook-result";
      row.dataset.entry = entry.id;
      const head = document.createElement("span");
      head.className = "rulebook-result-head";
      const title = document.createElement("span");
      setHighlightedText(title, entry.title, query);
      const where = document.createElement("span");
      where.className = "rulebook-row-page";
      where.textContent = `${entry.chapter} · ${entry.page}`;
      head.append(title, where);
      const snippet = document.createElement("span");
      snippet.className = "rulebook-result-snippet";
      setHighlightedText(snippet, snippetAround(entry.text, query), query);
      row.append(head, snippet);
      resultsList.append(row);
    });
    if (!found.length) {
      status.hidden = false;
      status.textContent = `Nothing in ${inBook(book)} matches “${search.value.trim()}”.`;
    }
  }

  function showBook(key) {
    book = key;
    bookChoices.forEach((input) => { input.checked = input.value === key; });
    try {
      localStorage.setItem(RULES_GAME_KEY, key);
    } catch (err) {
      // Not remembered; fine
    }
    if (!books[key]) return;
    renderIndex();
    renderSearch();
  }

  // ----- One entry -----

  function renderEntry(entry) {
    entryTitle.textContent = entry.title;
    entryBody.innerHTML = entry.html;
    meta.textContent = `${RULEBOOK_NAMES[entry.book]} · ${entry.page}`;

    // Each entry its links lead to, once, in the order they come
    const seen = new Set([entry.id]);
    mentionsList.replaceChildren();
    entryBody.querySelectorAll('a[href^="#"]').forEach((link) => {
      const target = books[entry.book].byId[link.getAttribute("href").slice(1)];
      if (!target || seen.has(target.id)) return;
      seen.add(target.id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "rulebook-chip";
      chip.dataset.entry = target.id;
      chip.textContent = target.title;
      mentionsList.append(chip);
    });
    mentions.hidden = mentionsList.children.length === 0;

  }

  function labelFor(state) {
    if (state.view === "entry") return books[book].byId[state.id].title;
    return search.value.trim() ? "Results" : "Index";
  }

  function render() {
    dialog.dataset.view = shown.view;
    indexView.hidden = shown.view !== "index";
    entryView.hidden = shown.view !== "entry";
    if (shown.view === "entry") renderEntry(books[book].byId[shown.id]);
    if (trail.length) backLabel.textContent = labelFor(trail[trail.length - 1].state);
  }

  // Slide the view now showing in, from the right going forward (from = 1)
  // or the left coming back (-1), with the header's back button and page
  function slideIn(from) {
    if (prefersReducedMotion.matches) return;
    const view = indexView.hidden ? entryView : indexView;
    const timing = { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
    view.animate([
      { transform: `translateX(${from * 56}px)`, opacity: 0 },
      { transform: "none", opacity: 1 }
    ], timing);
    dialog.querySelectorAll(".settings-header > :not([hidden])").forEach((el) => {
      el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
    });
  }

  // Show something new, with Back (and the device's back) returning here
  function go(state) {
    const step = { state: shown, scroll: dialog.scrollTop };
    step.back = () => {
      const at = trail.indexOf(step);
      if (at === -1) return;
      trail.splice(at);
      shown = step.state;
      render();
      dialog.scrollTop = step.scroll;
      slideIn(-1);
      backClosed(step.back);
    };
    trail.push(step);
    backOpened(step.back);
    shown = state;
    render();
    dialog.scrollTop = 0;
    slideIn(1);
  }

  // ----- Illustrations -----

  let figures = [];
  let figureAt = 0;

  function showFigure(at) {
    figureAt = Math.max(0, Math.min(figures.length - 1, at));
    const img = figures[figureAt];
    viewerImg.src = img.src;
    viewerImg.alt = img.alt;
    viewerCaption.textContent = img.alt;
    viewerSteps.hidden = figures.length < 2;
    viewerPrev.disabled = figureAt === 0;
    viewerNext.disabled = figureAt === figures.length - 1;
    viewerDots.replaceChildren();
    figures.forEach((_, i) => {
      const dot = document.createElement("span");
      if (i === figureAt) dot.className = "is-current";
      viewerDots.append(dot);
    });
  }

  function openViewer(img) {
    figures = Array.from(entryBody.querySelectorAll(".rulebook-zoom img"));
    viewerMeta.textContent = meta.textContent ? `${entryTitle.textContent} · ${meta.textContent.split(" · ").pop()}` : "";
    showFigure(figures.indexOf(img));
    viewer.showModal();
  }

  viewerPrev.addEventListener("click", () => showFigure(figureAt - 1));
  viewerNext.addEventListener("click", () => showFigure(figureAt + 1));
  $("#rulebook-viewer-close").click(() => closeDialog(viewer));

  // Swipe between illustrations; a tap anywhere else closes
  let swipeFrom = null;
  let swiped = false;
  viewer.addEventListener("pointerdown", (event) => {
    swipeFrom = event.clientX;
    swiped = false;
  });
  viewer.addEventListener("pointerup", (event) => {
    if (swipeFrom === null) return;
    const dx = event.clientX - swipeFrom;
    swipeFrom = null;
    if (Math.abs(dx) > 40 && figures.length > 1) {
      swiped = true;
      showFigure(figureAt + (dx < 0 ? 1 : -1));
    }
  });
  viewer.addEventListener("click", (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (!event.target.closest("button")) closeDialog(viewer);
  });
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showFigure(figureAt - 1);
    if (event.key === "ArrowRight") showFigure(figureAt + 1);
  });
  viewer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(viewer);
  });

  // ----- Taps -----

  dialog.addEventListener("click", (event) => {
    const zoom = event.target.closest(".rulebook-zoom");
    if (zoom) {
      openViewer(zoom.querySelector("img"));
      return;
    }
    const link = event.target.closest('#rulebook-entry-body a[href^="#"]');
    if (link) {
      event.preventDefault();
      const id = link.getAttribute("href").slice(1);
      if (books[book].byId[id]) go({ view: "entry", id: id });
      return;
    }
    const opener = event.target.closest("[data-entry]");
    if (!opener || !opener.dataset.entry) return;
    go({ view: "entry", id: opener.dataset.entry });
  });

  backButton.addEventListener("click", () => {
    if (trail.length) trail[trail.length - 1].back();
  });

  resultsOther.addEventListener("click", () => showBook(book === "base" ? "ck" : "base"));

  bookChoices.forEach((input) => {
    input.addEventListener("change", () => {
      showBook(input.value);
      dialog.scrollTo({ top: 0 });
    });
  });
  search.addEventListener("input", () => {
    if (books[book]) renderSearch();
  });

  $("#rules-button").click(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(RULES_GAME_KEY);
    } catch (err) {
      // Storage blocked: start on the base game
    }
    book = saved === "ck" ? "ck" : "base";
    bookChoices.forEach((input) => { input.checked = input.value === book; });
    search.value = "";
    shown = { view: "index" };
    render();
    browse.hidden = false;
    results.hidden = true;
    dialog.showModal();
    dialog.scrollTop = 0;
    loadBooks().then(() => showBook(book), () => {});
  });
  $("#rulebook-close").click(() => closeDialog(dialog));
  setUpDialogClosing(dialog);

  // Closing Rules drops the way back through it, and its back entries
  dialog.addEventListener("close", () => {
    trail.splice(0).reverse().forEach((step) => backClosed(step.back));
    shown = { view: "index" };
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
