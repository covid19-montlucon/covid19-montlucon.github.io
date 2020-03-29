#! /usr/bin/python
import json, requests

with open("Montluçon_AL8.GeoJson", 'r') as f:
    data = json.load(f)

ntot = len(data['features'])
for n, feat in enumerate(data['features'], 1):
    name = feat['properties']['name']
    wikidata_id = feat['properties']['wikidata']
    print(f"{n:3}/{ntot} {name}: {wikidata_id}")

    url_query = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=fr&props=aliases|claims&ids=" + str(wikidata_id)
    # Query
    json_data = requests.get(url_query).json()
    assert json_data['success']

    claims = json_data['entities'][wikidata_id]['claims']
    try:
        population = int(claims['P1082'][-1]['mainsnak']['datavalue']['value']['amount'])
        feat['properties']['population'] = population
    except KeyError as e:
        print(f"Population not found for {name} ({wikidata_id})")
    try:
        gps = claims['P625'][-1]['mainsnak']['datavalue']['value']
        feat['properties']['coordinates'] = gps
    except KeyError as e:
        print(f"GPS Coordinates not found for {name} ({wikidata_id})")
    try:
        postal = claims['P281'][-1]['mainsnak']['datavalue']['value']
        feat['properties']['postalcode'] = postal
    except KeyError as e:
        print(f"Postal code not found for {name} ({wikidata_id})")
    try:
        url_wikimedia = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=File:" + claims['P94'][-1]['mainsnak']['datavalue']['value']
        json_data2 = requests.get(url_wikimedia).json()
        feat['properties']['blason'] = next(iter(json_data2['query']['pages'].values()))['thumbnail']['source']
    except KeyError as e:
        #print(f"Blason not found for {name} ({wikidata_id}): {e}")
        pass
    try:
        url = "https://lannuaire.service-public.fr/" + claims['P6671'][-1]['mainsnak']['datavalue']['value']
        feat['properties']['url'] = url
    except KeyError as e:
        print(f"URL not found for {name} ({wikidata_id})")


with open("Montluçon_AL8_extra.GeoJson", 'w') as f:
    json.dump(data, f, indent=3)

