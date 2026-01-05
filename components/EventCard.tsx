import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Meeting } from '../types';
import { format } from 'date-fns';

interface EventCardProps {
  meeting: Meeting;
  index: number;
}

const EventCard: React.FC<EventCardProps> = ({ meeting, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col border-b-4 border-transparent hover:border-mini-red dark:border-slate-800 dark:hover:border-mini-red
        ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}
      `}
    >
      <div className={`relative overflow-hidden ${index === 0 ? 'h-64 md:h-80' : 'h-48'}`}>
        <img
          src={meeting.cover_image_url || `https://picsum.photos/800/600?random=${index}`}
          alt={meeting.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
        
        {/* Pinned Badge */}
        {meeting.is_pinned && (
          <div className="absolute top-4 right-4 bg-mini-red text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
            <Star size={12} fill="currentColor" /> MAIN EVENT
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-black/40 backdrop-blur-md px-3 py-1 rounded-full w-fit mb-2 border border-white/10">
            <Calendar size={12} />
            {format(new Date(meeting.date), 'MMM d, yyyy')}
          </div>
          <h3 className={`font-black leading-tight ${index === 0 ? 'text-3xl md:text-4xl' : 'text-xl'}`}>
            {meeting.title}
          </h3>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow justify-between bg-white dark:bg-slate-900 transition-colors">
        <div>
            <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400 mb-3 text-sm font-medium">
                <MapPin size={16} className="mt-0.5 shrink-0 text-mini-red" />
                <span>{meeting.location_name}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 line-clamp-3 text-sm leading-relaxed">
                {meeting.description}
            </p>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Details</span>
            <Link 
                to={`/event/${meeting.id}`}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-mini-black dark:bg-white text-white dark:text-black group-hover:bg-mini-red dark:group-hover:bg-mini-red dark:group-hover:text-white transition-all duration-300 transform group-hover:scale-110"
            >
                <ArrowRight size={18} />
            </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard;