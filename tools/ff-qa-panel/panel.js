const $ = (id) => document.getElementById(id);

async function readProbeSnapshot() {
  const src = `
    (function() {
      try {
        const w = window;
        const ns = w.__probe || {};
        const key = Object.keys(ns)[0] || null;
        const boot = w.__probeBoot || null;
        return {
          symbol: key,
          stage: key ? (ns[key].bootStage ?? null) : null,
          series: key ? (ns[key].seriesCount ?? 0) : 0,
          econ: key ? (ns[key].econEventCount ?? 0) : 0,
          markers: key ? (ns[key].econMarkerCount ?? 0) : 0,
          gate: boot?.gate ?? null
        };
      } catch (e) {
        return { error: String(e) };
      }
    })();
  `;
  const res = await browser.devtools.inspectedWindow.eval(src);
  return res && Array.isArray(res) ? (res[0] || {}) : (res || {});
}

async function tick() {
  try {
    const s = await readProbeSnapshot();
    if (s && s.error) {
      $('stage').textContent = 'error';
    } else {
      $('sym').textContent = s.symbol ?? '—';
      $('stage').textContent = s.stage ?? '—';
      $('series').textContent = s.series ?? 0;
      $('econ').textContent = s.econ ?? 0;
      $('markers').textContent = s.markers ?? 0;
      $('gate').textContent = s.gate ?? '—';
    }
  } catch (e) {
    // keep polling
  } finally {
    setTimeout(tick, 400);
  }
}
tick();
