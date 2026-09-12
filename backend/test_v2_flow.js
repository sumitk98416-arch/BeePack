/**
 * Remembering Bag v2 — Comprehensive End-to-End Automated Test Suite
 * Tests Google Auth, Onboarding (User Type -> Schedule -> Bag -> RFID Items),
 * Daily Bag Check, Missing Item Detection, Email Notifications, and Security Scoping.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
  console.log('  RUNNING REMEMBERING BAG v2 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Step 0: Reset Database
  const resetRes = await request('POST', '/api/reset-db');
  assert(resetRes.status === 200, "Database reset to initial clean state");

  // Step 1: Google Authentication (New User)
  console.log('\n--- 1. Testing Google Authentication ---');
  const googleAuthRes = await request('POST', '/api/auth/google', {
    googleId: 'google_test_998877',
    email: 'sarah.engineer@gmail.com',
    name: 'Sarah Chen',
    profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
  });

  assert(googleAuthRes.status === 200, "Google Auth returns HTTP 200");
  assert(googleAuthRes.body.token, "Session token generated");
  assert(googleAuthRes.body.user.email === 'sarah.engineer@gmail.com', "Verified Google email preserved");
  assert(googleAuthRes.body.user.emailVerified === true, "Google email marked verified");
  assert(googleAuthRes.body.user.onboardingCompleted === false, "New user onboarding flagged incomplete");
  assert(googleAuthRes.body.redirectTo === '/onboarding', "Redirect to onboarding");

  const userToken = googleAuthRes.body.token;
  const userId = googleAuthRes.body.user.id;

  // Step 2: Verify Protected Session
  const meRes = await request('GET', '/api/auth/me', null, userToken);
  assert(meRes.status === 200, "/api/auth/me authenticated successfully");
  assert(meRes.body.user.id === userId, "User context correctly resolved from token");

  // Step 3: Onboarding - Step 2: User Type Selection
  console.log('\n--- 2. Testing Onboarding: User Type Selection ---');
  const userTypeRes = await request('PUT', '/api/onboarding/user-type', {
    userType: 'employee'
  }, userToken);

  assert(userTypeRes.status === 200, "User Type 'employee' updated");
  assert(userTypeRes.body.user.userType === 'employee', "User Type persisted in profile");
  assert(userTypeRes.body.nextStep === 3, "Advanced to Step 3: Schedule");

  // Step 4: Onboarding - Step 3: Schedule Setup
  console.log('\n--- 3. Testing Onboarding: Schedule Setup ---');
  const scheduleRes = await request('PUT', '/api/onboarding/schedule', {
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '18:00'
  }, userToken);

  assert(scheduleRes.status === 200, "Schedule updated");
  assert(scheduleRes.body.schedule.activeDays.length === 5, "5 Active days saved");
  assert(scheduleRes.body.nextStep === 4, "Advanced to Step 4: Bag Setup");

  // Step 5: Onboarding - Step 4: Bag Setup
  console.log('\n--- 4. Testing Onboarding: Bag Setup ---');
  const bagRes = await request('POST', '/api/onboarding/bag', {
    name: 'Work Tech Backpack',
    hardwareId: 'ESP32-SARAH-01'
  }, userToken);

  assert(bagRes.status === 201, "Bag created successfully");
  assert(bagRes.body.bag.name === 'Work Tech Backpack', "Bag name persisted");
  assert(bagRes.body.nextStep === 5, "Advanced to Step 5: RFID Items");

  const bagId = bagRes.body.bag.id;

  // Step 6: Onboarding - Step 5: RFID Item Registration
  console.log('\n--- 5. Testing Onboarding: RFID Item Registration ---');
  const itemsRes = await request('POST', '/api/onboarding/items', {
    bagId,
    items: [
      { name: 'Work Laptop', rfidUid: 'AA11BB22', category: 'Electronics', importance: 'critical' },
      { name: 'Office Security Pass', rfidUid: 'CC33DD44', category: 'Credentials', importance: 'critical' },
      { name: 'Laptop Charger', rfidUid: 'EE55FF66', category: 'Electronics', importance: 'medium' },
      { name: 'House Keys', rfidUid: '11223344', category: 'Personal', importance: 'critical' }
    ]
  }, userToken);

  assert(itemsRes.status === 201, "RFID Items registered successfully");
  assert(itemsRes.body.items.length === 4, "4 items associated with RFID UIDs");
  assert(itemsRes.body.nextStep === 6, "Advanced to Step 6: Complete");

  // Step 7: Onboarding - Step 6: Complete
  console.log('\n--- 6. Testing Onboarding: Complete ---');
  const completeRes = await request('POST', '/api/onboarding/complete', null, userToken);
  assert(completeRes.status === 200, "Onboarding finalized");
  assert(completeRes.body.user.onboardingCompleted === true, "User onboardingCompleted is true");
  assert(completeRes.body.redirectTo === '/dashboard', "Redirects to dashboard");

  // Step 8: Daily Bag Check — All Items Present
  console.log('\n--- 7. Testing Daily Bag Check: All Items Present ---');
  const checkAllRes = await request('POST', '/api/bag/check', {
    bagId,
    scannedUids: ['AA11BB22', 'CC33DD44', 'EE55FF66', '11223344'],
    source: 'RC522 Proximity Tap',
    forceActiveOverride: true
  }, userToken);

  assert(checkAllRes.status === 200, "Bag check executed");
  assert(checkAllRes.body.summary.total === 4, "Total expected items is 4");
  assert(checkAllRes.body.summary.present === 4, "Present items is 4");
  assert(checkAllRes.body.summary.missing === 0, "Missing items is 0");
  assert(checkAllRes.body.summary.isAllPresent === true, "isAllPresent is true");
  assert(checkAllRes.body.notification === null, "No alert triggered when all items packed");

  // Step 9: Daily Bag Check — Missing Items & Email Alert
  console.log('\n--- 8. Testing Daily Bag Check: Missing Items & Notification ---');
  const checkMissingRes = await request('POST', '/api/bag/check', {
    bagId,
    // Laptop Charger ('EE55FF66') is omitted
    scannedUids: ['AA11BB22', 'CC33DD44', '11223344'],
    source: 'RC522 Proximity Tap',
    forceActiveOverride: true
  }, userToken);

  assert(checkMissingRes.status === 200, "Bag check executed");
  assert(checkMissingRes.body.summary.present === 3, "3 / 4 items detected");
  assert(checkMissingRes.body.summary.missing === 1, "1 item missing");
  assert(checkMissingRes.body.summary.missingItems[0].name === 'Laptop Charger', "Identified missing 'Laptop Charger'");
  assert(checkMissingRes.body.notification !== null, "Email notification dispatched on active day");
  assert(checkMissingRes.body.notification.recipient === 'sarah.engineer@gmail.com', "Notification addressed to user's Google email");

  // Step 10: Unknown RFID Tag Detection
  console.log('\n--- 9. Testing Unknown RFID Tag Filtering ---');
  const checkUnknownRes = await request('POST', '/api/bag/check', {
    bagId,
    scannedUids: ['AA11BB22', 'UNKNOWN_TAG_999'],
    source: 'RC522 Proximity Tap'
  }, userToken);

  assert(checkUnknownRes.status === 200, "Bag check with unknown tag handled");
  assert(checkUnknownRes.body.summary.unknownCount === 1, "1 Unknown RFID tag identified");
  assert(checkUnknownRes.body.summary.unknownUids[0] === 'UNKNOWN_TAG_999', "Unknown tag UID captured");

  // Step 11: Multi-User Scoping & Isolation
  console.log('\n--- 10. Testing Security & Multi-User Isolation ---');
  const userBRes = await request('POST', '/api/auth/google', {
    googleId: 'google_user_b_456',
    email: 'bob.student@college.edu',
    name: 'Bob Student'
  });
  const userBToken = userBRes.body.token;

  // User B queries their bags
  const userBBags = await request('GET', '/api/user/bags', null, userBToken);
  assert(userBBags.body.bags.length === 0, "User B cannot see User A's bags");

  // User B attempts to access User A's bag items
  const userBItems = await request('GET', `/api/user/items?bagId=${bagId}`, null, userBToken);
  assert(userBItems.body.items.length === 0, "User B cannot see User A's items");

  // Step 12: Notification History
  console.log('\n--- 11. Testing Notification History ---');
  const notifHistory = await request('GET', '/api/notifications/history', null, userToken);
  assert(notifHistory.status === 200, "Notification history retrieved");
  assert(notifHistory.body.notifications.length >= 1, "Past notification records available");

  console.log('\n======================================================');
  console.log('  🎉 ALL 12 TEST SUITE MODULES PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
