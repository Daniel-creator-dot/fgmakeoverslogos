/**
 * FG Makeovers – Image-Based Animation Engine
 * Uses the actual logo.jpg rendered onto canvas with cinematic effects:
 * circular reveal, shimmer sweeps, particle sparkle, breathing glow.
 */
(function () {
  'use strict';

  // ── DOM ──────────────────────────────────────────────────────────────
  const canvas       = document.getElementById('anim-canvas');
  const ctx          = canvas.getContext('2d');
  const body         = document.body;
  const themBtn      = document.getElementById('theme-toggle-btn');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const replayBtn    = document.getElementById('replay-btn');
  const loopToggle   = document.getElementById('loop-toggle');
  const speedSlider  = document.getElementById('speed-slider');
  const speedVal     = document.getElementById('speed-val');
  const sceneBadge   = document.getElementById('scene-badge');
  const styleBtns    = document.querySelectorAll('.scene-btn');
  const bgSwatches   = document.querySelectorAll('.swatch');
  const dlGif        = document.getElementById('download-gif-btn');
  const dlVideo      = document.getElementById('download-video-btn');
  const dlSvg        = document.getElementById('download-svg-btn');
  const overlay      = document.getElementById('export-overlay');
  const expTitle     = document.getElementById('exp-title');
  const expDesc      = document.getElementById('exp-desc');
  const expBar       = document.getElementById('exp-bar');

  const W = 600, H = 600;

  // ── State ────────────────────────────────────────────────────────────
  let animStyle  = 'cinematic';
  let bgKey      = 'cream';
  let speed      = 1.0;
  let playing    = true;
  let looping    = true;
  let startTime  = null;
  let loopTimer  = null;
  let rafId      = null;
  let logoReady  = false;
  let nowTime    = 0;

  const DURATIONS = {
    cinematic: 10,
    elegant: 6,
    bloom: 6,
    'line-drawing': 6,
    'vector-draw': 6,
    glamour: 6,
    glitch: 5,
    aurora: 6,
    'spin-expand': 5,
    curtain: 6
  };

  const SCENE_LABELS = {
    cinematic:     '✦ Cinematic Brand Reel — 10 sec',
    elegant:       'Elegant Reveal — 6 sec',
    bloom:         'Lotus Bloom — 6 sec',
    'line-drawing':'Line Sketch — 6 sec',
    'vector-draw': 'Pure Vector Draw — 6 sec',
    glamour:       '✨ Glitz & Glamour — 6 sec',
    glitch:        '⚡ Editorial Glitch — 5 sec',
    aurora:        '🌅 Champagne Aurora — 6 sec',
    'spin-expand': '🌀 Whirlpool Reveal — 5 sec',
    curtain:       '🎭 Theater Curtain Reveal — 6 sec'
  };

  // Background colours
  const BG = {
    none:  null,           // transparent — no fill
    cream: '#fcf6f0',
    dark:  '#14100e',
    rose:  '#f5e6e0',
    black: '#000000',
  };

  // Brand colours
  const GOLD   = '#d3a886';
  const GOLD2  = '#b88d6b';
  const CREAM  = '#fcf6f0';

  // ── Logo image ───────────────────────────────────────────────────────
  const logoImg = new Image();
  let logoCanvasClipped   = null; // circle-clipped raw logo
  let logoCanvasKeyed     = null; // brightness-keyed: removes cream bg (light backgrounds)
  let logoCanvasDarkKeyed = null; // BFS-keyed: removes only outer bg, full colours kept (dark backgrounds)

  // Radius of the logo circle in the 600×600 canvas
  const LOGO_RADIUS = 272;

  function getLogoSource(key) {
    if (key === 'dark' || key === 'black') return logoCanvasClipped || logoImg;
    return logoCanvasKeyed || logoImg;
  }

  // Pre-render two versions of the logo:
  // 1. logoCanvasClipped (retains cream background inside a clean circle) for dark backgrounds
  // 2. logoCanvasKeyed (fully keyed out, completely transparent background) for light/none backgrounds
  function processLogo() {
    const W2 = 600, H2 = 600;
    
    // Create circle-clipped version
    logoCanvasClipped = document.createElement('canvas');
    logoCanvasClipped.width  = W2;
    logoCanvasClipped.height = H2;
    const lc = logoCanvasClipped.getContext('2d');
    lc.beginPath();
    lc.arc(W2 / 2, H2 / 2, LOGO_RADIUS, 0, Math.PI * 2);
    lc.clip();
    lc.drawImage(logoImg, 0, 0, W2, H2);

    // Sample background colour once from the top-left pixel of the raw image
    const rawCtx = document.createElement('canvas').getContext('2d');
    rawCtx.canvas.width = W2; rawCtx.canvas.height = H2;
    rawCtx.drawImage(logoImg, 0, 0, W2, H2);
    let r0 = 252, g0 = 246, b0 = 240; // fallback: cream
    try {
      const px = rawCtx.getImageData(0, 0, 1, 1).data;
      r0 = px[0]; g0 = px[1]; b0 = px[2];
    } catch (e) { /* CORS – use fallback */ }

    // ── keyed-out version for LIGHT backgrounds ──────────────────────────
    // Removes pixels by both color-distance AND brightness threshold so
    // the cream/white background is fully stripped.
    logoCanvasKeyed = document.createElement('canvas');
    logoCanvasKeyed.width  = W2;
    logoCanvasKeyed.height = H2;
    const lk = logoCanvasKeyed.getContext('2d');
    lk.drawImage(logoImg, 0, 0, W2, H2);

    try {
      const imgData = lk.getImageData(0, 0, W2, H2);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const dist = Math.sqrt((r - r0)**2 + (g - g0)**2 + (b - b0)**2);
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (dist < 22 || brightness > 230) {
          data[i+3] = 0;
        } else if (dist < 50 || brightness > 212) {
          const distFactor   = clamp((dist - 22) / 28);
          const brightFactor = clamp((230 - brightness) / 18);
          data[i+3] = Math.min(data[i+3], Math.floor(Math.min(distFactor, brightFactor) * 255));
        }
      }
      lk.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn("Light keying failed, using raw.", e);
      logoCanvasKeyed = logoCanvasClipped;
    }

    // ── dark-keyed version (BFS flood-fill, no brightness cutoff) ──────────
    // Only the spatially-connected outer background region is removed.
    // Every logo pixel — regardless of how bright or light it is — stays
    // fully opaque at its original colour, so the logo is visible on dark canvases.
    logoCanvasDarkKeyed = document.createElement('canvas');
    logoCanvasDarkKeyed.width  = W2;
    logoCanvasDarkKeyed.height = H2;
    const ld = logoCanvasDarkKeyed.getContext('2d');
    ld.drawImage(logoImg, 0, 0, W2, H2);
    try {
      const d2   = ld.getImageData(0, 0, W2, H2);
      const px2  = d2.data;
      const TSQD = 38 * 38; // squared colour-distance threshold
      const vis  = new Uint8Array(W2 * H2);
      const qx   = new Int16Array(W2 * H2);
      const qy   = new Int16Array(W2 * H2);
      let head = 0, tail = 0;
      const eq = (x, y) => { const i = y * W2 + x; if (!vis[i]) { vis[i]=1; qx[tail]=x; qy[tail]=y; tail++; } };
      for (let x = 0; x < W2; x++) { eq(x, 0); eq(x, H2-1); }
      for (let y = 1; y < H2-1; y++) { eq(0, y); eq(W2-1, y); }
      const DX = [-1,1,0,0], DY = [0,0,-1,1];
      while (head < tail) {
        const x = qx[head], y = qy[head++];
        const i = (y * W2 + x) * 4;
        const dr = px2[i]-r0, dg = px2[i+1]-g0, db = px2[i+2]-b0;
        const dsq = dr*dr + dg*dg + db*db;
        if (dsq > TSQD) continue;           // not background — stop expanding
        const dist = Math.sqrt(dsq);
        px2[i+3] = dist < 22 ? 0 : Math.min(px2[i+3], Math.floor(clamp((dist-22)/16)*255));
        for (let d = 0; d < 4; d++) {
          const nx = x+DX[d], ny = y+DY[d];
          if (nx>=0 && nx<W2 && ny>=0 && ny<H2) eq(nx, ny);
        }
      }
      ld.putImageData(d2, 0, 0);
    } catch(e) {
      console.warn('Dark keying failed, using clipped.', e);
      logoCanvasDarkKeyed = logoCanvasClipped;
    }
  }

  logoImg.crossOrigin = 'anonymous';
  logoImg.onload  = () => { logoReady = true; processLogo(); startAnim(); };
  logoImg.onerror = () => { console.warn('Logo failed to load'); logoReady = false; startAnim(); };
  logoImg.src = 'logo.jpg';

  // ── Easing ───────────────────────────────────────────────────────────
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const seg   = (t, a, b) => clamp((t - a) / (b - a));
  const ease3 = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  const easeO = t => 1 - Math.pow(1 - t, 3);
  const easeS = t => t===0?0:t===1?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2;
  const easeB = t => { const c=2.70158; return 1+c*Math.pow(t-1,3)+c*Math.pow(t-1,2); };

  // ── Particles ────────────────────────────────────────────────────────
  const particles = [];
  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * W,
        y: H * 0.3 + Math.random() * H * 0.8,
        r: 0.8 + Math.random() * 2.2,
        vy: -(0.25 + Math.random() * 0.55),
        vx: (Math.random() - 0.5) * 0.3,
        alpha: 0.08 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function stepParticles() {
    for (const p of particles) {
      p.y += p.vy;
      p.x += Math.sin(p.phase) * 0.4 + p.vx;
      p.phase += 0.018;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
    }
  }

  function drawParticles(c, globalA) {
    c.save();
    for (const p of particles) {
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fillStyle = GOLD;
      c.globalAlpha = p.alpha * globalA;
      c.fill();
    }
    c.restore();
  }

  // ── Glow ─────────────────────────────────────────────────────────────
  function drawGlow(c, alpha, cx = 300, cy = 310, r = 200) {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,   `rgba(211,168,134,${alpha * 0.35})`);
    g.addColorStop(0.5, `rgba(211,168,134,${alpha * 0.12})`);
    g.addColorStop(1,   'rgba(211,168,134,0)');
    c.save();
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  // ── Shimmer sweep ─────────────────────────────────────────────────────
  function drawShimmer(c, progress, strength = 0.55) {
    if (progress <= 0 || progress >= 1) return;
    const x = -100 + (W + 200) * progress;
    const g = c.createLinearGradient(x - 80, 0, x + 80, H);
    g.addColorStop(0,   'rgba(255,245,225,0)');
    g.addColorStop(0.45,`rgba(255,245,225,${strength})`);
    g.addColorStop(0.55,`rgba(255,255,255,${strength * 0.8})`);
    g.addColorStop(1,   'rgba(255,245,225,0)');
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(x - 80, 0, 160, H);
    c.restore();
  }

  // ── Logo drawing helpers ──────────────────────────────────────────────

  /**
   * Draw the logo centred on the canvas.
   * Uses the pre-clipped logoCanvas (circle-masked) for clean rendering
   * on any background colour.
   */
  function drawLogo(c, alpha = 1, scale = 1, offsetY = 0) {
    if (!logoReady) return;
    const src = getLogoSource(bgKey);
    c.save();
    c.globalAlpha = alpha;
    c.translate(W / 2, H / 2 + offsetY);
    c.scale(scale, scale);
    c.drawImage(src, -W / 2, -H / 2, W, H);
    c.restore();
  }

  /**
   * Circular iris reveal — radius grows from 0 to LOGO_RADIUS+.
   */
  function drawLogoCircleReveal(c, radius, alpha = 1, scale = 1) {
    if (!logoReady || radius <= 0) return;
    const src = getLogoSource(bgKey);
    c.save();
    c.globalAlpha = alpha;
    c.translate(W / 2, H / 2);
    c.scale(scale, scale);
    c.beginPath();
    c.arc(0, 0, radius / scale, 0, Math.PI * 2);
    c.clip();
    c.drawImage(src, -W / 2, -H / 2, W, H);
    c.restore();
  }

  /**
   * Vertical wipe — reveals from bottom upward.
   */
  function drawLogoVerticalWipe(c, wipe, alpha = 1) {
    if (!logoReady || wipe <= 0) return;
    const src = getLogoSource(bgKey);
    c.save();
    c.globalAlpha = alpha;
    const revealTop = H - H * wipe;
    c.beginPath();
    c.rect(0, revealTop, W, H);
    c.clip();
    c.drawImage(src, 0, 0, W, H);
    c.restore();
  }

  /**
   * Horizontal iris — reveals left+right from centre.
   */
  function drawLogoHorizontalReveal(c, wipe, alpha = 1) {
    if (!logoReady || wipe <= 0) return;
    const src = getLogoSource(bgKey);
    c.save();
    c.globalAlpha = alpha;
    const halfW = (W / 2) * wipe;
    c.beginPath();
    c.rect(W / 2 - halfW, 0, halfW * 2, H);
    c.clip();
    c.drawImage(src, 0, 0, W, H);
    c.restore();
  }

  // ── Background fill ───────────────────────────────────────────────────
  function fillBg(c, key) {
    if (!key || key === 'none') {
      // Transparent — just clear the canvas
      c.clearRect(0, 0, W, H);
      return;
    }
    c.fillStyle = BG[key];
    c.fillRect(0, 0, W, H);
  }

  function isDarkBg(key) {
    return key === 'dark' || key === 'black';
  }

  function getPalette(key) {
    const pal = {
      none:  { text: '#4d2d18', text2: '#76543b' },
      cream: { text: '#4d2d18', text2: '#76543b' },
      dark:  { text: '#f5ece0', text2: '#c8a882' },
      rose:  { text: '#5a2a1a', text2: '#8a4a2a' },
      black: { text: '#f5ece0', text2: '#c8a882' },
    };
    return pal[key] || pal.cream;
  }

  function drawLeftArc(c, amount = 1) {
    c.save();
    c.lineWidth = 1.8;
    c.strokeStyle = GOLD;
    c.lineCap = 'round';
    const startA = 148 * Math.PI / 180;
    const endA   = (148 + 60 * amount) * Math.PI / 180;
    c.beginPath();
    c.arc(300, 300, 210, startA, endA, false);
    c.stroke();
    c.restore();
  }

  function drawRightArc(c, amount = 1) {
    c.save();
    c.lineWidth = 1.8;
    c.strokeStyle = GOLD;
    c.lineCap = 'round';
    const startA = 332 * Math.PI / 180;
    const endA   = (332 + 56 * amount) * Math.PI / 180;
    c.beginPath();
    c.arc(300, 300, 210, startA, endA, false);
    c.stroke();
    c.restore();
  }

  function drawLeftStem(c) {
    c.beginPath();
    c.moveTo(300, 390);
    c.bezierCurveTo(290, 360, 250, 330, 250, 280);
    c.bezierCurveTo(250, 230, 275, 220, 274, 195);
    c.bezierCurveTo(275, 223, 258, 230, 258, 280);
    c.bezierCurveTo(258, 330, 292, 360, 300, 390);
  }

  function drawRightStem(c) {
    c.beginPath();
    c.moveTo(300, 390);
    c.bezierCurveTo(310, 360, 350, 330, 350, 280);
    c.bezierCurveTo(350, 230, 325, 220, 326, 195);
    c.bezierCurveTo(325, 223, 342, 230, 342, 280);
    c.bezierCurveTo(342, 330, 308, 360, 300, 390);
  }

  function drawLeftLeaf(c) {
    // Large sweeping petal — upper edge arcs to tip, lower edge returns along bottom
    c.beginPath();
    c.moveTo(300, 418);
    c.bezierCurveTo(255, 385, 175, 340, 118, 355);
    c.bezierCurveTo(155, 415, 240, 460, 300, 458);
    c.closePath();
  }

  function drawRightLeaf(c) {
    // Mirror of left
    c.beginPath();
    c.moveTo(300, 418);
    c.bezierCurveTo(345, 385, 425, 340, 482, 355);
    c.bezierCurveTo(445, 415, 360, 460, 300, 458);
    c.closePath();
  }

  function drawDroplet(c) {
    c.beginPath();
    c.moveTo(300, 245);
    c.bezierCurveTo(295, 245, 278, 265, 278, 285);
    c.bezierCurveTo(278, 300, 288, 312, 300, 312);
    c.bezierCurveTo(312, 312, 322, 300, 322, 285);
    c.bezierCurveTo(322, 265, 305, 245, 300, 245);
  }

  // ════════════════════════════════════════════════════════════════════
  //   CINEMATIC  (10 seconds)
  //   Act 1  0.00–0.12  Warm bg materialises + gold particles drift in
  //   Act 2  0.12–0.28  Central glow pulses upward like stage lights
  //   Act 3  0.28–0.55  Circular mask expands — logo iris-reveals
  //   Act 4  0.55–0.72  Second shimmer ring + scale breathe
  //   Act 5  0.72–0.82  Full shimmer sweep (light wipe)
  //   Act 6  0.82–0.93  Logo holds, subtle float + glow breathe
  //   Act 7  0.93–1.00  Final sparkle glint + fade to hold
  // ════════════════════════════════════════════════════════════════════
  function renderCinematic(c, t, bg) {
    // Background
    fillBg(c, bg);

    // Act 1 — particles appear
    const partA = easeO(seg(t, 0, 0.20));
    stepParticles();
    drawParticles(c, partA * 0.5);

    // Act 2 — glow rises
    const glowA = ease3(seg(t, 0.10, 0.38));
    drawGlow(c, glowA * 0.85);

    // Act 3 — circular iris reveal  (0.28 → 0.60)
    const revT  = easeS(seg(t, 0.28, 0.60));
    const maxR  = 440;
    const irisR = revT * maxR;
    // Slightly scale-in while revealing (0.88 → 1.0)
    const irisScale = 0.88 + 0.12 * easeO(seg(t, 0.28, 0.60));
    drawLogoCircleReveal(c, irisR, 1, irisScale);

    // Act 4 — ring shimmer at the edge of the growing circle
    if (revT > 0 && revT < 1) {
      const edgeR = irisR;
      c.save();
      c.beginPath();
      c.arc(W / 2, H / 2, edgeR + 6, 0, Math.PI * 2);
      c.strokeStyle = `rgba(211,168,134,${(1 - revT) * 0.7})`;
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }

    // Full logo shown from act 3 end onwards
    if (t > 0.58) {
      const stabiliseA = easeO(seg(t, 0.58, 0.65));
      // Already drawn via iris, just ensure full opacity
      if (revT >= 1) drawLogo(c, stabiliseA);
    }

    // Act 5 — shimmer sweep  (0.72 → 0.85)
    const shimT = seg(t, 0.72, 0.85);
    if (shimT > 0) drawShimmer(c, shimT, 0.60);

    // Act 6 — float + breathe glow  (0.82 → 0.96)
    if (t > 0.82) {
      const holdT   = seg(t, 0.82, 1.0);
      const breathe = 0.5 + 0.5 * Math.sin(holdT * Math.PI * 4);
      drawGlow(c, breathe * 0.25);
      // Subtle vertical float
      const floatY  = Math.sin(holdT * Math.PI * 2.5) * 4;
      drawLogo(c, 1, 1, floatY);
    }

    // Act 7 — final glint  (0.93 → 1.0)
    if (t > 0.93) {
      drawShimmer(c, seg(t, 0.93, 1.0), 0.35);
    }

    // Particles on top (faint sparkle overlay throughout)
    drawParticles(c, partA * 0.22);
  }

  // ════════════════════════════════════════════════════════════════════
  //   ELEGANT REVEAL  (6 seconds)
  //   Vertical wipe up + fade in, shimmer finish
  // ════════════════════════════════════════════════════════════════════
  function renderElegant(c, t, bg) {
    fillBg(c, bg);
    drawGlow(c, ease3(seg(t, 0, 0.6)) * 0.45);

    // Wipe from bottom → top  (0 → 0.75)
    const wipe  = easeS(seg(t, 0, 0.75));
    const alpha = easeO(seg(t, 0.05, 0.45));
    drawLogoVerticalWipe(c, wipe, alpha);

    // Shimmer at wipe edge
    if (wipe > 0 && wipe < 1) {
      const edgeY = H - H * wipe;
      const g = c.createLinearGradient(0, edgeY - 20, 0, edgeY + 20);
      g.addColorStop(0, 'rgba(255,245,220,0)');
      g.addColorStop(0.5, `rgba(255,245,220,0.5)`);
      g.addColorStop(1, 'rgba(255,245,220,0)');
      c.save();
      c.fillStyle = g;
      c.fillRect(0, edgeY - 20, W, 40);
      c.restore();
    }

    // Final full logo fade-in (0.70 → 0.85)
    if (t > 0.70) {
      drawLogo(c, easeO(seg(t, 0.70, 0.85)));
    }

    // Shimmer sweep finish  (0.84 → 0.97)
    if (t > 0.84) drawShimmer(c, seg(t, 0.84, 0.97), 0.50);

    // Breathe hold
    if (t > 0.90) {
      const holdT = seg(t, 0.90, 1.0);
      drawGlow(c, (0.5 + 0.5 * Math.sin(holdT * Math.PI * 3)) * 0.20);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //   LOTUS BLOOM  (6 seconds)
  //   Scale from 0 + rotation unfold
  // ════════════════════════════════════════════════════════════════════
  function renderBloom(c, t, bg) {
    fillBg(c, bg);
    drawGlow(c, ease3(t) * 0.40);

    // Scale bloom from 0.1 → 1.0 with slight rotation
    const s   = easeB(clamp(seg(t, 0, 0.70)));
    const rot = (1 - clamp(seg(t, 0, 0.60))) * 8 * Math.PI / 180; // slight tilt
    const alpha = easeO(seg(t, 0, 0.55));

    if (s > 0.01) {
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(rot);
      c.scale(s, s);
      c.globalAlpha = alpha;
      const src = getLogoSource(bgKey);
      c.drawImage(src, -W / 2, -H / 2, W, H);
      c.restore();
    }

    // Shimmer once bloom is done
    if (t > 0.75) drawShimmer(c, seg(t, 0.75, 0.90), 0.50);

    // Float hold
    if (t > 0.88) {
      const holdT = seg(t, 0.88, 1.0);
      const floatY = Math.sin(holdT * Math.PI * 2) * 5;
      drawGlow(c, (0.5 + 0.5 * Math.sin(holdT * Math.PI * 3)) * 0.22);
      drawLogo(c, 1, 1, floatY);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //   LINE SKETCH  (6 seconds)
  //   Horizontal iris from centre → full logo + shimmer fill
  // ════════════════════════════════════════════════════════════════════
  function renderLineDrawing(c, t, bg) {
    fillBg(c, bg);
    drawGlow(c, easeO(seg(t, 0, 0.5)) * 0.35);

    // Horizontal iris expand centre → edges  (0 → 0.70)
    const iris  = easeS(seg(t, 0, 0.70));
    const alpha = easeO(seg(t, 0, 0.50));
    drawLogoHorizontalReveal(c, iris, alpha);

    // Leading edge glow lines
    if (iris > 0 && iris < 1) {
      const halfW = (W / 2) * iris;
      const xL = W / 2 - halfW;
      const xR = W / 2 + halfW;
      c.save();
      c.strokeStyle = `rgba(211,168,134,${(1 - iris) * 0.6})`;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(xL, 0); c.lineTo(xL, H); c.stroke();
      c.beginPath(); c.moveTo(xR, 0); c.lineTo(xR, H); c.stroke();
      c.restore();
    }

    // Full logo fade-in after iris done
    if (t > 0.65) drawLogo(c, easeO(seg(t, 0.65, 0.78)));

    // Shimmer  (0.76 → 0.90)
    if (t > 0.76) drawShimmer(c, seg(t, 0.76, 0.90), 0.55);

    // Breathe
    if (t > 0.88) {
      const holdT = seg(t, 0.88, 1.0);
      drawGlow(c, (0.5 + 0.5 * Math.sin(holdT * Math.PI * 4)) * 0.22);
    }
  }

  // ── PURE VECTOR DRAW  (6 seconds)
  //   Traces the paths organically in gold/bronze before filling and adding text
  // ════════════════════════════════════════════════════════════════════
  function renderVectorDraw(c, t, bg) {
    fillBg(c, bg);
    
    const drawT = clamp(t / 0.72);
    const fillA = easeO(seg(t, 0.70, 1.0));

    // 1. Draw the elegant thin gold sketch lines
    c.save();
    c.lineWidth = 1.8;
    c.strokeStyle = GOLD;
    c.globalAlpha = 1 - fillA; // Fade out outlines as actual logo image fades in
    c.lineCap = 'round';

    // Arcs (aligned to radius 206)
    const arcT = clamp(drawT / 0.35);
    if (arcT > 0) {
      c.beginPath();
      const startL = 148 * Math.PI / 180;
      const endL   = (148 + 60 * arcT) * Math.PI / 180;
      c.arc(300, 300, 206, startL, endL, false);
      c.stroke();

      c.beginPath();
      const startR = 332 * Math.PI / 180;
      const endR   = (332 + 56 * arcT) * Math.PI / 180;
      c.arc(300, 300, 206, startR, endR, false);
      c.stroke();
    }

    // Stems
    const stemT = clamp(seg(drawT, 0.08, 0.55));
    if (stemT > 0) {
      const PL = 340;
      c.setLineDash([PL, PL]);
      c.lineDashOffset = PL * (1 - stemT);
      
      c.beginPath();
      c.moveTo(300, 390);
      c.bezierCurveTo(290, 360, 250, 330, 250, 280);
      c.bezierCurveTo(250, 230, 275, 220, 274, 195);
      c.stroke();

      c.beginPath();
      c.moveTo(300, 390);
      c.bezierCurveTo(310, 360, 350, 330, 350, 280);
      c.bezierCurveTo(350, 230, 325, 220, 326, 195);
      c.stroke();

      c.setLineDash([]);
    }

    // Leaves — use a longer path length to match the bigger leaf shape
    const leafT = clamp(seg(drawT, 0.30, 0.70));
    if (leafT > 0) {
      const PL = 420;
      c.setLineDash([PL, PL]);
      c.lineDashOffset = PL * (1 - leafT);

      drawLeftLeaf(c);  c.stroke();
      drawRightLeaf(c); c.stroke();

      c.setLineDash([]);
    }

    // Droplet
    const dropT = clamp(seg(drawT, 0.55, 0.80));
    if (dropT > 0) {
      const PL = 175;
      c.setLineDash([PL, PL]);
      c.lineDashOffset = PL * (1 - dropT);
      
      c.beginPath();
      c.moveTo(300, 245);
      c.bezierCurveTo(295, 245, 278, 265, 278, 285);
      c.bezierCurveTo(278, 300, 288, 312, 300, 312);
      c.bezierCurveTo(312, 312, 322, 300, 322, 285);
      c.bezierCurveTo(322, 265, 305, 245, 300, 245);
      c.stroke();

      c.setLineDash([]);
    }

    // Head (aligned to cy = 195, r = 18)
    const headT = clamp(seg(drawT, 0.68, 0.90));
    if (headT > 0) {
      const PL = 120;
      c.setLineDash([PL, PL]);
      c.lineDashOffset = PL * (1 - headT);
      c.beginPath();
      c.arc(300, 195, 18, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    c.restore();

    // 2. Fade in the actual colored logo image
    if (fillA > 0) {
      drawLogo(c, fillA);
    }

    // 3. Shimmer sweep
    if (t > 0.88) {
      drawShimmer(c, seg(t, 0.88, 1.0), 0.4);
    }
  }

  // ── GLAMOUR SPARKLES ──────────────────────────────────────────────────
  const glamourSparkles = [];
  function initGlamourSparkles() {
    glamourSparkles.length = 0;
    for (let i = 0; i < 80; i++) {
      glamourSparkles.push({
        x: Math.random() * W,
        y: Math.random() * H - H,
        r: 1 + Math.random() * 2.8,
        vy: 1.2 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        alpha: 0.35 + Math.random() * 0.65,
      });
    }
  }

  function stepGlamourSparkles() {
    for (const p of glamourSparkles) {
      p.y += p.vy * speed;
      p.x += Math.sin(p.rot * 0.2) * 0.25 + p.vx * speed;
      p.rot += p.rotSpeed * speed;
      if (p.y > H) {
        p.y = -20;
        p.x = Math.random() * W;
      }
    }
  }

  function drawGlamourSparkles(c, alpha = 1) {
    c.save();
    c.fillStyle = GOLD;
    for (const p of glamourSparkles) {
      c.save();
      c.globalAlpha = p.alpha * alpha;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      c.moveTo(0, -p.r * 2);
      c.quadraticCurveTo(0, 0, p.r * 2, 0);
      c.quadraticCurveTo(0, 0, 0, p.r * 2);
      c.quadraticCurveTo(0, 0, -p.r * 2, 0);
      c.quadraticCurveTo(0, 0, 0, -p.r * 2);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  }

  // ── NEW RENDER FUNCTIONS ─────────────────────────────────────────────

  // Glitz & Glamour Style
  function renderGlamour(c, t, bg) {
    fillBg(c, bg);
    stepGlamourSparkles();
    drawGlamourSparkles(c, clamp(t / 0.85));

    const logoA = easeO(seg(t, 0.15, 0.65));
    const logoS = 0.85 + 0.15 * easeO(seg(t, 0.15, 0.75));
    
    if (logoA > 0) {
      c.save();
      c.globalAlpha = logoA * 0.45;
      const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 220);
      g.addColorStop(0, GOLD);
      g.addColorStop(1, 'rgba(211,168,134,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.restore();

      drawLogo(c, logoA, logoS);
    }

    if (t > 0.65) {
      drawShimmer(c, seg(t, 0.65, 0.85), 0.45);
    }
  }

  // Cyber Chic Glitch Style
  function renderGlitch(c, t, bg) {
    fillBg(c, bg);

    const revealT = seg(t, 0.0, 0.55);
    const logoA = easeO(revealT);
    const logoS = 0.95 + 0.05 * easeO(revealT);

    if (logoA <= 0) return;

    const isGlitching = (t > 0.05 && t < 0.45 && Math.random() < 0.35);

    if (isGlitching) {
      c.save();
      c.globalAlpha = logoA;
      const src = getLogoSource(bgKey);
      const numSlices = 7;
      const sliceH = H / numSlices;
      
      for (let i = 0; i < numSlices; i++) {
        const sy = i * sliceH;
        const sh = sliceH;
        const dx = (Math.random() - 0.5) * 24;
        c.drawImage(src, 0, sy, W, sh, dx, sy, W, sh);
      }
      
      if (Math.random() < 0.4) {
        c.globalCompositeOperation = 'color-dodge';
        c.fillStyle = Math.random() < 0.5 ? 'rgba(211,168,134,0.15)' : 'rgba(255,255,255,0.1)';
        c.fillRect(0, 0, W, H);
      }
      c.restore();
    } else {
      drawLogo(c, logoA, logoS);
    }

    if (t > 0.70) {
      drawShimmer(c, seg(t, 0.70, 0.95), 0.35);
    }
  }

  // Champagne Aurora Style
  function renderAurora(c, t, bg) {
    fillBg(c, bg);

    c.save();
    const waveT = nowTime ? nowTime / 1500 : t * 4;
    const isDark = isDarkBg(bgKey);
    c.globalAlpha = isDark ? 0.15 : 0.08;

    const colors = [GOLD, '#f5e6e0', GOLD2];
    for (let i = 0; i < 3; i++) {
      c.fillStyle = colors[i];
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) {
        const y = 300 + Math.sin(x * 0.01 + waveT + i * 2) * 45 + Math.cos(x * 0.005 + waveT * 0.5) * 30;
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fill();
    }
    c.restore();

    const sweep = seg(t, 0.10, 0.70);
    const scale = 0.93 + 0.07 * easeO(sweep);
    
    if (sweep > 0) {
      const src = getLogoSource(bgKey);
      c.save();
      c.beginPath();
      const sweepX = -250 + (W + 500) * easeO(sweep);
      c.moveTo(sweepX, 0);
      c.lineTo(sweepX + 250, 0);
      c.lineTo(sweepX + 50, H);
      c.lineTo(sweepX - 200, H);
      c.closePath();
      c.clip();
      
      c.translate(W / 2, H / 2);
      c.scale(scale, scale);
      c.drawImage(src, -W / 2, -H / 2, W, H);
      c.restore();

      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 4;
      c.beginPath();
      const sweepXLine = -250 + (W + 500) * easeO(sweep);
      c.moveTo(sweepXLine + 125, 0);
      c.lineTo(sweepXLine - 75, H);
      c.stroke();
      c.restore();
    }
  }

  // Whirlpool Reveal Style
  function renderSpinExpand(c, t, bg) {
    fillBg(c, bg);

    const revealT = clamp(t / 0.75);
    const s = easeB(revealT);
    const rot = (1 - easeO(revealT)) * 2.5 * Math.PI;
    const alpha = easeO(seg(t, 0, 0.60));

    if (t < 0.65) {
      c.save();
      c.strokeStyle = GOLD;
      c.lineWidth = 1.2;
      c.globalAlpha = (1 - revealT) * 0.6;
      for (let i = 1; i <= 3; i++) {
        c.beginPath();
        c.arc(W / 2, H / 2, 100 * i * revealT, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }

    if (alpha > 0) {
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(rot);
      c.scale(s, s);
      c.globalAlpha = alpha;
      const src = getLogoSource(bg);
      c.drawImage(src, -W / 2, -H / 2, W, H);
      c.restore();
    }

    if (t > 0.75) {
      drawShimmer(c, seg(t, 0.75, 0.95), 0.50);
    }
  }

  // Theater Curtain Reveal Style
  function renderCurtain(c, t, bg) {
    fillBg(c, bg);

    const lineT = clamp(t / 0.28);
    const openT = easeO(seg(t, 0.22, 0.75));

    if (lineT > 0 && openT < 0.99) {
      c.save();
      c.strokeStyle = GOLD;
      c.lineWidth = 2.2;
      c.globalAlpha = 1 - openT;
      c.beginPath();
      c.moveTo(W / 2, H / 2 - 250 * lineT);
      c.lineTo(W / 2, H / 2 + 250 * lineT);
      c.stroke();
      c.restore();
    }

    if (openT > 0) {
      const src = getLogoSource(bg);
      const halfW = (W / 2) * openT;

      c.save();
      c.beginPath();
      c.rect(W / 2 - halfW, 0, halfW, H);
      c.clip();
      c.drawImage(src, 0, 0, W, H);
      c.restore();

      c.save();
      c.beginPath();
      c.rect(W / 2, 0, halfW, H);
      c.clip();
      c.drawImage(src, 0, 0, W, H);
      c.restore();
    }

    if (t > 0.72) {
      drawShimmer(c, seg(t, 0.72, 0.92), 0.45);
    }
  }

  // ── Master render ─────────────────────────────────────────────────────
  function render(t) {
    ctx.clearRect(0, 0, W, H);
    if      (animStyle === 'cinematic')    renderCinematic(ctx, t, bgKey);
    else if (animStyle === 'elegant')      renderElegant(ctx, t, bgKey);
    else if (animStyle === 'bloom')        renderBloom(ctx, t, bgKey);
    else if (animStyle === 'line-drawing') renderLineDrawing(ctx, t, bgKey);
    else if (animStyle === 'vector-draw')  renderVectorDraw(ctx, t, bgKey);
    else if (animStyle === 'glamour')      renderGlamour(ctx, t, bgKey);
    else if (animStyle === 'glitch')       renderGlitch(ctx, t, bgKey);
    else if (animStyle === 'aurora')       renderAurora(ctx, t, bgKey);
    else if (animStyle === 'spin-expand')  renderSpinExpand(ctx, t, bgKey);
    else                                   renderCurtain(ctx, t, bgKey);
  }

  // ── Animation loop ────────────────────────────────────────────────────
  function tick(now) {
    nowTime = now;
    if (!startTime) startTime = now;
    const dur = DURATIONS[animStyle] * 1000 / speed;
    const t   = clamp((now - startTime) / dur);
    render(t);
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      render(1);
      if (looping && playing) {
        const hold = animStyle === 'cinematic' ? 1800 : 2200;
        loopTimer = setTimeout(startAnim, hold);
      }
    }
  }

  function startAnim() {
    cancelAnimationFrame(rafId);
    clearTimeout(loopTimer);
    startTime = null;
    playing   = true;
    playPauseBtn.textContent = '⏸ Pause';
    if (animStyle === 'cinematic') initParticles();
    if (animStyle === 'glamour') initGlamourSparkles();
    rafId = requestAnimationFrame(tick);
  }

  // ── Controls ──────────────────────────────────────────────────────────
  themBtn.addEventListener('click', () => {
    body.classList.toggle('light-mode');
    body.classList.toggle('dark-mode');
  });
  body.classList.add('light-mode');

  playPauseBtn.addEventListener('click', () => {
    if (playing) {
      cancelAnimationFrame(rafId);
      clearTimeout(loopTimer);
      playing = false;
      playPauseBtn.textContent = '▶ Play';
    } else {
      playing = true;
      playPauseBtn.textContent = '⏸ Pause';
      rafId = requestAnimationFrame(tick);
    }
  });

  replayBtn.addEventListener('click', startAnim);

  loopToggle.addEventListener('change', () => { looping = loopToggle.checked; });

  speedSlider.addEventListener('input', () => {
    speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(1) + '×';
  });

  styleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      styleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      animStyle = btn.dataset.style;
      sceneBadge.textContent = SCENE_LABELS[animStyle];
      startAnim();
    });
  });

  bgSwatches.forEach(sw => {
    sw.addEventListener('click', () => {
      bgSwatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      bgKey = sw.dataset.bg;
      // Show checkerboard on the canvas element itself to indicate transparency
      canvas.classList.toggle('bg-transparent', bgKey === 'none');
    });
  });

  // ── Off-screen renderer for exports ───────────────────────────────────
  function makeOC() {
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    return oc;
  }

  function renderFrame(c, t) {
    c.clearRect(0, 0, W, H);
    if      (animStyle === 'cinematic')    renderCinematic(c, t, bgKey);
    else if (animStyle === 'elegant')      renderElegant(c, t, bgKey);
    else if (animStyle === 'bloom')        renderBloom(c, t, bgKey);
    else if (animStyle === 'line-drawing') renderLineDrawing(c, t, bgKey);
    else if (animStyle === 'vector-draw')  renderVectorDraw(c, t, bgKey);
    else if (animStyle === 'glamour')      renderGlamour(c, t, bgKey);
    else if (animStyle === 'glitch')       renderGlitch(c, t, bgKey);
    else if (animStyle === 'aurora')       renderAurora(c, t, bgKey);
    else if (animStyle === 'spin-expand')  renderSpinExpand(c, t, bgKey);
    else                                   renderCurtain(c, t, bgKey);
  }

  // ── Export overlay helpers ─────────────────────────────────────────────
  function showOv(title, desc) {
    expTitle.textContent = title;
    expDesc.textContent  = desc;
    expBar.style.width   = '0%';
    overlay.classList.add('open');
  }
  function hideOv() { setTimeout(() => overlay.classList.remove('open'), 900); }
  function setProg(p, d) { expBar.style.width = p + '%'; expDesc.textContent = d; }

  // ── GIF export ────────────────────────────────────────────────────────
  dlGif.addEventListener('click', async () => {
    cancelAnimationFrame(rafId); clearTimeout(loopTimer);
    showOv('Generating GIF', 'Rendering frames…');

    const fps     = 20;
    const animDur = DURATIONS[animStyle];
    const holdDur = 2; // 2 second hold at end
    const totalDur = animDur + holdDur;
    const total   = Math.round(fps * totalDur);
    const oc = makeOC(); const octx = oc.getContext('2d');
    const frames = [];
    if (animStyle === 'cinematic') initParticles();
    if (animStyle === 'glamour') initGlamourSparkles();

    for (let i = 0; i < total; i++) {
      const t = clamp(i / (fps * animDur));
      renderFrame(octx, t);
      const fc = makeOC(); fc.getContext('2d').drawImage(oc, 0, 0);
      frames.push(fc);
      const pct = Math.round((i / total) * 46);
      setProg(pct, `Frame ${i + 1}/${total} (${pct}%)`);
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    setProg(50, 'Encoding GIF…');
    let fp = 50;
    const iv = setInterval(() => { if (fp < 93) { fp += 3; setProg(fp, `Encoding… (${fp}%)`); } }, 300);

    if (typeof gifshot === 'undefined') {
      clearInterval(iv); alert('GIF library unavailable — check internet connection.');
      hideOv(); startAnim(); return;
    }

    gifshot.createGIF({
      images: frames, gifWidth: W, gifHeight: H,
      interval: 1 / fps, numFrames: total, sampleInterval: 8, numWorkers: 2,
    }, obj => {
      clearInterval(iv);
      if (!obj.error) {
        setProg(100, 'Downloading…');
        const a = document.createElement('a');
        a.href = obj.image;
        a.download = `fg_makeovers_${animStyle}.gif`;
        a.click();
      } else { alert('GIF error: ' + obj.errorMsg); }
      hideOv(); startAnim();
    });
  });

  // ── Video export ──────────────────────────────────────────────────────
  dlVideo.addEventListener('click', async () => {
    cancelAnimationFrame(rafId); clearTimeout(loopTimer);
    showOv('Recording Video', 'Initialising recorder…');

    const oc = makeOC(); const octx = oc.getContext('2d');
    const fps = 30;
    const animDur  = DURATIONS[animStyle];
    const holdDur  = 2.5;
    const totalDur = animDur + holdDur;
    const total    = Math.round(fps * totalDur);

    const stream = oc.captureStream(fps);
    let mime = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = e => e.data?.size && chunks.push(e.data);
    recorder.onstop = () => {
      setProg(100, 'Downloading…');
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fg_makeovers_${animStyle}.mp4`;
      a.click(); URL.revokeObjectURL(a.href);
      hideOv(); startAnim();
    };

    recorder.start();
    if (animStyle === 'cinematic') initParticles();
    if (animStyle === 'glamour') initGlamourSparkles();

    for (let i = 0; i < total; i++) {
      const t = clamp(i / (fps * animDur));
      renderFrame(octx, t);
      await new Promise(r => requestAnimationFrame(r));
      const pct = Math.round((i / total) * 100);
      setProg(pct, `Frame ${i + 1}/${total} (${pct}%)`);
    }
    recorder.stop();
  });

  // ── SVG static export ─────────────────────────────────────────────────
  dlSvg.addEventListener('click', () => {
    let svgContent = '';
    const pal = getPalette(bgKey);
    const bgFill = BG[bgKey] || 'none';

    if (animStyle === 'vector-draw') {
      // Export pure vector elements
      svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="${bgFill}"/>
  <!-- Arcs -->
  <path d="M 123.3 190.8 A 206 206 0 0 0 123.3 409.2" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M 476.7 190.8 A 206 206 0 0 1 476.7 409.2" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Circular Text -->
  <!-- Top: FG MAKEOVERS -->
  <path id="topTextPath" d="M 144 186 A 210 210 0 0 1 456 186" fill="none" stroke="none"/>
  <text font-family="'Cormorant Garamond', serif" font-size="22" fill="${pal.text}" letter-spacing="4" text-anchor="middle">
    <textPath href="#topTextPath" startOffset="50%">FG MAKEOVERS</textPath>
  </text>
  <!-- Bottom: FLAWLESS. GORGEOUS. YOU. -->
  <path id="bottomTextPath" d="M 444 415 A 210 210 0 0 1 156 415" fill="none" stroke="none"/>
  <text font-family="'Cormorant Garamond', serif" font-size="14" fill="${pal.text2}" letter-spacing="3" text-anchor="middle">
    <textPath href="#bottomTextPath" startOffset="50%">FLAWLESS. GORGEOUS. YOU.</textPath>
  </text>
  <!-- Stems -->
  <path d="M 300,390 C 290,360 250,330 250,280 C 250,230 275,220 274,195 Z" fill="${GOLD}"/>
  <path d="M 300,390 C 310,360 350,330 350,280 C 350,230 325,220 326,195 Z" fill="${GOLD}"/>
  <!-- Leaves -->
  <path d="M 300,418 C 255,385 175,340 118,355 C 155,415 240,460 300,458 Z" fill="#d0bfb0"/>
  <path d="M 300,418 C 345,385 425,340 482,355 C 445,415 360,460 300,458 Z" fill="#965f35"/>
  <!-- Droplet -->
  <path d="M 300,245 C 295,245 278,265 278,285 C 278,300 288,312 300,312 C 312,312 322,300 322,285 C 322,265 305,245 300,245 Z" fill="${GOLD}"/>
  <!-- Head -->
  <circle cx="300" cy="195" r="18" fill="${pal.text}"/>
</svg>`;
    } else {
      if (!logoReady) { alert('Logo image is still loading.'); return; }
      // Embed logo as base64 in the SVG
      const tmpC = makeOC();
      const src = getLogoSource(bgKey);
      tmpC.getContext('2d').drawImage(src, 0, 0, W, H);
      const dataURL = tmpC.toDataURL('image/png');

      svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="${bgFill}"/>
  <image href="${dataURL}" x="0" y="0" width="600" height="600"/>
</svg>`;
    }

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fg_makeovers_${animStyle}.svg`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  // ── Boot — wait for image ─────────────────────────────────────────────
  sceneBadge.textContent = SCENE_LABELS[animStyle];
  initParticles();
  initGlamourSparkles();
  // Draw placeholder while logo loads
  fillBg(ctx, bgKey);
  drawGlow(ctx, 0.3);

})();
