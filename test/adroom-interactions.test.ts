
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../api/supabase';
import { botService } from '../api/services/botService';

describe('AdRoom Interactions System', () => {
    let testAdminId: string;
    let testPostId: string;

    // Increase timeout for high latency environments
    beforeAll(async () => {
        // 1. Setup Test Admin
        const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: `test_adroom_${Date.now()}@example.com`,
            password: 'password123',
            email_confirm: true
        });
        
        if (userError || !user.user) {
            console.error('Failed to create test user:', userError);
            throw new Error('Test setup failed: Could not create user');
        }
        testAdminId = user.user.id;

        // 2. Setup Test Post
        const { data: post, error: postError } = await supabaseAdmin.from('adroom_posts').insert({
            content: 'Test Post for Interactions',
            status: 'posted',
            facebook_post_id: '123456_789012'
        }).select().single();

        if (postError || !post) {
            console.error('Failed to create test post:', postError);
            throw new Error('Test setup failed: Could not create post');
        }
        testPostId = post.id;
    }, 60000); // 60s timeout for setup

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
            userName,
            null
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

    it('should correctly record a BOT reply with PARENT ID', async () => {
        const replyId = `reply_${Date.now()}`;
        const content = "This is a bot test reply";
        const parentId = "some_parent_id_123";

        await botService.recordInteraction(
            testAdminId,
            replyId,
            'comment',
            content,
            'bot',
            testPostId,
            'AdRoom Bot',
            parentId
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
        expect(data.parent_id).toBe(parentId);
    });

    afterAll(async () => {
        // Cleanup
        if (testAdminId) await supabaseAdmin.auth.admin.deleteUser(testAdminId);
        if (testPostId) await supabaseAdmin.from('adroom_posts').delete().eq('id', testPostId);
    });
});
