// Remembers the admin orders list (filters, page, and the order ids on that page) in
// sessionStorage so the detail page can go back to the same view and step prev/next.

const LIST_QS_KEY = 'orders-list-qs';
const SNAPSHOT_KEY = 'orders-list-snapshot';

export interface OrdersSnapshot {
  /** Filter query string WITHOUT `page`. */
  baseQs: string;
  page: number;
  pages: number;
  ids: string[];
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — navigation still works, just without restore
  }
}

export const saveListQs = (qs: string): void => write(LIST_QS_KEY, qs);
export const loadListQs = (): string | null => read<string>(LIST_QS_KEY);
export const saveSnapshot = (s: OrdersSnapshot): void => write(SNAPSHOT_KEY, s);
export const loadSnapshot = (): OrdersSnapshot | null => read<OrdersSnapshot>(SNAPSHOT_KEY);
