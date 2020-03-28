
// Load the map
var map = L.map('mapid').setView([46.3428, 2.6077], 11);
var OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
});
OpenStreetMap_HOT.addTo(map);


// Style
function getOpacity(n) {
    return 0.5 - 0.5 * Math.exp(-n/10)
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

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
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
    layer.bindPopup(
        '<h3>' + props.name + '</h3>' +
        'Population: ' + props.population + '<br/>' +
        'Suspectés: ' + props.suspected + ' (' + Math.trunc(1000 * props.suspected / props.population) + '‰)<br/>' +
        'Confirmés: ' + props.confirmed + ' (' + Math.trunc(1000 * props.confirmed / props.population) + '‰)<br/>' +
        'Guéris: ' + props.recovered + ' (' + Math.trunc(1000 * props.recovered / props.population) + '‰)<br/>' +
        'Morts: ' + props.dead + ' (' + Math.trunc(1000 * props.dead / props.population) + '‰)<br/>',
        {closeButton: false}
    );
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
var zones = L.geoJson([], {style: style, onEachFeature: onEachFeature}).addTo(map)
loadJSON("data/geojson/montlucon.json", function (data) {
    zones.addData(data)
});
loadJSON("data/geojson/saint-victor.json", function (data) {
    zones.addData(data)
});
loadJSON("data/geojson/domerat.json", function (data) {
    zones.addData(data)
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

