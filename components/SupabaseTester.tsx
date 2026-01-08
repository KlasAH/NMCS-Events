
import React, { useState, useRef, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Activity, Database, Server, AlertCircle, Copy, Check, ExternalLink, ShieldAlert, Trash2, Edit2, Save, X, RefreshCw, Plus } from 'lucide-react';
import Modal from './Modal';
import { motion, AnimatePresence } from 'framer-motion';

interface SupabaseTesterProps {
    isOpen: boolean;
    onClose: () => void;
}

interface TestRow {
    id: string;
    message: string;
    response_data: string;
    created_at: string;
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

-- Allow everyone (including anonymous users) to use this table for testing (ALL = Select, Insert, Update, Delete)
CREATE POLICY "Public can test connection" ON public.connection_tests 
FOR ALL USING (true) WITH CHECK (true);
`;

const SupabaseTester: React.FC<SupabaseTesterProps> = ({ isOpen, onClose }) => {
    // Input States
    const [msgInput, setMsgInput] = useState('');
    const [tagInput, setTagInput] = useState(''); // Second field
    
    // Data States
    const [rows, setRows] = useState<TestRow[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    
    // Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editMsg, setEditMsg] = useState('');
    const [editTag, setEditTag] = useState('');

    const coldStartTimer = useRef<any>(null);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const checkEnv = () => {
        let envUrl = '';
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                 // @ts-ignore
                 envUrl = import.meta.env.VITE_SUPABASE_URL || '';
            }
        } catch (e) {}
        
        if (!envUrl) {
            addLog('CRITICAL: VITE_SUPABASE_URL is missing!');
            setStatus('error');
            return false;
        }
        return true;
    };

    // --- CRUD OPERATIONS ---

    const fetchRows = async () => {
        if (!checkEnv()) return;
        
        if (isDemoMode) {
             setRows([
                 { id: 'demo-1', message: 'Hello World', response_data: 'Demo Tag 1', created_at: new Date().toISOString() },
                 { id: 'demo-2', message: 'Testing 123', response_data: 'Demo Tag 2', created_at: new Date().toISOString() }
             ]);
             return;
        }

        const { data, error } = await supabase
            .from('connection_tests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            addLog(`Fetch Error: ${error.message}`);
            if (error.code === '42P01') setStatus('error'); // Table missing
        } else {
            setRows(data || []);
            // addLog('Refreshed list.');
        }
    };

    const handleCreate = async () => {
        if (!msgInput || !checkEnv()) return;
        setStatus('loading');
        
        // Cold start warning
        if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        coldStartTimer.current = setTimeout(() => {
             addLog('...database waking up (Free Tier). Please wait...');
        }, 3000);

        if (isDemoMode) {
            setTimeout(() => {
                addLog('Demo: Created row');
                setRows([{id: Date.now().toString(), message: msgInput, response_data: tagInput || 'N/A', created_at: new Date().toISOString()}, ...rows]);
                setStatus('success');
                setMsgInput('');
                setTagInput('');
                clearTimeout(coldStartTimer.current);
            }, 500);
            return;
        }

        try {
            const { data, error } = await supabase.from('connection_tests').insert([{
                message: msgInput,
                response_data: tagInput || 'Auto-generated tag'
            }]).select().single();

            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);

            if (error) throw error;

            addLog(`Created ID: ${data.id.slice(0, 8)}...`);
            setMsgInput('');
            setTagInput('');
            setStatus('success');
            fetchRows();
        } catch (err: any) {
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            addLog(`Create Failed: ${err.message}`);
            setStatus('error');
        }
    };

    const handleDelete = async (id: string) => {
        if(isDemoMode) {
            setRows(rows.filter(r => r.id !== id));
            addLog('Demo: Deleted row');
            return;
        }

        addLog(`Deleting ${id.slice(0,8)}...`);
        const { error } = await supabase.from('connection_tests').delete().eq('id', id);
        
        if (error) {
            addLog(`Delete Failed: ${error.message}`);
        } else {
            addLog('Deleted successfully.');
            fetchRows();
        }
    };

    const startEdit = (row: TestRow) => {
        setEditingId(row.id);
        setEditMsg(row.message);
        setEditTag(row.response_data || '');
    };

    const handleUpdate = async (id: string) => {
        if(isDemoMode) {
            setRows(rows.map(r => r.id === id ? {...r, message: editMsg, response_data: editTag} : r));
            setEditingId(null);
            addLog('Demo: Updated row');
            return;
        }

        const { error } = await supabase
            .from('connection_tests')
            .update({ message: editMsg, response_data: editTag })
            .eq('id', id);

        if (error) {
            addLog(`Update Failed: ${error.message}`);
        } else {
            addLog(`Updated ${id.slice(0,8)}`);
            setEditingId(null);
            fetchRows();
        }
    };

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            fetchRows();
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Database Handshake & CRUD Tester">
            <div className="space-y-6">
                
                {/* Intro */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-300 flex items-start gap-3">
                    <Database className="shrink-0 text-mini-red mt-1" size={20} />
                    <div>
                        <p>Test full <strong>Create, Read, Update, Delete</strong> permissions.</p>
                        <p className="mt-1 text-xs opacity-70">If rows don't appear, run the SQL Fix below to ensure the policy allows 'ALL' operations.</p>
                    </div>
                </div>

                {/* 1. CREATE SECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add New Record</label>
                            {status === 'loading' && <Activity className="animate-spin text-mini-red" size={14} />}
                        </div>
                        
                        <div className="space-y-2">
                            <input 
                                type="text" 
                                value={msgInput}
                                onChange={(e) => setMsgInput(e.target.value)}
                                placeholder="Field 1: Message (e.g. Hello)"
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none text-sm"
                            />
                            <input 
                                type="text" 
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                placeholder="Field 2: Tag (e.g. Test A)"
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none text-sm"
                            />
                        </div>

                        <button 
                            onClick={handleCreate}
                            disabled={!msgInput || status === 'loading'}
                            className="w-full py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            {status === 'loading' ? 'Saving...' : 'Add Record'}
                        </button>
                    </div>

                    {/* LOGS */}
                    <div className="flex flex-col h-full min-h-[160px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Activity Log</label>
                        <div className="flex-grow bg-black/90 text-green-400 p-3 rounded-xl font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse h-full max-h-[200px]">
                            {logs.length === 0 ? <span className="opacity-50">Waiting for action...</span> : logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0 break-all">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. READ/UPDATE/DELETE SECTION */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Database Records (Last 5)</label>
                        <button onClick={fetchRows} className="text-mini-red hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded transition-colors" title="Refresh">
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        {rows.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 dark:bg-slate-800/50">
                                {status === 'error' ? 'Connection Error or Table Missing.' : 'No records found. Add one above.'}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rows.map((row) => (
                                    <motion.div 
                                        layout
                                        key={row.id} 
                                        className="p-3 bg-white dark:bg-slate-900 flex items-center gap-3"
                                    >
                                        {editingId === row.id ? (
                                            /* EDIT MODE */
                                            <div className="flex-grow grid grid-cols-2 gap-2">
                                                <input 
                                                    value={editMsg} 
                                                    onChange={(e) => setEditMsg(e.target.value)}
                                                    className="p-2 text-sm border rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-mini-red"
                                                />
                                                <input 
                                                    value={editTag} 
                                                    onChange={(e) => setEditTag(e.target.value)}
                                                    className="p-2 text-sm border rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-mini-red"
                                                />
                                            </div>
                                        ) : (
                                            /* VIEW MODE */
                                            <div className="flex-grow grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Message</span>
                                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.message}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Tag</span>
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">{row.response_data}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1">
                                            {editingId === row.id ? (
                                                <>
                                                    <button onClick={() => handleUpdate(row.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(row)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SQL Helper */}
                {status === 'error' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                            <div>
                                <h4 className="font-bold text-red-700 dark:text-red-300 text-sm">Permissions Error</h4>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    The app cannot Read/Write. Run this SQL to enable access for testing.
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
                     </div>
                </div>
            </div>
        </Modal>
    );
};

export default SupabaseTester;
