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
    criteria: 'possible',
    collapsed: false,
    colors: {
        total: '#000000',
        possible: '#bedde9',
        probable: '#6ec5e4',
        certain: '#3e95cd',
        gueri: '#3cba9f',
        mort: '#c45850'
    }
};


// Load the map
let map = L.map('mapid', {center: [46.3428, 2.6077], zoom: 11, zoomControl: false});
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

L.control.scale({metric: true, imperial: false, position: 'bottomleft'}).addTo(map);

let viewSelect = L.control({position: 'bottomright'});
viewSelect.onAdd = genViewSelect;
viewSelect.addTo(map);

L.control.zoom({position: 'topright'}).addTo(map);



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


function updateView(sidePanel = true) {
    let counts = {};
    let chartPieData = {'possible': 0, 'probable': 0, 'certain': 0, 'gueri': 0, 'mort': 0};
    let chartDateData = {};
    let chartAgeData = {
        'total': [0,0,0,0,0,0,0,0,0,0],
        'possible': [0,0,0,0,0,0,0,0,0,0],
        'probable': [0,0,0,0,0,0,0,0,0,0],
        'certain': [0,0,0,0,0,0,0,0,0,0],
        'gueri': [0,0,0,0,0,0,0,0,0,0],
        'mort': [0,0,0,0,0,0,0,0,0,0]
    };
    let chartSexData = {
        'total': {'F': 0, 'M': 0},
        'possible': {'F': 0, 'M': 0},
        'probable': {'F': 0, 'M': 0},
        'certain': {'F': 0, 'M': 0},
        'gueri': {'F': 0, 'M': 0},
        'mort': {'F': 0, 'M': 0}
    };
    for (let cas of cases) {
        let loc = cas['Domicile'];
        if (!(loc in counts)) {
            counts[loc] = {'total': 0, 'possible': 0, 'probable': 0, 'certain': 0, 'gueri': 0, 'mort': 0};
        }
        let filtered = (viewConfig.filter ? viewConfig.filter(cas) : viewFilterDefault(cas));
        if (filtered) {
            counts[loc]['total'] += 1;
            counts[loc][filtered['Condition']] += 1;

            chartPieData[filtered['Condition']] += 1;

            if (!(filtered['Date symptomes'] in chartDateData)) {
                chartDateData[filtered['Date symptomes']] = 1;
            } else {
                chartDateData[filtered['Date symptomes']] += 1;
            }

            chartAgeData['total'][Math.floor(filtered['Age']/10)] += 1;
            chartAgeData[filtered['Condition']][Math.floor(filtered['Age']/10)] += 1;

            chartSexData['total'][filtered['Sexe']] += 1;
            chartSexData[filtered['Condition']][filtered['Sexe']] += 1;
        }
    }
    updateViewMap(counts);
    if (sidePanel) {
        updateViewChartPie(chartPieData);
        updateViewChartDate(chartDateData);
        updateViewChartAge(chartAgeData);
        updateViewChartSex(chartSexData);
    }
}

function updateViewMap(counts) {
    piecharts.clearLayers();
    for (let feature of boundaries.toGeoJSON().features) {
        let loc = feature.properties.name;
        if (counts[loc]) {
            feature.properties.countCases = counts[loc].certain + counts[loc].possible;
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

function updateViewChartPie(chartPieData) {
    let ctx = document.getElementById('chart-pie');
    let chartPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Possible', 'Probable', 'Certain', 'Guéris', 'Morts'],
            datasets: [{
                backgroundColor: [viewConfig.colors.possible, viewConfig.colors.probable, viewConfig.colors.certain, viewConfig.colors.gueri, viewConfig.colors.mort],
                data: [chartPieData.possible, chartPieData.probable, chartPieData.certain, chartPieData.gueri, chartPieData.mort]
            }]
        },
        options: {
            title: {display: true, text: 'Proportion globales'},
            animation: {animateRotate: false, animateScale: true},
            legend: {
                display: true, 
                position: 'right',
                labels: {generateLabels: function(chart) {
                    return [
                        {text: 'Possible', fillStyle: viewConfig.colors.possible},
                        {text: 'Probable', fillStyle: viewConfig.colors.probable},
                        {text: 'Certain', fillStyle: viewConfig.colors.certain},
                        {text: 'Guéri', fillStyle: viewConfig.colors.gueri},
                        {text: 'Mort', fillStyle: viewConfig.colors.mort},
                        {text: 'Total', fillStyle: '#000000'}
                    ];
			    }}
			}
        }
    });
}

function updateViewChartDate(chartDateData) {
    let ctx = document.getElementById('chart-date');
    let y = [];
    let x = Object.keys(chartDateData);
    x.sort();
    if (x[0] === '#N/A') {
        x.shift();
    }
    for (let key of x) {
        y.push(chartDateData[key]);
    }
    let chartDate = new Chart(ctx, {
        type: 'line',
        data: {
            labels: x,
            datasets: [
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.total, label: 'Date de premiers symptomes', data: y}
            ]
        },
        options: {
            legend: {display: false},
            title: {display: true, text: 'Apparition de symptome'},
            scales: {yAxes: [{ stacked: true }]}
        }
    });
}

