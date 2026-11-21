# athens_orthophoto_tiles.py
#
# Install:
#   pip install requests pillow pyproj
#
# Run:
#   python athens_orthophoto_tiles.py
#
# Optional: choose a specific WMS layer:
#   LAYER_NAME="layer_name_here" python athens_orthophoto_tiles.py

import os
import csv
import math
import time
import requests
import xml.etree.ElementTree as ET

from pathlib import Path
from PIL import Image, ImageDraw
from pyproj import Transformer

WMS_URL = (
    "http://gis.ktimanet.gr/wms/"
    "wmsopen/wmsserver.aspx"
)

OUT = Path("athens_orthophotos")
OUT.mkdir(exist_ok=True)

# Approximate initial coverage of Athens municipality.
# Format: west, south, east, north (longitude, latitude).
WEST, SOUTH = 23.70, 37.94
EAST, NORTH = 23.78, 38.03

TILE_METRES = 400
OVERLAP_METRES = 10
PIXELS = 2048
DELAY_SECONDS = 0.4

session = requests.Session()
session.headers.update({
    "User-Agent": "AthensOrthophotoResearch/1.0"
})

def get_capabilities():
    r = session.get(
        WMS_URL,
        params={
            "SERVICE": "WMS",
            "VERSION": "1.1.1",
            "REQUEST": "GetCapabilities"
        },
        timeout=90
    )
    r.raise_for_status()
    return ET.fromstring(r.content)

def get_layers(root):
    layers = []
    for el in root.iter():
        if el.tag.endswith("Layer"):
            name = None
            title = None
            for child in el:
                if child.tag.endswith("Name"):
                    name = child.text
                if child.tag.endswith("Title"):
                    title = child.text
            if name:
                layers.append((name, title or name))
    return layers

root = get_capabilities()
layers = get_layers(root)

print("\nAvailable WMS layers:")
for name, title in layers:
    print(f"  {name}  |  {title}")

requested_layer = os.environ.get("LAYER_NAME")

if requested_layer:
    layer_name = requested_layer
else:
    candidates = [
        (name, title)
        for name, title in layers
        if any(word in (name + " " + title).lower()
               for word in ["ortho", "orthophoto", "ορθο", "photo"])
    ]

    if len(candidates) == 1:
        layer_name = candidates[0][0]
    else:
        raise SystemExit(
            "\nPlease set LAYER_NAME to the correct imagery layer "
            "shown above, then run again."
        )

print("\nSelected layer:", layer_name)

# Transform Athens bounds to Greek Grid (EPSG:2100).
transformer = Transformer.from_crs(
    "EPSG:4326", "EPSG:2100", always_xy=True
)

x1, y1 = transformer.transform(WEST, SOUTH)
x2, y2 = transformer.transform(EAST, NORTH)

xmin, xmax = sorted([x1, x2])
ymin, ymax = sorted([y1, y2])

step = TILE_METRES - OVERLAP_METRES

records = []
tile_number = 0

for y in range(
    math.floor(ymin / step) * step,
    math.ceil(ymax / step) * step,
    step
):
    for x in range(
        math.floor(xmin / step) * step,
        math.ceil(xmax / step) * step,
        step
    ):
        left = max(x, xmin)
        bottom = max(y, ymin)
        right = min(x + TILE_METRES, xmax)
        top = min(y + TILE_METRES, ymax)

        if right <= left or top <= bottom:
            continue

        tile_number += 1
        tile_id = f"ATH_{tile_number:04d}"
        filename = OUT / f"{tile_id}.jpg"

        params = {
            "SERVICE": "WMS",
            "VERSION": "1.1.1",
            "REQUEST": "GetMap",
            "LAYERS": layer_name,
            "STYLES": "",
            "SRS": "EPSG:2100",
            "BBOX": f"{left},{bottom},{right},{top}",
            "WIDTH": PIXELS,
            "HEIGHT": PIXELS,
            "FORMAT": "image/jpeg"
        }

        if not filename.exists():
            for attempt in range(3):
                try:
                    response = session.get(
                        WMS_URL,
                        params=params,
                        timeout=120
                    )
                    response.raise_for_status()

                    if "image" not in response.headers.get(
                        "Content-Type", ""
                    ):
                        raise RuntimeError(
                            response.text[:500]
                        )

                    filename.write_bytes(response.content)
                    break

                except Exception as e:
                    if attempt == 2:
                        print("FAILED:", tile_id, e)
                    else:
                        time.sleep(2 ** attempt)

        records.append({
            "tile_id": tile_id,
            "file": str(filename),
            "xmin": left,
            "ymin": bottom,
            "xmax": right,
            "ymax": top
        })

        print(f"{tile_id}: {filename.exists()}")
        time.sleep(DELAY_SECONDS)

# Save spatial index.
with open(OUT / "tile_index.csv", "w", newline="") as f:
    writer = csv.DictWriter(
        f, fieldnames=records[0].keys()
    )
    writer.writeheader()
    writer.writerows(records)

# Build a contact sheet for browsing.
valid = []
for record in records:
    path = Path(record["file"])
    if path.exists():
        try:
            im = Image.open(path).convert("RGB")
            im.thumbnail((180, 180))
            valid.append((record["tile_id"], im.copy()))
        except Exception:
            pass

columns = 6
cell_w, cell_h = 190, 205
rows = math.ceil(len(valid) / columns)

sheet = Image.new(
    "RGB",
    (columns * cell_w, rows * cell_h),
    "white"
)
draw = ImageDraw.Draw(sheet)

for i, (tile_id, im) in enumerate(valid):
    x = (i % columns) * cell_w
    y = (i // columns) * cell_h
    sheet.paste(im, (x, y))
    draw.text((x + 4, y + 182), tile_id, fill="black")

sheet.save(OUT / "athens_contact_sheet.jpg", quality=90)

print("\nFinished.")
print("Tiles:", len(valid))
print("Index:", OUT / "tile_index.csv")
print("Contact sheet:", OUT / "athens_contact_sheet.jpg")
