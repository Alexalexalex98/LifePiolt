// Estrae le stringhe italiane visibili all'utente da src/**/*.ts(x) -> src/i18n/source.json (+ source.meta.json).
// Uso: node scripts/extract-i18n.mjs [--list]   (vedi docs/i18n.md per i criteri)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

// File/cartelle esclusi (dati demo, cataloghi, test).
const EXCLUDE_DIRS = ['src/i18n/locales', 'src/i18n/source', 'tests', 'node_modules'];
const EXCLUDE_FILES = new Set([
  'src/i18n/languages.ts', 'src/i18n/core.ts', 'src/i18n/apply.ts', 'src/i18n/catalogs.ts', 'src/lib/rn-shim.tsx', 'src/lib/rn-shim-pressable.tsx',
  'src/data/seed.ts', 'src/data/marketSeed.ts', 'src/data/jobsSeed.ts', 'src/data/moodDemo.ts',
  'src/data/network-seed.json', 'src/data/translations.json', 'src/store/demo.ts',
]);

// Attributi JSX il cui valore stringa e' testo visibile.
export const TEXT_ATTRS = new Set([
  'title', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'text', 'subtitle', 'hint',
  'description', 'header', 'empty', 'caption', 'sub', 'desc', 'detail', 'tagline', 'cta', 'name',
  'message', 'body', 'heading', 'emptyText', 'confirmLabel', 'cancelLabel',
]);
// Chiavi di proprieta' di oggetti il cui valore stringa e' testo visibile.
export const TEXT_KEYS = new Set([
  'title', 'text', 'label', 'name', 'desc', 'description', 'detail', 'hint', 'tagline', 'placeholder', 'msg',
  'message', 'body', 'sub', 'subtitle', 'cta', 'why', 'summary', 'sentence', 'tip', 'action', 'explanation',
  'reason', 'heading', 'note', 'question', 'answer', 'caption', 'empty', 'short', 'long', 'intro', 'headline',
  'meaning', 'example', 'advice', 'verdict', 'cause', 'impact', 'how', 'what', 'suggestion', 'prompt',
]);
// Funzioni il cui primo argomento (o tutti i testuali) e' testo visibile.
const CALL_FUNCS = new Set(['toast', 'showUndoToast', 't', 'showToast', 'notify']);

// Voci aggiunte a mano: chiavi usate anche come etichette visibili (es. impostazioni privacy) ma passate solo per confronti.
const EXTRA = ['AI Memory', 'Dati salute', 'Dati finanziari', 'Smart Home', 'Profilo privato'];
// Rumore noto: nomi nativi delle lingue (non si traducono), token tecnici.
const NOISE = new Set(['Deutsch', 'English', 'Français', 'Italiano', 'Español', 'Português', 'Text', 'Alex', 'KB.', 'azione fallita', 'Translate', 'Settings']);

const norm = (s) => s.replace(/\s+/g, ' ').trim();

export function isItalianLike(s) {
  if (!s || !/\p{L}/u.test(s)) return false;
  if (s.length < 2) return false;
  if (/^[A-Z0-9_]+$/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9_.:-]*$/.test(s)) return false; // identificatori
  if (/^[A-Za-z]+[A-Z][a-zA-Z0-9]*$/.test(s) && !/\s/.test(s) && !/[àèéìòù]/.test(s)) return false; // camelCase/PascalCase
  if (/^(\/|#|http|@|rgb|lp2-)/i.test(s)) return false;
  if (/=>|;|[{}]\s*$|^\s*[{<]|\bfunction\b|\breturn\b|\bconst\b/.test(s.replace(/\{\d+\}/g, ''))) return false;
  if (/^[\w.-]+\.(png|jpg|jpeg|svg|json|ts|tsx|mp4|pdf|csv|ics)$/i.test(s)) return false;
  if (/^[\w-]+(\/[\w.-]+)+$/.test(s)) return false;
  if (/^[^\p{L}]*\{\d+\}[^\p{L}]*$/u.test(s)) return false; // solo segnaposto
  const stripped = s.replace(/\{\d+\}/g, '');
  if (!/\p{L}{2}/u.test(stripped)) return false;
  if (/\s/.test(s)) return true;
  if (/[àèéìòùÀÈÉÌÒÙ]/.test(s)) return true;
  return /^[A-ZÀ-Ý]/.test(s) && s.length >= 3;
}

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.some((d) => rel === d || rel.startsWith(d + '/'))) continue;
      walkFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !EXCLUDE_FILES.has(rel)) out.push(rel);
  }
  return out;
}

function childrenOf(node) {
  const res = [];
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') res.push(x); }
    else if (v && typeof v.type === 'string') res.push(v);
  }
  return res;
}

