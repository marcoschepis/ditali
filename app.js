let appState = {
  stanzaAttivaIdx: 0,
  categorie: [
    { nome: "Europa", colore: "#0284c7" },
    { nome: "Italia", colore: "#16a34a" },
    { nome: "Mondo", colore: "#d97706" }
  ],
  stanze: [
    {
      nome: "Scala",
      righe: 10,
      colonne: 14,
      griglia: {}
    }
  ]
};

let selezioni = new Set();
let isMouseDown = false;
let dragStartCoords = null;
let tileElements = [];
let isViewMode = true;

const GITHUB_CONFIG = {
  owner: "marcoschepis",
  repo: "ditali",
  path: "bacheca.json",
  branch: "main"
};

// ---------------------------------------------------------
// CALCOLO TOTALI (STANZE & GENERALE)
// ---------------------------------------------------------
function calcolaTotaleStanza(stanza) {
  if (!stanza || !stanza.griglia) return 0;
  
  let totaleStanza = 0;
  const visitati = new Set();

  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      const cell = stanza.griglia[key];

      if (cell && cell.tipo === 'bacheca' && !visitati.has(key)) {
        const coda = [{ r, c }];
        visitati.add(key);
        const currentGruppoId = cell.gruppoId || null;

        if (cell.totaleGruppo !== undefined) {
          totaleStanza += parseInt(cell.totaleGruppo) || 0;
        }

        while (coda.length > 0) {
          const curr = coda.shift();
          const vicini = [
            { r: curr.r - 1, c: curr.c },
            { r: curr.r + 1, c: curr.c },
            { r: curr.r, c: curr.c - 1 },
            { r: curr.r, c: curr.c + 1 }
          ];

          vicini.forEach(v => {
            const vKey = `${v.r}_${v.c}`;
            const vCell = stanza.griglia[vKey];
            if (
              vCell &&
              vCell.tipo === 'bacheca' &&
              vCell.categoria === cell.categoria &&
              (vCell.gruppoId || null) === currentGruppoId &&
              !visitati.has(vKey)
            ) {
              visitati.add(vKey);
              coda.push(v);
            }
          });
        }
      }
    }
  }

  return totaleStanza;
}

function calcolaTotaleGenerale() {
  return appState.stanze.reduce((acc, stanza) => acc + calcolaTotaleStanza(stanza), 0);
}

// ---------------------------------------------------------
// INIZIALIZZAZIONE & STATO
// ---------------------------------------------------------
async function init() {
  await caricaLayoutDaRepo();
  aggiornaInterfacciaModalita();
  renderGriglia();

  window.addEventListener('resize', () => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    renderGriglia();
  });

  // Parti sempre dalla prima stanza all'avvio
  cambiaStanza(0);
}

function toggleModalita() {
  isViewMode = !isViewMode;
  selezioni.clear();
  aggiornaInterfacciaModalita();
  
  setTimeout(() => {
    renderGriglia();
  }, 20);
}

function aggiornaInterfacciaModalita() {
  const btn = document.getElementById('btnToggleMode');
  if (isViewMode) {
    document.body.classList.add('view-only-mode');
    if (btn) btn.innerHTML = '✏️ Modifica';
  } else {
    document.body.classList.remove('view-only-mode');
    if (btn) btn.innerHTML = '👁️ Vista';
    renderTabsStanze();
    renderCategorie();
    setupDragSelection();
  }
}

function mostraSideTab(tabId) {
  document.querySelectorAll('.side-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.side-tab'))
    .find(b => b.getAttribute('onclick')?.includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  const activeContent = document.getElementById(tabId);
  if (activeContent) activeContent.classList.add('active');
}

async function caricaLayoutDaRepo() {
  try {
    const response = await fetch('bacheca.json');
    if (response.ok) {
      const data = await response.json();
      appState = data;
      if (appState.stanzaAttivaIdx === undefined) appState.stanzaAttivaIdx = 0;
    }
  } catch (err) {
    console.log("Nessun file bacheca.json trovato. Uso lo stato predefinito.", err);
  }
  inizializzaStanzaAttiva();
}

function getStanzaCorrente() {
  return appState.stanze[appState.stanzaAttivaIdx];
}

