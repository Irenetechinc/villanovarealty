-- Create about_sections table
CREATE TABLE IF NOT EXISTS about_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'hero', 'content_split', 'features_grid', 'team_grid'
  title TEXT,
  subtitle TEXT,
  content TEXT,
  image_url TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE about_sections ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public can view about sections" ON about_sections;
CREATE POLICY "Public can view about sections" ON about_sections
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage about sections" ON about_sections;
CREATE POLICY "Admins can manage about sections" ON about_sections
    FOR ALL
    USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin');

-- Seed Data (replicating current hardcoded content)

-- 1. Hero
INSERT INTO about_sections (type, title, content, image_url, order_index)
VALUES (
  'hero', 
  'Our Story', 
  'Redefining real estate excellence in Nigeria since 2010.', 
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  0
);

-- 2. History & Mission (Split Content)
INSERT INTO about_sections (type, title, subtitle, content, items, order_index)
VALUES (
  'content_split',
  'A Decade of Trust & Excellence',
  'Who We Are',
  'Villanova Realty began with a simple yet ambitious vision: to transform the Nigerian real estate landscape by offering world-class services rooted in integrity, transparency, and innovation.\n\nOver the past decade, we have grown from a boutique agency to a premier real estate firm, managing a multi-billion Naira portfolio and serving a diverse clientele ranging from first-time homeowners to multinational corporations.',
  '[
    {"label": "Properties Sold", "value": "1500+"},
    {"label": "Client Satisfaction", "value": "98%"},
    {"title": "Our Mission", "description": "To provide exceptional real estate solutions that empower our clients to build wealth and find their perfect sanctuary, while adhering to the highest standards of professionalism.", "icon": "Target"},
    {"title": "Our Vision", "description": "To be the undisputed leader in the African luxury real estate market, known for our unwavering commitment to quality and client success.", "icon": "Shield"},
    {"title": "Core Values", "description": "Integrity, Excellence, Innovation, and Client-Centricity are the pillars upon which Villanova Realty stands.", "icon": "Award"}
  ]'::jsonb,
  1
);

-- 3. Services (Features Grid)
INSERT INTO about_sections (type, title, subtitle, items, order_index)
VALUES (
  'features_grid',
  'Comprehensive Services',
  'What We Do',
  '[
    {"title": "Property Sales & Leasing", "description": "Expert guidance in buying, selling, and leasing residential and commercial properties.", "icon": "Building"},
    {"title": "Property Management", "description": "Full-service management solutions to maximize your asset''s value and lifespan.", "icon": "Shield"},
    {"title": "Real Estate Advisory", "description": "Strategic investment advice and market analysis for informed decision-making.", "icon": "Users"}
  ]'::jsonb,
  2
);

-- 4. Team (Team Grid)
INSERT INTO about_sections (type, title, subtitle, items, order_index)
VALUES (
  'team_grid',
  'Meet The Team',
  'Our People',
  '[
    {"name": "John Doe", "role": "CEO & Founder", "image": "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"},
    {"name": "Jane Smith", "role": "Head of Sales", "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"},
    {"name": "Robert Fox", "role": "Senior Agent", "image": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"},
    {"name": "Sarah Lee", "role": "Marketing Director", "image": "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"}
  ]'::jsonb,
  3
);
