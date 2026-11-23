const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../assets/images');
const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
const wrap = (bg, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 650" role="img"><defs>${defs}</defs><rect width="1200" height="650" fill="${bg}"/>${body}</svg>`;
let grid = '';
for (let row = 0; row < 10; row++) grid += `<path d="M590 ${85 + row * 52}H1094"/>`;
for (let col = 0; col < 9; col++) {
  const x = 590 + col * 63;
  grid += col === 0 || col === 8 ? `<path d="M${x} 85V553"/>` : `<path d="M${x} 85V293M${x} 345V553"/>`;
}
grid += '<path d="M779 85L905 189M905 85L779 189M779 449L905 553M905 449L779 553"/>';
function piece(c, r, text, red) {
  const x = 590 + c * 63, y = 85 + r * 52;
  return `<g transform="translate(${x} ${y})"><circle cy="5" r="25" fill="#533724" opacity=".18"/><circle r="25" fill="#fff6e2" stroke="#bb9360" stroke-width="2"/><circle r="20" fill="none" stroke="${red ? '#b53a2c' : '#343c3b'}" stroke-width="1.3"/><text y="9" text-anchor="middle" font-family="KaiTi,STKaiti,serif" font-size="29" font-weight="700" fill="${red ? '#b53a2c' : '#343c3b'}">${text}</text></g>`;
}
const pieces = [[0,0,'車'],[1,0,'馬'],[3,0,'士'],[4,0,'將'],[5,0,'士'],[7,0,'馬'],[8,0,'車'],[2,2,'象'],[1,2,'砲'],[7,2,'砲'],[0,3,'卒'],[4,3,'卒'],[8,3,'卒'],[4,5,'兵',true],[0,6,'兵',true],[8,6,'兵',true],[1,7,'炮',true],[6,7,'馬',true],[7,7,'炮',true],[0,9,'車',true],[2,9,'相',true],[3,9,'仕',true],[4,9,'帥',true],[5,9,'仕',true],[6,9,'相',true],[8,9,'車',true]].map(a=>piece(...a)).join('');
const chess = wrap('#f5e9d7', `<circle cx="165" cy="40" r="270" fill="#ebd8bd" opacity=".5"/><path d="M60 72H440" stroke="#bc9874"/><text x="68" y="260" font-family='${font}' font-size="60" font-weight="700" fill="#442e23">中国象棋</text><text x="72" y="310" font-family='${font}' font-size="21" fill="#705947">对弈 · 练习 · 推演</text><g transform="translate(70 360)"><rect width="108" height="4" rx="2" fill="#b53a2c"/><rect x="120" width="30" height="4" rx="2" fill="#c5ad91"/></g><text x="72" y="554" font-family='${font}' font-size="17" fill="#705947">练习指导与沙盘推演</text><rect x="546" y="40" width="592" height="558" rx="15" fill="#dac29e"/><rect x="557" y="51" width="570" height="536" rx="9" fill="#edcf9c"/><g fill="none" stroke="#91734e" stroke-width="1.5">${grid}</g><text x="670" y="328" font-family="KaiTi,serif" font-size="29" fill="#8a673e">楚 河</text><text x="930" y="328" font-family="KaiTi,serif" font-size="29" fill="#8a673e">漢 界</text>${pieces}`);
fs.writeFileSync(path.join(out, 'chess-cover.svg'), chess);
let dots = '';
for(let x=560;x<1140;x+=34)for(let y=65;y<600;y+=34)dots+=`<circle cx="${x}" cy="${y}" r="1.5" fill="#518a96" opacity=".25"/>`;
const trail = 'M620 468H790V366H688V196H926V298H1028V434H960';
const snake = wrap('#102c38', `<circle cx="990" cy="290" r="360" fill="url(#halo)"/><path d="M60 72H440" stroke="#34545d"/><text x="68" y="260" font-family='${font}' font-size="60" font-weight="700" fill="#f3fff4">贪吃蛇</text><text x="72" y="310" font-family='${font}' font-size="21" fill="#b4d6cd">随机强化 · 连击冲刺</text><g fill="#b6f378"><rect x="72" y="360" width="18" height="18" rx="4"/><rect x="100" y="360" width="18" height="18" rx="4" opacity=".65"/><rect x="128" y="360" width="18" height="18" rx="4" opacity=".35"/></g><text x="72" y="554" font-family='${font}' font-size="17" fill="#a9c8c2">NEON SERPENT</text><rect x="545" y="40" width="590" height="558" rx="20" fill="#071f2b" stroke="#345660"/>${dots}<path d="${trail}" fill="none" stroke="#a9f96e" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" opacity=".09"/><path d="${trail}" fill="none" stroke="#a9ec75" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><path d="M620 468H790V366H688V196H926V298H1028" fill="none" stroke="#d9ffac" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/><rect x="938" y="418" width="34" height="32" rx="12" fill="#cef995"/><circle cx="945" cy="428" r="3" fill="#102c38"/><circle cx="945" cy="440" r="3" fill="#102c38"/><rect x="858" y="420" width="21" height="21" rx="6" fill="#ff9b79" transform="rotate(12 869 431)"/><path d="M865 413l10-9" stroke="#d0f9a0" stroke-width="4" stroke-linecap="round"/><g stroke="#84bfc0" stroke-width="2" opacity=".7"><path d="M592 90h18m-9-9v18M1080 520h18m-9-9v18"/></g>`, '<radialGradient id="halo"><stop stop-color="#30635f" stop-opacity=".5"/><stop offset="1" stop-color="#102c38" stop-opacity="0"/></radialGradient>');
fs.writeFileSync(path.join(out, 'snake-cover.svg'), snake);
console.log('Created two SVG game covers.');
