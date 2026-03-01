import { useState, useEffect, useCallback } from 'react';

export function useLocalPersistence<T>(key: string, defaultValue: T): [T, (val: T | ((curr: T) => T)) => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : defaultValue;
        } catch (e) {
            console.warn(`Error reading localStorage key "${key}":`, e);
            return defaultValue;
        }
    });

    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(state) : value;
            setState(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (e) {
            console.warn(`Error setting localStorage key "${key}":`, e);
        }
    }, [key, state]);

    // Sync if another tab modifies the value
    useEffect(() => {
        const onStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    setState(JSON.parse(e.newValue) as T);
                } catch (err) {
                    // ignore JSON parse error in other tab
                }
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', onStorageChange);
            return () => window.removeEventListener('storage', onStorageChange);
        }
    }, [key]);

    return [state, setValue];
}
