/**
 * Smart Remembering Backpack — Interactive Virtual Simulator
 * Lets you test, demo, and simulate the complete IoT RFID loop without physical hardware.
 */

class BagSimulator {
  constructor() {
    this.isBagClosed = true;
    this.itemsInsideBag = new Set(); // Set of item IDs
    this.misreadRate = 0; // 0 to 1
    this.batteryLevel = 94;
    this.onScanComplete = null;
    this.onStateChange = null;
  }

  init(items) {
    // By default, put most items in the bag (simulate a realistic packing state with 1-2 forgotten)
    this.itemsInsideBag.clear();
    if (items && items.length > 0) {
      items.forEach((item, index) => {
        // Skip last item for a realistic first demo
        if (index < items.length - 1) {
          this.itemsInsideBag.add(item.id);
        }
      });
    }
    this.render();
  }

  toggleItem(itemId) {
    if (this.itemsInsideBag.has(itemId)) {
      this.itemsInsideBag.delete(itemId);
    } else {
      this.itemsInsideBag.add(itemId);
    }
    this.render();
    if (this.onStateChange) this.onStateChange();
  }

  packAll(items) {
    items.forEach(i => this.itemsInsideBag.add(i.id));
    this.render();
    if (this.onStateChange) this.onStateChange();
  }

  unpackAll() {
    this.itemsInsideBag.clear();
    this.render();
    if (this.onStateChange) this.onStateChange();
  }

  packMissOne(items) {
    this.itemsInsideBag.clear();
    items.forEach((i, idx) => {
      if (idx !== 1) { // Leave second item out (e.g. Student ID or Keys)
        this.itemsInsideBag.add(i.id);
      }
    });
    this.render();
    if (this.onStateChange) this.onStateChange();
  }

  toggleZipper() {
    this.isBagClosed = !this.isBagClosed;
    
    // If zipper is closed, trigger an automated scan!
    if (this.isBagClosed) {
      setTimeout(() => {
        this.runSimulationScan("Reed Switch (Bag Closed)");
      }, 300);
    }

    this.render();
    if (this.onStateChange) this.onStateChange();
  }

  getScannedUids(activeItems) {
    const scannedUids = [];
    activeItems.forEach(item => {
      if (this.itemsInsideBag.has(item.id)) {
        // Check for simulated antenna misread
        if (Math.random() >= this.misreadRate) {
          scannedUids.push(item.rfid_tag_id);
        }
      }
    });
    return scannedUids;
  }

  runSimulationScan(source = "Simulator Scan") {
    if (this.onScanComplete) {
      const activeItems = window.app ? window.app.getActiveItems() : [];
      const scannedUids = this.getScannedUids(activeItems);
      this.onScanComplete(scannedUids, source, this.batteryLevel);
    }
  }

  render() {
    const bagInteriorEl = document.getElementById('bagInterior');
    const itemTrayListEl = document.getElementById('itemTrayList');
    const zipperPullEl = document.getElementById('zipperPull');
    const zipperLabelEl = document.getElementById('zipperLabel');
    const backpackGraphic = document.getElementById('backpackGraphic');

    if (!bagInteriorEl || !itemTrayListEl) return;

    const activeItems = window.app ? window.app.getActiveItems() : [];

    // Render zipper status
    if (zipperLabelEl && zipperPullEl && backpackGraphic) {
      if (this.isBagClosed) {
        zipperLabelEl.innerText = "Zipper: Closed (Reed Switch Triggered)";
        zipperPullEl.innerHTML = "✓";
        backpackGraphic.classList.remove('open');
      } else {
        zipperLabelEl.innerText = "Zipper: Open (Bag Unzipped)";
        zipperPullEl.innerHTML = "✕";
        backpackGraphic.classList.add('open');
      }
    }

    // Render Bag Interior items
    bagInteriorEl.innerHTML = '';
    const insideItems = activeItems.filter(i => this.itemsInsideBag.has(i.id));

    if (insideItems.length === 0) {
      bagInteriorEl.innerHTML = `<div style="grid-column: span 2; text-align:center; color: var(--text-muted); font-size: 0.75rem; padding-top: 2rem;">Bag is empty.<br>Click items on the right to pack them.</div>`;
    } else {
      insideItems.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'bag-item-chip present';
        chip.title = `RFID: ${item.rfid_tag_id} (Click to remove)`;
        chip.innerHTML = `<span>${this.getCategoryIcon(item.category)}</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</span>`;
        chip.addEventListener('click', () => this.toggleItem(item.id));
        bagInteriorEl.appendChild(chip);
      });
    }

    // Render Item Tray (Right of visualizer)
    itemTrayListEl.innerHTML = '';
    activeItems.forEach(item => {
      const isInside = this.itemsInsideBag.has(item.id);
      const row = document.createElement('div');
      row.className = `tray-item ${isInside ? 'in-bag' : ''}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span>${this.getCategoryIcon(item.category)}</span>
          <span style="font-weight:500;">${item.name}</span>
        </div>
        <span style="font-size:0.68rem; color:${isInside ? 'var(--status-success)' : 'var(--text-muted)'};">
          ${isInside ? 'IN BAG' : '+ PACK'}
        </span>
      `;
      row.addEventListener('click', () => this.toggleItem(item.id));
      itemTrayListEl.appendChild(row);
    });
  }

  getCategoryIcon(category) {
    switch ((category || '').toLowerCase()) {
      case 'electronics': return '💻';
      case 'credentials': return '🪪';
      case 'stationery': return '📓';
      case 'personal': return '🔑';
      case 'accessories': return '☂️';
      default: return '📦';
    }
  }
}

window.simulator = new BagSimulator();
