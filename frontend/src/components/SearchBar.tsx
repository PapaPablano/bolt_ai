import { useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface SearchBarProps {
  onSelectSymbol: (symbol: string) => void;
}

export function SearchBar({ onSelectSymbol }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);

    if (searchQuery.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('stock-search', {
        body: { query: searchQuery }
      });

      if (error) throw error;
      setResults(data.results || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search stocks..."
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          aria-controls="search-results"
          aria-expanded={showResults && results.length > 0}
          aria-autocomplete="list"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-live="polite" aria-label="Searching">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div
          id="search-results"
          role="listbox"
          aria-label="Stock search results"
          className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg shadow-black/20 max-h-80 overflow-y-auto z-50"
        >
          {results.map((result) => (
            <button
              key={result.symbol}
              onClick={() => handleSelect(result.symbol)}
              role="option"
              aria-selected="false"
              className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{result.symbol}</div>
                  <div className="text-xs text-slate-400">{result.name}</div>
                </div>
                <div className="text-xs text-slate-500">{result.exchange}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
