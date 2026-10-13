import {runtimeConfig} from '../config/runtime-config.js';
import {portalForRole} from '../config/portals.js';
import {api} from '../core/api.js';
import {setSession} from '../core/state.js';

// Sign-in state for one portal.
//
// The server decides who the user is and which role they have (POST /auth/login and
// GET /auth/me). After a successful login the browser opens the portal for that role:
// campus manager credentials open the Campus Manager Portal, super admin credentials
// open the Super Admin Portal, and so on. A portal still checks the role before it
// shows its own pages. That check is for the user's benefit and is not a security
// boundary: the API enforces every permission and campus/club scope on every request.
//
// The bearer token lives in sessionStorage (this tab only), under a key per portal so
// two portals served from one origin during development never share a session.
const tokenKey=portal=>`mirai:${portal.portalId}:token`;
const HANDOFF='#handoff=';
export const storedToken=portal=>{try{return sessionStorage.getItem(tokenKey(portal))}catch{return null}};
export const storeToken=(portal,token)=>{try{sessionStorage.setItem(tokenKey(portal),token)}catch{}};
export const roleMatches=(portal,user)=>!!user&&user.role===portal.expectedRole;

export const portalUrlForRole=role=>{
 const home=portalForRole(role);
 return home&&runtimeConfig.portalUrls?.[home.id]||null};

// Reads a one-time token from the address bar (#handoff=…) and removes it so it is not
// left in history. Used when another page sends this account to the portal for its role.
export function takeHandoffToken(){
 const hash=location.hash||'';
 if(!hash.startsWith(HANDOFF))return null;
 const token=decodeURIComponent(hash.slice(HANDOFF.length));
 try{history.replaceState(null,'',location.pathname+location.search)}catch{}
 return token||null}

// Opens the portal that serves this role, carrying the token in the fragment so it is
// not sent to the server. `url` overrides the configured address (the local hub).
export function goToRolePortal(user,token,{url}={}){
 const destUrl=url||portalUrlForRole(user.role);
 if(!destUrl||!token)return false;
 const dest=new URL(destUrl,location.href);
 dest.hash='handoff='+encodeURIComponent(token);
 location.replace(dest.href);
 return true}

// Returns {ok:true,user} for an account this portal serves. For another role it returns
// {ok:false,user,access_token} without storing the token here, so the caller can send
// the browser to that role's portal. Bad credentials throw ApiError.
export async function signIn(portal,identifier,password){
 const r=await api('POST','/auth/login',{identifier,password});
 if(!roleMatches(portal,r.user))return{ok:false,user:r.user,access_token:r.access_token};
 storeToken(portal,r.access_token);setSession(r.access_token,r.user);return{ok:true,user:r.user}}

// Asks the server who the stored token belongs to. The token is used for this request
// only; the session starts after the role matches.
export async function fetchSessionUser(token){setSession(token,null);return api('GET','/auth/me')}

export function clearSession(portal){setSession(null,null);try{sessionStorage.removeItem(tokenKey(portal))}catch{}}