function inizializzaStanzaAttiva() {
  const stanza = getStanzaCorrente();
  if (!stanza) return;
  if (!stanza.griglia) stanza.griglia = {};
  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      if (!stanza.griglia[key]) stanza.griglia[key] = { tipo: 'vuoto' };
    }
  }
}

// ---------------------------------------------------------
// GESTIONE STANZE & DISPLAY TOTALI
// ---------------------------------------------------------
function renderTabsStanze() {
  const container = document.getElementById('roomsTabs');
  if (!container) return;
  container.innerHTML = '';

  appState.stanze.forEach((stanza, idx) => {
    const totStanza = calcolaTotaleStanza(stanza);
    const tab = document.createElement('div');
    tab.className = `tab-room ${idx === appState.stanzaAttivaIdx ? 'active' : ''}`;
    tab.innerHTML = `
      <span onclick="cambiaStanza(${idx})">
        ${stanza.nome} <strong style="opacity: 0.85; margin-left: 4px;">(${totStanza})</strong>
      </span>
      ${!isViewMode && appState.stanze.length > 1 ? `<span class="del-room" onclick="eliminaStanza(${idx})">✕</span>` : ''}
    `;
    container.appendChild(tab);
  });

  const stanza = getStanzaCorrente();
  if (stanza) {
    const inputRows = document.getElementById('roomRows');
    const inputCols = document.getElementById('roomCols');
    if (inputRows) inputRows.value = stanza.righe;
    if (inputCols) inputCols.value = stanza.colonne;
  }

  document.getElementById('totalCount').textContent = `Totale: ${calcolaTotaleGenerale()}`;
}

function cambiaStanza(idx) {
  appState.stanzaAttivaIdx = idx;
  selezioni.clear();
  inizializzaStanzaAttiva();
  renderTabsStanze();
  if (!isViewMode) {
    aggiornaPannelloEditor();
  }
  renderGriglia();
}

function creaNuovaStanza() {
  const nome = prompt("Nome della nuova stanza:", `Stanza ${appState.stanze.length + 1}`);
  if (!nome) return;

  appState.stanze.push({
    nome: nome,
    righe: 10,
    colonne: 14,
    griglia: {}
  });

  cambiaStanza(appState.stanze.length - 1);
}

function eliminaStanza(idx) {
  if (confirm(`Sei sicuro di voler eliminare "${appState.stanze[idx].nome}"?`)) {
    appState.stanze.splice(idx, 1);
    if (appState.stanzaAttivaIdx >= appState.stanze.length) {
      appState.stanzaAttivaIdx = appState.stanze.length - 1;
    }
    cambiaStanza(appState.stanzaAttivaIdx);
  }
}

function ridimensionaStanza() {
  const stanza = getStanzaCorrente();
  stanza.righe = parseInt(document.getElementById('roomRows').value) || 10;
  stanza.colonne = parseInt(document.getElementById('roomCols').value) || 14;

  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      if (!stanza.griglia[key]) stanza.griglia[key] = { tipo: 'vuoto' };
    }
  }
  renderGriglia();
}

// ---------------------------------------------------------
// GESTIONE CATEGORIE
// ---------------------------------------------------------
function renderCategorie() {
  const container = document.getElementById('categoriesList');
  const select = document.getElementById('bachecaCategorySelect');
  if (!container || !select) return;

  container.innerHTML = '';
  select.innerHTML = '';

  appState.categorie.forEach((cat, idx) => {
    const item = document.createElement('div');
    item.className = 'cat-item';
    item.innerHTML = `
      <div class="cat-item-info">
        <span class="color-dot" style="background-color: ${cat.colore};"></span>
        <strong>${cat.nome}</strong>
      </div>
      <span class="del" onclick="rimuoviCategoria(${idx})">✕</span>
    `;
    container.appendChild(item);

    const opt = document.createElement('option');
    opt.value = cat.nome;
    opt.innerText = cat.nome;
    select.appendChild(opt);
  });
}

function aggiungiCategoria() {
  const input = document.getElementById('newCatInput');
  const colorInput = document.getElementById('newCatColor');
  const nome = input.value.trim();
  const colore = colorInput.value;

  if (nome && !appState.categorie.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
    appState.categorie.push({ nome, colore });
    input.value = '';
    renderCategorie();
    renderGriglia();
  }
}

function rimuoviCategoria(idx) {
  appState.categorie.splice(idx, 1);
  renderCategorie();
  renderGriglia();
}

