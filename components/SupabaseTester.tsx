

import React, { useState, useRef, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Activity, Database, Server, AlertCircle, Copy, Check, ExternalLink, ShieldAlert, Timer, Globe, Trash2, Edit2, Save, X, RefreshCw, Key, Play } from 'lucide-react';
import Modal from './Modal';
import { motion } from 'framer-motion';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

const FIX_SQL = `
-- 1. CLEANUP: PREVENT DEPENDENCY ERRORS (2BP01)
DROP POLICY IF EXISTS "Board sees registrations" ON public.registrations;
DROP POLICY IF EXISTS "Board sees finances" ON public.transactions;
DROP FUNCTION IF EXISTS public.is_board() CASCADE;

-- 2. FIX: Security Warning "Mutable Search Path"
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

-- 3. FIX: Enable Full CRUD for Tester
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
DROP POLICY IF EXISTS "Public can update tests" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can delete tests" ON public.connection_tests;
CREATE POLICY "Public can insert tests" ON public.connection_tests FOR INSERT TO anon, authenticated WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can read tests" ON public.connection_tests FOR SELECT TO anon, authenticated USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update tests" ON public.connection_tests FOR UPDATE TO anon, authenticated USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can delete tests" ON public.connection_tests FOR DELETE TO anon, authenticated USING (auth.role() IN ('anon', 'authenticated'));

-- 4. FIX: Registrations "Always True" Warning
DROP POLICY IF EXISTS "Public can register" ON public.registrations;
CREATE POLICY "Public can register" ON public.registrations FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 5. FIX: Performance "Unindexed Foreign Keys"
CREATE INDEX IF NOT EXISTS idx_itinerary_meeting_id ON public.itinerary_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_registrations_meeting_id ON public.registrations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_meeting_id ON public.transactions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 6. FEATURE: App Settings for Auto Logout
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Public/Auth can read settings" ON public.app_settings;
CREATE POLICY "Public/Auth can read settings" ON public.app_settings FOR SELECT USING (true);

-- 7. FEATURE: Board Role Column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS board_role TEXT;

-- 8. FEATURE: Publish Status
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft';
`;

