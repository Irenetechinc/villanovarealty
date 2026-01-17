import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../api/services/notificationService.js'; // Ensure .js if that's what project uses
import { supabaseAdmin } from '../api/supabase.js';

// Mock Supabase
vi.mock('../api/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    })),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ 
            data: { user: { email: 'admin@test.com' } }, 
            error: null 
        })
      }
    }
  }
}));

describe('Notification System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send in-app notification and trigger email', async () => {
        const payload = {
            userId: 'user-123',
            type: 'lead' as const,
            title: 'New Lead',
            message: 'John Doe interested in Property X',
            metadata: { phone: '1234567890' }
        };

        const consoleSpy = vi.spyOn(console, 'log');
        
        const result = await notificationService.send(payload);

        expect(result.success).toBe(true);
        expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
        
        // Wait for async email (simulated delay is 500ms in service)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[EMAIL SERVICE]'),
            expect.objectContaining({ subject: 'AdRoom Alert: New Lead' })
        );
    }, 5000); // 5s timeout

    it('should handle inspection request notifications', async () => {
        const payload = {
            userId: 'user-123',
            type: 'inspection' as const,
            title: 'Inspection Request',
            message: 'Request for 123 Main St',
            metadata: { property_id: 'prop-1' }
        };

        await notificationService.send(payload);
        expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
    });
});
