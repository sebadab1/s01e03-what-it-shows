import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { deskRef } from '../src/lib/kb/desk-ref.ts';

const base = 'http://127.0.0.1:4173';
const route = '/kb/incidents/4471-causes/';
const output = new URL('../rendered/', import.meta.url);
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
server.on('error', (error) => { serverOutput += error.message; });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview server exited: ${serverOutput}`);
    try {
      ready = (await fetch(base + route)).ok;
    } catch {
      // The child process may not yet be listening.
    }
    if (ready) break;
    await setTimeout(100);
  }
  assert.ok(ready, `Preview server did not become ready: ${serverOutput}`);
  browser = await chromium.launch({
    ...(process.env.KB_BROWSER_EXECUTABLE ? { executablePath: process.env.KB_BROWSER_EXECUTABLE } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); });
  const response = await page.goto(base + route, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await expect(page.locator('h1')).toHaveText('#4471 · two causes behind wrong dates');
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('td').nth(0)).toHaveText('parser');
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('379');
  await expect(rows.nth(1).locator('td').nth(0)).toHaveText('hint');
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText('33');
  const ref = deskRef('sebadab1');
  await expect(page.locator('.stamp')).toHaveText(`desk ref ${ref}`);
  await expect(page.locator('a[href="https://github.com/sebadab1/s01e03-what-it-shows/issues/1"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://github.com/sebadab1/s01e03-what-it-shows/issues/2"]')).toHaveCount(1);
  await expect(page.locator('.stamp.missing')).toHaveCount(0);
  await expect(page.locator('.status')).toHaveText('closed');
  await expect(page.locator('main')).toContainText('Parser — FIXED');
  await expect(page.locator('main')).toContainText(/Hint — WON['’]T FIX/);
  await expect(page.locator('main')).toContainText('booking-v3 form retired');
  assert.deepEqual(errors, [], 'The rendered page must not raise browser errors.');

  await mkdir(output, { recursive: true });
  await page.screenshot({ path: new URL('4471-causes.png', output).pathname, fullPage: true });
  const html = await page.evaluate(() => {
    const css = [...document.styleSheets].map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('\n')).join('\n');
    const root = document.documentElement.cloneNode(true);
    for (const element of root.querySelectorAll('script, link[rel="stylesheet"], link[rel="modulepreload"], link[rel="preload"]')) element.remove();
    const style = document.createElement('style');
    style.textContent = css;
    root.querySelector('head').append(style);
    const generator = document.createElement('meta');
    generator.name = 'generator';
    generator.content = 'Captured from the built Svelte KB with Playwright; styles inlined for offline review.';
    root.querySelector('head').append(generator);
    return '<!doctype html>\n' + root.outerHTML;
  });
  await writeFile(new URL('4471-causes.html', output), html);

  // Reopen the standalone file to verify it does not depend on the local preview server.
  await page.goto(new URL('4471-causes.html', output).href);
  await expect(page.locator('.stamp')).toHaveText(`desk ref ${ref}`);
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  await expect(page.locator('link[rel="stylesheet"], script')).toHaveCount(0);
  await expect(page.locator('.status')).toHaveText('closed');
  await expect(page.locator('main')).toContainText('Parser — FIXED');
  await expect(page.locator('main')).toContainText(/Hint — WON['’]T FIX/);
  assert.deepEqual(errors, []);
  console.log(`Verified the built page and standalone HTML: 412 reports, parser 379, hint 33, desk ref ${ref}.`);
  console.log('Saved rendered/4471-causes.html and rendered/4471-causes.png.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
