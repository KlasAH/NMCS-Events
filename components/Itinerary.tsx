
import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ItineraryItem } from '../types';
import { Clock, Info, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import sv from 'date-fns/locale/sv';
import enGB from 'date-fns/locale/en-GB';
import Modal from './Modal';
import { useLanguage } from '../context/LanguageContext';

interface ItineraryProps {
  meetingId: string;
}

const mockItinerary: ItineraryItem[] = [
    { id: '1', meeting_id: '123', date: '2024-06-15', start_time: '09:00', title: 'Arrival & Coffee', description: 'Meet at the clubhouse', location_details: 'The Clubhouse has freshly brewed coffee and pastries available for all members.', location_map_url: 'https://google.com/maps' },
    { id: '2', meeting_id: '123', date: '2024-06-15', start_time: '10:30', title: 'Drivers Briefing', description: 'Safety protocols and route overview' },
    { id: '3', meeting_id: '123', date: '2024-06-15', start_time: '11:00', title: 'Engines Start', description: 'Departure in convoy groups' },
    { id: '4', meeting_id: '123', date: '2024-06-15', start_time: '13:00', title: 'Lunch Stop', description: 'The Old Mill Restaurant', location_details: 'Reserved seating in the patio area. Pre-orders required for groups larger than 4.' },
    { id: '5', meeting_id: '123', date: '2024-06-16', start_time: '09:30', title: 'Morning Drive', description: 'Pass through the valley' },
    { id: '6', meeting_id: '123', date: '2024-06-16', start_time: '12:00', title: 'Farewell Lunch', description: 'Beachside Grill' },
];

const Itinerary: React.FC<ItineraryProps> = ({ meetingId }) => {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const { language, t } = useLanguage();

  useEffect(() => {
    if (isDemoMode) {
        setItems(mockItinerary);
        setLoading(false);
        // Default expand first day for better UX
        if(mockItinerary.length > 0) {
            setExpandedDates({ [mockItinerary[0].date]: true });
        }
        return;
    }

    const fetchItinerary = async () => {
      const { data, error } = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!error && data) {
        setItems(data);
        if(data.length > 0) {
             setExpandedDates({ [data[0].date]: true });
        }
      }
      setLoading(false);
    };

    fetchItinerary();
  }, [meetingId]);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, ItineraryItem[]> = {};
    items.forEach(item => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
    });
    return groups;
  }, [items]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  if (loading) return <div className="p-4 text-center text-slate-400 animate-pulse">{t('itinerary')}...</div>;

  return (
    <>
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([date, dateItemsUntyped]) => {
          const dateItems = dateItemsUntyped as ItineraryItem[];
          return (
          <div key={date} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
            {/* Header / Date Toggle */}
            <button 
                onClick={() => toggleDate(date)}
                className="w-full flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white text-lg capitalize">
                        {format(new Date(date), 'EEEE, d MMM', { locale: language === 'sv' ? sv : enGB })}
                    </span>
                    <span className="text-xs bg-mini-red text-white px-2 py-0.5 rounded-full font-bold">
                        {dateItems.length}
                    </span>
                </div>
                {expandedDates[date] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>

            {/* Content */}
            <AnimatePresence>
                {expandedDates[date] && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="relative pt-6 pb-2 pl-2">
                             {/* Vertical Line */}
                             <div className="absolute left-[34px] top-6 bottom-6 w-[2px] bg-slate-200 dark:bg-slate-700"></div>

                             {dateItems.map((item) => (
                                <div key={item.id} className="relative pl-16 pr-4 pb-8 group flex items-start justify-between">
                                    {/* Timeline Dot */}
                                    <div className="absolute left-[26px] top-1.5 w-[18px] h-[18px] rounded-full border-4 border-mini-red bg-white dark:bg-slate-900 z-10" />

                                    <div className="flex-grow">
                                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                                            <span className="font-mono font-bold text-mini-red text-lg flex items-center gap-1 min-w-[70px]">
                                                <Clock size={16} />
                                                {item.start_time.slice(0, 5)}
                                            </span>
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{item.title}</h4>
                                                {item.description && (
                                                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{item.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Button - Appears if location details exist or description is long */}
                                    {(item.location_details || item.description) && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                                            className="ml-2 p-2 bg-slate-100 dark:bg-slate-700 text-mini-red hover:bg-mini-red hover:text-white rounded-full transition-all shadow-sm shrink-0"
                                            title={t('readMore')}
                                        >
                                            <Info size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>
      )})}

      {items.length === 0 && (
          <div className="text-center text-slate-400 italic py-4">No itinerary available yet.</div>
      )}
    </div>

    {/* Details Modal */}
    <Modal 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.title || t('details')}
    >
        {selectedItem && (
            <div className="space-y-4">
                 {selectedItem.description && (
                     <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Description</h4>
                         <p className="text-slate-700 dark:text-slate-300">{selectedItem.description}</p>
                     </div>
                 )}
                
                {selectedItem.location_details && (
                     <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Details</h4>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedItem.location_details}
                        </p>
                    </div>
                )}
                
                {selectedItem.location_map_url && (
                    <a 
                        href={selectedItem.location_map_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-mini-red text-white px-4 py-2 rounded-lg font-bold hover:opacity-90 mt-2 shadow-lg shadow-red-200 dark:shadow-none w-full justify-center"
                    >
                        <MapPin size={18} /> {t('openMap')}
                    </a>
                )}
            </div>
        )}
    </Modal>
    </>
  );
};

export default Itinerary;
