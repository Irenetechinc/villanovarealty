-- Insert a dummy agent (User)
-- Note: This user cannot login as they don't exist in auth.users, but good for display
INSERT INTO users (id, email, password_hash, name, role, phone)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'agent@villanova.com', 'hashed_pass', 'Sarah Jenkins', 'agent', '+1 (555) 123-4567')
ON CONFLICT (email) DO NOTHING;

-- Insert Properties
INSERT INTO properties (id, agent_id, title, description, price, type, status, address, specifications)
VALUES 
    (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000001',
        'Luxury Modern Villa with Ocean View',
        'Experience the pinnacle of luxury living in this stunning modern villa. Featuring panoramic ocean views, an infinity pool, and state-of-the-art smart home technology. The open-concept living area floods with natural light, creating a seamless indoor-outdoor flow perfect for entertaining.',
        2500000.00,
        'house',
        'available',
        '{"street": "123 Ocean Dr", "city": "Malibu", "state": "CA", "zip": "90265"}',
        '{"bedrooms": 5, "bathrooms": 6, "sqft": 4500, "year_built": 2022, "amenities": ["Pool", "Ocean View", "Smart Home", "Wine Cellar", "Home Theater"]}'
    ),
    (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000001',
        'Downtown Penthouse Suite',
        'Live on top of the world in this exclusive penthouse suite. Located in the heart of the financial district, this property offers breathtaking city skyline views, private elevator access, and a wrap-around terrace.',
        1850000.00,
        'apartment',
        'available',
        '{"street": "456 Wall St", "city": "New York", "state": "NY", "zip": "10005"}',
        '{"bedrooms": 3, "bathrooms": 3.5, "sqft": 2800, "year_built": 2020, "amenities": ["Concierge", "Gym", "Rooftop Terrace", "Parking"]}'
    ),
    (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000001',
        'Cozy Family Home in Suburbs',
        'Perfect for a growing family, this charming home features a large backyard, renovated kitchen, and is located in a top-rated school district. The quiet neighborhood offers a safe and friendly environment.',
        750000.00,
        'house',
        'available',
        '{"street": "789 Maple Ave", "city": "Austin", "state": "TX", "zip": "78701"}',
        '{"bedrooms": 4, "bathrooms": 2.5, "sqft": 2200, "year_built": 2015, "amenities": ["Garden", "Garage", "Fireplace", "Near Schools"]}'
    ),
    (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000001',
        'Modern Townhouse',
        'Sleek and stylish townhouse with high-end finishes. Close to shopping, dining, and public transportation. Ideal for young professionals.',
        620000.00,
        'townhouse',
        'available',
        '{"street": "321 Urban Way", "city": "Seattle", "state": "WA", "zip": "98101"}',
        '{"bedrooms": 2, "bathrooms": 2.5, "sqft": 1500, "year_built": 2019, "amenities": ["Rooftop Deck", "Modern Kitchen", "Walk Score 95"]}'
    );

-- Insert Property Images (Mock URLs)
INSERT INTO property_images (property_id, image_url, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', 0, true FROM properties WHERE title = 'Luxury Modern Villa with Ocean View';

INSERT INTO property_images (property_id, image_url, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', 0, true FROM properties WHERE title = 'Downtown Penthouse Suite';

INSERT INTO property_images (property_id, image_url, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', 0, true FROM properties WHERE title = 'Cozy Family Home in Suburbs';

INSERT INTO property_images (property_id, image_url, sort_order, is_primary)
SELECT id, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', 0, true FROM properties WHERE title = 'Modern Townhouse';
