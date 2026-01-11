CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    office_location TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.agents
    FOR SELECT USING (true);

-- Allow admin full access
-- Note: This relies on the existing users table and admin role check
CREATE POLICY "Allow admin full access" ON public.agents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Seed some initial data
INSERT INTO public.agents (name, role, email, phone, office_location, image_url)
VALUES 
    ('James Sterling', 'Senior Luxury Consultant', 'james@villanovarealty.com', '+234 (0) 123 456 7890', '123 Luxury Lane, Victoria Island, Lagos', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80'),
    ('Sarah Okafor', 'Real Estate Agent', 'sarah@villanovarealty.com', '+234 (0) 987 654 3210', 'Lekki Phase 1, Lagos', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80');
