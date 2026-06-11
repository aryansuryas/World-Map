# Bharat Atlas 3D 🇮🇳

A cinematic, India-only interactive 3D map. Fly across the country, click a state to dive into it, explore districts, tilt into streets and 3D buildings, and plot routes with live distance and travel time.

## ✨ Features
- **India only** – the rest of the world is masked into deep ocean; camera is locked to India's bounds.
- **True 3D** – real elevation terrain (Himalayas rise!), atmospheric sky, and extruded 3D buildings at street zoom.
- **State → District drill-down** – click any state to fly in; district boundaries load with hover highlights and facts.
- **Premium UI/UX** – glassmorphism panels, gold + emerald palette (no purple), animated counters, buttery fly-to camera moves, smooth hover glows.
- **Routing** – enable Route mode, click point A and point B anywhere in India: animated route line + distance + duration (OSRM).
- **Search** – find any Indian place via search (Nominatim, restricted to India).
- **Key stats** – 28 states, 8 union territories, 780+ districts, live per-state facts (capital, districts, area).

## 🔑 APIs & keys
None required. Everything is free and open:
| Purpose | Service |
|---|---|
| Base map tiles + 3D buildings | OpenFreeMap (liberty style) |
| Elevation / 3D terrain | AWS Open Data Terrain Tiles (terrarium) |
| State & district boundaries | india-maps-data GeoJSON (GitHub) |
| Routing | OSRM public demo server |
| Search | Nominatim (OpenStreetMap) |

## 🚀 Run it
### Frontend only (simplest)
```bash
cd frontend
python3 -m http.server 8080   # or: npx serve .
# open http://localhost:8080
```
### With backend proxy (optional, adds caching + stats API)
```bash
cd server && npm install && npm start   # http://localhost:3000 serves the app + /api/*
```

## 🗂 Structure
```
frontend/  index.html, css/style.css, js/app.js, js/data.js
server/    Express proxy + stats API (optional)
.gitlab-ci.yml  deploys frontend to GitLab Pages
```

## 🧭 How to use
1. Hover states – they glow and show a tooltip.
2. Click a state – cinematic fly-in, districts + facts panel appear.
3. Keep zooming (or click a district) – terrain and 3D buildings appear (pitch with right-drag / two fingers).
4. Press **Route**, click two points – animated route with km + time.
5. **Reset** returns to the full-India view.

See `IMPLEMENTATION_PLAN.md` for architecture and roadmap.
