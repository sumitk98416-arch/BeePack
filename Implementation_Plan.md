# Remembering Bag — Implementation Plan

A smart bag that uses RFID sensing (ESP32 + MFRC522) to detect which items are inside, and alerts the user via a mobile/web app when something is missing.

This plan breaks the build into phases, each with concrete tasks, deliverables, and rough timing, so it can be executed step by step (solo or with a small team).

---

## Phase 0 — Planning & Requirements (Week 1)

**Goal:** Lock scope before buying hardware or writing code.

- Finalize MVP scope: single bag, single list type (e.g., "College List"), RFID-only detection (skip reed switch and AI vision for v1)
- List exact items to track for the demo (6–8 items max) and note which need RFID tags
- Decide connectivity for v1: **BLE** is simpler for a demo (no Wi-Fi credentials needed); Wi-Fi is better if you want cloud sync from day one
- Choose backend: Firebase (fastest to set up) or Supabase (if you prefer SQL/Postgres)
- Choose app platform: Flutter (single codebase for Android/iOS) or React Native, or a simple web app (React) if a phone app isn't required for the demo

**Deliverable:** One-page spec — item list, chosen connectivity mode, chosen backend, chosen app framework.

---

## Phase 1 — Hardware Procurement & Bring-up (Weeks 1–2)

**Components to source:**

| Component | Purpose | Notes |
|---|---|---|
| ESP32 dev board | Main controller | Any ESP32-WROOM board works |
| MFRC522 RFID reader | Scans tags (13.56 MHz) | Connects via SPI |
| RFID tags/cards (13.56 MHz) | One per tracked item | Stickers are easiest to attach to items |
| TP4056 charging module | Li-Po charging + protection | Get one with built-in protection circuit |
| Li-Po battery (3.7V) | Power source | 1000–2000 mAh is enough for a demo |
| Reed switch (optional) | Detects bag open/close | Skip for v1, add in Phase 6 |
| Jumper wires, breadboard | Prototyping | — |

**Tasks:**
1. Wire MFRC522 to ESP32 over SPI (SDA, SCK, MOSI, MISO, RST, 3.3V, GND)
2. Wire TP4056 → Li-Po battery → ESP32 5V/VIN
3. Flash a basic "read RFID UID" sketch (Arduino IDE or PlatformIO) and confirm each tag returns a stable, unique UID
4. Record the UID of every tag against the item it will be stuck to (this becomes your seed data for Phase 3)

**Deliverable:** ESP32 reliably reads and prints UIDs of all tagged items over serial monitor.

---

## Phase 2 — Firmware / Embedded Software (Weeks 2–4)

**Goal:** ESP32 scans all tags in range and reports the list to the app/cloud.

