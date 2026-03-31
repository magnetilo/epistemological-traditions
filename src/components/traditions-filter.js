import * as Inputs from "npm:@observablehq/inputs";

// ── SVG-based RangeSlider (inspired by @jonhelfman/hello-multi-range-slider) ─
// Handles and fill are drawn in SVG so positions are always pixel-exact.
class RangeSlider {
  constructor(target, opts = {}) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    const {
      values      = [0, 100],
      min         = 0,
      max         = 100,
      step        = 1,
      pointRadius = 7,
      railHeight  = 3,
      trackHeight = 3,
      colors      = { points: "#ccc", rail: "rgba(255,255,255,0.15)", tracks: "#ccc" }
    } = opts;

    this._min    = min;
    this._max    = max;
    this._step   = step;
    this._values = [...values];
    this._pr     = pointRadius;
    this._rh     = railHeight;
    this._th     = trackHeight;
    this._colors = colors;
    this._onChange = null;

    this._H = Math.max(pointRadius * 2 + 6, 22);

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", this._H);
    svg.style.cssText = "display:block;overflow:visible;cursor:default;";

    const mkRect = () => {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("rx", "2");
      return r;
    };

    this._rail  = mkRect();
    this._track = mkRect();
    this._track.style.cursor = "grab";
    svg.appendChild(this._rail);
    svg.appendChild(this._track);

    // Small center square — drag handle for panning the whole range
    const sq = document.createElementNS(NS, "rect");
    sq.setAttribute("rx", "2");
    sq.style.cursor = "grab";
    sq.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.5))";
    sq.style.transition = "opacity 0.15s";
    svg.appendChild(sq);
    this._midSquare = sq;

    this._circles = values.map((_, i) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", pointRadius);
      c.style.fill = Array.isArray(colors.points)
        ? colors.points[i % colors.points.length]
        : colors.points;
      c.style.cursor = "grab";
      c.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.5))";
      svg.appendChild(c);
      return c;
    });

    el.appendChild(svg);
    this._svg = svg;

    // Initial draw + responsive redraws
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this._draw()).observe(svg);
    }

    // Drag handles
    this._circles.forEach((c, i) => {
      c.addEventListener("mousedown",  (e) => this._drag(e, i));
      c.addEventListener("touchstart", (e) => this._drag(e, i), { passive: false });
    });

    // Drag the filled track or center square to shift both handles together
    this._track.addEventListener("mousedown",  (e) => this._dragRange(e));
    this._track.addEventListener("touchstart", (e) => this._dragRange(e), { passive: false });
    this._midSquare.addEventListener("mousedown",  (e) => this._dragRange(e));
    this._midSquare.addEventListener("touchstart", (e) => this._dragRange(e), { passive: false });
  }

  _snap(v) {
    const s = this._step;
    return Math.round((Math.min(Math.max(v, this._min), this._max) - this._min) / s) * s + this._min;
  }

  _xOf(v) {
    const W = this._svg.getBoundingClientRect().width || this._svg.clientWidth || 0;
    return this._pr + (v - this._min) / (this._max - this._min) * (W - 2 * this._pr);
  }

  _vOf(x) {
    const W = this._svg.getBoundingClientRect().width || this._svg.clientWidth || 0;
    return this._snap((x - this._pr) / (W - 2 * this._pr) * (this._max - this._min) + this._min);
  }

  _draw() {
    const W  = this._svg.getBoundingClientRect().width || this._svg.clientWidth || 0;
    if (!W) return;
    const cy = this._H / 2;

    this._rail.setAttribute("x",      this._pr);
    this._rail.setAttribute("y",      cy - this._rh / 2);
    this._rail.setAttribute("width",  W - 2 * this._pr);
    this._rail.setAttribute("height", this._rh);
    this._rail.style.fill = Array.isArray(this._colors.rail)
      ? this._colors.rail[0] : this._colors.rail;

    const xs = this._values.map(v => this._pr + (v - this._min) / (this._max - this._min) * (W - 2 * this._pr));

    this._track.setAttribute("x",      xs[0]);
    this._track.setAttribute("y",      cy - this._th / 2);
    this._track.setAttribute("width",  Math.max(0, xs[xs.length - 1] - xs[0]));
    this._track.setAttribute("height", this._th);
    this._track.style.fill = Array.isArray(this._colors.tracks)
      ? this._colors.tracks[0] : this._colors.tracks;

    this._circles.forEach((c, i) => {
      c.setAttribute("cx", xs[i]);
      c.setAttribute("cy", cy);
    });

    // Center square: 8×8, midpoint between the two handles
    const SQ = 8;
    const midX = (xs[0] + xs[xs.length - 1]) / 2;
    this._midSquare.setAttribute("x",      midX - SQ / 2);
    this._midSquare.setAttribute("y",      cy   - SQ / 2);
    this._midSquare.setAttribute("width",  SQ);
    this._midSquare.setAttribute("height", SQ);
    const trackColor = Array.isArray(this._colors.tracks) ? this._colors.tracks[0] : this._colors.tracks;
    this._midSquare.style.fill = trackColor;
    // Hide when the two handles coincide
    this._midSquare.style.opacity = (xs[xs.length - 1] - xs[0]) > SQ * 2 ? "1" : "0";
  }

  _drag(e, idx) {
    e.preventDefault();
    const svg = this._svg;
    const onMove = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const rect = svg.getBoundingClientRect();
      let v = this._vOf(cx - rect.left);
      if (idx > 0) v = Math.max(v, this._values[idx - 1]);
      if (idx < this._values.length - 1) v = Math.min(v, this._values[idx + 1]);
      this._values[idx] = v;
      this._draw();
      if (this._onChange) this._onChange([...this._values]);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend",  onUp);
  }

  _dragRange(e) {
    e.preventDefault();
    e.stopPropagation();
    const svg       = this._svg;
    const startX    = e.touches ? e.touches[0].clientX : e.clientX;
    const startVals = [...this._values];
    this._track.style.cursor = "grabbing";
    this._midSquare.style.cursor = "grabbing";
    const onMove = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const W  = svg.getBoundingClientRect().width || svg.clientWidth || 0;
      if (!W) return;
      // Convert pixel delta to value delta
      const dv    = (cx - startX) / (W - 2 * this._pr) * (this._max - this._min);
      const span  = startVals[startVals.length - 1] - startVals[0];
      // Clamp so the whole range stays within [min, max]
      const lo    = this._snap(Math.max(this._min, Math.min(startVals[0] + dv, this._max - span)));
      const shift = lo - startVals[0];
      this._values = startVals.map(v => this._snap(v + shift));
      this._draw();
      if (this._onChange) this._onChange([...this._values]);
    };
    const onUp = () => {
      this._track.style.cursor = "grab";
      this._midSquare.style.cursor = "grab";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend",  onUp);
  }

  onChange(fn) { this._onChange = fn; return this; }
  get values()      { return [...this._values]; }
  set values(vals)  { this._values = [...vals]; this._draw(); }
}

