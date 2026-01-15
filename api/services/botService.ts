import axios from 'axios';
import { supabaseAdmin } from '../supabase.js';
import { facebookService } from './facebook.js';
import { geminiService } from './gemini.js';
import { logActivity } from '../logger.js';
import PQueue from 'p-queue';

// Interfaces for Task Management
interface BotTask {
    id: string; // Unique ID (Facebook Message ID or Comment ID)
    type: 'message' | 'comment';
    payload: any;
    pageId: string;
    timestamp: number;
    retryCount: 0;
}

/**
 * Autonomous Bot Service
 * Handles Webhook events for instant response and scheduled polling as fallback.
 * Now features a Robust Task Queue to handle concurrency and prevent duplication.
 */
export const botService = {
  // Store processed IDs in memory for cache speed
  processedIds: new Set<string>(),
  
  // Task Queue for managing concurrent processing
  // Concurrency: 1 ensures FIFO and no race conditions on single-threaded logic
  taskQueue: new PQueue({ concurrency: 1 }),
  
  // Track tasks currently in queue to prevent duplicates during scan
  queuedTaskIds: new Set<string>(),

  // Debug stats
  lastWebhookTime: 0,
  lastProcessedId: '',
  webhookCount: 0,

  /**
   * Start the monitoring loop
   */
  start() {
    console.log('[Bot] Starting Autonomous Monitoring System (Hybrid Mode)...');
    
    // Initial sync of processed IDs from DB to avoid re-replying on restart
    this.syncProcessedIds();

    // STARTUP SCAN: Immediately check for missed interactions while offline
    this.initialScan();

    // REDUCED POLLING: Fallback only (every 30 seconds)
    // Primary trigger should be Webhooks to save API quota
    setInterval(() => this.monitorCycle(), 30000); 
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
   * Add a task to the processing queue
   */
  addTask(task: BotTask) {
      if (this.processedIds.has(task.id)) {
          // Already processed
          return;
      }
      if (this.queuedTaskIds.has(task.id)) {
          // Already queued, don't add duplicate
          // console.log(`[Bot] Task ${task.id} already queued. Skipping duplicate.`);
          return;
      }

      // Add to queue tracker
      this.queuedTaskIds.add(task.id);

      // Push to PQueue
      this.taskQueue.add(async () => {
          try {
              console.log(`[Bot] Processing Task: ${task.type} ID: ${task.id}`);
              
              if (task.type === 'message') {
                  await this.processIncomingMessage(task.pageId, task.payload);
              } else if (task.type === 'comment') {
                  await this.processIncomingComment(task.pageId, task.payload);
              }

          } catch (error) {
              console.error(`[Bot] Task Execution Failed for ${task.id}:`, error);
          } finally {
              // Cleanup after processing (success or fail)
              this.queuedTaskIds.delete(task.id);
          }
      });
  },

  /**
   * Handle Incoming Webhook Event (Real-Time)
   */
  async handleWebhookEvent(body: any) {
    this.lastWebhookTime = Date.now();
    this.webhookCount++;
    
    try {
        console.log(`[Bot] ⚡ Real-time Webhook Triggered! (#${this.webhookCount})`);
        
        if (body.object === 'page') {
            if (!body.entry || !Array.isArray(body.entry)) return;

            for (const entry of body.entry) {
                const pageId = String(entry.id);
                
                // 1. Handle Messages
                if (entry.messaging) {
                    for (const messageEvent of entry.messaging) {
                        if (messageEvent.message && !messageEvent.message.is_echo) {
                            // Enqueue Message Task
                            this.addTask({
                                id: String(messageEvent.message.mid),
                                type: 'message',
                                payload: messageEvent,
                                pageId: pageId,
                                timestamp: Date.now(),
                                retryCount: 0
                            });
                        }
                    }
                }

                // 2. Handle Feed/Comments
                if (entry.changes) {
                    for (const change of entry.changes) {
                        const value = change.value;
                        if (value && value.item === 'comment' && value.verb === 'add') {
                            // Enqueue Comment Task
                            this.addTask({
                                id: String(value.comment_id),
                                type: 'comment',
                                payload: value,
                                pageId: pageId,
                                timestamp: Date.now(),
                                retryCount: 0
                            });
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
    const senderId = String(event.sender.id);
    const messageText = event.message.text;
    const messageId = String(event.message.mid);

    // Double Check inside execution context (in case of race conditions)
    if (this.processedIds.has(messageId)) return;

    console.log(`[Bot] Executing Message Logic ${messageId} from ${senderId}...`);

    // Get Admin ID associated with this Page
    const { data: settings } = await supabaseAdmin
        .from('adroom_settings')
        .select('admin_id, facebook_access_token')
        .eq('facebook_page_id', pageId)
        .single();

    if (!settings) {
        console.error(`[Bot] No settings found for Page ID ${pageId}. Cannot reply.`);
        return;
    }

    // 0. Send Immediate "Typing..." Indicator
    facebookService.sendTypingIndicator(senderId, settings.facebook_access_token).catch(() => {});

    // AI Reply Logic
    try {
        // 1. Fetch Context (Last 5 messages)
        const history = await facebookService.getConversationHistory(pageId, senderId, settings.facebook_access_token, 5);
        
        // Format history for Gemini/Bytez
        const contextString = history.reverse().map((msg: any) => {
            const role = msg.from.id === pageId ? 'assistant' : 'user'; // Ensure standard roles
            return `${role}: ${msg.message}`;
        }).join('\n');

        // 2. Fetch Knowledge Base (Available Properties)
        const { data: properties } = await supabaseAdmin
            .from('properties')
            .select('title, price, location, type')
            .eq('status', 'available')
            .limit(5); // Provide top 5 properties for context

        const propertyContext = properties?.length 
            ? properties.map(p => `- ${p.title} (${p.type}): $${p.price} in ${p.location}`).join('\n')
            : "No specific property data available currently. Direct them to the website.";

        const prompt = `
            You are a helpful real estate assistant for Villanova Realty.
            
            AVAILABLE PROPERTIES (Use this data to answer questions):
            ${propertyContext}
            
            CONVERSATION HISTORY:
            ${contextString}
            
            USER'S NEW MESSAGE: "${messageText}"
            
            INSTRUCTIONS:
            - Reply professionally and helpfully based ONLY on the provided property data or general real estate knowledge.
            - If the user asks for something not listed, politely suggest they check our full website.
            - Keep it under 200 characters if possible.
            - Do not make up facts.
        `;

        const aiReply = await geminiService.generateContent(prompt);
        const replyText = aiReply.response.text().trim();

        console.log(`[Bot] Generated AI Reply: "${replyText}"`);

        // Send Reply
        await facebookService.sendMessage(senderId, replyText, settings.facebook_access_token);
        
        // Record
        await this.recordInteraction(settings.admin_id, messageId, 'message', replyText);
        this.lastProcessedId = messageId;

    } catch (err) {
        console.error('[Bot] Failed to process message:', err);
    }
  },

  async processIncomingComment(pageId: string, value: any) {
    const commentId = String(value.comment_id);
    const message = value.message;
    const senderId = String(value.from.id);

    // Ignore self
    if (senderId === pageId) return;

    // Double-Check DB to prevent duplicates (Idempotency)
    const { count } = await supabaseAdmin
        .from('adroom_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('facebook_id', commentId);

    if (count && count > 0) {
        console.log(`[Bot] Skipping comment ${commentId}: Found in DB.`);
        this.processedIds.add(commentId); // Update cache
        return;
    }

    if (this.processedIds.has(commentId)) {
        console.log(`[Bot] Skipping comment ${commentId}: Already processed (Cache).`);
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

    const username = value.from?.name || 'Unknown User';
    // Fix: Handle cases where 'from' might be missing or incomplete
    if (!value.from || !value.from.id) {
        console.warn(`[Bot] Skipping comment ${commentId}: Missing 'from' user data.`);
        return;
    }
    
    console.log(`[Bot] Webhook: New Comment from ${username}: "${message}"`);

    try {
        // AI Reply
        const aiReply = await geminiService.generateContent(`
            You are a friendly social media manager for Villanova Realty.
            User Comment: "${message}"
            Write a short, engaging reply (max 1 sentence). No hashtags.
        `);
        const replyText = aiReply.response.text().trim();

        // Reply
        await facebookService.replyToComment(commentId, replyText, settings.facebook_access_token);

        // Record
        await this.recordInteraction(settings.admin_id, commentId, 'comment', replyText);
        this.lastProcessedId = commentId;
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
            return;
        }
        
        // Parallel checks with explicit logging
        // console.log(`[Bot] Scanning Admin ${adminId} (Page: ${settings.facebook_page_id})...`);
        await Promise.all([
            this.checkComments(settings.facebook_page_id, settings.facebook_access_token, adminId),
            this.checkMessages(settings.facebook_page_id, settings.facebook_access_token, adminId)
        ]);
      } catch (e) {
          console.error(`[Bot] Error processing admin ${adminId}:`, e);
      }
  },

  async checkComments(pageId: string, accessToken: string, _adminId: string) {
      try {
        const feedRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
            params: { access_token: accessToken, limit: 5, fields: 'id,comments.limit(10){id,message,from,created_time}' }
        });
        
        const posts = feedRes.data.data || [];
        for (const post of posts) {
            if (post.comments && post.comments.data) {
                for (const comment of post.comments.data) {
                    // Check if already processed OR queued
                    if (!this.processedIds.has(comment.id) && !this.queuedTaskIds.has(comment.id)) {
                        // Enqueue found comment
                        this.addTask({
                            id: comment.id,
                            type: 'comment',
                            payload: { ...comment, comment_id: comment.id },
                            pageId: pageId,
                            timestamp: Date.now(),
                            retryCount: 0
                        });
                    }
                }
            }
        }

      } catch (e: any) {
          // Silent fail for polling errors to avoid log spam
      }
  },

  async checkMessages(pageId: string, accessToken: string, _adminId: string) {
      try {
          const conversations = await facebookService.getConversations(pageId, accessToken);
          
          for (const convo of conversations) {
              const lastMessage = convo.messages?.data?.[0];
              if (!lastMessage) continue;
              
              if (!this.processedIds.has(lastMessage.id) && !this.queuedTaskIds.has(lastMessage.id)) {
                  // Need to fetch details to get message text
                   const msgRes = await axios.get(`https://graph.facebook.com/v21.0/${lastMessage.id}`, {
                      params: { access_token: accessToken, fields: 'from,message,created_time' }
                  });
                  const msgData = msgRes.data;

                  if (msgData.from?.id === pageId) {
                      this.processedIds.add(lastMessage.id);
                      continue; 
                  }

                  // Enqueue Message
                  this.addTask({
                      id: lastMessage.id,
                      type: 'message',
                      payload: {
                          sender: { id: msgData.from.id },
                          message: { text: msgData.message, mid: msgData.id }
                      },
                      pageId: pageId,
                      timestamp: Date.now(),
                      retryCount: 0
                  });
              }
          }
      } catch (e: any) {
          // Silent fail
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
