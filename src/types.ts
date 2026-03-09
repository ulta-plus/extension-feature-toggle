/**
 * Rule for a single feature (backend response format).
 */
export interface FeatureRule {
  "app-version"?: string;
  browser?: Record<string, number>;
  rollout?: number;
}

export type FeatureConfigResponse = Record<string, FeatureRule>;

/**
 * Context for evaluating rules (provided by the app).
 */
export interface EvaluationContext {
  appVersion: string;
  browserName: string;
  browserVersion: string;
  deviceId?: string;
}

/**
 * Store initialization options.
 */
export interface InitOptions {
  /** Feature keys to consider (other config keys are ignored). */
  features: string[];
  /** Fetches config from backend. */
  getConfig: () => Promise<FeatureConfigResponse>;
  /** Returns context (app version, browser, deviceId). */
  getContext: () => EvaluationContext;
  /** Persists state (featuresList + featuresListLocal). */
  setStorage: (data: StoredState) => void | Promise<void>;
  /** Reads persisted state (optional). */
  getStorage?: () => Promise<StoredState | null | undefined>;
}

/**
 * State passed to setStorage and returned from getStorage.
 */
export interface StoredState {
  featuresList: Record<string, boolean>;
  featuresListLocal: Record<string, boolean>;
}

/**
 * Store snapshot (returned by getSnapshot / getSnapshotAsync).
 */
export interface FeatureStoreSnapshot {
  isInitialized: boolean;
  featuresList: Record<string, boolean>;
  loading: boolean;
  error: Error | null;
}
