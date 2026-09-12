/**
 * Remembering Bag v2 — User Dashboard Manager
 * Real-time RFID Bag Checking, Zipper Open/Close Email Notifications, Scheduled Packing Reminders, and Sent Email Outbox.
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
    this.reminders = [];
    this.sentEmails = [];
    this.activities = [];
    this.zipperState = 'CLOSED'; // Default state
  }

  init() {
    this.container = document.getElementById('userDashboardView');
  }

  async loadDashboardData() {
    if (!this.container) this.container = document.getElementById('userDashboardView');
    if (!window.authManager || !window.authManager.token) return;
    const token = window.authManager.token;
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    try {
      // 1. Fetch user schedule
      const schRes = await fetch('/api/user/schedule', { headers: authHeaders });
      const schData = await schRes.json();
      if (schData.success) {
        this.schedule = schData.schedule;
        this.isTodayActive = schData.isTodayActive;
      }

      // 2. Fetch user bags
      const bagsRes = await fetch('/api/user/bags', { headers: authHeaders });
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
        const itemsRes = await fetch(`/api/user/items?bagId=${this.currentBag.id}`, { headers: authHeaders });
        const itemsData = await itemsRes.json();
        if (itemsData.success) {
          this.items = itemsData.items;
        }
      }

      // 4. Fetch recent scan history
      const scansRes = await fetch('/api/user/scans', { headers: authHeaders });
      const scansData = await scansRes.json();
      if (scansData.success && scansData.scans.length > 0) {
        this.lastScan = scansData.scans[0];
        if (this.lastScan && this.lastScan.scannedUids) {
          this.scannedUids = new Set(this.lastScan.scannedUids);
        }
      }

      // 5. Fetch Reminders
      const remRes = await fetch('/api/reminders', { headers: authHeaders });
      const remData = await remRes.json();
      if (remData.success) {
        this.reminders = remData.reminders || [];
      }

      // 6. Fetch Sent Email Notifications
      const emailsRes = await fetch('/api/emails', { headers: authHeaders });
      const emailsData = await emailsRes.json();
      if (emailsData.success) {
        this.sentEmails = emailsData.emails || [];
      }

      // 7. Fetch Activity Feed (to sync zipper state from latest bag event)
      const actRes = await fetch('/api/activity?limit=20', { headers: authHeaders });
      const actData = await actRes.json();
      if (actData.success) {
        this.activities = actData.activities || [];
        const latestBagEvent = this.activities.find(a => a.type === 'BAG_OPENED' || a.type === 'BAG_CLOSED');
        if (latestBagEvent) {
          this.zipperState = latestBagEvent.type === 'BAG_OPENED' ? 'OPEN' : 'CLOSED';
        }
      }

      this.render();
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }

  render() {
    if (!this.container) return;
    const user = window.authManager.user || { name: "Murtaza Jamali", email: "murtazajamali07@gmail.com" };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const currentDayName = days[now.getDay()];
    const currentDateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const hour = now.getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17) greeting = "Good evening";

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
                <span>${this.isTodayActive ? `${currentDayName} • Active Schedule` : `${currentDayName} • Non-Active Day`}</span>
              </span>
            </div>
          </div>

          <!-- Bag Switcher Dropdown -->
          <div class="dash-bag-picker-wrap">
            <label class="dash-picker-label">CURRENT BACKPACK</label>
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
                <span>Send Missing Email Alert</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Interactive Bag Zipper & Email Control Banner -->
        <div class="dash-card zipper-email-banner">
          <div class="zipper-banner-left">
            <div class="zipper-state-icon ${this.zipperState === 'OPEN' ? 'state-open' : 'state-closed'}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                ${this.zipperState === 'OPEN'
                  ? '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                  : '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
                }
              </svg>
            </div>
            <div>
              <div class="zipper-title-row">
                <span class="zipper-label">BACKPACK SENSOR STATUS:</span>
                <span class="zipper-pill ${this.zipperState === 'OPEN' ? 'pill-open' : 'pill-closed'}">
                  ${this.zipperState === 'OPEN' ? '⚠️ ZIPPER OPEN' : '🔒 ZIPPER CLOSED & SECURED'}
                </span>
              </div>
              <div class="zipper-sub-text">
                Live email alerts connected to: <strong>${user.email}</strong>
              </div>
            </div>
          </div>
          <div class="zipper-banner-actions">
            <button class="btn-secondary btn-zipper-action" id="btnSimulateBagOpen" title="Simulate opening the backpack (triggers Bag Opened email)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="2.2"><path d="M7 11V7a5 5 0 0 1 9.9-1"/><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/></svg>
              <span>Open Bag (Send Alert)</span>
            </button>
            <button class="btn-secondary btn-zipper-action" id="btnSimulateBagClose" title="Simulate closing and securing the backpack (triggers Bag Closed email)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2.2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Close Bag (Send Confirmation)</span>
            </button>
          </div>
        </div>

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

          <!-- Right Column: Reminders & Hardware Details -->
          <div class="dash-sidebar-col">
            
            <!-- Scheduled Packing Reminders Card -->
            <div class="dash-card reminders-card">
              <div class="dash-card-header" style="margin-bottom: 0.85rem;">
                <div>
                  <span class="card-kicker">AUTOMATIC PACKING ALERTS</span>
                  <h3 class="card-title-sm">Scheduled Reminders</h3>
                </div>
                <button class="btn-secondary" id="btnOpenReminderModal" style="padding: 0.3rem 0.75rem; font-size: 0.78rem;">
                  + Add Reminder
                </button>
              </div>

              <div class="reminders-list">
                ${this.reminders.length === 0 ? `
                  <div class="empty-timeline" style="padding: 1rem 0;">No reminders set. Click '+ Add Reminder' to schedule one.</div>
                ` : this.reminders.map(r => {
                  const item = this.items.find(i => i.id === r.itemId || i.itemId === r.itemId) || { name: 'Item' };
                  const isFired = r.status === 'FIRED';
                  const timeFormatted = new Date(r.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return `
                    <div class="reminder-item-card ${isFired ? 'fired' : 'pending'}">
                      <div class="reminder-info">
                        <div class="reminder-item-title">
                          <strong>${item.name}</strong> • <span class="reminder-time-tag">${timeFormatted}</span>
                        </div>
                        <div class="reminder-msg-text">"${r.message || `Remember to pack ${item.name}`}"</div>
                      </div>
                      <div class="reminder-actions">
                        <button class="btn-send-reminder-now" data-reminder-id="${r.reminderId || r.id}" title="Send this reminder email right now">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                          <span>Send Email</span>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Hardware Card -->
            <div class="dash-card hardware-card">
              <div class="card-kicker">PHYSICAL HARDWARE</div>
              <h3 class="card-title-sm">RC522 RFID Reader & Telemetry</h3>
              <div class="hw-status-indicators" style="margin-top: 0.75rem;">
                <div class="hw-indicator">
                  <span class="hw-dot online"></span>
                  <span>RC522: ONLINE</span>
                </div>
                <div class="hw-indicator">
                  <span class="hw-dot active"></span>
                  <span>Zipper Reed Switch: ACTIVE</span>
                </div>
                <div class="hw-indicator">
                  <span class="hw-dot online"></span>
                  <span>Email Dispatcher: READY</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        <!-- Sent Email Notifications Outbox Section -->
        <div class="dash-card email-outbox-card" style="margin-top: 1.5rem;">
          <div class="dash-card-header">
            <div>
              <span class="card-kicker">TRANSACTIONAL EMAIL OUTBOX</span>
              <h3 class="card-title" style="font-size: 1.25rem;">Sent Email Notifications (${this.sentEmails.length})</h3>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-secondary" id="btnSendTestEmail" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                <span>Send Test Email</span>
              </button>
            </div>
          </div>

          <div class="email-outbox-list">
            ${this.sentEmails.length === 0 ? `
              <div class="empty-timeline">No emails sent yet. Open/close your bag or trigger a reminder to send your first email notification!</div>
            ` : this.sentEmails.slice(0, 10).map(eml => {
              const timeStr = new Date(eml.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = new Date(eml.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
              let badgeColor = 'cyan';
              if (eml.type === 'BAG_OPENED') badgeColor = 'red';
              else if (eml.type === 'BAG_CLOSED') badgeColor = 'green';

              return `
                <div class="email-row-card">
                  <div class="email-row-left">
                    <span class="email-type-tag tag-${badgeColor}">${eml.type || 'ALERT'}</span>
                    <div class="email-subject-line"><strong>${eml.subject}</strong></div>
                    <div class="email-meta-line">To: <span>${eml.to}</span> • ${dateStr} at ${timeStr}</div>
                  </div>
                  <div class="email-row-right">
                    <span class="email-status-pill">✓ Delivered</span>
                    <button class="btn-preview-email" data-email-id="${eml.id}">
                      <span>Preview Email HTML</span>
                      <span>👁️</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>

      <!-- Add Reminder Modal Container -->
      <div id="addReminderModalOverlay" class="auth-modal-overlay" style="display: none;">
        <div class="auth-modal-card" style="max-width: 440px;">
          <button class="auth-modal-close" id="btnCloseReminderModal">✕</button>
          <div style="font-size: 1.25rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.5rem;">
            Schedule Packing Reminder
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            Set an automated email reminder to ensure an essential item is packed.
          </p>

          <form id="formAddReminder">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #A0AEC0; margin-bottom: 0.35rem;">Select Item</label>
              <select id="reminderItemSelect" class="styled-bag-select" style="width: 100%;">
                ${this.items.map(i => `<option value="${i.id}">${i.name} (${i.category})</option>`).join('')}
              </select>
            </div>

            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #A0AEC0; margin-bottom: 0.35rem;">Reminder Time</label>
              <input type="time" id="reminderTimeInput" class="google-auth-input" value="16:30" required style="width: 100%;">
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #A0AEC0; margin-bottom: 0.35rem;">Custom Reminder Note</label>
              <input type="text" id="reminderMessageInput" class="google-auth-input" placeholder="e.g. Bring laptop charger for lab class" style="width: 100%;">
            </div>

            <button type="submit" class="btn-primary" style="width: 100%;">
              <span>Save & Activate Reminder</span>
              <span>→</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Email HTML Preview Modal Container -->
      <div id="emailPreviewModalOverlay" class="auth-modal-overlay" style="display: none;">
        <div class="auth-modal-card" style="max-width: 640px; padding: 1.5rem; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
            <div style="font-size: 1.1rem; font-weight: 700; color: #FFFFFF;" id="previewModalTitle">Delivered Email Preview</div>
            <button class="auth-modal-close" id="btnCloseEmailPreviewModal" style="position: static;">✕</button>
          </div>
          <div id="previewEmailFrameWrap" style="background: #050505; border-radius: 8px; overflow: hidden;">
            <!-- Rendered HTML injected here -->
          </div>
        </div>
      </div>
    `;

    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    const token = window.authManager.token;
    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };

    // 1. Bag selector switch
    const bagSelector = document.getElementById('dashBagSelector');
    if (bagSelector) {
      bagSelector.addEventListener('change', (e) => {
        const bagId = e.target.value;
        this.currentBag = this.bags.find(b => b.id === bagId);
        this.loadDashboardData();
      });
    }

    // 2. Settings shortcut
    const btnSettings = document.getElementById('btnDashSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('settings');
      });
    }

    // 3. Simulate Bag Open Button (Triggers Bag Opened Email)
    const btnBagOpen = document.getElementById('btnSimulateBagOpen');
    if (btnBagOpen) {
      btnBagOpen.addEventListener('click', async () => {
        btnBagOpen.disabled = true;
        try {
          const res = await fetch('/api/bag/event', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              event: 'OPEN',
              hardwareId: 'ESP32-BAG-01',
              timestamp: new Date().toISOString()
            })
          });
          const data = await res.json();
          if (data.success) {
            this.zipperState = 'OPEN';
            if (window.zipperGatewayManager) {
              window.zipperGatewayManager.showEmailToast('OPEN');
            }
            await this.loadDashboardData();
          }
        } catch (e) {
          console.error("Error triggering bag open:", e);
        } finally {
          btnBagOpen.disabled = false;
        }
      });
    }

    // 4. Simulate Bag Close Button (Triggers Bag Closed Email)
    const btnBagClose = document.getElementById('btnSimulateBagClose');
    if (btnBagClose) {
      btnBagClose.addEventListener('click', async () => {
        btnBagClose.disabled = true;
        try {
          const res = await fetch('/api/bag/event', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              event: 'CLOSE',
              hardwareId: 'ESP32-BAG-01',
              timestamp: new Date().toISOString()
            })
          });
          const data = await res.json();
          if (data.success) {
            this.zipperState = 'CLOSED';
            if (window.zipperGatewayManager) {
              window.zipperGatewayManager.showEmailToast('CLOSE');
            }
            await this.loadDashboardData();
          }
        } catch (e) {
          console.error("Error triggering bag close:", e);
        } finally {
          btnBagClose.disabled = false;
        }
      });
    }

    // 5. Send Reminder Email Now buttons
    this.container.querySelectorAll('.btn-send-reminder-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const remId = btn.getAttribute('data-reminder-id');
        btn.disabled = true;
        btn.innerHTML = `<span>Sending...</span>`;
        try {
          const res = await fetch(`/api/reminders/${remId}/trigger`, {
            method: 'POST',
            headers: authHeaders
          });
          const data = await res.json();
          if (data.success) {
            alert(`📧 Reminder Email Dispatched!\n\nSent to ${window.authManager.user.email} for item: ${data.notification.title}`);
            await this.loadDashboardData();
          }
        } catch (e) {
          console.error("Error sending reminder email:", e);
        } finally {
          btn.disabled = false;
        }
      });
    });

    // 6. Open / Close Add Reminder Modal
    const modalRem = document.getElementById('addReminderModalOverlay');
    const btnOpenRem = document.getElementById('btnOpenReminderModal');
    const btnCloseRem = document.getElementById('btnCloseReminderModal');
    if (btnOpenRem && modalRem) {
      btnOpenRem.addEventListener('click', () => modalRem.style.display = 'flex');
    }
    if (btnCloseRem && modalRem) {
      btnCloseRem.addEventListener('click', () => modalRem.style.display = 'none');
    }

    // 7. Add Reminder Form Submit
    const formRem = document.getElementById('formAddReminder');
    if (formRem) {
      formRem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('reminderItemSelect').value;
        const timeVal = document.getElementById('reminderTimeInput').value;
        const msg = document.getElementById('reminderMessageInput').value;

        const [hours, minutes] = timeVal.split(':');
        const due = new Date();
        due.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

        try {
          const res = await fetch('/api/reminders', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              itemId,
              reminderTime: due.toISOString(),
              message: msg
            })
          });
          const data = await res.json();
          if (data.success) {
            modalRem.style.display = 'none';
            await this.loadDashboardData();
          }
        } catch (err) {
          console.error("Error saving reminder:", err);
        }
      });
    }

    // 8. Email HTML Preview Modal
    const modalPreview = document.getElementById('emailPreviewModalOverlay');
    const btnClosePreview = document.getElementById('btnCloseEmailPreviewModal');
    const frameWrap = document.getElementById('previewEmailFrameWrap');
    if (btnClosePreview && modalPreview) {
      btnClosePreview.addEventListener('click', () => modalPreview.style.display = 'none');
    }

    this.container.querySelectorAll('.btn-preview-email').forEach(btn => {
      btn.addEventListener('click', () => {
        const emailId = btn.getAttribute('data-email-id');
        const email = this.sentEmails.find(e => e.id === emailId);
        if (email && modalPreview && frameWrap) {
          document.getElementById('previewModalTitle').innerText = `Preview: ${email.subject}`;
          frameWrap.innerHTML = email.html;
          modalPreview.style.display = 'flex';
        }
      });
    });

    // 9. Send Test Email Button
    const btnSendTest = document.getElementById('btnSendTestEmail');
    if (btnSendTest) {
      btnSendTest.addEventListener('click', async () => {
        const type = prompt("Choose email test type (1 for Bag Opened, 2 for Bag Closed, 3 for Reminder):", "1");
        let eventType = "BAG_OPENED";
        if (type === "2") eventType = "BAG_CLOSED";
        else if (type === "3") eventType = "REMINDER_FIRED";

        try {
          const res = await fetch('/api/emails/test', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ type: eventType })
          });
          const data = await res.json();
          if (data.success) {
            alert(data.message);
            await this.loadDashboardData();
          }
        } catch (e) {
          console.error("Error sending test email:", e);
        }
      });
    }

    // 10. Tap on Reader physical simulator buttons
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

    // 11. Run full bag check button
    const btnCheck = document.getElementById('btnRunBagCheck');
    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        this.executeBagCheck(true);
      });
    }

    // 12. Reset scan button
    const btnReset = document.getElementById('btnResetScan');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.scannedUids.clear();
        this.render();
      });
    }

    // 13. Trigger missing item email alert
    const btnEmail = document.getElementById('btnTriggerEmailAlert');
    if (btnEmail) {
      btnEmail.addEventListener('click', async () => {
        const missingItems = this.items.filter(i => !this.scannedUids.has(i.rfidUid.toUpperCase()));
        const res = await fetch('/api/notifications/send-missing-alert', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            bagName: this.currentBag ? this.currentBag.name : 'My Bag',
            missingItems: missingItems.map(m => m.name)
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Email alert dispatched to ${window.authManager.user.email}!\n\n"${data.notification.subject}"`);
          await this.loadDashboardData();
        }
      });
    }

    // 14. Empty state add item
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
      if (btn) btn.innerHTML = `<span>Scanning RC522 Reader...</span>`;
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
