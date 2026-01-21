
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';

interface UseDataSyncResult<T> {
    data: T | null;
    isLoading: boolean;     // True ONLY if no data exists and we are fetching
    isValidating: boolean;  // True whenever we are fetching (background or foreground)
    error: any;
    refresh: () => Promise<void>;
}

export function useDataSync<T>(
    key: string,
    tableName: string | null, // Allow null to skip subscription
    fetcher: () => Promise<T | null>,
    dependencies: any[] = []
): UseDataSyncResult<T> {
    const isMounted = useRef(true);
    const fetcherRef = useRef(fetcher);

    // Keep fetcher ref current to avoid effect re-runs just because function identity changed
    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    // Helper to read cache safely
    const readCache = (k: string): T | null => {
        if (typeof window === 'undefined') return null;
        try {
            const item = window.localStorage.getItem(k);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.warn(`Error reading localStorage key "${k}":`, error);
            return null;
        }
    };

    // State
    const [data, setData] = useState<T | null>(() => readCache(key));
    const [isLoading, setIsLoading] = useState<boolean>(() => !readCache(key));
    const [isValidating, setIsValidating] = useState<boolean>(false);
    const [error, setError] = useState<any>(null);
    const [currentKey, setCurrentKey] = useState(key);

    // Handle Key Changes (e.g. User ID updates)
    // This pattern allows us to reset state *during* render if key changes, avoiding a flash of old content
    if (key !== currentKey) {
        setCurrentKey(key);
        const cached = readCache(key);
        setData(cached);
        setIsLoading(!cached);
        // Error is reset on key change
        setError(null);
    }

    const sync = useCallback(async () => {
        if (!isMounted.current) return;
        
        setIsValidating(true);
        // If we have no data, we are also "loading"
        if (!data) setIsLoading(true);

        try {
            const freshData = await fetcherRef.current();
            
            if (isMounted.current) {
                // If the fetcher returns null (e.g. no user ID yet), we shouldn't wipe cache unless necessary.
                // But generally if fetcher returns, we trust it.
                
                if (freshData !== null) {
                    const freshStr = JSON.stringify(freshData);
                    const currentStr = localStorage.getItem(key);

                    // Only update state/storage if different
                    if (freshStr !== currentStr) {
                        localStorage.setItem(key, freshStr);
                        setData(freshData);
                    }
                }
            }
        } catch (err) {
            if (isMounted.current) {
                console.error(`[DataSync] Error syncing ${key}`, err);
                setError(err);
            }
        } finally {
            if (isMounted.current) {
                setIsValidating(false);
                setIsLoading(false);
            }
        }
    }, [key, data]); // eslint-disable-line react-hooks/exhaustive-deps

    // 1. Initial Load & Network Sync
    useEffect(() => {
        isMounted.current = true;
        sync();
        return () => { isMounted.current = false; };
    }, [sync]);

    // 2. Realtime Subscription
    useEffect(() => {
        if (isDemoMode || !tableName) return;

        const channel = supabase
            .channel(`public:${tableName}:${key}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: tableName },
                (payload) => {
                    console.log(`[DataSync] Realtime update: ${tableName}`, payload);
                    sync();
                }
            )
            .subscribe((status) => {
                 if(status === 'SUBSCRIBED') {
                     // Optional: log subscription success
                 }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, key, sync]);

    return { data, isLoading, isValidating, error, refresh: sync };
}
