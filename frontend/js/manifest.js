/**
 * Smart Remembering Bag — Cargo Manifest Controller, Interactive Zipper Gateway & Hero Backpack Choreographer
 */

class ZipperGatewayManager {
  constructor(onUnzipCallback) {
    this.gateway = document.getElementById('zipperGateway');
    this.slider = document.getElementById('zipperSlider');
    this.pullTab = document.getElementById('pullTabHandle');
    this.tooltip = document.getElementById('zipperTooltip');
    this.btnRezip = document.getElementById('btnRezipBag');
    this.onUnzipCallback = onUnzipCallback;
    this.isUnzipped = false;
    this.isDragging = false;
    this.startY = 0;
  }

  init() {
    if (!this.gateway) return;

    // Check for reduced motion preference - auto open without block
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.unzip(false);
      return;
    }

    // Click on pull tab or slider or tooltip triggers instant opening
    const triggerElements = [this.slider, this.pullTab, this.tooltip];
    triggerElements.forEach(el => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.unzip(true);
        });
      }
    });

    // Touch and Drag down support
    if (this.slider) {
      this.slider.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.startY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging || this.isUnzipped) return;
        const deltaY = e.clientY - this.startY;
        if (deltaY > 60) {
          this.isDragging = false;
          this.unzip(true);
        }
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      // Touch events for mobile
      this.slider.addEventListener('touchstart', (e) => {
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!this.isDragging || this.isUnzipped) return;
        const deltaY = e.touches[0].clientY - this.startY;
        if (deltaY > 60) {
          this.isDragging = false;
          this.unzip(true);
        }
      }, { passive: true });

      window.addEventListener('touchend', () => {
        this.isDragging = false;
      });
    }

    // Re-zip button in header
    if (this.btnRezip) {
      this.btnRezip.addEventListener('click', () => {
        this.rezip();
      });
    }
  }

  unzip() {
    if (this.isUnzipped) return;
    this.isUnzipped = true;

    if (this.gateway) {
      this.gateway.classList.add('unzipped');
    }

    if (this.onUnzipCallback) {
      this.onUnzipCallback();
    }
  }

  rezip() {
    this.isUnzipped = false;
    if (this.gateway) {
      this.gateway.classList.remove('unzipped');
    }
  }
}

class HeroBackpackChoreographer {
  constructor() {
    this.actorWrapper = document.getElementById('backpackActorWrapper');
    this.storyBanner = document.getElementById('heroStoryBanner');
    this.storyIndicator = document.getElementById('storyIndicator');
    this.storyText = document.getElementById('storyText');
    this.worryBadge = document.getElementById('worryBadge');
    this.chips = [
      document.getElementById('chipLaptop'),
      document.getElementById('chipCharger'),
      document.getElementById('chipKeys'),
      document.getElementById('chipIdCard')
    ];
    this.isRunning = false;
    this.hasLaunched = false;
  }

