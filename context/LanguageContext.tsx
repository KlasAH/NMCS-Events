
import React, { createContext, useContext, useState } from 'react';

type Language = 'sv' | 'en';

interface Translations {
  [key: string]: {
    sv: string;
    en: string;
  };
}

const translations: Translations = {
  events: { sv: 'Event', en: 'Events' },
  admin: { sv: 'Admin', en: 'Admin' },
  login: { sv: 'Logga in', en: 'Login' },
  logout: { sv: 'Logga ut', en: 'Logout' },
  about: { sv: 'Om Eventet', en: 'About the Event' },
  itinerary: { sv: 'Schema', en: 'Itinerary' },
  details: { sv: 'Detaljer', en: 'Details' },
  hotel: { sv: 'Hotell', en: 'Hotel' },
  parking: { sv: 'Parkering', en: 'Parking' },
  bookNow: { sv: 'Boka Nu', en: 'Book Now' },
  openMap: { sv: 'Öppna Karta', en: 'Open Map' },
  download: { sv: 'Ladda ner', en: 'Download' },
  maps: { sv: 'Kartor & Rutter', en: 'Maps & Routes' },
  readMore: { sv: 'Läs mer', en: 'Read more' },
  back: { sv: 'Tillbaka', en: 'Back' },
  date: { sv: 'Datum', en: 'Date' },
  location: { sv: 'Plats', en: 'Location' },
  extraInfo: { sv: 'Mer Info', en: 'Extra Info' },
  food: { sv: 'Mat & Dryck', en: 'Food & Drink' },
  track: { sv: 'Bana / Racing', en: 'Track / Racing' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('sv'); // Default Swedish

  const t = (key: string) => {
    if (!translations[key]) return key;
    return translations[key][language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
