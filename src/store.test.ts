import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureToggleStore } from './store';
import type { EvaluationContext, FeatureConfigResponse, StoredState } from './types';

const baseContext: EvaluationContext = {
  appVersion: '6.0.0',
  browserName: 'chrome',
  browserVersion: '120.0.0',
  deviceId: 'user-1',
};

function makeStore() {
  return new FeatureToggleStore();
}

/** Waits until the store is no longer in loading state. */
async function waitForInit(store: FeatureToggleStore, timeout = 500): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const snap = store.getSnapshot();
    if (!snap.loading && (snap.isInitialized || snap.error)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Store did not initialize in time');
}

describe('FeatureToggleStore — initial state', () => {
  it('starts uninitialized, not loading, no error', () => {
    const store = makeStore();
    const snap = store.getSnapshot();
    expect(snap.isInitialized).toBe(false);
    expect(snap.loading).toBe(false);
    expect(snap.error).toBeNull();
    expect(snap.featuresList).toEqual({});
  });
});

describe('FeatureToggleStore — init', () => {
  it('sets loading to true while fetching config', async () => {
    const store = makeStore();
    let resolveConfig!: (v: FeatureConfigResponse) => void;
    const getConfig = () =>
      new Promise<FeatureConfigResponse>((res) => {
        resolveConfig = res;
      });

    store.init({
      features: ['featureA'],
      getConfig,
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    expect(store.getSnapshot().loading).toBe(true);
    resolveConfig({});
    await waitForInit(store);
  });

  it('resolves enabled features from config', async () => {
    const store = makeStore();
    const config: FeatureConfigResponse = {
      featureA: { 'app-version': '5.0.0' },
      featureB: { 'app-version': '99.0.0' },
    };

    store.init({
      features: ['featureA', 'featureB'],
      getConfig: () => Promise.resolve(config),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    const snap = store.getSnapshot();
    expect(snap.isInitialized).toBe(true);
    expect(snap.loading).toBe(false);
    expect(snap.featuresList.featureA).toBe(true);
    expect(snap.featuresList.featureB).toBe(false);
  });

  it('marks feature as false when it is absent from config', async () => {
    const store = makeStore();

    store.init({
      features: ['missingFeature'],
      getConfig: () => Promise.resolve({}),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    expect(store.getSnapshot().featuresList.missingFeature).toBe(false);
  });

  it('ignores config keys not listed in features', async () => {
    const store = makeStore();
    const config: FeatureConfigResponse = { unlisted: {} };

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve(config),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    const featuresList = store.getSnapshot().featuresList;
    expect('unlisted' in featuresList).toBe(false);
    expect('featureA' in featuresList).toBe(true);
  });

  it('persists state via setStorage after init', async () => {
    const store = makeStore();
    const setStorage = vi.fn().mockResolvedValue(undefined);

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: {} }),
      getContext: () => baseContext,
      setStorage,
    });

    await waitForInit(store);
    expect(setStorage).toHaveBeenCalledOnce();
    expect(setStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        featuresList: { featureA: true },
        featuresListLocal: {},
      }),
    );
  });

  it('loads featuresListLocal from getStorage before evaluating config', async () => {
    const store = makeStore();
    const stored: StoredState = {
      featuresList: {},
      featuresListLocal: { featureA: true },
    };

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: { 'app-version': '99.0.0' } }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
      getStorage: () => Promise.resolve(stored),
    });

    await waitForInit(store);
    // Config says false, but local override says true
    expect(store.getSnapshot().featuresList.featureA).toBe(true);
  });

  it('sets error on snapshot when getConfig rejects', async () => {
    const store = makeStore();
    const error = new Error('Network error');

    // runInit re-throws after updating the snapshot so init() produces an
    // unhandled rejection (init does not await runInit). Attach a no-op
    // handler to keep the test output clean.
    const suppress = (reason: unknown) => { if (reason !== error) throw reason as Error; };
    process.on('unhandledRejection', suppress);

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.reject(error),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    process.off('unhandledRejection', suppress);

    const snap = store.getSnapshot();
    expect(snap.isInitialized).toBe(false);
    expect(snap.error).toBe(error);
  });
});

describe('FeatureToggleStore — subscribe / unsubscribe', () => {
  it('notifies listener on init completion', async () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: {} }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    expect(listener).toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', async () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: {} }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });

    await waitForInit(store);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('FeatureToggleStore — setFeatureValues', () => {
  it('overrides a feature value locally', async () => {
    const store = makeStore();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: { 'app-version': '99.0.0' } }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });
    await waitForInit(store);
    expect(store.getSnapshot().featuresList.featureA).toBe(false);

    await store.setFeatureValues({ featureA: true });
    expect(store.getSnapshot().featuresList.featureA).toBe(true);
  });

  it('notifies listeners when feature values change', async () => {
    const store = makeStore();
    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({}),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });
    await waitForInit(store);

    const listener = vi.fn();
    store.subscribe(listener);
    await store.setFeatureValues({ featureA: true });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('persists updated local overrides via setStorage', async () => {
    const setStorage = vi.fn().mockResolvedValue(undefined);
    const store = makeStore();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({}),
      getContext: () => baseContext,
      setStorage,
    });
    await waitForInit(store);

    setStorage.mockClear();
    await store.setFeatureValues({ featureA: true });

    expect(setStorage).toHaveBeenCalledOnce();
    expect(setStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        featuresListLocal: { featureA: true },
      }),
    );
  });
});

describe('FeatureToggleStore — reset', () => {
  it('clears local overrides and restores config-based values', async () => {
    const store = makeStore();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: { 'app-version': '99.0.0' } }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });
    await waitForInit(store);

    await store.setFeatureValues({ featureA: true });
    expect(store.getSnapshot().featuresList.featureA).toBe(true);

    await store.reset();
    expect(store.getSnapshot().featuresList.featureA).toBe(false);
  });

  it('notifies listeners after reset', async () => {
    const store = makeStore();
    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({}),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });
    await waitForInit(store);

    const listener = vi.fn();
    store.subscribe(listener);
    await store.reset();
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('FeatureToggleStore — getSnapshotAsync', () => {
  it('merges config values with local overrides from getStorage', async () => {
    const stored: StoredState = {
      featuresList: { featureA: false },
      featuresListLocal: { featureA: true },
    };
    const store = makeStore();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: {} }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
      getStorage: () => Promise.resolve(stored),
    });
    await waitForInit(store);

    const snap = await store.getSnapshotAsync();
    expect(snap.featuresList.featureA).toBe(true);
  });

  it('returns current in-memory state when getStorage is not provided', async () => {
    const store = makeStore();

    store.init({
      features: ['featureA'],
      getConfig: () => Promise.resolve({ featureA: {} }),
      getContext: () => baseContext,
      setStorage: vi.fn(),
    });
    await waitForInit(store);

    const snap = await store.getSnapshotAsync();
    expect(snap.featuresList.featureA).toBe(true);
    expect(snap.isInitialized).toBe(true);
  });
});
