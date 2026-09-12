/**
 * Remembering Bag — Smart Compartments Visualizer Controller
 */

class SmartCompartmentsManager {
  constructor() {
    this.tabs = document.querySelectorAll('.compartment-tab');
    this.zoneTitle = document.getElementById('compStageZoneTitle');
    this.zoneFreq = document.getElementById('compStageZoneFreq');
    this.zoneItems = document.getElementById('compStageItems');
    this.antennaRing = document.getElementById('compHighlightRing');

    this.compartmentsData = {
      '1': {
        name: 'COMPARTMENT 01 — FRONT QUICK-ACCESS',
        frequency: 'RFID ZONE 13.56 MHz (HF PASSIVE)',
        items: ['Wallet', 'College ID Badge', 'Earbuds'],
        color: 'var(--accent-cyan)'
      },
      '2': {
        name: 'COMPARTMENT 02 — MAIN TECH CAVITY',
        frequency: 'RFID ZONE 13.56 MHz (NEAR-FIELD COIL)',
        items: ['Laptop (15")', 'Fast Charger', 'Calculator', 'Notebook'],
        color: 'var(--status-green)'
      },
      '3': {
        name: 'COMPARTMENT 03 — SECURITY KEY POCKET',
        frequency: 'RFID ZONE 13.56 MHz (SHIELDED CAVITY)',
        items: ['House & Bike Keys', 'Transit Pass'],
        color: 'var(--accent-blue)'
      }
    };
  }

  init() {
    if (!this.tabs.length) return;

    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const compId = tab.dataset.compartment;
        this.selectCompartment(compId, tab);
      });
    });

    // Default select compartment 1
    this.selectCompartment('1', this.tabs[0]);
  }

  selectCompartment(id, activeTab) {
    this.tabs.forEach(t => t.classList.remove('active'));
    if (activeTab) activeTab.classList.add('active');

    const data = this.compartmentsData[id];
    if (!data) return;

    if (this.zoneTitle) this.zoneTitle.innerText = data.name;
    if (this.zoneFreq) this.zoneFreq.innerText = data.frequency;

    if (this.zoneItems) {
      this.zoneItems.innerHTML = '';
      data.items.forEach(item => {
        const badge = document.createElement('div');
        badge.className = 'comp-item-badge';
        badge.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        badge.style.color = '#FFFFFF';
        badge.style.padding = '0.4rem 0.8rem';
        badge.style.fontSize = '0.85rem';
        badge.innerText = item;
        this.zoneItems.appendChild(badge);
      });
    }

    if (this.antennaRing) {
      this.antennaRing.style.borderColor = data.color;
      this.antennaRing.style.boxShadow = `0 0 30px ${data.color}`;
      this.antennaRing.style.transform = 'scale(1.15)';
      setTimeout(() => {
        if (this.antennaRing) this.antennaRing.style.transform = 'scale(1)';
      }, 300);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const compManager = new SmartCompartmentsManager();
  compManager.init();
});
