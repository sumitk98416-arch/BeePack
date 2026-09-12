/**
 * Audio System — Disabled completely per user configuration.
 */

class SoundAlertSystem {
  constructor() {
    this.soundEnabled = false;
  }
  initContext() {}
  toggleSound() { return false; }
  playStampSound() {}
  playMissingAlert() {}
  playSuccessChime() {}
  playZipperSound() {}
  playTagDetected() {}
  playZipperClick() {}
}

window.soundSystem = new SoundAlertSystem();
