

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


// Legend
var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');

    var html  = '<h3>Cas suspectés</h3>';
    html += '<i class="grad"></i><br/>';
    html += '<b id="start">0</b>';
    html += '<b>25</b>';
    html += '<b>50</b>';
    html += '<b>100</b>';
    html += '<b id="end">200</b>';
    div.innerHTML = html;

    return div;
};

legend.addTo(map);

L.control.scale({metric: true, imperial: false}).addTo(map);


// Style
function style (feature) {
    return {
        opacity: 0,
        dashArray: 9,
        fillColor: feature.properties.confirmed > 0 ? "#ff0000" : "#000000",
        fillOpacity: (
            !feature.properties.suspected ? 0 : 
            feature.properties.suspected < 25 ? feature.properties.suspected / 25 / 4 : 
            feature.properties.suspected < 200 ? Math.log(16/200*feature.properties.suspected)/4/Math.LN2 : 1)
    };
}

function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 3,
        opacity: 0.5,
        color: '#000000',
        dashArray: '',
        fillColor: '#ff4444'
    });

    layer.openPopup();
}

function resetHighlight(e) {
    zones.resetStyle(e.target);
    e.target.closePopup();
}

function movePopup(e) {
    e.target.getPopup().setLatLng(e.latlng).openOn(map);
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
    var props = feature.properties;

    popupText = '<h3>' + 
        (props.blason ? '<img class="thumbnail" src="' + props.blason + '" /> ' : '') + 
        props.name + '</h3>' +
        'Population: ' + props.population + '<br/>' +
        (props.suspected ? 'Suspectés: ' + props.suspected + ' (' + Math.trunc(1000 * props.suspected / props.population) + '‰)<br/>' : '') +
        (props.confirmed ? 'Confirmés: ' + props.confirmed + ' (' + Math.trunc(1000 * props.confirmed / props.population) + '‰)<br/>' : '') +
        (props.recovered ? 'Guéris: ' + props.recovered + ' (' + Math.trunc(1000 * props.recovered / props.population) + '‰)<br/>' : '') +
        (props.dead ? 'Morts: ' + props.dead + ' (' + Math.trunc(1000 * props.dead / props.population) + '‰)<br/>' : '') +
        (props.comments ? '<br/>' + props.comments : '');
    layer.bindPopup(popupText, {closeButton: false, autoPan: false, offset: [0,-10]});

    if (props.suspected + props.confirmed + props.recovered + props.dead > 0) {
        var ntot = props.suspected + props.confirmed + props.recovered + props.dead;
        var angles = [0, props.recovered, props.suspected, props.confirmed, props.dead];
        var colors = ['#00ff00', '#00ffff', '#0000ff', '#ff0000']
        for (var i = 1; i < angles.length; ++i)
            angles[i] += angles[i-1] + 0.01; // 0.01 to avoid having one complete turn if null
        for (var i = 1; i < angles.length; ++i)
            angles[i] = 360 * angles[i] / ntot;
        for (var i = 0; i < angles.length-1; ++i) {
            circles.push(L.semiCircleMarker(
                [props.coordinates.latitude, props.coordinates.longitude],
                {radius: 3*Math.sqrt(ntot), interactive: false,
                    stroke: true, color: '#444444', weight: 1, opacity: 1,
                    fill: true, fillOpacity: 0.7,
                    fillColor: colors[i], startAngle: angles[i], stopAngle: angles[i+1]}
            ));
        }
    }

    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        dblclick: zoomToFeature,
        mousemove: movePopup
    });
}

function zoomUpdate(e) {
    if (map.getZoom() > 10) {
        circles.addTo(map);
    } else {
        circles.removeFrom(map);
    }
}
map.on({zoomend: zoomUpdate});

// Load regions
function loadJSON(url, callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', url, true);
    xobj.onreadystatechange = function () {
          if (xobj.readyState == 4 && xobj.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(JSON.parse(xobj.responseText));
          }
    };
    xobj.send(null);  
 }
var zones;
var circles = [];
loadJSON("data/Montluçon_AL8_extra.GeoJson", function (data) {
    zones = L.geoJson(data, {style: style, onEachFeature: onEachFeature}).addTo(map);
    circles = L.layerGroup(circles);
    circles.addTo(map);
});


