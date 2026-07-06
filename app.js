document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const appContainer = document.getElementById('app-container');
  const body = document.body;
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const fgLogo = document.getElementById('fg-logo-svg');
  const styleBtns = document.querySelectorAll('.style-btn');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const replayBtn = document.getElementById('replay-btn');
  const speedSlider = document.getElementById('speed-slider');
  const speedDisplay = document.getElementById('speed-display');
  const downloadBtn = document.getElementById('download-animated-btn');
  const downloadGifBtn = document.getElementById('download-gif-btn');
  const downloadVideoBtn = document.getElementById('download-video-btn');
  const exportOverlay = document.getElementById('export-overlay');
  const exportProgressBar = document.getElementById('export-progress-bar');
  const exportStatusTitle = document.getElementById('export-status-title');
  const exportStatusDesc = document.getElementById('export-status-desc');
  const viewCodeBtn = document.getElementById('view-code-btn');
  const codeDrawer = document.getElementById('code-drawer');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const drawerOverlay = document.getElementById('drawer-overlay-div');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const svgTextarea = document.getElementById('svg-textarea');
  const cssTextarea = document.getElementById('css-textarea');
  const copyBtns = document.querySelectorAll('.copy-btn');
  const loopToggle = document.getElementById('loop-toggle');

  let currentStyle = 'elegant';
  let isPlaying = true;
  let loopTimeout = null;

  // 1. Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    if (body.classList.contains('light-mode')) {
      body.classList.replace('light-mode', 'dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.replace('dark-mode', 'light-mode');
      localStorage.setItem('theme', 'light');
    }
  });

  // Restore Theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  body.className = `${savedTheme}-mode`;

  // 2. Replay & Animation Triggers
  function replayAnimation() {
    clearTimeout(loopTimeout);
    
    // Remove all animation classes to reset state
    fgLogo.classList.remove('animation-elegant', 'animation-bloom', 'animation-line-drawing');
    
    // Force a reflow/repaint to ensure browser registers the class removal
    void fgLogo.offsetWidth;
    
    // Re-apply current animation style class
    fgLogo.classList.add(`animation-${currentStyle}`);
    
    // Reset play/pause state to playing
    isPlaying = true;
    fgLogo.classList.remove('paused');
    updatePlayPauseButtonUI();
  }

  // 3. Play / Pause Control
  function updatePlayPauseButtonUI() {
    const icon = playPauseBtn.querySelector('.play-icon');
    const text = playPauseBtn.querySelector('.btn-text');
    if (isPlaying) {
      icon.textContent = '⏸';
      text.textContent = 'Pause';
    } else {
      icon.textContent = '▶';
      text.textContent = 'Play';
    }
  }

  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    clearTimeout(loopTimeout);
    if (isPlaying) {
      fgLogo.classList.remove('paused');
    } else {
      fgLogo.classList.add('paused');
    }
    updatePlayPauseButtonUI();
  });

  replayBtn.addEventListener('click', () => {
    replayAnimation();
  });

  // 3b. Auto-Loop Timer
  const logoHead = fgLogo.querySelector('.logo-head');
  logoHead.addEventListener('animationend', () => {
    if (loopToggle.checked && isPlaying) {
      clearTimeout(loopTimeout);
      loopTimeout = setTimeout(() => {
        replayAnimation();
      }, 4000); // 4 seconds hold at completed state
    }
  });

  loopToggle.addEventListener('change', () => {
    clearTimeout(loopTimeout);
    if (loopToggle.checked && isPlaying) {
      replayAnimation();
    }
  });

  // 4. Style Selectors
  styleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      styleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentStyle = btn.dataset.style;
      replayAnimation();
    });
  });

  // 5. Speed Slider Control
  speedSlider.addEventListener('input', () => {
    const speed = parseFloat(speedSlider.value);
    speedDisplay.textContent = `${speed.toFixed(2)}x`;
    
    // Calculate speed scale (reciprocal of speed, since a higher speed multiplier means shorter animation duration)
    const speedScale = 1 / speed;
    fgLogo.style.setProperty('--speed-scale', speedScale);
    
    // Smoothly re-evaluate playback
    if (!isPlaying) {
      // If paused, keep paused
    }
  });

  // 6. SVG Path Measurement (For Line Sketch Stroke)
  // Ensure that paths in line drawing mode trace their actual lengths
  function measurePathLengths() {
    const paths = fgLogo.querySelectorAll('path, circle');
    paths.forEach(p => {
      // Skip text paths
      if (p.id && p.id.includes('text-path')) return;
      
      const length = p.getTotalLength ? p.getTotalLength() : 300;
      // We can inject style attributes or let CSS approximate. 
      // Letting CSS approximate works fine, but setting custom property allows precise sketch lines:
      p.style.setProperty('--path-length', length);
    });
  }
  
  measurePathLengths();

  // 7. Drawer & Export Code
  function openDrawer() {
    codeDrawer.classList.add('open');
    populateExportCode();
  }

  function closeDrawer() {
    codeDrawer.classList.remove('open');
  }

  viewCodeBtn.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // Tab switching inside drawer
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Fetch styles and SVG content to display in drawer
  async function populateExportCode() {
    // Clean SVG markup for presentation (cloning and formatting)
    const svgClone = fgLogo.cloneNode(true);
    // Remove custom speed inline styles
    svgClone.removeAttribute('style');
    // Ensure it keeps the active animation class
    svgClone.className.baseVal = `fg-logo animation-${currentStyle}`;
    
    const svgString = new XMLSerializer().serializeToString(svgClone);
    svgTextarea.value = formatXML(svgString);

    // Fetch css stylesheet content
    try {
      const response = await fetch('style.css');
      if (response.ok) {
        const cssText = await response.text();
        cssTextarea.value = cssText;
      } else {
        cssTextarea.value = `/* Error fetching style.css. Ensure you are running a local server. */`;
      }
    } catch (e) {
      cssTextarea.value = `/* Unable to fetch styles. Check console or copy manually. */`;
    }
  }

  // Simple XML Formatter
  function formatXML(xml) {
    let reg = /(>)\s*(<)(\/*)/g;
    let wxml = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    let formatted = '';
    let lines = wxml.split('\r\n');
    lines.forEach(line => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (line.match(/^<\w([^>]*[^\/])?>$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      let padding = '';
      for (let i = 0; i < pad; i++) {
        padding += '  ';
      }
      formatted += padding + line + '\r\n';
      pad += indent;
    });
    return formatted.trim();
  }

  // Copy Buttons
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetArea = document.getElementById(btn.dataset.clipboard);
      targetArea.select();
      document.execCommand('copy');

      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = 'Copy Code';
      }, 2000);
    });
  });

  // 8. Download Self-Contained Animated SVG
  downloadBtn.addEventListener('click', async () => {
    // Create a clone of the SVG
    const svgClone = fgLogo.cloneNode(true);
    
    // Inject stylesheet directly inside a <style> block in the SVG
    try {
      const response = await fetch('style.css');
      if (response.ok) {
        const cssText = await response.text();
        
        // Add font loading inside SVG style (since standalone SVGs need explicit imports)
        const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap');\n`;
        
        // Filter out app/dashboard specific page layout styles, keeping logo specific styles
        const logoStyles = `
          ${fontImport}
          svg {
            background: #fcf2e8; /* Default luxury cream background */
          }
          .fg-logo {
            width: 100%;
            height: 100%;
          }
          .logo-text {
            font-family: 'Cormorant Garamond', serif;
            font-weight: 400;
            fill: #4d2d18;
          }
          .top-text { font-size: 23px; letter-spacing: 0.18em; }
          .bottom-text { font-size: 14.5px; letter-spacing: 0.16em; font-weight: 500; }
          .logo-arc { stroke: #d3a886; }
          .logo-head { fill: #4d2d18; }
          .logo-droplet { fill: #d3a886; }
          .logo-stem-left, .logo-stem-right { fill: #d3a886; }
          .logo-leaf-left { fill: #d0bfb0; }
          .logo-leaf-right { fill: #965f35; }
          
          /* Embed active keyframe animation styles directly */
          ${cssText.substring(cssText.indexOf('/* ==========================================================================\n   ANIMATION KEYFRAMES'))}
        `;

        const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.textContent = logoStyles;
        
        // Insert style tag as the first child of the SVG
        svgClone.insertBefore(styleElement, svgClone.firstChild);
      }
    } catch (e) {
      console.warn("Could not load styles for embedding. Standalone SVG will have layout only.", e);
    }
    
    // Serialize and create Blob
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `fg_makeovers_logo_${currentStyle}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  });

  // 9. Canvas Rendering & GIF/Video Exporter
  
  // Draw text along an arc in Canvas
  function drawTextAlongArc(ctx, text, centerX, centerY, radius, startAngle, endAngle, isBottom, color) {
    ctx.save();
    ctx.font = isBottom ? "500 14px 'Cormorant Garamond', serif" : "400 22px 'Cormorant Garamond', serif";
    ctx.fillStyle = color;
    
    const charCount = text.length;
    const angleSpan = endAngle - startAngle;
    const angleStep = angleSpan / (charCount - 1 || 1);
    
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    for (let i = 0; i < charCount; i++) {
      const char = text[i];
      const charAngle = startAngle + i * angleStep;
      
      ctx.save();
      const x = centerX + radius * Math.cos(charAngle);
      const y = centerY + radius * Math.sin(charAngle);
      ctx.translate(x, y);
      
      if (isBottom) {
        ctx.rotate(charAngle - Math.PI / 2);
      } else {
        ctx.rotate(charAngle + Math.PI / 2);
      }
      
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // Draw a frame of the logo onto a 2D canvas context based on progress (0.0 to 1.0)
  function drawLogoFrame(ctx, progress, style, theme) {
    // Clear canvas
    ctx.clearRect(0, 0, 600, 600);
    
    // Fill background
    const bg = theme === 'dark' ? '#14100e' : '#fcf6f0';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 600, 600);
    
    // Colors
    const primaryText = theme === 'dark' ? '#f6ebd8' : '#4d2d18';
    const secondaryText = theme === 'dark' ? '#d0bfb0' : '#76543b';
    const gold = '#d3a886';
    const leafLeft = '#d0bfb0';
    const leafRight = '#965f35';
    const head = theme === 'dark' ? '#f6ebd8' : '#4d2d18';
    
    // Easing approximations
    const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const easeOutBack = x => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };
    
    if (style === 'elegant') {
      // 1. Arcs (progress 0 -> 0.4)
      const arcProgress = Math.min(1, Math.max(0, progress / 0.4));
      const arcEase = easeInOut(arcProgress);
      
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = gold;
      ctx.lineCap = 'round';
      
      if (arcProgress > 0) {
        ctx.beginPath();
        ctx.arc(300, 300, 210, 152 * Math.PI / 180, (152 + (208 - 152) * arcEase) * Math.PI / 180, false);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(300, 300, 210, 332 * Math.PI / 180, (332 + (388 - 332) * arcEase) * Math.PI / 180, false);
        ctx.stroke();
      }
      
      // 2. Texts (progress 0.2 -> 0.6)
      const textProgress = Math.min(1, Math.max(0, (progress - 0.2) / 0.4));
      if (textProgress > 0) {
        ctx.save();
        ctx.globalAlpha = textProgress;
        drawTextAlongArc(ctx, "FG MAKEOVERS", 300, 300, 210, 222 * Math.PI / 180, 318 * Math.PI / 180, false, primaryText);
        drawTextAlongArc(ctx, "FLAWLESS. GORGEOUS. YOU.", 300, 300, 230, 138 * Math.PI / 180, 42 * Math.PI / 180, true, secondaryText);
        ctx.restore();
      }
      
      // 3. Stems (progress 0.35 -> 0.75)
      const stemProgress = Math.min(1, Math.max(0, (progress - 0.35) / 0.4));
      const stemEase = easeInOut(stemProgress);
      if (stemProgress > 0) {
        ctx.save();
        ctx.translate(300, 390);
        ctx.scale(1, stemEase);
        ctx.translate(-300, -390);
        ctx.globalAlpha = Math.min(1, stemProgress * 1.5);
        
        // Left stem
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(290, 360, 250, 330, 250, 280);
        ctx.bezierCurveTo(250, 230, 275, 220, 274, 195);
        ctx.bezierCurveTo(275, 223, 258, 230, 258, 280);
        ctx.bezierCurveTo(258, 330, 292, 360, 300, 390);
        ctx.fillStyle = gold;
        ctx.fill();
        
        // Right stem
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(310, 360, 350, 330, 350, 280);
        ctx.bezierCurveTo(350, 230, 325, 220, 326, 195);
        ctx.bezierCurveTo(325, 223, 342, 230, 342, 280);
        ctx.bezierCurveTo(342, 330, 308, 360, 300, 390);
        ctx.fillStyle = gold;
        ctx.fill();
        
        ctx.restore();
      }
      
      // 4. Leaves (progress 0.5 -> 0.85)
      const leafProgress = Math.min(1, Math.max(0, (progress - 0.5) / 0.35));
      const leafEase = easeOutBack(leafProgress);
      if (leafProgress > 0) {
        ctx.save();
        ctx.translate(300, 400);
        ctx.scale(leafEase, leafEase);
        ctx.translate(-300, -400);
        ctx.globalAlpha = Math.min(1, leafProgress * 2);
        
        // Left leaf
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(270, 370, 210, 330, 170, 305);
        ctx.bezierCurveTo(210, 370, 260, 410, 300, 400);
        ctx.fillStyle = leafLeft;
        ctx.fill();
        
        // Right leaf
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(330, 370, 390, 330, 430, 305);
        ctx.bezierCurveTo(390, 370, 340, 410, 300, 400);
        ctx.fillStyle = leafRight;
        ctx.fill();
        
        ctx.restore();
      }
      
      // 5. Droplet (progress 0.65 -> 0.95)
      const dropletProgress = Math.min(1, Math.max(0, (progress - 0.65) / 0.3));
      const dropletEase = easeOutBack(dropletProgress);
      if (dropletProgress > 0) {
        ctx.save();
        ctx.translate(300, 312);
        ctx.scale(dropletEase, dropletEase);
        ctx.translate(-300, -312);
        ctx.globalAlpha = Math.min(1, dropletProgress * 2);
        
        ctx.beginPath();
        ctx.moveTo(300, 245);
        ctx.bezierCurveTo(295, 245, 278, 265, 278, 285);
        ctx.bezierCurveTo(278, 300, 288, 312, 300, 312);
        ctx.bezierCurveTo(312, 312, 322, 300, 322, 285);
        ctx.bezierCurveTo(322, 265, 305, 245, 300, 245);
        ctx.fillStyle = gold;
        ctx.fill();
        
        ctx.restore();
      }
      
      // 6. Head (progress 0.75 -> 1.0)
      const headProgress = Math.min(1, Math.max(0, (progress - 0.75) / 0.25));
      const headEase = easeOutBack(headProgress);
      if (headProgress > 0) {
        ctx.save();
        ctx.translate(300, 205);
        ctx.scale(headEase, headEase);
        ctx.translate(-300, -205);
        ctx.globalAlpha = Math.min(1, headProgress * 2);
        
        ctx.beginPath();
        ctx.arc(300, 205, 16, 0, 2 * Math.PI);
        ctx.fillStyle = head;
        ctx.fill();
        
        ctx.restore();
      }
    } else if (style === 'bloom') {
      const t = easeInOut(progress);
      
      // Arcs & Text
      ctx.save();
      ctx.globalAlpha = t;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = gold;
      
      ctx.beginPath();
      ctx.arc(300, 300, 210, 152 * Math.PI / 180, 208 * Math.PI / 180, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(300, 300, 210, 332 * Math.PI / 180, 28 * Math.PI / 180, false);
      ctx.stroke();
      
      drawTextAlongArc(ctx, "FG MAKEOVERS", 300, 300, 210, 222 * Math.PI / 180, 318 * Math.PI / 180, false, primaryText);
      drawTextAlongArc(ctx, "FLAWLESS. GORGEOUS. YOU.", 300, 300, 230, 138 * Math.PI / 180, 42 * Math.PI / 180, true, secondaryText);
      ctx.restore();
      
      // Leaves bloom
      ctx.save();
      ctx.globalAlpha = t;
      
      ctx.save();
      ctx.translate(300, 400);
      ctx.rotate((1 - t) * 20 * Math.PI / 180);
      ctx.scale(t, t);
      ctx.translate(-300, -400);
      ctx.beginPath();
      ctx.moveTo(300, 400);
      ctx.bezierCurveTo(270, 370, 210, 330, 170, 305);
      ctx.bezierCurveTo(210, 370, 260, 410, 300, 400);
      ctx.fillStyle = leafLeft;
      ctx.fill();
      ctx.restore();
      
      ctx.save();
      ctx.translate(300, 400);
      ctx.rotate((1 - t) * -20 * Math.PI / 180);
      ctx.scale(t, t);
      ctx.translate(-300, -400);
      ctx.beginPath();
      ctx.moveTo(300, 400);
      ctx.bezierCurveTo(330, 370, 390, 330, 430, 305);
      ctx.bezierCurveTo(390, 370, 340, 410, 300, 400);
      ctx.fillStyle = leafRight;
      ctx.fill();
      ctx.restore();
      
      // Stems
      ctx.save();
      ctx.translate(300, 390);
      ctx.scale(t, t);
      ctx.translate(-300, -390);
      
      ctx.beginPath();
      ctx.moveTo(300, 390);
      ctx.bezierCurveTo(290, 360, 250, 330, 250, 280);
      ctx.bezierCurveTo(250, 230, 275, 220, 274, 195);
      ctx.bezierCurveTo(275, 223, 258, 230, 258, 280);
      ctx.bezierCurveTo(258, 330, 292, 360, 300, 390);
      ctx.fillStyle = gold;
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(300, 390);
      ctx.bezierCurveTo(310, 360, 350, 330, 350, 280);
      ctx.bezierCurveTo(350, 230, 325, 220, 326, 195);
      ctx.bezierCurveTo(325, 223, 342, 230, 342, 280);
      ctx.bezierCurveTo(342, 330, 308, 360, 300, 390);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.restore();
      
      // Droplet
      ctx.save();
      ctx.translate(300, 312);
      ctx.translate(0, (1 - t) * 15);
      ctx.scale(t, t);
      ctx.translate(-300, -312);
      ctx.beginPath();
      ctx.moveTo(300, 245);
      ctx.bezierCurveTo(295, 245, 278, 265, 278, 285);
      ctx.bezierCurveTo(278, 300, 288, 312, 300, 312);
      ctx.bezierCurveTo(312, 312, 322, 300, 322, 285);
      ctx.bezierCurveTo(322, 265, 305, 245, 300, 245);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.restore();
      
      // Head
      ctx.save();
      ctx.translate(300, 205);
      ctx.translate(0, (1 - t) * 20);
      ctx.scale(t, t);
      ctx.translate(-300, -205);
      ctx.beginPath();
      ctx.arc(300, 205, 16, 0, 2 * Math.PI);
      ctx.fillStyle = head;
      ctx.fill();
      ctx.restore();
      
      ctx.restore();
    } else {
      // Line sketch
      const drawT = Math.min(1, progress / 0.75);
      const fillT = Math.min(1, Math.max(0, (progress - 0.7) / 0.3));
      
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = gold;
      ctx.lineCap = 'round';
      
      // Arcs sketch
      if (drawT > 0) {
        const arcT = Math.min(1, drawT / 0.4);
        ctx.beginPath();
        ctx.arc(300, 300, 210, 152 * Math.PI / 180, (152 + (208 - 152) * arcT) * Math.PI / 180, false);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(300, 300, 210, 332 * Math.PI / 180, (332 + (388 - 332) * arcT) * Math.PI / 180, false);
        ctx.stroke();
      }
      
      // Text
      if (fillT > 0) {
        ctx.save();
        ctx.globalAlpha = fillT;
        drawTextAlongArc(ctx, "FG MAKEOVERS", 300, 300, 210, 222 * Math.PI / 180, 318 * Math.PI / 180, false, primaryText);
        drawTextAlongArc(ctx, "FLAWLESS. GORGEOUS. YOU.", 300, 300, 230, 138 * Math.PI / 180, 42 * Math.PI / 180, true, secondaryText);
        ctx.restore();
      }
      
      // Stems sketch
      const stemT = Math.min(1, Math.max(0, (drawT - 0.1) / 0.6));
      if (stemT > 0) {
        ctx.save();
        const pathLength = 350;
        ctx.setLineDash([pathLength, pathLength]);
        ctx.lineDashOffset = pathLength * (1 - stemT);
        
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(290, 360, 250, 330, 250, 280);
        ctx.bezierCurveTo(250, 230, 275, 220, 274, 195);
        ctx.bezierCurveTo(275, 223, 258, 230, 258, 280);
        ctx.bezierCurveTo(258, 330, 292, 360, 300, 390);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(310, 360, 350, 330, 350, 280);
        ctx.bezierCurveTo(350, 230, 325, 220, 326, 195);
        ctx.bezierCurveTo(325, 223, 342, 230, 342, 280);
        ctx.bezierCurveTo(342, 330, 308, 360, 300, 390);
        ctx.stroke();
        ctx.restore();
      }
      
      // Leaves sketch
      const leafT = Math.min(1, Math.max(0, (drawT - 0.3) / 0.5));
      if (leafT > 0) {
        ctx.save();
        const pathLength = 260;
        ctx.setLineDash([pathLength, pathLength]);
        ctx.lineDashOffset = pathLength * (1 - leafT);
        
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(270, 370, 210, 330, 170, 305);
        ctx.bezierCurveTo(210, 370, 260, 410, 300, 400);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(330, 370, 390, 330, 430, 305);
        ctx.bezierCurveTo(390, 370, 340, 410, 300, 400);
        ctx.stroke();
        ctx.restore();
      }
      
      // Droplet sketch
      const dropT = Math.min(1, Math.max(0, (drawT - 0.5) / 0.4));
      if (dropT > 0) {
        ctx.save();
        const pathLength = 180;
        ctx.setLineDash([pathLength, pathLength]);
        ctx.lineDashOffset = pathLength * (1 - dropT);
        
        ctx.beginPath();
        ctx.moveTo(300, 245);
        ctx.bezierCurveTo(295, 245, 278, 265, 278, 285);
        ctx.bezierCurveTo(278, 300, 288, 312, 300, 312);
        ctx.bezierCurveTo(312, 312, 322, 300, 322, 285);
        ctx.bezierCurveTo(322, 265, 305, 245, 300, 245);
        ctx.stroke();
        ctx.restore();
      }
      
      // Head sketch
      const headT = Math.min(1, Math.max(0, (drawT - 0.6) / 0.4));
      if (headT > 0) {
        ctx.save();
        const pathLength = 100;
        ctx.setLineDash([pathLength, pathLength]);
        ctx.lineDashOffset = pathLength * (1 - headT);
        
        ctx.beginPath();
        ctx.arc(300, 205, 16, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
      
      // Fills
      if (fillT > 0) {
        ctx.save();
        ctx.globalAlpha = fillT;
        
        // Stems
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(290, 360, 250, 330, 250, 280);
        ctx.bezierCurveTo(250, 230, 275, 220, 274, 195);
        ctx.bezierCurveTo(275, 223, 258, 230, 258, 280);
        ctx.bezierCurveTo(258, 330, 292, 360, 300, 390);
        ctx.fillStyle = gold;
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(300, 390);
        ctx.bezierCurveTo(310, 360, 350, 330, 350, 280);
        ctx.bezierCurveTo(350, 230, 325, 220, 326, 195);
        ctx.bezierCurveTo(325, 223, 342, 230, 342, 280);
        ctx.bezierCurveTo(342, 330, 308, 360, 300, 390);
        ctx.fillStyle = gold;
        ctx.fill();
        
        // Leaves
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(270, 370, 210, 330, 170, 305);
        ctx.bezierCurveTo(210, 370, 260, 410, 300, 400);
        ctx.fillStyle = leafLeft;
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(300, 400);
        ctx.bezierCurveTo(330, 370, 390, 330, 430, 305);
        ctx.bezierCurveTo(390, 370, 340, 410, 300, 400);
        ctx.fillStyle = leafRight;
        ctx.fill();
        
        // Droplet
        ctx.beginPath();
        ctx.moveTo(300, 245);
        ctx.bezierCurveTo(295, 245, 278, 265, 278, 285);
        ctx.bezierCurveTo(278, 300, 288, 312, 300, 312);
        ctx.bezierCurveTo(312, 312, 322, 300, 322, 285);
        ctx.bezierCurveTo(322, 265, 305, 245, 300, 245);
        ctx.fillStyle = gold;
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(300, 205, 16, 0, 2 * Math.PI);
        ctx.fillStyle = head;
        ctx.fill();
        
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // Export to Animated GIF using gifshot
  async function generateGIF() {
    exportStatusTitle.textContent = "Generating GIF";
    exportStatusDesc.textContent = "Rendering frames... (0%)";
    exportProgressBar.style.width = "0%";
    exportOverlay.classList.add('open');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 600;
    tempCanvas.height = 600;
    const tempCtx = tempCanvas.getContext('2d');

    const frames = [];
    const numAnimFrames = 60; // 3 seconds at 20fps
    const numHoldFrames = 40;  // 2 seconds hold at 20fps
    const totalFrames = numAnimFrames + numHoldFrames;
    const activeTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';

    for (let i = 0; i < totalFrames; i++) {
      const progress = i < numAnimFrames ? i / numAnimFrames : 1.0;
      drawLogoFrame(tempCtx, progress, currentStyle, activeTheme);

      // Clone canvas frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = 600;
      frameCanvas.height = 600;
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.drawImage(tempCanvas, 0, 0);
      frames.push(frameCanvas);

      const percent = Math.round((i / totalFrames) * 45); // 0 to 45% for rendering
      exportProgressBar.style.width = `${percent}%`;
      exportStatusDesc.textContent = `Rendering frame ${i+1}/${totalFrames}... (${percent}%)`;
      
      if (i % 8 === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    exportStatusDesc.textContent = "Encoding GIF... (50%)";
    exportProgressBar.style.width = "50%";

    let fakeProgress = 50;
    const progressInterval = setInterval(() => {
      if (fakeProgress < 95) {
        fakeProgress += 4;
        exportProgressBar.style.width = `${fakeProgress}%`;
        exportStatusDesc.textContent = `Encoding GIF... (${fakeProgress}%)`;
      }
    }, 350);

    if (typeof gifshot === 'undefined') {
      clearInterval(progressInterval);
      alert("GIF encoding library failed to load. Please verify your internet connection and try again.");
      exportOverlay.classList.remove('open');
      return;
    }

    gifshot.createGIF({
      images: frames,
      gifWidth: 600,
      gifHeight: 600,
      interval: 0.05, // 20 FPS (50ms interval)
      numFrames: totalFrames,
      sampleInterval: 10,
      numWorkers: 2,
    }, function(obj) {
      clearInterval(progressInterval);
      if (!obj.error) {
        exportProgressBar.style.width = "100%";
        exportStatusDesc.textContent = "Ready! Downloading...";
        
        const downloadLink = document.createElement('a');
        downloadLink.href = obj.image;
        downloadLink.download = `fg_makeovers_logo_${currentStyle}.gif`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        alert("Error generating GIF: " + obj.errorMsg);
      }
      
      setTimeout(() => {
        exportOverlay.classList.remove('open');
      }, 800);
    });
  }

  // Export to WebM/MP4 Video using MediaRecorder
  async function generateVideo() {
    exportStatusTitle.textContent = "Generating Video";
    exportStatusDesc.textContent = "Initializing recorder...";
    exportProgressBar.style.width = "0%";
    exportOverlay.classList.add('open');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 600;
    tempCanvas.height = 600;
    const tempCtx = tempCanvas.getContext('2d');

    const numAnimFrames = 90;  // 3 seconds at 30fps
    const numHoldFrames = 120; // 4 seconds hold at 30fps
    const totalFrames = numAnimFrames + numHoldFrames;
    const activeTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';

    // Capture canvas stream at 30fps
    const stream = tempCanvas.captureStream(30);
    
    // Choose codec
    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = {};
    }

    let mediaRecorder;
    const chunks = [];
    
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      alert("MediaRecorder is not supported on this browser.");
      exportOverlay.classList.remove('open');
      return;
    }

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      exportProgressBar.style.width = "100%";
      exportStatusDesc.textContent = "Ready! Downloading...";
      
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      // Many modern systems play VP9 inside a WebM file natively or support renaming to .mp4
      downloadLink.download = `fg_makeovers_logo_${currentStyle}.mp4`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      
      setTimeout(() => {
        exportOverlay.classList.remove('open');
      }, 800);
    };

    mediaRecorder.start();
    
    // Draw frames at 30 FPS
    for (let i = 0; i < totalFrames; i++) {
      const progress = i < numAnimFrames ? i / numAnimFrames : 1.0;
      drawLogoFrame(tempCtx, progress, currentStyle, activeTheme);

      // Wait for a browser redraw so the stream captures the frame
      await new Promise(resolve => requestAnimationFrame(resolve));

      const percent = Math.round((i / totalFrames) * 100);
      exportProgressBar.style.width = `${percent}%`;
      exportStatusDesc.textContent = `Recording frames... ${i+1}/${totalFrames} (${percent}%)`;
    }

    mediaRecorder.stop();
  }

  // Bind Export Button Click Listeners
  downloadGifBtn.addEventListener('click', () => {
    generateGIF();
  });

  downloadVideoBtn.addEventListener('click', () => {
    generateVideo();
  });
});

