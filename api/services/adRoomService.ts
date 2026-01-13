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
  },
  /**
   * Scans pending posts for quality issues (typos, length, missing images) and auto-fixes them.
   */
  async scanAndFixPostQuality(strategyId: string) {
    try {
        const { data: pendingPosts } = await supabaseAdmin
            .from('adroom_posts')
            .select('*')
            .eq('strategy_id', strategyId)
            .eq('status', 'pending');

        if (!pendingPosts || pendingPosts.length === 0) return;

        for (const post of pendingPosts) {
            let needsFix = false;
            let issues = [];

            // Check 1: Content Length
            if (!post.content || post.content.length < 50) {
                needsFix = true;
                issues.push('Too short');
            }

            // Check 2: Image Quality
            if (!post.image_url || post.image_url.includes('placehold.co') || post.image_url === 'null') {
                 // Try to find a better image from the strategy or properties if possible.
                 // For now, we flag it.
                 // If it's a placeholder, we might not be able to fix it without property data context.
                 // But we can at least try to improve the caption to be more descriptive.
                 needsFix = true;
                 issues.push('Placeholder image');
            }

            // Check 3: Typo/Grammar (Simple heuristic or always run for high quality)
            // We'll skip running AI on every post to save quota, unless it looks "suspicious" or we are in a rigorous mode.
            // Let's assume we run it if it hasn't been "verified" yet. 
            // For MVP, let's just fix if it's short.

            if (needsFix) {
                logActivity(`[AdRoom] Auto-Fixing Post ${post.id} (Issues: ${issues.join(', ')})`, 'info');

                const prompt = `
                    Improve this Facebook post.
                    Current Content: "${post.content}"
                    Issues detected: ${issues.join(', ')}
                    
                    Task:
                    1. Expand content to be engaging and professional (>100 chars).
                    2. Fix any typos.
                    3. Ensure it has a Call to Action.
                    
                    Return ONLY the new content text.
                `;

                const aiRes = await geminiService.generateContent(prompt);
                const newContent = aiRes.response.text().trim();

                // Update DB
                await supabaseAdmin
                    .from('adroom_posts')
                    .update({ content: newContent }) // We can't easily fix image without context, so we just improve text.
                    .eq('id', post.id);
            }
        }
    } catch (e) {
        console.error('[AdRoom] Quality Scan Error:', e);
    }
  },

  /**
   * Validates a strategy's content volume against its duration and auto-corrects if needed.
   * Designed to be called immediately after approval or during audits.
   */
  async validateAndFixStrategy(strategyId: string) {
      try {
          const { data: strategy } = await supabaseAdmin
              .from('adroom_strategies')
              .select('*')
              .eq('id', strategyId)
              .single();

          if (!strategy) return;

          // 1. Determine Target Post Count based on Duration
          const durationStr = strategy.content.duration?.toLowerCase() || '';
          let targetCount = 5; // Default minimum

          if (durationStr.includes('month')) targetCount = 20; // ~5 posts/week
          else if (durationStr.includes('week')) targetCount = 5;
          else if (durationStr.includes('day')) {
             const days = parseInt(durationStr) || 1;
             targetCount = Math.max(1, days); 
          }

          // 2. Count Existing Pending/Posted Posts
          const { count } = await supabaseAdmin
              .from('adroom_posts')
              .select('*', { count: 'exact', head: true })
              .eq('strategy_id', strategyId);
          
          const currentCount = count || 0;

          logActivity(`[AdRoom] Validating Strategy ${strategyId}: Found ${currentCount} posts, Target ${targetCount} (Duration: ${durationStr})`, 'info');

          // 3. Auto-Correct if Insufficient
          if (currentCount < targetCount) {
              const deficit = targetCount - currentCount;
              logActivity(`[AdRoom] Strategy Under-filled! Generating ${deficit} more posts autonomously...`, 'info');
              
              // Call generateMoreContent enough times to fill the gap
              // generateMoreContent adds 5 posts at a time.
              const batchesNeeded = Math.ceil(deficit / 5);
              
              for (let i = 0; i < batchesNeeded; i++) {
                  await this.generateMoreContent(strategyId);
              }
          } else {
              logActivity(`[AdRoom] Strategy ${strategyId} content volume is healthy.`, 'success');
          }

      } catch (error: any) {
          console.error('[AdRoom] Validation Error:', error);
      }
  },

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
            You are the Senior Marketing Director for Villanova Realty.
            
            Current Strategy Context:
            - Theme: "${strategy.content.theme}"
            - Goal: "${strategy.content.goal}"
            - Target Audience: High-intent property buyers and investors in Nigeria.
            
            Task:
            Create 5 NEW, high-performance Facebook posts that align with this strategy.
            
            Improvement Framework Requirements:
            1. **Brand Voice**: Professional, authoritative, yet approachable and aspirational.
            2. **Engagement**: Use "Pattern Interrupt" hooks (questions, bold statements, insider tips).
            3. **Consistency**: Ensure these posts feel like a natural continuation of the campaign.
            4. **Structure**: 
               - Headline (Hook)
               - Body (Value/Story)
               - Call to Action (Clear instruction)
            
            Available Assets (Use these specific properties):
            ${JSON.stringify(assets.slice(0, 3), null, 2)}
            
            Output JSON ONLY:
            {
                "new_posts": [
                    { 
                        "content": "Full post caption with emojis...", 
                        "image_url": "EXACT URL from provided assets",
                        "post_type": "Showcase | Educational | Engagement | Urgency"
                    }
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
            logActivity(`[AdRoom] AI failed to generate valid posts for Strategy ${strategyId}.`, 'error');
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

        const postsToInsert = newPosts.map((p: any) => {
            // Add 1 day interval for each new post
            // Also, optimize posting times (e.g., set to 10 AM or 5 PM)
            nextSchedule.setDate(nextSchedule.getDate() + 1);
            nextSchedule.setHours(10, 0, 0, 0); // Default to 10 AM

            return {
                strategy_id: strategyId,
                content: p.content,
                image_url: p.image_url || "https://placehold.co/600x400?text=Villanova+Realty", 
                scheduled_time: nextSchedule.toISOString(),
                status: 'pending'
            };
        });

        await supabaseAdmin.from('adroom_posts').insert(postsToInsert);
        logActivity(`[AdRoom] Successfully optimized and added ${postsToInsert.length} new posts to Strategy ${strategyId}.`, 'success');

    } catch (error: any) {
        logActivity(`[AdRoom] Content Generation Error: ${error.message}`, 'error');
    }
  }
};