/** Restituisce le stringhe (con segnaposto) prodotte da un'espressione "di testo". */
function strings(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case 'StringLiteral': out.push(node.value); break;
    case 'TemplateLiteral': {
      let s = '';
      node.quasis.forEach((q, i) => {
        s += q.value.cooked ?? q.value.raw;
        if (i < node.expressions.length) s += `{${i}}`;
      });
      out.push(s);
      // rami di condizionali dentro il template -> voci separate
      for (const ex of node.expressions) collectBranches(ex, out);
      break;
    }
    case 'ConditionalExpression': strings(node.consequent, out); strings(node.alternate, out); break;
    case 'LogicalExpression': strings(node.right, out); if (node.operator !== '&&') strings(node.left, out); break;
    case 'ParenthesizedExpression': case 'TSAsExpression': case 'TSNonNullExpression': case 'TSSatisfiesExpression':
      strings(node.expression, out); break;
    case 'BinaryExpression':
      if (node.operator === '+') {
        const parts = [];
        flattenConcat(node, parts);
        let s = ''; let n = 0; let any = false;
        for (const p of parts) {
          if (p.type === 'StringLiteral') { s += p.value; any = true; }
          else if (p.type === 'TemplateLiteral' && p.expressions.length === 0) { s += p.quasis[0].value.cooked; any = true; }
          else { s += `{${n++}}`; }
        }
        if (any) out.push(s);
        for (const p of parts) if (p.type === 'ConditionalExpression') collectBranches(p, out);
      }
      break;
    case 'ArrayExpression': for (const el of node.elements) if (el && (el.type === 'StringLiteral' || el.type === 'TemplateLiteral')) strings(el, out); break;
    default: break;
  }
  return out;
}
function flattenConcat(n, parts) {
  if (n.type === 'BinaryExpression' && n.operator === '+') { flattenConcat(n.left, parts); flattenConcat(n.right, parts); }
  else parts.push(n);
}
function collectBranches(ex, out) {
  if (ex.type === 'ConditionalExpression') {
    for (const b of [ex.consequent, ex.alternate]) {
      if (b.type === 'StringLiteral' || b.type === 'TemplateLiteral') strings(b, out);
      else collectBranches(b, out);
    }
  } else if (ex.type === 'LogicalExpression') {
    for (const b of [ex.left, ex.right]) if (b.type === 'StringLiteral') strings(b, out);
  }
}

function calleeName(c) {
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
    const o = c.object.type === 'Identifier' ? c.object.name : '';
    return o + '.' + c.property.name;
  }
  return '';
}

function keyName(p) {
  if (p.computed) return null;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'StringLiteral') return p.key.value;
  return null;
}

const COMPARE_OPS = new Set(['===', '!==', '==', '!=']);
const LOGIC_METHODS = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'test', 'match', 'split', 'replace', 'replaceAll', 'localeCompare', 'has', 'getItem', 'setItem', 'removeItem', 'normalize', 'padStart', 'padEnd', 'matchAll', 'search', 'log', 'warn', 'info', 'debug', 'RegExp', 'require', 'go', 'navigate']);
const NON_TEXT_ATTRS = new Set(['key', 'testID', 'nativeID', 'name_', 'href', 'source', 'uri', 'style', 'icon', 'tone', 'kind', 'variant', 'type', 'mode', 'role', 'accessibilityRole', 'keyboardType', 'autoCapitalize', 'autoComplete', 'returnKeyType', 'resizeMode', 'size', 'color', 'fill', 'stroke', 'd', 'viewBox', 'id', 'to', 'page', 'screen', 'value', 'selectedValue', 'inputMode', 'textContentType', 'cursorColor']);
/** Letterali "generici": qualsiasi stringa italiana-like che non sia chiaramente logica. */
function genericOk(node, parent) {
  if (!parent) return false;
  const pt = parent.type;
  if (pt === 'ImportDeclaration' || pt === 'ExportNamedDeclaration' || pt === 'ExportAllDeclaration' || pt === 'TSLiteralType' || pt === 'TSEnumMember' || pt === 'SwitchCase' || pt === 'TSExternalModuleReference') return false;
  if (pt === 'ImportExpression') return false;
  if (pt === 'BinaryExpression' && (COMPARE_OPS.has(parent.operator) || parent.operator === 'in')) return false;
  if (pt === 'JSXAttribute') return false; // gestiti da TEXT_ATTRS
  if (pt === 'ObjectProperty' || pt === 'ObjectMethod') { if (parent.key === node) return false; }
  if (pt === 'MemberExpression' && parent.computed && parent.property === node) return false;
  if (pt === 'CallExpression' || pt === 'NewExpression') {
    const c = parent.callee;
    if (parent.arguments.includes(node)) {
      const nm = c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier' ? c.property.name : c.type === 'Identifier' ? c.name : '';
      if (LOGIC_METHODS.has(nm) || /^use[A-Z]/.test(nm) || nm === 'StyleSheet' || nm === 'fetch') return false;
    }
  }
  if (pt === 'TaggedTemplateExpression') return false;
  return true;
}

