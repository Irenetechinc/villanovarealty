import Bytez from 'bytez.js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.BYTEZ_API_KEY;

if (!API_KEY) {
  console.error('❌ BYTEZ_API_KEY is missing!');
  process.exit(1);
}

const sdk = new Bytez(API_KEY);
const model = sdk.model("openai/gpt-oss-20b");

async function testBytez() {
  console.log('🚀 Testing Bytez API connection...');
  try {
    const { error, output } = await model.run([
      { role: "user", content: "Hello, are you online?" }
    ]);

    if (error) {
      console.error('❌ API Error:', error);
    } else {
      console.log('✅ API Success! Response:', output);
    }
  } catch (e) {
    console.error('❌ Unexpected Error:', e);
  }
}

testBytez();
