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

    showBoardState(state, true);

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
function showBoardState(state, dropIn) {
    loadStateIntoMap(catanMap, state);
    sizeCanvas();
    catanMap.resize();
    updateShareUrl();
    updateBalanceDisplay();
    if (dropIn && !motionReduced()) {
        dropInBoard();
    } else {
        catanMap.draw();
    }
}

// ----- First board drop-in -----
// A board shown on an empty card (opening the app, a shared link, or after
// Clear all boards) falls into place: each tile, with its number token, and
// each harbor drops straight down from the sky above its own spot, in a
// random order, its shadow on the card darkening as it nears, and lands with
// a little bump. Then the score pill fades in.

// How long one piece takes to fall and land, and the spread of start times,
// in ms
var PIECE_DROP_MS = 480;
var DROP_SPREAD_MS = 650;
// requestAnimationFrame id while a drop-in is running
var dropFrame = null;

/** Stop a drop-in (the caller draws the board in full). */
function stopDropIn() {
    if (dropFrame === null) return;
    cancelAnimationFrame(dropFrame);
    dropFrame = null;
    document.getElementById("board-balance").style.opacity = "";
}

// A falling piece at progress p (0..1). Height shows as size: it starts
// 1.8 times as big (high above, nearer the eye), shrinks faster and faster as
// it falls, then gives a small bump as it lands. Scale, opacity, and how
// close it is to the card (0..1, for its shadow).
function pieceDropLook(p) {
    const fall = 0.78;
    if (p < fall) {
        const near = (p / fall) * (p / fall);
        return { s: 1.8 - 0.8 * near, alpha: Math.min(1, 5 * p / fall), near: near };
    }
    return { s: 1 - 0.05 * Math.sin(Math.PI * (p - fall) / (1 - fall)), alpha: 1, near: 1 };
}

// Trace a hexagon of the board's tile size around a point
function hexPath(x, y) {
    drawingContext.beginPath();
    for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        drawingContext.lineTo(x + size * Math.sin(angle), y - size * Math.cos(angle));
    }
    drawingContext.closePath();
}

/**
 * Animate catanMap onto the empty canvas (see above). Any full draw of the
 * board stops it; resizes carry on with it.
 */
