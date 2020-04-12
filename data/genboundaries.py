#! /usr/bin/python
import sys, json

with open('boundaries_all.GeoJson', 'r') as f:
    data = json.load(f)

with open('listCases.csv', 'r') as f:
    cases = [l.split(',') for l in f]

locs = {cas[2] for cas in cases}
merges = []
for loc in locs:
    if loc == '#N/A':
        continue
    if '/' in loc:
        merges.append(loc.split('/'))
if any(loc in ms for ms in merges for loc in locs):
    print('Warning: isolated location')
if any(set(m1)&set(m2) for m1 in merges for m2 in merges if m1 != m2):
    print('Warning: overlapping regions')

ambigus = {'Saint-Hilaire', 'Saint-Loup', 'Chappes', 'La Celle', 'Lussat', 'Saint-Angel'}
ambigu_insee = {"03238", "03242", "03058", "03047", "23114", "03217"}

newdata = {'type': 'FeatureCollection', 'features': []}

waiting_merge = {}
for feat in data['features']:
    for ms in merges:
        if feat['properties']['name'] in ms:
            waiting_merge[feat['properties']['name']] = feat
            break
    else:
        if feat['properties']['name'] not in locs:
            continue
        if feat['properties']['name'] in ambigus and feat['properties']['insee'] not in ambigu_insee:
            continue
        if feat['properties']['population'] < 300:
            print('Warning: large population for ' + feat['properties']['name'] + ' (' + str(feat['properties']['population']) + ')')
        newdata['features'].append(feat)

for ms in merges:
    ms = [name for name in ms if name in waiting_merge]
    feats = [waiting_merge[name] for name in ms]
    newdata['features'].append({
        'type': 'Feature',
        'properties': {
            'name': '/'.join(sorted(ms)),
            'population': sum(feat['properties']['population'] for feat in feats),
            'coordinates': {
                'latitude': sum(feat['properties']['coordinates']['latitude'] for feat in feats)/len(ms),
                'longitude': sum(feat['properties']['coordinates']['longitude'] for feat in feats)/len(ms),
                }
            },
        'bbox': [
            min(feat['bbox'][0] for feat in feats),
            min(feat['bbox'][1] for feat in feats),
            max(feat['bbox'][2] for feat in feats),
            max(feat['bbox'][3] for feat in feats),
            ],
        'geometry': {
            'type': 'MultiPolygon',
            'coordinates': [
                    feat['geometry']['coordinates'][0] for feat in feats
                ]
            }
        })

with open('boundaries.GeoJson', 'w') as f:
    json.dump(newdata, f)

