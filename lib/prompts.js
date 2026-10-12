/**
  * Prompt template tool. Supports the recommended {{variable}} form and stays compatible with {variable} from the early design drafts.
  * User input is used only in the browser dialog currently open and is never persisted to the catalog or the Host.
 */

const TOKEN_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}\}|\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}/g;

export function listPromptVariables(text) {
  const names = [];
  const seen = new Set();
  for (const match of String(text ?? '').matchAll(TOKEN_RE)) {
    const name = match[1] ?? match[2];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function renderPromptTemplate(text, values = {}, variables = []) {
  const specs = new Map(variables.map((variable) => [variable.name, variable]));
  const missing = [];
  const rendered = String(text ?? '').replace(TOKEN_RE, (_token, doubleName, singleName) => {
    const name = doubleName ?? singleName;
    const spec = specs.get(name);
    const value = String(values[name] ?? spec?.default ?? '').trim();
    if (!value && spec?.required !== false) missing.push(spec?.label ?? name);
    return value;
  });
  if (missing.length > 0) throw new Error(`Please fill in: ${[...new Set(missing)].join(', ')}`);
  return rendered.replace(/\s+([，。！？；：])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}
