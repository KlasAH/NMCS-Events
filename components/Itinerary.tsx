import React, { useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ItineraryItem } from '../types';
import { Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ItineraryProps {
  meetingId: string;
}

const mockItinerary: ItineraryItem[] = [
    { id: '1', meeting_id: '123', start_time: '09:00', title: 'Arrival & Coffee', description: 'Meet at the clubhouse' },
    { id: '2', meeting_id: '123', start_time: '10:30', title: 'Drivers Briefing', description: 'Safety protocols and route overview' },
    { id: '3', meeting_id: '123', start_time: '11:00', title: 'Engines Start', description: 'Departure in convoy groups' },
    { id: '4', meeting_id: '123', start_time: '13:00', title: 'Lunch Stop', description: 'The Old Mill Restaurant' },
];

const Itinerary: React.FC<ItineraryProps> = ({ meetingId }) => {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
        setItems(mockItinerary);
        setLoading(false);
        return;
    }

    const fetchItinerary = async () => {
      const { data, error } = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('start_time', { ascending: true });

      if (!error && data) {
        setItems(data);
      }
      setLoading(false);
    };

    fetchItinerary();

    // Real-time subscription
    const channel = supabase
      .channel('itinerary_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itinerary_items',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          console.log('Real-time update:', payload);
          fetchItinerary(); // Re-fetch to keep simple sorting logic
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  if (loading) return <div className="p-4 text-center text-slate-400 animate-pulse">Loading schedule...</div>;

  return (
    <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 py-2">
      <AnimatePresence>
        {items.map((item, index) => (
            <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-8"
            >
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-mini-red shadow-sm" />
                
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                    <span className="font-mono font-bold text-mini-red text-lg flex items-center gap-1 min-w-[80px]">
                        <Clock size={16} />
                        {item.start_time.slice(0, 5)}
                    </span>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{item.title}</h4>
                        {item.description && (
                            <p className="text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                        )}
                    </div>
                </div>
            </motion.div>
        ))}
      </AnimatePresence>
      {items.length === 0 && (
          <div className="pl-8 text-slate-400 italic">No itinerary items yet.</div>
      )}
    </div>
  );
};

export default Itinerary;