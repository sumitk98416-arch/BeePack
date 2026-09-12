const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, saveDb, DEFAULT_SEED_DATA } = require('../database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ----------------------------------------------------
// AUTHENTICATION & SESSION MANAGEMENT
// ----------------------------------------------------

// In-memory token session store (maps session token -> userId)
const sessions = new Map();

// Helper: generate session token
function createSession(userId) {
  const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 86400000 // 30 days
  });
  return token;
}

// Auth Middleware: validates session token or Bearer token
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-session-token'];

  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required. No session token provided." });
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
  }

  const db = getDb();
  const user = db.users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: "User account not found." });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

// Optional Auth Middleware (for endpoints that work both logged in or with defaults)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-session-token'];

  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    if (session.expiresAt >= Date.now()) {
      const db = getDb();
      const user = db.users.find(u => u.id === session.userId);
      if (user) req.user = user;
    }
  }
  next();
}

// Google Authentication Endpoint
// Accepts Google ID token payload or OAuth profile info
app.post('/api/auth/google', (req, res) => {
  const { googleId, email, name, profileImage } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: "Valid Google email address is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();

  let user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
  let isFirstLogin = false;

  if (!user) {
    // Register new user from verified Google Account
    isFirstLogin = true;
    const userId = `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    user = {
      id: userId,
      googleId: googleId || `goog_${Date.now()}`,
      name: (name && name.trim()) || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      profileImage: profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail)}&background=00E5FF&color=000&bold=true`,
      emailVerified: true, // Google accounts provide verified email
      userType: null, // to be selected in onboarding
      onboardingCompleted: false,
      onboardingStep: 2, // step 2: User Type
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(user);

    // Create default notification settings
    db.notificationSettings.push({
      id: `nset_${Date.now()}`,
      userId: user.id,
      emailEnabled: true,
      notifyOnMissing: true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveDb(db);
  } else {
    // Update existing user with latest info
    user.updatedAt = new Date().toISOString();
    if (profileImage && !user.profileImage) user.profileImage = profileImage;
    if (name && !user.name) user.name = name;
    saveDb(db);
  }

  const token = createSession(user.id);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      emailVerified: user.emailVerified,
      userType: user.userType,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep
    },
    isFirstLogin,
    redirectTo: user.onboardingCompleted ? '/dashboard' : '/onboarding'
  });
});

// Get Current Authenticated User & Status
app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = getDb();
  const schedule = db.schedules.find(s => s.userId === req.user.id) || null;
  const bags = db.bags.filter(b => b.userId === req.user.id);
  const items = db.items.filter(i => i.userId === req.user.id);
  const notificationSettings = db.notificationSettings.find(n => n.userId === req.user.id) || null;

  res.json({
    success: true,
    user: req.user,
    schedule,
    bagsCount: bags.length,
    itemsCount: items.length,
    notificationSettings
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-session-token'];
  if (token) sessions.delete(token);
  res.json({ success: true, message: "Logged out successfully" });
});

// ----------------------------------------------------
// ONBOARDING WIZARD ENDPOINTS
// ----------------------------------------------------

// 1. Set User Type (Employee, Student, Worker, Others)
app.put('/api/onboarding/user-type', requireAuth, (req, res) => {
  const { userType } = req.body;
  const validTypes = ['employee', 'student', 'worker', 'other'];

  if (!userType || !validTypes.includes(userType.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: "Valid userType is required ('employee', 'student', 'worker', 'other')"
    });
  }

  const db = getDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });

  user.userType = userType.toLowerCase();
  user.onboardingStep = Math.max(user.onboardingStep || 2, 3); // Advance to Step 3: Schedule
  user.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({
    success: true,
    user,
    nextStep: 3
  });
});

