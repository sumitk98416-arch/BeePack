/**
 * RFID UID Scanner & Tag Registration Utility Sketch
 * 
 * Purpose:
 * Use this quick sketch during Phase 1 (Hardware Bring-up) to scan all your RFID tags
 * and view their unique hex UIDs formatted and ready to copy-paste into your packing lists.
 */

#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN 22
#define SS_PIN  5

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
    Serial.begin(115200);
    while (!Serial);
    delay(500);

    Serial.println("\n=======================================================");
    Serial.println("  Smart Backpack — RFID UID Scanner & Tag Inspector    ");
    Serial.println("=======================================================");
    Serial.println("Hold each RFID sticker / card near the MFRC522 antenna...\n");

    SPI.begin(18, 19, 23, SS_PIN);
    mfrc522.PCD_Init();
    delay(50);
    mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);

    byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.printf("[INFO] MFRC522 Chip Version: 0x%02X (Expected 0x92 or 0x91)\n", v);
    if (v == 0x00 || v == 0xFF) {
        Serial.println("[ERROR] Communication failed! Check 3.3V, GND, MOSI, MISO, SCK, SS pins.");
    }
}

void loop() {
    if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
        delay(50);
        return;
    }

    String uidHex = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) uidHex += "0";
        uidHex += String(mfrc522.uid.uidByte[i], HEX);
    }
    uidHex.toUpperCase();

    MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);

    Serial.println("-------------------------------------------------------");
    Serial.printf(">> NEW TAG DETECTED!\n");
    Serial.printf("   Tag UID (HEX)  : %s\n", uidHex.c_str());
    Serial.printf("   UID Length     : %d bytes\n", mfrc522.uid.size);
    Serial.printf("   PICC Type      : %s\n", mfrc522.PICC_GetTypeName(piccType));
    Serial.printf("   JSON Snippet   : {\"name\": \"Item Name\", \"rfid_tag_id\": \"%s\"}\n", uidHex.c_str());
    Serial.println("-------------------------------------------------------\n");

    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(800); // Prevent spamming
}
