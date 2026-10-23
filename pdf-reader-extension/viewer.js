const { pdfjsLib } = globalThis;
// Worker: local in extension, CDN fallback when opened as a plain file
const inExt = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL);
pdfjsLib.GlobalWorkerOptions.workerSrc = inExt
  ? chrome.runtime.getURL("lib/pdf.worker.min.js")
  : "lib/pdf.worker.min.js";

// ---- State ----
let pdfDoc = null, scale = 1.0, baseFitScale = null;
const pageEls = {};
let textCache = {}, currentPage = 1;
let originalBytes = null, placedSigs = [];

const el = id => document.getElementById(id);
const viewer = el("viewer"), pagesEl = el("pages"), emptyEl = el("empty"), loadbar = el("loadbar");

// ================= THEME TOGGLE =================
const THEMES = [
  { id:"sprout",    name:"Sprout" },
  { id:"parchment", name:"Parchment" },
];
function applyTheme(id){
  const t = THEMES.find(x=>x.id===id) || THEMES[0];
  document.documentElement.setAttribute("data-theme", t.id);
  el("themeName").textContent = t.name;
  try{ localStorage.setItem("pdfreader-theme", t.id); }catch(_){}
}
el("themeBtn").onclick = ()=>{
  const cur = document.documentElement.getAttribute("data-theme") || "sprout";
  const idx = THEMES.findIndex(x=>x.id===cur);
  applyTheme(THEMES[(idx+1)%THEMES.length].id);
};
applyTheme((()=>{ try{ return localStorage.getItem("pdfreader-theme"); }catch(_){ return "sprout"; } })() || "sprout");

// ================= FILE OPENING =================
el("openBtn").onclick = ()=> el("fileInput").click();
el("fileInput").onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); };

["dragenter","dragover"].forEach(ev => viewer.addEventListener(ev, e => { e.preventDefault(); emptyEl.classList.add("drag"); }));
["dragleave","drop"].forEach(ev => viewer.addEventListener(ev, e => { e.preventDefault(); if (ev!=="drop") emptyEl.classList.remove("drag"); }));
viewer.addEventListener("drop", e => {
  emptyEl.classList.remove("drag");
  const f = e.dataTransfer.files[0];
  if (f && f.type === "application/pdf") loadFile(f);
});

function progress(p){ loadbar.style.width = (p*100)+"%"; if(p>=1) setTimeout(()=>loadbar.style.width="0",400); }

async function loadArrayBuffer(buf, name){
  originalBytes = buf.slice(0);
  placedSigs = [];
  el("saveBtn").style.display = "none";
  const task = pdfjsLib.getDocument({ data: buf });
  task.onProgress = ({loaded,total}) => { if(total) progress(0.3 + 0.5*(loaded/total)); };
  pdfDoc = await task.promise;
  textCache = {};
  el("docTitle").textContent = name || "document.pdf";
  el("pageCount").textContent = pdfDoc.numPages;
  emptyEl.style.display = "none";
  pagesEl.style.display = "flex";
  baseFitScale = null;
  await buildPages();
  buildThumbnails();
  buildOutline();
  el("searchResults").innerHTML = '<div class="hint">Type and press Enter to search all pages.</div>';
  progress(1);
}
async function loadFile(file){ progress(0.1); const buf = await file.arrayBuffer(); progress(0.3); await loadArrayBuffer(buf, file.name); }

// Auto-open a ?file= URL (extension redirect target)
async function autoOpenFromQuery(){
  const marker = "?file=";
  const i = location.href.indexOf(marker);
  if (i === -1) return;
  let target = location.href.substring(i + marker.length);
  try { target = decodeURIComponent(target); } catch(_){}
  if (!target) return;
  try{
    progress(0.15);
    const resp = await fetch(target);
    progress(0.3);
    const buf = await resp.arrayBuffer();
    const name = target.split("/").pop().split("?")[0] || "document.pdf";
    await loadArrayBuffer(buf, name);
  }catch(err){
    emptyEl.querySelector("h2").textContent = "Couldn't load that PDF";
    emptyEl.querySelector(".lock").textContent = "🔒 " + (err.message || "Network error");
  }
}
autoOpenFromQuery();

