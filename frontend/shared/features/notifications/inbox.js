import {h,toast,go} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {me,CFG} from '../../core/state.js';
import {fmt,STATUS} from '../../core/format.js';
import {pill,card,heading,btn,tbl} from '../../components/ui.js';
import {kindLabel,noticeText} from './notice-text.js';
import {updateBadge} from './badge.js';

// ---------- Notifications ----------
export const notificationsPage=async b=>{const box=h('div'),emailBox=h('div');
 const refresh=async()=>{const r=await api('GET','/notifications?limit=100');
  box.replaceChildren(h('div',{class:'filters'},h('span',{class:'mut'},`${fmt.n(r.unread_count)} unread`),r.unread_count?btn('Mark all read',async()=>{await api('POST','/notifications/read-all',{});refresh()},'s'):null),
   tbl(r.items,[['Notice',n=>[h('strong',{},kindLabel(n.kind)),h('small',{class:'field-hint'},noticeText(n))]],['Received',n=>h('span',{class:'nowrap'},fmt.dt(n.send_at))],['Status',n=>h('div',{class:'pill-row'},n.cancelled_at?pill('outdated','Outdated (rescheduled)'):pill(n.read_at?'read':'unread'),...(n.deliveries||[]).map(d=>pill(d.status,`${d.channel==='email'?'Email':'WhatsApp'}: ${STATUS[d.status]?.[0]||d.status}`)))],['',n=>!n.read_at&&btn('Mark read',async()=>{await api('POST',`/notifications/${n.id}/read`,{});refresh()},'s')]],'Your inbox is empty'));updateBadge()};
 const renderEmail=async()=>{
  try {
   const p=await api('GET','/notifications/email-preference'),cb=h('input',{type:'checkbox',checked:p.enabled});
   cb.onchange=()=>go(async()=>{const r=await api('PUT','/notifications/email-preference',{enabled:cb.checked});toast(r.enabled?'Email notifications on':'Email notifications off')});
   emailBox.replaceChildren(h('label',{class:'check-field'},cb,h('span',{},`Email me reminders at ${me.email || "my account email"}`)),!p.available&&h('p',{class:'mut'},'Email delivery is not configured on this server yet; your choice is saved for when it is.'))
  } catch(e) {
   emailBox.replaceChildren(h('p',{class:'mut'},'Email notifications are not configured on this server.'));
  }
 };
 b.append(card(heading('Saved on the server','Notifications',btn('Refresh',refresh,'s')),box),card(heading('Optional','Email'),emailBox));
 await Promise.all([refresh(),renderEmail()])};

