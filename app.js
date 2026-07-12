'use strict';

const API_BASE = 'https://audio.wabble.ca';

const PERSON_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

const state = {
  imageBase64: null,
  mediaType: 'image/jpeg',
  receipt: { items: [], subtotal: 0, tax: 0, tip: 0, total: 0 },
  people: [],
  assignments: {},   // itemId (number) -> Set of personIds
  _nextPersonId: 0,
  _nextItemId: 0,
};

function newItemId() { return state._nextItemId++; }
function newPersonId() { return state._nextPersonId++; }

// ── Utilities ─────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n) { return parseFloat(n || 0).toFixed(2); }

// ── Screens ───────────────────────────────────────────────────────

const SCREENS = ['upload', 'items', 'people', 'assign', 'summary'];

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.progress-step').forEach((step, i) => {
    const idx = SCREENS.indexOf(id);
    step.classList.toggle('done', i < idx);
    step.classList.toggle('active', i === idx);
  });
  window.scrollTo(0, 0);
}

// ── Loading overlay ───────────────────────────────────────────────

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

// ── Upload ────────────────────────────────────────────────────────

function initUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) return;
  state.mediaType = file.type;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    state.imageBase64 = dataUrl.split(',')[1];
    const preview = document.getElementById('preview');
    preview.src = dataUrl;
    preview.style.display = 'block';
    document.getElementById('dropzone-placeholder').style.display = 'none';
    document.getElementById('scan-btn').disabled = false;
  };
  reader.readAsDataURL(file);
}

