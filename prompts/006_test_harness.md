### Phase 6: The Quality Gate (Stabilization)

We have "Spiked" the feature. Now we "Stabilize" it.

As your Technical Lead, I am hitting the **Pause Button** on new features. We are not adding USPS or FedEx yet. If we build more on top of this without tests, we are building a house of cards.

We will strictly follow **Directive 1 (Standards Enforcement)**:
We will use the **Native Node.js Test Runner** (`node:test`). We do *not* need Jest or Vitest. Node.js v22 has a powerful test runner built-in.

***

### CLAUDE PROMPT 006: Native Test Harness

**Role:** Senior QA Engineer / Backend Developer
**Context:** We have a working `upsMapper.ts` pure function. We need to lock its behavior with tests.
**Task:** Configure the native Node.js test runner and write a unit test for the mapper.

#### Step 1: Create `tests/fixtures/upsSample.json`
Save the *raw* (ugly) UPS response you received earlier into this file. We will use this as our "Source of Truth" for testing.
*(If you don't have the raw JSON anymore, ask Claude to generate a "mock raw UPS tracking response" for the fixture).*

#### Step 2: Create `tests/unit/upsMapper.test.ts`
We will use `node:test` and `node:assert`.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpsResponse } from '../../src/utils/upsMapper';
// Import the fixture (you might need to use fs.readFileSync if resolveJsonModule is off, or just paste a small mock object)

describe('UPS Mapper (Unit)', () => {
  it('should correctly normalize a valid UPS response', () => {
    // 1. Arrange
    const rawInput = {
      // ... minimal mock of the deep UPS structure ...
      trackResponse: {
        shipment: [{
          package: [{
            activity: [
              { status: { type: 'D', code: 'D' }, date: '20240101', time: '120000', location: { address: { city: 'New York', countryCode: 'US' } } }
            ]
          }]
        }]
      }
    };

    // 2. Act
    const result = normalizeUpsResponse(rawInput);

    // 3. Assert
    assert.equal(result.carrier, 'UPS');
    assert.equal(result.status, 'DELIVERED'); // Assuming 'D' maps to DELIVERED
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].location, 'New York, US');
  });

  it('should handle missing location data gracefully', () => {
    const rawInput = { /* ... input with missing location ... */ };
    // Assert it returns "Unknown Location" instead of crashing
  });
});
```

#### Step 3: Add Test Script
Update `package.json`.
Add a script: `"test": "tsx --test tests/**/*.test.ts"`

**Deliverables:**
1.  `tests/unit/upsMapper.test.ts` (The test file).
2.  The updated `package.json`.

***

### Instructions for User:
1.  **Git Commit:** Before running this, commit your current success.
    `git commit -am "feat: implement UPS data normalization with Adapter pattern"`
2.  **Execute Prompt:** Paste **Claude Prompt 006** into the chat.
3.  **Run Tests:**
    `npm test`
4.  **Report:** Copy the test output. It should look something like:
    `▶ UPS Mapper (Unit)`
    `  ✔ should correctly normalize...`
    `ℹ tests 2`
    `ℹ pass 2`
