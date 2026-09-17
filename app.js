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

// ---------------------------------------------------------
// INIZIALIZZAZIONE & CARICAMENTO JSON AUTOMATICO
// ---------------------------------------------------------
// Stato per tracciare se siamo in visualizzazione o modifica
let isViewMode = true;

async function init() {
  await caricaLayoutDaRepo();
  
  // Applica lo stato visivo iniziale
  aggiornaInterfacciaModalita();

  renderGriglia();
  window.addEventListener('resize', debounce(renderGriglia, 150));
}

// Funzione per alternare la modalità dal tasto
function toggleModalita() {
  isViewMode = !isViewMode;
  selezioni.clear(); // Puliamo eventuali selezioni
  
  aggiornaInterfacciaModalita();
  renderGriglia();
}

function aggiornaInterfacciaModalita() {
  const btn = document.getElementById('btnToggleMode');
  
  if (isViewMode) {
    document.body.classList.add('view-only-mode');
    if (btn) btn.innerHTML = '✏️ Passa a Modifica';
  } else {
    document.body.classList.remove('view-only-mode');
    if (btn) btn.innerHTML = '👁️ Passa a Visualizzazione';
    
    // Inizializza i controlli dell'editor quando si passa a modifica
    renderTabsStanze();
    renderCategorie();
    setupDragSelection();
  }
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
    console.log("Nessun file bacheca.json trovato o errore nel caricamento. Uso lo stato predefinito.", err);
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

function isModalitaVisualizzazione() {
  const urlParams = new URLSearchParams(window.location.search);
  return !(urlParams.get('mode') === 'modifica');
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ---------------------------------------------------------
// GESTIONE MULTI-STANZA
// ---------------------------------------------------------
function renderTabsStanze() {
  const container = document.getElementById('roomsTabs');
  if (!container) return;
  container.innerHTML = '';

  appState.stanze.forEach((stanza, idx) => {
    const tab = document.createElement('div');
    tab.className = `tab-room ${idx === appState.stanzaAttivaIdx ? 'active' : ''}`;
    tab.innerHTML = `
      <span onclick="cambiaStanza(${idx})">${stanza.nome}</span>
      ${appState.stanze.length > 1 ? `<span class="del-room" onclick="eliminaStanza(${idx})">✕</span>` : ''}
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
}

function cambiaStanza(idx) {
  appState.stanzaAttivaIdx = idx;
  selezioni.clear();
  inizializzaStanzaAttiva();
  if (!isModalitaVisualizzazione()) {
    renderTabsStanze();
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

// ---------------------------------------------------------
// CATEGORIE
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
// RENDER GRIGLIA
// ---------------------------------------------------------
function renderGriglia() {
  const stanza = getStanzaCorrente();
  const container = document.getElementById('roomGrid');
  if (!container || !stanza) return;

  container.style.gridTemplateRows = `repeat(${stanza.righe}, 1fr)`;
  container.style.gridTemplateColumns = `repeat(${stanza.colonne}, 1fr)`;
  container.innerHTML = '';
  tileElements = [];

  const totaliBacheche = calcolaTotaliBachecheUnite(stanza);
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

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'tile-input';
        input.value = cell.valore !== undefined ? cell.valore : '';

        if (isViewMode) {
          input.readOnly = true;
          input.style.cursor = 'default';
        } else {
          input.addEventListener('input', (e) => {
            stanza.griglia[key].valore = e.target.value;
            aggiornaTotaleBachecheSilent(stanza);
          });

          const gestisciSelezioneCella = (e) => {
            e.stopPropagation();
            if (!e.shiftKey && !e.ctrlKey) {
              selezioni.clear();
              tileElements.forEach(t => t.classList.remove('selected'));
            }
            selezioni.add(key);
            tile.classList.add('selected');
            aggiornaPannelloEditor();
          };

          input.addEventListener('focus', gestisciSelezioneCella);
          input.addEventListener('pointerdown', gestisciSelezioneCella);
          input.addEventListener('mousedown', gestisciSelezioneCella);
        }

        tile.appendChild(input);
      } else {
        tile.style.backgroundColor = '#1e293b';
      }

      calcolaUnioneEBordi(tile, r, c, cell, stanza, totaliBacheche);

      fragment.appendChild(tile);
      tileElements.push(tile);
    }
  }

  container.appendChild(fragment);
}

// ---------------------------------------------------------
// CALCOLO TOTALI E UNIONE BACHECHE
// ---------------------------------------------------------
function calcolaTotaliBachecheUnite(stanza) {
  const visitati = new Set();
  const totaliBacheche = {};

  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      const cell = stanza.griglia[key];

      if (cell && cell.tipo === 'bacheca' && !visitati.has(key)) {
        const coda = [{ r, c }];
        const gruppo = [];
        let sommaTotale = 0;
        visitati.add(key);

        while (coda.length > 0) {
          const curr = coda.shift();
          const currKey = `${curr.r}_${curr.c}`;
          const currCell = stanza.griglia[currKey];

          gruppo.push(curr);

          const val = parseInt(currCell.valore);
          if (!isNaN(val)) {
            sommaTotale += val;
          }

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
              !visitati.has(vKey)
            ) {
              visitati.add(vKey);
              coda.push(v);
            }
          });
        }

        gruppo.sort((a, b) => (a.r === b.r ? a.c - b.c : a.r - b.r));
        const topLeftKey = `${gruppo[0].r}_${gruppo[0].c}`;

        totaliBacheche[topLeftKey] = sommaTotale;
      }
    }
  }

  return totaliBacheche;
}

function aggiornaTotaleBachecheSilent(stanza) {
  const totali = calcolaTotaliBachecheUnite(stanza);

  document.querySelectorAll('.bacheca-total-badge').forEach(el => el.remove());

  Object.keys(totali).forEach(key => {
    const tile = document.querySelector(`.tile[data-key="${key}"]`);
    if (tile && totali[key] > 0) {
      const badge = document.createElement('div');
      badge.className = 'bacheca-total-badge';
      badge.innerText = `Tot: ${totali[key]}`;
      tile.appendChild(badge);
    }
  });
}

function calcolaUnioneEBordi(tile, r, c, cell, stanza, totaliBacheche) {
  if (cell.tipo === 'vuoto') return;

  const top = stanza.griglia[`${r-1}_${c}`];
  const right = stanza.griglia[`${r}_${c+1}`];
  const bottom = stanza.griglia[`${r+1}_${c}`];
  const left = stanza.griglia[`${r}_${c-1}`];

  const StessoGruppo = (other) => {
    if (!other) return false;
    if (cell.tipo === 'muro') return other.tipo === 'muro' && other.colore === cell.colore;
    if (cell.tipo === 'bacheca') return other.tipo === 'bacheca' && other.categoria === cell.categoria;
    return false;
  };

  const hasTop = StessoGruppo(top);
  const hasRight = StessoGruppo(right);
  const hasBottom = StessoGruppo(bottom);
  const hasLeft = StessoGruppo(left);

  if (cell.tipo === 'muro') {
    tile.style.borderTop = hasTop ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderRight = hasRight ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderBottom = hasBottom ? 'none' : '1px solid rgba(0,0,0,0.4)';
    tile.style.borderLeft = hasLeft ? 'none' : '1px solid rgba(0,0,0,0.4)';
  } else if (cell.tipo === 'bacheca') {
    const wWidth = '3px';
    const wColor = 'var(--wood-frame, #8b5a2b)';

    tile.style.borderTop = hasTop ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderRight = hasRight ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderBottom = hasBottom ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderLeft = hasLeft ? 'none' : `${wWidth} solid ${wColor}`;

    const key = `${r}_${c}`;
    if (totaliBacheche && totaliBacheche[key] !== undefined && totaliBacheche[key] > 0) {
      const badge = document.createElement('div');
      badge.className = 'bacheca-total-badge';
      badge.innerText = `Tot: ${totaliBacheche[key]}`;
      tile.appendChild(badge);
    }
  }
}

// ---------------------------------------------------------
// SELEZIONE RETTANGOLARE
// ---------------------------------------------------------
function setupDragSelection() {
  const grid = document.getElementById('roomGrid');
  if (!grid) return;

  grid.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'INPUT') return;

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
    if (!isMouseDown) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const tile = target ? target.closest('.tile') : null;

    if (tile) {
      const currentCoords = { r: parseInt(tile.dataset.r), c: parseInt(tile.dataset.c) };
      aggiornaSelezioneRettangolo(dragStartCoords, currentCoords);
    }
  });

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

// ---------------------------------------------------------
// APPLICAZIONE MODIFICHE
// ---------------------------------------------------------
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

  selezioni.forEach(key => {
    if (tipo === 'vuoto') {
      stanza.griglia[key] = { tipo: 'vuoto' };
    } else if (tipo === 'muro') {
      stanza.griglia[key] = { tipo: 'muro', colore: coloreMuro };
    } else if (tipo === 'bacheca') {
      const vecchioValore = stanza.griglia[key]?.valore || '';
      stanza.griglia[key] = {
        tipo: 'bacheca',
        categoria: catBacheca,
        valore: vecchioValore
      };
    }
  });

  renderGriglia();
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
// EXPORT / IMPORT JSON
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


// ---------------------------------------------------------
// SAVE TO GITHUB
// ---------------------------------------------------------
// Configurazione per le API di GitHub
const GITHUB_CONFIG = {
  owner: "marcoschepis",
  repo: "ditali",
  path: "bacheca.json",
  branch: "main"
};

async function salvaSuGitHub() {
  // Chiede il Personal Access Token di GitHub se non è già salvato in sessione
  let token = sessionStorage.getItem('gh_token');
  if (!token) {
    token = prompt("Inserisci il tuo Personal Access Token (PAT) di GitHub:");
    if (!token) return;
    sessionStorage.setItem('gh_token', token);
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

  try {
    // 1. Recupera lo SHA del file esistente (obbligatorio per sovrascriverlo tramite API)
    let sha = "";
    const getRes = await fetch(url, {
      headers: { "Authorization": `token ${token}` }
    });
    
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Prepara il contenuto JSON codificato in Base64
    const jsonContent = JSON.stringify(appState, null, 2);
    // encodeURIComponent + unescape serve per gestire correttamente i caratteri UTF-8/emoji
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonContent)));

    // 3. Invia la richiesta di aggiornamento/commit
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
      alert(" Layout salvato con successo su GitHub!");
    } else {
      const errData = await putRes.json();
      alert(` Errore durante il salvataggio: ${errData.message}`);
      if (putRes.status === 401) sessionStorage.removeItem('gh_token'); // Token errato o scaduto
    }
  } catch (err) {
    console.error(err);
    alert(" Si è verificato un errore di rete durante il salvataggio.");
  }
}

window.onload = init;