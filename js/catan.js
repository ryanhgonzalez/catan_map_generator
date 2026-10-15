// ----- Canvas globals -----

var mapCanvas;
var drawingContext;

var canvasCenterX;
var canvasCenterY;
// Canvas size in CSS pixels (the backing store is scaled by devicePixelRatio)
var canvasWidth;
var canvasHeight;

// ----- Hexagon drawing parameters -----

var mapStyle = "retro";

var size = null;
var defaultFillStyle = "#ffffff";
var strokeStyle = "#000000";
var lineWidth = 3;
var resourceTypeToColor = {
	"ore": "#363636",
	"clay": "#E83200",
	"wool": "#98E82E",
	"wood": "#0A7300",
	"grain": "#E0E000",
	"desert": "#F2F0A0",
	"none": "#ffffff"
};
var resourceTypeToImageCanvas = {
	"ore": null,
	"clay": null,
	"wool": null,
	"wood": null,
	"grain": null,
	"desert": null
};

const RESOURCE_TO_CODE = {
    "desert": 0,
    "wood": 1,
    "clay": 2,
    "wool": 3,
    "grain": 4,
    "ore": 5
};

const CODE_TO_RESOURCE = {
    0: "desert",
    1: "wood",
    2: "clay",
    3: "wool",
    4: "grain",
    5: "ore"
};


//var allImagesLoaded = false;

// ----- Grid layout globals -----

var dx = size * (1 + Math.cos(Math.PI/3)) / 2;
var dy = size * Math.sin(Math.PI/3);

/*
 * Formula:
 * 
 * Height = (coordSpacing + 2) * dy
 *        = (coordSpacing + 2) * Math.sin(Math.PI/3) * size
 * Size = Height / ( (coordSpacing + 2) * Math.sin(Math.PI/3) )
 * 
 * Width = (coordSpacing * dx) + (2 * size)
 *       = (coordSpacing * (1 + Math.cos(Math.PI/3)) / 2 * size) + (2 * size)
 *       = ( (coordSpacing * (1 + Math.cos(Math.PI/3)) / 2) + 2 ) * size
 * Size = Width / ( (coordSpacing * (1 + Math.cos(Math.PI/3)) / 2) + 2 )
*/

// ----- Map definition globals -----

var catanMap = new CatanMap();

var normalMap = new MapDefinition();
normalMap.resourceDict = {
	"desert": 1,
	"wood": 4,
	"clay": 3,
	"wool": 4,
	"grain": 4,
	"ore": 3
};
normalMap.numberDict = {
	2: 1,
	3: 2,
	4: 2,
	5: 2,
	6: 2,
	8: 2,
	9: 2,
	10: 2,
	11: 2,
	12: 1
}
normalMap.coordinatesArray = [
	[-4,2],[-4,0],[-4,-2],
	[-2,3],[-2,1],[-2,-1],[-2,-3],
	[0,4],[0,2],[0,0],[0,-2],[0,-4],
	[2,3],[2,1],[2,-1],[2,-3],
	[4,2],[4,0],[4,-2]
];
// 4 generic 3:1 harbors plus one 2:1 harbor per resource
normalMap.harborTypes = [
	"any", "any", "any", "any",
	"wood", "clay", "wool", "grain", "ore"
];

var expandedMap = new MapDefinition();
expandedMap.resourceDict = {
	"desert": 2,
	"wood": 6,
	"clay": 5,
	"wool": 6,
	"grain": 6,
	"ore": 5
}
expandedMap.numberDict = {
	2: 2,
	3: 3,
	4: 3,
	5: 3,
	6: 3,
	8: 3,
	9: 3,
	10: 3,
	11: 3,
	12: 2
}
expandedMap.coordinatesArray = [
	[-6,2],[-6,0],[-6,-2],
	[-4,3],[-4,1],[-4,-1],[-4,-3],
	[-2,4],[-2,2],[-2,0],[-2,-2],[-2,-4],
	[0,5],[0,3],[0,1],[0,-1],[0,-3],[0,-5],
	[2,4],[2,2],[2,0],[2,-2],[2,-4],
	[4,3],[4,1],[4,-1],[4,-3],
	[6,2],[6,0],[6,-2]
];
// The 5-6 player extension adds one 3:1 harbor and a second 2:1 wool harbor
expandedMap.harborTypes = [
	"any", "any", "any", "any", "any",
	"wood", "clay", "wool", "wool", "grain", "ore"
];

// ----- Harbor geometry -----

// Neighbor offsets in grid coordinates, clockwise from the top edge. A
// harbor sits on the edge of a coastal tile facing one of these directions.
var HEX_DIRECTIONS = [[0,-2],[2,-1],[2,1],[0,2],[-2,1],[-2,-1]];

// A harbor is a dock: a wedge whose inner side is the coastal edge itself
// (so it spans the two corners that trade there). In units of the hex
// size: how far it reaches out to sea, and half the width of its outer side.
var HARBOR_DEPTH = 0.42;
var HARBOR_OUTER_HALF_WIDTH = 0.28;

var showHarbors = true;

// Hide the number tokens to see the resource layout on its own
var showNumbers = true;

// Mark the strongest settlement spots on the board
var showBestSpots = false;
var BEST_SPOT_COUNT = 3;

// ----- Balance rules -----

// Which placement rules the generator enforces; the switches in the
// controls card change these and they're saved per device
var balanceRules = {
	separate68: true,         // no 6 or 8 touching another 6 or 8
	separate212: false,       // no 2 or 12 touching another 2 or 12
	separateResources: false, // no two tiles of the same resource touching
	desertCenter: false       // desert(s) in the middle of the board
};

// Hexes used by "Desert in the center": the middle hex of the standard
// board, and the two middle hexes of the 5-6 player board
normalMap.centerCoords = [[0,0]];
expandedMap.centerCoords = [[0,1],[0,-1]];

// Cap on placement attempts per solve, so impossible rule combinations
// give up quickly instead of hanging
var MAX_SOLVER_STEPS = 5000;
var SOLVER_TRIES = 5;

// ----- Fairness score -----

// Dots on each number token: how many of the 36 dice combinations roll it
var PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

// Score thresholds, set from 5,000 generated boards per map so a typical
// board (default rules) scores about 7 and roughly 1 in 12 scores 9+.
// Resource balance: how far the worst-off resource's dots stray from its
// fair share for its tile count before that part scores 0 (typical: 30%).
var BALANCE_RESOURCE_LIMIT = 0.7;
// Hot spots: the richest corner's dots. At or under OK scores full marks;
// at MAX or above scores 0. With 6 & 8 apart the richest is usually 12-13.
var BALANCE_SPOT_OK = 12;
var BALANCE_SPOT_MAX = 15;

function pipsFor(number) {
	return PIPS[number] || 0;
}

function clamp01(x) {
	return Math.max(0, Math.min(1, x));
}

function capitalize(word) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

var BALANCE_RULES_STORAGE_KEY = "balanceRules";

function loadBalanceRules() {
	try {
		return JSON.parse(localStorage.getItem(BALANCE_RULES_STORAGE_KEY)) || {};
	} catch (err) {
		return {};
	}
}

function saveBalanceRules() {
	try {
		localStorage.setItem(BALANCE_RULES_STORAGE_KEY, JSON.stringify(balanceRules));
	} catch (err) {
		// Storage unavailable (e.g. private mode); rules last this visit only
	}
}

function isHot(number) {
	return number === 6 || number === 8;
}

function isRare(number) {
	return number === 2 || number === 12;
}

// Fisher-Yates shuffle into a new array
function shuffle(arr) {
	var out = arr.slice();
	for (var i = out.length - 1; i > 0; i -= 1) {
		var j = Math.floor(Math.random() * (i + 1));
		var tmp = out[i];
		out[i] = out[j];
		out[j] = tmp;
	}
	return out;
}

/**
 * Randomly assign values from a pool to hexes so that no two touching hexes
 * clash, backtracking out of dead ends. Returns {hexKey: value}.
 *
 * keys:      hex keys to fill, in board order (neighbors close together
 *            makes dead ends show up early)
 * pool:      [[value, count], ...], counts summing to keys.length
 * clashes:   function(a, b) -> true if a and b can't touch; null for none
 * neighbors: {hexKey: [neighborKey, ...]}
 * ruleName:  for the warning if the rules can't be met
 *
 * If the rules can't be met within the step cap, they're dropped for this
 * board rather than hanging.
 */
function solveAssignment(keys, pool, clashes, neighbors, ruleName) {
	for (var attempt = 0; attempt < SOLVER_TRIES; attempt += 1) {
		var result = trySolve(keys, pool, clashes, neighbors);
		if (result) return result;
	}
	console.warn("Couldn't satisfy " + ruleName + " on this board; ignoring it.");
	return trySolve(keys, pool, null, neighbors);
}

