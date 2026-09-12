/**
 * Beepack Person 2 Backend Test Suite
 * Validates:
 * 1. POST /auth/verify (Firebase token verification, User fetch/create)
 * 2. GET & PUT /users/:id/profile (User profile, use case, schedule)
 * 3. GET /items, POST /items, PUT /items/:id, DELETE /items/:id (CRUD regular/temporary items)
 * 4. POST /rfid/register (Link scanned UID to an item)
 * 5. POST /rfid/scan (Hardware ESP32 scan state machine: IN_BAG <-> REMOVED -> Activity -> Notification)
 * 6. POST /bag/event (Hardware ESP32 bag OPEN/CLOSE events -> Activity -> Notification)
 * 7. POST & GET /reminders (Create, list, reminder scheduler trigger -> Activity -> Notification)
 * 8. GET /activity (Timeline feed query with all 6 event types)
 * 9. GET & PUT /notifications/settings (Toggle notification types)
 * 10. GET /docs & GET /docs/postman (API documentation and Postman export)
 */

const http = require('http');
const { app, server } = require('./server');
const { checkPendingReminders } = require('./reminder_scheduler');

const PORT = 3001;
let testServer;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname: '127.0.0.1',
      port: PORT,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING BEEKPACK BACKEND PERSON 2 TEST SUITE');
  console.log('======================================================\n');

  // Start test server on PORT 3001
  testServer = app.listen(PORT);

  try {
    // 0. Reset Database
    const resetRes = await request('POST', '/api/reset-db');
    assert(resetRes.status === 200, "Database reset to initial seed data");

    // 1. Test POST /auth/verify (Firebase Token Verification & User Creation)
    console.log('\n--- 1. Testing /auth/verify (Firebase Auth & Profile Creation) ---');
    const mockFirebasePayload = Buffer.from(JSON.stringify({
      user_id: "goog_firebase_9921",
      email: "maya.lin@university.edu",
      name: "Maya Lin",
      picture: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150"
    })).toString('base64');
    const mockFirebaseToken = `header.${mockFirebasePayload}.signature`;

    const authRes = await request('POST', '/auth/verify', {
      idToken: mockFirebaseToken,
      useCase: "student"
    });

    assert(authRes.status === 200, "POST /auth/verify returns HTTP 200");
    assert(authRes.body.token, "Session token returned");
    assert(authRes.body.user.email === "maya.lin@university.edu", "Verified email matches Firebase token");
    assert(authRes.body.user.useCase === "student", "User useCase set to 'student'");

    const authToken = authRes.body.token;
    const userId = authRes.body.user.userId;

    // 2. Test GET & PUT /users/:id/profile
    console.log('\n--- 2. Testing /users/:id/profile (GET & PUT) ---');
    const profileRes = await request('GET', `/users/${userId}/profile`, null, authToken);
    assert(profileRes.status === 200, "GET /users/:id/profile returns HTTP 200");
    assert(profileRes.body.user.name === "Maya Lin", "Profile name matches");
    assert(profileRes.body.schedule !== null, "User schedule exists");

    const updateProfileRes = await request('PUT', `/users/${userId}/profile`, {
      name: "Maya Lin (Updated)",
      useCase: "researcher",
      day: ["mon", "wed", "fri"],
      startTime: "09:00",
      endTime: "18:00",
      active: true
    }, authToken);

    assert(updateProfileRes.status === 200, "PUT /users/:id/profile returns HTTP 200");
    assert(updateProfileRes.body.user.name === "Maya Lin (Updated)", "Profile name updated");
    assert(updateProfileRes.body.user.useCase === "researcher", "useCase updated to researcher");
    assert(updateProfileRes.body.schedule.startTime === "09:00", "Schedule startTime updated");

    // 3. Test Items CRUD (/items)
    console.log('\n--- 3. Testing /items CRUD (Regular & Temporary Items) ---');
    // Create Regular Item
    const createItem1 = await request('POST', '/items', {
      userId,
      name: "Research Tablet",
      rfidUid: "DEADBEEF01",
      type: "REGULAR",
      status: "IN_BAG",
      category: "Electronics"
    }, authToken);

    assert(createItem1.status === 201, "POST /items created Regular item (HTTP 201)");
    assert(createItem1.body.item.type === "REGULAR", "Item type is REGULAR");
    assert(createItem1.body.item.status === "IN_BAG", "Item status defaults to IN_BAG");
    const itemId1 = createItem1.body.item.itemId;

    // Create Temporary Item
    const createItem2 = await request('POST', '/items', {
      userId,
      name: "Conference Badge",
      rfidUid: "FEEDFACE02",
      type: "TEMPORARY",
      status: "IN_BAG",
      category: "Credentials"
    }, authToken);

    assert(createItem2.status === 201, "POST /items created Temporary item (HTTP 201)");
    assert(createItem2.body.item.type === "TEMPORARY", "Item type is TEMPORARY");
    const itemId2 = createItem2.body.item.itemId;

    // List Items
    const listItemsRes = await request('GET', `/items?userId=${userId}`, null, authToken);
    assert(listItemsRes.status === 200, "GET /items returns HTTP 200");
    assert(listItemsRes.body.items.length === 2, "Lists 2 created items for user");

    // Filter by type
    const filterTypeRes = await request('GET', `/items?userId=${userId}&type=TEMPORARY`, null, authToken);
    assert(filterTypeRes.body.items.length === 1, "Filter by type=TEMPORARY returns 1 item");
    assert(filterTypeRes.body.items[0].itemId === itemId2, "Filtered item matches Conference Badge");

    // Update Item
    const updateItemRes = await request('PUT', `/items/${itemId1}`, {
      name: "Research iPad Pro"
    }, authToken);
    assert(updateItemRes.status === 200, "PUT /items/:id updated item name");
    assert(updateItemRes.body.item.name === "Research iPad Pro", "Updated name persisted");

    // 4. Test POST /rfid/register
    console.log('\n--- 4. Testing /rfid/register (Link UID to Item) ---');
    const rfidRegRes = await request('POST', '/rfid/register', {
      itemId: itemId1,
      rfidUid: "AABBCCDDEE"
    });
    assert(rfidRegRes.status === 200, "POST /rfid/register returns HTTP 200");
    assert(rfidRegRes.body.item.rfidUid === "AABBCCDDEE", "RFID UID successfully linked to item");

    // 5. Test POST /rfid/scan (Hardware ESP32 Core State Machine: IN_BAG <-> REMOVED)
    console.log('\n--- 5. Testing /rfid/scan (Hardware ESP32 State Machine: IN_BAG <-> REMOVED) ---');
    // 5a. First scan: item is currently IN_BAG -> should transition to REMOVED
    const scanOutRes = await request('POST', '/rfid/scan', {
      uid: "AABBCCDDEE",
      timestamp: new Date().toISOString(),
      hardwareId: "ESP32-BAG-01"
    });

    assert(scanOutRes.status === 200, "POST /rfid/scan returned HTTP 200");
    assert(scanOutRes.body.recognized === true, "RFID tag recognized");
    assert(scanOutRes.body.transition.from === "IN_BAG", "Previous state was IN_BAG");
    assert(scanOutRes.body.transition.to === "REMOVED", "Transitioned to REMOVED");
    assert(scanOutRes.body.eventType === "ITEM_REMOVED", "Event type is ITEM_REMOVED");
    assert(scanOutRes.body.notification !== null, "Notification dispatched for ITEM_REMOVED");

    // 5b. Second scan: item is now REMOVED -> should transition back to IN_BAG
    const scanInRes = await request('POST', '/rfid/scan', {
      uid: "AABBCCDDEE",
      timestamp: new Date().toISOString(),
      hardwareId: "ESP32-BAG-01"
    });

    assert(scanInRes.status === 200, "POST /rfid/scan returned HTTP 200");
    assert(scanInRes.body.transition.from === "REMOVED", "Previous state was REMOVED");
    assert(scanInRes.body.transition.to === "IN_BAG", "Transitioned back to IN_BAG");
    assert(scanInRes.body.eventType === "ITEM_RETURNED", "Event type is ITEM_RETURNED");
    assert(scanInRes.body.notification !== null, "Notification dispatched for ITEM_RETURNED");

    // 5c. Unregistered scan test
    const unregScan = await request('POST', '/rfid/scan', {
      uid: "9999999999"
    });
    assert(unregScan.body.recognized === false, "Unrecognized UID handled gracefully");

    // 6. Test POST /bag/event (Hardware ESP32 Bag Open/Close Events)
    console.log('\n--- 6. Testing /bag/event (Hardware ESP32 Bag Zipper Events) ---');
    const bagOpenRes = await request('POST', '/bag/event', {
      userId,
      event: "OPEN",
      timestamp: new Date().toISOString(),
      hardwareId: "ESP32-BAG-01"
    });

    assert(bagOpenRes.status === 200, "POST /bag/event (OPEN) returned HTTP 200");
    assert(bagOpenRes.body.event === "BAG_OPENED", "Normalized event is BAG_OPENED");
    assert(bagOpenRes.body.notification !== null, "Notification dispatched for BAG_OPENED");

    const bagCloseRes = await request('POST', '/bag/event', {
      userId,
      event: "CLOSE",
      timestamp: new Date().toISOString(),
      hardwareId: "ESP32-BAG-01"
    });

    assert(bagCloseRes.status === 200, "POST /bag/event (CLOSE) returned HTTP 200");
    assert(bagCloseRes.body.event === "BAG_CLOSED", "Normalized event is BAG_CLOSED");
    assert(bagCloseRes.body.notification !== null, "Notification dispatched for BAG_CLOSED");

    // 7. Test /reminders (Create, List, and Scheduler Trigger)
    console.log('\n--- 7. Testing /reminders (Create, List & Scheduler Tick) ---');
    // Create reminder due right now (or 1 second in past to fire immediately)
    const dueTime = new Date(Date.now() - 1000).toISOString();
    const createRemRes = await request('POST', '/reminders', {
      userId,
      itemId: itemId1,
      reminderTime: dueTime,
      message: "Pack iPad before heading to the lab!"
    }, authToken);

    assert(createRemRes.status === 201, "POST /reminders created reminder (HTTP 201)");
    assert(createRemRes.body.reminder.status === "PENDING", "Reminder created as PENDING");
    const reminderId = createRemRes.body.reminder.reminderId;

    // List reminders
    const listRemRes = await request('GET', `/reminders?userId=${userId}`, null, authToken);
    assert(listRemRes.status === 200, "GET /reminders returned HTTP 200");
    assert(listRemRes.body.reminders.some(r => r.reminderId === reminderId), "Reminder present in user list");

    // Manually trigger scheduler tick to verify due reminder firing
    const fired = checkPendingReminders();
    assert(fired.length >= 1, "Reminder scheduler identified due reminder and fired it");
    assert(fired.some(r => r.reminderId === reminderId && r.status === "FIRED"), "Reminder status flipped to FIRED");

    // 8. Test GET /activity (Timeline Feed & All 6 Event Types)
    console.log('\n--- 8. Testing /activity (Timeline Feed Verification) ---');
    const actRes = await request('GET', `/activity?userId=${userId}&limit=20`, null, authToken);
    assert(actRes.status === 200, "GET /activity returned HTTP 200");
    assert(actRes.body.activities.length >= 5, "Activity feed contains logged events");

    const activityTypes = actRes.body.activities.map(a => a.type);
    console.log("Logged Activity types for user:", activityTypes);
    assert(activityTypes.includes("ITEM_ADDED"), "Activity feed has ITEM_ADDED");
    assert(activityTypes.includes("ITEM_REMOVED"), "Activity feed has ITEM_REMOVED");
    assert(activityTypes.includes("ITEM_RETURNED"), "Activity feed has ITEM_RETURNED");
    assert(activityTypes.includes("BAG_OPENED"), "Activity feed has BAG_OPENED");
    assert(activityTypes.includes("BAG_CLOSED"), "Activity feed has BAG_CLOSED");
    assert(activityTypes.includes("REMINDER_CREATED"), "Activity feed has REMINDER_CREATED");

    // 9. Test /notifications/settings (Toggle Notification Types)
    console.log('\n--- 9. Testing /notifications/settings (GET & PUT) ---');
    const getSettingsRes = await request('GET', `/notifications/settings?userId=${userId}`, null, authToken);
    assert(getSettingsRes.status === 200, "GET /notifications/settings returned HTTP 200");

    const updateSettingsRes = await request('PUT', '/notifications/settings', {
      userId,
      notifyOnBagEvents: false,
      notifyOnReminders: true
    }, authToken);

    assert(updateSettingsRes.status === 200, "PUT /notifications/settings returned HTTP 200");
    assert(updateSettingsRes.body.settings.notifyOnBagEvents === false, "notifyOnBagEvents successfully toggled off");

    // 10. Test Documentation Endpoints (/docs & /docs/postman)
    console.log('\n--- 10. Testing /docs & /docs/postman ---');
    const docsHtmlRes = await request('GET', '/docs');
    assert(docsHtmlRes.status === 200, "GET /docs returns HTTP 200 (Interactive HTML docs)");
    assert(docsHtmlRes.body.includes("Beepack API Documentation"), "Contains documentation title");

    const docsPostmanRes = await request('GET', '/docs/postman');
    assert(docsPostmanRes.status === 200, "GET /docs/postman returns HTTP 200 (Postman collection)");
    assert(docsPostmanRes.body.info && docsPostmanRes.body.info.name.includes("Beepack"), "Postman JSON format verified");

    console.log('\n======================================================');
    console.log('  🎉 ALL BEEKPACK PERSON 2 BACKEND TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    if (testServer) testServer.close();
    if (server) server.close();
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
