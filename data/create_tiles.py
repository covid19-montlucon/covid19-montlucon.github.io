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


with open('boundaries_all_fr.GeoJson', 'r') as f:
    boundaries = json.load(f)

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