function getColoreCategoria(nomeCategoria) {
  const cat = appState.categorie.find(c => c.nome === nomeCategoria);
  return cat ? cat.colore : '#0284c7';
}

// ---------------------------------------------------------
// RENDERING GRIGLIA & LOGICA VISIVA
// ---------------------------------------------------------
function renderGriglia() {
  const stanza = getStanzaCorrente();
  const container = document.getElementById('roomGrid');
  if (!container || !stanza) return;

  renderTabsStanze();

  container.style.gridTemplateRows = `repeat(${stanza.righe}, 1fr)`;
  container.style.gridTemplateColumns = `repeat(${stanza.colonne}, 1fr)`;
  container.innerHTML = '';
  tileElements = [];

  const fragment = document.createDocumentFragment();

  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      const cell = stanza.griglia[key] || { tipo: 'vuoto' };

      const tile = document.createElement('div');
      tile.className = 'tile' + (!isViewMode && selezioni.has(key) ? ' selected' : '');
      tile.dataset.key = key;
      tile.dataset.r = r;
      tile.dataset.c = c;

      if (cell.tipo === 'muro') {
        tile.style.backgroundColor = cell.colore || '#334155';
      } else if (cell.tipo === 'bacheca') {
        tile.style.backgroundColor = getColoreCategoria(cell.categoria);
      } else {
        tile.style.backgroundColor = '#1e293b';
      }

      calcolaUnioneEBordi(tile, r, c, cell, stanza);

      fragment.appendChild(tile);
      tileElements.push(tile);
    }
  }

  container.appendChild(fragment);
  renderBadgesCentrati(stanza, container);
  renderLegendaColori();
}

function calcolaUnioneEBordi(tile, r, c, cell, stanza) {
  if (cell.tipo === 'vuoto') return;

  const top = stanza.griglia[`${r-1}_${c}`];
  const right = stanza.griglia[`${r}_${c+1}`];
  const bottom = stanza.griglia[`${r+1}_${c}`];
  const left = stanza.griglia[`${r}_${c-1}`];

  if (cell.tipo === 'muro') {
    const StessoMuro = (other) => other && other.tipo === 'muro' && other.colore === cell.colore;
    tile.style.borderTop = StessoMuro(top) ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderRight = StessoMuro(right) ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderBottom = StessoMuro(bottom) ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderLeft = StessoMuro(left) ? 'none' : '1px solid rgba(0,0,0,0.4)';
  } else if (cell.tipo === 'bacheca') {
    const wOuter = '3px solid var(--wood-frame, #8b5a2b)';
    const wInner = '2px solid var(--wood-frame-divider, #5c3a1e)';

    const StessoGruppo = (other) => {
      if (!other || other.tipo !== 'bacheca') return false;
      const stessaCat = other.categoria === cell.categoria;
      const stessoSubId = (cell.gruppoId || null) === (other.gruppoId || null);
      return stessaCat && stessoSubId;
    };

    const gestisciBordo = (other) => {
      if (!other || other.tipo !== 'bacheca') return wOuter;
      if (!StessoGruppo(other)) return wInner;
      return 'none';
    };

    tile.style.borderTop = gestisciBordo(top);
    tile.style.borderRight = gestisciBordo(right);
    tile.style.borderBottom = gestisciBordo(bottom);
    tile.style.borderLeft = gestisciBordo(left);
  }
}

