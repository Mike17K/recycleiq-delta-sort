"""Find street bins in Athens from OpenStreetMap, then fetch one nearby street-level photo per bin.

Step 1 (no key needed): Overpass query -> bins.csv / bins.geojson
Step 2 (needs MAPILLARY_TOKEN, free at mapillary.com/developer): nearest photo within RADIUS_M of each bin
        -> photos/<osm_id>.jpg and bins_with_photos.csv (photo id, capture date, distance, compass angle)

Install:  pip install requests
Run:      python fetch_bins.py                      # step 1 only
          MAPILLARY_TOKEN=... python fetch_bins.py  # steps 1 and 2
Options (env): BBOX="south,west,north,east"  LIMIT=200  RADIUS_M=25
"""
import csv, json, math, os, sys, time
from pathlib import Path
import requests

BBOX = os.environ.get("BBOX", "37.94,23.70,38.03,23.78")       # south,west,north,east (central Athens)
LIMIT = int(os.environ.get("LIMIT", "0"))                       # 0 = all bins
RADIUS_M = float(os.environ.get("RADIUS_M", "25"))
TOKEN = os.environ.get("MAPILLARY_TOKEN")
OUT = Path("athens_bins"); (OUT / "photos").mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "AthensBinResearch/1.0"}
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

QUERY = f"""[out:json][timeout:120];
(node["amenity"~"^(waste_basket|recycling|waste_disposal)$"]({BBOX});
 node["waste"]({BBOX}););
out body;"""

def bins_from_osm():
    for url in OVERPASS:
        try:
            r = requests.post(url, data={"data": QUERY}, headers=UA, timeout=180); r.raise_for_status()
            return r.json()["elements"]
        except Exception as e:
            print("overpass failed:", url, e, file=sys.stderr)
    sys.exit("no Overpass server reachable")

def meters(lat1, lon1, lat2, lon2):
    k = 111320; return math.hypot((lat2 - lat1) * k, (lon2 - lon1) * k * math.cos(math.radians(lat1)))

def nearest_photo(lat, lon):
    d = RADIUS_M / 111320
    r = requests.get("https://graph.mapillary.com/images", headers=UA, timeout=60, params={
        "access_token": TOKEN, "fields": "id,captured_at,compass_angle,thumb_1024_url,geometry",
        "bbox": f"{lon-d*1.3:.6f},{lat-d:.6f},{lon+d*1.3:.6f},{lat+d:.6f}", "limit": 50})
    r.raise_for_status()
    best = None
    for im in r.json().get("data", []):
        ilon, ilat = im["geometry"]["coordinates"]; dist = meters(lat, lon, ilat, ilon)
        if dist <= RADIUS_M and (best is None or dist < best[0]): best = (dist, im)
    return best

nodes = bins_from_osm()
rows = [{"osm_id": n["id"], "lat": n["lat"], "lon": n["lon"], "kind": n.get("tags", {}).get("amenity", "waste"),
         "recycling_type": n.get("tags", {}).get("recycling_type", ""), "tags": json.dumps(n.get("tags", {}), ensure_ascii=False)}
        for n in nodes]
if LIMIT: rows = rows[:LIMIT]
print("bins found:", len(rows))
with open(OUT / "bins.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
(OUT / "bins.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]}, "properties": {k: v for k, v in r.items() if k not in ("lat", "lon")}}
    for r in rows]}, ensure_ascii=False))

if not TOKEN:
    sys.exit("step 1 done. Set MAPILLARY_TOKEN to also fetch a nearby street-level photo for each bin.")

done = 0
with open(OUT / "bins_with_photos.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["osm_id", "lat", "lon", "photo_id", "captured_at", "distance_m", "compass_angle"])
    for r in rows:
        try:
            hit = nearest_photo(r["lat"], r["lon"])
            if hit:
                dist, im = hit; path = OUT / "photos" / f"{r['osm_id']}.jpg"
                if not path.exists(): path.write_bytes(requests.get(im["thumb_1024_url"], timeout=60).content)
                w.writerow([r["osm_id"], r["lat"], r["lon"], im["id"], im["captured_at"], round(dist, 1), im.get("compass_angle")]); done += 1
        except Exception as e:
            print("skip", r["osm_id"], e, file=sys.stderr)
        time.sleep(0.2)
print("bins with a photo:", done, "of", len(rows))
