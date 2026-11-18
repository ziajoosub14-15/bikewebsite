import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { getComponent } from '../data/catalog';
import { DEFAULT_PRESET, PRESET_BUILDS } from '../domain/presets';
import { DEFAULT_CONDITIONS, type Conditions } from '../domain/ride';
import { DEFAULT_RIDER, type RiderProfile } from '../domain/rider';
import type { Route } from '../physics/types';
import { PRESET_ROUTES } from '../routes/presets';
import { localStore, type StoredBuild } from '../storage/buildRepository';
import { CATEGORIES, type BuildSelection, type Category } from '../types/components';
import { PAINTS } from '../ui/labels';

export interface AppState {
  rider: RiderProfile;
  builds: StoredBuild[];
  activeId: string;
  conditions: Conditions;
  routeId: string;
  customRoutes: Route[];
  /** Scene behind the bike in the builder. */
  backdrop: string;
}

const KEY = 'velolab.state.v2';
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function validSelection(sel: Partial<BuildSelection> | undefined): sel is BuildSelection {
  return !!sel && CATEGORIES.every((c) => typeof sel[c] === 'string' && !!getComponent(c, sel[c]!));
}

export function makeBuild(name: string, selection: BuildSelection, paint = PAINTS[1].hex): StoredBuild {
  return { id: uid(), name, selection: { ...selection }, paint, updatedAt: now() };
}

function initialState(): AppState {
  const saved = localStore.load<Partial<AppState> | null>(KEY, null);
  const builds = (saved?.builds ?? []).filter((b) => validSelection(b.selection));
  if (!builds.length) {
    builds.push(makeBuild(PRESET_BUILDS[DEFAULT_PRESET].name, PRESET_BUILDS[DEFAULT_PRESET].selection, PAINTS[1].hex));
    builds.push(makeBuild(PRESET_BUILDS.budgetAlloy.name, PRESET_BUILDS.budgetAlloy.selection, PAINTS[2].hex));
  }
  const customRoutes = saved?.customRoutes ?? [];
  const routeId = saved?.routeId && [...PRESET_ROUTES, ...customRoutes].some((r) => r.id === saved.routeId) ? saved.routeId : 'rolling';
  return {
    rider: { ...DEFAULT_RIDER, ...saved?.rider },
    builds,
    activeId: builds.some((b) => b.id === saved?.activeId) ? saved!.activeId! : builds[0].id,
    conditions: { ...DEFAULT_CONDITIONS, ...saved?.conditions },
    routeId,
    customRoutes,
    backdrop: saved?.backdrop ?? 'mountain-dusk',
  };
}

type Action =
  | { type: 'rider'; patch: Partial<RiderProfile> }
  | { type: 'conditions'; patch: Partial<Conditions> }
  | { type: 'route'; id: string }
  | { type: 'addRoute'; route: Route }
  | { type: 'removeRoute'; id: string }
  | { type: 'updateBuild'; id: string; patch: Partial<StoredBuild> }
  | { type: 'choose'; category: Category; partId: string }
  | { type: 'addBuild'; build: StoredBuild }
  | { type: 'duplicate'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'activate'; id: string }
  | { type: 'backdrop'; id: string };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'rider':
      return { ...s, rider: { ...s.rider, ...a.patch } };
    case 'conditions':
      return { ...s, conditions: { ...s.conditions, ...a.patch } };
    case 'route':
      return { ...s, routeId: a.id };
    case 'addRoute':
      return { ...s, customRoutes: [...s.customRoutes.filter((r) => r.id !== a.route.id), a.route], routeId: a.route.id };
    case 'removeRoute': {
      const customRoutes = s.customRoutes.filter((r) => r.id !== a.id);
      return { ...s, customRoutes, routeId: s.routeId === a.id ? 'rolling' : s.routeId };
    }
    case 'updateBuild':
      return { ...s, builds: s.builds.map((b) => (b.id === a.id ? { ...b, ...a.patch, updatedAt: now() } : b)) };
    case 'choose':
      return {
        ...s,
        builds: s.builds.map((b) => {
          if (b.id !== s.activeId) return b;
          const next: StoredBuild = { ...b, selection: { ...b.selection, [a.category]: a.partId }, updatedAt: now() };
          // A new frame or tyre invalidates manual size / pressure choices.
          if (a.category === 'frame') {
            next.frameSizeCm = undefined;
            if (next.colourwayId !== 'custom') next.colourwayId = undefined;
          }
          if (a.category === 'tyres') next.tyrePressureBar = undefined;
          return next;
        }),
      };
    case 'addBuild':
      return { ...s, builds: [...s.builds, a.build], activeId: a.build.id };
    case 'duplicate': {
      const src = s.builds.find((b) => b.id === a.id);
      if (!src) return s;
      const copy = { ...src, id: uid(), name: `${src.name} (copy)`, updatedAt: now() };
      return { ...s, builds: [...s.builds, copy], activeId: copy.id };
    }
    case 'delete': {
      if (s.builds.length <= 1) return s;
      const builds = s.builds.filter((b) => b.id !== a.id);
      return { ...s, builds, activeId: s.activeId === a.id ? builds[0].id : s.activeId };
    }
    case 'activate':
      return s.builds.some((b) => b.id === a.id) ? { ...s, activeId: a.id } : s;
    case 'backdrop':
      return { ...s, backdrop: a.id };
  }
}

function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  useEffect(() => localStore.save(KEY, state), [state]);
  const active = state.builds.find((b) => b.id === state.activeId) ?? state.builds[0];
  const route = [...PRESET_ROUTES, ...state.customRoutes].find((r) => r.id === state.routeId) ?? PRESET_ROUTES[1];
  const actions = useMemo(
    () => ({
      setRider: (patch: Partial<RiderProfile>) => dispatch({ type: 'rider', patch }),
      setConditions: (patch: Partial<Conditions>) => dispatch({ type: 'conditions', patch }),
      setRoute: (id: string) => dispatch({ type: 'route', id }),
      addRoute: (route: Route) => dispatch({ type: 'addRoute', route }),
      removeRoute: (id: string) => dispatch({ type: 'removeRoute', id }),
      updateBuild: (id: string, patch: Partial<StoredBuild>) => dispatch({ type: 'updateBuild', id, patch }),
      choose: (category: Category, partId: string) => dispatch({ type: 'choose', category, partId }),
      addBuild: (build: StoredBuild) => dispatch({ type: 'addBuild', build }),
      duplicate: (id: string) => dispatch({ type: 'duplicate', id }),
      remove: (id: string) => dispatch({ type: 'delete', id }),
      activate: (id: string) => dispatch({ type: 'activate', id }),
      setBackdrop: (id: string) => dispatch({ type: 'backdrop', id }),
    }),
    [],
  );
  const allRoutes = useMemo(() => [...PRESET_ROUTES, ...state.customRoutes], [state.customRoutes]);
  return { state, active, route, allRoutes, ...actions };
}

type Store = ReturnType<typeof useAppState>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useAppState();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be inside StoreProvider');
  return s;
}

/** Update helper for the active build. */
export function useActiveBuild() {
  const { active, updateBuild } = useStore();
  const update = useCallback((patch: Partial<StoredBuild>) => updateBuild(active.id, patch), [active.id, updateBuild]);
  return { build: active, update };
}
