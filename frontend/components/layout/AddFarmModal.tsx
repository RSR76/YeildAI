'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Loader2,
  MapPin,
  Sprout,
  X,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import {
  getLocations,
  reverseGeocode,
} from '@/lib/dataService';
import { findSupportedMatch } from '@/lib/location';
import { estimateSoilAndIrrigation } from '@/lib/soilLookup';
import type {
  Location,
  LocationMatchStatus,
  ReverseGeocodeResult,
  SelectedCoordinates,
} from '@/lib/types';

const LocationMap = dynamic(
  () => import('@/components/map/LocationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-500">
        Loading map…
      </div>
    ),
  },
);

type FieldName = 'name' | 'sizeAcres' | 'pincode';

function validateField(
  field: FieldName,
  values: {
    name: string;
    sizeAcres: string;
    pincode: string;
  },
): string | null {
  switch (field) {
    case 'name':
      return values.name.trim()
        ? null
        : 'Farm name is required';

    case 'sizeAcres': {
      if (!values.sizeAcres.trim()) {
        return 'Size is required';
      }

      const number = Number(values.sizeAcres);

      return number > 0
        ? null
        : 'Enter a size greater than 0';
    }

    case 'pincode':
      return values.pincode.trim().length >= 3
        ? null
        : 'Pincode / ZIP is required';

    default:
      return null;
  }
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-stone-600">
      {children}

      {required ? (
        <span
          className="text-red-500"
          aria-hidden="true"
        >
          *
        </span>
      ) : (
        <span className="font-normal text-stone-400">
          (optional)
        </span>
      )}
    </label>
  );
}

