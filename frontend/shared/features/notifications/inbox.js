import {h,toast,go} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {me,CFG,roleLabel} from '../../core/state.js';
import {fmt,STATUS,formatPersonLabel} from '../../core/format.js';
import {pill,card,heading,btn,tbl} from '../../components/ui.js';
import {kindLabel,noticeText} from './notice-text.js';
import {updateBadge} from './badge.js';

// ---------- Notifications (with Received and Sent sections for authorities) ----------
export const notificationsPage=async b=>{
 const box=h('div'),emailBox=h('div');
 const isAuthority=['super_admin','campus_admin','advisor','coordinator'].includes(me?.role);
 let activeTab='received';
 let receivedOffset=0,sentOffset=0;
 const limit=50;

 const loadReceived=async()=>{
  const query=receivedOffset===0?'limit=100':`limit=${limit}&offset=${receivedOffset}`;
  const r=await api('GET',`/notifications?${query}`);
  const total=r.total??(r.items?.length||0);

  const pager=h('div',{class:'pager'},
   `${total?receivedOffset+1:0}–${Math.min(receivedOffset+limit,total)} of ${fmt.n(total)}`,
   h('button',{type:'button',class:'s',disabled:receivedOffset===0,onclick:()=>{receivedOffset=Math.max(0,receivedOffset-limit);go(render)}},'Previous'),
   h('button',{type:'button',class:'s',disabled:receivedOffset+limit>=total,onclick:()=>{receivedOffset+=limit;go(render)}},'Next')
  );

  const actions=h('div',{class:'filters'},
   h('span',{class:'mut'},`${fmt.n(r.unread_count)} unread`),
   r.unread_count?btn('Mark all read',async()=>{await api('POST','/notifications/read-all',{});render()},'s'):null
  );

  const table=tbl(r.items||[],[
   ['Notice',n=>[h('strong',{},kindLabel(n.kind)),h('small',{class:'field-hint'},noticeText(n))]],
   ['Received',n=>h('span',{class:'nowrap'},fmt.dt(n.send_at))],
   ['Status',n=>h('div',{class:'pill-row'},n.cancelled_at?pill('outdated','Outdated (rescheduled)'):pill(n.read_at?'read':'unread'),...(n.deliveries||[]).map(d=>pill(d.status,`${d.channel==='email'?'Email':'WhatsApp'}: ${STATUS[d.status]?.[0]||d.status}`)))],
   ['',n=>!n.read_at&&btn('Mark read',async()=>{await api('POST',`/notifications/${n.id}/read`,{});render()},'s')]
  ],'Your inbox is empty');

  box.replaceChildren(actions,table,pager);
  updateBadge();
 };

 const loadSent=async()=>{
  const r=await api('GET',`/notifications/sent?limit=${limit}&offset=${sentOffset}`).catch(()=>({total:0,items:[]}));
  const total=r.total??(r.items?.length||0);

  const pager=h('div',{class:'pager'},
   `${total?sentOffset+1:0}–${Math.min(sentOffset+limit,total)} of ${fmt.n(total)}`,
   h('button',{type:'button',class:'s',disabled:sentOffset===0,onclick:()=>{sentOffset=Math.max(0,sentOffset-limit);go(render)}},'Previous'),
   h('button',{type:'button',class:'s',disabled:sentOffset+limit>=total,onclick:()=>{sentOffset+=limit;go(render)}},'Next')
  );

  const table=tbl(r.items||[],[
   ['Notice',n=>[h('strong',{},kindLabel(n.kind)),h('small',{class:'field-hint'},noticeText(n))]],
   ['Sent',n=>h('span',{class:'nowrap'},fmt.dt(n.send_at))],
   ['Recipient',n=>[h('strong',{},formatPersonLabel({name:n.recipient_name,campus:n.recipient_campus},{campus:me?.campus_name})||'—'),h('small',{class:'field-hint'},roleLabel(n.recipient_role))]],
   ['Delivery state',n=>h('div',{class:'pill-row'},
    n.cancelled_at?pill('cancelled','In-app: outdated'):pill(n.sent_at?'sent':'pending',`In-app: ${n.sent_at?(n.read_at?'read':'delivered'):'queued'}`),
    ...(n.deliveries||[]).map(d=>pill(d.status,`${d.channel==='email'?'Email':'WhatsApp'}: ${STATUS[d.status]?.[0]||d.status}`))
   )]
  ],'No sent notifications yet');

  box.replaceChildren(table,pager);
 };

 const render=async()=>{
  if(isAuthority&&activeTab==='sent'){
   await loadSent();
  } else {
   await loadReceived();
  }
 };

 const tabButtons=isAuthority?[
  h('button',{type:'button',class:`s ${activeTab==='received'?'primary':''}`,onclick:()=>{activeTab='received';receivedOffset=0;go(renderHeaderAndContent)}},'Received'),
  h('button',{type:'button',class:`s ${activeTab==='sent'?'primary':''}`,onclick:()=>{activeTab='sent';sentOffset=0;go(renderHeaderAndContent)}},'Sent')
 ]:[];

 const headerBox=h('div');
 const renderHeaderAndContent=async()=>{
  headerBox.replaceChildren(heading('Saved on the server','Notifications',...tabButtons,btn('Refresh',render,'s')));
  await render();
 };

 const renderEmail=async()=>{
  try {
   const p=await api('GET','/notifications/email-preference'),cb=h('input',{type:'checkbox',checked:p.enabled});
   cb.onchange=()=>go(async()=>{const r=await api('PUT','/notifications/email-preference',{enabled:cb.checked});toast(r.enabled?'Email notifications on':'Email notifications off')});
   emailBox.replaceChildren(h('label',{class:'check-field'},cb,h('span',{},`Email me reminders at ${me.email || "my account email"}`)),!p.available&&h('p',{class:'mut'},'Email delivery is not configured on this server yet; your choice is saved for when it is.'))
  } catch(e) {
   emailBox.replaceChildren(h('p',{class:'mut'},'Email notifications are not configured on this server.'));
  }
 };

 b.append(card(headerBox,box),card(heading('Optional','Email'),emailBox));
 await Promise.all([renderHeaderAndContent(),renderEmail()]);
};