function dropInBoard() {
    stopDropIn();
    const map = catanMap;
    const pill = document.getElementById("board-balance");
    pill.style.transition = "none";
    pill.style.opacity = "0";

    // Every piece, with when it starts falling; harbors come a bit later,
    // around the tiles
    const pieces = map.hexTiles.map((tile) => ({ tile: tile, start: DROP_SPREAD_MS * 0.8 * Math.random() }));
    if (showHarbors) {
        map.harbors.forEach((harbor) => {
            pieces.push({ harbor: harbor, start: DROP_SPREAD_MS * (0.35 + 0.65 * Math.random()) });
        });
    }
    const end = Math.max(...pieces.map((piece) => piece.start)) + PIECE_DROP_MS;

    const start = performance.now();
    const frame = (now) => {
        const t = now - start;
        drawingContext.clear();
        // Where everything goes, at the canvas's current size
        const placed = pieces.map((piece) => {
            const p = Math.max(0, Math.min(1, (t - piece.start) / PIECE_DROP_MS));
            if (piece.tile) {
                const tile = piece.tile;
                tile.xCenter = canvasCenterX + dx * tile.gridX;
                tile.yCenter = canvasCenterY + dy * tile.gridY;
                return { piece: piece, p: p, x: tile.xCenter, y: tile.yCenter };
            }
            const place = map.harborPlace(piece.harbor);
            return place && { piece: piece, p: p, x: place.centerX, y: place.centerY, place: place };
        }).filter((item) => item && item.p > 0);

        // Landed pieces first, then the falling ones' shadows on the card,
        // then the falling ones, highest (biggest) on top
        const landed = placed.filter((item) => item.p >= 1);
        const falling = placed.filter((item) => item.p < 1)
            .map((item) => Object.assign(item, { look: pieceDropLook(item.p) }))
            .sort((a, b) => b.look.s - a.look.s);
        const drawPiece = (item) => {
            if (item.piece.tile) {
                item.piece.tile.drawBase();
                if (item.piece.tile.number && showNumbers) item.piece.tile.drawNumber();
            } else {
                map.drawHarbor(item.piece.harbor, item.place);
            }
        };
        landed.forEach(drawPiece);
        falling.forEach((item) => {
            if (!item.piece.tile) return;
            drawingContext.fillStyle = `rgba(0, 0, 0, ${0.35 * item.look.near})`;
            hexPath(item.x, item.y + 0.06 * size);
            drawingContext.fill();
        });
        falling.slice().reverse().forEach((item) => {
            drawingContext.save();
            drawingContext.globalAlpha = item.look.alpha;
            drawingContext.translate(item.x, item.y);
            drawingContext.scale(item.look.s, item.look.s);
            drawingContext.translate(-item.x, -item.y);
            drawPiece(item);
            drawingContext.restore();
        });

        if (t < end) {
            dropFrame = requestAnimationFrame(frame);
            return;
        }
        dropFrame = null;
        map.draw();
        pill.style.transition = "opacity 250ms ease-out";
        pill.style.opacity = "";
    };
    dropFrame = requestAnimationFrame(frame);
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
// Swipe the board card up and it's thrown off the top of the screen, like
// a sideways swipe, uncovering a share card underneath: the board's QR code
// (so a phone at the table can scan it), Copy link, and Share… where the
// Web Share API exists. Pull the share card down and the board card comes
// back down over it. Settings > Share, and the header button on wider
// screens, open it too.

var shareOpen = false;
// The link the share card shows, for Copy link and Share…
var shareUrl = "";

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
    shareUrl = url.toString();
    renderQrCode(document.getElementById("share-qr"), shareUrl);
    document.getElementById("share-copy").textContent = "Copy link";
    document.getElementById("share-native").hidden = !navigator.share;
}

/** Board navigation is off while the share card shows (the QR would go stale) */
function setBoardControlsInert(inert) {
    document.querySelector(".board-nav").inert = inert;
    document.getElementById("board-pager").inert = inert;
}

// The board card's y fully off the top of the screen, past the header
function boardAwayY() {
    const card = document.getElementById("map-container");
    const top = document.querySelector(".card-stack").getBoundingClientRect().top;
    return -(top + card.offsetHeight * 1.1 + 24);
}

/**
 * The board card at a pose and the share card under it: like the next
 * board on a sideways swipe, the share card grows to full size as the
 * board card moves away. Returned as tracks for playFrames, or
 * applyBoardPose to set them directly.
 */
function shareTracks() {
    const card = document.getElementById("map-container");
    const height = card.offsetHeight;
    return [
        { el: card, style: (pose) => ({ transform: poseTransform(pose) }) },
        { el: document.getElementById("share-card"),
            style: (pose) => backCardStyle(Math.min(1, Math.abs(pose.y) / (height * 0.6))) }
    ];
}

function applyBoardPose(pose) {
    shareTracks().forEach((track) => Object.assign(track.el.style, track.style(pose)));
}

// Share card about to show: under the board card, small, with its link
function showShareCardUnder() {
    const share = document.getElementById("share-card");
    prepareShareCard();
    Object.assign(share.style, backCardStyle(0));
    share.hidden = false;
    document.querySelector(".card-stack").classList.add("is-lifted");
}

// Share card away: hide it and put the board card back as it was
function resetShareCard() {
    const card = document.getElementById("map-container");
    const share = document.getElementById("share-card");
    share.hidden = true;
    share.style.transform = "";
    share.style.opacity = "";
    card.style.transform = "";
    card.style.visibility = "";
    document.querySelector(".card-stack").classList.remove("is-lifted");
}