async function scanReceipt() {
  if (!state.imageBase64) return;
  showLoading(true);
  try {
    const res = await fetch(`${API_BASE}/receipt/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: state.imageBase64, media_type: state.mediaType }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }
    const data = await res.json();
    state.receipt = {
      items: (data.items || []).map(item => ({
        id: newItemId(),
        name: item.name || 'Unknown item',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
      })),
      subtotal: data.subtotal || 0,
      tax: data.tax || 0,
      tip: data.tip || 0,
      total: data.total || 0,
    };
    state.assignments = {};
    state.receipt.items.forEach(item => { state.assignments[item.id] = new Set(); });
    renderItemsScreen();
    showScreen('items');
  } catch (err) {
    alert('Failed to scan receipt.\n\n' + err.message);
  } finally {
    showLoading(false);
  }
}

// ── Items screen ──────────────────────────────────────────────────

function renderItemsScreen() {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  state.receipt.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    tr.innerHTML =
      `<td><input class="item-name" type="text" value="${esc(item.name)}" data-f="name"></td>` +
      `<td><input class="item-qty"  type="number" value="${item.quantity}" min="0.5" step="0.5" data-f="quantity"></td>` +
      `<td><input class="item-price" type="number" value="${fmt(item.total_price)}" min="0" step="0.01" data-f="total_price"></td>` +
      `<td><button class="btn-icon" onclick="removeItem(${item.id})">✕</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('change', syncItemFromRow));

  document.getElementById('receipt-subtotal').value = fmt(state.receipt.subtotal);
  document.getElementById('receipt-tax').value      = fmt(state.receipt.tax);
  document.getElementById('receipt-tip').value      = fmt(state.receipt.tip);
}

function syncItemFromRow(e) {
  const inp  = e.target;
  const id   = parseInt(inp.closest('tr').dataset.id, 10);
  const item = state.receipt.items.find(i => i.id === id);
  if (!item) return;
  const f = inp.dataset.f;
  if (f === 'name') item.name = inp.value;
  else if (f === 'quantity') item.quantity = parseFloat(inp.value) || 1;
  else if (f === 'total_price') item.total_price = parseFloat(inp.value) || 0;
}

function removeItem(id) {
  state.receipt.items = state.receipt.items.filter(i => i.id !== id);
  delete state.assignments[id];
  renderItemsScreen();
}

function addItem() {
  const item = { id: newItemId(), name: 'New item', quantity: 1, unit_price: 0, total_price: 0 };
  state.receipt.items.push(item);
  state.assignments[item.id] = new Set();
  renderItemsScreen();
  const inputs = document.querySelectorAll('#items-tbody .item-name');
  if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
}

function saveReceiptMeta() {
  state.receipt.subtotal = parseFloat(document.getElementById('receipt-subtotal').value) || 0;
  state.receipt.tax      = parseFloat(document.getElementById('receipt-tax').value)      || 0;
  state.receipt.tip      = parseFloat(document.getElementById('receipt-tip').value)      || 0;
}

// ── People screen ─────────────────────────────────────────────────

function renderPeopleScreen() {
  const container = document.getElementById('people-chips');
  container.innerHTML = '';
  state.people.forEach(person => {
    const chip = document.createElement('div');
    chip.className = 'person-chip';
    chip.style.background = person.color;
    chip.innerHTML = `<span>${esc(person.name)}</span><button onclick="removePerson(${person.id})">✕</button>`;
    container.appendChild(chip);
  });
}

function addPerson() {
  const input = document.getElementById('person-input');
  const name = input.value.trim();
  if (!name) return;
  if (state.people.length >= 8) { alert('Max 8 people'); return; }
  state.people.push({ id: newPersonId(), name, color: PERSON_COLORS[state.people.length] });
  input.value = '';
  renderPeopleScreen();
  input.focus();
}

function removePerson(id) {
  state.people = state.people.filter(p => p.id !== id);
  // Reassign colors to keep palette ordered
  state.people.forEach((p, i) => { p.color = PERSON_COLORS[i]; });
  Object.values(state.assignments).forEach(set => set.delete(id));
  renderPeopleScreen();
}

// ── Assign screen ─────────────────────────────────────────────────

function renderAssignScreen() {
  const container = document.getElementById('assign-items');
  container.innerHTML = '';

  state.receipt.items.forEach(item => {
    const assigned = state.assignments[item.id] || new Set();
    const splitLabel = assigned.size > 1 ? ` ÷${assigned.size}` : '';

    const div = document.createElement('div');
    div.className = 'assign-item';
    div.id = `ai-${item.id}`;
    div.innerHTML =
      `<div class="assign-item-header">` +
        `<span class="assign-item-name">${esc(item.name)}</span>` +
        `<span class="assign-item-price" id="aip-${item.id}">$${fmt(item.total_price)}${splitLabel}</span>` +
      `</div>` +
      `<div class="assign-person-chips" id="apc-${item.id}"></div>`;

    container.appendChild(div);

    const chipsDiv = document.getElementById(`apc-${item.id}`);
    state.people.forEach(person => {
      const isAssigned = assigned.has(person.id);
      const btn = document.createElement('button');
      btn.className = 'assign-chip' + (isAssigned ? ' assigned' : '');
      if (isAssigned) btn.style.background = person.color;
      btn.textContent = person.name;
      btn.addEventListener('click', () => toggleAssignment(item.id, person.id, btn));
      chipsDiv.appendChild(btn);
    });
  });

  updateLiveTotals();
}

function toggleAssignment(itemId, personId, btn) {
  const set    = state.assignments[itemId];
  const person = state.people.find(p => p.id === personId);
  if (!person) return;

  if (set.has(personId)) {
    set.delete(personId);
    btn.classList.remove('assigned');
    btn.style.background = '';
  } else {
    set.add(personId);
    btn.classList.add('assigned');
    btn.style.background = person.color;
  }

  const item = state.receipt.items.find(i => i.id === itemId);
  const priceEl = document.getElementById(`aip-${itemId}`);
  if (item && priceEl) {
    const splitLabel = set.size > 1 ? ` ÷${set.size}` : '';
    priceEl.textContent = `$${fmt(item.total_price)}${splitLabel}`;
  }

  updateLiveTotals();
}

function assignAll() {
  const allIds = new Set(state.people.map(p => p.id));
  state.receipt.items.forEach(item => { state.assignments[item.id] = new Set(allIds); });
  renderAssignScreen();
}

function updateLiveTotals() {
  const totals = {};
  state.people.forEach(p => { totals[p.id] = 0; });

  state.receipt.items.forEach(item => {
    const set = state.assignments[item.id];
    if (!set || set.size === 0) return;
    const share = item.total_price / set.size;
    set.forEach(pid => { totals[pid] = (totals[pid] || 0) + share; });
  });

  const footer = document.getElementById('assign-totals');
  footer.innerHTML = '';
  state.people.forEach(person => {
    const div = document.createElement('div');
    div.className = 'assign-total-chip';
    div.style.borderColor = person.color;
    div.innerHTML = `<span>${esc(person.name)}</span><strong>$${fmt(totals[person.id])}</strong>`;
    footer.appendChild(div);
  });
}

// ── Summary screen ────────────────────────────────────────────────

function renderSummary() {
  const personSubtotals = {};
  const personItems     = {};
  state.people.forEach(p => { personSubtotals[p.id] = 0; personItems[p.id] = []; });

  state.receipt.items.forEach(item => {
    const set = state.assignments[item.id];
    if (!set || set.size === 0) return;
    const share = item.total_price / set.size;
    set.forEach(pid => {
      personSubtotals[pid] += share;
      personItems[pid].push({ name: item.name, share });
    });
  });

  const grandSubtotal = Object.values(personSubtotals).reduce((a, b) => a + b, 0);
  const extras        = state.receipt.tax + state.receipt.tip;

  const container = document.getElementById('summary-cards');
  container.innerHTML = '';
  let copyText = '🧾 Receipt Split\n\n';

  state.people.forEach(person => {
    const sub       = personSubtotals[person.id] || 0;
    const prop      = grandSubtotal > 0 ? sub / grandSubtotal : 1 / state.people.length;
    const extraShare = extras * prop;
    const grand     = sub + extraShare;

    const rowsHtml = personItems[person.id]
      .map(({ name, share }) =>
        `<div class="summary-line"><span>${esc(name)}</span><span>$${fmt(share)}</span></div>`)
      .join('');

    const extraHtml = extraShare > 0
      ? `<div class="summary-line secondary"><span>Tax & tip</span><span>$${fmt(extraShare)}</span></div>`
      : '';

    const card = document.createElement('div');
    card.className = 'summary-card';
    card.style.borderColor = person.color;
    card.innerHTML =
      `<div class="summary-card-header" style="background:${person.color}">` +
        `<span>${esc(person.name)}</span><strong>$${fmt(grand)}</strong>` +
      `</div>` +
      `<div class="summary-card-body">${rowsHtml}${extraHtml}</div>`;
    container.appendChild(card);

    copyText += `${person.name}: $${fmt(grand)}\n`;
    personItems[person.id].forEach(({ name, share }) => { copyText += `  ${name}: $${fmt(share)}\n`; });
    if (extraShare > 0) copyText += `  Tax & tip: $${fmt(extraShare)}\n`;
    copyText += '\n';
  });

  document.getElementById('summary-text').dataset.text = copyText.trim();
}

async function copySummary() {
  const text = document.getElementById('summary-text').dataset.text || '';
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch {
    alert('Could not access clipboard');
  }
}

function restart() {
  state.imageBase64 = null;
  state.receipt     = { items: [], subtotal: 0, tax: 0, tip: 0, total: 0 };
  state.people      = [];
  state.assignments = {};
  state._nextPersonId = 0;
  state._nextItemId   = 0;

  const fileInput = document.getElementById('file-input');
  fileInput.value = '';
  document.getElementById('preview').style.display = 'none';
  document.getElementById('dropzone-placeholder').style.display = 'flex';
  document.getElementById('scan-btn').disabled = true;
  showScreen('upload');
}

// ── Wire up ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initUpload();

  document.getElementById('scan-btn').addEventListener('click', scanReceipt);
  document.getElementById('add-item-btn').addEventListener('click', addItem);

  document.getElementById('items-next-btn').addEventListener('click', () => {
    saveReceiptMeta();
    renderPeopleScreen();
    showScreen('people');
  });

  document.getElementById('person-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addPerson(); }
  });
  document.getElementById('add-person-btn').addEventListener('click', addPerson);

  document.getElementById('people-next-btn').addEventListener('click', () => {
    if (state.people.length === 0) { alert('Add at least one person first'); return; }
    state.receipt.items.forEach(item => {
      if (!state.assignments[item.id]) state.assignments[item.id] = new Set();
    });
    renderAssignScreen();
    showScreen('assign');
  });

  document.getElementById('assign-all-btn').addEventListener('click', assignAll);

  document.getElementById('assign-next-btn').addEventListener('click', () => {
    renderSummary();
    showScreen('summary');
  });

  document.getElementById('copy-btn').addEventListener('click', copySummary);
  document.getElementById('restart-btn').addEventListener('click', restart);
});

// Expose functions called inline from HTML (onclick attributes)
window.removeItem   = removeItem;
window.removePerson = removePerson;
