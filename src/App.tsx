import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Properties from '@/pages/Properties';
import PropertyDetails from '@/pages/PropertyDetails';
import Projects from '@/pages/Projects';
import ProjectDetails from '@/pages/ProjectDetails';
import Auctions from '@/pages/Auctions';
import AuctionDetails from '@/pages/AuctionDetails';
import Contact from '@/pages/Contact';
import ContactAgent from '@/pages/ContactAgent';
import About from '@/pages/About';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/admin/Dashboard';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/:id" element={<PropertyDetails />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="auctions" element={<Auctions />} />
          <Route path="auctions/:id" element={<AuctionDetails />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="contact-agent" element={<ContactAgent />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          
          <Route 
            path="admin" 
            element={
              <ProtectedRoute roles={['admin', 'agent']}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<div className="p-20 text-center">404 Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;