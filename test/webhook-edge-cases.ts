import axios from 'axios';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/adroom/webhook`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log('🚀 Starting Webhook Edge Case Test...');

  // Simulate Comment on a Status Update (field: "status" instead of "feed")
  const statusCommentPayload = {
    object: "page",
    entry: [
      {
        id: "106623265058935", // REAL Page ID
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "status", // Edge case!
            value: {
              item: "comment",
              verb: "add",
              comment_id: `comment_status_${Date.now()}`,
              post_id: "status_123",
              message: "EDGE CASE TEST: Comment on status update.",
              from: {
                id: "999999999999",
                name: "Edge Case User"
              },
              created_time: Math.floor(Date.now() / 1000)
            }
          }
        ]
      }
    ]
  };

  console.log('\n[1] Sending Status Comment Webhook...');
  try {
    const res = await axios.post(BASE_URL, statusCommentPayload);
    console.log(`✅ Status: ${res.status} ${res.data}`);
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}`);
  }

  console.log('\n--- Test Completed ---');
  console.log('Check the server console. You should see "[Bot] Webhook: New Comment..." logs.');
}

runTest();