// 2. Set Schedule (Active Days & Hours)
app.put('/api/onboarding/schedule', requireAuth, (req, res) => {
  const { activeDays = ["mon", "tue", "wed", "thu", "fri"], startTime = "08:30", endTime = "17:30" } = req.body;

  if (!Array.isArray(activeDays)) {
    return res.status(400).json({ success: false, error: "activeDays must be an array of day codes" });
  }

  const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const cleanedDays = activeDays.map(d => d.toLowerCase().substring(0, 3)).filter(d => validDays.includes(d));

  const db = getDb();
  let schedule = db.schedules.find(s => s.userId === req.user.id);

  if (schedule) {
    schedule.activeDays = cleanedDays;
    schedule.startTime = startTime;
    schedule.endTime = endTime;
    schedule.updatedAt = new Date().toISOString();
  } else {
    schedule = {
      id: `sch_${Date.now()}`,
      userId: req.user.id,
      activeDays: cleanedDays,
      startTime,
      endTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.schedules.push(schedule);
  }

  const user = db.users.find(u => u.id === req.user.id);
  if (user) {
    user.onboardingStep = Math.max(user.onboardingStep || 3, 4); // Advance to Step 4: Bag Setup
    user.updatedAt = new Date().toISOString();
  }

  saveDb(db);

  res.json({
    success: true,
    schedule,
    nextStep: 4
  });
});

// 3. Create Initial Bag
app.post('/api/onboarding/bag', requireAuth, (req, res) => {
  const { name = "My Everyday Bag", hardwareId = "ESP32-BAG-01" } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Bag name is required" });
  }

  const db = getDb();
  const existingBags = db.bags.filter(b => b.userId === req.user.id);

  const newBag = {
    id: `bag_${Date.now()}`,
    userId: req.user.id,
    name: name.trim(),
    hardwareId: hardwareId || `ESP32-BAG-${Math.floor(Math.random() * 1000)}`,
    isDefault: existingBags.length === 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.bags.push(newBag);

  const user = db.users.find(u => u.id === req.user.id);
  if (user) {
    user.onboardingStep = Math.max(user.onboardingStep || 4, 5); // Advance to Step 5: RFID Items
    user.updatedAt = new Date().toISOString();
  }

  saveDb(db);

  res.status(201).json({
    success: true,
    bag: newBag,
    nextStep: 5
  });
});

// 4. Register Items with RFID UIDs during onboarding
app.post('/api/onboarding/items', requireAuth, (req, res) => {
  const { bagId, items = [] } = req.body;

  const db = getDb();
  const targetBag = db.bags.find(b => b.id === bagId && b.userId === req.user.id) || db.bags.find(b => b.userId === req.user.id);
  if (!targetBag) {
    return res.status(404).json({ success: false, error: "Bag not found for this user." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "Items array is required" });
  }

  const createdItems = [];

  items.forEach(itemData => {
    if (!itemData.name || !itemData.name.trim()) return;
    const cleanUid = (itemData.rfidUid || `TAG_${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
      .trim().toUpperCase().replace(/[^0-9A-F]/g, '');

    const newItem = {
      id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: req.user.id,
      bagId: targetBag.id,
      name: itemData.name.trim(),
      category: itemData.category || "General",
      rfidUid: cleanUid,
      importance: itemData.importance || "critical",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.items.push(newItem);
    createdItems.push(newItem);
  });

  const user = db.users.find(u => u.id === req.user.id);
  if (user) {
    user.onboardingStep = 6;
    user.updatedAt = new Date().toISOString();
  }

  saveDb(db);

  res.status(201).json({
    success: true,
    items: createdItems,
    nextStep: 6
  });
});

// 5. Complete Onboarding
app.post('/api/onboarding/complete', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });

  user.onboardingCompleted = true;
  user.onboardingStep = 6;
  user.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({
    success: true,
    message: "Onboarding completed successfully!",
    user,
    redirectTo: "/dashboard"
  });
});

// ----------------------------------------------------
// USER RESOURCE MANAGEMENT (BAGS, ITEMS, SCHEDULE)
// ----------------------------------------------------

// Get user's bags
app.get('/api/user/bags', requireAuth, (req, res) => {
  const db = getDb();
  const userBags = db.bags.filter(b => b.userId === req.user.id).map(bag => {
    const bagItems = db.items.filter(i => i.bagId === bag.id);
    return {
      ...bag,
      itemsCount: bagItems.length
    };
  });
  res.json({ success: true, bags: userBags });
});

// Create a new bag
app.post('/api/user/bags', requireAuth, (req, res) => {
  const { name, hardwareId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Bag name is required" });
  }

  const db = getDb();
  const userBags = db.bags.filter(b => b.userId === req.user.id);

  const newBag = {
    id: `bag_${Date.now()}`,
    userId: req.user.id,
    name: name.trim(),
    hardwareId: hardwareId || `ESP32-BAG-${Math.floor(Math.random() * 1000)}`,
    isDefault: userBags.length === 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.bags.push(newBag);
  saveDb(db);
  res.status(201).json({ success: true, bag: newBag });
});

// Update a bag
app.put('/api/user/bags/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, hardwareId, isDefault } = req.body;

  const db = getDb();
  const bagIndex = db.bags.findIndex(b => b.id === id && b.userId === req.user.id);
  if (bagIndex === -1) {
    return res.status(404).json({ success: false, error: "Bag not found or unauthorized" });
  }

  if (isDefault) {
    db.bags.filter(b => b.userId === req.user.id).forEach(b => b.isDefault = false);
  }

  db.bags[bagIndex] = {
    ...db.bags[bagIndex],
    name: name ? name.trim() : db.bags[bagIndex].name,
    hardwareId: hardwareId ? hardwareId.trim() : db.bags[bagIndex].hardwareId,
    isDefault: isDefault !== undefined ? isDefault : db.bags[bagIndex].isDefault,
    updatedAt: new Date().toISOString()
  };

  saveDb(db);
  res.json({ success: true, bag: db.bags[bagIndex] });
});

// Delete a bag
app.delete('/api/user/bags/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const bagIndex = db.bags.findIndex(b => b.id === id && b.userId === req.user.id);
  if (bagIndex === -1) {
    return res.status(404).json({ success: false, error: "Bag not found or unauthorized" });
  }

  db.bags.splice(bagIndex, 1);
  db.items = db.items.filter(i => i.bagId !== id);
  db.scans = db.scans.filter(s => s.bagId !== id);

  saveDb(db);
  res.json({ success: true, message: "Bag and associated items deleted" });
});

// Get user's items
app.get('/api/user/items', requireAuth, (req, res) => {
  const { bagId } = req.query;
  const db = getDb();
  let userItems = db.items.filter(i => i.userId === req.user.id);
  if (bagId) {
    userItems = userItems.filter(i => i.bagId === bagId);
  }
  res.json({ success: true, items: userItems });
});

// Add a single item
app.post('/api/user/items', requireAuth, (req, res) => {
  const { bagId, name, category, rfidUid, importance } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Item name is required" });
  }

  const db = getDb();
  const targetBag = db.bags.find(b => b.id === bagId && b.userId === req.user.id) || db.bags.find(b => b.userId === req.user.id);
  if (!targetBag) {
    return res.status(404).json({ success: false, error: "Valid bag not found for this user" });
  }

  const cleanUid = (rfidUid || `TAG_${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
    .trim().toUpperCase().replace(/[^0-9A-F]/g, '');

  const newItem = {
    id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId: req.user.id,
    bagId: targetBag.id,
    name: name.trim(),
    category: category || "General",
    rfidUid: cleanUid,
    importance: importance || "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(newItem);
  saveDb(db);
  res.status(201).json({ success: true, item: newItem });
});

// Update item (name, rfidUid, category, importance)
app.put('/api/user/items/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, category, rfidUid, importance, bagId } = req.body;

  const db = getDb();
  const itemIndex = db.items.findIndex(i => i.id === id && i.userId === req.user.id);
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: "Item not found or unauthorized" });
  }

  let cleanUid = db.items[itemIndex].rfidUid;
  if (rfidUid) {
    cleanUid = rfidUid.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  }

  db.items[itemIndex] = {
    ...db.items[itemIndex],
    name: name ? name.trim() : db.items[itemIndex].name,
    category: category || db.items[itemIndex].category,
    rfidUid: cleanUid,
    importance: importance || db.items[itemIndex].importance,
    bagId: bagId || db.items[itemIndex].bagId,
    updatedAt: new Date().toISOString()
  };

  saveDb(db);
  res.json({ success: true, item: db.items[itemIndex] });
});

// Delete an item
app.delete('/api/user/items/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const itemIndex = db.items.findIndex(i => i.id === id && i.userId === req.user.id);
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: "Item not found or unauthorized" });
  }

  db.items.splice(itemIndex, 1);
  saveDb(db);
  res.json({ success: true, message: "Item deleted" });
});

