// Tools
function loadJSON(url) {
    return new Promise(function(resolve, reject) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType('application/json');
        xobj.open('GET', url, true);
        xobj.onreadystatechange = function () {
            if (xobj.status == '200') {
                if (xobj.readyState == 4)
                    resolve(JSON.parse(xobj.responseText));
            } else {
                    reject(Error(xobj.statusText));
            }
        };
        xobj.send(null);
    });
}


// Load data
var adminBoundariesPromise = loadJSON('data/adminBoundaries.GeoJson');
var listCasesPromise = loadJSON('data/listCases.json');

adminBoundariesPromise.catch(err => console.log(err));
listCasesPromise.catch(err => console.log(err));


// Load the map
var map = L.map('mapid').setView([46.3428, 2.6077], 11);
var CartoDB_PositronNoLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
	attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 19
});
var OpenMapSurfer_AdminBounds = L.tileLayer('https://maps.heigit.org/openmapsurfer/tiles/adminb/webmercator/{z}/{x}/{y}.png', {
	maxZoom: 18,
	attribution: 'Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group @ University of Heidelberg</a>'
});
CartoDB_PositronNoLabels.addTo(map);
OpenMapSurfer_AdminBounds.addTo(map);

map.on({zoomend: e => (e.target.getZoom() > 10 ? '': '')});


// Load regions
function popupText(l) {
    var population = l.feature.properties.population || 0;
    var total = l.feature.properties.total || 0;
    var suspected = l.feature.properties.suspected || 0;
    var confirmed = l.feature.properties.confirmed || 0;
    var recovered = l.feature.properties.recovered || 0;
    var dead = l.feature.properties.dead || 0;
    text = '<h3>';
    if (l.feature.properties.blason)
        text += '<img class="thumbnail" src="' + l.feature.properties.blason + '" /> '
        // TODO: encodeURI(blason) breaks if the url has already been encoded.
    text += l.feature.properties.name + '</h3>'
    text += 'Population : ' + population.toLocaleString() + '<br/>';
    if (total) {
        text += 'Suspectés : ' + suspected.toLocaleString() + '<br/>';
        text += 'Confirmés : ' + confirmed.toLocaleString() + '<br/>';
        text += 'Guéris : ' + recovered.toLocaleString() + '<br/>';
        text += 'Morts : ' + dead.toLocaleString() + '<br/>';
    }
    return text;
}
function adminBoundaryInit(feature, layer) {
    layer.bindPopup(popupText, {closeButton: false, autoPan: false, offset: [0,-10]});

    layer.on({
        mouseover: e => e.target.setStyle(adminBoundaryStyleHighlight(e.target.feature)).openPopup(e.latlng),
        mouseout: e => adminBoundariesLayer.resetStyle(e.target.closePopup()),
        mousemove: e => e.target.getPopup().setLatLng(e.latlng).openOn(map),
        dblclick: e => map.fitBounds(e.target.getBounds())
    });
}

adminBoundariesLayer = L.geoJson(
    {'type': 'FeatureCollection', 'features': []},
    {style: adminBoundaryStyle, onEachFeature: adminBoundaryInit}
).addTo(map);
adminBoundariesPromise.then(data => adminBoundariesLayer.addData(data));


// Legend
var legend = L.control({position: 'bottomright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');

    div.innerHTML = legendHtml(false);
    div.percent = false;
    div.onclick = function () {
        div.percent = !div.percent;
        div.innerHTML = legendHtml(div.percent);
        adminBoundaryStyleSel = div.percent ? adminBoundaryStyleSuspectedPercent : adminBoundaryStyleSuspected;
        adminBoundariesLayer.resetStyle();
    }

    return div;
};
function legendHtml(percent) {
    var html  = '<h3>Cas suspectés</h3>';
    html += '<i class="grad"></i><br/>';
    if (percent) {
        html += '<b id="start">0%</b>';
        html += '<b>25%</b>';
        html += '<b>50%</b>';
        html += '<b>75%</b>';
        html += '<b id="end">100%</b>';
    } else {
        html += '<b id="start">0</b>';
        html += '<b>25</b>';
        html += '<b>50</b>';
        html += '<b>100</b>';
        html += '<b id="end">200</b>';
    }
    return html;
}
legend.addTo(map);

