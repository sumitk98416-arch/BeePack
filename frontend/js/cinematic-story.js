/**
 * Remembering Bag — Cinematic "Before You Leave" Storytelling Controller
 */

class CinematicStoryManager {
  constructor() {
    this.section = document.getElementById('cinematicSection');
    this.statusEl = document.getElementById('cinematicStatus');
    this.revealTitle = document.getElementById('cinematicRevealTitle');
    this.revealSub = document.getElementById('cinematicRevealSub');
    this.hasTriggered = false;
  }

  init() {
    if (!this.section) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasTriggered) {
          this.hasTriggered = true;
          this.playSequence();
        }
      });
    }, { threshold: 0.35 });

    observer.observe(this.section);
  }

  async playSequence() {
    if (!this.statusEl) return;

    this.statusEl.innerText = 'Checking your bag...';
    await this.sleep(700);
    this.statusEl.innerText = 'Checking: Wallet ✓';
    await this.sleep(600);
    this.statusEl.innerText = 'Checking: Keys ✓';
    await this.sleep(600);
    this.statusEl.innerText = 'Checking: College ID ✗';
    await this.sleep(600);
    this.statusEl.innerText = 'Checking: Calculator ✓';
    await this.sleep(800);

    this.statusEl.innerText = 'Scan Complete.';
    await this.sleep(400);

    if (this.revealTitle) {
      this.revealTitle.innerText = "Wait. You're missing something.";
      this.revealTitle.style.animation = 'fade-in 0.6s ease forwards';
    }

    if (this.revealSub) {
      this.revealSub.innerText = "College ID isn't in your bag.";
      this.revealSub.style.animation = 'fade-in 0.8s ease forwards';
    }
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const story = new CinematicStoryManager();
  story.init();
});
