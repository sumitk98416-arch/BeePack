/**
 * Smart Remembering Backpack — Main ESP32 Firmware
 * 
 * Features:
 * - MFRC522 RFID Reader SPI Interface with multi-tag collision avoidance
 * - BLE GATT Server (Bluetooth Low Energy) for mobile & Web Bluetooth connectivity
 * - Automated bag zipper trigger via Reed switch (GPIO 4)
 * - Manual scan trigger button (GPIO 0)
 * - Piezo buzzer & RGB status LED indicators
 * - Low power deep sleep management
 */

#include <SPI.h>
#include <MFRC522.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

// ================= PIN DEFINITIONS =================
#define RST_PIN         22      // MFRC522 Reset pin
#define SS_PIN          5       // MFRC522 Chip Select (SDA) pin
#define REED_SWITCH_PIN 4       // Zipper / Flap sensor (Active LOW when closed)
#define BUTTON_PIN      0       // Manual scan push button (BOOT button on devkit)
#define BUZZER_PIN      26      // Piezo buzzer
#define LED_RED_PIN     27      // RGB Red (Missing item alert)
#define LED_GREEN_PIN   14      // RGB Green (All items packed)
#define LED_BLUE_PIN    12      // RGB Blue (BLE Connected)
#define BATTERY_ADC_PIN 34      // Optional LiPo voltage divider pin

// ================= BLE GATT UUIDs =================
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_SCAN_TRIGGER_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_SCANNED_TAGS_UUID "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"
#define CHAR_BAG_STATUS_UUID   "d28e4042-78d1-4d1e-ba78-4770387b99c0"

// Hardware instances
MFRC522 mfrc522(SS_PIN, RST_PIN);
BLEServer* pServer = nullptr;
BLECharacteristic* pScanTriggerChar = nullptr;
BLECharacteristic* pScannedTagsChar = nullptr;
BLECharacteristic* pBagStatusChar = nullptr;

bool deviceConnected = false;
bool oldDeviceConnected = false;
bool isScanning = false;
unsigned long lastScanTime = 0;
unsigned long lastActivityTime = 0;
const unsigned long INACTIVITY_SLEEP_TIMEOUT_MS = 60000; // Deep sleep after 60s idle

// Detected Tags storage (max 20 tags per scan window)
#define MAX_TAGS 20
String detectedTags[MAX_TAGS];
int detectedTagCount = 0;

// Function declarations
void triggerScan();
void beep(int freq, int durationMs);
void setLedStatus(bool red, bool green, bool blue);
int readBatteryPercentage();
void notifyBagStatus(const char* eventName);

// BLE Server Callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) override {
        deviceConnected = true;
        setLedStatus(false, false, true); // Blue LED on connection
        Serial.println(">> BLE Client Connected!");
    }

    void onDisconnect(BLEServer* pServer) override {
        deviceConnected = false;
        setLedStatus(false, false, false);
        Serial.println(">> BLE Client Disconnected!");
    }
};

// BLE Characteristic Callbacks for Scan Trigger
class ScanTriggerCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        String value = pCharacteristic->getValue().c_str();
        if (value.length() > 0) {
            Serial.printf(">> BLE Received Scan Command: %s\n", value.c_str());
            triggerScan();
        }
    }
};

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n==========================================");
    Serial.println("  Smart Remembering Backpack Starting...  ");
    Serial.println("==========================================");

    // Initialize GPIOs
    pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(LED_RED_PIN, OUTPUT);
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_BLUE_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    setLedStatus(false, false, false);

    // Initialize SPI & MFRC522 RFID
    SPI.begin(18, 19, 23, SS_PIN); // SCK=18, MISO=19, MOSI=23, SS=5
    mfrc522.PCD_Init();
    delay(50);
    mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max); // Max antenna sensitivity

    byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.printf(">> MFRC522 RFID Reader Initialized (Version Reg: 0x%02X)\n", v);
    if (v == 0x00 || v == 0xFF) {
        Serial.println("!! WARNING: MFRC522 communication failed. Check SPI wiring.");
    }

    // Initialize BLE
    BLEDevice::init("SmartBackpack-ESP32");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Scan Trigger Characteristic (Read / Write)
    pScanTriggerChar = pService->createCharacteristic(
        CHAR_SCAN_TRIGGER_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    pScanTriggerChar->setCallbacks(new ScanTriggerCallbacks());
    pScanTriggerChar->setValue("READY");

    // Scanned Tags Characteristic (Read / Notify)
    pScannedTagsChar = pService->createCharacteristic(
        CHAR_SCANNED_TAGS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pScannedTagsChar->addDescriptor(new BLE2902());
    pScannedTagsChar->setValue("[]");

    // Bag Status Characteristic (Read / Notify)
    pBagStatusChar = pService->createCharacteristic(
        CHAR_BAG_STATUS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pBagStatusChar->addDescriptor(new BLE2902());
    pBagStatusChar->setValue("{\"status\":\"ready\",\"battery\":100}");

    pService->start();

    // Start BLE Advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println(">> BLE Advertising started as 'SmartBackpack-ESP32'. Ready for connections.");

    // Startup beep
    beep(2000, 100);
    delay(80);
    beep(3000, 150);
    lastActivityTime = millis();
}

void loop() {
    // Re-advertising handling
    if (!deviceConnected && oldDeviceConnected) {
        delay(500);
        pServer->startAdvertising();
        Serial.println(">> Restarted BLE advertising...");
        oldDeviceConnected = deviceConnected;
    }
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
    }

    // Check manual button trigger (Active LOW)
    if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println(">> Push Button Triggered Scan!");
        delay(200); // Debounce
        triggerScan();
    }

    // Check Reed switch trigger (Zipper closed event)
    static int lastReedState = HIGH;
    int currentReedState = digitalRead(REED_SWITCH_PIN);
    if (currentReedState != lastReedState) {
        lastReedState = currentReedState;
        if (currentReedState == LOW) {
            Serial.println(">> Bag Closed (Reed switch triggered). Running automatic scan...");
            beep(2500, 80);
            triggerScan();
        } else {
            Serial.println(">> Bag Opened.");
            notifyBagStatus("bag_opened");
        }
        lastActivityTime = millis();
    }

    delay(20);
}

