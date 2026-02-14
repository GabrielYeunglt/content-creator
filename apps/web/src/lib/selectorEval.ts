import type { ExtractMode, SelectorType } from '../types/profile';

function pickByCss(document: Document, selector: string): Element | null {
  return document.querySelector(selector);
}

function pickByXpath(document: Document, selector: string): Node | null {
  const result = document.evaluate(
    selector,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );

  return result.singleNodeValue;
}

function firstNode(document: Document, selectorType: SelectorType, selector: string): Node | null {
  if (selectorType === 'css') {
    return pickByCss(document, selector);
  }

  return pickByXpath(document, selector);
}

export function extractFieldFromHtml(params: {
  html: string;
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
}): { ok: true; value: string } | { ok: false; error: string } {
  const { html, selector, selectorType, extractMode, attributeName } = params;

  try {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const node = firstNode(document, selectorType, selector);

    if (!node) {
      return { ok: false, error: 'No node matched selector.' };
    }

    if (!(node instanceof Element)) {
      return { ok: false, error: 'Matched node is not an HTML element.' };
    }

    if (extractMode === 'html') {
      return { ok: true, value: node.innerHTML.trim() };
    }

    if (extractMode === 'text') {
      return { ok: true, value: (node.textContent ?? '').trim() };
    }

    const attr = (attributeName ?? 'href').trim();
    return { ok: true, value: node.getAttribute(attr)?.trim() ?? '' };
  } catch {
    return { ok: false, error: 'Selector evaluation failed.' };
  }
}

export function extractNextUrlFromHtml(params: {
  html: string;
  selectorType: SelectorType;
  selector: string;
  attributeName: string;
}): { ok: true; value: string } | { ok: false; error: string } {
  const { html, selectorType, selector, attributeName } = params;

  try {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const node = firstNode(document, selectorType, selector);

    if (!node) {
      return { ok: false, error: 'No next-button node matched selector.' };
    }

    if (!(node instanceof Element)) {
      return { ok: false, error: 'Matched next node is not an HTML element.' };
    }

    const nextValue = node.getAttribute(attributeName)?.trim() ?? '';
    return { ok: true, value: nextValue };
  } catch {
    return { ok: false, error: 'Pagination selector evaluation failed.' };
  }
}
