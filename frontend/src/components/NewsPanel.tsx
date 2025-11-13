import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  symbols: string[];
  source: string;
}

interface NewsPanelProps {
  symbol: string;
}

export function NewsPanel({ symbol }: NewsPanelProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('stock-news', {
          body: { symbol }
        });

        if (error) throw error;
        setArticles(data.news || []);
      } catch (error) {
        console.error('Error fetching news:', error);
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, [symbol]);

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 h-[600px]">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-slate-100">Latest News</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 h-[600px] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-slate-100">Latest News</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {articles.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No news available for {symbol}
          </div>
        ) : (
          articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2">
                  {article.headline}
                </h4>
                <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-xs text-slate-400 mb-2 line-clamp-2">{article.summary}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{article.source || article.author}</span>
                <span>{formatTime(article.created_at)}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
