# Implementation Plan – Bharat Atlas 3D

## Vision
A map of India that feels better than a generic world map: India-only focus, premium visual identity, cinematic camera, real 3D terrain and buildings, and instant answers (facts, routes, distances).

## Architecture
```
Browser (frontend/)
 ├─ MapLibre GL JS v4  → WebGL rendering, camera animations
 ├─ OpenFreeMap tiles  → vector basemap + 3D building footprints
 ├─ AWS terrarium DEM  → setTerrain() 3D elevation + sky
 ├─ GeoJSON layers     → India states (hover/click), per-state districts, world mask
 ├─ OSRM API           → routing (distance/duration, geometry)
 └─ Nominatim API      → India-restricted place search
server/ (optional Express)
 ├─ /api/route, /api/search → proxies with caching headers
 └─ /api/stats              → India key figures JSON
```

## Design system
- **Palette**: ink `#0b1418`, ocean `#0a1c26`, emerald `#1f8a70`, forest `#2e6b4f`, gold `#d4a957`, sand `#e8dcc8`, terracotta `#c96f4a`. No purple, no plastic gradients.
- **Type**: Marcellus (display) + Manrope (UI).
- **Motion**: 1.6–2.4s easeOutCubic fly-to; 200ms hover transitions; animated dash on routes; counter tick-up on load.

## Phases
1. ✅ Map shell: India-locked camera, ocean mask, terrain, sky, 3D buildings.
2. ✅ States layer: hover glow, tooltips, click → fly-in + facts panel.
3. ✅ Districts: lazy-load per state, hover + click zoom.
4. ✅ Routing + search + stats UI.
5. ⏭ Next: per-district data (population/HQ), forest-cover overlay (green zones), rivers emphasis, city landmarks, offline tile caching, dark/day toggle.
