/**
 * Remembering Bag v2 — User Dashboard Manager
 * Real-time RFID Bag Checking, Missing Item Detection, Active/Inactive Day Status, and Notification Alerts.
 */

class DashboardManager {
  constructor() {
    this.container = null;
    this.currentBag = null;
    this.bags = [];
    this.items = [];
    this.scannedUids = new Set();
    this.schedule = null;
    this.isTodayActive = true;
    this.lastScan = null;
    this.isChecking = false;
  }

  init() {
    this.container = document.getElementById('userDashboardView');
  }

  async loadDashboardData() {
    if (!this.container) this.container = document.getElementById('userDashboardView');
    if (!window.authManager || !window.authManager.token) return;
    const token = window.authManager.token;

    try {
      // 1. Fetch user schedule
      const schRes = await fetch('/api/user/schedule', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const schData = await schRes.json();
      if (schData.success) {
        this.schedule = schData.schedule;
        this.isTodayActive = schData.isTodayActive;
      }

      // 2. Fetch user bags
      const bagsRes = await fetch('/api/user/bags', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bagsData = await bagsRes.json();
      if (bagsData.success && bagsData.bags.length > 0) {
        this.bags = bagsData.bags;
        if (!this.currentBag) {
          this.currentBag = this.bags.find(b => b.isDefault) || this.bags[0];
        } else {
          this.currentBag = this.bags.find(b => b.id === this.currentBag.id) || this.bags[0];
        }
      }

      // 3. Fetch items for current bag
      if (this.currentBag) {
        const itemsRes = await fetch(`/api/user/items?bagId=${this.currentBag.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const itemsData = await itemsRes.json();
        if (itemsData.success) {
          this.items = itemsData.items;
        }
      }

      // 4. Fetch recent scan history
      const scansRes = await fetch('/api/user/scans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const scansData = await scansRes.json();
      if (scansData.success && scansData.scans.length > 0) {
        this.lastScan = scansData.scans[0];
        // Populate detected UIDs from last scan if recent
        if (this.lastScan && this.lastScan.scannedUids) {
          this.scannedUids = new Set(this.lastScan.scannedUids);
        }
      }

      this.render();
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }

  render() {
    if (!this.container) return;
    const user = window.authManager.user || { name: "Alex Rivera", email: "alex@example.com" };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const currentDayName = days[now.getDay()];
    const currentDateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Time-based greeting
    const hour = now.getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17) greeting = "Good evening";

    // Compute detected vs missing
    const presentItems = this.items.filter(i => this.scannedUids.has(i.rfidUid.toUpperCase()));
    const missingItems = this.items.filter(i => !this.scannedUids.has(i.rfidUid.toUpperCase()));
    const pct = this.items.length > 0 ? Math.round((presentItems.length / this.items.length) * 100) : 100;

    this.container.innerHTML = `
      <div class="dashboard-page-container">
        
        <!-- Top Bar: Greeting, Date, Active Day Indicator -->
        <div class="dashboard-top-bar">
          <div class="dash-welcome">
            <h1 class="dash-greeting-text">${greeting}, ${user.name.split(' ')[0]} 👋</h1>
            <div class="dash-date-row">
              <span class="dash-date-text">${currentDayName}, ${currentDateStr}</span>
              <span class="dash-status-badge ${this.isTodayActive ? 'active-day' : 'inactive-day'}">
                <span class="badge-dot"></span>
                <span>${this.isTodayActive ? `${currentDayName} • Active Day` : `${currentDayName} • Non-Active Day (Reminders Paused)`}</span>
              </span>
            </div>
          </div>

          <!-- Bag Switcher Dropdown -->
          <div class="dash-bag-picker-wrap">
            <label class="dash-picker-label">CURRENT BAG</label>
            <div class="dash-bag-select-box">
              <select id="dashBagSelector" class="styled-bag-select">
                ${this.bags.map(b => `
                  <option value="${b.id}" ${this.currentBag && b.id === this.currentBag.id ? 'selected' : ''}>
                    🎒 ${b.name} (${b.itemsCount || 0} items)
                  </option>
                `).join('')}
              </select>
              <button class="btn-icon-settings" id="btnDashSettings" title="Bag & Schedule Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Missing Item Alert Banner (if any items missing on active day) -->
        ${missingItems.length > 0 && this.isTodayActive ? `
          <div class="dash-alert-banner fade-in">
            <div class="alert-icon-pulse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--status-red)" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="alert-content-box">
              <div class="alert-title">You might be forgetting something!</div>
              <div class="alert-message">
                Your bag appears to be missing: <strong>${missingItems.map(m => m.name).join(', ')}</strong>. Make sure you have ${missingItems.length > 1 ? 'them' : 'it'} before leaving.
              </div>
            </div>
            <div class="alert-actions">
              <button class="btn-email-preview" id="btnTriggerEmailAlert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span>Send Email Alert</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Main Dashboard 2-Column Grid -->
        <div class="dashboard-main-grid">
          
          <!-- Left Column: Bag Status & Item Checklist -->
          <div class="dash-card bag-status-card">
            <div class="dash-card-header">
              <div class="card-header-left">
                <span class="card-kicker">LIVE INVENTORY CHECK</span>
                <h2 class="card-title">${this.currentBag ? this.currentBag.name : "My Bag"}</h2>
              </div>
              <div class="card-header-right">
                <span class="count-pill ${missingItems.length === 0 ? 'perfect' : 'warning'}">
                  ${presentItems.length} / ${this.items.length} Items Detected (${pct}%)
                </span>
              </div>
            </div>

            <!-- Visual Progress Meter -->
            <div class="dash-progress-meter">
              <div class="meter-fill ${missingItems.length === 0 ? 'perfect' : ''}" style="width: ${pct}%"></div>
            </div>

            <!-- Items Checklist Table -->
            <div class="dash-items-checklist">
              ${this.items.length === 0 ? `
                <div class="empty-items-placeholder">
                  <p>No belongings registered in this bag yet.</p>
                  <button class="btn-secondary" id="btnAddFirstItem">+ Add Item</button>
                </div>
              ` : this.items.map(item => {
                const isDetected = this.scannedUids.has(item.rfidUid.toUpperCase());
                return `
                  <div class="dash-item-row ${isDetected ? 'detected' : 'missing'}" data-uid="${item.rfidUid}">
                    <div class="item-left-info">
                      <span class="item-state-dot ${isDetected ? 'detected' : 'missing'}"></span>
                      <span class="item-name-text">${item.name}</span>
                      <span class="item-uid-tag">${item.rfidUid}</span>
                    </div>
                    <div class="item-right-actions">
                      <button class="btn-tap-reader ${isDetected ? 'packed' : ''}" data-uid="${item.rfidUid}" title="Simulate physically bringing item near RC522 reader">
                        ${isDetected ? '✓ Packed' : '+ Tap on Reader'}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Daily Bag Check Trigger Bar -->
            <div class="dash-check-controls">
              <button class="btn-primary" id="btnRunBagCheck" ${this.isChecking ? 'disabled' : ''}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 14a7 7 0 0 1 10 0"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>
                <span>${this.isChecking ? 'Scanning RC522 Reader...' : 'Check Bag Now'}</span>
              </button>
              <button class="btn-secondary" id="btnResetScan">
                <span>Reset Status</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Hardware & Activity Log -->
          <div class="dash-sidebar-col">
            
            <!-- Hardware Interface Card -->
            <div class="dash-card hardware-card">
              <div class="card-kicker">PHYSICAL HARDWARE</div>
              <h3 class="card-title-sm">RC522 RFID Interrogator</h3>
              <p class="hw-card-desc">Short-range high-frequency 13.56 MHz RFID reader. Bring items directly to the bag's scanner antenna.</p>
              
              <div class="hw-status-indicators">
                <div class="hw-indicator">
                  <span class="hw-dot online"></span>
                  <span>MFRC522: ONLINE</span>
                </div>
                <div class="hw-indicator">
                  <span class="hw-dot active"></span>
                  <span>Antenna: 13.56 MHz</span>
                </div>
                <div class="hw-indicator">
                  <span class="hw-dot ${this.isTodayActive ? 'online' : 'paused'}"></span>
                  <span>Schedule: ${this.isTodayActive ? 'ACTIVE' : 'SILENT'}</span>
                </div>
              </div>
            </div>

            <!-- Recent Activity Log Card -->
            <div class="dash-card activity-card">
              <div class="card-kicker">SCAN HISTORY</div>
              <h3 class="card-title-sm">Recent Activity Log</h3>
              
              <div class="activity-timeline" id="dashActivityTimeline">
                ${this.lastScan ? `
                  <div class="activity-entry">
                    <div class="activity-entry-header">
                      <span class="act-source">${this.lastScan.source}</span>
                      <span class="act-time">${new Date(this.lastScan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="act-result ${this.lastScan.isAllPresent ? 'success' : 'alert'}">
                      ${this.lastScan.presentCount} / ${this.lastScan.totalExpected} items verified • ${this.lastScan.isAllPresent ? '100% Complete' : `${this.lastScan.missingItems.length} missing`}
                    </div>
                  </div>
                ` : `
                  <div class="empty-timeline">No recent scans recorded. Run your first bag check!</div>
                `}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;

    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    // Bag selector switch
    const bagSelector = document.getElementById('dashBagSelector');
    if (bagSelector) {
      bagSelector.addEventListener('change', (e) => {
        const bagId = e.target.value;
        this.currentBag = this.bags.find(b => b.id === bagId);
        this.loadDashboardData();
      });
    }

    // Settings shortcut
    const btnSettings = document.getElementById('btnDashSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('settings');
      });
    }

    // Tap on Reader physical simulator buttons
    this.container.querySelectorAll('.btn-tap-reader').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.getAttribute('data-uid');
        if (this.scannedUids.has(uid.toUpperCase())) {
          this.scannedUids.delete(uid.toUpperCase());
        } else {
          this.scannedUids.add(uid.toUpperCase());
        }
        this.executeBagCheck(false);
      });
    });

    // Run full bag check button
    const btnCheck = document.getElementById('btnRunBagCheck');
    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        this.executeBagCheck(true);
      });
    }

    // Reset scan button
    const btnReset = document.getElementById('btnResetScan');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.scannedUids.clear();
        this.render();
      });
    }

    // Trigger email alert
    const btnEmail = document.getElementById('btnTriggerEmailAlert');
    if (btnEmail) {
      btnEmail.addEventListener('click', async () => {
        const token = window.authManager.token;
        const missingItems = this.items.filter(i => !this.scannedUids.has(i.rfidUid.toUpperCase()));
        const res = await fetch('/api/notifications/send-missing-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            bagName: this.currentBag ? this.currentBag.name : 'My Bag',
            missingItems: missingItems.map(m => m.name)
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Email alert dispatched to ${window.authManager.user.email}!\n\n"${data.notification.subject}"`);
        }
      });
    }

    // Empty state add item
    const btnAddFirst = document.getElementById('btnAddFirstItem');
    if (btnAddFirst) {
      btnAddFirst.addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('settings');
      });
    }
  }

  async executeBagCheck(simulateFullSweep = false) {
    if (!window.authManager || !window.authManager.token) return;
    this.isChecking = true;

    if (simulateFullSweep) {
      const btn = document.getElementById('btnRunBagCheck');
      if (btn) btn.innerHTML = `<span>Interrogating RC522...</span>`;
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const res = await fetch('/api/bag/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.authManager.token}`
        },
        body: JSON.stringify({
          bagId: this.currentBag ? this.currentBag.id : null,
          scannedUids: Array.from(this.scannedUids),
          source: "RC522 Proximity Reader",
          forceActiveOverride: false
        })
      });

      const data = await res.json();
      if (data.success) {
        this.lastScan = data.scan;
        this.isTodayActive = data.isTodayActive;
      }
    } catch (err) {
      console.error("Bag check execution error:", err);
    } finally {
      this.isChecking = false;
      this.render();
    }
  }
}

window.dashboardManager = new DashboardManager();
