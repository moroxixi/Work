const GAS = "https://script.google.com/macros/s/AKfycbyDNzy0wf5MxcafkRuAW1icXq5oKdUPMM9Lfxy_U5CsGtQ7luBPZcdYss4ItWXrQBNE/exec";
let all = [];

setInterval(() => {
  const d = new Date();
  document.getElementById('clk').textContent = d.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}, 1000);

const menuBtn = document.getElementById('menuBtn');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const drawerClose = document.getElementById('drawerClose');

function openDrawer() {
  drawer.classList.add('open');
  overlay.classList.add('show');
  menuBtn.classList.add('open');
}
function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('show');
  menuBtn.classList.remove('open');
}
menuBtn.addEventListener('click', () => drawer.classList.contains('open') ? closeDrawer() : openDrawer());
overlay.addEventListener('click', closeDrawer);
drawerClose.addEventListener('click', closeDrawer);

function isBusiness(cat) {
  if (!cat) return false;
  const c = cat.toLowerCase();
  return c.includes('business') || c.includes('mao');
}

function catColor(cat, i) {
  if (!cat) return ['c-blue','c-purple','c-teal','c-rose','c-amber'][i % 5];
  const c = cat.toLowerCase();
  if (c.includes('mao') || c.includes('business')) return 'c-amber';
  if (c.includes('mobile')) return 'c-rose';
  if (c.includes('misc')) return 'c-teal';
  if (c.includes('web')) return ['c-blue','c-purple','c-teal'][i % 3];
  return ['c-blue','c-purple','c-teal','c-rose','c-amber'][i % 5];
}

function catIcon(cat, title) {
  const s = ((cat || '') + (title || '')).toLowerCase();
  if (s.includes('tracker') || s.includes('baby')) return 'ti-baby-carriage';
  if (s.includes('dashboard') || s.includes('chart')) return 'ti-chart-bar';
  if (s.includes('mao') || s.includes('wonton') || s.includes('tempura')) return 'ti-bowl';
  if (s.includes('diary') || s.includes('life')) return 'ti-notebook';
  if (s.includes('notes') || s.includes('note')) return 'ti-note';
  if (s.includes('music') || s.includes('murottal')) return 'ti-music';
  if (s.includes('report')) return 'ti-report';
  if (s.includes('task') || s.includes('pekerjaan')) return 'ti-briefcase';
  if (s.includes('bot') || s.includes('ai')) return 'ti-robot';
  if (s.includes('tiktok')) return 'ti-brand-tiktok';
  if (s.includes('video') || s.includes('mp4')) return 'ti-video';
  if (s.includes('github')) return 'ti-brand-github';
  if (s.includes('youtube')) return 'ti-brand-youtube';
  return 'ti-apps';
}

function cardHTML(projects, offset) {
  return projects.map((p, idx) => {
    const i = offset + idx;
    const col = catColor(p.category, i);
    const ico = catIcon(p.category || '', p.title || '');
    return `<a class="card ${col}" href="${p.url || '#'}" target="_blank">
      <div class="card-head">
        <div class="card-icon"><i class="ti ${ico}"></i></div>
        <span class="badge">${p.category || 'misc'}</span>
      </div>
      <div class="card-icon-m"><i class="ti ${ico}"></i></div>
      <div class="card-body" style="flex:1;min-width:0">
        <div class="card-title">${p.title || '—'}</div>
        <div class="card-desc">${p.description || '—'}</div>
      </div>
      <div class="card-foot"><i class="ti ti-arrow-right" style="font-size:10px"></i> open</div>
    </a>`;
  }).join('');
}

function render(projects) {
  const wrap = document.getElementById('projWrap');
  document.getElementById('cnt').textContent = projects.length + ' apps';
  if (!projects.length) { wrap.innerHTML = '<div class="empty">no results found</div>'; return; }

  const business = projects.filter(p => isBusiness(p.category));
  const others = projects.filter(p => !isBusiness(p.category));

  let html = '';
  if (business.length) {
    html += `<div class="proj-group"><div class="sec-label">business</div><div class="grid">${cardHTML(business, 0)}</div></div>`;
  }
  if (others.length) {
    html += `<div class="proj-group"><div class="sec-label">projects</div><div class="grid">${cardHTML(others, business.length)}</div></div>`;
  }
  wrap.innerHTML = html;
}

function bmGroupHTML(items) {
  return items.map(b => `<a class="bm-item" href="${b.url}" target="_blank"><div class="bm-dot"></div><span>${b.title}</span></a>`).join('');
}

function bmHTML(bms) {
  if (!bms || !bms.length) return '<div class="bm-item"><div class="bm-dot"></div><span style="color:#3d4466">empty</span></div>';

  const business = bms.filter(b => isBusiness(b.category));
  const others = bms.filter(b => !isBusiness(b.category));

  let html = '';
  if (business.length) {
    html += `<div class="bm-group"><div class="bm-group-label">business</div>${bmGroupHTML(business)}</div>`;
  }
  if (others.length) {
    html += `<div class="bm-group"><div class="bm-group-label">bookmark</div>${bmGroupHTML(others)}</div>`;
  }
  return html;
}

async function init() {
  try {
    const r = await fetch(GAS);
    const d = await r.json();

    all = d.projects || [];
    render(all);

    const bm = bmHTML(d.bookmarks || []);
    document.getElementById('bm-desktop').innerHTML = bm;
    document.getElementById('bm-mobile').innerHTML = bm;
  } catch (e) {
    document.getElementById('projWrap').innerHTML = '<div class="empty" style="color:#f7768e">error: connection refused</div>';
  }
}

document.getElementById('srch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  render(all.filter(p => (p.title + ' ' + (p.description || '')).toLowerCase().includes(q)));
});

init();
