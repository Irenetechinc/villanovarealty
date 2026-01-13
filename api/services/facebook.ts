import axios from 'axios';
import { interactionQueue } from './queueService.js';

export const facebookService = {
  /**
   * Validate page access token via Graph API
   */
  async validateToken(pageId: string, accessToken: string) {
    if (!pageId || !accessToken) throw new Error('Invalid credentials');
    
    try {
      // 1. Try to fetch the page directly (validates token works for this ID)
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
        params: {
          access_token: accessToken,
          fields: 'name,id,access_token' // Request the Page Token directly if available
        }
      }));
      
      // If we got here, the token is valid for READING the page.
      // But we need to know if it has POST permissions.
      
      return { valid: true, name: response.data.name, accessToken }; 
    } catch (error: any) {
        // 2. If it fails, maybe it's a User Token? Try to exchange it.
        // If the error suggests permission issues or invalid token for this object
        console.warn('[Facebook API] Direct validation failed, attempting to exchange User Token for Page Token...');
        
        try {
            const pageToken = await this.getPageAccessToken(accessToken, pageId);
            if (pageToken) {
                return { valid: true, name: 'Exchanged Page Token', accessToken: pageToken };
            }
        } catch (exchangeError) {
            console.error('Token Exchange Failed:', exchangeError);
        }

      console.error('[Facebook API] Validation Error:', error.response?.data || error.message);
      return { valid: false, error: error.response?.data?.error?.message || 'Token validation failed' };
    }
  },

  /**
   * Attempt to find the specific Page Access Token from a User Access Token
   */
  async getPageAccessToken(userToken: string, targetPageId: string): Promise<string | null> {
      try {
          console.log(`[Facebook API] Exchanging User Token for Page Token (Page ID: ${targetPageId})...`);
          
          // 0. Check if the provided token is ALREADY the Page Token
          try {
             const meRes = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/me`, {
                 params: { access_token: userToken, fields: 'id,name' }
             }));
             console.log(`[Facebook API] Token Identity Check: ID=${meRes.data.id}, Name=${meRes.data.name}`);
             
             if (meRes.data.id === targetPageId) {
                 console.log(`[Facebook API] The provided token is ALREADY a valid Page Token for ${meRes.data.name}.`);
                 return userToken;
             } else {
                 console.log(`[Facebook API] Token identity (${meRes.data.id}) does NOT match Target Page ID (${targetPageId}). Treating as User Token (or wrong Page Token).`);
             }
          } catch (ignore) {
             // Ignore error here, proceed to accounts check
             console.log('[Facebook API] Failed to check token identity (me endpoint).');
          }

          // 1. GET /me/accounts?access_token={userToken}
          const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
              params: {
                  access_token: userToken,
                  limit: 100
              }
          }));

          const pages = response.data.data || [];
          const foundIds = pages.map((p: any) => p.id);
          console.log(`[Facebook API] Found ${pages.length} pages in user accounts: ${foundIds.join(', ')}`);

          const targetPage = pages.find((p: any) => p.id === targetPageId);

          if (targetPage) {
              if (targetPage.access_token) {
                  console.log(`[Facebook API] SUCCESS: Found Page Token for ${targetPage.name}`);
                  return targetPage.access_token;
              } else {
                  console.error(`[Facebook API] Page found (${targetPage.name}) but NO access_token returned. Missing 'pages_show_list' or 'pages_read_engagement' scope?`);
              }
          } else {
              console.error(`[Facebook API] Page ID ${targetPageId} NOT found in user's accounts. Available Pages: ${foundIds.join(', ')}`);
          }
          
          return null;
      } catch (error: any) {
          console.error('[Facebook API] Failed to fetch accounts:', error.response?.data || error.message);
          return null;
      }
  },

  /**
   * Publish a post to the Facebook Page Feed
   */
  async publishPost(pageId: string, accessToken: string, content: string, imageUrl?: string) {
    try {
      // POST https://graph.facebook.com/v18.0/{page-id}/feed
      const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
      
      const payload: any = {
        message: content,
        access_token: accessToken
      };

      if (imageUrl) {
        // If image URL is provided, attach it as a link (or upload photo endpoint if strict photo post needed)
        // For simplicity, attaching as link/picture if it's a URL
        // A better approach for native photos is POST /{page-id}/photos
        payload.link = imageUrl;
      }

      console.log(`[Facebook API] Posting to ${pageId}...`);
      const response = await interactionQueue.add(() => axios.post(url, payload));
      
      if (response.data && response.data.id) {
        return response.data.id;
      } else {
        throw new Error('No Post ID returned from Facebook');
      }
    } catch (error: any) {
      console.error('[Facebook API] Publish Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish post');
    }
  },

  /**
   * Update a post on the Facebook Page
   */
  async updatePost(postId: string, message: string, accessToken: string) {
    try {
      console.log(`[Facebook API] Updating post ${postId}...`);
      await interactionQueue.add(() => axios.post(`https://graph.facebook.com/v18.0/${postId}`, {
        message,
        access_token: accessToken
      }));
      return true;
    } catch (error: any) {
      console.error('[Facebook API] Update Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to update post');
    }
  },

  /**
   * Get conversations (inbox)
   */
  async getConversations(pageId: string, accessToken: string) {
    try {
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${pageId}/conversations`, {
        params: { access_token: accessToken, fields: 'id,updated_time,snippet,messages.limit(1),participants' }
      }));
      return response.data.data || [];
    } catch (error: any) {
      console.error('[Facebook API] Get Conversations Error:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Get conversation history with a specific user
   */
  async getConversationHistory(pageId: string, userId: string, accessToken: string, limit = 5) {
      try {
          // 1. Find conversation ID for this user
          // GET /{page-id}/conversations?user_id={user-id}
          const convoRes = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${pageId}/conversations`, {
              params: { access_token: accessToken, user_id: userId }
          }));
          
          const conversation = convoRes.data.data?.[0];
          if (!conversation) return [];

          // 2. Get messages
          // GET /{conversation-id}/messages?limit={limit}&fields=message,from,created_time
          const msgRes = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${conversation.id}/messages`, {
              params: { access_token: accessToken, limit, fields: 'message,from,created_time' }
          }));

          return msgRes.data.data || [];
      } catch (error: any) {
          console.error('[Facebook API] History Error:', error.response?.data || error.message);
          return [];
      }
  },

  /**
   * Get User Profile (Name)
   */
  async getUserProfile(userId: string, accessToken: string) {
    try {
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
        params: { access_token: accessToken, fields: 'name,first_name,last_name' }
      }));
      return response.data;
    } catch (error: any) {
      // console.error('[Facebook API] Get Profile Error:', error.response?.data || error.message);
      return { name: 'Unknown User', first_name: 'User', last_name: '' };
    }
  },

  /**
   * Reply to a conversation (send message)
   */
  async sendMessage(recipientId: string, message: string, accessToken: string) {
    try {
      // Remove "Auto Reply" prefixes if present (legacy cleanup)
      const cleanMessage = message.replace(/^\[Auto Reply\]\s*/i, '');

      // For pages, we often send to a conversation or user ID.
      // POST /me/messages with recipient: {id: ...}
      console.log(`[Facebook API] Sending message to ${recipientId}...`);
      const response = await interactionQueue.add(() => axios.post(`https://graph.facebook.com/v18.0/me/messages`, {
        recipient: { id: recipientId },
        message: { text: cleanMessage },
        access_token: accessToken
      }), 1); // High priority (1)
      return response.data.message_id;
    } catch (error: any) {
      console.error('[Facebook API] Send Message Error:', error.response?.data || error.message);
      throw new Error('Failed to send message');
    }
  },

  /**
   * Reply to a comment
   */
  async replyToComment(commentId: string, message: string, accessToken: string) {
    try {
      const cleanMessage = message.replace(/^\[Auto Reply\]\s*/i, '');
      console.log(`[Facebook API] Replying to comment ${commentId}...`);
      const response = await interactionQueue.add(() => axios.post(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
        message: cleanMessage,
        access_token: accessToken
      }));
      return response.data.id;
    } catch (error: any) {
      console.error('[Facebook API] Reply Error:', error.response?.data || error.message);
      throw new Error('Failed to reply to comment');
    }
  },

  /**
   * Delete a post from the Facebook Page
   */
  async deletePost(postId: string, accessToken: string) {
    try {
      console.log(`[Facebook API] Deleting post ${postId}...`);
      await interactionQueue.add(() => axios.delete(`https://graph.facebook.com/v18.0/${postId}`, {
        params: { access_token: accessToken }
      }));
      return true;
    } catch (error: any) {
      console.error('[Facebook API] Delete Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to delete post');
    }
  },

  /**
   * Get comments for a post
   */
  async getComments(postId: string, accessToken: string) {
    try {
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${postId}/comments`, {
        params: { access_token: accessToken, fields: 'id,message,from' }
      }));
      return response.data.data;
    } catch (error: any) {
      console.error('[Facebook API] Get Comments Error:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Get specific metrics for a single post
   */
  async getPostMetrics(postId: string, accessToken: string) {
    try {
      // GET /{post-id}?fields=insights.metric(post_impressions,post_engagements),shares,comments.summary(true),likes.summary(true)
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${postId}`, {
        params: {
          access_token: accessToken,
          fields: 'insights.metric(post_impressions,post_engagements),shares,comments.summary(true),likes.summary(true)'
        }
      }));

      const data = response.data;
      const insights = data.insights?.data || [];
      
      const impressions = insights.find((i: any) => i.name === 'post_impressions')?.values[0]?.value || 0;
      const engagements = insights.find((i: any) => i.name === 'post_engagements')?.values[0]?.value || 0;
      const likes = data.likes?.summary?.total_count || 0;
      const comments = data.comments?.summary?.total_count || 0;
      const shares = data.shares?.count || 0;

      return {
        reach: impressions,
        engagement: engagements,
        likes,
        comments,
        shares
      };
    } catch (error: any) {
      console.error(`[Facebook API] Post Metrics Error for ${postId}:`, error.response?.data || error.message);
      return null;
    }
  },

  /**
   * Get Page Insights (Reach, Engagement)
   */
  async getInsights(pageId: string, accessToken: string) {
    try {
      // GET /{page-id}/insights?metric=page_impressions,page_engaged_users&period=day
      // 'page_post_engagements' is deprecated/unreliable in some versions.
      // 'page_engaged_users' is a good proxy for total engagement.
      const response = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${pageId}/insights`, {
        params: {
          access_token: accessToken,
          metric: 'page_impressions,page_engaged_users',
          period: 'day'
        }
      }));

      const data = response.data.data;
      let reach = 0;
      let engagement = 0;

      if (data) {
        const impressionsMetric = data.find((m: any) => m.name === 'page_impressions');
        const engagementMetric = data.find((m: any) => m.name === 'page_engaged_users');
        
        // Get most recent value (usually index 0 or 1 depending on day)
        // API returns data sorted by date usually. We take the latest available day.
        reach = impressionsMetric?.values[1]?.value || impressionsMetric?.values[0]?.value || 0;
        engagement = engagementMetric?.values[1]?.value || engagementMetric?.values[0]?.value || 0;
      }

      return { reach, engagement };
    } catch (error: any) {
      // Handle (#100) invalid metric error by falling back to simpler metric
      if (error.response?.data?.error?.code === 100) {
          console.warn('[Facebook API] Insights metric error, trying fallback (page_impressions only)...');
          try {
             const fallbackRes = await interactionQueue.add(() => axios.get(`https://graph.facebook.com/v18.0/${pageId}/insights`, {
                params: {
                  access_token: accessToken,
                  metric: 'page_impressions',
                  period: 'day'
                }
              }));
             const imp = fallbackRes.data.data?.[0]?.values?.[1]?.value || fallbackRes.data.data?.[0]?.values?.[0]?.value || 0;
             return { reach: imp, engagement: 0 };
          } catch (e) {
             console.error('[Facebook API] Fallback Insights Failed:', e);
             return { reach: 0, engagement: 0 };
          }
      }
      
      console.error('[Facebook API] Insights Error:', error.response?.data || error.message);
      return { reach: 0, engagement: 0 };
    }
  }
};
