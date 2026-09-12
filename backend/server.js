const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getDb, saveDb, DEFAULT_SEED_DATA } = require('../database/db');
const { dispatchNotification } = require('./notifications');
const { startScheduler, checkPendingReminders } = require('./reminder_scheduler');
const { sendEmail, sendBagOpenedEmail, sendBagClosedEmail, sendReminderEmail } = require('./email_service');

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
  const user = db.users.find(u => u.id === session.userId || u.userId === session.userId);
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
      const user = db.users.find(u => u.id === session.userId || u.userId === session.userId);
      if (user) req.user = user;
    }
  }
  next();
}

// Google Authentication Endpoint
// Accepts Google ID token payload or OAuth profile info
app.post('/api/auth/google', (req, res) => {
  let { googleId, email, name, profileImage, credential, idToken } = req.body;

  if (credential || idToken) {
    const token = credential || idToken;
    const decoded = parseFirebaseToken(token);
    if (decoded) {
      if (decoded.email) email = decoded.email;
      if (decoded.name && !name) name = decoded.name;
      if (decoded.picture && !profileImage) profileImage = decoded.picture;
      if (decoded.sub && !googleId) googleId = decoded.sub;
    }
  }

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
    const finalName = (name && name.trim()) || normalizedEmail.split('@')[0];
    const finalAvatar = profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=00E5FF&color=000&bold=true`;

    user = {
      id: userId,
      userId: userId,
      googleId: googleId || `goog_${Date.now()}`,
      name: finalName,
      username: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      avatar: finalAvatar,
      profileImage: finalAvatar,
      emailVerified: true, // Google accounts provide verified email
      useCase: "student",
      userType: "student",
      onboardingCompleted: false,
      onboardingStep: 2, // step 2: User Type
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(user);

    // Create default schedule
    db.schedules.push({
      id: `sch_${Date.now()}`,
      userId: user.id,
      day: ["mon", "tue", "wed", "thu", "fri"],
      activeDays: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "08:30",
      endTime: "17:00",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create default notification settings
    db.notificationSettings.push({
      id: `nset_${Date.now()}`,
      userId: user.id,
      emailEnabled: true,
      pushEnabled: true,
      notifyOnMissing: true,
      notifyOnBagEvents: true,
      notifyOnItemRemoved: true,
      notifyOnReminders: true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveDb(db);
  } else {
    // Update existing user with latest info
    user.updatedAt = new Date().toISOString();
    if (profileImage) {
      user.profileImage = profileImage;
      user.avatar = profileImage;
    }
    if (name && !user.name) user.name = name;
    if (!user.userId) user.userId = user.id;
    if (!user.avatar) user.avatar = user.profileImage;
    if (!user.useCase) user.useCase = user.userType || 'student';
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

// ====================================================
// BEEKPACK PERSON 2 SHARED CONTRACT APIS
// ====================================================

// Helper: decode Firebase ID Token (fallback parser for dev / mock tokens)
function parseFirebaseToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length >= 2) {
    try {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payloadStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 1. POST /auth/verify & /api/auth/verify
// Verify Firebase token, create/fetch user
const handleAuthVerify = (req, res) => {
  const { idToken, email, name, username, avatar, useCase } = req.body;
  let verifiedEmail = email;
  let verifiedName = name;
  let verifiedAvatar = avatar;
  let tokenUid = null;

  if (idToken) {
    const decoded = parseFirebaseToken(idToken);
    if (decoded) {
      if (decoded.email) verifiedEmail = decoded.email;
      if (decoded.name && !verifiedName) verifiedName = decoded.name;
      if (decoded.picture && !verifiedAvatar) verifiedAvatar = decoded.picture;
      if (decoded.user_id || decoded.sub) tokenUid = decoded.user_id || decoded.sub;
    }
  }

  if (!verifiedEmail && !tokenUid) {
    return res.status(400).json({ success: false, error: "Valid Firebase idToken or email is required." });
  }

  const db = getDb();
  const normalizedEmail = (verifiedEmail || "").trim().toLowerCase();

  let user = db.users.find(u => 
    (normalizedEmail && u.email && u.email.toLowerCase() === normalizedEmail) ||
    (tokenUid && (u.googleId === tokenUid || u.userId === tokenUid || u.id === tokenUid))
  );

  let isNew = false;
  if (!user) {
    isNew = true;
    const userId = tokenUid || `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const finalName = (verifiedName && verifiedName.trim()) || (normalizedEmail ? normalizedEmail.split('@')[0] : 'User');
    const finalUsername = (username && username.trim()) || (normalizedEmail ? normalizedEmail.split('@')[0] : userId);
    const finalAvatar = verifiedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=00E5FF&color=000&bold=true`;

    user = {
      id: userId,
      userId: userId,
      googleId: tokenUid || `goog_${Date.now()}`,
      name: finalName,
      username: finalUsername,
      email: normalizedEmail || `${userId}@example.com`,
      avatar: finalAvatar,
      profileImage: finalAvatar,
      useCase: useCase || 'student',
      userType: useCase || 'student',
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.users.push(user);

    // Default schedule
    db.schedules.push({
      id: `sch_${Date.now()}`,
      userId: user.userId,
      day: ["mon", "tue", "wed", "thu", "fri"],
      activeDays: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "08:30",
      endTime: "17:00",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Default bag
    db.bags.push({
      id: `bag_${Date.now()}`,
      userId: user.userId,
      name: "My College Bag",
      hardwareId: "ESP32-BAG-01",
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Default notification settings
    db.notificationSettings.push({
      id: `nset_${Date.now()}`,
      userId: user.userId,
      emailEnabled: true,
      pushEnabled: true,
      notifyOnMissing: true,
      notifyOnBagEvents: true,
      notifyOnItemRemoved: true,
      notifyOnReminders: true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveDb(db);
  } else {
    // Update existing user with newly provided details
    if (verifiedName && !user.name) user.name = verifiedName;
    if (username && !user.username) user.username = username;
    if (verifiedAvatar && !user.avatar) {
      user.avatar = verifiedAvatar;
      user.profileImage = verifiedAvatar;
    }
    if (useCase) {
      user.useCase = useCase;
      user.userType = useCase;
    }
    user.updatedAt = new Date().toISOString();
    saveDb(db);
  }

  const token = createSession(user.userId || user.id);
  res.json({
    success: true,
    token,
    isNew,
    user: {
      userId: user.userId || user.id,
      id: user.userId || user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar || user.profileImage,
      useCase: user.useCase || user.userType
    }
  });
};

app.post('/auth/verify', handleAuthVerify);
app.post('/api/auth/verify', handleAuthVerify);

// 2. GET & PUT /users/:id/profile
const handleGetUserProfile = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const user = db.users.find(u => u.userId === id || u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const schedule = db.schedules.find(s => s.userId === user.userId || s.userId === user.id) || null;
  const items = db.items.filter(i => i.userId === user.userId || i.userId === user.id);
  const bags = db.bags.filter(b => b.userId === user.userId || b.userId === user.id);

  res.json({
    success: true,
    user: {
      userId: user.userId || user.id,
      id: user.userId || user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar || user.profileImage,
      useCase: user.useCase || user.userType
    },
    schedule: schedule ? {
      userId: schedule.userId,
      day: schedule.day || schedule.activeDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      active: schedule.active !== undefined ? schedule.active : true
    } : null,
    itemsCount: items.length,
    bagsCount: bags.length
  });
};

const handleUpdateUserProfile = (req, res) => {
  const { id } = req.params;
  const { name, username, avatar, useCase, day, startTime, endTime, active } = req.body;
  const db = getDb();
  const user = db.users.find(u => u.userId === id || u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  if (name) user.name = name.trim();
  if (username) user.username = username.trim();
  if (avatar) {
    user.avatar = avatar;
    user.profileImage = avatar;
  }
  if (useCase) {
    user.useCase = useCase;
    user.userType = useCase;
  }
  user.updatedAt = new Date().toISOString();

  let schedule = db.schedules.find(s => s.userId === user.userId || s.userId === user.id);
  if (day !== undefined || startTime !== undefined || endTime !== undefined || active !== undefined) {
    if (!schedule) {
      schedule = {
        id: `sch_${Date.now()}`,
        userId: user.userId || user.id,
        day: day || ["mon", "tue", "wed", "thu", "fri"],
        activeDays: day || ["mon", "tue", "wed", "thu", "fri"],
        startTime: startTime || "08:30",
        endTime: endTime || "17:00",
        active: active !== undefined ? active : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.schedules.push(schedule);
    } else {
      if (day !== undefined) {
        schedule.day = Array.isArray(day) ? day : [day];
        schedule.activeDays = schedule.day;
      }
      if (startTime !== undefined) schedule.startTime = startTime;
      if (endTime !== undefined) schedule.endTime = endTime;
      if (active !== undefined) schedule.active = active;
      schedule.updatedAt = new Date().toISOString();
    }
  }

  saveDb(db);

  res.json({
    success: true,
    user: {
      userId: user.userId || user.id,
      id: user.userId || user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar || user.profileImage,
      useCase: user.useCase || user.userType
    },
    schedule: schedule ? {
      userId: schedule.userId,
      day: schedule.day || schedule.activeDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      active: schedule.active !== undefined ? schedule.active : true
    } : null
  });
};

app.get('/users/:id/profile', optionalAuth, handleGetUserProfile);
app.get('/api/users/:id/profile', optionalAuth, handleGetUserProfile);
app.put('/users/:id/profile', optionalAuth, handleUpdateUserProfile);
app.put('/api/users/:id/profile', optionalAuth, handleUpdateUserProfile);

// 3. GET /items, POST /items, PUT /items/:id, DELETE /items/:id
const handleGetItems = (req, res) => {
  const db = getDb();
  const { userId, type, status, bagId } = req.query;

  let targetUserId = userId;
  if (!targetUserId && req.user) {
    targetUserId = req.user.userId || req.user.id;
  }

  let items = db.items || [];
  if (targetUserId) {
    items = items.filter(i => i.userId === targetUserId);
  }
  if (type) {
    items = items.filter(i => (i.type || '').toUpperCase() === type.toUpperCase());
  }
  if (status) {
    items = items.filter(i => (i.status || '').toUpperCase() === status.toUpperCase());
  }
  if (bagId) {
    items = items.filter(i => i.bagId === bagId);
  }

  const formattedItems = items.map(item => ({
    itemId: item.itemId || item.id,
    id: item.itemId || item.id,
    userId: item.userId,
    name: item.name,
    rfidUid: item.rfidUid,
    type: item.type || "REGULAR",
    status: item.status || "IN_BAG",
    category: item.category || "General",
    importance: item.importance || "medium",
    bagId: item.bagId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  res.json({ success: true, items: formattedItems });
};

const handleCreateItem = (req, res) => {
  const { userId, name, rfidUid, type, status, category, importance, bagId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Item name is required" });
  }

  const db = getDb();
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : (db.users[0] ? db.users[0].userId : "usr_demo_01"));
  const targetBag = db.bags.find(b => (b.userId === targetUserId && (bagId ? b.id === bagId : true))) || db.bags[0];

  const cleanUid = (rfidUid || `TAG_${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
    .trim().toUpperCase().replace(/[^0-9A-F]/g, '');

  const itemId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const itemType = (type && String(type).toUpperCase() === 'TEMPORARY') ? 'TEMPORARY' : 'REGULAR';
  const itemStatus = (status && String(status).toUpperCase() === 'REMOVED') ? 'REMOVED' : 'IN_BAG';

  const newItem = {
    id: itemId,
    itemId: itemId,
    userId: targetUserId,
    bagId: targetBag ? targetBag.id : "bag_demo_01",
    name: name.trim(),
    category: category || "General",
    rfidUid: cleanUid,
    type: itemType,
    status: itemStatus,
    importance: importance || "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(newItem);

  // Write Activity: ITEM_ADDED
  const activityRecord = {
    activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    id: `act_${Date.now()}`,
    userId: targetUserId,
    type: "ITEM_ADDED",
    itemId: newItem.itemId,
    timestamp: new Date().toISOString(),
    details: `Added ${newItem.name} (${newItem.type}) to bag`
  };
  if (!db.activities) db.activities = [];
  db.activities.unshift(activityRecord);

  saveDb(db);

  res.status(201).json({
    success: true,
    item: {
      itemId: newItem.itemId,
      userId: newItem.userId,
      name: newItem.name,
      rfidUid: newItem.rfidUid,
      type: newItem.type,
      status: newItem.status
    }
  });
};

const handleUpdateItem = (req, res) => {
  const { id } = req.params;
  const { name, rfidUid, type, status, category, importance } = req.body;
  const db = getDb();
  const item = db.items.find(i => i.itemId === id || i.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: "Item not found" });
  }

  const oldStatus = item.status;

  if (name) item.name = name.trim();
  if (rfidUid) item.rfidUid = rfidUid.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (type) item.type = (String(type).toUpperCase() === 'TEMPORARY') ? 'TEMPORARY' : 'REGULAR';
  if (category) item.category = category;
  if (importance) item.importance = importance;
  if (status) {
    const newStatus = (String(status).toUpperCase() === 'REMOVED') ? 'REMOVED' : 'IN_BAG';
    if (oldStatus !== newStatus) {
      item.status = newStatus;
      const actType = newStatus === 'REMOVED' ? 'ITEM_REMOVED' : 'ITEM_RETURNED';
      const act = {
        activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        id: `act_${Date.now()}`,
        userId: item.userId,
        type: actType,
        itemId: item.itemId,
        timestamp: new Date().toISOString(),
        details: `${item.name} status updated to ${newStatus}`
      };
      if (!db.activities) db.activities = [];
      db.activities.unshift(act);

      dispatchNotification({
        userId: item.userId,
        type: actType,
        title: actType === 'ITEM_REMOVED' ? `${item.name} Removed` : `${item.name} Returned`,
        message: `${item.name} was marked as ${newStatus.toLowerCase().replace('_', ' ')}.`,
        data: { item }
      });
    }
  }

  item.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({
    success: true,
    item: {
      itemId: item.itemId,
      userId: item.userId,
      name: item.name,
      rfidUid: item.rfidUid,
      type: item.type,
      status: item.status
    }
  });
};

const handleDeleteItem = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const index = db.items.findIndex(i => i.itemId === id || i.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Item not found" });
  }

  const [removedItem] = db.items.splice(index, 1);
  if (db.reminders) {
    db.reminders = db.reminders.filter(r => r.itemId !== id && r.itemId !== removedItem.itemId);
  }
  saveDb(db);

  res.json({ success: true, message: `Item ${removedItem.name} deleted successfully` });
};

