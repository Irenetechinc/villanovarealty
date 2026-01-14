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
        console.log('[Bot] ⚡ Real-time Webhook Triggered!');
        // EXTREMELY IMPORTANT: Log the raw body to debug field mismatches
        console.log('[Bot] Webhook RAW:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            for (const entry of body.entry) {
                const pageId = entry.id;
                
                // 1. Handle Messages
                if (entry.messaging) {
                    console.log(`[Bot] Processing ${entry.messaging.length} messaging events...`);
                    for (const messageEvent of entry.messaging) {
                        if (messageEvent.message && !messageEvent.message.is_echo) {
                            await this.processIncomingMessage(pageId, messageEvent);
                        } else {
                            console.log('[Bot] Skipped messaging event (echo or no message):', messageEvent);
                        }
                    }
                }

                // 2. Handle Feed/Comments/Changes
                if (entry.changes) {
                    console.log(`[Bot] Processing ${entry.changes.length} changes...`);
                    for (const change of entry.changes) {
                        try {
                            const value = change.value;
                            // Relaxed check: Accept comments from any field (feed, status, photos, etc.)
                            if (value && value.item === 'comment' && value.verb === 'add') {
                                console.log('[Bot] Detected new comment:', value.comment_id);
                                await this.processIncomingComment(pageId, value);
                            } else {
                                // Log ignored types for debugging to identify missed events
                                console.log(`[Bot] Ignored Change: Field=${change.field}, Item=${value?.item}, Verb=${value?.verb}`);
                            }
                        } catch (changeError) {
                            console.error('[Bot] Error processing change entry:', changeError);
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

    if (this.processedIds.has(messageId)) {
        console.log(`[Bot] Skipping already processed message: ${messageId}`);
        return;
    }

    // Get Admin ID associated with this Page
    const { data: settings } = await supabaseAdmin
        .from('adroom_settings')
        .select('admin_id, facebook_access_token')
        .eq('facebook_page_id', pageId)
        .single();

    if (!settings) {
        console.error(`[Bot] No settings found for Page ID ${pageId}`);
        return;
    }

    // Use User Profile for better logs
    const userProfile = await facebookService.getUserProfile(senderId, settings.facebook_access_token);
    const username = userProfile.name || 'Unknown User';

    console.log(`[Bot] Webhook: New Message from ${username} (${senderId}): "${messageText}"`);

    // 0. Send Immediate "Typing..." Indicator
    // Don't await this, just fire it.
    facebookService.sendTypingIndicator(senderId, settings.facebook_access_token)
        .catch(() => {}); // Ignore errors

    // AI Reply Logic
    try {
        // 1. Fetch Context (Last 5 messages)
        const history = await facebookService.getConversationHistory(pageId, senderId, settings.facebook_access_token, 5);
        
        // Format history for Gemini
        const contextString = history.reverse().map((msg: any) => {
            const role = msg.from.id === pageId ? 'Assistant' : 'User';
            return `${role}: ${msg.message}`;
        }).join('\n');

        const prompt = `
            You are a helpful real estate assistant for Villanova Realty.
            
            Conversation History:
            ${contextString}
            
            User's New Message: "${messageText}"
            
            Instructions:
            - Reply professionally and helpfully.
            - Keep it under 200 characters if possible.
            - If the user asks about property listings, suggest checking the website or asking for specific details.
        `;

        const aiReply = await geminiService.generateContent(prompt);
        const replyText = aiReply.response.text().trim();

        // Send Reply
        await facebookService.sendMessage(senderId, replyText, settings.facebook_access_token);
        
        // Record
        await this.recordInteraction(settings.admin_id, messageId, 'message', replyText);
    } catch (err) {
        console.error('[Bot] Failed to process message:', err);
    }
  },

  async processIncomingComment(pageId: string, value: any) {
    const commentId = value.comment_id;
    const message = value.message;
    const senderId = value.from.id;

    // Ignore self
    if (senderId === pageId) return;
    if (this.processedIds.has(commentId)) {
        console.log(`[Bot] Skipping comment ${commentId}: Already processed.`);
        return;
    }

    // Get Admin/Token
    const { data: settings } = await supabaseAdmin
        .from('adroom_settings')
        .select('admin_id, facebook_access_token')
        .eq('facebook_page_id', pageId)
        .single();

    if (!settings) {
        console.error(`[Bot] No settings found for Page ID ${pageId}`);
        return;
    }

    const username = value.from.name || 'Unknown User';
    // CONSOLE LOG FOR DASHBOARD
    console.log(`[Dashboard] 💬 COMMENT from ${username} (${senderId}): "${message}"`);
    console.log(`[Bot] Webhook: New Comment from ${username}: "${message}"`);

    try {
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
    } catch (err) {
        console.error('[Bot] Failed to process comment:', err);
    }
  },

  // Fallback Polling (Reduced Frequency)
  async monitorCycle() {
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
        // Method: Check Feed (Fallback for missed notifications)
        // Fetch last 5 posts and their comments (increased from 3 to catch more)
        const feedRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
            params: { access_token: accessToken, limit: 5, fields: 'id,comments.limit(10){id,message,from,created_time}' }
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
              const commentRes = await axios.get(`https://graph.facebook.com/v21.0/${commentId}`, {
                  params: { access_token: accessToken, fields: 'message,from,created_time' }
              });
              comment = { ...commentRes.data, id: commentId };
          }

          if (!comment.from || comment.from.id === pageId) return; // Ignore self

          await this.processIncomingComment(pageId, {
              comment_id: comment.id,
              message: comment.message,
              from: comment.from
          });
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
              const msgRes = await axios.get(`https://graph.facebook.com/v21.0/${lastMessage.id}`, {
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
    logActivity(`[Bot] Auto-replied to ${type}: "${content}"`, 'success');
  }
};
