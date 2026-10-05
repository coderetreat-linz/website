// Conway's Game of Life in the page margins: a wrap-around world as large as the window.
// The reading column covers its middle, so spaceships fly out of one margin, pass behind
// the text and come back out of the other side. Oscillators sit in the margins, clear of
// the spaceship lanes, so the arranged scene runs forever unless a visitor disturbs it.
const Life = (() => {
  const pattern = (rows) => {
    const cells = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "O") cells.push([x, y]); }));
    return { w: rows[0].length, h: rows.length, cells };
  };
  const flipX = (p) => ({ ...p, cells: p.cells.map(([x, y]) => [p.w - 1 - x, y]) });
  const transpose = (p) => ({ w: p.h, h: p.w, cells: p.cells.map(([x, y]) => [y, x]) });

  // spaceships, all travelling left at c/2 in this orientation
  const LWSS = pattern([".O..O", "O....", "O...O", "OOOO."]);
  const MWSS = pattern(["...O..", ".O...O", "O.....", "O....O", "OOOOO."]);
  const HWSS = pattern(["...OO..", ".O....O", "O......", "O.....O", "OOOOOO."]);
  const SHIPS = [LWSS, MWSS, HWSS];

  // oscillators, each with the box it needs including every phase and two cells of air
  const PULSAR = pattern([
    "..OOO...OOO..",
    ".............",
    "O....O.O....O",
    "O....O.O....O",
    "O....O.O....O",
    "..OOO...OOO..",
    ".............",
    "..OOO...OOO..",
    "O....O.O....O",
    "O....O.O....O",
    "O....O.O....O",
    ".............",
    "..OOO...OOO..",
  ]);
  const PENTADECATHLON = transpose(pattern(["..O....O..", "OO.OOOO.OO", "..O....O.."]));
  const BEACON = pattern(["OO..", "O...", "...O", "..OO"]);
  const OSCILLATORS = [
    { p: PULSAR, w: 16, h: 19 },
    { p: PENTADECATHLON, w: 13, h: 20 },
    { p: BEACON, w: 8, h: 8 },
  ];

  const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]; // heads down-right

  function step(cur, next, cols, rows) {
    for (let y = 0; y < rows; y++) {
      const up = ((y + rows - 1) % rows) * cols, mid = y * cols, down = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const l = (x + cols - 1) % cols, r = (x + 1) % cols;
        const n = cur[up + l] + cur[up + x] + cur[up + r] + cur[mid + l] + cur[mid + r] +
          cur[down + l] + cur[down + x] + cur[down + r];
        next[mid + x] = n === 3 || (n === 2 && cur[mid + x]) ? 1 : 0;
      }
    }
  }

  // place the largest oscillator that fits a margin, centred in its box
  function fitting(width, preferred) {
    const order = preferred === 0 ? OSCILLATORS : [OSCILLATORS[1], OSCILLATORS[0], OSCILLATORS[2]];
    return order.find((o) => o.w <= width) || null;
  }

  // left / right: inclusive column ranges of the visible margins
  function build(cols, rows, left, right) {
    const grid = new Uint8Array(cols * rows);
    const put = (p, ox, oy) => {
      for (const [x, y] of p.cells) grid[((oy + y) % rows) * cols + ((ox + x) % cols)] = 1;
    };
    const leftW = left[1] - left[0] + 1, rightW = right[1] - right[0] + 1;

    let y = 1, band = 0, lane = 0;
    while (y < rows) {
      // a band of oscillators, one in each margin
      const a = fitting(leftW, band % 2), b = fitting(rightW, (band + 1) % 2);
      const h = Math.max(a ? a.h : 0, b ? b.h : 0);
      if (!h || y + h > rows) break;
      for (const [o, m] of [[a, left], [b, right]]) {
        if (!o) continue;
        const ox = m[0] + Math.floor((m[1] - m[0] + 1 - o.p.w) / 2);
        const oy = y + Math.floor((h - o.p.h) / 2);
        put(o.p, ox, oy);
      }
      y += h;
      band++;

      // a lane of spaceships under it, alternating direction and size
      const ship = SHIPS[lane % SHIPS.length];
      const laneH = ship.h + 6;
      if (y + laneH > rows) break;
      const p = lane % 2 ? flipX(ship) : ship;
      const count = Math.max(1, Math.floor(cols / 28));
      for (let i = 0; i < count; i++) put(p, Math.floor((i * cols) / count) + 3, y + 3);
      y += laneH;
      lane++;
    }
    return grid;
  }

  function glider(grid, cols, rows, cx, cy, dx, dy) {
    for (const [x, y] of GLIDER) {
      const gx = dx > 0 ? x : 2 - x, gy = dy > 0 ? y : 2 - y;
      grid[((cy - 1 + gy + rows) % rows) * cols + ((cx - 1 + gx + cols) % cols)] = 1;
    }
  }

  return { step, build, glider };
})();

