/**
 * Remembering Bag — Interactive Bag Demo Controller
 * Sequential RFID Scanning simulation with interactive item toggling and status diagnostics.
 */

class InteractiveBagDemo {
  constructor() {
    this.btnScan = document.getElementById('btnStartScan');
    this.statusText = document.getElementById('demoLiveStatusText');
    this.statusDot = document.getElementById('demoLiveStatusDot');
    this.scanLine = document.getElementById('demoRadarScanLine');
    this.verdictBox = document.getElementById('demoVerdictBox');
    this.verdictTitle = document.getElementById('demoVerdictTitle');
    this.verdictDesc = document.getElementById('demoVerdictDesc');
    
    this.items = [
      { 
        id: 'wallet', 
        name: 'Wallet', 
        svg: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`, 
        present: true 
      },
      { 
        id: 'keys', 
        name: 'Keys', 
        svg: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`, 
        present: true 
      },
      { 
        id: 'id_card', 
        name: 'College ID', 
        svg: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 9h2"/><path d="M15 13h2"/><path d="M7 16a4 4 0 0 1 4-2"/></svg>`, 
        present: true 
      },
      { 
        id: 'charger', 
        name: 'Charger', 
        svg: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="M18 8a6 6 0 0 1-12 0"/><path d="M12 14v8"/><path d="M9 22h6"/></svg>`, 
        present: false 
      }
    ];

    this.isScanning = false;
  }

  init() {
    if (!this.btnScan) return;
    this.renderItemsList();

    this.btnScan.addEventListener('click', () => {
      if (this.isScanning) return;
      this.runScanSequence();
    });
  }

  toggleItem(id) {
    if (this.isScanning) return;
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.present = !item.present;
      this.renderItemsList();
      if (this.verdictBox) this.verdictBox.classList.remove('active');
    }
  }

  renderItemsList() {
    const listEl = document.getElementById('demoItemsList');
    if (!listEl) return;

    listEl.innerHTML = '';
    this.items.forEach(item => {
      const row = document.createElement('div');
      row.className = `demo-item-row ${item.present ? 'detected' : 'missing'}`;
      row.id = `demo-row-${item.id}`;
      row.style.cursor = 'pointer';
      row.title = `Click to toggle ${item.name} packed/missing`;

      row.innerHTML = `
        <div class="demo-item-left">
          ${item.svg}
          <span class="demo-item-name">${item.name}</span>
        </div>
        <div class="demo-item-pill ${item.present ? 'present' : 'missing'}" id="demo-pill-${item.id}">
          <span>${item.present ? '✓' : '✗'}</span>
          <span>${item.present ? 'Present' : 'Missing'}</span>
        </div>
      `;

      row.addEventListener('click', () => this.toggleItem(item.id));
      listEl.appendChild(row);
    });
  }

  async runScanSequence() {
    this.isScanning = true;
    this.btnScan.disabled = true;
    this.btnScan.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon" style="animation: spin 1s infinite linear;">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
      SCANNING COMPARTMENTS...
    `;

    if (this.statusText) this.statusText.innerText = 'SCANNING IN PROGRESS...';
    if (this.scanLine) this.scanLine.classList.add('scanning');
    if (this.verdictBox) this.verdictBox.classList.remove('active');

    // Reset rows to waiting state
    this.items.forEach(item => {
      const row = document.getElementById(`demo-row-${item.id}`);
      const pill = document.getElementById(`demo-pill-${item.id}`);
      if (row) row.className = 'demo-item-row';
      if (pill) {
        pill.className = 'demo-item-pill waiting';
        pill.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon" style="animation: spin 1.2s infinite linear;">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
          </svg>
          <span>Queued</span>
        `;
      }
    });

    let missingCount = 0;
    const missingNames = [];

    // Scan each item sequentially with realistic micro-delays
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const row = document.getElementById(`demo-row-${item.id}`);
      const pill = document.getElementById(`demo-pill-${item.id}`);

      if (row) row.classList.add('scanning');
      if (pill) {
        pill.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5" class="spin-icon" style="animation: spin 0.8s infinite linear;">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
          </svg>
          <span>Interrogating...</span>
        `;
      }
      if (this.statusText) this.statusText.innerText = `Interrogating 13.56 MHz RFID Tag: ${item.name}...`;

      await new Promise(r => setTimeout(r, 1150));

      if (row) row.classList.remove('scanning');

      if (item.present) {
        if (row) row.classList.add('detected');
        if (pill) {
          pill.className = 'demo-item-pill present';
          pill.innerHTML = `<span>✓</span><span>Detected</span>`;
        }
      } else {
        missingCount++;
        missingNames.push(item.name);
        if (row) row.classList.add('missing');
        if (pill) {
          pill.className = 'demo-item-pill missing';
          pill.innerHTML = `<span>✗</span><span>Not Found</span>`;
        }
      }
    }

    // Stop scanning effects
    if (this.scanLine) this.scanLine.classList.remove('scanning');

    // Reveal verdict
    if (this.verdictBox) {
      this.verdictBox.classList.add('active');
      if (missingCount > 0) {
        this.verdictBox.style.borderColor = 'rgba(255, 59, 48, 0.4)';
        this.verdictBox.style.background = 'rgba(255, 59, 48, 0.08)';
        this.verdictTitle.style.color = '#FFFFFF';
        this.verdictTitle.innerText = `${missingCount} item${missingCount > 1 ? 's are' : ' is'} missing.`;
        this.verdictDesc.style.color = 'var(--status-red)';
        this.verdictDesc.innerText = `Your ${missingNames.join(', ')} isn't in the bag.`;
        if (this.statusText) {
          this.statusText.innerText = 'ALERT: ESSENTIAL OMITTED';
          this.statusText.style.color = 'var(--status-red)';
        }
      } else {
        this.verdictBox.style.borderColor = 'rgba(0, 223, 143, 0.4)';
        this.verdictBox.style.background = 'rgba(0, 223, 143, 0.08)';
        this.verdictTitle.style.color = '#FFFFFF';
        this.verdictTitle.innerText = 'All essentials packed.';
        this.verdictDesc.style.color = 'var(--status-green)';
        this.verdictDesc.innerText = 'Your bag has everything for today. Ready to leave!';
        if (this.statusText) {
          this.statusText.innerText = 'VERIFIED: 100% PACKED';
          this.statusText.style.color = 'var(--status-green)';
        }
      }
    }

    this.isScanning = false;
    this.btnScan.disabled = false;
    this.btnScan.innerHTML = `
      <span>Check Again</span>
      <span style="font-size: 1.1rem;">↻</span>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const demo = new InteractiveBagDemo();
  demo.init();
});
