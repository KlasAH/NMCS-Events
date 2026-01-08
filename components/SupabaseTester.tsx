
import React, { useState, useRef } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Activity, Database, Server, AlertCircle, Copy, Check, ExternalLink, Info, ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import { motion } from 'framer-motion';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

const FIX_SQL = `
-- Run this in your Supabase SQL Editor to fix permissions
CREATE TABLE IF NOT EXISTS public.connection_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.connection_tests ENABLE ROW LEVEL SECURITY;

-- Ensure policy exists (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Public can test connection" ON public.connection_tests;

-- Allow everyone (including anonymous users) to use this table for testing
CREATE POLICY "Public can test connection" ON public.connection_tests 
FOR ALL USING (true) WITH CHECK (true);
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
    // Increased to 60000ms (60s) to handle Supabase "cold starts" on free tier
    const withTimeout = (promise: any, ms: number = 60000) => {
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
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                 // @ts-ignore
                 envUrl = import.meta.env.VITE_SUPABASE_URL || '';
            }
        } catch (e) {
            // ignore
        }
        
        if (!envUrl) {
            addLog('CRITICAL ERROR: VITE_SUPABASE_URL is missing!');
            addLog('In Coolify/Docker, env vars MUST start with "VITE_".');
            setStatus('error');
            return;
        }

        addLog(`Target: ${envUrl.replace(/https:\/\/[^.]+\./, 'https://***.')}`);
        addLog('Initiating handshake...');
        
        if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        
        // Show a helpful message if it takes longer than 3 seconds
        coldStartTimer.current = setTimeout(() => {
             addLog('...still connecting. Database might be waking up (Free Tier). This can take up to 20-30s.');
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
            // STEP 1: PING (Simple Select)
            // We use a lighter query to check connectivity first
            addLog('Step 1: Pinging database...');
            
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
                throw new Error(`Ping Failed: ${pingError.message}`);
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
            
            // Heuristic diagnostics for Frontend/Vite
            if (msg.includes('timed out') || msg.includes('Failed to fetch')) {
                addLog('------------------------------------------------');
                addLog('TIMEOUT / CONNECTION DIAGNOSIS:');
                addLog('1. Check VITE_SUPABASE_URL in Coolify Settings.');
                addLog('2. Ensure Supabase project is ACTIVE (not paused).');
                addLog('3. Check Browser Console for "Connection Refused".');
                addLog('------------------------------------------------');
            } else if (msg.includes('not found') || msg.includes('policy') || msg.includes('permission')) {
                addLog('------------------------------------------------');
                addLog('RLS / PERMISSION DIAGNOSIS:');
                addLog('The app cannot read data (Infinite Loading).');
                addLog('You need a "SELECT" policy for "anon" role.');
                addLog('Run the "Copy SQL Fix" script to test.');
                addLog('------------------------------------------------');
            }

            setStatus('error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Database Handshake Tester">
            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-300">
                    <p>Verify <strong>Read</strong> and <strong>Write</strong> permissions to the remote Supabase database.</p>
                    <p className="mt-2 text-xs text-slate-400">Note: On Supabase Free Tier, the first request after inactivity may take 10-20 seconds.</p>
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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Write Value</label>
                        <input 
                            type="text" 
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="Type a test message..."
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none"
                        />
                        <button 
                            onClick={handleTest}
                            disabled={!inputVal || status === 'writing' || status === 'reading'}
                            className="mt-3 w-full py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {status === 'writing' || status === 'reading' ? <Activity className="animate-spin" size={18} /> : <Server size={18} />}
                            {status === 'writing' ? 'Sending...' : 'Send & Verify'}
                        </button>
                    </div>

                    <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status Log</label>
                        <div className="flex-grow bg-black/90 text-green-400 p-3 rounded-xl font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse min-h-[140px]">
                            {logs.length === 0 ? <span className="opacity-50">Ready to test...</span> : logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0 break-all">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SQL Fix Section - Only shows on error or always for convenience */}
                {status === 'error' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex flex-col gap-4 animate-pulse">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                            <div>
                                <h4 className="font-bold text-red-700 dark:text-red-300 text-sm">Connection Failed</h4>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    <strong>Coolify/Docker User?</strong> Ensure your Env Vars start with <code>VITE_</code>.
                                    <br/>
                                    <strong>Infinite Loading?</strong> You might need a "SELECT" Policy for "anon" users (RLS).
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
                                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied!' : 'Copy SQL Fix'}
                            </button>
                        </div>
                    </div>
                )}
                
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl text-xs text-yellow-800 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/30 flex items-start gap-3">
                     <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                     <div>
                         <strong>Coolify Deployment Tip</strong><br/>
                         In Coolify "Environment Variables", keys MUST be <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_KEY</code>.
                         <br/>
                         If you use just <code>SUPABASE_URL</code>, the app will ignore them and fail silently.
                     </div>
                </div>
            </div>
        </Modal>
    );
};

export default SupabaseTester;
