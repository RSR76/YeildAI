import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeocodeController } from '../src/controllers/geocode.controller.js';
import { GeocodeUpstreamError, __clearGeocodeCacheForTests } from '../src/services/geocode.service.js';
import * as geocodeService from '../src/services/geocode.service.js';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  __clearGeocodeCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GeocodeController.reverseGeocode — validation', () => {
  const controller = new GeocodeController();

  it('400s when lat is missing', async () => {
    const req: any = { query: { lon: '81.19' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid query parameters' }));
  });

  it('400s when lon is missing', async () => {
    const req: any = { query: { lat: '26.93' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s when coordinates are non-numeric', async () => {
    const req: any = { query: { lat: 'not-a-number', lon: 'also-not-a-number' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s when latitude is outside [-90, 90]', async () => {
    const req: any = { query: { lat: '95', lon: '10' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s when longitude is outside [-180, 180]', async () => {
    const req: any = { query: { lat: '10', lon: '200' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s when lat is present but empty, rather than silently treating it as 0', async () => {
    const req: any = { query: { lat: '', lon: '10' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('GeocodeController.reverseGeocode — success and error mapping', () => {
  const controller = new GeocodeController();

  it('200s with the normalized result for valid coordinates', async () => {
    const fakeResult = {
      latitude: 26.93,
      longitude: 81.19,
      displayName: 'Barabanki, Uttar Pradesh, India',
      state: 'Uttar Pradesh',
      district: 'Barabanki',
      country: 'India',
      source: 'nominatim' as const,
      matchedState: 'Uttar Pradesh',
      matchedDistrict: 'Barabanki',
      isSupportedLocation: true,
    };
    vi.spyOn(geocodeService, 'reverseGeocode').mockResolvedValue(fakeResult);

    const req: any = { query: { lat: '26.93', lon: '81.19' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(fakeResult);
  });

  it('maps a timeout upstream error to a safe 504 message', async () => {
    vi.spyOn(geocodeService, 'reverseGeocode').mockRejectedValue(
      new GeocodeUpstreamError('timeout', 'internal detail: connect ETIMEDOUT 1.2.3.4:443')
    );

    const req: any = { query: { lat: '10', lon: '10' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);

    expect(res.status).toHaveBeenCalledWith(504);
    const body = res.json.mock.calls[0][0];
    expect(body.error).not.toContain('ETIMEDOUT');
    expect(body.error).not.toContain('1.2.3.4');
  });

  it('maps a network upstream error to a safe 502 message', async () => {
    vi.spyOn(geocodeService, 'reverseGeocode').mockRejectedValue(new GeocodeUpstreamError('network', 'fetch failed: ECONNREFUSED'));

    const req: any = { query: { lat: '10', lon: '10' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    const body = res.json.mock.calls[0][0];
    expect(body.error).not.toContain('ECONNREFUSED');
  });

  it('maps an unexpected internal error to a generic 500 without leaking its message', async () => {
    vi.spyOn(geocodeService, 'reverseGeocode').mockRejectedValue(new Error('/secret/internal/path stack trace leaked here'));

    const req: any = { query: { lat: '10', lon: '10' } };
    const res = mockRes();
    await controller.reverseGeocode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).not.toContain('/secret/internal/path');
    expect(body.error).not.toContain('stack trace');
  });
});
