/**
 * Remembering Bag — Hero Visual 3D Tilt & RFID Wave Interaction
 */

class HeroVisualManager {
  constructor() {
    this.wrapper = document.getElementById('heroVisualWrapper');
    this.backpack = document.getElementById('heroBackpack3D');
    this.chips = document.querySelectorAll('.floating-item-chip');
    this.isMobile = window.innerWidth < 980;
  }

  init() {
    if (!this.wrapper || !this.backpack) return;

    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 980;
      if (this.isMobile && this.backpack) {
        this.backpack.style.transform = 'none';
      }
    });

    if (!this.isMobile) {
      this.setupMouseParallax();
    }
  }

  setupMouseParallax() {
    this.wrapper.addEventListener('mousemove', (e) => {
      const rect = this.wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Subtle 3D tilt
      const rotateY = (x / rect.width) * 12; // -6deg to +6deg
      const rotateX = -(y / rect.height) * 12; // -6deg to +6deg

      this.backpack.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      // Depth offset for floating chips
      this.chips.forEach((chip, i) => {
        const depth = (i + 1) * 3;
        const moveX = (x / rect.width) * depth * -1;
        const moveY = (y / rect.height) * depth * -1;
        chip.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    });

    this.wrapper.addEventListener('mouseleave', () => {
      this.backpack.style.transform = 'rotateX(0deg) rotateY(0deg)';
      this.chips.forEach((chip) => {
        chip.style.transform = 'translate(0px, 0px)';
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const heroVisual = new HeroVisualManager();
  heroVisual.init();
});
