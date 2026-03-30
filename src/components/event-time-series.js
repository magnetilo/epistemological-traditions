// ── Exponential fit for year-axis slider transformation ──────────────────────
//
// Replicates the following Python logic:
//   cumulative_sum = 0.1 * full_data["weight"].cumsum()         (sorted by year)
//   fit_mask_lin   = cumulative_sum.index >= -4000
//   slope, intercept = np.polyfit(x_lin, np.log(cumsum_lin), 1)
//   a_lr, b_lr = np.exp(intercept), slope
//
// The slider operates in transformed space:
//   sliderVal = a * exp(b * year)       (toSlider)
//   year      = log(sliderVal / a) / b  (fromSlider)
//
// This maps the historically sparse ancient years to a small slider range
// and gives proportionally more slider resolution to recent centuries.

export function fitYearExponential(raw) {
  // 1. Sort rows by year, drop rows without year or weight
  const sorted = raw
    .filter(r => r.year != null && !isNaN(+r.year) && r.weight != null && !isNaN(+r.weight))
    .sort((a, b) => +a.year - +b.year);

  // 2. Compute cumulative sum of weights × 0.1
  let cum = 0;
  const points = sorted.map(r => {
    cum += +r.weight;
    return { year: +r.year, cumSum: 0.1 * cum };
  });

  // 3. Keep only points where year >= -4000 and cumSum > 0
  const fit = points.filter(p => p.year >= -4000 && p.cumSum > 0);

  // 4. OLS on log(cumSum) ~ year  →  log(cumSum) = b*year + log(a)
  const n   = fit.length;
  const xs  = fit.map(p => p.year);
  const lys = fit.map(p => Math.log(p.cumSum));

  const sumX  = xs.reduce((s, x) => s + x, 0);
  const sumY  = lys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * lys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const a = Math.exp((sumY - b * sumX) / n);

  // 5. Slider range in transformed space
  const years   = points.map(p => p.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const toSlider   = (year) => a * Math.exp(b * year);
  const fromSlider = (val)  => Math.log(val / a) / b;

  const minVal = toSlider(minYear);
  const maxVal = toSlider(maxYear);

  // 500 discrete steps across the transformed range
  const step = (maxVal - minVal) / 500;

  return { a, b, minVal, maxVal, step, minYear, maxYear, toSlider, fromSlider };
}
