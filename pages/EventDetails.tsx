import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { Meeting } from '../types';
import Itinerary from '../components/Itinerary';
import { motion } from 'framer-motion';
import { ArrowLeft, Map, Calendar, Info, MapPin } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';

const mockDetailMeeting: Meeting = {
    id: '1',
    created_at: new Date().toISOString(),
    title: 'Alpine Grand Tour 2024',
    date: '2024-06-15',
    location_name: 'Swiss Alps, Zurich Start',
    description: 'Our annual flagship event traversing the most scenic passes in the Alps. Prepare for 3 days of spirited driving, luxury accommodation, and fine dining. Limited to 30 cars.',
    cover_image_url: 'https://picsum.photos/seed/alpine/800/600',
    maps_url: 'https://goo.gl/maps/example',
    custom_data: {
        'Dress Code': 'Smart Casual',
        'Radio Frequency': '446.006 MHz',
        'Hotel': 'The Dolder Grand',
        'Parking': 'Valet Reserved'
    }
}

const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
        setMeeting(mockDetailMeeting);
        setLoading(false);
        return;
    }

    const fetchMeeting = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setMeeting(data);
      }
      setLoading(false);
    };

    fetchMeeting();
  }, [id]);

  if (loading) return <div className="pt-32 text-center">Loading event details...</div>;
  if (!meeting) return <div className="pt-32 text-center">Event not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
        {/* Hero Image */}
        <div className="relative h-[50vh] w-full overflow-hidden">
             <motion.img 
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.5 }}
                src={meeting.cover_image_url} 
                className="w-full h-full object-cover" 
                alt={meeting.title}
             />
             <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
             <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 bg-gradient-to-t from-black/90 to-transparent">
                 <div className="max-w-5xl mx-auto">
                    <Link to="/" className="inline-flex items-center text-white/80 hover:text-white mb-6 transition-colors">
                        <ArrowLeft size={20} className="mr-2" /> Back to Events
                    </Link>
                    <motion.h1 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-4xl md:text-6xl font-bold text-white mb-2"
                    >
                        {meeting.title}
                    </motion.h1>
                    <div className="flex flex-wrap items-center gap-6 text-white/90">
                        <span className="flex items-center gap-2"><Calendar size={18} /> {format(new Date(meeting.date), 'EEEE, MMMM do, yyyy')}</span>
                        <span className="flex items-center gap-2"><MapPin size={18} /> {meeting.location_name}</span>
                    </div>
                 </div>
             </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-8 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
                {/* About Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50"
                >
                    <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Info className="text-blue-600" /> About the Event
                    </h2>
                    <p className="text-slate-600 leading-relaxed text-lg">
                        {meeting.description}
                    </p>

                    {/* Dynamic Custom Data Rendering */}
                    {meeting.custom_data && Object.keys(meeting.custom_data).length > 0 && (
                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Object.entries(meeting.custom_data).map(([key, value]) => (
                                <div key={key} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{key}</span>
                                    <span className="text-slate-800 font-medium">{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Itinerary Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50"
                >
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Calendar className="text-blue-600" /> Itinerary
                    </h2>
                    <Itinerary meetingId={meeting.id} />
                </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
                {/* Route / Map Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center"
                >
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Map className="text-blue-600" /> Route Map
                    </h2>
                    {meeting.maps_url ? (
                        <>
                            <div className="bg-white p-2 rounded-xl border border-slate-100 mb-4">
                                <div style={{ height: "auto", margin: "0 auto", maxWidth: 128, width: "100%" }}>
                                    <QRCode
                                        size={256}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        value={meeting.maps_url}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">Scan to open in Maps</p>
                            <a 
                                href={meeting.maps_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
                            >
                                Open Route
                            </a>
                        </>
                    ) : (
                        <p className="text-slate-400 italic">Route details coming soon.</p>
                    )}
                </motion.div>
            </div>
        </div>
    </div>
  );
};

export default EventDetails;