/* =========================================================================
   Petualangan Nihongo — mini game (v3.0)
   - Satu <canvas> resolusi kecil (160×120) yang diperbesar → ringan di HP.
   - Dunia (gedung, jalan, latar) digambar SEKALI ke kanvas offscreen,
     tiap frame cukup ditempel + karakter digambar. Loop berhenti kalau
     game ditutup atau tab disembunyikan.
   - Aset: Kenney "Tiny City" & "Pixel Platformer: Farm Expansion" (CC0).
   - Isi stage ada di stages.json (bisa ditambah tanpa ngoding).
   ========================================================================= */
(function () {
  "use strict";
  const SCRIPT = document.currentScript;
  const SRC = SCRIPT ? SCRIPT.src : "game/game.js";
  const BASE = SRC.replace(/[^/?#]*([?#].*)?$/, "");
  const VER = (SRC.split("?v=")[1] || "").split("&")[0];
  const url = (f) => BASE + f + (VER ? "?v=" + encodeURIComponent(VER) : "");

  const W = 160, H = 120, T = 16;
  const WALK_Y = 88;          // atas trotoar
  const FEET = 100;           // garis kaki karakter
  const SPEED = 34;           // px/detik
  const NPC_GAP = 132;
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- gambar & warna ---------------- */
  const IMG = {};
  function loadImg(k, f) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = url(f); });
  }
  const CITY_COLS = 12, FARM_COLS = 16;
  function city(ctx, t, x, y) { ctx.drawImage(IMG.city, (t % CITY_COLS) * 16, Math.floor(t / CITY_COLS) * 16, 16, 16, Math.round(x), Math.round(y), 16, 16); }
  function farm(ctx, t, x, y) { ctx.drawImage(IMG.farm, (t % FARM_COLS) * 18, Math.floor(t / FARM_COLS) * 18, 18, 18, Math.round(x), Math.round(y), 18, 18); }

  const rgb = (a) => a.join(",");
  const HAIR = {
    coklat: null,
    abu: [[200, 200, 210], [140, 140, 152]],
    hitam: [[74, 64, 80], [46, 40, 52]],
  };
  const BAJU = {
    ungu: [[176, 128, 210], [120, 80, 160]], merah: [[232, 98, 88], [170, 60, 55]],
    hijau: [[120, 190, 120], [70, 135, 80]], biru: [[110, 160, 230], [64, 105, 175]],
    kuning: [[245, 205, 90], [195, 150, 50]], putih: [[238, 238, 242], [182, 188, 202]],
    jas: [[78, 86, 112], [50, 56, 78]], pink: null,
  };
  const SERAGAM = { // untuk sprite w (3 nada)
    polisi: null,
    konbini: [[70, 165, 110], [40, 120, 80], [120, 205, 150]],
    super: [[238, 140, 60], [190, 95, 35], [250, 185, 110]],
  };
  const BASE_TILE = { f: 108, m: 120, w: 121 };
  const spriteCache = {};
  function sprite(spec) {
    const key = [spec.sprite, spec.rambut, spec.baju].join("|");
    if (spriteCache[key]) return spriteCache[key];
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const x = c.getContext("2d");
    city(x, BASE_TILE[spec.sprite] || 120, 0, 0);
    const d = x.getImageData(0, 0, 16, 16), p = d.data;
    const hair = HAIR[spec.rambut], baju = BAJU[spec.baju], sg = SERAGAM[spec.baju];
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const y = (i / 4) >> 4, col = rgb([p[i], p[i + 1], p[i + 2]]);
      let to = null;
      if (spec.sprite === "f") {
        if (hair && col === "189,108,74") to = hair[0];
        else if (hair && col === "118,59,54") to = hair[1];
        else if (baju && col === "242,132,98") to = baju[0];
        else if (baju && col === "195,75,53") to = baju[1];
      } else if (spec.sprite === "m") {
        if (hair && y < 9 && col === "189,108,74") to = hair[0];
        else if (hair && y < 9 && col === "118,59,54") to = hair[1];
        else if (baju && col === "192,203,220") to = baju[0];
        else if (baju && col === "139,155,180") to = baju[1];
      } else if (spec.sprite === "w" && sg) {
        if (col === "79,116,156") to = sg[0];
        else if (col === "61,87,130") to = sg[1];
        else if (col === "99,139,182") to = sg[2];
      }
      if (to) { p[i] = to[0]; p[i + 1] = to[1]; p[i + 2] = to[2]; }
    }
    x.putImageData(d, 0, 0);
    return (spriteCache[key] = c);
  }

  /* ---------------- gedung (tile Tiny City) ---------------- */
  const ROOF = { brown: [[0, 1, 2], [12, 13, 14], [24, 25, 26]], blue: [[6, 7, 8], [18, 19, 20], [30, 31, 32]] };
  function rowOf(l, m, r, w) { const a = [l]; for (let i = 0; i < w - 2; i++) a.push(m); a.push(r); return a; }
  function drawBuilding(ctx, x, b) {
    // b: {w, roof, wall, floors, roofRows, door:"single"|"double"|"shop", sign}
    const rows = [];
    const R = ROOF[b.roof];
    const rr = b.roofRows || 2;
    rows.push(rowOf(R[0][0], R[0][1], R[0][2], b.w));
    if (rr === 3) rows.push(rowOf(R[1][0], R[1][1], R[1][2], b.w));
    rows.push(rowOf(R[2][0], R[2][1], R[2][2], b.w));
    const red = b.wall === "red";
    for (let f = 0; f < (b.floors || 1); f++) {
      const r = [red ? 36 : 42];
      for (let i = 1; i < b.w - 1; i++) r.push(i % 2 ? (red ? 40 : 46) : (red ? 37 : 44));
      r.push(red ? 41 : 47); rows.push(r);
    }
    const bot = [red ? 48 : 54];
    for (let i = 1; i < b.w - 1; i++) bot.push(red ? 49 : 55);
    bot.push(red ? 53 : 59);
    const mid = Math.floor(b.w / 2);
    if (b.door === "double" && red) { bot[mid - 1] = 50; bot[mid] = 51; }
    else if (b.door === "shop") { bot[1] = 56; bot[2] = 57; bot[b.w - 2] = 58; if (b.w > 5) { bot[3] = 56; bot[4] = 57; } }
    else bot[mid] = red ? 52 : 58;
    rows.push(bot);
    const top = WALK_Y - rows.length * T;
    rows.forEach((r, yi) => r.forEach((t, xi) => city(ctx, t, x + xi * T, top + yi * T)));
    if (b.sign) {
      const sx = x + 4, sy = top + (rr) * T + 2, sw = b.w * T - 8;
      ctx.fillStyle = b.signBg || "#2E7D5B"; ctx.fillRect(sx, sy, sw, 11);
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(sx, sy, sw, 2);
      ctx.fillStyle = "#3F2631"; ctx.fillRect(sx, sy + 11, sw, 1);
      ctx.fillStyle = "#fff"; ctx.font = "9px 'DotGothic16', 'Zen Maru Gothic', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.sign, sx + sw / 2, sy + 6);
    }
    return { x, w: b.w * T, door: x + (b.door === "shop" ? (b.w - 2) * T + 8 : mid * T + (b.door === "double" ? 0 : 8)) };
  }

  /* ---------------- tema lokasi ---------------- */
  const THEME = {
    desa: { sky: ["#F4B98A", "#FBE3C4"], far: "hills", houses: [
      { w: 4, roof: "brown", wall: "red", door: "single" }, { w: 3, roof: "blue", wall: "brown", door: "single" },
      { w: 4, roof: "brown", wall: "brown", door: "single" }, { w: 3, roof: "brown", wall: "red", door: "single" } ], yard: "farm" },
    kota: { sky: ["#7DB7EC", "#D6ECFB"], far: "skyline", houses: [
      { w: 4, roof: "blue", wall: "brown", door: "shop" }, { w: 3, roof: "brown", wall: "red", door: "single", floors: 2 },
      { w: 5, roof: "blue", wall: "red", door: "double" }, { w: 3, roof: "blue", wall: "brown", door: "single", floors: 2 } ], yard: "city" },
    kantor: { sky: ["#A9CBEB", "#EEF5FB"], far: "towers", houses: [
      { w: 4, roof: "blue", wall: "brown", door: "single", floors: 3, roofRows: 2 }, { w: 5, roof: "blue", wall: "red", door: "double", floors: 3 },
      { w: 3, roof: "brown", wall: "brown", door: "single", floors: 3 }, { w: 4, roof: "blue", wall: "red", door: "double", floors: 3 } ], yard: "office" },
  };
  const DEST = {
    konbini: { w: 5, roof: "blue", wall: "brown", door: "shop", sign: "コンビニ", signBg: "#2E9A63" },
    super: { w: 7, roof: "brown", wall: "brown", door: "shop", sign: "スーパー", signBg: "#E07A2E", roofRows: 3 },
    kaisha: { w: 6, roof: "blue", wall: "red", door: "double", floors: 3, sign: "にほんご かいしゃ", signBg: "#2B4C8C" },
  };

  function buildFar(theme, w) {
    const c = document.createElement("canvas"); c.width = w; c.height = H; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, w, H);
    // awan kotak
    x.fillStyle = "rgba(255,255,255,.75)";
    for (let i = 0; i < w; i += 90) { const cy = 10 + ((i * 7) % 18); x.fillRect(i + 8, cy, 30, 5); x.fillRect(i + 14, cy - 4, 16, 4); x.fillRect(i + 4, cy + 5, 40, 4); }
    if (theme.far === "hills") {
      x.globalAlpha = .6;
      const pat = [2, 3, 3, 4, 4, 3, 2, 2, 3, 4, 5, 5, 4, 3, 2, 3];
      for (let i = 0; i * 18 < w; i++) {
        const h = pat[i % pat.length], X = i * 18;
        for (let j = 0; j < h; j++) farm(x, j === h - 1 ? 1 + (i % 2) : 32 + (i % 4), X, WALK_Y - (j + 1) * 18 + 10);
        if (i % 5 === 2) { farm(x, 20, X, WALK_Y - (h + 1) * 18 + 10); }
      }
      x.globalAlpha = 1;
    } else {
      x.globalAlpha = theme.far === "towers" ? .32 : .26;
      for (let X = 0; X < w; X += 52) {
        const fl = theme.far === "towers" ? 4 + (X / 52) % 3 : 2 + (X / 52) % 2;
        drawBuildingAt(x, X, { w: 3, roof: "blue", wall: (X / 52) % 2 ? "red" : "brown", door: "single", floors: fl }, WALK_Y - 6);
      }
      x.globalAlpha = 1;
    }
    return c;
  }
  function drawBuildingAt(ctx, x, b, baseY) { ctx.save(); ctx.translate(0, baseY - WALK_Y); drawBuilding(ctx, x, b); ctx.restore(); }

  function buildWorld(stage) {
    const theme = THEME[stage.lokasi] || THEME.kota;
    const npcX = stage.tetangga.map((_, i) => 120 + i * NPC_GAP);
    const destSpec = DEST[stage.tujuan.gedung] || DEST.konbini;
    const destX = npcX[npcX.length - 1] + 110;
    const worldW = destX + destSpec.w * T + 80;
    const c = document.createElement("canvas"); c.width = worldW; c.height = H; const x = c.getContext("2d");
    // gedung berjejer + halaman di sela
    let X = -8, k = 0;
    while (X < destX - 40) {
      const spec = theme.houses[k % theme.houses.length];
      if (X + spec.w * T > destX - 8) break;
      drawBuilding(x, X, spec);
      X += spec.w * T;
      const gap = 20 + ((k * 13) % 3) * 8;
      decorYard(x, theme.yard, X, gap, k);
      X += gap; k++;
    }
    const dest = drawBuilding(x, destX, destSpec);
    // trotoar & jalan
    for (let i = 0; i * T < worldW; i++) { city(x, 88, i * T, WALK_Y); city(x, i % 4 === 1 ? 64 : 63, i * T, WALK_Y + T); }
    // tiang lampu & pohon di trotoar
    for (let i = 60; i < worldW - 40; i += 96) {
      if (Math.abs(i - destX - destSpec.w * 8) < 60) continue;
      if ((i / 96) % 2 < 1) { city(x, 86, i, WALK_Y - 14); city(x, 98, i, WALK_Y - 2); }
      else { city(x, 68, i, WALK_Y - 22); city(x, 80, i, WALK_Y - 8); }
    }
    return { canvas: c, w: worldW, npcX, dest, destX, destSpec, far: buildFar(theme, Math.ceil(worldW * 0.35) + W) };
  }
  function decorYard(x, kind, X, gap, k) {
    const base = WALK_Y;
    if (kind === "farm") {
      city(x, 105, X, base - 14); for (let i = 16; i < gap - 8; i += 16) city(x, 106, X + i, base - 14);
      const crops = [4, 56, 57, 74, 73];
      for (let i = 2; i < gap - 6; i += 11) farm(x, crops[(k + i) % crops.length], X + i - 2, base - 18);
      if (k % 2) { farm(x, 36, X + 2, base - 36); farm(x, 20, X + 2, base - 52); }
    } else if (kind === "city") {
      if (k % 2) { city(x, 81, X + 2, base - 12); } else { city(x, 69, X + 4, base - 14); }
    } else {
      city(x, 71, X + 4, base - 14);
    }
  }

  /* ---------------- emote kecil ---------------- */
  function emote(ctx, kind, x, y, t) {
    const b = Math.round(Math.sin(t * 6) * 1);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y + b));
    if (kind === "!") {
      ctx.fillStyle = "#fff"; ctx.fillRect(-4, -11, 9, 11); ctx.fillStyle = "#3F2631"; ctx.fillRect(-5, -10, 1, 9); ctx.fillRect(5, -10, 1, 9); ctx.fillRect(-4, -12, 9, 1); ctx.fillRect(-4, 0, 9, 1);
      ctx.fillStyle = "#E5484D"; ctx.fillRect(0, -9, 1, 5); ctx.fillRect(0, -3, 1, 1);
    } else if (kind === "heart") {
      ctx.fillStyle = "#F0507A"; [[-3, -6, 2, 1], [1, -6, 2, 1], [-4, -5, 8, 2], [-3, -3, 6, 1], [-2, -2, 4, 1], [-1, -1, 2, 1]].forEach(r => ctx.fillRect(r[0], r[1], r[2], r[3]));
      ctx.fillStyle = "#FFC2D4"; ctx.fillRect(-2, -5, 1, 1);
    } else if (kind === "angry") {
      ctx.fillStyle = "#E5484D"; [[-4, -7, 2, 3], [2, -7, 2, 3], [-4, -1, 2, 3], [2, -1, 2, 3], [-2, -5, 1, 1], [1, -5, 1, 1], [-2, -2, 1, 1], [1, -2, 1, 1]].forEach(r => ctx.fillRect(r[0], r[1], r[2], r[3]));
    } else if (kind === "note") {
      ctx.fillStyle = "#3F2631"; ctx.fillRect(1, -9, 1, 7); ctx.fillRect(2, -9, 3, 1); ctx.fillRect(-1, -3, 3, 2);
    } else if (kind === "sweat") {
      ctx.fillStyle = "#6CB8EE"; ctx.fillRect(0, -6, 2, 3); ctx.fillRect(-1, -4, 4, 3);
    }
    ctx.restore();
  }

  /* ---------------- CSS (khusus game) ---------------- */
  const CSS = `
  .g-wrap{ display:flex; flex-direction:column; gap:10px; }
  .g-top{ display:flex; align-items:center; gap:8px; }
  .g-top .g-title{ flex:1; min-width:0; font-family:'DotGothic16', var(--f-head); font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .g-hearts{ font-size:16px; letter-spacing:1px; color:#E5484D; white-space:nowrap; }
  .g-hearts .off{ color:var(--line); }
  .g-coin{ font-size:12.5px; font-weight:700; color:var(--amber-dark); background:var(--card); border:1px solid var(--line); border-radius:999px; padding:3px 9px; white-space:nowrap; }
  .g-screen{ position:relative; border-radius:14px; overflow:hidden; border:3px solid #3F2631; box-shadow:0 6px 0 rgba(0,0,0,.18); background:#222; }
  .g-screen canvas{ display:block; width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
  .g-screen.shake{ animation:gShake .35s; }
  @keyframes gShake{ 20%{ transform:translateX(-5px); } 40%{ transform:translateX(5px); } 60%{ transform:translateX(-3px); } 80%{ transform:translateX(2px); } }
  .g-banner{ position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); text-align:center; padding:10px 12px; background:rgba(20,16,30,.82); color:#fff;
    font-family:'DotGothic16', var(--f-head); font-size:15px; line-height:1.45; opacity:0; pointer-events:none; transition:opacity .25s; }
  .g-banner.show{ opacity:1; }
  .g-banner b{ display:block; font-size:19px; color:#FFD84A; letter-spacing:.04em; }
  .g-panel{ background:var(--card); border:1px solid var(--line); border-radius:16px; padding:14px; min-height:160px; }
  .g-who{ display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:var(--muted); margin-bottom:6px; }
  .g-who .tag{ font-size:10.5px; padding:1px 7px; border-radius:999px; border:1px solid currentColor; }
  .g-who .tag.boss{ color:#E5484D; }
  .g-line{ font-family:'Zen Maru Gothic', var(--f-body); font-size:21px; font-weight:700; line-height:1.45; margin:2px 0 6px; color:var(--ink); }
  .g-arti{ font-size:13px; color:var(--muted); margin-bottom:4px; }
  .g-arti button{ background:none; border:1px dashed var(--line); border-radius:999px; padding:2px 10px; font-size:12px; color:var(--muted); cursor:pointer; font-family:inherit; }
  .g-tugas{ font-size:13px; color:var(--indigo); font-weight:700; margin:4px 0 10px; }
  .g-opts{ display:flex; flex-direction:column; gap:8px; }
  .g-opt{ text-align:left; background:var(--bg); border:2px solid var(--line); border-radius:12px; padding:11px 13px; font-size:17px; font-family:'Zen Maru Gothic', var(--f-body);
    color:var(--ink); cursor:pointer; box-shadow:0 3px 0 var(--line); transition:transform .08s; }
  .g-opt:active{ transform:translateY(2px); box-shadow:0 1px 0 var(--line); }
  .g-opt.ok{ border-color:var(--moss); background:var(--moss-tint); box-shadow:0 3px 0 var(--moss); }
  .g-opt.ng{ border-color:var(--seal); background:var(--seal-tint); box-shadow:0 3px 0 var(--seal); }
  .g-opt[disabled]{ cursor:default; }
  .g-fb{ margin-top:10px; border-radius:12px; padding:10px 12px; font-size:14px; line-height:1.5; display:none; }
  .g-fb.show{ display:block; }
  .g-fb.ok{ background:var(--moss-tint); color:var(--moss); }
  .g-fb.ng{ background:var(--seal-tint); color:var(--seal-dark); }
  .g-fb b{ display:block; font-family:'Zen Maru Gothic', var(--f-body); font-size:16px; }
  .g-timer{ height:8px; background:var(--line); border-radius:99px; overflow:hidden; margin:2px 0 10px; }
  .g-timer i{ display:block; height:100%; width:100%; background:linear-gradient(90deg,#F5B301,#E5484D); transform-origin:left; }
  .g-next{ margin-top:10px; }
  .g-wait{ text-align:center; color:var(--muted); font-size:13px; padding:28px 0; font-family:'DotGothic16', var(--f-body); }
  .g-list{ display:flex; flex-direction:column; gap:10px; }
  .g-stage{ display:flex; gap:12px; align-items:center; text-align:left; width:100%; background:var(--card); border:2px solid var(--line); border-radius:14px; padding:12px; cursor:pointer; color:var(--ink); box-shadow:0 4px 0 var(--line); }
  .g-stage:active{ transform:translateY(2px); box-shadow:0 2px 0 var(--line); }
  .g-stage .num{ width:44px; height:44px; flex:none; border-radius:10px; background:#3F2631; color:#FFD84A; display:flex; align-items:center; justify-content:center; font-family:'DotGothic16', monospace; font-size:20px; }
  .g-stage h4{ margin:0 0 2px; font-size:15.5px; font-family:var(--f-head); }
  .g-stage p{ margin:0; font-size:12.5px; color:var(--muted); line-height:1.45; }
  .g-stage .st{ margin-left:auto; font-size:15px; color:#F5B301; white-space:nowrap; }
  .g-stage.lock{ opacity:.55; cursor:not-allowed; }
  .g-chr{ display:flex; gap:8px; margin:4px 0 14px; }
  .g-chr button{ flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; border-radius:12px; border:2px solid var(--line); background:var(--card); color:var(--ink); font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; }
  .g-chr button.on{ border-color:var(--indigo); box-shadow:0 0 0 1px var(--indigo); }
  .g-chr canvas{ width:32px; height:32px; image-rendering:pixelated; }
  .g-hero{ text-align:center; margin:2px 0 14px; }
  .g-hero h2{ font-family:'DotGothic16', var(--f-head); font-size:22px; margin:0 0 4px; }
  .g-hero p{ color:var(--muted); font-size:13px; margin:0; line-height:1.5; }
  .g-res{ text-align:center; }
  .g-res .stars{ font-size:34px; color:#F5B301; letter-spacing:4px; margin:4px 0; }
  .g-res .stars .off{ color:var(--line); }
  .g-res h3{ font-family:'DotGothic16', var(--f-head); font-size:22px; margin:2px 0 6px; }
  .g-res p{ color:var(--muted); font-size:13.5px; margin:0 0 12px; line-height:1.55; }
  .g-review{ text-align:left; margin:10px 0 4px; font-size:13px; }
  .g-review div{ border-left:3px solid var(--seal); padding:6px 10px; margin-bottom:8px; background:var(--seal-tint); border-radius:0 10px 10px 0; color:var(--ink); }
  .g-review b{ font-family:'Zen Maru Gothic', var(--f-body); }
  .g-credit{ text-align:center; font-size:11px; color:var(--muted); margin-top:12px; }
  `;

  /* ---------------- state ---------------- */
  let API = null, ROOT = null, DATA = null, G = null, RAF = 0, styleEl = null, READY = null;

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gsave() {
    const S = API.save();
    if (!S.game || typeof S.game !== "object") S.game = { st: {}, chr: "m" };
    if (!S.game.st) S.game.st = {};
    return S.game;
  }

  function prepare() {
    if (READY) return READY;
    READY = Promise.all([
      loadImg("city", "city.png"), loadImg("farm", "farm.png"),
      fetch(url("stages.json")).then(r => { if (!r.ok) throw new Error("stages"); return r.json(); }).then(j => { DATA = j; }),
      document.fonts && document.fonts.load ? document.fonts.load("9px 'DotGothic16'").catch(() => {}) : Promise.resolve(),
    ]);
    READY.catch(() => { READY = null; });
    return READY;
  }

  /* ---------------- layar: daftar stage ---------------- */
  function menuView() {
    stopLoop(); G = null;
    const gs = gsave();
    const stages = DATA.stages;
    const cards = stages.map((s, i) => {
      const prev = i === 0 || (gs.st[stages[i - 1].id] || 0) > 0;
      const stars = gs.st[s.id] || 0;
      const st = stars ? "★".repeat(stars) + "☆".repeat(3 - stars) : "";
      return `<button class="g-stage ${prev ? "" : "lock"}" data-stage="${i}" ${prev ? "" : "disabled"}>
        <div class="num">${prev ? i + 1 : "🔒"}</div>
        <div><h4>${esc(s.judul)}</h4><p>${prev ? esc(s.sub) : "Selesaikan stage sebelumnya dulu."}</p></div>
        <div class="st">${st}</div></button>`;
    }).join("");
    ROOT.innerHTML = `<div class="g-wrap">
      <div class="g-hero"><h2>Petualangan Nihongo</h2><p>Jalan keliling kota, sapa tetangga dengan sopan, lalu kalahkan bos di tujuan!<br>Salah jawab = ♥ berkurang dan kena omel.</p></div>
      <div class="g-who">Karakter kamu</div>
      <div class="g-chr">
        <button data-chr="m" class="${gs.chr !== "f" ? "on" : ""}"><canvas width="16" height="16" data-spr="m"></canvas>Cowok</button>
        <button data-chr="f" class="${gs.chr === "f" ? "on" : ""}"><canvas width="16" height="16" data-spr="f"></canvas>Cewek</button>
      </div>
      <div class="g-list">${cards}</div>
      <div class="g-credit">Grafis pixel: Kenney (kenney.nl) · CC0</div>
    </div>`;
    ROOT.querySelectorAll("canvas[data-spr]").forEach(cv => {
      const k = cv.dataset.spr; cv.getContext("2d").drawImage(sprite(k === "f" ? { sprite: "f", baju: "pink" } : { sprite: "m", baju: "biru", rambut: "hitam" }), 0, 0);
    });
    ROOT.querySelectorAll("[data-chr]").forEach(b => b.addEventListener("click", () => { gsave().chr = b.dataset.chr; API.persist(); menuView(); }));
    ROOT.querySelectorAll("[data-stage]").forEach(b => b.addEventListener("click", () => startStage(Number(b.dataset.stage))));
  }

  /* ---------------- main game ---------------- */
  function startStage(idx) {
    const st = DATA.stages[idx];
    const gs = gsave();
    const world = buildWorld(st);
    G = {
      idx, st, world, hearts: 3, coins: 0, correct: 0, mistakes: [],
      px: 20, phase: "walk", npcIdx: 0, t: 0, last: 0,
      npcs: st.tetangga.map((n, i) => ({ ...n, x: world.npcX[i], mood: null, moodT: 0, done: false })),
      player: sprite(gs.chr === "f" ? { sprite: "f", baju: "pink" } : { sprite: "m", baju: "biru", rambut: "hitam" }),
      boss: null, bossHP: st.bos.hp, bossMax: st.bos.hp, bq: [], qStart: 0, qTime: 0, timerOn: false, pmood: null, pmoodT: 0, shakeT: 0,
    };
    ROOT.innerHTML = `<div class="g-wrap">
      <div class="g-top"><div class="g-title">${idx + 1}. ${esc(st.judul)}</div><div class="g-coin" id="gCoin">+0 koin</div><div class="g-hearts" id="gHearts"></div></div>
      <div class="g-screen" id="gScreen"><canvas id="gCv" width="${W}" height="${H}"></canvas><div class="g-banner" id="gBanner"></div></div>
      <div class="g-panel" id="gPanel"><div class="g-wait">Berjalan…</div></div>
    </div>`;
    G.cv = ROOT.querySelector("#gCv"); G.ctx = G.cv.getContext("2d"); G.ctx.imageSmoothingEnabled = false;
    hearts();
    banner(`<b>${esc(st.tujuan.nama)}</b>${esc(st.sub)}`, 1800);
    startLoop();
  }
  function hearts() {
    const el = ROOT && ROOT.querySelector("#gHearts"); if (!el) return;
    el.innerHTML = [0, 1, 2].map(i => `<span class="${i < G.hearts ? "" : "off"}">♥</span>`).join("");
    const c = ROOT.querySelector("#gCoin"); if (c) c.textContent = `+${G.coins} koin`;
  }
  let bannerT = 0;
  function banner(html, ms) {
    const b = ROOT.querySelector("#gBanner"); if (!b) return;
    b.innerHTML = html; b.classList.add("show");
    clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => b.classList.remove("show"), ms);
  }
  function shake() { const s = ROOT.querySelector("#gScreen"); if (!s) return; s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake"); }

  function panelQuestion(who, isBoss, q) {
    const P = ROOT.querySelector("#gPanel");
    const opts = shuffle(q.pilihan);
    P.innerHTML = `
      <div class="g-who"><span>${esc(who)}</span>${isBoss ? `<span class="tag boss">BOS</span>` : ""}</div>
      <div class="g-line">${esc(q.kata)}</div>
      <div class="g-arti" id="gArti"><button type="button">Lihat arti</button></div>
      ${isBoss ? `<div class="g-timer"><i id="gTimer"></i></div>` : ""}
      <div class="g-tugas">🎯 ${esc(q.tugas)}</div>
      <div class="g-opts">${opts.map((o, i) => `<button class="g-opt" data-i="${i}">${esc(o.t)}</button>`).join("")}</div>
      <div class="g-fb" id="gFb"></div>`;
    P.querySelector("#gArti button").addEventListener("click", () => { P.querySelector("#gArti").textContent = q.arti; });
    P.querySelectorAll(".g-opt").forEach(b => b.addEventListener("click", () => answer(opts[Number(b.dataset.i)], b, q, isBoss)));
  }

  function answer(opt, btn, q, isBoss) {
    if (G.locked) return;
    G.locked = true; G.timerOn = false;
    const P = ROOT.querySelector("#gPanel");
    P.querySelectorAll(".g-opt").forEach(b => { b.disabled = true; });
    const correctTxt = q.pilihan.find(o => o.ok).t;
    P.querySelectorAll(".g-opt").forEach(b => { if (b.textContent === correctTxt) b.classList.add("ok"); });
    const fb = P.querySelector("#gFb");
    const ok = !!(opt && opt.ok);
    if (btn && !ok) btn.classList.add("ng");
    if (ok) {
      G.correct++;
      if (isBoss) {
        const frac = Math.max(0, 1 - (performance.now() - G.qStart) / (G.qTime * 1000));
        const dmg = 14 + Math.round(12 * frac);
        G.bossHP = Math.max(0, G.bossHP - dmg); G.coins += 6; G.hitT = 0.5;
        fb.className = "g-fb ok show"; fb.innerHTML = `<b>${frac > .6 ? "Cepat! " : ""}−${dmg} HP</b>Jawaban tepat!`;
      } else {
        const n = G.npcs[G.npcIdx]; n.mood = "heart"; n.moodT = 2; G.coins += 5;
        fb.className = "g-fb ok show"; fb.innerHTML = `<b>${esc(n.senang.jp)}</b>${esc(n.senang.id)}`;
      }
      G.pmood = "note"; G.pmoodT = 1.4;
      hearts();
      setTimeout(() => nextStep(isBoss), 1300);
    } else {
      G.hearts--; shake(); G.pmood = "sweat"; G.pmoodT = 2;
      const scold = q.marah || { jp: "…", id: "" };
      if (isBoss) G.bossMood = 1.5; else { const n = G.npcs[G.npcIdx]; n.mood = "angry"; n.moodT = 3; }
      G.mistakes.push({ kata: q.kata, benar: correctTxt, scold });
      fb.className = "g-fb ng show";
      fb.innerHTML = `<b>${opt ? "" : "⏰ Waktu habis! "}${esc(scold.jp)}</b>${esc(scold.id)}<br><small>Jawaban yang benar: <b style="display:inline">${esc(correctTxt)}</b></small>`;
      hearts();
      const nx = document.createElement("button");
      nx.className = "primary g-next"; nx.textContent = G.hearts <= 0 ? "Lihat hasil" : "Lanjut";
      nx.addEventListener("click", () => nextStep(isBoss));
      P.appendChild(nx);
    }
  }

  function nextStep(isBoss) {
    if (!G) return;
    G.locked = false;
    if (G.hearts <= 0) return finish(false);
    if (isBoss) {
      if (G.bossHP <= 0) return finish(true);
      return bossQuestion();
    }
    G.npcs[G.npcIdx].done = true;
    G.npcIdx++;
    G.phase = "walk";
    ROOT.querySelector("#gPanel").innerHTML = `<div class="g-wait">Berjalan…</div>`;
  }

  function bossStart() {
    const st = G.st, b = st.bos;
    G.phase = "boss";
    G.boss = { spr: sprite(b), x: G.world.dest.door + 4 };
    G.bq = [];
    banner(`<b>${esc(b.nama)} muncul!</b>${esc(b.intro.jp)}<br><small>${esc(b.intro.id)}</small>`, 2600);
    const P = ROOT.querySelector("#gPanel");
    P.innerHTML = `<div class="g-who"><span>${esc(b.nama)}</span><span class="tag boss">BOS</span></div>
      <div class="g-line">${esc(b.intro.jp)}</div><div class="g-arti">${esc(b.intro.id)}</div>
      <button class="primary g-next" id="gFight">Mulai!</button>`;
    P.querySelector("#gFight").addEventListener("click", () => { ROOT.querySelector("#gBanner").classList.remove("show"); bossQuestion(); });
  }
  function bossQuestion() {
    if (!G.bq.length) G.bq = shuffle(G.st.bos.soal);
    const q = G.bq.shift();
    panelQuestion(G.st.bos.nama, true, q);
    G.qTime = G.st.bos.waktu || 12; G.qStart = performance.now(); G.timerOn = true; G.curQ = q;
  }

  function finish(win) {
    const atBoss = !!G.boss;
    G.phase = win ? "win" : "lose"; G.timerOn = false;
    const gs = gsave(), st = G.st;
    const stars = win ? Math.max(1, G.hearts) : 0;
    const prevStars = gs.st[st.id] || 0;
    let coins = G.coins;
    if (win) coins += 30 + stars * 10;
    if (win && prevStars > 0) coins = Math.round(coins / 2);   // main ulang: koin setengah
    if (win && stars > prevStars) gs.st[st.id] = stars;
    if (coins > 0) API.addCoins(coins);
    API.persist();
    G.coins = coins; hearts();
    const b = st.bos;
    const loseJP = atBoss ? b.kalah.jp : "♥ が なくなりました…";
    const loseID = atBoss ? b.kalah.id : "♥ kamu habis sebelum sampai tujuan. Ulangi dan sapa semua orang dengan sopan, ya!";
    banner(win ? `<b>MENANG!</b>${esc(b.menang.jp)}` : `<b>GAME OVER</b>${esc(loseJP)}`, 0);
    const review = G.mistakes.length ? `<div class="g-review"><div style="background:none;border:none;padding:0;color:var(--muted)">Yang perlu diulang:</div>${G.mistakes.map(m =>
      `<div><b>${esc(m.kata)}</b><br>✔ ${esc(m.benar)}<br><small>${esc(m.scold.id)}</small></div>`).join("")}</div>` : "";
    const hasNext = win && G.idx < DATA.stages.length - 1;
    ROOT.querySelector("#gPanel").innerHTML = `<div class="g-res">
      <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? "" : "off"}">★</span>`).join("")}</div>
      <h3>${win ? "Stage selesai!" : "Coba lagi, yuk!"}</h3>
      <p>${win ? esc(b.menang.id) : esc(loseID)}<br>Dapat <b>${coins} koin</b>${win && prevStars > 0 ? " (main ulang: koin ½)" : ""}.</p>
      ${hasNext ? `<button class="primary" id="gNext">Stage berikutnya →</button>` : ""}
      <button class="${hasNext ? "ghost" : "primary"}" id="gRetry">Main lagi</button>
      <button class="ghost" id="gMenu">Daftar stage</button>
      ${review}</div>`;
    const P = ROOT.querySelector("#gPanel");
    if (P.querySelector("#gNext")) P.querySelector("#gNext").addEventListener("click", () => startStage(G.idx + 1));
    P.querySelector("#gRetry").addEventListener("click", () => startStage(G.idx));
    P.querySelector("#gMenu").addEventListener("click", menuView);
  }

  /* ---------------- loop ---------------- */
  function startLoop() { stopLoop(); G.last = 0; RAF = requestAnimationFrame(frame); }
  function stopLoop() { if (RAF) cancelAnimationFrame(RAF); RAF = 0; }
  function frame(ts) {
    if (!G || !G.cv || !G.cv.isConnected) { RAF = 0; return; }
    const dt = G.last ? Math.min(0.05, (ts - G.last) / 1000) : 0; G.last = ts; G.t += dt;
    update(dt); draw();
    RAF = requestAnimationFrame(frame);
  }
  function update(dt) {
    G.npcs.forEach(n => { if (n.moodT > 0) { n.moodT -= dt; if (n.moodT <= 0) n.mood = null; } });
    if (G.pmoodT > 0) { G.pmoodT -= dt; if (G.pmoodT <= 0) G.pmood = null; }
    if (G.hitT > 0) G.hitT -= dt;
    if (G.bossMood > 0) G.bossMood -= dt;
    if (G.phase === "walk") {
      const target = G.npcIdx < G.npcs.length ? G.npcs[G.npcIdx].x - 18 : G.world.dest.door - 14;
      if (G.px < target) { G.px = Math.min(target, G.px + SPEED * dt * (G.npcIdx >= G.npcs.length ? 1.2 : 1)); G.walking = true; }
      else {
        G.walking = false;
        if (G.npcIdx < G.npcs.length) {
          G.phase = "talk"; const n = G.npcs[G.npcIdx];
          panelQuestion(n.nama, false, n);
        } else { G.phase = "arrive"; banner(`<b>Sampai di ${esc(G.st.tujuan.nama)}!</b>${esc(G.st.tujuan.jp)}`, 1500); setTimeout(() => { if (G && G.phase === "arrive") bossStart(); }, 1400); }
      }
    } else G.walking = false;
    if (G.timerOn) {
      const left = 1 - (performance.now() - G.qStart) / (G.qTime * 1000);
      const bar = ROOT.querySelector("#gTimer");
      if (bar) bar.style.transform = `scaleX(${Math.max(0, left)})`;
      if (left <= 0) { G.timerOn = false; answer(null, null, G.curQ, true); }
    }
  }
  function draw() {
    const ctx = G.ctx, wd = G.world;
    const cam = Math.max(0, Math.min(wd.w - W, Math.round(G.px - 52)));
    ctx.drawImage(wd.far, Math.round(cam * 0.35), 0, W, H, 0, 0, W, H);
    ctx.drawImage(wd.canvas, cam, 0, W, H, 0, 0, W, H);
    const bob = (on, speed) => on && !REDUCED ? (Math.floor(G.t * speed) % 2 ? -1 : 0) : 0;
    // tetangga
    G.npcs.forEach((n, i) => {
      const sx = n.x - cam; if (sx < -20 || sx > W + 20) return;
      const near = i === G.npcIdx && (G.phase === "talk");
      const spr = sprite(n);
      const shakeX = n.mood === "angry" && !REDUCED ? Math.round(Math.sin(G.t * 40)) : 0;
      shadow(ctx, sx + 8, FEET);
      ctx.drawImage(spr, Math.round(sx + shakeX), FEET - 16 + bob(n.mood === "heart", 6));
      if (n.mood) emote(ctx, n.mood, sx + 8, FEET - 19, G.t);
      else if (near) emote(ctx, "!", sx + 8, FEET - 19, G.t);
    });
    // bos
    if (G.boss) {
      const bx = G.boss.x - cam;
      shadow(ctx, bx + 16, FEET, 12);
      const hitX = G.hitT > 0 && !REDUCED ? Math.round(Math.sin(G.t * 50) * 2) : 0;
      ctx.drawImage(G.boss.spr, Math.round(bx + hitX), FEET - 32 + bob(G.phase === "win", 5), 32, 32);
      if (G.bossMood > 0) emote(ctx, "angry", bx + 16, FEET - 35, G.t);
      if (G.phase === "win") emote(ctx, "heart", bx + 16, FEET - 35, G.t);
      // HP bar
      const bw = 92, x0 = (W - bw) / 2, y0 = 5;
      ctx.fillStyle = "#3F2631"; ctx.fillRect(x0 - 2, y0 - 2, bw + 4, 12);
      ctx.fillStyle = "#5a2330"; ctx.fillRect(x0, y0, bw, 8);
      const fr = G.bossHP / G.bossMax;
      ctx.fillStyle = fr > .5 ? "#4CC36A" : fr > .25 ? "#F5B301" : "#E5484D"; ctx.fillRect(x0, y0, Math.round(bw * fr), 8);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x0, y0, Math.round(bw * fr), 2);
      ctx.fillStyle = "#fff"; ctx.font = "8px 'DotGothic16', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("HP", x0 - 1, y0 + 11);
    }
    // pemain
    const px = G.px - cam;
    shadow(ctx, px + 8, FEET);
    ctx.drawImage(G.player, Math.round(px), FEET - 16 + bob(G.walking, 8) + (G.phase === "win" ? bob(true, 5) : 0));
    if (G.pmood) emote(ctx, G.pmood, px + 13, FEET - 17, G.t);
  }
  function shadow(ctx, cx, y, r) { r = r || 6; ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(Math.round(cx - r), y - 1, r * 2, 2); ctx.fillRect(Math.round(cx - r + 2), y - 2, r * 2 - 4, 4); }

  document.addEventListener("visibilitychange", () => {
    if (!G) return;
    if (document.hidden) stopLoop(); else if (G.cv && G.cv.isConnected) startLoop();
  });

  /* ---------------- API publik ---------------- */
  window.NSGame = {
    mount(root, api) {
      API = api; ROOT = root;
      if (!styleEl) { styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
      root.innerHTML = `<div class="g-wait">Memuat game…</div>`;
      prepare().then(() => { if (ROOT === root && root.isConnected) menuView(); })
        .catch(() => { root.innerHTML = `<div class="g-wait">Game gagal dimuat. Cek koneksi internet lalu coba lagi.</div>`; });
    },
    unmount() { stopLoop(); G = null; ROOT = null; },
  };
})();
