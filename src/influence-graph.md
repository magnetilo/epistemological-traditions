---
theme: dashboard
toc: false
title: Influence Graph
---

# Influence Graph

<div id="graph-container">
  <div class="quadrant-bg">
    <div class="qbg-top">Universal</div>
    <div class="qbg-left">Participatory</div>
    <div class="quadrant-bg-grid">
      <div class="qbg-cell qbg-PxU"></div>
      <div class="qbg-cell qbg-AxU"></div>
      <div class="qbg-cell qbg-PxP"></div>
      <div class="qbg-cell qbg-AxP"></div>
    </div>
    <div class="qbg-right">Abstract</div>
    <div class="qbg-bottom">Particular</div>
  </div>
  <svg id="graph-svg"></svg>
</div>

```js
const edges = await FileAttachment("data/influence_edges.csv").csv({typed: true});
const traditions = await FileAttachment("data/epistemological_traditions_v2.csv").csv({typed: true});
```

<p class="section-label">Filter & Explore</p>

```js
const fieldInput = Inputs.checkbox(
  ["Science", "Philosophy", "Art", "Spirituality"],
  {label: "Field (source)", value: ["Science", "Philosophy", "Art", "Spirituality"]}
);
const fields = view(fieldInput);

const attitudeInput = Inputs.radio(
  ["all", "I", "E", "I/E"],
  {label: "Attitude (source)", value: "all"}
);
const attitude = view(attitudeInput);

const regionInput = Inputs.select(
  ["all", "Africa", "Africa/Diaspora", "Americas", "Anatolia", "Caribbean/Africa", "Central Asia", "Central Asia/Global", "East Asia", "Egypt", "Egypt/Mediterranean", "Europe", "Europe/Asia", "Europe/Global", "Europe/Middle East", "Europe/N.America", "Global", "Latin America", "Latin America/Global", "Mediterranean", "Mesopotamia", "Middle East", "Middle East/Asia", "Middle East/Europe", "Middle East/South Asia", "North Africa", "North America", "Oceania", "Persia", "Persia/Central Asia", "Persia/South Asia", "South Asia", "South Asia/Global", "South/Central Asia", "Southeast Asia", "Southeast Asia/Global", "Western Europe"],
  {label: "Region (source)", value: "all"}
);
const region = view(regionInput);

const minStrength = view(Inputs.range([1, 3], {label: "Min strength", value: 1, step: 1}));
```

