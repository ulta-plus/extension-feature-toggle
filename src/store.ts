import type {
  InitOptions,
  FeatureStoreSnapshot,
  StoredState,
  FeatureConfigResponse,
} from './types';
import { evaluateRule } from './evaluate';

const initialSnapshot: FeatureStoreSnapshot = {
  isInitialized: false,
  featuresList: {},
  loading: false,
  error: null,
};

export class FeatureToggleStore {
  private snapshot: FeatureStoreSnapshot = { ...initialSnapshot };
  private featuresListFromConfig: Record<string, boolean> = {};
  private featuresListLocal: Record<string, boolean> = {};
  private allowedFeatures: string[] = [];
  private getConfig: InitOptions['getConfig'] | null = null;
  private getContext: InitOptions['getContext'] | null = null;
  private setStorage: InitOptions['setStorage'] | null = null;
  private getStorage: InitOptions['getStorage'] | null = null;
  private readonly listeners: Array<() => void> = [];

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private mergeFeaturesList(): Record<string, boolean> {
    return { ...this.featuresListFromConfig, ...this.featuresListLocal };
  }

  private updateSnapshot(partial: Partial<FeatureStoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    if (partial.featuresList != null) {
      this.snapshot.featuresList = partial.featuresList;
    }
  }

  private async persistState(): Promise<void> {
    if (!this.setStorage) return;
    const data: StoredState = {
      featuresList: this.featuresListFromConfig,
      featuresListLocal: this.featuresListLocal,
    };
    await this.setStorage(data);
  }

  init(options: InitOptions): void {
    this.allowedFeatures = options.features;
    this.getConfig = options.getConfig;
    this.getContext = options.getContext;
    this.setStorage = options.setStorage;
    this.getStorage = options.getStorage;

    this.runInit();
  }

  private async runInit(): Promise<void> {
    if (!this.getConfig || !this.getContext || !this.setStorage) return;
    try {
      this.updateSnapshot({ loading: true });
      this.emitChange();

      const stored = this.getStorage ? await this.getStorage() : null;
      if (stored?.featuresListLocal) {
        this.featuresListLocal = { ...stored.featuresListLocal };
      }

      const config: FeatureConfigResponse = await this.getConfig();
      const context = this.getContext();
      const resolved: Record<string, boolean> = {};

      for (const key of this.allowedFeatures) {
        const rule = config[key];
        if (rule == null) {
          resolved[key] = false;
          continue;
        }
        resolved[key] = evaluateRule(rule, context);
      }

      this.featuresListFromConfig = resolved;
      this.updateSnapshot({
        isInitialized: true,
        featuresList: this.mergeFeaturesList(),
        loading: false,
        error: null,
      });
      await this.persistState();
      this.emitChange();
    } catch (err) {
      this.updateSnapshot({
        ...initialSnapshot,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      this.emitChange();
      throw err;
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  getSnapshot(): FeatureStoreSnapshot {
    return this.snapshot;
  }

  async getSnapshotAsync(): Promise<FeatureStoreSnapshot> {
    const stored = this.getStorage ? await this.getStorage() : null;
    const local = stored?.featuresListLocal ?? this.featuresListLocal;
    return {
      ...this.snapshot,
      featuresList: { ...this.featuresListFromConfig, ...local },
    };
  }

  async setFeatureValues(features: Record<string, boolean>): Promise<void> {
    this.featuresListLocal = { ...this.featuresListLocal, ...features };
    this.updateSnapshot({ featuresList: this.mergeFeaturesList() });
    this.emitChange();
    await this.persistState();
  }

  async reset(): Promise<void> {
    this.featuresListLocal = {};
    this.updateSnapshot({ featuresList: this.featuresListFromConfig });
    this.emitChange();
    await this.persistState();
  }
}

export const featureStore = new FeatureToggleStore();
