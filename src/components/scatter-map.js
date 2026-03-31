import * as d3 from "npm:d3";

function axisQ(pa, pu) {
  return (pa >= 0 ? "A" : "P") + "x" + (pu >= 0 ? "U" : "P");
}

function clusterColor(pa, pu) {
  const angleDeg = Math.atan2(pu, pa) * (180 / Math.PI);
  const hue = ((50 - angleDeg) % 360 + 360) % 360;
  return `hsl(${hue.toFixed(1)}, 62%, 56%)`;
}

export function createScatterMap(filtered) {
  const N = 4;
  function sBinKey(r) {
    const pa = +r.axis_pa, pu = +r.axis_pu;
    const paCell = Math.min(Math.floor(Math.abs(pa) * N), N - 1);
    const puCell = Math.min(Math.floor(Math.abs(pu) * N), N - 1);
    const ie = +(r.axis_ie) > 0 ? "E" : "I";
    return axisQ(pa, pu) + `_${paCell}_${puCell}_${ie}`;
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

  const S = 480, SPAD = 36, SGS = S - SPAD * 2;
  const spx = pa => SPAD + (pa + 1) / 2 * SGS;
  const spy = pu => SPAD + (1 - (pu + 1) / 2) * SGS;

  const container = document.createElement("div");
  container.id = "scatter-container";
  container.innerHTML = `
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
    <svg id="scatter-svg-el"></svg>`;

  const sSvg = d3.select(container.querySelector("#scatter-svg-el"))
    .attr("width", S).attr("height", S)
    .attr("viewBox", `0 0 ${S} ${S}`);

  // Crosshair
  sSvg.append("line").attr("x1", spx(0)).attr("x2", spx(0)).attr("y1", SPAD).attr("y2", S - SPAD)
    .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1);
  sSvg.append("line").attr("x1", SPAD).attr("x2", S - SPAD).attr("y1", spy(0)).attr("y2", spy(0))
    .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1);

  // Shared tooltip (singleton via d3 join)
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

  for (const c of sClusters) {
    const px = spx(c.pa), py = spy(c.pu);
    const r = 5 + Math.sqrt(c.w / sMaxW) * 22;
    const color = clusterColor(c.pa, c.pu);
    const fillOp = 0.08 + ((c.ie + 1) / 2) * 0.52;

    sSvg.append("circle")
      .attr("cx", px).attr("cy", py).attr("r", r)
      .attr("fill", color).attr("fill-opacity", fillOp)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.55)
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

  return container;
}
