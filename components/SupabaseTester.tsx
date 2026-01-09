import React, { useState, useRef } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Activity, Database, Server, AlertCircle, Copy, Check, ExternalLink, ShieldAlert, Timer, Globe } from 'lucide-react';
import Modal from './Modal';
import { motion } from 'framer-motion';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

const FIX_SQL = `
-- 1. FIX: Security Warning "Mutable Search Path"
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  extracted_username TEXT;
  extracted_fullname TEXT;
BEGIN
  extracted_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  extracted_fullname := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  INSERT INTO public.profiles (id, email, full_name, username, role)
  VALUES (new.id, new.email, extracted_fullname, extracted_username, 'user')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username;
    
  RETURN new;
END;
$$;

-- 2. FIX: Security Warning "RLS Policy Always True" for connection tests
-- We replace the loose "ALL" policy with specific INSERT/SELECT policies
CREATE TABLE IF NOT EXISTS public.connection_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.connection_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can test connection" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can insert tests" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can read tests" ON public.connection_tests;

CREATE POLICY "Public can insert tests" ON public.connection_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read tests" ON public.connection_tests FOR SELECT USING (true);

-- 3. FIX: Performance "Unindexed Foreign Keys"
CREATE INDEX IF NOT EXISTS idx_itinerary_meeting_id ON public.itinerary_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_registrations_meeting_id ON public.registrations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_meeting_id ON public.transactions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
`;

