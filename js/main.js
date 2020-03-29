
// Load the map
var map = L.map('mapid').setView([46.3428, 2.6077], 11);
var OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
});
OpenStreetMap_HOT.addTo(map);


// Style
function getOpacity(n) {
    return n ? 0.5 - 0.5 * Math.exp(-n/10) : 0;
}
function style (feature) {
    return {
        color: "#000000",
        opacity: 0,
        fillColor: feature.properties.confirmed > 0 ? "#ff0000" : "#000000",
        fillOpacity: getOpacity(feature.properties.confirmed),
    };
}

function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 3,
        opacity: 0.3,
        color: '#000000',
        dashArray: '',
        //fillOpacity: 0.7
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
    layer.bindPopup(popupText, {closeButton: false, autoPan: false});

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


// Legend
var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {

    var div = L.DomUtil.create('div', 'info legend'),
        grades = [0, 2, 5, 10, 20, 50];

    div.innerHTML = '<h3>Cas suspectés</h3>'
    for (var i = 0; i < grades.length; i++) {
        div.innerHTML += 
            '<i style="opacity:' + getOpacity(grades[i]) + '"></i> ' +
            grades[i] + (grades[i + 1] ? '-' + grades[i + 1] + '<br/>' : '+');
    }

    return div;
};

legend.addTo(map);

L.control.scale().addTo(map);