app.get('/items', optionalAuth, handleGetItems);
app.post('/items', optionalAuth, handleCreateItem);
app.put('/items/:id', optionalAuth, handleUpdateItem);
app.delete('/items/:id', optionalAuth, handleDeleteItem);

// 4. POST /rfid/register & /api/rfid/register
const handleRfidRegister = (req, res) => {
  const { itemId, rfidUid } = req.body;
  if (!itemId || !rfidUid) {
    return res.status(400).json({ success: false, error: "Both itemId and rfidUid are required." });
  }

  const cleanUid = String(rfidUid).trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!cleanUid) {
    return res.status(400).json({ success: false, error: "Valid hexadecimal RFID UID is required." });
  }

  const db = getDb();
  const item = db.items.find(i => i.itemId === itemId || i.id === itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: "Item not found." });
  }

  item.rfidUid = cleanUid;
  item.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({
    success: true,
    message: "RFID UID successfully linked to item",
    item: {
      itemId: item.itemId || item.id,
      userId: item.userId,
      name: item.name,
      rfidUid: item.rfidUid,
      type: item.type,
      status: item.status
    }
  });
};

app.post('/rfid/register', handleRfidRegister);
app.post('/api/rfid/register', handleRfidRegister);

// 5. POST /rfid/scan & /api/rfid/scan
// Hardware scan ingestion endpoint (ESP32 sends { uid, timestamp })
// Core state machine: flips status IN_BAG <-> REMOVED -> writes Activity -> triggers notification
const handleRfidScan = (req, res) => {
  const { uid, timestamp, hardwareId } = req.body;
  if (!uid) {
    return res.status(400).json({ success: false, error: "RFID UID is required." });
  }

  const cleanUid = String(uid).trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  const db = getDb();
  const item = db.items.find(i => (i.rfidUid || '').toUpperCase() === cleanUid);

  const scanTimestamp = timestamp || new Date().toISOString();

  if (!item) {
    return res.status(200).json({
      success: true,
      recognized: false,
      uid: cleanUid,
      message: "Unregistered RFID tag scanned. No item matched.",
      timestamp: scanTimestamp
    });
  }

  const prevStatus = item.status || 'IN_BAG';
  const newStatus = (prevStatus === 'IN_BAG') ? 'REMOVED' : 'IN_BAG';
  const activityType = (newStatus === 'REMOVED') ? 'ITEM_REMOVED' : 'ITEM_RETURNED';

  item.status = newStatus;
  item.updatedAt = scanTimestamp;

  // Write Activity row
  const activityRecord = {
    activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    id: `act_${Date.now()}`,
    userId: item.userId,
    type: activityType,
    itemId: item.itemId || item.id,
    timestamp: scanTimestamp,
    details: activityType === 'ITEM_REMOVED'
      ? `${item.name} was removed from the bag`
      : `${item.name} was returned to the bag`
  };

  if (!db.activities) db.activities = [];
  db.activities.unshift(activityRecord);

  // Dispatch Notification
  const notification = dispatchNotification({
    userId: item.userId,
    type: activityType,
    title: activityType === 'ITEM_REMOVED' ? `${item.name} Removed` : `${item.name} Returned`,
    message: activityType === 'ITEM_REMOVED'
      ? `${item.name} has been removed from your backpack.`
      : `${item.name} is safely back inside your backpack.`,
    data: {
      itemId: item.itemId || item.id,
      rfidUid: cleanUid,
      status: newStatus,
      hardwareId: hardwareId || null,
      timestamp: scanTimestamp
    }
  });

  saveDb(db);

  res.json({
    success: true,
    recognized: true,
    item: {
      itemId: item.itemId || item.id,
      userId: item.userId,
      name: item.name,
      rfidUid: item.rfidUid,
      type: item.type,
      status: item.status
    },
    transition: {
      from: prevStatus,
      to: newStatus
    },
    activity: activityRecord,
    notification,
    eventType: activityType,
    timestamp: scanTimestamp
  });
};

