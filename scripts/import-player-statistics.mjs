#!/usr/bin/env node
/**
 * Import season statistics from the public league Google Sheet or a local .xlsx.
 *
 * Usage:
 *   node scripts/import-player-statistics.mjs
 *   node scripts/import-player-statistics.mjs ./path/to/stats.xlsx
 *   node scripts/import-player-statistics.mjs ./path/to/stats.xlsx "Exact worksheet name"
 *
 * With no path, downloads the current workbook export. All tabs containing a
 * recognizable player-stat table are scanned unless a worksheet is specified.
 * Exact duplicate values across tabs are de-duplicated; conflicting values are
 * reported and the first value in workbook order is retained deterministically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const inputPath = process.argv[2];
const requestedSheet = process.argv[3];
const spreadsheetId = '1yBJOkXfj27P-RX_mFvH4qtYayav9ic9UjekYkJhpKhw';
const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Keep + significant so OPS+ cannot be mistaken for OPS, and ERA+ for ERA.
const normalizeHeader = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+]/g, '');
const characters = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/data/characters.json'), 'utf8'));
const definitions = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/data/statisticDefinitions.json'), 'utf8'));

const byName = new Map();
for (const character of characters) {
  const key = normalize(character.name);
  if (byName.has(key)) byName.set(key, null);
  else byName.set(key, character);
}
// These are established base-name aliases in the league workbook. Explicit
// aliases are safer than fuzzy matching (which can assign stats to the wrong color variant).
const explicitAliases = new Map([
  ['magikoopa', 'bmag'],
  ['koopatroopa', 'gkoopa'],
  ['redkoopatroopa', 'rkoopa'],
  ['shyguy', 'rshy'],
  ['kritter', 'gkritter'],
  ['paratroopa', 'gpara'],
  ['drybones', 'graybones'],
  ['redtoad', 'toad']
]);
const byId = new Map(characters.map(character => [character.id, character]));
for (const [alias, id] of explicitAliases) {
  const target = byId.get(id);
  if (target && !byName.has(normalize(alias))) byName.set(normalize(alias), target);
}

const nonPlayerRows = new Set([
  'player', 'totalstats', 'totalteamrecord', 'star1b', 'na', 'n/a', '#n/a', 'nan'
].map(normalize));
function isNonPlayerRow(value) {
  const key = normalize(value);
  return !key || nonPlayerRows.has(key) || key.startsWith('total') || key.startsWith('#n/a') || key.startsWith('star');
}

async function loadWorkbook() {
  if (inputPath) {
    const workbookPath = path.resolve(process.cwd(), inputPath);
    if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
    return { workbook: XLSX.readFile(workbookPath, { cellDates: false }), source: path.basename(workbookPath) };
  }
  console.log('Downloading the latest league statistics workbook from Google Sheets…');
  const response = await fetch(spreadsheetUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Google Sheets export failed (${response.status}). Check that the sheet is shared for viewing or pass a downloaded .xlsx file.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Google Sheets did not return an .xlsx workbook. Check sharing permissions and that the spreadsheet URL is correct.');
  }
  return { workbook: XLSX.read(bytes, { type: 'buffer', cellDates: false }), source: 'Google Sheets (latest export)' };
}

const nameHeaderAliases = new Set(['player', 'playername', 'character', 'charactername', 'name', 'playercharacter']);
const definitionAliases = definitions.map(definition => ({
  definition,
  aliases: [...new Set([definition.key, definition.label, ...(definition.aliases || [])].map(normalizeHeader))]
}));
function parseMetric(value, definition) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let text = String(value).trim();
  const percent = text.endsWith('%');
  text = text.replace(/,/g, '').replace(/%$/, '');
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return percent && definition.format === 'decimal' ? number / 100 : number;
}
function findHeader(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 60); rowIndex++) {
    const row = matrix[rowIndex] || [];
    const headerByName = new Map();
    row.forEach((value, index) => {
      const key = normalizeHeader(value);
      if (key && !headerByName.has(key)) headerByName.set(key, index);
    });
    const nameIndex = [...nameHeaderAliases].map(alias => headerByName.get(alias)).find(index => index !== undefined);
    if (nameIndex === undefined) continue;
    const metricColumns = [];
    for (const item of definitionAliases) {
      const columnIndex = item.aliases.map(alias => headerByName.get(alias)).find(index => index !== undefined);
      if (columnIndex !== undefined) metricColumns.push({ definition: item.definition, columnIndex });
    }
    if (metricColumns.length) return { matrix, headerRowIndex: rowIndex, nameIndex, metricColumns };
  }
  return null;
}

try {
  const { workbook, source } = await loadWorkbook();
  const sheetNames = requestedSheet ? [requestedSheet] : workbook.SheetNames;
  if (requestedSheet && !workbook.Sheets[requestedSheet]) {
    throw new Error(`Sheet "${requestedSheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const imported = {};
  const unmatched = new Set();
  const ambiguous = new Set();
  const ignoredRows = new Set();
  const conflicts = new Map();
  const importedSheets = [];
  const importedMetricKeys = new Set();
  const provenance = new Map();

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const header = findHeader(sheet);
    if (!header) continue;
    let sheetRowsImported = 0;
    for (let rowIndex = header.headerRowIndex + 1; rowIndex < header.matrix.length; rowIndex++) {
      const row = header.matrix[rowIndex] || [];
      const rawName = row[header.nameIndex];
      if (isNonPlayerRow(rawName)) {
        if (rawName !== null && rawName !== undefined && String(rawName).trim()) ignoredRows.add(String(rawName).trim());
        continue;
      }
      const key = normalize(rawName);
      const character = byName.get(key);
      if (character === null && byName.has(key)) { ambiguous.add(String(rawName)); continue; }
      if (!character) { unmatched.add(String(rawName).trim()); continue; }

      let rowHadValues = false;
      imported[character.id] ||= {};
      for (const { definition, columnIndex } of header.metricColumns) {
        const value = parseMetric(row[columnIndex], definition);
        if (value === null) continue;
        const existing = imported[character.id][definition.key];
        const provenanceKey = `${character.id}:${definition.key}`;
        if (existing !== undefined) {
          // Identical values repeated on summary/detail tabs are normal; do not
          // overwrite or emit a warning for those. Conflicts are surfaced.
          if (Math.abs(Number(existing) - Number(value)) > 1e-9) {
            if (!conflicts.has(provenanceKey)) conflicts.set(provenanceKey, {
              player: character.name, metric: definition.key, kept: existing,
              keptFrom: provenance.get(provenanceKey), ignored: value, ignoredFrom: sheetName
            });
          }
          continue;
        }
        imported[character.id][definition.key] = value;
        provenance.set(provenanceKey, sheetName);
        importedMetricKeys.add(definition.key);
        rowHadValues = true;
      }
      if (rowHadValues) sheetRowsImported++;
      if (!Object.keys(imported[character.id]).length) delete imported[character.id];
    }
    if (sheetRowsImported) importedSheets.push(`${sheetName} (${sheetRowsImported} new player rows)`);
  }

  if (!importedMetricKeys.size) {
    throw new Error(`No player-stat tables were detected in ${source}. Supported metrics: ${definitions.map(d => d.key).join(', ')}. Add header aliases in src/data/statisticDefinitions.json if the workbook uses different column names.`);
  }

  const outputPath = path.join(projectRoot, 'src/data/playerStatistics.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(imported, null, 2)}\n`);
  console.log(`Imported statistics for ${Object.keys(imported).length} players from ${source}.`);
  console.log(`Sheets: ${importedSheets.join('; ')}`);
  console.log(`Metrics: ${[...importedMetricKeys].join(', ')}.`);
  console.log(`Output: ${path.relative(process.cwd(), outputPath)}`);
  if (unmatched.size) console.warn(`Unmatched names (${unmatched.size}); not imported: ${[...unmatched].join(', ')}`);
  if (ambiguous.size) console.warn(`Ambiguous character names (${ambiguous.size}); not imported: ${[...ambiguous].join(', ')}`);
  if (ignoredRows.size) console.log(`Ignored summary/group rows (${ignoredRows.size}): ${[...ignoredRows].slice(0, 12).join(', ')}${ignoredRows.size > 12 ? ', …' : ''}`);
  if (conflicts.size) {
    const sample = [...conflicts.values()].slice(0, 20).map(c => `${c.player}: ${c.metric} (${c.kept} from ${c.keptFrom}; ${c.ignored} from ${c.ignoredFrom})`);
    console.warn(`Conflicting repeated values (${conflicts.size}); first value kept in workbook order. Review: ${sample.join('; ')}${conflicts.size > 20 ? `; … and ${conflicts.size - 20} more` : ''}`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
