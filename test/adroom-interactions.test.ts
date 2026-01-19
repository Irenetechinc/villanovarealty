
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../api/supabase';
import { botService } from '../api/services/botService';

describe('AdRoom Interactions System', () => {
    let testAdminId: string;
    let testPostId: string;

    beforeAll(async () => {
        // 1. Setup Test Admin
        const { data: user } = await supabaseAdmin.auth.admin.createUser({
            email: `test_adroom_${Date.now()}@example.com`,
            password: 'password123',
            email_confirm: true
        });
        testAdminId = user.user!.id;

        // 2. Setup Test Post
        const { data: post } = await supabaseAdmin.from('adroom_posts').insert({
            content: 'Test Post for Interactions',
            status: 'posted',
            facebook_post_id: '123456_789012'
        }).select().single();
        testPostId = post.id;
    });

    it('should correctly record a USER comment with metadata', async () => {
        const commentId = `comment_${Date.now()}`;
        const content = "This is a user test comment";
        const userName = "Test User";

        await botService.recordInteraction(
            testAdminId,
            commentId,
            'comment',
            content,
            'user',
            testPostId,
            userName
        );

        // Verify in DB
        const { data } = await supabaseAdmin
            .from('adroom_interactions')
            .select('*')
            .eq('facebook_id', commentId)
            .single();

        expect(data).toBeDefined();
        expect(data.sender_role).toBe('user');
        expect(data.user_name).toBe(userName);
        expect(data.post_id).toBe(testPostId);
        expect(data.content).toBe(content);
    });

    it('should correctly record a BOT reply', async () => {
        const replyId = `reply_${Date.now()}`;
        const content = "This is a bot test reply";

        await botService.recordInteraction(
            testAdminId,
            replyId,
            'comment',
            content,
            'bot',
            testPostId,
            'AdRoom Bot'
        );

        // Verify in DB
        const { data } = await supabaseAdmin
            .from('adroom_interactions')
            .select('*')
            .eq('facebook_id', replyId)
            .single();

        expect(data).toBeDefined();
        expect(data.sender_role).toBe('bot');
        expect(data.post_id).toBe(testPostId);
        expect(data.content).toBe(content);
    });

    afterAll(async () => {
        // Cleanup
        if (testAdminId) await supabaseAdmin.auth.admin.deleteUser(testAdminId);
        if (testPostId) await supabaseAdmin.from('adroom_posts').delete().eq('id', testPostId);
    });
});