app.post('/rfid/scan', handleRfidScan);
app.post('/api/rfid/scan', handleRfidScan);

// 6. POST /bag/event & /api/bag/event
// Hardware sends { event: OPEN/CLOSE, timestamp }
const handleBagEvent = (req, res) => {
  const { event, timestamp, hardwareId, userId } = req.body;
  if (!event) {
    return res.status(400).json({ success: false, error: "Event ('OPEN' or 'CLOSE') is required." });
  }

  const rawEvent = String(event).toUpperCase();
  const isOpened = rawEvent.includes('OPEN');
  const activityType = isOpened ? 'BAG_OPENED' : 'BAG_CLOSED';
  const eventTimestamp = timestamp || new Date().toISOString();

  const db = getDb();
  let targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : null);

  let bag = null;
  if (hardwareId) {
    if (targetUserId) {
      bag = db.bags.find(b => b.hardwareId === hardwareId && b.userId === targetUserId);
    }
    if (!bag) {
      bag = db.bags.find(b => b.hardwareId === hardwareId);
    }
  }

  if (!targetUserId) {
    targetUserId = bag ? bag.userId : (db.users[0] ? db.users[0].userId : "usr_demo_01");
  }

  // Write Activity
  const activityRecord = {
    activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    id: `act_${Date.now()}`,
    userId: targetUserId,
    type: activityType,
    itemId: null,
    timestamp: eventTimestamp,
    details: isOpened ? "Backpack zipper opened" : "Backpack zipper secured and closed"
  };

  if (!db.activities) db.activities = [];
  db.activities.unshift(activityRecord);
  saveDb(db);

  // Dispatch Notification (dispatches email and records notification)
  const notification = dispatchNotification({
    userId: targetUserId,
    type: activityType,
    title: isOpened ? "Bag Opened" : "Bag Closed",
    message: isOpened ? "Your backpack was opened." : "Your backpack was closed.",
    data: {
      event: activityType,
      hardwareId: hardwareId || (bag ? bag.hardwareId : null),
      timestamp: eventTimestamp
    }
  });

  res.json({
    success: true,
    event: activityType,
    timestamp: eventTimestamp,
    activity: activityRecord,
    notification
  });
};

