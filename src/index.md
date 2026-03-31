---
theme: dashboard
toc: false
title: Epistemological Traditions Map
---

<h1 class="page-title">Epistemological & Psychological Traditions Map</h1>

<p class="subtitle">Human cultural history in a quaternary model — Participatory/Abstract × Universal/Particular — mapped to Jungian functions (Feeling · Intuition · Sensation · Thinking) and attitude (Introverted/Extroverted) [1]. Colors after Goethe's <em>Farbenlehre</em> [2].</p>

<p class="text">This data app explores cultural traditions and movements and their mapping into an eplistemological-psychological model. All datasets are generated using <a href="https://claude.ai">Claude</a>. More information on the model can be found in <a href="https://www.zosimolab.ch/post/four-ways-of-knowing-part-1-an-epistemological-map">Four Ways of Knowing — Part&nbsp;1</a> and <a href="https://www.zosimolab.ch/post/four-ways-of-knowing-part-2-comparative-and-critical-studies">Part&nbsp;2</a>. Some theoretical background is also provided at the bottom of each dashboard. The code and datasets are available on <a href="https://github.com/magnetilo/epistemological-traditions">Github</a>.
</p>

<div class="map-row">
<div class="quadrant-map">
  <div class="qmap-top">Universal</div>
  <div class="qmap-left">Participatory</div>
  <div class="quadrant-grid">
    <div class="quadrant-pill q-PxU-pill">
      <span>Participatory × Universal</span>
      <span>Feeling · Violet — blue rising through universal Steigerung</span>
    </div>
    <div class="quadrant-pill q-AxU-pill">
      <span>Abstract × Universal</span>
      <span>Intuition · Orange-Red — yellow rising through universal Glut</span>
    </div>
    <div class="quadrant-pill q-PxP-pill">
      <span>Participatory × Particular</span>
      <span>Sensation · Cyan — blue settling into particular Stille</span>
    </div>
    <div class="quadrant-pill q-AxP-pill">
      <span>Abstract × Particular</span>
      <span>Thinking · Yellow-Green — yellow settling into particular Form</span>
    </div>
  </div>
  <div class="qmap-right">Abstract</div>
  <div class="qmap-bottom">Particular</div>
</div>
</div>

<h2 class="header-2">Traditions Visualizations</h2>

<p class="text">Mapping historical traditions into epistemological-psychological model (first plot) and the world coordinate system (second plot). The colors of each cluster of traditions is determined by aligning its angle in the epistemological-psychological space with Goethe's color wheel [2]. The opacity of the clusters' filling is determined by the (average) attitude, with low opacity signaling an introverted orientation and stronger opacity signaling an extroverted orientation. Explore the traditions data by hovering over the maps and apply filters. The full filtered dataset is shown in the table below.
</p>


```js
const raw = await FileAttachment("data/epistemological_traditions_v2.csv").csv({typed: true});
```

