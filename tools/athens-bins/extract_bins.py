"""Extract street bins from an OSM .pbf (offline alternative to Overpass). Writes athens_bins/bins.csv + bins.geojson.
Usage: python extract_bins.py greece.osm.pbf   (env BBOX="south,west,north,east", default central Athens)"""
import csv, json, os, sys
from pathlib import Path
import osmium

S, W, N, E = map(float, os.environ.get("BBOX", "37.94,23.70,38.03,23.78").split(","))
WANT = {"waste_basket", "recycling", "waste_disposal"}
rows = []

class H(osmium.SimpleHandler):
    def node(self, n):
        t = n.tags
        if (t.get("amenity") in WANT or "waste" in t) and n.location.valid() and S <= n.location.lat <= N and W <= n.location.lon <= E:
            rows.append({"osm_id": n.id, "lat": n.location.lat, "lon": n.location.lon, "kind": t.get("amenity", "waste"),
                         "recycling_type": t.get("recycling_type", ""), "tags": json.dumps(dict(t), ensure_ascii=False)})

H().apply_file(sys.argv[1], locations=False)
out = Path("athens_bins"); out.mkdir(exist_ok=True)
with open(out / "bins.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
(out / "bins.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
     "properties": {k: v for k, v in r.items() if k not in ("lat", "lon")}} for r in rows]}, ensure_ascii=False))
from collections import Counter
print(len(rows), "bins", dict(Counter(r["kind"] for r in rows)))
