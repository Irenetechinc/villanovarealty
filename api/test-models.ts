import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log('Testing with API Key:', apiKey ? 'Present' : 'Missing');

if (!apiKey) {
    console.error('No API key found!');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // Note: The SDK doesn't expose listModels directly on genAI instance in some versions,
    // but let's try to infer or just try a standard generation to see if we can get a better error
    // Actually, newer SDKs might not have listModels helper easily accessible, 
    // but we can try to hit the REST endpoint or just try the most basic model.
    
    // Let's try 'gemini-1.5-flash' again but catch the specific error details
    console.log('Attempting to use model: gemini-1.5-flash');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Hello');
    console.log('Success with gemini-1.5-flash:', result.response.text());
  } catch (error: any) {
    console.error('Error with gemini-1.5-flash:', error.message);
    
    // Fallback try
    try {
        console.log('Attempting to use model: gemini-pro');
        const modelPro = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const resultPro = await modelPro.generateContent('Hello');
        console.log('Success with gemini-pro:', resultPro.response.text());
    } catch (e: any) {
        console.error('Error with gemini-pro:', e.message);
    }
  }
}

listModels();
