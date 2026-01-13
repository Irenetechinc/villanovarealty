import axios from 'axios';
import { supabaseAdmin } from '../supabase.js';
import { facebookService } from './facebook.js';
import { geminiService } from './gemini.js';
import { logActivity } from '../logger.js';

/**
 * Autonomous Bot Service
 * Handles Webhook events for instant response and scheduled polling as fallback.
 */
export const botService = {
  // Store processed IDs in memory for cache speed
  processedIds: new Set<string>(),

  /**
   * Start the monitoring loop
   */
  start() {
    console.log('[Bot] Starting Autonomous Monitoring System (Hybrid Mode)...');
    
    // Initial sync of processed IDs from DB to avoid re-replying on restart
    this.syncProcessedIds();

    // STARTUP SCAN: Immediately check for missed interactions while offline
    this.initialScan();

    // REDUCED POLLING: Fallback only (every 30 minutes instead of 10s)
    // Primary trigger should be Webhooks to save API quota
    setInterval(() => this.monitorCycle(), 1800000); 
  },

  async initialScan() {
    console.log('[Bot] Performing startup scan for missed interactions...');
    await this.monitorCycle();
    console.log('[Bot] Startup scan completed.');
  },

  async syncProcessedIds() {
    const { data } = await supabaseAdmin.from('adroom_interactions').select('facebook_id');
    if (data) {
        data.forEach(row => this.processedIds.add(row.facebook_id));
    }
    console.log(`[Bot] Synced ${this.processedIds.size} historical interactions.`);
  },

  /**
   * Handle Incoming Webhook Event (Real-Time)
   */
  async handleWebhookEvent(body: any) {
    try {
        console.log('[Bot] Webhook Received:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            for (const entry of body.entry) {
                const pageId = entry.id;
                
                // 1. Handle Messages
                if (entry.messaging) {
                    for (const messageEvent of entry.messaging) {
                        if (messageEvent.message && !messageEvent.message.is_echo) {
                            await this.processIncomingMessage(pageId, messageEvent);
                        }
                    }
                }

                // 2. Handle Feed/Comments
                if (entry.changes) {
                    for (const change of entry.changes) {
                        // Check for 'feed' (Page Feed) or 'live_videos' etc. 
                        // For comments, it's usually field: 'feed', value: { item: 'comment', verb: 'add' }
                        if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
                            await this.processIncomingComment(pageId, change.value);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Bot] Webhook Handler Error:', error);
    }
  },

  async processIncomingMessage(pageId: string, event: any) {
    const senderId = event.sender.id;
    const messageText = event.message.text;
    const messageId = event.message.mid;

    if (this.processedIds.has(messageId)) return;

    // Get Admin ID associated with this Page
    const { data: settings } = await supabaseAdmin
        .from('adroom_settings')
        .select('admin_id, facebook_access_token')
        .eq('facebook_page_id', pageId)
        .single();

    if (!settings) return;

    console.log(`[Bot] Webhook: New Message from ${senderId}: "${messageText}"`);

    // Only use Gemini if necessary (e.g. for generating content, decision making)
    // For simple responses, we can use templates or check if AI is needed.
    // Assuming we always want AI for now, but keeping it efficient.
    
    // AI Reply
    const aiReply = await geminiService.generateContent(`
        You are a helpful real estate assistant.
        User Message: "${messageText}"
        Keep it professional, helpful, and under 200 characters.
    `);
    const replyText = aiReply.response.text().trim();

    // Send Reply
    await facebookService.sendMessage(senderId, replyText, settings.facebook_access_token);
    
    // Record
    await this.recordInteraction(settings.admin_id, messageId, 'message', replyText);
  },

  async processIncomingComment(pageId: string, value: any) {
    const commentId = value.comment_id;
    const message = value.message;
    const senderId = value.from.id;

    // Ignore self
    if (senderId === pageId) return;
    if (this.processedIds.has(commentId)) return;

    // Get Admin/Token
    const { data: settings } = await supabaseAdmin
        .from('adroom_settings')
        .select('admin_id, facebook_access_token')
        .eq('facebook_page_id', pageId)
        .single();

    if (!settings) return;

    console.log(`[Bot] Webhook: New Comment from ${value.from.name}: "${message}"`);

    // AI Reply
    const aiReply = await geminiService.generateContent(`
        You are a friendly social media manager.
        User Comment: "${message}"
        Write a short, engaging reply (max 1 sentence). No hashtags.
    `);
    const replyText = aiReply.response.text().trim();

    // Reply
    await facebookService.replyToComment(commentId, replyText, settings.facebook_access_token);

    // Record
    await this.recordInteraction(settings.admin_id, commentId, 'comment', replyText);
  },

  // Fallback Polling (Reduced Frequency)
  async monitorCycle() {
    // ... Existing logic but less frequent ...
    // Simplified for brevity as Webhook is primary now
    try {
        const { data: activeAdmins } = await supabaseAdmin.from('adroom_strategies').select('admin_id').eq('status', 'active');
        if (!activeAdmins) return;
        const uniqueAdmins = [...new Set(activeAdmins.map(a => a.admin_id))];
        for (const adminId of uniqueAdmins) {
            await this.processAdmin(adminId);
        }
    } catch (e) { console.error('Polling Error', e); }
  },

  async processAdmin(adminId: string) {
      try {
        const { data: settings } = await supabaseAdmin.from('adroom_settings').select('*').eq('admin_id', adminId).single();
        
        if (!settings?.facebook_page_id || !settings?.facebook_access_token) {
            console.warn(`[Bot] Admin ${adminId} missing Facebook settings. Skipping.`);
            return;
        }
        
        // Parallel checks with explicit logging
        console.log(`[Bot] Scanning Admin ${adminId} (Page: ${settings.facebook_page_id})...`);
        await Promise.all([
            this.checkComments(settings.facebook_page_id, settings.facebook_access_token, adminId),
            this.checkMessages(settings.facebook_page_id, settings.facebook_access_token, adminId)
        ]);
      } catch (e) {
          console.error(`[Bot] Error processing admin ${adminId}:`, e);
      }
  },

  async checkComments(pageId: string, accessToken: string, adminId: string) {
      try {
        // Method 1: Check Notifications (Good for "new" stuff)
        const notifRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/notifications`, {
            params: { access_token: accessToken, type: 'feed_comment', limit: 10, fields: 'id,object,from,title,created_time' }
        });
        
        const notifications = notifRes.data.data || [];
        if (notifications.length > 0) {
            console.log(`[Bot] Found ${notifications.length} recent notifications.`);
        }

        for (const notif of notifications) {
            if (notif.object && notif.object.id) {
                const commentId = notif.object.id;
                await this.processSingleComment(commentId, pageId, accessToken, adminId);
            }
        }

        // Method 2: Check Feed (Fallback for missed notifications)
        // Fetch last 3 posts and their comments
        const feedRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
            params: { access_token: accessToken, limit: 3, fields: 'id,comments.limit(5){id,message,from,created_time}' }
        });
        
        const posts = feedRes.data.data || [];
        for (const post of posts) {
            if (post.comments && post.comments.data) {
                for (const comment of post.comments.data) {
                    await this.processSingleComment(comment.id, pageId, accessToken, adminId, comment);
                }
            }
        }

      } catch (e: any) {
          console.error('[Bot] Check Comments Error:', e.response?.data || e.message);
      }
  },

  async processSingleComment(commentId: string, pageId: string, accessToken: string, _adminId: string, preFetchedData?: any) {
      if (this.processedIds.has(commentId)) return;

      try {
          let comment = preFetchedData;
          
          // Fetch if not provided
          if (!comment) {
              const commentRes = await axios.get(`https://graph.facebook.com/v18.0/${commentId}`, {
                  params: { access_token: accessToken, fields: 'message,from,created_time' }
              });
              comment = { ...commentRes.data, id: commentId };
          }

          if (!comment.from || comment.from.id === pageId) return; // Ignore self

          // Check if we already replied to this specific comment (Double check via API if needed, but ID cache should suffice)
          // For robustness: Check if the comment has replies from US
          // GET /{comment-id}/comments?fields=from
          
          await this.processIncomingComment(pageId, {
              comment_id: comment.id,
              message: comment.message,
              from: comment.from
          });
          
          // Use adminId for logging or future extensions
          // (This fixes the TS6133 unused variable error while keeping the signature ready)
          // console.log(`[Bot] Processed comment for Admin ${adminId}`);
      } catch (e) {
          // Comment might be deleted
      }
  },

  async checkMessages(pageId: string, accessToken: string, _adminId: string) {
      try {
          const conversations = await facebookService.getConversations(pageId, accessToken);
          console.log(`[Bot] Checked inbox. Found ${conversations.length} conversations.`);
          
          for (const convo of conversations) {
              // Check the latest message
              const lastMessage = convo.messages?.data?.[0];
              if (!lastMessage) continue;
              
              if (this.processedIds.has(lastMessage.id)) continue;

              // Fetch details
              const msgRes = await axios.get(`https://graph.facebook.com/v18.0/${lastMessage.id}`, {
                  params: { access_token: accessToken, fields: 'from,message,created_time' }
              });
              const msgData = msgRes.data;

              if (msgData.from?.id === pageId) {
                  // If the LAST message is from us, we've likely handled it.
                  // Add to processed so we don't check again
                  this.processedIds.add(lastMessage.id);
                  continue; 
              }

              // It's a new user message!
              await this.processIncomingMessage(pageId, {
                  sender: { id: msgData.from.id },
                  message: { text: msgData.message, mid: msgData.id }
              });
          }
      } catch (e: any) {
          console.error('[Bot] Check Messages Error:', e.response?.data || e.message);
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
