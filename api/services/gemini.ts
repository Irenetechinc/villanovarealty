import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');
// gemini-2.5-flash-lite is confirmed working (though subject to rate limits)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const retryOperation = async (operation: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && error.message.includes('429')) {
      console.warn(`Rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const geminiService = {
  /**
   * Generates a marketing strategy based on provided properties and goals.
   */
  async generateStrategy(properties: any[], targetAudience: any, goals: string) {
    try {
      const prompt = `
        You are an expert real estate marketing strategist for Villanova Realty.
        
        Task: Create a comprehensive marketing strategy for the following properties:
        ${JSON.stringify(properties, null, 2)}
        
        Target Audience:
        ${JSON.stringify(targetAudience, null, 2)}
        
        Campaign Goals:
        ${goals}
        
        Please provide a detailed strategy including:
        1. Campaign Theme & Messaging
        2. Content Strategy (types of posts, tone of voice)
        3. Posting Schedule (frequency, best times)
        4. Ad Recommendations (targeting, format)
        5. Budget Allocation Strategy
        
        Format the response as a valid JSON object with the following structure:
        {
          "theme": "string",
          "messaging": "string",
          "content_strategy": ["string"],
          "posting_schedule": [{"day": "string", "time": "string", "type": "string"}],
          "ad_recommendations": [{"format": "string", "targeting": "string", "budget_percentage": number}],
          "budget_breakdown": {"content_creation": number, "ad_spend": number, "management": number}
        }
      `;

      const result = await retryOperation(() => model.generateContent(prompt));
      const response = result.response;
      const text = response.text();
      
      // Attempt to parse JSON from the response (handling potential markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from Gemini response');
      }
    } catch (error) {
      console.error('Error generating strategy:', error);
      throw error;
    }
  },

  /**
   * Optimizes a pending post based on the performance of previous posts.
   */
  async optimizeContent(currentPost: string, performanceContext: string) {
    try {
      const prompt = `
        You are the Marketing Director. We are executing a Facebook strategy.
        
        Performance Context (Last few posts):
        ${performanceContext}
        
        Next Pending Post Content:
        "${currentPost}"
        
        Task: The previous posts have not met our engagement goals. 
        Rewrite the "Next Pending Post" to be significantly more engaging, viral, and action-oriented. 
        Use a different angle or hook. Keep it professional but catchy.
        
        Output ONLY the new post content (plain text), no explanations.
      `;

      const result = await retryOperation(() => model.generateContent(prompt));
      return result.response.text();
    } catch (error) {
      console.error('Error optimizing content:', error);
      // Fallback: return original if AI fails
      return currentPost;
    }
  },

  /**
   * Analyzes all assets to provide structured Paid vs Free marketing strategies.
   */
  async analyzeAssets(data: { properties: any[], auctions: any[], projects: any[] }) {
    try {
      const prompt = `
        You are the Marketing Director for Villanova Realty.
        
        Analyze the following assets available in our database:
        
        1. Properties (${data.properties.length}):
        ${JSON.stringify(data.properties.slice(0, 5), null, 2)}
        
        2. Auctions (${data.auctions.length}):
        ${JSON.stringify(data.auctions.slice(0, 5), null, 2)}
        
        3. Projects (${data.projects.length}):
        ${JSON.stringify(data.projects.slice(0, 5), null, 2)}
        
        Task: Create TWO distinct marketing strategies targeted specifically at FACEBOOK.
        
        1. **Free Strategy**: Organic growth, community engagement, regular posting.
        2. **Paid Strategy**: Ads, boosted posts, targeted campaigns with a budget.
        
        CRITICAL GOAL FOR PAID STRATEGY: 
        Minimize Cost Per Click (CPC) and Cost Per Lead (CPL). 
        Our selling point is that AdRoom is cheaper and more effective than manual ads.
        Focus on high-converting, low-competition audience segments.
        Use "Pattern Interrupt" hooks in content to increase CTR (Click Through Rate) which lowers costs.

        For EACH strategy, provide:
        - Theme/Concept
        - Duration (e.g., "7 days")
        - Campaign Goal/KPI (e.g., "Generate 50 Leads" or "Reach 10,000 People")
        - Content Plan (3 specific post ideas with captions and ad format if applicable)
        - Expected Outcome (Reach/Leads estimate)
        - Schedule (e.g., "Daily at 10 AM")

        IMPORTANT: For "image_url" in the content plan, you MUST select the exact 'main_image' URL provided in the properties data. Do not invent URLs. If no image is available, leave it null.
        
        Output valid JSON ONLY with this structure:
        {
          "free_strategy": {
             "theme": "string",
             "duration": "string",
             "goal": "string",
             "content_plan": [{"title": "string", "caption": "string", "image_url": "string"}],
             "expected_outcome": "string",
             "schedule": "string"
          },
          "paid_strategy": {
             "theme": "string",
             "duration": "string",
             "goal": "string",
             "content_plan": [{"title": "string", "caption": "string", "image_url": "string", "ad_format": "string"}],
             "expected_outcome": "string",
             "schedule": "string",
             "recommended_budget": "string",
             "cost_optimization_tactic": "string" 
          }
        }
      `;

      const result = await retryOperation(() => model.generateContent(prompt));
      const response = result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from Gemini response');
      }
    } catch (error) {
      console.error('Error analyzing assets:', error);
      throw error;
    }
  },

  /**
   * Generates a reply or next message in the AdRoom chat.
   */
  async chat(history: { role: string; parts: string }[], newMessage: string) {
    try {
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === 'admin' ? 'user' : 'model',
          parts: [{ text: h.parts }]
        })),
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await retryOperation(() => chat.sendMessage(newMessage));
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  },

  /**
   * Raw content generation wrapper
   */
  async generateContent(prompt: string) {
    try {
      return await retryOperation(() => model.generateContent(prompt));
    } catch (error) {
      console.error('Error generating raw content:', error);
      throw error;
    }
  }
};
