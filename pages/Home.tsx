
import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isDemoMode, getAssetUrl } from '../lib/supabase';
import { Meeting } from '../types';
import EventCard from '../components/EventCard';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const mockMeetings: Meeting[] = [
    {
        id: '1',
        created_at: new Date().toISOString(),
        title: 'Alpine Grand Tour 2024',
        date: '2024-06-15',
        location_name: 'Swiss Alps, Zurich Start',
        description: 'Our annual flagship event traversing the most scenic passes in the Alps. Prepare for 3 days of spirited driving, luxury accommodation, and fine dining. Limited to 30 cars.',
        cover_image_url: 'https://picsum.photos/seed/alpine/800/600',
        is_pinned: true
    },
    {
        id: '2',
        created_at: new Date().toISOString(),
        title: 'Sunday Coffee Run',
        date: '2024-04-20',
        location_name: 'Blue Bottle, Downtown',
        description: 'Casual meet and greet for new members. Coffee is on the club.',
        cover_image_url: 'https://picsum.photos/seed/coffee/800/600',
        is_pinned: false
    },
    {
        id: '3',
        created_at: new Date().toISOString(),
        title: 'Track Day: Silverstone',
        date: '2024-05-10',
        location_name: 'Silverstone Circuit, UK',
        description: 'Open pit lane format. Instructors available. Noise limit 102dB.',
        cover_image_url: 'https://picsum.photos/seed/track/800/600',
        is_pinned: false
    },
    {
        id: '4',
        created_at: new Date().toISOString(),
        title: 'Coastal Cruise',
        date: '2024-07-08',
        location_name: 'Pacific Highway',
        description: 'A relaxed drive along the coast followed by a seafood lunch.',
        cover_image_url: 'https://picsum.photos/seed/coast/800/600',
        is_pinned: false
    }
];

type FilterType = 'all' | 'upcoming' | 'past';

const Home: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const { currentTheme } = useTheme();

  useEffect(() => {
    if (isDemoMode) {
        setTimeout(() => {
            setMeetings(mockMeetings);
            setLoading(false);
        }, 800);
        return;
    }

    const fetchMeetings = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('date', { ascending: false }); // Fetch latest dates first as base
      
      if (!error && data) {
        setMeetings(data);
      }
      setLoading(false);
    };

    fetchMeetings();
  }, []);

  const filteredMeetings = useMemo(() => {
    let filtered = [...meetings];

    // 1. Text Search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(m => 
            m.title.toLowerCase().includes(query) || 
            m.location_name.toLowerCase().includes(query)
        );
    }

    // 2. Date Filter
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (filterType === 'upcoming') {
        filtered = filtered.filter(m => new Date(m.date) >= today);
    } else if (filterType === 'past') {
        filtered = filtered.filter(m => new Date(m.date) < today);
    }

    // 3. Sort: Pinned first, then Date
    filtered.sort((a, b) => {
        // Pinned always on top
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (filterType === 'past') {
            return dateB - dateA; // Newest past event first
        } else {
             return dateB - dateA;
        }
    });

    return filtered;

  }, [meetings, searchQuery, filterType]);

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center relative"
      >
         <div className="inline-block mb-4 p-2 px-4 rounded-full bg-mini-black dark:bg-white text-white dark:text-black text-xs font-bold tracking-widest uppercase transition-colors">
            Since 2001
        </div>

        {/* Header Layout: [Car] [Old Logo] [Title] [New Logo] [Car] */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            
            {/* Left Group */}
            <div className="flex items-center gap-4">
                {/* Left Car (Theme) */}
                <motion.img 
                    key={`left-${currentTheme.id}`}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    src={currentTheme.carImageUrl} 
                    className="w-24 md:w-32 h-auto hidden lg:block opacity-80 transition-all object-contain"
                    style={{ filter: `drop-shadow(0 0 10px ${currentTheme.color}30)` }}
                    alt={`${currentTheme.name} Left`}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />

                {/* Logo Old */}
                <motion.img 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    src={getAssetUrl('logos/logo_old.png')}
                    className="h-12 md:h-20 w-auto object-contain dark:invert transition-all"
                    alt="Classic Mini Logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            </div>

            {/* Center Title */}
            <div className="flex flex-col items-center mx-2">
                <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter transition-colors">
                    NMCS <span style={{ color: currentTheme.color }} className="transition-colors duration-500">EVENTS</span>
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium transition-colors mt-2">
                    The ultimate club for modern Mini enthusiasts.
                </p>
            </div>

            {/* Right Group */}
            <div className="flex items-center gap-4">
                {/* Logo New */}
                <motion.img 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    src={getAssetUrl('logos/logo_new.png')}
                    className="h-12 md:h-20 w-auto object-contain dark:invert transition-all"
                    alt="Modern Mini Logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />

                {/* Right Car (Theme) */}
                <motion.img 
                    key={`right-${currentTheme.id}`}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    src={currentTheme.carImageUrl} 
                    className="w-24 md:w-32 h-auto hidden lg:block opacity-80 scale-x-[-1] transition-all object-contain"
                    style={{ filter: `drop-shadow(0 0 10px ${currentTheme.color}30)` }}
                    alt={`${currentTheme.name} Right`}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            </div>
        </div>
      </motion.div>

      {/* Controls Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10 bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none p-2 flex flex-col md:flex-row gap-2 max-w-4xl mx-auto border border-slate-100 dark:border-slate-800 transition-colors"
      >
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Find a trip..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-mini-red focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-white transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 transition-colors">
             {(['all', 'upcoming', 'past'] as const).map((ft) => (
                 <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all
                        ${filterType === ft 
                            ? 'bg-white dark:bg-slate-700 text-mini-black dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}
                    `}
                 >
                     {ft}
                 </button>
             ))}
        </div>
      </motion.div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {[1,2,3,4].map(i => (
                <div key={i} className={`bg-slate-200 dark:bg-slate-800 rounded-3xl h-64 ${i===1 ? 'md:col-span-2 md:row-span-2' : ''}`}></div>
            ))}
        </div>
      ) : (
        <>
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-20 text-slate-400 dark:text-slate-500">
                    <p className="text-xl font-medium">No events found fitting your criteria.</p>
                    <button 
                        onClick={() => {setFilterType('all'); setSearchQuery('');}}
                        className="mt-4 text-mini-red font-bold hover:underline"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
                {filteredMeetings.map((meeting, index) => (
                    <EventCard key={meeting.id} meeting={meeting} index={index} />
                ))}
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default Home;
