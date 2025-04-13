"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

const Graph = dynamic(() => import("@/components/GraphVisualizer"), {
  ssr: false,
});

type SharedAnalysis = {
  id: string;
  book_id: string;
  title: string;
  response_data: any;
  created_at: string;
  shared_by: string;
  note?: string;
};

type TrendingBook = {
  book_id: string;
  title: string;
  search_count: number;
  last_searched: string;
};

const formatDateTime = (utcDateString: string) => {
  const utcDate = new Date(utcDateString);
  const offset = utcDate.getTimezoneOffset();
  const localDate = new Date(utcDate.getTime() - offset * 60000);
  return localDate.toLocaleString('en-US', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');
};

export default function SharePage() {
  const [analysis, setAnalysis] = useState<SharedAnalysis | null>(null);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const shareId = params.shareId as string;

  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!shareId) {
          setError("No share ID provided");
          setLoading(false);
          return;
        }

        const [analysisRes, trendingRes] = await Promise.all([
          fetch(`${BASE_URL}/api/share/${shareId}`),
          fetch(`${BASE_URL}/api/trending`)
        ]);

        if (!analysisRes.ok) {
          throw new Error("Failed to fetch shared analysis");
        }

        const analysisData = await analysisRes.json();
        setAnalysis(analysisData);

        if (trendingRes.ok) {
          const trendingData = await trendingRes.json();
          setTrending(trendingData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Analysis not found or expired"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
        <div>
          <h1 
            className="text-3xl font-bold cursor-pointer hover:text-gray-600 transition-colors"
            onClick={() => window.location.href = '/'}
          >
            PlotThePlot Visualizer
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Shared by {analysis.shared_by} on {formatDateTime(analysis.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">{analysis.title}</h2>
            {analysis.note && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">{analysis.note}</p>
              </div>
            )}
            <Graph data={analysis.response_data} />
          </Card>
        </div>

        {/* Trending Section */}
        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Trending Books</h2>
            {trending.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No trending data</AlertTitle>
                <AlertDescription>
                  No books have been analyzed yet
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {trending
                  .sort((a, b) => b.search_count - a.search_count)
                  .map((book) => (
                    <div
                      key={book.book_id}
                      className="p-2 rounded-lg border hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{book.title} <span className="text-sm text-gray-500">(ID: {book.book_id})</span></h3>
                      </div>
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-sm text-gray-500">{book.search_count} analyses</span>
                        <span className="text-sm text-gray-500">{formatDateTime(book.last_searched)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
} 