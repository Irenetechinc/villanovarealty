import { supabaseAdmin } from '../supabase.js';
import { geminiService } from './gemini.js';

interface StrategyHealth {
    status: 'healthy' | 'at_risk' | 'critical';
    lastPostDate: string | null;
    missedPosts: number;
    issues: string[];
}

export const strategyMonitorService = {
  
  /**
   * Main entry point: Scans all active strategies for health and compliance.
   */
  async monitorAllStrategies() {
    console.log('[StrategyMonitor] Starting comprehensive health check...');
    
    try {
        const { data: strategies, error } = await supabaseAdmin
            .from('adroom_strategies')
            .select(`
                *,
                adroom_posts (
                    id, content, status, scheduled_time, posted_time, image_url
                )
            `)
            .eq('status', 'active');

        if (error || !strategies) {
            console.error('[StrategyMonitor] Failed to fetch strategies:', error);
            return;
        }

        for (const strategy of strategies) {
            await this.processStrategy(strategy);
        }
        
    } catch (err) {
        console.error('[StrategyMonitor] Critical failure in monitor loop:', err);
    }
  },

  /**
   * Process a single strategy: Health Check -> QA -> Auto-Fix
   */
  async processStrategy(strategy: any) {
      const health = this.assessHealth(strategy);
      
      // Log Health Status
      if (health.status !== 'healthy') {
          await this.logEvent(strategy.id, strategy.admin_id, 'alert', 
              `Strategy Health: ${health.status.toUpperCase()}. Issues: ${health.issues.join(', ')}`);
          
          // Create persistent alert
          await this.createAlert(strategy.id, strategy.admin_id, 
              health.status === 'critical' ? 'critical' : 'warning',
              `Strategy is ${health.status}: ${health.issues[0]}`
          );
      }

      // QA: Check pending posts for quality
      const pendingPosts = strategy.adroom_posts.filter((p: any) => p.status === 'pending');
      for (const post of pendingPosts) {
          await this.qaPost(post, strategy.admin_id);
      }

      // Auto-Fix: If critical (e.g., no posts for 3 days), generate content
      if (health.status === 'critical' && health.missedPosts > 0) {
          await this.autoFixStrategy(strategy, health);
      }
  },

  /**
   * 1. Strategy Execution Monitoring
   */
  assessHealth(strategy: any): StrategyHealth {
      const posts = strategy.adroom_posts || [];
      const posted = posts.filter((p: any) => p.status === 'posted');
      
      // Sort by posted_time desc
      posted.sort((a: any, b: any) => new Date(b.posted_time).getTime() - new Date(a.posted_time).getTime());
      
      const lastPost = posted[0];
      const lastPostDate = lastPost ? new Date(lastPost.posted_time) : new Date(strategy.created_at);
      const daysSinceLastPost = (Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24);
      
      const issues: string[] = [];
      let status: StrategyHealth['status'] = 'healthy';

      // Rule: No posts for 3 days = Critical
      if (daysSinceLastPost > 3) {
          status = 'critical';
          issues.push(`No posts for ${Math.floor(daysSinceLastPost)} days`);
      } else if (daysSinceLastPost > 1.5) {
          status = 'at_risk';
          issues.push(`Late posting (${Math.floor(daysSinceLastPost)} days gap)`);
      }

      // Rule: No future posts scheduled = At Risk
      const pending = posts.filter((p: any) => p.status === 'pending');
      if (pending.length === 0) {
          if (status !== 'critical') status = 'at_risk';
          issues.push('No upcoming posts scheduled');
      }

      return {
          status,
          lastPostDate: lastPost ? lastPost.posted_time : null,
          missedPosts: daysSinceLastPost > 1 ? Math.floor(daysSinceLastPost) : 0,
          issues
      };
  },

  /**
   * 2. Content Quality Assurance (QA)
   */
  async qaPost(post: any, adminId: string) {
      const issues: string[] = [];

      // Check 1: Completeness
      if (!post.content || post.content.length < 10) issues.push('Content too short');
      if (!post.image_url) issues.push('Missing image');

      // Check 2: Formatting (Basic)
      if (post.content.includes('undefined') || post.content.includes('[Insert Link]')) {
          issues.push('Placeholder text detected');
      }

      if (issues.length > 0) {
          await this.logEvent(post.strategy_id, adminId, 'check', 
              `QA Failed for Post ${post.id.slice(0, 8)}: ${issues.join(', ')}`);
          
          // 3. Automated Correction (Simple)
          await this.attemptPostCorrection(post, issues, adminId);
      }
  },

  /**
   * 3. Automated Correction System
   */
  async attemptPostCorrection(post: any, issues: string[], adminId: string) {
      // If missing image, try to find one from property data (mocked for now as we don't have easy access to property link here without more queries)
      // If placeholder text, try to use AI to fix it.
      
      if (issues.includes('Placeholder text detected') || issues.includes('Content too short')) {
          try {
              const aiResponse = await geminiService.optimizeContent(post.content, "Fix placeholders and expand content to be professional.");
              
              // Update Post
              await supabaseAdmin
                  .from('adroom_posts')
                  .update({ content: aiResponse })
                  .eq('id', post.id);
                  
              await this.logEvent(post.strategy_id, adminId, 'fix', `Auto-corrected content for Post ${post.id}`);
          } catch (e) {
              console.error('Failed to auto-correct post:', e);
          }
      }
  },

  async autoFixStrategy(strategy: any, health: StrategyHealth) {
      console.log(`[StrategyMonitor] Auto-fixing Strategy ${strategy.id}...`);
      
      // Generate 1 emergency post to break the silence
      try {
          const prompt = `
            Emergency Content Generation for Strategy: ${strategy.type}
            Context: We haven't posted in ${health.missedPosts} days.
            Goal: Re-engage audience immediately.
            Theme: ${strategy.content?.theme || 'General Real Estate'}
            
            Write a single engaging Facebook post (caption only).
          `;
          
          const { response } = await geminiService.generateContent(prompt);
          const content = response.text();

          // Insert new post scheduled for NOW
          await supabaseAdmin.from('adroom_posts').insert({
              strategy_id: strategy.id,
              content: content,
              status: 'pending',
              scheduled_time: new Date().toISOString(),
              image_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800' // Fallback Generic Real Estate Image
          });

          await this.logEvent(strategy.id, strategy.admin_id, 'fix', 'Auto-generated emergency post to restore activity.');

      } catch (e) {
          console.error('Auto-fix failed:', e);
      }
  },

  // Helpers
  async logEvent(strategyId: string, adminId: string, type: 'check' | 'fix' | 'alert' | 'update', message: string) {
      await supabaseAdmin.from('adroom_strategy_logs').insert({
          strategy_id: strategyId,
          admin_id: adminId,
          event_type: type,
          message: message
      });
  },

  async createAlert(strategyId: string, adminId: string, severity: 'info' | 'warning' | 'critical', message: string) {
      // Check if active alert already exists to prevent spam
      const { count } = await supabaseAdmin
          .from('adroom_strategy_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('strategy_id', strategyId)
          .eq('status', 'active')
          .eq('message', message);
          
      if (count && count > 0) return;

      await supabaseAdmin.from('adroom_strategy_alerts').insert({
          strategy_id: strategyId,
          admin_id: adminId,
          severity,
          message
      });
  }
};
