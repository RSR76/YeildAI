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
const GUEST_FARMS_KEY = 'agri.guestFarms';

interface AuthContextValue {
    user: AuthUser | null;
    farms: FarmProfile[];
    activeFarm: FarmProfile | null;

    isLoading: boolean;
    isAuthenticated: boolean;

    isAdmin: boolean;
    isFarmer: boolean;

    isGuest: boolean;
    persona: Persona | null;

    login: (
        email: string,
        password: string
    ) => Promise<void>;

    signup: (
        email: string,
        password: string,
        name: string,
        role: Role
    ) => Promise<void>;

    logout: () => void;

    enterGuestMode: () => void;
    exitGuestMode: () => void;

    switchFarm: (
        farmId: string
    ) => Promise<void>;

    addFarm: (
        input: CreateFarmInput
    ) => Promise<FarmProfile>;

    editFarm: (
        farmId: string,
        input: Partial<CreateFarmInput>
    ) => Promise<FarmProfile>;

    removeFarm: (
        farmId: string
    ) => Promise<void>;

    refreshFarms: () => Promise<void>;
}

const AuthContext =
    createContext<AuthContextValue | undefined>(
        undefined
    );

export function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] =
        useState<AuthUser | null>(null);

    const [farms, setFarms] =
        useState<FarmProfile[]>([]);

    const [isLoading, setIsLoading] =
        useState(true);

    const [isGuest, setIsGuest] =
        useState(false);

    /*
     * Restore the guest farms saved in sessionStorage.
     *
     * This means:
     * - demo farm survives page navigation
     * - guest-created farms survive refreshes
     * - nothing is written to PostgreSQL
     */
    const getStoredGuestFarms =
        useCallback((): FarmProfile[] => {
            if (typeof window === 'undefined') {
                return GUEST_DEMO_FARMS;
            }

            const stored =
                window.sessionStorage.getItem(
                    GUEST_FARMS_KEY
                );

            if (!stored) {
                return GUEST_DEMO_FARMS;
            }

            try {
                const parsed =
                    JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // Ignore invalid session data.
            }

            return GUEST_DEMO_FARMS;
        }, []);

    const saveGuestFarms = useCallback(
        (nextFarms: FarmProfile[]) => {
            if (
                typeof window !== 'undefined'
            ) {
                window.sessionStorage.setItem(
                    GUEST_FARMS_KEY,
                    JSON.stringify(nextFarms)
                );
            }

            setFarms(nextFarms);
        },
        []
    );

    const loadSession =
        useCallback(async () => {
            const token = getStoredToken();

            if (!token) {
                if (
                    typeof window !==
                    'undefined' &&
                    window.sessionStorage.getItem(
                        GUEST_STORAGE_KEY
                    ) === '1'
                ) {
                    setIsGuest(true);

                    setFarms(
                        getStoredGuestFarms()
                    );
                }

                setIsLoading(false);
                return;
            }

            try {
                const [
                    me,
                    farmList,
                ] = await Promise.all([
                    authClient.getMe(),
                    authClient.listFarms(),
                ]);

                setUser(me);
                setFarms(farmList);
                setIsGuest(false);
            } catch {
                setStoredToken(null);
                setUser(null);
                setFarms([]);
                setIsGuest(false);
            } finally {
                setIsLoading(false);
            }
        }, [getStoredGuestFarms]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadSession();
    }, [loadSession]);

    /*
     * ENTER GUEST MODE
     */
    const enterGuestMode =
        useCallback(() => {
            setStoredToken(null);
            setUser(null);

            const guestFarms =
                getStoredGuestFarms();

            setFarms(guestFarms);

            if (
                typeof window !== 'undefined'
            ) {
                window.sessionStorage.setItem(
                    GUEST_STORAGE_KEY,
                    '1'
                );
            }

            setIsGuest(true);
        }, [getStoredGuestFarms]);

    /*
     * EXIT GUEST MODE
     */
    const exitGuestMode =
        useCallback(() => {
            if (
                typeof window !== 'undefined'
            ) {
                window.sessionStorage.removeItem(
                    GUEST_STORAGE_KEY
                );

                window.sessionStorage.removeItem(
                    GUEST_FARMS_KEY
                );
            }

            setIsGuest(false);
        }, []);

    /*
     * LOGIN
     */
    const login = useCallback(
        async (
            email: string,
            password: string
        ) => {
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

            setFarms(
                await authClient.listFarms()
            );
        },
        [exitGuestMode]
    );

    /*
     * SIGNUP
     */
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

            setFarms(
                await authClient.listFarms()
            );
        },
        [exitGuestMode]
    );

    /*
     * LOGOUT
     */
    const logout = useCallback(() => {
        setStoredToken(null);
        setUser(null);
        setFarms([]);
        setIsGuest(false);

        if (
            typeof window !== 'undefined'
        ) {
            window.sessionStorage.removeItem(
                GUEST_STORAGE_KEY
            );

            window.sessionStorage.removeItem(
                GUEST_FARMS_KEY
            );
        }
    }, []);

    /*
     * REFRESH FARMS
     */
    const refreshFarms =
        useCallback(async () => {
            if (isGuest) {
                setFarms(
                    getStoredGuestFarms()
                );

                return;
            }

            setFarms(
                await authClient.listFarms()
            );
        }, [
            isGuest,
            getStoredGuestFarms,
        ]);

    /*
     * SWITCH FARM
     */
    const switchFarm =
        useCallback(
            async (farmId: string) => {
                /*
                 * Guest farm switching happens locally.
                 */
                if (isGuest) {
                    const currentFarms =
                        getStoredGuestFarms();

                    const updated =
                        currentFarms.map(
                            (farm) => ({
                                ...farm,
                                isDefault:
                                    farm.id ===
                                    farmId,
                            })
                        );

                    saveGuestFarms(
                        updated
                    );

                    return;
                }

                /*
                 * Authenticated users use backend.
                 */
                const updated =
                    await authClient.activateFarm(
                        farmId
                    );

                setFarms((prev) =>
                    prev.map(
                        (farm) => ({
                            ...farm,
                            isDefault:
                                farm.id ===
                                updated.id,
                        })
                    )
                );
            },
            [
                isGuest,
                getStoredGuestFarms,
                saveGuestFarms,
            ]
        );

    /*
     * ADD FARM
     */
    const addFarm =
        useCallback(
            async (
                input: CreateFarmInput
            ): Promise<FarmProfile> => {
                /*
                 * GUEST:
                 * Create a local farm.
                 */
                if (isGuest) {
                    const newFarm: FarmProfile = {
                      ...GUEST_DEMO_FARMS[0],
                      id: `guest-farm-${Date.now()}`,
                      name: input.name,
                      location: input.location,
                      address: input.address ?? '',
                      latitude: input.latitude,
                      longitude: input.longitude,
                      state: input.state,
                      district: input.district,
                      pincode: input.pincode,
                      sizeAcres: input.sizeAcres,
                      soilType: input.soilType ?? 'Black soil',
                      crops: input.crops ?? [],
                      irrigation: input.irrigation ?? 'Drip',
                      isDefault: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                  
                    setFarms([newFarm]);
                  
                    return newFarm;
                  }

                /*
                 * AUTHENTICATED:
                 * Use backend as before.
                 */
                const farm =
                    await authClient.createFarm(
                        input
                    );

                await refreshFarms();

                return farm;
            },
            [
                isGuest,
                getStoredGuestFarms,
                saveGuestFarms,
                refreshFarms,
            ]
        );

    /*
     * EDIT FARM
     */
    const editFarm =
        useCallback(
            async (
                farmId: string,
                input: Partial<CreateFarmInput>
            ): Promise<FarmProfile> => {
                /*
                 * GUEST:
                 * Update local farm.
                 */
                if (isGuest) {
                    const currentFarms =
                        getStoredGuestFarms();

                    const existing =
                        currentFarms.find(
                            (farm) =>
                                farm.id ===
                                farmId
                        );

                    if (!existing) {
                        throw new Error(
                            'Farm not found.'
                        );
                    }

                    const updatedFarm: FarmProfile =
                        {
                            ...existing,
                            ...input,
                            updatedAt:
                                new Date().toISOString(),
                        };

                    const updatedFarms =
                        currentFarms.map(
                            (farm) =>
                                farm.id ===
                                farmId
                                    ? updatedFarm
                                    : farm
                        );

                    saveGuestFarms(
                        updatedFarms
                    );

                    return updatedFarm;
                }

                /*
                 * AUTHENTICATED:
                 * Use backend.
                 */
                const farm =
                    await authClient.updateFarm(
                        farmId,
                        input
                    );

                setFarms((prev) =>
                    prev.map(
                        (existingFarm) =>
                            existingFarm.id ===
                            farmId
                                ? farm
                                : existingFarm
                    )
                );

                return farm;
            },
            [
                isGuest,
                getStoredGuestFarms,
                saveGuestFarms,
            ]
        );

    /*
     * REMOVE FARM
     */
    const removeFarm =
        useCallback(
            async (farmId: string) => {
                /*
                 * GUEST:
                 * Remove locally.
                 */
                if (isGuest) {
                    const currentFarms =
                        getStoredGuestFarms();

                    const remaining =
                        currentFarms.filter(
                            (farm) =>
                                farm.id !==
                                farmId
                        );

                    /*
                     * If the active farm was
                     * removed, make the first
                     * remaining farm active.
                     */
                    if (
                        remaining.length >
                            0 &&
                        !remaining.some(
                            (farm) =>
                                farm.isDefault
                        )
                    ) {
                        remaining[0].isDefault =
                            true;
                    }

                    saveGuestFarms(
                        remaining
                    );

                    return;
                }

                /*
                 * AUTHENTICATED:
                 * Use backend.
                 */
                await authClient.deleteFarm(
                    farmId
                );

                await refreshFarms();
            },
            [
                isGuest,
                getStoredGuestFarms,
                saveGuestFarms,
                refreshFarms,
            ]
        );

    /*
     * ACTIVE FARM
     */
    const activeFarm =
        useMemo(
            () =>
                farms.find(
                    (farm) =>
                        farm.isDefault
                ) ??
                farms[0] ??
                null,
            [farms]
        );

    /*
     * PERSONA
     */
    const persona: Persona | null =
        isGuest
            ? 'GUEST'
            : user?.role ?? null;

    const value: AuthContextValue = {
        user,
        farms,
        activeFarm,
        isLoading,

        isAuthenticated:
            !!user,

        isAdmin:
            user?.role === 'ADMIN',

        isFarmer:
            user?.role === 'FARMER',

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
        <AuthContext.Provider
            value={value}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx =
        useContext(AuthContext);

    if (!ctx) {
        throw new Error(
            'useAuth must be used within an AuthProvider'
        );
    }

    return ctx;
}