function renderBadgesCentrati(stanza, container) {
  const visitati = new Set();

  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      const cell = stanza.griglia[key];

      if (cell && cell.tipo === 'bacheca' && !visitati.has(key)) {
        const coda = [{ r, c }];
        const gruppo = [];
        visitati.add(key);

        const currentGruppoId = cell.gruppoId || null;

        while (coda.length > 0) {
          const curr = coda.shift();
          const currKey = `${curr.r}_${curr.c}`;
          gruppo.push(currKey);

          const vicini = [
            { r: curr.r - 1, c: curr.c },
            { r: curr.r + 1, c: curr.c },
            { r: curr.r, c: curr.c - 1 },
            { r: curr.r, c: curr.c + 1 }
          ];

          vicini.forEach(v => {
            const vKey = `${v.r}_${v.c}`;
            const vCell = stanza.griglia[vKey];
            
            if (
              vCell &&
              vCell.tipo === 'bacheca' &&
              vCell.categoria === cell.categoria &&
              (vCell.gruppoId || null) === currentGruppoId &&
              !visitati.has(vKey)
            ) {
              visitati.add(vKey);
              coda.push(v);
            }
          });
        }

        const totaleAttuale = cell.totaleGruppo !== undefined ? cell.totaleGruppo : '';

        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        gruppo.forEach(k => {
          const [pr, pc] = k.split('_').map(Number);
          if (pr < minR) minR = pr;
          if (pr > maxR) maxR = pr;
          if (pc < minC) minC = pc;
          if (pc > maxC) maxC = pc;
        });

        const centerC = ((minC + maxC + 1) / 2) / stanza.colonne * 100;
        const centerR = ((minR + maxR + 1) / 2) / stanza.righe * 100;

        const badge = document.createElement('div');
        badge.className = 'bacheca-total-badge';
        badge.innerText = totaleAttuale !== '' ? `${totaleAttuale}` : '0';
        badge.style.left = `${centerC}%`;
        badge.style.top = `${centerR}%`;
        badge.style.cursor = isViewMode ? 'default' : 'pointer';

        if (!isViewMode) {
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const nuovoTotale = prompt(`Inserisci il totale per la bacheca (${cell.categoria}):`, totaleAttuale);
            if (nuovoTotale !== null) {
              const val = parseInt(nuovoTotale) || 0;
              cell.totaleGruppo = val;
              renderGriglia();
            }
          });
        }

        container.appendChild(badge);
      }
    }
  }
}

function renderLegendaColori() {
  const legendContainer = document.getElementById('colorLegend');
  if (!legendContainer || !appState.categorie) return;

  // Svuota la legenda esistente
  legendContainer.innerHTML = '';

  // Genera un pallino di colore e il relativo nome per ogni categoria
  Object.entries(appState.categorie).forEach(([nome, cat]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorBadge = document.createElement('span');
    colorBadge.className = 'legend-color-dot';
    colorBadge.style.backgroundColor = cat.colore || '#94a3b8';

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = cat.nome;

    item.appendChild(colorBadge);
    item.appendChild(label);
    legendContainer.appendChild(item);
  });
}

// ---------------------------------------------------------
// INTERAZIONE & SELEZIONE
// ---------------------------------------------------------
function setupDragSelection() {
  const grid = document.getElementById('roomGrid');
  if (!grid) return;

  grid.addEventListener('pointerdown', (e) => {
    if (isViewMode || e.target.closest('.bacheca-total-badge')) return;

    const tile = e.target.closest('.tile');
    if (!tile) return;

    isMouseDown = true;
    dragStartCoords = { r: parseInt(tile.dataset.r), c: parseInt(tile.dataset.c) };

    if (!e.shiftKey && !e.ctrlKey) {
      selezioni.clear();
    }

    aggiornaSelezioneRettangolo(dragStartCoords, dragStartCoords);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!isMouseDown || isViewMode) return;

    if (e.cancelable) e.preventDefault();

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const tile = target ? target.closest('.tile') : null;

    if (tile) {
      const currentCoords = { r: parseInt(tile.dataset.r), c: parseInt(tile.dataset.c) };
      aggiornaSelezioneRettangolo(dragStartCoords, currentCoords);
    }
  }, { passive: false });

  window.addEventListener('pointerup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      aggiornaPannelloEditor();
    }
  });
}

function aggiornaSelezioneRettangolo(p1, p2) {
  const minR = Math.min(p1.r, p2.r);
  const maxR = Math.max(p1.r, p2.r);
  const minC = Math.min(p1.c, p2.c);
  const maxC = Math.max(p1.c, p2.c);

  const coordinateCorrenti = new Set();
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      coordinateCorrenti.add(`${r}_${c}`);
    }
  }

  tileElements.forEach(tile => {
    const key = tile.dataset.key;
    const isInsideRect = coordinateCorrenti.has(key);

    if (isInsideRect) {
      selezioni.add(key);
      tile.classList.add('selected');
    } else {
      selezioni.delete(key);
      tile.classList.remove('selected');
    }
  });
}

function deselezionaTutto() {
  selezioni.clear();
  tileElements.forEach(tile => tile.classList.remove('selected'));
  aggiornaPannelloEditor();
}

