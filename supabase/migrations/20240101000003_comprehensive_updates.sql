-- Create Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Inquiries
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view inquiries" ON inquiries;
CREATE POLICY "Admins view inquiries" ON inquiries
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role IN ('admin', 'agent')
    ));

DROP POLICY IF EXISTS "Public insert inquiries" ON inquiries;
CREATE POLICY "Public insert inquiries" ON inquiries
    FOR INSERT
    WITH CHECK (true);

-- Insert Ongoing Projects
INSERT INTO projects (title, description, location, status, completion_date, images, features, progress)
VALUES 
    (
        'The Zenith Skyscraper',
        'A 60-story architectural marvel redefining the city skyline. This mixed-use tower features luxury residential units, premium office spaces, and a sky deck with panoramic views.',
        'Victoria Island',
        'Under Construction',
        'Q4 2026',
        ARRAY['https://images.unsplash.com/photo-1486325212027-8081e485255e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Sky Deck', 'Helipad', 'Smart Building System', 'Premium Concierge'],
        45
    ),
    (
        'Royal Palms 7-Star Hotel',
        'An epitome of opulence and grandeur. The Royal Palms offers unmatched hospitality with private butler service, underwater suites, and world-class dining experiences.',
        'Banana Island',
        'Near Completion',
        'Q2 2025',
        ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Underwater Suites', 'Private Beach', 'Michelin Star Dining', 'Spa & Wellness'],
        85
    ),
    (
        'Eco-Haven Estate',
        'Sustainable luxury living at its finest. This gated community is powered entirely by renewable energy and features vertical gardens, rainwater harvesting, and organic markets.',
        'Lekki Phase 1',
        'Planning',
        'Q1 2027',
        ARRAY['https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Solar Powered', 'Vertical Gardens', 'Zero Carbon Footprint', 'Community Farm'],
        15
    ),
    (
        'Marina Blue Waterfront',
        'Exclusive waterfront residences with private yacht slips. Enjoy direct access to the ocean and a lifestyle centered around water sports and leisure.',
        'Ikoyi',
        'Under Construction',
        'Q3 2025',
        ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Private Marina', 'Yacht Club', 'Infinity Pool', 'Sea View'],
        60
    ),
    (
        'Tech Valley Smart City',
        'A futuristic residential complex integrated with the latest smart home technologies. Features automated amenities, high-speed connectivity, and co-working hubs.',
        'Eko Atlantic',
        'Planning',
        'Q4 2027',
        ARRAY['https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Smart Home Automation', 'AI Security', 'Co-working Hubs', 'EV Charging Stations'],
        10
    ),
    (
        'The Oasis Resort',
        'A sanctuary of peace in the heart of the city. This urban resort features lush tropical landscaping, lagoon pools, and serene meditation gardens.',
        'Victoria Island',
        'Under Construction',
        'Q2 2026',
        ARRAY['https://images.unsplash.com/photo-1571896349842-6e53ce41e887?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],
        ARRAY['Tropical Gardens', 'Lagoon Pools', 'Meditation Spaces', 'Urban Retreat'],
        30
    );

-- Insert Properties for Neighborhoods (Mock Data using seeded Agent ID if available, else NULL which is fine as agent_id is nullable in schema? Check schema... it's NOT NULL? No, it's REFERENCES users(id). Let's check schema again. agent_id UUID REFERENCES users(id). It doesn't say NOT NULL. But good practice to link. I'll use the dummy agent ID from seed_data.sql '00000000-0000-0000-0000-000000000001')

-- Ikoyi Properties
INSERT INTO properties (agent_id, title, description, price, type, status, address, specifications)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Ikoyi Grand Mansion', 'Expansive mansion with manicured gardens.', 1200000000, 'house', 'available', '{"city": "Ikoyi", "state": "Lagos"}', '{"bedrooms": 7, "bathrooms": 8, "sqft": 8000}'),
    ('00000000-0000-0000-0000-000000000001', 'Bourdillon Heights Apartment', 'Luxury high-rise apartment with city views.', 450000000, 'apartment', 'available', '{"city": "Ikoyi", "state": "Lagos"}', '{"bedrooms": 3, "bathrooms": 3, "sqft": 2500}');

-- Victoria Island Properties
INSERT INTO properties (agent_id, title, description, price, type, status, address, specifications)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'VI Commercial Plaza', 'Prime office space in central business district.', 850000000, 'commercial', 'available', '{"city": "Victoria Island", "state": "Lagos"}', '{"bedrooms": 0, "bathrooms": 4, "sqft": 5000}'),
    ('00000000-0000-0000-0000-000000000001', 'Adeola Odeku Luxury Condo', 'Modern condo with premium finishes.', 350000000, 'condo', 'available', '{"city": "Victoria Island", "state": "Lagos"}', '{"bedrooms": 2, "bathrooms": 2, "sqft": 1800}');

-- Lekki Phase 1 Properties
INSERT INTO properties (agent_id, title, description, price, type, status, address, specifications)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Lekki Contemporary Duplex', 'Newly built duplex with smart features.', 280000000, 'house', 'available', '{"city": "Lekki Phase 1", "state": "Lagos"}', '{"bedrooms": 4, "bathrooms": 5, "sqft": 3000}'),
    ('00000000-0000-0000-0000-000000000001', 'Admiralty Way Townhouse', 'Stylish townhouse near major amenities.', 220000000, 'townhouse', 'available', '{"city": "Lekki Phase 1", "state": "Lagos"}', '{"bedrooms": 3, "bathrooms": 4, "sqft": 2200}');

-- Banana Island Properties
INSERT INTO properties (agent_id, title, description, price, type, status, address, specifications)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Banana Island Waterfront Villa', 'Ultra-luxury villa with private jetty.', 2500000000, 'house', 'available', '{"city": "Banana Island", "state": "Lagos"}', '{"bedrooms": 6, "bathrooms": 7, "sqft": 7500}'),
    ('00000000-0000-0000-0000-000000000001', 'Ocean Parade Penthouse', 'Exclusive penthouse with ocean panorama.', 1500000000, 'apartment', 'available', '{"city": "Banana Island", "state": "Lagos"}', '{"bedrooms": 4, "bathrooms": 5, "sqft": 4000}');

-- Insert Images for these properties
INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Ikoyi Grand Mansion';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Bourdillon Heights Apartment';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1486325212027-8081e485255e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'VI Commercial Plaza';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Adeola Odeku Luxury Condo';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1600596542815-e32cb5328d49?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Lekki Contemporary Duplex';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Admiralty Way Townhouse';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Banana Island Waterfront Villa';

INSERT INTO property_images (property_id, image_url, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', true FROM properties WHERE title = 'Ocean Parade Penthouse';
