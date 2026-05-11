/* =============================================
   STALKER 2 — charts.js
   Логіка вкладок Список і Статистика
   ============================================= */

'use strict';

const ChartsModule = (() => {

  let listTypeFilter = 'all';
  let listZoneFilter = 'all';

  const all = () => {
    const d = window.APP_DATA;
    if (!d) return [];
    return [
      ...(d.locations   || []),
      ...(d.artifacts   || []),
      ...(d.archanomaly || []),
    ];
  };

  const typeKey = t => ({
    'локація':       'loc',
    'локація':       'loc',
    'артефакт':      'art',
    'архо-аномалія': 'arc',
    'Локація':       'loc',
    'Артефакт':      'art',
    'Архо-аномалія': 'arc',
    'архіаномалія':  'arc',
    'Архіаномалія':  'arc',
  })[(t||'').trim()] || 'loc';

  const typeLabel = d => ({
    'локація':       'Локація',
    'Локація':       'Локація',
    'артефакт':      'Артефакт',
    'Артефакт':      'Артефакт',
    'архо-аномалія': 'Архіаномалія',
    'Архо-аномалія': 'Архіаномалія',
  })[(d.type||'').trim()] || d.type;

  const typeColor = k => ({
    loc: '#60a5fa',
    art: '#f59e0b',
    arc: '#ee5a24',
  })[k] || '#60a5fa';

  // Нормалізуємо назву зони: кожне слово з великої літери
  const normalizeZone = z => (z || '').trim().replace(/\S+/g, function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  const getAllZones = () => {
    const seen = new Set();
    all().forEach(function(d) { if (d.zone) seen.add(normalizeZone(d.zone)); });
    return Array.from(seen).sort();
  };

  function renderZoneFilter() {
    const container = document.getElementById('zone-filter-bar');
    if (!container) return;
    const zones = getAllZones();
    if (!zones.length) { container.innerHTML = ''; return; }
    const btns = zones.map(z => {
      const active = listZoneFilter === z ? ' active' : '';
      return '<button class="zone-btn' + active + '" onclick="ChartsModule.setZoneFilter(\'' + z.replace(/'/g, "\\'") + '\')">' + z + '</button>';
    }).join('');
    container.innerHTML =
      '<button class="zone-btn' + (listZoneFilter === 'all' ? ' active' : '') + '" onclick="ChartsModule.setZoneFilter(\'all\')">Всі зони</button>' +
      btns;
  }

  function renderList(query) {
    if (query === undefined) query = '';
    renderZoneFilter();
    const grid = document.getElementById('list-grid');
    if (!grid) return;
    const q = query.toLowerCase().trim();
    const items = all().filter(function(d) {
      if (listTypeFilter !== 'all' && typeKey(d.type) !== listTypeFilter) return false;
      if (listZoneFilter !== 'all' && normalizeZone(d.zone) !== listZoneFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!items.length) {
      grid.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:20px 0;">Нічого не знайдено</div>';
      return;
    }
    grid.innerHTML = items.map(function(d) {
      const k   = typeKey(d.type);
      const col = typeColor(k);
      const hasCoords = d.coords && d.coords.length === 2;
      const mapBtn = hasCoords
        ? '<button class="card-map-btn" onclick="event.stopPropagation();ChartsModule.selectOnMap(' + d.id + ')" title="Показати на мапі">🗺 На мапу</button>'
        : '';
      const price = d.price
        ? '<div class="card-price">Ціна: ' + d.price.toLocaleString() + ' руб.</div>'
        : '';
      const clickable = hasCoords ? ' list-card--clickable' : '';
      const clickHandler = hasCoords ? ' onclick="ChartsModule.selectOnMap(' + d.id + ')"' : '';

      // Визначаємо шлях до фото залежно від типу
      let imgSrc = '';
      let imgWrapClass = 'card-img-wrap';
      if (k === 'loc') {
        if (d.image) imgSrc = 'images/Locations/' + d.image;
      } else if (k === 'arc') {
        if (d.image) imgSrc = 'images/Archanomaly/' + d.image;
      } else if (k === 'art') {
        if (d.image) imgSrc = 'images/artifacts/' + d.image;
        else if (d.icon) { imgSrc = 'images/artifacts/' + d.icon; imgWrapClass = 'card-img-wrap card-img-wrap--icon'; }
      }
      const imgHtml = imgSrc
        ? '<div class="' + imgWrapClass + '"><img class="card-img" src="' + imgSrc + '" alt="' + d.name + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>'
        : '';

      return '<div class="list-card list-card--' + k + clickable + '"' + clickHandler + '>' +
        imgHtml +
        '<div class="card-body">' +
          '<div class="card-header">' +
            '<div class="card-name" style="color:' + col + '">' + d.name + '</div>' +
            mapBtn +
          '</div>' +
          '<div class="card-type">' + typeLabel(d) + '</div>' +
          '<div class="card-desc">' + (d.description || '') + '</div>' +
          price +
        '</div>' +
        '</div>';
    }).join('');
  }

  function setListFilter(type) {
    listTypeFilter = type;
    document.querySelectorAll('.type-btn').forEach(function(b) { b.classList.remove('active'); });
    const btn = document.querySelector('.type-btn[data-type="' + type + '"]');
    if (btn) btn.classList.add('active');
    renderList(document.getElementById('list-search') ? document.getElementById('list-search').value : '');
  }

  function setZoneFilter(zone) {
    listZoneFilter = zone;
    renderList(document.getElementById('list-search') ? document.getElementById('list-search').value : '');
  }

  function selectOnMap(id) {
    const item = all().find(function(d) { return d.id === id; });
    if (!item || !item.coords) return;
    switchPane('map');
    setTimeout(function() { MapModule.panToMarker(item.coords, item); }, 100);
  }

  function goToZone(zone) {
    listZoneFilter = normalizeZone(zone);
    listTypeFilter = 'all';
    switchPane('list');
    setTimeout(function() { renderList(''); }, 50);
  }

  function renderStats() {
    const data  = all();
    const total = data.length;
    const locs = data.filter(function(d) { return typeKey(d.type) === 'loc'; }).length;
    const arts = data.filter(function(d) { return typeKey(d.type) === 'art'; }).length;
    const arcs = data.filter(function(d) { return typeKey(d.type) === 'arc'; }).length;

    const cards = document.getElementById('stat-cards');
    if (cards) {
      cards.innerHTML =
        '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">Всього об\'єктів</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#60a5fa">' + locs + '</div><div class="stat-label">Локацій</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#ee5a24">' + arcs + '</div><div class="stat-label">Архіаномалій</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#f59e0b">' + arts + '</div><div class="stat-label">Артефактів</div></div>';
    }

    const bars = document.getElementById('stat-bars');
    if (!bars) return;

    // ── Підрахунок об'єктів по зонах (з розбивкою по типу) ──
    const zoneMap = {};
    data.forEach(function(d) {
      if (!d.zone) return;
      const z = normalizeZone(d.zone);
      if (!zoneMap[z]) zoneMap[z] = { total: 0, loc: 0, arc: 0, art: 0 };
      zoneMap[z].total++;
      zoneMap[z][typeKey(d.type)]++;
    });
    const zoneSorted = Object.entries(zoneMap).sort(function(a, b) { return b[1].total - a[1].total; });
    const maxZoneVal = zoneSorted.length ? zoneSorted[0][1].total : 1;

    // ── Горизонтальний HTML-графік ──
    const zoneRows = zoneSorted.map(function(entry, i) {
      const zone = entry[0];
      const v    = entry[1];
      const pct  = Math.round(v.total / maxZoneVal * 100);
      const locW = Math.round(v.loc / maxZoneVal * 100);
      const arcW = Math.round(v.arc / maxZoneVal * 100);
      const artW = Math.round(v.art / maxZoneVal * 100);
      const rank = i + 1;
      return (
        '<div class="zc-row" onclick="ChartsModule.goToZone(\'' + zone.replace(/'/g, "\\'") + '\')" title="Переглянути ' + zone + '">' +
          '<div class="zc-rank">' + rank + '</div>' +
          '<div class="zc-label">' + zone + '</div>' +
          '<div class="zc-track">' +
            '<div class="zc-seg zc-seg--loc" style="width:' + locW + '%"></div>' +
            '<div class="zc-seg zc-seg--arc" style="width:' + arcW + '%"></div>' +
            '<div class="zc-seg zc-seg--art" style="width:' + artW + '%"></div>' +
          '</div>' +
          '<div class="zc-val">' + v.total + '</div>' +
        '</div>'
      );
    }).join('');

    const legend =
      '<div class="zc-legend">' +
        '<span class="zc-leg-dot" style="background:#60a5fa"></span>Локації' +
        '<span class="zc-leg-dot" style="background:#ee5a24;margin-left:14px"></span>Аномалії' +
        '<span class="zc-leg-dot" style="background:#f59e0b;margin-left:14px"></span>Артефакти' +
        '<span style="margin-left:auto;color:#3a5a3a;font-size:10px">Клікни на зону → фільтр списку</span>' +
      '</div>';

    bars.innerHTML =
      '<div class="pane-title" style="margin-top:4px">Типи об\'єктів</div>' +
      '<div class="bar-section">' +
        (total ? barRow('Локації',      locs, total, '#60a5fa') : '') +
        (total ? barRow('Архіаномалії', arcs, total, '#ee5a24') : '') +
        (total ? barRow('Артефакти',    arts, total, '#f59e0b') : '') +
      '</div>' +
      '<div class="zone-chart-wrap">' +
        '<div class="zone-chart-title">Розподіл по зонах</div>' +
        legend +
        '<div class="zc-chart">' + zoneRows + '</div>' +
      '</div>';
  }

  function barRow(label, value, total, color) {
    const pct = total > 0 ? Math.round(value / total * 100) : 0;
    return '<div class="bar-row">' +
      '<div class="bar-label"><span>' + label + '</span><span style="color:' + color + '">' + value + ' (' + pct + '%)</span></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</div>';
  }

  return { renderList, renderStats, setListFilter, setZoneFilter, selectOnMap, goToZone };
})();
