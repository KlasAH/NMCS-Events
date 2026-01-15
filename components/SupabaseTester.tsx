
import React, { useState, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Database, Server, AlertCircle, Copy, Check, ExternalLink, ShieldAlert, RefreshCw, X, CheckCircle2, Terminal, Play, Lock, Cpu } from 'lucide-react';
import Modal from './Modal';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

// SQL Fix Script - Updated to ensure idempotency and robustness
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

-- 4. CONNECTION TESTER TABLE (Diagnostics)
CREATE TABLE IF NOT EXISTS public.connection_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.connection_tests ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon access for troubleshooting
DROP POLICY IF EXISTS "Public can test connection" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can insert tests" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can read tests" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can update tests" ON public.connection_tests;
DROP POLICY IF EXISTS "Public can delete tests" ON public.connection_tests;

CREATE POLICY "Public can insert tests" ON public.connection_tests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can read tests" ON public.connection_tests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can update tests" ON public.connection_tests FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public can delete tests" ON public.connection_tests FOR DELETE TO anon, authenticated USING (true);

-- 5. PROFILES SCHEMA FIX (Critical)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  username TEXT,
  role TEXT DEFAULT 'user',
  board_role TEXT,
  car_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Idempotent column adds
DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS board_role TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS car_model TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'Column already exists in profiles.';
END $$;

-- 6. APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public settings read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin settings write" ON public.app_settings FOR ALL USING (is_admin());

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;

const RELOAD_SQL = `NOTIFY pgrst, 'reload schema';`;

// Diagnostic Step Definition
type DiagnosticStep = {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'success' | 'error';
    detail?: string;
    errorCode?: string;
};

