import { supabaseAdmin } from '../supabase.ts';
import { facebookService } from './facebook.ts';
import { geminiService } from './gemini.ts';
import { logActivity } from '../logger.ts';

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
};
