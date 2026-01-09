
import React, { useEffect, useState, useMemo } from 'react';
// @ts-ignore
import { useParams, Link } from 'react-router-dom';
import { supabase, isDemoMode, getAssetUrl } from '../lib/supabase';
import { Meeting, ExtraInfoSection, MapConfig } from '../types';
import Itinerary from '../components/Itinerary';
import Modal from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Map, Calendar, FileText, MapPin, Building2, Car, Utensils, Flag, Info, ChevronDown, ChevronRight, ExternalLink, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import sv from 'date-fns/locale/sv';
import enGB from 'date-fns/locale/en-GB';

const mockDetailMeeting: Meeting = {
    id: '1',
    created_at: new Date().toISOString(),
    title: 'Alpine Grand Tour 2024',
    date: '2024-06-15',
    end_date: '2024-06-17',
    location_name: 'Swiss Alps, Zurich Start',
    description: 'Our annual flagship event traversing the most scenic passes in the Alps. Prepare for 3 days of spirited driving, luxury accommodation, and fine dining. Limited to 30 cars.',
    cover_image_url: 'https://picsum.photos/seed/alpine/1920/1080',
    pdf_url: 'pdf/alpine_guide.pdf',
    maps_config: [
        { groupName: 'Day 1', label: 'Zurich to Andermatt', url: 'https://goo.gl/maps/day1' },
        { groupName: 'Day 1', label: 'Lunch Stop', url: 'https://goo.gl/maps/lunch1' },
        { groupName: 'Day 2', label: 'Passes Loop', url: 'https://goo.gl/maps/day2' },
        { groupName: 'Day 3', label: 'Return to Base', url: 'https://goo.gl/maps/day3' }
    ],
    hotel_info: {
        name: 'The Dolder Grand',
        address: 'Kurhausstrasse 65, 8032 Zürich, Switzerland',
        map_url: 'https://goo.gl/maps/dolder',
        price_single: '4500 SEK / night',
        price_double: '5500 SEK / night',
        description: 'Luxury 5-star hotel offering panoramic views of the city. Features a 4,000 sqm spa and 2-Michelin star dining.',
        image_url: 'https://picsum.photos/seed/hotel/400/300',
        booking_links: [
            { label: 'Booking.com', url: 'https://booking.com' },
            { label: 'Hotels.com', url: 'https://hotels.com' },
            { label: 'Direct Hotel Site', url: 'https://thedoldergrand.com' }
        ]
    },
    parking_info: {
        location: 'Hotel Underground Garage - Zone B',
        cost: 'Included in package',
        security_info: '24/7 CCTV and Guarded Entry. Low clearance cars welcome (ramp angle < 8 degrees).',
        image_url: 'https://picsum.photos/seed/parking/400/300',
        apps: [
            { label: 'EasyPark', url: 'https://easypark.com' },
            { label: 'Parkster', url: 'https://parkster.com' }
        ]
    },
    extra_info: [
        { 
            id: 'e1', 
            type: 'food',
            title: 'Food & Dining', 
            icon: 'utensils', 
            content: 'We have reserved tables at Restaurant Saltz for Friday night. Saturday is a free evening in Andermatt.', 
            image_url: 'https://picsum.photos/seed/food/400/300',
            links: [{ label: 'Restaurant Saltz Menu', url: 'https://saltz.ch' }] 
        },
        { 
            id: 'e2', 
            type: 'racing',
            title: 'Racing Track Info', 
            icon: 'flag', 
            content: 'Optional track session at Ambri Airport on Sunday morning. Helmet mandatory. Noise limit 95dB.', 
            address: 'Ambri Airport, 6775 Quinto, Switzerland',
            website_url: 'https://ambri-airport.ch',
            image_url: 'https://picsum.photos/seed/track/400/300',
            links: [{ label: 'Track Layout', url: '#' }] 
        },
        {
            id: 'e3',
            type: 'roadtrip',
            title: 'Road Trip Info',
            icon: 'map',
            content: 'Detailed information about the scenic routes, photo stops, and historic landmarks we will pass.',
            image_url: 'https://picsum.photos/seed/road/400/300'
        }
    ]
}

