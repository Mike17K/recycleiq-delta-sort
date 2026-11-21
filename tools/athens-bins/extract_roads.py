"""Extract the drivable road network of central Athens from an OSM .pbf into ops/data/roads.json (used by the fleet simulator).
Usage: python extract_roads.py greece.osm.pbf [../../ops/data/roads.json]    (env BBOX="south,west,north,east")
Format: {"nodes": [lat, lon, lat, lon, ...], "ways": [[class, oneway, nodeIdx, nodeIdx, ...], ...]}  (class: see CLASSES)"""
import json, os, sys
import osmium

S, W, N, E = map(float, os.environ.get("BBOX", "37.93,23.665,38.045,23.79").split(","))
CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service"]
CLASS_OF = {"motorway": 0, "motorway_link": 0, "trunk": 1, "trunk_link": 1, "primary": 2, "primary_link": 2, "secondary": 2 + 1, "secondary_link": 3,
            "tertiary": 4, "tertiary_link": 4, "unclassified": 4, "residential": 5, "living_street": 5, "service": 6}
nodes, index, ways = [], {}, []

def inside(lat, lon): return S <= lat <= N and W <= lon <= E

class H(osmium.SimpleHandler):
    def way(self, w):
        t = w.tags; hw = t.get("highway")
        if hw not in CLASS_OF or t.get("access") in ("private", "no") or t.get("motor_vehicle") in ("no", "private"):
            return
        if hw == "service" and t.get("service") in ("parking_aisle", "driveway", "drive-through"):
            return
        pts = []
        for n in w.nodes:
            if not n.location.valid(): pts.append(None); continue
            pts.append((round(n.location.lat, 5), round(n.location.lon, 5)) if inside(n.location.lat, n.location.lon) else None)
        ow = 1 if (t.get("oneway") in ("yes", "true", "1") or t.get("junction") in ("roundabout", "circular") or hw.startswith("motorway")) else 0
        if t.get("oneway") == "-1": ow, pts = 1, pts[::-1]
        run = []
        for p in pts + [None]:
            if p is None:
                if len(run) >= 2:
                    ids = []
                    for q in run:
                        if q not in index: index[q] = len(nodes) // 2; nodes.extend(q)
                        ids.append(index[q])
                    ways.append([CLASS_OF[hw], ow] + ids)
                run = []
            elif not run or run[-1] != p: run.append(p)

H().apply_file(sys.argv[1], locations=True, idx="flex_mem")
out = sys.argv[2] if len(sys.argv) > 2 else "../../ops/data/roads.json"
json.dump({"classes": CLASSES, "nodes": nodes, "ways": ways}, open(out, "w"), separators=(",", ":"))
print(len(nodes) // 2, "nodes,", len(ways), "ways ->", out, os.path.getsize(out) // 1024, "KB")
