import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FRONTEND} from './helpers.js';

const mod = p => import(pathToFileURL(path.join(FRONTEND, p)).href);
const PORTALS = ['super-admin', 'campus-manager', 'advisor', 'coordinator', 'student'];

describe.each(PORTALS)('%s navigation', id => {
  test('every nav item resolves to a page function, metadata and an icon, and nothing else is registered', async () => {
    const {portalConfig} = await mod(`apps/${id}/portal-config.js`);
    const {pages} = await mod(`apps/${id}/pages.js`);
    const {pageCopy, navGlyph} = await mod('shared/navigation/page-meta.js');
    expect(Object.keys(pages)).toEqual([...portalConfig.pages]);
    for (const tab of portalConfig.pages) {
      expect(typeof pages[tab]).toBe('function');
      expect(pageCopy[tab]).toBeTruthy();
      expect(navGlyph[tab]).toBeTruthy();
    }
  });

  test('the router opens only this portal\'s pages and falls back to home', async () => {
    const {portalConfig} = await mod(`apps/${id}/portal-config.js`);
    const {pages} = await mod(`apps/${id}/pages.js`);
    const router = await mod('shared/navigation/router.js');
    router.configureRouter(portalConfig, pages);
    expect(router.homeOf()).toBe(portalConfig.pages[0]);
    for (const tab of portalConfig.pages) expect(router.hasPage(tab)).toBe(true);
    expect(router.hasPage('Definitely not a page')).toBe(false);
  });
});

test('page hashes round-trip, including names with a space', async () => {
  const {pageOfHash} = await mod('shared/navigation/router.js');
  expect(pageOfHash('#/Notification%20log')).toBe('Notification log');
  expect(pageOfHash('#/Check-in?session=4')).toBe('Check-in');
  expect(pageOfHash('')).toBe('');
});
