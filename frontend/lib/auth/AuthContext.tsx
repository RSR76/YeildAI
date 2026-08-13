'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type React from 'react';

import { getStoredToken, setStoredToken } from '@/lib/api';
import * as authClient from './authClient';
import { GUEST_DEMO_FARMS } from '@/lib/guestData';
import type {
    AuthUser,
    FarmProfile,
    CreateFarmInput,
    Role,
    Persona,
} from './types';

const GUEST_STORAGE_KEY = 'agri.guestMode';

interface AuthContextValue {
    user: AuthUser | null;
    farms: FarmProfile[];
    activeFarm: FarmProfile | null;

    /** True while the initial session is being restored. */
    isLoading: boolean;

    isAuthenticated: boolean;

    /** Role helpers for Admin/Farmer UI. */
    isAdmin: boolean;
    isFarmer: boolean;

    /** True when browsing the public read-only demo. */
    isGuest: boolean;

    /** Unified persona value: ADMIN, FARMER, or GUEST. */
    persona: Persona | null;

    login: (email: string, password: string) => Promise<void>;

    signup: (
        email: string,
        password: string,
        name: string,
        role: Role
    ) => Promise<void>;

    logout: () => void;

    enterGuestMode: () => void;
    exitGuestMode: () => void;

    switchFarm: (farmId: string) => Promise<void>;

    addFarm: (input: CreateFarmInput) => Promise<FarmProfile>;

    editFarm: (
        farmId: string,
        input: Partial<CreateFarmInput>
    ) => Promise<FarmProfile>;

    removeFarm: (farmId: string) => Promise<void>;

    refreshFarms: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [farms, setFarms] = useState<FarmProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    const loadSession = useCallback(async () => {
        const token = getStoredToken();

        if (!token) {
            // No authentication token. Check whether a guest session exists.
            if (
                typeof window !== 'undefined' &&
                window.sessionStorage.getItem(GUEST_STORAGE_KEY) === '1'
            ) {
                setIsGuest(true);
                setFarms(GUEST_DEMO_FARMS);
            }

            setIsLoading(false);
            return;
        }

        try {
            const [me, farmList] = await Promise.all([
                authClient.getMe(),
                authClient.listFarms(),
            ]);

            setUser(me);
            setFarms(farmList);
            setIsGuest(false);
        } catch {
            // Token is invalid or expired.
            setStoredToken(null);
            setUser(null);
            setFarms([]);
            setIsGuest(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Restore the authentication/guest session when the provider mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadSession();
    }, [loadSession]);

    const enterGuestMode = useCallback(() => {
        // Guest and authenticated sessions are mutually exclusive.
        setStoredToken(null);
        setUser(null);
        setFarms(GUEST_DEMO_FARMS);

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(GUEST_STORAGE_KEY, '1');
        }

        setIsGuest(true);
    }, []);

    const exitGuestMode = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
        }

        setIsGuest(false);
    }, []);

    const login = useCallback(
        async (email: string, password: string) => {
            const {
                token,
                user: loggedInUser,
            } = await authClient.login({
                email,
                password,
            });

            exitGuestMode();

            setStoredToken(token);
            setUser(loggedInUser);
            setFarms(await authClient.listFarms());
        },
        [exitGuestMode]
    );

    const signup = useCallback(
        async (
            email: string,
            password: string,
            name: string,
            role: Role
        ) => {
            const {
                token,
                user: newUser,
            } = await authClient.signup({
                email,
                password,
                name,
                role,
            });

            exitGuestMode();

            setStoredToken(token);
            setUser(newUser);

            // New accounts may not have any farms yet.
            setFarms(await authClient.listFarms());
        },
        [exitGuestMode]
    );

    const logout = useCallback(() => {
        setStoredToken(null);
        setUser(null);
        setFarms([]);
        setIsGuest(false);

        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
        }
    }, []);

    const refreshFarms = useCallback(async () => {
        if (isGuest) {
            return;
        }

        setFarms(await authClient.listFarms());
    }, [isGuest]);

    const GUEST_WRITE_ERROR =
        'Sign up to save changes — guest mode is read-only.';

    const switchFarm = useCallback(
        async (farmId: string) => {
            if (isGuest) {
                throw new Error(GUEST_WRITE_ERROR);
            }

            const updated = await authClient.activateFarm(farmId);

            setFarms((prev) =>
                prev.map((farm) => ({
                    ...farm,
                    isDefault: farm.id === updated.id,
                }))
            );
        },
        [isGuest]
    );

    const addFarm = useCallback(
        async (input: CreateFarmInput) => {
            if (isGuest) {
                throw new Error(GUEST_WRITE_ERROR);
            }

            const farm = await authClient.createFarm(input);

            await refreshFarms();

            return farm;
        },
        [isGuest, refreshFarms]
    );

    const editFarm = useCallback(
        async (
            farmId: string,
            input: Partial<CreateFarmInput>
        ) => {
            if (isGuest) {
                throw new Error(GUEST_WRITE_ERROR);
            }

            const farm = await authClient.updateFarm(
                farmId,
                input
            );

            setFarms((prev) =>
                prev.map((existingFarm) =>
                    existingFarm.id === farmId
                        ? farm
                        : existingFarm
                )
            );

            return farm;
        },
        [isGuest]
    );

    const removeFarm = useCallback(
        async (farmId: string) => {
            if (isGuest) {
                throw new Error(GUEST_WRITE_ERROR);
            }

            await authClient.deleteFarm(farmId);

            await refreshFarms();
        },
        [isGuest, refreshFarms]
    );

    const activeFarm = useMemo(
        () =>
            farms.find((farm) => farm.isDefault) ??
            farms[0] ??
            null,
        [farms]
    );

    const persona: Persona | null = isGuest
        ? 'GUEST'
        : user?.role ?? null;

    const value: AuthContextValue = {
        user,
        farms,
        activeFarm,
        isLoading,

        isAuthenticated: !!user,

        isAdmin: user?.role === 'ADMIN',
        isFarmer: user?.role === 'FARMER',

        isGuest,
        persona,

        login,
        signup,
        logout,

        enterGuestMode,
        exitGuestMode,

        switchFarm,
        addFarm,
        editFarm,
        removeFarm,
        refreshFarms,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);

    if (!ctx) {
        throw new Error(
            'useAuth must be used within an AuthProvider'
        );
    }

    return ctx;
}