if (typeof module !== "undefined") module.exports = Life;

// One glider, stepping slowly on a 5×5 field that wraps at the edges.
(() => {
  const svg = document.querySelector(".glider");
  if (!svg) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const N = 5;
  const NS = "http://www.w3.org/2000/svg";
  let cells = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];

  function step(live) {
    const alive = new Set(live.map(([x, y]) => x + "," + y));
    const next = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && alive.has(((x + dx + N) % N) + "," + ((y + dy + N) % N))) n++;
          }
        }
        const on = alive.has(x + "," + y);
        if (n === 3 || (on && n === 2)) next.push([x, y]);
      }
    }
    return next;
  }

  function draw() {
    svg.querySelectorAll(".on").forEach((r) => r.remove());
    for (const [x, y] of cells) {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "on");
      r.setAttribute("x", x * 10 + 1);
      r.setAttribute("y", y * 10 + 1);
      r.setAttribute("width", 8);
      r.setAttribute("height", 8);
      svg.appendChild(r);
    }
  }

  let timer = 0;
  let visible = true;

  function tick() {
    cells = step(cells);
    draw();
  }

  function sync() {
    const run = visible && !document.hidden;
    if (run && !timer) timer = setInterval(tick, 1200);
    if (!run && timer) { clearInterval(timer); timer = 0; }
  }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(svg);
  document.addEventListener("visibilitychange", sync);
  sync();
})();

