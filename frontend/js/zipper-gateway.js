/**
 * Remembering Bag — Futuristic Interactive Hero Zipper Gateway
 */

class ZipperGatewayManager {
  constructor() {
    this.gateway = document.getElementById('zipperGateway');
    this.slider = document.getElementById('zipperSlider');
    this.pullTab = document.getElementById('pullTabHandle');
    this.tooltip = document.getElementById('zipperTooltip');
    this.trackGlow = document.getElementById('zipperTrackGlow');
    this.btnRezip = document.getElementById('btnRezipBag');
    this.isUnzipped = false;
  }

  init() {
    if (!this.gateway) return;

    // Click triggers
    const triggerUnzip = () => this.unzip();

    if (this.slider) this.slider.addEventListener('click', triggerUnzip);
    if (this.pullTab) this.pullTab.addEventListener('click', triggerUnzip);
    if (this.tooltip) this.tooltip.addEventListener('click', triggerUnzip);

    // Rezip button in navbar
    if (this.btnRezip) {
      this.btnRezip.addEventListener('click', (e) => {
        e.preventDefault();
        this.rezip();
      });
    }

    // Drag down to unzip support
    let startY = 0;
    let isDragging = false;

    if (this.slider) {
      this.slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || this.isUnzipped) return;
        const deltaY = e.clientY - startY;
        if (deltaY > 50) {
          this.unzip();
          isDragging = false;
        }
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Touch support
      this.slider.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
      });

      window.addEventListener('touchmove', (e) => {
        if (!isDragging || this.isUnzipped) return;
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY > 40) {
          this.unzip();
          isDragging = false;
        }
      });

      window.addEventListener('touchend', () => {
        isDragging = false;
      });
    }
  }

  unzip() {
    if (this.isUnzipped) return;
    this.isUnzipped = true;

    // Stage 1: Slide down zipper pull tab with glowing trail
    if (this.slider) {
      this.slider.style.top = '88%';
    }
    if (this.trackGlow) {
      this.trackGlow.style.height = '88%';
    }

    // Stage 2: Flaps slowly part and rotate outward in 3D
    setTimeout(() => {
      if (this.gateway) {
        this.gateway.classList.add('unzipped');
      }
    }, 850);
  }

  rezip() {
    this.isUnzipped = false;
    
    // First bring flaps back together
    if (this.gateway) {
      this.gateway.classList.remove('unzipped');
    }

    // Then slide zipper back up
    setTimeout(() => {
      if (this.slider) {
        this.slider.style.top = '25%';
      }
      if (this.trackGlow) {
        this.trackGlow.style.height = '0%';
      }
    }, 600);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const gateway = new ZipperGatewayManager();
  gateway.init();
});
