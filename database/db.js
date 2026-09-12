const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'bag_database.json');

const DEFAULT_SEED_DATA = {
  users: [
    {
      id: "usr_demo_01",
      googleId: "google_10829482910481",
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      emailVerified: true,
      userType: "student",
      onboardingCompleted: true,
      onboardingStep: 6,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  schedules: [
    {
      id: "sch_demo_01",
      userId: "usr_demo_01",
      activeDays: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "08:30",
      endTime: "17:00",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  bags: [
    {
      id: "bag_demo_01",
      userId: "usr_demo_01",
      name: "My College Bag",
      hardwareId: "ESP32-BAG-01",
      isDefault: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  items: [
    {
      id: "item_01",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      name: "Laptop",
      category: "Electronics",
      rfidUid: "E2801160",
      importance: "critical",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "item_02",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      name: "Wallet",
      category: "Personal",
      rfidUid: "5D88C94B",
      importance: "critical",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "item_03",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      name: "Keys",
      category: "Personal",
      rfidUid: "C390E41A",
      importance: "critical",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "item_04",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      name: "Notebook",
      category: "Stationery",
      rfidUid: "A1B2C3D4",
      importance: "medium",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "item_05",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      name: "Charger",
      category: "Electronics",
      rfidUid: "7F3E2A10",
      importance: "medium",
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  scans: [
    {
      id: "scan_01",
      userId: "usr_demo_01",
      bagId: "bag_demo_01",
      bagName: "My College Bag",
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      source: "RC522 Proximity Reader",
      scannedUids: ["E2801160", "5D88C94B", "C390E41A", "7F3E2A10"],
      presentCount: 4,
      totalExpected: 5,
      isAllPresent: false,
      missingItems: [
        { id: "item_04", name: "Notebook", rfidUid: "A1B2C3D4", importance: "medium" }
      ],
      unknownUids: [],
      batteryLevel: 92
    }
  ],
  notifications: [
    {
      id: "notif_01",
      userId: "usr_demo_01",
      type: "missing_item_alert",
      recipient: "alex.rivera@example.com",
      subject: "Remembering Bag Alert: 1 item missing before leaving",
      message: "Your bag appears to be missing: Notebook. Make sure you have it before leaving for college today.",
      missingItems: ["Notebook"],
      status: "delivered",
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ],
  notificationSettings: [
    {
      id: "nset_demo_01",
      userId: "usr_demo_01",
      emailEnabled: true,
      notifyOnMissing: true,
      dailySummaryEnabled: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  // Legacy backward compatibility for lists
  lists: [
    {
      id: "list-college",
      name: "College List",
      icon: "graduation-cap",
      description: "Daily college classes, lectures and labs",
      is_default: true,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString()
    }
  ]
};

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_SEED_DATA, null, 2), 'utf-8');
  }
}

function getDb() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    
    // Ensure all collections exist
    if (!data.users) data.users = DEFAULT_SEED_DATA.users;
    if (!data.schedules) data.schedules = DEFAULT_SEED_DATA.schedules;
    if (!data.bags) data.bags = DEFAULT_SEED_DATA.bags;
    if (!data.items) data.items = DEFAULT_SEED_DATA.items;
    if (!data.scans) data.scans = DEFAULT_SEED_DATA.scans;
    if (!data.notifications) data.notifications = DEFAULT_SEED_DATA.notifications;
    if (!data.notificationSettings) data.notificationSettings = DEFAULT_SEED_DATA.notificationSettings;
    if (!data.lists) data.lists = DEFAULT_SEED_DATA.lists;

    return data;
  } catch (err) {
    console.error("Error reading database file, returning seed data fallback:", err);
    return JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
  }
}

function saveDb(data) {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  getDb,
  saveDb,
  DEFAULT_SEED_DATA
};
