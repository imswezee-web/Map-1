/* =============================================
   STALKER 2 — charts.js
   Логіка вкладок Список і Статистика
   Діаграми: Chart.js 4.x
   ============================================= */

'use strict';

const ChartsModule = (() => {

  let listTypeFilter = 'all';
  let listZoneFilter = 'all';

  // Зберігаємо екземпляри Chart.js щоб знищувати перед перемалюванням
  let _chartDoughnut = null;
  let _chartZone     = null;

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

  const normalizeZone = z => (z || '').trim().replace(/\S+/g, function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  const getAllZones = () => {
    const seen = new Set();
    all().forEach(function(d) { if (d.zone) seen.add(normalizeZone(d.zone)); });
    return Array.from(seen).sort();
  };

  // ── Знищити Chart.js-екземпляр безпечно ──
  function _destroyChart(ref) {
    if (ref) { try { ref.destroy(); } catch(e) {} }
    return null;
  }

  // ── Рендер фільтра зон ──
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

  // ── Рендер списку карток ──
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
      const clickable   = hasCoords ? ' list-card--clickable' : '';
      const clickHandler = hasCoords ? ' onclick="ChartsModule.selectOnMap(' + d.id + ')"' : '';

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
    // Шукаємо по кожному масиву окремо, щоб уникнути колізій id між масивами
    const d = window.APP_DATA;
    const item = (d && (
      (d.archanomaly || []).find(function(x) { return x.id === id; }) ||
      (d.artifacts   || []).find(function(x) { return x.id === id; }) ||
      (d.locations   || []).find(function(x) { return x.id === id; })
    )) || null;
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

  // ══════════════════════════════════════════════
  //  renderStats — Chart.js діаграми
  // ══════════════════════════════════════════════
  function renderStats() {
    const data  = all();
    const total = data.length;
    const locs  = data.filter(function(d) { return typeKey(d.type) === 'loc'; }).length;
    const arts  = data.filter(function(d) { return typeKey(d.type) === 'art'; }).length;
    const arcs  = data.filter(function(d) { return typeKey(d.type) === 'arc'; }).length;

    // ── Stat-cards ──
    const cards = document.getElementById('stat-cards');
    if (cards) {
      cards.innerHTML =
        '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">Всього об\'єктів</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#60a5fa">' + locs  + '</div><div class="stat-label">Локацій</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#ee5a24">' + arcs  + '</div><div class="stat-label">Архіаномалій</div></div>' +
        '<div class="stat-card"><div class="stat-value" style="color:#f59e0b">' + arts  + '</div><div class="stat-label">Артефактів</div></div>';
    }

    const bars = document.getElementById('stat-bars');
    if (!bars) return;

    // ── Підрахунок по зонах ──
    const zoneMap = {};
    data.forEach(function(d) {
      if (!d.zone) return;
      const z = normalizeZone(d.zone);
      if (!zoneMap[z]) zoneMap[z] = { total: 0, loc: 0, arc: 0, art: 0 };
      zoneMap[z].total++;
      zoneMap[z][typeKey(d.type)]++;
    });
    const zoneSorted = Object.entries(zoneMap).sort(function(a, b) { return b[1].total - a[1].total; });
    const zoneLabels = zoneSorted.map(function(e) { return e[0]; });
    const zoneLoc    = zoneSorted.map(function(e) { return e[1].loc; });
    const zoneArc    = zoneSorted.map(function(e) { return e[1].arc; });
    const zoneArt    = zoneSorted.map(function(e) { return e[1].art; });

    // ── Будуємо розмітку для двох canvas ──
    bars.innerHTML =
      '<div class="pane-title" style="margin-top:4px">Типи об\'єктів</div>' +
      '<div class="chartjs-wrap chartjs-wrap--doughnut">' +
        '<canvas id="chartjs-doughnut"></canvas>' +
      '</div>' +
      '<div class="zone-chart-wrap">' +
        '<div class="zone-chart-title">Розподіл по зонах' +
          '<span class="zc-click-hint">Клікни на зону → фільтр списку</span>' +
        '</div>' +
        '<div class="chartjs-wrap chartjs-wrap--bar">' +
          '<canvas id="chartjs-zone"></canvas>' +
        '</div>' +
      '</div>';

    // ── Знищуємо старі екземпляри ──
    _chartDoughnut = _destroyChart(_chartDoughnut);
    _chartZone     = _destroyChart(_chartZone);

    // ── Перевіряємо наявність Chart.js ──
    if (typeof Chart === 'undefined') {
      bars.insertAdjacentHTML('afterbegin',
        '<div style="color:#ee5a24;padding:8px 0;font-size:12px">⚠ Chart.js не підключено. ' +
        'Додайте &lt;script src="https://cdn.jsdelivr.net/npm/chart.js"&gt;&lt;/script&gt; в index.html.</div>');
      return;
    }

    // Спільні налаштування шрифту / кольорів для Chart.js
    Chart.defaults.color = '#8fa87a';
    Chart.defaults.font.family = 'inherit';
    Chart.defaults.font.size   = 11;

    // ── 1. Кругова (doughnut) — типи об'єктів ──
    const ctxD = document.getElementById('chartjs-doughnut');
    if (ctxD && total > 0) {
      _chartDoughnut = new Chart(ctxD, {
        type: 'doughnut',
        data: {
          labels: ['Локації', 'Архіаномалії', 'Артефакти'],
          datasets: [{
            data: [locs, arcs, arts],
            backgroundColor: ['#60a5fa', '#ee5a24', '#f59e0b'],
            borderColor:     ['#1a2a1a', '#1a2a1a', '#1a2a1a'],
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.4,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                boxWidth: 12,
                boxHeight: 12,
                color: '#8fa87a',
                maxWidth: 400,
              },
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const val = ctx.parsed;
                  const pct = total > 0 ? Math.round(val / total * 100) : 0;
                  return ' ' + ctx.label + ': ' + val + ' (' + pct + '%)';
                },
              },
            },
          },
        },
      });
    }

    // ── 2. Stacked horizontal bar — розподіл по зонах ──
    const ctxZ = document.getElementById('chartjs-zone');
    if (ctxZ && zoneSorted.length > 0) {
      _chartZone = new Chart(ctxZ, {
        type: 'bar',
        data: {
          labels: zoneLabels,
          datasets: [
            {
              label: 'Локації',
              data: zoneLoc,
              backgroundColor: '#60a5fa',
              borderColor:     '#1a2a1a',
              borderWidth: 1,
            },
            {
              label: 'Аномалії',
              data: zoneArc,
              backgroundColor: '#ee5a24',
              borderColor:     '#1a2a1a',
              borderWidth: 1,
            },
            {
              label: 'Артефакти',
              data: zoneArt,
              backgroundColor: '#f59e0b',
              borderColor:     '#1a2a1a',
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: 'y',        // горизонтальні смуги
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid:  { color: 'rgba(96,164,90,0.08)' },
              ticks: { color: '#8fa87a', stepSize: 1 },
            },
            y: {
              stacked: true,
              grid:  { color: 'rgba(96,164,90,0.08)' },
              ticks: { color: '#8fa87a', font: { size: 11 } },
            },
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                padding: 14,
                boxWidth: 12,
                boxHeight: 12,
                color: '#8fa87a',
              },
            },
            tooltip: {
              mode: 'index',
              axis: 'y',
            },
          },
          onClick: function(evt, elements) {
            if (!elements.length) return;
            const idx = elements[0].index;
            if (zoneLabels[idx]) ChartsModule.goToZone(zoneLabels[idx]);
          },
          onHover: function(evt, elements) {
            evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
          },
        },
      });

      // Динамічна висота: ~32px на зону
      ctxZ.parentElement.style.height = Math.max(160, zoneSorted.length * 32 + 48) + 'px';
    }
  }

  return { renderList, renderStats, setListFilter, setZoneFilter, selectOnMap, goToZone };
})();