L.control.scale({metric: true, imperial: false}).addTo(map);


// Style
function adminBoundaryStyleSuspected(feature) {
    return {
        opacity: 0,
        dashArray: 9,
        fillColor: feature.properties.total > 0 ? '#ff0000' : '#000000',
        fillOpacity: (
            !feature.properties.suspected ? 0 : 
            feature.properties.suspected < 25 ? feature.properties.suspected / 25 / 4 : 
            feature.properties.suspected < 200 ? Math.log(16/200*feature.properties.suspected)/4/Math.LN2 : 1)
    };
}
function adminBoundaryStyleSuspectedPercent(feature) {
    return {
        opacity: 0,
        dashArray: 9,
        fillColor: feature.properties.total > 0 ? '#ff0000' : '#000000',
        fillOpacity: (
            !feature.properties.suspected ? 0 : 
            feature.properties.suspected / feature.properties.population)
    };
}
adminBoundaryStyleSel = undefined;
function adminBoundaryStyle(feature) {
    if (!adminBoundaryStyleSel) { adminBoundaryStyleSel = adminBoundaryStyleSuspected; }
    return adminBoundaryStyleSel(feature);
}

function adminBoundaryStyleHighlight(feature) {
    return {
        weight: 3,
        opacity: 0.5,
        color: '#000000',
        dashArray: '',
        fillColor: '#ff4444'
    };
}


// Data process
function updateAdminBoundaries([adminBoundaries, listCases]) {
    var counts = {};
    for (var cas of listCases) {
        var insee = cas.residence_insee;
        if (!(insee in counts))
            counts[insee] = {'total': 0, 'suspected': 0, 'confirmed': 0, 'recovered': 0, 'dead': 0};
        counts[insee]['total'] += 1;
        counts[insee][cas.condition] += 1;
    }
    for (var feature of adminBoundaries.features) {
        var insee = feature.properties.insee;
        for (var key in counts[insee])
            feature.properties[key] = counts[insee][key];
    }
    return adminBoundaries;
}

function addPieCharts(adminBoundaries) {
    var layer = L.layerGroup({attribution: 'ARS'}).addTo(map);
    
    for (var feature of adminBoundaries.features) {
        var population = feature.properties.population || 0;
        var total = feature.properties.total || 0;
        var suspected = feature.properties.suspected || 0;
        var confirmed = feature.properties.confirmed || 0;
        var recovered = feature.properties.recovered || 0;
        var dead = feature.properties.dead || 0;
        if (total) {
            var angles = [0, recovered, suspected, confirmed, dead];
            var colors = ['#00ff00', '#00ffff', '#0000ff', '#ff0000']
            var marker = L.layerGroup();
            for (var i = 1; i < angles.length; ++i)
                angles[i] += angles[i-1];
            for (var i = 1; i < angles.length; ++i)
                angles[i] = 360 * angles[i] / total;
            for (var i = 0; i < angles.length-1; ++i) {
                marker.addLayer(L.semiCircle(
                    [
                        feature.properties.coordinates.latitude, 
                        feature.properties.coordinates.longitude
                    ],
                    {
                        radius: 150*Math.sqrt(total), interactive: false,
                        stroke: true, color: '#444444', weight: 1, opacity: 1,
                        fill: true, fillOpacity: 0.7,
                        fillColor: colors[i], startAngle: angles[i], stopAngle: angles[i+1]+1
                    }
                ));
            }
            layer.addLayer(marker);
        }
    }
}

var datasPromise = Promise.all([adminBoundariesPromise, listCasesPromise]).then(updateAdminBoundaries);
datasPromise.then(() => adminBoundariesLayer.resetStyle())
datasPromise.then(addPieCharts)


