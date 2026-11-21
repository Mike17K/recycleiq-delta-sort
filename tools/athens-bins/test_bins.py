"""Sanity checks for the extracted Athens bin data and the generated map. Run: python test_bins.py"""
import csv, json, sys
from pathlib import Path

S, W, N, E = 37.94, 23.70, 38.03, 23.78
rows = list(csv.DictReader(open("athens_bins/bins.csv", encoding="utf-8")))
gj = json.loads(Path("athens_bins/bins.geojson").read_text(encoding="utf-8"))
checks = []
def check(name, ok, detail=""): checks.append(ok); print(("PASS " if ok else "FAIL ") + name, detail)

check("csv is not empty", len(rows) > 0, f"({len(rows)} rows)")
check("geojson matches csv count", len(gj["features"]) == len(rows))
check("osm ids are unique", len({r["osm_id"] for r in rows}) == len(rows))
check("all points inside the Athens bbox", all(S <= float(r["lat"]) <= N and W <= float(r["lon"]) <= E for r in rows))
check("only known kinds", {r["kind"] for r in rows} <= {"waste_basket", "recycling", "waste_disposal", "waste"}, str(sorted({r['kind'] for r in rows})))
check("tags parse as JSON", all(isinstance(json.loads(r["tags"]), dict) for r in rows))
check("geojson coordinates are [lon, lat]", all(W <= f["geometry"]["coordinates"][0] <= E for f in gj["features"]))
m = Path("map.html")
check("map.html exists and embeds every bin", m.exists() and m.read_text(encoding="utf-8").count('"osm_id"') == len(rows))
check("map.html pins Leaflet 1.9.4 from cdnjs", m.exists() and "leaflet/1.9.4/leaflet.js" in m.read_text(encoding="utf-8"))
print(f"\n{sum(checks)}/{len(checks)} checks passed"); sys.exit(0 if all(checks) else 1)
