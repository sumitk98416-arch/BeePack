# Smart Remembering Backpack — Firmware Flashing Guide

This directory contains the ESP32 embedded software for the Smart Remembering Backpack.

## Sketches Included

1. **`smart_bag_firmware.ino`**: Full production firmware with BLE GATT Server, MFRC522 multi-tag scanning loop, Reed switch trigger, Buzzer & LED control.
2. **`uid_scanner_test.ino`**: Simple diagnostic sketch to scan RFID stickers/cards and print their exact HEX UIDs over Serial Monitor.

---

## Option A: Flashing via Arduino IDE

1. **Install Arduino IDE 2.x** (from arduino.cc).
2. **Add ESP32 Board Support**:
   - Go to `Settings` -> `Additional Boards Manager URLs`.
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Open **Boards Manager** and install **esp32 by Espressif Systems**.
3. **Install Required Libraries** (via Library Manager `Ctrl+Shift+I` or `Cmd+Shift+I`):
   - `MFRC522` by GithubCommunity (v1.4.10+)
   - `ArduinoJson` by Benoit Blanchon (v6.21.3+)
4. **Select Board & Port**:
   - Board: `ESP32 Dev Module`
   - Port: Select your USB Serial COM/tty port (e.g., `/dev/cu.usbserial-0001` on Mac or `COM3` on Windows).
5. **Upload**:
   - Click the **Upload** button.
   - Open **Serial Monitor** at **115200 baud**.

---

## Option B: Flashing via PlatformIO (VS Code / CLI)

1. Open this `firmware/` folder in VS Code with the PlatformIO extension.
2. Run build:
   ```bash
   pio run
   ```
3. Upload to connected ESP32:
   ```bash
   pio run --target upload
   ```
4. Open Serial Monitor:
   ```bash
   pio device monitor -b 115200
   ```

---

## Bluetooth Low Energy (BLE) Specifications

- **Device Name**: `SmartBackpack-ESP32`
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Characteristics**:
  - `beb5483e-36e1-4688-b7f5-ea07361b26a8` (**Scan Trigger**): Write `"SCAN"` to run a 2.5s multi-tag read.
  - `1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e` (**Scanned Tags**): Read / Notify JSON array of detected UIDs (e.g. `{"tags":["E2801160","04A23B9F"],"count":2,"battery":98}`).
  - `d28e4042-78d1-4d1e-ba78-4770387b99c0` (**Bag Status**): Read / Notify bag opened/closed and battery level.
