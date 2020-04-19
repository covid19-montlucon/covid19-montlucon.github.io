# covid19-montlucon.github.io

## Data organization

### Administrative boundaries organization
Boundaries have been extracted from openstreetmap using [wambachers-osm.website](https://wambachers-osm.website/boundaries/)'s API (administrative boundaries level 8) and gathered into the file `osm_boundaries.GeoJson`. This file contains the name, a bounding box, the geometry of the boundary and a Wikidata identifier.
*Note: It turns out some communes are missing.*

The script `create_boundaries.py` reads this file and create a new one, `all_boundaries.GeoJson`, containing needed information. Additional information are gathered from [wikidata](https://www.wikidata.org) and [commons.wikimedia.org](commons.wikimedia.org). The new file contains the following information for each commune (if available):
- The name
- The INSEE COG
- The OpenStreetMap identifier
- The Wikidata identifier
- The wikipedia identifier
- The population (loaded from wikidata)
- The URL
- The GPS coordinates of the commune
- The bounding box
- The geometry of the boundary

The file `all_boundaries.GeoJson` is not included in the repository because it is rather large and can be regenerate easily (takes several hours though).

Then, the script `create_tiles.py` spread these features into separate files to enable a dynamic tile loading. A boundary is attached to the tile containing the GPS coordinates of the commune.

### Case listing
The list of reported cases is stored in the csv file `listCases.csv`.

## Code overview




