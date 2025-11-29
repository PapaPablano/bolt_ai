import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { fetchStockSearch, type SearchHit } from '@/lib/api';

interface SearchBarProps {
  onSelectSymbol: (symbol: string) => void;
}

export function SearchBar({ onSelectSymbol }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const isExpanded = showResults && results.length > 0;
  const ariaExpandedValue = isExpanded ? 'true' : 'false';

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setErr(null);
      setShowResults(false);
      setHighlightIndex(-1);
      return;
    }

    setLoading(true);
    setErr(null);

    const t = setTimeout(async () => {
      try {
        const hits = await fetchStockSearch(q, { limit: 8 });
        setResults(hits);
        setShowResults(true);
        setHighlightIndex(hits.length ? 0 : -1);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
        setResults([]);
        setShowResults(false);
        setHighlightIndex(-1);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setShowResults(false);
      setHighlightIndex(-1);
      return;
    }

    if (!showResults || results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((prev) => {
        if (results.length === 0) return -1;
        const next = prev < 0 ? 0 : Math.min(prev + 1, results.length - 1);
        return next;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((prev) => {
        if (results.length === 0) return -1;
        const next = prev < 0 ? results.length - 1 : Math.max(prev - 1, 0);
        return next;
      });
    } else if (event.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        event.preventDefault();
        handleSelect(results[highlightIndex].symbol);
      }
    }
  };

  useEffect(() => {
    if (highlightIndex < 0) {
      return;
    }
    if (highlightIndex >= results.length) {
      setHighlightIndex(results.length ? results.length - 1 : -1);
      return;
    }

    const container = resultsRef.current;
    if (!container) {
      return;
    }

    const activeOption = container.querySelector<HTMLButtonElement>(`#search-result-${highlightIndex}`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, results.length]);

  return (
    <div className="relative w-full max-w-md" role="search" aria-label="Search stocks">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
        <label htmlFor="stock-search" className="sr-only">
          Search for stocks by symbol or company name
        </label>
        <input
          id="stock-search"
          type="search"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
            setHighlightIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search stocks..."
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-expanded={ariaExpandedValue}
          aria-haspopup="listbox"
          role="combobox"
        />
        {err && (
          <div className="mt-1 text-xs text-red-400" aria-live="polite">
            {err}
          </div>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-live="polite" aria-label="Searching">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showResults && query.trim() && (
        <div
          id="search-results"
          role="listbox"
          aria-activedescendant={highlightIndex >= 0 ? `search-result-${highlightIndex}` : undefined}
          aria-label="Stock search results"
          className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg shadow-black/20 max-h-80 overflow-y-auto z-50"
          ref={resultsRef}
        >
          {results.map((result, idx) => {
            const isHighlighted = idx === highlightIndex;
            const ariaSelectedValue = isHighlighted ? 'true' : 'false';
            return (
              <button
                id={`search-result-${idx}`}
                key={result.symbol}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(result.symbol);
                }}
                role="option"
                aria-selected={ariaSelectedValue}
                className={`w-full px-4 py-3 text-left transition-colors border-b border-slate-700 last:border-b-0 ${
                  isHighlighted ? 'bg-slate-700' : 'hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{result.symbol}</div>
                    {result.name && <div className="text-xs text-slate-400">{result.name}</div>}
                  </div>
                  {result.exchange && <div className="text-xs text-slate-500">{result.exchange}</div>}
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
