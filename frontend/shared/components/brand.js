import {h} from '../core/dom.js';

export const miraiLogoSvg = () => `
<svg class="mirai-logo-svg" width="168" height="34" viewBox="0 0 168 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="miraiDotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <g transform="translate(1, 2)">
    <!-- Cyan glowing dot at bottom left -->
    <circle cx="7" cy="20" r="4.2" fill="url(#miraiDotGrad)"/>
    <!-- Connected ribbon / wave nodes -->
    <path d="M7 20 C11 13, 15 8, 20 8 C24 8, 26.5 10.5, 25.5 15 C24.5 19, 19 21, 15 18" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M20 8 C25 8, 28 12, 32 20" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M25.5 15 C28.5 10, 32.5 7.5, 36.5 7.5 C40.5 7.5, 42.5 10, 41.5 14 C40.5 18, 36 21, 32 20" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <circle cx="40" cy="10" r="3" fill="#ffffff"/>
  </g>
  <!-- Bold Mirai typography -->
  <text x="49" y="24" fill="#ffffff" font-family="'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" font-size="22" font-weight="800" letter-spacing="-0.5">Mirai</text>
  <!-- Stacked subtext: SCHOOL OF TECHNOLOGY -->
  <text x="110" y="15" fill="#94a3b8" font-family="'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" font-size="5.8" font-weight="800" letter-spacing="0.8">SCHOOL OF</text>
  <text x="110" y="23" fill="#94a3b8" font-family="'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" font-size="5.8" font-weight="800" letter-spacing="0.8">TECHNOLOGY</text>
</svg>
`;

export const logo = (options = {}) => {
  const brand = h('div', {class: `brand ${options.className || ''}`});
  brand.innerHTML = miraiLogoSvg();
  return brand;
};
