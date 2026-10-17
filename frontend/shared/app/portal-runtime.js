import {setUnauthorizedHandler} from '../core/api.js';
import {setSession,clearLiveTimer} from '../core/state.js';
import {configureRouter,watchHash,homeOf,hasPage,pageOfHash} from '../navigation/router.js';
import {loadConfig} from './boot-config.js';
import {loginView} from '../auth/login-view.js';
import {roleMismatchView} from '../auth/role-mismatch-view.js';
import {storedToken,storeToken,signIn,fetchSessionUser,roleMatches,clearSession,takeHandoff,goToRolePortal,goToLogin,safeNext,REASON_MESSAGES} from '../auth/session.js';
import {shell,stopBadgeTimer} from './shell.js';

// Starts one role portal: `portal` is its portal-config.js, `pages` maps each page id in
// portal.pages to the function that renders it.
export function startPortal(portal,pages){
 const missing=portal.pages.filter(t=>typeof pages[t]!=='function');
 if(missing.length)throw new Error(`${portal.portalId}: no page for ${missing.join(', ')}`);
 configureRouter(portal,pages);watchHash();
 setUnauthorizedHandler(reason=>signOut(portal,reason));
 boot(portal)}

// Signed out. With a central sign-in site configured the browser goes there, carrying the
// reason and the page the user wanted; otherwise this portal shows the same sign-in screen.
// `reason` is a key of REASON_MESSAGES; `text` is any other message to show.
function showLogin(portal,{reason,text}={}){
 const wanted=safeNext(location.hash);
 if(goToLogin({reason,next:wanted}))return;
 loginView(portal,{message:text||REASON_MESSAGES[reason],onSignIn:async(identifier,password)=>{
  const r=await signIn(portal,identifier,password);
  if(!r.ok){
   // Campus manager, super admin, student, … each open their own site.
   if(goToRolePortal(r.user,r.access_token,{next:wanted}))return;
   return roleMismatchView(portal,r.user,()=>signOut(portal))}
  history.replaceState(null,'',wanted&&hasPage(pageOfHash(wanted))?wanted:'#/'+encodeURIComponent(homeOf()));
  shell(portal,()=>signOut(portal))}})}

// An expired session keeps the current page in the address bar so signing in again returns
// to it; an explicit sign-out starts fresh.
function signOut(portal,reason='signed_out'){clearSession(portal);try{sessionStorage.clear()}catch{}clearLiveTimer();stopBadgeTimer();
 if(reason!=='expired')history.replaceState(null,'',location.pathname+location.search);
 showLogin(portal,{reason})}

async function boot(portal){await loadConfig();
 const handed=takeHandoff();
 const token=handed.token||storedToken(portal);if(!token)return showLogin(portal);
 let user;
 try{user=await fetchSessionUser(token)}
 catch(e){
  // 401: the API client has already signed out and said the session ended.
  if(e.status===401)return;
  // Network failure: keep the stored token for a later reload, but start signed out.
  if(!e.status){setSession(null,null);return showLogin(portal,{text:e.message})}
  clearSession(portal);return showLogin(portal,{text:e.message})}
 if(!roleMatches(portal,user)){clearSession(portal);return roleMismatchView(portal,user,()=>signOut(portal))}
 if(handed.token)storeToken(portal,handed.token);
 if(handed.next&&hasPage(pageOfHash(handed.next)))history.replaceState(null,'',handed.next);
 setSession(token,user);shell(portal,()=>signOut(portal))}