function trySolve(keys, pool, clashes, neighbors) {
	var assignment = {};
	var remaining = pool.map(function(entry) { return entry[1]; });
	var steps = 0;

	// Pool indices in random order, weighted by how many of each are left,
	// so rare values aren't tried first more often than they'd come up
	function valueOrder() {
		var copies = [];
		remaining.forEach(function(count, idx) {
			for (var n = 0; n < count; n += 1) copies.push(idx);
		});
		var seen = {};
		return shuffle(copies).filter(function(idx) {
			if (seen[idx]) return false;
			seen[idx] = true;
			return true;
		});
	}

	function place(i) {
		if (i === keys.length) return true;
		if (++steps > MAX_SOLVER_STEPS) return false;

		var key = keys[i];
		var order = valueOrder();
		for (var o = 0; o < order.length; o += 1) {
			var value = pool[order[o]][0];
			var blocked = clashes && neighbors[key].some(function(n) {
				return n in assignment && clashes(value, assignment[n]);
			});
			if (blocked) continue;

			assignment[key] = value;
			remaining[order[o]] -= 1;
			if (place(i + 1)) return true;
			delete assignment[key];
			remaining[order[o]] += 1;
		}
		return false;
	}

	return place(0) ? assignment : null;
}

// ----- Catan Board History Traversal -----

var boardHistory = [];
var currentBoardIndex = -1; // No boards generated yet

// ----- URL encoding helpers -----

/**
 * Encode the current board into a compact Base64 string and return it.
 * Format before encoding: "gridX,gridY:resource:number;..."
 */
function encodeBoard() {
    if (!catanMap.hexTiles) return "";

    const payload = catanMap.hexTiles.map(tile => {
        const n = (typeof tile.number === 'number') ? tile.number : "";
        return `${tile.gridX},${tile.gridY}:${tile.resourceType}:${n}`;
    }).join(";");

    try {
        return btoa(payload);
    } catch (e) {
        console.error('Failed to encode board to base64', e);
        return "";
    }
}

function encodeBoardShort() {
    if (!catanMap.hexTiles) return "";

    const tiles = catanMap.hexTiles.map(tile => {
        const res = RESOURCE_TO_CODE[tile.resourceType] ?? 0;
        const num = tile.number ?? 0;
        return `${tile.gridX},${tile.gridY},${res},${num}`;
    });

    // Harbor types in coastline order, one digit each (0 = 3:1 harbor)
    const harbors = catanMap.harbors
        .map(h => h.type === "any" ? 0 : RESOURCE_TO_CODE[h.type])
        .join("");

    const compact = tiles.join(".") + (harbors ? "|" + harbors : "");
    return btoa(compact);
}


/**
 * Decode a Base64 board string into an array of tile objects.
 * Returns null on failure.
 */
function decodeBoard(b64) {
    if (!b64) return null;
    let decoded;
    try {
        decoded = atob(b64);
    } catch (e) {
        console.error('Invalid base64 for board:', e);
        return null;
    }

    if (!decoded) return null;

    const entries = decoded.split(";");
    const tiles = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry) continue;
        const parts = entry.split(":");
        if (parts.length < 2) {
            console.warn('Malformed board entry:', entry);
            continue;
        }
        const coords = parts[0].split(",");
        const x = parseInt(coords[0]);
        const y = parseInt(coords[1]);
        const resource = parts[1];
        const numPart = parts[2] || "";
        const number = (numPart === "") ? null : parseInt(numPart);

        tiles.push({ gridX: x, gridY: y, resourceType: resource, number: number });
    }

    return tiles;
}

function decodeBoardShort(b64) {
    let decoded;
    try {
        decoded = atob(b64);
    } catch {
        console.error("Invalid compact board encoding.");
        return null;
    }

    // Links shared before harbors existed have no "|" section
    const [tilePart, harborPart] = decoded.split("|");

    const tiles = tilePart.split(".").map(part => {
        const [gx, gy, rc, num] = part.split(",").map(v => parseInt(v));
        return {
            gridX: gx,
            gridY: gy,
            resourceType: CODE_TO_RESOURCE[rc] ?? "desert",
            number: num === 0 ? null : num
        };
    });

    const harborTypes = harborPart
        ? harborPart.split("").map(c => c === "0" ? "any" : CODE_TO_RESOURCE[c])
        : [];

    return { tiles: tiles, harborTypes: harborTypes };
}


/**
 * Load a decoded shared board ({tiles, harborTypes}), render it and make
 * it the start of the history.
 */
function loadBoardFromDecodedState(state) {
    if (!state || !Array.isArray(state.tiles)) return;

    showBoardState(state);

    // Start the game type switch on the shared board's type, so New board
    // keeps making boards like the one that was shared
    const gameType = catanMap.mapDefinition === expandedMap ? "expanded" : "normal";
    $(`input[name=game-type][value=${gameType}]`)[0].checked = true;

    boardHistory = [state];
    currentBoardIndex = 0;
    enableButtons();
}

/**
 * Capture a map's board as plain data for history and sharing.
 */
function snapshotOf(map) {
    return {
        tiles: map.hexTiles.map(tile => ({
            resourceType: tile.resourceType,
            number: tile.number,
            gridX: tile.gridX,
            gridY: tile.gridY
        })),
        harborTypes: map.harbors.map(h => h.type)
    };
}

/**
 * Load a board state ({tiles, harborTypes}) into a map.
 */
function loadStateIntoMap(map, state) {
    // Determine map type based on tile count. The game type switch is left
    // alone: it picks the type of the next generated board.
    if (state.tiles.length === normalMap.coordinatesArray.length) {
        map.defineMap(normalMap);
    } else if (state.tiles.length === expandedMap.coordinatesArray.length) {
        map.defineMap(expandedMap);
    } else {
        console.warn("Unknown map size; cannot set map definition correctly.");
    }

    map.hexTiles = state.tiles.map(t => {
        const tile = new HexTile();
        tile.setCoordinate(t.gridX, t.gridY);
        tile.setResourceType(t.resourceType);
        if (t.number !== null && t.number !== undefined) tile.setNumber(t.number);
        return tile;
    });

    map.coordToTile = {};
    map.hexTiles.forEach(tile => {
        map.coordToTile[[tile.gridX, tile.gridY].toString()] = tile;
    });

    map.setHarborTypes(state.harborTypes);
}

/**
 * Put a board state on screen and in the URL.
 */
function showBoardState(state) {
    loadStateIntoMap(catanMap, state);
    sizeCanvas();
    catanMap.resize();
    catanMap.draw();
    updateShareUrl();
    updateBalanceDisplay();
}

/**
 * Keep ?board= in the address bar in sync so the URL always shares the
 * board on screen.
 */
function updateShareUrl() {
    const encoded = encodeBoardShort();
    if (encoded) {
        const url = new URL(window.location);
        url.searchParams.set('board', encoded);
        window.history.replaceState({}, '', url);
    }
}

/**
 * Show the board's fairness score under it.
 */
function updateBalanceDisplay() {
    const el = document.getElementById("board-balance");
    if (!el || !catanMap.hexTiles) return;

    fillBalancePill(el, catanMap.getBalance());
    el.hidden = false;
}

function fillBalancePill(el, balance) {
    el.querySelector(".balance-score").textContent = balance.score + "/10";
    el.querySelector(".balance-label").textContent = balance.label;
    el.querySelector(".balance-reason").textContent = balance.reason;
    el.dataset.level = balance.label.toLowerCase();
}

// ----- Share card -----
// Swipe the board card up to reveal a share card under it:
// the board's QR code (so a phone at the table can scan it), its link,
// Copy link, and Share… where the Web Share API exists. The board card
// parks with its bottom edge peeking above; tap or pull it down to go back.
// Settings > Share, and the header button on wider screens, open it too.

// How much of the board card stays visible when parked, in px
var SHARE_PEEK_PX = 72;
var shareOpen = false;

/**
 * Show a hint pill where the pager sits ("Swipe up to share"), or hide it
 * with null.
 */
function setCardHint(text) {
    const hint = document.getElementById("card-hint");
    if (text) hint.querySelector(".card-hint-text").textContent = text;
    document.querySelector(".board-panel").classList.toggle("show-hint", !!text);
}

/** Fill the share card with the current board's link and QR code. */
function prepareShareCard() {
    const url = new URL(window.location);
    url.searchParams.set("board", encodeBoardShort());
    const shareUrl = url.toString();
    renderQrCode(document.getElementById("share-qr"), shareUrl);
    document.getElementById("share-url").value = shareUrl;
    document.getElementById("share-copy").textContent = "Copy link";
    document.getElementById("share-native").hidden = !navigator.share;
}

// The board card's parked position: moved up, clipped to its bottom strip
function parkedFrame(card) {
    const hidden = card.offsetHeight - SHARE_PEEK_PX;
    return {
        transform: `translateY(${-hidden}px)`,
        clipPath: `inset(${hidden}px 0 0 0 round 0 0 24px 24px)`
    };
}

const UNPARKED_CLIP = "inset(0px 0 0 0 round 0 0 24px 24px)";

