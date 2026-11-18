import type { BuildSelection } from '../types/components';

/** A build as it is stored. The same shape would be sent to a backend later. */
export interface StoredBuild {
  id: string;
  name: string;
  selection: BuildSelection;
  /** Official colourway id for the frame, or 'custom' to use `paint`. Empty = the frame's first colourway. */
  colourwayId?: string;
  /** Custom paint colour (hex), used when colourwayId is 'custom'. */
  paint: string;
  /** Chosen frame size (cm). Empty = use the fit calculator's recommendation. */
  frameSizeCm?: number;
  /** Tyre pressure (bar). Empty = ideal pressure for the rider's weight. */
  tyrePressureBar?: number;
  updatedAt: string;
}

/**
 * Small key/value persistence used by the app store. Everything goes through here, so moving builds to a
 * server later means replacing these two functions (or making them async behind the store).
 */
export const localStore = {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: the app keeps working without saving */
    }
  },
};
