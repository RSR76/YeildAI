'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  Sprout,
  Droplets,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { getLocations, reverseGeocode } from '@/lib/dataService';
import { findSupportedMatch } from '@/lib/location';
import { estimateSoilAndIrrigation } from '@/lib/soilLookup';
import type {
  Location,
  LocationMatchStatus,
  ReverseGeocodeResult,
  SelectedCoordinates,
} from '@/lib/types';
import type { FarmProfile } from '@/lib/auth/types';

/*
 * Uses the existing LocationMap component from the project.
 * No mapConfig.ts is required.
 */
const LocationMap = dynamic(
  () => import('@/components/map/LocationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-500 sm:h-80">
        Loading map…
      </div>
    ),
  }
);

/*
 * Same India-wide starting position already used by
 * components/map/LocationPicker.tsx.
 */
const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const INDIA_ZOOM = 5;

type FieldName = 'name' | 'sizeAcres' | 'pincode';

function validateField(
  field: FieldName,
  values: {
    name: string;
    sizeAcres: string;
    pincode: string;
  }
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

      const n = Number(values.sizeAcres);

      return n > 0
        ? null
        : 'Enter a size greater than 0';
    }

    case 'pincode':
      return values.pincode.trim().length >= 3
        ? null
        : 'Pincode/ZIP is required';

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

export interface FarmFormProps {
  mode: 'add' | 'edit';

  /**
   * Required when mode="edit".
   */
  initialFarm?: FarmProfile;

  onSuccess: (farm: FarmProfile) => void;

  onCancel?: () => void;

  /**
   * page:
   *   Two-column layout for the Edit Farm page.
   *
   * stacked:
   *   Single-column layout for Add Farm modal.
   */
  layout?: 'page' | 'stacked';
}