const EventDetails: React.FC = () => {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [selectedExtraInfo, setSelectedExtraInfo] = useState<ExtraInfoSection | null>(null);
  
  // Map Collapse State
  const [expandedMapGroups, setExpandedMapGroups] = useState<Record<string, boolean>>({});

  const { t, language } = useLanguage();
  const dateLocale = language === 'sv' ? sv : enGB;

  useEffect(() => {
    if (isDemoMode) {
        setMeeting(mockDetailMeeting);
        if(mockDetailMeeting.maps_config) {
             // Default expand first group
             const firstGroup = mockDetailMeeting.maps_config[0].groupName || 'General';
             setExpandedMapGroups({ [firstGroup]: true });
        }
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
        if(data.maps_config && Array.isArray(data.maps_config)) {
             const firstGroup = data.maps_config[0]?.groupName || 'General';
             setExpandedMapGroups({ [firstGroup]: true });
        }
      }
      setLoading(false);
    };

    fetchMeeting();
  }, [id]);

  const groupedMaps = useMemo(() => {
      const groups: Record<string, MapConfig[]> = {};
      if (!meeting?.maps_config) return groups;
      
      meeting.maps_config.forEach(map => {
          const name = map.groupName || 'General';
          if (!groups[name]) groups[name] = [];
          groups[name].push(map);
      });
      return groups;
  }, [meeting]);

  const toggleMapGroup = (group: string) => {
      setExpandedMapGroups(prev => ({...prev, [group]: !prev[group]}));
  }

  if (loading) return <div className="pt-32 text-center dark:text-white">Loading...</div>;
  if (!meeting) return <div className="pt-32 text-center dark:text-white">Event not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
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
                        <ArrowLeft size={20} className="mr-2" /> {t('back')}
                    </Link>
                    <motion.h1 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-2"
                    >
                        {meeting.title}
                    </motion.h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-white/90 text-sm md:text-base font-medium">
                        <span className="flex items-center gap-2">
                            <Calendar size={18} className="text-mini-red" /> 
                            {format(new Date(meeting.date), 'MMM do', {locale: dateLocale})} 
                            {meeting.end_date && ` - ${format(new Date(meeting.end_date), 'MMM do, yyyy', {locale: dateLocale})}`}
                        </span>
                        <span className="flex items-center gap-2"><MapPin size={18} className="text-mini-red" /> {meeting.location_name}</span>
                        
                        {/* PDF Download Button */}
                        {meeting.pdf_url && (
                            <a 
                                href={getAssetUrl(meeting.pdf_url)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 bg-mini-red text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg w-fit"
                            >
                                <Download size={18} /> {t('download')} PDF
                            </a>
                        )}
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
                    className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors"
                >
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <FileText className="text-mini-red" /> {t('about')}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg mb-8 whitespace-pre-line">
                        {meeting.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {meeting.hotel_info && (
                            <button 
                                onClick={() => setShowHotelModal(true)}
                                className="flex flex-col text-left rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-mini-red dark:hover:border-mini-red group transition-all overflow-hidden"
                            >
                                {meeting.hotel_info.image_url && (
                                    <div className="h-32 w-full overflow-hidden">
                                        <img src={meeting.hotel_info.image_url} alt="Hotel" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                )}
                                <div className="p-4 flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                            <Building2 size={24} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{t('hotel')}</div>
                                            <div className="text-xs text-slate-500">{t('details')}</div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="rotate-180 text-slate-300 group-hover:text-mini-red transition-colors" size={20} />
                                </div>
                            </button>
                        )}

                        {meeting.parking_info && (
                            <button 
                                onClick={() => setShowParkingModal(true)}
                                className="flex flex-col text-left rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-mini-red dark:hover:border-mini-red group transition-all overflow-hidden"
                            >
                                {meeting.parking_info.image_url && (
                                    <div className="h-32 w-full overflow-hidden">
                                        <img src={meeting.parking_info.image_url} alt="Parking" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                )}
                                <div className="p-4 flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                                            <Car size={24} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{t('parking')}</div>
                                            <div className="text-xs text-slate-500">{t('details')}</div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="rotate-180 text-slate-300 group-hover:text-mini-red transition-colors" size={20} />
                                </div>
                            </button>
                        )}
                        
                        {/* Extra Info Buttons (Dynamic) */}
                        {meeting.extra_info?.map(extra => (
                             <button 
                                key={extra.id}
                                onClick={() => setSelectedExtraInfo(extra)}
                                className="flex flex-col text-left rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-mini-red dark:hover:border-mini-red group transition-all overflow-hidden"
                            >
                                {extra.image_url && (
                                    <div className="h-32 w-full overflow-hidden">
                                        <img src={extra.image_url} alt={extra.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                )}
                                <div className="p-4 flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                                            {extra.icon === 'utensils' && <Utensils size={24} />}
                                            {extra.icon === 'flag' && <Flag size={24} />}
                                            {extra.icon === 'map' && <Map size={24} />}
                                            {(!extra.icon || extra.icon === 'info') && <Info size={24} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{extra.title}</div>
                                            <div className="text-xs text-slate-500">{t('readMore')}</div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="rotate-180 text-slate-300 group-hover:text-mini-red transition-colors" size={20} />
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Itinerary Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors"
                >
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Calendar className="text-mini-red" /> {t('itinerary')}
                    </h2>
                    <Itinerary meetingId={meeting.id} />
                </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
                {/* Route / Map Card (Collapsible) */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors"
                >
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Map className="text-mini-red" /> {t('maps')}
                    </h2>
                    
                    {Object.keys(groupedMaps).length > 0 ? (
                        <div className="w-full space-y-4">
                            {Object.entries(groupedMaps).map(([groupName, maps]) => (
                                <div key={groupName} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                     <button 
                                        onClick={() => toggleMapGroup(groupName)}
                                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                     >
                                         <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{groupName}</span>
                                         {expandedMapGroups[groupName] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                     </button>

                                     <AnimatePresence>
                                        {expandedMapGroups[groupName] && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 space-y-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                                    {(maps as MapConfig[]).map((mapItem, idx) => (
                                                        <div key={idx} className="flex flex-col items-center text-center">
                                                            <div className="bg-white p-2 rounded-lg border border-slate-100 dark:border-slate-700 mb-2 shadow-sm">
                                                                <QRCode
                                                                    size={100}
                                                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                                    value={mapItem.url}
                                                                    viewBox={`0 0 256 256`}
                                                                />
                                                            </div>
                                                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-1">{mapItem.label}</h4>
                                                            <a 
                                                                href={mapItem.url} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="text-xs font-bold text-mini-red hover:underline flex items-center gap-1"
                                                            >
                                                                {t('openMap')} <ExternalLink size={10} />
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                     </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 italic text-center text-sm">Route details coming soon.</p>
                    )}
                </motion.div>
            </div>
        </div>

        {/* Hotel Modal */}
        <Modal 
            isOpen={showHotelModal} 
            onClose={() => setShowHotelModal(false)}
            title={t('hotel')}
        >
            {meeting.hotel_info && (
                <div className="space-y-5">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">{meeting.hotel_info.name}</h3>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                         <div className="flex items-start gap-3 mb-2">
                             <MapPin className="text-mini-red shrink-0 mt-1" size={18} />
                             <p className="text-slate-700 dark:text-slate-300">{meeting.hotel_info.address}</p>
                         </div>
                         <a href={meeting.hotel_info.map_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-mini-red hover:underline ml-8 flex items-center gap-1">
                             {t('openMap')} <ExternalLink size={12}/>
                         </a>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center">
                            <span className="block text-xs text-slate-500 uppercase tracking-wide">Single Room</span>
                            <span className="block font-bold text-slate-900 dark:text-white">{meeting.hotel_info.price_single}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center">
                            <span className="block text-xs text-slate-500 uppercase tracking-wide">Double Room</span>
                            <span className="block font-bold text-slate-900 dark:text-white">{meeting.hotel_info.price_double}</span>
                        </div>
                    </div>

                    <div className="prose dark:prose-invert text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                        <p>{meeting.hotel_info.description}</p>
                    </div>

                    {/* Multiple Booking Links */}
                    {meeting.hotel_info.booking_links && meeting.hotel_info.booking_links.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('bookNow')}</p>
                            <div className="grid grid-cols-1 gap-2">
                                {meeting.hotel_info.booking_links.map((link, i) => (
                                    <a 
                                        key={i}
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full flex items-center justify-between px-4 py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        <span>{link.label}</span>
                                        <ExternalLink size={16} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </Modal>

        {/* Parking Modal */}
        <Modal 
            isOpen={showParkingModal} 
            onClose={() => setShowParkingModal(false)}
            title={t('parking')}
        >
            {meeting.parking_info && (
                <div className="space-y-5">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                         <h4 className="font-bold text-slate-900 dark:text-white mb-1">{t('location')}</h4>
                         <p className="text-slate-600 dark:text-slate-300">{meeting.parking_info.location}</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                         <h4 className="font-bold text-slate-900 dark:text-white mb-1">Cost</h4>
                         <p className="text-slate-600 dark:text-slate-300">{meeting.parking_info.cost}</p>
                    </div>

                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                         <h4 className="font-bold text-mini-red mb-1">Security & Access</h4>
                         <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{meeting.parking_info.security_info}</p>
                    </div>

                    {/* Apps */}
                    {meeting.parking_info.apps && meeting.parking_info.apps.length > 0 && (
                        <div>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Apps</p>
                             <div className="flex flex-wrap gap-2">
                                 {meeting.parking_info.apps.map((app, i) => (
                                     <a key={i} href={app.url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                         {app.label}
                                     </a>
                                 ))}
                             </div>
                        </div>
                    )}

                    {meeting.parking_info.map_url && (
                        <a 
                            href={meeting.parking_info.map_url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full block text-center py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl font-bold hover:border-mini-red dark:hover:border-mini-red hover:text-mini-red transition-colors"
                        >
                            {t('openMap')}
                        </a>
                    )}
                </div>
            )}
        </Modal>

        {/* Extra Info Modal */}
        <Modal
            isOpen={!!selectedExtraInfo}
            onClose={() => setSelectedExtraInfo(null)}
            title={selectedExtraInfo?.title || t('details')}
        >
             {selectedExtraInfo && (
                 <div className="space-y-4">
                     <div className="flex justify-center mb-4">
                         <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-mini-red">
                            {selectedExtraInfo.icon === 'utensils' && <Utensils size={32} />}
                            {selectedExtraInfo.icon === 'flag' && <Flag size={32} />}
                            {selectedExtraInfo.icon === 'map' && <Map size={32} />}
                            {(!selectedExtraInfo.icon || selectedExtraInfo.icon === 'info') && <Info size={32} />}
                         </div>
                     </div>
                     
                     {selectedExtraInfo.image_url && (
                        <div className="rounded-xl overflow-hidden mb-4 border border-slate-100 dark:border-slate-800">
                             <img src={selectedExtraInfo.image_url} alt={selectedExtraInfo.title} className="w-full h-auto" />
                        </div>
                     )}

                     <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg whitespace-pre-line">
                         {selectedExtraInfo.content}
                     </p>

                     {/* Racing Track Specific Fields */}
                     {selectedExtraInfo.type === 'racing' && selectedExtraInfo.address && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-start gap-3 mb-2">
                                <MapPin className="text-mini-red shrink-0 mt-1" size={18} />
                                <p className="text-slate-700 dark:text-slate-300 font-medium">{selectedExtraInfo.address}</p>
                            </div>
                        </div>
                     )}

                     {selectedExtraInfo.type === 'racing' && selectedExtraInfo.website_url && (
                         <a 
                            href={selectedExtraInfo.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-2"
                         >
                             Visit Homepage
                         </a>
                     )}
                     
                     {selectedExtraInfo.links && selectedExtraInfo.links.length > 0 && (
                         <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                             {selectedExtraInfo.links.map((link, i) => (
                                 <a 
                                    key={i}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-mini-red font-bold hover:underline mb-2"
                                 >
                                     <ExternalLink size={16}/> {link.label}
                                 </a>
                             ))}
                         </div>
                     )}
                 </div>
             )}
        </Modal>
    </div>
  );
};

export default EventDetails;