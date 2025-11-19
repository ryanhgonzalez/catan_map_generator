// ----- Canvas globals -----

var mapCanvas;
var drawingContext;

var canvasCenterX;
var canvasCenterY;

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

    const compact = tiles.join(".");
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

    const tiles = decoded.split(".").map(part => {
        const [gx, gy, rc, num] = part.split(",").map(v => parseInt(v));
        return {
            gridX: gx,
            gridY: gy,
            resourceType: CODE_TO_RESOURCE[rc] ?? "desert",
            number: num === 0 ? null : num
        };
    });

    return tiles;
}


/**
 * Load a decoded state (array of tile objects) into the map and render it.
 */
function loadBoardFromDecodedState(stateTiles) {
    if (!Array.isArray(stateTiles)) return;

	  // Determine map type based on tile count
    if (stateTiles.length === normalMap.coordinatesArray.length) {
        catanMap.defineMap(normalMap);
    } else if (stateTiles.length === expandedMap.coordinatesArray.length) {
        catanMap.defineMap(expandedMap);
    } else {
        console.warn("Unknown map size; cannot set map definition correctly.");
    }

    catanMap.hexTiles = stateTiles.map(t => {
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

    // Render
    sizeCanvas();
    catanMap.resize();
    catanMap.draw();

    // Put into history so back/forward still work
    boardHistory = [catanMap.hexTiles.map(tile => ({
        resourceType: tile.resourceType,
        number: tile.number,
        gridX: tile.gridX,
        gridY: tile.gridY
    }))];
    currentBoardIndex = 0;
    enableButtons();
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
        genButton.innerHTML = "Generate";

        const goBackButton = $('button#gen-map-back-button')[0];
        $(goBackButton).click(goBack);

        const goForwardButton = $('button#gen-map-forward-button')[0];
        $(goForwardButton).click(goForward);

        const shareButton = document.getElementById("share-catan-board");
		shareButton.addEventListener("click", async () => {
			const encoded = encodeBoardShort();
			if (!encoded) {
				alert("Generate a board first before sharing.");
				return;
			}

			// Build shareable URL
			const url = new URL(window.location);
			url.searchParams.set("board", encoded);
			const shareUrl = url.toString();

			// If Web Share API is supported (Mobile Safari/Chrome)
			if (navigator.share) {
				try {
					await navigator.share({
						title: "Catan Board",
						text: "Check out this Catan board!",
						url: shareUrl
					});
					return;
				} catch (err) {
					// fall through to clipboard
					console.warn("Share canceled or failed; falling back.", err);
				}
			}

			// Fallback for desktop browsers
			try {
				await navigator.clipboard.writeText(shareUrl);
				alert("Share URL copied to clipboard!");
			} catch (err) {
				prompt("Copy this share link:", shareUrl);
			}
		});


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
    const currentBoardState = catanMap.hexTiles?.map(tile => ({
        resourceType: tile.resourceType,
        number: tile.number,
        gridX: tile.gridX,
        gridY: tile.gridY
    })) || null;

    // If we are not at the end of the history, truncate it
    if (currentBoardIndex < boardHistory.length - 1) {
        boardHistory = boardHistory.slice(0, currentBoardIndex + 1);
    }

    // Add the current board to the history
    if (currentBoardState) {
        boardHistory.push(currentBoardState);
    }
    currentBoardIndex = boardHistory.length - 1;

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

    // Update URL so this exact board can be shared
    const encoded = encodeBoardShort();
    if (encoded) {
        const url = new URL(window.location);
        url.searchParams.set('board', encoded);
        window.history.replaceState({}, '', url);
    }

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

    catanMap.hexTiles = boardState.map(tileState => {
        const tile = new HexTile();
        tile.setCoordinate(tileState.gridX, tileState.gridY);
        tile.setResourceType(tileState.resourceType);
        if (tileState.number) {
            tile.setNumber(tileState.number);
        }
        return tile;
    });

    catanMap.coordToTile = {};
    catanMap.hexTiles.forEach(tile => {
        catanMap.coordToTile[[tile.gridX, tile.gridY].toString()] = tile;
    });

    catanMap.draw();

    // Also update URL to reflect the current history board
    const encoded = encodeBoardShort();
    if (encoded) {
        const url = new URL(window.location);
        url.searchParams.set('board', encoded);
        window.history.replaceState({}, '', url);
    }
}

function enableButtons() {
    const goBackButton = $('button#gen-map-back-button')[0];
    const goForwardButton = $('button#gen-map-forward-button')[0];

    goBackButton.disabled = currentBoardIndex <= 0;
    goForwardButton.disabled = currentBoardIndex >= boardHistory.length - 1;
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
	
	if (this.mapDefinition) {
		
		this.hexTiles = [];
		
		var numTiles = this.mapDefinition.coordinatesArray.length;
		
		var tileCoordinates = this.mapDefinition.coordinatesArray.copy();
		
		var tileNumbers = [];
		for (var key in this.mapDefinition.numberDict) {
			for (var i = 0; i < this.mapDefinition.numberDict[key]; i += 1) {
				tileNumbers.push(parseInt(key));
			}
		}
		
		var tileTypes = [];
		for (var key in this.mapDefinition.resourceDict) {
			if (key != "desert") {
				for (var i = 0; i < this.mapDefinition.resourceDict[key]; i += 1) {
					tileTypes.push(key);
				}
			}
		}
		
		var newCoords = null;
		var numDeserts = this.mapDefinition.resourceDict["desert"];
		
		for (var i = 0; i < numDeserts; i += 1) {
			var desertHexTile = new HexTile();
			newCoords = tileCoordinates.random(true);
			desertHexTile.setCoordinate.apply(
				desertHexTile,
				newCoords
			);
			desertHexTile.setResourceType("desert");
			this.hexTiles.push(desertHexTile);
			this.coordToTile[newCoords.toString()] = desertHexTile;
		}
		
		// Move all highly productive tile number (6 and 8) to the front
		// of the tileNumbers array
		var highlyProductiveIdx = [];
		highlyProductiveIdx = highlyProductiveIdx.concat(
			tileNumbers.indexOfArray(6),
			tileNumbers.indexOfArray(8)
		);
		for (var i = 0; i < highlyProductiveIdx.length; i += 1) {
			tileNumbers.swap(i,highlyProductiveIdx[i]);
		}
		
		// Handle all other tiles
		for (var i = 0; i < (numTiles - numDeserts); i += 1) {
			
			var newHexTile = new HexTile();
			newHexTile.setNumber(tileNumbers[i]);
			newHexTile.setResourceType(tileTypes.random(true));

			var invalid;
			
			if ( newHexTile.isHighlyProductive() ) {
				var tmpCoords = [];
				do {
					newCoords = tileCoordinates.random(true);
					newHexTile.setCoordinate.apply(
						newHexTile,
						newCoords
					);
					invalid = this.hasHighlyProductiveNeighbors(newHexTile);
					if (invalid) {
						tmpCoords.push(newCoords);
					}
				} while ( invalid );
				tileCoordinates = tileCoordinates.concat(tmpCoords);
			} else {
				newCoords = tileCoordinates.random(true);
				newHexTile.setCoordinate.apply(
					newHexTile,
					newCoords
				);
			}
			
			this.hexTiles.push(newHexTile);
			this.coordToTile[newCoords.toString()] = newHexTile;
		}
		
	} else {
		console.log("No map definition.");
	}
	
}
CatanMap.prototype.draw = function() {

	if (this.hexTiles) {
		drawingContext.clear();
		for (var i = 0; i < this.hexTiles.length; i += 1) {
			this.hexTiles[i].draw();
		}
	}
	
}
CatanMap.prototype.resize = function() {
/* Size = Height / ( (coordSpacing + 2) * Math.sin(Math.PI/3) )
 * Size = Width / ( (coordSpacing * (1 + Math.cos(Math.PI/3)) / 2) + 2 )
*/
	var wSize = (mapCanvas.width-10) / 
		( (this.coordSpan[0] * (1 + Math.cos(Math.PI/3)) / 2) + 2 );
	var hSize = (mapCanvas.height-10) / 
		( (this.coordSpan[1] + 2) * Math.sin(Math.PI/3) );
	size = Math.floor(Math.min(wSize, hSize));
	dx = size * (1 + Math.cos(Math.PI/3)) / 2;
	dy = size * Math.sin(Math.PI/3);
}
CatanMap.prototype.getAdjacentTiles = function(tile) {
	
	var tileX = tile.gridX;
	var tileY = tile.gridY;
	
	var adjTiles = [];
	
	// (+0,+2), (+2,+1), (+2,-1), (+0,-2), (-2,-1), (-2,1)
	xshift = [0, 2, 2, 0, -2, -2];
	yshift = [2, 1, -1, -2, -1, 1];
	
	for (var i = 0; i < 6; i += 1) {
		var adjTile = this.coordToTile[
			[tileX + xshift[i], tileY + yshift[i]].toString()
		];
		// Will be null if no hex tile found at that coordinate
		if (adjTile) {
			adjTiles.push(adjTile);
		}
	}
	
	return adjTiles;
	
}
CatanMap.prototype.hasHighlyProductiveNeighbors = function(tile) {
	var adjacentTiles = this.getAdjacentTiles(tile);
	for (var i = 0; i < adjacentTiles.length; i += 1) {
		if ( adjacentTiles[i].isHighlyProductive() ) {
			return true;
		}
	}
	return false;
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
HexTile.prototype.lineWidth = lineWidth;
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
	// Don't draw number if desert
	if (this.number) {
		this.drawNumber();
	}
}
HexTile.prototype.drawBase = function() {
	
	if (mapStyle == "retro") {
		drawingContext.lineWidth = 10;
		drawingContext.fillStyle = "rgba(255,255,255,0)";
		drawingContext.strokeStyle = "#FAEB96";
	} else {
		drawingContext.lineWidth = this.lineWidth;
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
	drawingContext.lineWidth = 3;
	
	drawingContext.beginPath();
	drawingContext.arc(this.xCenter, this.yCenter, 0.375 * size,
		0, 2 * Math.PI, false);
	drawingContext.closePath();
	
	drawingContext.fill();
	drawingContext.stroke();
	
	var fontSizePt = Math.ceil(30/40*(.45*size-8)+6);
	
	drawingContext.font = "bold " + fontSizePt + "pt sans-serif";
	drawingContext.textAlign = "center";
	if ( this.isHighlyProductive() ) {
		drawingContext.fillStyle = "#FF0000";
	} else {
		drawingContext.fillStyle = "#000000";
	}
	drawingContext.fillText(
		this.number.toString(),
		this.xCenter,
		this.yCenter + Math.ceil( 0.85 * fontSizePt/2 )
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
Array.prototype.indexOfArray = function(val) {
	var arr = [];
	var sIdx = 0;
	var tmpCopy = this.copy();
	do {
		var rIdx = tmpCopy.indexOf(val);
		var valid = (rIdx >= 0);
		if (valid) {
			tmpCopy.splice(0, rIdx + 1);
			arr.push(sIdx + rIdx);
			sIdx += rIdx + 1;
		}
	} while (valid);
	return arr;
}
Array.prototype.swap = function(idx1, idx2) {
	var tmp = this[idx1];
	this[idx1] = this[idx2];
	this[idx2] = tmp;
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
    $(mapCanvas).attr("width", $(mapContainer).width());
    $(mapCanvas).attr("height", $(mapContainer).height());
    canvasCenterY = mapCanvas.height/2;
    canvasCenterX = mapCanvas.width/2;
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
