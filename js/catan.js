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
    boardHistory = [state];
    currentBoardIndex = 0;
    enableButtons();
}

/**
 * Capture the board on screen as plain data for history and sharing.
 */
function snapshotBoard() {
    return {
        tiles: catanMap.hexTiles.map(tile => ({
            resourceType: tile.resourceType,
            number: tile.number,
            gridX: tile.gridX,
            gridY: tile.gridY
        })),
        harborTypes: catanMap.harbors.map(h => h.type)
    };
}

/**
 * Put a board state ({tiles, harborTypes}) on screen and in the URL.
 */
function showBoardState(state) {
    // Determine map type based on tile count, and match the game type switch
    // (setting .checked doesn't fire "change", so this won't regenerate)
    let gameType = null;
    if (state.tiles.length === normalMap.coordinatesArray.length) {
        catanMap.defineMap(normalMap);
        gameType = "normal";
    } else if (state.tiles.length === expandedMap.coordinatesArray.length) {
        catanMap.defineMap(expandedMap);
        gameType = "expanded";
    } else {
        console.warn("Unknown map size; cannot set map definition correctly.");
    }
    if (gameType) {
        $(`input[name=game-type][value=${gameType}]`)[0].checked = true;
    }

    catanMap.hexTiles = state.tiles.map(t => {
        const tile = new HexTile();
        tile.setCoordinate(t.gridX, t.gridY);
        tile.setResourceType(t.resourceType);
        if (t.number !== null && t.number !== undefined) tile.setNumber(t.number);
        return tile;
    });

    catanMap.coordToTile = {};
    catanMap.hexTiles.forEach(tile => {
        catanMap.coordToTile[[tile.gridX, tile.gridY].toString()] = tile;
    });

    catanMap.setHarborTypes(state.harborTypes);

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

    const balance = catanMap.getBalance();
    el.querySelector(".balance-score").textContent = balance.score + "/10";
    el.querySelector(".balance-label").textContent = balance.label;
    el.querySelector(".balance-reason").textContent = balance.reason;
    el.dataset.level = balance.label.toLowerCase();
    el.hidden = false;
}

// ----- Share dialog -----

/**
 * The share button opens a dialog with a QR code of the board's link (so a
 * phone at the table can scan it off a laptop), the link itself, Copy
 * link, and Share… where the browser supports the Web Share API.
 */
function setUpShareDialog() {
    const dialog = document.getElementById("share-dialog");
    const urlInput = document.getElementById("share-url");
    const copyButton = document.getElementById("share-copy");
    const nativeButton = document.getElementById("share-native");

    $("#share-catan-board").click(() => {
        const encoded = encodeBoardShort();
        if (!encoded) return;

        const url = new URL(window.location);
        url.searchParams.set("board", encoded);
        const shareUrl = url.toString();

        renderQrCode(document.getElementById("share-qr"), shareUrl);
        urlInput.value = shareUrl;
        copyButton.textContent = "Copy link";
        nativeButton.hidden = !navigator.share;
        dialog.showModal();
    });

    $("#share-close").click(() => closeDialog(dialog));

    // Esc and backdrop clicks close it with the same animation (ui.js)
    setUpDialogClosing(dialog);

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
            // Cancelled or failed; the dialog stays open with the other options
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

window.onresize = function(event) {
	sizeCanvas();
	catanMap.resize();
	catanMap.draw();
}

function init() {
    // Ensure the canvas exists early so we can render as soon as images and board data are ready
    addCanvas();

    loadImages(function () {
        // Wire up buttons (we do this after images are loaded to keep behavior consistent)
        const genButton = $('button#gen-map-button')[0];
        $(genButton).click(generate);
        genButton.disabled = false;

        const goBackButton = $('button#gen-map-back-button')[0];
        $(goBackButton).click(goBack);

        const goForwardButton = $('button#gen-map-forward-button')[0];
        $(goForwardButton).click(goForward);

        // Switching game type rolls a board of the new type straight away
        document.querySelectorAll('input[name=game-type]').forEach(input => {
            input.addEventListener("change", generate);
        });

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

        // Balance rules: restore the saved choices, and roll a new board
        // whenever one changes so its effect shows straight away
        Object.assign(balanceRules, loadBalanceRules());
        document.querySelectorAll('input[data-rule]').forEach(input => {
            input.checked = !!balanceRules[input.dataset.rule];
            input.addEventListener("change", () => {
                balanceRules[input.dataset.rule] = input.checked;
                saveBalanceRules();
                generate();
            });
        });

        setUpShareDialog();

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
    // Generate a new board
    var mapDef;
    switch ($("input[name=game-type]:checked").val()) {
        case "expanded":
            mapDef = expandedMap;
            break;
        default:
            mapDef = normalMap;
    }

    catanMap.defineMap(mapDef);
    catanMap.generate();
    catanMap.resize();
    catanMap.draw();
    updateShareUrl();
    updateBalanceDisplay();

    // History holds every board shown, with currentBoardIndex on the one on
    // screen. Generating after going back drops the boards that were ahead.
    boardHistory = boardHistory.slice(0, currentBoardIndex + 1);
    boardHistory.push(snapshotBoard());
    currentBoardIndex = boardHistory.length - 1;

    enableButtons();
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
		
		// 3:1 is plain white; 2:1 shows the resource's art
		if (harbor.type === "any") {
			drawingContext.fillStyle = "#FFFFFF";
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
		if (harbor.type === "any") {
			drawingContext.fillStyle = "#0b1120";
		} else {
			// White with a dark outline to stay legible over the artwork
			drawingContext.strokeStyle = "rgba(0,0,0,0.85)";
			drawingContext.lineWidth = Math.max(2, fontSizePx / 4);
			drawingContext.strokeText(label, centerX, textY);
			drawingContext.fillStyle = "#FFFFFF";
		}
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
	
	// Scale with the token (radius 0.375*size) so two digits still fit
	var fontSizePx = Math.round(0.42 * size);

	drawingContext.font = "bold " + fontSizePx + "px sans-serif";
	drawingContext.textAlign = "center";
	drawingContext.textBaseline = "middle";
	if ( this.isHighlyProductive() ) {
		drawingContext.fillStyle = "#FF0000";
	} else {
		drawingContext.fillStyle = "#000000";
	}
	drawingContext.fillText(
		this.number.toString(),
		this.xCenter,
		// Nudge down slightly: "middle" sits a touch high for digits
		this.yCenter + Math.round(0.06 * fontSizePx)
	);
	
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
	
	sizeCanvas();
	
	document.getElementById("map-container").appendChild(mapCanvas);
	
}

function sizeCanvas() {
    var mapContainer = $("div#map-container")[0];
    if (!mapCanvas) return;
    // Back the canvas with device pixels so it stays sharp on high-DPI
    // screens, but keep all drawing math in CSS pixels via the transform.
    var dpr = window.devicePixelRatio || 1;
    canvasWidth = $(mapContainer).width();
    canvasHeight = $(mapContainer).height();
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