1. **Scan loop:** poll the MFRC522 repeatedly to build a "detected tags" list over a short scan window (RFID tags aren't always all readable in a single instant if items overlap — scan for a few seconds and merge results)
2. **Comparison logic:** compare the detected list against an "expected list" (initially hardcoded, later fetched from the app)
3. **Communication layer** — pick one:
   - **BLE (recommended for v1):** ESP32 acts as a BLE GATT server; app connects as client and reads/writes the item list and scan results. Lower power, no network setup needed.
   - **Wi-Fi:** ESP32 connects to a router and pushes data via HTTP/MQTT to the cloud backend directly. Needed if you want scans logged even when the phone isn't nearby.
4. **Trigger logic:** for v1, trigger a scan on a button press or on a timer; add the reed switch (bag-open trigger) in Phase 6
5. **Power management:** put ESP32 in deep sleep between scans to preserve battery

**Deliverable:** ESP32 firmware that scans on trigger, compares against a list, and sends a "present/missing" result over BLE (or Wi-Fi) to a test client.

---

## Phase 3 — Backend / Cloud (Weeks 3–5, parallel with Phase 2)

**Goal:** Store users, item lists, RFID tag mappings, and scan history.

**Data model (example):**
- `users`: id, name, email
- `lists`: id, user_id, name (e.g., "College List")
- `items`: id, list_id, name, item_type, rfid_tag_id
- `scans`: id, list_id, timestamp, missing_items[]

**Tasks:**
1. Set up Firebase project (Auth + Firestore) or Supabase project (Auth + Postgres)
2. Create the schema/collections above
3. Build simple REST endpoints or use the Firebase/Supabase SDK directly from the app for:
   - Create/read/update/delete items and lists
   - Log a scan result
   - Fetch scan history
4. Add basic auth (email/password or Google sign-in) for the "User Registration" step in the flow

**Deliverable:** Backend where you can manually create a list, add items with RFID tag IDs, and log a scan via API calls (e.g., tested with Postman).

---

## Phase 4 — Mobile / Web App (Weeks 4–7, parallel with Phase 3)

**Goal:** The app/dashboard shown in the presentation — list management, live status, missing-item alerts.

**Core screens:**
1. **My Lists** — view/create lists (College, Office, Gym, Travel)
2. **Add Item** — item name, type, RFID tag ID, save to backend
3. **Bag Dashboard** — shows each item with Present/Missing status for the active list
4. **Missing Item Alert** — highlighted banner + push notification when items are missing
5. **History/Logs** — past scans

**Tasks:**
1. Scaffold the app (Flutter/React Native/React) and connect to backend SDK
2. Implement BLE client (or MQTT/HTTP client for Wi-Fi mode) to receive scan results from the ESP32
3. Build the list/item CRUD screens against the backend
4. Build the dashboard that merges "expected list" with "last scan result"
5. Add push notifications (Firebase Cloud Messaging) for missing-item alerts
6. Add sound/vibration alert on the phone when a scan reports missing items

**Deliverable:** Working app that lets you create a list, add RFID-tagged items, and see live present/missing status after a scan.

---

## Phase 5 — Integration & End-to-End Testing (Weeks 7–8)

1. Attach real RFID tags to real items and place them in the bag prototype
2. Run the full loop: open bag (or trigger scan) → ESP32 scans → sends result → app compares → dashboard updates → alert fires if something's missing
3. Test edge cases:
   - Tag misreads (metal/liquid near tags can interfere with RFID — test bottle placement)
   - Two tags scanned simultaneously
   - App offline when scan happens (queue and sync later)
   - Battery low behavior
4. Tune scan timing/antenna placement so all tags in the bag are reliably read

**Deliverable:** A demo-ready working prototype: put items in the bag, get an accurate missing-item alert on the phone within a few seconds.

---

## Phase 6 — Physical Build (Weeks 8–9, can start earlier in parallel)

1. Source or modify a backpack with an accessible internal side pocket/panel
2. Mount ESP32 + MFRC522 + battery + charging module on one side only (as shown in the reference design) using a small enclosure or foam mount
3. Route antenna/reader placement to maximize tag read range across the main compartment
4. Add the reed switch at the zipper/opening to trigger scans automatically on bag-open
5. Add a charging port cutout for the TP4056 micro-USB

**Deliverable:** Fully assembled smart bag matching the "Smart Remembering Bag" reference (45×30×18 cm form factor, electronics on one side).

---

## Phase 7 — Polish & Demo Prep (Weeks 9–10)

- Clean up app UI to match the reference dashboard style (list view, present/missing badges, alert banner)
- Prepare a live demo script: register → create list → add items → place items in bag → close bag → show alert for a deliberately missing item
- Write up a short README / project report covering problem statement, architecture, and results (useful if this feeds into a patent filing or project submission, similar to your MediLink documentation)

---

## Suggested Timeline Summary

| Phase | Duration | Can run in parallel with |
|---|---|---|
| 0. Planning | Week 1 | — |
| 1. Hardware bring-up | Weeks 1–2 | — |
| 2. Firmware | Weeks 2–4 | Phase 3 |
| 3. Backend | Weeks 3–5 | Phase 2, 4 |
| 4. App | Weeks 4–7 | Phase 3 |
| 5. Integration testing | Weeks 7–8 | — |
| 6. Physical build | Weeks 8–9 (or earlier) | Phase 2–4 |
| 7. Polish & demo | Weeks 9–10 | — |

**Total: ~10 weeks** for a solo builder working part-time; compressible to 4–5 weeks with a small team splitting hardware/firmware, backend, and app work in parallel.

---

## Future Scope (post-MVP, from your roadmap)

Once the core loop works, the presentation's "Future Scope" items are good next milestones in priority order:
1. Multiple bag support (data model already allows this — just add a `bags` table)
2. Geo-fencing/location alerts (needs GPS module or phone-based geofencing)
3. Cloud analytics dashboard (most-forgotten items, usage patterns)
4. AI-powered computer vision item recognition (replaces RFID tagging requirement — biggest lift, needs a camera module and a vision model)
5. Anti-theft motion detection
6. Solar/energy harvesting for battery life