const SupabaseTester: React.FC<SupabaseTesterProps> = ({ isOpen, onClose }) => {
    const [inputVal, setInputVal] = useState('');
    const [outputVal, setOutputVal] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'writing' | 'reading' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    
    // Table Data State
    const [tableRows, setTableRows] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    
    // Countdown state for cold starts
    const [countdown, setCountdown] = useState<number | null>(null);
    const coldStartTimer = useRef<any>(null);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper to timeout a promise
    const withTimeout = (promise: any, ms: number = 65000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Connection timed out (${ms/1000}s).`)), ms))
        ]);
    };

    // Helper: Create a fresh client (bypassing global singleton issues)
    const getFreshClient = () => {
        let envUrl = '';
        let envKey = '';
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                 // @ts-ignore
                 envUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
                 envUrl = envUrl.replace(/\/$/, '');
                 
                 // @ts-ignore
                 envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '').replace(/^['"]|['"]$/g, '').trim();
            }
        } catch (e) {
            console.error(e);
        }
        
        if (!envUrl || !envKey) return null;

        return createClient(envUrl, envKey, {
            auth: { persistSession: false }
        });
    };

    const fetchLatestRows = async (customClient?: any) => {
        const client = customClient || supabase;

        if (isDemoMode) {
            setTableRows([
                { id: 'mock-1', message: 'Demo Data 1', created_at: new Date().toISOString() },
                { id: 'mock-2', message: 'Demo Data 2', created_at: new Date().toISOString() }
            ]);
            return;
        }

        const { data, error } = await client
            .from('connection_tests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) {
            addLog(`Table Refresh Failed: ${error.message} (${error.code || 'No Code'})`);
        } else {
            setTableRows(data || []);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLatestRows();
        }
    }, [isOpen]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        };
    }, []);

    const startCountdown = () => {
        setCountdown(60);
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return interval;
    };

    const handleTest = async () => {
        if (!inputVal) return;
        
        setStatus('writing');
        setOutputVal(null);
        setLogs([]);
        setCountdown(null);
        
        // Use standard Vite env access safely
        let envUrl = '';
        let envKey = '';
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                 // @ts-ignore
                 envUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
                 envUrl = envUrl.replace(/\/$/, '');
                 
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

        if (envUrl.includes('"') || envUrl.includes("'") || envUrl.includes(" ")) {
            addLog('ERROR: URL contains invalid characters (quotes/spaces).');
            addLog('We attempted to clean it, but check your Coolify settings.');
        }

        addLog(`Target: ${envUrl.replace(/https:\/\/[^.]+\./, 'https://***.')}`);
        
        if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        
        // Start "Slow Response" detector
        coldStartTimer.current = setTimeout(() => {
             addLog('⚠️ Slow response detected.');
             addLog('Database might be "Paused" (Free Tier limit).');
             addLog('Waking up database... (up to 60s)');
             startCountdown();
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
                    fetchLatestRows();
                }, 800);
            }, 800);
            return;
        }

        try {
            // STEP 0: DIRECT HTTP CHECK (Root)
            addLog('Step 0: Network Reachability Check...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const restUrl = `${envUrl}/rest/v1/`;
                
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
                    addLog(`Network OK. Status: ${response.status}`);
                } else if (response.status === 401) {
                    addLog('CRITICAL ERROR: 401 Unauthorized.');
                    setStatus('error');
                    if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
                    return; // ABORT
                } else {
                    addLog(`Network Warning. Server replied: ${response.status} ${response.statusText}`);
                }
            } catch (netErr: any) {
                console.error("Network check failed:", netErr);
                addLog(`NETWORK ERROR: ${netErr.name} - ${netErr.message}`);
                throw new Error('Network Reachability Failed');
            }

            // RESET TIMER: Step 0 Passed, so network is fine.
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            coldStartTimer.current = setTimeout(() => {
                 addLog('⚠️ Slow response detected on DB step.');
                 startCountdown();
            }, 3000);

            // STEP 1: DIRECT TABLE CHECK (REST)
            // Bypasses SDK to isolate if table exists or permissions issue
            addLog('Step 1: Checking Table Existence (REST)...');
            try {
                // Try to fetch just 1 row, 0 bytes
                const tableUrl = `${envUrl}/rest/v1/connection_tests?select=id&limit=1`;
                const tableResp = await fetch(tableUrl, {
                    method: 'GET',
                    headers: {
                        'apikey': envKey,
                        'Authorization': `Bearer ${envKey}`
                    }
                    // No timeout here, let it run (Supabase sleep can take time)
                });
                
                if (tableResp.status === 404) {
                    throw new Error('Table "connection_tests" Not Found (404). Run SQL Fix!');
                } else if (tableResp.status === 401) {
                     throw new Error('Unauthorized Access to Table. Check RLS Policies (Run SQL Fix).');
                } else if (!tableResp.ok) {
                     addLog(`Table Check Warning: ${tableResp.status} ${tableResp.statusText}`);
                } else {
                    addLog('Table "connection_tests" found and accessible.');
                }
            } catch (tableErr: any) {
                 if (tableErr.message.includes('SQL Fix')) throw tableErr;
                 addLog(`Table Check Info: ${tableErr.message}`);
                 // Continue to SDK anyway, maybe it can handle it
            }

            // STEP 2: SDK PING
            addLog('Step 2: Pinging database (SDK)...');
            
            // RESET TIMER: Step 1 Passed, so REST is fine.
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            coldStartTimer.current = setTimeout(() => {
                 addLog('⚠️ SDK is taking a long time...');
                 startCountdown();
            }, 5000);

            // CRITICAL: Create a fresh, isolated client using the keys we just verified.
            const testClient = createClient(envUrl, envKey, {
                auth: { persistSession: false } // Pure data test, no auth overhead
            });
            
            const { error: pingError } = await withTimeout(
                testClient.from('connection_tests').select('id').limit(1)
            );
            
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            setCountdown(null);

            if (pingError) {
                if (pingError.code === '42P01') {
                     throw new Error('Table "connection_tests" not found. Run the SQL Fix.');
                }
                throw new Error(`Ping Failed: ${pingError.message} (${pingError.code || 'No Code'})`);
            }
            addLog(`Ping successful. SDK Connected.`);

            // STEP 3: WRITE
            addLog(`Step 3: Writing "${inputVal}"...`);
            const { data: insertData, error: insertError } = await withTimeout(
                testClient.from('connection_tests')
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

            // STEP 4: READ BACK
            addLog('Step 4: Verifying data...');
            const { data: readData, error: readError } = await withTimeout(
                testClient.from('connection_tests')
                .select('message')
                .eq('id', insertData.id)
                .single()
            );

            if (readError) throw new Error(`Read Failed: ${readError.message}`);

            addLog(`Read successful. Value: "${readData.message}"`);
            setOutputVal(readData.message);
            setStatus('success');
            
            // USE THE WORKING CLIENT TO REFRESH THE TABLE
            await fetchLatestRows(testClient);

        } catch (err: any) {
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            setCountdown(null);
            
            console.error(err);
            const msg = err.message || 'Unknown error';
            addLog('ERROR: ' + msg);
            
            if (msg.includes('timed out') || msg.includes('Failed to fetch') || msg.includes('Network Reachability')) {
                addLog('------------------------------------------------');
                addLog('DIAGNOSIS: CONNECTION TIMEOUT / PAUSED');
                addLog('1. Database is waking up (Wait 1 min and try again).');
                addLog('2. Check VITE_SUPABASE_URL in Coolify.');
                addLog('------------------------------------------------');
            } else if (msg.includes('not found') || msg.includes('policy') || msg.includes('permission') || msg.includes('404')) {
                addLog('------------------------------------------------');
                addLog('DIAGNOSIS: MISSING TABLE OR RLS POLICY');
                addLog('The app cannot write to the database yet.');
                addLog('SOLUTION: Click "Copy SQL Fixes" below and run in Supabase SQL Editor.');
                addLog('------------------------------------------------');
            } else if (msg.includes('401')) {
                addLog('------------------------------------------------');
                addLog('DIAGNOSIS: INVALID API KEY');
                addLog('See KEY INSPECTOR above.');
                addLog('------------------------------------------------');
            }

            setStatus('error');
        }
    };

    const handleDelete = async (id: string) => {
        if (isDemoMode) {
            setTableRows(prev => prev.filter(r => r.id !== id));
            addLog('Demo Mode: Deleted locally.');
            return;
        }

        const client = getFreshClient();
        if (!client) {
            addLog('ERROR: Could not create Supabase client (Missing Env Vars?)');
            return;
        }

        addLog(`Deleting row ${id.slice(0, 8)}...`);
        const { error } = await client.from('connection_tests').delete().eq('id', id);
        
        if (error) {
            addLog(`Delete Failed: ${error.message}`);
        } else {
            addLog('Delete successful.');
            fetchLatestRows(client);
        }
    };

    const handleUpdate = async (id: string) => {
        if (isDemoMode) {
            setTableRows(prev => prev.map(r => r.id === id ? { ...r, message: editValue } : r));
            setEditingId(null);
            addLog('Demo Mode: Updated locally.');
            return;
        }

        const client = getFreshClient();
        if (!client) {
            addLog('ERROR: Could not create Supabase client (Missing Env Vars?)');
            return;
        }

        addLog(`Updating row ${id.slice(0, 8)}...`);
        const { error } = await client.from('connection_tests').update({ message: editValue }).eq('id', id);
        
        if (error) {
            addLog(`Update Failed: ${error.message}`);
        } else {
            addLog('Update successful.');
            setEditingId(null);
            fetchLatestRows(client);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Connection Troubleshooter">
            <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><ShieldAlert size={16}/> Security & Performance Updates</h4>
                    <p className="text-xs mb-2">
                        Updates available for "Dependency Errors (2BP01)", "Security Advisor", and "Permissions".
                    </p>
                    <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li><strong>Fixed Dependency Error (2BP01):</strong> SQL now explicitly drops old "Board" policies before dropping functions.</li>
                        <li><strong>Fixed "Always True" Policies:</strong> Updated policies to use explicit role checks.</li>
                        <li><strong>Mutable Search Path:</strong> Fixed by adding <code>SET search_path = public</code> to functions.</li>
                        <li><strong>NEW: Publish Status:</strong> Added 'status' column to meetings table.</li>
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
                        {/* Countdown Overlay */}
                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center -top-6">
                                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Timer size={10} /> Waking Up: {countdown}s
                                </span>
                            </div>
                        )}
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
                        <div className="flex-grow bg-black/90 text-green-400 p-3 rounded-xl font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse min-h-[160px]">
                            {logs.length === 0 ? <span className="opacity-50">Ready to test...</span> : logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0 break-all">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stored Data Table */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stored Data (Last 5)</label>
                        <button onClick={() => fetchLatestRows()} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            <RefreshCw size={10} /> Refresh
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-3 text-slate-500 font-bold w-20">ID</th>
                                    <th className="p-3 text-slate-500 font-bold">Message</th>
                                    <th className="p-3 text-slate-500 font-bold text-right w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {tableRows.map(row => (
                                    <tr key={row.id}>
                                        <td className="p-3 font-mono text-slate-400">{row.id.slice(0,6)}...</td>
                                        <td className="p-3">
                                            {editingId === row.id ? (
                                                <input 
                                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 outline-none focus:border-mini-red"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-slate-700 dark:text-slate-300">{row.message}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                {editingId === row.id ? (
                                                    <>
                                                        <button onClick={() => handleUpdate(row.id)} className="text-green-600 hover:text-green-700 p-1 bg-green-50 dark:bg-green-900/30 rounded"><Save size={14}/></button>
                                                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 dark:bg-slate-800 rounded"><X size={14}/></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => { setEditingId(row.id); setEditValue(row.message); }} className="text-blue-500 hover:text-blue-600 p-1 bg-blue-50 dark:bg-blue-900/30 rounded"><Edit2 size={14}/></button>
                                                        <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-600 p-1 bg-red-50 dark:bg-red-900/30 rounded"><Trash2 size={14}/></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {tableRows.length === 0 && (
                                    <tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">No data found in 'connection_tests'.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SQL Fix Section */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <Database className="text-slate-500 shrink-0 mt-1" size={20} />
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Apply Database Fixes</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Run this SQL to fix Security Warnings, Permissions, and Performance Issues.
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