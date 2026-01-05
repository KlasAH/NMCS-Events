import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Meeting } from '../types';
import EventCard from '../components/EventCard';
import { motion } from 'framer-motion';
import { Search, Filter, Star } from 'lucide-react';

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
    // If 'all' or 'upcoming', usually prefer closest date first, but pinned stays on top.
    // If 'past', prefer most recent past date first.
    
    filtered.sort((a, b) => {
        // Pinned always on top
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (filterType === 'past') {
            return dateB - dateA; // Newest past event first
        } else {
             // For upcoming/all, arguably closest date is better, but user asked for 'Latest First' (descending)
             // in context of a blog/feed. Let's do descending (Newest date first).
             return dateB - dateA;
        }
    });

    return filtered;

  }, [meetings, searchQuery, filterType]);

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        {/* Header styling updated for Mini theme */}
        <div className="inline-block mb-4 p-2 px-4 rounded-full bg-mini-black text-white text-xs font-bold tracking-widest uppercase">
             Since 2001
        </div>
        <h1 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter mb-4">
          NMCS <span className="text-transparent bg-clip-text bg-gradient-to-r from-mini-red to-red-600">EVENTS</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
          The ultimate club for modern Mini enthusiasts. <br className="hidden md:block"/> Rallies, meetups, and track days.
        </p>
      </motion.div>

      {/* Controls Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10 bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-2 flex flex-col md:flex-row gap-2 max-w-4xl mx-auto border border-slate-100"
      >
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Find a trip..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-mini-red focus:bg-white transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
             {(['all', 'upcoming', 'past'] as const).map((ft) => (
                 <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all
                        ${filterType === ft 
                            ? 'bg-white text-mini-black shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
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
                <div key={i} className={`bg-slate-200 rounded-3xl h-64 ${i===1 ? 'md:col-span-2 md:row-span-2' : ''}`}></div>
            ))}
        </div>
      ) : (
        <>
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
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