export function FarmForm({
  mode,
  initialFarm,
  onSuccess,
  onCancel,
  layout = 'stacked',
}: FarmFormProps) {
  const {
    addFarm,
    editFarm,
  } = useAuth();

  /*
   * Existing farm values are loaded automatically
   * when editing.
   */
  const [name, setName] = useState(
    initialFarm?.name ?? ''
  );

  const [address, setAddress] = useState(
    initialFarm?.address ?? ''
  );

  const [pincode, setPincode] = useState(
    initialFarm?.pincode ?? ''
  );

  const [sizeAcres, setSizeAcres] = useState(
    initialFarm
      ? String(initialFarm.sizeAcres)
      : ''
  );

  const [crops, setCrops] = useState(
    initialFarm?.crops.join(', ') ?? ''
  );

  const [error, setError] = useState<string | null>(
    null
  );

  const [submitting, setSubmitting] =
    useState(false);

  const [touched, setTouched] = useState<
    Partial<Record<FieldName, boolean>>
  >({});

  const [submitAttempted, setSubmitAttempted] =
    useState(false);

  /*
   * Field validation.
   */
  const fieldErrors = useMemo(() => {
    const fieldValues = {
      name,
      sizeAcres,
      pincode,
    };

    return {
      name: validateField(
        'name',
        fieldValues
      ),

      sizeAcres: validateField(
        'sizeAcres',
        fieldValues
      ),

      pincode: validateField(
        'pincode',
        fieldValues
      ),
    };
  }, [name, sizeAcres, pincode]);

  function markTouched(field: FieldName) {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  }

  function shownError(
    field: FieldName
  ): string | null {
    return touched[field] || submitAttempted
      ? fieldErrors[field]
      : null;
  }

  /*
   * Location state.
   *
   * When editing an existing farm, start with
   * its saved coordinates.
   */
  const [pin, setPin] =
    useState<SelectedCoordinates | null>(
      initialFarm?.latitude != null &&
      initialFarm?.longitude != null
        ? {
            latitude: initialFarm.latitude,
            longitude: initialFarm.longitude,
          }
        : null
    );

  const [geocodeStatus, setGeocodeStatus] =
    useState<LocationMatchStatus>(
      initialFarm
        ? 'success'
        : 'idle'
    );

  const [geocodeResult, setGeocodeResult] =
    useState<ReverseGeocodeResult | null>(
      initialFarm
        ? {
            latitude: initialFarm.latitude ?? 0,
            longitude: initialFarm.longitude ?? 0,
            displayName:
              initialFarm.address ?? null,
            state: initialFarm.state,
            district: initialFarm.district,
            country: null,
            source: 'nominatim',
            matchedState: initialFarm.state,
            matchedDistrict: initialFarm.district,
            isSupportedLocation: true,
          }
        : null
    );

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

  /*
   * Existing soil lookup functionality.
   */
  const soilAndIrrigation = resolvedState
    ? estimateSoilAndIrrigation(
        resolvedState,
        resolvedDistrict ?? undefined
      )
    : null;

  const locationError =
    submitAttempted && !locationResolved
      ? 'Pick your farm’s location on the map and confirm it'
      : null;

  function handleSelectPin(
    coords: SelectedCoordinates
  ) {
    setPin(coords);
    setGeocodeStatus('idle');
    setGeocodeResult(null);
    setGeocodeError(null);
  }

  /*
   * Reverse-geocode selected map location.
   */
  async function handleUseThisLocation() {
    if (!pin) return;

    setGeocodeStatus('loading');
    setGeocodeError(null);

    try {
      const result = await reverseGeocode(
        pin.latitude,
        pin.longitude
      );

      setGeocodeResult(result);

      setGeocodeStatus(
        result.isSupportedLocation
          ? 'success'
          : result.matchedState
          ? 'partial'
          : 'unsupported'
      );

      if (result.displayName) {
        setAddress(result.displayName);
      }
    } catch (err) {
      setGeocodeStatus('error');

      setGeocodeError(
        err instanceof Error
          ? err.message
          : 'The location lookup failed.'
      );
    }
  }

  /*
   * Existing supported-location lookup.
   */
  const [
    supportedLocations,
    setSupportedLocations,
  ] = useState<Location[] | null>(null);

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
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const showCoverageWarning =
    supportedLocations !== null &&
    !!resolvedState &&
    !!resolvedDistrict &&
    !findSupportedMatch(
      supportedLocations,
      resolvedState,
      resolvedDistrict
    );

  /*
   * Required fields + location.
   */
  const isFormValid =
    Object.values(fieldErrors).every(
      (e) => e === null
    ) && locationResolved;

  /*
   * Save farm.
   */
  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

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
      const payload = {
        name: name.trim(),

        location:
          `${resolvedDistrict}, ${resolvedState}`,

        address:
          address.trim() || undefined,

        pincode:
          pincode.trim(),

        latitude:
          pin?.latitude,

        longitude:
          pin?.longitude,

        state:
          resolvedState,

        district:
          resolvedDistrict,

        sizeAcres:
          Number(sizeAcres),

        soilType:
          soilAndIrrigation.soilType,

        irrigation:
          soilAndIrrigation.irrigation,

        crops:
          crops
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
      };

      const farm =
        mode === 'edit' && initialFarm
          ? await editFarm(
              initialFarm.id,
              payload
            )
          : await addFarm(payload);

      onSuccess(farm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save this farm. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * LOCATION SECTION
   */
  const locationBlock = (
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
        Click anywhere on the map to drop a pin,
        then confirm it. Soil type and irrigation
        below are filled in automatically from
        this location.
      </p>

      <LocationMap
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        selected={pin}
        onSelect={handleSelectPin}
      />

      {pin && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-xs text-stone-600">
            {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
          </span>

          <button
            type="button"
            onClick={handleUseThisLocation}
            disabled={
              geocodeStatus === 'loading'
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--forest-600)] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {geocodeStatus === 'loading' ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <MapPin size={14} />
            )}

            {geocodeStatus === 'loading'
              ? 'Looking up…'
              : locationResolved
              ? 'Confirm this location'
              : 'Use this location'}
          </button>
        </div>
      )}

      <FieldError message={locationError} />

      {geocodeStatus === 'success' &&
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

      {geocodeStatus === 'partial' &&
        geocodeResult && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

            <span>
              Matched state{' '}
              {resolvedState}, but not an exact
              district (
              {resolvedDistrict}).
              Move the pin for a closer match
              if needed.
            </span>
          </div>
        )}

      {geocodeStatus === 'unsupported' &&
        geocodeResult && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

            <span>
              Location set to{' '}
              {resolvedDistrict},{' '}
              {resolvedState}, but it isn't in
              the forecast dataset yet.
            </span>
          </div>
        )}

      {geocodeStatus === 'error' && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

          <span>
            {geocodeError ??
              'The location lookup failed.'}{' '}
            Try moving the pin slightly and
            confirming again.
          </span>
        </div>
      )}

      {showCoverageWarning && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

          <span>
            No forecast data is available for
            this location yet. You can still
            save the farm — Mandi Prices and
            Recommendations will show no data
            until this location is added to the
            dataset.
          </span>
        </div>
      )}

      {/* Address */}
      <div className="mt-3">
        <FieldLabel>
          Address
        </FieldLabel>

        <input
          value={address}
          onChange={(e) =>
            setAddress(e.target.value)
          }
          placeholder="Village / street, landmark"
          className={inputClass(false)}
        />
      </div>
    </div>
  );

  /*
   * AUTOMATIC GROWING CONDITIONS
   */
  const growingConditionsBlock = (
    <div>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">
        Growing conditions
      </span>

      {!locationResolved ? (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-400">
          Soil type and irrigation will be
          determined automatically once you set
          a location above.
        </p>
      ) : (
        <div className="space-y-2">

          {/* Soil */}
          <div className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
            <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

            <div>
              <div className="text-xs font-medium text-stone-800">
                Soil type:{' '}
                {soilAndIrrigation?.soilType}
              </div>

              <div className="text-[11px] text-stone-400">
                Extracted from{' '}
                {resolvedDistrict},{' '}
                {resolvedState}
              </div>
            </div>
          </div>

          {/* Irrigation */}
          <div className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
            <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />

            <div>
              <div className="text-xs font-medium text-stone-800">
                Suggested irrigation:{' '}
                {soilAndIrrigation?.irrigation}
              </div>

              <div className="text-[11px] text-stone-400">
                Best-suited estimate for this
                region
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );

  /*
   * FARM DETAILS
   */
  const detailsFields = (
    <>
      {/* Farm Name */}
      <div>
        <FieldLabel required>
          Farm name
        </FieldLabel>

        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          onBlur={() =>
            markTouched('name')
          }
          placeholder="Green Acres"
          className={inputClass(
            !!shownError('name')
          )}
          aria-invalid={
            !!shownError('name')
          }
        />

        <FieldError
          message={shownError('name')}
        />
      </div>

      {/* Size + Pincode */}
      <div
        className={
          layout === 'page'
            ? 'grid grid-cols-2 gap-3'
            : 'space-y-4'
        }
      >
        {/* Size */}
        <div>
          <FieldLabel required>
            Size (acres)
          </FieldLabel>

          <input
            type="number"
            min="0.1"
            step="0.1"
            value={sizeAcres}
            onChange={(e) =>
              setSizeAcres(
                e.target.value
              )
            }
            onBlur={() =>
              markTouched('sizeAcres')
            }
            placeholder="50"
            className={inputClass(
              !!shownError('sizeAcres')
            )}
            aria-invalid={
              !!shownError('sizeAcres')
            }
          />

          <FieldError
            message={shownError(
              'sizeAcres'
            )}
          />
        </div>

        {/* Pincode */}
        <div>
          <FieldLabel required>
            Pincode / ZIP
          </FieldLabel>

          <input
            value={pincode}
            onChange={(e) =>
              setPincode(
                e.target.value
              )
            }
            onBlur={() =>
              markTouched('pincode')
            }
            placeholder="422001"
            className={inputClass(
              !!shownError('pincode')
            )}
            aria-invalid={
              !!shownError('pincode')
            }
          />

          <FieldError
            message={shownError(
              'pincode'
            )}
          />
        </div>
      </div>

      {/* Crops */}
      <div>
        <FieldLabel>
          Crops
        </FieldLabel>

        <input
          value={crops}
          onChange={(e) =>
            setCrops(e.target.value)
          }
          placeholder="Wheat, Rice, Soybean (comma-separated)"
          className={inputClass(false)}
        />

        <p className="mt-1 text-xs text-stone-400">
          You can add multiple crops
          separated by commas.
        </p>
      </div>
    </>
  );

  const submitLabel = submitting
    ? mode === 'edit'
      ? 'Saving…'
      : 'Adding…'
    : mode === 'edit'
    ? 'Save Changes'
    : 'Add farm';

  return (
    <form onSubmit={handleSubmit}>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* FORM LAYOUT */}
      {layout === 'page' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Left */}
          <div className="space-y-4">
            {locationBlock}
          </div>

          {/* Right */}
          <div className="space-y-4">
            {detailsFields}
            {growingConditionsBlock}
          </div>

        </div>
      ) : (
        <div className="space-y-4">
          {detailsFields}
          {locationBlock}
          {growingConditionsBlock}
        </div>
      )}

      {/* ACTIONS */}
      <div
        className={`flex gap-3 ${
          layout === 'page'
            ? 'mt-6'
            : 'mt-5'
        }`}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}