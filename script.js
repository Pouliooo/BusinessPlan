/* ══════════════════════════════════════════════════════════════
   script.js — Business Plan MVP — Château Gonflable
   Vanilla JS, pas de dépendances.
   ══════════════════════════════════════════════════════════════ */

// ── Correspondance onglet → clé DATA ─────────────────────────
let TAB_MAP = {
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
  editMode:     false,       // true = édition inline active
  customBlocks: [],          // [{ id, intitule, montant, note }]
  customTabs:   [],          // [{ id, label }] — onglets créés par l'utilisateur
  customUnits:  {},          // { [tabId]: [{id, label, prixAchat, ...}] } — unités par tab custom
  // Unités château pour la simulation
  chateauUnits: [
    { id: 'main', label: 'Château principal', isMain: true, prixAchat: 2382.00, prixLivraison: 178.80, prixLocation: 300, locationsMois: 1 }
  ],
  // Unités photobooth pour la simulation
  photoboothUnits: [],
  // IDs des cartes château dont le détail est déplié
  expandedUnits: new Set(),
  // Photos de plan par type : { chateau: [], photobooth: [], [tabId]: [] }
  planPhotos: { chateau: [], photobooth: [] },
  // Groupes ouverts dans les tableaux : Set de "dsKey:tagValue" (fermés par défaut)
  expandedGroups: new Set()
};


/* ════════════════════════════════════════════════════════════
   INITIALISATION
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('app-loader').classList.remove('hidden');
  await loadFromAPI();   // charge depuis jsonbin (fallback localStorage)
  document.getElementById('app-loader').classList.add('hidden');

  initNavigation();
  initTabs();
  initEditMode();
  initModal();
  initCustomBlocks();
  initExport();
  initUnits();
  initSave();
  initHistoryPanel();

  // Rendu initial (avec l'onglet par défaut)
  renderTable();
  renderSummary();
  renderUnits();
  renderSimulator();

  // Navigation URL — après le rendu initial
  applyHash();
  if (!location.hash) updateHash();

  window.addEventListener('popstate', () => { applyHash(); renderTable(); renderSummary(); });
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

function switchPage(page, skipHash = false) {
  state.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(`page-${page}`).classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
    b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false');
  });

  if (!skipHash) updateHash();
}


/* ════════════════════════════════════════════════════════════
   ONGLETS
════════════════════════════════════════════════════════════ */
function initTabs() {
  bindStaticTabs();
  initTabNewForm();
}

function bindStaticTabs() {
  document.querySelectorAll('.tab-btn[data-tab]:not(.tab-btn-custom)').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabKey, skipHash = false) {
  state.tab  = tabKey;
  state.sort = { col: null, dir: 'asc' };
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
    const active = b.dataset.tab === tabKey;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (!skipHash) updateHash();
  renderTable();
}

function updateHash() {
  const hash = state.page === 'resume'
    ? '#resume'
    : `#detail/${state.tab}`;
  history.replaceState(null, '', hash);
}

function applyHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const parts = hash.split('/');
  if (parts[0] === 'resume') {
    switchPage('resume', true);
  } else if (parts[0] === 'detail') {
    switchPage('detail', true);
    const tabKey = parts[1];
    if (tabKey && (TAB_MAP[tabKey] !== undefined || document.querySelector(`.tab-btn[data-tab="${tabKey}"]`))) {
      switchTab(tabKey, true);
    }
  }
}

function initTabNewForm() {
  const addBtn  = document.getElementById('tab-add-btn');
  const form    = document.getElementById('tab-new-form');
  const input   = document.getElementById('tab-new-input');
  const confirmBtn = document.getElementById('tab-new-confirm');
  const cancel  = document.getElementById('tab-new-cancel');
  if (!addBtn) return;

  let selectedType = 'item';

  form.querySelectorAll('.tab-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      form.querySelectorAll('.tab-type-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  addBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) { input.value = ''; input.focus(); }
  });
  cancel.addEventListener('click', () => form.classList.add('hidden'));
  confirmBtn.addEventListener('click', () => {
    const label = input.value.trim();
    if (!label) { input.focus(); return; }
    createCustomTab(label, selectedType);
    form.classList.add('hidden');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmBtn.click();
    if (e.key === 'Escape') cancel.click();
  });
}

/* ── Helpers pour créer les datasets de sections ────────────── */
function makeInvestDataset(label, rows = []) {
  return {
    title: label, subtitle: 'Investissement — Initial — Matériel', accentClass: 'accent-cyan',
    columns: [
      { key: 'intitule',    label: 'Intitulé',   type: 'text'   },
      { key: 'qte',         label: 'Qté',         type: 'number' },
      { key: 'prixHT',      label: 'Prix HT',     type: 'price'  },
      { key: 'prixTTC',     label: 'Prix TTC',    type: 'price'  },
      { key: 'partage',     label: '1/n UN',      type: 'number' },
      { key: 'commentaire', label: 'Commentaire', type: 'text'   },
      { key: 'lien',        label: 'Lien',        type: 'link'   },
      { key: 'coutParUnit', label: '/UN',          type: 'price',
        compute: row => (row.prixHT || 0) / Math.max(1, parseInt(row.partage) || 1) }
    ],
    rows, totalPrixTTC: 0
  };
}
function makeServiceDataset(label, rows = []) {
  return {
    title: label, subtitle: 'Frais de service — Par journée de location', accentClass: 'accent-cyan',
    columns: [
      { key: 'intitule',    label: 'Intitulé',    type: 'text'   },
      { key: 'commentaire', label: 'Commentaire', type: 'text'   },
      { key: 'usure',       label: 'Usure / loc', type: 'number' },
      { key: 'prixHT',      label: 'Prix HT',     type: 'price'  },
      { key: 'prixTTC',     label: 'Prix TTC',    type: 'price'  },
      { key: 'coutParLoc',  label: 'Coût / loc',  type: 'price',
        compute: row => (row.prixHT || 0) * (parseFloat(row.usure) || 0), isTotal: true }
    ],
    rows, totalPrixTTC: 0
  };
}
function makeMaintenanceDataset(label, rows = []) {
  return {
    title: label, subtitle: 'Frais de maintenance — Par an', accentClass: 'accent-cyan',
    columns: [
      { key: 'intitule', label: 'Intitulé', type: 'text' },
      { key: 'remarque', label: 'Remarque', type: 'text' },
      { key: 'prixTTC',  label: 'HT/AN',    type: 'price', isTotal: true }
    ],
    rows, totalPrixTTC: 0
  };
}
function makeFreisDataset(label, rows = []) {
  return {
    title: label, subtitle: 'Frais', accentClass: 'accent-orange',
    columns: [
      { key: 'intitule', label: 'Intitulé', type: 'text' },
      { key: 'remarque', label: 'Remarque', type: 'text' },
      { key: 'prixTTC',  label: 'HT/AN',    type: 'price', isTotal: true }
    ],
    rows, totalPrixTTC: 0
  };
}

function createCustomTab(label, type = 'item') {
  const id = 'custom_' + Date.now();
  TAB_MAP[id] = id;

  if (type === 'item') {
    const investKey      = id + '_invest';
    const serviceKey     = id + '_service';
    const maintenanceKey = id + '_maintenance';
    DATA[investKey]      = makeInvestDataset(label);
    DATA[serviceKey]     = makeServiceDataset(label);
    DATA[maintenanceKey] = makeMaintenanceDataset(label);
    state.customTabs.push({
      id, label, type: 'item',
      sections: [
        { dsKey: investKey,      label: `⚙️ ${label} — Investissement — Initial — Matériel`,        sortable: true  },
        { dsKey: serviceKey,     label: `🔧 ${label} — Frais de service — Par journée de location`, sortable: false },
        { dsKey: maintenanceKey, label: `🛠️ ${label} — Frais de maintenance — Par an`,              sortable: false }
      ]
    });
  } else {
    DATA[id] = makeFreisDataset(label);
    state.customTabs.push({ id, label, type: 'frais' });
  }

  renderCustomTabButtons();
  updateUnitTypeSelect();
  switchTab(id);
  scheduleAutoSave();
}

function renderCustomTabButtons() {
  const header  = document.getElementById('tabs-header');
  const addBtn  = document.getElementById('tab-add-btn');
  // Supprimer les anciens boutons custom
  header.querySelectorAll('.tab-btn-custom').forEach(b => b.remove());
  // Réinsérer avant le bouton "+"
  state.customTabs.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className     = 'tab-btn tab-btn-custom';
    btn.dataset.tab   = id;
    btn.role          = 'tab';
    btn.ariaSelected  = 'false';
    btn.innerHTML     = `${escHtml(label)} <span class="tab-btn-del" data-tab-del="${id}" title="Supprimer">×</span>`;
    btn.addEventListener('click', e => {
      if (e.target.dataset.tabDel) { e.stopImmediatePropagation(); deleteCustomTab(id); return; }
      switchTab(id);
    });
    header.insertBefore(btn, addBtn);
  });
}

function deleteCustomTab(id) {
  if (!confirm('Supprimer cet onglet et toutes ses données ?')) return;
  state.customTabs = state.customTabs.filter(t => t.id !== id);
  delete DATA[id];
  delete DATA[id + '_invest'];
  delete DATA[id + '_service'];
  delete DATA[id + '_maintenance'];
  delete state.customUnits[id];
  delete TAB_MAP[id];
  renderCustomTabButtons();
  updateUnitTypeSelect();
  if (state.tab === id) switchTab('chateau');
  scheduleAutoSave();
}


/* ════════════════════════════════════════════════════════════
   MODE ÉDITION / LECTURE SEULE
════════════════════════════════════════════════════════════ */
function initEditMode() {
  const btn = document.getElementById('edit-mode-btn');
  if (!btn) return;
  updateEditModeBtn(btn);
  btn.addEventListener('click', () => {
    state.editMode = !state.editMode;
    updateEditModeBtn(btn);
    renderTable();
  });
}

