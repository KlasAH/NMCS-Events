
import React, { createContext, useContext, useState } from 'react';

type Language = 'sv' | 'en';

interface Translations {
  [key: string]: {
    sv: string;
    en: string;
  };
}

const translations: Translations = {
  // Navigation
  events: { sv: 'Event', en: 'Events' },
  admin: { sv: 'Admin', en: 'Admin' },
  login: { sv: 'Logga in', en: 'Login' },
  logout: { sv: 'Logga ut', en: 'Logout' },
  back: { sv: 'Tillbaka', en: 'Back' },

  // Home / General
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
  date: { sv: 'Datum', en: 'Date' },
  location: { sv: 'Plats', en: 'Location' },
  extraInfo: { sv: 'Mer Info', en: 'Extra Info' },
  food: { sv: 'Mat & Dryck', en: 'Food & Drink' },
  track: { sv: 'Bana / Racing', en: 'Track / Racing' },

  // Registration
  registerForEvent: { sv: 'Anmäl dig', en: 'Register for Event' },
  joinEvent: { sv: 'Delta i eventet', en: 'Join Event' },
  alreadyRegistered: { sv: 'Du är anmäld', en: 'You are registered' },
  phone: { sv: 'Telefonnummer', en: 'Phone Number' },
  forumName: { sv: 'Forumnamn', en: 'Forum Name' },
  carType: { sv: 'Bilmodell', en: 'Car Model' },
  confirmRegistration: { sv: 'Bekräfta anmälan', en: 'Confirm Registration' },
  registrationSuccess: { sv: 'Tack för din anmälan!', en: 'Thanks for registering!' },
  registrationError: { sv: 'Något gick fel. Försök igen.', en: 'Something went wrong. Try again.' },

  // Login / Auth Strings
  loginHeader: { sv: 'Endast för styrelsen', en: 'Board Members Only' },
  loginSub: { sv: 'Åtkomst till administration', en: 'Access to administration' },
  signupHeader: { sv: 'Bli medlem', en: 'Join the Club' },
  signupSub: { sv: 'Skapa ett konto för att komma igång', en: 'Create your account to get started' },
  forgotHeader: { sv: 'Återställ lösenord', en: 'Reset Password' },
  forgotSub: { sv: 'Ange din e-post för att få en länk', en: 'Enter your email to receive a link' },
  resetConfirmHeader: { sv: 'Nytt lösenord', en: 'New Password' },
  resetConfirmSub: { sv: 'Ange ditt nya säkra lösenord', en: 'Enter your new secure password' },
  
  // Form Labels & Placeholders
  emailOrUsername: { sv: 'E-post eller Användarnamn', en: 'Email or Username' },
  emailOrUsernamePlaceholder: { sv: 'användarnamn eller e-post', en: 'username or email' },
  password: { sv: 'Lösenord', en: 'Password' },
  fullName: { sv: 'Namn', en: 'Full Name' },
  username: { sv: 'Användarnamn', en: 'Username' },
  email: { sv: 'E-post', en: 'Email' },
  forgotBtn: { sv: 'Glömt?', en: 'Forgot?' },
  
  // Buttons
  signIn: { sv: 'Logga in', en: 'Sign In' },
  createAccount: { sv: 'Skapa konto', en: 'Create Account' },
  creatingAccount: { sv: 'Skapar konto...', en: 'Creating Account...' },
  processing: { sv: 'Bearbetar...', en: 'Processing...' },
  sendResetLink: { sv: 'Skicka återställningslänk', en: 'Send Reset Link' },
  updatePassword: { sv: 'Uppdatera lösenord', en: 'Update Password' },
  
  // Links / Toggles
  noAccount: { sv: 'Har du inget konto?', en: "Don't have an account?" },
  registerNow: { sv: 'Registrera dig nu', en: 'Register Now' },
  hasAccount: { sv: 'Har du redan ett konto? Logga in', en: 'Already have an account? Log In' },
  backToLogin: { sv: 'Tillbaka till inloggning', en: 'Back to Login' },
  or: { sv: 'Eller', en: 'Or' },
  
  // Errors / Success
  successLogin: { sv: 'Inloggning lyckades!', en: 'Login successful!' },
  successReg: { sv: 'Registrering lyckades!', en: 'Registration successful!' },
  checkEmail: { sv: 'Kontrollera din e-post.', en: 'Please check your email.' },
  userNotFound: { sv: 'Användarnamnet hittades inte.', en: 'Username not found.' },
  usernameTaken: { sv: 'Användarnamnet är redan upptaget.', en: 'Username is already taken.' },
  invalidCreds: { sv: 'Felaktiga inloggningsuppgifter', en: 'Invalid login credentials' },
  unexpectedError: { sv: 'Ett oväntat fel uppstod.', en: 'An unexpected error occurred.' },
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
