/// <reference lib="webworker" />
import { autoBuild } from '../domain/autobuild';
import { suggestUpgrades } from '../domain/upgrades';

export type Job =
  | { kind: 'autobuild'; args: Parameters<typeof autoBuild> }
  | { kind: 'upgrades'; args: Parameters<typeof suggestUpgrades> };

self.onmessage = (e: MessageEvent<{ id: number; job: Job }>) => {
  const { id, job } = e.data;
  try {
    const result = job.kind === 'autobuild' ? autoBuild(...job.args) : suggestUpgrades(...job.args);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