function updateEditModeBtn(btn) {
  if (state.editMode) {
    btn.textContent = '🔒 Verrouiller';
    btn.classList.add('edit-mode-active');
    btn.title = 'Passer en lecture seule';
  } else {
    btn.textContent = '✏️ Modifier';
    btn.classList.remove('edit-mode-active');
    btn.title = 'Activer l\'édition des tableaux';
    // Fermer le formulaire si ouvert
    document.getElementById('tab-new-form')?.classList.add('hidden');
  }
  // Afficher / masquer les contrôles d'onglets selon le mode
  const tabAddBtn = document.getElementById('tab-add-btn');
  if (tabAddBtn) tabAddBtn.style.display = state.editMode ? 'inline-flex' : 'none';
  document.querySelectorAll('.tab-btn-del').forEach(el => {
    el.style.display = state.editMode ? 'inline' : 'none';
  });
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

/** Total annuel des frais de maintenance + frais récurrents (charges fixes) — tous types */
function getTotalChargesFixesAnnuelles() {
  // Château : maintenance + récurrents
  const maintenanceCH = DATA.fraisMaintenance.rows.reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  const recurrents    = resolveComputedRows(DATA.fraisRecurrentsAnnuels.rows)
    .reduce((s, r) => s + (parseFloat(r.prixTTC) || 0), 0);
  // Photobooth : maintenance
  const maintenancePB = DATA.fraisMaintenancePhotobooth.rows.reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  // Custom item tabs : maintenance
  const maintenanceCustom = state.customTabs.filter(t => t.type === 'item').reduce((s, tab) => {
    const ds = DATA[tab.id + '_maintenance'];
    return s + (ds ? ds.rows.reduce((ss,r) => ss + (parseFloat(r.prixTTC)||0), 0) : 0);
  }, 0);
  return maintenanceCH + recurrents + maintenancePB + maintenanceCustom;
}

/** Retourne la clé DATA correspondant à un objet dataset */
function getDatasetKey(ds) {
  return Object.keys(DATA).find(k => DATA[k] === ds) || null;
}

/** Recalcule les totaux statiques après édition ou ajout de ligne */
function recomputeDataTotals() {
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
  // Onglets personnalisés de type "item" → multi-section
  const customTab = state.customTabs.find(t => t.id === state.tab);
  if (customTab?.type === 'item') {
    renderMultiSectionTab(customTab.sections.map(s => ({
      ds: DATA[s.dsKey], label: s.label, sortable: !!s.sortable
    })));
    return;
  }

  const dataset = DATA[TAB_MAP[state.tab]];
  let   rows    = resolveComputedRows([...dataset.rows]);

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

  const wrapper  = document.getElementById('table-wrapper');
  const dsKey    = TAB_MAP[state.tab];
  const label    = `${dataset.title} — ${dataset.subtitle}`;

  if (rows.length === 0 && dataset.rows.length === 0) {
    wrapper.innerHTML = `<div class="tab-section">
      <div class="tab-section-header">${label}</div>
      <div class="tab-empty-state">
        📋 Aucune donnée
        <button class="btn-primary btn-sm btn-add-first-row" data-dataset-key="${escHtml(dsKey)}">+ Ajouter une ligne</button>
      </div>
    </div>`;
    wrapper.querySelector('.btn-add-first-row')?.addEventListener('click', () => addFirstRow(dsKey));
    return;
  }

  wrapper.innerHTML = `<div class="tab-section">
    <div class="tab-section-header">${label}</div>
    ${buildTableHTML(dataset, rows, dsKey)}
  </div>`;

  // Tri au clic sur en-tête
  wrapper.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      state.sort = { col: th.dataset.col,
        dir: state.sort.col === th.dataset.col && state.sort.dir === 'asc' ? 'desc' : 'asc' };
      renderTable();
    });
  });

  // Édition inline
  const tbl = wrapper.querySelector('table');
  if (tbl) attachInlineTableListeners(tbl, dsKey);
}

/**
 * Rendu générique pour les onglets multi-sections (château, photobooth…)
 * @param {Array<{ds: Object, label: string, sortable: boolean}>} sections
 */
