
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
    /*
     * @class BoundariesLayer
     * @inherits GeoJSONGridLayer
     * Used to load and display tile layers on the map. Contrary to TileLayer which creates img tag,
     * this create a featuregroup.
     * This file is adapted from TileLayer's source of the official library.
     */
    var BoundariesLayer = L.GeoJSONGridLayer.extend({

	    // @section
	    // @aka BoundariesLayer options
	    options: {
		    // @option minZoom: Number = 0
		    // The minimum zoom level down to which this layer will be displayed (inclusive).
		    minZoom: 0,

		    // @option maxZoom: Number = 18
		    // The maximum zoom level up to which this layer will be displayed (inclusive).
		    maxZoom: 18,

		    // @option subdomains: String|String[] = 'abc'
		    // Subdomains of the tile service. Can be passed in the form of one string (where each letter is a subdomain name) or an array of strings.
		    subdomains: 'abc',

		    // @option errorTileUrl: String = ''
		    // URL to the tile image to show in place of the tile that failed to load.
		    errorTileUrl: '',

		    // @option crossOrigin: Boolean|String = false
		    // Whether the crossOrigin attribute will be added to the tiles.
		    // If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
		    // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
		    crossOrigin: false
	    },

	    initialize: function (url, options) {
		    L.Util.setOptions(this, options);

		    this._url = url;

		    this._layers = {}

		    options = L.Util.setOptions(this, options);

		    if (typeof options.subdomains === 'string') {
			    options.subdomains = options.subdomains.split('');
		    }

		    // for https://github.com/Leaflet/Leaflet/issues/137
		    if (!L.Browser.android) {
			    this.on('tileunload', this._onTileRemove);
		    }
	    },

	    // @method setUrl(url: String, noRedraw?: Boolean): this
	    // Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
	    // If the URL does not change, the layer will not be redrawn unless
	    // the noRedraw parameter is set to false.
	    setUrl: function (url, noRedraw) {
		    if (this._url === url && noRedraw === undefined) {
			    noRedraw = true;
		    }

		    this._url = url;

		    if (!noRedraw) {
			    this.redraw();
		    }
		    return this;
	    },

	    // @method createTile(coords: Object, done?: Function): HTMLElement
	    // Called only internally, overrides GeoJSONGridLayer's [`createTile()`](#gridlayer-createtile)
	    // to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
	    // callback is called when the tile has been loaded.
	    createTile: function (coords, done) {
		    let tile = L.geoJson({'type': 'FeatureCollection', 'features': []}, this.options);

		    //L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
		    //L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

		    if (this.options.crossOrigin || this.options.crossOrigin === '') {
			    tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		    }

		    let url = this.getTileUrl(coords);
            let loadBoundaries = fetch(url)
                .then(function (ans) { if (!ans.ok) throw new Error('HTTP Error: ' + ans.status); return ans; })
                .then(ans => ans.json())
                .then(data => tile.addData(data))
                //TODO: load cases count into features of tile
                .then(x => this._tileOnLoad(done, tile))
                .catch(err => this._tileOnError(done, tile));


		    return tile;
	    },

	    // @section Extension methods
	    // @uninheritable
	    // Layers extending `BoundariesLayer` might reimplement the following method.
	    // @method getTileUrl(coords: Object): String
	    // Called only internally, returns the URL for a tile given its coordinates.
	    // Classes extending `BoundariesLayer` can override this function to provide custom tile URL naming schemes.
	    getTileUrl: function (coords) {
		    var data = {
			    r: L.Browser.retina ? '@2x' : '',
			    s: this._getSubdomain(coords),
			    x: coords.x,
			    y: coords.y,
			    z: this._getZoomForUrl()
		    };
		    if (this._map && !this._map.options.crs.infinite) {
			    var invertedY = this._globalTileRange.max.y - coords.y;
			    if (this.options.tms) {
				    data['y'] = invertedY;
			    }
			    data['-y'] = invertedY;
		    }

		    return L.Util.template(this._url, L.Util.extend(data, this.options));
	    },

	    _tileOnLoad: function (done, tile) {
		    // For https://github.com/Leaflet/Leaflet/issues/3332
		    if (L.Browser.ielt9) {
			    setTimeout(L.Util.bind(done, this, null, tile), 0);
		    } else {
			    done(null, tile);
		    }
	    },

	    _tileOnError: function (done, tile, e) {
		    var errorUrl = this.options.errorTileUrl;
		    done(e, tile);
	    },

	    _onTileRemove: function (e) {
		    e.tile.onload = null;
	    },

	    _getZoomForUrl: function () {
		    var zoom = this._tileZoom,
		        maxZoom = this.options.maxZoom,
		        zoomReverse = this.options.zoomReverse;

		    if (zoomReverse) {
			    zoom = maxZoom - zoom;
		    }

		    return zoom;
	    },

	    _getSubdomain: function (tilePoint) {
		    var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		    return this.options.subdomains[index];
	    },

	    // stops loading all tiles in the background layer
	    _abortLoading: function () {
		    var i, tile;
		    for (i in this._tiles) {
			    if (this._tiles[i].coords.z !== this._tileZoom) {
				    tile = this._tiles[i].el;

				    tile.onload = L.Util.falseFn;
				    tile.onerror = L.Util.falseFn;

				    if (!tile.complete) {
					    tile.src = L.Util.emptyImageUrl;
					    this.removeLayer(tile);
					    delete this._tiles[i];
				    }
			    }
		    }
	    },

	    _removeTile: function (key) {
		    var tile = this._tiles[key];
		    if (!tile) { return; }

		    return L.GeoJSONGridLayer.prototype._removeTile.call(this, key);
	    },

	    _tileReady: function (coords, err, tile) {
		    if (!this._map) {
			    return;
		    }

		    return L.GeoJSONGridLayer.prototype._tileReady.call(this, coords, err, tile);
	    }
    });


    // @factory L.BoundariesLayer(urlTemplate: String, options?: BoundariesLayer options)
    // Instantiates a tile layer object given a `URL template` and optionally an options object.

    L.boundariesLayer = function (url, options) {
	    return new BoundariesLayer(url, options);
    }

});