function aggiornaPannelloEditor() {
  const info = document.getElementById('selectionInfo');
  const form = document.getElementById('editorForm');
  if (!info || !form) return;

  if (selezioni.size === 0) {
    info.innerText = "Nessuna cella selezionata.";
    form.style.display = 'none';
  } else {
    info.innerText = `Celle selezionate: ${selezioni.size}`;
    form.style.display = 'block';
    toggleTipoInputs();
  }
}

function toggleTipoInputs() {
  const tipo = document.getElementById('tileType').value;
  document.getElementById('muroOptions').style.display = tipo === 'muro' ? 'block' : 'none';
  document.getElementById('bachecaOptions').style.display = tipo === 'bacheca' ? 'block' : 'none';
}

function applicaASelezione() {
  const stanza = getStanzaCorrente();
  const tipo = document.getElementById('tileType').value;
  const coloreMuro = document.getElementById('muroColor').value;
  const catBacheca = document.getElementById('bachecaCategorySelect').value;
  const nuovoId = 'sub_' + crypto.randomUUID();

  selezioni.forEach(key => {
    if (tipo === 'vuoto') {
      stanza.griglia[key] = { tipo: 'vuoto' };
    } else if (tipo === 'muro') {
      stanza.griglia[key] = { tipo: 'muro', colore: coloreMuro };
    } else if (tipo === 'bacheca') {
      stanza.griglia[key] = {
        tipo: 'bacheca',
        categoria: catBacheca,
        gruppoId: nuovoId
      };
    }
  });

  renderGriglia();
}

// ---------------------------------------------------------
// EXPORT, IMPORT & SALVATAGGIO GITHUB
// ---------------------------------------------------------
function esportaJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'bacheca.json';
  a.click();
}

function importaJSON(e) {
  const fileReader = new FileReader();
  fileReader.onload = function(evt) {
    try {
      appState = JSON.parse(evt.target.result);
      if (appState.stanzaAttivaIdx === undefined) appState.stanzaAttivaIdx = 0;
      selezioni.clear();
      renderTabsStanze();
      renderCategorie();
      aggiornaPannelloEditor();
      renderGriglia();
    } catch (err) {
      alert("File JSON non valido.");
    }
  };
  fileReader.readAsText(e.target.files[0]);
}

async function salvaSuGitHub() {
  // Passaggio a localStorage per persistere il token tra le sessioni del browser
  let token = localStorage.getItem('gh_token');
  if (!token) {
    token = prompt("Inserisci il tuo Personal Access Token (PAT) di GitHub:");
    if (!token) return;
    localStorage.setItem('gh_token', token.trim());
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

  try {
    let sha = "";
    const getRes = await fetch(url, {
      headers: { "Authorization": `token ${token}` }
    });
    
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    const jsonContent = JSON.stringify(appState, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonContent)));

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Update bacheca.json via web editor",
        content: contentBase64,
        sha: sha ? sha : undefined,
        branch: GITHUB_CONFIG.branch
      })
    });

    if (putRes.ok) {
      alert("Layout salvato con successo su GitHub!");
    } else {
      const errData = await putRes.json();
      alert(`Errore durante il salvataggio: ${errData.message}`);
      // Se il token non è valido (401), lo rimuoviamo da localStorage così lo ric chiederà la prossima volta
      if (putRes.status === 401) {
        localStorage.removeItem('gh_token');
      }
    }
  } catch (err) {
    console.error(err);
    alert("Si è verificato un errore di rete durante il salvataggio.");
  }
}

window.onload = init;






// ---------------------------------------------------------
// GESTIONE MODAL STATISTICHE
// ---------------------------------------------------------
// Variable globali per conservare i riferimenti ai grafici
let chartCategorieInstance = null;
let chartStanzeInstance = null;

// ---------------------------------------------------------
// APERTURA / CHIUSURA MODALE
// ---------------------------------------------------------
function apriModalStatistiche() {
  const modal = document.getElementById('statsModal');
  if (!modal) return;
  modal.classList.add('open');
  renderStatistiche();
}

function chiudiModalStatistiche(e) {
  const modal = document.getElementById('statsModal');
  if (modal) modal.classList.remove('open');
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') chiudiModalStatistiche();
});

