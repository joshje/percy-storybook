import PromisePool from 'es6-promise-pool';
import runSnapshot from './runSnapshot';

const concurrency = 5;

export default function runSnapshots(percyClient, build, snapshots, html, getQueryParams) {
  function* generatePromises() {
    for (const snapshot of snapshots) {
      yield runSnapshot(percyClient, build, snapshot, html, getQueryParams);
    }
  }

  const pool = new PromisePool(generatePromises(), concurrency);
  return pool.start();
}
