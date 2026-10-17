import {runtimeConfig} from '../config/runtime-config.js';
import {h} from '../core/dom.js';
import {API} from '../core/api.js';
import {CFG} from '../core/state.js';
import {themeButton} from '../core/theme.js';
import {frm} from '../components/forms.js';
import {logo} from '../components/brand.js';

// ---------- the Mirai theme sign-in screen ----------
export const loginStory = () => h('section', {class: 'login-story'},
  h('div', {class: 'hero-badge'},
    h('span', {class: 'badge-dot'}),
    'APPLICATIONS OPEN — 2026 BATCH'
  ),
  h('div', {class: 'story-copy'},
    h('h1', {}, 'Your ', h('span', {class: 'ai-gradient'}, 'AI Journey'), h('br'), 'Starts Here'),
    h('p', {class: 'hero-sub'}, 'One home for clubs, Club Days, check-ins, submissions and the records students are proud to share.'),
    h('div', {class: 'hero-info-card'},
      h('div', {class: 'info-row'},
        h('div', {class: 'info-icon'},
          h('svg', {width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round'},
            h('rect', {x: '3', y: '4', width: '18', height: '18', rx: '2'}),
            h('line', {x1: '16', y1: '2', x2: '16', y2: '6'}),
            h('line', {x1: '8', y1: '2', x2: '8', y2: '6'}),
            h('line', {x1: '3', y1: '10', x2: '21', y2: '10'}),
            h('circle', {cx: '16', cy: '16', r: '2', fill: '#00d2ff'})
          )
        ),
        h('div', {class: 'info-text'},
          h('div', {class: 'info-highlight'}, 'Mirai MAINS is conducted'),
          h('div', {class: 'info-sub'}, 'every day at ', h('strong', {class: 'cyan-bright'}, '12 PM.'))
        )
      ),
      h('div', {class: 'info-row'},
        h('div', {class: 'info-icon'},
          h('svg', {width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round'},
            h('circle', {cx: '12', cy: '12', r: '10'}),
            h('polyline', {points: '12 6 12 12 16 14'})
          )
        ),
        h('div', {class: 'info-text'},
          h('strong', {class: 'cyan-bright'}, 'Apply by 11 AM '),
          'to get a slot for the same day’s exam.'
        )
      ),
      h('div', {class: 'info-row'},
        h('div', {class: 'info-icon'},
          h('svg', {width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round'},
            h('path', {d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'}),
            h('polyline', {points: '14 2 14 8 20 8'}),
            h('line', {x1: '16', y1: '13', x2: '8', y2: '13'}),
            h('line', {x1: '16', y1: '17', x2: '8', y2: '17'})
          )
        ),
        h('div', {class: 'info-text'},
          'Applications submitted ',
          h('strong', {}, 'after 11 AM '),
          'will be slotted for the next day’s ',
          h('strong', {class: 'cyan-bright'}, '12 PM'),
          ' exam.'
        )
      )
    ),
    h('div', {class: 'hero-checklist'},
      h('div', {class: 'check-item'}, h('span', {class: 'check-box'}, '✓'), 'MacBook included — no extra cost'),
      h('div', {class: 'check-item'}, h('span', {class: 'check-box'}, '✓'), 'UGC approved B.Tech degree'),
      h('div', {class: 'check-item'}, h('span', {class: 'check-box'}, '✓'), 'Top 12% Merit Based Scholarship'),
      h('div', {class: 'check-item'}, h('span', {class: 'check-box'}, '✓'), 'Build real AI products from Day 1')
    ),
    h('div', {class: 'story-stats', style: 'display:none'},
      h('div', {}, h('strong', {}, '01'), h('small', {}, 'Find your people')),
      h('div', {}, h('strong', {}, '02'), h('small', {}, 'Show what you can do')),
      h('div', {}, h('strong', {}, '03'), h('small', {}, 'Keep your record'))
    )
  ),
  h('div', {class: 'story-footer'}, CFG.app_name)
);

export function loginView(site, {message, onSignIn} = {}) {
  const A = document.getElementById('app');
  A.replaceChildren();
  document.body.className = 'mirai-auth-body';
  document.title = `Sign in · ${CFG.app_short_name}`;

  const f = frm([
    ['identifier', 'Email or student ID', 'text', null, {autocomplete: 'username', placeholder: 'Enter Email Address *'}],
    ['password', 'Password', 'password', null, {autocomplete: 'current-password', placeholder: 'Enter Password *'}]
  ], 'Continue to workspace', async d => {
    const b = f.querySelector('[type=submit]'), label = b.textContent;
    b.textContent = 'Signing in…';
    f.setAttribute('aria-busy', 'true');
    try {
      await onSignIn(d.identifier.trim(), d.password);
    } finally {
      b.textContent = label;
      f.removeAttribute('aria-busy');
    }
  }, 0, {draft: false});

  // Insert the agreement disclaimer before submit button
  const agreeBox = h('label', {class: 'agree-consent'},
    h('input', {type: 'checkbox', checked: true, required: true}),
    h('span', {}, 'I agree to receive information regarding my submitted application by signing up on Mirai School of Technology *')
  );
  const submitBtn = f.querySelector('[type=submit]');
  if (submitBtn) f.insertBefore(agreeBox, submitBtn);

  const demo = runtimeConfig.demoLogins;
  const demos = h('div', {class: 'demo-buttons'},
    demo.map(([e, , l]) => h('button', {
      type: 'button',
      class: 's',
      onclick: () => {
        f.elements.identifier.value = e;
        f.elements.password.value = runtimeConfig.demoPassword;
      }
    }, l))
  );

  const tabs = h('div', {class: 'auth-tabs'},
    h('button', {type: 'button', class: 'auth-tab', onclick: () => {
      const el = f.querySelector('.form-error') || f.appendChild(h('p', {class: 'form-error', role: 'alert'}, ''));
      el.textContent = 'Admissions and accounts are managed by Mirai Administration.';
      el.hidden = false;
    }}, 'Register'),
    h('button', {type: 'button', class: 'auth-tab active'}, 'Login', h('span', {class: 'tab-indicator'}))
  );

  const topHeader = h('header', {class: 'mirai-top-header'}, logo());

  A.append(
    topHeader,
    h('div', {class: 'login-screen'},
      loginStory(),
      h('section', {class: 'login-side'},
        h('div', {class: 'mobile-brand'}, logo()),
        h('div', {class: 'login-card'},
          h('div', {class: 'spotlight-head'},
            h('div', {class: 'card-alert-pill'},
              h('span', {class: 'alert-dot'}),
              'Only a few seats remaining for 2026 batch!'
            ),
            themeButton()
          ),
          h('h2', {}, `Sign in to ${CFG.app_short_name}`),
          h('p', {class: 'card-subtitle'}, 'Takes less than 3 minutes to register'),
          tabs,
          message && h('div', {class: 'notice wait', role: 'status'}, message),
          f,
          demo.length ? h('div', {class: 'demo-area'},
            h('span', {}, `Demo accounts · ${runtimeConfig.demoPassword} · each role opens its own portal (${runtimeConfig.environment} build only)`),
            demos
          ) : null,
          runtimeConfig.allowApiOverride && h('details', {class: 'api-setting'},
            h('summary', {}, 'Connection settings'),
            h('label', {}, 'API address',
              h('input', {
                value: API(),
                onchange: e => {
                  try {
                    localStorage.setItem('api', e.target.value.trim());
                  } catch {}
                }
              })
            )
          )
        )
      )
    )
  );
}
