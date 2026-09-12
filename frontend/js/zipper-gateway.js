/**
 * Remembering Bag — Futuristic Interactive Hero Zipper Gateway
 * Coordinates the 3D unzipping entrance and syncs Bag Open / Bag Close events with backend email notifications.
 */

class ZipperGatewayManager {
  constructor() {
    this.gateway = document.getElementById('zipperGateway');
    this.slider = document.getElementById('zipperSlider');
    this.pullTab = document.getElementById('pullTabHandle');
    this.tooltip = document.getElementById('zipperTooltip');
    this.trackGlow = document.getElementById('zipperTrackGlow');
    this.btnRezip = document.getElementById('btnRezipBag');
    this.isUnzipped = false;
  }

  init() {
    if (!this.gateway) return;

    // Click triggers
    const triggerUnzip = () => this.unzip();

    if (this.slider) this.slider.addEventListener('click', triggerUnzip);
    if (this.pullTab) this.pullTab.addEventListener('click', triggerUnzip);
    if (this.tooltip) this.tooltip.addEventListener('click', triggerUnzip);

    // Rezip button in navbar
    if (this.btnRezip) {
      this.btnRezip.addEventListener('click', (e) => {
        e.preventDefault();
        this.rezip();
      });
    }

    // Drag down to unzip support
    let startY = 0;
    let isDragging = false;

    if (this.slider) {
      this.slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || this.isUnzipped) return;
        const deltaY = e.clientY - startY;
        if (deltaY > 50) {
          this.unzip();
          isDragging = false;
        }
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Touch support
      this.slider.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
      });

      window.addEventListener('touchmove', (e) => {
        if (!isDragging || this.isUnzipped) return;
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY > 40) {
          this.unzip();
          isDragging = false;
        }
      });

      window.addEventListener('touchend', () => {
        isDragging = false;
      });
    }
  }

  async notifyBagEvent(eventType) {
    try {
      const token = localStorage.getItem('rb_session_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/bag/event', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: eventType,
          hardwareId: 'ESP32-BAG-01',
          timestamp: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (data.success) {
        this.showEmailToast(eventType);
        // Refresh dashboard data if dashboard manager is active
        if (window.dashboardManager && window.dashboardManager.loadDashboardData) {
          window.dashboardManager.loadDashboardData();
        }
      }
    } catch (err) {
      console.warn("Bag event email trigger note:", err.message);
    }
  }

  showEmailToast(eventType) {
    const isOpened = eventType === 'OPEN';
    const email = (window.authManager && window.authManager.user) ? window.authManager.user.email : 'murtazajamali07@gmail.com';
    
    let toast = document.getElementById('bagEmailToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bagEmailToast';
      toast.className = 'bag-email-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div class="toast-icon ${isOpened ? 'icon-warning' : 'icon-success'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          ${isOpened 
            ? '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
            : '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
          }
        </svg>
      </div>
      <div class="toast-content">
        <div class="toast-title">📧 Email Notification Dispatched</div>
        <div class="toast-desc">Bag <strong>${isOpened ? 'OPENED' : 'CLOSED'}</strong> alert sent to <span>${email}</span></div>
      </div>
    `;

    toast.classList.remove('visible');
    void toast.offsetWidth; // Force reflow
    toast.classList.add('visible');

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 4500);
  }

  unzip(immediate = false) {
    if (this.isUnzipped) return;
    this.isUnzipped = true;

    // Trigger backend Bag Opened event + Email
    this.notifyBagEvent('OPEN');

    if (immediate) {
      if (this.slider) this.slider.style.top = '88%';
      if (this.trackGlow) this.trackGlow.style.height = '88%';
      if (this.gateway) this.gateway.classList.add('unzipped');
      return;
    }

    // Stage 1: Slide down zipper pull tab with glowing trail
    if (this.slider) {
      this.slider.style.top = '88%';
    }
    if (this.trackGlow) {
      this.trackGlow.style.height = '88%';
    }

    // Stage 2: Flaps slowly part and rotate outward in 3D
    setTimeout(() => {
      if (this.gateway) {
        this.gateway.classList.add('unzipped');
      }
    }, 850);
  }

  rezip() {
    this.isUnzipped = false;
    
    // Trigger backend Bag Closed event + Email
    this.notifyBagEvent('CLOSE');

    // First bring flaps back together
    if (this.gateway) {
      this.gateway.classList.remove('unzipped');
    }

    // Then slide zipper back up
    setTimeout(() => {
      if (this.slider) {
        this.slider.style.top = '25%';
      }
      if (this.trackGlow) {
        this.trackGlow.style.height = '0%';
      }
    }, 600);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const gateway = new ZipperGatewayManager();
  gateway.init();
  window.zipperGatewayManager = gateway;
});