app.post('/bag/event', optionalAuth, handleBagEvent);
app.post('/api/bag/event', optionalAuth, handleBagEvent);

// 7. Reminders: POST /reminders, GET /reminders, DELETE /reminders/:id, POST /reminders/:id/trigger
const handleCreateReminder = (req, res) => {
  const { userId, itemId, reminderTime, message } = req.body;
  if (!reminderTime) {
    return res.status(400).json({ success: false, error: "reminderTime is required." });
  }

  const due = new Date(reminderTime);
  if (isNaN(due.getTime())) {
    return res.status(400).json({ success: false, error: "Invalid reminderTime date format." });
  }

  const db = getDb();
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : (db.users[0] ? db.users[0].userId : "usr_demo_01"));
  const item = itemId ? db.items.find(i => i.itemId === itemId || i.id === itemId) : null;

  const reminderId = `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const reminderRecord = {
    reminderId,
    id: reminderId,
    userId: targetUserId,
    itemId: itemId || null,
    reminderTime: due.toISOString(),
    status: "PENDING",
    message: message || (item ? `Pack your ${item.name}` : "Backpack reminder"),
    createdAt: new Date().toISOString()
  };

  if (!db.reminders) db.reminders = [];
  db.reminders.push(reminderRecord);

  // Activity: REMINDER_CREATED
  const activityRecord = {
    activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    id: `act_${Date.now()}`,
    userId: targetUserId,
    type: "REMINDER_CREATED",
    itemId: itemId || null,
    timestamp: new Date().toISOString(),
    details: reminderRecord.message
  };

  if (!db.activities) db.activities = [];
  db.activities.unshift(activityRecord);

  saveDb(db);

  res.status(201).json({
    success: true,
    reminder: {
      reminderId: reminderRecord.reminderId,
      userId: reminderRecord.userId,
      itemId: reminderRecord.itemId,
      reminderTime: reminderRecord.reminderTime,
      status: reminderRecord.status
    }
  });
};

const handleGetReminders = (req, res) => {
  const { userId, status } = req.query;
  const db = getDb();
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : null);

  let reminders = db.reminders || [];
  if (targetUserId) {
    reminders = reminders.filter(r => r.userId === targetUserId);
  }
  if (status) {
    reminders = reminders.filter(r => r.status.toUpperCase() === status.toUpperCase());
  }

  const formatted = reminders.map(r => ({
    reminderId: r.reminderId || r.id,
    userId: r.userId,
    itemId: r.itemId,
    reminderTime: r.reminderTime,
    status: r.status,
    message: r.message
  }));

  res.json({ success: true, reminders: formatted });
};

const handleDeleteReminder = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const index = (db.reminders || []).findIndex(r => r.reminderId === id || r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Reminder not found" });
  }

  db.reminders[index].status = "CANCELLED";
  saveDb(db);
  res.json({ success: true, message: "Reminder cancelled successfully" });
};

// Trigger reminder immediately (dispatches notification and email)
const handleTriggerReminder = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const reminder = (db.reminders || []).find(r => r.reminderId === id || r.id === id);
  if (!reminder) {
    return res.status(404).json({ success: false, error: "Reminder not found" });
  }

  reminder.status = "FIRED";
  reminder.firedAt = new Date().toISOString();

  const item = (db.items || []).find(i => i.id === reminder.itemId || i.itemId === reminder.itemId);
  const itemName = item ? item.name : "Tracked Belonging";

  const notification = dispatchNotification({
    userId: reminder.userId,
    type: "REMINDER_FIRED",
    title: `Reminder: ${itemName}`,
    message: reminder.message || `Don't forget to pack your ${itemName}!`,
    data: {
      reminderId: reminder.reminderId || reminder.id,
      itemId: reminder.itemId
    }
  });

  saveDb(db);

  res.json({
    success: true,
    message: `Reminder fired successfully and email sent to user.`,
    reminder,
    notification
  });
};