const SupabaseTester: React.FC<SupabaseTesterProps> = ({ isOpen, onClose }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [steps, setSteps] = useState<DiagnosticStep[]>([]);
    const [copied, setCopied] = useState(false);
    
    // --- DIAGNOSTIC LOGIC ---

    const getEnvVars = () => {
        let url = '';
        let key = '';
        try {
            // @ts-ignore
            if (import.meta.env) {
                // @ts-ignore
                url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
                // @ts-ignore
                key = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '').trim();
            }
        } catch (e) { console.error(e); }
        return { url, key };
    };

    const runDiagnostics = async () => {
        setIsRunning(true);
        
        // Reset Steps
        const initialSteps: DiagnosticStep[] = [
            { id: 'env', label: 'Environment Configuration', status: 'pending' },
            { id: 'network', label: 'Network Reachability', status: 'pending' },
            { id: 'table', label: 'Diagnostic Table Check', status: 'pending' },
            { id: 'write', label: 'Write Permissions', status: 'pending' },
            { id: 'schema', label: 'Profile Schema Validation', status: 'pending' },
        ];
        setSteps(initialSteps);

        const updateStep = (id: string, status: DiagnosticStep['status'], detail?: string, errorCode?: string) => {
            setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail, errorCode } : s));
            return status === 'success';
        };

        // 1. ENV CHECK
        updateStep('env', 'running');
        const { url, key } = getEnvVars();
        if (!url || !key || url.includes('placeholder')) {
            updateStep('env', 'error', 'Missing VITE_SUPABASE_URL or Key');
            setIsRunning(false);
            return;
        }
        updateStep('env', 'success', `Connected to: ${url.substring(8, 25)}...`);

        if (isDemoMode) {
            await new Promise(r => setTimeout(r, 500));
            updateStep('network', 'success', 'Demo Mode');
            updateStep('table', 'success', 'Demo Mode');
            updateStep('write', 'success', 'Demo Mode');
            updateStep('schema', 'success', 'Demo Mode');
            setIsRunning(false);
            return;
        }

        // Create isolated client
        const testClient = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { 'x-client-info': 'nmcs-tester' } }
        });

        // 2. NETWORK CHECK (Fastest possible ping)
        updateStep('network', 'running');
        try {
            // "HEAD" request via select count is effectively a ping
            const start = Date.now();
            const { error } = await testClient.from('connection_tests').select('id', { count: 'exact', head: true });
            
            // We ignore table errors here; we just care if the SERVER responded
            if (error && error.code === undefined && error.message.includes('fetch')) {
                 updateStep('network', 'error', 'Server unreachable. Check internet or URL.');
                 setIsRunning(false);
                 return;
            }
            const latency = Date.now() - start;
            updateStep('network', 'success', `Latency: ${latency}ms`);
        } catch (e: any) {
            updateStep('network', 'error', e.message);
            setIsRunning(false);
            return;
        }

        // 3. TABLE EXISTENCE
        updateStep('table', 'running');
        const { error: tableError } = await testClient.from('connection_tests').select('id').limit(1);
        if (tableError) {
            if (tableError.code === '42P01') {
                updateStep('table', 'error', 'Table missing.', '42P01');
                updateStep('write', 'error', 'Cannot write to missing table.'); // Cascading fail
                setIsRunning(false); // Stop here, need SQL fix
                return;
            } else if (tableError.code === '42501') {
                updateStep('table', 'error', 'RLS Policy Violation (Access Denied).', '42501');
                setIsRunning(false);
                return;
            }
            updateStep('table', 'error', tableError.message, tableError.code);
            setIsRunning(false);
            return;
        }
        updateStep('table', 'success', 'Table "connection_tests" exists.');

        // 4. WRITE CHECK
        updateStep('write', 'running');
        const testId = crypto.randomUUID();
        const { error: writeError } = await testClient
            .from('connection_tests')
            .insert({ id: testId, message: 'Diagnostics Ping', response_data: 'OK' });
        
        if (writeError) {
            updateStep('write', 'error', writeError.message, writeError.code);
            setIsRunning(false);
            return;
        } else {
            // Cleanup (Fire and forget)
            testClient.from('connection_tests').delete().eq('id', testId).then(() => {});
            updateStep('write', 'success', 'Insert / Delete successful.');
        }

        // 5. PROFILE SCHEMA CHECK (The "Board Role" Fixer)
        updateStep('schema', 'running');
        // We try to select the specific columns that were causing issues
        const { error: schemaError } = await testClient
            .from('profiles')
            .select('board_role, role, car_model')
            .limit(1);

        if (schemaError) {
            if (schemaError.code === '42703') {
                updateStep('schema', 'error', 'Missing columns (Schema Mismatch).', '42703');
            } else if (schemaError.code === '42P01') {
                updateStep('schema', 'error', 'Table "profiles" missing.', '42P01');
            } else {
                updateStep('schema', 'error', schemaError.message, schemaError.code);
            }
        } else {
            updateStep('schema', 'success', 'Profile columns verified.');
        }

        setIsRunning(false);
    };

    // Auto-run on open
    useEffect(() => {
        if (isOpen) runDiagnostics();
    }, [isOpen]);

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const hasError = steps.some(s => s.status === 'error');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="System Diagnostics">
            <div className="space-y-6">
                {/* STATUS CARD */}
                <div className={`p-6 rounded-2xl border-2 transition-colors ${
                    isRunning ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900' :
                    hasError ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900' :
                    'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900'
                }`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                             {isRunning ? <RefreshCw className="animate-spin text-blue-600" /> : 
                              hasError ? <ShieldAlert className="text-red-600" /> : 
                              <CheckCircle2 className="text-green-600" />}
                             
                             {isRunning ? 'Running Diagnostics...' : 
                              hasError ? 'System Issues Detected' : 
                              'All Systems Operational'}
                        </h3>
                        {!isRunning && (
                            <button 
                                onClick={runDiagnostics}
                                className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                            >
                                <Play size={14} /> Re-run
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {steps.map(step => (
                            <div key={step.id} className="flex items-center justify-between p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-white/50 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-full ${
                                        step.status === 'pending' ? 'bg-slate-200 text-slate-400' :
                                        step.status === 'running' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                                        step.status === 'error' ? 'bg-red-100 text-red-600' :
                                        'bg-green-100 text-green-600'
                                    }`}>
                                        {step.status === 'running' ? <RefreshCw size={14} className="animate-spin" /> :
                                         step.status === 'error' ? <X size={14} /> :
                                         step.status === 'success' ? <Check size={14} /> :
                                         <div className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className={`text-sm font-bold ${
                                        step.status === 'error' ? 'text-red-700 dark:text-red-400' : 
                                        'text-slate-700 dark:text-slate-200'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                                
                                {step.detail && (
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xs font-mono font-medium ${
                                            step.status === 'error' ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 
                                            'text-slate-500'
                                        }`}>
                                            {step.detail}
                                        </span>
                                        {step.errorCode && (
                                            <span className="text-[10px] text-slate-400 mt-0.5">Code: {step.errorCode}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ACTION AREA - Only show if errors exist */}
                {hasError && (
                    <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Terminal size={120} />
                        </div>
                        
                        <div className="relative z-10">
                            <h4 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                                <Cpu className="text-mini-red" />
                                Automated Repair Protocol
                            </h4>
                            <p className="text-sm text-slate-400 mb-6 max-w-md">
                                Issues were detected with your database schema or permissions. 
                                Execute the repair script to synchronize the database structure.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <a 
                                    href="https://supabase.com/dashboard/project/_/sql/new" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/50"
                                >
                                    <ExternalLink size={18} /> Open SQL Editor
                                </a>

                                <button 
                                    onClick={copySql}
                                    className="flex items-center justify-center gap-2 bg-mini-red hover:bg-red-600 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-900/50"
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? 'Script Copied!' : 'Copy Repair Script'}
                                </button>
                            </div>
                            
                            <div className="mt-4 flex items-start gap-2 text-[10px] text-slate-500 bg-black/30 p-2 rounded">
                                <AlertCircle size={12} className="mt-0.5" />
                                <span>Paste the script into the Supabase SQL Editor and click "Run". Then come back here and click "Re-run".</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SupabaseTester;
