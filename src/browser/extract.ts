/**
 * DOM extraction used by declarative browser adapters.
 *
 * This function is written with only standard DOM APIs so the exact same code
 * runs in two places: in unit tests via jsdom, and injected into a live page
 * over CDP (see adapter-runtime.ts, which serializes it with .toString()).
 * Keep it dependency-free and side-effect-free.
 */

export interface FieldSpec {
  /** CSS selector relative to the item; omit to use the item element itself */
  selector?: string;
  /** read this attribute instead of text content (e.g. "href", "src") */
  attr?: string;
  /** for href/src, return the browser-resolved absolute URL instead of the raw attribute */
  absolute?: boolean;
}

export interface ListSpec {
  /** selector matching each repeated item (row) on the page */
  selector: string;
  /** max rows to return */
  limit?: number;
  /** map of output field name -> how to read it from the item */
  fields: Record<string, FieldSpec>;
}

export function extractRows(root: Document | Element, spec: ListSpec): Record<string, string>[] {
  const items = Array.prototype.slice.call(root.querySelectorAll(spec.selector), 0, spec.limit ?? 25);
  return items.map((item: Element) => {
    const row: Record<string, string> = {};
    for (const key of Object.keys(spec.fields)) {
      const f = spec.fields[key];
      const el = f.selector ? item.querySelector(f.selector) : item;
      if (!el) {
        row[key] = '';
        continue;
      }
      if (f.attr) {
        // For href/src, the DOM property is already resolved to an absolute URL.
        const prop = f.absolute ? (el as unknown as Record<string, unknown>)[f.attr] : undefined;
        row[key] = typeof prop === 'string' && prop ? prop : (el.getAttribute(f.attr) ?? '');
      } else {
        row[key] = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      }
    }
    return row;
  });
}
