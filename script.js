
async function getPools(){ const r = await fetch('pools.json'); return r.json(); }
function loadState(){ try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')}catch{return {}} }
function saveState(s){ try{localStorage.setItem(LS_KEY, JSON.stringify(s));}catch{} }

function renderBadges(pools){
  const state = loadState();
  const byArea = pools.reduce((acc,p)=>{(acc[p.area]=acc[p.area]||[]).push(p);return acc;},{});
  const visited = id => !!state[id]?.visited;

  const defs = [
    {id:'harbour', label:'Harbour Complete', img:'badges/harbour-complete.png', unlocked: (byArea['Harbour']||[]).every(p=>visited(p.id)) && (byArea['Harbour']||[]).length>0},
    {id:'middle', label:'Middle Harbour Complete', img:'badges/middle-harbour-complete.png', unlocked: (byArea['Middle Harbour']||[]).every(p=>visited(p.id)) && (byArea['Middle Harbour']||[]).length>0},
    {id:'all', label:'All Pools Complete', img:'badges/all-complete.png', unlocked: pools.every(p=>visited(p.id)) && pools.length>0},
  ];

  const wrap = document.getElementById('badges');
  wrap.innerHTML = '';
  defs.forEach(b => {
    const d = document.createElement('div');
    d.className = 'badge' + (b.unlocked ? '' : ' locked');
    d.innerHTML = `<img src="${b.img}" alt="${b.label}"><div class="label">${b.label}</div>`;
    wrap.appendChild(d);
  });

  const allUnlocked = defs.find(b=>b.id==='all').unlocked;
  const cardBtn = document.getElementById('makeCardBtn');
  if (cardBtn) cardBtn.disabled = !allUnlocked;
}

function renderGrid(pools){
  const state = loadState();
  const grid = document.getElementById('grid');
  const tpl = document.getElementById('cardTpl');
  grid.innerHTML = '';

  const q = (document.getElementById('searchBox').value || '').toLowerCase();
  const type = document.getElementById('typeFilter').value || '';
  const area = document.getElementById('areaFilter').value || '';

  const filtered = pools.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q);
    const matchT = !type || p.type === type;
    const matchA = !area || p.area === area;
    return matchQ && matchT && matchA;
  });

  filtered.forEach(p => {
    const st = state[p.id] || {};
    const node = tpl.content.cloneNode(true);
    node.querySelector('.name').textContent = p.name;
    node.querySelector('.pill-type').textContent = p.type;
    node.querySelector('.suburb').textContent = p.suburb;
    node.querySelector('.notes').textContent = p.notes || '';
    node.querySelector('.area').textContent = p.area;
    const img = node.querySelector('.thumb');
    img.src = `images/${p.img}`;
    img.alt = p.name;
    img.addEventListener('click', () => openLightbox(img.src));

    const box = node.querySelector('.visitBox');
    const date = node.querySelector('.visitDate');
    const rating = node.querySelector('.rating');
    const notes = node.querySelector('.userNotes');
    const cafe = node.querySelector('.cafeNotes');
    const mapJumpBtn = node.querySelector('.map-jump');

    box.checked = !!st.visited;
    date.value = st.date || '';
    rating.value = st.rating || '';
    notes.value = st.notes || '';
    cafe.value = st.cafe || '';

    const save = () => {
      const cur = loadState();
      cur[p.id] = { visited: box.checked, date: date.value||'', rating: rating.value||'', notes: notes.value||'', cafe: cafe.value||'' };
      saveState(cur);
      updateProgress(pools);
      renderBadges(pools);
      updateMapMarker(p.id, box.checked);
    };

    box.addEventListener('change', save);
    date.addEventListener('change', save);
    rating.addEventListener('change', save);
    notes.addEventListener('change', save);
    cafe.addEventListener('change', save);
    if (mapJumpBtn) mapJumpBtn.addEventListener('click', ()=> jumpToOnMap(p));
    grid.appendChild(node);
  });
}

function updateProgress(pools){
  const state = loadState();
  const total = pools.length;
  const visited = pools.filter(p => state[p.id]?.visited).length;
  const pct = total ? Math.round((visited/total)*100) : 0;
  document.getElementById('progressLabel').textContent = `${visited} / ${total} visited`;
  document.getElementById('progressBar').style.width = pct + '%';
}

function exportProgress(){ const s = loadState(); const blob = new Blob([JSON.stringify(s,null,2)], {type:'application/json'}); const a = document.getElementById('dlLink'); a.href = URL.createObjectURL(blob); a.download='harbour_pools_progress.json'; a.click(); }

function importProgress(file){
  const reader = new FileReader();
  reader.onload = () => { try{ const obj = JSON.parse(reader.result); saveState(obj); init(); }catch{ alert('Could not import JSON'); } };
  reader.readAsText(file);
}

function openLightbox(src){
  const dlg = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  img.src = src;
  dlg.showModal();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }, {once:true});
}