```js
// ── Scatter plot ––––––––––––––––––

import * as d3 from "npm:d3";

// ── Quadrant from axis values (reuses axisQuadrant defined above) ──────────
function axisQ(pa, pu) {
  return (pa >= 0 ? "A" : "P") + "x" + (pu >= 0 ? "U" : "P");
}

// ── 3×3 spatial grid within each quadrant, I and E never mixed ─────────────
const N = 3;
function sBinKey(r) {
  const pa = +r.axis_pa, pu = +r.axis_pu;
  const paCell = Math.min(Math.floor(Math.abs(pa) * N), N - 1);
  const puCell = Math.min(Math.floor(Math.abs(pu) * N), N - 1);
  const ie = +(r.axis_ie) > 0 ? "E" : "I";
  return axisQ(pa, pu) + `_${paCell}_${puCell}_${ie}`;
}

// ── Continuous Goethean color wheel by angle in pa-pu space ────────────────
function clusterColor(pa, pu) {
  const angleDeg = Math.atan2(pu, pa) * (180 / Math.PI);
  const hue = ((50 - angleDeg) % 360 + 360) % 360;
  return `hsl(${hue.toFixed(1)}, 62%, 56%)`;
}

const scatterBins = d3.rollup(
  filtered.filter(r => r.axis_pa != null && r.axis_pu != null),
  rows => ({
    pa:    d3.mean(rows, r => +r.axis_pa),
    pu:    d3.mean(rows, r => +r.axis_pu),
    ie:    d3.mean(rows, r => +(r.axis_ie) || 0),
    w:     d3.sum(rows,  r => +(r.weight) || 1),
    n:     rows.length,
    names: rows.map(r => r.movement).filter(Boolean).sort()
  }),
  sBinKey
);
const sClusters = [...scatterBins.entries()].map(([key, c]) => ({ ...c, q: key.split("_")[0] }));
const sMaxW = d3.max(sClusters, c => c.w) || 1;

// ── Build container element (returned so Observable places it here) ──────────
const S = 480, SPAD = 36, SGS = S - SPAD * 2;
function spx(pa) { return SPAD + (pa + 1) / 2 * SGS; }
function spy(pu) { return SPAD + (1 - (pu + 1) / 2) * SGS; }

const scatterContainer = html`<div id="scatter-container">
  <div class="scatter-bg">
    <div class="sbg-top">Universal</div>
    <div class="sbg-left">Participatory</div>
    <div class="scatter-bg-grid">
      <div class="sbg-cell sbg-PxU"></div>
      <div class="sbg-cell sbg-AxU"></div>
      <div class="sbg-cell sbg-PxP"></div>
      <div class="sbg-cell sbg-AxP"></div>
    </div>
    <div class="sbg-right">Abstract</div>
    <div class="sbg-bottom">Particular</div>
  </div>
  <svg id="scatter-svg-el"></svg>
</div>`;

const sSvg = d3.select(scatterContainer.querySelector("#scatter-svg-el"))
  .attr("width", S).attr("height", S)
  .attr("viewBox", `0 0 ${S} ${S}`);

// Crosshair
sSvg.append("line").attr("x1", spx(0)).attr("x2", spx(0)).attr("y1", SPAD).attr("y2", S - SPAD)
  .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1);
sSvg.append("line").attr("x1", SPAD).attr("x2", S - SPAD).attr("y1", spy(0)).attr("y2", spy(0))
  .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1);

// ── Tooltip ──────────────────────────────────────────────────────────────────
const sTooltip = d3.select("body").selectAll(".scatter-tooltip").data([1]).join("div")
  .attr("class", "scatter-tooltip")
  .style("position", "fixed").style("pointer-events", "none")
  .style("background", "rgba(10,10,16,0.96)")
  .style("border", "1px solid rgba(255,255,255,0.12)").style("border-radius", "4px")
  .style("padding", "0.5rem 0.7rem")
  .style("font-family", "'JetBrains Mono', monospace").style("font-size", "0.62rem")
  .style("color", "#ccc").style("max-width", "280px")
  .style("line-height", "1.65").style("opacity", "0")
  .style("transition", "opacity 0.12s").style("z-index", "9999");

// ── Draw clusters ────────────────────────────────────────────────────────────
for (const c of sClusters) {
  const px = spx(c.pa), py = spy(c.pu);
  const r = 5 + Math.sqrt(c.w / sMaxW) * 22;
  const color = clusterColor(c.pa, c.pu);
  const ieNorm = (c.ie + 1) / 2;
  const fillOp = 0.08 + ieNorm * 0.52;

  sSvg.append("circle")
    .attr("cx", px).attr("cy", py).attr("r", r)
    .attr("fill", color).attr("fill-opacity", fillOp)
    .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.55)
    .style("cursor", "pointer")
    .on("mouseover", function(event) {
      const ieLabel = c.ie > 0 ? "Extroverted" : "Introverted";
      const shown = c.names.slice(0, 30);
      const more = c.names.length > 30 ? `<br><span style="opacity:0.45">… +${c.names.length - 30} more</span>` : "";
      sTooltip.style("opacity", "1").html(
        `<strong style="color:${color}">${c.q} · ${ieLabel}</strong> <span style="opacity:0.6">${c.n} traditions</span>` +
        `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0.3rem 0">` +
        shown.join("<br>") + more
      );
    })
    .on("mousemove", function(event) {
      sTooltip.style("left", (event.clientX + 16) + "px").style("top", (event.clientY - 10) + "px");
    })
    .on("mouseout", function() { sTooltip.style("opacity", "0"); });
}
```

```js
// ── World Map ─────────────────────────────────────────────────────────────────
import * as topojson from "npm:topojson-client";

