
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Shield, LogIn, LogOut, Sun, Moon, Car } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme, MODELS } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getAssetUrl } from '../lib/supabase';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { session, isAdmin, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode, model, setModel, currentTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showGenMenu, setShowGenMenu] = useState(false);

  const navItems = [
    { name: t('events'), path: '/', icon: <Home size={18} /> },
    ...(isAdmin ? [{ name: t('admin'), path: '/admin', icon: <Shield size={18} /> }] : []),
    ...(session
      ? [{ name: t('logout'), action: signOut, icon: <LogOut size={18} /> }]
      : [{ name: t('login'), path: '/login', icon: <LogIn size={18} /> }]),
  ];

  return (
    <div className="fixed top-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700 shadow-2xl shadow-black/10 rounded-full px-4 py-2 flex items-center gap-4"
      >
        {/* Mini Wings Logo */}
        <Link to="/" className="flex items-center">
            <img 
                src={getAssetUrl('logos/mini-wings.png')} 
                alt="MINI" 
                className="h-6 w-auto object-contain dark:invert transition-all"
                onError={(e) => {
                    // Fallback if image not found
                    e.currentTarget.style.display = 'none';
                }}
            />
        </Link>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Navigation Items */}
        <div className="flex items-center gap-1">
        {navItems.map((item) => {
            const isActive = item.path === location.pathname;
            
            return (
              <motion.div
                key={item.name}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                {item.action ? (
                   <button
                   onClick={item.action}
                   className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium
                     ${isActive ? 'bg-mini-black text-white dark:bg-white dark:text-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}
                   `}
                 >
                   {item.icon}
                   <span className="hidden sm:block">{item.name}</span>
                 </button>
                ) : (
                  <Link
                    to={item.path!}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium
                      ${isActive ? 'bg-mini-black text-white dark:bg-white dark:text-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}
                    `}
                  >
                    {item.icon}
                    <span className="hidden sm:block">{item.name}</span>
                  </Link>
                )}
              </motion.div>
            );
        })}
        </div>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Language Toggle */}
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setLanguage(language === 'sv' ? 'en' : 'sv')}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm"
            title={language === 'sv' ? 'Switch to English' : 'Byt till Svenska'}
        >
            {language === 'sv' ? '🇸🇪' : '🇬🇧'}
        </motion.button>

        {/* Model Selector */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGenMenu(!showGenMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold text-mini-red bg-red-50 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-slate-700 transition-colors"
          >
             <Car size={18} />
             <span className="hidden sm:block whitespace-nowrap">{currentTheme.name}</span>
          </motion.button>

          <AnimatePresence>
            {showGenMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 p-2 min-w-[200px] overflow-hidden"
              >
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase tracking-wider">Select Model</div>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setShowGenMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors
                      ${model === m.id 
                        ? 'bg-mini-red/10 text-mini-red font-bold' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                    `}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] opacity-60 ml-2">{m.years}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dark Mode Toggle */}
        <motion.button
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleDarkMode}
            className="p-2 ml-1 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </motion.button>
      </motion.nav>
    </div>
  );
};

export default Navbar;
