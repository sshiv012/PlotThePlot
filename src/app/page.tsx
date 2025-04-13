"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, BookmarkPlus, Share2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LandingPage from "@/components/LandingPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const formatDateTime = (utcDateString: string) => {
  // Create a date object from the UTC string
  const utcDate = new Date(utcDateString);
  
  // Get the timezone offset in minutes
  const offset = utcDate.getTimezoneOffset();
  
  // Create a new date adjusted for the local timezone
  const localDate = new Date(utcDate.getTime() - offset * 60000);
  
  // Format in local time zone
  return localDate.toLocaleString('en-US', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');
};

const Graph = dynamic(() => import("@/components/GraphVisualizer"), {
  ssr: false,
});

type User = {
  id?: number;
  username: string;
};

type BookmarkPreview = {
  id: string;
  book_id: string;
  title: string;
  created_at: string;
  note: string | null;
};

type TrendingBook = {
  book_id: string;
  title: string;
  search_count: number;
  last_searched: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [bookId, setBookId] = useState("");
  const [validate, setValidate] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkPreview[]>([]);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authError, setAuthError] = useState("");
  const [note, setNote] = useState("");
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<BookmarkPreview | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('user');
        
        if (!token || !storedUsername) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${BASE_URL}/api/auth/check`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors'
        });

        if (res.ok) {
          setUser({ username: storedUsername });
          setIsAuthenticated(true);
          await Promise.all([
            fetchBookmarks(),
            fetchTrending(),
            fetchUserHistory()
          ]);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/auth/bookmarks/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/trending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTrending(data);
      }
    } catch (e) {
      console.error("Failed to fetch trending:", e);
    }
  };

  const fetchUserHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const res = await fetch(`${BASE_URL}/api/auth/search/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUserHistory(data);
      } else {
        console.error("Failed to fetch user history:", res.status);
      }
    } catch (e) {
      console.error("Failed to fetch user history:", e);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      setBookmarks([]);
      window.location.reload();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    setError("");
    setLoading(true);
    setJsonData(null);
    setValidation(null);
    setNote("");
    setCurrentBookmark(null);

    try {
      let input = bookId.trim();
      const match = input.match(/gutenberg\.org\/ebooks\/(\d+)/);
      if (match) input = match[1];

      const parsedId = parseInt(input);
      if (isNaN(parsedId)) {
        setError("Please enter a valid Gutenberg Book ID or URL");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ book_id: parsedId, validate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API request failed");
      }

      const data = await res.json();
      setJsonData(data);
      if (data.validation) {
        setValidation(data.validation);
      }

      await Promise.all([
        fetchUserHistory(),
        fetchBookmarks(),
        fetchTrending()
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleHistoryClick = (history: any) => {
    setBookId(history.book_id);
    setValidate(false);
    scrollToTop();
    // Add visual feedback
    const input = document.getElementById('bookIdInput');
    if (input) {
      input.focus();
      input.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        input.classList.remove('ring-2', 'ring-blue-500');
      }, 1000);
    }
  };

  const handleBookmarkClick = async (bookmarkId: string) => {
    try {
      setIsLoadingBookmark(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/auth/bookmarks/${bookmarkId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBookmark(data);
        setBookId(data.book_id);
        setJsonData(data.response_data.analysis);
        setValidation(data.response_data.validation);
        setNote(data.note || "");
        scrollToTop();
        // Add visual feedback
        const input = document.getElementById('bookIdInput');
        if (input) {
          input.focus();
          input.classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            input.classList.remove('ring-2', 'ring-blue-500');
          }, 1000);
        }
      }
    } catch (e) {
      console.error("Failed to fetch bookmark:", e);
    } finally {
      setIsLoadingBookmark(false);
    }
  };

  const handleBookmark = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/auth/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          book_id: bookId,
          title: jsonData?.title || 'Unknown Book',
          response_data: {
            analysis: jsonData,
            validation: validation
          },
          note: note
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add bookmark');
      }

      const data = await res.json();
      setError('');
      setNote('');
      // Refresh bookmarks list
      fetchBookmarks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleTrendingClick = (book: TrendingBook) => {
    setBookId(book.book_id);
    setValidate(false);
    setCurrentBookmark(null);
    scrollToTop();
    // Add visual feedback
    const input = document.getElementById('bookIdInput');
    if (input) {
      input.focus();
      input.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        input.classList.remove('ring-2', 'ring-blue-500');
      }, 1000);
    }
  };

  const handleHeaderClick = () => {
    setShowLandingPage(true);
  };

  const handleShare = async () => {
    if (!user || !jsonData) return;
    
    setIsSharing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          book_id: bookId,
          title: jsonData.title,
          response_data: jsonData,
          note: note
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create share link');
      }

      const data = await res.json();
      const shareUrl = `${window.location.origin}/share/${data.share_id}`;
      setShareLink(shareUrl);
      setShowShareDialog(true);
    } catch (err) {
      toast.error('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated || showLandingPage) {
    return <LandingPage />;
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
        <div>
          <h1 
            className="text-3xl font-bold cursor-pointer hover:text-gray-600 transition-colors"
            onClick={handleHeaderClick}
          >
            PlotThePlot Visualizer
          </h1>
          {user && (
            <p className="text-sm text-gray-600 mt-1">Welcome, {user.username}</p>
          )}
        </div>
        {user && (
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">
              Analyze a Book from{" "}
              <a
                href="https://www.gutenberg.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 underline hover:text-gray-800"
              >
                Project Gutenberg
              </a>
            </h2>

            <Input
              id="bookIdInput"
              type="text"
              placeholder="Enter Book ID (e.g., 16) or full Gutenberg URL"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
            />

            <div className="text-sm text-gray-600">
              Example books:
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { title: "Peter Pan", id: "16" },
                  { title: "Hamlet", id: "1787" },
                  { title: "Romeo & Juliet", id: "1513" },
                  { title: "Julius Caesar", id: "1522" },
                ].map((book) => (
                  <button
                    key={book.id}
                    className="text-blue-600 underline hover:text-blue-800"
                    onClick={() => {
                      setBookId(book.id);
                      setValidate(false);
                    }}
                  >
                    {book.title} ({book.id})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={validate}
                onChange={(e) => setValidate(e.target.checked)}
                className="mt-1"
              />
              <div className="text-sm leading-snug">
                <strong>Validate output</strong>
                <p className="text-gray-600">
                  Checks accuracy of extracted characters and relationships
                </p>
              </div>
            </div>

            <Button onClick={handleAnalyze} disabled={!bookId || loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </Card>

          {jsonData && (
            <div className="border rounded-xl p-4 bg-white shadow">
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Character Analysis</h2>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleBookmark}
                      className="flex items-center gap-2"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      Save Bookmark
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleShare}
                      disabled={isSharing}
                      className="flex items-center gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="note" className="text-sm font-medium">Add a note (optional)</label>
                  <textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add your thoughts about this analysis..."
                    className="w-full p-2 border rounded-md min-h-[80px] resize-none"
                    readOnly={!!currentBookmark}
                  />
                </div>
                {currentBookmark && (
                  <div className="text-sm text-gray-500">
                    Loaded from bookmark: {currentBookmark.title}
                  </div>
                )}
              </div>
              <Graph data={jsonData} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User History */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Your History</h2>
            {userHistory.length === 0 ? (
              <p className="text-gray-500">No search history yet</p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {userHistory
                    .sort((a, b) => new Date(b.search_date).getTime() - new Date(a.search_date).getTime())
                    .map((history, index) => (
                      <div
                        key={`${history.book_id}-${history.search_date}`}
                        className="p-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleHistoryClick(history)}
                      >
                        <h3 className="font-medium">{history.title}</h3>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>ID: {history.book_id}</span>
                          <span>{formatDateTime(history.search_date)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Bookmarks */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Your Bookmarks</h2>
            {bookmarks.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No bookmarks yet</AlertTitle>
                <AlertDescription>
                  Analyze a book to create bookmarks
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className={`p-2 rounded-lg border hover:bg-gray-50 cursor-pointer ${
                        currentBookmark?.id === bookmark.id ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => handleBookmarkClick(bookmark.id)}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{bookmark.title} <span className="text-sm text-gray-500">(ID: {bookmark.book_id})</span></h3>
                      </div>
                      <div className="flex justify-between items-end mt-1">
                        {bookmark.note ? (
                          <span className="text-sm text-gray-500">{bookmark.note}</span>
                        ) : (
                          <span className="text-sm text-gray-500">No note</span>
                        )}
                        <span className="text-sm text-gray-500">{formatDateTime(bookmark.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Trending */}
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
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {trending
                    .sort((a, b) => b.search_count - a.search_count)
                    .map((book) => (
                      <div
                        key={book.book_id}
                        className="p-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleTrendingClick(book)}
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
              </ScrollArea>
            )}
          </Card>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Analysis</DialogTitle>
            <DialogDescription>
              Share this analysis with others using the link below
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={shareLink}
              readOnly
              className="flex-1"
            />
            <Button onClick={copyToClipboard}>
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}