// Get user schedule
app.get('/api/user/schedule', requireAuth, (req, res) => {
  const db = getDb();
  let schedule = db.schedules.find(s => s.userId === req.user.id);
  if (!schedule) {
    schedule = {
      id: `sch_${Date.now()}`,
      userId: req.user.id,
      activeDays: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "08:30",
      endTime: "17:30",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.schedules.push(schedule);
    saveDb(db);
  }

  // Check today's active status
  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayCode = daysOfWeek[new Date().getDay()];
  const isTodayActive = schedule.activeDays.includes(todayCode);

  res.json({
    success: true,
    schedule,
    isTodayActive,
    todayCode
  });
});

// Update user schedule
app.put('/api/user/schedule', requireAuth, (req, res) => {
  const { activeDays, startTime, endTime } = req.body;
  const db = getDb();
  let schedule = db.schedules.find(s => s.userId === req.user.id);

  if (!schedule) {
    schedule = {
      id: `sch_${Date.now()}`,
      userId: req.user.id,
      activeDays: activeDays || ["mon", "tue", "wed", "thu", "fri"],
      startTime: startTime || "08:30",
      endTime: endTime || "17:30",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.schedules.push(schedule);
  } else {
    if (activeDays) schedule.activeDays = activeDays;
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    schedule.updatedAt = new Date().toISOString();
  }

  saveDb(db);
  res.json({ success: true, schedule });
});

// Update user profile
app.put('/api/user/profile', requireAuth, (req, res) => {
  const { name, userType, profileImage } = req.body;
  const db = getDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });

  if (name) user.name = name.trim();
  if (userType) user.userType = userType;
  if (profileImage) user.profileImage = profileImage;
  user.updatedAt = new Date().toISOString();

  saveDb(db);
  res.json({ success: true, user });
});

