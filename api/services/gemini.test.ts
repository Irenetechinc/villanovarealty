import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  startChat: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mocks.generateContent,
          startChat: mocks.startChat,
        };
      }
    },
  };
});

// Import after mocking
import { geminiService } from './gemini';

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mocks.generateContent.mockResolvedValue({
      response: {
        text: () => 'Mocked response text',
      },
    });

    mocks.startChat.mockReturnValue({
      sendMessage: mocks.sendMessage,
    });
    
    mocks.sendMessage.mockResolvedValue({
      response: {
        text: () => 'Mocked chat response',
      },
    });
  });

  describe('analyzeAssets', () => {
    it('should generate analysis based on assets', async () => {
      const data = {
        properties: [{ id: 1, title: 'Prop 1' }],
        auctions: [{ id: 1, title: 'Auc 1' }],
        projects: [],
      };

      const result = await geminiService.analyzeAssets(data);

      expect(mocks.generateContent).toHaveBeenCalled();
      expect(result).toBe('Mocked response text');
      
      // Verify prompt contains data
      const prompt = mocks.generateContent.mock.calls[0][0];
      expect(prompt).toContain('Properties (1)');
      expect(prompt).toContain('Auctions (1)');
    });

    it('should handle non-retriable errors gracefully', async () => {
      // Mock console.error to keep test output clean
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mocks.generateContent.mockRejectedValue(new Error('API Error'));
      
      const data = { properties: [], auctions: [], projects: [] };
      
      await expect(geminiService.analyzeAssets(data)).rejects.toThrow('API Error');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should retry on 429 errors', async () => {
        // Mock console.warn to keep test output clean
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Fail twice with 429, then succeed
        mocks.generateContent
            .mockRejectedValueOnce(new Error('429 Too Many Requests'))
            .mockRejectedValueOnce(new Error('429 Too Many Requests'))
            .mockResolvedValue({
                response: {
                    text: () => 'Success after retry',
                },
            });

        const data = { properties: [], auctions: [], projects: [] };
        
        // Fast-forward timers to skip the delay
        vi.useFakeTimers();
        const promise = geminiService.analyzeAssets(data);
        
        // Advance time for first retry (1000ms)
        await vi.advanceTimersByTimeAsync(1000);
        // Advance time for second retry (2000ms)
        await vi.advanceTimersByTimeAsync(2000);
        
        const result = await promise;
        
        expect(result).toBe('Success after retry');
        expect(mocks.generateContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
        
        consoleWarnSpy.mockRestore();
        vi.useRealTimers();
    });
  });

  describe('generateStrategy', () => {
    it('should parse JSON response', async () => {
        const mockJson = {
            theme: "Test Theme",
            messaging: "Test Msg",
            content_strategy: [],
            posting_schedule: [],
            ad_recommendations: [],
            budget_breakdown: { content_creation: 0, ad_spend: 0, management: 0 }
        };
        
        mocks.generateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify(mockJson)
            }
        });

        const result = await geminiService.generateStrategy([], {}, "goals");
        expect(result).toEqual(mockJson);
    });
  });
});
