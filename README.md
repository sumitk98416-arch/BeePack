# 🎒 Remembering Bag (Smart Backpack)

An intelligent, IoT-enabled backpack system that uses **RFID sensing (ESP32 + MFRC522)**, **Web Bluetooth Low Energy (BLE)**, and a **Fullstack Web Application** to detect packed items in real-time and alert you whenever essential items are missing before you leave.

---

## 📁 Repository Structure

```
remembering-bag/
├── frontend/         # Modern web UI, interactive bag dashboard, 3D/canvas simulator, BLE connector
├── backend/          # Node.js/Express REST API, Google Auth session manager, packing check engine
├── esp32/            # ESP32 C++ firmware (Arduino/PlatformIO), MFRC522 SPI RFID reader & BLE server
├── database/         # JSON database storage layer, seed dataset, and schema definitions
├── package.json      # Root NPM script runner and dependencies
└── README.md         # Project documentation & setup guide
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Web Browser**: Chrome / Edge / Opera (for Web Bluetooth API support)
- **Hardware (Optional for physical build)**: ESP32 development board + RC522 RFID module

### 2. Install & Run Backend / Frontend
```bash
# Clone the repository
git clone <repo-url>
cd remembering-bag

# Install dependencies
npm install

# Start the fullstack development server
npm run dev
# or
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Automated Tests
```bash
# Run API & End-to-End Flow Tests
npm test
# or
npm run test:v2
```

---

## 📦 Folder Details

### 🖥️ 1. `frontend/`
Contains the modern, glassmorphic single-page web application with interactive controls:
- **`index.html`**: Core web application shell.
- **`css/style.css`**: Design system tokens, responsive layouts, and animations.
- **`js/`**:
  - `app.js`: Main frontend controller and view orchestrator.
  - `ble.js`: Web Bluetooth API integration for real-time ESP32 sync.
  - `dashboard.js`: Live packing status, readiness gauges, and item checklists.
  - `simulator.js`: Virtual RFID scanner and bag packing simulator.
  - `onboarding.js`: User type, schedule, bag, and tag registration wizard.
  - `compartments.js` & `bag-demo.js`: Interactive visual compartments and demo modes.

### ⚙️ 2. `backend/`
Contains the Express.js server providing REST APIs and business logic:
- **`server.js`**:
  - Google OAuth / Mock Auth session provider
  - Onboarding lifecycle and schedule management
  - Daily bag check engine (compares scanned RFID UIDs against schedule items)
  - Missing item notification dispatcher
  - Web Bluetooth & hardware sync endpoints
- **`test_api.js`**: Core API endpoint integration test suite.
- **`test_v2_flow.js`**: Full multi-user isolation and daily bag check automated test suite.

### ⚡ 3. `esp32/`
Contains embedded firmware and hardware wiring documentation:
- **`smart_bag_firmware.ino`**: Production Arduino/ESP32 sketch with SPI RFID polling, buzzer/LED feedback, and BLE GATT Service (`0x180F`).
- **`uid_scanner_test.ino`**: Diagnostic sketch for testing MFRC522 tag UID detection over Serial.
- **`platformio.ini`**: PlatformIO configuration file for ESP32 builds.
- **`WIRING.md`**: Pinout connection table between ESP32 and MFRC522 RFID reader.

### 💾 4. `database/`
Persistent data storage layer:
- **`db.js`**: File-based database helper with automatic seed generation and JSON persistence.
- **`data/bag_database.json`**: Primary JSON store for:
  - `users`: User profiles, account types (Student / Employee / Freelancer / Traveler).
  - `schedules`: Active days (e.g. Mon–Fri) and departure times.
  - `bags`: Registered backpacks and hardware IDs.
  - `items`: Expected tracked items linked to RFID tag UIDs.
  - `scanHistory`: Historical scan records with timestamp and completeness logs.
  - `notificationSettings` & `notifications`: Alert history and dispatch logs.

---

## 🔌 ESP32 Pinout Guide

| MFRC522 Pin | ESP32 Pin | Description |
|:---|:---|:---|
| **3.3V** | 3V3 | Power (Do NOT connect to 5V) |
| **GND** | GND | Ground |
| **RST** | GPIO 22 | Reset Pin |
| **SDA (SS)** | GPIO 5 | SPI Chip Select |
| **SCK** | GPIO 18 | SPI Clock |
| **MOSI** | GPIO 23 | SPI Master Out Slave In |
| **MISO** | GPIO 19 | SPI Master In Slave Out |
| **BUZZER** | GPIO 21 (optional) | Audio beep on item scan |
| **LED** | GPIO 2 (optional) | Visual indicator LED |

---

## 🛡️ License
MIT License. Built for the Smart Remembering Backpack IoT Project.
