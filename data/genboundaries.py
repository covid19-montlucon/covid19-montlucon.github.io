#! /usr/bin/python
import sys, json

with open('boundaries_all.GeoJson', 'r') as f:
    data = json.load(f)

with open('listCases.csv', 'r') as f:
    cases = [l.split(',') for l in f]

locs = {cas[2] for cas in cases}
for loc in locs:
    print(loc)

newdata = {'type': 'FeatureCollection', 'features': [feat for feat in data['features'] if feat['properties']['name'] in locs]}

with open('boundaries.GeoJson', 'w') as f:
    json.dump(newdata, f)