// ================= RENDERING =================
async function computeFit(){
  const page = await pdfDoc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const avail = viewer.clientWidth - 64;
  baseFitScale = Math.max(0.2, avail / vp.width);
}
function effScale(){ return (baseFitScale || 1) * scale; }
function zlabel(){ el("zoomLabel").textContent = Math.round(scale*100)+"%"; }

async function buildPages(){
  pagesEl.innerHTML = "";
  for (const k in pageEls) delete pageEls[k];
  if (baseFitScale === null) await computeFit();
  for (let n = 1; n <= pdfDoc.numPages; n++){
    const page = await pdfDoc.getPage(n);
    const vp = page.getViewport({ scale: effScale() });
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.style.width = vp.width + "px"; wrap.style.height = vp.height + "px";
    wrap.dataset.page = n;
    pagesEl.appendChild(wrap);
    pageEls[n] = { wrap, rendered:false, renderScale:null };
  }
  observePages(); zlabel();
}

let io;
function observePages(){
  if (io) io.disconnect();
  io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const n = +en.target.dataset.page;
      if (en.isIntersecting){ renderPage(n); currentPage = n; el("pageInput").value = n; markThumb(n); }
    });
  }, { root: viewer, rootMargin: "300px 0px" });
  Object.values(pageEls).forEach(p => io.observe(p.wrap));
}

async function renderPage(n){
  const slot = pageEls[n];
  if (!slot || (slot.rendered && slot.renderScale === effScale())) return;
  const page = await pdfDoc.getPage(n);
  const dpr = window.devicePixelRatio || 1;
  const vp = page.getViewport({ scale: effScale() });
  slot.wrap.style.width = vp.width + "px"; slot.wrap.style.height = vp.height + "px";
  // keep any placed signatures, only clear rendered canvas/text
  slot.wrap.querySelectorAll("canvas,.textLayer").forEach(e=>e.remove());

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = vp.width + "px"; canvas.style.height = vp.height + "px";
  slot.wrap.insertBefore(canvas, slot.wrap.firstChild);
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  const textContent = await page.getTextContent();
  const tl = document.createElement("div");
  tl.className = "textLayer"; tl.style.width = vp.width + "px"; tl.style.height = vp.height + "px";
  slot.wrap.insertBefore(tl, canvas.nextSibling);
  pdfjsLib.renderTextLayer({ textContent, container: tl, viewport: vp, textDivs: [] });
  slot.rendered = true; slot.renderScale = effScale();
}

// ================= ZOOM =================
function setScale(s){ scale = Math.min(4, Math.max(0.25, s)); Object.values(pageEls).forEach(p => p.rendered=false); resizeWraps(); }
async function resizeWraps(){
  for (let n=1;n<=pdfDoc.numPages;n++){
    const page = await pdfDoc.getPage(n);
    const vp = page.getViewport({ scale: effScale() });
    pageEls[n].wrap.style.width = vp.width+"px"; pageEls[n].wrap.style.height = vp.height+"px";
  }
  zlabel();
  Object.keys(pageEls).forEach(n=>{
    const r = pageEls[n].wrap.getBoundingClientRect();
    if (r.bottom>0 && r.top<window.innerHeight+400) renderPage(+n);
  });
}
el("zoomIn").onclick = ()=>{ setScale(scale+0.15); };
el("zoomOut").onclick = ()=>{ setScale(scale-0.15); };
el("fitWidth").onclick = async ()=>{ await computeFit(); scale=1; await resizeWraps(); };
viewer.addEventListener("wheel", e=>{ if (e.ctrlKey || e.metaKey){ e.preventDefault(); setScale(scale + (e.deltaY<0?0.1:-0.1)); } }, { passive:false });

el("pageInput").addEventListener("change", e=>{ const n = parseInt(e.target.value,10); if (n>=1 && n<=pdfDoc.numPages) gotoPage(n); });
function gotoPage(n){ const slot = pageEls[n]; if (slot) slot.wrap.scrollIntoView({ behavior:"smooth", block:"start" }); }

// ================= SIDEBAR =================
el("toggleSidebar").onclick = ()=> el("sidebar").classList.toggle("collapsed");
document.querySelectorAll(".tab").forEach(t=>{
  t.onclick = ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".pane").forEach(x=>x.classList.remove("active"));
    t.classList.add("active"); el("pane-"+t.dataset.pane).classList.add("active");
  };
});

