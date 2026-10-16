import {api} from '../core/api.js';
import {setSession} from '../core/state.js';
import {loginView} from '../auth/login-view.js';
import {fetchSessionUser,goToRolePortal,safeNext,REASON_MESSAGES} from '../auth/session.js';
import {loadConfig} from './boot-config.js';

// The central sign-in site. It keeps no session of its own: it signs the account in, asks
// the server who it is (GET /auth/me, never browser storage) and opens the portal for that
// role with the token in the URL fragment. `?next=#/Page` (set by a portal that sent the
// visitor here) is the page to open there; `?reason=expired|signed_out` explains why.
export async function startLogin(site){
 await loadConfig();
 const q=new URLSearchParams(location.search),next=safeNext(q.get('next')),message=REASON_MESSAGES[q.get('reason')];
 loginView(site,{message,onSignIn:async(identifier,password)=>{
  const r=await api('POST','/auth/login',{identifier,password});
  const user=await fetchSessionUser(r.access_token);
  setSession(null,null);
  if(!goToRolePortal(user,r.access_token,{next}))throw new Error('Your account does not have a portal yet. Ask your campus manager.')}})}
