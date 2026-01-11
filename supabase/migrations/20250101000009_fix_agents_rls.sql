-- Fix RLS for agents table to avoid recursion and use JWT metadata
DROP POLICY IF EXISTS "Allow admin full access" ON public.agents;

CREATE POLICY "Allow admin full access" ON public.agents
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );
