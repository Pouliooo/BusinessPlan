/* ══════════════════════════════════════════════════════════════
   script.js — Business Plan MVP — Château Gonflable
   Vanilla JS, pas de dépendances.
   ══════════════════════════════════════════════════════════════ */

// ── Correspondance onglet → clé DATA ─────────────────────────
const TAB_MAP = {
  'chateau':            'chateauGonflable',      // géré par renderMultiSectionTab
  'photobooth':         'photobooth',            // géré par renderMultiSectionTab
  'frais-initiaux':     'fraisInitiaux',
  'frais-recurrents':   'fraisRecurrentsAnnuels'
};

// ── État global ───────────────────────────────────────────────
const state = {
  page:         'detail',   // 'detail' | 'resume'
  tab:          'chateau',  // clé dans TAB_MAP
  sort:         { col: null, dir: 'asc' },
  customBlocks: [],          // [{ id, intitule, montant, note }]
  // Unités château pour la simulation
  chateauUnits: [
    { id: 'main', label: 'Château principal', isMain: true, prixAchat: 2382.00, prixLivraison: 178.80, prixLocation: 300, locationsMois: 1 }
  ],
  // Unités photobooth pour la simulation
  photoboothUnits: [],
  // IDs des cartes château dont le détail est déplié
  expandedUnits: new Set()
};


/* ════════════════════════════════════════════════════════════
   INITIALISATION
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadData();           // ← restaure l'état avant tout rendu

  initNavigation();
  initTabs();
  initSearch();
  initModal();
  initCustomBlocks();
  initExport();
  initChateauUnits();
  initPhotoboothUnits();
  initSave();

  // Rendu initial
  renderTable();
  renderSummary();
  renderChateauUnits();
  renderPhotoboothUnits();
  renderSimulator();
});


/* ════════════════════════════════════════════════════════════
   NAVIGATION PAGES
════════════════════════════════════════════════════════════ */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchPage(btn.dataset.page);
    });
  });
}

function switchPage(page) {
  state.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(`page-${page}`).classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
    b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false');
  });
}


/* ════════════════════════════════════════════════════════════
   ONGLETS
════════════════════════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab  = btn.dataset.tab;
      state.sort = { col: null, dir: 'asc' };
      clearSearch();

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });

      renderTable();
    });
  });
}


/* ════════════════════════════════════════════════════════════
   RECHERCHE / FILTRE
════════════════════════════════════════════════════════════ */
function initSearch() {
  const input = document.getElementById('search-input');
  const clear  = document.getElementById('search-clear');

  input.addEventListener('input', () => {
    clear.classList.toggle('hidden', !input.value);
    renderTable();
  });

  clear.addEventListener('click', () => {
    clearSearch();
    renderTable();
  });
}

function clearSearch() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('search-clear').classList.add('hidden');
}

function getSearchTerm() {
  return document.getElementById('search-input').value.trim().toLowerCase();
}


/* ════════════════════════════════════════════════════════════
   CALCULS DYNAMIQUES — frais annuels
════════════════════════════════════════════════════════════ */

/** Prix TTC du groupe électrogène (depuis la tab Château Gonflable) */
function getElectrogenePrice() {
  const row = DATA.chateauGonflable.rows.find(r =>
    r.produit && r.produit.toLowerCase().includes('lectro'));
  return row ? (parseFloat(row.prixTTC) || 0) : 0;
}

/**
 * Assurance multirisque matériel = 6 % de la valeur du matériel.
 * Base = somme des prixAchat de chaque château + électrogène par château
 *      + somme des prixAchat de chaque photobooth
 */
function computeAssuranceMateriel() {
  const electro = getElectrogenePrice();
  const baseChateaux = state.chateauUnits.reduce(
    (s, u) => s + (parseFloat(u.prixAchat) || 0) + electro, 0);
  const basePhotobooths = state.photoboothUnits.reduce(
    (s, u) => s + (parseFloat(u.prixAchat) || 0), 0);
  return (baseChateaux + basePhotobooths) * 0.06;
}

/** Injecte les valeurs calculées dans les lignes qui ont computed="assurance_materiel" */
function resolveComputedRows(rows) {
  return rows.map(row => {
    if (row.computed === 'assurance_materiel') {
      return { ...row, prixTTC: computeAssuranceMateriel() };
    }
    return row;
  });
}

/** Total annuel des frais de maintenance + frais récurrents (charges fixes) */
function getTotalChargesFixesAnnuelles() {
  const maintenance = DATA.fraisMaintenance.rows.reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  const recurrents  = resolveComputedRows(DATA.fraisRecurrentsAnnuels.rows)
    .reduce((s, r) => s + (parseFloat(r.prixTTC) || 0), 0);
  return maintenance + recurrents;
}

/** Retourne la clé DATA correspondant à un objet dataset */
function getDatasetKey(ds) {
  return Object.keys(DATA).find(k => DATA[k] === ds) || null;
}

/** Recalcule les totaux statiques après édition d'une ligne */
function recomputeDataTotals() {
  DATA.fraisRecurrent.totalCoutParLoc = DATA.fraisRecurrent.rows
    .reduce((s,r) => s + (parseFloat(r.coutParLoc)||0), 0);
  DATA.fraisInitiaux.totalPrixTTC = DATA.fraisInitiaux.rows
    .reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  DATA.fraisMaintenance.totalPrixTTC = DATA.fraisMaintenance.rows
    .reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
}


/* ════════════════════════════════════════════════════════════
   RENDU DU TABLEAU
════════════════════════════════════════════════════════════ */
function renderTable() {
  if (state.tab === 'chateau') {
    renderMultiSectionTab([
      { ds: DATA.chateauGonflable, label: '⚙️ Investissement — Initial — Matériel',          sortable: true  },
      { ds: DATA.fraisRecurrent,   label: '🔧 Frais de service — Par journée de location',   sortable: false },
      { ds: DATA.fraisMaintenance, label: '🛠️ Frais de maintenance — Par an',                sortable: false }
    ]);
    return;
  }
  if (state.tab === 'photobooth') {
    renderMultiSectionTab([
      { ds: DATA.photobooth,                 label: '⚙️ Investissement — Initial — Matériel',        sortable: true  },
      { ds: DATA.fraisServicePhotobooth,     label: '🔧 Frais de service — Par journée de location', sortable: false },
      { ds: DATA.fraisMaintenancePhotobooth, label: '🛠️ Frais de maintenance — Par an',              sortable: false }
    ]);
    return;
  }

  const dataset = DATA[TAB_MAP[state.tab]];
  const search  = getSearchTerm();
  let   rows    = [...dataset.rows];

  // Résolution des lignes calculées (ex : assurance multirisque)
  rows = resolveComputedRows(rows);

  // Filtre texte
  if (search) {
    rows = rows.filter(row =>
      Object.values(row).some(v =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(search)
      )
    );
  }

  // Tri
  if (state.sort.col) {
    const { col, dir } = state.sort;
    rows.sort((a, b) => {
      const av = a[col] ?? '';
      const bv = b[col] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'fr');
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  const wrapper = document.getElementById('table-wrapper');

  if (rows.length === 0 && dataset.rows.length === 0) {
    wrapper.innerHTML = `<div class="tab-empty-state">📋 Aucune donnée — à compléter prochainement.</div>`;
    return;
  }

  wrapper.innerHTML = buildTableHTML(dataset, rows, TAB_MAP[state.tab]);

  // Tri au clic sur en-tête
  wrapper.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      state.sort = { col: th.dataset.col,
        dir: state.sort.col === th.dataset.col && state.sort.dir === 'asc' ? 'desc' : 'asc' };
      renderTable();
    });
  });

  // Clic sur une ligne → modale
  wrapper.querySelectorAll('tbody tr[data-idx]').forEach(tr => {
    tr.addEventListener('click', () => {
      const idx     = parseInt(tr.dataset.idx, 10);
      const origIdx = parseInt(tr.dataset.origIdx, 10);
      openModal(dataset, rows[idx], TAB_MAP[state.tab], origIdx);
      wrapper.querySelectorAll('tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
    });
  });
}

/**
 * Rendu générique pour les onglets multi-sections (château, photobooth…)
 * @param {Array<{ds: Object, label: string, sortable: boolean}>} sections
 */
function renderMultiSectionTab(sections) {
  const search  = getSearchTerm();
  const wrapper = document.getElementById('table-wrapper');

  // ── Résoudre et filtrer chaque section ───────────────────
  const resolved = sections.map(({ ds, label, sortable }) => {
    let rows = resolveComputedRows([...ds.rows]);
    if (search) rows = rows.filter(row =>
      Object.values(row).some(v => v !== null && v !== undefined &&
        String(v).toLowerCase().includes(search)));
    if (sortable && state.sort.col) {
      const { col, dir } = state.sort;
      rows.sort((a, b) => {
        const av = a[col] ?? '', bv = b[col] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv : String(av).localeCompare(String(bv), 'fr');
        return dir === 'asc' ? cmp : -cmp;
      });
    }
    return { ds, label, sortable, rows, key: getDatasetKey(ds) };
  });

  // ── HTML ─────────────────────────────────────────────────
  wrapper.innerHTML = resolved.map(({ ds, label, rows, key }, i) => {
    const body = (rows.length === 0 && ds.rows.length === 0)
      ? `<div class="tab-empty-state">📋 Aucune donnée — à compléter prochainement.</div>`
      : buildTableHTML(ds, rows, key);
    return `<div class="tab-section" data-section-idx="${i}">
              <div class="tab-section-header">${label}</div>
              ${body}
            </div>`;
  }).join('');

  // ── Listeners ────────────────────────────────────────────
  resolved.forEach(({ ds, sortable, rows, key }, i) => {
    const sec = wrapper.querySelector(`[data-section-idx="${i}"]`);

    if (sortable) {
      sec.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          state.sort = { col: th.dataset.col,
            dir: state.sort.col === th.dataset.col && state.sort.dir === 'asc' ? 'desc' : 'asc' };
          renderTable();
        });
      });
    }

    sec.querySelectorAll('tbody tr[data-idx]').forEach(tr => {
      tr.addEventListener('click', () => {
        const idx     = parseInt(tr.dataset.idx, 10);
        const origIdx = parseInt(tr.dataset.origIdx, 10);
        openModal(ds, rows[idx], key, origIdx);
        wrapper.querySelectorAll('tbody tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });
    });
  });
}



/** Formate un nombre décimal brut pour value="" d'un input */
function fmtRaw(val) {
  if (val === null || val === undefined || val === '') return '';
  return parseFloat(val).toFixed(2);
}

function buildTableHTML(dataset, rows, datasetKey) {
  const { columns } = dataset;

  /* ── En-têtes ─────────────────────────── */
  const keyAttr = datasetKey ? ` data-dataset-key="${escHtml(datasetKey)}"` : '';
  let html = `<table${keyAttr}><thead><tr>`;
  columns.forEach(col => {
    const active = state.sort.col === col.key;
    const icon   = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = active ? `sort-${state.sort.dir}` : '';
    html += `<th data-col="${col.key}" class="${cls}">
               ${escHtml(col.label)} <span class="sort-icon">${icon}</span>
             </th>`;
  });
  html += '</tr></thead>';

  /* ── Corps ────────────────────────────── */
  html += '<tbody>';
  if (rows.length === 0) {
    html += `<tr><td colspan="${columns.length}" style="text-align:center;padding:36px;color:#94a3b8;">
               Aucun résultat pour cette recherche.
             </td></tr>`;
  } else {
    rows.forEach((row, idx) => {
      const origIdx = dataset.rows.indexOf(row);
      html += `<tr data-idx="${idx}" data-orig-idx="${origIdx}" title="Cliquer pour modifier">`;
      columns.forEach(col => {
        const cellCls = col.type === 'price' ? 'price-cell' :
                        col.type === 'number' ? 'num-cell' :
                        col.type === 'text'   ? 'text-cell' : '';
        const cellVal = col.compute ? col.compute(row) : row[col.key];
        html += `<td class="${cellCls}">${renderCellShort(cellVal, col.type)}</td>`;
      });
      html += '</tr>';
    });
  }
  html += '</tbody>';

  /* ── Pied (totaux) ────────────────────── */
  html += buildFooterHTML(dataset, rows);

  html += '</table>';
  return html;
}

function buildFooterHTML(dataset, rows) {
  const { columns } = dataset;

  // Vérifie si on a au moins une colonne de type price avec total
  const hasPriceCols = columns.some(c => c.type === 'price');
  if (!hasPriceCols) return '';

  let html = '<tfoot><tr>';
  columns.forEach((col, i) => {
    if (i === 0) {
      html += '<td><strong>Total</strong></td>';
      return;
    }
    if (col.type !== 'price') { html += '<td></td>'; return; }

    // 1) Cherche un total pré-défini : "total" + key capitalisé
    const preKey = 'total' + col.key.charAt(0).toUpperCase() + col.key.slice(1);
    if (dataset[preKey] !== undefined) {
      html += `<td class="price-cell"><strong>${fmtPrice(dataset[preKey])}</strong></td>`;
    } else {
      // 2) Calcul dynamique depuis les rows visibles
      const sum = rows.reduce((acc, r) => acc + (parseFloat(col.compute ? col.compute(r) : r[col.key]) || 0), 0);
      html += `<td class="price-cell"><strong>${fmtPrice(sum)}</strong></td>`;
    }
  });
  html += '</tr></tfoot>';
  return html;
}


/* ════════════════════════════════════════════════════════════
   FORMATAGE DES CELLULES (version courte pour le tableau)
════════════════════════════════════════════════════════════ */
function renderCellShort(val, type) {
  if (val === null || val === undefined || val === '') {
    return '<span class="empty-val">—</span>';
  }
  switch (type) {
    case 'price':  return fmtPrice(val);
    case 'number': return String(val);
    case 'bool':   return val ? '✅' : '❌';
    case 'link':   return `<a href="${escHtml(val)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 Voir</a>`;
    case 'badge':  return `<span class="badge ${badgeCls(val)}">${escHtml(val)}</span>`;
    case 'rating': return renderRating(val);
    default:       return escHtml(String(val));
  }
}

function renderRating(val) {
  const n    = parseFloat(val) || 0;
  const pct  = Math.round((n / 20) * 100);
  return `<div class="rating-bar">
            <div class="rating-track"><div class="rating-fill" style="width:${pct}%"></div></div>
            <span class="rating-label">${n}/20</span>
          </div>`;
}

function badgeCls(val) {
  // Convertit la valeur en classe CSS stable
  return 'badge-' + String(val).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}


/* ════════════════════════════════════════════════════════════
   MODALE / PANNEAU LATÉRAL
════════════════════════════════════════════════════════════ */
function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(dataset, row, datasetKey, origIdx) {
  const titleEl   = document.getElementById('modal-title');
  const contentEl = document.getElementById('modal-content');
  const footerEl  = document.getElementById('modal-footer');

  const titleVal = row.produit || row.intitule || row.description || 'Détail';
  titleEl.textContent = titleVal;

  // ── Image en haut si disponible ─────────────────────────
  const imgHtml = row.image
    ? `<div class="modal-image-wrap">
         <img src="${escHtml(row.image)}" alt="${escHtml(titleVal)}" class="modal-img"
              onerror="this.parentElement.style.display='none'">
       </div>`
    : '';

  // Éditable si la ligne existe dans le dataset original et n'est pas calculée
  const isEditable = !!datasetKey && origIdx >= 0 && !row.computed;
  const editableTypes = new Set(['text', 'price', 'number', 'link']);
  const multilineKeys = new Set(['avertissement', 'commentaire', 'remarque', 'note']);

  let html = '';
  dataset.columns.forEach(col => {
    const val   = row[col.key];
    const empty = val === null || val === undefined || val === '';

    if (isEditable && editableTypes.has(col.type)) {
      // ── Champ éditable ──────────────────────────────────────
      let input;
      if (col.type === 'price' || col.type === 'number') {
        input = `<input type="number" class="modal-input" data-col="${col.key}"
                        value="${val !== null && val !== undefined ? val : ''}"
                        step="${col.type === 'price' ? '0.01' : '1'}" min="0">`;
      } else if (multilineKeys.has(col.key)) {
        input = `<textarea class="modal-input modal-textarea" data-col="${col.key}" rows="3">${escHtml(String(val ?? ''))}</textarea>`;
      } else if (col.type === 'link') {
        input = `<input type="url" class="modal-input" data-col="${col.key}" value="${escHtml(String(val ?? ''))}">`;
      } else {
        input = `<input type="text" class="modal-input" data-col="${col.key}" value="${escHtml(String(val ?? ''))}">`;
      }
      html += `<div class="modal-field">
                 <div class="modal-field-label">${escHtml(col.label)}</div>
                 <div class="modal-field-value">${input}</div>
               </div>`;
    } else {
      // ── Lecture seule ───────────────────────────────────────
      const isBool = col.type === 'bool';
      if (empty && !isBool) {
        html += `<div class="modal-field">
                   <div class="modal-field-label">${escHtml(col.label)}</div>
                   <div class="modal-field-value"><span class="modal-empty">Non renseigné</span></div>
                 </div>`;
        return;
      }
      let rendered = '';
      switch (col.type) {
        case 'price':  rendered = `<span class="price">${fmtPrice(val)}</span>`; break;
        case 'link':   rendered = `<a href="${escHtml(val)}" target="_blank" rel="noopener">${escHtml(val)}</a>`; break;
        case 'bool':   rendered = val ? '✅ Oui' : '❌ Non'; break;
        case 'badge':  rendered = `<span class="badge ${badgeCls(val)}">${escHtml(val)}</span>`; break;
        case 'rating': rendered = renderRating(val) + `<br><small style="color:var(--text-muted)">${val} / 20</small>`; break;
        default:       rendered = escHtml(String(val));
      }
      html += `<div class="modal-field">
                 <div class="modal-field-label">${escHtml(col.label)}</div>
                 <div class="modal-field-value ${col.type === 'price' ? 'price' : ''}">${rendered}</div>
               </div>`;
    }
  });

  contentEl.innerHTML = imgHtml + html;

  // ── Footer ───────────────────────────────────────────────
  if (isEditable) {
    footerEl.innerHTML = `
      <button class="btn-secondary" id="modal-cancel-btn">Annuler</button>
      <button class="btn-primary"   id="modal-save-btn">💾 Sauvegarder</button>`;
    footerEl.classList.remove('hidden');
    document.getElementById('modal-save-btn').addEventListener('click', () => {
      saveModalEdits(dataset, datasetKey, origIdx);
    });
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  } else {
    footerEl.innerHTML = '';
    footerEl.classList.add('hidden');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  // Focus sur le premier input si éditable, sinon sur fermer
  const firstInput = contentEl.querySelector('.modal-input');
  (firstInput || document.getElementById('modal-close')).focus();
}

function saveModalEdits(dataset, datasetKey, origIdx) {
  const contentEl = document.getElementById('modal-content');
  const row = DATA[datasetKey].rows[origIdx];

  contentEl.querySelectorAll('[data-col]').forEach(input => {
    const col = dataset.columns.find(c => c.key === input.dataset.col);
    if (!col) return;
    const raw = input.value;
    if (col.type === 'price' || col.type === 'number') {
      row[col.key] = raw === '' ? null : parseFloat(raw);
    } else {
      row[col.key] = raw;
    }
  });

  recomputeDataTotals();
  renderTable();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  saveData(false);
  closeModal();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-footer').classList.add('hidden');
  document.querySelectorAll('tbody tr').forEach(r => r.classList.remove('selected'));
}


/* ════════════════════════════════════════════════════════════
   PAGE RÉSUMÉ — CARTES DE SYNTHÈSE
════════════════════════════════════════════════════════════ */

/** Construit un bouton "?" avec tooltip au survol */
function buildTooltip(items) {
  if (!items.length) return '';
  const rows = items.map(({ label, price }) => `
    <div class="sc-tooltip-row">
      <span class="sc-tooltip-name">${escHtml(label)}</span>
      <span class="sc-tooltip-price">${price != null ? fmtPrice(price) : '—'}</span>
    </div>`).join('');
  return `<div class="sc-info">
    <button class="sc-info-btn" tabindex="-1" aria-label="Détail">?</button>
    <div class="sc-tooltip" role="tooltip">${rows}</div>
  </div>`;
}

function renderSummary() {
  // TTC → HT (TVA 20 %)
  const toHT = v => (parseFloat(v) || 0) / 1.2;

  const investChateaux    = state.chateauUnits.reduce(
    (s, u) => s + (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0), 0);
  const investPhotobooths = state.photoboothUnits.reduce(
    (s, u) => s + (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0), 0);
  const investTotal  = investChateaux + investPhotobooths;
  const fraisInitTTC  = DATA.fraisInitiaux.totalPrixTTC;
  const nbChateaux    = state.chateauUnits.length;
  const nbPhotobooths = state.photoboothUnits.length;

  const equipLabel = [
    nbChateaux   ? `${nbChateaux} château${nbChateaux > 1 ? 'x' : ''}`       : '',
    nbPhotobooths ? `${nbPhotobooths} photobooth${nbPhotobooths > 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(', ') || 'aucun équipement';

  // ── Tooltips fixes ───────────────────────────────────────────
  const tooltipFraisInit = buildTooltip(
    DATA.fraisInitiaux.rows.map(r => ({ label: r.intitule, price: toHT(r.prixTTC) }))
  );
  const tooltipEquip = buildTooltip([
    ...state.chateauUnits.flatMap(u => [
      { label: `🏰 ${u.label}`,  price: toHT(parseFloat(u.prixAchat)     || 0) },
      { label: `🚚 Livraison`,   price: toHT(parseFloat(u.prixLivraison) || 0) }
    ]),
    ...state.photoboothUnits.flatMap(u => [
      { label: `📷 ${u.label}`,  price: toHT(parseFloat(u.prixAchat)     || 0) },
      { label: `🚚 Livraison`,   price: toHT(parseFloat(u.prixLivraison) || 0) }
    ])
  ]);
  const tooltipCharges = buildTooltip([
    ...DATA.fraisMaintenance.rows.map(r => ({ label: r.intitule, price: toHT(r.prixTTC) })),
    ...resolveComputedRows(DATA.fraisRecurrentsAnnuels.rows).map(r => ({ label: r.intitule, price: toHT(r.prixTTC) }))
  ]);

  // ── Cartes "Charges de location" — agrégées par type ────────
  const coutParLocHTChateaux = DATA.fraisRecurrent.rows.reduce((s,r) => s + (r.prixHT||0)*(parseFloat(r.usure)||0), 0);
  const totalChargesVarChateaux = state.chateauUnits.reduce((s, u) => {
    return s + coutParLocHTChateaux * (parseFloat(u.locationsMois) || 0) * 12;
  }, 0);
  const totalLocsAnChateaux = state.chateauUnits.reduce((s, u) => s + (parseFloat(u.locationsMois) || 0) * 12, 0);
  const tooltipChateauLoc = buildTooltip(
    DATA.fraisRecurrent.rows.map(r => ({ label: r.intitule, price: (r.prixHT||0)*(parseFloat(r.usure)||0) }))
  );
  const chateauLocCard = state.chateauUnits.length ? `
    <div class="summary-card accent-green">
      <div class="sc-top">
        <div class="sc-label">🏰 Châteaux — charges de location</div>
        ${tooltipChateauLoc}
      </div>
      <div class="sc-value">${fmtPrice(totalChargesVarChateaux)}</div>
      <div class="sc-sub">HT — ${totalLocsAnChateaux} loc/an · ${nbChateaux} château${nbChateaux > 1 ? 'x' : ''}</div>
    </div>` : '';

  const coutLocPhotobooth = DATA.fraisServicePhotobooth.rows.reduce((s, r) => s + (parseFloat(r.coutParLoc) || 0), 0);
  const totalChargesVarPhotobooths = state.photoboothUnits.reduce((s, u) => {
    return s + coutLocPhotobooth * (parseFloat(u.locationsMois) || 0) * 12;
  }, 0);
  const totalLocsAnPhotobooths = state.photoboothUnits.reduce((s, u) => s + (parseFloat(u.locationsMois) || 0) * 12, 0);
  const tooltipPhotoboothLoc = buildTooltip(
    DATA.fraisServicePhotobooth.rows.map(r => ({ label: r.intitule, price: (r.prixHT||0)*(parseFloat(r.usure)||0) || toHT(r.coutParLoc) }))
  );
  const photoboothLocCard = state.photoboothUnits.length ? `
    <div class="summary-card accent-purple">
      <div class="sc-top">
        <div class="sc-label">📷 Photobooths — charges de location</div>
        ${tooltipPhotoboothLoc}
      </div>
      <div class="sc-value">${fmtPrice(totalChargesVarPhotobooths)}</div>
      <div class="sc-sub">HT — ${totalLocsAnPhotobooths} loc/an · ${nbPhotobooths} photobooth${nbPhotobooths > 1 ? 's' : ''}</div>
    </div>` : '';

  document.getElementById('summary-grid').innerHTML = `
    <div class="bp-group">
      <div class="bp-group-label">Fixe</div>
      <div class="bp-group-cards">
        <div class="summary-card accent-orange">
          <div class="sc-top">
            <div class="sc-label">Frais initiaux</div>
            ${tooltipFraisInit}
          </div>
          <div class="sc-value">${fmtPrice(toHT(fraisInitTTC))}</div>
          <div class="sc-sub">HT — Création SARL</div>
        </div>
        <div class="summary-card accent-cyan">
          <div class="sc-top">
            <div class="sc-label">Investissement équipements</div>
            ${tooltipEquip}
          </div>
          <div class="sc-value">${fmtPrice(toHT(investTotal))}</div>
          <div class="sc-sub">HT — ${equipLabel} (achat + livraison)</div>
        </div>
      </div>
    </div>
    <div class="bp-group">
      <div class="bp-group-label">Charges de location</div>
      <div class="bp-group-cards">
        ${chateauLocCard}${photoboothLocCard}
        ${!chateauLocCard && !photoboothLocCard ? '<span class="bp-group-empty">Aucune unité configurée</span>' : ''}
      </div>
    </div>
    <div class="bp-group">
      <div class="bp-group-label">Par année</div>
      <div class="bp-group-cards">
        <div class="summary-card accent-red">
          <div class="sc-top">
            <div class="sc-label">Charges fixes / an</div>
            ${tooltipCharges}
          </div>
          <div class="sc-value">${fmtPrice(toHT(getTotalChargesFixesAnnuelles()))}</div>
          <div class="sc-sub">HT — Total annuel</div>
        </div>
      </div>
    </div>
  `;

  updateGrandTotal();
}

function sumCol(rows, key) {
  return rows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0);
}

function updateGrandTotal() {
  const investTTC = [
    ...state.chateauUnits,
    ...state.photoboothUnits
  ].reduce((s, u) => s + (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0), 0);
  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);
  const grandTotal   = investTTC + fraisInitTTC + customTotal;

  const breakdownParts = [
    `Matériel ${fmtPrice(investTTC)}`,
    `Frais init. ${fmtPrice(fraisInitTTC)}`
  ];
  if (customTotal > 0) breakdownParts.push(`Blocs perso ${fmtPrice(customTotal)}`);

  document.getElementById('grand-total').innerHTML = `
    <div>
      <div class="gt-label">💰 Total Global Estimé</div>
      <div class="gt-breakdown">${breakdownParts.join(' + ')}</div>
    </div>
    <div class="gt-value">${fmtPrice(grandTotal)}</div>
  `;

  // Recalcule aussi le simulateur
  renderSimulator();
}


/* ════════════════════════════════════════════════════════════
   SECTION "MES CHÂTEAUX" — unités configurables
════════════════════════════════════════════════════════════ */

/** Initialise le bouton "Ajouter un château" */
function initChateauUnits() {
  document.getElementById('add-chateau-btn').addEventListener('click', () => {
    const id = Date.now();
    state.chateauUnits.push({
      id,
      label: `Château ${state.chateauUnits.length + 1}`,
      isMain: false,
      prixAchat: 0,
      prixLivraison: 0,
      prixLocation: 150,
      locationsMois: 4
    });
    renderChateauUnits();
    renderSummary();
    renderSimulator();
    updateGrandTotal();
    scheduleAutoSave();
  });
}

/** Supprime une unité non-principale et re-rend */
function removeChateauUnit(id) {
  state.chateauUnits = state.chateauUnits.filter(u => String(u.id) !== String(id));
  renderChateauUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  scheduleAutoSave();
}

/** Retourne l'investissement total d'une unité (TTC) */
function getUnitInvest(unit) {
  return (parseFloat(unit.prixAchat) || 0) + (parseFloat(unit.prixLivraison) || 0);
}

/**
 * Calcule les stats de rentabilité d'une unité.
 * @param {Object} unit   — unité (château ou photobooth)
 * @param {number} coutParLoc — coût HT par location (déjà calculé par l'appelant)
 */
function calcUnitStats(unit, coutParLoc) {
  const prixLoc   = parseFloat(unit.prixLocation)  || 0;
  const nbMois    = parseFloat(unit.locationsMois) || 0;
  const invest    = getUnitInvest(unit);
  const marge     = prixLoc - coutParLoc;
  return {
    marge,
    caMensuel:  prixLoc * nbMois,
    caAnnuel:   prixLoc * nbMois * 12,
    chargesVar: coutParLoc * nbMois * 12,
    invest,
    seuilLocs:  marge > 0 ? Math.ceil(invest / marge) : Infinity
  };
}

function chateauCoutParLoc() {
  return DATA.fraisRecurrent.rows.reduce((s,r) => s + (r.prixHT||0)*(parseFloat(r.usure)||0), 0);
}

function photoboothCoutParLoc() {
  return DATA.fraisServicePhotobooth.rows.reduce((s,r) => {
    return s + (r.prixHT != null ? (r.prixHT||0)*(parseFloat(r.usure)||0) : (parseFloat(r.coutParLoc)||0));
  }, 0);
}

/** Rendu complet de toutes les cartes château */
function renderChateauUnits() {
  const container = document.getElementById('chateau-units-container');
  const coutLoc   = chateauCoutParLoc();

  const badge = document.getElementById('chateau-cost-badge');
  if (badge) badge.innerHTML = `${fmtPrice(coutLoc)}<span class="unit-cost-label"> frais de service</span>`;

  container.innerHTML = state.chateauUnits.map(unit =>
    buildUnitCardHTML(unit, calcUnitStats(unit, coutLoc))
  ).join('');

  attachUnitListeners(container, state.chateauUnits, removeChateauUnit, coutLoc, true);
}

/** Construit le HTML du détail des équipements (dépliable) */
function buildUnitDetailHTML() {
  const rows  = DATA.chateauGonflable.rows;
  const total = rows.reduce((s, r) => s + (r.prixHT || 0), 0);
  let html = '<div class="unit-detail-list">';
  rows.forEach(row => {
    html += `<div class="detail-row">
               <span class="detail-row-name">${escHtml(row.produit)}</span>
               <span class="detail-row-price">${fmtPrice(row.prixHT || 0)}</span>
             </div>`;
  });
  html += `<div class="detail-row detail-row-total">
             <span class="detail-row-name">Total équipements <small style="font-weight:400;color:var(--text-muted)">(HT)</small></span>
             <span class="detail-row-price">${fmtPrice(total)}</span>
           </div>`;
  html += '</div>';
  return html;
}

/** Construit le HTML d'une carte unité (château ou photobooth) */
function buildUnitCardHTML(unit, s, cfg = {}) {
  const { icon = '🏰', placeholder = 'Nom du château', showExpand = true } = cfg;
  const expanded  = showExpand && state.expandedUnits.has(String(unit.id));
  const deleteBtn = unit.isMain ? ''
    : `<button class="btn-danger unit-delete" data-unit-id="${unit.id}">✕</button>`;

  return `
    <div class="unit-card" data-unit-id="${unit.id}">
      <div class="unit-header">
        <span class="unit-icon">${icon}</span>
        <input class="unit-input unit-name-input" type="text"
               data-unit-id="${unit.id}" data-field="label"
               value="${escHtml(unit.label)}" placeholder="${escHtml(placeholder)}">
        ${deleteBtn}
      </div>

      <div class="unit-grid">
        <div class="unit-field">
          <div class="unit-field-label">Prix d'achat (HT)</div>
          <input type="number" class="unit-input unit-price-input"
                 data-unit-id="${unit.id}" data-field="prixAchat"
                 value="${fmtRaw((unit.prixAchat || 0) / 1.2)}" min="0" step="10" placeholder="0.00">
        </div>
        <div class="unit-field">
          <div class="unit-field-label">Prix de livraison (HT)</div>
          <input type="number" class="unit-input unit-price-input"
                 data-unit-id="${unit.id}" data-field="prixLivraison"
                 value="${fmtRaw((unit.prixLivraison || 0) / 1.2)}" min="0" step="1" placeholder="0.00">
        </div>
        <div class="unit-field">
          <div class="unit-field-label">Prix de location (€ TTC)</div>
          <input type="number" class="unit-input unit-price-input"
                 data-unit-id="${unit.id}" data-field="prixLocation"
                 value="${fmtRaw(unit.prixLocation)}" min="0" step="5" placeholder="150">
        </div>
        <div class="unit-field">
          <div class="unit-field-label">Locations / mois</div>
          <input type="number" class="unit-input"
                 data-unit-id="${unit.id}" data-field="locationsMois"
                 value="${unit.locationsMois || ''}" min="0" step="1" placeholder="4">
        </div>
      </div>

      <div class="unit-stats" data-stats-for="${unit.id}">
        ${buildUnitStatsHTML(s)}
      </div>

      ${showExpand ? `
      <div class="unit-expand-bar">
        <button class="unit-expand-btn" data-unit-id="${unit.id}">
          ${expanded ? '▲ Masquer les équipements' : '▼ Voir les équipements'}
        </button>
      </div>
      ${expanded ? `<div class="unit-detail">${buildUnitDetailHTML()}</div>` : ''}` : ''}
    </div>`;
}

/** Construit uniquement le HTML des stats d'une carte */
function buildUnitStatsHTML(s) {
  const isGood = n => isFinite(n) && n <= 40;
  const fmtLoc = n => isFinite(n) ? `${n} loc.` : '∞';
  return `
    <div class="unit-stat">
      <span class="unit-stat-label">Marge / loc.</span>
      <span class="unit-stat-value ${s.marge >= 0 ? 'pos' : 'neg'}">${fmtPrice(s.marge)}</span>
    </div>
    <div class="unit-stat">
      <span class="unit-stat-label">CA mensuel</span>
      <span class="unit-stat-value">${fmtPrice(s.caMensuel)}</span>
    </div>
    <div class="unit-stat">
      <span class="unit-stat-label">CA annuel</span>
      <span class="unit-stat-value">${fmtPrice(s.caAnnuel)}</span>
    </div>
    <div class="unit-stat">
      <span class="unit-stat-label">Seuil invest.</span>
      <span class="unit-stat-value ${isGood(s.seuilLocs) ? 'pos' : 'warn'}">${fmtLoc(s.seuilLocs)}</span>
    </div>`;
}

/** Met à jour uniquement les stats d'une carte (sans re-render global) */
function refreshUnitStats(unit, coutParLoc) {
  const statsEl = document.querySelector(`.unit-stats[data-stats-for="${unit.id}"]`);
  if (statsEl) statsEl.innerHTML = buildUnitStatsHTML(calcUnitStats(unit, coutParLoc));
}

/**
 * Attache tous les listeners d'une section d'unités (inputs, suppression, expand).
 * @param {Element}  container    — conteneur DOM
 * @param {Array}    units        — tableau d'unités de l'état
 * @param {Function} removeFn     — fonction de suppression (id) => void
 * @param {number}   coutParLoc   — coût HT par location pour le calcul de stats
 * @param {boolean}  hasExpand    — true si les cartes ont un bouton "voir équipements"
 */
function attachUnitListeners(container, units, removeFn, coutParLoc, hasExpand) {
  container.querySelectorAll('.unit-delete').forEach(btn => {
    btn.addEventListener('click', () => removeFn(btn.dataset.unitId));
  });

  if (hasExpand) {
    container.querySelectorAll('.unit-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.unitId;
        state.expandedUnits.has(id) ? state.expandedUnits.delete(id) : state.expandedUnits.add(id);
        renderChateauUnits();
      });
    });
  }

  const htFields  = new Set(['prixAchat', 'prixLivraison']);
  const numFields = new Set(['prixAchat', 'prixLivraison', 'prixLocation', 'locationsMois']);

  container.querySelectorAll('.unit-input').forEach(input => {
    input.addEventListener('input', () => {
      const unit = units.find(u => String(u.id) === String(input.dataset.unitId));
      if (!unit) return;
      const field = input.dataset.field;
      if (numFields.has(field)) {
        const val = parseFloat(input.value) || 0;
        unit[field] = htFields.has(field) ? val * 1.2 : val;
      } else {
        unit[field] = input.value;
      }
      refreshUnitStats(unit, coutParLoc);
      renderSummary();
      renderSimulator();
      updateGrandTotal();
      scheduleAutoSave();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   SECTION "MES PHOTOBOOTHS" — unités configurables
════════════════════════════════════════════════════════════ */

function initPhotoboothUnits() {
  document.getElementById('add-photobooth-btn').addEventListener('click', () => {
    state.photoboothUnits.push({
      id: Date.now(),
      label: `Photobooth ${state.photoboothUnits.length + 1}`,
      prixAchat: 0, prixLivraison: 0, prixLocation: 100, locationsMois: 4
    });
    renderPhotoboothUnits();
    renderSummary();
    renderSimulator();
    updateGrandTotal();
    scheduleAutoSave();
  });
}

function removePhotoboothUnit(id) {
  state.photoboothUnits = state.photoboothUnits.filter(u => String(u.id) !== String(id));
  renderPhotoboothUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  scheduleAutoSave();
}

function renderPhotoboothUnits() {
  const container = document.getElementById('photobooth-units-container');
  const hint      = document.getElementById('photobooth-hint');
  const coutLoc   = photoboothCoutParLoc();

  const badge = document.getElementById('photobooth-cost-badge');
  if (badge) badge.innerHTML = coutLoc > 0
    ? `${fmtPrice(coutLoc)}<span class="unit-cost-label"> frais de service</span>` : '';

  hint.style.display = state.photoboothUnits.length === 0 ? '' : 'none';

  container.innerHTML = state.photoboothUnits.map(unit =>
    buildUnitCardHTML(unit, calcUnitStats(unit, coutLoc), { icon: '📷', placeholder: 'Nom du photobooth', showExpand: false })
  ).join('');

  attachUnitListeners(container, state.photoboothUnits, removePhotoboothUnit, coutLoc, false);
}


/* ════════════════════════════════════════════════════════════
   SIMULATEUR DE RENTABILITÉ — agrégé sur tous les châteaux
════════════════════════════════════════════════════════════ */
function renderSimulator() {
  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);

  // Agrégation par unité
  let totalInvestEquip = 0;
  let totalCA          = 0;
  let totalChargesVar  = 0;

  const coutLocChateau    = chateauCoutParLoc();
  const coutLocPhotobooth = photoboothCoutParLoc();

  state.chateauUnits.forEach(unit => {
    const s = calcUnitStats(unit, coutLocChateau);
    totalInvestEquip += s.invest;
    totalCA          += s.caAnnuel;
    totalChargesVar  += s.chargesVar;
  });

  state.photoboothUnits.forEach(unit => {
    const s = calcUnitStats(unit, coutLocPhotobooth);
    totalInvestEquip += s.invest;
    totalCA          += s.caAnnuel;
    totalChargesVar  += s.chargesVar;
  });

  const chargesFixesAnnuelles = getTotalChargesFixesAnnuelles();
  const totalInvest   = totalInvestEquip + fraisInitTTC + customTotal;
  const totalCharges  = totalChargesVar + chargesFixesAnnuelles;
  const benefAnnuel   = totalCA - totalCharges;
  const benefMensuel  = benefAnnuel / 12;
  const moisSeuil     = benefMensuel > 0 ? Math.ceil(totalInvest / benefMensuel) : Infinity;

  const fmtM = n => isFinite(n) ? `${n} mois` : '∞';
  const cls  = (n, good, warn) => n <= good ? 'good' : n <= warn ? '' : 'warn';

  const nbChateaux    = state.chateauUnits.length;
  const nbPhotobooths = state.photoboothUnits.length;
  const equipStr = [
    nbChateaux    ? `${nbChateaux} château${nbChateaux > 1 ? 'x' : ''}`           : '',
    nbPhotobooths ? `${nbPhotobooths} photobooth${nbPhotobooths > 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(', ') || '—';

  document.getElementById('be-results').innerHTML = `
    <div class="be-item">
      <div class="be-item-label">CA annuel total</div>
      <div class="be-item-value">${fmtPrice(totalCA)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Charges variables / an</div>
      <div class="be-item-value">${fmtPrice(totalChargesVar)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Charges fixes / an</div>
      <div class="be-item-value">${fmtPrice(chargesFixesAnnuelles)}</div>
    </div>
    <div class="be-item ${benefAnnuel >= 0 ? 'good' : 'warn'}">
      <div class="be-item-label">Bénéfice annuel</div>
      <div class="be-item-value">${fmtPrice(benefAnnuel)}</div>
    </div>
    <div class="be-item ${cls(moisSeuil, 18, 36)}">
      <div class="be-item-label">Retour sur invest.</div>
      <div class="be-item-value">${fmtM(moisSeuil)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Invest. total</div>
      <div class="be-item-value">${fmtPrice(totalInvest)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Équipements actifs</div>
      <div class="be-item-value">${equipStr}</div>
    </div>
  `;
}


/* ════════════════════════════════════════════════════════════
   BLOCS PERSONNALISÉS
════════════════════════════════════════════════════════════ */
function initCustomBlocks() {
  document.getElementById('add-block-btn').addEventListener('click', () => {
    state.customBlocks.push({ id: Date.now(), intitule: '', montant: '', note: '' });
    renderCustomBlocks();
    updateGrandTotal();
  });
}

function removeBlock(id) {
  state.customBlocks = state.customBlocks.filter(b => b.id !== id);
  renderCustomBlocks();
  updateGrandTotal();
}

function renderCustomBlocks() {
  const container = document.getElementById('custom-blocks-container');
  const hint      = document.getElementById('blocks-hint');

  hint.style.display = state.customBlocks.length === 0 ? '' : 'none';

  container.innerHTML = state.customBlocks.map(block => `
    <div class="custom-block" data-block-id="${block.id}">
      <input class="cb-intitule" type="text"   placeholder="Intitulé (ex: Formation)"
             value="${escHtml(block.intitule)}" data-field="intitule" data-id="${block.id}" />
      <input class="cb-montant"  type="number" placeholder="Montant €"
             value="${escHtml(block.montant)}"  data-field="montant"  data-id="${block.id}"
             min="0" step="0.01" />
      <input class="cb-note"     type="text"   placeholder="Note (optionnel)"
             value="${escHtml(block.note)}"     data-field="note"     data-id="${block.id}" />
      <button class="btn-danger" onclick="removeBlock(${block.id})">✕ Supprimer</button>
    </div>
  `).join('');

  // Mise à jour en temps réel
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      const id    = parseInt(input.dataset.id, 10);
      const field = input.dataset.field;
      const block = state.customBlocks.find(b => b.id === id);
      if (block) {
        block[field] = input.value;
        updateGrandTotal();
      }
    });
  });
}


/* ════════════════════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════════════════════ */
function initExport() {
  document.getElementById('export-csv-btn').addEventListener('click', exportCurrentTableCSV);
  document.getElementById('export-summary-csv-btn').addEventListener('click', exportSummaryCSV);
  document.getElementById('print-btn').addEventListener('click', () => window.print());
}

function exportCurrentTableCSV() {
  if (state.tab === 'chateau' || state.tab === 'photobooth') {
    const sections = state.tab === 'chateau'
      ? [
          { ds: DATA.chateauGonflable, label: 'Investissement — Initial — Matériel' },
          { ds: DATA.fraisRecurrent,   label: 'Frais de service — Par journée de location' },
          { ds: DATA.fraisMaintenance, label: 'Frais de maintenance — Par an' }
        ]
      : [
          { ds: DATA.photobooth,                 label: 'Investissement — Initial — Matériel' },
          { ds: DATA.fraisServicePhotobooth,     label: 'Frais de service — Par journée de location' },
          { ds: DATA.fraisMaintenancePhotobooth, label: 'Frais de maintenance — Par an' }
        ];
    const search = getSearchTerm();
    const filter = rows => search
      ? rows.filter(row => Object.values(row).some(v => v !== null && String(v).toLowerCase().includes(search)))
      : rows;

    const csvRows = sections.flatMap(({ ds, label }) => {
      const rows = filter(resolveComputedRows([...ds.rows]));
      return [
        [`— ${label} —`],
        ds.columns.map(c => c.label),
        ...rows.map(row => ds.columns.map(col => row[col.key] ?? '')),
        []
      ];
    });
    downloadCSV(csvRows, `${state.tab === 'chateau' ? 'Chateau_Gonflable' : 'Photobooth'}.csv`);
    return;
  }

  const dataset  = DATA[TAB_MAP[state.tab]];
  const search   = getSearchTerm();
  let   rows     = [...dataset.rows];

  if (search) {
    rows = rows.filter(row =>
      Object.values(row).some(v => v !== null && String(v).toLowerCase().includes(search))
    );
  }

  const headers = dataset.columns.map(c => c.label);
  const body    = rows.map(row => dataset.columns.map(col => row[col.key] ?? ''));
  downloadCSV([headers, ...body], `${dataset.title}.csv`);
}

function exportSummaryCSV() {
  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;
  const coutParLoc   = chateauCoutParLoc();
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);
  const investTotal  = [...state.chateauUnits, ...state.photoboothUnits].reduce(
    (s, u) => s + (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0), 0);
  const grand = investTotal + fraisInitTTC + customTotal;

  const rows = [
    ['Catégorie', 'Montant TTC (€)', 'Remarque'],
    ...state.chateauUnits.map(u => [
      `🏰 ${u.label}`,
      (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0),
      `Location ${fmtRaw(u.prixLocation)} € × ${u.locationsMois}/mois`
    ]),
    ...state.photoboothUnits.map(u => [
      `📷 ${u.label}`,
      (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0),
      `Location ${fmtRaw(u.prixLocation)} € × ${u.locationsMois}/mois`
    ]),
    ['Frais initiaux (SARL)', fraisInitTTC, 'Annonce légale + Greffe'],
    ['Coût / location château', coutParLoc, 'Essence + consommables'],
    ...state.customBlocks.map(b => [b.intitule || 'Bloc perso', parseFloat(b.montant) || 0, b.note || '']),
    [],
    ['TOTAL GLOBAL', grand, ''],
  ];
  downloadCSV(rows, 'Business_Plan.csv');
}

function downloadCSV(rows, filename) {
  const esc  = v => { const s = String(v ?? '').replace(/"/g, '""'); return (s.includes(';') || s.includes('"') || s.includes('\n')) ? `"${s}"` : s; };
  // BOM UTF-8 pour compatibilité Excel
  const body = '\uFEFF' + rows.map(r => (Array.isArray(r) ? r : []).map(esc).join(';')).join('\r\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


/* ════════════════════════════════════════════════════════════
   SAUVEGARDE / CHARGEMENT (localStorage)
════════════════════════════════════════════════════════════ */
const SAVE_KEY = 'bp_chateau_v1';
let _autoSaveTimer = null;

function initSave() {
  document.getElementById('save-btn').addEventListener('click', () => saveData(true));
  document.getElementById('export-file-btn').addEventListener('click', exportToFile);
  document.getElementById('import-file-input').addEventListener('change', importFromFile);
}

function saveData(showNotif = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(buildSnapshot()));
    if (showNotif) showToast('✓ Sauvegardé');
    const btn = document.getElementById('save-btn');
    if (btn) btn.classList.remove('unsaved');
  } catch(e) {
    showToast('⚠ Erreur de sauvegarde');
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    applySnapshot(JSON.parse(raw));
  } catch(e) {
    console.error('Erreur chargement sauvegarde', e);
  }
}

function buildSnapshot() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    chateauUnits:    state.chateauUnits,
    photoboothUnits: state.photoboothUnits,
    customBlocks:    state.customBlocks,
    data: Object.fromEntries(
      Object.keys(DATA).map(k => [k, { rows: DATA[k].rows }])
    )
  };
}

function applySnapshot(snap) {
  if (Array.isArray(snap.chateauUnits) && snap.chateauUnits.length)
    state.chateauUnits    = snap.chateauUnits;
  if (Array.isArray(snap.photoboothUnits))
    state.photoboothUnits = snap.photoboothUnits;
  if (Array.isArray(snap.customBlocks))
    state.customBlocks    = snap.customBlocks;
  if (snap.data) {
    Object.keys(snap.data).forEach(k => {
      if (DATA[k] && Array.isArray(snap.data[k]?.rows)) {
        const orig = DATA[k].rows;
        DATA[k].rows = snap.data[k].rows.map((savedRow, i) => {
          const o = orig[i] || {};
          return {
            ...savedRow,
            ...(o.image   ? { image:   o.image   } : {}),
            ...(o.prixHT  != null ? { prixHT:  o.prixHT  } : {}),
            ...(o.prixTTC != null ? { prixTTC: o.prixTTC } : {})
          };
        });
      }
    });
  }
  recomputeDataTotals();
}

function exportToFile() {
  const snap = buildSnapshot();
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bp-chateau-${date}.bpsave`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Fichier exporté');
}

function importFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const snap = JSON.parse(evt.target.result);
      applySnapshot(snap);
      saveData(false); // sync localStorage avec le fichier importé
      renderAll();
      showToast('✓ Configuration importée');
    } catch {
      showToast('⚠ Fichier invalide');
    }
    // Reset input pour permettre de réimporter le même fichier
    e.target.value = '';
  };
  reader.readAsText(file);
}

function renderAll() {
  renderChateauUnits();
  renderPhotoboothUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  renderTable();
}

function scheduleAutoSave() {
  const btn = document.getElementById('save-btn');
  if (btn) btn.classList.add('unsaved');
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => saveData(false), 1500);
}

function showToast(msg) {
  const el = document.getElementById('save-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2200);
}


/* ════════════════════════════════════════════════════════════
   UTILITAIRES
════════════════════════════════════════════════════════════ */

/** Formate un nombre en euros français */
function fmtPrice(val) {
  if (val === null || val === undefined) return '<span class="empty-val">—</span>';
  return new Intl.NumberFormat('fr-FR', {
    style:                 'currency',
    currency:              'EUR',
    minimumFractionDigits: 2
  }).format(val);
}

/** Échappe les caractères HTML dangereux */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