app.post('/reminders', optionalAuth, handleCreateReminder);
app.post('/api/reminders', optionalAuth, handleCreateReminder);
app.get('/reminders', optionalAuth, handleGetReminders);
app.get('/api/reminders', optionalAuth, handleGetReminders);
app.delete('/reminders/:id', optionalAuth, handleDeleteReminder);
app.delete('/api/reminders/:id', optionalAuth, handleDeleteReminder);
app.post('/reminders/:id/trigger', optionalAuth, handleTriggerReminder);
app.post('/api/reminders/:id/trigger', optionalAuth, handleTriggerReminder);

// 7b. Email Notifications Outbox & Testing APIs
app.get('/api/emails', optionalAuth, (req, res) => {
  const db = getDb();
  let emails = db.sentEmails || [];
  const targetUserId = req.user ? (req.user.userId || req.user.id) : null;
  if (targetUserId) {
    emails = emails.filter(e => e.userId === targetUserId || !e.userId);
  }
  const { type } = req.query;
  if (type) {
    emails = emails.filter(e => e.type === type.toUpperCase());
  }
  res.json({ success: true, count: emails.length, emails });
});

app.get('/api/emails/:id', optionalAuth, (req, res) => {
  const db = getDb();
  const email = (db.sentEmails || []).find(e => e.id === req.params.id);
  if (!email) {
    return res.status(404).json({ success: false, error: "Email not found" });
  }
  if (req.query.format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    return res.send(email.html);
  }
  res.json({ success: true, email });
});