async function buildThumbnails(){
  const pane = el("pane-thumbs"); pane.innerHTML = "";
  for (let n=1;n<=pdfDoc.numPages;n++){
    const div = document.createElement("div");
    div.className = "thumb"; div.dataset.page = n;
    div.innerHTML = `<canvas></canvas><div class="lbl">${n}</div>`;
    div.onclick = ()=> gotoPage(n);
    pane.appendChild(div);
  }
  const tio = new IntersectionObserver(async (entries)=>{
    for (const en of entries){
      if (!en.isIntersecting) continue;
      tio.unobserve(en.target);
      const n = +en.target.dataset.page;
      const page = await pdfDoc.getPage(n);
      const vp = page.getViewport({ scale: 0.3 });
      const c = en.target.querySelector("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext:c.getContext("2d"), viewport:vp }).promise;
    }
  }, { root: pane, rootMargin:"200px" });
  pane.querySelectorAll(".thumb").forEach(t=>tio.observe(t));
}
function markThumb(n){
  document.querySelectorAll(".thumb").forEach(t=>t.classList.toggle("active", +t.dataset.page===n));
  const active = document.querySelector(".thumb.active"); if (active) active.scrollIntoView({ block:"nearest" });
}

async function buildOutline(){
  const pane = el("pane-outline");
  const outline = await pdfDoc.getOutline();
  if (!outline || !outline.length){ pane.innerHTML = '<div class="hint">No outline available.</div>'; return; }
  pane.innerHTML = "";
  const render = (items, depth)=>{
    items.forEach(it=>{
      const d = document.createElement("div");
      d.className = "outline-item"; d.style.paddingLeft = (8 + depth*14) + "px"; d.textContent = it.title;
      d.onclick = async ()=>{
        try{ let dest = it.dest; if (typeof dest === "string") dest = await pdfDoc.getDestination(dest);
          const idx = await pdfDoc.getPageIndex(dest[0]); gotoPage(idx+1); }catch(_){}
      };
      pane.appendChild(d);
      if (it.items && it.items.length) render(it.items, depth+1);
    });
  };
  render(outline, 0);
}

// ================= SEARCH =================
async function getPageText(n){
  if (textCache[n] != null) return textCache[n];
  const page = await pdfDoc.getPage(n);
  const tc = await page.getTextContent();
  return (textCache[n] = tc.items.map(i=>i.str).join(" "));
}
el("searchInput").addEventListener("keydown", e=>{ if(e.key==="Enter") runSearch(); });
async function runSearch(){
  const q = el("searchInput").value.trim(); const out = el("searchResults");
  if (!pdfDoc){ out.innerHTML='<div class="hint">Open a PDF first.</div>'; return; }
  if (!q){ out.innerHTML='<div class="hint">Type and press Enter to search all pages.</div>'; return; }
  out.innerHTML = '<div class="hint">Searching…</div>';
  const ql = q.toLowerCase(); const results = [];
  for (let n=1;n<=pdfDoc.numPages;n++){
    const text = await getPageText(n); const tl = text.toLowerCase();
    let idx = tl.indexOf(ql), count=0, firstSnip=null;
    while (idx !== -1){
      count++;
      if (!firstSnip){
        const s = Math.max(0, idx-30), e = Math.min(text.length, idx+q.length+40);
        firstSnip = text.slice(s,e).replace(new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>");
      }
      idx = tl.indexOf(ql, idx+ql.length);
    }
    if (count) results.push({n, count, snip:firstSnip});
  }
  if (!results.length){ out.innerHTML = `<div class="hint">No matches for “${q}”.</div>`; return; }
  out.innerHTML = `<div class="hint">${results.reduce((a,r)=>a+r.count,0)} match(es) on ${results.length} page(s)</div>`;
  results.forEach(r=>{
    const d = document.createElement("div"); d.className = "result";
    d.innerHTML = `<span class="pg">p.${r.n}</span><span class="snip">…${r.snip}…</span>`;
    d.onclick = ()=> gotoPage(r.n); out.appendChild(d);
  });
}

// ================= SIGNATURE =================
const sigModal = el("sigModal");
let sigTab = "draw", typeFont = "Sig Script";
const famCSS = n => `"${n}", cursive`;
// preload bundled signature fonts so the canvas can render them
["Sig Script","Sig Elegant","Sig Casual","Sig Classic"].forEach(n=>{ try{ document.fonts.load(`64px "${n}"`); }catch(_){} });
el("signBtn").onclick = ()=>{ if (!pdfDoc){ alert("Open a PDF first."); return; } sigModal.classList.add("show"); setupSigPad(); };
el("sigCancel").onclick = ()=> sigModal.classList.remove("show");
sigModal.addEventListener("click", e=>{ if(e.target===sigModal) sigModal.classList.remove("show"); });
document.querySelectorAll("[data-sigtab]").forEach(t=>{
  t.onclick = ()=>{
    sigTab = t.dataset.sigtab;
    document.querySelectorAll("[data-sigtab]").forEach(x=>x.classList.toggle("active", x===t));
    el("sigtab-draw").style.display = sigTab==="draw" ? "block":"none";
    el("sigtab-type").style.display = sigTab==="type" ? "block":"none";
  };
});
el("typeFonts").querySelectorAll(".ff").forEach(f=>{
  f.onclick = ()=>{ typeFont = f.dataset.font;
    el("typeFonts").querySelectorAll(".ff").forEach(x=>x.classList.toggle("active", x===f));
    el("sigType").style.fontFamily = famCSS(typeFont); };
});
el("sigType").style.fontFamily = famCSS(typeFont);
let sigCtx, drawing=false, hasInk=false;
function setupSigPad(){
  const c = el("sigPad"); const r = c.getBoundingClientRect();
  c.width = r.width; c.height = r.height;
  sigCtx = c.getContext("2d"); sigCtx.clearRect(0,0,c.width,c.height);
  sigCtx.lineWidth=2.5; sigCtx.lineCap="round"; sigCtx.lineJoin="round"; sigCtx.strokeStyle="#10131a"; hasInk=false;
}
function padPos(e){ const r=el("sigPad").getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:t.clientX-r.left, y:t.clientY-r.top}; }
el("sigPad").addEventListener("pointerdown", e=>{ drawing=true; const p=padPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); e.preventDefault(); });
el("sigPad").addEventListener("pointermove", e=>{ if(!drawing)return; const p=padPos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); hasInk=true; e.preventDefault(); });
["pointerup","pointerleave"].forEach(ev=> el("sigPad").addEventListener(ev, ()=> drawing=false));
el("sigClear").onclick = ()=> setupSigPad();

