// Initialize data
let boundaries = L.geoJson(
    {'type': 'FeatureCollection', 'features': []},
    {style: boundaryStyle, onEachFeature: boundaryInit}
);
let piecharts = L.featureGroup();
let cases = [];
let viewConfig = {
    filter: undefined,
    percent: false,
    criteria: 'suspected'
};


// Load the map
let map = L.map('mapid').setView([46.3428, 2.6077], 11);
let CartoDB_PositronNoLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
	attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 19
});
let OpenMapSurfer_AdminBounds = L.tileLayer('https://maps.heigit.org/openmapsurfer/tiles/adminb/webmercator/{z}/{x}/{y}.png', {
	maxZoom: 18,
	attribution: 'Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group @ University of Heidelberg</a>'
});
CartoDB_PositronNoLabels.addTo(map);
OpenMapSurfer_AdminBounds.addTo(map);
boundaries.addTo(map);
piecharts.addTo(map);

let loading = L.control({position: 'topright'})
loading.onAdd = function (map) {
    let div = L.DomUtil.create('div', 'info');
    div.innerHTML = '↻ chargement...';
    return div;
}
loading.addTo(map);

let legend = L.control({position: 'bottomright'});
legend.onAdd = function (map) {
    let div = L.DomUtil.create('div', 'info legend');

    div.innerHTML = genLegendHTML();

    return div;
};
legend.addTo(map);

L.control.scale({metric: true, imperial: false}).addTo(map);

let viewSelect = L.control({position: 'topright'});
viewSelect.onAdd = genViewSelect;
viewSelect.addTo(map);



// Load data
function CSVParse(csv) {
    let lines = csv.split(/\r\n|\n/);
    for (let i = 0; i < lines.length; ++i) {
        lines[i] = lines[i].split(',');
    }
    const labels = lines[0];
    let json = [];
    for (let i = 1; i < lines.length-1; ++i) {
        let entry = {};
        for (let j = 0; j < labels.length; j++) {
            entry[labels[j]] = lines[i][j];
        }
        json.push(entry);
    }
    return json;
}

{
let loadBoundaries = fetch('data/boundaries.GeoJson')
    .then(function (ans) { if (!ans.ok) throw new Error('HTTP Error: ' + ans.status); return ans; })
    .then(ans => ans.json())
    .then(data => boundaries.addData(data))
    .catch(error);
let loadListCases = fetch('data/listCases.csv')
    .then(function (ans) { if (!ans.ok) throw new Error('HTTP Error: ' + ans.status); return ans; })
    .then(ans => ans.text())
    .then(CSVParse)
    .then(data => cases = data)
    .catch(error);
Promise.all([loadBoundaries, loadListCases])
    .then(updateView)
    .then(() => loading.remove());
}
function reloadListCases() {
    return fetch('data/listCases.csv')
        .then(ans => ans.text())
        .then(CSVParse)
        .then(data => cases = data)
        .catch(err => console.log(err))
        .then(updateView);
}
setInterval(reloadListCases, 1800000); // Reload every 30 minutes


function updateView() {
    let counts = {};
    for (let cas of cases) {
        let loc = cas['Domicile'];
        if (!(loc in counts)) {
            counts[loc] = {'total': 0, 'suspected': 0, 'confirmed': 0, 'recovered': 0, 'dead': 0};
        }
        let filtered = (viewConfig.filter ? viewConfig.filter(cas) : viewFilterDefault(cas));
        if (filtered) {
            counts[loc]['total'] += 1;
            counts[loc][filtered['Condition']] += 1;
        }
    }
    piecharts.clearLayers();
    for (let feature of boundaries.toGeoJSON().features) {
        let loc = feature.properties.name;
        if (counts[loc]) {
            feature.properties.countCases = counts[loc].confirmed + counts[loc].suspected;
            feature.properties.popup = genPopup(feature, counts[loc]);
            piecharts.addLayer(genPiechart(feature, counts[loc]));
            delete counts[loc];
        } else {
            feature.properties.popup = genPopup(feature);
        }
    }
    for (let loc in counts) {
        console.warn('Location "' + loc + '" not found.');
    }
    boundaries.resetStyle();

    legend.getContainer().innerHTML = genLegendHTML(viewConfig.percent);
}

function boundaryInit(feature, layer) {
    layer.bindPopup((l => l.feature.properties.popup),
        {closeButton: false, autoPan: false, offset: [0,-10]});

    layer.on({
        mouseover: function (e) {
            let feature = e.target.feature;
            e.target.setStyle(boundaryStyle(feature, true));
            return e.target.openPopup(e.latlng);
        },
        mouseout: function (e) {
            let feature = e.target.feature;
            e.target.setStyle(boundaryStyle(feature, false));
            return e.target.closePopup();
        },
        mousemove: function (e) {
            e.target.getPopup().setLatLng(e.latlng);
        },
        dblclick: e => map.fitBounds(e.target.getBounds())
    });
}