function makeCompletionCard(pools){
  const state = loadState();
  if (!pools.every(p => state[p.id]?.visited)) { alert('Tick all pools first!'); return; }

  const w=1200, h=630;
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#1f8f64'); g.addColorStop(1,'#f59e0b'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,0.95)'; roundRect(ctx,40,40,w-80,h-80,24); ctx.fill();
  ctx.fillStyle='#1d2a22'; ctx.font='bold 58px system-ui, sans-serif'; ctx.fillText('Harbour Pools Passport', 80, 140);
  ctx.font='28px system-ui, sans-serif'; ctx.fillText('Wanderlusters & Dabblers Society', 80, 180);
  ctx.fillText('Completed: ' + new Date().toLocaleDateString(), 80, 215);
  ctx.font='24px system-ui, sans-serif';
  let y=260; pools.forEach(p=>{ ctx.fillText('✓ ' + p.name, 80, y); y+=32; });

  Promise.all([loadImage('badges/harbour-complete.png'), loadImage('badges/middle-harbour-complete.png'), loadImage('badges/all-complete.png'), loadImage('brand/logo-256.png')]).then(([a,b,c,logo])=>{
    ctx.drawImage(a, w-80-160*3-20*2, h-80-160, 160,160);
    ctx.drawImage(b, w-80-160*2-20, h-80-160, 160,160);
    ctx.drawImage(c, w-80-160, h-80-160, 160,160);
    ctx.globalAlpha = 0.09; ctx.drawImage(logo, w-320, 40, 256,256); ctx.globalAlpha = 1;
    canvas.toBlob(blob => { const link = document.getElementById('dlLink'); link.href = URL.createObjectURL(blob); link.download='harbour_pools_completion_card.png'; link.click(); });
  });
}
function loadImage(src){ return new Promise(res=>{ const i = new Image(); i.onload=()=>res(i); i.src=src; }); }
function roundRect(ctx, x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---- Leaflet Map ----
let MAP = null;
const markers = {};

function initMap(pools){
  const card = document.getElementById('mapCard');
  card.style.display = '';
  MAP = L.map('map').setView([-33.86, 151.22], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(MAP);

  const state = loadState();

  pools.forEach(p => {
    const icon = makeIcon(state[p.id]?.visited);
    const m = L.marker([p.lat, p.lng], { icon }).addTo(MAP);
    markers[p.id] = m;
    const html = `<b>${p.name}</b><br>${p.suburb} • ${p.area}<br><em>${p.type}</em><br>
      <label style="display:inline-flex;gap:6px;align-items:center;margin-top:6px">
        <input id="chk-${p.id}" type="checkbox" ${state[p.id]?.visited ? 'checked' : ''}/> visited
      </label>`;
    m.bindPopup(html);
    m.on('popupopen', () => {
      const box = document.getElementById('chk-'+p.id);
      if (box) { box.onchange = () => toggleVisitedFromMap(pools, p.id, box.checked); }
    });
  });
}

function makeIcon(visited){
  const color = visited ? '#1f8f64' : '#f59e0b';
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='30' height='42' viewBox='0 0 30 42'><path d='M15 0c8.3 0 15 6.7 15 15 0 10-15 27-15 27S0 25 0 15C0 6.7 6.7 0 15 0z' fill='${color}'/><circle cx='15' cy='15' r='6' fill='#fff'/></svg>`);
  return L.icon({ iconUrl: 'data:image/svg+xml,'+svg, iconSize:[30,42], iconAnchor:[15,42], popupAnchor:[0,-36] });
}
function updateMapMarker(id, visited){
  if (!MAP || !markers[id]) return;
  markers[id].setIcon(makeIcon(visited));
}
function toggleVisitedFromMap(pools, id, checked){
  const state = loadState();
  state[id] = state[id] || {};
  state[id].visited = checked;
  saveState(state);
  renderGrid(pools); // re-render grid to reflect checkbox
  updateProgress(pools);
  renderBadges(pools);
  updateMapMarker(id, checked);
}

// ---- App init & wiring ----
function init(){
  fetch('pools.json').then(r=>r.json()).then(pools => { window.__POOLS = pools;
    // Filters & buttons
    ['searchBox','typeFilter','areaFilter'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => { renderGrid(pools); });
      document.getElementById(id).addEventListener('change', () => { renderGrid(pools); });
    });
    document.getElementById('exportBtn').addEventListener('click', exportProgress);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importProgress(f); });
    document.getElementById('resetBtn').addEventListener('click', () => { if (confirm('Reset all progress?')) { localStorage.removeItem(LS_KEY); renderGrid(pools); renderBadges(pools); updateProgress(pools); if (MAP) { Object.keys(markers).forEach(id=>updateMapMarker(id,false)); } } });
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('makeCardBtn').addEventListener('click', () => makeCompletionCard(pools));
    document.getElementById('openMapBtn').addEventListener('click', () => {
      if (!MAP) initMap(pools);
      const card = document.getElementById('mapCard');
      card.scrollIntoView({behavior:'smooth'});
    });

    // Initial render
    renderGrid(pools); renderBadges(pools); updateProgress(pools);
  });
}
document.addEventListener('DOMContentLoaded', init);

function jumpToOnMap(p){
  const card = document.getElementById('mapCard');
  if (!MAP) initMap([p, ...window.__POOLS]); // create with at least this pool
  MAP.setView([p.lat, p.lng], 14, {animate:true});
  const m = markers[p.id]; if (m) m.openPopup();
  card.scrollIntoView({behavior:'smooth'});
}

// Keep pools globally for helpers
window.__POOLS = window.__POOLS || [];