```js
import * as d3 from "npm:d3";

const Q_COLOR = {
  PxU: "hsl(268,55%,58%)",
  AxU: "hsl(18,65%,58%)",
  PxP: "hsl(200,58%,52%)",
  AxP: "hsl(83,52%,48%)",
};
const Q_LABEL = {
  PxU: "Participatory\n× Universal",
  AxU: "Abstract\n× Universal",
  PxP: "Participatory\n× Particular",
  AxP: "Abstract\n× Particular",
};
const QUADS = ["PxU", "AxU", "PxP", "AxP"];

// ── Join: build lookup from movement name → tradition metadata ────────────
const tradByName = new Map(traditions.map(t => [t.movement, t]));

// ── Filter edges: join on source movement, apply field/attitude/region ────
const filteredEdges = edges.filter(e => {
  if (+e.strength < minStrength) return false;
  const src = tradByName.get(e.source);
  if (!src) return false; // exclude edges whose source isn't in traditions
  if (!fields.includes(src.field)) return false;
  if (attitude !== "all" && src.attitude !== attitude) return false;
  if (region !== "all" && src.region !== region) return false;
  return true;
});

// ── Aggregate filtered edges by quadrant_transition ───────────────────────
const agg = new Map(); // "src→tgt" → { src, tgt, total, count }
for (const e of filteredEdges) {
  const tr = e.quadrant_transition;
  if (!tr) continue;
  const [src, tgt] = tr.split("→");
  if (!QUADS.includes(src) || !QUADS.includes(tgt)) continue;
  const key = `${src}→${tgt}`;
  if (!agg.has(key)) agg.set(key, { src, tgt, total: 0, count: 0 });
  const a = agg.get(key);
  a.total += +e.strength || 1;
  a.count += 1;
}

const aggLinks = [...agg.values()];
const maxTotal = d3.max(aggLinks, d => d.total);

// ── Layout ────────────────────────────────────────────────────────────────
const container = document.getElementById("graph-container");
const W = 800;
const H = 800;
const PAD = 60;
const GW = W - PAD * 2;
const GH = H - PAD * 2;

// Fixed quadrant centres
const Q_POS = {
  PxU: [PAD + GW * 0.25, PAD + GH * 0.25],
  AxU: [PAD + GW * 0.75, PAD + GH * 0.25],
  PxP: [PAD + GW * 0.25, PAD + GH * 0.75],
  AxP: [PAD + GW * 0.75, PAD + GH * 0.75],
};
const NODE_R = 44;

const svg = d3.select("#graph-svg")
  .attr("width", W).attr("height", H)
  .attr("viewBox", `0 0 ${W} ${H}`);
svg.selectAll("*").remove();

const defs = svg.append("defs");

// Arrow markers, one per source quadrant colour
for (const q of QUADS) {
  defs.append("marker")
    .attr("id", `arr-${q}`)
    .attr("viewBox", "0 -4 8 8")
    .attr("refX", 12).attr("refY", 0)
    .attr("markerWidth", 5).attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path").attr("d", "M0,-4L8,0L0,4")
    .attr("fill", Q_COLOR[q]).attr("opacity", 0.9);
}

// Crosshair
const cr = svg.append("g");
cr.append("line").attr("x1", PAD).attr("x2", W-PAD).attr("y1", H/2).attr("y2", H/2)
  .attr("stroke","rgba(255,255,255,0.07)").attr("stroke-width",1);
cr.append("line").attr("x1", W/2).attr("x2", W/2).attr("y1", PAD).attr("y2", H-PAD)
  .attr("stroke","rgba(255,255,255,0.07)").attr("stroke-width",1);

// ── Draw edges ────────────────────────────────────────────────────────────
const edgeG = svg.append("g");

for (const d of aggLinks) {
  const [x1, y1] = Q_POS[d.src];
  const [x2, y2] = Q_POS[d.tgt];
  const w = 1.5 + (d.total / maxTotal) * 22;
  const opacity = 0.3 + (d.total / maxTotal) * 0.55;
  const color = Q_COLOR[d.src];

  if (d.src === d.tgt) {
    // Self-loop: draw an arc looping outward from the node corner
    const cx = x1, cy = y1;
    const loopR = NODE_R * 1.6;
    // offset direction per quadrant
    const offsets = { PxU: [-1,-1], AxU:[1,-1], PxP:[-1,1], AxP:[1,1] };
    const [ox, oy] = offsets[d.src];
    const lx = cx + ox * loopR * 1.1;
    const ly = cy + oy * loopR * 1.1;
    const path = `M${cx + ox*NODE_R*0.6},${cy + oy*NODE_R*0.6}
                  C${lx + oy*loopR*0.6},${ly - ox*loopR*0.6}
                   ${lx - oy*loopR*0.6},${ly + ox*loopR*0.6}
                   ${cx + oy*NODE_R*0.6},${cy - ox*NODE_R*0.6}`;
    edgeG.append("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", color).attr("stroke-width", w).attr("stroke-opacity", opacity)
      .attr("marker-end", `url(#arr-${d.src})`);

    // label mid-loop
    edgeG.append("text")
      .attr("x", lx).attr("y", ly)
      .attr("text-anchor","middle").attr("dominant-baseline","middle")
      .attr("font-family","'JetBrains Mono',monospace").attr("font-size","9px")
      .attr("fill", color).attr("fill-opacity", 0.75)
      .text(`${d.count}`);
  } else {
    // Check if reverse edge exists → offset both to avoid overlap
    const hasReverse = agg.has(`${d.tgt}→${d.src}`);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/len, ny = dx/len; // normal
    const offset = hasReverse ? 14 : 0;

    // Shorten to not overlap node circles
    const sx = x1 + (dx/len)*NODE_R + nx*offset;
    const sy = y1 + (dy/len)*NODE_R + ny*offset;
    const ex = x2 - (dx/len)*(NODE_R+10) + nx*offset;
    const ey = y2 - (dy/len)*(NODE_R+10) + ny*offset;

    // Slight curve
    const mx = (sx+ex)/2 + nx*30, my = (sy+ey)/2 + ny*30;
    const path = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`;

    edgeG.append("path")
      .attr("d", path).attr("fill","none")
      .attr("stroke", color).attr("stroke-width", w).attr("stroke-opacity", opacity)
      .attr("marker-end", `url(#arr-${d.src})`);

    // edge count label at midpoint
    const lx = (sx + 2*mx + ex)/4, ly = (sy + 2*my + ey)/4;
    edgeG.append("text")
      .attr("x", lx + nx*10).attr("y", ly + ny*10)
      .attr("text-anchor","middle").attr("dominant-baseline","middle")
      .attr("font-family","'JetBrains Mono',monospace").attr("font-size","9px")
      .attr("fill", color).attr("fill-opacity", 0.75)
      .text(`${d.count}`);
  }
}

