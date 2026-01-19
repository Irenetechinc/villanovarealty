-- Enhance adroom_interactions for granular message storage
ALTER TABLE public.adroom_interactions
ADD COLUMN IF NOT EXISTS sender_role text DEFAULT 'bot',
ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.adroom_posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS user_name text,
ADD COLUMN IF NOT EXISTS parent_id text;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_adroom_interactions_post_id ON public.adroom_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_adroom_interactions_sender_role ON public.adroom_interactions(sender_role);
