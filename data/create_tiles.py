#! /usr/bin/python
import json
import os, os.path
from math import pi, tan, atan, exp, log
from collections import defaultdict
earthRadius = 6378137

def unproject(x, y, z):
    x /= 2**z
    y /= 2**z
    return (0.25 - atan(exp((y - 0.5)*2*pi))/pi)*360,\
            (x - 0.5)*360

def project(lat, lng, z=11):
    x = lng/360 + 0.5
    y = log(tan((0.25 - lat/360)*pi))/2/pi + 0.5
    return int(x*2**z), int(y*2**z), int(z)

def avg(*l):
    s = 0
    for n, x in enumerate(l, 1): s += x
    return s / n


with open('all_boundaries.GeoJson', 'r') as f:
    boundaries = json.load(f)

# Reduce geometry resolution (take half the points)
def reduce(mesh):
    if len(mesh) < 400:
        return mesh
    return mesh[::len(mesh)//400]
for feature in boundaries['features']:
    feature['geometry']['coordinates'] = [[reduce(cs) for cs in ca] for ca in feature['geometry']['coordinates']]

merges = [
        {"03191", "03285"},
        {"03172", "03249", "03317"},
        {"03167", "03261"},
        {"03032", "03308"},
        {"18002", "18041", "18178"},
        ]
merges = [dict.fromkeys(x) for x in merges]
for feature in boundaries['features']:
    for grp in merges:
        if feature['properties']['insee'] in grp:
            grp[feature['properties']['insee']] = feature
for grp in merges:
    for x in grp.values():
        boundaries['features'].remove(x)
    newfeat = {
            'type': 'Feature',
            'properties': {
                'name': ', '.join(x['properties']['name'] for x in sorted(grp.values(), key=lambda x: -x['properties']['population'])),
                'insee': '/'.join(sorted(x['properties']['insee'] for x in grp.values())),
                'population': sum(x['properties']['population'] for x in grp.values()),
                'coordinates': max(grp.values(), key=lambda x: x['properties']['population'])['properties']['coordinates'],
                },
            'bbox': [
                min(x['bbox'][0] for x in grp.values()),
                min(x['bbox'][1] for x in grp.values()),
                max(x['bbox'][2] for x in grp.values()),
                max(x['bbox'][3] for x in grp.values()),
                ],
            'geometry': {
                'type': 'MultiPolygon',
                'coordinates': [t for x in grp.values() for t in x['geometry']['coordinates']]
                }
            }
    boundaries['features'].append(newfeat)


outfile_fmt = './{z}/{x}/{y}.GeoJson'

assert boundaries['type'] == "FeatureCollection"
tiles = defaultdict(list)
for feature in boundaries['features']:
    lat = feature['properties']['coordinates']['latitude']
    lng = feature['properties']['coordinates']['longitude']

    x, y, z = project(lat, lng, 11)
    tiles[(x,y,z)].append(feature)


for (x, y, z), features in tiles.items():
    data = {
            'type': 'FeatureCollection',
            'features': features
            }
    outfile = outfile_fmt.format(x=x, y=y, z=z)
    dirname = os.path.dirname(outfile)
    os.makedirs(dirname, exist_ok=True)
    with open(outfile, 'w') as f:
        json.dump(data, f)

with open('./null.GeoJson', 'w') as f:
    data = {
            'type': 'FeatureCollection',
            'features': []
            }
    json.dump(data, f)



