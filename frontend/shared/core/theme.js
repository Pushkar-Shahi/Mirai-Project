import {h} from './dom.js';

export const THEME_KEY='mirai-theme';
export const theme=()=>document.documentElement.dataset.theme==='light'?'light':'dark';
export function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem(THEME_KEY,t)}catch{}syncThemeButtons()}
function syncThemeButtons(){const dark=theme()==='dark';document.querySelectorAll('.theme-toggle').forEach(b=>{b.textContent=dark?'☀':'☾';b.title=dark?'Switch to light mode':'Switch to dark mode';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(dark))});const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content=dark?'#060814':'#f5f7fb'}
export const themeButton=()=>{const b=h('button',{type:'button',class:'icon-button theme-toggle',onclick:()=>setTheme(theme()==='dark'?'light':'dark')});setTimeout(syncThemeButtons);return b};
