import {jest} from '@jest/globals';
import {response} from './helpers.js';

const load = async () => ({
  api: await import('../../shared/core/api.js'),
  state: await import('../../shared/core/state.js'),
});

afterEach(() => { localStorage.clear(); });

test('sends the bearer token and a JSON body', async () => {
  const {api, state} = await load();
  state.setSession('abc', {id: 1});
  const seen = [];
  globalThis.fetch = async (url, opts) => { seen.push([url, opts]); return response(200, {ok: true}); };
  expect(await api.api('POST', '/things', {a: 1})).toEqual({ok: true});
  const [url, opts] = seen[0];
  expect(url.endsWith('/things')).toBe(true);
  expect(opts.method).toBe('POST');
  expect(opts.headers.Authorization).toBe('Bearer abc');
  expect(opts.headers['Content-Type']).toBe('application/json');
  expect(opts.body).toBe('{"a":1}');
});

test('sends no Authorization header when signed out', async () => {
  const {api, state} = await load();
  state.setSession(null, null);
  let headers;
  globalThis.fetch = async (_u, o) => { headers = o.headers; return response(200, []); };
  await api.api('GET', '/clubs');
  expect(headers.Authorization).toBeUndefined();
});

test.each([
  [403, {}, 'You do not have permission to do that.'],
  [500, {}, 'Something went wrong (error 500).'],
  [404, {detail: 'Club not found'}, 'Club not found'],
  [422, {detail: [{loc: ['body', 'start_time'], msg: 'Value error, must be in the future'}]}, 'start time: must be in the future'],
  [409, {detail: {message: 'Already open'}}, 'Already open'],
])('maps an error response %s to a readable message', async (status, body, message) => {
  const {api, state} = await load();
  state.setSession('t', {});
  globalThis.fetch = async () => response(status, body);
  await expect(api.api('GET', '/x')).rejects.toMatchObject({message, status});
});

test('a network failure names the API address', async () => {
  const {api} = await load();
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await expect(api.api('GET', '/x')).rejects.toMatchObject({status: 0, message: expect.stringContaining('Cannot reach the server at')});
});

test('401 on a signed-in request calls the unauthorized handler with "expired"', async () => {
  const {api, state} = await load();
  const handler = jest.fn();
  api.setUnauthorizedHandler(handler);
  state.setSession('t', {});
  globalThis.fetch = async () => response(401, {detail: 'Invalid token'});
  await expect(api.api('GET', '/clubs')).rejects.toMatchObject({status: 401});
  expect(handler).toHaveBeenCalledWith('expired');
});

test('a failed login (401) is a normal error, not an expired session', async () => {
  const {api, state} = await load();
  const handler = jest.fn();
  api.setUnauthorizedHandler(handler);
  state.setSession('t', {});
  globalThis.fetch = async () => response(401, {detail: 'Invalid credentials'});
  await expect(api.api('POST', '/auth/login', {})).rejects.toMatchObject({message: 'Invalid credentials'});
  expect(handler).not.toHaveBeenCalled();
});

test('the API address comes from the runtime config, with a development-only override', async () => {
  const {api} = await load();
  const {runtimeConfig} = await import('../../shared/config/runtime-config.js');
  expect(api.API()).toBe(runtimeConfig.apiBaseUrl);
  expect(runtimeConfig.allowApiOverride).toBe(true); // the committed file is the development default
  localStorage.setItem('api', 'http://192.168.1.5:8000');
  expect(api.API()).toBe('http://192.168.1.5:8000');
});

test('non-JSON success responses are returned as they are (downloads)', async () => {
  const {api, state} = await load();
  state.setSession('t', {});
  const csv = response(200, 'a,b', 'text/csv');
  globalThis.fetch = async () => csv;
  expect(await api.api('GET', '/x.csv')).toBe(csv);
});

test('dl and blobUrl send the token and report failures', async () => {
  const {api, state} = await load();
  state.setSession('t', {});
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.fetch = async () => response(200, {a: 1});
  expect(await api.blobUrl('/file')).toBe('blob:x');
  await api.dl('/file', 'f.json');
  globalThis.fetch = async () => response(404, {detail: 'No such file'});
  await expect(api.dl('/file', 'f')).rejects.toThrow('No such file');
  await expect(api.blobUrl('/file')).rejects.toThrow('Could not load the file');
});
