import { describe, expect, it } from 'vitest';

import { FETCH_OUTCOMES } from '../../services/feeds/http/contracts.js';
import { htmlPageDiscoveryError } from '../../services/feeds/feedManagement.js';

describe('feed rate-limit error passthrough', () => {
  it('preserves a rate-limited outcome as FEED_RATE_LIMITED', () => {
    const retryAt = new Date(Date.now() + 30000);
    const outcome = {
      type: FETCH_OUTCOMES.RATE_LIMITED,
      response: { status: 429, headers: {} },
      error: { type: FETCH_OUTCOMES.RATE_LIMITED, status: 429, retryAfter: retryAt }
    };

    const error = htmlPageDiscoveryError([outcome], []);

    expect(error.name).toBe('FeedManagementError');
    expect(error.code).toBe('FEED_RATE_LIMITED');
    expect(error.details.retryAfterAt).toBe(retryAt);
    expect(error.message).not.toMatch(/invalid/i);
  });

  it('still degrades a non-rate-limited failure to DISCOVERY_FAILED', () => {
    const outcome = {
      type: FETCH_OUTCOMES.PERMANENT_FAILURE,
      response: { status: 500, headers: {} },
      error: { type: FETCH_OUTCOMES.PERMANENT_FAILURE, status: 500 }
    };

    const error = htmlPageDiscoveryError([outcome], []);
    expect(error.code).toBe('DISCOVERY_FAILED');
  });
});