const worldData = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
  .then(r => r.json());

// Raw rows eligible for world clustering
const wRawRows = filtered.filter(r =>
  r.lat != null && r.lon != null &&
  r.region !== "Global" &&
  r.axis_pa != null && r.axis_pu != null
);

// Discrete zoom tier → geographic cell size in degrees
function wCellDeg(k) {
  if (k < 2)  return 30;   // tier 1: ~continent blobs
  if (k < 4)  return 15;   // tier 2: sub-continental
  if (k < 7)  return 7;    // tier 3: country-level
  if (k < 10) return 3;    // tier 4: regional
  return 1.5;              // tier 5: near-individual
}

// Compute clusters for a given zoom level k
function computeWClusters(k) {
  const cell = wCellDeg(k);
  const bins = d3.rollup(
    wRawRows,
    rows => ({
      lat:   d3.mean(rows, r => +r.lat),
      lon:   d3.mean(rows, r => +r.lon),
      pa:    d3.mean(rows, r => +r.axis_pa),
      pu:    d3.mean(rows, r => +r.axis_pu),
      ie:    d3.mean(rows, r => +(r.axis_ie) || 0),
      w:     d3.sum(rows,  r => +(r.weight) || 1),
      n:     rows.length,
      names: rows.map(r => r.movement).filter(Boolean).sort()
    }),
    r => {
      const pa = +r.axis_pa, pu = +r.axis_pu;
      const ie = +(r.axis_ie) > 0 ? "E" : "I";
      const latCell = Math.floor(+r.lat / cell);
      const lonCell = Math.floor(+r.lon / cell);
      return axisQ(pa, pu) + "_" + ie + "_" + latCell + "_" + lonCell;
    }
  );
  return [...bins.entries()].map(([key, c]) => ({ ...c, q: key.split("_")[0], key }));
}

// ── Map dimensions & projection ──────────────────────────────────────────────
const WW = 0.9*640, WH = 0.9*340;
const wProjection = d3.geoNaturalEarth1().fitSize([WW, WH], { type: "Sphere" });
const wPath = d3.geoPath(wProjection);

const worldContainer = html`<div id="world-container" style="position:relative;width:${WW}px;height:${WH}px;flex-shrink:0;border-radius:4px;overflow:hidden">
  <svg id="world-svg-el" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}"></svg>
</div>`;

const wSvg = d3.select(worldContainer.querySelector("#world-svg-el"));

// Sea background (not part of zoomable group)
wSvg.append("rect")
  .attr("width", WW).attr("height", WH)
  .attr("fill", "rgba(15, 15, 15, 0.92)");

// All zoomable content lives in this group
const wMapG = wSvg.append("g").attr("id", "world-map-g");

// Graticule
wMapG.append("path")
  .datum(d3.geoGraticule()())
  .attr("d", wPath)
  .attr("fill", "none")
  .attr("stroke", "rgba(255,255,255,0.04)")
  .attr("stroke-width", 0.4);

// Countries
const cFeatures = topojson.feature(worldData, worldData.objects.countries);
wMapG.append("g")
  .selectAll("path")
  .data(cFeatures.features)
  .join("path")
  .attr("d", wPath)
  .attr("fill", "rgba(68, 68, 68, 0.6)")
  .attr("stroke", "rgba(255,255,255,0.09)")
  .attr("stroke-width", 0.4);