  init() {
    if (!this.actorWrapper) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.setResolvedStatic();
      return;
    }
  }

  startEntranceAfterUnzip() {
    if (!this.actorWrapper) return;
    this.hasLaunched = true;

    // Reset entrance class and styles
    this.actorWrapper.classList.remove('floating');
    this.actorWrapper.style.animation = 'none';
    void this.actorWrapper.offsetWidth; // trigger reflow
    this.actorWrapper.style.animation = 'bag-entrance 1.3s cubic-bezier(0.21, 0.9, 0.3, 1.15) forwards';

    setTimeout(() => {
      // Clear inline animation style so .floating class can animate perpetually!
      this.actorWrapper.style.animation = '';
      this.actorWrapper.classList.add('floating');
      this.startStoryLoop();
    }, 1300);
  }

  setResolvedStatic() {
    if (this.storyBanner) {
      this.storyBanner.className = 'hero-story-banner resolved';
    }
    if (this.storyIndicator) {
      this.storyIndicator.innerText = '✓';
    }
    if (this.storyText) {
      this.storyText.innerText = 'Not anymore.';
    }
    if (this.worryBadge) {
      this.worryBadge.classList.add('hidden');
    }
    this.chips.forEach(chip => {
      if (chip) chip.classList.add('landed');
    });
  }

  async startStoryLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.isRunning) {
      // 1. WORRY BEAT
      if (this.storyBanner) this.storyBanner.className = 'hero-story-banner worry';
      if (this.storyIndicator) this.storyIndicator.innerText = '?';
      if (this.storyText) this.storyText.innerText = 'Still forgetting something?';
      if (this.worryBadge) this.worryBadge.classList.remove('hidden');
      
      // Hide chips
      this.chips.forEach(chip => {
        if (chip) chip.classList.remove('landed');
      });

      await this.sleep(1200);

      // 2. ITEMS POP IN SEQUENTIALLY
      for (let i = 0; i < this.chips.length; i++) {
        const chip = this.chips[i];
        if (chip) {
          chip.classList.add('landed');
        }
        await this.sleep(550);
      }

      await this.sleep(400);

      // 3. RESOLVED STATE
      if (this.worryBadge) this.worryBadge.classList.add('hidden');
      if (this.storyBanner) this.storyBanner.className = 'hero-story-banner resolved';
      if (this.storyIndicator) this.storyIndicator.innerText = '✓';
      if (this.storyText) this.storyText.innerText = 'Not anymore.';

      // Hold resolved state for ~3.5 seconds
      await this.sleep(3600);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ManifestController {
  constructor() {
    this.activeListId = "list-college";
    this.items = [];
    this.simulatedMissingSet = new Set(["04A23B9F"]); // Default omit Student ID for demonstration
    this.isScanning = false;
    this.heroChoreographer = new HeroBackpackChoreographer();
    this.zipperGateway = new ZipperGatewayManager(() => {
      this.heroChoreographer.startEntranceAfterUnzip();
      setTimeout(() => {
        this.runSequentialInspection();
      }, 1800);
    });
  }

  async init() {
    this.zipperGateway.init();
    this.heroChoreographer.init();
    this.setupEventListeners();
    await this.loadItems();
    this.renderCards();
  }

  setupEventListeners() {
    // List selector dropdown
    const listSelect = document.getElementById('manifestListSelect');
    if (listSelect) {
      listSelect.addEventListener('change', async (e) => {
        this.activeListId = e.target.value;
        this.simulatedMissingSet.clear();
        await this.loadItems();
        this.renderCards();
        this.runSequentialInspection();
      });
    }

    // Web BLE Connect
    const btnBle = document.getElementById('btnBleConnect');
    if (btnBle) {
      btnBle.addEventListener('click', async () => {
        if (window.bleManager.isConnected) {
          await window.bleManager.disconnect();
          btnBle.innerText = "⚡ HARDWARE LINK";
          document.getElementById('beaconDot').className = "beacon-dot sim";
          document.getElementById('beaconText').innerText = "TELEMETRY: SIMULATION READY";
        } else {
          const success = await window.bleManager.connect();
          if (success) {
            btnBle.innerText = "✓ ESP32 CONNECTED";
            document.getElementById('beaconDot').className = "beacon-dot";
            document.getElementById('beaconText').innerText = "TELEMETRY: LIVE BLE STREAM";
          }
        }
      });
    }

    // BLE scan data callback
    if (window.bleManager) {
      window.bleManager.onScanDataCallback = (payload) => {
        const detectedTags = new Set(payload.tags || []);
        // Determine which items are missing based on real hardware scan
        this.simulatedMissingSet.clear();
        this.items.forEach(item => {
          if (!detectedTags.has(item.rfid_tag_id)) {
            this.simulatedMissingSet.add(item.rfid_tag_id);
          }
        });
        this.runSequentialInspection();
      };
    }

    // Trigger Scan button
    const btnTrigger = document.getElementById('btnTriggerScan');
    const btnExecute = document.getElementById('btnExecuteStampScan');
    if (btnTrigger) btnTrigger.addEventListener('click', () => this.runSequentialInspection());
    if (btnExecute) btnExecute.addEventListener('click', () => this.runSequentialInspection());

    // Preset buttons
    const btnAll = document.getElementById('btnSimulateComplete');
    if (btnAll) {
      btnAll.addEventListener('click', () => {
        this.simulatedMissingSet.clear();
        this.runSequentialInspection();
      });
    }

    const btnMissing = document.getElementById('btnSimulateMissing');
    if (btnMissing) {
      btnMissing.addEventListener('click', () => {
        this.simulatedMissingSet.clear();
        // Omit second item (Student ID or Work Badge)
        if (this.items.length > 1) {
          this.simulatedMissingSet.add(this.items[1].rfid_tag_id);
        }
        this.runSequentialInspection();
      });
    }
  }

  async loadItems() {
    try {
      const res = await fetch(`/api/items?list_id=${this.activeListId}`);
      const data = await res.json();
      if (data.success) {
        this.items = data.items;
      }
    } catch (e) {
      console.warn("Backend API offline, using fallback items:", e);
      this.items = [
        { id: "1", name: "Laptop & Charger", category: "Electronics", rfid_tag_id: "E2801160", importance: "critical" },
        { id: "2", name: "Student ID Card", category: "Credentials", rfid_tag_id: "04A23B9F", importance: "critical" },
        { id: "3", name: "Notebook & Pen Case", category: "Stationery", rfid_tag_id: "A1B2C3D4", importance: "medium" },
        { id: "4", name: "Scientific Calculator", category: "Electronics", rfid_tag_id: "7F3E2A10", importance: "medium" },
        { id: "5", name: "Insulated Water Bottle", category: "Personal", rfid_tag_id: "5D88C94B", importance: "low" },
        { id: "6", name: "House & Locker Keys", category: "Personal", rfid_tag_id: "C390E41A", importance: "critical" },
        { id: "7", name: "Compact Umbrella", category: "Accessories", rfid_tag_id: "99AA88BB", importance: "low" }
      ];
    }
  }

  renderCards() {
    const grid = document.getElementById('manifestGrid');
    if (!grid) return;

    grid.innerHTML = '';
    this.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'manifest-item-card';
      card.id = `card-${item.id}`;

      card.innerHTML = `
        <div class="stamp-badge" id="stamp-${item.id}">PENDING</div>
        <div class="item-card-category">${item.category} // SEC. 3</div>
        <h3 class="item-card-name">${item.name}</h3>
        <div class="item-card-footer">
          <span class="item-uid-tag">TAG: ${item.rfid_tag_id}</span>
          <span>${item.importance === 'critical' ? '★ CRITICAL' : 'STANDARD'}</span>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  /**
   * Sequential Ink-Stamping Inspection Cycle
   */
  async runSequentialInspection() {
    if (this.isScanning) return;
    this.isScanning = true;

    // Reset existing stamps
    this.items.forEach(item => {
      const stamp = document.getElementById(`stamp-${item.id}`);
      if (stamp) {
        stamp.className = 'stamp-badge';
        stamp.innerText = 'PENDING';
      }
    });

    const banner = document.getElementById('manifestAlertBanner');
    const bannerStamp = document.getElementById('alertStampBadge');
    const bannerTitle = document.getElementById('alertBannerTitle');
    const bannerSub = document.getElementById('alertBannerSub');

    if (banner) {
      banner.className = 'manifest-alert-banner';
      bannerStamp.className = 'alert-stamp-icon';
      bannerStamp.innerText = 'CHECKING...';
      bannerTitle.innerText = 'SCANNING YOUR BACKPACK...';
      bannerSub.innerText = 'Checking each item against your packing list.';
    }

    let missingCount = 0;
    const missingNames = [];

    // Loop through cards sequentially with tactile mechanical rhythm
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isMissing = this.simulatedMissingSet.has(item.rfid_tag_id);
      
      if (isMissing) {
        missingCount++;
        missingNames.push(item.name);
      }

      await new Promise(resolve => setTimeout(resolve, 280));

      const stamp = document.getElementById(`stamp-${item.id}`);
      if (stamp) {
        // Random organic rotation between -12 and +10 degrees
        const randomAngle = (Math.random() * 22 - 11).toFixed(1) + 'deg';
        stamp.style.setProperty('--stamp-angle', randomAngle);

        stamp.innerText = isMissing ? 'MISSING' : 'PRESENT';
        stamp.className = `stamp-badge stamped ${isMissing ? 'missing' : 'present'}`;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 350));

    // Conclude with banner verdict
    if (banner) {
      if (missingCount > 0) {
        banner.className = 'manifest-alert-banner missing';
        bannerStamp.className = 'alert-stamp-icon red';
        bannerStamp.innerText = 'MISSING';
        bannerTitle.innerText = `⚠️ FORGOTTEN ITEM DETECTED: ${missingCount} ITEM(S) MISSING`;
        bannerSub.innerText = `You forgot: ${missingNames.join(', ')}. Please pack it before leaving!`;
      } else {
        banner.className = 'manifest-alert-banner cleared';
        bannerStamp.className = 'alert-stamp-icon green';
        bannerStamp.innerText = 'ALL SET';
        bannerTitle.innerText = '✓ ALL ESSENTIALS PACKED';
        bannerSub.innerText = `Your bag has everything on your checklist. You're ready to go!`;
      }
    }

    // Log scan to backend
    try {
      const scannedUids = this.items
        .filter(item => !this.simulatedMissingSet.has(item.rfid_tag_id))
        .map(i => i.rfid_tag_id);

      await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: this.activeListId,
          scanned_uids: scannedUids,
          source: 'Manifest Cargo Audit',
          battery_level: 94
        })
      });
    } catch (e) {
      // Ignore background sync errors
    }

    this.isScanning = false;
  }
}

window.manifestApp = new ManifestController();
document.addEventListener('DOMContentLoaded', () => {
  window.manifestApp.init();
});