export function extractFromCode(code, file = 'x.tsx') {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });
  const found = [];
  const add = (s) => {
    if (typeof s !== 'string') return;
    // le stringhe multi-riga vanno normalizzate (spazi collassati)
    const n = norm(s);
    if (n && isItalianLike(n)) found.push(n);
  };
  const visit = (node, ctx, parent) => {
    if ((node.type === 'StringLiteral' || node.type === 'TemplateLiteral') && genericOk(node, parent)) strings(node).forEach(add);
    switch (node.type) {
      case 'JSXText': {
        const n = norm(node.value);
        if (/\p{L}/u.test(n)) add(n);
        break;
      }
      case 'JSXAttribute': {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name && TEXT_ATTRS.has(name) && node.value) {
          if (node.value.type === 'StringLiteral') add(node.value.value);
          else if (node.value.type === 'JSXExpressionContainer') strings(node.value.expression).forEach(add);
        }
        break;
      }
      case 'JSXExpressionContainer': {
        if (ctx.inJsxChild) strings(node.expression).forEach(add);
        break;
      }
      case 'CallExpression': {
        const nm = calleeName(node.callee);
        if (CALL_FUNCS.has(nm) || nm === 'Alert.alert' || nm === 'Share.share') {
          if (nm === 'Share.share') {
            for (const a of node.arguments) if (a.type === 'ObjectExpression') for (const p of a.properties) {
              if (p.type === 'ObjectProperty' && ['message', 'title'].includes(keyName(p))) strings(p.value).forEach(add);
            }
          } else if (nm === 'Alert.alert') {
            node.arguments.slice(0, 2).forEach((a) => strings(a).forEach(add));
            const btns = node.arguments[2];
            if (btns && btns.type === 'ArrayExpression') for (const b of btns.elements) if (b && b.type === 'ObjectExpression') for (const p of b.properties) {
              if (p.type === 'ObjectProperty' && keyName(p) === 'text') strings(p.value).forEach(add);
            }
          } else {
            node.arguments.slice(0, 1).forEach((a) => strings(a).forEach(add));
          }
        }
        break;
      }
      case 'ObjectProperty': {
        const k = keyName(node);
        if (k && TEXT_KEYS.has(k)) {
          const v = node.value;
          if (v.type === 'ArrayExpression') { for (const el of v.elements) if (el) strings(el).forEach(add); }
          else strings(v).forEach(add);
        }
        break;
      }
      default: break;
    }
    const isJsxEl = node.type === 'JSXElement' || node.type === 'JSXFragment';
    for (const c of childrenOf(node)) {
      let childCtx = ctx;
      if (isJsxEl && node.children && node.children.includes(c)) childCtx = { inJsxChild: true };
      else if (node.type === 'JSXExpressionContainer' || node.type === 'JSXAttribute') childCtx = { inJsxChild: false };
      else if (c.type !== 'ConditionalExpression' && c.type !== 'LogicalExpression' && c.type !== 'ParenthesizedExpression' && !isJsxEl) childCtx = ctx;
      visit(c, childCtx, node);
    }
  };
  visit(ast.program, { inJsxChild: false }, null);
  return found;
}

function main() {
  const files = walkFiles(SRC).sort();
  const all = new Set();
  const byFile = {};
  const origin = new Map();
  for (const f of files) {
    let list;
    try { list = extractFromCode(fs.readFileSync(path.join(ROOT, f), 'utf8'), f); }
    catch (e) { console.error('ERRORE parse', f, e.message); process.exitCode = 1; continue; }
    const uniq = new Set(list);
    if (uniq.size) byFile[f] = uniq.size;
    for (const s of uniq) { all.add(s); if (!origin.has(s)) origin.set(s, f); }
  }
  for (const e of EXTRA) all.add(e);
  for (const n of NOISE) all.delete(n);
  const sorted = [...all].sort((a, b) => a.localeCompare(b, 'it') || (a < b ? -1 : 1));
  const withPlaceholders = sorted.filter((s) => /\{\d+\}/.test(s)).length;
  fs.mkdirSync(path.join(SRC, 'i18n'), { recursive: true });
  fs.writeFileSync(path.join(SRC, 'i18n/source.json'), JSON.stringify(sorted, null, 1) + '\n');
  fs.writeFileSync(path.join(SRC, 'i18n/source.meta.json'), JSON.stringify({ count: sorted.length, byFile, withPlaceholders }, null, 1) + '\n');
  if (process.argv.includes('--origin')) fs.writeFileSync(path.join(process.env.TMPDIR || '/tmp', 'i18n-origin.json'), JSON.stringify(Object.fromEntries(origin), null, 1));
  console.log(`source.json: ${sorted.length} voci (${withPlaceholders} con segnaposto), ${files.length} file visitati`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
