'use client';

import { useState } from 'react';
import {
  MapPin,
  Ruler,
  Droplet,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Pencil,
  Sprout,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AddFarmModal } from '@/components/layout/AddFarmModal';
import { useAuth } from '@/lib/auth/AuthContext';

export default function FarmDetailsPage() {
  const { activeFarm, removeFarm, isGuest } = useAuth();

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [confirmingDelete, setConfirmingDelete] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /* =========================================================
     DELETE FARM
     ========================================================= */

  async function handleDelete() {
    if (!activeFarm) return;

    setDeleting(true);
    setError(null);

    try {
      await removeFarm(activeFarm.id);
      setConfirmingDelete(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete this farm. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =========================================================
     NO FARM
     ========================================================= */

  if (!activeFarm) {
    return (
      <PageWrapper title="My Farm">
        <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#17251d]">
              My Farm
            </h1>

            <p className="mt-1 text-sm text-stone-500">
              Manage your farm details and fields.
            </p>
          </div>

          <Card title="No farms yet">
            <div className="py-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <Sprout className="h-7 w-7 text-emerald-600" />
              </div>

              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-stone-600">
                Add your first farm to start tracking soil health,
                yield predictions, and crop recommendations.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowAddModal(true)
                }
                disabled={isGuest}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add a farm
              </button>

              {isGuest && (
                <p className="mt-2 text-xs text-amber-700">
                  Sign up to add and save your own farms.
                </p>
              )}

            </div>
          </Card>

          {showAddModal && !isGuest && (
            <AddFarmModal
              onClose={() =>
                setShowAddModal(false)
              }
            />
          )}

        </div>
      </PageWrapper>
    );
  }

  /* =========================================================
     FARM INFORMATION
     ========================================================= */

  const stats = [
    {
      icon: MapPin,
      label: 'Location',
      value:
        activeFarm.address ||
        activeFarm.location ||
        'Not available',
    },
    {
      icon: Ruler,
      label: 'Size',
      value: `${activeFarm.sizeAcres} acres`,
    },
    {
      icon: Layers,
      label: 'Soil Type',
      value:
        activeFarm.soilType ||
        'Not specified',
    },
    {
      icon: Droplet,
      label: 'Irrigation Type',
      value:
        activeFarm.irrigation ||
        'Not specified',
    },
  ];

  if (activeFarm.pincode) {
    stats.push({
      icon: MapPin,
      label: 'Pincode',
      value: activeFarm.pincode,
    });
  }

  /* =========================================================
     MAP URL
     ========================================================= */

  const mapLocation = encodeURIComponent(
    activeFarm.address ||
      activeFarm.location ||
      '',
  );

  const mapUrl =
    mapLocation.length > 0
      ? `https://www.google.com/maps?q=${mapLocation}&output=embed`
      : '';

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <PageWrapper title="My Farm">
      <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">

        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#17251d]">
            My Farm
          </h1>

          <p className="mt-1 text-sm text-stone-500">
            Manage your farm details and fields.
          </p>
        </div>

        {/* =====================================================
            FARM OVERVIEW + LOCATION
        ===================================================== */}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(250px,0.42fr)_minmax(0,1fr)]">

          {/* ===================================================
              FARM OVERVIEW
          =================================================== */}

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_10px_rgba(20,49,42,0.03)]">

            <div className="mb-5">
              <h2 className="text-sm font-semibold text-[#17251d]">
                Farm Overview
              </h2>
            </div>

            <div className="space-y-4">

              {/* FARM NAME */}

              <FarmInfoRow
                label="Farm Name"
                value={activeFarm.name}
              />

              {/* LOCATION */}

              <FarmInfoRow
                label="Location"
                value={
                  activeFarm.address ||
                  activeFarm.location ||
                  'Not available'
                }
              />

              {/* AREA */}

              <FarmInfoRow
                label="Total Area"
                value={`${activeFarm.sizeAcres} acres`}
              />

              {/* SOIL */}

              <FarmInfoRow
                label="Soil Type"
                value={
                  activeFarm.soilType ||
                  'Not specified'
                }
              />

              {/* IRRIGATION */}

              <FarmInfoRow
                label="Irrigation Type"
                value={
                  activeFarm.irrigation ||
                  'Not specified'
                }
              />

              {/* PINCODE */}

              {activeFarm.pincode && (
                <FarmInfoRow
                  label="Pincode"
                  value={activeFarm.pincode}
                />
              )}

            </div>

            {/* EDIT BUTTON */}

            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('open-edit-farm'),
                );
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Farm Details
            </button>

            {/* DELETE */}

            {!isGuest && (
              <button
                type="button"
                onClick={() =>
                  setConfirmingDelete(true)
                }
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Farm
              </button>
            )}

          </div>

          {/* ===================================================
              FARM LOCATION
          =================================================== */}

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_2px_10px_rgba(20,49,42,0.03)]">

            <div className="px-5 pb-3 pt-4">
              <h2 className="text-sm font-semibold text-[#17251d]">
                Farm Location
              </h2>
            </div>

            <div className="relative h-[300px] w-full bg-[#edf3e8] sm:h-[340px]">

              {mapUrl ? (
                <iframe
                  title="Farm location"
                  src={mapUrl}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                      <MapPin className="h-6 w-6 text-emerald-600" />
                    </div>

                    <p className="mt-3 text-sm font-medium text-stone-700">
                      Farm location unavailable
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      Add a location to see your farm on the map.
                    </p>

                  </div>
                </div>
              )}

              {/* MAP LOCATION LABEL */}

              <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">

                <div className="flex items-center gap-2">

                  <MapPin className="h-4 w-4 text-emerald-600" />

                  <span className="max-w-[220px] truncate text-xs font-medium text-stone-700">
                    {activeFarm.address ||
                      activeFarm.location ||
                      'Farm location'}
                  </span>

                </div>

              </div>

            </div>
          </div>

        </div>

        {/* =====================================================
            CURRENT CROPS
        ===================================================== */}

        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_10px_rgba(20,49,42,0.03)]">

          <div className="mb-4 flex items-center justify-between">

            <div>
              <h2 className="text-sm font-semibold text-[#17251d]">
                Current Crops
              </h2>

              <p className="mt-1 text-xs text-stone-400">
                Crops currently recorded for this farm.
              </p>
            </div>

          </div>

          {activeFarm.crops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
              <p className="text-sm text-stone-500">
                No crops recorded for this farm yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">

              {activeFarm.crops.map((crop) => (
                <span
                  key={crop}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
                >
                  {crop}
                </span>
              ))}

            </div>
          )}

        </div>

        {/* =====================================================
            DELETE MODAL
        ===================================================== */}

        {confirmingDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onClick={() =>
              !deleting &&
              setConfirmingDelete(false)
            }
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="mb-3 flex items-center gap-2 text-red-600">

                <AlertTriangle className="h-5 w-5" />

                <h3 className="text-lg font-semibold text-stone-900">
                  Delete {activeFarm.name}?
                </h3>

              </div>

              <p className="mb-4 text-sm leading-6 text-stone-600">
                This permanently removes this farm and its
                saved details. This can&apos;t be undone.
              </p>

              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setConfirmingDelete(false)
                  }
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting
                    ? 'Deleting…'
                    : 'Delete'}
                </button>

              </div>

            </div>
          </div>
        )}

      </div>
    </PageWrapper>
  );
}

/* =============================================================
   FARM INFO ROW
============================================================= */

function FarmInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>

      <p className="mt-0.5 text-sm font-medium leading-5 text-stone-800">
        {value}
      </p>
    </div>
  );
}