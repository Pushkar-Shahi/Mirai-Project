import {runtimeConfig} from './shared/config/runtime-config.js';
import {portalForRole} from './shared/config/portals.js';
import {api,API} from './shared/core/api.js';
import {h} from './shared/core/dom.js';
import {themeButton} from './shared/core/theme.js';
import {frm} from './shared/components/forms.js';
import {goToRolePortal} from './shared/auth/session.js';

// Default API for remote/cloud deployments (Cloudflare Pages)
if (typeof window !== 'undefined' && !localStorage.getItem('api')) {
  if (location.hostname && !['localhost', '127.0.0.1'].includes(location.hostname) && !location.hostname.startsWith('192.168.') && !location.hostname.startsWith('10.')) {
    localStorage.setItem('api', 'https://club-tracker-demo-api.onrender.com');
  }
}

// Local development hub: one sign-in. The account's role chooses the website.
const mount=document.getElementById('hub-login');
if(mount){
 const f=frm([['identifier','Email or student ID','text',null,{autocomplete:'username'}],['password','Password','password',null,{autocomplete:'current-password'}]],'Open my portal',async d=>{
  const r=await api('POST','/auth/login',{identifier:d.identifier.trim(),password:d.password});
  const home=portalForRole(r.user.role);
  if(!home||!goToRolePortal(r.user,r.access_token,{url:`apps/${home.id}/`}))
   throw new Error('This account does not have a portal yet.');
 },0,{draft:false});
 const demo=runtimeConfig.demoLogins;
 mount.replaceWith(h('div',{class:'card login-card hub-login-card'},
  h('div',{class:'spotlight-head'},h('div',{class:'page-eyebrow'},'Sign in'),themeButton()),
  h('h2',{},'Use your account'),
  h('p',{},'Campus manager credentials open the campus manager site. Super admin credentials open the super admin site. Student, advisor and coordinator accounts work the same way.'),
  f,
  demo.length?h('div',{class:'demo-area'},h('span',{},`Demo accounts · ${runtimeConfig.demoPassword}`),
   h('div',{class:'demo-buttons'},demo.map(([e,,l])=>h('button',{type:'button',class:'s',onclick:()=>{f.identifier.value=e;f.password.value=runtimeConfig.demoPassword}},l)))):null,
  runtimeConfig.allowApiOverride?h('details',{class:'api-setting'},h('summary',{},'Connection settings'),h('label',{},'API address',h('input',{value:API(),onchange:e=>{try{localStorage.setItem('api',e.target.value.trim())}catch{}}}))):null));
}
