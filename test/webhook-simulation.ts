import axios from 'axios';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/adroom/webhook`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log('🚀 Starting Webhook Simulation Test...');

  // 1. Simulate Feed Comment
  const commentPayload = {
    object: "page",
    entry: [
      {
        id: "106623265058935", // REAL Page ID
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "feed",
            value: {
              item: "comment",
              verb: "add",
              comment_id: `comment_${Date.now()}`,
              post_id: "post_123456789",
              message: "REAL-TIME TEST: This comment should trigger logs immediately.",
              from: {
                id: "999999999999",
                name: "Simulation User"
              },
              created_time: Math.floor(Date.now() / 1000)
            }
          }
        ]
      }
    ]
  };

  console.log('\n[1] Sending Comment Webhook...');
  try {
    const res = await axios.post(BASE_URL, commentPayload);
    console.log(`✅ Status: ${res.status} ${res.data}`);
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}`);
    if (e.code === 'ECONNREFUSED') {
        console.error('   Hint: Is the server running? (npm run server)');
    }
  }

  await sleep(1000);

  // 2. Simulate Message
  const messagePayload = {
    object: "page",
    entry: [
      {
        id: "106623265058935", // REAL Page ID
        time: Math.floor(Date.now() / 1000),
        messaging: [
          {
            sender: { id: "999999999999" },
            recipient: { id: "106623265058935" },
            timestamp: Math.floor(Date.now() / 1000),
            message: {
              mid: `mid.${Date.now()}`,
              text: "REAL-TIME TEST: This message should trigger logs immediately."
            }
          }
        ]
      }
    ]
  };

  console.log('\n[2] Sending Message Webhook...');
  try {
    const res = await axios.post(BASE_URL, messagePayload);
    console.log(`✅ Status: ${res.status} ${res.data}`);
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}`);
  }

  console.log('\n--- Test Completed ---');
  console.log('Check the server console. You should see "[Bot] Webhook: New Comment..." logs.');
}

runTest();