const SupabaseTester: React.FC<SupabaseTesterProps> = ({ isOpen, onClose }) => {
    const [inputVal, setInputVal] = useState('');
    const [outputVal, setOutputVal] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'writing' | 'reading' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    
    // Timer ref to show "Waking up" messages
    const coldStartTimer = useRef<any>(null);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper to timeout a promise
    // INCREASED to 65s for Supabase Free Tier Cold Starts (Slightly longer than fetch timeout to catch inner errors)
    const withTimeout = (promise: any, ms: number = 65000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Connection timed out (${ms/1000}s).`)), ms))
        ]);
    };

    const handleTest = async () => {
        if (!inputVal) return;
        
        setStatus('writing');
        setOutputVal(null);
        setLogs([]);
        
        // Use standard Vite env access safely
        let envUrl = '';
        let envKey = '';
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                 // @ts-ignore
                 // Sanitize here too just in case
                 envUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
                 // @ts-ignore
                 envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '').replace(/^['"]|['"]$/g, '').trim();
            }
        } catch (e) {
            // ignore
        }
        
        if (!envUrl) {
            addLog('CRITICAL ERROR: VITE_SUPABASE_URL is missing!');
            addLog('In Coolify, keys must start with "VITE_" to be visible to the frontend.');
            setStatus('error');
            return;
        }

        // Sanitized check
        if (envUrl.includes('"') || envUrl.includes("'") || envUrl.includes(" ")) {
            addLog('ERROR: URL contains invalid characters (quotes/spaces).');
            addLog('We attempted to clean it, but check your Coolify settings.');
        }

        addLog(`Target: ${envUrl.replace(/https:\/\/[^.]+\./, 'https://***.')}`);
        
        if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        
        // Show a helpful message if it takes longer than 3 seconds
        coldStartTimer.current = setTimeout(() => {
             addLog('⚠️ Slow response detected.');
             addLog('Database might be "Paused" (Free Tier limit).');
             addLog('Waiting up to 60s for wake-up...');
        }, 3000);

        if (isDemoMode) {
            clearTimeout(coldStartTimer.current);
            setTimeout(() => {
                addLog('Demo Mode: Simulating write...');
                setStatus('reading');
                setTimeout(() => {
                    addLog('Demo Mode: Read successful.');
                    setOutputVal(inputVal);
                    setStatus('success');
                }, 800);
            }, 800);
            return;
        }

        try {
            // STEP 0: DIRECT HTTP CHECK (Bypassing SDK)
            // This proves if we can actually reach the internet/server
            addLog('Step 0: Network Reachability Check...');
            try {
                // Ping the Supabase REST endpoint root
                const restUrl = `${envUrl}/rest/v1/`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for pure ping
                
                const response = await fetch(restUrl, {
                    method: 'GET',
                    headers: {
                        'apikey': envKey,
                        'Authorization': `Bearer ${envKey}`
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.ok || response.status === 404) {
                    // 404 is fine here, it means we reached the server and it replied "No route", but we connected!
                    // 200 is better.
                    addLog(`Network OK. Status: ${response.status}`);
                } else {
                    addLog(`Network Warning. Server replied: ${response.status} ${response.statusText}`);
                }
            } catch (netErr: any) {
                console.error("Network check failed:", netErr);
                addLog(`NETWORK ERROR: ${netErr.name} - ${netErr.message}`);
                addLog('DIAGNOSIS: The browser cannot reach Supabase.');
                addLog('Check: AdBlockers, Firewalls, or invalid URL.');
                throw new Error('Network Reachability Failed');
            }

            // STEP 1: SDK PING (Simple Select)
            addLog('Step 1: Pinging database (SDK)...');
            
            const { error: pingError } = await withTimeout(
                supabase.from('connection_tests').select('id').limit(1)
            );
            
            // Clear the "waking up" timer as soon as we get a response
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);

            if (pingError) {
                // If the table doesn't exist, we'll get a specific error code 42P01
                if (pingError.code === '42P01') {
                     throw new Error('Table "connection_tests" not found. Run the SQL Fix.');
                }
                throw new Error(`Ping Failed: ${pingError.message} (${pingError.code || 'No Code'})`);
            }
            addLog(`Ping successful. Connection established.`);

            // STEP 2: WRITE
            addLog(`Step 2: Writing "${inputVal}"...`);
            const { data: insertData, error: insertError } = await withTimeout(
                supabase.from('connection_tests')
                .insert([{ 
                    message: inputVal,
                    response_data: 'Server received: ' + inputVal
                }])
                .select()
                .single()
            );

            if (insertError) throw new Error(`Write Failed: ${insertError.message}`);

            addLog('Write successful. Row ID: ' + insertData.id);
            setStatus('reading');

            // STEP 3: READ BACK
            addLog('Step 3: Verifying data...');
            const { data: readData, error: readError } = await withTimeout(
                supabase.from('connection_tests')
                .select('message')
                .eq('id', insertData.id)
                .single()
            );

            if (readError) throw new Error(`Read Failed: ${readError.message}`);

            addLog(`Read successful. Value: "${readData.message}"`);
            setOutputVal(readData.message);
            setStatus('success');

        } catch (err: any) {
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            console.error(err);
            const msg = err.message || 'Unknown error';
            addLog('ERROR: ' + msg);
            
            // Heuristic diagnostics for Frontend/Vite based on user context
            if (msg.includes('timed out') || msg.includes('Failed to fetch') || msg.includes('Network Reachability')) {
                addLog('------------------------------------------------');
                addLog('DIAGNOSIS: CONNECTION TIMEOUT / BLOCKED');
                addLog('1. Check VITE_SUPABASE_URL in Coolify (No quotes!).');
                addLog('2. DB might be paused (7-day inactivity).');
                addLog('3. Disable AdBlockers (uBlock, etc).');
                addLog('------------------------------------------------');
            } else if (msg.includes('not found') || msg.includes('policy') || msg.includes('permission')) {
                addLog('------------------------------------------------');
                addLog('DIAGNOSIS: RLS / PERMISSIONS');
                addLog('The app connected, but was blocked from reading.');
                addLog('Run the "Copy SQL Fix" script below.');
                addLog('------------------------------------------------');
            }

            setStatus('error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Connection Troubleshooter">
            <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><ShieldAlert size={16}/> Security & Performance Updates</h4>
                    <p className="text-xs mb-2">
                        Updates available for "Mutable Search Path", "RLS Policies", and "Missing Indexes".
                    </p>
                    <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li><strong>Mutable Search Path:</strong> Fixed by adding <code>SET search_path = public</code> to functions.</li>
                        <li><strong>RLS Policy:</strong> Tightened <code>connection_tests</code> policies.</li>
                        <li><strong>Performance:</strong> Added indexes for foreign keys (itinerary, registrations, etc).</li>
                    </ul>
                </div>

                {/* VISUALIZER */}
                <div className="flex items-center justify-between px-4 py-8 bg-slate-100 dark:bg-slate-900 rounded-2xl relative overflow-hidden">
                    {/* PC */}
                    <div className="flex flex-col items-center z-10">
                        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border-2 ${status === 'writing' ? 'border-mini-red' : 'border-transparent'}`}>
                             <Server size={24} className="text-slate-700 dark:text-slate-200" />
                        </div>
                        <span className="text-xs font-bold mt-2 text-slate-500">Your App</span>
                    </div>

                    {/* Connection Line */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 px-16">
                        <div className="h-1 bg-slate-200 dark:bg-slate-700 w-full rounded-full overflow-hidden relative">
                             <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700"></div>
                             {status === 'success' && <div className="absolute inset-0 bg-green-500"></div>}
                             {status === 'error' && <div className="absolute inset-0 bg-red-500"></div>}
                            {(status === 'writing' || status === 'reading') && (
                                <motion.div 
                                    className="h-full bg-mini-red w-1/3 absolute top-0"
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '300%' }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                />
                            )}
                        </div>
                    </div>

                    {/* DB */}
                    <div className="flex flex-col items-center z-10">
                         <div className={`p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border-2 ${status === 'reading' || status === 'success' ? 'border-green-500' : status === 'error' ? 'border-red-500' : 'border-transparent'}`}>
                             {status === 'error' ? (
                                <AlertCircle size={24} className="text-red-500" />
                             ) : (
                                <Database size={24} className="text-slate-700 dark:text-slate-200" />
                             )}
                        </div>
                        <span className="text-xs font-bold mt-2 text-slate-500">Supabase</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Test Connection</label>
                        <input 
                            type="text" 
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="Type hello..."
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none"
                        />
                        <button 
                            onClick={handleTest}
                            disabled={!inputVal || status === 'writing' || status === 'reading'}
                            className="mt-3 w-full py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {status === 'writing' || status === 'reading' ? <Activity className="animate-spin" size={18} /> : <Globe size={18} />}
                            {status === 'writing' ? 'Testing...' : 'Test Reachability'}
                        </button>
                    </div>

                    <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Logs</label>
                        <div className="flex-grow bg-black/90 text-green-400 p-3 rounded-xl font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse min-h-[140px]">
                            {logs.length === 0 ? <span className="opacity-50">Ready to test...</span> : logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0 break-all">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SQL Fix Section */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <Database className="text-slate-500 shrink-0 mt-1" size={20} />
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Apply Database Fixes</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Run this SQL to fix Security Warnings and Performance Issues.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                         <a 
                            href="https://supabase.com/dashboard" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                         >
                            <ExternalLink size={14} /> Open Dashboard
                         </a>
                        <button 
                            onClick={copySql}
                            className="flex-1 flex items-center justify-center gap-2 bg-mini-red hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy SQL Fixes'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default SupabaseTester;