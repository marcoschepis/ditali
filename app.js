let appState = {
  stanzaAttivaIdx: 0,
  categorie: [
    { nome: "Europa", colore: "#0284c7" },
    { nome: "Italia", colore: "#16a34a" },
    { nome: "Mondo", colore: "#d97706" }
  ],
  stanze: [
    {
      nome: "Soggiorno",
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

function init() {
  inizializzaStanzaAttiva();
  renderTabsStanze();
  renderCategorie();
  renderGriglia();
  setupDragSelection();

  window.addEventListener('resize', debounce(renderGriglia, 150));
}

function getStanzaCorrente() {
  return appState.stanze[appState.stanzaAttivaIdx];
}

function inizializzaStanzaAttiva() {
  const stanza = getStanzaCorrente();
  if (!stanza.griglia) stanza.griglia = {};
  for (let r = 0; r < stanza.righe; r++) {
    for (let c = 0; c < stanza.colonne; c++) {
      const key = `${r}_${c}`;
      if (!stanza.griglia[key]) stanza.griglia[key] = { tipo: 'vuoto' };
    }
  }
}

// Utility Debounce per non affaticare la CPU al resize
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
  document.getElementById('roomRows').value = stanza.righe;
  document.getElementById('roomCols').value = stanza.colonne;
}

function cambiaStanza(idx) {
  appState.stanzaAttivaIdx = idx;
  selezioni.clear();
  inizializzaStanzaAttiva();
  renderTabsStanze();
  aggiornaPannelloEditor();
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
// RENDER GRIGLIA ULTRA PERFORMANTE E ADATTIVA
// ---------------------------------------------------------
function renderGriglia() {
  const stanza = getStanzaCorrente();
  const container = document.getElementById('roomGrid');
  
  // Imposta layout fluido
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
      tile.className = 'tile' + (selezioni.has(key) ? ' selected' : '');
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
}

function calcolaUnioneEBordi(tile, r, c, cell, stanza) {
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
    const wColor = 'var(--wood-frame)';

    tile.style.borderTop = hasTop ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderRight = hasRight ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderBottom = hasBottom ? 'none' : `${wWidth} solid ${wColor}`;
    tile.style.borderLeft = hasLeft ? 'none' : `${wWidth} solid ${wColor}`;
  }
}

// ---------------------------------------------------------
// NUOVA SELEZIONE RETTANGOLARE DINAMICA (CORRETTO RETRO-SELEZIONE)
// ---------------------------------------------------------
function setupDragSelection() {
  const grid = document.getElementById('roomGrid');

  grid.addEventListener('pointerdown', (e) => {
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
    
    // Trova la cella sotto il puntatore corrente anche se ci si sposta velocemente
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

  // Calcola esattamente quali celle devono essere selezionate ora
  const coordinateCorrenti = new Set();
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      coordinateCorrenti.add(`${r}_${c}`);
    }
  }

  // Aggiorna le classi CSS direttamente sugli elementi senza re-renderizzare l'intera griglia
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
      stanza.griglia[key] = { 
        tipo: 'bacheca', 
        categoria: catBacheca
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
// EXPORT / IMPORT JSON COMPLETO
// ---------------------------------------------------------
function esportaJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'layout_bacheche.json';
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

window.onload = init;