import {runtimeConfig} from '../config/runtime-config.js';
import {h} from '../core/dom.js';
import {API} from '../core/api.js';
import {CFG} from '../core/state.js';
import {themeButton} from '../core/theme.js';
import {frm} from '../components/forms.js';
import {logo} from '../components/brand.js';

// ---------- the one sign-in screen ----------
// The central sign-in site (frontend/login) and all five portals render this same view, so
// the copy, layout, fonts and colours (shared/styles/app.css) are identical before and
// after sign-in. It names no portal: the account's role decides where the browser goes.
export const loginStory=()=>h('section',{class:'login-story'},logo(),h('div',{class:'story-copy'},h('span',{class:'eyebrow'},`${CFG.institution_name} · Club Activities Tracker`),h('h1',{},'Make every moment',h('br'),h('span',{},'count.')),h('p',{},'One home for clubs, Club Days, check-ins, submissions and the records students are proud to share.'),h('div',{class:'story-stats'},h('div',{},h('strong',{},'01'),h('small',{},'Find your people')),h('div',{},h('strong',{},'02'),h('small',{},'Show what you can do')),h('div',{},h('strong',{},'03'),h('small',{},'Keep your record')))),h('div',{class:'story-footer'},CFG.app_name));

// `site` supplies the page title only. `onSignIn(identifier,password)` throws to show an
// error under the form; while it runs the button is disabled and reads "Signing in…".
export function loginView(site,{message,onSignIn}={}){const A=document.getElementById('app');A.replaceChildren();document.body.className='';document.title=`Sign in · ${CFG.app_short_name}`;
 const f=frm([['identifier','Email or student ID','text',null,{autocomplete:'username'}],['password','Password','password',null,{autocomplete:'current-password'}]],'Continue to workspace',async d=>{
  const b=f.querySelector('[type=submit]'),label=b.textContent;b.textContent='Signing in…';f.setAttribute('aria-busy','true');
  try{await onSignIn(d.identifier.trim(),d.password)}finally{b.textContent=label;f.removeAttribute('aria-busy')}},0,{draft:false});
 const demo=runtimeConfig.demoLogins;
 const demos=h('div',{class:'demo-buttons'},demo.map(([e,,l])=>h('button',{type:'button',class:'s',onclick:()=>{f.identifier.value=e;f.password.value=runtimeConfig.demoPassword}},l)));
 A.append(h('div',{class:'login-screen'},loginStory(),h('section',{class:'login-side'},h('div',{class:'mobile-brand'},logo()),h('div',{class:'login-card'},h('div',{class:'spotlight-head'},h('div',{class:'page-eyebrow'},'Welcome back'),themeButton()),h('h2',{},`Sign in to ${CFG.app_short_name}`),h('p',{},'Use your Mirai account. After you sign in, you are taken to the site for your role.'),message&&h('div',{class:'notice wait',role:'status'},message),f,demo.length?h('div',{class:'demo-area'},h('span',{},`Demo accounts · ${runtimeConfig.demoPassword} · each role opens its own portal (${runtimeConfig.environment} build only)`),demos):null,runtimeConfig.allowApiOverride&&h('details',{class:'api-setting'},h('summary',{},'Connection settings'),h('label',{},'API address',h('input',{value:API(),onchange:e=>{try{localStorage.setItem('api',e.target.value.trim())}catch{}}})))))))}
