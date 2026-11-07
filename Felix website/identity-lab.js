(() => {
  'use strict';

  const CATEGORIES = Object.freeze([
    ['family-partner', 'Family/Partner'], ['outdoors', 'Outdoors'], ['work', 'Work'],
    ['jokes-memes', 'Jokes/Memes'], ['product-advertising', 'Product/Advertising'],
    ['politics-news', 'Politics/News'], ['music-sport-film', 'Music/Sport/Film'],
    ['animals', 'Animals'], ['friends', 'Friends'], ['local-events', 'Local Events'],
    ['thoughts-reflections', 'Thoughts/Reflections'], ['activism', 'Activism'], ['lifestyle', 'Lifestyle'],
  ]);
  const CATEGORY_CODES = new Set(CATEGORIES.map(([code]) => code));
  const LABELS = Object.fromEntries(CATEGORIES);
  const HEADERS = ['person_id', 'post_id', 'category', 'notes'];
  const PEOPLE = Array.from({ length: 32 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`);
  const POSTS = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0'));
  const FORMULA = /^[\s\u0000-\u001f]*[=+\-@]/;
  const keyOf = (person, post) => `${person}:${post}`;

  function blankRecords() {
    return PEOPLE.flatMap((person_id) => POSTS.map((post_id) => ({ person_id, post_id, category: '', notes: '' })));
  }

  function parseCSV(text) {
    if (typeof text !== 'string') throw new Error('Choose a CSV text file.');
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], cell = '', quoted = false, closed = false;
    const finishCell = () => { row.push(cell); cell = ''; closed = false; };
    const finishRow = () => { finishCell(); rows.push(row); row = []; };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (char === '"') { quoted = false; closed = true; }
        else cell += char;
      } else if (char === '"') {
        if (cell || closed) throw new Error('A quote appears outside a quoted CSV field.');
        quoted = true;
      } else if (char === ',') finishCell();
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        finishRow();
      } else {
        if (closed) throw new Error('Unexpected text after a closing CSV quote.');
        cell += char;
      }
    }
    if (quoted) throw new Error('A quoted CSV field was not closed.');
    if (cell || row.length || closed) finishRow();
    while (rows.length && rows[rows.length - 1].every((value) => value === '')) rows.pop();
    return rows;
  }

  function validateCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The CSV is empty. Start with the blank template.');
    const header = rows.shift();
    if (new Set(header).size !== header.length) throw new Error('The CSV header contains a repeated column.');
    if (header.length !== HEADERS.length || header.some((value, i) => value !== HEADERS[i])) {
      throw new Error('Use the template columns in order: person_id, post_id, category, notes.');
    }
    if (!rows.length) throw new Error('The CSV has no post rows.');
    if (rows.length > 480) throw new Error('The CSV contains more than 480 post rows.');
    const seen = new Set();
    const imported = [];
    rows.forEach((values, index) => {
      const line = index + 2;
      if (values.length !== 4) throw new Error(`CSV row ${line} needs exactly four fields.`);
      if (values.some((value) => FORMULA.test(value))) throw new Error(`CSV row ${line} contains a formula-like value. Use plain text only.`);
      const [person_id, post_id, category, notes] = values;
      if (!PEOPLE.includes(person_id)) throw new Error(`CSV row ${line} needs a person ID from P01 to P32.`);
      if (!POSTS.includes(post_id)) throw new Error(`CSV row ${line} needs a post ID from 01 to 15.`);
      if (category && !CATEGORY_CODES.has(category)) throw new Error(`CSV row ${line} has an unknown category. Use a code from the category key.`);
      if (notes.length > 500) throw new Error(`CSV row ${line} has a note longer than 500 characters.`);
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(notes)) throw new Error(`CSV row ${line} contains unsupported control characters.`);
      const key = keyOf(person_id, post_id);
      if (seen.has(key)) throw new Error(`CSV row ${line} repeats a person/post pair.`);
      seen.add(key);
      imported.push({ person_id, post_id, category, notes });
    });
    const replacement = new Map(blankRecords().map((row) => [keyOf(row.person_id, row.post_id), row]));
    imported.forEach((row) => replacement.set(keyOf(row.person_id, row.post_id), row));
    return [...replacement.values()];
  }

  function csvCell(value) {
    value = String(value);
    if (FORMULA.test(value)) value = `'${value}`;
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  function exportCSV(records) {
    return [HEADERS.join(','), ...records.map((row) => HEADERS.map((field) => csvCell(row[field])).join(','))].join('\r\n') + '\r\n';
  }

  function summarise(records) {
    return PEOPLE.map((person_id) => {
      const counts = Object.fromEntries(CATEGORIES.map(([code]) => [code, 0]));
      let completed = 0;
      records.filter((row) => row.person_id === person_id).forEach((row) => {
        if (CATEGORY_CODES.has(row.category)) { counts[row.category] += 1; completed += 1; }
      });
      return { person_id, completed, counts };
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATEGORIES, HEADERS, blankRecords, parseCSV, validateCSV, exportCSV, summarise };
  }
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let records = blankRecords();
  let selectedPerson = PEOPLE[0];
  let dirty = false;

  function setStatus(text, isError = false) {
    $('import-status').textContent = text;
    $('import-status').classList.toggle('is-error', isError);
  }

  function addCategoryOptions(select, allowBlank) {
    if (allowBlank) {
      const blank = make('option', 'Choose a category'); blank.value = ''; select.append(blank);
    }
    CATEGORIES.forEach(([code, label]) => { const option = make('option', label); option.value = code; select.append(option); });
  }

  function download(name, content) {
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
    const link = make('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderEditor() {
    $('person-select').value = selectedPerson;
    $('person-title').textContent = `${selectedPerson} · 15 posts`;
    $('previous-person').disabled = selectedPerson === PEOPLE[0];
    $('next-person').disabled = selectedPerson === PEOPLE[PEOPLE.length - 1];
    const list = $('post-editor'); list.replaceChildren();
    records.filter((row) => row.person_id === selectedPerson).forEach((record) => {
      const item = make('li', undefined, 'lab-post-row');
      item.append(make('span', `Post ${record.post_id}`, 'lab-post-number'));
      const categoryField = make('div', undefined, 'lab-field');
      const categoryLabel = make('label', 'Category');
      const select = make('select'); select.id = `category-${selectedPerson}-${record.post_id}`; categoryLabel.htmlFor = select.id;
      select.setAttribute('aria-label', `Category for ${selectedPerson} post ${record.post_id}`);
      addCategoryOptions(select, true); select.value = record.category;
      select.addEventListener('change', () => { record.category = select.value; dirty = true; renderSummary(); });
      categoryField.append(categoryLabel, select);
      const noteField = make('div', undefined, 'lab-field');
      const noteLabel = make('label', 'Optional note');
      const note = make('textarea'); note.id = `note-${selectedPerson}-${record.post_id}`; noteLabel.htmlFor = note.id;
      note.setAttribute('aria-label', `Optional note for ${selectedPerson} post ${record.post_id}`);
      note.rows = 2; note.maxLength = 500; note.value = record.notes;
      note.addEventListener('input', () => { record.notes = note.value; dirty = true; });
      noteField.append(noteLabel, note); item.append(categoryField, noteField); list.append(item);
    });
  }

  function renderMatrix(summary) {
    const head = make('tr');
    ['Person', 'Classified', ...CATEGORIES.map(([, label]) => label)].forEach((label) => { const th = make('th', label); th.scope = 'col'; head.append(th); });
    $('count-matrix').querySelector('thead').replaceChildren(head);
    const body = $('count-matrix').querySelector('tbody'); body.replaceChildren();
    summary.forEach((person) => {
      const row = make('tr'); row.classList.toggle('is-complete', person.completed === 15);
      const personCell = make('th', person.person_id); personCell.scope = 'row'; row.append(personCell, make('td', `${person.completed}/15`));
      CATEGORIES.forEach(([code]) => row.append(make('td', person.completed ? String(person.counts[code]) : '—')));
      body.append(row);
    });
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPlot(summary) {
    const xCode = $('x-category').value, yCode = $('y-category').value;
    const complete = summary.filter((person) => person.completed === 15);
    const svg = $('scatter-plot'); svg.replaceChildren();
    const xLabel = LABELS[xCode], yLabel = LABELS[yCode];
    svg.append(svgNode('title', { id: 'plot-title' }, `${xLabel} and ${yLabel} post counts`));
    svg.append(svgNode('desc', { id: 'plot-description' }, `${complete.length} complete anonymous people, each with 15 classified posts. Axes range from zero to fifteen. Overlapping people share one bubble; exact coordinates are in the following table.`));
    const left = 76, top = 30, width = 626, height = 380;
    const xAt = (value) => left + value / 15 * width, yAt = (value) => top + height - value / 15 * height;
    [0, 3, 6, 9, 12, 15].forEach((value) => {
      svg.append(svgNode('line', { x1: xAt(value), x2: xAt(value), y1: top, y2: top + height, stroke: '#e1e5db', 'stroke-width': 1 }));
      svg.append(svgNode('line', { x1: left, x2: left + width, y1: yAt(value), y2: yAt(value), stroke: '#e1e5db', 'stroke-width': 1 }));
      svg.append(svgNode('text', { x: xAt(value), y: top + height + 24, 'text-anchor': 'middle', fill: '#526157', 'font-size': 13 }, value));
      svg.append(svgNode('text', { x: left - 14, y: yAt(value) + 4, 'text-anchor': 'end', fill: '#526157', 'font-size': 13 }, value));
    });
    svg.append(svgNode('line', { x1: left, x2: left + width, y1: top + height, y2: top + height, stroke: '#6a796d' }));
    svg.append(svgNode('line', { x1: left, x2: left, y1: top, y2: top + height, stroke: '#6a796d' }));
    svg.append(svgNode('text', { x: left + width / 2, y: 474, 'text-anchor': 'middle', fill: '#34473e', 'font-size': 15 }, `${xLabel} posts`));
    svg.append(svgNode('text', { x: 20, y: top + height / 2, transform: `rotate(-90 20 ${top + height / 2})`, 'text-anchor': 'middle', fill: '#34473e', 'font-size': 15 }, `${yLabel} posts`));
    const clusters = new Map();
    complete.forEach((person) => {
      const x = person.counts[xCode], y = person.counts[yCode], key = `${x},${y}`;
      if (!clusters.has(key)) clusters.set(key, { x, y, people: [] });
      clusters.get(key).people.push(person.person_id);
    });
    clusters.forEach(({ x, y, people }) => {
      const group = svgNode('g', { tabindex: '0', role: 'img', 'aria-label': `${people.join(', ')}: ${xLabel} ${x}, ${yLabel} ${y}` });
      group.append(svgNode('title', {}, `${people.join(', ')} · (${x}, ${y})`));
      group.append(svgNode('circle', { cx: xAt(x), cy: yAt(y), r: people.length > 1 ? Math.min(19, 8 + Math.sqrt(people.length) * 2) : 7, fill: '#a5523f', stroke: '#fffdf8', 'stroke-width': 2 }));
      if (people.length > 1) group.append(svgNode('text', { x: xAt(x), y: yAt(y) + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 600 }, people.length));
      svg.append(group);
    });
    const suffix = xCode === yCode ? ' Both axes show the same category, so the points lie on a diagonal.' : '';
    $('plot-status').textContent = complete.length ? `${complete.length} of 32 people are ready to plot.${suffix}` : 'No complete people to plot yet. Classify all 15 posts for a person to add their point.';
    const table = $('plot-table'), header = make('tr');
    ['Person', `${xLabel} posts`, `${yLabel} posts`].forEach((label) => { const th = make('th', label); th.scope = 'col'; header.append(th); });
    table.querySelector('thead').replaceChildren(header);
    const body = table.querySelector('tbody'); body.replaceChildren();
    complete.forEach((person) => {
      const row = make('tr'), th = make('th', person.person_id); th.scope = 'row';
      row.append(th, make('td', person.counts[xCode]), make('td', person.counts[yCode])); body.append(row);
    });
    if (!complete.length) { const row = make('tr'), td = make('td', 'No complete records yet.'); td.colSpan = 3; row.append(td); body.append(row); }
  }

  function renderSummary() {
    const summary = summarise(records);
    $('total-coded').textContent = summary.reduce((sum, person) => sum + person.completed, 0);
    $('people-complete').textContent = summary.filter((person) => person.completed === 15).length;
    $('person-progress').textContent = `${summary.find((person) => person.person_id === selectedPerson).completed} / 15 classified`;
    renderMatrix(summary); renderPlot(summary);
  }

  function changePerson(person) { selectedPerson = person; renderEditor(); renderSummary(); }
  PEOPLE.forEach((person) => { const option = make('option', person); option.value = person; $('person-select').append(option); });
  $('person-select').addEventListener('change', (event) => changePerson(event.target.value));
  $('previous-person').addEventListener('click', () => changePerson(PEOPLE[Math.max(0, PEOPLE.indexOf(selectedPerson) - 1)]));
  $('next-person').addEventListener('click', () => changePerson(PEOPLE[Math.min(31, PEOPLE.indexOf(selectedPerson) + 1)]));
  CATEGORIES.forEach(([code, label]) => { const li = make('li'); li.append(document.createTextNode(`${label} — `), make('code', code)); $('category-key').append(li); });
  addCategoryOptions($('x-category'), false); addCategoryOptions($('y-category'), false);
  $('x-category').value = 'lifestyle'; $('y-category').value = 'outdoors';
  ['x-category', 'y-category'].forEach((id) => $(id).addEventListener('change', () => renderPlot(summarise(records))));
  $('download-template').addEventListener('click', () => download('anonymous-post-template.csv', exportCSV(blankRecords())));
  $('export-records').addEventListener('click', () => { download('anonymous-post-records.csv', exportCSV(records)); dirty = false; setStatus('CSV exported. Your entries are still available on this page until it is refreshed or closed.'); });
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('Choose a CSV smaller than 1 MB.');
      const replacement = validateCSV(await file.text());
      records = replacement; dirty = false; renderEditor(); renderSummary();
      setStatus('CSV imported. Only the labels in that file are counted; other person/post slots remain blank.');
    } catch (error) { setStatus(`${error.message} Your current entries have not changed.`, true); }
    event.target.value = '';
  });
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  renderEditor(); renderSummary();

  async function loadPilot() {
    try {
      const response = await fetch('assets/week6/pilot.json', { credentials: 'omit' });
      if (!response.ok) throw new Error('Pilot unavailable');
      const data = await response.json();
      if (!Array.isArray(data.records) || data.records.length !== 15 || !Array.isArray(data.counts)) throw new Error('Pilot unavailable');
      const pilotLabels = Object.fromEntries([...(data.categories || []), ...(data.expanded_categories || [])].map((category) => [category.code, category.label]));
      const body = $('pilot-counts').querySelector('tbody');
      data.counts.forEach((count) => {
        const row = make('tr'), label = make('th', count.label || pilotLabels[count.category] || count.category); label.scope = 'row';
        row.append(label, make('td', count.original_available === false ? 'Not available' : count.original_count), make('td', count.expanded_count)); body.append(row);
      });
      data.records.forEach((record) => {
        const card = make('article', undefined, 'lab-pilot-card');
        if (/^assets\/journal\/[a-z0-9-]+\.jpg$/.test(record.image)) {
          const img = make('img'); img.src = record.image; img.alt = record.caption || ''; img.loading = 'lazy'; card.append(img);
        }
        const text = make('div'); text.append(make('h3', record.caption || record.id));
        text.append(make('p', `${pilotLabels[record.original_category] || record.original_category} → ${pilotLabels[record.expanded_category] || record.expanded_category}`, 'lab-pilot-labels'));
        if (record.reason) text.append(make('p', record.reason));
        if (record.alternative_category) text.append(make('p', `Another possible label: ${pilotLabels[record.alternative_category] || record.alternative_category}.`));
        card.append(text); $('pilot-cards').append(card);
      });
      $('pilot-scope').textContent = data.scope_note || 'A fifteen-photo pilot using existing public portfolio images. It is kept separate from the anonymous-post records below.';
      $('pilot-status').textContent = '15 portfolio photos · 3 chapters · a category test, separate from the blank 32-person tool';
      $('pilot-content').hidden = false;
    } catch {
      $('pilot-status').textContent = 'The photo pilot is unavailable in this preview. The blank coding tool below still works; the reflection contains the pilot discussion.';
    }
  }
  loadPilot();
})();
