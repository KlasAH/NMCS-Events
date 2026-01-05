import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Scroll to top on route change
const ScrollToTop = () => {
    const { pathname } = useLocation();
    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <div className="min-h-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-mini-red selection:text-white transition-colors duration-300">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/event/:id" element={<EventDetails />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;