// ---------------------------------------------------------
// LOGICA E RENDERING DELLE STATISTICHE
// ---------------------------------------------------------
function calcolaDatiStatistiche() {
  const perCategoria = {};
  const perStanza = {};

  appState.categorie.forEach(c => {
    perCategoria[c.nome] = { totale: 0, colore: c.colore };
  });

  appState.stanze.forEach(stanza => {
    let totStanza = 0;
    if (stanza && stanza.griglia) {
      const visitati = new Set();

      for (let r = 0; r < stanza.righe; r++) {
        for (let c = 0; c < stanza.colonne; c++) {
          const key = `${r}_${c}`;
          const cell = stanza.griglia[key];

          if (cell && cell.tipo === 'bacheca' && !visitati.has(key)) {
            const coda = [{ r, c }];
            visitati.add(key);
            const currentGruppoId = cell.gruppoId || null;
            const val = parseInt(cell.totaleGruppo) || 0;

            totStanza += val;

            if (!perCategoria[cell.categoria]) {
              perCategoria[cell.categoria] = { 
                totale: 0, 
                colore: getColoreCategoria(cell.categoria) 
              };
            }
            perCategoria[cell.categoria].totale += val;

            while (coda.length > 0) {
              const curr = coda.shift();
              const vicini = [
                { r: curr.r - 1, c: curr.c },
                { r: curr.r + 1, c: curr.c },
                { r: curr.r, c: curr.c - 1 },
                { r: curr.r, c: curr.c + 1 }
              ];

              vicini.forEach(v => {
                const vKey = `${v.r}_${v.c}`;
                const vCell = stanza.griglia[vKey];
                if (
                  vCell &&
                  vCell.tipo === 'bacheca' &&
                  vCell.categoria === cell.categoria &&
                  (vCell.gruppoId || null) === currentGruppoId &&
                  !visitati.has(vKey)
                ) {
                  visitati.add(vKey);
                  coda.push(v);
                }
              });
            }
          }
        }
      }
    }
    perStanza[stanza.nome] = totStanza;
  });

  return { perCategoria, perStanza };
}

function renderStatistiche() {
  const { perCategoria, perStanza } = calcolaDatiStatistiche();

  // Aggiorna i contatori testuali principali
  const totalDitali = Object.values(perStanza).reduce((a, b) => a + b, 0);
  document.getElementById('statTotalCount').textContent = totalDitali;
  document.getElementById('statRoomsCount').textContent = appState.stanze.length;

  // Distruggi le istanze precedenti per evitare sovrapposizioni al re-rendering
  if (chartCategorieInstance) chartCategorieInstance.destroy();
  if (chartStanzeInstance) chartStanzeInstance.destroy();

  // Registra il plugin dei data labels se disponibile
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  // ---------------------------------------------------------
  // 1. GRAFICO CATEGORIE (Donut)
  // ---------------------------------------------------------
  const catLabels = Object.keys(perCategoria);
  const catData = catLabels.map(l => perCategoria[l].totale);
  const catColors = catLabels.map(l => perCategoria[l].colore);

  const ctxCat = document.getElementById('chartCategorie').getContext('2d');
  chartCategorieInstance = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catData,
        backgroundColor: catColors,
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#f8fafc' }
        },
        datalabels: {
          display: false // Disabilitato sul Donut per evitare disordine visivo
        }
      }
    }
  });

  // ---------------------------------------------------------
  // 2. GRAFICO STANZE (Barre con colori unici e numeri al centro)
  // ---------------------------------------------------------
  const stanzaLabels = Object.keys(perStanza);
  const stanzaData = stanzaLabels.map(l => perStanza[l]);

  // Palette dinamica HSL per generare toni distinti per ogni stanza
  const coloriStanze = stanzaLabels.map((_, i) => {
    const hue = (i * 137.5) % 360;
    return `hsl(${hue}, 70%, 55%)`;
  });

  const ctxStanze = document.getElementById('chartStanze').getContext('2d');
  chartStanzeInstance = new Chart(ctxStanze, {
    type: 'bar',
    data: {
      labels: stanzaLabels,
      datasets: [{
        label: 'Ditali',
        data: stanzaData,
        backgroundColor: coloriStanze,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'center',
          align: 'center',
          color: '#ffffff',
          font: {
            weight: 'bold',
            size: 13
          },
          formatter: (value) => (value > 0 ? value : '')
        }
      }
    }
  });
}