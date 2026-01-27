import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeUpsResponse } from '../../src/utils/upsMapper.js';

// Get directory path for fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '..', 'fixtures');

// Load fixtures
const loadFixture = (filename: string) => {
  const filePath = join(fixturesPath, filename);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
};

describe('UPS Mapper (Unit)', () => {
  describe('normalizeUpsResponse', () => {
    it('should correctly normalize a delivered UPS response', () => {
      const rawInput = loadFixture('upsSample.json');
      const result = normalizeUpsResponse(rawInput);

      assert.equal(result.carrier, 'UPS');
      assert.equal(result.trackingNumber, '1Z999AA10123456784');
      assert.equal(result.status, 'DELIVERED');
      assert.equal(result.events.length, 8);
      assert.ok(result.estimatedDelivery);
      assert.ok(result.currentLocation);
    });

    it('should map status "D" to DELIVERED', () => {
      const rawInput = {
        trackResponse: {
          shipment: [{
            package: [{
              trackingNumber: '1Z123',
              currentStatus: { type: 'D', code: 'KB' },
              activity: [{
                status: { type: 'D', description: 'DELIVERED' },
                date: '20250120',
                time: '143000',
                location: { address: { city: 'New York', stateProvince: 'NY', countryCode: 'US' } },
              }],
            }],
          }],
        },
      };

      const result = normalizeUpsResponse(rawInput);
      assert.equal(result.status, 'DELIVERED');
    });

    it('should map status "I" to TRANSIT', () => {
      const rawInput = loadFixture('upsInTransit.json');
      const result = normalizeUpsResponse(rawInput);

      assert.equal(result.status, 'TRANSIT');
      assert.equal(result.trackingNumber, '1Z999BB20234567890');
    });

    it('should map status "X" to EXCEPTION', () => {
      const rawInput = loadFixture('upsException.json');
      const result = normalizeUpsResponse(rawInput);

      assert.equal(result.status, 'EXCEPTION');
      assert.equal(result.trackingNumber, '1Z999CC30345678901');
    });

    it('should map status "M" to PENDING', () => {
      const rawInput = {
        trackResponse: {
          shipment: [{
            package: [{
              trackingNumber: '1Z456',
              currentStatus: { type: 'M' },
              activity: [{
                status: { type: 'M', description: 'Label Created' },
                date: '20250120',
                time: '100000',
              }],
            }],
          }],
        },
      };

      const result = normalizeUpsResponse(rawInput);
      assert.equal(result.status, 'PENDING');
    });

    it('should handle missing location data gracefully', () => {
      const rawInput = {
        trackResponse: {
          shipment: [{
            package: [{
              trackingNumber: '1Z789',
              activity: [{
                status: { type: 'I', description: 'In Transit' },
                date: '20250120',
                time: '100000',
              }],
            }],
          }],
        },
      };

      const result = normalizeUpsResponse(rawInput);
      assert.equal(result.events[0].location, 'Unknown Location');
      assert.equal(result.currentLocation, 'Unknown Location');
    });

    it('should handle empty response', () => {
      const result = normalizeUpsResponse({});

      assert.equal(result.trackingNumber, 'UNKNOWN');
      assert.equal(result.carrier, 'UPS');
      assert.equal(result.status, 'UNKNOWN');
      assert.equal(result.events.length, 0);
    });

    it('should sort events by timestamp (most recent first)', () => {
      const rawInput = loadFixture('upsSample.json');
      const result = normalizeUpsResponse(rawInput);

      for (let i = 0; i < result.events.length - 1; i++) {
        const currentTime = new Date(result.events[i].timestamp).getTime();
        const nextTime = new Date(result.events[i + 1].timestamp).getTime();
        assert.ok(currentTime >= nextTime, 'Events should be sorted most recent first');
      }
    });

    it('should include raw data when includeRaw is true', () => {
      const rawInput = { trackResponse: { shipment: [{ package: [{ trackingNumber: '1ZRAW', activity: [] }] }] } };
      const result = normalizeUpsResponse(rawInput, true);

      assert.ok(result.raw);
      assert.deepEqual(result.raw, rawInput);
    });
  });
});