/* Bharat Atlas 3D — main application */
const INDIA_CENTER=[80.2,22.8];
const STATES_URL='https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson';
const DISTRICT_BASE='https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/states/';
const OSRM='https://router.project-osrm.org/route/v1/driving/';
const NOMINATIM='https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=6&q=';

const $=id=>document.getElementById(id);
let statesGeo=null, hoveredId=null, currentState=null, is3D=true;
let routeMode=false, routePts=[], routeMarkers=[], dashAnim=null;

const map=new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/liberty',
  center:INDIA_CENTER, zoom:4.35, pitch:40, bearing:-8,
  maxBounds:[[55,0],[110,42]], minZoom:3.6, maxZoom:19.5, antialias:true
});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');

const stateName=f=>f.properties.st_nm||f.properties.ST_NM||f.properties.NAME_1||f.properties.name||'Unknown';
const distName=f=>f.properties.district||f.properties.DISTRICT||f.properties.dtname||f.properties.name||'District';

function bboxOf(geom){let b=[Infinity,Infinity,-Infinity,-Infinity];const walk=c=>{if(typeof c[0]==='number'){b[0]=Math.min(b[0],c[0]);b[1]=Math.min(b[1],c[1]);b[2]=Math.max(b[2],c[0]);b[3]=Math.max(b[3],c[1]);}else c.forEach(walk);};walk(geom.coordinates);return b;}

map.on('load',async()=>{
  // ---- 3D terrain (free AWS terrarium DEM) + sky ----
  try{
    map.addSource('dem',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:13});
    map.setTerrain({source:'dem',exaggeration:1.35});
    map.setSky({'sky-color':'#a8c8d8','sky-horizon-blend':.5,'horizon-color':'#e8d8b8','horizon-fog-blend':.5,'fog-color':'#dce8e4','fog-ground-blend':.6});
  }catch(e){console.warn('terrain unavailable',e);}

  // ---- 3D buildings at street zoom ----
  try{
    const has=map.getStyle().layers.some(l=>l.type==='fill-extrusion');
    if(!has) map.addLayer({id:'bldg-3d',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:14.5,paint:{
      'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],8],0,'#cfc8b8',60,'#a89a78',200,'#7d6f50'],
      'fill-extrusion-height':['coalesce',['get','render_height'],8],
      'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
      'fill-extrusion-opacity':.88}});
  }catch(e){console.warn('buildings layer',e);}

  // ---- Load India states ----
  statesGeo=await fetch(STATES_URL).then(r=>r.json());
  statesGeo.features.forEach((f,i)=>f.id=i);

  // Ocean mask: hide everything outside India in deep ocean tone
  const holes=[];statesGeo.features.forEach(f=>{const g=f.geometry;if(g.type==='Polygon')holes.push(g.coordinates[0]);else g.coordinates.forEach(p=>holes.push(p[0]));});
  map.addSource('mask',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...holes]}}});
  map.addLayer({id:'mask',type:'fill',source:'mask',paint:{'fill-color':'#0a1c26','fill-opacity':['interpolate',['linear'],['zoom'],4,.94,7,.6,10,0]}});

  map.addSource('states',{type:'geojson',data:statesGeo});
  map.addLayer({id:'state-fill',type:'fill',source:'states',paint:{
    'fill-color':['to-color',['at',['%',['id'],STATE_PALETTE.length],['literal',STATE_PALETTE]]],
    'fill-opacity':['case',['boolean',['feature-state','hover'],false],.78,['interpolate',['linear'],['zoom'],4,.55,7.5,.12,9,0]]}});
  map.addLayer({id:'state-line',type:'line',source:'states',paint:{'line-color':'#e8dcc8','line-width':['case',['boolean',['feature-state','hover'],false],2.6,1.1],'line-opacity':.85}});
  map.addLayer({id:'state-glow',type:'line',source:'states',paint:{'line-color':'#d4a957','line-width':6,'line-blur':6,'line-opacity':['case',['boolean',['feature-state','hover'],false],.9,0]}});

  // Hover
  const tip=$('tooltip');
  map.on('mousemove','state-fill',e=>{
    map.getCanvas().style.cursor='pointer';
    const f=e.features[0];
    if(hoveredId!==null)map.setFeatureState({source:'states',id:hoveredId},{hover:false});
    hoveredId=f.id;map.setFeatureState({source:'states',id:hoveredId},{hover:true});
    const d=INDIA_STATES[stateName(f)]||{};
    tip.innerHTML=`${stateName(f)}<small>${d.capital?('Capital: '+d.capital+' · '+d.districts+' districts'):'Click to explore'}</small>`;
    tip.style.left=e.point.x+'px';tip.style.top=e.point.y+'px';tip.classList.remove('hidden');
  });
  map.on('mouseleave','state-fill',()=>{map.getCanvas().style.cursor='';if(hoveredId!==null)map.setFeatureState({source:'states',id:hoveredId},{hover:false});hoveredId=null;tip.classList.add('hidden');});
  map.on('click','state-fill',e=>{if(!routeMode)enterState(e.features[0]);});

  animateCounters();
  $('loader').classList.add('done');
});

