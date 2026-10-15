import { describe, expect, it } from 'vitest';

import { createHttpRequest } from '../../services/feeds/http/contracts.js';
import { executeHttpRequest } from '../../services/feeds/http/fetchTransport.js';

// Grants every hop without touching the real SSRF-guarded connector.
const noopRequestPolicy = { acquire: async () => () => {} };

const fakeResponse = (status, headers = {}, url = 'https://example.com/feed') => ({
  status,
  url,
  headers: new Headers(headers),
  body: null
});

const buildRequest = () => createHttpRequest({
  url: 'https://example.com/feed',
  retries: 0,
  connectTimeoutMs: 1000,
  bodyTimeoutMs: 1000,
  deadlineAt: Date.now() + 60000
});

describe('executeHttpRequest rate-limit backoff', () => {
  it('waits for the reset window and retries once (x-ratelimit-reset)', async () => {
    let calls = 0;
    const fetchImplementation = async () => {
      calls += 1;
      if (calls === 1) {
        return fakeResponse(429, { 'x-ratelimit-reset': '1' });
      }
      return fakeResponse(200, { 'content-type': 'application/rss+xml' });
    };

    const result = await executeHttpRequest(buildRequest(), fetchImplementation, {
      requestPolicy: noopRequestPolicy
    });

    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(200);
    expect(result.attempts).toBe(2);
    expect(calls).toBe(2);
  });

  it('honors Retry-After delta-seconds as well', async () => {
    let calls = 0;
    const fetchImplementation = async () => {
      calls += 1;
      if (calls === 1) return fakeResponse(429, { 'retry-after': '1' });
      return fakeResponse(200, {});
    };

    const result = await executeHttpRequest(buildRequest(), fetchImplementation, {
      requestPolicy: noopRequestPolicy
    });

    expect(result.response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('does not retry when no reset header is present', async () => {
    let calls = 0;
    const fetchImplementation = async () => {
      calls += 1;
      return fakeResponse(429, {});
    };

    const result = await executeHttpRequest(buildRequest(), fetchImplementation, {
      requestPolicy: noopRequestPolicy
    });

    expect(result.response.status).toBe(429);
    expect(calls).toBe(1);
  });
});
