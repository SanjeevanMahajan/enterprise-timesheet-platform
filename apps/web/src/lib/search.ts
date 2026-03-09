// In dev: NEXT_PUBLIC_SEARCH_URL=http://localhost:8003 → calls http://localhost:8003/api/search
// In prod: NEXT_PUBLIC_SEARCH_URL=                     → calls /api/search (Nginx proxies)
const SEARCH_URL =
  process.env.NEXT_PUBLIC_SEARCH_URL ?? "http://localhost:8003";

export interface SearchHit {
  id: string;
  type: "project" | "timelog" | "invoice";
  [key: string]: unknown;
}

export interface SearchResults {
  query: string;
  total_hits: number;
  results: {
    projects: SearchHit[];
    timelogs: SearchHit[];
    invoices: SearchHit[];
  };
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const url = SEARCH_URL
    ? `${SEARCH_URL}/api/search?q=${encodeURIComponent(query)}`
    : `/api/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }
  return res.json() as Promise<SearchResults>;
}
