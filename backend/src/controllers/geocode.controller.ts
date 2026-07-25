import type { Request, Response } from 'express';
import { z } from 'zod';
import { GeocodeUpstreamError, reverseGeocode, type GeocodeErrorCode } from '../services/geocode.service.js';

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`);
}

// z.coerce.number() alone would turn an empty string (e.g. `?lat=&lon=5`)
// into 0 via Number(''), silently treating a present-but-empty param as
// valid (0, 0) instead of rejecting it — so the raw string is required to be
// non-empty before it's ever coerced to a number.
const finiteNumber = (label: string) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(1, { message: `${label} is required` })
    .transform((v) => Number(v))
    .refine(Number.isFinite, { message: `${label} must be a finite number` });

const latitudeSchema = finiteNumber('lat').refine((v) => v >= -90 && v <= 90, { message: 'lat must be between -90 and 90' });
const longitudeSchema = finiteNumber('lon').refine((v) => v >= -180 && v <= 180, { message: 'lon must be between -180 and 180' });

const reverseGeocodeQuerySchema = z.object({ lat: latitudeSchema, lon: longitudeSchema });

// User-facing, non-technical messages only — never the raw upstream error or
// response body. Timeouts/network/upstream/invalid-response are all
// "the lookup service didn't work", not something the user can act on beyond
// retrying or using the manual selectors.
const UPSTREAM_ERROR_RESPONSES: Record<GeocodeErrorCode, { status: number; message: string }> = {
  timeout: {
    status: 504,
    message: 'The location lookup service timed out. Please try again, or continue with the state/district selectors below.',
  },
  network: {
    status: 502,
    message: 'The location lookup service is currently unavailable. Please try again, or continue with the state/district selectors below.',
  },
  upstream_error: {
    status: 502,
    message: 'The location lookup service returned an unexpected response. Please try again, or continue with the state/district selectors below.',
  },
  invalid_response: {
    status: 502,
    message: 'The location lookup service returned an unexpected response. Please try again, or continue with the state/district selectors below.',
  },
};

export class GeocodeController {
  async reverseGeocode(req: Request, res: Response) {
    const parsed = reverseGeocodeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }

    try {
      const result = await reverseGeocode(parsed.data.lat, parsed.data.lon);
      res.json(result);
    } catch (error) {
      if (error instanceof GeocodeUpstreamError) {
        const mapped = UPSTREAM_ERROR_RESPONSES[error.code];
        return res.status(mapped.status).json({ error: mapped.message, retryable: true });
      }
      res.status(500).json({
        error: 'The location lookup service failed unexpectedly. Please try again, or continue with the state/district selectors below.',
      });
    }
  }
}
