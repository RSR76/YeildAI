'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tractor, Check, Plus } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { AddFarmModal } from './AddFarmModal';

export function FarmSwitcher() {
    const { farms, activeFarm, switchFarm } = useAuth();
    const [open, setOpen] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function handleSwitch(farmId: string) {
        if (farmId === activeFarm?.id) {
            setOpen(false);
            return;
        }
        setSwitching(farmId);
        try {
            await switchFarm(farmId);
        } finally {
            setSwitching(null);
            setOpen(false);
        }
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
                <Tractor className="h-4 w-4 text-emerald-700" />
                <span className="max-w-[140px] truncate font-medium">
                    {activeFarm ? activeFarm.name : 'Add a farm'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
            </button>

            {open && (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                    {farms.length === 0 ? (
                        <p className="px-2.5 py-2 text-sm text-stone-500">No farms yet.</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto">
                            {farms.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => handleSwitch(f.id)}
                                    disabled={switching === f.id}
                                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-60"
                                >
                                    <span>
                                        <span className="block font-medium text-stone-800">{f.name}</span>
                                        <span className="block text-xs text-stone-500">{f.location}</span>
                                    </span>
                                    {f.id === activeFarm?.id && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="my-1 border-t border-stone-100" />

                    <button
                        onClick={() => {
                            setOpen(false);
                            setShowAddModal(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                        <Plus className="h-4 w-4" />
                        Add a farm
                    </button>
                </div>
            )}

            {showAddModal && <AddFarmModal onClose={() => setShowAddModal(false)} />}
        </div>
    );
}