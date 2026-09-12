/**
 * Remembering Bag — Technology Pipeline Packet Animation
 */

class TechFlowManager {
  constructor() {
    this.nodes = document.querySelectorAll('.pipeline-node');
  }

  init() {
    if (!this.nodes.length) return;

    let currentIndex = 0;
    setInterval(() => {
      this.nodes.forEach((node, idx) => {
        if (idx === currentIndex) {
          node.classList.add('active');
        } else {
          node.classList.remove('active');
        }
      });
      currentIndex = (currentIndex + 1) % this.nodes.length;
    }, 700);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const flow = new TechFlowManager();
  flow.init();
});
