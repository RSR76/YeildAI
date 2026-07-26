'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';

const SOIL_TYPES = ['Alluvial loam', 'Black cotton soil', 'Red laterite', 'Sandy loam', 'Clay loam'];
const IRRIGATION_TYPES = ['Canal + tube well', 'Borewell', 'Rainfed', 'Drip irrigation', 'Canal only'];

export function AddFarmModal({ onClose }: { onClose: () => void }) {
    const { addFarm } = useAuth();

    const [name, setName] = useState('');
    const [state, setState] = useState('');
    const [district, setDistrict] = useState('');
    const [sizeAcres, setSizeAcres] = useState('');
    const [soilType, setSoilType] = useState(SOIL_TYPES[0]);
    const [irrigation, setIrrigation] = useState(IRRIGATION_TYPES[0]);
    const [crops, setCrops] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const acres = Number(sizeAcres);
        if (!name.trim() || !state.trim() || !district.trim() || !acres || acres <= 0) {
            setError('Please fill in all required fields with valid values.');
            return;
        }

        setSubmitting(true);
        try {
            await addFarm({
                name: name.trim(),
                location: `${district.trim()}, ${state.trim()}`,
                state: state.trim(),
                district: district.trim(),
                sizeAcres: acres,
                soilType,
                irrigation,
                crops: crops
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean),
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create farm. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-[var(--font-display)] text-lg text-[var(--forest-900)]">Add a farm</h3>
                    <button onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">Farm name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Green Acres"
                            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">State</label>
                            <input
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                placeholder="Uttar Pradesh"
                                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">District</label>
                            <input
                                value={district}
                                onChange={(e) => setDistrict(e.target.value)}
                                placeholder="Barabanki"
                                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">Size (acres)</label>
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={sizeAcres}
                            onChange={(e) => setSizeAcres(e.target.value)}
                            placeholder="50"
                            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">Soil type</label>
                            <select
                                value={soilType}
                                onChange={(e) => setSoilType(e.target.value)}
                                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                            >
                                {SOIL_TYPES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">Irrigation</label>
                            <select
                                value={irrigation}
                                onChange={(e) => setIrrigation(e.target.value)}
                                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                            >
                                {IRRIGATION_TYPES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">Crops (comma-separated)</label>
                        <input
                            value={crops}
                            onChange={(e) => setCrops(e.target.value)}
                            placeholder="Wheat, Rice, Soybean"
                            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:opacity-60"
                    >
                        {submitting ? 'Adding…' : 'Add farm'}
                    </button>
                </form>
            </div>
        </div>
    );
}