async function makeSignaturePNG(){
  if (sigTab==="draw"){ if(!hasInk) return null; return trimCanvas(el("sigPad")); }
  const txt = el("sigType").value.trim(); if(!txt) return null;
  const fam = `"${typeFont}"`, fs=84, pad=28;
  try{ await document.fonts.load(`${fs}px ${fam}`); }catch(_){}
  const c = document.createElement("canvas");
  const m=c.getContext("2d"); m.font=`${fs}px ${fam}`;
  c.width = Math.ceil(m.measureText(txt).width)+pad*2; c.height = Math.round(fs*1.9);
  const ctx=c.getContext("2d"); ctx.font=`${fs}px ${fam}`; ctx.fillStyle="#10131a"; ctx.textBaseline="middle";
  ctx.fillText(txt, pad, c.height/2); return c.toDataURL("image/png");
}
function trimCanvas(src){
  const ctx=src.getContext("2d"); const {width:w,height:h}=src;
  const d=ctx.getImageData(0,0,w,h).data; let top=h,left=w,right=0,bottom=0,found=false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>10){found=true; if(x<left)left=x; if(x>right)right=x; if(y<top)top=y; if(y>bottom)bottom=y;} }
  if(!found) return null;
  const pad=8; left=Math.max(0,left-pad); top=Math.max(0,top-pad); right=Math.min(w,right+pad); bottom=Math.min(h,bottom+pad);
  const tw=right-left, th=bottom-top; const o=document.createElement("canvas"); o.width=tw; o.height=th;
  o.getContext("2d").drawImage(src,left,top,tw,th,0,0,tw,th); return o.toDataURL("image/png");
}
el("sigAdd").onclick = async ()=>{
  const png = await makeSignaturePNG();
  if(!png){ alert("Draw or type a signature first."); return; }
  sigModal.classList.remove("show"); placeSignature(png, currentPage);
};
function placeSignature(dataURL, pageNum){
  const slot = pageEls[pageNum]; if(!slot) return;
  const img = new Image();
  img.onload = ()=>{
    const wrapW = slot.wrap.clientWidth;
    let w = Math.min(220, wrapW*0.4), h = w * (img.height/img.width);
    const ov = document.createElement("div");
    ov.className="sig-overlay"; ov.style.width=w+"px"; ov.style.height=h+"px";
    ov.style.left=(wrapW*0.3)+"px"; ov.style.top=(slot.wrap.clientHeight*0.4)+"px";
    ov.innerHTML = `<img src="${dataURL}"><div class="del">×</div><div class="resize"></div>`;
    ov.dataset.src = dataURL;
    slot.wrap.appendChild(ov);
    const rec = { pageNum, el:ov }; placedSigs.push(rec);
    el("saveBtn").style.display="inline-flex";
    makeDraggable(ov, slot.wrap);
    ov.querySelector(".del").onclick = (e)=>{ e.stopPropagation(); ov.remove(); placedSigs=placedSigs.filter(s=>s!==rec); if(!placedSigs.length) el("saveBtn").style.display="none"; };
  };
  img.src = dataURL;
}
function makeDraggable(ov, wrap){
  let mode=null, sx,sy, ox,oy, ow,oh;
  ov.addEventListener("pointerdown", e=>{
    if(e.target.classList.contains("del")) return;
    mode = e.target.classList.contains("resize") ? "resize":"move";
    sx=e.clientX; sy=e.clientY; ox=parseFloat(ov.style.left); oy=parseFloat(ov.style.top);
    ow=ov.clientWidth; oh=ov.clientHeight; ov.setPointerCapture(e.pointerId); e.preventDefault();
  });
  ov.addEventListener("pointermove", e=>{
    if(!mode) return; const dx=e.clientX-sx, dy=e.clientY-sy;
    if(mode==="move"){
      ov.style.left = Math.max(0, Math.min(wrap.clientWidth-ov.clientWidth, ox+dx))+"px";
      ov.style.top  = Math.max(0, Math.min(wrap.clientHeight-ov.clientHeight, oy+dy))+"px";
    } else { const ratio = oh/ow; let nw = Math.max(40, ow+dx); ov.style.width=nw+"px"; ov.style.height=(nw*ratio)+"px"; }
  });
  ov.addEventListener("pointerup", ()=> mode=null);
}
el("saveBtn").onclick = async ()=>{
  if(!originalBytes || !placedSigs.length) return;
  progress(0.2);
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.load(originalBytes);
  const pages = doc.getPages();
  for (const sig of placedSigs){
    const wrap = pageEls[sig.pageNum].wrap;
    const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
    const page = pages[sig.pageNum-1]; const { width:pw, height:ph } = page.getSize();
    const sxr = pw/wrapW, syr = ph/wrapH;
    const left = parseFloat(sig.el.style.left), top = parseFloat(sig.el.style.top);
    const w = sig.el.clientWidth, h = sig.el.clientHeight;
    const pngBytes = await (await fetch(sig.el.dataset.src)).arrayBuffer();
    const png = await doc.embedPng(pngBytes);
    page.drawImage(png, { x:left*sxr, y:ph-(top+h)*syr, width:w*sxr, height:h*syr });
  }
  progress(0.7);
  const out = await doc.save();
  const blob = new Blob([out], {type:"application/pdf"});
  const a = document.createElement("a");
  const base = (el("docTitle").textContent||"document").replace(/\.pdf$/i,"");
  a.href = URL.createObjectURL(blob); a.download = base + "-signed.pdf"; a.click();
  URL.revokeObjectURL(a.href); progress(1);
};

// Re-fit on resize
let rT;
window.addEventListener("resize", ()=>{ if (!pdfDoc) return; clearTimeout(rT); rT = setTimeout(async ()=>{ await computeFit(); await resizeWraps(); }, 200); });