function renderMultiSectionTab(sections) {
  const wrapper = document.getElementById('table-wrapper');

  // ── Résoudre chaque section ───────────────────────────────
  const resolved = sections.map(({ ds, label, sortable }) => {
    let rows = resolveComputedRows([...ds.rows]);
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
      ? `<div class="tab-empty-state">📋 Aucune donnée
           <button class="btn-primary btn-sm btn-add-first-row" data-dataset-key="${escHtml(key)}">+ Ajouter une ligne</button>
         </div>`
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

    // Édition inline par section
    const tbl = sec.querySelector('table');
    if (tbl) attachInlineTableListeners(tbl, key);

    // Bouton ajouter première ligne (état vide)
    sec.querySelectorAll('.btn-add-first-row').forEach(btn => {
      btn.addEventListener('click', () => addFirstRow(btn.dataset.datasetKey));
    });
  });

  // ── Section Plan (photos) en bas du tab ──────────────────
  const itemTypes = ['chateau', 'photobooth', ...state.customTabs.filter(t => t.type === 'item').map(t => t.id)];
  if (!itemTypes.includes(state.tab)) return;

  const tabType = state.tab;
  const planSection = document.createElement('div');
  planSection.className = 'plan-tab-section';
  planSection.innerHTML = renderPlanSectionHTML(tabType);
  wrapper.appendChild(planSection);

  // Input fichier caché — branché directement
  const fileInput = planSection.querySelector('.plan-file-input');
  planSection.querySelector('.btn-plan-add-file')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let done = 0;
    files.forEach(file => {
      compressImage(file, 1200, 0.75).then(src => {
        if (!state.planPhotos[tabType]) state.planPhotos[tabType] = [];
        state.planPhotos[tabType].push({ src, name: file.name });
        if (++done === files.length) { renderTable(); markResumeDirty(); scheduleAutoSave(); }
      });
    });
    e.target.value = '';
  });

  planSection.querySelector('.btn-plan-add-url')?.addEventListener('click', () => {
    const url = prompt('URL de l\'image :');
    if (!url?.trim()) return;
    if (!state.planPhotos[tabType]) state.planPhotos[tabType] = [];
    state.planPhotos[tabType].push({ src: url.trim(), name: url.trim().split('/').pop() });
    renderTable(); markResumeDirty(); scheduleAutoSave();
  });

  planSection.querySelectorAll('.plan-tab-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.planPhotos[tabType]) return;
      state.planPhotos[tabType].splice(parseInt(btn.dataset.idx), 1);
      renderTable(); markResumeDirty();
    });
  });

  planSection.querySelectorAll('.plan-tab-img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

/** Redimensionne et compresse une image avant stockage base64 */
function compressImage(file, maxPx, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Lightbox in-page pour visualiser une image sans window.open */
function openLightbox(src) {
  let lb = document.getElementById('plan-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'plan-lightbox';
    lb.innerHTML = `<div class="lb-backdrop"></div><img class="lb-img" /><button class="lb-close">✕</button>`;
    document.body.appendChild(lb);
    lb.querySelector('.lb-backdrop').addEventListener('click', () => lb.classList.add('hidden'));
    lb.querySelector('.lb-close').addEventListener('click',    () => lb.classList.add('hidden'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb?.classList.add('hidden'); });
  }
  lb.querySelector('.lb-img').src = src;
  lb.classList.remove('hidden');
}

function renderPlanSectionHTML(type) {
  const isStatic = type === 'photobooth';
  const photos   = isStatic ? PHOTOBOOTH_STATIC_PHOTOS : (state.planPhotos[type] || []);

  const actions = isStatic ? '' : `
    <div class="plan-tab-actions">
      <input type="file" class="plan-file-input" accept="image/*" multiple style="display:none">
      <button class="btn-secondary btn-sm btn-plan-add-file">📁 Ajouter fichier</button>
      <button class="btn-secondary btn-sm btn-plan-add-url">🔗 URL</button>
    </div>`;

  const cards = photos.map((p, i) => `
    <div class="plan-photo-card">
      <img src="${escHtml(p.src)}" alt="${escHtml(p.name||'')}" class="plan-tab-img" />
      <div class="plan-photo-bar">
        <span class="plan-photo-name">${escHtml(p.name||`Photo ${i+1}`)}</span>
        ${isStatic ? '' : `<button class="btn-danger plan-tab-del" data-idx="${i}">✕</button>`}
      </div>
    </div>`).join('');

  return `
    <div class="plan-tab-header">
      <span class="plan-tab-title">📋 Plan & Photos</span>
      ${actions}
    </div>
    <div class="plan-tab-gallery">
      ${photos.length === 0 ? '<p class="plan-empty">Aucune photo. Ajoutez un fichier ou une URL.</p>' : ''}
      ${cards}
    </div>
  `;
}

function addFirstRow(dsKey) {
  const ds = DATA[dsKey];
  if (!ds) return;
  const newRow = {};
  ds.columns.forEach(col => { if (!col.compute) newRow[col.key] = null; });
  ds.rows.push(newRow);
  state.editMode = true;
  updateEditModeBtn(document.getElementById('edit-mode-btn'));
  recomputeDataTotals();
  renderTable();
  renderSummary();
  renderSimulator();
  scheduleAutoSave();
}



/** Formate un nombre décimal brut pour value="" d'un input */
function fmtRaw(val) {
  if (val === null || val === undefined || val === '') return '';
  return parseFloat(val).toFixed(2);
}

function buildTableHTML(dataset, rows, datasetKey) {
  const { columns } = dataset;
  const hasHT  = columns.some(c => c.key === 'prixHT');
  const keyAttr = datasetKey ? ` data-dataset-key="${escHtml(datasetKey)}"` : '';

  /* ── En-têtes ─────────────────────────── */
  let html = `<table${keyAttr}><thead><tr>`;
  columns.forEach(col => {
    const active = state.sort.col === col.key;
    const icon   = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [active ? `sort-${state.sort.dir}` : '', (col.compute || col.isTotal) ? 'col-total' : '', col.thClass || ''].filter(Boolean).join(' ');
    // Datasets sans prixHT : prixTTC est édité en HT → relibellé
    let label = col.label;
    if (col.key === 'prixTTC' && !hasHT) label = label.replace('TTC', 'HT');
    const widthAttr = col.thWidth ? ` style="width:${col.thWidth}"` : '';
    html += `<th data-col="${escHtml(col.key)}" class="${cls}"${widthAttr}>
               ${escHtml(label)} <span class="sort-icon">${icon}</span>
             </th>`;
  });
  if (state.editMode) html += `<th class="col-actions"></th>`;
  html += '</tr></thead>';

  /* ── Corps ────────────────────────────── */
  const colSpan   = columns.length + (state.editMode ? 1 : 0);
  const hasTagCol = columns.some(c => c.key === 'tag');
  html += '<tbody>';

  const buildRowHTML = row => {
    const origIdx    = dataset.rows.indexOf(row);
    const isComputed = !!row.computed;
    let r = `<tr data-row-idx="${origIdx}"${isComputed ? ' class="row-computed"' : ''}>`;
    columns.forEach(col => { r += buildInlineCell(col, row, dataset, origIdx, hasHT); });
    if (state.editMode) {
      r += isComputed
        ? `<td class="col-actions"></td>`
        : `<td class="col-actions"><button class="btn-row-delete" data-row-idx="${origIdx}" title="Supprimer">✕</button></td>`;
    }
    r += '</tr>';
    return r;
  };

  if (rows.length === 0) {
    html += `<tr><td colspan="${colSpan}" style="text-align:center;padding:36px;color:#94a3b8;">
               Aucun résultat pour cette recherche.
             </td></tr>`;
  } else if (hasTagCol && datasetKey) {
    // Groupement par tag
    const groups   = new Map(); // tag → rows[]
    const noTag    = [];
    rows.forEach(row => {
      const tag = (row.tag || '').toString().trim();
      if (tag) {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag).push(row);
      } else {
        noTag.push(row);
      }
    });

    // Groupes d'abord
    const totalCol = columns.find(c => c.isTotal) || columns.find(c => c.type === 'price' && c.key !== 'tag');
    groups.forEach((groupRows, tag) => {
      const gKey      = `${datasetKey}:${tag}`;
      const collapsed = !state.expandedGroups.has(gKey);
      const groupSum  = totalCol
        ? groupRows.reduce((s, r) => {
            const v = totalCol.compute ? totalCol.compute(r) : (parseFloat(r[totalCol.key]) || 0);
            const htToTtc = totalCol.key === 'prixTTC' && !hasHT;
            return s + (htToTtc ? (v / 1.2) : v);
          }, 0)
        : null;

      // Noms des produits pour le résumé
      const nameKey  = columns.find(c => c.key === 'produit' || c.key === 'intitule')?.key || columns.find(c => c.type === 'text' && c.key !== 'tag' && c.key !== 'commentaire' && c.key !== 'lien')?.key;
      const names    = nameKey ? groupRows.map(r => r[nameKey]).filter(Boolean).join(', ') : '';
      const nameSpan = names ? `<span class="group-names">${escHtml(names)}</span>` : '';

      // Ligne résumé du groupe (toujours affichée)
      html += `<tr class="group-header-row ${collapsed ? 'group-collapsed' : `group-expanded ${badgeCls(tag)}`}"
                   data-group-key="${escHtml(gKey)}" data-group-tag="${escHtml(tag)}">
        <td><span class="badge ${badgeCls(tag)}">${escHtml(tag)}</span> <span class="group-toggle-icon">${collapsed ? '▶' : '▼'}</span></td>
        <td colspan="${colSpan - 2}" class="group-summary-label">
          ${nameSpan}
        </td>
        <td class="price-cell group-summary-total">${groupSum != null ? `<strong>${fmtPrice(groupSum)}</strong>` : ''}</td>
        ${state.editMode ? '<td class="col-actions"></td>' : ''}
      </tr>`;

      // Lignes individuelles (masquées si replié)
      if (!collapsed) {
        groupRows.forEach(row => {
          // Masquer la cellule tag dans les lignes enfant (déjà visible dans le header)
          const origIdx    = dataset.rows.indexOf(row);
          const isComputed = !!row.computed;
          let r = `<tr class="group-child-row ${badgeCls(tag)}" data-row-idx="${origIdx}">`;

          columns.forEach(col => {
            r += col.key === 'tag'
              ? `<td class="text-cell cell-readonly group-child-tag"></td>`
              : buildInlineCell(col, row, dataset, origIdx, hasHT);
          });
          if (state.editMode) {
            r += isComputed
              ? `<td class="col-actions"></td>`
              : `<td class="col-actions"><button class="btn-row-delete" data-row-idx="${origIdx}" title="Supprimer">✕</button></td>`;
          }
          r += '</tr>';
          html += r;
        });
      }
    });
    // Lignes sans tag après les groupes
    noTag.forEach(row => { html += buildRowHTML(row); });
  } else {
    rows.forEach(row => { html += buildRowHTML(row); });
  }

  if (state.editMode && datasetKey) {
    html += `<tr class="row-add"><td colspan="${colSpan}">
               <button class="btn-add-row" data-dataset-key="${escHtml(datasetKey)}">+ Ajouter une ligne</button>
             </td></tr>`;
  }
  html += '</tbody>';

  /* ── Pied (totaux) ────────────────────── */
  html += buildFooterHTML(dataset, rows);
  html += '</table>';
  return html;
}

function buildInlineCell(col, row, dataset, origIdx, hasHT) {
  const cellCls = [
    col.type === 'price'  ? 'price-cell' :
    col.type === 'number' ? 'num-cell'   :
    col.type === 'text'   ? 'text-cell'  : '',
    (col.compute || col.isTotal) ? 'col-total' : ''
  ].filter(Boolean).join(' ');

  // Readonly : mode lecture seule global, colonne calculée, prixTTC quand prixHT existe, ou ligne computed
  const isColReadonly = !state.editMode || !!row.computed || !!col.compute || (col.key === 'prixTTC' && hasHT);

  if (isColReadonly) {
    let val = col.compute ? col.compute(row) : row[col.key];
    // prixTTC dans dataset sans prixHT → afficher en HT
    if (col.key === 'prixTTC' && !hasHT && val != null) val = val / 1.2;
    const computeAttr = col.compute ? ` data-computed-col="${escHtml(col.key)}"` : '';
    return `<td class="${cellCls} cell-readonly"${computeAttr}>${renderCellShort(val, col.type)}</td>`;
  }

  const val       = row[col.key];
  // prixTTC sans prixHT : éditer en HT (÷1.2 affichage, ×1.2 stockage)
  const htToTtc   = col.key === 'prixTTC' && !hasHT;
  const updatesTtc = col.key === 'prixHT';
  const displayVal = htToTtc && val != null ? val / 1.2 : val;

  const multilineKeys = new Set(['avertissement', 'commentaire', 'remarque', 'note']);
  let input;

  if (col.type === 'price' || col.type === 'number') {
    const numStr = displayVal != null ? parseFloat(displayVal).toFixed(2) : '';
    input = `<input type="number" class="cell-input"
                    data-row-idx="${origIdx}" data-col="${escHtml(col.key)}" data-coltype="${col.type}"
                    ${htToTtc    ? 'data-ht-to-ttc="1"'   : ''}
                    ${updatesTtc ? 'data-updates-ttc="1"' : ''}
                    value="${numStr}"
                    step="${col.type === 'price' ? '0.01' : '1'}" min="0">`;
  } else if (col.type === 'link') {
    input = `<input type="url" class="cell-input cell-input-link"
                    data-row-idx="${origIdx}" data-col="${escHtml(col.key)}" data-coltype="${col.type}"
                    value="${escHtml(String(val ?? ''))}">`;
  } else if (multilineKeys.has(col.key)) {
    input = `<textarea class="cell-input cell-textarea"
                       data-row-idx="${origIdx}" data-col="${escHtml(col.key)}" data-coltype="${col.type}"
                       rows="2">${escHtml(String(val ?? ''))}</textarea>`;
  } else {
    input = `<input type="text" class="cell-input"
                    data-row-idx="${origIdx}" data-col="${escHtml(col.key)}" data-coltype="${col.type}"
                    value="${escHtml(String(val ?? ''))}">`;
  }

  return `<td class="${cellCls} cell-editable">${input}</td>`;
}

function buildFooterHTML(dataset, rows) {
  const { columns } = dataset;
  const hasHT = columns.some(c => c.key === 'prixHT');
  const hasPriceCols = columns.some(c => c.type === 'price');
  if (!hasPriceCols) return '';

  let html = '<tfoot><tr>';
  columns.forEach((col, i) => {
    if (i === 0) { html += '<td><strong>Total</strong></td>'; return; }
    if (col.type !== 'price' || col.noTotal) { html += '<td></td>'; return; }

    const htToTtc = col.key === 'prixTTC' && !hasHT;
    // Colonnes calculées (col.compute) → toujours dynamique
    const preKey  = !col.compute && ('total' + col.key.charAt(0).toUpperCase() + col.key.slice(1));

    let sum;
    if (preKey && dataset[preKey] !== undefined) {
      sum = htToTtc ? dataset[preKey] / 1.2 : dataset[preKey];
    } else {
      sum = rows.reduce((acc, r) => {
        const v       = col.compute ? col.compute(r) : r[col.key];
        const display = htToTtc && v != null ? v / 1.2 : v;
        return acc + (parseFloat(display) || 0);
      }, 0);
    }
    const totalCls = (col.compute || col.isTotal) ? ' col-total' : '';
    html += `<td class="price-cell${totalCls}"><strong>${fmtPrice(sum)}</strong></td>`;
  });
  if (state.editMode) html += '<td></td>'; // colonne actions
  html += '</tr></tfoot>';
  return html;
}

/**
 * Attache les listeners d'édition inline sur une table.
 * @param {HTMLTableElement} tableEl
 * @param {string}           datasetKey — clé dans DATA
 */
function attachInlineTableListeners(tableEl, datasetKey) {
  const dataset = DATA[datasetKey];
  if (!dataset) return;
  const hasHT = dataset.columns.some(c => c.key === 'prixHT');

  // ── Toggle groupe tag ─────────────────────────────────────
  tableEl.querySelectorAll('.group-header-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const gKey = tr.dataset.groupKey;
      if (!gKey) return;
      state.expandedGroups.has(gKey)
        ? state.expandedGroups.delete(gKey)
        : state.expandedGroups.add(gKey);
      renderTable();
    });
  });

  // ── Édition de cellule ────────────────────────────────────
  tableEl.querySelectorAll('.cell-input').forEach(input => {
    input.addEventListener('change', () => {
      const rowIdx = parseInt(input.dataset.rowIdx, 10);
      const row    = dataset.rows[rowIdx];
      if (!row || row.computed) return;

      const key     = input.dataset.col;
      const coltype = input.dataset.coltype;
      const raw     = input.value;

      if (coltype === 'price' || coltype === 'number') {
        const num = raw === '' ? null : parseFloat(raw);
        if (input.dataset.htToTtc) {
          // Utilisateur saisit HT → stocker TTC
          row[key] = num != null ? Math.round(num * 1.2 * 100) / 100 : null;
        } else {
          row[key] = num;
          if (input.dataset.updatesTtc) {
            // prixHT modifié → recalculer prixTTC dans la ligne
            row.prixTTC = num != null ? Math.round(num * 1.2 * 100) / 100 : null;
            const tr = input.closest('tr');
            if (tr) {
              // cibler uniquement la cellule prixTTC (pas les colonnes calculées)
              const ttcCell = tr.querySelector('td.cell-readonly.price-cell:not([data-computed-col])');
              if (ttcCell) ttcCell.innerHTML = renderCellShort(row.prixTTC, 'price');
            }
          }
        }
      } else {
        row[key] = raw === '' ? null : raw;
      }

      recomputeDataTotals();
      // Rafraîchir les cellules calculées de la ligne (préserve le focus sur les autres)
      const tr = tableEl.querySelector(`tr[data-row-idx="${rowIdx}"]`);
      if (tr) {
        dataset.columns.forEach(c => {
          if (!c.compute) return;
          const td = tr.querySelector(`[data-computed-col="${c.key}"]`);
          if (!td) return;
          let v = c.compute(row);
          if (c.key === 'prixTTC' && !hasHT && v != null) v = v / 1.2;
          td.innerHTML = renderCellShort(v, c.type);
        });
      }
      // Met à jour uniquement le pied (préserve le focus)
      const tfoot = tableEl.querySelector('tfoot');
      if (tfoot) {
        const tmp = document.createElement('table');
        tmp.innerHTML = buildFooterHTML(dataset, dataset.rows);
        const newFoot = tmp.querySelector('tfoot');
        if (newFoot) tfoot.replaceWith(newFoot);
      }
      renderSummary();
      renderSimulator();
      scheduleAutoSave();
    });
  });

  // ── Clic sur ligne → ouvrir modal détail ────────────────
  tableEl.querySelectorAll('tbody tr[data-row-idx]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (state.editMode) return;
      if (e.target.closest('a, button, input, textarea, select')) return;
      const rowIdx = parseInt(tr.dataset.rowIdx, 10);
      const row = dataset.rows[rowIdx];
      if (!row) return;
      openModal(dataset, row, datasetKey, rowIdx);
    });
  });

  // ── Suppression de ligne ──────────────────────────────────
  tableEl.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIdx = parseInt(btn.dataset.rowIdx, 10);
      dataset.rows.splice(rowIdx, 1);
      recomputeDataTotals();
      renderTable();
      renderSummary();
      renderSimulator();
      scheduleAutoSave();
    });
  });

  // ── Ajout de ligne ────────────────────────────────────────
  tableEl.querySelectorAll('.btn-add-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.datasetKey;
      const ds  = DATA[key];
      if (!ds) return;
      const newRow = {};
      ds.columns.forEach(col => { newRow[col.key] = null; });
      ds.rows.push(newRow);
      recomputeDataTotals();
      renderTable();
      renderSummary();
      renderSimulator();
      scheduleAutoSave();
    });
  });
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
  const toHT = v => (parseFloat(v) || 0) / 1.2;
  const unitInvest = u => (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0);

  // ── Investissement — tous types ──────────────────────────────
  const investChateaux    = state.chateauUnits.reduce((s, u) => s + unitInvest(u), 0);
  const investPhotobooths = state.photoboothUnits.reduce((s, u) => s + unitInvest(u), 0);
  const investCustom      = state.customTabs.filter(t => t.type === 'item').reduce((s, tab) =>
    s + (state.customUnits[tab.id] || []).reduce((ss, u) => ss + unitInvest(u), 0), 0);
  const investTotal = investChateaux + investPhotobooths + investCustom;
  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;

  // Labels équipements
  const equipParts = [];
  if (state.chateauUnits.length)    equipParts.push(`${state.chateauUnits.length} château${state.chateauUnits.length>1?'x':''}`);
  if (state.photoboothUnits.length) equipParts.push(`${state.photoboothUnits.length} photobooth${state.photoboothUnits.length>1?'s':''}`);
  state.customTabs.filter(t => t.type === 'item').forEach(tab => {
    const n = (state.customUnits[tab.id] || []).length;
    if (n) equipParts.push(`${n} ${tab.label}`);
  });
  const equipLabel = equipParts.join(', ') || 'aucun équipement';

  // ── Tooltip frais initiaux ───────────────────────────────────
  const tooltipFraisInit = buildTooltip(
    DATA.fraisInitiaux.rows.map(r => ({ label: r.intitule, price: toHT(r.prixTTC) }))
  );

  // ── Tooltip investissement équipements ───────────────────────
  const tooltipEquip = buildTooltip([
    ...state.chateauUnits.flatMap(u => [
      { label: `🏰 ${u.label}`,  price: toHT(parseFloat(u.prixAchat)     || 0) },
      { label: `🚚 Livraison`,   price: toHT(parseFloat(u.prixLivraison) || 0) }
    ]),
    ...state.photoboothUnits.flatMap(u => [
      { label: `📷 ${u.label}`,  price: toHT(parseFloat(u.prixAchat)     || 0) },
      { label: `🚚 Livraison`,   price: toHT(parseFloat(u.prixLivraison) || 0) }
    ]),
    ...state.customTabs.filter(t => t.type === 'item').flatMap(tab =>
      (state.customUnits[tab.id] || []).flatMap(u => [
        { label: `📦 ${u.label}`,  price: toHT(parseFloat(u.prixAchat)     || 0) },
        { label: `🚚 Livraison`,   price: toHT(parseFloat(u.prixLivraison) || 0) }
      ])
    )
  ]);

  // ── Tooltip charges fixes / an — tous types ──────────────────
  const tooltipCharges = buildTooltip([
    ...DATA.fraisMaintenance.rows.map(r => ({ label: `🏰 ${r.intitule}`, price: toHT(r.prixTTC) })),
    ...resolveComputedRows(DATA.fraisRecurrentsAnnuels.rows).map(r => ({ label: r.intitule, price: toHT(r.prixTTC) })),
    ...DATA.fraisMaintenancePhotobooth.rows.map(r => ({ label: `📷 ${r.intitule}`, price: toHT(r.prixTTC) })),
    ...state.customTabs.filter(t => t.type === 'item').flatMap(tab => {
      const ds = DATA[tab.id + '_maintenance'];
      return ds ? ds.rows.map(r => ({ label: `📦 ${tab.label} — ${r.intitule}`, price: toHT(r.prixTTC) })) : [];
    })
  ]);

  // ── Charges de location — agrégées tous types ────────────────
  const serviceTypes = [];

  if (state.chateauUnits.length) {
    const coutLoc   = chateauCoutParLoc();
    const totalVar  = state.chateauUnits.reduce((s, u) => s + coutLoc * (parseFloat(u.locationsMois)||0) * 12, 0);
    const totalLocs = state.chateauUnits.reduce((s, u) => s + (parseFloat(u.locationsMois)||0) * 12, 0);
    const details   = DATA.fraisRecurrent.rows.map(r => ({ label: r.intitule, price: (r.prixHT||0)*(parseFloat(r.usure)||0) }));
    serviceTypes.push({ icon: '🏰', label: `${state.chateauUnits.length} château${state.chateauUnits.length>1?'x':''}`, totalVar, totalLocs, details });
  }

  if (state.photoboothUnits.length) {
    const coutLoc   = photoboothCoutParLoc();
    const totalVar  = state.photoboothUnits.reduce((s, u) => s + coutLoc * (parseFloat(u.locationsMois)||0) * 12, 0);
    const totalLocs = state.photoboothUnits.reduce((s, u) => s + (parseFloat(u.locationsMois)||0) * 12, 0);
    const details   = DATA.fraisServicePhotobooth.rows.map(r => ({ label: r.intitule, price: (r.prixHT||0)*(parseFloat(r.usure)||0) }));
    serviceTypes.push({ icon: '📷', label: `${state.photoboothUnits.length} photobooth${state.photoboothUnits.length>1?'s':''}`, totalVar, totalLocs, details });
  }

  state.customTabs.filter(t => t.type === 'item').forEach(tab => {
    const units = state.customUnits[tab.id] || [];
    if (!units.length) return;
    const coutLoc   = customCoutParLoc(tab.id);
    const totalVar  = units.reduce((s, u) => s + coutLoc * (parseFloat(u.locationsMois)||0) * 12, 0);
    const totalLocs = units.reduce((s, u) => s + (parseFloat(u.locationsMois)||0) * 12, 0);
    const ds      = DATA[tab.id + '_service'];
    const details = ds ? ds.rows.map(r => ({ label: r.intitule, price: (r.prixHT||0)*(parseFloat(r.usure)||0) })) : [];
    serviceTypes.push({ icon: '📦', label: `${units.length} ${tab.label}`, totalVar, totalLocs, details });
  });

  const totalChargesLocAll = serviceTypes.reduce((s, t) => s + t.totalVar, 0);
  const tooltipLocAll = buildTooltip(
    serviceTypes.map(t => ({ label: `${t.icon} ${t.label} · ${t.totalLocs} loc/an`, price: t.totalVar }))
  );
  const locSubLabel = serviceTypes.map(t => `${t.icon} ${t.label}`).join(', ') || '—';

  const chargesLocCard = serviceTypes.length
    ? `<div class="summary-card accent-green">
        <div class="sc-top">
          <div class="sc-label">Charges de location / an</div>
          ${tooltipLocAll}
        </div>
        <div class="sc-value">${fmtPrice(totalChargesLocAll)}</div>
        <div class="sc-sub">HT — ${locSubLabel}</div>
      </div>`
    : '<span class="bp-group-empty">Aucune unité configurée</span>';

  // ── Rendu ────────────────────────────────────────────────────
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
      <div class="bp-group-cards">${chargesLocCard}</div>
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
  const allUnits  = [
    ...state.chateauUnits,
    ...state.photoboothUnits,
    ...state.customTabs.filter(t => t.type === 'item').flatMap(tab => state.customUnits[tab.id] || [])
  ];
  const investTTC = allUnits.reduce((s, u) => s + (parseFloat(u.prixAchat) || 0) + (parseFloat(u.prixLivraison) || 0), 0);
  const fraisInitTTC = DATA.fraisInitiaux.rows.reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  const chargesFixesAn = getTotalChargesFixesAnnuelles();
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);
  const grandTotal   = investTTC + fraisInitTTC + chargesFixesAn + customTotal;

  const breakdownParts = [];
  if (investTTC     > 0) breakdownParts.push(`Équipements ${fmtPrice(investTTC)}`);
  if (fraisInitTTC  > 0) breakdownParts.push(`Frais init. ${fmtPrice(fraisInitTTC)}`);
  if (chargesFixesAn > 0) breakdownParts.push(`Charges fixes/an ${fmtPrice(chargesFixesAn)}`);
  if (customTotal   > 0) breakdownParts.push(`Blocs ${fmtPrice(customTotal)}`);

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

