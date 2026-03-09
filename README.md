# extension-feature-toggle

Feature toggle with rules: app version, browser (name + min version), and rollout percentage.

## Install

```bash
npm install @ulta-plus/extension-feature-toggle
```

## Usage

`getContext` is called by the library when evaluating rules. It must return data from your **Chrome extension environment**: extension version from `chrome.runtime.getManifest()`, browser name and version from your UA/browser detector, and `userId` from your auth if you use rollout.

```ts
import { featureStore } from "@ulta-plus/extension-feature-toggle";

featureStore.init({
  features: ["feature-a", "feature-b"],
  getConfig: () => fetch("/api/features").then((r) => r.json()),
  getContext: () => {
    const manifest = chrome.runtime.getManifest();
    const { browserName, browserVersion } = detectBrowser(); // from UA or chrome.runtime
    return {
      appVersion: manifest.version,
      browserName,
      browserVersion,
      userId: getUserId(), // from your auth/storage if needed for rollout
    };
  },
  setStorage: (data) => chrome.storage.local.set({ featureToggle: data }),
  getStorage: () =>
    chrome.storage.local
      .get("featureToggle")
      .then((r) => r.featureToggle ?? null),
});

const snapshot = featureStore.getSnapshot();
featureStore.subscribe(() => {});
await featureStore.getSnapshotAsync();
await featureStore.setFeatureValues({ "feature-a": true });
await featureStore.reset();
```

## Config format (backend response)

The **rollout percentage** is set by the backend in each feature rule (`rollout`: 0–1, e.g. `0.5` = 50%). The extension does not pass the percentage; it only passes `userId` (or another stable string) in `getContext()`. The library hashes that and checks if the user falls inside the rolled-out fraction.

Each feature value: `{ "app-version"?: string, browser?: Record<string, number>, rollout?: number }`.

- `app-version` — min extension version (semver).
- `browser` — min major per browser, e.g. `{ "chrome": 120, "firefox": 90 }`. If omitted or empty, the feature is enabled for all browsers and versions (no browser filter).
- `rollout` — fraction 0–1 (0.5 = 50%), **from backend**; extension supplies `userId` in context for the hash. If omitted, the feature is enabled for 100% of users (no rollout filter).

**Example: JSON returned by `getConfig()` (backend response):**

```json
{
  "switch-internet": {
    "app-version": "6.3.7",
    "browser": { "chrome": 120, "firefox": 90 },
    "rollout": 0.5
  },
  "lite": {
    "app-version": "1.0.0"
  },
  "media": {
    "app-version": "2.0.0",
    "browser": { "chrome": 100 },
    "rollout": 1
  }
}
```

Only feature keys that are in the `features` array passed to `init()` are evaluated; other keys in this response are ignored.

## API

- `featureStore.init(options)` — call once with features list, getConfig, getContext, setStorage, getStorage.
- `featureStore.subscribe(listener)` — returns unsubscribe.
- `featureStore.getSnapshot()` — current state (sync).
- `featureStore.getSnapshotAsync()` — state with persisted overrides (async).
- `featureStore.setFeatureValues(partial)` — local overrides.
- `featureStore.reset()` — clear overrides.

Export `FeatureToggleStore` class to create your own instance instead of the default singleton.
