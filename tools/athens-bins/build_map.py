"""Build a self-contained Leaflet map (map.html) from athens_bins/bins.geojson.  Usage: python build_map.py"""
import json
from pathlib import Path

data = Path("athens_bins/bins.geojson").read_text(encoding="utf-8")
html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Athens bins</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css">
<style>
html,body,#map{height:100%;margin:0} body{font-family:system-ui,sans-serif}
.panel{position:absolute;z-index:1000;top:10px;right:10px;background:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.3);font-size:13px}
.panel label{display:block;margin:3px 0;cursor:pointer} .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
</style></head><body><div id="map"></div><div class="panel" id="panel"><b>Athens bins (OpenStreetMap)</b><div id="rows"></div><div id="total" style="margin-top:6px;color:#555"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js"></script>
<script>
const DATA = __DATA__;
const KINDS = {waste_basket:['#e67e22','Waste basket'], recycling:['#27ae60','Recycling point'], waste_disposal:['#7f8c8d','Waste disposal']};
const map = L.map('map').setView([37.985, 23.735], 14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap contributors (ODbL)'}).addTo(map);
const groups = {}, counts = {};
for (const k in KINDS) { groups[k] = L.markerClusterGroup({maxClusterRadius:45}).addTo(map); counts[k] = 0; }
for (const f of DATA.features) {
  const k = f.properties.kind, [lon, lat] = f.geometry.coordinates;
  const p = f.properties, tags = JSON.parse(p.tags || '{}');
  const m = L.circleMarker([lat, lon], {radius:6, color:'#fff', weight:1, fillColor:(KINDS[k]||KINDS.waste_disposal)[0], fillOpacity:.95});
  m.bindPopup('<b>'+(KINDS[k]||['','Waste'])[1]+'</b><br>OSM node <a target="_blank" href="https://www.openstreetmap.org/node/'+p.osm_id+'">'+p.osm_id+'</a><br>'
    + lat.toFixed(6)+', '+lon.toFixed(6)+'<br><small>'+Object.entries(tags).map(([a,b])=>a+'='+b).join('<br>')+'</small>');
  (groups[k]||groups.waste_disposal).addLayer(m); counts[k] = (counts[k]||0)+1;
}
const rows = document.getElementById('rows');
for (const k in KINDS) {
  const l = document.createElement('label');
  l.innerHTML = '<input type="checkbox" checked><span class="dot" style="background:'+KINDS[k][0]+'"></span>'+KINDS[k][1]+' ('+counts[k]+')';
  l.firstChild.onchange = e => e.target.checked ? map.addLayer(groups[k]) : map.removeLayer(groups[k]);
  rows.appendChild(l);
}
document.getElementById('total').textContent = DATA.features.length + ' bins';
</script></body></html>
""".replace("__DATA__", data.replace("</", "<\\/"))
Path("map.html").write_text(html, encoding="utf-8")
print("wrote map.html", len(html) // 1024, "KB,", len(json.loads(data)["features"]), "bins")
