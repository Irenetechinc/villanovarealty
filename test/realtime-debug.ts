import axios from 'axios';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/adroom/webhook`;

// REAL Page ID from user logs
const PAGE_ID = "106623265058935"; 

async function runRealtimeDebug() {
  console.log('🚀 Starting Real-time Debug Test...');
  console.log(`Target: ${BASE_URL}`);

  // 1. Simulate a Message Event
  // We use a timestamp of NOW to ensure it looks fresh
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
              mid: `mid.${Date.now()}`,
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
    
    console.log('\n👉 MONITOR THE SERVER LOGS NOW.');
    console.log('You should see:');
    console.log('  1. [Bot] ⚡ Real-time Webhook Triggered!');
    console.log('  2. [Bot] Webhook RAW: { ... }');
    console.log('  3. [Bot] Webhook: New Message from ...');
    console.log('  4. [Facebook API] Sending message to ...');
  } catch (e: any) {
    console.error(`❌ Webhook Failed: ${e.message}`);
    if (e.response) {
        console.error('Data:', e.response.data);
    }
  }
}

runRealtimeDebug();
