// Bharat Atlas 3D — optional backend
// Serves the frontend + proxies routing/search with simple in-memory caching, plus an India stats API.
const express=require('express');
const path=require('path');
const app=express();
const PORT=process.env.PORT||3000;
const cache=new Map();
const TTL=10*60*1000;

async function cachedFetch(url){
  const hit=cache.get(url);
  if(hit&&Date.now()-hit.t<TTL)return hit.d;
  const r=await fetch(url,{headers:{'User-Agent':'BharatAtlas3D/1.0'}});
  const d=await r.json();
  cache.set(url,{d,t:Date.now()});
  return d;
}

app.use(express.static(path.join(__dirname,'..','frontend')));

app.get('/api/stats',(_req,res)=>res.json({
  country:'India',states:28,unionTerritories:8,districts:785,
  officialLanguages:22,area_km2:3287263,coastline_km:7516,
  highestPoint:'Kanchenjunga (8,586 m)',longestRiver:'Ganga (2,525 km)'
}));

app.get('/api/route',async(req,res)=>{
  const{from,to}=req.query;
  if(!from||!to)return res.status(400).json({error:'from & to required as lng,lat'});
  try{res.json(await cachedFetch(`https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`));}
  catch(e){res.status(502).json({error:'routing upstream failed'});}
});

app.get('/api/search',async(req,res)=>{
  const q=(req.query.q||'').trim();
  if(!q)return res.status(400).json({error:'q required'});
  try{res.json(await cachedFetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=6&q=${encodeURIComponent(q)}`));}
  catch(e){res.status(502).json({error:'search upstream failed'});}
});

app.listen(PORT,()=>console.log(`Bharat Atlas 3D running → http://localhost:${PORT}`));
