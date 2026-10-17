import {startLogin} from '../shared/app/login-runtime.js';
import {LOGIN_SITE} from '../shared/config/portals.js';

// The central sign-in site: the same screen every portal shows, then a redirect to the
// portal for the account's role.
startLogin(LOGIN_SITE);