/**
 * Throw the board card off the top of the screen from fromPose ({x, y, r,
 * s}) at velocity ({x, y} px/ms), the share card growing to full size
 * under it, and keep it there out of sight.
 */
async function throwBoardUp(fromPose, velocity) {
    const card = document.getElementById("map-container");
    const from = Object.assign({ x: 0, y: 0, r: 0, s: 1 }, fromPose);
    const exit = boardAwayY();
    let last = { x: 0, y: exit, r: 0, s: 1 };
    if (!motionReduced()) {
        boardSliding = true;
        const frames = throwFrames(from, -1, velocity, exit, "y");
        last = frames[frames.length - 1];
        const motion = playFrames(frames, shareTracks());
        activeMotion = motion;
        await motion.done;
        applyBoardPose(last);
        motion.cancel();
        activeMotion = null;
        boardSliding = false;
    }
    applyBoardPose(last);
    card.style.visibility = "hidden";
}

/**
 * Spring the board card from fromPose back to rest over the share card at
 * velocity ({x, y} px/ms), the share card stepping back under it, then put
 * the share card away.
 */
async function springBoardHome(fromPose, velocity) {
    const card = document.getElementById("map-container");
    card.style.visibility = "";
    if (!motionReduced()) {
        boardSliding = true;
        const spring = playFrames(simulateSpring({
            from: Object.assign({ x: 0, y: 0, r: 0, s: 1 }, fromPose),
            to: { x: 0, y: 0, r: 0, s: 1 },
            velocity: { x: velocity.x * 1000, y: velocity.y * 1000 },
            stiffness: 340,
            damping: 33
        }), shareTracks());
        activeMotion = spring;
        await spring.done;
        spring.cancel();
        activeMotion = null;
        boardSliding = false;
    }
    resetShareCard();
}

/**
 * Show the share card: the board card is thrown up off the screen. fromPose
 * and velocity are a swipe's at release; with neither it gets a firm push
 * from rest.
 */
async function openShareCard(fromPose, velocity) {
    if (shareOpen || !catanMap.hexTiles) return;
    if (!(await settleMotion())) return;
    if (!fromPose) showShareCardUnder();
    shareOpen = true;
    document.body.classList.add("share-open");
    setBoardControlsInert(true);
    setCardHint(null);
    await throwBoardUp(fromPose, velocity || { x: 0, y: -1.2 });
    document.getElementById("share-card").focus({ preventScroll: true });
}

/**
 * Bring the board card back down over the share card, from fromPose (where
 * a pull left it; default off the top) at velocity ({x, y} px/ms).
 */
async function closeShareCard(fromPose, velocity) {
    if (!shareOpen) return;
    if (!(await settleMotion())) return;
    // Closed as of now; the board card finishes coming down
    shareOpen = false;
    document.body.classList.remove("share-open");
    setBoardControlsInert(false);
    await springBoardHome(fromPose || { y: boardAwayY() }, velocity || { x: 0, y: 0 });
}

