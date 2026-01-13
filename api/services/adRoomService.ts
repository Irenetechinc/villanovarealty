import { supabaseAdmin } from '../supabase.js';
import { facebookService } from './facebook.js';
import { geminiService } from './gemini.js';
import { logActivity } from '../logger.js';

export const adRoomService = {
  /**
   * Daily check of active strategies to ensure they are meeting performance goals.
   * If not, it triggers an autonomous adjustment.
   */
  async monitorAndAdjust() {
    logActivity('Starting daily performance monitoring...', 'info');

    try {
      // 1. Get all active strategies
      const { data: activeStrategies, error } = await supabaseAdmin
        .from('adroom_strategies')
        .select('*, adroom_settings(facebook_page_id, facebook_access_token)')
        .eq('status', 'active');

      if (error) throw error;
      if (!activeStrategies || activeStrategies.length === 0) {
        logActivity('No active strategies to monitor.', 'info');
        return;
      }

      for (const strategy of activeStrategies) {
        // Skip if settings are missing
        if (!strategy.adroom_settings?.facebook_page_id || !strategy.adroom_settings?.facebook_access_token) {
          logActivity(`Skipping strategy ${strategy.id}: Missing FB settings`, 'error');
          continue;
        }

        const accessToken = strategy.adroom_settings.facebook_access_token;

        // 2. Aggregate Performance of Posted Content
        const { data: posts } = await supabaseAdmin
          .from('adroom_posts')
          .select('*')
          .eq('strategy_id', strategy.id)
          .eq('status', 'posted');

        if (!posts || posts.length === 0) continue;

        let totalReach = 0;
        let totalEngagement = 0;

        for (const post of posts) {
          // If we have a FB post ID, fetch fresh metrics
          if (post.facebook_post_id) {
            const metrics = await facebookService.getPostMetrics(post.facebook_post_id, accessToken);
            if (metrics) {
              totalReach += metrics.reach;
              totalEngagement += metrics.engagement;
              
              // Update local DB with fresh metrics
              await supabaseAdmin
                .from('adroom_posts')
                .update({ metrics })
                .eq('id', post.id);
            }
          }
        }

        logActivity(`Strategy ${strategy.id} Performance: Reach=${totalReach}, Engagement=${totalEngagement}`, 'info');

        // 3. Evaluate Performance (Simple Threshold Logic for MVP)
        // In a real app, parse "Expected Outcome" string to get numbers.
        // For now, let's assume a "Healthy" baseline is > 100 reach per post after 24h.
        const avgReach = totalReach / posts.length;
        
        if (avgReach < 50) { // Threshold: Underperforming
             logActivity(`Strategy ${strategy.id} is UNDERPERFORMING (Avg Reach: ${avgReach}). Initiating adjustment...`, 'info');
             await this.triggerAdjustment(strategy, avgReach, totalEngagement);
        } else {
            logActivity(`Strategy ${strategy.id} is performing well.`, 'success');
        }
      }

    } catch (error: any) {
      logActivity(`Monitoring Error: ${error.message}`, 'error');
    }
  },

  /**
   * Uses Gemini to generate a corrective action and schedules a new "Emergency" post.
   */
  async triggerAdjustment(strategy: any, currentReach: number, currentEngagement: number) {
    try {
      const prompt = `
        URGENT: Marketing Strategy Correction Needed.
        
        Current Strategy Theme: "${strategy.content.theme}"
        Goal: "${strategy.content.goal}"
        
        PERFORMANCE ALERT:
        - Average Reach: ${currentReach} (Target: >100)
        - Total Engagement: ${currentEngagement}
        
        The current content is not resonating. 
        1. Diagnose WHY (e.g., wrong time, boring copy, needs more visual hook).
        2. Create ONE new "Emergency Correction" post to regain momentum.
        
        Output JSON ONLY:
        {
          "diagnosis": "Brief explanation of the issue",
          "action": "Brief description of the fix (e.g. 'Switching to question-based engagement')",
          "new_post": {
            "title": "Emergency Engagement Post",
            "caption": "The actual caption text...",
            "image_idea": "Description of image"
          }
        }
      `;

      const result = await geminiService.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) throw new Error('Failed to parse AI adjustment');
      
      const adjustment = JSON.parse(jsonMatch[0]);

      // 1. Log the adjustment for the Admin Chat
      // We'll store this as a special "message" or "report" so it appears in the chat stream
      // For MVP, we can insert into 'adroom_reports' or a new 'adroom_events' table.
      // Let's use adroom_reports for simplicity as "adjustment" type.
      await supabaseAdmin.from('adroom_reports').insert({
          admin_id: strategy.admin_id,
          type: 'adjustment',
          content: adjustment
      });

      // 2. Schedule the Emergency Post (Immediate/Next Slot)
      await supabaseAdmin.from('adroom_posts').insert({
          strategy_id: strategy.id,
          content: adjustment.new_post.caption,
          // In a real app, we'd generate the image here too
          scheduled_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Schedule for 10 mins from now
          status: 'pending'
      });

      logActivity(`Adjustment applied for Strategy ${strategy.id}. Diagnosis: ${adjustment.diagnosis}`, 'success');

    } catch (error: any) {
      logActivity(`Adjustment Failed: ${error.message}`, 'error');
    }
  }
  /**
   * Generates additional content for an active strategy.
   * This is triggered when the queue is running low (e.g. < 5 posts).
   */
  async generateMoreContent(strategyId: string) {
    try {
        logActivity(`[AdRoom] Generating more content for Strategy ${strategyId}...`, 'info');

        // 1. Fetch Strategy Details
        const { data: strategy } = await supabaseAdmin
            .from('adroom_strategies')
            .select('*')
            .eq('id', strategyId)
            .single();

        if (!strategy) throw new Error('Strategy not found');

        // 2. Fetch Assets (Properties) to use for content
        // We need random properties to keep content fresh
        const { data: properties } = await supabaseAdmin
            .from('properties')
            .select('*, property_images(url)')
            .limit(10); // Fetch a batch

        const assets = properties?.map(p => ({
            ...p,
            main_image: p.property_images?.[0]?.url || null
        })).filter(p => p.main_image) || [];

        // 3. Use Gemini to generate 5 new posts
        const prompt = `
            You are the Marketing Director.
            Current Strategy Theme: "${strategy.content.theme}"
            Goal: "${strategy.content.goal}"
            
            We are running low on scheduled content.
            Create 5 NEW, engaging Facebook posts aligned with this strategy.
            
            Available Assets (Properties):
            ${JSON.stringify(assets.slice(0, 3), null, 2)}
            
            Instructions:
            - Create 5 distinct posts.
            - Use the provided property images where relevant.
            - Vary the content types (Question, Showcase, Tip, Urgency).
            - Output JSON ONLY:
            {
                "new_posts": [
                    { "content": "Post caption...", "image_url": "URL from assets" }
                ]
            }
        `;

        const result = await geminiService.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error('Failed to parse AI generation');
        
        const data = JSON.parse(jsonMatch[0]);
        const newPosts = data.new_posts || [];

        if (newPosts.length === 0) {
            logActivity(`[AdRoom] AI failed to generate valid posts for Strategy ${strategyId}.`, 'warn');
            return;
        }

        // 4. Insert into DB
        // Find the latest scheduled time to append after
        const { data: lastPost } = await supabaseAdmin
            .from('adroom_posts')
            .select('scheduled_time')
            .eq('strategy_id', strategyId)
            .order('scheduled_time', { ascending: false })
            .limit(1)
            .single();

        let nextSchedule = lastPost ? new Date(lastPost.scheduled_time) : new Date();

        const postsToInsert = newPosts.map((p: any, i: number) => {
            // Add 1 day interval for each new post
            nextSchedule.setDate(nextSchedule.getDate() + 1);
            return {
                strategy_id: strategyId,
                content: p.content,
                image_url: p.image_url || "https://placehold.co/600x400?text=AdRoom+Content", // Fallback
                scheduled_time: nextSchedule.toISOString(),
                status: 'pending'
            };
        });

        await supabaseAdmin.from('adroom_posts').insert(postsToInsert);
        logActivity(`[AdRoom] Successfully added ${postsToInsert.length} new posts to Strategy ${strategyId}.`, 'success');

    } catch (error: any) {
        logActivity(`[AdRoom] Content Generation Error: ${error.message}`, 'error');
    }
  }
};
