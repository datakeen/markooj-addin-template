// @name Abbreviations
// @description List the abbreviations defined in a document
// @version 1.0.0
// @author Markooj
// @icon table
// @color #30b0c7
//
// Abbreviations: a sample Markooj add-in. MIT License, see LICENSE.
//
// Finds definitions such as "sediment delivery ratio (SDR)" and can insert them as a table, count them on the
// status bar, and save them as a CSV file from File → Save As.
//
// Markooj runs this file once when it starts, as the body of a function with these names in scope:
//   app      the Markooj application (commands, ribbon, documents, settings, ...)
//   markooj  the simple document API that macros use (markooj.doc.insert, markooj.doc.replace, ...)
//   addin    this add-in's id, version and folder, and addin.file(name) to read a data file listed in manifest.json
// The full API: https://github.com/datakeen/markooj/blob/main/docs/ADDINS.md
// The lines above starting with @ are only used when this file is tried as a single .js add-in;
// an installed add-in takes its name, version and icon from manifest.json.

// 1. The logic: plain functions, easy to test.
// Small words that an abbreviation may skip, as in "Council of Research (CR)".
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

// The words just before "(SDR)" that the abbreviation stands for: the shortest run of words whose first letters
// spell its capital letters, with or without the small words, and counting the parts of hyphenated words.
function meaningOf(words, short) {
  const caps = short.replace(/[^A-Z]/g, '');
  const initials = (list, skipSmall, splitHyphens) => list
    .flatMap(w => (splitHyphens ? w.split('-') : [w]))
    .filter(w => w && !(skipSmall && SMALL_WORDS.has(w.toLowerCase())))
    .map(w => w[0].toUpperCase()).join('');
  for (let k = 1; k <= words.length; k++) {
    const run = words.slice(-k);
    if (SMALL_WORDS.has(run[0].toLowerCase())) continue;
    for (const skip of [true, false]) for (const split of [false, true]) {
      if (initials(run, skip, split) === caps) return run.join(' ');
    }
  }
  return null;
}

function findAbbreviations(markdown) {
  const found = new Map();
  const re = /((?:[A-Za-z][\w-]*,?\s+){1,10}?)\(([A-Z][A-Za-z0-9]{1,9})\)/g;
  for (const m of String(markdown || '').matchAll(re)) {
    const short = m[2];
    if (found.has(short)) continue;
    const words = m[1].trim().split(/\s+/).map(w => w.replace(/,$/, ''));
    const long = meaningOf(words, short);
    if (long) found.set(short, long);
  }
  const list = [...found.entries()].map(([short, long]) => ({ short, long }));
  if (app.settings.get('abbreviations.sort', true)) list.sort((a, b) => a.short.localeCompare(b.short));
  return list;
}

function toTable(list) {
  const cell = s => String(s).replace(/\|/g, '\\|');
  return ['| Abbreviation | Meaning |', '| --- | --- |', ...list.map(a => `| ${cell(a.short)} | ${cell(a.long)} |`)].join('\n');
}

// 2. A command: it works from a button, the command search (Alt+Q), a shortcut and macros.
app.commands.register('abbreviations.insert', {
  label: 'Insert list of abbreviations',
  icon: 'table',
  description: 'Insert a table of the abbreviations defined in this document, at the cursor.',
  run: () => {
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown' || doc.readOnly) { app.ui.toast('Open an editable Markdown document first.'); return; }
    const list = findAbbreviations(doc.text);
    if (!list.length) { app.ui.toast('No abbreviations found. Define one like this: sediment delivery ratio (SDR).'); return; }
    markooj.doc.insert('\n\n' + toTable(list) + '\n\n: Abbreviations\n');
    app.ui.toast(list.length === 1 ? 'Inserted one abbreviation.' : `Inserted ${list.length} abbreviations.`, { kind: 'success' });
  },
});

// 3. A button on the Add-ins tab.
app.ribbon.addGroup('addins', {
  id: 'abbreviations', label: 'Abbreviations', order: 70,
  items: [{ type: 'big', command: 'abbreviations.insert', label: 'Abbreviations', icon: 'table' }],
});

// 4. A count on the status bar that follows the document. It is counted again a moment after typing stops,
//    not on every keystroke, so long documents stay fast.
app.status.addItem({
  id: 'abbreviations', side: 'right', order: 40,
  render(el) {
    const doc = app.docs.active();
    const n = doc && doc.kind === 'markdown' ? findAbbreviations(doc.text).length : 0;
    el.classList.add('abbreviations-status');
    el.textContent = n ? `${n} abbr.` : '';
    el.title = 'Abbreviations defined in this document';
  },
});
let refreshTimer = null;
const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => app.status.refresh(), 400); };
app.events.on('doc:changed', refreshSoon);
app.events.on('doc:active', () => app.status.refresh());

// 5. A new format in File → Save As → From add-ins.
app.exporter.register({
  id: 'abbreviations-csv', label: 'Abbreviations (CSV)', ext: 'csv',
  description: 'Every abbreviation and its meaning, for Excel.',
  run: (doc, ctx) => {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    return ['abbreviation,meaning', ...findAbbreviations(ctx.markdown).map(a => q(a.short) + ',' + q(a.long))].join('\r\n') + '\r\n';
  },
});

// 6. A setting in File → Options.
app.options.addSection({
  id: 'abbreviations', label: 'Abbreviations',
  render(el) {
    const label = document.createElement('label');
    label.className = 'abbreviations-option';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = app.settings.get('abbreviations.sort', true);
    box.addEventListener('change', () => app.settings.set('abbreviations.sort', box.checked));
    label.append(box, ' Sort the list of abbreviations from A to Z');
    el.append(label);
  },
});

// 7. A test that runs with Markooj's smoke test.
app.tests.register('add-in abbreviations: finds definitions', () => {
  const list = findAbbreviations('The sediment delivery ratio (SDR) and the Water Resources Board (WRB) agree.');
  app.assert(list.length === 2, JSON.stringify(list));
  app.assert(list[0].short === 'SDR' && list[0].long === 'sediment delivery ratio', JSON.stringify(list[0]));
  app.assert(list[1].short === 'WRB' && list[1].long === 'Water Resources Board', JSON.stringify(list[1]));
  const more = findAbbreviations('The Pakistan Council of Research in Water Resources (PCRWR) studied two-phase flow (TPF). See also (NASA).');
  app.assert(more.length === 2 && more.some(a => a.short === 'PCRWR' && a.long === 'Pakistan Council of Research in Water Resources'), JSON.stringify(more));
  app.assert(more.some(a => a.short === 'TPF' && a.long === 'two-phase flow'), JSON.stringify(more));
});