/** Board navigation is off while the share card shows (the QR would go stale) */
function setBoardControlsInert(inert) {
    document.querySelector(".board-nav").inert = inert;
    document.getElementById("board-pager").inert = inert;
}

/**
 * Reveal the share card: the board card slides up into its parked strip.
 * fromTransform is where a held/swiped card currently is.
 */
async function openShareCard(fromTransform) {
    if (shareOpen || boardSliding || !catanMap.hexTiles) return;
    const card = document.getElementById("map-container");
    const share = document.getElementById("share-card");
    prepareShareCard();
    share.hidden = false;
    shareOpen = true;
    document.body.classList.add("share-open");
    setBoardControlsInert(true);
    setCardHint(null);
    document.getElementById("lift-dim").classList.remove("is-on");
    document.querySelector(".card-stack").classList.remove("is-lifted");
    card.classList.remove("is-lifted");

    const parked = parkedFrame(card);
    if (!motionReduced() && card.animate) {
        boardSliding = true;
        await card.animate([
            { transform: fromTransform || "none", clipPath: UNPARKED_CLIP },
            parked
        ], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }).finished;
        boardSliding = false;
    }
    card.style.transform = parked.transform;
    card.style.clipPath = parked.clipPath;
    share.focus({ preventScroll: true });
}

/** Drop the board card back over the share card. */
async function closeShareCard() {
    if (!shareOpen || boardSliding) return;
    const card = document.getElementById("map-container");
    const share = document.getElementById("share-card");
    const parked = parkedFrame(card);
    card.style.transform = "";
    card.style.clipPath = "";
    if (!motionReduced() && card.animate) {
        boardSliding = true;
        await card.animate([
            parked,
            { transform: "none", clipPath: UNPARKED_CLIP }
        ], { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }).finished;
        boardSliding = false;
    }
    share.hidden = true;
    shareOpen = false;
    document.body.classList.remove("share-open");
    setBoardControlsInert(false);
}

function setUpShareCard() {
    const urlInput = document.getElementById("share-url");
    const copyButton = document.getElementById("share-copy");
    const nativeButton = document.getElementById("share-native");

    // Header share button (wider screens) and Settings > Share
    $("#share-catan-board").click(() => openShareCard());
    $("#share-open-settings").click(() => {
        const settings = document.getElementById("settings-dialog");
        closeDialog(settings);
        // Let the settings page slide away first
        setTimeout(() => openShareCard(), motionReduced() ? 0 : 260);
    });
    $("#share-back").click(() => closeShareCard());
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && shareOpen && !document.querySelector("dialog[open]")) {
            closeShareCard();
        }
    });
    // Keep the parked strip the right size if the card changes size
    window.addEventListener("resize", () => {
        if (!shareOpen || boardSliding) return;
        const card = document.getElementById("map-container");
        const parked = parkedFrame(card);
        card.style.transform = parked.transform;
        card.style.clipPath = parked.clipPath;
    });

    // Select the whole link on focus so it's easy to copy by hand
    urlInput.addEventListener("focus", () => urlInput.select());

    $(copyButton).click(async () => {
        try {
            await navigator.clipboard.writeText(urlInput.value);
            copyButton.textContent = "Copied!";
        } catch (err) {
            // Clipboard blocked: select the link so the user can copy it
            urlInput.focus();
            copyButton.textContent = "Link selected, copy it";
        }
    });

    $(nativeButton).click(async () => {
        try {
            await navigator.share({
                title: "Catan Board",
                text: "Check out this Catan board!",
                url: urlInput.value
            });
        } catch (err) {
            // Cancelled or failed; the share card stays open
        }
    });
}

/**
 * Draw a QR code for text into container as an SVG: dark modules on white
 * with the standard 4-module quiet zone, which scanners need regardless of
 * the app's theme.
 */
