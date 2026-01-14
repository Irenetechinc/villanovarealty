import axios from 'axios';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/adroom/webhook`;
const DEBUG_URL = `http://localhost:${PORT}/api/adroom/debug/status`;

// REAL Page ID from user logs
const PAGE_ID = "106623265058935"; 

async function runRealtimeDebug() {
  console.log('🚀 Starting Real-time Processing Verification Test...');
  console.log(`Target: ${BASE_URL}`);

  // 0. Check initial state
  let initialCount = 0;
  try {
      const status = await axios.get(DEBUG_URL);
      initialCount = status.data.webhookCount;
      console.log(`[Init] Webhooks received so far: ${initialCount}`);
  } catch (e) {
      console.log('[Init] Server might be down or debug endpoint missing.');
  }

  // 1. Simulate a Message Event
  const messageId = `mid.${Date.now()}`;
  const payload = {
    object: "page",
    entry: [
      {
        id: PAGE_ID,
        time: Math.floor(Date.now() / 1000),
        messaging: [
          {
            sender: { id: "123456789012345" }, // Fake User ID
            recipient: { id: PAGE_ID },
            timestamp: Math.floor(Date.now() / 1000),
            message: {
              mid: messageId,
              text: "DEBUG: Real-time immediate response check."
            }
          }
        ]
      }
    ]
  };

  console.log('\n[1] Sending Webhook Payload...');
  try {
    const start = Date.now();
    const res = await axios.post(BASE_URL, payload);
    const duration = Date.now() - start;
    console.log(`✅ Webhook Accepted: ${res.status} (${duration}ms)`);
    
    if (duration > 2000) {
        console.error('❌ WARNING: Webhook took too long! It should be near-instant.');
    }

    console.log('[2] Verifying Processing Side-Effects (Polling)...');
    
    // Poll for 5 seconds to see if it processes
    let processed = false;
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms
        try {
            const status = await axios.get(DEBUG_URL);
            if (status.data.webhookCount > initialCount) {
                console.log(`   ✅ Server acknowledged webhook reception (Count: ${status.data.webhookCount})`);
                
                // Note: It won't fully process because the user ID is fake and DB lookup for settings will fail/warn
                // But we can check if it attempted to process by seeing logs (manual)
                // Or checking lastProcessedId if we mocked the DB/User.
                // Since we can't easily mock DB here, we rely on the webhookCount incrementing
                // which proves handleWebhookEvent was called.
                processed = true;
                break;
            }
        } catch (e) {}
    }

    if (processed) {
        console.log('\n✅ TEST PASSED: Webhook was received and triggered the handler immediately.');
    } else {
        console.error('\n❌ TEST FAILED: Webhook handler did not increment count within 5 seconds.');
    }

  } catch (e: any) {
    console.error(`❌ Webhook Failed: ${e.message}`);
    if (e.response) {
        console.error('Data:', e.response.data);
    }
  }
}

runRealtimeDebug();