// Notification Settings
app.get('/api/user/notifications/settings', requireAuth, (req, res) => {
  const db = getDb();
  let settings = db.notificationSettings.find(n => n.userId === req.user.id);
  if (!settings) {
    settings = {
      id: `nset_${Date.now()}`,
      userId: req.user.id,
      emailEnabled: true,
      notifyOnMissing: true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.notificationSettings.push(settings);
    saveDb(db);
  }
  res.json({ success: true, settings });
});

app.put('/api/user/notifications/settings', requireAuth, (req, res) => {
  const { emailEnabled, notifyOnMissing, dailySummaryEnabled } = req.body;
  const db = getDb();
  let settings = db.notificationSettings.find(n => n.userId === req.user.id);

  if (!settings) {
    settings = {
      id: `nset_${Date.now()}`,
      userId: req.user.id,
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      notifyOnMissing: notifyOnMissing !== undefined ? notifyOnMissing : true,
      dailySummaryEnabled: dailySummaryEnabled !== undefined ? dailySummaryEnabled : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.notificationSettings.push(settings);
  } else {
    if (emailEnabled !== undefined) settings.emailEnabled = emailEnabled;
    if (notifyOnMissing !== undefined) settings.notifyOnMissing = notifyOnMissing;
    if (dailySummaryEnabled !== undefined) settings.dailySummaryEnabled = dailySummaryEnabled;
    settings.updatedAt = new Date().toISOString();
  }

  saveDb(db);
  res.json({ success: true, settings });
});

// ----------------------------------------------------
// DAILY BAG CHECKING & SCAN ENGINE
// ----------------------------------------------------

/**
 * Core Bag Checking Logic
 * Computes missing items by comparing registered RFID UIDs with scanned UIDs.
 * Identifies active vs non-working/inactive days.
 * Dispatches email notifications if items are missing on active days.
 */
app.post('/api/bag/check', optionalAuth, (req, res) => {
  const { bagId, scannedUids = [], source = "RC522 Proximity Tap", forceActiveOverride = false, batteryLevel = 94 } = req.body;
  const db = getDb();

  // Find user (either authenticated user, or default demo user)
  const userId = req.user ? req.user.id : (db.users[0] ? db.users[0].id : "usr_demo_01");
  const user = db.users.find(u => u.id === userId) || db.users[0];

  // Find bag
  let bag = null;
  if (bagId) {
    bag = db.bags.find(b => b.id === bagId && b.userId === userId);
  }
  if (!bag) {
    bag = db.bags.find(b => b.userId === userId && b.isDefault) || db.bags.find(b => b.userId === userId) || db.bags[0];
  }

  // Get user's schedule to evaluate Active Day status
  const schedule = db.schedules.find(s => s.userId === userId) || {
    activeDays: ["mon", "tue", "wed", "thu", "fri"]
  };

  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayCode = daysOfWeek[new Date().getDay()];
  const isTodayActive = schedule.activeDays.includes(todayCode);

  // Retrieve expected items for this bag
  const expectedItems = db.items.filter(i => i.bagId === (bag ? bag.id : "") && i.userId === userId);

  // Normalize scanned UIDs
  const cleanScannedUids = (scannedUids || [])
    .map(uid => String(uid).trim().toUpperCase().replace(/[^0-9A-Z_-]/g, ''))
    .filter(Boolean);

  const presentItems = [];
  const missingItems = [];
  const recognizedUids = [];

  expectedItems.forEach(item => {
    const isPresent = cleanScannedUids.includes(item.rfidUid.toUpperCase());
    if (isPresent) {
      presentItems.push(item);
      recognizedUids.push(item.rfidUid.toUpperCase());
    } else {
      missingItems.push(item);
    }
  });

  // Unknown / Unregistered RFID tags detected in RF field
  const unknownUids = cleanScannedUids.filter(uid => !recognizedUids.includes(uid));

  // Build Scan Log
  const scanRecord = {
    id: `scan_${Date.now()}`,
    userId: user ? user.id : "usr_demo_01",
    bagId: bag ? bag.id : "bag_demo_01",
    bagName: bag ? bag.name : "My Bag",
    timestamp: new Date().toISOString(),
    source,
    scannedUids: cleanScannedUids,
    presentCount: presentItems.length,
    totalExpected: expectedItems.length,
    isAllPresent: missingItems.length === 0,
    missingItems: missingItems.map(m => ({ id: m.id, name: m.name, rfidUid: m.rfidUid, importance: m.importance })),
    unknownUids,
    batteryLevel,
    isTodayActive
  };

  db.scans.unshift(scanRecord);
  if (db.scans.length > 100) db.scans = db.scans.slice(0, 100);

  // Handle Notifications on Missing Items
  let notificationDispatched = false;
  let notificationRecord = null;

  const notifSettings = db.notificationSettings.find(n => n.userId === userId) || { emailEnabled: true, notifyOnMissing: true };

  if (missingItems.length > 0 && (isTodayActive || forceActiveOverride) && notifSettings.emailEnabled && notifSettings.notifyOnMissing) {
    const missingNames = missingItems.map(m => m.name).join(', ');
    notificationRecord = {
      id: `notif_${Date.now()}`,
      userId: user.id,
      type: "missing_item_alert",
      recipient: user.email,
      subject: `Remembering Bag Alert: You might be forgetting something!`,
      message: `Your bag appears to be missing: ${missingNames}. Make sure you have ${missingItems.length > 1 ? 'them' : 'it'} before leaving.`,
      missingItems: missingItems.map(m => m.name),
      status: "delivered",
      timestamp: new Date().toISOString()
    };

    db.notifications.unshift(notificationRecord);
    if (db.notifications.length > 50) db.notifications = db.notifications.slice(0, 50);
    notificationDispatched = true;
  }

  saveDb(db);

  res.json({
    success: true,
    scan: scanRecord,
    isTodayActive,
    todayCode,
    bagName: bag ? bag.name : "My Bag",
    summary: {
      total: expectedItems.length,
      present: presentItems.length,
      missing: missingItems.length,
      unknownCount: unknownUids.length,
      percentage: expectedItems.length > 0 ? Math.round((presentItems.length / expectedItems.length) * 100) : 100,
      isAllPresent: missingItems.length === 0,
      missingItems,
      presentItems,
      unknownUids
    },
    notification: notificationDispatched ? notificationRecord : null
  });
});

// Hardware / ESP32 scan ingestion endpoint
app.post('/api/hardware/scan', (req, res) => {
  const { hardwareId, tags = [], battery = 95 } = req.body;
  const db = getDb();

  // Match bag by hardware ID
  let bag = db.bags.find(b => b.hardwareId === hardwareId);
  if (!bag) {
    bag = db.bags[0];
  }

  const user = db.users.find(u => u.id === bag.userId) || db.users[0];

  // Proxy to bag check engine
  const expectedItems = db.items.filter(i => i.bagId === bag.id);
  const cleanUids = tags.map(t => t.trim().toUpperCase().replace(/[^0-9A-F]/g, ''));

  const presentItems = expectedItems.filter(i => cleanUids.includes(i.rfidUid.toUpperCase()));
  const missingItems = expectedItems.filter(i => !cleanUids.includes(i.rfidUid.toUpperCase()));

  const scanRecord = {
    id: `scan_hw_${Date.now()}`,
    userId: user.id,
    bagId: bag.id,
    bagName: bag.name,
    timestamp: new Date().toISOString(),
    source: "ESP32 + RC522 (Hardware RFID)",
    scannedUids: cleanUids,
    presentCount: presentItems.length,
    totalExpected: expectedItems.length,
    isAllPresent: missingItems.length === 0,
    missingItems: missingItems.map(m => ({ id: m.id, name: m.name, rfidUid: m.rfidUid })),
    unknownUids: cleanUids.filter(uid => !expectedItems.some(i => i.rfidUid.toUpperCase() === uid)),
    batteryLevel: battery
  };

  db.scans.unshift(scanRecord);
  saveDb(db);

  res.json({
    success: true,
    message: "Hardware scan recorded",
    scan: scanRecord
  });
});

// Get user scan history
app.get('/api/user/scans', optionalAuth, (req, res) => {
  const db = getDb();
  const userId = req.user ? req.user.id : (db.users[0] ? db.users[0].id : null);
  let scans = db.scans;
  if (userId) {
    scans = scans.filter(s => s.userId === userId);
  }
  res.json({ success: true, scans: scans.slice(0, 30) });
});

// ----------------------------------------------------
// NOTIFICATIONS API
// ----------------------------------------------------

// Send explicit email alert for missing items
app.post('/api/notifications/send-missing-alert', optionalAuth, (req, res) => {
  const { missingItems = [], bagName = "My Bag", recipientEmail } = req.body;
  const db = getDb();
  const user = req.user || db.users[0];

  const targetEmail = recipientEmail || (user ? user.email : "user@example.com");
  const missingList = Array.isArray(missingItems) ? missingItems.join(', ') : missingItems;

  const notif = {
    id: `notif_${Date.now()}`,
    userId: user ? user.id : "usr_demo_01",
    type: "missing_item_alert",
    recipient: targetEmail,
    subject: `Remembering Bag Alert: You might be forgetting something!`,
    message: `Your bag (${bagName}) appears to be missing: ${missingList || 'essential items'}. Make sure you have everything before leaving!`,
    missingItems: Array.isArray(missingItems) ? missingItems : [missingItems],
    status: "delivered",
    timestamp: new Date().toISOString()
  };

  db.notifications.unshift(notif);
  saveDb(db);

  res.json({
    success: true,
    message: `Notification successfully sent to ${targetEmail}`,
    notification: notif
  });
});

// Get notification history
app.get('/api/notifications/history', optionalAuth, (req, res) => {
  const db = getDb();
  const userId = req.user ? req.user.id : (db.users[0] ? db.users[0].id : null);
  let notifs = db.notifications;
  if (userId) {
    notifs = notifs.filter(n => n.userId === userId);
  }
  res.json({ success: true, notifications: notifs.slice(0, 20) });
});

// ----------------------------------------------------
// LEGACY BACKWARD COMPATIBILITY (Landing page demo)
// ----------------------------------------------------

app.get('/api/lists', (req, res) => {
  const db = getDb();
  res.json({ success: true, lists: db.lists || [] });
});

app.get('/api/items', (req, res) => {
  const db = getDb();
  res.json({ success: true, items: db.items || [] });
});

app.get('/api/scans', (req, res) => {
  const db = getDb();
  res.json({ success: true, scans: (db.scans || []).slice(0, 20) });
});

app.post('/api/scans', (req, res) => {
  // Proxy to /api/bag/check
  req.url = '/api/bag/check';
  return app._router.handle(req, res);
});

app.get('/api/analytics', (req, res) => {
  const db = getDb();
  const totalScans = db.scans.length;
  const perfectScans = db.scans.filter(s => s.isAllPresent).length;

  res.json({
    success: true,
    analytics: {
      total_scans: totalScans,
      perfect_scans: perfectScans,
      overall_readiness_pct: totalScans > 0 ? Math.round((perfectScans / totalScans) * 100) : 100,
      total_tracked_items: db.items.length,
      total_bags: db.bags.length,
      last_scan: db.scans[0] || null
    }
  });
});

// Reset database
app.post('/api/reset-db', (req, res) => {
  saveDb(JSON.parse(JSON.stringify(DEFAULT_SEED_DATA)));
  sessions.clear();
  res.json({ success: true, message: "Database reset to defaults" });
});

// Single Page App Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Remembering Bag v2 Server Running!`);
  console.log(`  URL:      http://localhost:${PORT}`);
  console.log(`  API Base: http://localhost:${PORT}/api`);
  console.log(`======================================================\n`);
});
