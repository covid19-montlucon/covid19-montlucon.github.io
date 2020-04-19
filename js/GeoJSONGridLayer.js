
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['leaflet'], factory);
    } else if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        // Node/CommonJS
        module.exports = factory(require('leaflet'));
    } else {
        // Browser globals
        if (typeof window.L === 'undefined') {
            throw 'Leaflet must be loaded first';
        }
        factory(window.L);
    }
})(function (L) {
    var GeoJSONGridLayer = {

	    // @section
	    // @aka GeoJSONGridLayer options
	    options: {
		    // @option tileSize: Number|Point = 256
		    // Width and height of tiles in the grid. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
		    tileSize: 256,

		    // @option updateWhenIdle: Boolean = (depends)
		    // Load new tiles only when panning ends.
		    // `true` by default on mobile browsers, in order to avoid too many requests and keep smooth navigation.
		    // `false` otherwise in order to display new tiles _during_ panning, since it is easy to pan outside the
		    // [`keepBuffer`](#GeoJSONGridLayer-keepbuffer) option in desktop browsers.
		    updateWhenIdle: L.Browser.mobile,

		    // @option updateWhenZooming: Boolean = true
		    // By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting this option to `false` will update the grid layer only when the smooth animation ends.
		    updateWhenZooming: true,

		    // @option updateInterval: Number = 200
		    // Tiles will not update more than once every `updateInterval` milliseconds when panning.
		    updateInterval: 200,

		    // @option zIndex: Number = 1
		    // The explicit zIndex of the tile layer.
		    zIndex: 1,

		    // @option bounds: LatLngBounds = undefined
		    // If set, tiles will only be loaded inside the set `LatLngBounds`.
		    bounds: null,

		    // @option minZoom: Number = 0
		    // The minimum zoom level down to which this layer will be displayed (inclusive).
		    minZoom: 0,

		    // @option maxZoom: Number = undefined
		    // The maximum zoom level up to which this layer will be displayed (inclusive).
		    maxZoom: undefined,

		    // @option maxNativeZoom: Number = undefined
		    // Maximum zoom number the tile source has available. If it is specified,
		    // the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
		    // from `maxNativeZoom` level and auto-scaled.
		    maxNativeZoom: undefined,

		    // @option minNativeZoom: Number = undefined
		    // Minimum zoom number the tile source has available. If it is specified,
		    // the tiles on all zoom levels lower than `minNativeZoom` will be loaded
		    // from `minNativeZoom` level and auto-scaled.
		    minNativeZoom: undefined,

		    // @option noWrap: Boolean = false
		    // Whether the layer is wrapped around the antimeridian. If `true`, the
		    // GeoJSONGridLayer will only be displayed once at low zoom levels. Has no
		    // effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
		    // in combination with [`bounds`](#GeoJSONGridLayer-bounds) to prevent requesting
		    // tiles outside the CRS limits.
		    noWrap: false,

		    // @option pane: String = 'tilePane'
		    // `Map pane` where the grid layer will be added.
		    pane: 'tilePane',

		    // @option className: String = ''
		    // A custom class name to assign to the tile layer. Empty by default.
		    className: '',

		    // @option keepBuffer: Number = 2
		    // When panning the map, keep this many rows and columns of tiles before unloading them.
		    keepBuffer: 2
	    },

	    initialize: function (options) {
		    L.Util.setOptions(this, options);
		    this._layers = {};
	    },

	    onAdd: function () {
		    this._initContainer();

		    this._levels = {};
		    this._tiles = {};
		    this.eachLayer(map.addLayer, map);
		    
		    this._resetView();
		    this._update();
	    },

	    beforeAdd: function (map) {
		    map._addZoomLimit(this);
	    },

	    onRemove: function (map) {
		    this.eachLayer(map.removeLayer, map);
		    this._removeAllTiles();
		    L.DomUtil.remove(this._container);
		    map._removeZoomLimit(this);
		    this._container = null;
		    this._tileZoom = undefined;
	    },

	    // @method bringToFront: this
	    // Brings the tile layer to the top of all tile layers.
	    bringToFront: function () {
		    if (this._map) {
			    L.DomUtil.toFront(this._container);
			    this._setAutoZIndex(Math.max);
		    }
		    this.invoke('bringToFront');
		    return this;
	    },

	    // @method bringToBack: this
	    // Brings the tile layer to the bottom of all tile layers.
	    bringToBack: function () {
		    if (this._map) {
			    L.DomUtil.toBack(this._container);
			    this._setAutoZIndex(Math.min);
		    }
		    this.invoke('bringToBack');
		    return this;
	    },

        resetStyle: function () {
			return this.invoke('resetStyle');
	    },

	    // @method getContainer: HTMLElement
	    // Returns the HTML element that contains the tiles for this layer.
	    getContainer: function () {
		    return this._container;
	    },

	    // @method setZIndex(zIndex: Number): this
	    // Changes the [zIndex](#GeoJSONGridLayer-zindex) of the grid layer.
	    setZIndex: function (zIndex) {
		    this.options.zIndex = zIndex;
		    this.invoke('setZIndex', zIndex);
		    this._updateZIndex();

		    return this;
	    },

	    // @method isLoading: Boolean
	    // Returns `true` if any tile in the grid layer has not finished loading.
	    isLoading: function () {
		    return this._loading;
	    },

	    // @method redraw: this
	    // Causes the layer to clear all the tiles and request them again.
	    redraw: function () {
		    if (this._map) {
			    this._removeAllTiles();
			    this._update();
		    }
		    return this;
	    },

	    getEvents: function () {
		    var events = {
			    viewprereset: this._invalidateAll,
			    viewreset: this._resetView,
			    zoom: this._resetView,
			    moveend: this._onMoveEnd
		    };

		    if (!this.options.updateWhenIdle) {
			    // update tiles on move, but not more often than once per given interval
			    if (!this._onMove) {
				    this._onMove = L.Util.throttle(this._onMoveEnd, this.options.updateInterval, this);
			    }

			    events.move = this._onMove;
		    }

		    if (this._zoomAnimated) {
			    events.zoomanim = this._animateZoom;
		    }

		    return events;
	    },

	    // @section Extension methods
	    // Layers extending `GeoJSONGridLayer` shall reimplement the following method.
	    // @method createTile(coords: Object, done?: Function): HTMLElement
	    // Called only internally, must be overridden by classes extending `GeoJSONGridLayer`.
	    // Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
	    // is specified, it must be called when the tile has finished loading and drawing.
	    createTile: function () {
		    return L.geoJson();
	    },

	    // @section
	    // @method getTileSize: Point
	    // Normalizes the [tileSize option](#GeoJSONGridLayer-tilesize) into a point. Used by the `createTile()` method.
	    getTileSize: function () {
		    var s = this.options.tileSize;
		    return s instanceof L.Point ? s : new L.Point(s, s);
	    },

	    _updateZIndex: function () {
		    if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			    this._container.style.zIndex = this.options.zIndex;
		    }
	    },

	    _setAutoZIndex: function (compare) {
		    // go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

		    var layers = this.getPane().children,
		        edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		    for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			    zIndex = layers[i].style.zIndex;

			    if (layers[i] !== this._container && zIndex) {
				    edgeZIndex = compare(edgeZIndex, +zIndex);
			    }
		    }

		    if (isFinite(edgeZIndex)) {
			    this.options.zIndex = edgeZIndex + compare(-1, 1);
			    this._updateZIndex();
		    }
	    },

	    _initContainer: function () {
		    if (this._container) { return; }

		    this._container = L.DomUtil.create('div', 'leaflet-layer ' + (this.options.className || ''));
		    this._updateZIndex();

		    this.getPane().appendChild(this._container);
	    },

	    _updateLevels: function () {

		    var zoom = this._tileZoom,
		        maxZoom = this.options.maxZoom;

		    if (zoom === undefined) { return undefined; }

		    for (var z in this._levels) {
			    if (this._levels[z].el.children.length || z === zoom) {
				    this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
				    this._onUpdateLevel(z);
			    } else {
				    L.DomUtil.remove(this._levels[z].el);
				    this._removeTilesAtZoom(z);
				    this._onRemoveLevel(z);
				    delete this._levels[z];
			    }
		    }

		    var level = this._levels[zoom],
		        map = this._map;

		    if (!level) {
			    level = this._levels[zoom] = {};

			    level.el = L.DomUtil.create('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			    level.el.style.zIndex = maxZoom;

			    level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			    level.zoom = zoom;

			    this._setZoomTransform(level, map.getCenter(), map.getZoom());

			    // force the browser to consider the newly added element for transition
			    L.Util.falseFn(level.el.offsetWidth);

			    this._onCreateLevel(level);
		    }

		    this._level = level;

		    return level;
	    },

	    _onUpdateLevel: L.Util.falseFn,

	    _onRemoveLevel: L.Util.falseFn,

	    _onCreateLevel: L.Util.falseFn,

	    _pruneTiles: function () {
		    if (!this._map) {
			    return;
		    }

		    var key, tile;

		    var zoom = this._map.getZoom();
		    if (zoom > this.options.maxZoom ||
			    zoom < this.options.minZoom) {
			    this._removeAllTiles();
			    return;
		    }

		    for (key in this._tiles) {
			    tile = this._tiles[key];
			    tile.retain = tile.current;
		    }

		    for (key in this._tiles) {
			    tile = this._tiles[key];
			    if (tile.current && !tile.active) {
				    var coords = tile.coords;
				    if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
					    this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
				    }
			    }
		    }

		    for (key in this._tiles) {
			    if (!this._tiles[key].retain) {
				    this._removeTile(key);
			    }
		    }
	    },

	    _removeTilesAtZoom: function (zoom) {
		    for (var key in this._tiles) {
			    if (this._tiles[key].coords.z !== zoom) {
				    continue;
			    }
			    this._removeTile(key);
		    }
	    },

	    _removeAllTiles: function () {
		    for (var key in this._tiles) {
			    this._removeTile(key);
		    }
	    },

	    _invalidateAll: function () {
		    for (var z in this._levels) {
			    L.DomUtil.remove(this._levels[z].el);
			    this._onRemoveLevel(z);
			    delete this._levels[z];
		    }
		    this._removeAllTiles();

		    this._tileZoom = undefined;
	    },

	    _retainParent: function (x, y, z, minZoom) {
		    var x2 = Math.floor(x / 2),
		        y2 = Math.floor(y / 2),
		        z2 = z - 1,
		        coords2 = new L.Point(+x2, +y2);
		    coords2.z = +z2;

		    var key = this._tileCoordsToKey(coords2),
		        tile = this._tiles[key];

		    if (tile && tile.active) {
			    tile.retain = true;
			    return true;

		    } else if (tile && tile.loaded) {
			    tile.retain = true;
		    }

		    if (z2 > minZoom) {
			    return this._retainParent(x2, y2, z2, minZoom);
		    }

		    return false;
	    },

	    _retainChildren: function (x, y, z, maxZoom) {

		    for (var i = 2 * x; i < 2 * x + 2; i++) {
			    for (var j = 2 * y; j < 2 * y + 2; j++) {

				    var coords = new L.Point(i, j);
				    coords.z = z + 1;

				    var key = this._tileCoordsToKey(coords),
				        tile = this._tiles[key];

				    if (tile && tile.active) {
					    tile.retain = true;
					    continue;

				    } else if (tile && tile.loaded) {
					    tile.retain = true;
				    }

				    if (z + 1 < maxZoom) {
					    this._retainChildren(i, j, z + 1, maxZoom);
				    }
			    }
		    }
	    },

	    _resetView: function (e) {
		    var animating = e && (e.pinch || e.flyTo);
		    this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
	    },

	    _animateZoom: function (e) {
		    this._setView(e.center, e.zoom, true, e.noUpdate);
	    },

	    _clampZoom: function (zoom) {
		    var options = this.options;

		    if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
			    return options.minNativeZoom;
		    }

		    if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
			    return options.maxNativeZoom;
		    }

		    return zoom;
	    },

	    _setView: function (center, zoom, noPrune, noUpdate) {
		    var tileZoom = this._clampZoom(Math.round(zoom));
		    if ((this.options.maxZoom !== undefined && zoom > this.options.maxZoom) ||
		        (this.options.minZoom !== undefined && zoom < this.options.minZoom)) {
			    tileZoom = undefined;
		    }

		    var tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

		    if (!noUpdate || tileZoomChanged) {

			    this._tileZoom = tileZoom;

			    if (this._abortLoading) {
				    this._abortLoading();
			    }

			    this._updateLevels();
			    this._resetGrid();

			    if (tileZoom !== undefined) {
				    this._update(center);
			    }

			    if (!noPrune) {
				    this._pruneTiles();
			    }

		    }

		    this._setZoomTransforms(center, zoom);
	    },

	    _setZoomTransforms: function (center, zoom) {
		    for (var i in this._levels) {
			    this._setZoomTransform(this._levels[i], center, zoom);
		    }
	    },

	    _setZoomTransform: function (level, center, zoom) {
		    var scale = this._map.getZoomScale(zoom, level.zoom),
		        translate = level.origin.multiplyBy(scale)
		        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		    if (L.Browser.any3d) {
			    //L.DomUtil.setTransform(level.el, translate, scale);
		    } else {
			    //L.DomUtil.setPosition(level.el, translate);
		    }
	    },

	    _resetGrid: function () {
		    var map = this._map,
		        crs = map.options.crs,
		        tileSize = this._tileSize = this.getTileSize(),
		        tileZoom = this._tileZoom;

		    var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		    if (bounds) {
			    this._globalTileRange = this._pxBoundsToTileRange(bounds);
		    }

		    this._wrapX = crs.wrapLng && !this.options.noWrap && [
			    Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
			    Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
		    ];
		    this._wrapY = crs.wrapLat && !this.options.noWrap && [
			    Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
			    Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
		    ];
	    },

	    _onMoveEnd: function () {
		    if (!this._map || this._map._animatingZoom) { return; }

		    this._update();
	    },

	    _getTiledPixelBounds: function (center) {
		    var map = this._map,
		        mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
		        scale = map.getZoomScale(mapZoom, this._tileZoom),
		        pixelCenter = map.project(center, this._tileZoom).floor(),
		        halfSize = map.getSize().divideBy(scale * 2);

		    return new L.Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
	    },

	    // Private method to load tiles in the grid's active zoom level according to map bounds
	    _update: function (center) {
		    var map = this._map;
		    if (!map) { return; }
		    var zoom = this._clampZoom(map.getZoom());

		    if (center === undefined) { center = map.getCenter(); }
		    if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		    var pixelBounds = this._getTiledPixelBounds(center),
		        tileRange = this._pxBoundsToTileRange(pixelBounds),
		        tileCenter = tileRange.getCenter(),
		        queue = [],
		        margin = this.options.keepBuffer,
		        noPruneRange = new L.Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
		            tileRange.getTopRight().add([margin, -margin]));

		    // Sanity check: panic if the tile range contains Infinity somewhere.
		    if (!(isFinite(tileRange.min.x) &&
		        isFinite(tileRange.min.y) &&
		        isFinite(tileRange.max.x) &&
		        isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		    for (var key in this._tiles) {
			    var c = this._tiles[key].coords;
			    if (c.z !== this._tileZoom || !noPruneRange.contains(new L.Point(c.x, c.y))) {
				    this._tiles[key].current = false;
			    }
		    }

		    // _update just loads more tiles. If the tile zoom level differs too much
		    // from the map's, let _setView reset levels and prune old tiles.
		    if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		    // create a queue of coordinates to load tiles from
		    for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			    for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				    var coords = new L.Point(i, j);
				    coords.z = this._tileZoom;

				    if (!this._isValidTile(coords)) { continue; }

				    var tile = this._tiles[this._tileCoordsToKey(coords)];
				    if (tile) {
					    tile.current = true;
				    } else {
					    queue.push(coords);
				    }
			    }
		    }

		    // sort tile queue to load tiles in order of their distance to center
		    queue.sort(function (a, b) {
			    return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
		    });

		    if (queue.length !== 0) {
			    // if it's the first batch of tiles to load
			    if (!this._loading) {
				    this._loading = true;
				    // @event loading: Event
				    // Fired when the grid layer starts loading tiles.
				    this.fire('loading');
			    }

			    // create DOM fragment to append tiles in one batch
			    var fragment = document.createDocumentFragment();

			    for (i = 0; i < queue.length; i++) {
				    this._addTile(queue[i], fragment);
			    }

			    this._level.el.appendChild(fragment);
		    }
	    },

	    _isValidTile: function (coords) {
		    var crs = this._map.options.crs;

		    if (!crs.infinite) {
			    // don't load tile if it's out of bounds and not wrapped
			    var bounds = this._globalTileRange;
			    if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
			        (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
		    }

		    if (!this.options.bounds) { return true; }

		    // don't load tile if it doesn't intersect the bounds in options
		    var tileBounds = this._tileCoordsToBounds(coords);
		    return L.latLngBounds(this.options.bounds).overlaps(tileBounds);
	    },

	    _keyToBounds: function (key) {
		    return this._tileCoordsToBounds(this._keyToTileCoords(key));
	    },

	    _tileCoordsToNwSe: function (coords) {
		    var map = this._map,
		        tileSize = this.getTileSize(),
		        nwPoint = coords.scaleBy(tileSize),
		        sePoint = nwPoint.add(tileSize),
		        nw = map.unproject(nwPoint, coords.z),
		        se = map.unproject(sePoint, coords.z);
		    return [nw, se];
	    },

	    // converts tile coordinates to its geographical bounds
	    _tileCoordsToBounds: function (coords) {
		    var bp = this._tileCoordsToNwSe(coords),
		        bounds = new L.LatLngBounds(bp[0], bp[1]);

		    if (!this.options.noWrap) {
			    bounds = this._map.wrapLatLngBounds(bounds);
		    }
		    return bounds;
	    },
	    // converts tile coordinates to key for the tile cache
	    _tileCoordsToKey: function (coords) {
		    return coords.x + ':' + coords.y + ':' + coords.z;
	    },

	    // converts tile cache key to coordinates
	    _keyToTileCoords: function (key) {
		    var k = key.split(':'),
		        coords = new L.Point(+k[0], +k[1]);
		    coords.z = +k[2];
		    return coords;
	    },

	    _removeTile: function (key) {
		    var tile = this._tiles[key];
		    if (!tile) { return; }

		    this.removeLayer(tile.el);

		    delete this._tiles[key];

		    // @event tileunload: TileEvent
		    // Fired when a tile is removed (e.g. when a tile goes off the screen).
		    this.fire('tileunload', {
			    tile: tile.el,
			    coords: this._keyToTileCoords(key)
		    });
	    },

	    _addTile: function (coords, container) {
		    var tilePos = this._getTilePos(coords),
		        key = this._tileCoordsToKey(coords);

		    var tile = this.createTile(this._wrapCoords(coords), L.Util.bind(this._tileReady, this, coords));

		    // if createTile is defined with a second argument ("done" callback),
		    // we know that tile is async and will be ready later; otherwise
		    if (this.createTile.length < 2) {
			    // mark tile as ready, but delay one frame for opacity animation to happen
			    L.Util.requestAnimFrame(L.Util.bind(this._tileReady, this, coords, null, tile));
		    }

		    // save tile in cache
		    this._tiles[key] = {
			    el: tile,
			    coords: coords,
			    current: true
		    };

		    this.addLayer(tile);
		    // @event tileloadstart: TileEvent
		    // Fired when a tile is requested and starts loading.
		    this.fire('tileloadstart', {
			    tile: tile,
			    coords: coords
		    });
	    },

	    _tileReady: function (coords, err, tile) {
		    if (err) {
			    // @event tileerror: TileErrorEvent
			    // Fired when there is an error loading a tile.
			    this.fire('tileerror', {
				    error: err,
				    tile: tile,
				    coords: coords
			    });
		    }

		    var key = this._tileCoordsToKey(coords);

		    tile = this._tiles[key];
		    if (!tile) { return; }

		    tile.loaded = +new Date();
		    if (this._map._fadeAnimated) {
		    } else {
			    tile.active = true;
			    this._pruneTiles();
		    }

		    if (!err) {
			    // @event tileload: TileEvent
			    // Fired when a tile loads.
			    this.fire('tileload', {
				    tile: tile.el,
				    coords: coords
			    });
		    }

		    if (this._noTilesToLoad()) {
			    this._loading = false;
			    // @event load: Event
			    // Fired when the grid layer loaded all visible tiles.
			    this.fire('load');

			    if (L.Browser.ielt9 || !this._map._fadeAnimated) {
				    L.Util.requestAnimFrame(this._pruneTiles, this);
			    } else {
				    // Wait a bit more than 0.2 secs (the duration of the tile fade-in)
				    // to trigger a pruning.
				    setTimeout(L.Util.bind(this._pruneTiles, this), 250);
			    }
		    }
	    },

	    _getTilePos: function (coords) {
		    return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
	    },

	    _wrapCoords: function (coords) {
		    var newCoords = new L.Point(
			    this._wrapX ? L.Util.wrapNum(coords.x, this._wrapX) : coords.x,
			    this._wrapY ? L.Util.wrapNum(coords.y, this._wrapY) : coords.y);
		    newCoords.z = coords.z;
		    return newCoords;
	    },

	    _pxBoundsToTileRange: function (bounds) {
		    var tileSize = this.getTileSize();
		    return new L.Bounds(
			    bounds.min.unscaleBy(tileSize).floor(),
			    bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
	    },

	    _noTilesToLoad: function () {
		    for (var key in this._tiles) {
			    if (!this._tiles[key].loaded) { return false; }
		    }
		    return true;
	    }
    };

    L.GeoJSONGridLayer = L.GeoJSON.extend(GeoJSONGridLayer);
    L.geoJsonGridLayer = function (options) {
	    return new L.GeoJSONGridLayer(options);
    }

});