/** Initialise la section unifiée "Mes Équipements" */
function initUnits() {
  const addBtn    = document.getElementById('add-unit-btn');
  const form      = document.getElementById('unit-new-form');
  const confirmBtn = document.getElementById('unit-new-confirm');
  const cancelBtn  = document.getElementById('unit-new-cancel');
  if (!addBtn) return;

  updateUnitTypeSelect();   // populer avec les onglets custom existants

  addBtn.addEventListener('click', () => form.classList.toggle('hidden'));
  cancelBtn.addEventListener('click', () => form.classList.add('hidden'));
  confirmBtn.addEventListener('click', () => {
    const sel = document.getElementById('unit-type-select');
    addUnit(sel?.value || 'chateau');
    form.classList.add('hidden');
  });
}

/** Met à jour les options du select avec les onglets custom de type item */
function updateUnitTypeSelect() {
  const sel = document.getElementById('unit-type-select');
  if (!sel) return;
  // Retirer les options custom précédentes
  sel.querySelectorAll('option[data-custom]').forEach(o => o.remove());
  // Ajouter les onglets custom de type item
  state.customTabs.filter(t => t.type === 'item').forEach(t => {
    const opt = document.createElement('option');
    opt.value       = t.id;
    opt.dataset.custom = '1';
    opt.textContent = `📦 ${t.label}`;
    sel.appendChild(opt);
  });
}