// ── Year range input wrapping RangeSlider as an Observable-compatible input ──
// toLabel(sliderVal) → display string; if null, treats sliderVal as a year directly.
export function createYearRangeInput(minVal = -40000, maxVal = 2000, step = 500, toLabel = null) {
  // Inject label-row styles once
  const styleId = "__yr-row-style";
  if (typeof document !== "undefined" && !document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = `
      .yr-row { display: flex; align-items: center; gap: 0.75rem;
        font-family: var(--sans-serif, sans-serif); font-size: 0.85rem; padding: 0.2rem 0; }
      .yr-lbl { flex: 0 0 120px; color: var(--theme-foreground, #ffffff); }
      .yr-body { display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0; }
      .yr-svg-wrap { flex: 0 0 300px; width: 300px; min-width: 0; }
      .yr-vals { flex: 0 0 auto; font-family: 'JetBrains Mono', monospace;
        font-size: 0.65rem; color: var(--theme-foreground, #ffffff); white-space: nowrap; }
    `;
    document.head.appendChild(s);
  }

  function fmtY(y) {
    if (y < 0) return Math.abs(y) + " BCE";
    if (y < 1000) return "~" + y + " CE";
    return String(y);
  }

  const labelOf = toLabel ?? fmtY;

  const container = document.createElement("div");
  container.className = "yr-row";
  container.innerHTML = `
    <span class="yr-lbl">Year range</span>
    <div class="yr-body">
      <div class="yr-svg-wrap"></div>
      <span class="yr-vals">${labelOf(minVal)} – ${labelOf(maxVal)}</span>
    </div>
  `;

  const svgWrap = container.querySelector(".yr-svg-wrap");
  const valsEl  = container.querySelector(".yr-vals");

  const rs = new RangeSlider(svgWrap, {
    values: [minVal, maxVal],
    min: minVal,
    max: maxVal,
    step,
    pointRadius: 7,
    railHeight:  3,
    trackHeight: 3,
    colors: {
      points: "#b6b6b6",
      rail:   "rgba(255,255,255,0.10)",
      tracks: "#b6b6b6"
    }
  });

  rs.onChange(([lo, hi]) => {
    valsEl.textContent = labelOf(lo) + " – " + labelOf(hi);
    container.dispatchEvent(new Event("input", { bubbles: true }));
  });

  Object.defineProperty(container, "value", {
    get() { return rs.values; },
    set([lo, hi]) { rs.values = [lo, hi]; valsEl.textContent = fmtY(lo) + " – " + fmtY(hi); }
  });

  return container;
}