function FieldError({
  message,
}: {
  message: string | null;
}) {
  if (!message) return null;

  return (
    <p className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
    hasError
      ? 'border-red-300 focus:border-red-400'
      : 'border-stone-200 focus:border-emerald-400'
  }`;

export function AddFarmModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { addFarm } = useAuth();

  /* =====================================================
     FORM VALUES
  ===================================================== */

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [sizeAcres, setSizeAcres] = useState('');
  const [crops, setCrops] = useState('');

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  /* =====================================================
     VALIDATION
  ===================================================== */

  const [touched, setTouched] = useState<
    Partial<Record<FieldName, boolean>>
  >({});

  const [submitAttempted, setSubmitAttempted] =
    useState(false);

  const fieldErrors = useMemo(() => {
    const values = {
      name,
      sizeAcres,
      pincode,
    };

    return {
      name: validateField('name', values),
      sizeAcres: validateField(
        'sizeAcres',
        values,
      ),
      pincode: validateField(
        'pincode',
        values,
      ),
    };
  }, [name, sizeAcres, pincode]);

  function markTouched(field: FieldName) {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));
  }

  function shownError(
    field: FieldName,
  ): string | null {
    return touched[field] || submitAttempted
      ? fieldErrors[field]
      : null;
  }

  /* =====================================================
     LOCATION
  ===================================================== */

  const [pin, setPin] =
    useState<SelectedCoordinates | null>(null);

  const [geocodeStatus, setGeocodeStatus] =
    useState<LocationMatchStatus>('idle');

  const [geocodeResult, setGeocodeResult] =
    useState<ReverseGeocodeResult | null>(null);

  const [geocodeError, setGeocodeError] =
    useState<string | null>(null);

  const locationResolved =
    (
      geocodeStatus === 'success' ||
      geocodeStatus === 'partial' ||
      geocodeStatus === 'unsupported'
    ) &&
    !!geocodeResult?.state;

  const resolvedState =
    geocodeResult?.state ?? null;

  const resolvedDistrict =
    geocodeResult?.district ?? null;

  /* =====================================================
     SOIL / IRRIGATION
  ===================================================== */

  const soilAndIrrigation =
    resolvedState
      ? estimateSoilAndIrrigation(
          resolvedState,
          resolvedDistrict ?? undefined,
        )
      : null;

  /* =====================================================
     LOCATION VALIDATION
  ===================================================== */

  const locationError =
    submitAttempted && !locationResolved
      ? 'Pick your farm’s location on the map and confirm it'
      : null;

  function handleSelectPin(
    coordinates: SelectedCoordinates,
  ) {
    setPin(coordinates);
    setGeocodeStatus('idle');
    setGeocodeResult(null);
    setGeocodeError(null);
  }

  async function handleUseThisLocation() {
    if (!pin) return;

    setGeocodeStatus('loading');
    setGeocodeError(null);

    try {
      const result = await reverseGeocode(
        pin.latitude,
        pin.longitude,
      );

      setGeocodeResult(result);

      setGeocodeStatus(
        result.isSupportedLocation
          ? 'success'
          : result.matchedState
            ? 'partial'
            : 'unsupported',
      );

      if (result.displayName) {
        setAddress(result.displayName);
      }
    } catch (err) {
      setGeocodeStatus('error');

      setGeocodeError(
        err instanceof Error
          ? err.message
          : 'The location lookup failed.',
      );
    }
  }

  /* =====================================================
     SUPPORTED LOCATIONS
  ===================================================== */

  const [supportedLocations, setSupportedLocations] =
    useState<Location[] | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    getLocations({
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setSupportedLocations(data);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setSupportedLocations(null);
      });

    return () => controller.abort();
  }, []);

  const showCoverageWarning =
    supportedLocations !== null &&
    !!resolvedState &&
    !!resolvedDistrict &&
    !findSupportedMatch(
      supportedLocations,
      resolvedState,
      resolvedDistrict,
    );

  /* =====================================================
     FORM VALIDATION
  ===================================================== */

  const isFormValid =
    Object.values(fieldErrors).every(
      (value) => value === null,
    ) && locationResolved;

  /* =====================================================
     SUBMIT
  ===================================================== */

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setError(null);
    setSubmitAttempted(true);

    if (
      !isFormValid ||
      !resolvedState ||
      !resolvedDistrict ||
      !soilAndIrrigation
    ) {
      return;
    }

    setSubmitting(true);

    try {
      await addFarm({
        name: name.trim(),

        location:
          `${resolvedDistrict}, ${resolvedState}`,

        address:
          address.trim() || undefined,

        pincode: pincode.trim(),

        latitude: pin?.latitude,

        longitude: pin?.longitude,

        state: resolvedState,

        district: resolvedDistrict,

        sizeAcres: Number(sizeAcres),

        soilType:
          soilAndIrrigation.soilType,

        irrigation:
          soilAndIrrigation.irrigation,

        crops: crops
          .split(',')
          .map((crop) => crop.trim())
          .filter(Boolean),
      });

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create farm. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">

          <div>
            <h3 className="font-[var(--font-display)] text-lg text-[var(--forest-900)]">
              Add a farm
            </h3>

            <p className="mt-0.5 text-xs text-stone-400">
              <span className="text-red-500">
                *
              </span>{' '}
              indicates a required field
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4"
        >

          {/* ERROR */}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">

            {/* FARM NAME */}

            <div>
              <FieldLabel required>
                Farm name
              </FieldLabel>

              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                onBlur={() =>
                  markTouched('name')
                }
                placeholder="Green Acres"
                className={inputClass(
                  !!shownError('name'),
                )}
                aria-invalid={
                  !!shownError('name')
                }
              />

              <FieldError
                message={shownError('name')}
              />
            </div>

            {/* LOCATION */}

            <div
              className={`rounded-xl border p-3 ${
                locationError
                  ? 'border-red-300 bg-red-50/40'
                  : 'border-stone-100 bg-stone-50/60'
              }`}
            >

              <div className="mb-2 flex items-center justify-between">

                <FieldLabel required>
                  Location — pick on map
                </FieldLabel>

                {locationResolved && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Location set
                  </span>
                )}

              </div>

              <p className="mb-2 text-xs text-stone-500">
                Pick your farm location on the
                map. The location will be used to
                determine the state, district,
                soil type and irrigation estimate.
              </p>

              <LocationMap
                center={[17.3850, 78.4867]}
                zoom={6}
                selected={pin}
                onSelect={handleSelectPin}
              />

              {pin && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                  <span className="font-mono text-xs text-stone-600">
                    {pin.latitude.toFixed(5)},
                    {' '}
                    {pin.longitude.toFixed(5)}
                  </span>

                  <button
                    type="button"
                    onClick={
                      handleUseThisLocation
                    }
                    disabled={
                      geocodeStatus ===
                      'loading'
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--forest-600)] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {geocodeStatus ===
                    'loading' ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <MapPin size={14} />
                    )}

                    {geocodeStatus ===
                    'loading'
                      ? 'Looking up…'
                      : locationResolved
                        ? 'Confirm location'
                        : 'Use this location'}

                  </button>

                </div>
              )}

              <FieldError
                message={locationError}
              />

              {/* SUCCESS */}

              {geocodeStatus ===
                'success' &&
                geocodeResult && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">

                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <span>
                      Matched to{' '}
                      {resolvedDistrict},{' '}
                      {resolvedState}.
                    </span>

                  </div>
                )}

              {/* PARTIAL */}

              {geocodeStatus ===
                'partial' &&
                geocodeResult && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">

                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <span>
                      Matched state{' '}
                      {resolvedState}, but the
                      exact district could not
                      be confirmed. Move the pin
                      if needed.
                    </span>

                  </div>
                )}

              {/* UNSUPPORTED */}

              {geocodeStatus ===
                'unsupported' &&
                geocodeResult && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">

                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <span>
                      Location set to{' '}
                      {resolvedDistrict},{' '}
                      {resolvedState}, but forecast
                      data is not available for
                      this location yet.
                    </span>

                  </div>
                )}

              {/* ERROR */}

              {geocodeStatus ===
                'error' && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">

                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <span>
                      {geocodeError ??
                        'The location lookup failed.'}{' '}
                      Try moving the pin and
                      confirming again.
                    </span>

                  </div>
                )}

              {/* COVERAGE */}

              {showCoverageWarning && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">

                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <span>
                    No forecast data is available
                    for this location yet. You can
                    still add the farm.
                  </span>

                </div>
              )}

              {/* ADDRESS */}

              <div className="mt-3">

                <FieldLabel>
                  Address
                </FieldLabel>

                <input
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value,
                    )
                  }
                  placeholder="Village / street, landmark"
                  className={inputClass(false)}
                />

              </div>

            </div>

            {/* SIZE */}

            <div>

              <FieldLabel required>
                Size (acres)
              </FieldLabel>

              <input
                type="number"
                min="0.1"
                step="0.1"
                value={sizeAcres}
                onChange={(event) =>
                  setSizeAcres(
                    event.target.value,
                  )
                }
                onBlur={() =>
                  markTouched('sizeAcres')
                }
                placeholder="50"
                className={inputClass(
                  !!shownError(
                    'sizeAcres',
                  ),
                )}
                aria-invalid={
                  !!shownError(
                    'sizeAcres',
                  )
                }
              />

              <FieldError
                message={shownError(
                  'sizeAcres',
                )}
              />

            </div>

            {/* PINCODE */}

            <div>

              <FieldLabel required>
                Pincode / ZIP
              </FieldLabel>

              <input
                value={pincode}
                onChange={(event) =>
                  setPincode(
                    event.target.value,
                  )
                }
                onBlur={() =>
                  markTouched('pincode')
                }
                placeholder="422001"
                className={inputClass(
                  !!shownError('pincode'),
                )}
                aria-invalid={
                  !!shownError('pincode')
                }
              />

              <FieldError
                message={shownError(
                  'pincode',
                )}
              />

            </div>

            {/* GROWING CONDITIONS */}

            <div>

              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Growing conditions
              </span>

              {!locationResolved ? (
                <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-400">
                  Soil type and irrigation will
                  be determined automatically
                  after you set a location.
                </p>
              ) : (
                <div className="space-y-2">

                  {/* SOIL */}

                  <div className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">

                    <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                    <div>

                      <div className="text-xs font-medium text-stone-800">
                        Soil type:{' '}
                        {soilAndIrrigation?.soilType}
                      </div>

                      <div className="text-[11px] text-stone-400">
                        Based on{' '}
                        {resolvedDistrict},{' '}
                        {resolvedState}
                      </div>

                    </div>

                  </div>

                  {/* IRRIGATION */}

                  <div className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">

                    <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />

                    <div>

                      <div className="text-xs font-medium text-stone-800">
                        Suggested irrigation:{' '}
                        {
                          soilAndIrrigation?.irrigation
                        }
                      </div>

                      <div className="text-[11px] text-stone-400">
                        Regional estimate
                      </div>

                    </div>

                  </div>

                  <p className="text-[11px] text-stone-400">
                    These are regional estimates,
                    not measured soil-test results.
                  </p>

                </div>
              )}

            </div>

            {/* CROPS */}

            <div>

              <FieldLabel>
                Crops
              </FieldLabel>

              <input
                value={crops}
                onChange={(event) =>
                  setCrops(
                    event.target.value,
                  )
                }
                placeholder="Wheat, Rice, Soybean"
                className={inputClass(false)}
              />

              <p className="mt-1 text-[11px] text-stone-400">
                Separate multiple crops with commas.
              </p>

            </div>

          </div>

          {/* SUBMIT */}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Adding…'
              : 'Add farm'}
          </button>

        </form>

      </div>
    </div>
  );
}