function addUnit(type) {
  if (type === 'chateau') {
    state.chateauUnits.push({
      id: Date.now(),
      label: `Château ${state.chateauUnits.length + 1}`,
      isMain: false,
      prixAchat: 0, prixLivraison: 0, prixLocation: 150, locationsMois: 4
    });
  } else if (type === 'photobooth') {
    state.photoboothUnits.push({
      id: Date.now(),
      label: `Photobooth ${state.photoboothUnits.length + 1}`,
      prixAchat: 0, prixLivraison: 0, prixLocation: 100, locationsMois: 4
    });
  } else {
    // Onglet custom de type item
    const tab = state.customTabs.find(t => t.id === type);
    if (!tab) return;
    if (!state.customUnits[type]) state.customUnits[type] = [];
    const n = state.customUnits[type].length + 1;
    state.customUnits[type].push({
      id: Date.now(),
      label: `${tab.label} ${n}`,
      prixAchat: 0, prixLivraison: 0, prixLocation: 100, locationsMois: 4
    });
  }
  renderUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  markResumeDirty();
  scheduleAutoSave();
}

function removeCustomUnit(tabId, unitId) {
  if (!state.customUnits[tabId]) return;
  state.customUnits[tabId] = state.customUnits[tabId].filter(u => String(u.id) !== String(unitId));
  renderUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  markResumeDirty();
  scheduleAutoSave();
}

/** Supprime une unité château */
function removeChateauUnit(id) {
  state.chateauUnits = state.chateauUnits.filter(u => String(u.id) !== String(id));
  renderUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  markResumeDirty();
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
  const qte       = Math.max(1, parseInt(unit.quantite) || 1);
  const invest    = getUnitInvest(unit) * qte;
  const marge     = prixLoc - coutParLoc;
  return {
    marge,
    caMensuel:  prixLoc * nbMois * qte,
    caAnnuel:   prixLoc * nbMois * 12 * qte,
    chargesVar: coutParLoc * nbMois * 12 * qte,
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

function customCoutParLoc(tabId) {
  const ds = DATA[tabId + '_service'];
  if (!ds) return 0;
  return ds.rows.reduce((s,r) => s + (r.prixHT||0)*(parseFloat(r.usure)||0), 0);
}


/**
 * Détail des équipements (dépliable) — générique pour château et onglets custom.
 * dsKey : clé DATA de l'invest dataset (ex: 'chateauGonflable', 'custom_xxx_invest')
 * Les colonnes de nom supportées : produit (château) ou intitule (custom).
 */
function buildUnitDetailHTML(dsKey = 'chateauGonflable', unitIndex = 0) {
  const ds = DATA[dsKey];
  if (!ds || ds.rows.length === 0) return '<div class="unit-detail-list"><p style="color:var(--text-muted);padding:8px">Aucun équipement renseigné dans le tableau Détail.</p></div>';
  const rows = ds.rows;

  const coutPourCeUnit = r => {
    const p = Math.max(1, parseInt(r.partage) || 1);
    return unitIndex % p === 0 ? (r.prixHT || 0) : 0;
  };
  const total = rows.reduce((s, r) => s + coutPourCeUnit(r), 0);

  let html = '<div class="unit-detail-list">';
  rows.forEach(row => {
    const partage = Math.max(1, parseInt(row.partage) || 1);
    const isOwner = partage === 1 || unitIndex % partage === 0;
    const cout    = isOwner ? (row.prixHT || 0) : 0;
    const badge   = partage > 1
      ? isOwner
        ? `<span class="detail-row-badge">1/${partage}</span>`
        : `<span class="detail-row-badge badge-shared">partagé</span>`
      : '';
    const name = row.produit || row.intitule || '';
    html += `<div class="detail-row${isOwner ? '' : ' detail-row-shared'}">
               <span class="detail-row-name">${escHtml(name)}${badge}</span>
               <span class="detail-row-price">${isOwner ? fmtPrice(cout) : '<span class="empty-val">—</span>'}</span>
             </div>`;
  });
  html += `<div class="detail-row detail-row-total">
             <span class="detail-row-name">Total achat <small style="font-weight:400;color:var(--text-muted)">(HT)</small></span>
             <span class="detail-row-price">${fmtPrice(total)}</span>
           </div>`;
  html += '</div>';
  return html;
}

/** Construit le HTML d'une carte unité (château ou photobooth) */
function buildUnitCardHTML(unit, s, cfg = {}, unitIndex = 0) {
  const { icon = '🏰', placeholder = 'Nom du château', showExpand = true, unitType = 'chateau', investDsKey = 'chateauGonflable' } = cfg;
  const expanded  = showExpand && state.expandedUnits.has(String(unit.id));
  const deleteBtn = unit.isMain ? ''
    : `<button class="btn-danger unit-delete" data-unit-id="${unit.id}">✕</button>`;

  return `
    <div class="unit-card" data-unit-id="${unit.id}" data-unit-type="${unitType}">
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
        <div class="unit-field">
          <div class="unit-field-label">Quantité</div>
          <input type="number" class="unit-input"
                 data-unit-id="${unit.id}" data-field="quantite"
                 value="${unit.quantite || 1}" min="1" step="1" placeholder="1">
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
      </div>` : ''}
      ${showExpand && expanded ? `<div class="unit-detail">${buildUnitDetailHTML(investDsKey, unitIndex)}</div>` : ''}
      ${showExpand && expanded ? `<div class="unit-detail">${buildUnitDetailHTML(investDsKey, unitIndex)}</div>` : ''}
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
/** Supprime une unité photobooth */
function removePhotoboothUnit(id) {
  state.photoboothUnits = state.photoboothUnits.filter(u => String(u.id) !== String(id));
  renderUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  markResumeDirty();
  scheduleAutoSave();
}

/** Rendu unifié — châteaux + photobooths + unités custom */
function renderUnits() {
  const container = document.getElementById('units-container');
  if (!container) return;
  const coutLocC = chateauCoutParLoc();
  const coutLocP = photoboothCoutParLoc();

  const parts = [
    ...state.chateauUnits.map((unit, idx) =>
      buildUnitCardHTML(unit, calcUnitStats(unit, coutLocC),
        { icon: '🏰', placeholder: 'Nom du château', showExpand: true, unitType: 'chateau', investDsKey: 'chateauGonflable' }, idx)),
    ...state.photoboothUnits.map(unit =>
      buildUnitCardHTML(unit, calcUnitStats(unit, coutLocP),
        { icon: '📷', placeholder: 'Nom du photobooth', showExpand: false, unitType: 'photobooth' }))
  ];

  // Unités custom (onglets de type item)
  state.customTabs.filter(t => t.type === 'item').forEach(tab => {
    const units   = state.customUnits[tab.id] || [];
    const coutLoc = customCoutParLoc(tab.id);
    const investDsKey = tab.id + '_invest';
    units.forEach((unit, idx) => {
      parts.push(buildUnitCardHTML(unit, calcUnitStats(unit, coutLoc),
        { icon: '📦', placeholder: tab.label, showExpand: true, unitType: tab.id, investDsKey }, idx));
    });
  });

  container.innerHTML = parts.join('');
  attachUnitsListeners(container);
}

/** Listeners unifiés — détecte le type depuis data-unit-type */
function attachUnitsListeners(container) {
  const coutLocC = chateauCoutParLoc();
  const coutLocP = photoboothCoutParLoc();

  // Expand
  container.querySelectorAll('.unit-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.unitId;
      state.expandedUnits.has(id) ? state.expandedUnits.delete(id) : state.expandedUnits.add(id);
      renderUnits();
    });
  });

  // Suppression
  container.querySelectorAll('.unit-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.closest('.unit-card')?.dataset.unitType;
      if (type === 'chateau')    removeChateauUnit(btn.dataset.unitId);
      else if (type === 'photobooth') removePhotoboothUnit(btn.dataset.unitId);
      else                       removeCustomUnit(type, btn.dataset.unitId);
    });
  });

  const htFields  = new Set(['prixAchat', 'prixLivraison']);
  const numFields = new Set(['prixAchat', 'prixLivraison', 'prixLocation', 'locationsMois', 'quantite']);

  container.querySelectorAll('.unit-input').forEach(input => {
    input.addEventListener('input', () => {
      const card  = input.closest('.unit-card');
      const type  = card?.dataset.unitType;
      let units, coutLoc;
      if (type === 'chateau')         { units = state.chateauUnits;    coutLoc = coutLocC; }
      else if (type === 'photobooth') { units = state.photoboothUnits; coutLoc = coutLocP; }
      else                            { units = state.customUnits[type] || []; coutLoc = customCoutParLoc(type); }
      const unit = units.find(u => String(u.id) === String(input.dataset.unitId));
      if (!unit) return;
      const field = input.dataset.field;
      if (numFields.has(field)) {
        const val = parseFloat(input.value) || 0;
        unit[field] = htFields.has(field) ? val * 1.2 : val;
      } else {
        unit[field] = input.value;
      }
      refreshUnitStats(unit, coutLoc);
      renderSummary();
      renderSimulator();
      updateGrandTotal();
      markResumeDirty();
      scheduleAutoSave();
    });
  });
}


