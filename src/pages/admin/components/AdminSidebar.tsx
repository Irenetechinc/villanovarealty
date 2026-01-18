import React from 'react';
import { 
  LayoutDashboard, 
  Home, 
  Building2, 
  Users, 
  MessageSquare, 
  Phone, 
  FileText, 
  Gavel, 
  UserCog, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bot
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  setIsCollapsed 
}) => {
  const menuItems = [
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
    { id: 'adroom', label: 'AdRoom', icon: Bot },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'projects', label: 'Projects', icon: Building2 },
    { id: 'auctions', label: 'Auctions', icon: Gavel },
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'users', label: 'User Mgmt', icon: UserCog },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'about', label: 'About Page', icon: FileText },
  ];

  return (
    <div 
      className={`bg-white h-screen fixed left-0 top-0 pt-20 border-r border-gray-200 transition-all duration-300 z-40 flex flex-col overflow-x-hidden ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex justify-end p-4">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <ul className="space-y-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center p-3 rounded-lg transition-colors group relative ${
                    isActive 
                      ? 'bg-primary text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={24} className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                  
                  {!isCollapsed && (
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {item.label}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button className={`w-full flex items-center p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
          isCollapsed ? 'justify-center' : ''
        }`}>
          <LogOut size={24} className={isCollapsed ? '' : 'mr-3'} />
          {!isCollapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
