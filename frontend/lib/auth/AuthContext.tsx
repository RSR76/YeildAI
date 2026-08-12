'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type React from 'react';

import { getStoredToken, setStoredToken } from '@/lib/api';
import * as authClient from './authClient';
import type { AuthUser, FarmProfile, CreateFarmInput } from './types';

interface AuthContextValue {
    user: AuthUser | null;
    farms: FarmProfile[];
    activeFarm: FarmProfile | null;
    /** True while the initial session (token -> user/farms) is being restored. */
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    switchFarm: (farmId: string) => Promise<void>;
    addFarm: (input: CreateFarmInput) => Promise<FarmProfile>;
    editFarm: (farmId: string, input: Partial<CreateFarmInput>) => Promise<FarmProfile>;
    removeFarm: (farmId: string) => Promise<void>;
    refreshFarms: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [farms, setFarms] = useState<FarmProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadSession = useCallback(async () => {
        const token = getStoredToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const [me, farmList] = await Promise.all([authClient.getMe(), authClient.listFarms()]);
            setUser(me);
            setFarms(farmList);
        } catch {
            // Token invalid/expired — clear it and fall back to logged-out state.
            setStoredToken(null);
            setUser(null);
            setFarms([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Restoring the session (token -> user/farms) on mount is the standard,
        // necessary pattern here — there's no non-effect alternative for
        // checking auth state on load. All setState calls inside loadSession
        // happen after an awaited network call, not synchronously.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadSession();
    }, [loadSession]);

    const login = useCallback(async (email: string, password: string) => {
        const { token, user: loggedInUser } = await authClient.login({ email, password });
        setStoredToken(token);
        setUser(loggedInUser);
        setFarms(await authClient.listFarms());
    }, []);

    const signup = useCallback(async (email: string, password: string, name: string) => {
        const { token, user: newUser } = await authClient.signup({ email, password, name });
        setStoredToken(token);
        setUser(newUser);
        setFarms(await authClient.listFarms());
    }, []);

    const logout = useCallback(() => {
        setStoredToken(null);
        setUser(null);
        setFarms([]);
    }, []);

    const refreshFarms = useCallback(async () => {
        setFarms(await authClient.listFarms());
    }, []);

    const switchFarm = useCallback(async (farmId: string) => {
        const updated = await authClient.activateFarm(farmId);
        setFarms((prev) => prev.map((f) => ({ ...f, isDefault: f.id === updated.id })));
    }, []);

    const addFarm = useCallback(async (input: CreateFarmInput) => {
        const farm = await authClient.createFarm(input);
        await refreshFarms();
        return farm;
    }, [refreshFarms]);

    const editFarm = useCallback(async (farmId: string, input: Partial<CreateFarmInput>) => {
        const farm = await authClient.updateFarm(farmId, input);
        setFarms((prev) => prev.map((f) => (f.id === farmId ? farm : f)));
        return farm;
    }, []);

    const removeFarm = useCallback(async (farmId: string) => {
        await authClient.deleteFarm(farmId);
        await refreshFarms();
    }, [refreshFarms]);

    const activeFarm = useMemo(() => farms.find((f) => f.isDefault) ?? farms[0] ?? null, [farms]);

    const value: AuthContextValue = {
        user,
        farms,
        activeFarm,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        switchFarm,
        addFarm,
        editFarm,
        removeFarm,
        refreshFarms,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}