function boundaryStyle(feature, highlight = false) {
    let style;
    let count = 0;
    if (feature.properties.hasOwnProperty('countCases')) {
        if (feature.properties.countCases > 0) {
            count = feature.properties.countCases;
        }
    }
    if (highlight) {
        style = {
            weight: 3,
            opacity: 0.5,
            color: '#000000',
            dashArray: '',
            fillColor: '#ff4444'
        };
    } else {
        style = {
            weight: 1,
            opacity: 0,
            color: '#000000',
            dashArray: 9,
            fillColor: count > 0 ? '#ff0000' : '#000000'
        };
    }
    if (viewConfig.percent) {
        style.fillOpacity = count / feature.properties.population;
    } else {
        if (count < 25) {
            style.fillOpacity = count / 25 / 4;
        } else if (count < 200) {
            style.fillOpacity = Math.log(16/200*count) / (4*Math.LN2);
        } else {
            style.fillOpacity = 1;
        }
    }
    return style;
}

function genLegendHTML() {
    let html = '';// = '<h3>Cas suspectés</h3>';
    html += '<i class="grad"></i><br/>';
    if (viewConfig.percent) {
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

function genViewSelect() {
    let div = L.DomUtil.create('div', 'info');

    let radio0, radio1;
    let percent = document.createElement('form');
    {
        let label0 = document.createElement('label');
        {
            radio0 = document.createElement('input');
            radio0.id = 'percent-count';
            radio0.name = 'percent';
            radio0.type = 'radio';
            radio0.value = 'count';
            radio0.checked = true;
            let txt0 = document.createElement('div');
            txt0.appendChild(document.createTextNode('nombre de cas'));
            label0.appendChild(radio0);
            label0.appendChild(txt0);
        }

        let label1 = document.createElement('label');
        {
            radio1 = document.createElement('input');
            radio1.name = 'percent';
            radio1.type = 'radio';
            radio1.value = 'percent';
            let txt1 = document.createElement('div');
            txt1.appendChild(document.createTextNode('% population'));
            label1.appendChild(radio1);
            label1.appendChild(txt1);
        }

        percent.appendChild(label0);
        percent.appendChild(label1);
    }

    div.appendChild(percent);

    radio0.addEventListener('change', function() {
        viewConfig.percent = false;
        updateView();
    } );
    radio1.addEventListener('change', function() {
        viewConfig.percent = true;
        updateView();
    } );

    return div;
};

function genPopup(feature, cases = {}) {
    let population = feature.properties.population || 0;
    let total = cases.total || 0;
    let suspected = cases.suspected || 0;
    let confirmed = cases.confirmed || 0;
    let recovered = cases.recovered || 0;
    let dead = cases.dead || 0;

    let elbase = document.createElement('div');
    {
        let eltitle = document.createElement('h3');
        if (feature.properties.blason) {
            let elblason = document.createElement('img');
            elblason.classList.add('thumbnail');
            elblason.src = feature.properties.blason;
            elblason.alt = '';
            elbase.appendChild(elblason);
        }
        eltitle.appendChild(document.createTextNode(feature.properties.name));
        elbase.appendChild(eltitle);
    }
    elbase.appendChild(document.createTextNode('Population : '));
    elbase.appendChild(document.createTextNode(population.toLocaleString()));
    elbase.appendChild(document.createElement('br'));
    if (total) {
        elbase.appendChild(document.createTextNode('Suspectés : '));
        elbase.appendChild(document.createTextNode(suspected.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Confirmés : '));
        elbase.appendChild(document.createTextNode(confirmed.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Guéris : '));
        elbase.appendChild(document.createTextNode(recovered.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Morts : '));
        elbase.appendChild(document.createTextNode(dead.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
    }
    return elbase;
}

function genPiechart(feature, cases = {}) {
    let group = L.featureGroup();

    let population = feature.properties.population || 0;
    let total = cases.total || 0;
    let suspected = cases.suspected || 0;
    let confirmed = cases.confirmed || 0;
    let recovered = cases.recovered || 0;
    let dead = cases.dead || 0;

    if (total) {
        let angles = [0, recovered, suspected, confirmed, dead];
        let colors = ['#00ff00', '#00ffff', '#0000ff', '#ff0000']
        let marker = L.layerGroup();
        for (let i = 1; i < angles.length; ++i)
            angles[i] += angles[i-1];
        for (let i = 1; i < angles.length; ++i)
            angles[i] = 360 * angles[i] / total;
        for (let i = 0; i < angles.length-1; ++i) {
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
        group.addLayer(marker);
    }
    return group;
}

function viewFilterDefault(cas) {
    if (['suspected', 'confirmed', 'recovered', 'dead'].indexOf(cas['Condition']) >= 0) {
        return cas;
    } else {
        console.warn('Unknown condition "' + cas['Condition'] + '".');
        return undefined;
    }
}

function error(err) {
    console.error(err);
    let error = L.control({position: 'topright'})
    error.onAdd = function (map) {
        let div = L.DomUtil.create('div', 'error');
        div.innerHTML = err;
        return div;
    }
    error.addTo(map);
}