/* ════════════════════════════════════════════════════════════
   PLAN PHOTOS — galerie par type d'item
════════════════════════════════════════════════════════════ */

function openPlanModal(type) {
  if (!state.planPhotos[type]) state.planPhotos[type] = [];
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const content = document.getElementById('modal-content');
  const footer  = document.getElementById('modal-footer');

  const typeLabel = type === 'chateau' ? 'Château Gonflable'
    : type === 'photobooth' ? 'Photobooth'
    : (state.customTabs.find(t => t.id === type)?.label || type);

  title.textContent = `📋 Plan — ${typeLabel}`;
  footer.classList.remove('hidden');

  const render = () => {
    const photos = state.planPhotos[type] || [];
    content.innerHTML = `
      <div class="plan-gallery">
        ${photos.length === 0 ? '<p class="plan-empty">Aucune photo. Ajoutez un fichier ou une URL.</p>' : ''}
        ${photos.map((p, i) => `
          <div class="plan-photo-card">
            <img src="${escHtml(p.src)}" alt="${escHtml(p.name || '')}" class="plan-photo-img" />
            <div class="plan-photo-bar">
              <span class="plan-photo-name">${escHtml(p.name || `Photo ${i+1}`)}</span>
              <button class="btn-danger plan-photo-del" data-idx="${i}">✕</button>
            </div>
          </div>`).join('')}
      </div>
    `;
    content.querySelectorAll('.plan-photo-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.planPhotos[type].splice(parseInt(btn.dataset.idx), 1);
        render(); updatePlanBtn(type); markResumeDirty();
      });
    });
    content.querySelectorAll('.plan-photo-img').forEach(img => {
      img.addEventListener('click', () => {
        const w = window.open('', '_blank');
        w.document.write(`<img src="${img.src}" style="max-width:100%;height:auto">`);
      });
    });
  };

  footer.innerHTML = `
    <label class="btn-primary btn-sm" style="cursor:pointer">
      📁 Fichier
      <input type="file" accept="image/*" multiple style="display:none" id="plan-file-input">
    </label>
    <button class="btn-secondary btn-sm" id="plan-url-btn">🔗 URL</button>
  `;
  footer.querySelector('#plan-file-input').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    let done = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (!state.planPhotos[type]) state.planPhotos[type] = [];
        state.planPhotos[type].push({ src: ev.target.result, name: file.name });
        done++;
        if (done === files.length) { render(); updatePlanBtn(type); markResumeDirty(); scheduleAutoSave(); }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });
  footer.querySelector('#plan-url-btn').addEventListener('click', () => {
    const url = prompt('URL de l\'image :');
    if (!url?.trim()) return;
    if (!state.planPhotos[type]) state.planPhotos[type] = [];
    state.planPhotos[type].push({ src: url.trim(), name: url.trim().split('/').pop() });
    render(); updatePlanBtn(type); markResumeDirty(); scheduleAutoSave();
  });

  render();
  overlay.classList.remove('hidden');
  document.getElementById('modal-close').onclick = () => overlay.classList.add('hidden');
}

/* ════════════════════════════════════════════════════════════
   SIMULATEUR DE RENTABILITÉ — agrégé sur tous les châteaux
════════════════════════════════════════════════════════════ */

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function computeSimKPIs() {
  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);

  let totalInvestEquip = 0, totalCA = 0, totalChargesVar = 0;
  const coutLocChateau    = chateauCoutParLoc();
  const coutLocPhotobooth = photoboothCoutParLoc();

  state.chateauUnits.forEach(unit => {
    const s = calcUnitStats(unit, coutLocChateau);
    totalInvestEquip += s.invest; totalCA += s.caAnnuel; totalChargesVar += s.chargesVar;
  });
  state.photoboothUnits.forEach(unit => {
    const s = calcUnitStats(unit, coutLocPhotobooth);
    totalInvestEquip += s.invest; totalCA += s.caAnnuel; totalChargesVar += s.chargesVar;
  });
  state.customTabs.filter(t => t.type === 'item').forEach(tab => {
    const coutLoc = customCoutParLoc(tab.id);
    (state.customUnits[tab.id] || []).forEach(unit => {
      const s = calcUnitStats(unit, coutLoc);
      totalInvestEquip += s.invest; totalCA += s.caAnnuel; totalChargesVar += s.chargesVar;
    });
  });

  const chargesFixesAnnuelles = getTotalChargesFixesAnnuelles();
  const totalInvest  = totalInvestEquip + fraisInitTTC + customTotal;
  const totalCharges = totalChargesVar + chargesFixesAnnuelles;
  const benefAnnuel  = totalCA - totalCharges;
  const benefMensuel = benefAnnuel / 12;
  const roi          = totalInvest > 0 ? ((benefAnnuel / totalInvest) * 100).toFixed(1) : 0;
  const moisSeuil    = benefMensuel > 0 ? Math.ceil(totalInvest / benefMensuel) : Infinity;

  const grandTotal = totalInvest + chargesFixesAnnuelles;
  return { totalInvest, totalCA, totalCharges, totalChargesVar, chargesFixesAnnuelles, benefAnnuel, benefMensuel, roi, moisSeuil, grandTotal };
}

function renderSimulator() {
  const { totalInvest, totalCA, totalCharges, totalChargesVar, chargesFixesAnnuelles,
          benefAnnuel, benefMensuel, roi, moisSeuil } = computeSimKPIs();

  const fraisInitTTC = DATA.fraisInitiaux.totalPrixTTC;
  const customTotal  = state.customBlocks.reduce((s, b) => s + (parseFloat(b.montant) || 0), 0);

  const salaireMensuel = 0;

  const fmtM = n => isFinite(n) ? `${n} mois` : '∞';
  const cls  = (n, good, warn) => n <= good ? 'good' : n <= warn ? '' : 'warn';

  // ── KPIs principaux ────────────────────────────────────────
  document.getElementById('sim-kpi-row').innerHTML = `
    <div class="sim-kpi">
      <div class="sim-kpi-icon">💰</div>
      <div class="sim-kpi-label">CA annuel</div>
      <div class="sim-kpi-value">${fmtPrice(totalCA)}</div>
    </div>
    <div class="sim-kpi ${benefAnnuel >= 0 ? 'kpi-good' : 'kpi-warn'}">
      <div class="sim-kpi-icon">📈</div>
      <div class="sim-kpi-label">Bénéfice / an</div>
      <div class="sim-kpi-value">${fmtPrice(benefAnnuel)}</div>
    </div>
    <div class="sim-kpi ${cls(moisSeuil, 18, 36)}">
      <div class="sim-kpi-icon">🎯</div>
      <div class="sim-kpi-label">Retour sur invest.</div>
      <div class="sim-kpi-value">${fmtM(moisSeuil)}</div>
    </div>
    <div class="sim-kpi">
      <div class="sim-kpi-icon">📊</div>
      <div class="sim-kpi-label">ROI annuel</div>
      <div class="sim-kpi-value">${roi} %</div>
    </div>
  `;

  // ── Détails ────────────────────────────────────────────────
  document.getElementById('be-results').innerHTML = `
    <div class="be-item">
      <div class="be-item-label">Invest. total</div>
      <div class="be-item-value">${fmtPrice(totalInvest)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Charges variables / an</div>
      <div class="be-item-value">${fmtPrice(totalChargesVar)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Charges fixes / an</div>
      <div class="be-item-value">${fmtPrice(chargesFixesAnnuelles)}</div>
    </div>
    <div class="be-item">
      <div class="be-item-label">Bénéfice mensuel</div>
      <div class="be-item-value">${fmtPrice(benefMensuel)}</div>
    </div>
  `;

  // ── Graphiques ─────────────────────────────────────────────
  if (typeof Chart === 'undefined') return;
  renderChartBreakeven(totalInvest, benefMensuel);
}

