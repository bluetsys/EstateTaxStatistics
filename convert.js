const { readFile, readdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;

function parseCsv(text) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records.filter((record) => record.some((value) => value !== ''));
}

function numberOrNull(value) {
  const normalized = value?.trim().replaceAll(',', '');
  if (!normalized || normalized === '-' || normalized === '..') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

async function findCsv(prefix) {
  const matches = (await readdir(ROOT)).filter(
    (name) => name.toLowerCase().endsWith('.csv') && name.startsWith(prefix),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one CSV starting with "${prefix}", found ${matches.length}: ${matches.join(', ') || '(none)'}`,
    );
  }
  return path.join(ROOT, matches[0]);
}

async function readRows(prefix) {
  const filename = await findCsv(prefix);
  const text = (await readFile(filename, 'utf8')).replace(/^\uFEFF/, '');
  return parseCsv(text);
}

function buildTaxData(records, type) {
  if (records.length < 4) throw new Error(`${type} CSV has too few rows`);
  const years = records[0].slice(2).map((value) => value.trim());
  const labels = records[1].slice(2).map((value) => value.trim());
  const subs = records[2].slice(2).map((value) => value.trim());
  const rowNames = records.slice(3).filter((record) => record.length >= 2);
  const output = {};
  const yearColumns = new Map();

  years.forEach((year, column) => {
    if (!/^\d{4}$/.test(year)) return;
    if (!yearColumns.has(year)) yearColumns.set(year, []);
    yearColumns.get(year).push(column);
  });

  for (const [year, columns] of yearColumns) {
    const metrics = columns.map((column) => {
      const label = labels[column] || '';
      const match = label.match(/^(.*)\s+\(([^()]*)\)$/);
      return {
        label: match ? match[1].trim() : label,
        sub: subs[column] || '소계',
        unit: match ? match[2].trim() : '',
      };
    });
    const rows = rowNames
      .filter((record) => record[0]?.trim() && record[1]?.trim())
      .map((record) => ({
        group: record[0].trim(),
        segment: record[1].trim(),
        values: columns.map((column) => numberOrNull(record[column + 2])),
      }));
    output[year] = { metrics, rows };
  }

  return output;
}

function buildMortality(records) {
  if (records.length < 2) throw new Error('Mortality CSV has too few rows');
  const years = records[0].slice(1).map((value) => value.trim());
  const result = {};

  for (let i = 1; i < records.length; i += 1) {
    const label = records[i][0]?.trim();
    if (!label) continue;
    years.forEach((year, column) => {
      if (!/^\d{4}$/.test(year)) return;
      result[year] ??= {};
      result[year][label] = numberOrNull(records[i][column + 1]);
    });
  }

  return result;
}

async function main() {
  const [reportRows, decisionRows, mortalityRows] = await Promise.all([
    readRows('6.1.2_'),
    readRows('6.2.2_'),
    readRows('사망자수__조사망률__기대수명_'),
  ]);

  const DATA = {
    신고: buildTaxData(reportRows, '신고'),
    결정: buildTaxData(decisionRows, '결정'),
  };
  const MORTALITY = buildMortality(mortalityRows);
  const output = `const DATA = ${JSON.stringify(DATA, null, 2)};\n\nconst MORTALITY = ${JSON.stringify(MORTALITY, null, 2)};\n`;

  await writeFile(path.join(ROOT, 'data.js'), output, 'utf8');
  console.log(
    `Converted ${Object.keys(DATA.신고).length} 신고 years, ${Object.keys(DATA.결정).length} 결정 years, and ${Object.keys(MORTALITY).length} mortality years to data.js`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