// Draw/redraw clusters — called on initial load and on zoom tier change
let wCurrentTier = -1;  // reset each cell run → always redraws on filter change
function drawWClusters(k) {
  const tier = wCellDeg(k);
  if (tier === wCurrentTier) return; // no tier change during zoom, skip redraw
  wCurrentTier = tier;

  const clusters = computeWClusters(k);
  const maxW = d3.max(clusters, c => c.w) || 1;

  wMapG.selectAll(".w-cluster").remove();

  for (const c of clusters) {
    const proj = wProjection([c.lon, c.lat]);
    if (!proj) continue;
    const [px, py] = proj;
    const color = clusterColor(c.pa, c.pu);
    const fillOp = 0.08 + ((c.ie + 1) / 2) * 0.52;

    wMapG.append("circle")
      .attr("class", "w-cluster")
      .datum(c)
      .attr("cx", px).attr("cy", py)
      .attr("r", (2 + Math.sqrt(c.w / maxW) * 10) / k)
      .attr("fill", color).attr("fill-opacity", fillOp)
      .attr("stroke", color).attr("stroke-width", 1.5 / k).attr("stroke-opacity", 0.55)
      .style("cursor", "pointer")
      .on("mouseover", function(event) {
        const ieLabel = c.ie > 0 ? "Extroverted" : "Introverted";
        const shown = c.names.slice(0, 30);
        const more = c.names.length > 30 ? `<br><span style="opacity:0.45">… +${c.names.length - 30} more</span>` : "";
        sTooltip.style("opacity", "1").html(
          `<strong style="color:${color}">${c.q} · ${ieLabel}</strong> <span style="opacity:0.6">${c.n} traditions</span>` +
          `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0.3rem 0">` +
          shown.join("<br>") + more
        );
      })
      .on("mousemove", function(event) {
        sTooltip.style("left", (event.clientX + 16) + "px").style("top", (event.clientY - 10) + "px");
      })
      .on("mouseout", function() { sTooltip.style("opacity", "0"); });
  }
}

// ── Zoom behaviour ────────────────────────────────────────────────────────────
const wZoom = d3.zoom()
  .scaleExtent([1, 12])
  .translateExtent([[-Infinity, -Infinity], [Infinity, Infinity]])
  .on("zoom", (event) => {
    const k = event.transform.k;
    window.__wZoomSave = event.transform;  // persist across re-runs
    wMapG.attr("transform", event.transform);
    wMapG.selectAll("path").attr("stroke-width", 0.4 / k);
    drawWClusters(k);
  });

wSvg.call(wZoom).style("cursor", "grab")
  .on("mousedown.cursor", function() { d3.select(this).style("cursor", "grabbing"); })
  .on("mouseup.cursor",   function() { d3.select(this).style("cursor", "grab"); });

// Double-click to reset
wSvg.on("dblclick.zoom", () => {
  window.__wZoomSave = d3.zoomIdentity;
  wSvg.transition().duration(400).call(wZoom.transform, d3.zoomIdentity);
});

// Restore zoom state from previous run (survives filter changes)
const _wt = window.__wZoomSave;
if (_wt && (_wt.k !== 1 || _wt.x !== 0 || _wt.y !== 0)) {
  wSvg.call(wZoom.transform, _wt);
} else {
  drawWClusters(1);
}

