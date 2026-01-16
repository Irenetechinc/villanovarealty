import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletService } from '../api/services/wallet.js';
import { adRoomService } from '../api/services/adRoomService.js';
import { facebookService } from '../api/services/facebook.js';
import { supabaseAdmin } from '../api/supabase.js';

// Mock dependencies
vi.mock('../api/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({ limit: vi.fn() })),
        })),
        limit: vi.fn(),
      })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      update: vi.fn(() => ({ eq: vi.fn() })),
    })),
    rpc: vi.fn(),
  },
}));

vi.mock('../api/services/facebook.js', () => ({
  facebookService: {
    publishPost: vi.fn(),
  },
}));

describe('AdRoom Payment & Execution Flow', () => {
  const adminId = 'test-admin-id';
  const strategyId = 'test-strategy-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payment Processing', () => {
    it('should deduct funds for paid strategy', async () => {
      // Mock wallet balance check
      const mockWallet = { id: 'wallet-123', balance: 10000 };
      
      // Setup mock chain for getBalance
      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'wallets') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockWallet, error: null })
              })
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { ...mockWallet, balance: 5000 }, error: null })
                })
              })
            })
          };
        }
        if (table === 'transactions') {
          return {
            insert: () => Promise.resolve({ error: null })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      const result = await walletService.deductFunds(adminId, 5000, 'ad_spend');
      
      expect(result.balance).toBe(5000);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('transactions');
    });

    it('should fail if insufficient funds', async () => {
      const mockWallet = { id: 'wallet-123', balance: 1000 }; // Less than cost
      
      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'wallets') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockWallet, error: null })
              })
            })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      await expect(walletService.deductFunds(adminId, 5000, 'ad_spend'))
        .rejects.toThrow('Insufficient funds');
    });
  });

  describe('Ad Execution (Sponsored)', () => {
    it('should publish post immediately for paid strategy', async () => {
      // Mock strategy data
      const mockStrategy = {
        id: strategyId,
        type: 'paid',
        adroom_settings: {
          facebook_page_id: 'page-123',
          facebook_access_token: 'token-abc'
        }
      };

      const mockPendingPosts = [
        { id: 'post-1', content: 'Test Ad', image_url: 'http://img.com', status: 'pending' }
      ];

      // Mock DB calls
      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'adroom_strategies') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockStrategy })
              })
            })
          };
        }
        if (table === 'adroom_posts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: mockPendingPosts })
              })
            }),
            update: vi.fn(() => ({ eq: () => Promise.resolve({}) }))
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      // Mock Facebook success
      (facebookService.publishPost as any).mockResolvedValue('fb-post-id-123');

      // Run the service
      await adRoomService.scanAndFixPostQuality(strategyId);

      // Verify Facebook API was called
      expect(facebookService.publishPost).toHaveBeenCalledWith(
        'page-123',
        'token-abc',
        'Test Ad',
        'http://img.com'
      );

      // Verify DB was updated to 'posted'
      expect(supabaseAdmin.from).toHaveBeenCalledWith('adroom_posts');
    });
  });
});
