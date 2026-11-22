#!/usr/bin/env node
// Checks this add-in before a release: manifest.json, main.js, styles.css and the extra files.
// MIT License, see LICENSE. Needs Node.js 18 or later and nothing else.
//
//   node tools/check.js                  check everything
//   node tools/check.js --tag v1.2.0     also check that the tag matches the version in manifest.json
//   node tools/check.js --list-files     print the files to attach to a release, one per line
//
// The same rules are used by the Markooj add-in list: https://github.com/datakeen/markooj-addins
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MB = 1024 * 1024;
const LIMITS = { manifest: 64 * 1024, main: 2 * MB, styles: 2 * MB, total: 50 * MB };
const TEMPLATE_REPO = 'datakeen/markooj-addin-template';
const CATEGORIES = ['writing', 'research', 'math', 'languages', 'export', 'productivity', 'developer', 'fun', 'other'];
const KNOWN = ['$schema', 'id', 'name', 'version', 'minMarkooj', 'author', 'authorUrl', 'description', 'icon', 'color', 'category', 'license', 'permissions', 'files'];
const RESERVED = ['manifest.json', 'main.js', 'styles.css', '.install.json'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ONE_LINE = /^[^\r\n\t]+$/;

const fmt = n => (n >= MB ? (n / MB).toFixed(1) + ' MB' : n >= 1024 ? Math.ceil(n / 1024) + ' KB' : n + ' bytes');
const size = f => fs.statSync(path.join(ROOT, f)).size;
const exists = f => fs.existsSync(path.join(ROOT, f));

/** Checks the add-in in `root`. Returns {errors[], warnings[], files[] (to attach to a release), manifest}. */
function check({ tag = null, repo = process.env.GITHUB_REPOSITORY || '' } = {}) {
  const errors = [];
  const warnings = [];
  const files = [];
  const text = (v, field, min, max) => {
    if (typeof v !== 'string') { errors.push(`"${field}" is missing or is not text.`); return; }
    const n = [...v].length;
    if (n < min || n > max) errors.push(`"${field}" should be ${min} to ${max} characters (now ${n}).`);
    if (!ONE_LINE.test(v)) errors.push(`"${field}" should be one line.`);
    else if (v !== v.trim()) errors.push(`"${field}" has spaces at the start or the end.`);
  };

  // manifest.json
  if (!exists('manifest.json')) return { errors: ['manifest.json is missing.'], warnings, files, manifest: null };
  if (size('manifest.json') > LIMITS.manifest) errors.push(`manifest.json is larger than ${fmt(LIMITS.manifest)}.`);
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8').replace(/^﻿/, '')); } catch (e) {
    return { errors: [`manifest.json is not valid JSON: ${e.message}`], warnings, files, manifest: null };
  }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { errors: ['manifest.json should be an object: { ... }.'], warnings, files, manifest: null };
  files.push('manifest.json');
  for (const k of Object.keys(m)) if (!KNOWN.includes(k)) errors.push(`manifest.json has "${k}", which is not a known field. Check the spelling, or remove it.`);

  if (typeof m.id !== 'string' || !ID.test(m.id) || m.id.length < 3 || m.id.length > 40) {
    errors.push('"id" should be 3 to 40 lowercase letters, digits and single hyphens, such as word-count.');
  } else if (m.id === 'abbreviations' && repo && repo.toLowerCase() !== TEMPLATE_REPO) {
    errors.push('"id" is still "abbreviations", the template\'s sample. Give your add-in its own id in manifest.json.');
  } else if (m.id === 'abbreviations' && !repo) {
    warnings.push('"id" is "abbreviations", the template\'s sample. Change it to your own add-in\'s id before you publish.');
  }
  text(m.name, 'name', 2, 50);
  text(m.author, 'author', 1, 80);
  text(m.description, 'description', 10, 250);
  if (!SEMVER.test(String(m.version))) errors.push(`"version" is "${m.version}"; it should look like 1.0.0.`);
  if (!SEMVER.test(String(m.minMarkooj))) errors.push(`"minMarkooj" is "${m.minMarkooj}"; it should look like 1.1.0.`);
  if (m.authorUrl !== undefined && !/^https:\/\/\S+$/.test(String(m.authorUrl))) errors.push('"authorUrl" should start with https://.');
  if (m.icon !== undefined && !(typeof m.icon === 'string' && ID.test(m.icon) && m.icon.length <= 40)) errors.push('"icon" should be an icon name such as table or sparkle.');
  if (m.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(m.color))) errors.push('"color" should look like #30b0c7.');
  if (m.category !== undefined && !CATEGORIES.includes(m.category)) errors.push(`"category" should be one of: ${CATEGORIES.join(', ')}.`);
  if (m.license !== undefined && (typeof m.license !== 'string' || m.license.length > 80)) errors.push('"license" should be a short license name such as MIT.');
  if (m.permissions !== undefined) text(m.permissions, 'permissions', 1, 300);
  if (typeof m.name === 'string' && /markooj/i.test(m.name) && repo && !repo.toLowerCase().startsWith('datakeen/')) {
    errors.push('"name" uses the word Markooj. Only add-ins from the Markooj team may; Markooj already shows your add-in inside the app.');
  }
  if (tag !== null && tag.replace(/^v/i, '') !== m.version) {
    errors.push(`The tag is ${tag}, but manifest.json says version ${m.version}. Use the tag v${m.version}, or change the version.`);
  }

  // main.js: compiled the way Markooj runs it (the body of a function with app and markooj), never run here
  if (!exists('main.js')) errors.push('main.js is missing.');
  else {
    files.push('main.js');
    if (size('main.js') > LIMITS.main) errors.push(`main.js is ${fmt(size('main.js'))}; at most ${fmt(LIMITS.main)}.`);
    const code = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8').replace(/^﻿/, '');
    // parsed as a function body on its own, exactly as Markooj's new Function('app', 'markooj', 'addin', code) does
    try { vm.compileFunction(code, ['app', 'markooj', 'addin'], { filename: 'main.js' }); } catch (e) { errors.push(`main.js has a syntax error: ${e.message}`); }
    if (code.split(/\r?\n/).some(l => l.length > 500)) warnings.push('main.js has lines longer than 500 characters. The add-in list accepts only readable, not minified, code.');
  }

  // styles.css (optional)
  if (exists('styles.css')) {
    files.push('styles.css');
    if (size('styles.css') > LIMITS.styles) errors.push(`styles.css is ${fmt(size('styles.css'))}; at most ${fmt(LIMITS.styles)}.`);
  }

  // extra files
  if (m.files !== undefined) {
    if (!Array.isArray(m.files)) errors.push('"files" should be a list: [ { "name": "words.json" } ].');
    else {
      if (m.files.length > 50) errors.push('"files" lists more than 50 files.');
      const seen = new Set();
      for (const f of m.files) {
        const n = f && typeof f === 'object' ? f.name : undefined;
        if (typeof n !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n) || n.length > 100) { errors.push(`"files" has ${JSON.stringify(f)}: each needs a plain "name" such as words.json.`); continue; }
        if (RESERVED.includes(n.toLowerCase())) { errors.push(`"files" lists ${n}, a name Markooj uses itself. Rename the file.`); continue; }
        if (/\.$|^(?:con|prn|aux|nul|com\d|lpt\d)(?:\..*)?$/i.test(n)) { errors.push(`"files" lists ${n}, a name Windows cannot save. Rename the file.`); continue; }
        if (seen.has(n.toLowerCase())) { errors.push(`"files" lists ${n} twice.`); continue; }
        seen.add(n.toLowerCase());
        for (const k of Object.keys(f)) if (k !== 'name' && k !== 'size') errors.push(`"files" entry ${n} has "${k}", which is not a known field.`);
        if (!exists(n)) { errors.push(`"files" lists ${n}, but there is no such file next to manifest.json.`); continue; }
        if (f.size !== undefined && f.size !== size(n)) warnings.push(`"files" says ${n} is ${f.size} bytes, but it is ${size(n)} bytes. Fix the size or remove it.`);
        files.push(n);
      }
    }
  }
  const total = files.filter(exists).reduce((s, f) => s + size(f), 0);
  if (total > LIMITS.total) errors.push(`The add-in's files add up to ${fmt(total)}; at most ${fmt(LIMITS.total)}.`);

  // the repository
  if (!exists('README.md')) warnings.push('README.md is missing. Markooj shows it on your add-in\'s page.');
  if (!exists('LICENSE') && !exists('LICENSE.md') && !exists('LICENSE.txt')) warnings.push('There is no LICENSE file.');

  return { errors, warnings, files, manifest: m };
}

function main() {
  const argv = process.argv.slice(2);
  const tagAt = argv.indexOf('--tag');
  const tag = tagAt >= 0 ? String(argv[tagAt + 1] || '') : null;
  const r = check({ tag });
  if (argv.includes('--list-files')) {
    if (r.errors.length) { for (const e of r.errors) console.error(`Problem: ${e}`); return 1; }
    console.log(r.files.join('\n'));
    return 0;
  }
  const m = r.manifest || {};
  console.log(`${m.name || 'Add-in'} ${m.version || ''} (${m.id || 'no id'})`.trim());
  for (const e of r.errors) console.log(`  Problem: ${e}`);
  for (const w of r.warnings) console.log(`  Warning: ${w}`);
  if (r.errors.length) { console.log(`${r.errors.length} problem(s) to fix.`); return 1; }
  console.log(`Ready. Files for the release: ${r.files.join(', ')}.`);
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { check };
