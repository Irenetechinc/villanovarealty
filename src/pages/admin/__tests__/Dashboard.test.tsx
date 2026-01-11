import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { supabase } from '@/lib/supabaseClient';

// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/image.jpg' } })),
      })),
    },
  },
}));

describe('Dashboard Functionality', () => {
  const mockAgents = [
    {
      id: '1',
      name: 'John Doe',
      role: 'Agent',
      email: 'john@example.com',
      phone: '123-456-7890',
      office_location: 'New York',
      image_url: 'https://example.com/john.jpg',
      created_at: '2023-01-01',
    },
  ];

  const mockProjects = [
    {
      id: '1',
      title: 'Luxury Villa',
      description: 'A beautiful villa',
      location: 'Miami',
      status: 'Under Construction',
      completion_date: 'Q4 2025',
      images: ['img1.jpg', 'img2.jpg'],
      features: ['Pool', 'Gym'],
      progress: 50,
      created_at: '2023-01-01',
    },
  ];

  const mockProperties = [
    {
      id: '1',
      title: 'Beautiful House',
      description: 'A nice house',
      price: 50000000,
      type: 'house',
      status: 'available',
      address: { street: '123 Main St', city: 'Lagos City', state: 'Lagos State', zip: '100001' },
      specifications: { bedrooms: 4, bathrooms: 3, sqft: 2500, yearBuilt: '2020' },
      created_at: '2023-01-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // A chainable mock builder
    const createBuilder = (data: any, count?: number) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        // Making it thenable to be awaited
        then: (resolve: any) => {
          resolve({ data, error: null, count: count || 0 });
        },
      };
      return builder;
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'agents') {
        return createBuilder(mockAgents);
      }
      if (table === 'projects') {
        return createBuilder(mockProjects);
      }
      if (table === 'properties') {
        return createBuilder(mockProperties, 10);
      }
      if (table === 'users') {
        return createBuilder([], 10);
      }
      if (table === 'inquiries') {
        return createBuilder([], 5);
      }
      return createBuilder([]);
    });
  });

  describe('Agent Management', () => {
    it('opens the edit modal when the edit icon is clicked', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      });

      const agentsTab = screen.getByText('Agents');
      fireEvent.click(agentsTab);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit agent/i });
      expect(editButtons.length).toBeGreaterThan(0);
      const editButton = editButtons[0];
      
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument();
      });
      
      const nameInput = screen.getByDisplayValue('John Doe');
      expect(nameInput).toBeInTheDocument();
    });
  });

  describe('Project Management', () => {
    it('opens the edit modal when the edit icon is clicked', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      });

      const projectsTab = screen.getByText('Ongoing Projects');
      fireEvent.click(projectsTab);

      await waitFor(() => {
        expect(screen.getByText('Luxury Villa')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      expect(editButtons.length).toBeGreaterThan(0);
      const editButton = editButtons[0];
      
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('Luxury Villa');
      expect(titleInput).toBeInTheDocument();
      
      // Check joined arrays
      const featuresInput = screen.getByDisplayValue('Pool, Gym');
      expect(featuresInput).toBeInTheDocument();
    });

    it('handles file selection for project images', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      });

      const projectsTab = screen.getByText('Ongoing Projects');
      fireEvent.click(projectsTab);
      
      const addButton = screen.getByText('Add Project');
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Project')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload files/i);
      const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });
      
      // Mock createObjectURL
      const originalCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/chucknorris.png');

      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      // Cleanup
      global.URL.createObjectURL = originalCreateObjectURL;
    });
  });

  describe('Property Management', () => {
    it('opens the edit modal when the edit icon is clicked', async () => {
      render(<Dashboard />);
      await waitFor(() => expect(screen.getByText('Dashboard Overview')).toBeInTheDocument());

      // Properties is the default tab
      await waitFor(() => expect(screen.getByText('Beautiful House')).toBeInTheDocument());

      const editButtons = screen.getAllByRole('button', { name: /edit property/i });
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      await waitFor(() => expect(screen.getByText('Edit Property')).toBeInTheDocument());
      
      expect(screen.getByDisplayValue('Beautiful House')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Lagos City')).toBeInTheDocument();
    });
    
    it('displays currency in Naira', async () => {
      render(<Dashboard />);
      await waitFor(() => expect(screen.getByText('Beautiful House')).toBeInTheDocument());
      // Check for Naira symbol. 
      // We expect to find text containing ₦
      const priceElement = screen.getByText((content) => content.includes('₦'));
      expect(priceElement).toBeInTheDocument();
    });
    it('handles file selection for property images', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Property');
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Property')).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload files/i);
      const file = new File(['(⌐□_□)'], 'house.png', { type: 'image/png' });
      
      // Mock createObjectURL
      const originalCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/house.png');

      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      // Cleanup
      global.URL.createObjectURL = originalCreateObjectURL;
    });
  });
});
