/**
 * Remembering Bag v2 — Settings Manager
 * Profile, Schedule, Bag/Item CRUD & RFID reassignment, and Notification preferences.
 */

class SettingsManager {
  constructor() {
    this.container = null;
    this.activeTab = 'profile'; // 'profile' | 'schedule' | 'bags' | 'notifications'
    this.schedule = null;
    this.bags = [];
    this.items = [];
    this.notificationSettings = null;
  }

  async loadSettingsData() {
    if (!this.container) this.container = document.getElementById('userSettingsView');
    if (!window.authManager || !window.authManager.token) return;
    const token = window.authManager.token;

    try {
      const [schRes, bagsRes, itemsRes, notifRes] = await Promise.all([
        fetch('/api/user/schedule', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/user/bags', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/user/items', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/user/notifications/settings', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [schData, bagsData, itemsData, notifData] = await Promise.all([
        schRes.json(),
        bagsRes.json(),
        itemsRes.json(),
        notifRes.json()
      ]);

      if (schData.success) this.schedule = schData.schedule;
      if (bagsData.success) this.bags = bagsData.bags;
      if (itemsData.success) this.items = itemsData.items;
      if (notifData.success) this.notificationSettings = notifData.settings;

      this.render();
    } catch (err) {
      console.error("Failed to load settings data:", err);
    }
  }

  render() {
    if (!this.container) return;
    const user = window.authManager.user || { name: "Alex Rivera", email: "alex@example.com", userType: "student" };

    this.container.innerHTML = `
      <div class="settings-page-container">
        
        <!-- Header -->
        <div class="settings-header">
          <div class="settings-header-left">
            <button class="btn-back-dashboard" id="btnSettingsBackDash">
              ← Back to Dashboard
            </button>
            <h1 class="settings-title">Bag & Account Settings</h1>
            <p class="settings-subtitle">Manage your profile, active days schedule, RFID bags and email alert preferences.</p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="settings-tabs-bar">
          <button class="settings-tab-btn ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
            <span>Profile</span>
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'schedule' ? 'active' : ''}" data-tab="schedule">
            <span>Active Schedule</span>
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'bags' ? 'active' : ''}" data-tab="bags">
            <span>Bags & RFID Items</span>
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
            <span>Notifications</span>
          </button>
        </div>

        <!-- Tab Content Views -->
        <div class="settings-content-card">
          ${this.renderActiveTabContent(user)}
        </div>

      </div>
    `;

    this.bindSettingsEvents(user);
  }

  renderActiveTabContent(user) {
    if (this.activeTab === 'profile') {
      return `
        <div class="settings-tab-view fade-in">
          <h2 class="tab-view-title">Profile Information</h2>
          <p class="tab-view-desc">Your verified account credentials and primary daily routine.</p>

          <form id="formUserProfile" class="styled-form-grid">
            <div class="form-group">
              <label class="input-label">Full Name</label>
              <input type="text" id="setUserName" class="styled-text-input" value="${user.name}">
            </div>

            <div class="form-group">
              <label class="input-label">Email Address (Google Verified)</label>
              <input type="email" class="styled-text-input" value="${user.email}" disabled>
              <span class="input-hint">Google authenticated accounts cannot change verified primary email.</span>
            </div>

            <div class="form-group">
              <label class="input-label">User Type Routine</label>
              <select id="setUserType" class="styled-bag-select">
                <option value="employee" ${user.userType === 'employee' ? 'selected' : ''}>Employee (Corporate / Office)</option>
                <option value="student" ${user.userType === 'student' ? 'selected' : ''}>Student (College / School)</option>
                <option value="worker" ${user.userType === 'worker' ? 'selected' : ''}>Worker (Field / Operations)</option>
                <option value="other" ${user.userType === 'other' ? 'selected' : ''}>Others (Custom / Travel)</option>
              </select>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      `;
    }

    if (this.activeTab === 'schedule') {
      const activeDays = (this.schedule && this.schedule.activeDays) || ['mon', 'tue', 'wed', 'thu', 'fri'];
      const startTime = (this.schedule && this.schedule.startTime) || '08:30';
      const endTime = (this.schedule && this.schedule.endTime) || '17:30';

      const dayLabels = [
        { code: 'mon', label: 'Mon' },
        { code: 'tue', label: 'Tue' },
        { code: 'wed', label: 'Wed' },
        { code: 'thu', label: 'Thu' },
        { code: 'fri', label: 'Fri' },
        { code: 'sat', label: 'Sat' },
        { code: 'sun', label: 'Sun' }
      ];

      return `
        <div class="settings-tab-view fade-in">
          <h2 class="tab-view-title">Active Schedule Settings</h2>
          <p class="tab-view-desc">Select which days of the week Remembering Bag should run packing checks.</p>

          <form id="formUserSchedule" class="styled-form-grid">
            <div class="form-group">
              <label class="input-label">Active Days</label>
              <div class="days-pills-row" id="setDaysPicker">
                ${dayLabels.map(d => `
                  <button type="button" class="day-pill ${activeDays.includes(d.code) ? 'selected' : ''}" data-day="${d.code}">
                    <span class="day-check">${activeDays.includes(d.code) ? '✓' : ''}</span>
                    <span>${d.label}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="time-range-row">
              <div class="time-input-group">
                <label class="input-label">Start Time</label>
                <input type="time" id="setStartTime" class="styled-time-input" value="${startTime}">
              </div>
              <div class="time-input-group">
                <label class="input-label">End Time</label>
                <input type="time" id="setEndTime" class="styled-time-input" value="${endTime}">
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>Save Schedule</span>
              </button>
            </div>
          </form>
        </div>
      `;
    }

    if (this.activeTab === 'bags') {
      return `
        <div class="settings-tab-view fade-in">
          <div class="tab-view-header-row">
            <div>
              <h2 class="tab-view-title">Bags & Belongings</h2>
              <p class="tab-view-desc">Manage registered RFID items and your smart backpacks.</p>
            </div>
            <button class="btn-primary" id="btnAddNewBagModal">+ Create New Bag</button>
          </div>

          <div class="bags-management-list">
            ${this.bags.map(bag => {
              const bagItems = this.items.filter(i => i.bagId === bag.id);
              return `
                <div class="bag-accordion-card" data-bag-id="${bag.id}">
                  <div class="bag-card-top">
                    <div class="bag-name-zone">
                      <span class="bag-icon-symbol">🎒</span>
                      <strong class="bag-title-text">${bag.name}</strong>
                      <span class="bag-items-badge">${bagItems.length} RFID Items</span>
                    </div>
                    <div class="bag-card-actions">
                      <button class="btn-secondary btn-sm btn-add-item-modal" data-bag-id="${bag.id}">+ Add Item</button>
                      <button class="btn-secondary btn-sm btn-delete-bag text-danger" data-bag-id="${bag.id}">Delete Bag</button>
                    </div>
                  </div>

                  <!-- Items Table Inside Bag -->
                  <div class="bag-items-table">
                    ${bagItems.length === 0 ? `
                      <p class="no-items-text">No belongings registered yet. Click "+ Add Item" to pair an RFID tag.</p>
                    ` : `
                      <div class="items-table-header">
                        <span>Belonging Name</span>
                        <span>Category</span>
                        <span>RFID UID</span>
                        <span>Actions</span>
                      </div>
                      ${bagItems.map(item => `
                        <div class="item-table-row" data-item-id="${item.id}">
                          <div class="item-name-cell">
                            <strong>${item.name}</strong>
                          </div>
                          <div class="item-cat-cell">${item.category || 'General'}</div>
                          <div class="item-uid-cell">
                            <span class="uid-tag-pill">${item.rfidUid}</span>
                          </div>
                          <div class="item-actions-cell">
                            <button class="btn-text-action btn-reassign-uid" data-item-id="${item.id}" data-uid="${item.rfidUid}">Reassign UID</button>
                            <button class="btn-text-action text-danger btn-delete-item" data-item-id="${item.id}">Remove</button>
                          </div>
                        </div>
                      `).join('')}
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'notifications') {
      const emailEnabled = this.notificationSettings ? this.notificationSettings.emailEnabled : true;
      const notifyOnMissing = this.notificationSettings ? this.notificationSettings.notifyOnMissing : true;

      return `
        <div class="settings-tab-view fade-in">
          <h2 class="tab-view-title">Notification Channels</h2>
          <p class="tab-view-desc">Configure automated alerts when items are missing on active days.</p>

          <form id="formUserNotifications" class="styled-form-grid">
            <div class="toggle-setting-row">
              <div class="toggle-info">
                <strong class="toggle-title">Email Notifications</strong>
                <p class="toggle-desc">Send alert email to <strong>${user.email}</strong> before departure if items are missing.</p>
              </div>
              <label class="switch">
                <input type="checkbox" id="chkEmailEnabled" ${emailEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="toggle-setting-row">
              <div class="toggle-info">
                <strong class="toggle-title">Active Day Only Filter</strong>
                <p class="toggle-desc">Suppress notifications on non-working or inactive days.</p>
              </div>
              <label class="switch">
                <input type="checkbox" id="chkActiveOnly" ${notifyOnMissing ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>Save Notification Preferences</span>
              </button>
            </div>
          </form>
        </div>
      `;
    }
  }

  bindSettingsEvents(user) {
    // Back to Dashboard
    const btnBack = document.getElementById('btnSettingsBackDash');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('dashboard');
      });
    }

    // Tab Switching
    this.container.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    const token = window.authManager.token;

    // Profile Form
    const formProfile = document.getElementById('formUserProfile');
    if (formProfile) {
      formProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setUserName').value;
        const userType = document.getElementById('setUserType').value;
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name, userType })
        });
        const data = await res.json();
        if (data.success) {
          window.authManager.user = data.user;
          alert("Profile updated successfully!");
        }
      });
    }

    // Schedule Form
    const formSchedule = document.getElementById('formUserSchedule');
    if (formSchedule) {
      const dayPills = formSchedule.querySelectorAll('.day-pill');
      dayPills.forEach(pill => {
        pill.addEventListener('click', () => {
          pill.classList.toggle('selected');
          pill.querySelector('.day-check').innerText = pill.classList.contains('selected') ? '✓' : '';
        });
      });

      formSchedule.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedDays = Array.from(formSchedule.querySelectorAll('.day-pill.selected')).map(p => p.getAttribute('data-day'));
        const startTime = document.getElementById('setStartTime').value;
        const endTime = document.getElementById('setEndTime').value;

        const res = await fetch('/api/user/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ activeDays: selectedDays, startTime, endTime })
        });
        const data = await res.json();
        if (data.success) {
          this.schedule = data.schedule;
          alert("Schedule updated successfully!");
        }
      });
    }

    // Create New Bag
    const btnNewBag = document.getElementById('btnAddNewBagModal');
    if (btnNewBag) {
      btnNewBag.addEventListener('click', async () => {
        const bagName = prompt("Enter a name for your new bag (e.g. 'Gym Duffel' or 'Camera Bag'):");
        if (!bagName || !bagName.trim()) return;

        const res = await fetch('/api/user/bags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name: bagName.trim() })
        });
        const data = await res.json();
        if (data.success) {
          await this.loadSettingsData();
        }
      });
    }

    // Delete Bag
    this.container.querySelectorAll('.btn-delete-bag').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bagId = btn.getAttribute('data-bag-id');
        if (!confirm("Are you sure you want to delete this bag and all its registered items?")) return;

        await fetch(`/api/user/bags/${bagId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await this.loadSettingsData();
      });
    });

    // Add Item to Bag
    this.container.querySelectorAll('.btn-add-item-modal').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bagId = btn.getAttribute('data-bag-id');
        const itemName = prompt("Enter item name (e.g. 'Laptop', 'Keys', 'Charger'):");
        if (!itemName || !itemName.trim()) return;

        const randomUid = Math.random().toString(16).substring(2, 10).toUpperCase();
        const rfidUid = prompt("Enter RFID UID (or click OK to generate tag):", randomUid);

        await fetch('/api/user/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            bagId,
            name: itemName.trim(),
            rfidUid: rfidUid || randomUid
          })
        });
        await this.loadSettingsData();
      });
    });

    // Delete Item
    this.container.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-item-id');
        if (!confirm("Remove this item from bag?")) return;

        await fetch(`/api/user/items/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await this.loadSettingsData();
      });
    });

    // Reassign UID
    this.container.querySelectorAll('.btn-reassign-uid').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-item-id');
        const currentUid = btn.getAttribute('data-uid');
        const newUid = prompt("Bring tag near RC522 or enter new RFID UID:", currentUid);
        if (!newUid || newUid === currentUid) return;

        await fetch(`/api/user/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ rfidUid: newUid })
        });
        await this.loadSettingsData();
      });
    });

    // Notifications Form
    const formNotif = document.getElementById('formUserNotifications');
    if (formNotif) {
      formNotif.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailEnabled = document.getElementById('chkEmailEnabled').checked;
        const notifyOnMissing = document.getElementById('chkActiveOnly').checked;

        const res = await fetch('/api/user/notifications/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ emailEnabled, notifyOnMissing })
        });
        const data = await res.json();
        if (data.success) {
          alert("Notification preferences saved!");
        }
      });
    }
  }
}

window.settingsManager = new SettingsManager();