app.post('/api/emails/test', optionalAuth, async (req, res) => {
  try {
    const { type = 'BAG_OPENED', recipient } = req.body;
    const db = getDb();
    const user = req.user || db.users[0];
    const to = recipient || (user ? user.email : 'murtazajamali07@gmail.com');
    const userName = user ? user.name : 'Murtaza Jamali';
    const bag = (db.bags && db.bags[0]) || { name: 'My College Bag', hardwareId: 'ESP32-BAG-01' };

    let result;
    if (type === 'BAG_CLOSED') {
      result = await sendBagClosedEmail({ to, userName, bagName: bag.name, timestamp: new Date().toISOString(), hardwareId: bag.hardwareId });
    } else if (type === 'REMINDER' || type === 'REMINDER_FIRED') {
      result = await sendReminderEmail({ to, userName, itemName: 'Laptop Charger', reminderMessage: 'Pack charger before leaving for evening lab!', dueTime: new Date().toISOString(), bagName: bag.name });
    } else {
      result = await sendBagOpenedEmail({ to, userName, bagName: bag.name, timestamp: new Date().toISOString(), hardwareId: bag.hardwareId });
    }

    res.json({ success: true, message: `Test email (${type}) sent successfully to ${to}`, email: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. GET /activity & /api/activity (Timeline feed)
const handleGetActivity = (req, res) => {
  const { userId, limit = 50, type } = req.query;
  const db = getDb();
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : null);

  let activities = db.activities || [];
  if (targetUserId) {
    activities = activities.filter(a => a.userId === targetUserId);
  }
  if (type) {
    activities = activities.filter(a => a.type.toUpperCase() === type.toUpperCase());
  }

  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const count = Math.min(parseInt(limit, 10) || 50, 100);
  const sliced = activities.slice(0, count).map(a => ({
    activityId: a.activityId || a.id,
    userId: a.userId,
    type: a.type,
    itemId: a.itemId,
    timestamp: a.timestamp,
    details: a.details
  }));

  res.json({ success: true, activities: sliced });
};

app.get('/activity', optionalAuth, handleGetActivity);
app.get('/api/activity', optionalAuth, handleGetActivity);

// 9. GET & PUT /notifications/settings
const handleGetNotificationSettings = (req, res) => {
  const { userId } = req.query;
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : "usr_demo_01");
  const db = getDb();
  let settings = (db.notificationSettings || []).find(n => n.userId === targetUserId);

  if (!settings) {
    settings = {
      id: `nset_${Date.now()}`,
      userId: targetUserId,
      emailEnabled: true,
      pushEnabled: true,
      notifyOnMissing: true,
      notifyOnBagEvents: true,
      notifyOnItemRemoved: true,
      notifyOnReminders: true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.notificationSettings.push(settings);
    saveDb(db);
  }

  res.json({ success: true, settings });
};

const handleUpdateNotificationSettings = (req, res) => {
  const { userId, emailEnabled, pushEnabled, notifyOnMissing, notifyOnBagEvents, notifyOnItemRemoved, notifyOnReminders } = req.body;
  const targetUserId = userId || (req.user ? (req.user.userId || req.user.id) : "usr_demo_01");
  const db = getDb();
  let settings = (db.notificationSettings || []).find(n => n.userId === targetUserId);

  if (!settings) {
    settings = {
      id: `nset_${Date.now()}`,
      userId: targetUserId,
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      pushEnabled: pushEnabled !== undefined ? pushEnabled : true,
      notifyOnMissing: notifyOnMissing !== undefined ? notifyOnMissing : true,
      notifyOnBagEvents: notifyOnBagEvents !== undefined ? notifyOnBagEvents : true,
      notifyOnItemRemoved: notifyOnItemRemoved !== undefined ? notifyOnItemRemoved : true,
      notifyOnReminders: notifyOnReminders !== undefined ? notifyOnReminders : true,
      dailySummaryEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.notificationSettings.push(settings);
  } else {
    if (emailEnabled !== undefined) settings.emailEnabled = emailEnabled;
    if (pushEnabled !== undefined) settings.pushEnabled = pushEnabled;
    if (notifyOnMissing !== undefined) settings.notifyOnMissing = notifyOnMissing;
    if (notifyOnBagEvents !== undefined) settings.notifyOnBagEvents = notifyOnBagEvents;
    if (notifyOnItemRemoved !== undefined) settings.notifyOnItemRemoved = notifyOnItemRemoved;
    if (notifyOnReminders !== undefined) settings.notifyOnReminders = notifyOnReminders;
    settings.updatedAt = new Date().toISOString();
  }

  saveDb(db);
  res.json({ success: true, settings });
};

app.get('/notifications/settings', optionalAuth, handleGetNotificationSettings);
app.get('/api/notifications/settings', optionalAuth, handleGetNotificationSettings);
app.put('/notifications/settings', optionalAuth, handleUpdateNotificationSettings);
app.put('/api/notifications/settings', optionalAuth, handleUpdateNotificationSettings);

// 10. Interactive API Documentation & Postman Export
app.get('/docs/postman', (req, res) => {
  const collectionPath = path.join(__dirname, 'beepack_postman_collection.json');
  if (fs.existsSync(collectionPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="beepack_postman_collection.json"');
    return res.sendFile(collectionPath);
  }
  res.status(404).json({ success: false, error: "Postman collection not found" });
});

app.get('/docs', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Beepack API Documentation — Person 2</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090D16;
      --card: #121826;
      --border: #1E293B;
      --accent: #00E5FF;
      --accent-dim: rgba(0, 229, 255, 0.12);
      --green: #10B981;
      --amber: #F59E0B;
      --purple: #8B5CF6;
      --text: #F1F5F9;
      --text-muted: #94A3B8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid rgba(0, 229, 255, 0.3);
    }
    h1 { font-size: 2.2rem; font-weight: 700; margin-top: 8px; }
    p.subtitle { color: var(--text-muted); font-size: 1.05rem; }
    .btn-download {
      background: linear-gradient(135deg, #00E5FF, #0088FF);
      color: #000;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: opacity 0.2s;
    }
    .btn-download:hover { opacity: 0.9; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card h2 { font-size: 1.3rem; margin-bottom: 12px; color: var(--accent); }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem;
    }
    .method {
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.8rem;
    }
    .post { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .get { background: rgba(0, 229, 255, 0.15); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.3); }
    .put { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
    .delete { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    pre {
      background: #060910;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #38BDF8;
      overflow-x: auto;
      margin-top: 8px;
    }
    .state-machine {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #080D1A;
      border: 1px dashed var(--accent);
      border-radius: 10px;
      padding: 20px;
      margin: 16px 0;
      text-align: center;
    }
    .node {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
    }
    .arrow { color: var(--accent); font-size: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <span class="badge">Person 2: Backend & APIs</span>
        <h1>Beepack Backend APIs</h1>
        <p class="subtitle">"Beep before you leave." Shared Contracts & Hardware/Frontend Specifications.</p>
      </div>
      <a href="/docs/postman" class="btn-download">
        <span>📦</span> Download Postman Collection
      </a>
    </header>

    <div class="card">
      <h2>Core Item State Machine</h2>
      <p style="color: var(--text-muted); margin-bottom: 8px;">Hardware scans directly trigger transitions between IN_BAG and REMOVED:</p>
      <div class="state-machine">
        <div class="node" style="color: var(--green);">IN_BAG</div>
        <div class="arrow">⇄</div>
        <div class="node" style="color: var(--amber);">REMOVED</div>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-muted);">
        Every scan to <code>POST /rfid/scan</code> looks up the item UID, toggles the state, records an Activity entry (<code>ITEM_REMOVED</code> or <code>ITEM_RETURNED</code>), and dispatches notifications.
      </p>
    </div>

    <div class="card">
      <h2>Hardware Endpoints (ESP32 Integration)</h2>
      <p style="color: var(--text-muted); margin-bottom: 12px;">Only two endpoints are used by the ESP32 hardware:</p>

      <div style="margin-bottom: 16px;">
        <div class="endpoint">
          <span class="method post">POST</span>
          <span>/rfid/scan</span>
          <span style="color: var(--text-muted); font-size: 0.85rem;">— Trigger on item RFID scan</span>
        </div>
        <pre>{
  "uid": "E2801160",
  "timestamp": "2026-09-12T10:50:00.000Z",
  "hardwareId": "ESP32-BAG-01"
}</pre>
      </div>

      <div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span>/bag/event</span>
          <span style="color: var(--text-muted); font-size: 0.85rem;">— Zipper Open/Close event</span>
        </div>
        <pre>{
  "event": "OPEN", // or "CLOSE"
  "timestamp": "2026-09-12T10:50:00.000Z",
  "hardwareId": "ESP32-BAG-01"
}</pre>
      </div>
    </div>

    <div class="card">
      <h2>Frontend REST API Endpoints</h2>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method post">POST</span> <span>/auth/verify</span></div>
        <pre>// Body: { "idToken": "..." } -> Returns { success: true, token, user }</pre>
      </div>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method get">GET</span> <span>/users/:id/profile</span></div>
        <div class="endpoint"><span class="method put">PUT</span> <span>/users/:id/profile</span></div>
      </div>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method get">GET</span> <span>/items</span></div>
        <div class="endpoint"><span class="method post">POST</span> <span>/items</span></div>
        <div class="endpoint"><span class="method put">PUT</span> <span>/items/:id</span></div>
        <div class="endpoint"><span class="method delete">DELETE</span> <span>/items/:id</span></div>
      </div>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method post">POST</span> <span>/rfid/register</span></div>
        <pre>// Body: { "itemId": "item_01", "rfidUid": "E2801160" }</pre>
      </div>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method post">POST</span> <span>/reminders</span></div>
        <div class="endpoint"><span class="method get">GET</span> <span>/reminders</span></div>
      </div>
      <div style="margin-bottom: 16px;">
        <div class="endpoint"><span class="method get">GET</span> <span>/activity</span></div>
      </div>
      <div>
        <div class="endpoint"><span class="method get">GET</span> <span>/notifications/settings</span></div>
        <div class="endpoint"><span class="method put">PUT</span> <span>/notifications/settings</span></div>
      </div>
    </div>
  </div>
</body>
</html>`);
});

// ----------------------------------------------------
// LEGACY BACKWARD COMPATIBILITY (Landing page demo)
// ----------------------------------------------------

app.get('/api/lists', (req, res) => {
  const db = getDb();
  res.json({ success: true, lists: db.lists || [] });
});

app.get('/api/items', (req, res) => {
  return handleGetItems(req, res);
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

// Start background reminder scheduler & server when run directly
let server = null;
if (require.main === module) {
  startScheduler(10000);
  server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Beepack Server Running!`);
    console.log(`  URL:      http://localhost:${PORT}`);
    console.log(`  API Base: http://localhost:${PORT}/api`);
    console.log(`  Docs:     http://localhost:${PORT}/docs`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, server };