// ── Input widgets ────────────────────────────────────────────────────────────
// Call view() on each in the page: const quadrant = view(filters.quadrant);

// yearFit: optional object from fitYearExponential(raw) — { minVal, maxVal, step, fromSlider }
export function createFilterInputs(yearFit = null) {
  const yrMin  = yearFit ? yearFit.minVal : -40000;
  const yrMax  = yearFit ? yearFit.maxVal :  2000;
  const yrStep = yearFit ? yearFit.step   :  500;
  const toLabel = yearFit
    ? (v) => { const y = Math.round(yearFit.fromSlider(v)); return y < 0 ? Math.abs(y) + " BCE" : y < 1000 ? "~" + y + " CE" : String(y); }
    : null;
  return {
    quadrant: Inputs.radio(
      ["all", "PxU", "AxU", "PxP", "AxP"],
      {label: "Quadrant", value: "all", format: d => d === "all" ? "All" : d.replace("x", "×")}
    ),
    field: Inputs.radio(
      ["all", "Science", "Philosophy", "Art", "Spirituality"],
      {label: "Field", value: "all", format: d => d === "all" ? "All" : d}
    ),
    attitude: Inputs.radio(
      ["all", "I", "E", "I/E"],
      {label: "Attitude (Jungian)", value: "all", format: d => d.replace("all", "All").replace("I", "Introverted").replace("E", "Extraverted")}
    ),
    search: Inputs.text({
      label: "Search",
      placeholder: "movement, individual, region…",
      width: 260
    }),
    // sort: Inputs.select(
    //   ["year", "weight", "movement", "region", "attitude"],
    //   {label: "Sort", value: "year"}
    // ),
    yearRange: createYearRangeInput(yrMin, yrMax, yrStep, toLabel)
  };
}

// ── Helper functions ─────────────────────────────────────────────────────────

export function axisQuadrant(r) {
  return (+r.axis_pa >= 0 ? "A" : "P") + "x" + (+r.axis_pu >= 0 ? "U" : "P");
}

export function quadrantLabel(q) {
  return {
    PxU: "P × Universal ↖",
    AxU: "A × Universal ↗",
    PxP: "P × Particular ↙",
    AxP: "A × Particular ↘"
  }[q] || q;
}

export function formatYear(y) {
  if (y < 0) return Math.abs(y) + " BCE";
  if (y < 1000) return "~" + y + " CE";
  return y.toString();
}

// ── Filter + sort ────────────────────────────────────────────────────────────

// yearFit: optional object from fitYearExponential — if provided, yearRange values are
// in transformed slider space and are inverted to actual years before filtering.
export function filterData(raw, {quadrant, field, attitude, search, yearRange, yearFit = null, geoFilter = null}) {
  const raw2 = yearRange ?? [-Infinity, Infinity];
  const yLo = yearFit ? yearFit.fromSlider(raw2[0]) : raw2[0];
  const yHi = yearFit ? yearFit.fromSlider(raw2[1]) : raw2[1];
  return raw
    .filter(r => quadrant === "all" || axisQuadrant(r) === quadrant)
    .filter(r => field === "all" || r.field === field)
    .filter(r => attitude === "all" || r.attitude === attitude)
    .filter(r => +r.year >= yLo && +r.year <= yHi)
    .filter(r => !geoFilter || geoFilter(r))
    .filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      return [r.movement, r.individuals, r.region, r.field].some(v => v?.toLowerCase().includes(s));
    })
    // .sort((a, b) => {
    //   const va = typeof a[sort] === "string" ? a[sort].toLowerCase() : a[sort];
    //   const vb = typeof b[sort] === "string" ? b[sort].toLowerCase() : b[sort];
    //   return va < vb ? -1 : va > vb ? 1 : 0;
    // });
}