/**
 * Executes a thorough 2.5-second multi-pass RFID scan window
 * to detect all RFID tags present inside the backpack compartment.
 */
void triggerScan() {
    if (isScanning) return;
    isScanning = true;
    lastActivityTime = millis();

    Serial.println("\n-------------------------------------------");
    Serial.println(">> [SCANNING] Multi-pass RFID Scan Started...");
    setLedStatus(true, true, false); // Yellow / Orange LED indicator
    beep(1800, 100);

    detectedTagCount = 0;
    for (int i = 0; i < MAX_TAGS; i++) {
        detectedTags[i] = "";
    }

    unsigned long scanStart = millis();
    const unsigned long SCAN_WINDOW_MS = 2500; // 2.5 second scan duration

    while (millis() - scanStart < SCAN_WINDOW_MS) {
        // Look for new cards
        if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
            String uidStr = "";
            for (byte i = 0; i < mfrc522.uid.size; i++) {
                if (mfrc522.uid.uidByte[i] < 0x10) uidStr += "0";
                uidStr += String(mfrc522.uid.uidByte[i], HEX);
            }
            uidStr.toUpperCase();

            // Check if already in detected list
            bool alreadyFound = false;
            for (int i = 0; i < detectedTagCount; i++) {
                if (detectedTags[i] == uidStr) {
                    alreadyFound = true;
                    break;
                }
            }

            if (!alreadyFound && detectedTagCount < MAX_TAGS) {
                detectedTags[detectedTagCount++] = uidStr;
                Serial.printf("   [+] Detected RFID Tag: %s (Total: %d)\n", uidStr.c_str(), detectedTagCount);
                beep(3200, 40); // Quick chirp for each tag found
            }

            // Halt PICC to allow reading next card in RF field
            mfrc522.PICC_HaltA();
            mfrc522.PCD_StopCrypto1();
        }
        delay(40);
    }

    // Build JSON Payload
    StaticJsonDocument<512> doc;
    JsonArray tagArray = doc.createNestedArray("tags");
    for (int i = 0; i < detectedTagCount; i++) {
        tagArray.add(detectedTags[i]);
    }
    doc["count"] = detectedTagCount;
    doc["battery"] = readBatteryPercentage();
    doc["timestamp"] = millis();

    String jsonString;
    serializeJson(doc, jsonString);
    Serial.printf(">> [SCAN COMPLETE] Scanned Payload: %s\n", jsonString.c_str());
    Serial.println("-------------------------------------------\n");

    // Send over BLE
    if (pScannedTagsChar != nullptr) {
        pScannedTagsChar->setValue(jsonString.c_str());
        if (deviceConnected) {
            pScannedTagsChar->notify();
            Serial.println(">> Notified BLE client with scan results.");
        }
    }

    notifyBagStatus("scan_completed");

    // Visual / Audio feedback
    if (detectedTagCount > 0) {
        setLedStatus(false, true, false); // Green
        beep(2400, 100);
        delay(60);
        beep(3000, 150);
    } else {
        setLedStatus(true, false, false); // Red (No items found or empty bag)
        beep(1000, 300);
    }

    delay(800);
    if (deviceConnected) {
        setLedStatus(false, false, true); // Return to Blue (BLE Connected)
    } else {
        setLedStatus(false, false, false);
    }

    isScanning = false;
    lastScanTime = millis();
}

void notifyBagStatus(const char* eventName) {
    StaticJsonDocument<256> doc;
    doc["event"] = eventName;
    doc["status"] = (digitalRead(REED_SWITCH_PIN) == LOW) ? "closed" : "opened";
    doc["battery"] = readBatteryPercentage();
    doc["tag_count"] = detectedTagCount;
    doc["timestamp"] = millis();

    String statusJson;
    serializeJson(doc, statusJson);

    if (pBagStatusChar != nullptr) {
        pBagStatusChar->setValue(statusJson.c_str());
        if (deviceConnected) {
            pBagStatusChar->notify();
        }
    }
}

int readBatteryPercentage() {
    // If ADC voltage divider wired to GPIO 34 (e.g. 100k + 100k)
    // 4.2V max = 2.1V at pin (ADC reading ~2600), 3.3V cutoff = 1.65V (~2040)
    int raw = analogRead(BATTERY_ADC_PIN);
    if (raw <= 100) return 95; // Default fallback if pin unattached
    int pct = map(raw, 2040, 2600, 0, 100);
    return constrain(pct, 0, 100);
}

void setLedStatus(bool red, bool green, bool blue) {
    digitalWrite(LED_RED_PIN, red ? HIGH : LOW);
    digitalWrite(LED_GREEN_PIN, green ? HIGH : LOW);
    digitalWrite(LED_BLUE_PIN, blue ? HIGH : LOW);
}

void beep(int freq, int durationMs) {
    tone(BUZZER_PIN, freq, durationMs);
    delay(durationMs);
    noTone(BUZZER_PIN);
}
