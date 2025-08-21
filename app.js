(() => {
  const $  = sel => document.querySelector(sel);
  const hubEl = $('#hub');
  const statusEl = $('#statusText');
  const reloadBtn = $('#reloadBtn');
  const fileLoader = $('#fileLoader');
  const loadWrapper = $('#loadWrapper');
  const footerTextEl = $('#footerText');
  const headerEl = $('#siteHeader');
  const mainEl = $('#mainArea');

  // ---- Theme Catalog: 20 full-color themes (light + dark variants) ----
  const THEMES = {
    Forest:      { light:{bg:'#f2f7f3',surface:'#e8f1ea',muted:'#d3e2d6',text:'#1b2b22',sub:'#50665a',accent:'#3fa072',accent2:'#8cc63f'},
                   dark: {bg:'#0c1510',surface:'#122018',muted:'#14251c',text:'#e7f5ee',sub:'#98c3ae',accent:'#41d18a',accent2:'#b6ff66'} },
    Azure:       { light:{bg:'#f2f7ff',surface:'#e8f1ff',muted:'#dbe7ff',text:'#0d1b2a',sub:'#496682',accent:'#4d86ff',accent2:'#63e6ff'},
                   dark: {bg:'#0f1220',surface:'#171a2b',muted:'#1e2440',text:'#e6e9ef',sub:'#adb5c9',accent:'#7aa2ff',accent2:'#52e0ef'} },
    Sunset:      { light:{bg:'#fff6f2',surface:'#ffe9e0',muted:'#ffd7ca',text:'#371a12',sub:'#7a5147',accent:'#ff7a59',accent2:'#ffb347'},
                   dark: {bg:'#1a100c',surface:'#241511',muted:'#2c1712',text:'#ffe9e0',sub:'#ffb7a2',accent:'#ff8b6b',accent2:'#ffc680'} },
    Grape:       { light:{bg:'#fbf5ff',surface:'#f4e9ff',muted:'#e9d4ff',text:'#26162e',sub:'#6d507d',accent:'#a66bff',accent2:'#ff72e1'},
                   dark: {bg:'#140c1a',surface:'#1b0f23',muted:'#22122c',text:'#f2e9ff',sub:'#cbb6e6',accent:'#b785ff',accent2:'#ff8ae8'} },
    Solar:       { light:{bg:'#fffaf0',surface:'#fff1cc',muted:'#ffe8a3',text:'#2e2500',sub:'#6b5e20',accent:'#ffb703',accent2:'#fb8500'},
                   dark: {bg:'#1b1706',surface:'#241f09',muted:'#2a250c',text:'#fff1cc',sub:'#e6d393',accent:'#ffcc33',accent2:'#ff9c33'} },
    Ocean:       { light:{bg:'#f0fbff',surface:'#d9f2ff',muted:'#c6e9fb',text:'#0b1f28',sub:'#3f6d82',accent:'#12a4d9',accent2:'#00e0ff'},
                   dark: {bg:'#08141a',surface:'#0d1b22',muted:'#0f212a',text:'#d9f2ff',sub:'#9dd2e6',accent:'#33c3ff',accent2:'#33fff3'} },
    Rose:        { light:{bg:'#fff1f5',surface:'#ffe1ea',muted:'#ffc8d9',text:'#2c0e17',sub:'#7c4a5c',accent:'#ff79a8',accent2:'#ff9fbd'},
                   dark: {bg:'#1a0b11',surface:'#210e16',muted:'#27111a',text:'#ffe1ea',sub:'#ffc1d2',accent:'#ff8fb6',accent2:'#ffc2d6'} },
    Mint:        { light:{bg:'#f4fffb',surface:'#e0fbf1',muted:'#c8f3e2',text:'#0f2a22',sub:'#4b7968',accent:'#49dcb1',accent2:'#32f5b3'},
                   dark: {bg:'#0a1713',surface:'#10211c',muted:'#132620',text:'#e0fbf1',sub:'#a4d7c7',accent:'#55f0c3',accent2:'#76ffd2'} },
    Ember:       { light:{bg:'#fff8f5',surface:'#ffe9e1',muted:'#ffd6c8',text:'#2f160d',sub:'#7a5549',accent:'#ff6a3d',accent2:'#ff9d66'},
                   dark: {bg:'#170e0a',surface:'#20130e',muted:'#26160f',text:'#ffe9e1',sub:'#f8c5b2',accent:'#ff7b51',accent2:'#ffb08a'} },
    Lagoon:      { light:{bg:'#f4fffe',surface:'#dcfbf8',muted:'#c6f5f0',text:'#0d2422',sub:'#3f6f69',accent:'#2bd7c4',accent2:'#30f2de'},
                   dark: {bg:'#0a1513',surface:'#0f201d',muted:'#122521',text:'#dcfbf8',sub:'#a8ddd5',accent:'#4be7d6',accent2:'#64fff0'} },
    Slate:       { light:{bg:'#f6f8fb',surface:'#e9edf5',muted:'#dbe2ee',text:'#12161f',sub:'#5b6474',accent:'#6b86a9',accent2:'#8fb6ff'},
                   dark: {bg:'#0c0f15',surface:'#131722',muted:'#171c2a',text:'#e9edf5',sub:'#b2bbcc',accent:'#89a0be',accent2:'#a9c9ff'} },
    Lime:        { light:{bg:'#f7ffef',surface:'#ebfbd6',muted:'#d9f7b0',text:'#1d2a0b',sub:'#5a7340',accent:'#98d82c',accent2:'#c9ff5c'},
                   dark: {bg:'#0f1508',surface:'#141c0a',muted:'#17210b',text:'#ebfbd6',sub:'#c3e599',accent:'#b2ff3b',accent2:'#dbff6b'} },
    Royal:       { light:{bg:'#f5f6ff',surface:'#e6e8ff',muted:'#d4d6ff',text:'#121331',sub:'#545887',accent:'#6b72ff',accent2:'#8ea1ff'},
                   dark: {bg:'#0c0d24',surface:'#13143a',muted:'#181a46',text:'#e6e8ff',sub:'#bdc2ff',accent:'#8e95ff',accent2:'#b7c5ff'} },
    Cherry:      { light:{bg:'#fff5f7',surface:'#ffe4e9',muted:'#ffcbd6',text:'#311017',sub:'#74414d',accent:'#ff5577',accent2:'#ff88a6'},
                   dark: {bg:'#1a0d11',surface:'#220f14',muted:'#29121a',text:'#ffe4e9',sub:'#ffc0cd',accent:'#ff6b8b',accent2:'#ffa3b9'} },
    Pumpkin:     { light:{bg:'#fff7f0',surface:'#ffe9d6',muted:'#ffd9b5',text:'#2f1c0b',sub:'#795f40',accent:'#ff8f1f',accent2:'#ffc145'},
                   dark: {bg:'#1a1208',surface:'#23170b',muted:'#291a0c',text:'#ffe9d6',sub:'#f4cfa8',accent:'#ffa43d',accent2:'#ffd27a'} },
    Sky:         { light:{bg:'#f5fbff',surface:'#e6f4ff',muted:'#d3ecff',text:'#0f1a26',sub:'#4b6a86',accent:'#48a8ff',accent2:'#7fd3ff'},
                   dark: {bg:'#0a121b',surface:'#101a27',muted:'#122033',text:'#e6f4ff',sub:'#b0d6ff',accent:'#6bc0ff',accent2:'#9de0ff'} },
    Orchid:      { light:{bg:'#fcf7ff',surface:'#f1e6ff',muted:'#e3d1ff',text:'#1f142a',sub:'#5d4a7a',accent:'#b07cff',accent2:'#d39bff'},
                   dark: {bg:'#130b1a',surface:'#1a0f24',muted:'#1f122e',text:'#f1e6ff',sub:'#d5c2ff',accent:'#c59bff',accent2:'#e3bdff'} },
    Steel:       { light:{bg:'#f7f9fb',surface:'#ecf0f4',muted:'#dee6ee',text:'#11171f',sub:'#566272',accent:'#7c8fa6',accent2:'#9fb6cc'},
                   dark: {bg:'#0b1016',surface:'#121923',muted:'#15202c',text:'#ecf0f4',sub:'#b9c6d6',accent:'#95a7bd',accent2:'#b6cbe0'} },
    Candy:       { light:{bg:'#fff7fe',surface:'#ffe5fb',muted:'#ffd0f7',text:'#2a1027',sub:'#6d4b68',accent:'#ff6de2',accent2:'#ff9eee'},
                   dark: {bg:'#180a16',surface:'#210e1f',muted:'#271126',text:'#ffe5fb',sub:'#ffc9f6',accent:'#ff86e7',accent2:'#ffb8f1'} },
    Sand:        { light:{bg:'#fffbf4',surface:'#fff1db',muted:'#ffe4be',text:'#2a2215',sub:'#6b5d3e',accent:'#e2b66d',accent2:'#ffd58a'},
                   dark: {bg:'#151108',surface:'#1f180c',muted:'#241c0f',text:'#fff1db',sub:'#edd3a4',accent:'#f3c77e',accent2:'#ffdba4'} },
  };

  // ---- State ----
  const state = {
    config: {
      TilesTiltToMouseOnHover: false,
      ShowLoadButton: true,
      ShowReloadButton: true,
      OpenExternalInNewTab: true,
      SortButtons: 'None',
      FooterText: null,
    },
    style:  {
      Colour: 'Azure',
      DarkMode: 'False',
      ButtonIcons: 'True',
      Layout: 'Grid',

      TileSize: '132px',
      TileGap: '16px',
      TilePadding: '14px',
      BorderRadius: '14px',
      BorderWidth: '1px',
      HoverLift: '6px',
      TiltDegrees: '10',

      EnableGlow: 'True',
      HeaderSticky: 'True',
      FontFamily: null,
      MaxWidth: null,
      LabelAlign: 'Auto',
      IconSize: '28px',
    },
    buttons: new Map(), // label -> iconPath
    links:   new Map(), // label -> href
  };

  // ---- Utilities ----
  const normalizeBool = (v) => {
    if (typeof v === 'boolean') return v;
    return String(v).trim().toLowerCase() === 'true';
  };
  const normalizeLayout = (v) => /list/i.test(v) ? 'list' : 'grid';
  const safeLabel = (s) => s.replace(/^<|>$/g,'').trim(); // remove angle wrappers
  const safeVal = (s) => s.replace(/^<|>$/g,'').trim();

  // ---- Apply Theme & Style ----
  function applyTheme() {
    const colourName = state.style.Colour in THEMES ? state.style.Colour : 'Azure';
    const dark = normalizeBool(state.style.DarkMode);
    const pad = THEMES[colourName][dark ? 'dark' : 'light'];
    const root = document.documentElement.style;

    // core palette
    root.setProperty('--bg', pad.bg);
    root.setProperty('--surface', pad.surface);
    root.setProperty('--muted', pad.muted);
    root.setProperty('--text', pad.text);
    root.setProperty('--subtext', pad.sub);
    root.setProperty('--accent', pad.accent);
    root.setProperty('--accent-2', pad.accent2);

    // style overrides
    root.setProperty('--tile-size', state.style.TileSize || '132px');
    root.setProperty('--tile-gap', state.style.TileGap || '16px');
    root.setProperty('--tile-pad', state.style.TilePadding || '14px');
    root.setProperty('--radius', state.style.BorderRadius || '14px');
    root.setProperty('--border-width', state.style.BorderWidth || '1px');
    root.setProperty('--hover-lift', state.style.HoverLift || '6px');

    // optional font override
    if (state.style.FontFamily) {
      root.setProperty('--font', state.style.FontFamily);
    }

    // header sticky vs normal flow
    headerEl.style.position = normalizeBool(state.style.HeaderSticky) ? 'sticky' : 'static';
    headerEl.style.top = normalizeBool(state.style.HeaderSticky) ? '0' : '';

    // max width control
    if (state.style.MaxWidth) {
      mainEl.style.maxWidth = state.style.MaxWidth;
    } else {
      mainEl.style.maxWidth = '1200px'; // default from CSS
    }

    // icons on/off
    document.body.classList.toggle('no-icons', !normalizeBool(state.style.ButtonIcons));

    // layout
    hubEl.classList.toggle('grid', normalizeLayout(state.style.Layout) === 'grid');
    hubEl.classList.toggle('list', normalizeLayout(state.style.Layout) === 'list');

    // footer text override (plain text for safety)
    if (state.config.FooterText != null) {
      footerTextEl.textContent = state.config.FooterText;
    }
  }

  // ---- Build UI from buttons+links ----
  function buildHub() {
    hubEl.innerHTML = '';

    let items = Array.from(state.buttons.entries()).map(([label, icon]) => {
      const href = state.links.get(label) ?? '#';
      return { label, icon, href };
    });

    // sorting
    if (/alpha/i.test(state.config.SortButtons || '')) {
      items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }

    if (!items.length) {
      hubEl.innerHTML = `<div class="pill" role="status"><strong>No buttons found.</strong> Add entries under [Buttons] and [Links] with matching keys.</div>`;
      return;
    }

    const listish = normalizeLayout(state.style.Layout) === 'list';
    const labelAlignPref = (state.style.LabelAlign || 'Auto').toLowerCase();
    const labelAlign = labelAlignPref === 'left' ? 'left'
                     : labelAlignPref === 'center' ? 'center'
                     : (listish ? 'left' : 'center');
    const iconSize = parseInt(state.style.IconSize || '28', 10) || 28;
    const openExtNewTab = normalizeBool(state.config.OpenExternalInNewTab);

    for (const item of items) {
      const a = document.createElement('a');
      a.className = `tile ${listish ? 'listish' : ''}`;
      a.href = item.href;
      a.role = 'listitem';

      const isExternal = /^https?:/i.test(item.href);
      a.target = isExternal && openExtNewTab ? '_blank' : '_self';
      a.rel = isExternal && openExtNewTab ? 'noopener' : '';

      // optional glow
      if (normalizeBool(state.style.EnableGlow)) {
        const glow = document.createElement('div');
        glow.className = 'glow';
        a.appendChild(glow);
      }

      const iconWrap = document.createElement('div');
      iconWrap.className = 'icon-wrap';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.icon || 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      img.style.width = iconSize + 'px';
      img.style.height = iconSize + 'px';
      iconWrap.appendChild(img);

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = item.label;
      label.style.textAlign = labelAlign;

      if (normalizeBool(state.style.ButtonIcons)) a.appendChild(iconWrap);
      a.appendChild(label);

      // Tilt effect if enabled
      if (state.config.TilesTiltToMouseOnHover) {
        const tiltMax = Number.parseFloat(state.style.TiltDegrees ?? '10');
        const hoverLiftVar = getComputedStyle(document.documentElement)
          .getPropertyValue('--hover-lift').trim() || '0px';

        const glowEl = a.querySelector('.glow'); // may be null if disabled

        a.addEventListener('mousemove', (e) => {
          const rect = a.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          const rx = (-dy * tiltMax).toFixed(2);
          const ry = (dx * tiltMax).toFixed(2);
          a.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(calc(-1 * ${hoverLiftVar}))`;

          if (glowEl) {
            glowEl.style.setProperty('--mx', `${((dx+1)/2)*100}%`);
            glowEl.style.setProperty('--my', `${((dy+1)/2)*100}%`);
          }
        });
        a.addEventListener('mouseleave', () => { a.style.transform = ''; });
      }

      hubEl.appendChild(a);
    }
  }

  // ---- Parser for .ocf ----
  function parseOCF(text) {
    const lines = text.split(/\r?\n/);
    let section = null;

    // reset maps
    state.buttons = new Map();
    state.links = new Map();

    for (let raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;

      // section header
      const m = line.match(/^\[(.+?)\]\s*$/);
      if (m) { section = m[1]; continue; }

      if (!section) continue;

      switch (section) {
        case 'Config':
        case 'Style': {
          // key = value
          const kv = line.split('=');
          if (kv.length >= 2) {
            const key = kv[0].trim();
            const val = kv.slice(1).join('=').trim();
            if (section === 'Config') {
              // booleans handled in apply/use sites; keep as string unless true/false literal
              state.config[key] = /^true|false$/i.test(val) ? normalizeBool(val) : val;
            } else {
              state.style[key] = val;
            }
          }
          break;
        }

        case 'Buttons':
        case 'Links': {
          // <ItemLabel>:<value>
          const idx = line.indexOf(':');
          if (idx !== -1) {
            const k = safeLabel(line.slice(0, idx).trim());
            const v = safeVal(line.slice(idx + 1).trim());
            if (section === 'Buttons') state.buttons.set(k, v);
            else state.links.set(k, v);
          }
          break;
        }

        default:
          // ignore unknown sections
          break;
      }
    }
  }

  // ---- Apply config-driven UI bits not covered by theme ----
  function applyGlobalToggles() {
    // show/hide load + reload buttons
    loadWrapper.style.display = normalizeBool(state.config.ShowLoadButton) ? '' : 'none';
    reloadBtn.style.display   = normalizeBool(state.config.ShowReloadButton) ? '' : 'none';
  }

  // ---- Loaders ----
  async function loadFromURL(url = 'hubconfig.ocf') {
    statusEl.textContent = `Loading ${url}…`;
    try {
      const res = await fetch(url + `?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      parseOCF(text);
      applyTheme();
      applyGlobalToggles();
      buildHub();
      statusEl.textContent = `Loaded ${url}`;
    } catch (err) {
      statusEl.textContent = `Could not load ${url}: ${err.message}. You can use “Load .ocf” to pick a file.`;
    }
  }

  function loadFromFile(file) {
    statusEl.textContent = `Reading ${file.name}…`;
    const reader = new FileReader();
    reader.onerror = () => statusEl.textContent = 'Failed to read file.';
    reader.onload = () => {
      try {
        parseOCF(String(reader.result));
        applyTheme();
        applyGlobalToggles();
        buildHub();
        statusEl.textContent = `Loaded ${file.name}`;
      } catch (e) {
        statusEl.textContent = `Parse error: ${e.message}`;
      }
    };
    reader.readAsText(file);
  }

  // ---- Wire up controls ----
  reloadBtn.addEventListener('click', () => loadFromURL());
  fileLoader.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) loadFromFile(f);
    fileLoader.value = '';
  });

  // ---- Boot ----
  loadFromURL();
})();