function updateViewChartAge(chartAgeData) {
    let ctx = document.getElementById('chart-age');
    let chartAge = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['0-10','10-20','20-30','30-40','40-50','50-60','60-70','70-80','80-90','90-100'],
            datasets: [
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.mort, label: 'Morts', data: chartAgeData['mort']},
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.gueri, label: 'Guéris', data: chartAgeData['gueri']},
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.certain, label: 'Certain', data: chartAgeData['certain']},
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.probable, label: 'Probable', data: chartAgeData['probable']},
                {pointRadius: 0, pointHitRadius: 15, backgroundColor: viewConfig.colors.possible, label: 'Possible', data: chartAgeData['possible']},
            ]
        },
        options: {
            legend: {display: false},
            title: {display: true, text: 'Age (aires empillées)'},
            scales: {yAxes: [{ stacked: true }]}
        }
    });
}

function updateViewChartSex(chartSexData) {
    let ctx = document.getElementById('chart-sex');
    let chartPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Femme', 'Homme'],
            datasets: [
                {
                    backgroundColor: [viewConfig.colors.total, viewConfig.colors.total],
                    data: [chartSexData.total['F'], chartSexData.total['M']]
                },
                {
                    backgroundColor: [viewConfig.colors.gueri, viewConfig.colors.gueri],
                    data: [chartSexData.gueri['F'], chartSexData.gueri['M']]
                },
                {
                    backgroundColor: [viewConfig.colors.mort, viewConfig.colors.mort],
                    data: [chartSexData.mort['F'], chartSexData.mort['M']]
                },
                {
                    backgroundColor: [viewConfig.colors.certain, viewConfig.colors.certain],
                    data: [chartSexData.certain['F'], chartSexData.certain['M']]
                },
                {
                    backgroundColor: [viewConfig.colors.probable, viewConfig.colors.probable],
                    data: [chartSexData.probable['F'], chartSexData.probable['M']]
                },
                {
                    backgroundColor: [viewConfig.colors.possible, viewConfig.colors.possible],
                    data: [chartSexData.possible['F'], chartSexData.possible['M']]
                },
            ]
        },
        options: {
            cutoutPercentage: 20,
            rotation: 0,
            circumference: Math.PI,
            legend: {display: true, labels: {boxWidth: 0, generateLabels: (() => [{text: 'Homme    Femme'}])}},
            title: {display: true, text: 'Sexe'},
            animation: {animateRotate: false, animateScale: true}
        }
    });
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
        style.fillOpacity = 50*count / feature.properties.population;
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
        html += '<b>0.5%</b>';
        html += '<b>1%</b>';
        html += '<b>1.5%</b>';
        html += '<b id="end">2%</b>';
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
            let slider = document.createElement('span');
            slider.classList.add('switch');
            label0.appendChild(slider);
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
            let slider = document.createElement('span');
            slider.classList.add('switch');
            label1.appendChild(slider);
        }

        percent.appendChild(label0);
        percent.appendChild(label1);
    }

    div.appendChild(percent);

    radio0.addEventListener('change', function() {
        viewConfig.percent = false;
        updateView(false);
    } );
    radio1.addEventListener('change', function() {
        viewConfig.percent = true;
        updateView(false);
    } );

    return div;
};

function genPopup(feature, cases = {}) {
    let population = feature.properties.population || 0;
    let total = cases.total || 0;
    let possible = cases.possible || 0;
    let probable = cases.probable || 0;
    let certain = cases.certain || 0;
    let gueri = cases.gueri || 0;
    let mort = cases.mort || 0;

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
        elbase.appendChild(document.createTextNode('Possible : '));
        elbase.appendChild(document.createTextNode(possible.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Probable : '));
        elbase.appendChild(document.createTextNode(probable.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Certain : '));
        elbase.appendChild(document.createTextNode(certain.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Guéris : '));
        elbase.appendChild(document.createTextNode(gueri.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
        elbase.appendChild(document.createTextNode('Morts : '));
        elbase.appendChild(document.createTextNode(mort.toLocaleString()));
        elbase.appendChild(document.createElement('br'));
    }
    return elbase;
}

function genPiechart(feature, cases = {}) {
    let group = L.featureGroup();

    let population = feature.properties.population || 0;
    let total = cases.total || 0;
    let possible = cases.possible || 0;
    let probable = cases.probable || 0;
    let certain = cases.certain || 0;
    let gueri = cases.gueri || 0;
    let mort = cases.mort || 0;

    if (total) {
        let angles = [0, gueri, possible, probable, certain, mort];
        let colors = [viewConfig.colors.gueri, viewConfig.colors.possible, viewConfig.colors.probable, viewConfig.colors.certain, viewConfig.colors.mort]
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
    if (['possible', 'probable', 'certain', 'gueri', 'mort'].indexOf(cas['Condition']) >= 0) {
        return cas;
    } else {
        console.warn('Unknown condition "' + cas['Condition'] + '".');
        return undefined;
    }
}

function toggleCollapse() {
    viewConfig.collapsed = !viewConfig.collapsed;

    let aside = document.getElementsByTagName('aside')[0];
    if (viewConfig.collapsed) {
        aside.classList.remove('uncollapsed');
        aside.classList.add('collapsed');
        document.getElementById('collapse-button').textContent = '›';
    } else {
        aside.classList.remove('collapsed');
        aside.classList.add('uncollapsed');
        document.getElementById('collapse-button').textContent = '‹';
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

