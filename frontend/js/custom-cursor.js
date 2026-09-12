/**
 * Remembering Bag — Custom Futuristic Dual-Ring Cyan Cursor
 * Exact replication of the cyan inner dot with smooth trailing outer hollow ring.
 */

class FuturisticCursor {
  constructor() {
    this.dot = document.getElementById('customCursorDot');
    this.ring = document.getElementById('customCursorRing');
    
    if (!this.dot || !this.ring) return;

    this.mouse = { x: -100, y: -100 };
    this.ringPos = { x: -100, y: -100 };
    this.isHovering = false;
    this.isActive = false;
    this.isVisible = false;
    
    this.interactiveSelectors = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '.floating-item-chip',
      '.zipper-slider-unit',
      '.zipper-instruction-tooltip',
      '.demo-item-row',
      '.compartment-pill',
      '.feature-card',
      '.step-card',
      '.pipeline-card',
      '.faq-item'
    ];

    this.init();
  }

  init() {
    // Check if device is touch-only
    if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(hover: hover)').matches) {
      this.dot.style.display = 'none';
      this.ring.style.display = 'none';
      return;
    }

    document.documentElement.classList.add('has-custom-cursor');

    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      if (!this.isVisible) {
        this.isVisible = true;
        this.dot.classList.add('visible');
        this.ring.classList.add('visible');
        this.ringPos.x = this.mouse.x;
        this.ringPos.y = this.mouse.y;
      }
    });

    // Mouse leave / enter window
    document.addEventListener('mouseleave', () => {
      this.isVisible = false;
      this.dot.classList.remove('visible');
      this.ring.classList.remove('visible');
    });

    document.addEventListener('mouseenter', () => {
      this.isVisible = true;
      this.dot.classList.add('visible');
      this.ring.classList.add('visible');
    });

    // Click press feedback
    window.addEventListener('mousedown', () => {
      this.isActive = true;
      this.ring.classList.add('active');
      this.dot.classList.add('active');
    });

    window.addEventListener('mouseup', () => {
      this.isActive = false;
      this.ring.classList.remove('active');
      this.dot.classList.remove('active');
    });

    // Hover state delegation
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(this.interactiveSelectors.join(', '));
      if (target) {
        this.isHovering = true;
        this.ring.classList.add('hovering');
        this.dot.classList.add('hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest(this.interactiveSelectors.join(', '));
      if (target) {
        this.isHovering = false;
        this.ring.classList.remove('hovering');
        this.dot.classList.remove('hovering');
      }
    });

    // Start RAF loop for silky smooth 60fps lerp
    this.render();
  }

  render() {
    // Instant dot movement with zero latency
    this.dot.style.transform = `translate3d(${this.mouse.x}px, ${this.mouse.y}px, 0)`;

    // Smooth physics lerp for outer trailing ring
    this.ringPos.x += (this.mouse.x - this.ringPos.x) * 0.18;
    this.ringPos.y += (this.mouse.y - this.ringPos.y) * 0.18;

    this.ring.style.transform = `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0)`;

    requestAnimationFrame(() => this.render());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FuturisticCursor();
});
