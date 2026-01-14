import Bytez from 'bytez.js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.BYTEZ_API_KEY;

if (!API_KEY) {
  console.warn('BYTEZ_API_KEY is not set in environment variables');
}

// Initialize Bytez SDK
const sdk = new Bytez(API_KEY || '');
// Use the specific model requested by the user
const model = sdk.model("openai/gpt-oss-20b");

const retryOperation = async (operation: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await operation();
  } catch (error: any) {
    // Retry on rate limits or temporary server errors
    if (retries > 0 && (error.message?.includes('429') || error.message?.includes('500'))) {
      console.warn(`API Request failed. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Helper to run the model and mimic the response structure if needed,
 * or just return the text.
 */
const runQuery = async (messages: { role: string, content: string }[]) => {
    const { error, output } = await model.run(messages);
    if (error) {
        throw new Error(`Bytez API Error: ${error}`);
    }
    
    // Extract text content from response object
    if (typeof output === 'object' && output !== null && 'content' in output) {
        return (output as any).content;
    }
    
    // Fallback if it's already a string
    return String(output);
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
        
        CRITICAL REQUIREMENT:
        - The "content_plan" MUST contain at least 7 distinct posts (one for each day of the week) to be considered a viable strategy. 
        - Do not propose fewer than 7 posts.
        
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

      const text = await retryOperation(() => runQuery([{ role: 'user', content: prompt }]));
      
      // Attempt to parse JSON from the response (handling potential markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from AI response');
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

      const text = await retryOperation(() => runQuery([{ role: 'user', content: prompt }]));
      return text;
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

        IMPORTANT: For "image_url" in the content plan:
        1. You MUST select a valid 'url' from the 'main_image' or 'property_images' provided in the properties data.
        2. If a property has NO images, do NOT select it for a post. Only choose properties with images.
        3. The 'image_url' field is COMPULSORY. Do not leave it null.
        4. Do not invent URLs. Use the exact ones provided.
        
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

      const text = await retryOperation(() => runQuery([{ role: 'user', content: prompt }]));
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from AI response');
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
      // Convert history to Bytez/OpenAI format
      const messages = history.map(h => ({
        role: h.role === 'admin' ? 'user' : 'assistant', // Map 'model' to 'assistant'
        content: h.parts
      }));

      // Add the new message
      messages.push({ role: 'user', content: newMessage });

      const text = await retryOperation(() => runQuery(messages));
      return text;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  },

  /**
   * Raw content generation wrapper
   * Maintains compatibility with existing calls that expect a .response.text() structure
   */
  async generateContent(prompt: string) {
    try {
      const text = await retryOperation(() => runQuery([{ role: 'user', content: prompt }]));
      
      // Return object structure that mimics Gemini SDK for compatibility
      return {
        response: {
          text: () => text
        }
      };
    } catch (error) {
      console.error('Error generating raw content:', error);
      throw error;
    }
  }
};
