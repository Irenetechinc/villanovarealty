
import axios from 'axios';

async function testWebhook() {
  console.log('Testing Webhook Endpoint...');
  
  const payload = {
    object: 'page',
    entry: [
      {
        id: '123456789', // Mock Page ID
        time: Date.now(),
        messaging: [
          {
            sender: { id: '987654321' }, // Mock User ID
            recipient: { id: '123456789' },
            timestamp: Date.now(),
            message: {
              mid: 'mid.1234567890',
              text: 'Hello, is this still available?',
              is_echo: false
            }
          }
        ]
      }
    ]
  };

  try {
    // Send to local server
    const response = await axios.post('http://localhost:3000/api/adroom/webhook', payload);
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
    
    if (response.status === 200) {
        console.log('✅ Webhook Test Passed: Server accepted the payload.');
    } else {
        console.log('❌ Webhook Test Failed: Server rejected the payload.');
    }
  } catch (error: any) {
    console.error('❌ Webhook Test Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
        console.log('Ensure the server is running on port 3000 (npm start or npm run server)');
    }
  }
}

testWebhook();