// ---- State drill-down ----
async function enterState(f){
  const name=stateName(f);currentState=name;
  const b=bboxOf(f.geometry);
  map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:80,bottom:60,left:360,right:80},pitch:is3D?55:0,bearing:-12,duration:2200,essential:true});
  const d=INDIA_STATES[name]||{};
  $('panel-title').textContent=name;
  $('panel-sub').textContent=(d.capital?('Capital: '+d.capital+' · '+d.area):'State of India');
  $('panel-body').innerHTML=`<p class="tagline">${d.tag||'Explore the terrain, cities and districts in 3D.'}</p>
    <div class="factgrid"><div class="fact"><b>${d.districts??'–'}</b><span>Districts</span></div><div class="fact"><b>${d.area?d.area.split(' ')[0]:'–'}</b><span>km² area</span></div></div>
    <div class="section-label">Districts</div><ul id="dlist" class="district-list"><li>Loading districts…</li></ul>`;
  loadDistricts(name);
}

async function loadDistricts(name){
  const slugs=[name.toLowerCase().replace(/&/g,'and').replace(/[^a-z]+/g,'-').replace(/^-|-$/g,''),name.toLowerCase().replace(/[^a-z]/g,'')];
  let geo=null;
  for(const s of slugs){try{const r=await fetch(DISTRICT_BASE+s+'.geojson');if(r.ok){geo=await r.json();break;}}catch(e){}}
  const list=$('dlist');if(!list)return;
  if(!geo){list.innerHTML='<li>District boundaries unavailable — keep zooming for 3D streets.</li>';return;}
  geo.features.forEach((f,i)=>f.id=i);
  if(map.getSource('districts'))map.getSource('districts').setData(geo);
  else{
    map.addSource('districts',{type:'geojson',data:geo});
    map.addLayer({id:'dist-fill',type:'fill',source:'districts',paint:{'fill-color':'#d4a957','fill-opacity':['case',['boolean',['feature-state','hover'],false],.32,.04]}});
    map.addLayer({id:'dist-line',type:'line',source:'districts',paint:{'line-color':'#d4a957','line-width':1,'line-dasharray':[2,2],'line-opacity':.8}});
    let dh=null;
    map.on('mousemove','dist-fill',e=>{if(dh!==null)map.setFeatureState({source:'districts',id:dh},{hover:false});dh=e.features[0].id;map.setFeatureState({source:'districts',id:dh},{hover:true});});
    map.on('mouseleave','dist-fill',()=>{if(dh!==null)map.setFeatureState({source:'districts',id:dh},{hover:false});dh=null;});
    map.on('click','dist-fill',e=>{if(routeMode)return;const b=bboxOf(e.features[0].geometry);map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:60,pitch:60,bearing:-20,duration:2000});});
  }
  list.innerHTML='';
  geo.features.map(f=>({n:distName(f),f})).sort((a,b)=>a.n.localeCompare(b.n)).forEach(({n,f})=>{
    const li=document.createElement('li');li.textContent=n;
    li.onclick=()=>{const b=bboxOf(f.geometry);map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:60,pitch:60,bearing:-20,duration:2000});};
    list.appendChild(li);
  });
}

function resetIndia(){
  currentState=null;
  if(map.getSource('districts'))map.getSource('districts').setData({type:'FeatureCollection',features:[]});
  map.flyTo({center:INDIA_CENTER,zoom:4.35,pitch:is3D?40:0,bearing:-8,duration:2400,essential:true});
  $('panel-title').textContent='India';$('panel-sub').textContent='Republic of India · Bhārat Gaṇarājya';
  $('panel-body').innerHTML=`<div class="factgrid"><div class="fact"><b data-count="28">0</b><span>States</span></div><div class="fact"><b data-count="8">0</b><span>Union Territories</span></div><div class="fact"><b data-count="785">0</b><span>Districts</span></div><div class="fact"><b data-count="22">0</b><span>Official Languages</span></div></div><p class="hint">Hover a state to preview · Click to dive in · Keep zooming for 3D buildings.</p>`;
  animateCounters();
}

