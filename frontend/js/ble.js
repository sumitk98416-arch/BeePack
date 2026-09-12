/**
 * Smart Remembering Backpack — Web Bluetooth (Web BLE) Manager
 * Enables direct browser-to-ESP32 Bluetooth pairing to stream live scans and trigger hardware reading.
 */

const BLE_CONFIG = {
  SERVICE_UUID:           "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
  CHAR_SCAN_TRIGGER_UUID: "beb5483e-36e1-4688-b7f5-ea07361b26a8",
  CHAR_SCANNED_TAGS_UUID: "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e",
  CHAR_BAG_STATUS_UUID:   "d28e4042-78d1-4d1e-ba78-4770387b99c0"
};

class BleManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.scanTriggerChar = null;
    this.scannedTagsChar = null;
    this.bagStatusChar = null;
    this.isConnected = false;
    this.onScanDataCallback = null;
    this.onStatusChangeCallback = null;
    this.onLogCallback = null;
  }

  log(msg, type = "info") {
    if (this.onLogCallback) {
      this.onLogCallback(msg, type);
    }
    console.log(`[BLE ${type.toUpperCase()}]`, msg);
  }

  isSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  async connect() {
    if (!this.isSupported()) {
      alert("Web Bluetooth API is not supported in this browser. Please use Chrome, Edge, or Bluefy on iOS.");
      this.log("Web Bluetooth is not supported on this browser.", "error");
      return false;
    }

    try {
      this.log("Requesting Bluetooth device 'SmartBackpack-ESP32'...", "info");
      
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "SmartBackpack" }],
        optionalServices: [BLE_CONFIG.SERVICE_UUID]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.log("Hardware disconnected.", "warn");
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback(false, this.device.name);
        }
      });

      this.log(`Connecting to GATT Server on ${this.device.name}...`, "info");
      this.server = await this.device.gatt.connect();

      this.log("Discovering Smart Backpack Primary Service...", "info");
      const service = await this.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);

      // Get Characteristics
      this.scanTriggerChar = await service.getCharacteristic(BLE_CONFIG.CHAR_SCAN_TRIGGER_UUID);
      this.scannedTagsChar = await service.getCharacteristic(BLE_CONFIG.CHAR_SCANNED_TAGS_UUID);
      this.bagStatusChar = await service.getCharacteristic(BLE_CONFIG.CHAR_BAG_STATUS_UUID);

      // Start Notifications on Scanned Tags
      await this.scannedTagsChar.startNotifications();
      this.scannedTagsChar.addEventListener('characteristicvaluechanged', (event) => {
        const decoder = new TextDecoder('utf-8');
        const rawJson = decoder.decode(event.target.value);
        this.log(`Received Scanned Tags payload: ${rawJson}`, "success");
        try {
          const parsed = JSON.parse(rawJson);
          if (this.onScanDataCallback) {
            this.onScanDataCallback(parsed);
          }
        } catch (e) {
          this.log(`JSON parse error from ESP32: ${e.message}`, "warn");
        }
      });

      // Start Notifications on Bag Status
      await this.bagStatusChar.startNotifications();
      this.bagStatusChar.addEventListener('characteristicvaluechanged', (event) => {
        const decoder = new TextDecoder('utf-8');
        const statusJson = decoder.decode(event.target.value);
        this.log(`Bag Status update: ${statusJson}`, "info");
      });

      this.isConnected = true;
      this.log(`Connected successfully to ${this.device.name}!`, "success");

      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(true, this.device.name);
      }

      return true;
    } catch (err) {
      this.isConnected = false;
      this.log(`Connection cancelled or failed: ${err.message}`, "error");
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(false, null);
      }
      return false;
    }
  }

  async triggerHardwareScan() {
    if (!this.isConnected || !this.scanTriggerChar) {
      this.log("Cannot trigger scan: ESP32 hardware is not connected via BLE.", "warn");
      return false;
    }

    try {
      this.log("Sending 'SCAN' command characteristic to ESP32...", "info");
      const encoder = new TextEncoder();
      await this.scanTriggerChar.writeValue(encoder.encode("SCAN"));
      this.log("Command sent! ESP32 is reading RFID field...", "info");
      return true;
    } catch (err) {
      this.log(`Failed to write scan trigger: ${err.message}`, "error");
      return false;
    }
  }

  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
      this.isConnected = false;
      this.log("Disconnected from Bluetooth device.", "info");
    }
  }
}

window.bleManager = new BleManager();
