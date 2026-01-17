import { describe, it, expect, vi } from 'vitest';

// Mock Supabase
vi.mock('../api/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: { admin: { getUserById: vi.fn() } }
  }
}));

describe('Simple Test', () => {
    it('should work', () => {
        expect(true).toBe(true);
    });
});
