import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { causeOf, dayFirst, groupByCause, readAs, uniqueById } from '../src/lib/kb/causes.ts';
import { deskRef } from '../src/lib/kb/desk-ref.ts';

const data = new URL('../src/lib/data/', import.meta.url);
const rows = JSON.parse(await readFile(new URL('reports-4471.json', data), 'utf8'));
const notes = JSON.parse(await readFile(new URL('desk-notes.json', data), 'utf8'));
const tenants = new Map();
for (const name of await readdir(new URL('tenants/', data))) {
  const tenant = JSON.parse(await readFile(new URL(`tenants/${name}`, data), 'utf8'));
  tenants.set(tenant.handle, tenant);
}
const tenantOf = (report) => tenants.get(report.tenant);
const reports = uniqueById(rows).filter((report) => report.mergedInto === 4471);
const groups = groupByCause(reports, tenantOf);

test('overlapping export rows do not inflate the report count', () => {
  assert.equal(rows.length, 427);
  assert.equal(reports.length, 412);
  const first = new Map();
  for (const row of rows) {
    if (first.has(row.id)) assert.deepEqual(row, first.get(row.id));
    else first.set(row.id, row);
  }
});

test('tenant locale and booking form produce the accepted cause counts', () => {
  for (const tenant of tenants.values()) assert.equal(dayFirst(tenant.locale), true);
  assert.deepEqual(Object.fromEntries(groups.map((group) => [group.cause, group.reports.length])), {
    parser: 379,
    hint: 33,
  });
});

test('the intake guess is not the cause classifier', () => {
  const disagreements = reports.filter((report) => causeOf(report, tenantOf(report)) !== report.meta.intakeTag);
  assert.equal(disagreements.length, 38);
  assert.equal(causeOf({ channel: 'email' }, undefined), null);
});

test('desk-noted one-day moves remain included, not double-counted', () => {
  assert.equal(readAs(groups.find((group) => group.cause === 'parser'), notes.oneDayMove), 5);
  assert.equal(readAs(groups.find((group) => group.cause === 'hint'), notes.oneDayMove), 0);
});

test('the page has one signature and uses the computed table and stamp', async () => {
  const page = await readFile(new URL('../src/routes/kb/incidents/4471-causes/+page.svx', import.meta.url), 'utf8');
  assert.match(page, /^signature: sebadab1$/m);
  assert.match(page, /<CauseTable ticket=\{4471\} \/>/);
  assert.match(page.trimEnd(), /<RenderStamp \{signature\} \/>$/);
  assert.doesNotMatch(page, /const signature\s*=/);
  assert.match(deskRef('sebadab1'), /^DR-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
});

test('the page distinguishes the reported fix from the retired form', async () => {
  const page = await readFile(new URL('../src/routes/kb/incidents/4471-causes/+page.svx', import.meta.url), 'utf8');
  assert.match(page, /^status: closed$/m);
  assert.match(page, /Parser — FIXED/);
  assert.match(page, /fix\(dates\): parse dd\/mm for eu locales/);
  assert.match(page, /Hint — WON'T FIX/);
  assert.match(page, /booking-v3 form retired/);
  assert.match(page, /closed as not planned, not as a shipped hint fix/);
  assert.match(page, /not production changes made in this repo/);
});
