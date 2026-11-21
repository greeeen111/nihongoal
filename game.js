/* =========================================================================
   Petualangan Nihongo — mini game (v3.1)
   - Satu <canvas> 160×120 yang diperbesar (pixel art), layar penuh.
   - Latar & ruangan digambar SEKALI ke kanvas offscreen; tiap frame cuma
     tempel latar + gambar karakter → ringan di HP. Loop berhenti saat game
     ditutup / tab disembunyikan.
   - Grafis luar ruangan: Kenney "Tiny City" (CC0). Ruangan dalam (rak buku,
     loket, kelas, kantor, dst.) digambar oleh kode ini dengan gaya yang sama.
   - Isi stage: stages.json (bisa ditambah tanpa ngoding).
   ========================================================================= */
(function () {
  "use strict";
  const SCRIPT = document.currentScript;
  const SRC = SCRIPT ? SCRIPT.src : "game/game.js";
  const BASE = SRC.replace(/[^/?#]*([?#].*)?$/, "");
  const VER = (SRC.split("?v=")[1] || "").split("&")[0];
  const url = (f) => BASE + f + (VER ? "?v=" + encodeURIComponent(VER) : "");

  const W = 160, H = 120, T = 16;
  const SPEED = 36, NPC_GAP = 132;
  const OL = "#3F2631";      // garis luar (sama dengan Tiny City)
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= util gambar ================= */
  const IMG = {};
  function loadImg(k, f) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = url(f); }); }
  function city(c, t, x, y) { c.drawImage(IMG.city, (t % 12) * 16, Math.floor(t / 12) * 16, 16, 16, Math.round(x), Math.round(y), 16, 16); }
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function box(c, x, y, w, h, fill, hi, sh) { R(c, x, y, w, h, OL); R(c, x + 1, y + 1, w - 2, h - 2, fill); if (hi) R(c, x + 1, y + 1, w - 2, 1, hi); if (sh) R(c, x + 1, y + h - 2, w - 2, 1, sh); }
  function txt(c, s, x, y, col, size, align) {
    c.font = `bold ${size || 8}px 'DotGothic16', 'Zen Maru Gothic', sans-serif`;
    c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillStyle = col; c.fillText(s, Math.round(x), Math.round(y));
  }
  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; }
  const BOOK = ["#C94F4F", "#3F6FB0", "#4C9A5A", "#E0B040", "#8E5DB0", "#D9773B", "#2F8C8C", "#EDE3D0", "#6B4E9B", "#B23A5C"];

  /* ================= sprite karakter (Tiny City + warna/aksesori) ================= */
  const rgb = (a) => a.join(",");
  const HAIR = { coklat: null, abu: [[200, 200, 210], [140, 140, 152]], hitam: [[74, 64, 80], [46, 40, 52]] };
  const BAJU = {
    ungu: [[176, 128, 210], [120, 80, 160]], merah: [[232, 98, 88], [170, 60, 55]], hijau: [[120, 190, 120], [70, 135, 80]],
    biru: [[110, 160, 230], [64, 105, 175]], kuning: [[245, 205, 90], [195, 150, 50]], putih: [[240, 240, 244], [186, 192, 206]],
    jas: [[66, 74, 100], [42, 48, 70]], abu: [[128, 132, 146], [88, 92, 106]], seragam: [[58, 70, 118], [38, 46, 84]],
    pink: [[246, 160, 178], [214, 110, 136]],
  };
  const SERAGAM = { polisi: null, konbini: [[70, 165, 110], [40, 120, 80], [120, 205, 150]],
    super: [[238, 140, 60], [190, 95, 35], [250, 185, 110]], stasiun: [[44, 66, 118], [28, 42, 82], [76, 104, 160]] };
  const BASE_TILE = { f: 108, m: 120, w: 121 };
  const SPR = {};
  function sprite(spec) {
    const key = [spec.sprite, spec.rambut, spec.baju, (spec.aks || []).join("+")].join("|");
    if (SPR[key]) return SPR[key];
    const [c, x] = canvas(16, 16);
    city(x, BASE_TILE[spec.sprite] || 120, 0, 0);
    const d = x.getImageData(0, 0, 16, 16), p = d.data;
    const hair = HAIR[spec.rambut], baju = spec.baju === "pink" && spec.sprite === "f" ? null : BAJU[spec.baju], sg = SERAGAM[spec.baju];
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const y = (i / 4) >> 4, col = rgb([p[i], p[i + 1], p[i + 2]]);
      let to = null;
      if (spec.sprite === "f") {
        if (hair && col === "189,108,74") to = hair[0]; else if (hair && col === "118,59,54") to = hair[1];
        else if (baju && col === "242,132,98") to = baju[0]; else if (baju && col === "195,75,53") to = baju[1];
      } else if (spec.sprite === "m") {
        if (hair && y < 9 && col === "189,108,74") to = hair[0]; else if (hair && y < 9 && col === "118,59,54") to = hair[1];
        else if (baju && col === "192,203,220") to = baju[0]; else if (baju && col === "139,155,180") to = baju[1];
      } else if (spec.sprite === "w" && sg) {
        if (col === "79,116,156") to = sg[0]; else if (col === "61,87,130") to = sg[1]; else if (col === "99,139,182") to = sg[2];
      }
      if (to) { p[i] = to[0]; p[i + 1] = to[1]; p[i + 2] = to[2]; }
    }
    x.putImageData(d, 0, 0);
    (spec.aks || []).forEach(a => {
      if (a === "kacamata") { const g = "#2B2433"; [[5, 6, 3, 1], [5, 8, 3, 1], [9, 6, 3, 1], [9, 8, 3, 1], [5, 6, 1, 3], [7, 6, 1, 3], [9, 6, 1, 3], [11, 6, 1, 3], [8, 7, 1, 1]].forEach(r => R(x, r[0], r[1], r[2], r[3], g)); }
      else if (a === "dasi") { R(x, 7, 11, 2, 1, "#8E1F2A"); R(x, 7, 12, 2, 2, "#C83A44"); }
      else if (a === "celemek") { R(x, 5, 12, 6, 2, spec.celemek || "#7A5C3E"); R(x, 6, 11, 1, 1, "#7A5C3E"); R(x, 9, 11, 1, 1, "#7A5C3E"); }
      else if (a === "pita") { R(x, 6, 11, 1, 1, "#D9364B"); R(x, 9, 11, 1, 1, "#D9364B"); R(x, 7, 11, 2, 1, "#F25A6E"); }
      else if (a === "topi-perawat") { R(x, 5, 1, 6, 2, "#FFFFFF"); R(x, 5, 1, 6, 1, OL); R(x, 7, 1, 2, 2, "#E04B5A"); }
    });
    return (SPR[key] = c);
  }
  function playerSpec(st, chr) {
    const p = st.pemain || {}, aks = [];
    (p.aks || []).forEach(a => { if (a === "seragam") aks.push(chr === "f" ? "pita" : "dasi"); else if (a === "dasi") { if (chr !== "f") aks.push("dasi"); } else aks.push(a); });
    return { sprite: chr === "f" ? "f" : "m", rambut: chr === "f" ? null : "hitam", baju: p.baju || (chr === "f" ? "pink" : "biru"), aks };
  }

  /* ================= properti (furnitur pixel) ================= */
  function bookshelf(c, x, base, w, h, rnd) {
    const y = base - h; box(c, x, y, w, h, "#8B5A2B", "#A9733F");
    R(c, x + 3, y + 3, w - 6, h - 5, "#4E3020");
    for (let sy = y + 3; sy + 13 <= base - 1; sy += 13) {
      let bx = x + 3;
      while (bx < x + w - 4) {
        const bw = 2 + Math.floor(rnd() * 3), bh = 7 + Math.floor(rnd() * 4);
        if (bx + bw > x + w - 3) break;
        if (rnd() < .08) { bx += 3; continue; }
        R(c, bx, sy + 12 - bh, bw, bh, BOOK[Math.floor(rnd() * BOOK.length)]); R(c, bx, sy + 12 - bh, bw, 1, "rgba(255,255,255,.3)");
        bx += bw;
      }
      R(c, x + 2, sy + 12, w - 4, 2, "#A9733F");
    }
  }
  function windowBox(c, x, y, w, h, view, rnd) {
    box(c, x, y, w, h, "#F4F1EA"); const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, view === "malam" ? "#22305A" : "#8EC3EE"); g.addColorStop(1, view === "malam" ? "#3A4A7E" : "#D7EEFB");
    c.fillStyle = g; c.fillRect(x + 2, y + 2, w - 4, h - 4);
    if (view === "kota" || view === "malam") {
      let bx = x + 2; while (bx < x + w - 2) { const bw = 5 + Math.floor(rnd() * 6), bh = 6 + Math.floor(rnd() * (h * .55)); R(c, bx, y + h - 2 - bh, Math.min(bw, x + w - 2 - bx), bh, view === "malam" ? "#121A36" : "#A7BCD9");
        if (view === "malam") for (let k = 0; k < 3; k++) R(c, bx + 1 + Math.floor(rnd() * (bw - 2)), y + h - bh + Math.floor(rnd() * (bh - 3)), 1, 1, "#FFE28A"); bx += bw + 1; }
    } else if (view === "pohon") {
      for (let k = 0; k < 3; k++) { const cx = x + 4 + rnd() * (w - 8), cy = y + h - 6; R(c, cx - 4, cy - 6, 9, 7, "#6FB46A"); R(c, cx - 2, cy - 9, 5, 4, "#86C77D"); R(c, cx, cy, 1, 4, "#7A5230"); }
    } else { R(c, x + 4, y + 5, 9, 2, "#FFFFFF"); R(c, x + 6, y + 3, 5, 2, "#FFFFFF"); }
    R(c, x + Math.floor(w / 2) - 1, y + 1, 2, h - 2, "#F4F1EA"); R(c, x + 1, y + Math.floor(h / 2) - 1, w - 2, 2, "#F4F1EA");
    R(c, x - 2, y + h, w + 4, 2, "#D8D2C4");
  }
  function poster(c, x, y, w, h, col, s, fg) { box(c, x, y, w, h, "#FBF8F0"); R(c, x + 1, y + 1, w - 2, Math.min(7, h - 2), col); if (s) txt(c, s, x + w / 2, y + 4.5, fg || "#fff", 6); for (let ly = y + 10; ly < y + h - 2; ly += 3) R(c, x + 3, ly, w - 6 - ((ly * 7) % 5), 1, "#C9C2B4"); }
  function sign(c, x, y, w, h, bg, s, fg, size) { box(c, x, y, w, h, bg, "rgba(255,255,255,.25)"); txt(c, s, x + w / 2, y + h / 2 + .5, fg || "#fff", size || 8); }
  function clock(c, x, y) { R(c, x + 1, y, 8, 10, OL); R(c, x, y + 1, 10, 8, OL); R(c, x + 2, y + 1, 6, 8, "#FFFFFF"); R(c, x + 1, y + 2, 8, 6, "#FFFFFF"); R(c, x + 4, y + 2, 1, 3, OL); R(c, x + 5, y + 5, 2, 1, OL); }
  function plant(c, x, base, big) { const s = big ? 1.4 : 1; R(c, x + 2, base - 7, 8, 7, OL); R(c, x + 3, base - 6, 6, 5, "#B5643A"); R(c, x + 3, base - 6, 6, 1, "#D58A5A");
    R(c, x, base - 7 - 9 * s, 12, 9 * s, "#3F7A4B"); R(c, x + 1, base - 8 - 11 * s, 10, 4, "#5BA466"); R(c, x + 3, base - 10 - 13 * s, 6, 4, "#79C27F"); }
  function lockers(c, x, base, w, h) { for (let lx = x; lx + 10 <= x + w; lx += 10) { box(c, lx, base - h, 10, h, "#8FA3BC", "#AFC0D4"); for (let k = 0; k < 3; k++) R(c, lx + 2, base - h + 4 + k * 2, 6, 1, "#6E809A"); R(c, lx + 7, base - h / 2, 1, 3, "#E6ECF3"); } }
  function corkboard(c, x, y, w, h, rnd) { box(c, x, y, w, h, "#C99B63", "#DDB27A"); for (let k = 0; k < 4; k++) { const pw = 7 + rnd() * 5, ph = 8 + rnd() * 4, px = x + 3 + rnd() * (w - pw - 6), py = y + 3 + rnd() * (h - ph - 5);
    R(c, px, py, pw, ph, ["#FFFFFF", "#FFF3B0", "#CDE8FF", "#FFD3DC"][k % 4]); R(c, px + pw / 2, py, 1, 1, "#E04B5A"); } }
  function slideDoor(c, x, base, label) { const w = 24, h = 52; box(c, x, base - h, w, h, "#B98C5A", "#D3A876"); R(c, x + 3, base - h + 5, w - 6, 16, "#CFE8F7"); R(c, x + w / 2, base - h + 1, 1, h - 2, "#8C6438"); R(c, x + w - 5, base - 26, 2, 4, OL);
    if (label) sign(c, x - 2, base - h - 9, w + 4, 8, "#FFFFFF", label, OL, 6); }
  function extinguisher(c, x, base) { R(c, x, base - 11, 5, 11, OL); R(c, x + 1, base - 10, 3, 9, "#D9453B"); R(c, x + 1, base - 13, 3, 2, OL); }
  function vending(c, x, base, col) { const w = 22, h = 46; box(c, x, base - h, w, h, col || "#D9453B", "#EF7066"); R(c, x + 3, base - h + 4, w - 6, 22, "#F7F3EA");
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) R(c, x + 4 + k * 4, base - h + 6 + r * 7, 2, 5, BOOK[(r * 4 + k) % BOOK.length]);
    R(c, x + 4, base - 14, w - 8, 5, OL); R(c, x + 5, base - 13, w - 10, 3, "#2B2433"); }
  function bench(c, x, base, w) { R(c, x, base - 10, w, 4, OL); R(c, x + 1, base - 9, w - 2, 2, "#B98C5A"); R(c, x + 2, base - 6, 2, 6, OL); R(c, x + w - 4, base - 6, 2, 6, OL); }
  function chairsRow(c, x, base, n, col) { for (let k = 0; k < n; k++) { const cx = x + k * 11; box(c, cx, base - 18, 10, 9, col || "#5B8FD6", "rgba(255,255,255,.3)"); box(c, cx, base - 10, 10, 3, col || "#5B8FD6"); R(c, cx + 2, base - 7, 1, 7, OL); R(c, cx + 7, base - 7, 1, 7, OL); } }
  function counterTop(c, x, y, w, h, top, front, trim) { R(c, x, y, w, h, OL); R(c, x + 1, y + 1, w - 2, 3, top); R(c, x + 1, y + 4, w - 2, h - 5, front); R(c, x + 1, y + 4, w - 2, 1, "rgba(0,0,0,.15)"); if (trim) R(c, x + 1, y + h - 5, w - 2, 2, trim); }
  function monitor(c, x, y, glow) { box(c, x, y, 13, 10, "#2B2433"); R(c, x + 2, y + 2, 9, 6, glow || "#5DB3E8"); R(c, x + 2, y + 2, 9, 1, "#A5DBFA"); R(c, x + 5, y + 10, 3, 2, OL); R(c, x + 3, y + 11, 7, 1, OL); }
  function desk(c, x, base, w, pc) { R(c, x, base - 14, w, 3, OL); R(c, x + 1, base - 13, w - 2, 1, "#C49A6C"); R(c, x + 2, base - 11, 2, 11, OL); R(c, x + w - 4, base - 11, 2, 11, OL); if (pc) monitor(c, x + w / 2 - 6, base - 26, pc === true ? null : pc); }
  function whiteboard(c, x, y, w, h, rnd) { box(c, x, y, w, h, "#FDFDFB", "#FFFFFF"); for (let k = 0; k < 3; k++) R(c, x + 4, y + 5 + k * 5, 8 + rnd() * (w - 14), 1, ["#3F6FB0", "#C94F4F", "#3F2631"][k]); R(c, x + 2, y + h, w - 4, 2, "#B7B7B7"); }
  function copier(c, x, base) { box(c, x, base - 30, 24, 30, "#E3E5EA", "#F5F6F8"); R(c, x + 2, base - 33, 20, 4, OL); R(c, x + 3, base - 32, 18, 2, "#B9BEC8"); R(c, x + 14, base - 26, 7, 3, "#5DB3E8"); R(c, x + 3, base - 12, 18, 2, "#C9CDD5"); }
  function waterServer(c, x, base) { box(c, x, base - 24, 10, 24, "#EDEFF3"); R(c, x + 1, base - 34, 8, 10, OL); R(c, x + 2, base - 33, 6, 8, "#A8D8F5"); R(c, x + 3, base - 14, 1, 2, "#D9453B"); R(c, x + 6, base - 14, 1, 2, "#3F6FB0"); }
  function numDisplay(c, x, y, w, s) { box(c, x, y, w, 12, "#1B1620"); txt(c, s, x + w / 2, y + 6.5, "#FF5A4E", 8); }
  function elevator(c, x, base) { box(c, x, base - 50, 28, 50, "#B9C3D0", "#D6DDE6"); R(c, x + 13, base - 49, 2, 48, "#8C97A6"); sign(c, x + 7, base - 60, 14, 8, "#1B1620", "5F", "#FFB347", 6); }
  function sofa(c, x, base, w, col) { box(c, x, base - 16, w, 10, col || "#7D5BA6", "rgba(255,255,255,.25)"); box(c, x - 2, base - 12, 5, 9, col || "#7D5BA6"); box(c, x + w - 3, base - 12, 5, 9, col || "#7D5BA6"); R(c, x + 2, base - 4, 2, 4, OL); R(c, x + w - 4, base - 4, 2, 4, OL); }
  function lantern(c, x, y) { R(c, x + 1, y, 6, 10, OL); R(c, x, y + 2, 8, 6, OL); R(c, x + 1, y + 2, 6, 6, "#E04B3A"); R(c, x + 2, y + 1, 4, 8, "#E04B3A"); R(c, x + 2, y + 2, 1, 6, "#F7836E"); R(c, x + 1, y + 4, 6, 1, OL); R(c, x + 3, y - 2, 2, 2, OL); }
  function noren(c, x, y, w, col, s) { R(c, x, y, w, 12, OL); R(c, x + 1, y + 1, w - 2, 10, col); for (let k = 1; k < 3; k++) R(c, x + (w * k) / 3, y + 4, 1, 8, OL); if (s) txt(c, s, x + w / 2, y + 5, "#fff", 6); }
  function nobori(c, x, base, col, s) { R(c, x, base - 44, 1, 44, OL); R(c, x + 1, base - 42, 8, 26, OL); R(c, x + 2, base - 41, 6, 24, col); R(c, x + 2, base - 41, 6, 2, "#fff");
    if (s) [...s].slice(0, 3).forEach((ch, i) => txt(c, ch, x + 5, base - 34 + i * 7, "#fff", 6)); }
  function productShelf(c, x, base, w, h, rnd) { const y = base - h; box(c, x, y, w, h, "#C9CED8", "#E3E6EC");
    for (let sy = y + 3; sy + 10 <= base - 2; sy += 10) { let bx = x + 3; while (bx < x + w - 5) { const bw = 3 + Math.floor(rnd() * 3), bh = 4 + Math.floor(rnd() * 4); R(c, bx, sy + 8 - bh, bw, bh, BOOK[Math.floor(rnd() * BOOK.length)]); R(c, bx, sy + 8 - bh, bw, 1, "rgba(255,255,255,.4)"); bx += bw + 1; } R(c, x + 2, sy + 8, w - 4, 2, "#9AA2B1"); } }
  function fridge(c, x, base, w, h) { const y = base - h; box(c, x, y, w, h, "#DDE3EA"); for (let dx = x + 2; dx + 12 <= x + w - 1; dx += 13) { R(c, dx, y + 3, 12, h - 6, "#A9D7F0"); R(c, dx + 1, y + 4, 2, h - 8, "rgba(255,255,255,.6)");
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) R(c, dx + 3 + k * 3, y + 6 + r * 9, 2, 6, ["#E04B3A", "#3F6FB0", "#4C9A5A", "#E0B040"][(r + k) % 4]); } }
  function boxShelf(c, x, base, w, h, rnd) { const y = base - h; box(c, x, y, w, h, "#9C6B3E", "#B9844F"); R(c, x + 3, y + 3, w - 6, h - 5, "#6E4A2A");
    for (let sy = y + 3; sy + 13 <= base - 1; sy += 13) { let bx = x + 4; while (bx < x + w - 10) { const bw = 7 + Math.floor(rnd() * 4), bh = 6 + Math.floor(rnd() * 4), col = ["#E04B5A", "#F2C14E", "#4C9A5A", "#3F6FB0", "#F7F3EA", "#8E5DB0"][Math.floor(rnd() * 6)];
      box(c, bx, sy + 12 - bh, bw, bh, col); R(c, bx + bw / 2, sy + 13 - bh, 1, bh - 2, "#FFFFFF"); bx += bw + 2; } R(c, x + 2, sy + 12, w - 4, 2, "#B9844F"); } }
  function maneki(c, x, base) { R(c, x + 1, base - 12, 8, 12, OL); R(c, x, base - 9, 10, 9, OL); R(c, x + 2, base - 11, 6, 10, "#FFFFFF"); R(c, x + 1, base - 8, 8, 7, "#FFFFFF"); R(c, x + 1, base - 14, 2, 3, OL); R(c, x + 7, base - 14, 2, 3, OL);
    R(c, x + 3, base - 9, 1, 1, OL); R(c, x + 6, base - 9, 1, 1, OL); R(c, x + 3, base - 6, 4, 1, "#E04B3A"); R(c, x + 4, base - 5, 2, 2, "#F2C14E"); R(c, x + 8, base - 15, 2, 4, "#FFFFFF"); }
  function register(c, x, y) { box(c, x, y, 16, 9, "#3A3F4A"); R(c, x + 2, y + 2, 7, 3, "#7CE08A"); R(c, x + 11, y + 2, 3, 5, "#D8DCE3"); R(c, x - 1, y + 9, 18, 2, OL); }
  function blackboard(c, x, y, w, h, lines) { box(c, x, y, w, h, "#2F5D47"); R(c, x + 1, y + 1, w - 2, h - 2, "#356B52"); R(c, x - 1, y + h, w + 2, 3, "#A9733F");
    (lines || []).forEach((s, i) => txt(c, s, x + w / 2, y + 10 + i * 12, "#F4F1EA", i ? 7 : 9)); R(c, x + 6, y + h + 1, 4, 1, "#FFFFFF"); }
  function studentDesk(c, x, base) { R(c, x, base - 10, 22, 4, OL); R(c, x + 1, base - 9, 20, 2, "#D3A876"); R(c, x + 2, base - 6, 2, 6, OL); R(c, x + 18, base - 6, 2, 6, OL); }
  function bed(c, x, base, w) { R(c, x, base - 14, w, 9, OL); R(c, x + 1, base - 13, w - 2, 4, "#FFFFFF"); R(c, x + 1, base - 9, w - 2, 3, "#8FC6E8"); R(c, x + 2, base - 16, 10, 3, OL); R(c, x + 3, base - 15, 8, 2, "#FFFFFF"); R(c, x + 2, base - 5, 2, 5, OL); R(c, x + w - 4, base - 5, 2, 5, OL); }
  function curtain(c, x, y, w, h) { R(c, x, y - 2, w, 2, "#9AA2B1"); for (let k = 0; k < w; k += 4) { R(c, x + k, y, 4, h, k % 8 ? "#BFE3D2" : "#A8D6C0"); } R(c, x, y, 1, h, OL); }
  function lightbox(c, x, y, w, h) { box(c, x, y, w, h, "#EAF6FF"); R(c, x + 3, y + 3, w / 2 - 4, h - 6, "#3A4250"); R(c, x + w / 2 + 1, y + 3, w / 2 - 4, h - 6, "#3A4250"); R(c, x + 5, y + 6, 3, h - 12, "#D8DCE3"); R(c, x + w / 2 + 3, y + 6, 3, h - 12, "#D8DCE3"); }
  function floorPlan(c, x, y, w, h, rnd) { box(c, x, y, w, h, "#FFFFFF"); R(c, x + 2, y + 2, w - 4, 6, "#E0B040"); txt(c, "1K", x + w / 2, y + 5.5, "#fff", 6);
    R(c, x + 3, y + 10, w - 6, h - 13, "#F1EFEA"); R(c, x + 3, y + 10, w - 6, 1, OL); R(c, x + 3, y + h - 4, w - 6, 1, OL); R(c, x + 3, y + 10, 1, h - 13, OL); R(c, x + w - 4, y + 10, 1, h - 13, OL);
    R(c, x + 3 + Math.floor((w - 6) * .55), y + 10, 1, h - 13, OL); R(c, x + 4, y + 10 + Math.floor((h - 13) * .5), Math.floor((w - 6) * .55), 1, OL); }
  function trophy(c, x, base) { R(c, x + 2, base - 4, 6, 4, OL); R(c, x + 3, base - 3, 4, 2, "#7A5230"); R(c, x + 4, base - 7, 2, 3, "#E0B040"); R(c, x + 1, base - 13, 8, 7, OL); R(c, x + 2, base - 12, 6, 5, "#F2C14E"); R(c, x + 3, base - 12, 1, 4, "#FFF1B8"); }
  function rug(c, x, y, w, h) { R(c, x, y, w, h, "#8E2E3B"); R(c, x + 2, y + 2, w - 4, h - 4, "#B23A4C"); R(c, x + 4, y + 4, w - 8, h - 8, "#8E2E3B"); }
  function gates(c, x, base, n) { for (let k = 0; k < n; k++) { const gx = x + k * 16; box(c, gx, base - 18, 7, 18, "#C8CED8", "#E3E6EC"); R(c, gx + 1, base - 17, 5, 3, "#3F6FB0"); R(c, gx + 2, base - 12, 3, 3, "#4CC36A"); } }
  function deptBoard(c, x, y, w) { box(c, x, y, w, 22, "#1B1620"); R(c, x + w / 2, y - 6, 1, 6, OL); txt(c, "のぞみ  10:30", x + w / 2, y + 7, "#FFB347", 7); txt(c, "きょうと  14ばん", x + w / 2, y + 16, "#7CE08A", 7); }
  function ticketMachine(c, x, base) { box(c, x, base - 34, 18, 34, "#D8DCE3", "#EEF0F4"); R(c, x + 3, base - 30, 12, 9, "#5DB3E8"); for (let k = 0; k < 3; k++) R(c, x + 3 + k * 4, base - 18, 3, 3, "#F2C14E"); R(c, x + 4, base - 10, 10, 2, OL); }
  function receptionDesk(c, x, base, w) { counterTop(c, x, base - 20, w, 20, "#EDE6DA", "#8B6A4E", "#6E5038"); }
  function bigDoor(c, x, base, label, col) { box(c, x, base - 54, 30, 54, col || "#9C6B3E", "rgba(255,255,255,.2)"); R(c, x + 14, base - 53, 2, 52, "rgba(0,0,0,.25)"); R(c, x + 10, base - 28, 2, 4, "#F2C14E"); R(c, x + 18, base - 28, 2, 4, "#F2C14E");
    sign(c, x - 8, base - 66, 46, 10, "#2B4C8C", label, "#fff", 7); }

  /* ================= latar perjalanan ================= */
  const SKY = { pagi: ["#F7C59A", "#FCE8CF"], siang: ["#82BDEE", "#D8EDFB"], sore: ["#F0A27A", "#F9D9B5"] };
  function sky(c, w, k) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, SKY[k][0]); g.addColorStop(1, SKY[k][1]); c.fillStyle = g; c.fillRect(0, 0, w, H);
    c.fillStyle = "rgba(255,255,255,.8)"; for (let i = 10; i < w; i += 92) { const cy = 8 + (i * 7) % 16; c.fillRect(i + 6, cy, 28, 5); c.fillRect(i + 12, cy - 4, 14, 4); c.fillRect(i + 2, cy + 5, 38, 4); } }
  const ROOF = { brown: [[0, 1, 2], [12, 13, 14], [24, 25, 26]], blue: [[6, 7, 8], [18, 19, 20], [30, 31, 32]] };
  function rowOf(l, m, r, w) { const a = [l]; for (let i = 0; i < w - 2; i++) a.push(m); a.push(r); return a; }
  function building(c, x, b, groundY) {
    const rows = [], Rf = ROOF[b.roof], rr = b.roofRows || 2;
    rows.push(rowOf(Rf[0][0], Rf[0][1], Rf[0][2], b.w)); if (rr === 3) rows.push(rowOf(Rf[1][0], Rf[1][1], Rf[1][2], b.w)); rows.push(rowOf(Rf[2][0], Rf[2][1], Rf[2][2], b.w));
    const red = b.wall === "red";
    for (let f = 0; f < (b.floors || 1); f++) { const r = [red ? 36 : 42]; for (let i = 1; i < b.w - 1; i++) r.push(i % 2 ? (red ? 40 : 46) : (red ? 37 : 44)); r.push(red ? 41 : 47); rows.push(r); }
    const bot = [red ? 48 : 54]; for (let i = 1; i < b.w - 1; i++) bot.push(red ? 49 : 55); bot.push(red ? 53 : 59);
    const mid = Math.floor(b.w / 2);
    if (b.door === "double" && red) { bot[mid - 1] = 50; bot[mid] = 51; }
    else if (b.door === "shop") { bot[1] = 56; bot[2] = 57; bot[b.w - 2] = 58; if (b.w > 5) { bot[3] = 56; bot[4] = 57; } }
    else bot[mid] = red ? 52 : 58;
    rows.push(bot);
    const top = groundY - rows.length * T;
    rows.forEach((r, yi) => r.forEach((t, xi) => city(c, t, x + xi * T, top + yi * T)));
    const doorX = x + (b.door === "shop" ? (b.w - 2) * T + 8 : mid * T + (b.door === "double" ? 0 : 8));
    if (b.sign) sign(c, x + 4, top + rr * T + 2, b.w * T - 8, 11, b.signBg || "#2E7D5B", b.sign, "#fff", 8);
    if (b.noren) noren(c, doorX - 9, groundY - 16, 18, b.noren, b.norenTxt);
    if (b.posters) for (let k = 0; k < b.posters; k++) { R(c, x + 6 + k * 9, groundY - 13, 7, 9, OL); R(c, x + 7 + k * 9, groundY - 12, 5, 7, "#FFFFFF"); R(c, x + 7 + k * 9, groundY - 12, 5, 2, "#E0B040"); }
    return { x, w: b.w * T, door: doorX, top };
  }
  const OUTDOOR = {
    perumahan: { sky: "pagi", far: "bukit", houses: [
      { w: 4, roof: "brown", wall: "red", door: "single" }, { w: 3, roof: "blue", wall: "brown", door: "single" },
      { w: 4, roof: "brown", wall: "brown", door: "single" }, { w: 3, roof: "brown", wall: "red", door: "single" } ],
      dest: { w: 5, roof: "blue", wall: "brown", door: "shop", sign: "コンビニ", signBg: "#2E9A63" } },
    shotengai: { sky: "sore", far: "kota", houses: [
      { w: 3, roof: "brown", wall: "brown", door: "shop", noren: "#2B4C8C", norenTxt: "そば" }, { w: 3, roof: "brown", wall: "red", door: "single", noren: "#B23A3A", norenTxt: "やさい" },
      { w: 4, roof: "blue", wall: "brown", door: "shop", noren: "#4C7A3A", norenTxt: "おちゃ" }, { w: 3, roof: "brown", wall: "red", door: "single", noren: "#7A3A8E", norenTxt: "たこやき" } ],
      dest: { w: 5, roof: "brown", wall: "brown", door: "shop", sign: "おみやげ", signBg: "#B23A3A", noren: "#B23A3A", norenTxt: "おみやげ" } },
    kota: { sky: "siang", far: "kota", houses: [
      { w: 4, roof: "blue", wall: "brown", door: "single", floors: 2 }, { w: 3, roof: "brown", wall: "red", door: "single", floors: 3 },
      { w: 5, roof: "blue", wall: "red", door: "double", floors: 2, sign: "ぎんこう", signBg: "#2B4C8C" }, { w: 3, roof: "blue", wall: "brown", door: "single", floors: 3 } ],
      dest: { w: 5, roof: "brown", wall: "brown", door: "shop", sign: "ふどうさん", signBg: "#E07A2E", posters: 3 } },
  };
  function buildOutdoor(kind, n) {
    const cf = OUTDOOR[kind], G = 88;
    const npcX = Array.from({ length: n }, (_, i) => 110 + i * NPC_GAP);
    const destX = npcX[n - 1] + 104, worldW = destX + cf.dest.w * T + 70;
    const [c, x] = canvas(worldW, H);
    sky(x, worldW, cf.sky);
    const rnd = rng(kind.length * 977);
    if (cf.far === "bukit") {         // bukit bertangga lembut + rumah kecil di kejauhan (gaya pixel datar)
      for (let bx = -10; bx < worldW; bx += 70) { const h = 22 + (bx * 13) % 16; for (let s = 0; s < 5; s++) R(x, bx + s * 6, G - h + s * 3, 70 - s * 12, h, s % 2 ? "#E8B996" : "#EEC6A6"); }
      for (let bx = 20; bx < worldW; bx += 54) { const hx = bx + (bx * 7) % 20; R(x, hx, G - 26, 12, 8, "#D9A487"); R(x, hx - 1, G - 29, 14, 3, "#C98A73"); R(x, hx + 5, G - 22, 2, 4, "#B9796A"); }
    } else {
      x.globalAlpha = .28;
      for (let bx = 0; bx < worldW; bx += 50) { const fl = 2 + Math.floor(rnd() * 3); x.save(); x.translate(0, -8); building(x, bx, { w: 3, roof: "blue", wall: rnd() < .5 ? "red" : "brown", door: "single", floors: fl }, G); x.restore(); }
      x.globalAlpha = 1;
    }
    let X = -6, k = 0;
    while (X < destX - 44) {
      const sp = cf.houses[k % cf.houses.length];
      if (X + sp.w * T > destX - 10) break;
      building(x, X, sp, G); X += sp.w * T;
      const gap = 18 + (k % 3) * 8;
      if (kind === "perumahan") { city(x, 105, X, G - 14); for (let i = 16; i < gap - 6; i += 16) city(x, 106, X + i, G - 14); if (k % 2) { city(x, 68, X + 2, G - 30); city(x, 80, X + 2, G - 16); } else city(x, 71, X + 3, G - 14); }
      else if (kind === "shotengai") nobori(x, X + 6, G, ["#B23A3A", "#2B4C8C", "#4C7A3A"][k % 3], ["やすい", "セール", "おいしい"][k % 3]);
      else { if (k % 2) city(x, 81, X + 1, G - 12); else { city(x, 86, X + 4, G - 30); city(x, 98, X + 4, G - 16); } }
      X += gap; k++;
    }
    const dest = building(x, destX, cf.dest, G);
    for (let i = 0; i * T < worldW; i++) { city(x, 88, i * T, G); city(x, i % 4 === 1 ? 64 : 63, i * T, G + T); }
    if (kind === "shotengai") {       // gerbang & lampion berjejer
      sign(x, 6, 4, 70, 12, "#B23A3A", "しょうてんがい", "#fff", 8); R(x, 8, 16, 2, G - 16, OL); R(x, 72, 16, 2, G - 16, OL);
      R(x, 0, 20, worldW, 1, "rgba(63,38,49,.7)"); for (let lx = 20; lx < worldW; lx += 26) lantern(x, lx, 21 + ((lx / 26) % 2) * 2);
    }
    for (let i = 56; i < worldW - 30; i += 104) { if (Math.abs(i - dest.door) < 40) continue; city(x, 86, i, G - 14); city(x, 98, i, G - 2); }
    return { canvas: x.canvas, w: worldW, npcX, door: dest.door, feet: 100 };
  }

  /* ================= latar dalam ruangan (berjalan) ================= */
  const INDOOR = {
    perpustakaan: { wall: "#EFE3C8", trim: "#D9C7A0", floor: ["kayu", "#B98C5A"], door: ["うけつけ", "#2E7D5B"],
      props: [ (c, x, b, r) => (bookshelf(c, x, b, 44, 64, r), 44), (c, x, b, r) => (bookshelf(c, x, b, 44, 64, r), 44),
        (c, x, b, r) => (windowBox(c, x, 14, 30, 40, "pohon", r), poster(c, x + 6, 58, 18, 16, "#2E7D5B", "しずかに"), 30),
        (c, x, b, r) => (bookshelf(c, x, b, 38, 64, r), 38), (c, x, b, r) => (clock(c, x + 6, 12), plant(c, x + 3, b, true), 22) ] },
    sekolah: { wall: "#EEF1F3", wains: "#9DB6A8", trim: "#7F9C8C", floor: ["kayu", "#CFA676"], door: ["１ねん Aくみ", "#2B4C8C"],
      props: [ (c, x, b, r) => (windowBox(c, x, 12, 42, 36, "pohon", r), 42), (c, x, b, r) => (slideDoor(c, x, b, ["１-B", "２-A", "２-B"][Math.floor(r() * 3)]), 24),
        (c, x, b, r) => (corkboard(c, x, 22, 40, 26, r), extinguisher(c, x + 32, b), 40), (c, x, b, r) => (lockers(c, x, b, 40, 44), 40), (c, x, b, r) => (windowBox(c, x, 12, 42, 36, "langit", r), plant(c, x + 14, b), 42) ] },
    stasiun: { wall: "#E1E4E8", wains: "#C3C9D1", trim: "#9AA2B1", floor: ["ubin", "#CFD3D9"], door: ["みどりの まどぐち", "#2E9A63"], tactile: true,
      props: [ (c, x, b, r) => (deptBoard(c, x, 10, 58), gates(c, x + 2, b, 4), 60), (c, x, b, r) => (poster(c, x, 22, 22, 30, "#3F6FB0", "きょうと"), 22),
        (c, x, b, r) => (vending(c, x, b, "#D9453B"), 22), (c, x, b, r) => (ticketMachine(c, x, b), ticketMachine(c, x + 20, b), sign(c, x, 22, 38, 9, "#1B1620", "きっぷ", "#FFB347", 7), 38),
        (c, x, b, r) => (clock(c, x + 12, 14), bench(c, x, b, 34), 34), (c, x, b, r) => (poster(c, x, 22, 22, 30, "#E04B5A", "ふじさん"), 22) ] },
    klinik: { wall: "#DDEFEA", wains: "#B9DDD1", trim: "#8FC2B0", floor: ["ubin", "#E9ECEF"], door: ["しんさつしつ", "#3F8C7A"],
      props: [ (c, x, b, r) => (chairsRow(c, x, b, 4, "#5B8FD6"), 44), (c, x, b, r) => (poster(c, x, 22, 20, 26, "#3F8C7A", "てあらい"), 20),
        (c, x, b, r) => (numDisplay(c, x, 14, 30, "０２５"), receptionDesk(c, x - 4, b, 40), 36), (c, x, b, r) => (waterServer(c, x, b), plant(c, x + 14, b), 28),
        (c, x, b, r) => (windowBox(c, x, 14, 32, 34, "pohon", r), chairsRow(c, x, b, 3, "#E08A9A"), 34) ] },
    balaikota: { wall: "#ECE8DF", wains: "#CDC5B4", trim: "#A99F8A", floor: ["marmer", "#D9D4C9"], door: ["まどぐち", "#2B4C8C"],
      props: [ (c, x, b, r, S) => { counterWindow(c, x, b, "１", S); return 46; }, (c, x, b, r) => (numDisplay(c, x, 16, 30, "１２３"), chairsRow(c, x - 4, b, 4, "#8E7AB8"), 40),
        (c, x, b, r) => (corkboard(c, x, 20, 38, 26, r), 38), (c, x, b, r, S) => { counterWindow(c, x, b, "２", S); return 46; }, (c, x, b, r) => (plant(c, x, b, true), poster(c, x + 16, 24, 18, 24, "#2B4C8C", "おしらせ"), 34) ] },
    lobi: { wall: "#D8D2C8", wains: "#B9AE9C", trim: "#8E8270", floor: ["marmer", "#E6E1D8"], door: ["めんせつしつ", "#2B4C8C"],
      props: [ (c, x, b, r) => (sign(c, x, 14, 60, 12, "#2B4C8C", "ABC しょうじ", "#fff", 8), receptionDesk(c, x + 4, b, 52), 60), (c, x, b, r) => (plant(c, x, b, true), 18),
        (c, x, b, r) => (elevator(c, x, b), elevator(c, x + 32, b), 60), (c, x, b, r) => (windowBox(c, x, 12, 40, 44, "kota", r), sofa(c, x + 4, b, 32), 40), (c, x, b, r) => (poster(c, x, 22, 22, 28, "#E07A2E", "ようこそ"), 22) ] },
    kantor: { wall: "#EEF0F3", wains: null, trim: "#B9C0CA", floor: ["karpet", "#7D8BA6"], door: ["しゃちょうしつ", "#3F2631"],
      props: [ (c, x, b, r) => (windowBox(c, x, 10, 46, 40, "kota", r), desk(c, x + 2, b, 40, true), 46), (c, x, b, r) => (whiteboard(c, x, 18, 40, 24, r), 40),
        (c, x, b, r) => (copier(c, x, b), waterServer(c, x + 28, b), 40), (c, x, b, r) => (windowBox(c, x, 10, 46, 40, "kota", r), desk(c, x + 2, b, 40, "#7CE08A"), 46), (c, x, b, r) => (bookshelf(c, x, b, 30, 56, r), plant(c, x + 32, b), 46) ] },
  };
  function counterWindow(c, x, base, no, staff) {
    R(c, x, 20, 44, base - 20 - 20, "#F7F4EC"); R(c, x, 20, 44, 1, OL); R(c, x, 20, 1, base - 40, OL); R(c, x + 43, 20, 1, base - 40, OL);
    sign(c, x + 12, 10, 20, 10, "#2B4C8C", no + "ばん", "#fff", 7);
    if (staff) { const s = sprite(staff); c.drawImage(s, x + 14, base - 38); }
    counterTop(c, x - 2, base - 22, 48, 22, "#E6DCC8", "#9C8466", "#7A6448");
    R(c, x + 4, base - 25, 8, 3, "#FFFFFF"); R(c, x + 30, base - 26, 6, 4, "#5DB3E8");
  }
  function drawFloor(c, w, y, kind, col) {
    R(c, 0, y, w, H - y, col);
    const dk = "rgba(0,0,0,.10)", lt = "rgba(255,255,255,.18)";
    if (kind === "kayu") { for (let ly = y + 5; ly < H; ly += 6) { R(c, 0, ly, w, 1, dk); for (let lx = ((ly / 6) % 2) * 18; lx < w; lx += 36) R(c, lx, ly - 5, 1, 5, dk); } }
    else if (kind === "ubin") { for (let ly = y; ly < H; ly += 12) R(c, 0, ly, w, 1, dk); for (let lx = 0; lx < w; lx += 12) R(c, lx, y, 1, H - y, dk); }
    else if (kind === "marmer") { for (let ly = y; ly < H; ly += 16) R(c, 0, ly, w, 1, dk); for (let lx = 0; lx < w; lx += 24) { R(c, lx, y, 1, H - y, dk); R(c, lx + 6, y + 4, 8, 1, lt); R(c, lx + 12, y + 20, 6, 1, lt); } }
    else if (kind === "karpet") { for (let ly = y + 2; ly < H; ly += 4) for (let lx = (ly % 8) / 2; lx < w; lx += 8) R(c, lx, ly, 1, 1, dk); }
    R(c, 0, y, w, 1, "rgba(0,0,0,.25)");
  }
  function buildIndoor(kind, n, S) {
    const cf = INDOOR[kind], FL = 82;
    const npcX = Array.from({ length: n }, (_, i) => 110 + i * NPC_GAP);
    const doorX = npcX[n - 1] + 100, worldW = doorX + 80;
    const [c, x] = canvas(worldW, H);
    R(x, 0, 0, worldW, FL, cf.wall);
    if (cf.wains) { R(x, 0, FL - 26, worldW, 26, cf.wains); R(x, 0, FL - 27, worldW, 1, cf.trim); }
    R(x, 0, 0, worldW, 4, cf.trim); for (let lx = 14; lx < worldW; lx += 48) { R(x, lx, 4, 22, 2, "#FFFFFF"); R(x, lx - 1, 6, 24, 1, "rgba(255,255,255,.5)"); }
    drawFloor(x, worldW, FL, cf.floor[0], cf.floor[1]);
    R(x, 0, FL - 3, worldW, 3, cf.trim);
    if (cf.tactile) for (let lx = 0; lx < worldW; lx += 6) R(x, lx, FL + 14, 5, 3, "#F2C14E");
    const rnd = rng(kind.length * 131 + 7);
    let X = 6, k = 0;
    while (X < doorX - 50) { const w = cf.props[k % cf.props.length](x, X, FL, rnd, S); X += w + 8 + Math.floor(rnd() * 8); k++; }
    bigDoor(x, doorX, FL, cf.door[0], cf.door[1]);
    return { canvas: c, w: worldW, npcX, door: doorX + 15, feet: 104 };
  }

  /* ================= ruangan bos ================= */
  const ROOM_FL = 80;
  function roomBase(c, wall, floor, fcol, trim) { R(c, 0, 0, W, ROOM_FL, wall); R(c, 0, 0, W, 4, trim); drawFloor(c, W, ROOM_FL, floor, fcol); R(c, 0, ROOM_FL - 3, W, 3, trim); }
  const ROOMS = {
    konbini(c, rnd) { roomBase(c, "#F6F6F2", "ubin", "#E4E7EA", "#C8CDD3");
      R(c, 0, 4, W, 3, "#2E9A63"); R(c, 0, 7, W, 2, "#F2A33A"); R(c, 0, 9, W, 2, "#3F6FB0");
      productShelf(c, 2, ROOM_FL, 52, 52, rnd); fridge(c, 112, ROOM_FL, 46, 60); sign(c, 66, 16, 40, 11, "#2E9A63", "レジ", "#fff", 8);
      return { boss: [86, 94], front(c) { counterTop(c, 60, 86, 100, 22, "#F3F3EF", "#FFFFFF", "#3F6FB0"); register(c, 120, 77); R(c, 70, 82, 10, 4, "#F2C14E"); R(c, 82, 83, 6, 3, "#E04B5A"); } }; },
    uketsuke(c, rnd) { roomBase(c, "#EFE3C8", "kayu", "#B98C5A", "#D9C7A0");
      bookshelf(c, 2, ROOM_FL, 50, 66, rnd); bookshelf(c, 108, ROOM_FL, 50, 66, rnd); sign(c, 64, 12, 36, 11, "#2E7D5B", "うけつけ", "#fff", 8); clock(c, 78, 28);
      return { boss: [84, 94], front(c) { counterTop(c, 58, 86, 102, 22, "#C49A6C", "#8B5A2B", "#6E4423"); monitor(c, 128, 74); for (let k = 0; k < 4; k++) R(c, 68, 82 - k * 2, 12, 2, BOOK[k]); plant(c, 146, 87); } }; },
    kelas(c, rnd) { roomBase(c, "#EEF1F3", "kayu", "#CFA676", "#9DB6A8");
      blackboard(c, 14, 12, 92, 44, ["じこしょうかい", "なまえ・くに・しゅみ"]); windowBox(c, 118, 12, 38, 40, "pohon", rnd); clock(c, 128, 58);
      return { boss: [94, 96], playerX: 44, front(c) { R(c, 86, 88, 44, 4, OL); R(c, 87, 89, 42, 2, "#C49A6C"); R(c, 90, 92, 36, 14, OL); R(c, 91, 92, 34, 13, "#9C6B3E");
        const stu = [{ sprite: "m", rambut: "hitam", baju: "seragam" }, { sprite: "f", rambut: "hitam", baju: "seragam" }, { sprite: "m", rambut: "coklat", baju: "seragam" }, { sprite: "f", rambut: "coklat", baju: "seragam" }];
        stu.forEach((sp, i) => { const sx = 4 + i * 40; c.drawImage(sprite(sp), 0, 0, 16, 10, sx + 4, 108, 16, 10); studentDesk(c, sx, 120); }); } }; },
    omiyage(c, rnd) { roomBase(c, "#F6E7CF", "kayu", "#A9733F", "#D9B98A");
      boxShelf(c, 2, ROOM_FL, 54, 64, rnd); boxShelf(c, 104, ROOM_FL, 54, 64, rnd); noren(c, 62, 12, 36, "#B23A3A", "おみやげ"); for (let lx = 8; lx < W; lx += 34) if (lx < 50 || lx > 110) lantern(c, lx, 12);
      return { boss: [84, 94], front(c) { counterTop(c, 60, 86, 100, 22, "#C49A6C", "#7A4E2D", "#5B3A1E"); maneki(c, 140, 86); box(c, 70, 78, 12, 8, "#E04B5A"); R(c, 75, 79, 1, 6, "#fff"); box(c, 84, 80, 10, 6, "#F2C14E"); } }; },
    loket(c, rnd) { roomBase(c, "#E1E4E8", "ubin", "#CFD3D9", "#9AA2B1");
      sign(c, 40, 11, 80, 11, "#2E9A63", "みどりの まどぐち", "#fff", 8); box(c, 6, 22, 30, 18, "#1B1620"); txt(c, "10:30", 21, 28, "#FFB347", 7); txt(c, "きょうと", 21, 35, "#7CE08A", 6);
      poster(c, 132, 22, 24, 32, "#3F6FB0", "しんかんせん"); R(c, 46, 22, 2, 60, OL); R(c, 128, 22, 2, 60, OL);
      return { boss: [80, 92], front(c) { c.fillStyle = "rgba(190,228,245,.28)"; c.fillRect(48, 22, 80, 56); R(c, 48, 22, 80, 1, OL); R(c, 56, 26, 2, 40, "rgba(255,255,255,.5)"); R(c, 62, 26, 1, 30, "rgba(255,255,255,.4)");
        counterTop(c, 40, 84, 96, 24, "#D8DCE3", "#8C97A6", "#6E7889"); R(c, 76, 84, 24, 3, OL); R(c, 77, 85, 22, 1, "#B9C3D0"); } }; },
    dokter(c, rnd) { roomBase(c, "#E3F2EC", "ubin", "#E9ECEF", "#8FC2B0");
      lightbox(c, 8, 14, 36, 26); poster(c, 50, 16, 18, 26, "#3F8C7A", "め"); curtain(c, 112, 12, 46, 66); bed(c, 116, ROOM_FL + 6, 40);
      return { boss: [76, 92], front(c) { R(c, 60, 88, 52, 4, OL); R(c, 61, 89, 50, 2, "#EDE6DA"); R(c, 62, 92, 4, 18, OL); R(c, 106, 92, 4, 18, OL); R(c, 66, 92, 40, 10, "#C9C2B4"); monitor(c, 62, 76); R(c, 96, 85, 10, 3, "#FFFFFF"); } }; },
    properti(c, rnd) { roomBase(c, "#F3EEE4", "karpet", "#9C8B78", "#C9BCA6");
      for (let k = 0; k < 4; k++) floorPlan(c, 6 + k * 38, 10, 32, 30, rnd); sign(c, 50, 44, 60, 10, "#E07A2E", "ふどうさん", "#fff", 7); plant(c, 4, ROOM_FL, true);
      return { boss: [84, 92], front(c) { R(c, 58, 88, 100, 4, OL); R(c, 59, 89, 98, 2, "#C49A6C"); R(c, 62, 92, 92, 14, OL); R(c, 63, 92, 90, 13, "#8B5A2B"); R(c, 70, 84, 14, 4, "#FFFFFF"); R(c, 71, 85, 12, 1, "#3F6FB0"); R(c, 92, 84, 12, 4, "#FFF3B0"); R(c, 120, 85, 8, 2, OL); } }; },
    madoguchi(c, rnd) { roomBase(c, "#ECE8DF", "marmer", "#D9D4C9", "#A99F8A");
      sign(c, 64, 13, 32, 11, "#2B4C8C", "３ばん", "#fff", 8); numDisplay(c, 114, 18, 40, "１２３"); corkboard(c, 6, 18, 40, 30, rnd);
      return { boss: [82, 91], front(c) { counterTop(c, 40, 86, 96, 22, "#E6DCC8", "#9C8466", "#7A6448"); R(c, 52, 82, 14, 4, "#FFFFFF"); R(c, 53, 83, 12, 1, "#3F6FB0"); R(c, 112, 80, 4, 6, OL); R(c, 113, 81, 2, 4, "#5DB3E8"); } }; },
    wawancara(c, rnd) { roomBase(c, "#EEF0F3", "karpet", "#6F7E98", "#B9C0CA");
      windowBox(c, 96, 8, 60, 50, "kota", rnd); whiteboard(c, 8, 14, 50, 30, rnd); plant(c, 70, ROOM_FL, true);
      return { boss: [86, 93], front(c) { R(c, 50, 90, 110, 4, OL); R(c, 51, 91, 108, 2, "#6E4A2A"); R(c, 54, 94, 102, 14, OL); R(c, 55, 94, 100, 13, "#4E3020"); R(c, 74, 86, 14, 4, "#FFFFFF"); R(c, 120, 86, 6, 4, "#FFFFFF"); } }; },
    shachou(c, rnd) { roomBase(c, "#E9E2D6", "karpet", "#7A3B44", "#B9A889");
      windowBox(c, 54, 6, 100, 56, "kota", rnd); bookshelf(c, 2, ROOM_FL, 44, 70, rnd); trophy(c, 8, 22); trophy(c, 28, 22); rug(c, 10, 96, 60, 18); plant(c, 140, ROOM_FL, true);
      return { boss: [94, 92], front(c) { R(c, 64, 88, 96, 5, OL); R(c, 65, 89, 94, 3, "#5B3A1E"); R(c, 66, 93, 92, 16, OL); R(c, 67, 93, 90, 15, "#3E2616"); R(c, 67, 93, 90, 1, "#7A4E2D");
        sign(c, 92, 98, 36, 8, "#E0B040", "しゃちょう", "#3F2631", 6); R(c, 140, 78, 3, 10, OL); R(c, 136, 74, 10, 5, "#4C9A5A"); } }; },
  };
  function buildRoom(kind) {
    const [c, x] = canvas(W, H);
    const info = (ROOMS[kind] || ROOMS.konbini)(x, rng(kind.length * 53 + 11));
    return { canvas: c, ...info };
  }

  /* ================= emote ================= */
  function emote(c, kind, x, y, t) {
    const b = REDUCED ? 0 : Math.round(Math.sin(t * 6)); c.save(); c.translate(Math.round(x), Math.round(y + b));
    if (kind === "!") { R(c, -5, -12, 11, 13, OL); R(c, -4, -11, 9, 11, "#fff"); R(c, 0, -9, 1, 5, "#E5484D"); R(c, 0, -3, 1, 1, "#E5484D"); }
    else if (kind === "heart") { [[-3, -6, 2, 1], [1, -6, 2, 1], [-4, -5, 8, 2], [-3, -3, 6, 1], [-2, -2, 4, 1], [-1, -1, 2, 1]].forEach(r => R(c, r[0], r[1], r[2], r[3], "#F0507A")); R(c, -2, -5, 1, 1, "#FFC2D4"); }
    else if (kind === "angry") { [[-4, -7, 2, 3], [2, -7, 2, 3], [-4, -1, 2, 3], [2, -1, 2, 3], [-2, -5, 1, 1], [1, -5, 1, 1], [-2, -2, 1, 1], [1, -2, 1, 1]].forEach(r => R(c, r[0], r[1], r[2], r[3], "#E5484D")); }
    else if (kind === "note") { R(c, 1, -9, 1, 7, OL); R(c, 2, -9, 3, 1, OL); R(c, -1, -3, 3, 2, OL); }
    else if (kind === "sweat") { R(c, 0, -6, 2, 3, "#6CB8EE"); R(c, -1, -4, 4, 3, "#6CB8EE"); }
    c.restore();
  }

  /* ================= CSS (layar penuh) ================= */
  const CSS = `
  body.g-lock{ overflow:hidden; }
  .g-full{ position:fixed; inset:0; z-index:400; background:#1A1424; color:#2A1E26; display:flex; flex-direction:column; align-items:center;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); font-family:'Zen Maru Gothic', var(--f-body), sans-serif; }
  .g-col{ width:100%; max-width:min(560px, calc((100vh - 230px) * 4 / 3 + 40px)); min-width:min(100%, 320px); flex:1; display:flex; flex-direction:column; min-height:0; }
  .g-hud{ display:flex; align-items:center; gap:8px; padding:8px 10px; color:#fff; }
  .g-x{ width:38px; height:38px; flex:none; border-radius:10px; border:2px solid #4A3B5C; background:#2A2138; color:#fff; font-size:18px; font-weight:900; cursor:pointer; }
  .g-hud .g-title{ flex:1; min-width:0; font-family:'DotGothic16', monospace; font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:.02em; }
  .g-hud .g-title small{ display:block; font-size:11px; color:#FFD84A; font-family:'Zen Maru Gothic', sans-serif; font-weight:800; }
  .g-coin{ font-size:13px; font-weight:900; color:#FFD84A; background:#2A2138; border:2px solid #4A3B5C; border-radius:999px; padding:3px 10px; white-space:nowrap; }
  .g-hearts{ font-size:19px; letter-spacing:1px; color:#FF5A6E; white-space:nowrap; text-shadow:0 2px 0 #000; }
  .g-hearts .off{ color:#4A3B5C; }
  .g-screen{ position:relative; margin:0 10px; border:3px solid #000; border-radius:6px; overflow:hidden; background:#000; box-shadow:0 0 0 3px #4A3B5C; flex:none; }
  .g-screen canvas{ display:block; width:100%; height:auto; image-rendering:pixelated; image-rendering:crisp-edges; }
  .g-screen.shake{ animation:gShake .35s; }
  @keyframes gShake{ 20%{ transform:translateX(-6px); } 40%{ transform:translateX(6px); } 60%{ transform:translateX(-3px); } 80%{ transform:translateX(2px); } }
  .g-banner{ position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); text-align:center; padding:10px 12px; background:rgba(16,10,24,.86); color:#fff;
    font-family:'DotGothic16', monospace; font-size:15px; line-height:1.45; opacity:0; pointer-events:none; transition:opacity .25s; border-top:2px solid #FFD84A; border-bottom:2px solid #FFD84A; }
  .g-banner.show{ opacity:1; }
  .g-banner b{ display:block; font-size:20px; color:#FFD84A; letter-spacing:.05em; }
  .g-banner small{ font-family:'Zen Maru Gothic', sans-serif; font-weight:700; font-size:12.5px; color:#E9E2F5; }
  .g-panel{ flex:1; min-height:0; overflow-y:auto; margin:10px; background:#FFF7E8; border:3px solid #000; box-shadow:0 0 0 3px #4A3B5C, inset 0 -4px 0 #E8D8B8; border-radius:6px; padding:14px; }
  .g-who{ display:flex; align-items:center; gap:8px; font-size:14px; font-weight:900; color:#6B4E3D; margin-bottom:4px; }
  .g-who .tag{ font-size:11px; padding:1px 8px; border-radius:4px; background:#E5484D; color:#fff; font-family:'DotGothic16', monospace; }
  .g-line{ font-size:23px; font-weight:900; line-height:1.55; margin:2px 0 6px; color:#1E1418; }
  .g-line ruby rt, .g-opt ruby rt, .g-fb ruby rt, .g-review ruby rt{ font-size:.5em; font-weight:700; color:#8A6F60; }
  .g-arti{ font-size:14px; font-weight:700; color:#7A6455; margin-bottom:4px; }
  .g-arti button{ background:#FFF; border:2px dashed #C9B49A; border-radius:999px; padding:3px 12px; font-size:13px; font-weight:800; color:#7A6455; cursor:pointer; font-family:inherit; }
  .g-tugas{ font-size:15px; color:#2B4C8C; font-weight:900; margin:6px 0 10px; background:#E8F0FB; border-radius:8px; padding:7px 10px; }
  .g-opts{ display:flex; flex-direction:column; gap:9px; }
  .g-opt{ text-align:left; background:#FFFFFF; border:3px solid #2A1E26; border-radius:8px; padding:11px 13px; font-size:18.5px; font-weight:800; font-family:inherit; line-height:1.5;
    color:#1E1418; cursor:pointer; box-shadow:0 4px 0 #2A1E26; transition:transform .06s; }
  .g-opt:active{ transform:translateY(3px); box-shadow:0 1px 0 #2A1E26; }
  .g-opt.ok{ background:#DDF6E3; border-color:#2E8B57; box-shadow:0 4px 0 #2E8B57; }
  .g-opt.ng{ background:#FDE2E4; border-color:#C9344A; box-shadow:0 4px 0 #C9344A; }
  .g-opt[disabled]{ cursor:default; }
  .g-fb{ margin-top:12px; border-radius:8px; padding:11px 13px; font-size:15px; font-weight:700; line-height:1.55; display:none; }
  .g-fb.show{ display:block; }
  .g-fb.ok{ background:#DDF6E3; color:#1F6B42; border:2px solid #2E8B57; }
  .g-fb.ng{ background:#FDE2E4; color:#8E1F33; border:2px solid #C9344A; }
  .g-fb b{ display:block; font-size:17.5px; font-weight:900; }
  .g-timer{ height:12px; background:#3A2E46; border:2px solid #000; border-radius:4px; overflow:hidden; margin:4px 0 8px; }
  .g-timer i{ display:block; height:100%; width:100%; background:linear-gradient(90deg,#FFD84A,#FF5A3A); transform-origin:left; }
  .g-btn{ width:100%; margin-top:12px; padding:13px; font-size:17px; font-weight:900; font-family:'DotGothic16', 'Zen Maru Gothic', sans-serif; letter-spacing:.04em; color:#fff;
    background:#2B4C8C; border:3px solid #000; border-radius:8px; box-shadow:0 4px 0 #000; cursor:pointer; }
  .g-btn:active{ transform:translateY(3px); box-shadow:0 1px 0 #000; }
  .g-btn.alt{ background:#FFF; color:#2A1E26; }
  .g-btn.go{ background:#E5484D; }
  .g-wait{ text-align:center; color:#8A6F60; font-size:15px; font-weight:800; padding:26px 0; font-family:'DotGothic16', 'Zen Maru Gothic', sans-serif; }
  .g-menu{ flex:1; overflow-y:auto; padding:4px 12px 24px; color:#fff; }
  .g-hero{ text-align:center; margin:6px 0 14px; }
  .g-hero h2{ font-family:'DotGothic16', monospace; font-size:26px; margin:0 0 6px; color:#FFD84A; text-shadow:0 3px 0 #000; }
  .g-hero p{ color:#D9D0E6; font-size:14px; font-weight:700; margin:0; line-height:1.55; }
  .g-chr{ display:flex; gap:8px; margin:6px 0 16px; }
  .g-chr button{ flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; border-radius:8px; border:3px solid #4A3B5C; background:#2A2138; color:#fff; font-size:15px; font-weight:900; cursor:pointer; font-family:inherit; }
  .g-chr button.on{ border-color:#FFD84A; box-shadow:0 0 0 2px #FFD84A; }
  .g-chr canvas{ width:36px; height:36px; image-rendering:pixelated; }
  .g-list{ display:flex; flex-direction:column; gap:10px; }
  .g-stage{ display:flex; gap:12px; align-items:center; text-align:left; width:100%; background:#FFF7E8; border:3px solid #000; border-radius:8px; padding:11px 12px; cursor:pointer; color:#1E1418; box-shadow:0 4px 0 #000; font-family:inherit; }
  .g-stage:active{ transform:translateY(3px); box-shadow:0 1px 0 #000; }
  .g-stage .num{ width:46px; height:46px; flex:none; border-radius:6px; background:#2A1E26; color:#FFD84A; display:flex; align-items:center; justify-content:center; font-family:'DotGothic16', monospace; font-size:21px; }
  .g-stage h4{ margin:0; font-size:17px; font-weight:900; font-family:'DotGothic16', 'Zen Maru Gothic', sans-serif; }
  .g-stage .q{ font-size:13.5px; font-weight:800; color:#2B4C8C; margin:2px 0; }
  .g-stage .lv{ font-size:11.5px; font-weight:800; color:#8A6F60; }
  .g-stage .st{ margin-left:auto; font-size:16px; color:#F5B301; white-space:nowrap; text-shadow:0 1px 0 #000; }
  .g-stage.lock{ opacity:.5; cursor:not-allowed; }
  .g-res{ text-align:center; }
  .g-res .stars{ font-size:38px; color:#F5B301; letter-spacing:4px; margin:2px 0; text-shadow:0 3px 0 #000; }
  .g-res .stars .off{ color:#D9CDB8; text-shadow:none; }
  .g-res h3{ font-family:'DotGothic16', monospace; font-size:24px; margin:2px 0 6px; }
  .g-res p{ color:#5B463A; font-size:15px; font-weight:700; margin:0 0 6px; line-height:1.55; }
  .g-review{ text-align:left; margin:14px 0 4px; font-size:14px; font-weight:700; }
  .g-review h5{ margin:0 0 8px; font-size:14px; color:#8A6F60; }
  .g-review div{ border-left:4px solid #C9344A; padding:7px 10px; margin-bottom:8px; background:#FDE2E4; border-radius:0 8px 8px 0; color:#1E1418; line-height:1.55; }
  .g-review b{ font-weight:900; }
  .g-credit{ text-align:center; font-size:11px; color:#8F84A0; margin-top:14px; }
  `;

  /* ================= state ================= */
  let API = null, ROOT = null, DATA = null, G = null, RAF = 0, styleEl = null, READY = null;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (s) => esc(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
  const plain = (s) => String(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, "$1");
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gsave() { const S = API.save(); if (!S.game || typeof S.game !== "object") S.game = { st: {}, chr: "m" }; if (!S.game.st) S.game.st = {}; return S.game; }

  function prepare() {
    if (READY) return READY;
    READY = Promise.all([
      loadImg("city", "city.png"),
      fetch(url("stages.json")).then(r => { if (!r.ok) throw new Error("stages"); return r.json(); }).then(j => { DATA = j; }),
      document.fonts && document.fonts.load ? document.fonts.load("8px 'DotGothic16'").catch(() => {}) : Promise.resolve(),
    ]);
    READY.catch(() => { READY = null; });
    return READY;
  }

  function shell(inner) {
    ROOT.innerHTML = `<div class="g-full"><div class="g-col">${inner}</div></div>`;
    const x = ROOT.querySelector("[data-gx]"); if (x) x.addEventListener("click", () => (G && G.phase !== "menu" && G.phase !== "win" && G.phase !== "lose") ? menuView() : API.exit());
  }

  /* ================= daftar stage ================= */
  function menuView() {
    stopLoop(); G = { phase: "menu" };
    const gs = gsave(), stages = DATA.stages;
    const cards = stages.map((s, i) => {
      const open = i === 0 || (gs.st[stages[i - 1].id] || 0) > 0, stars = gs.st[s.id] || 0;
      return `<button class="g-stage ${open ? "" : "lock"}" data-stage="${i}" ${open ? "" : "disabled"}>
        <div class="num">${open ? i + 1 : "🔒"}</div>
        <div><h4>${esc(s.judul)}</h4><div class="q">🎯 ${esc(s.quest)}</div><div class="lv">${open ? esc(s.level || "") : "Selesaikan stage sebelumnya dulu"}</div></div>
        <div class="st">${stars ? "★".repeat(stars) + "☆".repeat(3 - stars) : ""}</div></button>`;
    }).join("");
    shell(`<div class="g-hud"><button class="g-x" data-gx title="Keluar">✕</button><div class="g-title">Petualangan Nihongo<small>${stages.length} stage · makin tinggi makin sulit</small></div></div>
      <div class="g-menu">
        <div class="g-hero"><h2>冒険 ぼうけん</h2><p>Jalani Main Quest, sapa orang dengan sopan, lalu kalahkan bos di tujuan!<br>Salah jawab = ♥ berkurang & kena omel.</p></div>
        <div class="g-chr">
          <button data-chr="m" class="${gs.chr !== "f" ? "on" : ""}"><canvas width="16" height="16" data-spr="m"></canvas>Cowok</button>
          <button data-chr="f" class="${gs.chr === "f" ? "on" : ""}"><canvas width="16" height="16" data-spr="f"></canvas>Cewek</button>
        </div>
        <div class="g-list">${cards}</div>
        <div class="g-credit">Grafis kota: Kenney (kenney.nl) · CC0</div>
      </div>`);
    ROOT.querySelectorAll("canvas[data-spr]").forEach(cv => { const k = cv.dataset.spr; cv.getContext("2d").drawImage(sprite(playerSpec(stages[0], k)), 0, 0); });
    ROOT.querySelectorAll("[data-chr]").forEach(b => b.addEventListener("click", () => { gsave().chr = b.dataset.chr; API.persist(); menuView(); }));
    ROOT.querySelectorAll("[data-stage]").forEach(b => b.addEventListener("click", () => startStage(Number(b.dataset.stage))));
  }

  /* ================= main game ================= */
  function startStage(idx) {
    const st = DATA.stages[idx], gs = gsave();
    const n = st.tetangga.length;
    const world = OUTDOOR[st.jalan] ? buildOutdoor(st.jalan, n) : buildIndoor(st.jalan, n, { sprite: "f", rambut: "hitam", baju: "jas", aks: ["kacamata"] });
    G = { idx, st, world, room: null, hearts: 3, coins: 0, mistakes: [], px: 16, phase: "walk", npcIdx: 0, t: 0, last: 0, fade: 0,
      npcs: st.tetangga.map((nn, i) => ({ ...nn, x: world.npcX[i], mood: null, moodT: 0 })),
      player: sprite(playerSpec(st, gs.chr)), boss: null, bossHP: st.bos.hp, bossMax: st.bos.hp, bq: [], qStart: 0, qTime: 0, timerOn: false };
    shell(`<div class="g-hud"><button class="g-x" data-gx title="Kembali ke daftar stage">✕</button>
        <div class="g-title">${idx + 1}. ${esc(st.judul)}<small>🎯 ${esc(st.quest)}</small></div><div class="g-coin" id="gCoin">+0</div><div class="g-hearts" id="gHearts"></div></div>
      <div class="g-screen" id="gScreen"><canvas id="gCv" width="${W}" height="${H}"></canvas><div class="g-banner" id="gBanner"></div></div>
      <div class="g-panel" id="gPanel"><div class="g-wait">Berjalan…</div></div>`);
    G.cv = ROOT.querySelector("#gCv"); G.ctx = G.cv.getContext("2d"); G.ctx.imageSmoothingEnabled = false;
    hearts();
    banner(`<b>MAIN QUEST</b>${esc(st.quest)}<br><small>${esc(st.sub)}</small>`, 2600);
    startLoop();
  }
  function hearts() {
    const el = ROOT && ROOT.querySelector("#gHearts"); if (!el) return;
    el.innerHTML = [0, 1, 2].map(i => `<span class="${i < G.hearts ? "" : "off"}">♥</span>`).join("");
    const c = ROOT.querySelector("#gCoin"); if (c) c.textContent = `+${G.coins} koin`;
  }
  let bannerT = 0;
  function banner(html, ms) { const b = ROOT.querySelector("#gBanner"); if (!b) return; b.innerHTML = html; b.classList.add("show"); clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => b.classList.remove("show"), ms); }
  function shake() { const s = ROOT.querySelector("#gScreen"); if (!s) return; s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake"); }

  function panelQuestion(who, isBoss, q) {
    const P = ROOT.querySelector("#gPanel");
    const opts = shuffle(q.pilihan.map((o, i) => ({ ...o, i })));
    P.innerHTML = `<div class="g-who"><span>${esc(who)}</span>${isBoss ? `<span class="tag">BOS</span>` : ""}</div>
      <div class="g-line">${fmt(q.kata)}</div>
      ${isBoss ? `<div class="g-timer"><i id="gTimer"></i></div>` : ""}
      <div class="g-arti" id="gArti"><button type="button">👁 Lihat arti</button></div>
      <div class="g-tugas">🎯 ${esc(q.tugas)}</div>
      <div class="g-opts">${opts.map((o, k) => `<button class="g-opt" data-k="${k}">${fmt(o.t)}</button>`).join("")}</div>
      <div class="g-fb" id="gFb"></div>`;
    P.scrollTop = 0;
    P.querySelector("#gArti button").addEventListener("click", () => { P.querySelector("#gArti").textContent = q.arti; });
    P.querySelectorAll(".g-opt").forEach(b => b.addEventListener("click", () => answer(opts[Number(b.dataset.k)], b, q, isBoss, opts)));
    G.curOpts = opts;
  }

  function answer(opt, btn, q, isBoss, opts) {
    if (G.locked) return;
    G.locked = true; G.timerOn = false;
    opts = opts || G.curOpts;
    const P = ROOT.querySelector("#gPanel"), btns = [...P.querySelectorAll(".g-opt")];
    btns.forEach((b, k) => { b.disabled = true; if (opts[k] && opts[k].ok) b.classList.add("ok"); });
    const correctTxt = q.pilihan.find(o => o.ok).t, fb = P.querySelector("#gFb"), ok = !!(opt && opt.ok);
    if (btn && !ok) btn.classList.add("ng");
    if (ok) {
      if (isBoss) {
        const frac = Math.max(0, 1 - (performance.now() - G.qStart) / (G.qTime * 1000));
        const per = G.bossMax / G.st.bos.soal.length, dmg = Math.round(per * (0.8 + 0.45 * frac));
        G.bossHP = Math.max(0, G.bossHP - dmg); G.coins += 6 + G.idx; G.hitT = .5;
        fb.className = "g-fb ok show"; fb.innerHTML = `<b>${frac > .6 ? "CEPAT! " : ""}−${dmg} HP</b>Jawaban tepat!`;
      } else {
        const n = G.npcs[G.npcIdx]; n.mood = "heart"; n.moodT = 2; G.coins += 5 + G.idx;
        fb.className = "g-fb ok show"; fb.innerHTML = `<b>${fmt(n.senang.jp)}</b>${esc(n.senang.id)}`;
      }
      G.pmood = "note"; G.pmoodT = 1.4; hearts();
      setTimeout(() => nextStep(isBoss), 1250);
    } else {
      G.hearts--; shake(); G.pmood = "sweat"; G.pmoodT = 2;
      const scold = q.marah || { jp: "…", id: "" };
      if (isBoss) G.bossMood = 1.6; else { const n = G.npcs[G.npcIdx]; n.mood = "angry"; n.moodT = 3; }
      G.mistakes.push({ kata: q.kata, benar: correctTxt, scold });
      fb.className = "g-fb ng show";
      fb.innerHTML = `<b>${opt ? "" : "⏰ WAKTU HABIS! "}${fmt(scold.jp)}</b>${esc(scold.id)}<br>✔ Yang benar: <b style="display:inline">${fmt(correctTxt)}</b>`;
      hearts();
      const nx = document.createElement("button"); nx.className = "g-btn"; nx.textContent = G.hearts <= 0 ? "Lihat hasil" : "Lanjut ▶";
      nx.addEventListener("click", () => nextStep(isBoss)); P.appendChild(nx);
      setTimeout(() => nx.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
    }
  }

  function nextStep(isBoss) {
    if (!G || G.phase === "menu") return;
    G.locked = false;
    if (G.hearts <= 0) return finish(false);
    if (isBoss) { if (G.bossHP <= 0) return finish(true); return bossQuestion(); }
    G.npcIdx++; G.phase = "walk";
    ROOT.querySelector("#gPanel").innerHTML = `<div class="g-wait">Berjalan…</div>`;
  }

  function enterRoom() {
    G.phase = "fadeout"; G.fade = 0;
  }
  function bossStart() {
    const b = G.st.bos;
    G.room = buildRoom(G.st.ruang);
    G.phase = "boss"; G.fade = 1;
    G.boss = { spr: sprite(b) };
    G.bq = [];
    banner(`<b>${esc(b.nama)} muncul!</b>${fmt(b.intro.jp)}<br><small>${esc(b.intro.id)}</small>`, 2800);
    const P = ROOT.querySelector("#gPanel");
    P.innerHTML = `<div class="g-who"><span>${esc(b.nama)}</span><span class="tag">BOS</span></div>
      <div class="g-line">${fmt(b.intro.jp)}</div><div class="g-arti">${esc(b.intro.id)}</div>
      <button class="g-btn go" id="gFight">⚔ MULAI!</button>`;
    P.querySelector("#gFight").addEventListener("click", () => { ROOT.querySelector("#gBanner").classList.remove("show"); bossQuestion(); });
  }
  function bossQuestion() {
    if (!G.bq.length) G.bq = shuffle(G.st.bos.soal);
    const q = G.bq.shift();
    panelQuestion(G.st.bos.nama, true, q);
    G.qTime = G.st.bos.waktu || 12; G.qStart = performance.now(); G.timerOn = true; G.curQ = q;
  }

  function finish(win) {
    const atBoss = !!G.boss, gs = gsave(), st = G.st, b = st.bos;
    G.phase = win ? "win" : "lose"; G.timerOn = false;
    const stars = win ? Math.max(1, G.hearts) : 0, prev = gs.st[st.id] || 0;
    let coins = G.coins; if (win) coins += 30 + G.idx * 5 + stars * 10;
    if (win && prev > 0) coins = Math.round(coins / 2);
    if (win && stars > prev) gs.st[st.id] = stars;
    if (coins > 0) API.addCoins(coins);
    API.persist(); G.coins = coins; hearts();
    const loseJP = atBoss ? b.kalah.jp : "♥ が なくなりました…";
    const loseID = atBoss ? b.kalah.id : "♥ kamu habis sebelum sampai tujuan. Ulangi dan jawab dengan sopan, ya!";
    banner(win ? `<b>QUEST CLEAR!</b>${fmt(b.menang.jp)}` : `<b>GAME OVER</b>${fmt(loseJP)}`, 0);
    const review = G.mistakes.length ? `<div class="g-review"><h5>Yang perlu diulang:</h5>${G.mistakes.map(m =>
      `<div><b>${fmt(m.kata)}</b><br>✔ ${fmt(m.benar)}<br><small>${esc(m.scold.id)}</small></div>`).join("")}</div>` : "";
    const hasNext = win && G.idx < DATA.stages.length - 1;
    const P = ROOT.querySelector("#gPanel");
    P.innerHTML = `<div class="g-res">
      <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? "" : "off"}">★</span>`).join("")}</div>
      <h3>${win ? "Quest selesai!" : "Coba lagi, yuk!"}</h3>
      <p>${win ? esc(b.menang.id) : esc(loseID)}<br>Dapat <b>${coins} koin</b>${win && prev > 0 ? " (main ulang: koin ½)" : ""}.</p>
      ${hasNext ? `<button class="g-btn go" id="gNext">Stage berikutnya ▶</button>` : ""}
      <button class="g-btn ${hasNext ? "alt" : ""}" id="gRetry">Main lagi</button>
      <button class="g-btn alt" id="gMenu">Daftar stage</button>${review}</div>`;
    P.scrollTop = 0;
    if (P.querySelector("#gNext")) P.querySelector("#gNext").addEventListener("click", () => startStage(G.idx + 1));
    P.querySelector("#gRetry").addEventListener("click", () => startStage(G.idx));
    P.querySelector("#gMenu").addEventListener("click", menuView);
  }

  /* ================= loop ================= */
  function startLoop() { stopLoop(); if (G) G.last = 0; RAF = requestAnimationFrame(frame); }
  function stopLoop() { if (RAF) cancelAnimationFrame(RAF); RAF = 0; }
  function frame(ts) {
    if (!G || !G.cv || !G.cv.isConnected) { RAF = 0; return; }
    const dt = G.last ? Math.min(.05, (ts - G.last) / 1000) : 0; G.last = ts; G.t += dt;
    update(dt); draw(); RAF = requestAnimationFrame(frame);
  }
  function update(dt) {
    G.npcs.forEach(n => { if (n.moodT > 0 && (n.moodT -= dt) <= 0) n.mood = null; });
    if (G.pmoodT > 0 && (G.pmoodT -= dt) <= 0) G.pmood = null;
    if (G.hitT > 0) G.hitT -= dt; if (G.bossMood > 0) G.bossMood -= dt;
    if (G.phase === "walk") {
      const last = G.npcIdx >= G.npcs.length, target = last ? G.world.door - 8 : G.npcs[G.npcIdx].x - 18;
      if (G.px < target) { G.px = Math.min(target, G.px + SPEED * dt * (last ? 1.25 : 1)); G.walking = true; }
      else { G.walking = false;
        if (!last) { G.phase = "talk"; const n = G.npcs[G.npcIdx]; panelQuestion(n.nama, false, n); }
        else { G.phase = "arrive"; banner(`<b>Sampai di ${esc(G.st.tujuan)}!</b>`, 1300); setTimeout(() => { if (G && G.phase === "arrive") enterRoom(); }, 1000); } }
    } else G.walking = false;
    if (G.phase === "fadeout") { G.fade = Math.min(1, G.fade + dt * 2.5); if (G.fade >= 1) bossStart(); }
    else if (G.fade > 0 && G.phase !== "fadeout") G.fade = Math.max(0, G.fade - dt * 2.2);
    if (G.timerOn) {
      const left = 1 - (performance.now() - G.qStart) / (G.qTime * 1000), bar = ROOT.querySelector("#gTimer");
      if (bar) bar.style.transform = `scaleX(${Math.max(0, left)})`;
      if (left <= 0) { G.timerOn = false; answer(null, null, G.curQ, true); }
    }
  }
  const bob = (on, sp) => on && !REDUCED ? (Math.floor(G.t * sp) % 2 ? -1 : 0) : 0;
  function shadow(c, cx, y, r) { r = r || 6; c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(Math.round(cx - r), y - 1, r * 2, 2); c.fillRect(Math.round(cx - r + 2), y - 2, r * 2 - 4, 4); }
  function draw() {
    const c = G.ctx;
    if (G.room) { drawRoom(c); }
    else {
      const wd = G.world, cam = Math.max(0, Math.min(wd.w - W, Math.round(G.px - 50))), F = wd.feet;
      c.drawImage(wd.canvas, cam, 0, W, H, 0, 0, W, H);
      G.npcs.forEach((n, i) => {
        if (i < G.npcIdx && n.mood == null && n.x - cam < -20) return;
        const sx = n.x - cam; if (sx < -20 || sx > W + 20) return;
        const sh = n.mood === "angry" && !REDUCED ? Math.round(Math.sin(G.t * 40)) : 0;
        shadow(c, sx + 8, F); c.drawImage(sprite(n), Math.round(sx + sh), F - 16 + bob(n.mood === "heart", 6));
        if (n.mood) emote(c, n.mood, sx + 8, F - 19, G.t); else if (i === G.npcIdx && G.phase === "talk") emote(c, "!", sx + 8, F - 19, G.t);
      });
      const px = G.px - cam; shadow(c, px + 8, F); c.drawImage(G.player, Math.round(px), F - 16 + bob(G.walking, 8));
      if (G.pmood) emote(c, G.pmood, px + 13, F - 17, G.t);
    }
    if (G.fade > 0) { c.fillStyle = `rgba(10,6,16,${G.fade})`; c.fillRect(0, 0, W, H); }
  }
  function drawRoom(c) {
    const rm = G.room; c.drawImage(rm.canvas, 0, 0);
    const [bx, bf] = rm.boss, hit = G.hitT > 0 && !REDUCED ? Math.round(Math.sin(G.t * 50) * 2) : 0;
    c.drawImage(G.boss.spr, Math.round(bx + hit), bf - 32 + bob(G.phase === "win", 5), 32, 32);
    if (G.bossMood > 0) emote(c, "angry", bx + 16, bf - 35, G.t);
    if (G.phase === "win") emote(c, "heart", bx + 16, bf - 35, G.t);
    rm.front(c);
    const px = rm.playerX || 26, pf = 110;
    shadow(c, px + 8, pf); c.drawImage(G.player, px, pf - 16 + bob(G.phase === "win", 5));
    if (G.pmood) emote(c, G.pmood, px + 13, pf - 17, G.t);
    // HP bar bos
    const bw = 100, x0 = (W - bw) / 2, y0 = 2, fr = G.bossHP / G.bossMax;
    R(c, x0 - 1, y0 - 1, bw + 2, 7, "#000"); R(c, x0, y0, bw, 5, "#5a2330");
    R(c, x0, y0, Math.round(bw * fr), 5, fr > .5 ? "#4CC36A" : fr > .25 ? "#F5B301" : "#E5484D"); R(c, x0, y0, Math.round(bw * fr), 1, "rgba(255,255,255,.35)");
    txt(c, "BOS", x0 - 12, y0 + 2.5, "#fff", 6);
  }

  document.addEventListener("visibilitychange", () => { if (!G || !G.cv) return; if (document.hidden) stopLoop(); else if (G.cv.isConnected) startLoop(); });

  /* ================= API publik ================= */
  window.NSGame = {
    mount(root, api) {
      API = api; ROOT = root;
      if (!styleEl) { styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
      document.body.classList.add("g-lock");
      root.innerHTML = `<div class="g-full"><div class="g-wait" style="color:#D9D0E6;margin-top:40vh">Memuat game…</div></div>`;
      prepare().then(() => { if (ROOT === root && root.isConnected) menuView(); })
        .catch(() => { root.innerHTML = `<div class="g-full"><div class="g-wait" style="color:#fff;margin-top:35vh">Game gagal dimuat. Cek koneksi internet lalu coba lagi.<br><br><button class="g-btn alt" style="max-width:240px" id="gOut">Kembali</button></div></div>`;
          const o = root.querySelector("#gOut"); if (o) o.addEventListener("click", () => API.exit()); });
    },
    unmount() { stopLoop(); G = null; ROOT = null; document.body.classList.remove("g-lock"); },
    _debug: () => ({ G, DATA, buildRoom, buildIndoor, buildOutdoor, sprite }),
  };
})();