/* ── Graphique 1 : Amortissement ────────────────────────────── */
function renderChartBreakeven(totalInvest, benefMensuel) {
  destroyChart('breakeven');
  const canvas = document.getElementById('chart-breakeven');
  if (!canvas) return;

  const maxMois = Math.min(Math.max(
    benefMensuel > 0 ? Math.ceil(totalInvest / benefMensuel) + 6 : 60,
    24
  ), 84);

  const labels     = Array.from({ length: maxMois + 1 }, (_, i) => `M${i}`);
  const cumulProfit = labels.map((_, i) => Math.max(0, i * benefMensuel));
  const investLine  = labels.map(() => totalInvest);

  const datasets = [
    { label: 'Investissement (jour 0)', data: investLine, borderColor: '#ef4444', borderDash: [6, 3], borderWidth: 2, pointRadius: 0, fill: false },
    { label: 'Profit cumulé', data: cumulProfit, borderColor: '#10b981', borderWidth: 2, pointRadius: 0, fill: { target: '-1', above: 'rgba(16,185,129,.08)', below: 'rgba(239,68,68,.06)' } },
  ];

  _charts.breakeven = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtPrice(ctx.parsed.y)}` } } },
      scales: { y: { ticks: { callback: v => fmtPrice(v) } } }
    }
  });
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
   IMPRESSION
════════════════════════════════════════════════════════════ */
function initExport() {
  document.getElementById('print-btn').addEventListener('click', () => window.print());
}


/* ════════════════════════════════════════════════════════════
   SAUVEGARDE / CHARGEMENT (localStorage)
════════════════════════════════════════════════════════════ */
const SAVE_KEY    = 'bp_chateau_v1';
const HISTORY_KEY = 'bp_history_v1';
const HISTORY_MAX = 40;
let _autoSaveTimer = null;

/* ── jsonbin.io ─────────────────────────────────────────────── */
const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/69e12a91856a6821893ff825';
const JSONBIN_KEY = '$2a$10$xPhBGIhnaRlxEbEFXCcFVekKcL2CRMXytb1rwlZayg4pFnBPtoonK';
let _nptData = { current: null, history: [] };

function initSave() {
  document.getElementById('save-btn')?.addEventListener('click', saveCurrentSilent);
  document.getElementById('detail-save-btn')?.addEventListener('click', saveDetail);
  document.getElementById('resume-save-btn')?.addEventListener('click', () => {
    promptSaveName(name => saveDataWithName(name));
  });
}

/** Sauvegarde uniquement les tableaux (page Détail) */
function saveDetail() {
  try {
    const base  = _nptData.current ? { ..._nptData.current } : buildSnapshot();
    const snap  = {
      ...base,
      savedAt:    new Date().toISOString(),
      customTabs: state.customTabs,
      data:       Object.fromEntries(STATIC_KEYS.map(k => [k, { rows: DATA[k]?.rows ?? [] }])),
      customData: buildCustomData()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    _nptData.current = snap;
    flushToAPI();
    showToast('✓ Tableaux sauvegardés');
    document.getElementById('detail-save-btn')?.classList.remove('unsaved');
  } catch(e) {
    console.error(e);
    showToast('⚠ Erreur — sauvegarde détail');
  }
}

/** Sauvegarde uniquement la configuration (page Résumé) */
function saveResume() {
  try {
    const base = _nptData.current ? { ..._nptData.current } : buildSnapshot();
    const snap = {
      ...base,
      savedAt:         new Date().toISOString(),
      chateauUnits:    state.chateauUnits,
      photoboothUnits: state.photoboothUnits,
      customUnits:     state.customUnits,
      customBlocks:    state.customBlocks
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    _nptData.current = snap;
    flushToAPI();
    showToast('✓ Configuration sauvegardée');
    document.getElementById('resume-save-btn')?.classList.remove('unsaved');
  } catch(e) {
    console.error(e);
    showToast('⚠ Erreur — sauvegarde résumé');
  }
}

/** Sauvegarde silencieuse — état complet, sans créer de version dans l'historique */
function saveCurrentSilent() {
  try {
    const snap = buildSnapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    _nptData.current = snap;
    flushToAPI();
    showToast('✓ Sauvegardé');
    document.getElementById('save-btn')?.classList.remove('unsaved');
  } catch(e) {
    console.error(e);
    showToast('⚠ Erreur — sauvegarde');
  }
}

/**
 * Ouvre la modale de saisie du nom de sauvegarde.
 * @param {function(string)} callback — appelé avec le nom saisi si confirmé
 */
function promptSaveName(callback) {
  const overlay  = document.getElementById('savename-overlay');
  const input    = document.getElementById('savename-input');
  const btnOk    = document.getElementById('savename-confirm');
  const btnCancel = document.getElementById('savename-cancel');

  input.value = '';
  input.placeholder = fmtHistoryDate(new Date().toISOString());
  overlay.classList.remove('hidden');
  input.focus();

  function doConfirm() {
    const name = input.value.trim() || fmtHistoryDate(new Date().toISOString());
    overlay.classList.add('hidden');
    cleanup();
    callback(name);
  }

  function doCancel() {
    overlay.classList.add('hidden');
    cleanup();
  }

  function onKey(e) {
    if (e.key === 'Enter')  doConfirm();
    if (e.key === 'Escape') doCancel();
  }

  function cleanup() {
    btnOk.removeEventListener('click', doConfirm);
    btnCancel.removeEventListener('click', doCancel);
    document.removeEventListener('keydown', onKey);
  }

  btnOk.addEventListener('click', doConfirm);
  btnCancel.addEventListener('click', doCancel);
  document.addEventListener('keydown', onKey);
}

/**
 * Sauvegarde l'état courant avec un nom donné :
 *  - localStorage (état courant)
 *  - historique
 *  - téléchargement du fichier .bpsave
 */
function saveDataWithName(name) {
  try {
    const snap = buildSnapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    _nptData.current = snap;
    addHistoryEntry(name, snap);  // → persistHistory → flushToAPI
    showToast(`✓ Sauvegardé — « ${name} »`);
    const btn = document.getElementById('save-btn');
    if (btn) btn.classList.remove('unsaved');
  } catch(e) {
    showToast('⚠ Erreur de sauvegarde');
  }
}

function saveData(showNotif = false) {
  try {
    const snap = buildSnapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    _nptData.current = snap;
    if (showNotif) {
      addHistoryEntry(null, snap);   // null = nom auto (date/heure)
    } else {
      flushToAPI();
    }
    const btn = document.getElementById('save-btn');
    if (btn) btn.classList.remove('unsaved');
  } catch(e) {
    showToast('⚠ Erreur de sauvegarde');
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { applyDefaultPlanPhotos(); return; }
    applySnapshot(JSON.parse(raw));
  } catch(e) {
    console.error('Erreur chargement sauvegarde', e);
    applyDefaultPlanPhotos();
  }
}

const STATIC_KEYS = ['chateauGonflable','photobooth','fraisInitiaux','fraisRecurrent',
                     'fraisMaintenance','fraisRecurrentsAnnuels','fraisServicePhotobooth','fraisMaintenancePhotobooth'];

function buildCustomData() {
  const customData = {};
  state.customTabs.forEach(tab => {
    if (tab.type === 'item') {
      tab.sections.forEach(s => {
        if (DATA[s.dsKey]) customData[s.dsKey] = { rows: DATA[s.dsKey].rows };
      });
    } else {
      if (DATA[tab.id]) customData[tab.id] = { rows: DATA[tab.id].rows };
    }
  });
  return customData;
}

function buildSnapshot() {
  return {
    version: 3,
    savedAt:         new Date().toISOString(),
    chateauUnits:    state.chateauUnits,
    photoboothUnits: state.photoboothUnits,
    customUnits:     state.customUnits,
    customBlocks:    state.customBlocks,
    customTabs:      state.customTabs,
    planPhotos:      state.planPhotos,
    data:            Object.fromEntries(STATIC_KEYS.map(k => [k, { rows: DATA[k]?.rows ?? [] }])),
    customData:      buildCustomData()
  };
}

const PHOTOBOOTH_STATIC_PHOTOS = [
  { src: 'image/photobooth_schema.png',  name: 'Schéma électrique',       _static: true },
  { src: 'image/photobooth_plan2d.png',  name: 'Plan 2D — Pièces à découper', _static: true },
  { src: 'image/photobooth_photo.png',   name: 'Rendu photobooth',         _static: true }
];

function applyDefaultPlanPhotos() {
  // Les photos statiques photobooth sont toujours affichées depuis PHOTOBOOTH_STATIC_PHOTOS
  // elles ne sont pas dans state.planPhotos
}

function applySnapshot(snap) {
  if (Array.isArray(snap.chateauUnits) && snap.chateauUnits.length)
    state.chateauUnits    = snap.chateauUnits;
  if (Array.isArray(snap.photoboothUnits))
    state.photoboothUnits = snap.photoboothUnits;
  if (snap.customUnits && typeof snap.customUnits === 'object')
    state.customUnits = snap.customUnits;
  if (snap.planPhotos && typeof snap.planPhotos === 'object') {
    state.planPhotos = snap.planPhotos;
    // nettoyer les anciennes entrées _default avec des chemins locaux inexistants
    Object.keys(state.planPhotos).forEach(k => {
      state.planPhotos[k] = (state.planPhotos[k] || []).filter(p => !p._default);
    });
  }
  if (Array.isArray(snap.customBlocks))
    state.customBlocks    = snap.customBlocks;

  // Onglets personnalisés
  if (Array.isArray(snap.customTabs) && snap.customTabs.length) {
    state.customTabs = snap.customTabs;
    state.customTabs.forEach(tab => {
      TAB_MAP[tab.id] = tab.id;
      if (tab.type === 'item' && Array.isArray(tab.sections)) {
        tab.sections.forEach(s => {
          const rows = snap.customData?.[s.dsKey]?.rows || [];
          if (s.dsKey.endsWith('_invest'))      DATA[s.dsKey] = makeInvestDataset(tab.label, rows);
          else if (s.dsKey.endsWith('_service')) DATA[s.dsKey] = makeServiceDataset(tab.label, rows);
          else                                   DATA[s.dsKey] = makeMaintenanceDataset(tab.label, rows);
        });
      } else {
        const rows = snap.customData?.[tab.id]?.rows || [];
        DATA[tab.id] = makeFreisDataset(tab.label, rows);
      }
    });
    renderCustomTabButtons();
    updateUnitTypeSelect();
  }

  if (snap.data) {
    Object.keys(snap.data).forEach(k => {
      if (DATA[k] && Array.isArray(snap.data[k]?.rows)) {
        const savedRows = snap.data[k].rows.filter(r =>
          r && Object.values(r).some(v => v !== null && v !== '' && v !== undefined)
        );
        if (savedRows.length === 0) return; // garde les defaults de data.js
        const origRows = DATA[k].rows;
        DATA[k].rows = savedRows.map((savedRow, i) => {
          const image = (origRows[i] || {}).image;
          const row = image ? { ...savedRow, image } : { ...savedRow };
          // migration prixTTC → prixHT pour photobooth
          if (k === 'photobooth' && row.prixHT == null && row.prixTTC != null) {
            row.prixHT = row.prixTTC;
          }
          return row;
        });
      }
    });
  }
  recomputeDataTotals();
}

function renderAll() {
  renderUnits();
  renderSummary();
  renderSimulator();
  updateGrandTotal();
  renderTable();
}

function scheduleAutoSave() {
  document.getElementById('detail-save-btn')?.classList.add('unsaved');
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => saveData(false), 1500);
}

function markResumeDirty() {
  document.getElementById('resume-save-btn')?.classList.add('unsaved');
}


/* ════════════════════════════════════════════════════════════
   NPOINT.IO — Persistance cloud
════════════════════════════════════════════════════════════ */

/** Charge les données depuis jsonbin au démarrage */
async function loadFromAPI() {
  try {
    const res = await fetch(JSONBIN_URL, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    if (!res.ok) throw new Error('jsonbin unreachable');
    const json = await res.json();
    const parsed = json.record || json;
    _nptData = {
      current: parsed.current || null,
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
    if (_nptData.current) {
      applySnapshot(_nptData.current);
    } else {
      loadData();   // fallback localStorage si pas encore de snapshot cloud
    }
  } catch {
    loadData();   // fallback localStorage si jsonbin indisponible
  }
}

/** Écrit _nptData vers jsonbin — planPhotos exclus (trop lourd pour le cloud) */
function flushToAPI() {
  const stripPhotos = snap => {
    if (!snap) return snap;
    const { planPhotos, ...rest } = snap;
    return rest;
  };
  const payload = {
    current: stripPhotos(_nptData.current),
    history: (_nptData.history || []).map(e => ({
      ...e,
      snap: stripPhotos(e.snap)
    }))
  };
  fetch(JSONBIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY
    },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) showToast(`⚠ jsonbin erreur ${res.status}`);
  })
  .catch(e => {
    console.error('Écriture jsonbin échouée', e);
    showToast('⚠ Sauvegarde cloud échouée');
  });
}


/* ════════════════════════════════════════════════════════════
   HISTORIQUE DES SAUVEGARDES
════════════════════════════════════════════════════════════ */

function fmtHistoryDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function getHistory() {
  return _nptData.history || [];
}

function persistHistory(entries) {
  _nptData.history = entries;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  flushToAPI();
}

/**
 * Ajoute un snapshot à l'historique.
 * @param {string|null} name  — null = nom auto (date/heure)
 * @param {Object}      snap  — snapshot (buildSnapshot())
 */
function addHistoryEntry(name, snap) {
  const entries = getHistory();
  const now     = new Date();
  const kpis    = computeSimKPIs();
  entries.unshift({
    id:          now.getTime(),
    name:        name || fmtHistoryDate(now.toISOString()),
    savedAt:     now.toISOString(),
    benefAnnuel: kpis.benefAnnuel,
    roi:         kpis.roi,
    grandTotal:  kpis.grandTotal,
    snap
  });
  if (entries.length > HISTORY_MAX) entries.length = HISTORY_MAX;
  persistHistory(entries);
}

function deleteHistoryEntry(id) {
  persistHistory(getHistory().filter(e => String(e.id) !== String(id)));
}

function initHistoryPanel() {
  const overlay = document.getElementById('history-overlay');
  const drawer  = document.getElementById('history-drawer');

  document.getElementById('history-btn').addEventListener('click', openHistoryPanel);
  document.getElementById('resume-history-btn')?.addEventListener('click', openHistoryPanel);
  document.getElementById('history-close').addEventListener('click', closeHistoryPanel);

  // Fermer en cliquant hors du drawer
  overlay.addEventListener('click', e => { if (e.target === overlay) closeHistoryPanel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeHistoryPanel();
  });

}

function openHistoryPanel() {
  renderHistoryList();
  document.getElementById('history-overlay').classList.remove('hidden');
  document.getElementById('history-close').focus();
}

function closeHistoryPanel() {
  document.getElementById('history-overlay').classList.add('hidden');
}

function computeKPIsFromSnap(snap) {
  if (!snap) return { benefAnnuel: null, roi: null };
  const sd = snap.data || {};
  const cd = snap.customData || {};
  const customTabs = snap.customTabs || [];

  const coutLoc = rows => (rows || []).reduce((s,r) => s + (parseFloat(r.prixHT)||0)*(parseFloat(r.usure)||0), 0);
  const coutLocCH = coutLoc(sd.fraisRecurrent?.rows);
  const coutLocPB = coutLoc(sd.fraisServicePhotobooth?.rows);

  let totalInvestEquip = 0, totalCA = 0, totalChargesVar = 0;
  const calcUnit = (unit, cl) => {
    totalInvestEquip += (parseFloat(unit.prixAchat)||0) + (parseFloat(unit.prixLivraison)||0);
    const locs = (parseFloat(unit.locationsMois)||0) * 12;
    totalCA         += locs * (parseFloat(unit.prixLocation)||0);
    totalChargesVar += locs * cl;
  };
  (snap.chateauUnits    || []).forEach(u => calcUnit(u, coutLocCH));
  (snap.photoboothUnits || []).forEach(u => calcUnit(u, coutLocPB));
  customTabs.filter(t => t.type === 'item').forEach(tab => {
    const cl = coutLoc(cd[tab.id + '_service']?.rows);
    ((snap.customUnits || {})[tab.id] || []).forEach(u => calcUnit(u, cl));
  });

  // Charges fixes
  const sumRows = rows => (rows || []).reduce((s,r) => s + (parseFloat(r.prixTTC)||0), 0);
  const mainCH  = sumRows(sd.fraisMaintenance?.rows);
  const mainPB  = sumRows(sd.fraisMaintenancePhotobooth?.rows);
  const mainCust = customTabs.filter(t => t.type === 'item')
    .reduce((s,t) => s + sumRows(cd[t.id + '_maintenance']?.rows), 0);

  // Assurance matériel (6% base matériel)
  const electro = parseFloat((sd.chateauGonflable?.rows || []).find(r => r.produit?.includes('électrogène'))?.prixHT || 0);
  const assurance = ((snap.chateauUnits||[]).reduce((s,u) => s+(parseFloat(u.prixAchat)||0)+electro, 0)
    + (snap.photoboothUnits||[]).reduce((s,u) => s+(parseFloat(u.prixAchat)||0), 0)) * 0.06;

  const recurrents = (sd.fraisRecurrentsAnnuels?.rows || []).reduce((s,r) => {
    if (r.computed === 'assurance_materiel') return s + assurance;
    return s + (parseFloat(r.prixTTC)||0);
  }, 0);

  const chargesFixesAnnuelles = mainCH + recurrents + mainPB + mainCust;
  const fraisInitTTC = sumRows(sd.fraisInitiaux?.rows);
  const customTotal  = (snap.customBlocks||[]).reduce((s,b) => s+(parseFloat(b.montant)||0), 0);
  const totalInvest  = totalInvestEquip + fraisInitTTC + customTotal;
  const totalCharges = totalChargesVar + chargesFixesAnnuelles;
  const benefAnnuel  = totalCA - totalCharges;
  const roi          = totalInvest > 0 ? ((benefAnnuel / totalInvest) * 100).toFixed(1) : 0;
  const grandTotal   = totalInvestEquip + fraisInitTTC + chargesFixesAnnuelles + customTotal;
  return { benefAnnuel, roi, grandTotal };
}

function renderHistoryList() {
  const entries   = getHistory();
  const container = document.getElementById('history-list');
  const countEl   = document.getElementById('history-count');

  if (countEl) countEl.textContent = entries.length
    ? `${entries.length} sauvegarde${entries.length > 1 ? 's' : ''}`
    : '';

  if (!entries.length) {
    container.innerHTML = `<div class="history-empty">
      Aucune sauvegarde.<br>
      <small>Cliquez sur « Sauvegarder maintenant » pour commencer.</small>
    </div>`;
    return;
  }

  container.innerHTML = entries.map((entry, i) => {
    const kpis = (entry.benefAnnuel != null)
      ? { benefAnnuel: entry.benefAnnuel, roi: entry.roi, grandTotal: entry.grandTotal }
      : computeKPIsFromSnap(entry.snap);
    return `
    <div class="history-entry" data-id="${entry.id}" role="listitem">
      <div class="history-entry-top">
        <div class="history-entry-left">
          <input class="history-entry-name" value="${escHtml(entry.name)}"
                 data-id="${entry.id}" aria-label="Nom de la sauvegarde" />
          <div class="history-entry-kpis">
            ${kpis.grandTotal  != null ? `<span class="history-kpi">💰 ${fmtPrice(kpis.grandTotal)}</span>` : ''}
            ${kpis.benefAnnuel != null ? `<span class="history-kpi ${kpis.benefAnnuel >= 0 ? 'kpi-pos' : 'kpi-neg'}">📈 ${fmtPrice(kpis.benefAnnuel)}/an</span>` : ''}
            ${kpis.roi         != null ? `<span class="history-kpi">ROI ${kpis.roi} %</span>` : ''}
          </div>
        </div>
        ${i === 0 ? '<span class="history-latest-badge">Dernière</span>' : ''}
      </div>
      <div class="history-entry-bottom">
        <span class="history-entry-date">${fmtHistoryDate(entry.savedAt)}</span>
        <div class="history-entry-actions">
          <button class="btn-history-load"   data-id="${entry.id}" title="Charger">📥 Charger</button>
          <button class="btn-history-delete" data-id="${entry.id}" title="Supprimer">🗑</button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  // ── Renommer ──────────────────────────────────────────────
  container.querySelectorAll('.history-entry-name').forEach(input => {
    input.addEventListener('change', () => {
      const entries = getHistory();
      const entry   = entries.find(e => String(e.id) === String(input.dataset.id));
      if (entry) { entry.name = input.value.trim() || entry.name; persistHistory(entries); }
    });
  });

  // ── Charger ───────────────────────────────────────────────
  container.querySelectorAll('.btn-history-load').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = getHistory().find(e => String(e.id) === String(btn.dataset.id));
      if (!entry) return;
      if (!confirm(`Charger « ${entry.name} » ?\nL'état actuel non sauvegardé sera remplacé.`)) return;
      applySnapshot(entry.snap);
      saveData(false);
      renderAll();
      closeHistoryPanel();
      showToast(`✓ « ${entry.name} » chargée`);
    });
  });

  // ── Supprimer ─────────────────────────────────────────────
  container.querySelectorAll('.btn-history-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteHistoryEntry(btn.dataset.id);
      renderHistoryList();
    });
  });
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
