/**
 * Remembering Bag v2 — Onboarding Wizard Manager
 * 6-Stage Tailored Setup: Account -> User Type -> Adaptive Schedule -> Bag -> RFID Items -> Ready
 */

class OnboardingManager {
  constructor() {
    this.container = null;
    this.currentStep = 1;
    this.userType = null;
    this.schedule = {
      activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      startTime: '08:30',
      endTime: '17:30'
    };
    this.bag = {
      name: 'My Everyday Bag',
      id: null
    };
    this.items = [
      { name: 'Laptop', rfidUid: 'E2801160', category: 'Electronics', importance: 'critical' },
      { name: 'Wallet', rfidUid: '5D88C94B', category: 'Personal', importance: 'critical' },
      { name: 'Keys', rfidUid: 'C390E41A', category: 'Personal', importance: 'critical' },
      { name: 'College ID Card', rfidUid: '04A23B9F', category: 'Credentials', importance: 'critical' }
    ];
  }

  init() {
    this.createDomStructure();
  }

  createDomStructure() {
    let el = document.getElementById('onboardingOverlay');
    if (el) return;

    el = document.createElement('div');
    el.id = 'onboardingOverlay';
    el.className = 'onboarding-overlay';
    el.innerHTML = `
      <div class="onboarding-card">
        <!-- Progress Stepper Header -->
        <div class="onboarding-stepper">
          <div class="stepper-item" data-step="1">
            <span class="step-num">1</span>
            <span class="step-label">Account</span>
          </div>
          <div class="stepper-connector"></div>
          <div class="stepper-item" data-step="2">
            <span class="step-num">2</span>
            <span class="step-label">About You</span>
          </div>
          <div class="stepper-connector"></div>
          <div class="stepper-item" data-step="3">
            <span class="step-num">3</span>
            <span class="step-label">Schedule</span>
          </div>
          <div class="stepper-connector"></div>
          <div class="stepper-item" data-step="4">
            <span class="step-num">4</span>
            <span class="step-label">Your Bag</span>
          </div>
          <div class="stepper-connector"></div>
          <div class="stepper-item" data-step="5">
            <span class="step-num">5</span>
            <span class="step-label">RFID Items</span>
          </div>
          <div class="stepper-connector"></div>
          <div class="stepper-item" data-step="6">
            <span class="step-num">6</span>
            <span class="step-label">Ready</span>
          </div>
        </div>

        <!-- Dynamic Step Content View -->
        <div class="onboarding-body" id="onboardingStepContainer">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.container = el;
  }

  open(initialStep = 1) {
    if (!this.container) this.createDomStructure();
    this.container.classList.add('open');
    this.goToStep(initialStep);
  }

  close() {
    if (this.container) this.container.classList.remove('open');
  }

  goToStep(stepNumber) {
    this.currentStep = stepNumber;
    this.updateStepperUI();
    this.renderCurrentStep();
  }

  updateStepperUI() {
    const items = this.container.querySelectorAll('.stepper-item');
    items.forEach(item => {
      const step = parseInt(item.getAttribute('data-step'), 10);
      item.classList.remove('active', 'completed');
      if (step === this.currentStep) {
        item.classList.add('active');
      } else if (step < this.currentStep) {
        item.classList.add('completed');
      }
    });
  }

  renderCurrentStep() {
    const container = document.getElementById('onboardingStepContainer');
    if (!container) return;

    const user = (window.authManager && window.authManager.user) || {
      name: "Alex Rivera",
      email: "alex.rivera@example.com"
    };

    switch (this.currentStep) {
      case 1:
        this.renderStep1Account(container, user);
        break;
      case 2:
        this.renderStep2UserType(container);
        break;
      case 3:
        this.renderStep3Schedule(container);
        break;
      case 4:
        this.renderStep4Bag(container);
        break;
      case 5:
        this.renderStep5Items(container);
        break;
      case 6:
        this.renderStep6Ready(container, user);
        break;
    }
  }

  // STEP 1: Account
  renderStep1Account(container, user) {
    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header">
          <span class="step-badge">STEP 1 OF 6</span>
          <h2 class="step-title">Verified Google Account</h2>
          <p class="step-subtitle">Your identity has been authenticated. Remembering Bag will associate all hardware scans with this verified profile.</p>
        </div>

        <div class="account-card-preview">
          <div class="acc-avatar">
            ${user.profileImage ? `<img src="${user.profileImage}" alt="${user.name}">` : `<span class="acc-initial">${user.name.charAt(0)}</span>`}
          </div>
          <div class="acc-info">
            <h3 class="acc-name">${user.name}</h3>
            <p class="acc-email">${user.email}</p>
            <span class="acc-verified-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Google Email Verified
            </span>
          </div>
        </div>

        <div class="step-actions">
          <button class="btn-primary w-full" id="btnStep1Next">
            <span>Continue to Profile Setup</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btnStep1Next').addEventListener('click', () => {
      this.goToStep(2);
    });
  }

  // STEP 2: User Type Selection (Who are you?)
  renderStep2UserType(container) {
    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header">
          <span class="step-badge">STEP 2 OF 6</span>
          <h2 class="step-title">Who are you?</h2>
          <p class="step-subtitle">Select your primary daily routine so Remembering Bag can tailor your schedule, alerts, and essential packing checklists.</p>
        </div>

        <div class="user-types-grid">
          <!-- Option 1: Employee -->
          <div class="user-type-card ${this.userType === 'employee' ? 'selected' : ''}" data-type="employee">
            <div class="card-radio"></div>
            <div class="card-icon-wrap">
              <svg class="svg-icon lg cyan" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <h3 class="user-type-name">Employee</h3>
            <p class="user-type-desc">Office, remote or corporate work with work hours, laptop, ID pass & office gear.</p>
          </div>

          <!-- Option 2: Student -->
          <div class="user-type-card ${this.userType === 'student' ? 'selected' : ''}" data-type="student">
            <div class="card-radio"></div>
            <div class="card-icon-wrap">
              <svg class="svg-icon lg cyan" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <h3 class="user-type-name">Student</h3>
            <p class="user-type-desc">College, university or school classes, lecture notes, student ID & chargers.</p>
          </div>

          <!-- Option 3: Worker -->
          <div class="user-type-card ${this.userType === 'worker' ? 'selected' : ''}" data-type="worker">
            <div class="card-radio"></div>
            <div class="card-icon-wrap">
              <svg class="svg-icon lg cyan" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <h3 class="user-type-name">Worker</h3>
            <p class="user-type-desc">Field work, specialized equipment, shift shifts, tools & safety credentials.</p>
          </div>

          <!-- Option 4: Others -->
          <div class="user-type-card ${this.userType === 'other' ? 'selected' : ''}" data-type="other">
            <div class="card-radio"></div>
            <div class="card-icon-wrap">
              <svg class="svg-icon lg cyan" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="m4.93 4.93 4.24 4.24"/>
                <path d="m14.83 9.17 4.24-4.24"/>
                <path d="m14.83 14.83 4.24 4.24"/>
                <path d="m9.17 14.83-4.24 4.24"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <h3 class="user-type-name">Others</h3>
            <p class="user-type-desc">Gym workouts, weekend travel, photography gear or custom personal routines.</p>
          </div>
        </div>

        <div class="step-actions dual">
          <button class="btn-secondary" id="btnStep2Back">← Back</button>
          <button class="btn-primary" id="btnStep2Next" ${!this.userType ? 'disabled' : ''}>
            <span>Continue to Schedule</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    const cards = container.querySelectorAll('.user-type-card');
    const nextBtn = container.querySelector('#btnStep2Next');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.userType = card.getAttribute('data-type');
        nextBtn.disabled = false;

        // Auto-adapt default bag name based on user type
        if (this.userType === 'student') {
          this.bag.name = "My College Bag";
          this.items = [
            { name: 'Laptop', rfidUid: 'E2801160', category: 'Electronics', importance: 'critical' },
            { name: 'Student ID Card', rfidUid: '04A23B9F', category: 'Credentials', importance: 'critical' },
            { name: 'Notebook & Pen', rfidUid: 'A1B2C3D4', category: 'Stationery', importance: 'medium' },
            { name: 'Scientific Calculator', rfidUid: '7F3E2A10', category: 'Electronics', importance: 'medium' }
          ];
        } else if (this.userType === 'employee') {
          this.bag.name = "My Office Backpack";
          this.items = [
            { name: 'Work Laptop', rfidUid: 'E2801160', category: 'Electronics', importance: 'critical' },
            { name: 'Corporate Badge', rfidUid: '04A23B9F', category: 'Credentials', importance: 'critical' },
            { name: 'Laptop Charger', rfidUid: 'EE55FF66', category: 'Electronics', importance: 'critical' },
            { name: 'House Keys', rfidUid: 'C390E41A', category: 'Personal', importance: 'critical' }
          ];
        } else if (this.userType === 'worker') {
          this.bag.name = "My Tool & Gear Bag";
          this.items = [
            { name: 'Site Access Card', rfidUid: '04A23B9F', category: 'Credentials', importance: 'critical' },
            { name: 'Tool Pouch', rfidUid: 'AA11BB22', category: 'Gear', importance: 'critical' },
            { name: 'Safety Goggles', rfidUid: '5D88C94B', category: 'Safety', importance: 'medium' }
          ];
        } else {
          this.bag.name = "My Everyday Bag";
          this.items = [
            { name: 'Wallet', rfidUid: '5D88C94B', category: 'Personal', importance: 'critical' },
            { name: 'Keys', rfidUid: 'C390E41A', category: 'Personal', importance: 'critical' },
            { name: 'Earphones', rfidUid: '11223344', category: 'Electronics', importance: 'medium' }
          ];
        }
      });
    });

    container.querySelector('#btnStep2Back').addEventListener('click', () => this.goToStep(1));
    nextBtn.addEventListener('click', async () => {
      if (!this.userType) return;
      if (window.authManager && window.authManager.token) {
        await fetch('/api/onboarding/user-type', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authManager.token}`
          },
          body: JSON.stringify({ userType: this.userType })
        });
      }
      this.goToStep(3);
    });
  }

  // STEP 3: Adaptive Schedule Setup
  renderStep3Schedule(container) {
    let adaptiveQuestion = "What days are you usually active?";
    if (this.userType === 'student') adaptiveQuestion = "What days do you usually have classes?";
    else if (this.userType === 'employee' || this.userType === 'worker') adaptiveQuestion = "What days do you usually work?";

    const dayLabels = [
      { code: 'mon', label: 'Mon', full: 'Monday' },
      { code: 'tue', label: 'Tue', full: 'Tuesday' },
      { code: 'wed', label: 'Wed', full: 'Wednesday' },
      { code: 'thu', label: 'Thu', full: 'Thursday' },
      { code: 'fri', label: 'Fri', full: 'Friday' },
      { code: 'sat', label: 'Sat', full: 'Saturday' },
      { code: 'sun', label: 'Sun', full: 'Sunday' }
    ];

    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header">
          <span class="step-badge">STEP 3 OF 6</span>
          <h2 class="step-title">${adaptiveQuestion}</h2>
          <p class="step-subtitle">Remembering Bag uses your active schedule to perform automated bag checks. Reminders are paused on non-active days.</p>
        </div>

        <div class="schedule-config-box">
          <label class="input-label">Select Active Days</label>
          <div class="days-pills-row" id="daysPickerRow">
            ${dayLabels.map(d => `
              <button type="button" class="day-pill ${this.schedule.activeDays.includes(d.code) ? 'selected' : ''}" data-day="${d.code}" title="${d.full}">
                <span class="day-check">${this.schedule.activeDays.includes(d.code) ? '✓' : ''}</span>
                <span>${d.label}</span>
              </button>
            `).join('')}
          </div>

          <div class="time-range-row">
            <div class="time-input-group">
              <label class="input-label">Normal Departure / Start Time</label>
              <input type="time" id="inputStartTime" class="styled-time-input" value="${this.schedule.startTime}">
            </div>
            <div class="time-input-group">
              <label class="input-label">Return / End Time</label>
              <input type="time" id="inputEndTime" class="styled-time-input" value="${this.schedule.endTime}">
            </div>
          </div>

          <div class="schedule-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>On non-active days (e.g. weekends), bag reminders remain silent so you are never disturbed.</span>
          </div>
        </div>

        <div class="step-actions dual">
          <button class="btn-secondary" id="btnStep3Back">← Back</button>
          <button class="btn-primary" id="btnStep3Next">
            <span>Continue to Bag Setup</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    const dayPills = container.querySelectorAll('.day-pill');
    dayPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const day = pill.getAttribute('data-day');
        if (this.schedule.activeDays.includes(day)) {
          this.schedule.activeDays = this.schedule.activeDays.filter(d => d !== day);
          pill.classList.remove('selected');
          pill.querySelector('.day-check').innerText = '';
        } else {
          this.schedule.activeDays.push(day);
          pill.classList.add('selected');
          pill.querySelector('.day-check').innerText = '✓';
        }
      });
    });

    container.querySelector('#btnStep3Back').addEventListener('click', () => this.goToStep(2));
    container.querySelector('#btnStep3Next').addEventListener('click', async () => {
      const startTime = container.querySelector('#inputStartTime').value || '08:30';
      const endTime = container.querySelector('#inputEndTime').value || '17:30';
      this.schedule.startTime = startTime;
      this.schedule.endTime = endTime;

      if (window.authManager && window.authManager.token) {
        await fetch('/api/onboarding/schedule', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authManager.token}`
          },
          body: JSON.stringify(this.schedule)
        });
      }

      this.goToStep(4);
    });
  }

  // STEP 4: Bag Setup
  renderStep4Bag(container) {
    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header">
          <span class="step-badge">STEP 4 OF 6</span>
          <h2 class="step-title">Give your bag a name</h2>
          <p class="step-subtitle">Create your first smart bag. You can add more bags later in your dashboard.</p>
        </div>

        <div class="bag-create-form">
          <div class="form-group">
            <label class="input-label" for="inputBagName">Bag Name</label>
            <input type="text" id="inputBagName" class="styled-text-input" value="${this.bag.name}" placeholder="e.g. My Office Bag or College Backpack">
          </div>

          <div class="hardware-link-badge">
            <div class="hw-icon-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 14a7 7 0 0 1 10 0"/><circle cx="12" cy="18" r="1.5" fill="var(--accent-cyan)"/></svg>
            </div>
            <div class="hw-text">
              <div class="hw-title">RC522 RFID Interrogator & ESP32 Microcontroller</div>
              <div class="hw-sub">Hardware linked: Ready to register physical RFID tag tokens.</div>
            </div>
          </div>
        </div>

        <div class="step-actions dual">
          <button class="btn-secondary" id="btnStep4Back">← Back</button>
          <button class="btn-primary" id="btnStep4Next">
            <span>Continue to RFID Registration</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btnStep4Back').addEventListener('click', () => this.goToStep(3));
    container.querySelector('#btnStep4Next').addEventListener('click', async () => {
      const bagName = container.querySelector('#inputBagName').value || this.bag.name;
      this.bag.name = bagName.trim();

      if (window.authManager && window.authManager.token) {
        const res = await fetch('/api/onboarding/bag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authManager.token}`
          },
          body: JSON.stringify({ name: this.bag.name })
        });
        const data = await res.json();
        if (data.bag) this.bag.id = data.bag.id;
      }

      this.goToStep(5);
    });
  }

  // STEP 5: RFID Item Registration
  renderStep5Items(container) {
    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header">
          <span class="step-badge">STEP 5 OF 6</span>
          <h2 class="step-title">Register your belongings</h2>
          <p class="step-subtitle">Pair each essential item with its 13.56 MHz RFID tag. Bring the tag physically near your RC522 reader to scan.</p>
        </div>

        <!-- Touch-to-register simulator banner -->
        <div class="rfid-touch-simulator-box">
          <div class="sim-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 14a7 7 0 0 1 10 0"/><circle cx="12" cy="18" r="1.5" fill="var(--accent-cyan)"/></svg>
            <span class="sim-title">RC522 Antenna Surface (Touch / Proximity Zone)</span>
          </div>
          <p class="sim-desc">Short-range physical RFID: Touch item tag near reader to capture unique UID.</p>
        </div>

        <!-- Items Table / List -->
        <div class="rfid-items-table" id="rfidItemsList">
          ${this.items.map((item, idx) => `
            <div class="rfid-item-card" data-index="${idx}">
              <div class="rfid-item-left">
                <span class="rfid-item-num">#${idx + 1}</span>
                <input type="text" class="item-name-input" value="${item.name}" placeholder="Item name">
              </div>
              <div class="rfid-item-right">
                <span class="rfid-uid-badge" title="Paired RFID UID">${item.rfidUid}</span>
                <button type="button" class="btn-sim-touch" title="Simulate touching tag on RC522 reader">Tap Tag</button>
                <button type="button" class="btn-remove-item" title="Remove item">✕</button>
              </div>
            </div>
          `).join('')}
        </div>

        <button type="button" class="btn-add-item-row" id="btnAddItemRow">
          <span>+ Add Another Belonging</span>
        </button>

        <div class="step-actions dual">
          <button class="btn-secondary" id="btnStep5Back">← Back</button>
          <button class="btn-primary" id="btnStep5Next">
            <span>Finalize & Preview Bag</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    this.bindItemsListEvents(container);

    container.querySelector('#btnStep5Back').addEventListener('click', () => this.goToStep(4));
    container.querySelector('#btnStep5Next').addEventListener('click', async () => {
      // Sync names from inputs
      const inputs = container.querySelectorAll('.item-name-input');
      inputs.forEach((inp, idx) => {
        if (this.items[idx]) this.items[idx].name = inp.value.trim() || `Item ${idx + 1}`;
      });

      if (window.authManager && window.authManager.token) {
        await fetch('/api/onboarding/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authManager.token}`
          },
          body: JSON.stringify({
            bagId: this.bag.id,
            items: this.items
          })
        });
      }

      this.goToStep(6);
    });
  }

  bindItemsListEvents(container) {
    const listEl = container.querySelector('#rfidItemsList');
    const addBtn = container.querySelector('#btnAddItemRow');

    addBtn.addEventListener('click', () => {
      const randomUid = Math.random().toString(16).substring(2, 10).toUpperCase();
      this.items.push({
        name: 'New Belonging',
        rfidUid: randomUid,
        category: 'General',
        importance: 'medium'
      });
      this.renderStep5Items(container);
    });

    listEl.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.rfid-item-card');
        const idx = parseInt(card.getAttribute('data-index'), 10);
        this.items.splice(idx, 1);
        this.renderStep5Items(container);
      });
    });

    listEl.querySelectorAll('.btn-sim-touch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.rfid-item-card');
        const idx = parseInt(card.getAttribute('data-index'), 10);
        const newUid = Math.random().toString(16).substring(2, 10).toUpperCase();
        this.items[idx].rfidUid = newUid;
        card.querySelector('.rfid-uid-badge').innerText = newUid;
        card.classList.add('flash-cyan');
        setTimeout(() => card.classList.remove('flash-cyan'), 600);
      });
    });
  }

  // STEP 6: Ready & Confirmation
  renderStep6Ready(container, user) {
    container.innerHTML = `
      <div class="onboarding-step-view fade-in">
        <div class="step-header text-center">
          <div class="success-icon-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="step-badge">SETUP COMPLETE</span>
          <h2 class="step-title">Your Remembering Bag is Ready</h2>
          <p class="step-subtitle">All essentials are registered with their unique RFID tags. Starting today, your bag will warn you before you leave anything behind.</p>
        </div>

        <div class="summary-card-grid">
          <div class="summary-item">
            <span class="summary-label">User Profile</span>
            <span class="summary-val">${user.name} (${this.userType ? this.userType.toUpperCase() : 'USER'})</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Active Schedule</span>
            <span class="summary-val">${this.schedule.activeDays.map(d => d.toUpperCase()).join(', ')} • ${this.schedule.startTime}–${this.schedule.endTime}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Bag Setup</span>
            <span class="summary-val">${this.bag.name}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Tracked Belongings</span>
            <span class="summary-val">${this.items.length} Registered RFID items</span>
          </div>
        </div>

        <div class="step-actions">
          <button class="btn-primary w-full" id="btnFinishOnboarding">
            <span>Open My Dashboard</span>
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btnFinishOnboarding').addEventListener('click', async () => {
      if (window.authManager && window.authManager.token) {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authManager.token}`
          }
        });
        if (window.authManager.user) {
          window.authManager.user.onboardingCompleted = true;
        }
      }

      this.close();

      if (window.appViewManager) {
        window.appViewManager.switchView('dashboard');
      }
    });
  }
}

window.onboardingManager = new OnboardingManager();
document.addEventListener('DOMContentLoaded', () => {
  window.onboardingManager.init();
});
