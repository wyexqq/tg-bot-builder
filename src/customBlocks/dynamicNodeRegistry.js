const registry = new Map();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function registerCodeBlock(defId, { Component, InspectorComponent, generatorFn, parserFn }) {
  registry.set(defId, { Component, InspectorComponent, generatorFn, parserFn });
  notify();
}

export function unregisterCodeBlock(defId) {
  registry.delete(defId);
  notify();
}

export function getCodeBlockComponent(defId) {
  return registry.get(defId)?.Component ?? null;
}

export function getCodeBlockInspector(defId) {
  return registry.get(defId)?.InspectorComponent ?? null;
}

export function getCodeBlockGenerator(defId) {
  return registry.get(defId)?.generatorFn ?? null;
}

export function getCodeBlockParser(defId) {
  return registry.get(defId)?.parserFn ?? null;
}

export function getNodeTypesSnapshot() {
  const result = {};
  registry.forEach(({ Component }, defId) => {
    result[`codeblock_${defId}`] = Component;
  });
  return result;
}

export function subscribeRegistry(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAllRegistered() {
  return [...registry.entries()].map(([defId, v]) => ({ defId, ...v }));
}