// ── Draw nodes ────────────────────────────────────────────────────────────
const nodeG = svg.append("g");
for (const q of QUADS) {
  const [cx, cy] = Q_POS[q];
  const color = Q_COLOR[q];

  // glow
  nodeG.append("circle")
    .attr("cx",cx).attr("cy",cy).attr("r", NODE_R*1.35)
    .attr("fill", color).attr("opacity", 0.07);

  // circle
  nodeG.append("circle")
    .attr("cx",cx).attr("cy",cy).attr("r", NODE_R)
    .attr("fill", color).attr("fill-opacity", 0.18)
    .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.7);

  // label (two lines)
  const lines = Q_LABEL[q].split("\n");
  nodeG.append("text")
    .attr("x",cx).attr("y",cy - 8)
    .attr("text-anchor","middle").attr("dominant-baseline","middle")
    .attr("font-family","'JetBrains Mono',monospace").attr("font-size","11px")
    .attr("font-weight","500").attr("fill", color)
    .text(lines[0]);
  nodeG.append("text")
    .attr("x",cx).attr("y",cy + 8)
    .attr("text-anchor","middle").attr("dominant-baseline","middle")
    .attr("font-family","'JetBrains Mono',monospace").attr("font-size","11px")
    .attr("font-weight","500").attr("fill", color)
    .text(lines[1]);
}
```

```js
html`<p class="row-count">${filteredEdges.length} edges</p>`
```

```js
Inputs.table(filteredEdges, {
  columns: ["source", "target", "strength", "confidence", "influence_type", "quadrant_transition"],
  header: {
    source: "Source", target: "Target", strength: "Strength",
    confidence: "Confidence", influence_type: "Type", quadrant_transition: "Transition"
  },
  format: {
    strength: s => html`<div class="weight-bar">
      <div class="weight-track"><div class="weight-fill" style="width:${s/3*100}%"></div></div>
      <span class="weight-num">${s}</span>
    </div>`,
    confidence: c => html`<div class="weight-bar">
      <div class="weight-track"><div class="weight-fill" style="width:${c/3*100}%"></div></div>
      <span class="weight-num">${c}</span>
    </div>`,
    quadrant_transition: t => {
      if (!t) return "";
      const [src, tgt] = t.split("→");
      const srcCls = {PxU:"qb-PxU",AxU:"qb-AxU",PxP:"qb-PxP",AxP:"qb-AxP"}[src] || "";
      const tgtCls = {PxU:"qb-PxU",AxU:"qb-AxU",PxP:"qb-PxP",AxP:"qb-AxP"}[tgt] || "";
      return html`<span class="quadrant-badge ${srcCls}">${src}</span> → <span class="quadrant-badge ${tgtCls}">${tgt}</span>`;
    },
    influence_type: t => html`<span class="influence-type-badge">${t}</span>`
  },
  width: {
    source: 220, target: 220, strength: 90, confidence: 90,
    influence_type: 180, quadrant_transition: 160
  },
  rows: 30
})
```

<style>
  .section-label {
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--theme-foreground-muted);
    margin: 1.5rem 0 0.5rem;
    opacity: 0.6;
    display: block;
  }

  :root {
    --q-PxU-bg: rgba(130, 70, 200, 0.15);
    --q-PxU-text: hsl(268, 68%, 78%);
    --q-AxU-bg: rgba(210, 90, 30, 0.15);
    --q-AxU-text: hsl(18, 70%, 72%);
    --q-PxP-bg: rgba(40, 140, 200, 0.15);
    --q-PxP-text: hsl(200, 65%, 72%);
    --q-AxP-bg: rgba(120, 168, 40, 0.15);
    --q-AxP-text: hsl(83, 58%, 68%);
  }

  .row-count {
    font-family: var(--sans-serif);
    font-size: 0.75rem;
    color: var(--theme-foreground-muted);
    margin: 1.5rem 0 0.25rem;
  }

  .quadrant-badge {
    display: inline-block;
    padding: 0.18rem 0.45rem;
    border-radius: 2px;
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.6rem;
    white-space: nowrap;
  }
  .qb-PxU { background: var(--q-PxU-bg); color: var(--q-PxU-text); }
  .qb-AxU { background: var(--q-AxU-bg); color: var(--q-AxU-text); }
  .qb-PxP { background: var(--q-PxP-bg); color: var(--q-PxP-text); }
  .qb-AxP { background: var(--q-AxP-bg); color: var(--q-AxP-text); }

  .influence-type-badge {
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.6rem;
    color: var(--theme-foreground-muted);
  }

  .weight-bar   { display: flex; align-items: center; gap: 0.35rem; }
  .weight-track { width: 40px; height: 3px; background: var(--theme-foreground-faintest); border-radius: 2px; overflow: hidden; }
  .weight-fill  { height: 100%; border-radius: 2px; background: var(--theme-foreground-focus); }
  .weight-num   { font-family: 'JetBrains Mono', var(--mono); font-size: 0.68rem; color: var(--theme-foreground-muted); min-width: 1rem; }

  #graph-container {
    position: relative;
    width: 800px;
    height: 800px;
  }

  .quadrant-bg {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-areas:
      ". top ."
      "left grid right"
      ". bottom .";
    grid-template-columns: 2.2rem 1fr 2.2rem;
    grid-template-rows: 2.2rem 1fr 2.2rem;
    pointer-events: none;
  }

  .qbg-top    { grid-area: top;    display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(315, 68%, 62%); }
  .qbg-bottom { grid-area: bottom; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(140, 52%, 52%); }
  .qbg-left   { grid-area: left;   display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(218, 65%, 62%); writing-mode: vertical-rl; transform: rotate(180deg); }
  .qbg-right  { grid-area: right;  display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(52, 80%, 58%); writing-mode: vertical-rl; }

  .quadrant-bg-grid {
    grid-area: grid;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    background: rgba(8, 8, 12, 0.5);
    border-radius: 3px;
    overflow: hidden;
  }

  .qbg-cell { opacity: 0.12; }
  .qbg-PxU { background: radial-gradient(ellipse 120% 120% at 0%   0%,   hsl(268, 55%, 26%), transparent); }
  .qbg-AxU { background: radial-gradient(ellipse 120% 120% at 100% 0%,   hsl(18,  65%, 28%), transparent); }
  .qbg-PxP { background: radial-gradient(ellipse 120% 120% at 0%   100%, hsl(200, 58%, 24%), transparent); }
  .qbg-AxP { background: radial-gradient(ellipse 120% 120% at 100% 100%, hsl(83,  52%, 22%), transparent); }

  #graph-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>