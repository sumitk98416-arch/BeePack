const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Integration Tests ---');

  try {
    // 1. Test GET /api/lists
    const listsRes = await request('GET', '/api/lists');
    console.log(`[PASS] GET /api/lists: status ${listsRes.status}, count: ${listsRes.data.lists.length}`);

    // 2. Test GET /api/items
    const itemsRes = await request('GET', '/api/items?list_id=list-college');
    console.log(`[PASS] GET /api/items: status ${itemsRes.status}, college items: ${itemsRes.data.items.length}`);

    // 3. Test POST /api/scans with missing item
    const scanRes = await request('POST', '/api/scans', {
      list_id: 'list-college',
      scanned_uids: ['E2801160', '04A23B9F', 'A1B2C3D4'], // 3 of 7 items
      source: 'Test Runner',
      battery_level: 91
    });
    console.log(`[PASS] POST /api/scans (missing items): status ${scanRes.status}, present: ${scanRes.data.summary.present}/${scanRes.data.summary.total}, missing: ${scanRes.data.summary.missing}`);

    // 4. Test GET /api/analytics
    const analyticsRes = await request('GET', '/api/analytics');
    console.log(`[PASS] GET /api/analytics: status ${analyticsRes.status}, readiness: ${analyticsRes.data.analytics.overall_readiness_pct}%`);

    console.log('--- All API Tests Succeeded! ---');
  } catch (err) {
    console.error('[FAIL] Test error:', err.message);
    process.exit(1);
  }
}

// Execute tests
runTests();
