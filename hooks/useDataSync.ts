
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';

interface UseDataSyncResult<T> {
    data: T | null;
    loading: boolean;
    error: any;
    refresh: () => Promise<void>;
}

export function useDataSync<T>(
    key: string,
    tableName: string,
    fetcher: () => Promise<T | null>,
    dependencies: any[] = []
): UseDataSyncResult<T> {
    // Initialize state from LocalStorage if available to ensure instant load
    const [data, setData] = useState<T | null>(() => {
        try {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.warn('Error reading from localStorage', e);
            return null;
        }
    });
    
    // If we have data from cache, we aren't "loading" in the UI sense, 
    // but we are syncing in the background.
    const [loading, setLoading] = useState<boolean>(!data);
    const [error, setError] = useState<any>(null);
    const isMounted = useRef(true);

    // The core sync function
    const sync = useCallback(async () => {
        if (!isMounted.current) return;
        
        try {
            const networkData = await fetcher();
            
            if (isMounted.current) {
                // Deep comparison via stringify (sufficient for this app size)
                const prevString = localStorage.getItem(key);
                const newString = JSON.stringify(networkData);

                if (prevString !== newString) {
                    console.log(`[DataSync] Update detected for ${key}, syncing...`);
                    localStorage.setItem(key, newString);
                    setData(networkData);
                }
                setLoading(false);
            }
        } catch (err) {
            if (isMounted.current) {
                console.error(`[DataSync] Error syncing ${key}`, err);
                setError(err);
                setLoading(false);
            }
        }
    }, [key, ...dependencies]); // eslint-disable-line react-hooks/exhaustive-deps

    // 1. Initial Load & Network Sync
    useEffect(() => {
        isMounted.current = true;
        sync();

        return () => {
            isMounted.current = false;
        };
    }, [sync]);

    // 2. Realtime Subscription (Only if not in Demo Mode)
    useEffect(() => {
        if (isDemoMode) return;
        if (!tableName) return;

        const channel = supabase
            .channel(`public:${tableName}:${key}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: tableName },
                (payload) => {
                    console.log(`[DataSync] Realtime change detected in ${tableName}`, payload);
                    sync(); // Trigger re-fetch on DB change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, key, sync]);

    return { data, loading, error, refresh: sync };
}