// The margins: a live Game of Life field (see life.js). Wide screens only.
(() => {
  const canvas = document.querySelector(".life");
  const page = document.querySelector(".page");
  const toggle = document.querySelector(".life-toggle");
  if (!canvas || !page || typeof Life === "undefined") return;

  const wide = window.matchMedia("(min-width: 1100px)");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ctx = canvas.getContext("2d");
  const CELL = 20, INSET = 3, SIZE = 14, GAP = 70, TEMPO = 200, REST = 20000;
  const css = getComputedStyle(document.documentElement);
  const DEAD = "#eaedef";
  const LIVE = css.getPropertyValue("--green").trim() || "#2e6f4a";

  let cols = 0, rows = 0, x0 = 0, cur = null, next = null, fade = null;
  let left = [0, 0], right = [0, 0], colL = 0, colR = 0;
  let paused = false, timer = 0, raf = 0, dirty = true;
  let hover = -1, lastMove = 0, disturbed = false, last = { x: 0, y: 0 }, dir = { x: 1, y: 1 };
  let down = null, painted = false, restoreAt = 0, reveal = 1;

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // cell edges line up with the centre of the window, like the column
    x0 = ((w / 2) % CELL) - CELL;
    cols = Math.ceil((w - x0) / CELL) + 1;
    if (cols % 2) cols++;
    rows = Math.ceil(h / CELL) + 1;
    const r = page.getBoundingClientRect();
    colL = r.left - GAP;
    colR = r.right + GAP;
    left = [0, Math.floor((colL - x0) / CELL) - 1];
    right = [Math.ceil((colR - x0) / CELL), Math.floor((w - x0) / CELL) - 1];
    seed();
  }

  function seed() {
    cur = Life.build(cols, rows, left, right);
    next = new Uint8Array(cols * rows);
    fade = new Float32Array(cols * rows);
    disturbed = false;
    dirty = true;
  }

  const visibleCell = (x) => {
    const px = x0 + x * CELL;
    return px + CELL <= colL || px >= colR;
  };

  function draw() {
    dirty = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!visibleCell(x)) continue;
        const i = y * cols + x;
        const px = x0 + x * CELL + INSET, py = y * CELL + INSET;
        ctx.fillStyle = DEAD;
        ctx.fillRect(px, py, SIZE, SIZE);
        const a = cur[i] ? 0.5 * reveal : fade[i] * 0.22;
        if (a > 0.01) {
          ctx.globalAlpha = a;
          ctx.fillStyle = LIVE;
          ctx.fillRect(px, py, SIZE, SIZE);
          ctx.globalAlpha = 1;
        }
        if (i === hover) {
          ctx.strokeStyle = LIVE;
          ctx.lineWidth = 1;
          ctx.strokeRect(px - 0.5, py - 0.5, SIZE + 1, SIZE + 1);
        }
      }
    }
  }

  function tick() {
    for (let i = 0; i < cur.length; i++) fade[i] = cur[i] ? 1 : fade[i] * 0.45;
    Life.step(cur, next, cols, rows);
    [cur, next] = [next, cur];
    // after a disturbance, the arranged scene returns once the visitor leaves it alone
    if (disturbed && performance.now() > restoreAt) {
      seed();
      reveal = 0;
    }
    dirty = true;
  }

  function frame() {
    raf = 0;
    if (reveal < 1) { reveal = Math.min(1, reveal + 0.04); dirty = true; }
    if (dirty) draw();
    if (reveal < 1) raf = requestAnimationFrame(frame);
  }
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function running() {
    return wide.matches && !still.matches && !paused && !document.hidden;
  }

  function sync() {
    if (running() && !timer) timer = setInterval(() => { tick(); request(); }, TEMPO);
    if (!running() && timer) { clearInterval(timer); timer = 0; }
    if (toggle) {
      toggle.hidden = still.matches;
      toggle.textContent = paused ? "Resume" : "Pause";
      toggle.setAttribute("aria-pressed", String(paused));
    }
  }

  // pointer: hover marks a cell, a click drops a glider heading the way the mouse moved,
  // dragging draws live cells
  function cellAt(e) {
    if (e.clientX > colL && e.clientX < colR) return null;
    const x = Math.floor((e.clientX - x0) / CELL), y = Math.floor(e.clientY / CELL);
    if (x < 0 || x >= cols || y < 0 || y >= rows || !visibleCell(x)) return null;
    return { x, y };
  }
  const interactive = () => wide.matches && !still.matches;

  function disturb() {
    disturbed = true;
    restoreAt = performance.now() + REST;
    dirty = true;
    request();
  }

  window.addEventListener("pointermove", (e) => {
    if (!interactive()) return;
    const c = cellAt(e);
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dir = { x: dx >= 0 ? 1 : -1, y: dy >= 0 ? 1 : -1 };
    last = { x: e.clientX, y: e.clientY };
    const h = c ? c.y * cols + c.x : -1;
    document.documentElement.classList.toggle("over-life", !!c);
    if (down && c && h !== hover) {
      cur[h] = 1;
      painted = true;
      disturb();
    }
    if (h !== hover) { hover = h; dirty = true; request(); }
  }, { passive: true });

  window.addEventListener("pointerdown", (e) => {
    if (!interactive() || e.button !== 0) return;
    const c = cellAt(e);
    if (!c) return;
    e.preventDefault();
    down = c;
    painted = false;
  });

  window.addEventListener("pointerup", () => {
    if (down && !painted) {
      Life.glider(cur, cols, rows, down.x, down.y, dir.x, dir.y);
      disturb();
    }
    down = null;
  });

  document.documentElement.addEventListener("pointerleave", () => {
    hover = -1;
    document.documentElement.classList.remove("over-life");
    dirty = true;
    request();
  });

  if (toggle) toggle.addEventListener("click", () => { paused = !paused; sync(); });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (wide.matches) { layout(); request(); } }, 150);
  });
  wide.addEventListener("change", () => { if (wide.matches) { layout(); request(); } sync(); });
  still.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);

  document.fonts.ready.then(() => {
    if (wide.matches) layout();
    request();
    sync();
  });
})();
