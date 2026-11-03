import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForCloudSave } from './cloudRequest';

test('returns success only after cloud acknowledgement', async () => {
  let acknowledge!: (value: string) => void;
  let completed = false;
  const result = waitForCloudSave(new Promise<string>((resolve) => {
    acknowledge = resolve;
  }), 1000).then((value) => {
    completed = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(completed, false);
  acknowledge('saved');
  assert.equal(await result, 'saved');
});

test('preserves permission and server errors', async () => {
  const error = new Error('permission-denied');
  await assert.rejects(waitForCloudSave(Promise.reject(error)), (actual) => actual === error);
});

test('ends waiting without claiming a pending write failed or succeeded', async () => {
  let acknowledge!: () => void;
  const request = new Promise<void>((resolve) => { acknowledge = resolve; });
  await assert.rejects(waitForCloudSave(request, 5), /belum mengonfirmasi/);
  // A late server acknowledgement remains safe after the UI timeout.
  acknowledge();
  await request;
});
