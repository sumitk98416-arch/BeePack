/**
 * Remembering Bag — Premium Futuristic 3D Flowing Wireframe Mesh Background
 * 
 * Architecture:
 * - Procedural 3D undulating topological surface / RFID signal field
 * - Dual-axis wireframe lattice (longitudinal wave splines + transverse depth ribs)
 * - True 3D perspective projection with horizon depth foreshortening
 * - Traveling RFID electromagnetic scan pulse illuminating the wireframe
 * - Sparse intersection nodes with breathing luminescent halos
 * - Clean dark upper hero (#000000) with mesh localized to lower 35–45%
 * - Smooth cursor reactive deformation and full prefers-reduced-motion support
 */

class FlowingMeshBackground {
  constructor() {
    this.canvas = document.getElementById('ambientCanvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.time = 0;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Mesh Density
    this.cols = 48; // Horizontal resolution
    this.rows = 20; // Depth resolution (Z-axis)
    this.grid = []; // 2D array of computed projected points

    // Sparse Nodes
    this.sparseNodes = [];

    // RFID Scanning Wave State
    this.scan = {
      progress: 0,
      speed: 0.0006,  // Subtle, rhythmic sweep
      width: 0.20     // Spatial pulse width
    };

    // Interactive Mouse
    this.mouse = {
      x: -2000,
      y: -2000,
      targetX: -2000,
      targetY: -2000,
      radius: 200,
      active: false
    };

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  init() {
    this.resize();
    this.createSparseNodes();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Responsive grid resolution
    if (this.width < 768) {
      this.cols = 28;
      this.rows = 14;
    } else if (this.width < 1200) {
      this.cols = 38;
      this.rows = 18;
    } else {
      this.cols = 48;
      this.rows = 20;
    }

    this.createSparseNodes();
  }

  createSparseNodes() {
    this.sparseNodes = [];
    // Generate sparse, organic node distribution at grid intersections
    for (let r = 2; r < this.rows - 1; r += 2) {
      for (let c = 2; c < this.cols - 1; c += 3) {
        const hash = (r * 41 + c * 23) % 100;
        if (hash > 38) {
          this.sparseNodes.push({
            row: r,
            col: c,
            isPulsing: hash > 80,
            pulsePhase: (r + c) * 0.8,
            pulseSpeed: 0.012 + (hash % 10) * 0.002,
            baseRadius: hash > 80 ? 2.0 : 1.2
          });
        }
      }
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;
      this.mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
      this.mouse.targetX = -2000;
      this.mouse.targetY = -2000;
    });

    try {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
      });
    } catch (e) {}
  }

  updateGrid() {
    const t = this.reducedMotion ? 120 : this.time;
    this.grid = [];

    // Scan wave position across u: -0.3 to 1.3
    const scanU = (this.scan.progress % 1.6) - 0.3;

    // Positioning: Flowing mesh anchored in lower 35-45% of viewport
    const horizonY = this.height * 0.54;   // Horizon baseline
    const depthSpan = this.height * 0.42;  // Perspective depth extent
    const widthSpan = this.width * 1.45;   // Extended perspective width
    const fov = 380;                       // Perspective focal length

    for (let r = 0; r < this.rows; r++) {
      const rowArr = [];
      const v = r / (this.rows - 1); // 0 (horizon/far) to 1 (near foreground)

      // Perspective foreshortening
      const zDepth = (1 - v) * 420;
      const perspScale = fov / (fov + zDepth);

      for (let c = 0; c < this.cols; c++) {
        const u = c / (this.cols - 1); // 0 (left) to 1 (right)

        // 3D X coordinate with fan projection
        const worldX = (u - 0.5) * widthSpan;
        const screenX = this.width * 0.5 + worldX * perspScale;

        // Harmonic topological wave surface math
        const amp = 0.4 + v * 0.6; // Foreground has richer amplitude
        const wave1 = Math.sin(u * 4.2 - t * 0.008 + v * 2.8) * (32 * amp);
        const wave2 = Math.cos(u * 2.9 + t * 0.006 - v * 2.1) * (20 * amp);
        const wave3 = Math.sin(u * 7.5 - t * 0.012 + v * 4.5) * (8 * amp);
        const wave4 = Math.cos(u * 1.4 + t * 0.003) * (15 * amp);

        let yElevation = horizonY + (v * depthSpan) + (wave1 + wave2 + wave3 + wave4);

        // Backpack area dampening (keeps central/right area uncluttered)
        const bpDist = Math.sqrt(Math.pow((u - 0.72) / 0.24, 2) + Math.pow((v - 0.55) / 0.45, 2));
        if (bpDist < 1.0) {
          const bpFactor = 0.4 + 0.6 * bpDist;
          yElevation = horizonY + (v * depthSpan) + (wave1 + wave2 + wave3 + wave4) * bpFactor;
        }

        let screenY = yElevation;

        // Subtle Mouse Interaction
        if (this.mouse.active) {
          const dx = screenX - this.mouse.x;
          const dy = screenY - this.mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.mouse.radius) {
            const force = Math.cos((dist / this.mouse.radius) * (Math.PI / 2)) * 26;
            screenY += (dy / (dist || 1)) * force * 0.45;
          }
        }

        // RFID Scan Pulse Calculation
        const distToScan = Math.abs(u - scanU);
        let scanIntensity = 0;
        if (distToScan < this.scan.width) {
          scanIntensity = Math.pow(Math.cos((distToScan / this.scan.width) * (Math.PI / 2)), 2);
          screenY -= scanIntensity * 7.0; // Gentle elevation lift along pulse
        }

        // Depth and Edge Vignette Falloff
        const edgeFadeX = Math.sin(u * Math.PI);
        const depthAlpha = Math.pow(v, 1.2) * Math.min(1, edgeFadeX * 1.6);

        rowArr.push({
          u,
          v,
          screenX,
          screenY,
          alpha: Math.max(0, Math.min(1, depthAlpha)),
          scanIntensity
        });
      }
      this.grid.push(rowArr);
    }
  }

  drawMesh() {
    const ctx = this.ctx;

    // 1. Draw Longitudinal Flowing Spline Curves (Horizontal wave lines)
    for (let r = 0; r < this.rows; r++) {
      const row = this.grid[r];
      if (!row || row.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(row[0].screenX, row[0].screenY);

      for (let c = 1; c < this.cols; c++) {
        const prev = row[c - 1];
        const curr = row[c];
        const midX = (prev.screenX + curr.screenX) * 0.5;
        const midY = (prev.screenY + curr.screenY) * 0.5;
        ctx.quadraticCurveTo(prev.screenX, prev.screenY, midX, midY);
      }
      const last = row[this.cols - 1];
      ctx.lineTo(last.screenX, last.screenY);

      const v = r / (this.rows - 1);
      const baseAlpha = 0.05 + v * 0.22; // 0.05 in distance to 0.27 in foreground
      const scanAvg = row.reduce((acc, pt) => acc + pt.scanIntensity, 0) / this.cols;

      // Premium subtle cool tones: Slate Gray / Dark Cyan Wireframe
      const rVal = Math.round(110 + scanAvg * 60);
      const gVal = Math.round(150 + scanAvg * 85);
      const bVal = Math.round(180 + scanAvg * 75);
      const finalAlpha = Math.min(0.65, baseAlpha + scanAvg * 0.40);

      ctx.strokeStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${finalAlpha})`;
      ctx.lineWidth = 0.75 + v * 0.85; // 0.75px to 1.6px
      ctx.stroke();

      // Delicate luminous glow pass when RFID pulse crosses
      if (scanAvg > 0.07) {
        ctx.save();
        ctx.strokeStyle = `rgba(0, 229, 255, ${scanAvg * 0.32})`;
        ctx.lineWidth = (0.75 + v * 0.85) * 2.4;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Draw Transverse Connecting Spline Ribs (Vertical depth lines)
    for (let c = 0; c < this.cols; c++) {
      if (this.width < 768 && c % 2 !== 0) continue;

      ctx.beginPath();
      ctx.moveTo(this.grid[0][c].screenX, this.grid[0][c].screenY);

      for (let r = 1; r < this.rows; r++) {
        const prev = this.grid[r - 1][c];
        const curr = this.grid[r][c];
        const midX = (prev.screenX + curr.screenX) * 0.5;
        const midY = (prev.screenY + curr.screenY) * 0.5;
        ctx.quadraticCurveTo(prev.screenX, prev.screenY, midX, midY);
      }
      const last = this.grid[this.rows - 1][c];
      ctx.lineTo(last.screenX, last.screenY);

      const u = c / (this.cols - 1);
      const edgeFadeX = Math.sin(u * Math.PI);
      const scanCol = this.grid.reduce((acc, row) => acc + row[c].scanIntensity, 0) / this.rows;
      const ribAlpha = (0.03 + scanCol * 0.28) * edgeFadeX;

      ctx.strokeStyle = scanCol > 0.08
        ? `rgba(0, 229, 255, ${Math.min(0.42, ribAlpha * 2.0)})`
        : `rgba(130, 160, 195, ${Math.max(0.02, ribAlpha)})`;
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
  }

  drawNodes() {
    const ctx = this.ctx;

    this.sparseNodes.forEach(nodeDef => {
      const point = this.grid[nodeDef.row]?.[nodeDef.col];
      if (!point || point.alpha < 0.06) return;

      const { screenX, screenY, alpha, scanIntensity } = point;

      let radius = nodeDef.baseRadius;
      let nodeAlpha = alpha * 0.55;
      let isGlow = false;

      if (nodeDef.isPulsing) {
        const pulse = Math.sin(this.time * nodeDef.pulseSpeed + nodeDef.pulsePhase);
        nodeAlpha = alpha * (0.5 + pulse * 0.4);
        radius += pulse * 0.6;
        isGlow = true;
      }

      if (scanIntensity > 0.05) {
        nodeAlpha = Math.min(0.95, nodeAlpha + scanIntensity * 0.65);
        radius += scanIntensity * 1.3;
        isGlow = true;
      }

      // Soft halo for active nodes
      if (isGlow && nodeAlpha > 0.22) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius * 3.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${nodeAlpha * 0.24})`;
        ctx.fill();
      }

      // Center Node
      ctx.beginPath();
      ctx.arc(screenX, screenY, Math.max(0.6, radius), 0, Math.PI * 2);
      ctx.fillStyle = isGlow
        ? `rgba(0, 229, 255, ${nodeAlpha})`
        : `rgba(180, 205, 230, ${nodeAlpha})`;
      ctx.fill();
    });
  }

  drawAtmosphericDepth() {
    const ctx = this.ctx;

    // Upper Hero Darkness Falloff (Ensures top 50% is clean, deep black #000)
    const topFade = ctx.createLinearGradient(0, 0, 0, this.height * 0.52);
    topFade.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    topFade.addColorStop(0.7, 'rgba(0, 0, 0, 0.75)');
    topFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, this.width, this.height * 0.52);

    // Bottom Edge Falloff into subsequent sections
    const bottomFade = ctx.createLinearGradient(0, this.height * 0.84, 0, this.height);
    bottomFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomFade.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, this.height * 0.84, this.width, this.height * 0.16);
  }

  animate() {
    if (!this.reducedMotion) {
      this.time += 1;
      this.scan.progress += this.scan.speed * 16;
    }

    if (this.mouse.active) {
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.updateGrid();
    this.drawMesh();
    this.drawNodes();
    this.drawAtmosphericDepth();

    requestAnimationFrame(() => this.animate());
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new FlowingMeshBackground();
});
