#! /usr/bin/python
import sys, json

with open('boundaries_all.GeoJson', 'r') as f:
    data = json.load(f)

with open('listCases.csv', 'r') as f:
    cases = [l.split(',') for l in f]

locs = {cas[2] for cas in cases}
for loc in locs:
    print(loc)

ambigus = {'Saint-Hilaire', 'Saint-Loup', 'Chappes', 'La Celle', 'Lussat', 'Saint-Angel'}
ambigu_insee = {"03238", "03242", "03058", "03047", "23114", "03217"}

newdata = {'type': 'FeatureCollection', 'features': [feat for feat in data['features'] if feat['properties']['name'] in locs-ambigus or feat['properties']['name'] in locs and feat['properties']['insee'] in ambigu_insee]}


with open('boundaries.GeoJson', 'w') as f:
    json.dump(newdata, f)

