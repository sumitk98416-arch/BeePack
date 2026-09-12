# Smart Remembering Backpack — Hardware Wiring & Assembly Guide

This document details the circuit schematic, pin mapping, power architecture, and physical installation guidelines for building the **Smart Remembering Backpack**.

---

## 1. Bill of Materials (BOM)

| # | Component | Model / Specs | Qty | Estimated Cost | Notes |
|---|---|---|---|---|---|
| 1 | **Microcontroller** | ESP32-WROOM-32 (30-pin or 38-pin DevKit) | 1 | ~$4.50 | Dual-core 240MHz, Bluetooth 4.2 BLE + Wi-Fi |
| 2 | **RFID Reader** | MFRC522 (13.56 MHz RFID Module) | 1 | ~$2.00 | SPI interface, 3.3V logic |
| 3 | **RFID Tags** | NTAG213 / NTAG215 / Mifare Classic 1K Stickers | 10–20 | ~$5.00 | Adhesive stickers (anti-metal recommended for metal items) |
| 4 | **Battery** | 3.7V Lithium-Polymer (LiPo) 1500–2000mAh | 1 | ~$6.00 | JST-PH 2.0 connector or solder pads |
| 5 | **Charger & Protection** | TP4056 Micro-USB / Type-C 5V 1A LiPo Charger | 1 | ~$1.00 | Module with over-discharge & over-current protection |
| 6 | **Magnetic Sensor** | Normally Open (NO) Reed Switch + Magnet | 1 | ~$1.20 | Detects bag zipper/flap opening |
| 7 | **Audio Indicator** | 3V–5V Active Piezo Buzzer | 1 | ~$0.50 | Beeps for scan confirmation & missing alerts |
| 8 | **Visual Indicator** | 5mm RGB LED or Bi-color LED (Common Cathode) | 1 | ~$0.30 | Status indicator (Green=Packed, Red=Missing, Blue=BLE) |
| 9 | **Resistors** | 220Ω (x3 for LED), 10kΩ (pull-up for Reed switch) | 4 | ~$0.20 | Current limiting and pull-up |
| 10| **Prototyping** | Mini Breadboard / Stripboard, Jumper wires | 1 set | ~$2.00 | Solderless or soldered perfboard |
| 11| **Enclosure** | 3D Printed / Acrylic case (~80x60x25mm) | 1 | ~$3.00 | Protects electronics inside backpack side pocket |

---

## 2. Pin Connection Diagram

### A. ESP32 to MFRC522 RFID Reader (SPI Interface)

> [!WARNING]
> The **MFRC522 operates at 3.3V ONLY**. Connecting it to 5V will permanently damage the module.

| MFRC522 Pin | ESP32 Pin (Standard SPI) | Description |
|---|---|---|
| **VCC (3.3V)** | **3V3 (Pin 1 / 3.3V Rail)** | Power (3.3V DC) |
| **RST** | **GPIO 22** | Reset Pin |
| **GND** | **GND** | Ground |
| **MISO** | **GPIO 19** | SPI Master In / Slave Out |
| **MOSI** | **GPIO 23** | SPI Master Out / Slave In |
| **SCK** | **GPIO 18** | SPI Clock |
| **SDA / SS** | **GPIO 5** (Chip Select / Slave Select) | SPI Chip Select |
| **IRQ** | *Unconnected* | Not needed for polling |

---

### B. Peripherals & Sensors

| Component | Component Pin | ESP32 Pin | Wiring Notes |
|---|---|---|---|
| **Reed Switch (Bag Open)** | Terminal 1 | **GPIO 4** | Configured with internal pull-up (`INPUT_PULLUP`). |
| | Terminal 2 | **GND** | When zipper closes magnet near switch, pin goes LOW. |
| **Manual Trigger Button** | Terminal 1 | **GPIO 0** (or **GPIO 15**) | Configured with `INPUT_PULLUP`. Pulls to GND when pressed. |
| | Terminal 2 | **GND** | |
| **Active Buzzer** | Positive (+) | **GPIO 26** | Direct or via 100Ω resistor for volume dampening. |
| | Negative (-) | **GND** | |
| **Status LED (Red)** | Anode (+) | **GPIO 27** | Via 220Ω resistor (Indicates Missing Items). |
| **Status LED (Green)** | Anode (+) | **GPIO 14** | Via 220Ω resistor (Indicates 100% Packed). |
| **Status LED (Blue)** | Anode (+) | **GPIO 12** | Via 220Ω resistor (Indicates BLE Connected). |
| | Cathode (-) | **GND** | Common ground for RGB LED. |

---

### C. Power Circuit & Charging (TP4056 + Li-Po)

```
[5V USB Charger] ───► [TP4056 IN+/IN-]
                             │
                  [BAT+/BAT-] ◄───► [3.7V LiPo Battery]
                             │
                  [OUT+/OUT-] ───► [Power Switch] ───► [ESP32 5V/VIN & GND]
```

1. Connect Li-Po battery positive to **TP4056 B+** and negative to **TP4056 B-**.
2. Connect **TP4056 OUT+** through a slide switch to **ESP32 VIN (5V)**.
3. Connect **TP4056 OUT-** to **ESP32 GND**.
4. The ESP32's onboard LDO voltage regulator steps down the 3.7V–4.2V LiPo output to a clean 3.3V.

---

## 3. Physical Placement & Antenna Tuning

1. **Electronics Location**: Mount the ESP32, battery, and TP4056 module inside an internal side pocket or dedicated electronics pouch (as shown in the reference 45×30×18 cm layout).
2. **Antenna Positioning**: The MFRC522 reader has a typical read range of **3 to 6 cm**. Place the reader facing the interior main compartment.
3. **Anti-Metal RFID Tags**: For metallic items (laptops, metal water bottles, keychains), standard RFID stickers detune when placed on metal. Use ferrite-backed **Anti-Metal RFID tags** or attach the tag to a plastic tag/keychain.
4. **Reed Switch Zipper Sensor**:
   - Affix the tiny neodymium magnet to the zipper pull tab.
   - Stitch the reed switch near the top seam where the zipper rests when fully closed.
   - When the bag is zipped closed, the reed switch triggers an automated scan!

---

## 4. Power Optimization & Deep Sleep

- In active scanning mode, ESP32 draws **~80–120mA**.
- In **BLE deep sleep**, ESP32 draws **< 15µA**.
- The firmware enters deep sleep after 15 seconds of inactivity and wakes up instantly via **GPIO 4 (Reed switch)** or **GPIO 0 (Push button)**.
- With a 1500mAh LiPo battery and 20 scans per day, battery life exceeds **2 to 3 weeks** on a single charge.
