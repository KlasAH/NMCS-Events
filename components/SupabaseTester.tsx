
import React, { useState, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Database, Server, AlertCircle, Copy, Check, ExternalLink, ShieldAlert, RefreshCw, X, CheckCircle2, Terminal, Play, Lock, Cpu, Save, User, Trash2, Edit3, Plus, Search, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

// COMPLETE SQL SCHEMA SCRIPT
const FIX_SQL = `
-- 1. UTILITIES & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. RESET FUNCTIONS (Prevent Dependency Locks)
DROP POLICY IF EXISTS "Board sees registrations" ON public.registrations;
DROP POLICY IF EXISTS "Board sees finances" ON public.transactions;
DROP FUNCTION IF EXISTS public.is_board() CASCADE;

-- 3. ADMIN SECURITY FUNCTION
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'board')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'board')
  );
END;
$$;

-- 4. TABLES SETUP

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  username TEXT,
  role TEXT DEFAULT 'user',
  board_role TEXT,
  car_model TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Connection Tests (Diagnostics)
CREATE TABLE IF NOT EXISTS public.connection_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.connection_tests ENABLE ROW LEVEL SECURITY;

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  location_name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  pdf_url TEXT, 
  is_pinned BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft',
  maps_config JSONB DEFAULT '[]'::jsonb,
  hotel_info JSONB DEFAULT '{}'::jsonb,
  parking_info JSONB DEFAULT '{}'::jsonb,
  custom_data JSONB DEFAULT '{}'::jsonb,
  extra_info JSONB DEFAULT '[]'::jsonb,
  gallery_images TEXT[] DEFAULT '{}',
  google_photos_url TEXT
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Itinerary Items
CREATE TABLE IF NOT EXISTS public.itinerary_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_details TEXT,
  location_map_url TEXT,
  sort_order INTEGER DEFAULT 0,
  type TEXT DEFAULT 'activity',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- Registrations
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  forum_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  car_type TEXT,
  status TEXT CHECK (status IN ('confirmed', 'pending', 'cancelled')) DEFAULT 'pending',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  date DATE NOT NULL,
  category TEXT
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (Idempotent)

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Connection Tests (Public for Troubleshooting)
DROP POLICY IF EXISTS "Public can insert tests" ON public.connection_tests;
CREATE POLICY "Public can insert tests" ON public.connection_tests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can read tests" ON public.connection_tests;
CREATE POLICY "Public can read tests" ON public.connection_tests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can update tests" ON public.connection_tests;
CREATE POLICY "Public can update tests" ON public.connection_tests FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can delete tests" ON public.connection_tests;
CREATE POLICY "Public can delete tests" ON public.connection_tests FOR DELETE TO anon, authenticated USING (true);

-- Meetings
DROP POLICY IF EXISTS "Public meetings read" ON public.meetings;
CREATE POLICY "Public meetings read" ON public.meetings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin meetings all" ON public.meetings;
CREATE POLICY "Admin meetings all" ON public.meetings FOR ALL USING (is_admin());

-- Itinerary
DROP POLICY IF EXISTS "Public itinerary read" ON public.itinerary_items;
CREATE POLICY "Public itinerary read" ON public.itinerary_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin itinerary all" ON public.itinerary_items;
CREATE POLICY "Admin itinerary all" ON public.itinerary_items FOR ALL USING (is_admin());

-- Registrations
DROP POLICY IF EXISTS "Public register" ON public.registrations;
CREATE POLICY "Public register" ON public.registrations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "User view own regs" ON public.registrations;
CREATE POLICY "User view own regs" ON public.registrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin manage regs" ON public.registrations;
CREATE POLICY "Admin manage regs" ON public.registrations FOR ALL USING (is_admin());

-- Transactions
DROP POLICY IF EXISTS "Admin manage tx" ON public.transactions;
CREATE POLICY "Admin manage tx" ON public.transactions FOR ALL USING (is_admin());

-- Settings
DROP POLICY IF EXISTS "Public settings read" ON public.app_settings;
CREATE POLICY "Public settings read" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin settings write" ON public.app_settings;
CREATE POLICY "Admin settings write" ON public.app_settings FOR ALL USING (is_admin());

-- 6. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
`;

// Diagnostic Step Definition
type DiagnosticStep = {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'success' | 'error';
    detail?: string;
    errorCode?: string;
};

// TIMEOUT HELPER to prevent getting stuck
async function withTimeout<T>(promise: PromiseLike<T>, ms = 5000): Promise<T> {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout (5s)')), ms);
    });
    try {
        const result = await Promise.race([Promise.resolve(promise), timeout]);
        clearTimeout(timer);
        return result;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

const SupabaseTester: React.FC<SupabaseTesterProps> = ({ isOpen, onClose }) => {
    const { session } = useAuth();
    const [activeTab, setActiveTab] = useState<'auto' | 'manual' | 'profile'>('auto');
    
    // Auto Diag State
    const [isRunning, setIsRunning] = useState(false);
    const [steps, setSteps] = useState<DiagnosticStep[]>([]);
    const [copied, setCopied] = useState(false);

    // Manual / Profile Log State
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [consoleLogs, setConsoleLogs] = useState<{type: 'info'|'error'|'success', msg: string, time: string}[]>([]);

    const log = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
        const time = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [{type, msg, time}, ...prev]);
    };

    // --- AUTOMATED DIAGNOSTICS ---
    const runDiagnostics = async () => {
        setIsRunning(true);
        setConsoleLogs([]); 
        
        const initialSteps: DiagnosticStep[] = [
            { id: 'env', label: 'Environment Config', status: 'pending' },
            { id: 'network', label: 'Network Reachability', status: 'pending' },
            { id: 'table', label: 'Table Access (connection_tests)', status: 'pending' },
            { id: 'schema', label: 'Profile Schema Check', status: 'pending' },
        ];
        setSteps(initialSteps);

        const updateStep = (id: string, status: DiagnosticStep['status'], detail?: string, errorCode?: string) => {
            setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail, errorCode } : s));
            return status === 'success';
        };

        try {
            // 1. Env
            updateStep('env', 'running');
            // @ts-ignore
            const url = import.meta.env.VITE_SUPABASE_URL;
            // @ts-ignore
            const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (!url || !key) {
                 updateStep('env', 'error', 'Missing ENV variables');
                 throw new Error('Missing Env');
            }
            updateStep('env', 'success', `URL: ${url.substring(0, 15)}...`);

            // 2. Network
            updateStep('network', 'running');
            try {
                const start = Date.now();
                // Wrap in timeout
                const { error } = await withTimeout(
                    supabase.from('connection_tests').select('id', { count: 'exact', head: true })
                );
                
                if (error && error.message.includes('fetch')) throw error;
                updateStep('network', 'success', `${Date.now() - start}ms`);
            } catch (e: any) {
                updateStep('network', 'error', e.message || 'Timeout');
                throw e; // Stop here
            }

            // 3. Table Access
            updateStep('table', 'running');
            const { error: tableError } = await withTimeout(
                supabase.from('connection_tests').select('id').limit(1)
            );
            if (tableError) {
                 updateStep('table', 'error', tableError.message, tableError.code);
            } else {
                 updateStep('table', 'success', 'Read OK');
            }

            // 4. Schema
            updateStep('schema', 'running');
            const { error: schemaError } = await withTimeout(
                supabase.from('profiles').select('board_role, updated_at').limit(1)
            );
            if (schemaError) {
                 updateStep('schema', 'error', 'Missing Columns?', schemaError.code);
            } else {
                 updateStep('schema', 'success', 'Columns Exist');
            }

        } catch (e) {
            console.error("Diagnostic Halt", e);
        } finally {
            setIsRunning(false);
        }
    };

    // Auto-run when opening modal
    useEffect(() => {
        if (isOpen && activeTab === 'auto') runDiagnostics();
    }, [isOpen]);


    // --- MANUAL TESTS ---
    const manualTest = async (action: 'insert' | 'read' | 'update' | 'delete') => {
        setLoadingAction(action);
        log(`Starting ${action.toUpperCase()} test on 'connection_tests'...`, 'info');
        
        try {
            if (action === 'insert') {
                const { data, error } = await withTimeout(
                    supabase.from('connection_tests').insert({ 
                        message: 'Manual Test', response_data: 'Clicked Button' 
                    }).select().single()
                );
                if (error) throw error;
                log(`Insert Success! ID: ${data.id}`, 'success');
            }
            if (action === 'read') {
                const { data, error } = await withTimeout(
                    supabase.from('connection_tests').select('*').limit(3).order('created_at', {ascending:false})
                );
                if (error) throw error;
                log(`Read Success! Found ${data.length} rows.`, 'success');
                if(data.length > 0) log(`Row 1: ${JSON.stringify(data[0])}`, 'info');
            }
            if (action === 'update') {
                // First get a row
                const { data: rows } = await withTimeout(supabase.from('connection_tests').select('id').limit(1));
                if (!rows || rows.length === 0) { log('No rows to update. Insert first.', 'error'); setLoadingAction(null); return; }
                
                const { error } = await withTimeout(
                    supabase.from('connection_tests').update({ message: 'Updated ' + Date.now() }).eq('id', rows[0].id)
                );
                if (error) throw error;
                log(`Update Success for ID: ${rows[0].id}`, 'success');
            }
            if (action === 'delete') {
                const { error } = await withTimeout(
                    supabase.from('connection_tests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                );
                if (error) throw error;
                log(`Delete All Success.`, 'success');
            }
        } catch (e: any) {
            log(`${action.toUpperCase()} Failed: ${e.message} (Code: ${e.code || 'N/A'})`, 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    // --- PROFILE DEBUGGER ---
    const profileDebug = async (action: 'read' | 'save_basic' | 'save_full') => {
        if (!session?.user) {
            log("No active session. Please log in first.", 'error');
            return;
        }

        setLoadingAction(action);
        log(`Starting Profile ${action} check...`, 'info');

        try {
            if (action === 'read') {
                const { data, error } = await withTimeout(
                    supabase.from('profiles').select('*').eq('id', session.user.id).single()
                );
                if (error) throw error;
                log(`Read Profile Success!`, 'success');
                log(JSON.stringify(data, null, 2), 'info');
            }

            if (action === 'save_basic') {
                // Minimal save (safe columns)
                const updates = { updated_at: new Date().toISOString() };
                const { error } = await withTimeout(
                    supabase.from('profiles').update(updates).eq('id', session.user.id)
                );
                if (error) throw error;
                log(`Basic Save (updated_at) Success!`, 'success');
            }

            if (action === 'save_full') {
                // Risky save (potentially missing columns)
                const updates = { 
                    updated_at: new Date().toISOString(),
                    board_role: 'Tester',
                    car_model: 'r53'
                };
                const { error } = await withTimeout(
                    supabase.from('profiles').update(updates).eq('id', session.user.id)
                );
                if (error) throw error;
                log(`Full Save (board_role, car_model) Success!`, 'success');
            }

        } catch (e: any) {
            log(`Profile Error: ${e.message}`, 'error');
            if (e.code === '42703') {
                log("CRITICAL: Column missing in database. Run the Fix Script in 'Diagnostics' tab.", 'error');
            }
        } finally {
            setLoadingAction(null);
        }
    };

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const hasError = steps.some(s => s.status === 'error');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Database & Connection Tools">
            <div className="flex flex-col h-[70vh]">
                
                {/* TABS */}
                <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                    <button 
                        onClick={() => setActiveTab('auto')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'auto' ? 'bg-white dark:bg-slate-700 shadow-sm text-mini-black dark:text-white' : 'text-slate-500'}`}
                    >
                        Auto Diagnostics
                    </button>
                    <button 
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'manual' ? 'bg-white dark:bg-slate-700 shadow-sm text-mini-black dark:text-white' : 'text-slate-500'}`}
                    >
                        Connection Lab
                    </button>
                    <button 
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white dark:bg-slate-700 shadow-sm text-mini-black dark:text-white' : 'text-slate-500'}`}
                    >
                        Profile Debug
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-grow overflow-y-auto custom-scrollbar px-1">
                    
                    {/* --- TAB 1: AUTO DIAGNOSTICS --- */}
                    {activeTab === 'auto' && (
                        <div className="space-y-6">
                            <div className={`p-4 rounded-xl border-2 ${hasError ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold flex items-center gap-2">
                                        {isRunning ? <RefreshCw className="animate-spin"/> : hasError ? <ShieldAlert className="text-red-500"/> : <CheckCircle2 className="text-green-500"/>}
                                        {isRunning ? 'Scanning...' : hasError ? 'Issues Found' : 'Systems Nominal'}
                                    </h3>
                                    {!isRunning && <button onClick={runDiagnostics} className="text-xs bg-white px-3 py-1 rounded shadow hover:bg-slate-50">Re-run</button>}
                                </div>
                                <div className="space-y-2">
                                    {steps.map(s => (
                                        <div key={s.id} className="flex justify-between items-center text-sm p-2 bg-white/50 rounded">
                                            <span className="font-medium">{s.label}</span>
                                            <div className="flex items-center gap-2">
                                                {s.status === 'error' && <span className="text-xs text-red-500 font-mono">{s.detail} (Code: {s.errorCode})</span>}
                                                {s.status === 'success' && <span className="text-xs text-green-600">{s.detail || 'OK'}</span>}
                                                {s.status === 'running' && <RefreshCw size={12} className="animate-spin text-blue-500"/>}
                                                {s.status === 'error' && <X size={14} className="text-red-500"/>}
                                                {s.status === 'success' && <Check size={14} className="text-green-500"/>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-white flex items-center gap-2"><Cpu size={16}/> Auto-Fix Script</h4>
                                    <button onClick={copySql} className="text-xs flex items-center gap-1 bg-mini-red text-white px-2 py-1 rounded hover:opacity-90">
                                        {copied ? <Check size={12}/> : <Copy size={12}/>} Copy SQL
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mb-2">If any errors appear above, copy this and run it in the Supabase SQL Editor.</p>
                            </div>
                        </div>
                    )}

                    {/* --- TAB 2: CONNECTION LAB --- */}
                    {activeTab === 'manual' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => manualTest('insert')} className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold flex flex-col items-center gap-1 border border-blue-200">
                                    {loadingAction === 'insert' ? <Loader2 className="animate-spin"/> : <Plus size={20} />} Test Insert
                                </button>
                                <button onClick={() => manualTest('read')} className="p-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold flex flex-col items-center gap-1 border border-green-200">
                                    {loadingAction === 'read' ? <Loader2 className="animate-spin"/> : <Search size={20} />} Test Read
                                </button>
                                <button onClick={() => manualTest('update')} className="p-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-xl font-bold flex flex-col items-center gap-1 border border-yellow-200">
                                    {loadingAction === 'update' ? <Loader2 className="animate-spin"/> : <Edit3 size={20} />} Test Update
                                </button>
                                <button onClick={() => manualTest('delete')} className="p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex flex-col items-center gap-1 border border-red-200">
                                    {loadingAction === 'delete' ? <Loader2 className="animate-spin"/> : <Trash2 size={20} />} Test Delete
                                </button>
                            </div>
                            <div className="text-xs text-slate-400 text-center">
                                Operations target the <code>connection_tests</code> table.
                            </div>
                        </div>
                    )}

                    {/* --- TAB 3: PROFILE DEBUG --- */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                <User className="mx-auto mb-2 text-slate-400" size={32} />
                                <div className="text-sm font-bold">{session?.user?.email || "No User Logged In"}</div>
                                <div className="text-xs text-slate-400 font-mono">{session?.user?.id}</div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button onClick={() => profileDebug('read')} className="p-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl font-bold flex items-center justify-center gap-2">
                                    {loadingAction === 'read' ? <Loader2 className="animate-spin"/> : <Search size={16} />} Read My Profile (Fetch)
                                </button>
                                <button onClick={() => profileDebug('save_basic')} className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-700 hover:bg-blue-200 rounded-xl font-bold flex items-center justify-center gap-2">
                                    {loadingAction === 'save_basic' ? <Loader2 className="animate-spin"/> : <Save size={16} />} Test Save (Basic Fields)
                                </button>
                                <button onClick={() => profileDebug('save_full')} className="p-3 bg-mini-red/10 text-mini-red hover:bg-mini-red/20 rounded-xl font-bold flex items-center justify-center gap-2">
                                    {loadingAction === 'save_full' ? <Loader2 className="animate-spin"/> : <ShieldAlert size={16} />} Test Save (Full / Risky)
                                </button>
                            </div>
                             <div className="text-xs text-slate-400 text-center">
                                'Full Save' attempts to write to <code>board_role</code>. If this fails, you need to run the SQL Fix.
                            </div>
                        </div>
                    )}

                    {/* CONSOLE LOG OUTPUT */}
                    {(activeTab === 'manual' || activeTab === 'profile') && (
                        <div className="mt-6 bg-slate-950 text-slate-300 p-4 rounded-xl font-mono text-xs h-40 overflow-y-auto border border-slate-800 shadow-inner">
                            <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                                <span className="font-bold text-slate-500">CONSOLE OUTPUT</span>
                                <button onClick={() => setConsoleLogs([])} className="text-slate-500 hover:text-white">Clear</button>
                            </div>
                            {consoleLogs.length === 0 ? (
                                <span className="opacity-30 italic">Waiting for input...</span>
                            ) : (
                                consoleLogs.map((l, i) => (
                                    <div key={i} className={`mb-1 ${
                                        l.type === 'error' ? 'text-red-400' : 
                                        l.type === 'success' ? 'text-green-400' : 
                                        'text-slate-300'
                                    }`}>
                                        <span className="opacity-50 mr-2">[{l.time}]</span>
                                        {l.msg}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SupabaseTester;