// ---- Routing (OSRM, free) ----
function setRouteMode(on){
  routeMode=on;$('btn-route').classList.toggle('active',on);$('route-card').classList.toggle('hidden',!on);
  if(!on)clearRoute();else $('route-status').innerHTML='Click your <b>start point</b> on the map.';
}
function clearRoute(){
  routePts=[];routeMarkers.forEach(m=>m.remove());routeMarkers=[];
  if(dashAnim)cancelAnimationFrame(dashAnim),dashAnim=null;
  if(map.getLayer('route'))map.removeLayer('route');
  if(map.getLayer('route-casing'))map.removeLayer('route-casing');
  if(map.getSource('route'))map.removeSource('route');
  $('route-result').classList.add('hidden');$('route-status').innerHTML='Click your <b>start point</b> on the map.';
}
map.on('click',async e=>{
  if(!routeMode||routePts.length>=2)return;
  routePts.push([e.lngLat.lng,e.lngLat.lat]);
  const el=document.createElement('div');el.className=routePts.length===1?'marker-a':'marker-b';el.innerHTML=`<span>${routePts.length===1?'A':'B'}</span>`;
  routeMarkers.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(e.lngLat).addTo(map));
  if(routePts.length===1){$('route-status').innerHTML='Now click your <b>destination</b>.';return;}
  $('route-status').textContent='Calculating best route…';
  try{
    const r=await fetch(`${OSRM}${routePts[0].join(',')};${routePts[1].join(',')}?overview=full&geometries=geojson`).then(x=>x.json());
    const rt=r.routes[0];
    map.addSource('route',{type:'geojson',lineMetrics:true,data:{type:'Feature',geometry:rt.geometry}});
    map.addLayer({id:'route-casing',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#0b1418','line-width':9,'line-opacity':.55}});
    map.addLayer({id:'route',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':5,'line-gradient':['interpolate',['linear'],['line-progress'],0,'#1f8a70',.5,'#d4a957',1,'#c96f4a']}});
    const km=(rt.distance/1000).toFixed(1),h=Math.floor(rt.duration/3600),m=Math.round(rt.duration%3600/60);
    $('route-km').textContent=km+' km';$('route-time').textContent=(h?h+'h ':'')+m+'m';
    $('route-result').classList.remove('hidden');$('route-status').textContent='Fastest road route:';
    const b=bboxOf(rt.geometry);map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:90,pitch:45,duration:2200});
  }catch(err){$('route-status').textContent='Routing failed — try points nearer to roads.';}
});

// ---- Search (Nominatim, India only) ----
$('search').addEventListener('keydown',async e=>{
  if(e.key!=='Enter')return;const q=e.target.value.trim();if(!q)return;
  const res=await fetch(NOMINATIM+encodeURIComponent(q),{headers:{'Accept-Language':'en'}}).then(r=>r.json()).catch(()=>[]);
  const ul=$('search-results');ul.innerHTML='';
  res.forEach(p=>{const li=document.createElement('li');li.textContent=p.display_name;
    li.onclick=()=>{ul.innerHTML='';$('search').value=p.display_name.split(',')[0];
      map.flyTo({center:[+p.lon,+p.lat],zoom:p.type==='state'?7:13.5,pitch:55,bearing:-15,duration:2600,essential:true});};
    ul.appendChild(li);});
  if(!res.length)ul.innerHTML='<li>No results found in India.</li>';
});

// ---- UI wiring ----
$('btn-reset').onclick=resetIndia;
$('panel-close').onclick=resetIndia;
$('btn-route').onclick=()=>setRouteMode(!routeMode);
$('route-clear').onclick=clearRoute;
$('btn-3d').onclick=()=>{is3D=!is3D;$('btn-3d').classList.toggle('active',is3D);map.easeTo({pitch:is3D?55:0,duration:1200});};

function animateCounters(){
  document.querySelectorAll('[data-count]').forEach(el=>{
    const target=+el.dataset.count,t0=performance.now();
    const step=t=>{const p=Math.min((t-t0)/1400,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(target*e);if(p<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  });
}
