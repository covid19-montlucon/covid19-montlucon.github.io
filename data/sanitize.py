#! /usr/bin/python
import sys, json, requests

if len(sys.argv) < 3:
    print("Usage:", sys.argv[0], "<filename.GeoJson>... <out.GeoJson>")
    sys.exit(-1)

features = []
for filename in sys.argv[1:-1]:
    with open(filename, 'r') as f:
        data = json.load(f)
    assert data.get("type") == "FeatureCollection", f"{filename} is not a feature collection"

    for n, feature in enumerate(data["features"], 1):
        assert feature.get("type") == "Feature"
        new_feature = {"type": "Feature"}

        properties = feature["properties"]
        new_feature["properties"] = {
                "name": properties["name"],
                "insee": properties["alltags"]["ref:INSEE"],
                "osm": properties["id"],
                "wikidata": properties["wikidata"],
                "wikipedia": properties["wikipedia"],
                }
        new_feature["bbox"] = feature["bbox"]
        new_feature["geometry"] = feature["geometry"]

        print(f"{len(features):3} {filename} {n}/{len(data['features'])} {properties['name']}")

        name = properties["name"]
        wikidata = properties["wikidata"]
        wikidata_query = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=fr&props=claims&ids=" + str(wikidata)
        ans = requests.get(wikidata_query).json()
        assert ans['success']
        claims = ans['entities'][wikidata]['claims']
        try:
            population = int(claims['P1082'][-1]['mainsnak']['datavalue']['value']['amount'])
            new_feature['properties']['population'] = population
        except KeyError as e:
            print(f"Population not found for {name} ({wikidata})")
        try:
            gps = claims['P625'][-1]['mainsnak']['datavalue']['value']
            new_feature['properties']['coordinates'] = gps
        except KeyError as e:
            print(f"GPS Coordinates not found for {name} ({wikidata})")
        try:
            postal = claims['P281'][-1]['mainsnak']['datavalue']['value']
            new_feature['properties']['postalcode'] = postal
        except KeyError as e:
            print(f"Postal code not found for {name} ({wikidata})")
        try:
            url_wikimedia = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=File:" + claims['P94'][-1]['mainsnak']['datavalue']['value']
            json_data2 = requests.get(url_wikimedia).json()
            new_feature['properties']['blason'] = next(iter(json_data2['query']['pages'].values()))['thumbnail']['source']
        except KeyError as e:
            #print(f"Blason not found for {name} ({wikidata}): {e}")
            pass
        try:
            url = "https://lannuaire.service-public.fr/" + claims['P6671'][-1]['mainsnak']['datavalue']['value']
            new_feature['properties']['url'] = url
        except KeyError as e:
            print(f"URL not found for {name} ({wikidata})")

        features.append(new_feature)


with open(sys.argv[-1], 'w') as f:
    data = {"type": "FeatureCollection", "features": features}
    #json.dump(data, f, indent=3)
    json.dump(data, f)

