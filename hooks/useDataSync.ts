
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

    // Keep fetcher ref current
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
            // If cache is corrupted, clear it
            window.localStorage.removeItem(k);
            return null;
        }
    };

    // State
    const [data, setData] = useState<T | null>(() => readCache(key));
    const [isLoading, setIsLoading] = useState<boolean>(() => !readCache(key));
    const [isValidating, setIsValidating] = useState<boolean>(false);
    const [error, setError] = useState<any>(null);
    const [currentKey, setCurrentKey] = useState(key);

    // Handle Key Changes synchronously during render to avoid flash
    if (key !== currentKey) {
        setCurrentKey(key);
        const cached = readCache(key);
        setData(cached);
        setIsLoading(!cached);
        setError(null);
    }

    const sync = useCallback(async () => {
        if (!isMounted.current) return;
        
        setIsValidating(true);
        // Only set blocking loading if we have absolutely no data
        if (!data) setIsLoading(true);

        let timeoutId: ReturnType<typeof setTimeout>;

        try {
            // Create a timeout promise to prevent hanging forever
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error("Network timeout (10s)"));
                }, 10000);
            });

            // Race the fetcher against the timeout
            const freshData = await Promise.race([
                fetcherRef.current(),
                timeoutPromise
            ]);
            
            if (isMounted.current) {
                if (freshData !== null) {
                    try {
                        const freshStr = JSON.stringify(freshData);
                        const currentStr = localStorage.getItem(key);

                        if (freshStr !== currentStr) {
                            localStorage.setItem(key, freshStr);
                            setData(freshData);
                        }
                    } catch (serializationError) {
                        console.error("Failed to serialize data for cache:", serializationError);
                        // Still update state even if cache fails
                        setData(freshData);
                    }
                }
            }
        } catch (err: any) {
            if (isMounted.current) {
                console.error(`[DataSync] Error syncing ${key}:`, err);
                setError(err);
                
                // If we have an error and no data, we must stop loading so the UI can show the error
                if (!data) {
                    setIsLoading(false);
                }
            }
        } finally {
            // @ts-ignore
            if (timeoutId) clearTimeout(timeoutId);
            
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, key, sync]);

    return { data, isLoading, isValidating, error, refresh: sync };
}