function setUpShareCard() {
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
    $(copyButton).click(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copyButton.textContent = "Copied!";
        } catch (err) {
            // Clipboard blocked: show the link to copy by hand
            window.prompt("Copy this link:", shareUrl);
        }
    });

    $(nativeButton).click(async () => {
        try {
            await navigator.share({
                title: "Catan Board",
                text: "Check out this Catan board!",
                url: shareUrl
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
			// A drop-in redraws every frame anyway
			if (dropFrame === null) catanMap.draw();
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

        // Settings > Clear all boards, after a check (it can't be undone)
        $("#clear-boards").click(() => {
            const total = boardHistory.length;
            const question = total === 1
                ? "Clear the board from this session? This can't be undone."
                : `Clear all ${total} boards from this session? This can't be undone.`;
            if (!window.confirm(question)) return;
            closeDialog(document.getElementById("settings-dialog"));
            clearAllBoards();
        });

        setUpShareCard();
        setUpBoardSwipe();
        setUpPagerScrub();

        enableButtons();

        hideLoadingState();

        // Open on the shared board if the link has one, else a new board
        const url = new URL(window.location);
        const encodedBoard = url.searchParams.get('board');
        const boardState = encodedBoard && decodeBoardShort(encodedBoard);
        if (boardState) {
            loadBoardFromDecodedState(boardState);
        } else {
            generate();
        }
    });
}

// Fade out "Preparing your board…" as the first board drops in
function hideLoadingState() {
    const loading = document.getElementById("map-loading-state");
    if (!loading) return;
    loading.style.transition = "opacity 200ms ease-out";
    loading.style.opacity = "0";
    loading.style.pointerEvents = "none";
    setTimeout(() => loading.remove(), 200);
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
    // The first board on the empty card drops in
    showBoardState(state, boardHistory.length === 0);
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

// ----- Springs -----
// Card motion after a release runs on damped springs seeded with the
// finger's speed, so it carries on from the gesture and settles naturally
// instead of following a fixed curve.

// The card motion in progress ({finish, done}), so a new gesture or tap
// can jump it to the end instead of waiting
var activeMotion = null;

/**
 * Finish any card motion in progress and wait for it, so the next action
 * starts right away. Returns false if something still blocks input.
 */
async function settleMotion() {
    if (activeMotion) {
        const motion = activeMotion;
        motion.finish();
        await motion.done;
    }
    return !boardSliding;
}

// A card pose {x, y, r (deg), s} as a CSS transform
function poseTransform(pose) {
    return `translate(${pose.x || 0}px, ${pose.y || 0}px) rotate(${pose.r || 0}deg) scale(${pose.s === undefined ? 1 : pose.s})`;
}

// Card motion is computed up front and played as a keyframe animation,
// so the browser runs it on its compositor at the display's full refresh
// rate (120Hz on ProMotion iPhones, where frame-by-frame JavaScript is held
// to 60Hz) and board drawing on the main thread can't stall it
var SPRING_FPS = 120;

/**
 * Simulate a damped spring (mass 1) on several values at once and return
 * their values every 1/120s until they settle on `to`. velocity is per
 * second.
 */
function simulateSpring({ from, to, velocity = {}, stiffness = 300, damping = 26 }) {
    const keys = Object.keys(to);
    const value = {};
    const speed = {};
    keys.forEach((k) => {
        value[k] = from[k] === undefined ? to[k] : from[k];
        speed[k] = velocity[k] || 0;
    });
    // Scale-like values settle on a finer tolerance than px and degrees
    const fine = (k) => k === "s";
    const frames = [Object.assign({}, value)];
    const step = 1 / SPRING_FPS;
    for (let i = 0; i < SPRING_FPS * 2; i += 1) {
        // Small substeps keep stiff springs stable
        for (let sub = 0; sub < 2; sub += 1) {
            keys.forEach((k) => {
                const accel = -stiffness * (value[k] - to[k]) - damping * speed[k];
                speed[k] += accel * step / 2;
                value[k] += speed[k] * step / 2;
            });
        }
        frames.push(Object.assign({}, value));
        const settled = keys.every((k) =>
            Math.abs(value[k] - to[k]) < (fine(k) ? 0.0005 : 0.3) &&
            Math.abs(speed[k]) < (fine(k) ? 0.005 : 3));
        if (settled) break;
    }
    frames[frames.length - 1] = Object.assign({}, to);
    return frames;
}

/**
 * The path of a thrown card, as 120fps frames {x, y, r, s}. It leaves at
 * exactly the release velocity (no jump in speed) and accelerates, or eases
 * for a hard flick, at a constant rate until it's fully off screen, over
 * 170-280ms depending on how hard it was thrown, so the eye can follow it.
 * It keeps tilting as it goes. Thrown along axis ("x" or "y") in
 * direction (1 or -1) to exit, a position on that axis far enough that the
 * tilted card has fully left the screen; v is the release velocity in
 * px/ms.
 */
function throwFrames(from, direction, v, exit, axis = "x") {
    const cross = axis === "x" ? "y" : "x";
    const distance = Math.abs(exit - from[axis]);
    const duration = Math.max(170, Math.min(280, distance / Math.max(direction * v[axis], 2)));
    // Speed along the throw at release; capped so a huge flick still ends
    // moving outward rather than doubling back
    const v0 = Math.min(Math.max(0, direction * v[axis]), 2 * distance / duration);
    const accel = 2 * (distance - v0 * duration) / (duration * duration);
    // Sideways throws lean into the throw; upward ones keep leaning the way
    // they already were
    const extraTilt = axis === "x" ? direction * 16 : Math.sign(from.r) * 6;
    const frames = [];
    const count = Math.max(2, Math.ceil(duration * SPRING_FPS / 1000));
    for (let i = 0; i <= count; i += 1) {
        const t = duration * i / count;
        const travel = v0 * t + 0.5 * accel * t * t;
        const frame = { r: from.r + extraTilt * (travel / distance), s: 1 };
        frame[axis] = from[axis] + direction * travel;
        frame[cross] = from[cross] + v[cross] * t * 0.6;
        frames.push(frame);
    }
    return frames;
}

/**
 * Play precomputed motion frames (a spring or a throw path) as keyframe
 * animations on one or more elements: tracks are
 * [{el, style(values) -> keyframe}]. Returns
 * {done, finish, cancel}: finish() jumps to the end; cancel() drops the
 * animations (call it once the final styles are set inline).
 */
function playFrames(frames, tracks) {
    const duration = Math.max(1, (frames.length - 1) * 1000 / SPRING_FPS);
    const anims = tracks.map((track) => track.el.animate(frames.map(track.style), {
        duration: duration,
        easing: "linear",
        fill: "forwards"
    }));
    const done = Promise.all(anims.map((a) => a.finished)).then(() => {}, () => {});
    return {
        done: done,
        finish: () => anims.forEach((a) => { try { a.finish(); } catch (err) { /* already done */ } }),
        cancel: () => anims.forEach((a) => a.cancel())
    };
}

// How far the card underneath has grown (0..1), for the swap
var backProgress = 0;

/**
 * The card underneath's look for how far the top card has moved away
 * (progress 0..1): slightly smaller, growing to full size, and nearly
 * opaque throughout so the next board reads as already there, just behind.
 */
function backCardStyle(progress) {
    return {
        transform: `scale(${0.94 + 0.06 * progress})`,
        opacity: String(0.85 + 0.15 * progress)
    };
}

function setBackCardProgress(progress) {
    const back = document.getElementById("map-back");
    backProgress = progress;
    Object.assign(back.style, backCardStyle(progress));
}

function hideBackCard() {
    const back = document.getElementById("map-back");
    back.classList.remove("is-visible");
    back.style.transform = "";
    back.style.opacity = "";
    backProgress = 0;
}

/**
 * Fling the top card off toward `direction` (1 = right, -1 = left) and make
 * `move` current. fromPose is where a swipe left the card and velocity its
 * speed at release ({x, y} px/ms): the card carries on at that speed and
 * glides fully off screen (throwFrames), and the top card takes over the
 * next board.
 */
async function flingCard(direction, move, fromPose, velocity) {
    const card = document.getElementById("map-container");
    if (motionReduced()) {
        card.style.transform = "";
        hideBackCard();
        move.change();
        return;
    }
    boardSliding = true;
    const back = document.getElementById("map-back");
    showOnBackCard(move.state);
    back.classList.add("is-visible");
    // From a button there's no drag: start the next board well in view
    if (!fromPose) setBackCardProgress(0.5);
    const startBack = backProgress;

    const width = card.offsetWidth;
    const from = Object.assign({ x: 0, y: 0, r: 0, s: 1 }, fromPose);
    const v = velocity || { x: 0, y: 0 };
    // The next board grows to full size as the card clears the card area
    const backAt = (pose) => Math.max(startBack, Math.min(1, Math.abs(pose.x) / width));
    // From a button there's no throw: give it a firm push to start
    const throwV = fromPose ? v : { x: direction * 1.2, y: 0 };
    const motion = playFrames(throwFrames(from, direction, throwV, direction * width * 1.45), [
        { el: card, style: (pose) => ({ transform: poseTransform(pose) }) },
        { el: back, style: (pose) => backCardStyle(backAt(pose)) }
    ]);
    // The animations hold the positions from here on
    card.style.transform = "";
    activeMotion = motion;
    await motion.done;

    // The board underneath is full size by now: the top card draws it and
    // comes back to the middle in the same task, so the swap never shows
    move.change();
    motion.cancel();
    hideBackCard();
    activeMotion = null;
    boardSliding = false;
}

async function showPreviousBoard() {
    if (!(await settleMotion())) return;
    const move = prepareMove("prev");
    if (move) flingCard(1, move);
}

async function showNextBoard() {
    if (!(await settleMotion())) return;
    const move = prepareMove("next");
    if (move) flingCard(-1, move);
}

async function showNewBoard() {
    if (!(await settleMotion())) return;
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
 * direction; the card then follows the finger freely, with movement off
 * that direction damped:
 * - Left or right: it tilts (more when grabbed near the top, like a held
 *   card), with the board you'd move to showing underneath. Past the
 *   threshold, or on a flick, it's thrown off; otherwise it springs back.
 *   Swiping right on the first board resists.
 * - Up: the same, with the share card showing underneath. Past a quarter
 *   of its height, or on an upward flick, it's thrown off the top of the
 *   screen; otherwise it springs back.
 * - While the share card shows: pull it down and the board card comes
 *   down from the top with the finger, springing back into place past a
 *   quarter of its height or on a downward flick; otherwise it's thrown
 *   back up.
 * A new gesture during a motion finishes the motion at once. The stack has
 * touch-action: pinch-zoom, so one-finger drags are all ours (no page
 * scroll on the card) and pinch still zooms.
 */
function setUpBoardSwipe() {
    const card = document.getElementById("map-container");
    const stack = document.querySelector(".card-stack");
    const back = document.getElementById("map-back");
    const share = document.getElementById("share-card");
    let start = null;
    // null until the direction is picked: "x", "up", "down", or with the
    // share card open "open" (picking) and "pull" (pulling the board down)
    let mode = null;
    let pose = { x: 0, y: 0, r: 0, s: 1 };
    // Where the board card waits off the top while the share card shows
    let awayY = 0;
    // How much the card tilts for where it was grabbed: 1 near the top,
    // less in the middle, the other way near the bottom (like a held card)
    let tiltScale = 1;
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
        if (samples.length < 2) return { x: 0, y: 0 };
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last[0] - first[0]);
        return { x: (last[1] - first[1]) / dt, y: (last[2] - first[2]) / dt };
    };

    const reset = () => {
        start = null;
        mode = null;
        kind = null;
        move = null;
        samples = [];
    };

    // Swipe up begins: the share card shows underneath, and the stack goes
    // over the header so the board card can be thrown past it
    const beginUp = () => {
        setCardHint(null);
        showShareCardUnder();
    };

    // Spring back to rest from a released pose, carrying its velocity
    const springBack = (fromPose, vel) => {
        const width = card.offsetWidth;
        if (motionReduced()) {
            card.style.transform = "";
            hideBackCard();
            return;
        }
        const withBack = back.classList.contains("is-visible");
        const tracks = [{ el: card, style: (p) => ({ transform: poseTransform(p) }) }];
        if (withBack) {
            tracks.push({ el: back, style: (p) => backCardStyle(Math.min(1, Math.abs(p.x) / (width * 0.6))) });
        }
        const spring = playFrames(simulateSpring({
            from: fromPose,
            to: { x: 0, y: 0, r: 0, s: 1 },
            velocity: { x: vel.x * 1000, y: vel.y * 1000 },
            stiffness: 340,
            damping: 33
        }), tracks);
        card.style.transform = "";
        activeMotion = spring;
        spring.done.then(() => {
            spring.cancel();
            if (activeMotion === spring) activeMotion = null;
            hideBackCard();
        });
    };

    // Listen on the stack, not the card: mid-motion the card may have moved
    // out from under the finger, but a new swipe should still catch it
    stack.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || !catanMap.hexTiles) return;
        // With the share card showing, its buttons work normally
        if (shareOpen && event.target.closest("button, a")) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // Mid-motion: jump it to the end (its cleanup runs before the next
        // pointermove) and start this gesture straight away
        if (activeMotion) activeMotion.finish();
        else if (boardSliding) return;
        reset();
        start = { x: event.clientX, y: event.clientY, id: event.pointerId };
        const rect = card.getBoundingClientRect();
        const fromCenter = Math.max(-1, Math.min(1,
            (rect.top + rect.height / 2 - event.clientY) / (rect.height / 2)));
        tiltScale = 0.25 + 0.75 * fromCenter;
        track(event);
        if (shareOpen) mode = "open";
    });

    stack.addEventListener("pointermove", (event) => {
        if (!start || event.pointerId !== start.id) return;
        track(event);
        const moveX = event.clientX - start.x;
        const moveY = event.clientY - start.y;
        if (mode === "down") return;

        if (mode === "open") {
            // Pulling down brings the board card; anything else is a tap
            if (moveY < 6 || Math.abs(moveX) > moveY) return;
            mode = "pull";
            awayY = boardAwayY();
            card.style.visibility = "";
            stack.setPointerCapture(event.pointerId);
        }
        if (mode === "pull") {
            // Down from off the top with the finger, resisting past its spot
            const y = awayY + moveY;
            const x = moveX * 0.3;
            pose = { x: x, y: y < 0 ? y : y * 0.2, r: Math.max(-20, Math.min(20, x * 0.09)), s: 1 };
            applyBoardPose(pose);
            return;
        }

        if (!mode) {
            if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return;
            if (Math.abs(moveX) >= Math.abs(moveY)) {
                mode = "x";
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
            const x = moveX * 0.3;
            pose = {
                x: x,
                y: moveY < 0 ? moveY : moveY * 0.2,
                r: Math.max(-20, Math.min(20, x * 0.09 * tiltScale)),
                s: 1
            };
            applyBoardPose(pose);
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
        const x = move ? moveX : moveX * 0.25;
        pose = {
            x: x,
            y: moveY * 0.3,
            r: Math.max(-20, Math.min(20, x * 0.09 * tiltScale)),
            s: 1
        };
        card.style.transform = poseTransform(pose);
        if (move) setBackCardProgress(Math.min(1, Math.abs(x) / (card.offsetWidth * 0.6)));
    });

    // A long press shouldn't open a context menu
    stack.addEventListener("contextmenu", (event) => {
        if (!share.contains(event.target)) event.preventDefault();
    });

    const finish = (event) => {
        if (!start || event.pointerId !== start.id) return;
        track(event);
        const released = event.type === "pointerup";
        const vel = velocity();
        const travelX = event.clientX - start.x;
        const travelY = event.clientY - start.y;
        const thisMode = mode;
        const thisMove = move;
        const fromPose = Object.assign({}, pose);
        reset();
        pose = { x: 0, y: 0, r: 0, s: 1 };

        // Board card pulled down far enough, or flicked down, it comes
        // back; otherwise it's thrown back up
        if (thisMode === "pull") {
            const flicked = vel.y > FLICK_VELOCITY && travelY > 24;
            if (released && (travelY >= shareThreshold() || flicked)) {
                closeShareCard(fromPose, vel);
            } else {
                throwBoardUp(fromPose, vel);
            }
            return;
        }

        if (thisMode === "up") {
            const flicked = vel.y < -FLICK_VELOCITY && -fromPose.y > 24;
            if (released && (-fromPose.y >= shareThreshold() || flicked)) {
                openShareCard(fromPose, vel);
            } else {
                springBoardHome(fromPose, vel);
            }
            return;
        }

        if (thisMode !== "x") return;

        const flicked = Math.abs(vel.x) > FLICK_VELOCITY && Math.abs(fromPose.x) > 24 &&
            Math.sign(vel.x) === Math.sign(fromPose.x);
        if (released && thisMove && (Math.abs(fromPose.x) >= SWIPE_THRESHOLD_PX || flicked)) {
            flingCard(fromPose.x > 0 ? 1 : -1, thisMove, fromPose, vel);
            return;
        }
        springBack(fromPose, vel);
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

    // Settings > Clear all boards
    const total = boardHistory.length;
    document.getElementById("clear-boards").disabled = total === 0;
    document.getElementById("clear-boards-note").textContent = total === 0
        ? "No boards yet"
        : `${total} board${total === 1 ? "" : "s"} this session`;
}

/**
 * Forget every board generated this session and go back to the empty card
 * the app starts with.
 */
async function clearAllBoards() {
    if (!(await settleMotion())) return;
    if (shareOpen) {
        shareOpen = false;
        document.body.classList.remove("share-open");
        setBoardControlsInert(false);
        resetShareCard();
    }
    boardHistory = [];
    currentBoardIndex = -1;
    catanMap.hexTiles = null;
    drawingContext.clear();
    document.getElementById("board-balance").hidden = true;
    // The address bar no longer shares a board
    const url = new URL(window.location);
    url.searchParams.delete("board");
    window.history.replaceState({}, "", url);
    enableButtons();
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
    if (!pager) return;
    if (total === 0) {
        pager.hidden = true;
        return;
    }

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

	if (this === catanMap) stopDropIn();
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
		var place = this.harborPlace(this.harbors[i]);
		if (place) this.drawHarbor(this.harbors[i], place);
	}
}

/**
 * Where a harbor's dock goes, off its tile's coastal edge: the edge
 * midpoint, the outward normal (nx, ny) and the edge direction (ex, ey),
 * its depth and outer half-width, and its center (for the art and label).
 * null if its tile isn't on the board.
 */
CatanMap.prototype.harborPlace = function(harbor) {
	var tile = this.coordToTile[[harbor.gridX, harbor.gridY].toString()];
	if (!tile) return null;

	// Half the vector to the missing neighbor reaches the edge midpoint
	var d = HEX_DIRECTIONS[harbor.dir];
	var vx = dx * d[0] / 2;
	var vy = dy * d[1] / 2;
	var len = Math.sqrt(vx * vx + vy * vy);
	var nx = vx / len;
	var ny = vy / len;
	var midX = canvasCenterX + dx * tile.gridX + vx;
	var midY = canvasCenterY + dy * tile.gridY + vy;
	var depth = HARBOR_DEPTH * size;
	return {
		midX: midX, midY: midY, nx: nx, ny: ny, ex: -ny, ey: nx,
		depth: depth,
		outerHalf: HARBOR_OUTER_HALF_WIDTH * size,
		centerX: midX + nx * depth / 2,
		centerY: midY + ny * depth / 2
	};
}

CatanMap.prototype.drawHarbor = function(harbor, place) {
	var midX = place.midX, midY = place.midY;
	var nx = place.nx, ny = place.ny, ex = place.ex, ey = place.ey;
	var depth = place.depth, outerHalf = place.outerHalf;
	var centerX = place.centerX, centerY = place.centerY;

	// Keep line join and stroke changes from leaking into the tile drawing
	drawingContext.save();

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
