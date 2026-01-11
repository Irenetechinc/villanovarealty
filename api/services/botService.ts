import axios from 'axios';
import { supabaseAdmin } from '../supabase.ts';
import { facebookService } from './facebook.ts';
import { geminiService } from './gemini.ts';
import { logActivity } from '../logger.ts';

/**
 * Autonomous Bot Service
 * Handles high-frequency monitoring of social channels and instant responses.
 */
export const botService = {
  // Store processed IDs in memory for cache speed, but sync to DB for persistence
  // In a clustered environment, this should be Redis. For single node, Map is fine.
  processedIds: new Set<string>(),

  /**
   * Start the monitoring loop
   */
  start() {
    console.log('[Bot] Starting Autonomous Monitoring System...');
    
    // Initial sync of processed IDs from DB to avoid re-replying on restart
    this.syncProcessedIds();

    // High-frequency polling (every 10s) - Simulates "Real-time"
    // This is much lighter than it sounds if we use efficient Graph API calls
    setInterval(() => this.monitorCycle(), 10000);
  },

  async syncProcessedIds() {
    const { data } = await supabaseAdmin.from('adroom_interactions').select('facebook_id');
    if (data) {
        data.forEach(row => this.processedIds.add(row.facebook_id));
    }
    console.log(`[Bot] Synced ${this.processedIds.size} historical interactions.`);
  },

  async monitorCycle() {
    try {
        // 1. Get Active Admins
        const { data: activeAdmins } = await supabaseAdmin
            .from('adroom_strategies')
            .select('admin_id')
            .eq('status', 'active');
        
        if (!activeAdmins || activeAdmins.length === 0) return;

        const uniqueAdmins = [...new Set(activeAdmins.map(a => a.admin_id))];

        for (const adminId of uniqueAdmins) {
            await this.processAdmin(adminId);
        }
    } catch (error) {
        console.error('[Bot] Monitor Cycle Error:', error);
    }
  },

  async processAdmin(adminId: string) {
    try {
        const { data: settings } = await supabaseAdmin
            .from('adroom_settings')
            .select('*')
            .eq('admin_id', adminId)
            .single();

        if (!settings || !settings.facebook_page_id || !settings.facebook_access_token) return;

        const { facebook_page_id: pageId, facebook_access_token: token } = settings;

        // PARALLEL EXECUTION for speed
        await Promise.all([
            this.checkMessages(pageId, token, adminId),
            this.checkComments(pageId, token, adminId)
        ]);

    } catch (error) {
        // Silent fail for individual admin to not block others
    }
  },

  /**
   * Check for new comments (using Notifications API for efficiency on old posts)
   */
  async checkComments(pageId: string, accessToken: string, adminId: string) {
    try {
        // GET /me/notifications?type=feed_comment&include_read=false
        // This is the "Magic" endpoint to find comments on OLD posts
        const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/notifications`, {
            params: {
                access_token: accessToken,
                type: 'feed_comment',
                // include_read: false, // In prod, we mark as read. For dev, we might fetch all recent.
                limit: 10,
                fields: 'id,object,updated_time,from,title'
            }
        });

        const notifications = response.data.data || [];

        for (const notif of notifications) {
            // "object" is the Comment ID usually, or the Post ID.
            // For 'feed_comment', object.id is usually the *Comment* ID or the *Post* ID depending on notification type.
            // Let's verify specifically. 
            // Usually notif.object.id is the Comment ID.
            
            const commentId = notif.object?.id;
            if (!commentId) continue;

            if (this.processedIds.has(commentId)) continue;

            // Double check if we already replied in DB (race condition)
            const { data: exists } = await supabaseAdmin.from('adroom_interactions').select('id').eq('facebook_id', commentId).single();
            if (exists) {
                this.processedIds.add(commentId);
                continue;
            }

            // Fetch the actual comment content to generate reply
            const commentDetails = await axios.get(`https://graph.facebook.com/v18.0/${commentId}`, {
                params: { access_token: accessToken, fields: 'message,from,parent' }
            });
            
            const commentMsg = commentDetails.data.message;
            const authorId = commentDetails.data.from?.id;

            // Don't reply to self
            if (authorId === pageId) continue;

            console.log(`[Bot] New Comment detected on ${pageId}: "${commentMsg}"`);

            // Generate AI Reply
            const aiReply = await geminiService.generateContent(`
                You are a friendly, professional social media manager for a real estate agency.
                User Comment: "${commentMsg}"
                
                Write a short, engaging reply (max 1 sentence). 
                Do NOT use hashtags. Do NOT sound like a bot.
            `);
            
            const replyText = aiReply.response.text().trim();

            // Reply
            await facebookService.replyToComment(commentId, replyText, accessToken);

            // Mark as handled
            await this.recordInteraction(adminId, commentId, 'comment', replyText);
            
            // Mark notification as read (optional, good practice)
            // await axios.post(`https://graph.facebook.com/v18.0/${notif.id}`, { unread: false, access_token: accessToken });
        }

    } catch (error: any) {
        // console.error('[Bot] Comment Check Error:', error.response?.data || error.message);
    }
  },

  /**
   * Check for new messages
   */
  async checkMessages(pageId: string, accessToken: string, adminId: string) {
    try {
        const conversations = await facebookService.getConversations(pageId, accessToken);
        
        for (const convo of conversations) {
            const lastMessage = convo.messages?.data?.[0];
            if (!lastMessage) continue;

            // Check if processed
            if (this.processedIds.has(lastMessage.id)) continue;

            // Check DB
            const { data: exists } = await supabaseAdmin.from('adroom_interactions').select('id').eq('facebook_id', lastMessage.id).single();
            if (exists) {
                this.processedIds.add(lastMessage.id);
                continue;
            }

            // Fetch full message details to see SENDER
            const msgDetails = await axios.get(`https://graph.facebook.com/v18.0/${lastMessage.id}`, {
                params: { access_token: accessToken, fields: 'message,from' }
            });

            const senderId = msgDetails.data.from?.id;
            const messageText = msgDetails.data.message;

            // If sender is ME (Page), ignore
            if (senderId === pageId) continue;

            console.log(`[Bot] New Message detected: "${messageText}"`);

            // Generate AI Reply
            const aiReply = await geminiService.generateContent(`
                You are a helpful real estate assistant.
                User Message: "${messageText}"
                
                Provide a helpful, polite response. If they ask about price/details, invite them to visit the website or ask for more info.
                Keep it under 200 characters.
            `);
            
            const replyText = aiReply.response.text().trim();

            // Reply
            await facebookService.sendMessage(senderId, replyText, accessToken);

            // Mark as handled
            await this.recordInteraction(adminId, lastMessage.id, 'message', replyText);
        }

    } catch (error: any) {
        // console.error('[Bot] Message Check Error:', error.response?.data || error.message);
    }
  },

  async recordInteraction(adminId: string, facebookId: string, type: 'comment' | 'message', content: string) {
    this.processedIds.add(facebookId);
    await supabaseAdmin.from('adroom_interactions').insert({
        admin_id: adminId,
        facebook_id: facebookId,
        type,
        content
    });
    logActivity(`[Bot] Auto-replied to ${type}: "${content}"`, 'success');
  }
};