function renderQrCode(container, text) {
    const qr = qrcode(0, "M"); // 0 = smallest version that fits
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const quietZone = 4;
    const extent = count + 2 * quietZone;
    let path = "";
    for (let row = 0; row < count; row += 1) {
        for (let col = 0; col < count; col += 1) {
            if (qr.isDark(row, col)) {
                path += `M${col + quietZone} ${row + quietZone}h1v1h-1z`;
            }
        }
    }

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${extent} ${extent}`);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code for this board's link");

    const background = document.createElementNS(ns, "rect");
    background.setAttribute("width", extent);
    background.setAttribute("height", extent);
    background.setAttribute("fill", "#ffffff");

    const modules = document.createElementNS(ns, "path");
    modules.setAttribute("d", path);
    modules.setAttribute("fill", "#000000");

    svg.append(background, modules);
    container.replaceChildren(svg);
}

// ----- FUNCTIONS -----

/**
 * Redraw whenever the canvas's box changes size: window resizes and
 * rotation, but also the balance pill under it growing (it's empty before
 * the first board, and a long reason can wrap to two lines).
 */
function watchCanvasSize() {
	new ResizeObserver(function() {
		if (mapCanvas.clientWidth === canvasWidth && mapCanvas.clientHeight === canvasHeight) return;
		sizeCanvas();
		if (catanMap.hexTiles) {
			catanMap.resize();
			catanMap.draw();
		}
	}).observe(mapCanvas);
}

function init() {
    // Ensure the canvas exists early so we can render as soon as images and board data are ready
    addCanvas();

    loadImages(function () {
        // Wire up buttons (we do this after images are loaded to keep behavior consistent)
        const genButton = $('button#gen-map-button')[0];
        $(genButton).click(showNewBoard);
        genButton.disabled = false;

        const goBackButton = $('button#gen-map-back-button')[0];
        $(goBackButton).click(() => showPreviousBoard());

        const goForwardButton = $('button#gen-map-forward-button')[0];
        $(goForwardButton).click(() => showNextBoard());

        // Hiding harbors also gives the tiles the room the harbors used
        const harborsToggle = document.getElementById("show-harbors");
        // The browser may restore the checkbox state on reload
        showHarbors = harborsToggle.checked;
        harborsToggle.addEventListener("change", () => {
            showHarbors = harborsToggle.checked;
            catanMap.resize();
            catanMap.draw();
        });

        const numbersToggle = document.getElementById("show-numbers");
        showNumbers = numbersToggle.checked;
        numbersToggle.addEventListener("change", () => {
            showNumbers = numbersToggle.checked;
            catanMap.draw();
        });

        const bestSpotsToggle = document.getElementById("show-best-spots");
        showBestSpots = bestSpotsToggle.checked;
        bestSpotsToggle.addEventListener("change", () => {
            showBestSpots = bestSpotsToggle.checked;
            catanMap.draw();
        });

        // Balance rules: restore the saved choices. Changes apply to the next
        // board generated, like the game type.
        Object.assign(balanceRules, loadBalanceRules());
        document.querySelectorAll('input[data-rule]').forEach(input => {
            input.checked = !!balanceRules[input.dataset.rule];
            input.addEventListener("change", () => {
                balanceRules[input.dataset.rule] = input.checked;
                saveBalanceRules();
            });
        });

        setUpShareCard();
        setUpBoardSwipe();
        setUpPagerScrub();

        enableButtons();

        // If the URL has a board parameter, auto-load it (Option A)
        const url = new URL(window.location);
        const encodedBoard = url.searchParams.get('board');
        if (encodedBoard) {
            const boardState = decodeBoardShort(encodedBoard);
            if (boardState) {
                loadBoardFromDecodedState(boardState);
                return; // We've loaded the shared board — skip automatic generation
            }
        }

        // otherwise keep normal UI ready for the user
    });
}

function preloadImages(arr, callback){
	//http://www.javascriptkit.com/javatutors/preloadimagesplus.shtml
	
    var newimages=[], loadedimages=0;
    var postaction=function(){};
    var arr=(typeof arr!="object")? [arr] : arr;
    function imageloadpost(){
        loadedimages++;
        if (loadedimages==arr.length){
            callback(newimages); //call postaction and pass in newimages array as parameter
        }
    }
    for (var i=0; i<arr.length; i++){
        newimages[i]=new Image();
        newimages[i].src=arr[i];
        newimages[i].onload=function(){
            imageloadpost();
        }
        newimages[i].onerror=function(){
            imageloadpost();
        }
    }

}

function loadImages(callback) {

	var rTypes = [];
	var imgPaths = [];
	for (var key in resourceTypeToImageCanvas) {
		rTypes.push(key);
		imgPaths.push("images/"+key+".png");
	}
	
	preloadImages(imgPaths, function(images) {
		
		for (var i = 0; i < imgPaths.length; i += 1) {
			//resourceTypeToImage[ rTypes[i] ] = images[i];
			var img = images[i];
			var imgCanvas = document.createElement("canvas");
			var imgContext = imgCanvas.getContext("2d");
			
			imgCanvas.width = img.width;
			imgCanvas.height = img.height;
			imgContext.drawImage(img, 0, 0);
			
			resourceTypeToImageCanvas[ rTypes[i] ] = imgCanvas;
		}
		
		callback();
		
	});
	
}

function generate() {
    addBoardToHistory(generateBoardState());
}

/**
 * Generate a board with the current game type and rules, without showing
 * it (the swipe card shows it underneath before it's added).
 */
function generateBoardState() {
    const mapDef = $("input[name=game-type]:checked").val() === "expanded"
        ? expandedMap
        : normalMap;
    const map = new CatanMap();
    map.defineMap(mapDef);
    map.generate();
    return snapshotOf(map);
}

/**
 * Show a new board and add it to the session. History holds every board
 * generated this session, with currentBoardIndex on the one on screen; new
 * boards always go on the end, so going back never loses any.
 */
function addBoardToHistory(state) {
    showBoardState(state);
    boardHistory.push(state);
    currentBoardIndex = boardHistory.length - 1;
    enableButtons();
    if (boardHistory.length === 1) maybeShowShareTip();
}

var SHARE_TIP_KEY = "shareTipShown";

/**
 * The first time someone uses the app on a touch screen, point out the
 * swipe-up-to-share gesture for a few seconds.
 */
function maybeShowShareTip() {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    try {
        if (localStorage.getItem(SHARE_TIP_KEY)) return;
        localStorage.setItem(SHARE_TIP_KEY, "1");
    } catch (err) {
        return;
    }
    setCardHint("Swipe the board up to share");
    setTimeout(() => {
        const text = document.querySelector("#card-hint .card-hint-text").textContent;
        if (text === "Swipe the board up to share") setCardHint(null);
    }, 4000);
}

// ----- Card swipe -----
// The board card can be swiped like a deck of cards. A second card sits
// under it showing the board you'd move to: dragging tilts the top card,
// and past the threshold it flies off and the card underneath takes over.
// Swipe right for the previous board; swipe left for the next one, or a
// new one from the newest board. The buttons fling the card the same way.

// How far a swipe must travel to change board, in px
var SWIPE_THRESHOLD_PX = 80;
// True while a card is flying off; input waits for it to finish
var boardSliding = false;

function motionReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Where a move goes: "prev", "next" (an existing later board) or "new".
 * Returns {state, change} with the board to show underneath and how to
 * make it current, or null if there's no board that way.
 */
function prepareMove(kind) {
    if (kind === "prev") {
        if (currentBoardIndex <= 0) return null;
        return { state: boardHistory[currentBoardIndex - 1], change: goBack };
    }
    if (kind === "next") {
        if (currentBoardIndex >= boardHistory.length - 1) return null;
        return { state: boardHistory[currentBoardIndex + 1], change: goForward };
    }
    const state = generateBoardState();
    return { state: state, change: () => addBoardToHistory(state) };
}

/**
 * Draw a board state onto the card underneath, with its balance pill.
 * Drawing goes through globals (context, hex size), so they're swapped to
 * a throwaway map and restored after.
 */
function showOnBackCard(state) {
    const back = document.getElementById("map-back");
    const canvas = back.querySelector("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);

    const map = new CatanMap();
    loadStateIntoMap(map, state);

    const saved = [drawingContext, size, dx, dy, lineWidth];
    drawingContext = canvas.getContext("2d");
    drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    map.resize();
    map.draw();
    [drawingContext, size, dx, dy, lineWidth] = saved;

    fillBalancePill(back.querySelector(".board-balance"), map.getBalance());
}

/**
 * Show the card underneath scaled down and dimmed, growing toward full
 * size as the top card moves away (progress 0..1).
 */
function setBackCardProgress(progress) {
    const back = document.getElementById("map-back");
    back.style.transform = `scale(${0.94 + 0.06 * progress})`;
    back.style.opacity = String(0.55 + 0.45 * progress);
}

function hideBackCard() {
    const back = document.getElementById("map-back");
    back.classList.remove("is-visible");
    back.style.transform = "";
    back.style.opacity = "";
}

// The top card's tilt for a horizontal offset (degrees, capped)
function tiltFor(offset) {
    return Math.max(-14, Math.min(14, offset * 0.06));
}

/**
 * Fling the top card off toward `direction` (1 = right, -1 = left) and make
 * `move` current. fromX is where a swipe left the card (px).
 */
// The fling in progress, so a new swipe or tap can finish it instantly
// instead of waiting: {anim, done}
var activeFling = null;

/**
 * If a card is mid-fling, jump it to the end and wait for the swap, so the
 * next action starts right away. Returns false if something else (the share
 * card opening or closing) is animating.
 */
async function settleFling() {
    if (activeFling) {
        const pending = activeFling;
        pending.anim.finish();
        await pending.done;
    }
    return !boardSliding;
}

/**
 * Fling the top card off toward `direction` (1 = right, -1 = left) and make
 * `move` current. fromX is where a swipe left the card (px) and velocity
 * its speed at release (px/ms): a flick flies off as fast as it was thrown.
 */
async function flingCard(direction, move, fromX, velocity) {
    const card = document.getElementById("map-container");
    if (motionReduced() || !card.animate) {
        card.style.transform = "";
        hideBackCard();
        move.change();
        return;
    }
    boardSliding = true;
    const back = document.getElementById("map-back");
    showOnBackCard(move.state);
    back.classList.add("is-visible");
    // From a button there's no drag: start the next board already well in
    // view so it appears quickly
    if (!fromX) setBackCardProgress(0.5);

    const width = card.offsetWidth;
    const startX = fromX || 0;
    const endX = direction * width * 1.3;
    const speed = Math.max(Math.abs(velocity || 0), 2.4);
    const duration = Math.max(110, Math.min(200, Math.abs(endX - startX) / speed));
    const easing = "cubic-bezier(0.25, 0.8, 0.4, 1)";
    const fly = card.animate([
        { transform: `translateX(${startX}px) rotate(${tiltFor(startX)}deg)` },
        { transform: `translateX(${endX}px) rotate(${direction * 20}deg)` }
    ], { duration: duration, easing: easing, fill: "forwards" });
    // The animation holds the drag position from here on
    card.style.transform = "";
    const grow = back.animate([
        { transform: back.style.transform || "scale(0.94)", opacity: back.style.opacity || 0.55 },
        { transform: "scale(1)", opacity: 1 }
    ], { duration: duration, easing: easing, fill: "forwards" });

    // The top card then draws the board that was underneath and comes back
    // to the middle in the same task, so the swap never shows
    const done = fly.finished.then(() => {
        move.change();
        fly.cancel();
        grow.cancel();
        hideBackCard();
        boardSliding = false;
        activeFling = null;
    });
    activeFling = { anim: fly, done: done };
    await done;
}

async function showPreviousBoard() {
    if (!(await settleFling())) return;
    const move = prepareMove("prev");
    if (move) flingCard(1, move);
}

async function showNextBoard() {
    if (!(await settleFling())) return;
    const move = prepareMove("next");
    if (move) flingCard(-1, move);
}

async function showNewBoard() {
    if (!(await settleFling())) return;
    // The very first board has no card to fling away
    if (!catanMap.hexTiles) {
        generate();
        return;
    }
    flingCard(-1, prepareMove("new"));
}

// A release this fast (px/ms) commits a swipe even if it traveled less
// than the distance threshold
var FLICK_VELOCITY = 0.45;

/**
 * Gestures on the board card. The first few pixels of movement pick the
 * direction, then the card follows the finger 1:1:
 * - Left or right: it tilts, with the board you'd move to showing
 *   underneath. Past the threshold, or on a flick, it flies off; otherwise
 *   it springs back. Swiping right on the first board resists.
 * - Up: the page dims as it rises with the share card showing underneath.
 *   Past a quarter of its height, or on an upward flick, it parks and
 *   reveals the share card; otherwise it settles back.
 * - While the share card shows: tap or pull down the peeking strip to go
 *   back.
 * A new gesture during a fling finishes the fling at once. The card has
 * touch-action: pinch-zoom, so one-finger drags are all ours (no page
 * scroll on the card) and pinch still zooms.
 */
function setUpBoardSwipe() {
    const card = document.getElementById("map-container");
    const stack = document.querySelector(".card-stack");
    const back = document.getElementById("map-back");
    const share = document.getElementById("share-card");
    const dim = document.getElementById("lift-dim");
    let start = null;
    // null until the direction is picked: "x", "up", "down" or "parked"
    let mode = null;
    let offset = 0;
    let upY = 0;
    let samples = [];
    // The move for the direction being dragged, prepared once per direction
    let kind = null;
    let move = null;

    // Swiping right shows the previous board; left the next, else a new one
    const kindFor = (towardRight) => towardRight
        ? "prev"
        : (currentBoardIndex < boardHistory.length - 1 ? "next" : "new");

    const shareThreshold = () => card.offsetHeight / 4;

    // Release velocity from the last ~90ms of movement, in px/ms
    const track = (event) => {
        samples.push([event.timeStamp, event.clientX, event.clientY]);
        while (samples.length > 2 && event.timeStamp - samples[0][0] > 90) samples.shift();
    };
    const velocity = () => {
        if (samples.length < 2) return [0, 0];
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last[0] - first[0]);
        return [(last[1] - first[1]) / dt, (last[2] - first[2]) / dt];
    };

    const reset = () => {
        start = null;
        mode = null;
        kind = null;
        move = null;
        samples = [];
    };

    // Swipe up begins: lift the card over a dimming page, share card ready
    const beginUp = () => {
        prepareShareCard();
        upY = 0;
        card.classList.add("is-lifted");
        stack.classList.add("is-lifted");
        dim.style.transition = "none";
        dim.style.opacity = "0";
        dim.classList.add("is-on");
    };

    // Let go without sharing: settle back down from where the card is
    const settleUp = (fromTransform) => {
        card.classList.remove("is-lifted");
        stack.classList.remove("is-lifted");
        dim.style.transition = "";
        dim.style.opacity = "";
        dim.classList.remove("is-on");
        setCardHint(null);
        card.style.transform = "";
        if (!motionReduced() && card.animate) {
            card.animate([
                { transform: fromTransform || "none" },
                { transform: "none" }
            ], { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" })
                .finished.then(() => { if (!shareOpen) share.hidden = true; });
        } else {
            share.hidden = true;
        }
    };

    // Listen on the stack, not the card: mid-fling the card has moved out
    // from under the finger, but a new swipe should still catch it
    stack.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || !catanMap.hexTiles) return;
        // With the share card showing, only the board card's peeking strip
        // is a gesture; the share card's own buttons work normally
        if (shareOpen && !card.contains(event.target)) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // Mid-fling: jump it to the end (the swap runs before the next
        // pointermove) and start this gesture straight away
        if (activeFling) activeFling.anim.finish();
        else if (boardSliding) return;
        reset();
        start = { x: event.clientX, y: event.clientY, id: event.pointerId };
        track(event);
        if (shareOpen) mode = "parked";
    });

    stack.addEventListener("pointermove", (event) => {
        if (!start || event.pointerId !== start.id) return;
        track(event);
        const moveX = event.clientX - start.x;
        const moveY = event.clientY - start.y;
        if (mode === "parked" || mode === "down") return;

        if (!mode) {
            if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return;
            if (Math.abs(moveX) >= Math.abs(moveY)) {
                mode = "x";
                card.classList.add("is-dragging");
            } else if (moveY < 0) {
                mode = "up";
                beginUp();
            } else {
                // Pulling the board down does nothing
                mode = "down";
                return;
            }
            stack.setPointerCapture(event.pointerId);
        }

        if (mode === "up") {
            upY = Math.min(0, moveY);
            const progress = Math.min(1, -upY / shareThreshold());
            card.style.transform = `translateY(${upY}px) scale(${1 + 0.03 * progress})`;
            dim.style.opacity = String(progress);
            share.hidden = upY > -4;
            setCardHint(progress >= 1 ? "Release to share" : "Swipe up to share");
            return;
        }

        const wanted = kindFor(moveX > 0);
        if (wanted !== kind) {
            kind = wanted;
            move = prepareMove(kind);
            if (move) {
                showOnBackCard(move.state);
                back.classList.add("is-visible");
            } else {
                hideBackCard();
            }
        }

        // Follow the finger, or resist where there's no board that way
        offset = move ? moveX : moveX * 0.25;
        card.style.transform = `translateX(${offset}px) rotate(${tiltFor(offset)}deg)`;
        if (move) setBackCardProgress(Math.min(1, Math.abs(offset) / (card.offsetWidth * 0.6)));
    });

    // A long press shouldn't open a context menu
    stack.addEventListener("contextmenu", (event) => {
        if (!share.contains(event.target)) event.preventDefault();
    });

    const finish = (event) => {
        if (!start || event.pointerId !== start.id) return;
        track(event);
        const released = event.type === "pointerup";
        const [vx, vy] = velocity();
        const travelX = event.clientX - start.x;
        const travelY = event.clientY - start.y;
        const thisMode = mode;
        const thisMove = move;
        const fromX = offset;
        const fromY = upY;
        const fromTransform = card.style.transform;
        reset();
        card.classList.remove("is-dragging");

        // Parked: a tap, a pull down or a downward flick goes back
        if (thisMode === "parked") {
            const tap = Math.abs(travelX) < 8 && Math.abs(travelY) < 8;
            if (released && (tap || travelY > 30 || vy > FLICK_VELOCITY)) closeShareCard();
            return;
        }

        if (thisMode === "up") {
            const flicked = vy < -FLICK_VELOCITY && -fromY > 24;
            if (released && (-fromY >= shareThreshold() || flicked)) {
                card.classList.remove("is-lifted");
                stack.classList.remove("is-lifted");
                dim.style.transition = "";
                dim.style.opacity = "";
                openShareCard(fromTransform);
            } else {
                settleUp(fromTransform);
            }
            return;
        }

        if (thisMode !== "x") return;

        const flicked = Math.abs(vx) > FLICK_VELOCITY && Math.abs(fromX) > 24 &&
            Math.sign(vx) === Math.sign(fromX);
        if (released && thisMove && (Math.abs(fromX) >= SWIPE_THRESHOLD_PX || flicked)) {
            flingCard(fromX > 0 ? 1 : -1, thisMove, fromX, vx);
            return;
        }

        // Spring back
        card.style.transform = "";
        hideBackCard();
        if (!motionReduced() && card.animate) {
            card.animate([
                { transform: `translateX(${fromX}px) rotate(${tiltFor(fromX)}deg)` },
                { transform: "translateX(0) rotate(0deg)" }
            ], { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
        }
    };
    stack.addEventListener("pointerup", finish);
    stack.addEventListener("pointercancel", finish);
}

function goBack() {
    if (currentBoardIndex <= 0) {
        console.log("No previous board to go back to.");
        return;
    }

    currentBoardIndex--;
    loadBoardFromHistory(currentBoardIndex);
    enableButtons();
}

function goForward() {
    if (currentBoardIndex >= boardHistory.length - 1) {
        console.log("No forward board to navigate to.");
        return;
    }

    currentBoardIndex++;
    loadBoardFromHistory(currentBoardIndex);
    enableButtons();
}

function loadBoardFromHistory(index) {
    const boardState = boardHistory[index];
    if (!boardState) return;

    // Boards in history can be a different size than the one on screen,
    // so this re-defines the map and resizes rather than only redrawing
    showBoardState(boardState);
}

function enableButtons() {
    const goBackButton = $('button#gen-map-back-button')[0];
    const goForwardButton = $('button#gen-map-forward-button')[0];
    const shareButton = $('button#share-catan-board')[0];
    const hasBoard = !!catanMap.hexTiles;

    // The label sits in its own span so the button keeps its icon
    $("#gen-map-label")[0].textContent = hasBoard ? "New board" : "Generate board";
    goBackButton.disabled = currentBoardIndex <= 0;
    goForwardButton.disabled = currentBoardIndex >= boardHistory.length - 1;
    shareButton.disabled = !hasBoard;
    updatePager();
}

// Most dots the pager shows; longer sessions show a window around the
// current board
var PAGER_MAX_DOTS = 9;

/**
 * Pager under the board: one dot per board in this session's history (the
 * current one stretched), plus "3 of 7".
 */
function updatePager() {
    const pager = document.getElementById("board-pager");
    const total = boardHistory.length;
    if (!pager || total === 0) return;

    const current = currentBoardIndex;
    const count = Math.min(total, PAGER_MAX_DOTS);
    // Center the window on the current board, clamped to the history
    const start = Math.max(0, Math.min(current - Math.floor(PAGER_MAX_DOTS / 2), total - count));

    // Reuse the dot elements and only change their classes, so the current
    // dot's stretch animates when stepping back and forth
    const dotsEl = pager.querySelector(".pager-dots");
    while (dotsEl.children.length < count) {
        dotsEl.appendChild(document.createElement("span"));
    }
    while (dotsEl.children.length > count) {
        dotsEl.lastElementChild.remove();
    }
    Array.from(dotsEl.children).forEach((dot, k) => {
        const i = start + k;
        // Shrink the ends of a window that doesn't reach the first/last board
        const cutOff = (k === 0 && start > 0) || (k === count - 1 && start + count < total);
        dot.className = "pager-dot" +
            (i === current ? " is-current" : i < current ? " is-past" : "") +
            (cutOff && i !== current ? " is-edge" : "");
    });
    pager.querySelector(".pager-index").textContent = current + 1;
    pager.querySelector(".pager-total").textContent = total;
    pager.setAttribute("aria-valuemin", "1");
    pager.setAttribute("aria-valuemax", String(total));
    pager.setAttribute("aria-valuenow", String(current + 1));
    pager.setAttribute("aria-valuetext", `Board ${current + 1} of ${total}`);
    pager.hidden = false;
}

// How long to hold the pager before scrubbing starts, in ms
var PAGER_HOLD_MS = 250;

/**
 * Jump straight to a board in the session (no card animation), for
 * scrubbing and the keyboard.
 */
function jumpToBoard(index) {
    const target = Math.max(0, Math.min(boardHistory.length - 1, index));
    if (target === currentBoardIndex) return;
    currentBoardIndex = target;
    loadBoardFromHistory(target);
    enableButtons();
}

/**
 * Press and hold the pager, then slide, to scrub through this session's
 * boards like the iPhone home screen's page dots. Each step of finger
 * travel is one board (smaller steps for long sessions), measured from
 * where the hold began so the board doesn't jump when scrubbing starts.
 * Arrow keys, Home and End do the same from the keyboard.
 */
function setUpPagerScrub() {
    const pager = document.getElementById("board-pager");
    let hold = null;
    let scrub = null;

    const stepPx = () => Math.max(8, Math.min(28, pager.clientWidth / boardHistory.length));

    const stop = () => {
        if (hold) clearTimeout(hold.timer);
        hold = null;
        scrub = null;
        pager.classList.remove("is-scrubbing");
    };

    pager.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || boardSliding || boardHistory.length < 2) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        stop();
        pager.setPointerCapture(event.pointerId);
        const start = { x: event.clientX, id: event.pointerId };
        hold = {
            start: start,
            timer: setTimeout(() => {
                hold = null;
                scrub = { x: start.x, id: start.id, index: currentBoardIndex };
                pager.classList.add("is-scrubbing");
                if (navigator.vibrate) navigator.vibrate(10);
            }, PAGER_HOLD_MS)
        };
    });

    pager.addEventListener("pointermove", (event) => {
        // Moving before the hold completes cancels it
        if (hold && event.pointerId === hold.start.id && Math.abs(event.clientX - hold.start.x) > 10) {
            stop();
            return;
        }
        if (!scrub || event.pointerId !== scrub.id) return;
        jumpToBoard(scrub.index + Math.round((event.clientX - scrub.x) / stepPx()));
    });

    pager.addEventListener("pointerup", stop);
    pager.addEventListener("pointercancel", stop);
    // A long press shouldn't open a context menu or start selecting text
    pager.addEventListener("contextmenu", (event) => event.preventDefault());

    pager.addEventListener("keydown", (event) => {
        if (boardSliding || boardHistory.length === 0) return;
        const keys = {
            ArrowLeft: currentBoardIndex - 1,
            ArrowDown: currentBoardIndex - 1,
            ArrowRight: currentBoardIndex + 1,
            ArrowUp: currentBoardIndex + 1,
            Home: 0,
            End: boardHistory.length - 1
        };
        if (!(event.key in keys)) return;
        event.preventDefault();
        jumpToBoard(keys[event.key]);
    });
}

function MapDefinition() {
	this.resourceDict = null;
	this.numberDict = null;
	this.coordinatesArray = null;
}
MapDefinition.prototype.checkValidity = function() {
	var cArrLen = this.coordinatesArray.length;
	var rDictLen = this.sumDictVals(this.resourceDict);
	var nDictLen = this.sumDictVals(this.numberDict);
	var numDeserts = this.resourceDict["desert"];
	
	return (cArrLen == rDictLen) && (rDictLen == (nDictLen + numDeserts));
}
MapDefinition.prototype.sumDictVals = function(dict) {
	var sum = 0;
	for (var key in dict) {
		sum += dict[key];
	}
	return sum;
}

function CatanMap() {
	
	this.mapDefinition = null;
	this.hexTiles = null;
	this.coordToTile = {};
	this.coordSpan = [0,0];
	this.harbors = [];

}
CatanMap.prototype.defineMap = function(mapDefinition) {
	
	if (mapDefinition.checkValidity()) {
		
		this.mapDefinition = mapDefinition;
		
		var coordRangeX = [0,0];
		var coordRangeY = [0,0];
		
		for (var i = 0; i < mapDefinition.coordinatesArray.length; i += 1) {
			var coord = mapDefinition.coordinatesArray[i];
			coordRangeX = [
				Math.min(coordRangeX[0], coord[0]),
				Math.max(coordRangeX[1], coord[0])
			];
			coordRangeY = [
				Math.min(coordRangeY[0], coord[1]),
				Math.max(coordRangeY[1], coord[1])
			];
		}
		
		this.coordSpan = [
			coordRangeX[1] - coordRangeX[0],
			coordRangeY[1] - coordRangeY[0]
		];
		
	} else {
		console.log("Invalid map definition.");
	}
}
CatanMap.prototype.generate = function() {
	
	if (!this.mapDefinition) {
		console.log("No map definition.");
		return;
	}
	
	var def = this.mapDefinition;
	var keys = def.coordinatesArray.map(function(c) { return c.toString(); });
	var neighbors = this.getNeighborKeys();
	var numDeserts = def.resourceDict["desert"];
	
	// 1. Deserts: the center hex(es), or anywhere
	var desertKeys = (balanceRules.desertCenter && def.centerCoords)
		? def.centerCoords.map(function(c) { return c.toString(); })
		: shuffle(keys).slice(0, numDeserts);
	var landKeys = keys.filter(function(key) {
		return desertKeys.indexOf(key) === -1;
	});
	
	// 2. Resources on the remaining hexes
	var resourcePool = [];
	for (var type in def.resourceDict) {
		if (type != "desert") resourcePool.push([type, def.resourceDict[type]]);
	}
	var sameResource = balanceRules.separateResources
		? function(a, b) { return a === b; }
		: null;
	var resources = solveAssignment(landKeys, resourcePool, sameResource, neighbors, "same resources apart");
	
	// 3. Numbers on every hex but the deserts
	var numberPool = [];
	for (var number in def.numberDict) {
		numberPool.push([parseInt(number), def.numberDict[number]]);
	}
	var numbersClash = (balanceRules.separate68 || balanceRules.separate212)
		? function(a, b) {
			return (balanceRules.separate68 && isHot(a) && isHot(b)) ||
				(balanceRules.separate212 && isRare(a) && isRare(b));
		}
		: null;
	var numbers = solveAssignment(landKeys, numberPool, numbersClash, neighbors, "number rules");
	
	this.hexTiles = [];
	this.coordToTile = {};
	for (var i = 0; i < def.coordinatesArray.length; i += 1) {
		var coord = def.coordinatesArray[i];
		var key = keys[i];
		var tile = new HexTile();
		tile.setCoordinate(coord[0], coord[1]);
		if (desertKeys.indexOf(key) !== -1) {
			tile.setResourceType("desert");
		} else {
			tile.setResourceType(resources[key]);
			tile.setNumber(numbers[key]);
		}
		this.hexTiles.push(tile);
		this.coordToTile[key] = tile;
	}
	
	// Shuffle harbor types onto the fixed coastline slots
	this.setHarborTypes(shuffle(def.harborTypes));
	
}
/**
 * Every corner on the board where a settlement could go, with the tiles
 * that touch it (1 to 3). Positions are in hex-size units from the center.
 */
CatanMap.prototype.getIntersections = function() {
	var spots = {};
	this.hexTiles.forEach(function(tile) {
		var cx = tile.gridX * 0.75;
		var cy = tile.gridY * Math.sin(Math.PI/3);
		for (var k = 0; k < 6; k += 1) {
			var x = cx + Math.cos(k * Math.PI / 3);
			var y = cy + Math.sin(k * Math.PI / 3);
			// Rounded so the same corner seen from neighboring tiles matches
			var key = Math.round(x * 100) + "," + Math.round(y * 100);
			if (!spots[key]) spots[key] = { x: x, y: y, tiles: [] };
			spots[key].tiles.push(tile);
		}
	});
	return Object.keys(spots).map(function(key) { return spots[key]; });
}
/**
 * Rate how fair the board is, 0-10, from two checks:
 * - resource balance: each resource's total dots against its fair share
 *   for its number of tiles; the worst-off resource counts
 * - hot spots: the dots at the richest corner
 * Returns {score, label, reason}.
 */
CatanMap.prototype.getBalance = function() {
	var pips = {};
	var tileCounts = {};
	var totalPips = 0;
	var landTiles = 0;
	this.hexTiles.forEach(function(tile) {
		if (tile.resourceType === "desert") return;
		pips[tile.resourceType] = (pips[tile.resourceType] || 0) + pipsFor(tile.number);
		tileCounts[tile.resourceType] = (tileCounts[tile.resourceType] || 0) + 1;
		totalPips += pipsFor(tile.number);
		landTiles += 1;
	});

	var pipsPerTile = totalPips / landTiles;
	var worst = { resource: null, deviation: 0 };
	Object.keys(pips).forEach(function(resource) {
		var deviation = pips[resource] / (tileCounts[resource] * pipsPerTile) - 1;
		if (Math.abs(deviation) > Math.abs(worst.deviation)) {
			worst = { resource: resource, deviation: deviation };
		}
	});
	var resourceScore = clamp01(1 - Math.abs(worst.deviation) / BALANCE_RESOURCE_LIMIT);

	var richestCorner = 0;
	this.getIntersections().forEach(function(spot) {
		var spotPips = spot.tiles.reduce(function(sum, tile) {
			return sum + pipsFor(tile.number);
		}, 0);
		richestCorner = Math.max(richestCorner, spotPips);
	});
	var spotScore = clamp01(
		(BALANCE_SPOT_MAX - richestCorner) / (BALANCE_SPOT_MAX - BALANCE_SPOT_OK)
	);

	var score = Math.round(10 * (0.6 * resourceScore + 0.4 * spotScore));
	var label = score >= 9 ? "Great" : score >= 7 ? "Good" : score >= 5 ? "Fair" : "Uneven";

	// Explain whichever check cost the most points
	var reason;
	if (score >= 9) {
		reason = "Production is evenly spread";
	} else if (0.6 * (1 - resourceScore) >= 0.4 * (1 - spotScore)) {
		reason = capitalize(worst.resource) + (worst.deviation < 0
			? " is short on production"
			: " gets more than its share");
	} else {
		reason = "One corner gets " + richestCorner + " dots";
	}

	return { score: score, label: label, reason: reason };
}
/**
 * For each hex on the current map, the keys of the hexes touching it.
 */
CatanMap.prototype.getNeighborKeys = function() {
	var coords = this.mapDefinition.coordinatesArray;
	var onBoard = {};
	coords.forEach(function(c) { onBoard[c.toString()] = true; });
	
	var neighbors = {};
	coords.forEach(function(c) {
		neighbors[c.toString()] = HEX_DIRECTIONS
			.map(function(d) { return [c[0] + d[0], c[1] + d[1]].toString(); })
			.filter(function(key) { return onBoard[key]; });
	});
	return neighbors;
}
/**
 * Harbor positions for the current map: coastal edges (tile edges with no
 * neighbor) sorted around the board, then spread evenly. With 30 coastal
 * edges and 9 harbors this gives the classic 3-3-4 spacing.
 */
CatanMap.prototype.getHarborSlots = function() {
	var def = this.mapDefinition;
	if (!def || !def.harborTypes) return [];

	var occupied = {};
	def.coordinatesArray.forEach(function(c) {
		occupied[c.toString()] = true;
	});

	var coastEdges = [];
	def.coordinatesArray.forEach(function(c) {
		HEX_DIRECTIONS.forEach(function(d, dir) {
			if (occupied[[c[0] + d[0], c[1] + d[1]].toString()]) return;
			// Edge midpoint relative to the board center, in hex-size units
			var mx = (c[0] + d[0] / 2) * 0.75;
			var my = (c[1] + d[1] / 2) * Math.sin(Math.PI/3);
			coastEdges.push({
				gridX: c[0],
				gridY: c[1],
				dir: dir,
				angle: Math.atan2(my, mx)
			});
		});
	});
	coastEdges.sort(function(a, b) { return a.angle - b.angle; });

	var count = def.harborTypes.length;
	var slots = [];
	for (var i = 0; i < count; i += 1) {
		var edge = coastEdges[Math.floor(i * coastEdges.length / count)];
		slots.push({ gridX: edge.gridX, gridY: edge.gridY, dir: edge.dir });
	}
	return slots;
}
/**
 * Assign harbor types (in slot order) to this map's harbor slots. Boards
 * from old share links have no harbor types and get no harbors.
 */
CatanMap.prototype.setHarborTypes = function(types) {
	var slots = this.getHarborSlots();
	if (!types || types.length !== slots.length) {
		this.harbors = [];
		return;
	}
	this.harbors = slots.map(function(slot, i) {
		return { gridX: slot.gridX, gridY: slot.gridY, dir: slot.dir, type: types[i] };
	});
}
CatanMap.prototype.draw = function() {

	if (this.hexTiles) {
		drawingContext.clear();
		for (var i = 0; i < this.hexTiles.length; i += 1) {
			this.hexTiles[i].draw();
		}
		if (showHarbors) {
			this.drawHarbors();
		}
		if (showBestSpots) {
			this.drawBestSpots();
		}
	}

}
/**
 * The strongest places for a settlement: corners ranked by total dots,
 * ties going to the corner touching more different resources. Corners
 * next to an already picked one are skipped, since settlements can't be
 * built on neighboring corners.
 */
CatanMap.prototype.getBestSpots = function(count) {
	var ranked = this.getIntersections().map(function(spot) {
		var resources = {};
		spot.tiles.forEach(function(tile) {
			if (tile.resourceType !== "desert") resources[tile.resourceType] = true;
		});
		return {
			x: spot.x,
			y: spot.y,
			pips: spot.tiles.reduce(function(sum, tile) { return sum + pipsFor(tile.number); }, 0),
			variety: Object.keys(resources).length
		};
	}).sort(function(a, b) {
		return (b.pips - a.pips) || (b.variety - a.variety);
	});

	var picked = [];
	for (var i = 0; i < ranked.length && picked.length < count; i += 1) {
		var spot = ranked[i];
		// Neighboring corners are one hex side (1 unit) apart
		var tooClose = picked.some(function(p) {
			return Math.hypot(p.x - spot.x, p.y - spot.y) < 1.5;
		});
		if (!tooClose) picked.push(spot);
	}
	return picked;
}
CatanMap.prototype.drawBestSpots = function() {
	var spots = this.getBestSpots(BEST_SPOT_COUNT);
	var radius = 0.27 * size;

	drawingContext.save();
	drawingContext.textAlign = "center";
	drawingContext.textBaseline = "middle";
	drawingContext.font = "bold " + Math.round(0.32 * size) + "px sans-serif";

	spots.forEach(function(spot, rank) {
		// Corner positions are in hex-size units from the board center
		var x = canvasCenterX + spot.x * size;
		var y = canvasCenterY + spot.y * size;

		// Orange marker with a white ring and dark edge, to stand out on
		// any tile art
		drawingContext.beginPath();
		drawingContext.arc(x, y, radius, 0, 2 * Math.PI, false);
		drawingContext.fillStyle = "#f97316";
		drawingContext.fill();
		drawingContext.lineWidth = 2.6 * lineWidth;
		drawingContext.strokeStyle = "#0b1120";
		drawingContext.stroke();
		drawingContext.lineWidth = 1.3 * lineWidth;
		drawingContext.strokeStyle = "#FFFFFF";
		drawingContext.stroke();

		drawingContext.fillStyle = "#0b1120";
		drawingContext.fillText(String(rank + 1), x, y + Math.round(0.02 * size));
	});

	drawingContext.restore();
}
CatanMap.prototype.drawHarbors = function() {
	for (var i = 0; i < this.harbors.length; i += 1) {
		var harbor = this.harbors[i];
		var tile = this.coordToTile[[harbor.gridX, harbor.gridY].toString()];
		if (!tile) continue;

		// Keep line join and stroke changes from leaking into the tile drawing
		drawingContext.save();

		// Half the vector to the missing neighbor reaches the edge midpoint
		var d = HEX_DIRECTIONS[harbor.dir];
		var vx = dx * d[0] / 2;
		var vy = dy * d[1] / 2;
		var len = Math.sqrt(vx * vx + vy * vy);
		var nx = vx / len;
		var ny = vy / len;
		var midX = tile.xCenter + vx;
		var midY = tile.yCenter + vy;

		// Unit vector along the edge, and the dock's center (for the art and
		// the label)
		var ex = -ny;
		var ey = nx;
		var depth = HARBOR_DEPTH * size;
		var outerHalf = HARBOR_OUTER_HALF_WIDTH * size;
		var centerX = midX + nx * depth / 2;
		var centerY = midY + ny * depth / 2;
		
		// Inner side = the coastal edge between its two corners; outer side
		// is shorter, giving the wedge shape of the game's harbor pieces
		drawingContext.beginPath();
		drawingContext.moveTo(midX - ex * size / 2, midY - ey * size / 2);
		drawingContext.lineTo(midX + ex * size / 2, midY + ey * size / 2);
		drawingContext.lineTo(midX + nx * depth + ex * outerHalf, midY + ny * depth + ey * outerHalf);
		drawingContext.lineTo(midX + nx * depth - ex * outerHalf, midY + ny * depth - ey * outerHalf);
		drawingContext.closePath();
		
		// 3:1 is open water (a port for any resource); 2:1 shows the
		// resource's art
		if (harbor.type === "any") {
			// Lighter water at the shore, deeper out to sea
			var water = drawingContext.createLinearGradient(
				midX, midY, midX + nx * depth, midY + ny * depth
			);
			water.addColorStop(0, "#3b8fd0");
			water.addColorStop(1, "#1d5f99");
			drawingContext.fillStyle = water;
			drawingContext.fill();
		} else {
			var img = resourceTypeToImageCanvas[harbor.type];
			var artHalf = 0.55 * size;
			drawingContext.save();
			drawingContext.clip();
			// Center crop skips the tile scan's cream border
			drawingContext.drawImage(
				img,
				img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6,
				centerX - artHalf, centerY - artHalf, 2 * artHalf, 2 * artHalf
			);
			drawingContext.restore();
		}
		// Gold rim, matching the tile borders
		drawingContext.strokeStyle = "#FAEB96";
		drawingContext.lineWidth = 1.25 * lineWidth;
		drawingContext.lineJoin = "round";
		drawingContext.stroke();
		
		var fontSizePx = Math.round(0.23 * size);
		drawingContext.font = "bold " + fontSizePx + "px sans-serif";
		drawingContext.textAlign = "center";
		drawingContext.textBaseline = "middle";
		var label = harbor.type === "any" ? "3:1" : "2:1";
		var textY = centerY + Math.round(0.06 * fontSizePx);
		// White with a dark outline, legible over water and artwork alike
		drawingContext.strokeStyle = "rgba(0,0,0,0.85)";
		drawingContext.lineWidth = Math.max(2, fontSizePx / 4);
		drawingContext.strokeText(label, centerX, textY);
		drawingContext.fillStyle = "#FFFFFF";
		drawingContext.fillText(label, centerX, textY);

		drawingContext.restore();
	}
}
CatanMap.prototype.resize = function() {
/* Size = Height / ( (coordSpacing + 2) * Math.sin(Math.PI/3) )
 * Size = Width / ( (coordSpacing * (1 + Math.cos(Math.PI/3)) / 2) + 2 )
*/
	// Harbor docks stick out past the tiles; leave room for them. On a top or
	// bottom edge a dock adds its depth. On a side edge (normal 30 degrees off
	// horizontal) its outer corner reaches (apothem + depth) * cos 30 along
	// the normal plus half its outer width * sin 30 along the edge, measured
	// against the tile's half-width of 1.
	var marginX = 0;
	var marginY = 0;
	if (showHarbors && this.harbors.length) {
		var apothem = Math.sin(Math.PI/3);
		marginX = Math.max(0,
			(apothem + HARBOR_DEPTH) * Math.cos(Math.PI/6) +
			HARBOR_OUTER_HALF_WIDTH * Math.sin(Math.PI/6) - 1);
		marginY = HARBOR_DEPTH;
	}

	var wSize = (canvasWidth-10) /
        ( (this.coordSpan[0] * (1 + Math.cos(Math.PI/3)) / 2) + 2 + 2 * marginX );
    var hSize = (canvasHeight-10) /
        ( (this.coordSpan[1] + 2) * Math.sin(Math.PI/3) + 2 * marginY );
    size = Math.floor(Math.min(wSize, hSize));
    dx = size * (1 + Math.cos(Math.PI/3)) / 2;
    dy = size * Math.sin(Math.PI/3);
    lineWidth = Math.max(1, Math.min(3, size / 30));
}

function HexTile() {
	this.gridX;
	this.gridY;
	this.xCenter;
	this.yCenter;
	this.resourceType = "none";
	this.fillStyle = defaultFillStyle;
	this.number;
}
HexTile.prototype.strokeStyle = strokeStyle;
HexTile.prototype.hexColorMap = resourceTypeToColor;
HexTile.prototype.size = size;
HexTile.prototype.setResourceType = function(resourceType) {
	if (this.hexColorMap[resourceType]) {
		this.resourceType = resourceType;
		this.fillStyle = this.hexColorMap[resourceType];
	} else {
		console.log("Unrecognized resource type:",resourceType);
	}
}
HexTile.prototype.isHighlyProductive = function() {
	return ( (this.number == 6) || (this.number == 8) );
}
HexTile.prototype.setNumber = function(number) {
	this.number = number;
}
HexTile.prototype.setCoordinate = function(x,y) {
	this.gridX = x;
	this.gridY = y;
}
HexTile.prototype.draw = function() {
	this.xCenter = canvasCenterX + dx*this.gridX;
	this.yCenter = canvasCenterY + dy*this.gridY;
	
	this.drawBase();
	// Don't draw number if desert, or while numbers are hidden
	if (this.number && showNumbers) {
		this.drawNumber();
	}
}
HexTile.prototype.drawBase = function() {
	if (mapStyle == "retro") {
        drawingContext.lineWidth = Math.max(3, Math.min(10, size / 15));
		drawingContext.fillStyle = "rgba(255,255,255,0)";
		drawingContext.strokeStyle = "#FAEB96";
	} else {
		// Global lineWidth is recomputed by CatanMap.resize()
		drawingContext.lineWidth = lineWidth;
		drawingContext.fillStyle = this.fillStyle;
		drawingContext.strokeStyle = this.strokeStyle;
	}
	
	var angleOffset = Math.PI / 6;
	
	// Begin Path and start at top of hexagon
	drawingContext.beginPath();
	drawingContext.moveTo (
		this.xCenter + size * Math.sin(angleOffset),
		this.yCenter - size * Math.cos(angleOffset)
	);
	// Move clockwise and draw hexagon
	var newAngle;
	for (var i = 1; i <= 6; i += 1) {
		newAngle = i * Math.PI / 3;
		drawingContext.lineTo (
			this.xCenter + size * Math.sin(newAngle + angleOffset),
			this.yCenter - size * Math.cos(newAngle + angleOffset)
		);
	}
	drawingContext.closePath();
	
	if (mapStyle == "retro") {
		
		var imgCanvas = resourceTypeToImageCanvas[this.resourceType];
		
		drawingContext.drawImage(
			imgCanvas,
			0, 0, imgCanvas.width, imgCanvas.height, 
			this.xCenter - size,
			this.yCenter - dy,
			2*size,
			2*dy
		);
		
	} else {
		drawingContext.fill();
	}
	
	drawingContext.stroke();
	
}
HexTile.prototype.drawNumber = function() {
	
	drawingContext.fillStyle = "#FFFFFF";
	drawingContext.strokeStyle = "#000000";
	drawingContext.lineWidth = lineWidth;
	
	drawingContext.beginPath();
	drawingContext.arc(this.xCenter, this.yCenter, 0.375 * size,
		0, 2 * Math.PI, false);
	drawingContext.closePath();
	
	drawingContext.fill();
	drawingContext.stroke();
	
	// Scale with the token (radius 0.375*size) so two digits still fit,
	// leaving room for the dots underneath
	var fontSizePx = Math.round(0.37 * size);

	drawingContext.font = "bold " + fontSizePx + "px sans-serif";
	drawingContext.textAlign = "center";
	drawingContext.textBaseline = "middle";
	drawingContext.fillStyle = this.isHighlyProductive() ? "#FF0000" : "#000000";
	drawingContext.fillText(
		this.number.toString(),
		this.xCenter,
		// Above center to make room for the dots; "middle" sits a touch
		// high for digits, hence the small nudge back down
		this.yCenter - 0.07 * size + Math.round(0.06 * fontSizePx)
	);

	// Dots under the number, like the real tokens: one per way to roll it
	// with two dice (5 for 6 and 8, down to 1 for 2 and 12)
	var dots = pipsFor(this.number);
	var dotRadius = Math.max(1, 0.032 * size);
	var dotSpacing = 0.085 * size;
	var dotsY = this.yCenter + 0.2 * size;
	var firstX = this.xCenter - (dots - 1) * dotSpacing / 2;
	for (var i = 0; i < dots; i += 1) {
		drawingContext.beginPath();
		drawingContext.arc(firstX + i * dotSpacing, dotsY, dotRadius, 0, 2 * Math.PI, false);
		drawingContext.fill();
	}
	
}

Array.prototype.random = function(removeElem) {
	var idx = Math.floor(Math.random() * this.length);
	var val = this[idx];
	if (removeElem) {
		this.splice(idx,1);
	}
	return val;
}
Array.prototype.copy = function() {
	return this.slice();
}

function addCanvas() {
	mapCanvas = document.createElement("canvas");
	drawingContext = mapCanvas.getContext('2d');
	mapCanvas.id = "map-canvas";
	
	// Inside the board card, above the balance pill
	document.getElementById("map-container").insertBefore(
		mapCanvas,
		document.getElementById("board-balance")
	);
	
	sizeCanvas();
	watchCanvasSize();
	
}

function sizeCanvas() {
    if (!mapCanvas) return;
    // Back the canvas with device pixels so it stays sharp on high-DPI
    // screens, but keep all drawing math in CSS pixels via the transform.
    // The canvas's own box is measured, not the card's: the balance pill
    // takes the bottom of the card.
    var dpr = window.devicePixelRatio || 1;
    canvasWidth = mapCanvas.clientWidth;
    canvasHeight = mapCanvas.clientHeight;
    $(mapCanvas).attr("width", Math.round(canvasWidth * dpr));
    $(mapCanvas).attr("height", Math.round(canvasHeight * dpr));
    drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasCenterY = canvasHeight/2;
    canvasCenterX = canvasWidth/2;
}

// http://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
CanvasRenderingContext2D.prototype.clear = 
  CanvasRenderingContext2D.prototype.clear || function (preserveTransform) {
    if (preserveTransform) {
      this.save();
      this.setTransform(1, 0, 0, 1, 0, 0);
    }

    this.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (preserveTransform) {
      this.restore();
    }           
};
