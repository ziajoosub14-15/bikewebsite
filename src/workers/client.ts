import { autoBuild } from '../domain/autobuild';
import { suggestUpgrades } from '../domain/upgrades';
import type { Job } from './heavy.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./heavy.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    return worker;
  } catch {
    return null;
  }
}

/** Run a heavy job off the main thread (falls back to the main thread if workers are unavailable). */
export function runJob(job: Extract<Job, { kind: 'autobuild' }>): Promise<ReturnType<typeof autoBuild>>;
export function runJob(job: Extract<Job, { kind: 'upgrades' }>): Promise<ReturnType<typeof suggestUpgrades>>;
export function runJob(job: Job): Promise<unknown> {
  const w = getWorker();
  if (!w)
    return new Promise((resolve) =>
      setTimeout(() => resolve(job.kind === 'autobuild' ? autoBuild(...job.args) : suggestUpgrades(...job.args)), 20),
    );
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, job });
  });
}