// ── Side-by-side: scatter (left) + world map (right, vertically centred) ────
const plotsRow = html`<div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap;justify-content:center;margin:1rem auto 1.5rem;"></div>`;
plotsRow.append(scatterContainer);
plotsRow.append(worldContainer);
display(plotsRow);
```

```js
import { createFilterInputs, filterData, formatYear, quadrantLabel, axisQuadrant } from "./components/traditions-filter.js";
import { fitYearExponential } from "./components/event-time-series.js";
const yearFit = fitYearExponential(raw);
const fi = createFilterInputs(yearFit);
```

```js
const _filterSection = html`<div class="filter-section">
  <p class="section-label">Filter & Explore</p>
</div>`;
_filterSection.append(fi.quadrant, fi.field, fi.attitude, fi.yearRange, fi.search);
display(_filterSection);
const quadrant = Generators.input(fi.quadrant);
const field = Generators.input(fi.field);
const attitude = Generators.input(fi.attitude);
const yearRange = Generators.input(fi.yearRange);
const search = Generators.input(fi.search);
```

```js
const filtered = filterData(raw, {quadrant, field, attitude, search, yearRange, yearFit});
```


```js
html`<p class="row-count">${filtered.length} traditions</p>`
```

```js
Inputs.table(filtered.map(r => ({...r, quadrant: axisQuadrant(r)})), {
  columns: ["year", "quadrant", "attitude", "field", "movement", "individuals", "region", "weight"],
  header: {
    year: "Year", quadrant: "Quadrant", attitude: "I/E", field: "Field",
    movement: "Movement / Tradition", individuals: "Key Individuals",
    region: "Region", weight: "Weight"
  },
  format: {
    year: y => formatYear(y),
    quadrant: q => {
      const cls = {PxU: "qb-PxU", AxU: "qb-AxU", PxP: "qb-PxP", AxP: "qb-AxP"}[q] || "";
      return html`<span class="quadrant-badge ${cls}">${quadrantLabel(q)}</span>`;
    },
    attitude: a => {
      const cls = a === "I" ? "att-I" : a === "E" ? "att-E" : "att-IE";
      return html`<span class="attitude-badge ${cls}">${a}</span>`;
    },
    field: f => html`<span class="field-badge f-${f}">${f}</span>`,
    weight: w => html`<div class="weight-bar">
      <div class="weight-track"><div class="weight-fill" style="width:${w * 10}%"></div></div>
      <span class="weight-num">${w}</span>
    </div>`
  },
  width: {
    year: 90, quadrant: 160, attitude: 50, field: 110,
    movement: 280, individuals: 240, region: 130, weight: 80
  },
  rows: 30
})
```

<div style="height:3rem"></div>

<h2 class="header-2">Theoretical Background</h2>

<div class="text">Correspondences between epistemological quadrants and Jung's psychological functions and attitudes [1]:

<ul>
  <li><b>Thinking as Abstract x Particular</b>: Jung describes <em>thinking</em> as being “confined to the linking up of ideas by means of a concept, in other words, to an act of judgment.” While the words “ideas” and “concept” imply a Distance attitude, Jung does not explicitly label thinking as Experiential. However, in my model, Thinking represents the <em>quantitative ordering</em> of the empirical world — turning discrete facts into logical systems.</li>
  <li><b>Sensation as Participatory x Particular</b>: Jung defines <em>sensation</em> as “the psychological function that mediates the perception of a physical stimulus,” clearly situating it in the Experiential realm. While Jung does not use the term Participation, he notes that sensation and feeling often “ally” themselves to “an almost inseparable amalgam of feeling and sensation elements,” which, in my epistemological model, can be identified as the “left-side Participation alliance” immersed in the “here and now” of reality.</li>
  <li><b>Feeling as Participatory x Universal</b>: Jung describes <em>feeling</em> as a process “that imparts to the content a definite value in the sense of acceptance or rejection (‘like’ or ‘dislike’)” and that it is “independent of external stimuli.” Thus, feeling is not Experiential; it evaluates experience based on Universal principles or “primordial images” of worth. It is a Participation function because the subject must “feel into” the value to realize its significance.</li>
  <li><b>Intuition as Abstract x Universal</b>: Rooted in the Latin <em>intueri</em> (“to look at or into”), Jung describes <em>intuition</em> as perception “in an unconscious way” and as content presenting itself “whole and complete, without our being able to explain or discover how this content came into existence.” This description aligns with the “seeing of” or “looking at” Universal patterns or possibilities. The visual nature of intuition suggests a certain Distance — a detached apprehension of the “idea” or “archetypal pattern” of a situation.</li>
  <li><b>Introversion and Extroversion as Depth (z-axis)</b>: Jung defines <em>introversion</em> as “an inward-turning of libido… a negative relation of subject to object,” and <em>extroversion</em> as “an outward-turning of libido… a positive movement of subjective interest towards the object.” Unlike the four functions, these two attitudes rely on the ontological categories of <em>subject and object</em> (inside and outside). While these categories are not strictly epistemological, they are near-universal structures found in most cosmic ontologies.</li>
</ul>

Goethe's Color Psychology [2]: 

<ul>
  <li>Goethe develop a kind of <em>color psychology</em> based on his participatory observations and experiments with light and colors by assigning six aesthetic qualities as well as four human cognitions to his color wheel.</li>
  <li>He associated red with <em>beautiful</em>, orange with <em>noble</em>, yellow with <em>good</em>, green with <em>useful</em>, blue with <em>common</em>, and violet with <em>unnecessary</em>. The four assigned human cognitions are: <em>reason</em> (Vernunft) to the beautiful and the noble (red and orange), the <em>intellect</em> (Verstand) to the good and the useful (yellow and green), <em>sensuality</em> (Sinnlichkeit) to the useful and the common (green and blue) and, <em>imagination</em> (Phantasie) to the unnecessary and the beautiful (purple and red).</li>
</ul>

References:

<ul>
  <li>[1] Carl Gustav Jung, <a href=https://jungiancenter.org/wp-content/uploads/2023/09/Vol-6-psychological-types.pdf>Psychological Types</a> (in particular, chapter XI Definitions)</li>
  <li>[2] Johann Wolfgang von Goethe, <a href=https://en.wikipedia.org/wiki/Theory_of_Colours>Theory of Colours</a></li>
  <li>[3] Thilo Weber, <a href="https://www.zosimolab.ch/post/four-ways-of-knowing-part-1-an-epistemological-map">Four Ways of Knowing — Part&nbsp;1: An Epistemological Map</a> and <a href="https://www.zosimolab.ch/post/four-ways-of-knowing-part-2-comparative-and-critical-studies">Four Ways of Knowing — Part&nbsp;2: Comparative and Critical Studies</a></li>
</ul>

</div>

<style>
  :root {
    /* badge backgrounds (table) */
    --q-PxU-bg: rgba(130, 70, 200, 0.15);
    --q-PxU-text: hsl(268, 68%, 78%);
    --q-AxU-bg: rgba(210, 90, 30, 0.15);
    --q-AxU-text: hsl(18, 70%, 72%);
    --q-PxP-bg: rgba(40, 140, 200, 0.15);
    --q-PxP-text: hsl(200, 65%, 72%);
    --q-AxP-bg: rgba(120, 168, 40, 0.15);
    --q-AxP-text: hsl(83, 58%, 68%);
  }

  .page-title {
    font-size: 1.8rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: #c9a84c;
    margin-bottom: 0.4rem;
    max-width: 860px;
    margin-left: auto;
    margin-right: auto;
  }

  .subtitle {
    color: var(--theme-foreground-muted);
    font-style: italic;
    margin-bottom: 1rem;
    max-width: 860px;
    margin-left: auto;
    margin-right: auto;
  }

  .header-2 {
    font-size: 1.6rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--theme-foreground-muted);
    margin-bottom: 0.4rem;
    max-width: 860px;
    margin-left: auto;
    margin-right: auto;
  }

  .text {
    color: var(--theme-foreground);
    margin-bottom: 1rem;
    max-width: 860px;
    margin-left: auto;
    margin-right: auto;
  }

  .filter-section {
    max-width: 660px;
    margin-left: auto;
    margin-right: auto;
  }

  .section-label {
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--theme-foreground-muted);
    margin: 1.5rem 0 0.5rem;
    opacity: 0.6;
  }

  .row-count {
    font-family: var(--sans-serif);
    font-size: 0.75rem;
    color: var(--theme-foreground-muted);
    margin: 0.25rem 0 0.5rem;
  }

  .quadrant-map {
    display: grid;
    grid-template-areas:
      ". top ."
      "left grid right"
      ". bottom .";
    grid-template-columns: 1.6rem 1fr 1.6rem;
    grid-template-rows: 1.6rem auto 1.6rem;
    gap: 0.2rem;
    margin: 1rem auto 1.5rem;
    max-width: 480px;
  }

  .qmap-top, .qmap-bottom, .qmap-left, .qmap-right {
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* axis labels: pure color-circle hues */
  .qmap-top    { grid-area: top;    color: hsl(315, 68%, 62%); }  /* magenta */
  .qmap-bottom { grid-area: bottom; color: hsl(140, 52%, 52%); }  /* green */
  .qmap-left   { grid-area: left;   color: hsl(218, 65%, 62%); writing-mode: vertical-rl; transform: rotate(180deg); }  /* blue */
  .qmap-right  { grid-area: right;  color: hsl(52,  80%, 58%); writing-mode: vertical-rl; }  /* yellow */

  .quadrant-grid {
    grid-area: grid;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    background: rgba(8, 8, 12, 0.95);  /* dark cross lines */
    border-radius: 3px;
    overflow: hidden;
  }

  .quadrant-pill {
    padding: 0.6rem 0.8rem;
    border-radius: 0;
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.68rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    aspect-ratio: 1;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .quadrant-pill span:first-child { font-weight: 500; font-size: 0.75rem; }
  .quadrant-pill span:last-child { opacity: 0.65; font-size: 0.62rem; }

  /* radial gradients: bright hue at outer corner, dark at inner corner (center of map) */
  .q-PxU-pill { background: radial-gradient(ellipse 130% 130% at 0%   0%,   hsl(268, 55%, 26%), hsl(268, 20%, 7%)); color: var(--q-PxU-text); }
  .q-AxU-pill { background: radial-gradient(ellipse 130% 130% at 100% 0%,   hsl(18,  65%, 28%), hsl(18,  22%, 7%)); color: var(--q-AxU-text); }
  .q-PxP-pill { background: radial-gradient(ellipse 130% 130% at 0%   100%, hsl(200, 58%, 24%), hsl(200, 22%, 7%)); color: var(--q-PxP-text); }
  .q-AxP-pill { background: radial-gradient(ellipse 130% 130% at 100% 100%, hsl(83,  52%, 22%), hsl(83,  22%, 7%)); color: var(--q-AxP-text); }

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

  .field-badge {
    display: inline-block;
    padding: 0.14rem 0.4rem;
    border-radius: 2px;
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.6rem;
  }

  .f-Science      { background: rgba(74, 143, 165, 0.15); color: #6ab4cc; }
  .f-Philosophy   { background: rgba(143, 110, 165, 0.15); color: #b494cc; }
  .f-Art          { background: rgba(165, 119, 74, 0.15); color: #cc9960; }
  .f-Spirituality { background: rgba(90, 159, 122, 0.15); color: #70cc99; }

  .attitude-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    padding: 0.14rem 0;
    border-radius: 2px;
    font-family: 'JetBrains Mono', var(--mono);
    font-size: 0.65rem;
    font-weight: 500;
  }

  .att-I  { background: rgba(100, 80, 160, 0.2); color: #a090e0; }
  .att-E  { background: rgba(200, 120, 40, 0.2); color: #d49050; }
  .att-IE { background: rgba(120, 120, 120, 0.15); color: #999; font-size: 0.58rem; }

  .weight-bar   { display: flex; align-items: center; gap: 0.35rem; }
  .weight-track { width: 55px; height: 3px; background: var(--theme-foreground-faintest); border-radius: 2px; overflow: hidden; }
  .weight-fill  { height: 100%; border-radius: 2px; background: var(--theme-foreground-focus); }
  .weight-num   { font-family: 'JetBrains Mono', var(--mono); font-size: 0.68rem; color: var(--theme-foreground-muted); min-width: 1.4rem; }

  /* ── Map row: quadrant-map + scatter side by side ──────────────────────── */
  .map-row {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .quadrant-map { flex-shrink: 0; }

  #scatter-container {
    position: relative;
    width: 480px;
    height: 480px;
    flex-shrink: 0;
    /* margin: 1rem auto 1.5rem; */
  }

  .scatter-bg {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-areas:
      ". top ."
      "left grid right"
      ". bottom .";
    grid-template-columns: 36px 1fr 36px;
    grid-template-rows: 36px 1fr 36px;
    pointer-events: none;
  }

  .sbg-top    { grid-area: top;    display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', var(--mono); font-size: 0.55rem; font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase; color: hsl(315, 68%, 62%); }
  .sbg-bottom { grid-area: bottom; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', var(--mono); font-size: 0.55rem; font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase; color: hsl(140, 52%, 52%); }
  .sbg-left   { grid-area: left;   display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', var(--mono); font-size: 0.55rem; font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase; color: hsl(218, 65%, 62%); writing-mode: vertical-rl; transform: rotate(180deg); }
  .sbg-right  { grid-area: right;  display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', var(--mono); font-size: 0.55rem; font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase; color: hsl(52, 80%, 58%); writing-mode: vertical-rl; }

  .scatter-bg-grid {
    grid-area: grid;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    background: rgba(8, 8, 12, 0.5);
    border-radius: 3px;
    overflow: hidden;
  }

  .sbg-cell { opacity: 0.12; }
  .sbg-PxU { background: radial-gradient(ellipse 120% 120% at 0%   0%,   hsl(268, 55%, 26%), transparent); }
  .sbg-AxU { background: radial-gradient(ellipse 120% 120% at 100% 0%,   hsl(18,  65%, 28%), transparent); }
  .sbg-PxP { background: radial-gradient(ellipse 120% 120% at 0%   100%, hsl(200, 58%, 24%), transparent); }
  .sbg-AxP { background: radial-gradient(ellipse 120% 120% at 100% 100%, hsl(83,  52%, 22%), transparent); }

  #scatter-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
