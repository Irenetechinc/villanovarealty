import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { facebookService } from './facebook';

vi.mock('axios');

describe('facebookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should return valid true when API returns success', async () => {
      (axios.get as any).mockResolvedValue({
        data: { name: 'Test Page', id: '123' }
      });

      const result = await facebookService.validateToken('123', 'token');
      expect(result).toEqual({ valid: true, name: 'Test Page' });
    });

    it('should return valid false when API fails', async () => {
      (axios.get as any).mockRejectedValue({
        response: { data: { error: { message: 'Invalid token' } } }
      });

      const result = await facebookService.validateToken('123', 'bad_token');
      expect(result).toEqual({ valid: false, error: 'Invalid token' });
    });
  });

  describe('publishPost', () => {
    it('should return post ID on success', async () => {
      (axios.post as any).mockResolvedValue({
        data: { id: 'post_123' }
      });

      const result = await facebookService.publishPost('123', 'token', 'Hello World');
      expect(result).toBe('post_123');
    });

    it('should handle API errors', async () => {
      (axios.post as any).mockRejectedValue({
        response: { data: { error: { message: 'Permission error' } } }
      });

      await expect(facebookService.publishPost('123', 'token', 'Hello'))
        .rejects.toThrow('Permission error');
    });
  });
});
