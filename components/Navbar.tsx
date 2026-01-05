import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Shield, LogIn, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { session, isAdmin, signOut } = useAuth();

  const navItems = [
    { name: 'Events', path: '/', icon: <Home size={20} /> },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: <Shield size={20} /> }] : []),
    ...(session
      ? [{ name: 'Logout', action: signOut, icon: <LogOut size={20} /> }]
      : [{ name: 'Login', path: '/login', icon: <LogIn size={20} /> }]),
  ];

  return (
    <div className="fixed top-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/10 rounded-full px-2 py-2 flex items-center gap-1"
      >
        {navItems.map((item) => {
            const isActive = item.path === location.pathname;
            
            return (
              <motion.div
                key={item.name}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                {item.action ? (
                   <button
                   onClick={item.action}
                   className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium
                     ${isActive ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'}
                   `}
                 >
                   {item.icon}
                   <span className="hidden sm:block">{item.name}</span>
                 </button>
                ) : (
                  <Link
                    to={item.path!}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium
                      ${isActive ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'}
                    `}
                  >
                    {item.icon}
                    <span className="hidden sm:block">{item.name}</span>
                  </Link>
                )}
                
                {isActive && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-black/5 rounded-full -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
              </motion.div>
            );
        })}
      </motion.nav>
    </div>
  );
};

export default Navbar;