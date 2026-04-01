import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

// ── Shared helpers ────────────────────────────────────────────────────────────
function axisQ(pa, pu) {
  return (pa >= 0 ? "A" : "P") + "x" + (pu >= 0 ? "U" : "P");
}

function clusterColor(pa, pu) {
  const angleDeg = Math.atan2(pu, pa) * (180 / Math.PI);
  const hue = ((50 - angleDeg) % 360 + 360) % 360;
  return `hsl(${hue.toFixed(1)}, 62%, 56%)`;
}

// ── Projection (module-level constant — exported for geoFilter in index.md) ──
export const WW = 0.9 * 800;
export const WH = 0.9 * 425;
export const wProjection = d3.geoNaturalEarth1().fitSize([WW, WH], { type: "Sphere" });
const wPath = d3.geoPath(wProjection);

// ── World data cache ──────────────────────────────────────────────────────────
let _worldDataPromise = null;
function getWorldData() {
  if (!_worldDataPromise) {
    _worldDataPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json());
  }
  return _worldDataPromise;
}

// ── Main component ────────────────────────────────────────────────────────────
// poly:          current polygon (null or [[x,y], …]) — displayed on load/re-render
// onPolyChange:  called with new poly value when user draws/clears a polygon
// invalidation:  Observable invalidation promise for keydown listener cleanup
export async function createWorldMap(filtered, { poly, onPolyChange, invalidation }) {
  const worldData = await getWorldData();

  // currentPoly tracks poly locally for immediate visual feedback before cell re-runs
  let currentPoly = poly;

  // Shared tooltip (singleton)
  const tooltip = d3.select("body").selectAll(".scatter-tooltip").data([1]).join("div")
    .attr("class", "scatter-tooltip")
    .style("position", "fixed").style("pointer-events", "none")
    .style("background", "rgba(10,10,16,0.96)")
    .style("border", "1px solid rgba(255,255,255,0.12)").style("border-radius", "4px")
    .style("padding", "0.5rem 0.7rem")
    .style("font-family", "'JetBrains Mono', monospace").style("font-size", "0.62rem")
    .style("color", "#ccc").style("max-width", "280px")
    .style("line-height", "1.65").style("opacity", "0")
    .style("transition", "opacity 0.12s").style("z-index", "9999");

  // ── Eligible rows ─────────────────────────────────────────────────────────
  const wRawRows = filtered.filter(r =>
    r.lat != null && r.lon != null &&
    r.region !== "Global" &&
    r.axis_pa != null && r.axis_pu != null
  );

  // ── Zoom-tier → cell size in degrees ─────────────────────────────────────
  function wCellDeg(k) {
    if (k < 2)  return 20;
    if (k < 4)  return 10;
    if (k < 7)  return 5;
    if (k < 10) return 2;
    return 1;
  }

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
        return axisQ(pa, pu) + "_" + ie + "_" +
          Math.floor(+r.lat / cell) + "_" + Math.floor(+r.lon / cell);
      }
    );
    return [...bins.entries()].map(([key, c]) => ({ ...c, q: key.split("_")[0], key }));
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  const worldContainer = document.createElement("div");
  worldContainer.id = "world-container";
  worldContainer.style.cssText = `position:relative;width:min(${WW}px, 100%);aspect-ratio:${WW}/${WH};height:auto;flex-shrink:0;border-radius:4px;overflow:hidden`;
  worldContainer.innerHTML = `<svg id="world-svg-el" width="100%" height="100%" viewBox="0 0 ${WW} ${WH}"></svg>`;

  const wSvg = d3.select(worldContainer.querySelector("#world-svg-el"));
  wSvg.append("rect").attr("width", WW).attr("height", WH).attr("fill", "rgba(15, 15, 15, 0.92)");

  const wMapG = wSvg.append("g").attr("id", "world-map-g");
  const wPolyG = wMapG.append("g").attr("id", "world-poly-overlay");

  wMapG.append("path")
    .datum(d3.geoGraticule()())
    .attr("d", wPath)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.04)")
    .attr("stroke-width", 0.4);

  const cFeatures = topojson.feature(worldData, worldData.objects.countries);
  wMapG.append("g")
    .selectAll("path")
    .data(cFeatures.features)
    .join("path")
    .attr("d", wPath)
    .attr("fill", "rgba(68, 68, 68, 0.6)")
    .attr("stroke", "rgba(255,255,255,0.09)")
    .attr("stroke-width", 0.4);

  // ── Cluster rendering ─────────────────────────────────────────────────────
  let wCurrentTier = -1;
  function drawWClusters(k) {
    const tier = wCellDeg(k);
    if (tier === wCurrentTier) return;
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
          tooltip.style("opacity", "1").html(
            `<strong style="color:${color}">${c.q} · ${ieLabel}</strong> <span style="opacity:0.6">${c.n} traditions</span>` +
            `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0.3rem 0">` +
            shown.join("<br>") + more
          );
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.clientX + 16) + "px").style("top", (event.clientY - 10) + "px");
        })
        .on("mouseout", function() { tooltip.style("opacity", "0"); });
    }
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const wZoom = d3.zoom()
    .scaleExtent([1, 12])
    .translateExtent([[-Infinity, -Infinity], [Infinity, Infinity]])
    .on("zoom", (event) => {
      const k = event.transform.k;
      window.__wZoomSave = event.transform;
      wMapG.attr("transform", event.transform);
      wMapG.selectAll("path").attr("stroke-width", 0.4 / k);
      drawWClusters(k);
    });

  function enableZoom() {
    wSvg.call(wZoom).style("cursor", "grab")
      .on("mousedown.cursor", function() { d3.select(this).style("cursor", "grabbing"); })
      .on("mouseup.cursor",   function() { d3.select(this).style("cursor", "grab"); });
    wSvg.on("dblclick.zoom", () => {
      window.__wZoomSave = d3.zoomIdentity;
      wSvg.transition().duration(400).call(wZoom.transform, d3.zoomIdentity);
    });
  }

  enableZoom();

  const _wt = window.__wZoomSave;
  if (_wt && (_wt.k !== 1 || _wt.x !== 0 || _wt.y !== 0)) {
    wSvg.call(wZoom.transform, _wt);
  } else {
    drawWClusters(1);
  }

  // ── Polygon tool ──────────────────────────────────────────────────────────
  let wDrawMode = false;
  let wVertices = [];
  let wPreviewPt = null;

  function redrawPolyOverlay() {
    wPolyG.selectAll("*").remove();
    // Closed polygon
    if (currentPoly && currentPoly.length >= 3) {
      wPolyG.append("polygon")
        .attr("points", currentPoly.map(([x, y]) => x + "," + y).join(" "))
        .attr("fill", "rgba(255,200,50,0.08)")
        .attr("stroke", "rgba(255,200,50,0.65)")
        .attr("stroke-width", 1.2)
        .attr("pointer-events", "none");
    }
    // In-progress drawing
    if (wDrawMode && wVertices.length > 0) {
      for (const [x, y] of wVertices) {
        wPolyG.append("circle")
          .attr("cx", x).attr("cy", y).attr("r", 3)
          .attr("fill", "rgba(255,200,50,0.9)")
          .attr("pointer-events", "none");
      }
      if (wVertices.length > 1) {
        wPolyG.append("polyline")
          .attr("points", wVertices.map(([x, y]) => x + "," + y).join(" "))
          .attr("fill", "none").attr("stroke", "rgba(255,200,50,0.8)")
          .attr("stroke-width", 1.2).attr("stroke-dasharray", "5,3")
          .attr("pointer-events", "none");
      }
      if (wPreviewPt) {
        const [lx, ly] = wVertices[wVertices.length - 1];
        const [px, py] = wPreviewPt;
        wPolyG.append("line")
          .attr("x1", lx).attr("y1", ly).attr("x2", px).attr("y2", py)
          .attr("stroke", "rgba(255,200,50,0.35)").attr("stroke-width", 1.2)
          .attr("stroke-dasharray", "5,3").attr("pointer-events", "none");
      }
    }
  }

  function setDrawMode(active) {
    wDrawMode = active;
    if (active) {
      wSvg.on(".zoom", null);
      wSvg.style("cursor", "crosshair");
      polyBtn.style.background = "rgba(255,200,50,0.15)";
      polyBtn.style.color = "#ffc832";
      polyBtn.style.borderColor = "rgba(255,200,50,0.4)";
    } else {
      wVertices = [];
      wPreviewPt = null;
      enableZoom();
      const t = window.__wZoomSave;
      if (t && (t.k !== 1 || t.x !== 0 || t.y !== 0)) wSvg.call(wZoom.transform, t);
      polyBtn.style.background = "rgba(20,20,28,0.85)";
      polyBtn.style.color = "#aaa";
      polyBtn.style.borderColor = "rgba(255,255,255,0.15)";
    }
  }

  function closePolygon() {
    currentPoly = [...wVertices];  // update locally for immediate visual feedback
    clearBtn.style.display = "";
    setDrawMode(false);
    redrawPolyOverlay();
    onPolyChange(currentPoly); // propagate to Observable reactive graph
  }

  // Click: add vertex or snap-close
  wSvg.on("click.poly", function(event) {
    if (!wDrawMode) return;
    if (event.detail >= 2) return;
    event.stopPropagation();
    const [mx, my] = d3.pointer(event);
    const t = window.__wZoomSave || d3.zoomIdentity;
    const [bx, by] = t.invert([mx, my]);
    if (wVertices.length >= 3) {
      const [fx, fy] = t.apply(wVertices[0]);
      if (Math.hypot(mx - fx, my - fy) < 12) { closePolygon(); return; }
    }
    wVertices.push([bx, by]);
    redrawPolyOverlay();
  });

  // Double-click: close polygon
  wSvg.on("dblclick.poly", function(event) {
    if (!wDrawMode) return;
    event.stopPropagation();
    if (wVertices.length > 3) wVertices.pop();
    if (wVertices.length >= 3) closePolygon();
  });

  // Mouse move: preview line
  wSvg.on("mousemove.poly", function(event) {
    if (!wDrawMode || wVertices.length === 0) return;
    const [mx, my] = d3.pointer(event);
    const t = window.__wZoomSave || d3.zoomIdentity;
    wPreviewPt = t.invert([mx, my]);
    redrawPolyOverlay();
  });

  // Escape: cancel or clear
  const onKeyDown = e => {
    if (e.key !== "Escape") return;
    if (wDrawMode) { setDrawMode(false); redrawPolyOverlay(); }
    else if (currentPoly) {
      currentPoly = null;
      clearBtn.style.display = "none";
      redrawPolyOverlay();
      onPolyChange(null);
    }
  };
  document.addEventListener("keydown", onKeyDown);
  invalidation.then(() => document.removeEventListener("keydown", onKeyDown));

  // ── Toolbar buttons ───────────────────────────────────────────────────────
  const polyBtn = document.createElement("button");
  polyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="7,1 13,5 11,12 3,12 1,5"/></svg>`;
  polyBtn.title = "Draw polygon region filter  (Esc to cancel)";
  polyBtn.style.cssText = "position:absolute;top:6px;right:6px;z-index:10;background:rgba(20,20,28,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:3px;padding:5px 6px;cursor:pointer;color:#aaa;display:flex;align-items:center;line-height:1;";

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "✕";
  clearBtn.title = "Clear polygon filter  (Esc)";
  clearBtn.style.cssText = "position:absolute;top:6px;right:38px;z-index:10;background:rgba(20,20,28,0.85);border:1px solid rgba(255,200,50,0.4);border-radius:3px;padding:4px 6px;cursor:pointer;color:rgba(255,200,50,0.8);font-size:0.68rem;line-height:1;display:none;";

  if (currentPoly) clearBtn.style.display = "";

  polyBtn.addEventListener("click", () => {
    if (wDrawMode) { setDrawMode(false); redrawPolyOverlay(); }
    else setDrawMode(true);
  });

  clearBtn.addEventListener("click", () => {
    if (wDrawMode) setDrawMode(false);
    currentPoly = null;
    clearBtn.style.display = "none";
    redrawPolyOverlay();
    onPolyChange(null);
  });

  worldContainer.appendChild(polyBtn);
  worldContainer.appendChild(clearBtn);

  // Draw initial polygon overlay (if poly was passed in)
  redrawPolyOverlay();

  return worldContainer;
}
