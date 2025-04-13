import { Button } from "@/components/ui/button";
import { BookOpen, Network, TrendingUp, Bookmark, MousePointer, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const funnyErrorMessages = [
  "Oops! Our bookworms are taking a coffee break ☕",
  "Looks like our story got a bit tangled! 📚",
  "The plot thickens... but our server is taking a nap 😴",
  "Our characters are having an identity crisis! 🎭",
  "The library is temporarily closed for storytime 📖",
  "Our book fairies are reorganizing the shelves ✨",
  "The story got lost in translation... temporarily! 🌍",
  "Our digital librarian is on a quest for more books 🧙‍♂️",
];

type TrendingBook = {
  book_id: string;
  title: string;
  search_count: number;
  last_searched: string;
};

const formatDateTime = (utcDateString: string) => {
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

export default function LandingPage() {
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/trending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors'
      });
      if (res.ok) {
        const data = await res.json();
        setTrending(data);
      } else {
        console.error("Failed to fetch trending:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch trending:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const endpoint = isSignUp ? 'register' : 'login';
      const res = await fetch(`${BASE_URL}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        mode: 'cors',
        body: JSON.stringify({ username, password }),
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', username);
        setShowAuth(false);
        window.location.reload();
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`);
        setShowError(true);
      }
    } catch (err) {
      const randomMessage = funnyErrorMessages[Math.floor(Math.random() * funnyErrorMessages.length)];
      setError(randomMessage);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetStarted = () => {
    const token = localStorage.getItem('token');
    if (token) {
      window.location.href = '/';
    } else {
      setShowAuth(true);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 px-4 text-center">
        <h1 className="text-5xl font-bold mb-6">PlotThePlot</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Visualize character relationships and story arcs from your favorite books.
          Dive deep into the narrative structure and discover hidden connections.
        </p>
        <div className="flex gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-black hover:bg-gray-800 text-white text-lg px-8 py-6"
            onClick={handleGetStarted}
          >
            Get Started
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4 italic px-4">
          <span className="hidden sm:inline">Pro tip: </span>Works best with <span className="font-semibold">fictional books</span> 📚✨
        </p>
      </section>

      {/* Trending Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What's Trending 📚</h2>
          {loading ? (
            <div className="text-center text-gray-500">Loading trending books...</div>
          ) : trending.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trending.slice(0, 6).map((book) => (
                <Card key={book.book_id} className="p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold line-clamp-2">{book.title}</h3>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-sm text-gray-500">Last searched at {formatDateTime(book.last_searched)}</span>
                    <span className="text-sm font-medium">{book.search_count} analyses</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-block p-8 rounded-lg bg-white border border-gray-200">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Trending Books Yet</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Be the first to analyze a book and start the trend! Your analysis could be featured here.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Book Analysis */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <BookOpen className="w-8 h-8 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">Book Analysis</h3>
              <p className="text-gray-600">
                Extract and visualize character relationships from <span className="font-semibold">any Project Gutenberg book</span>.
              </p>
            </div>

            {/* Interactive Visualizations */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Network className="w-8 h-8 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">Interactive Visualizations</h3>
              <p className="text-gray-600 mb-4">
                Explore character networks with interactive graphs and relationship maps.
                Hover over nodes and edges to discover character details and relationships.
              </p>
            </div>

            {/* Trending Analysis */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <TrendingUp className="w-8 h-8 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">Trending Analysis</h3>
              <p className="text-gray-600">
                Discover <span className="font-semibold">popular books</span> and see what others are analyzing.
              </p>
            </div>

            {/* Personal Bookmarks */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Bookmark className="w-8 h-8 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">Personal Bookmarks</h3>
              <p className="text-gray-600">
                <span className="font-semibold">Save your favorite analyses</span> and access them anytime.
              </p>
            </div>

            {/* Share Analysis */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Share2 className="w-8 h-8 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">Share Analysis</h3>
              <p className="text-gray-600">
                Share your analysis with others through a <span className="font-semibold">unique link</span>. <span className="font-semibold">No login required</span> to view.
              </p>
            </div>

            {/* Validation */}
            <div className="p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-8 h-8 mb-4 text-gray-600">✓</div>
              <h3 className="text-xl font-semibold mb-2">Validation</h3>
              <p className="text-gray-600">
                <span className="font-semibold">Verify the accuracy</span> of character relationships and story elements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Auth Dialog */}
      <Dialog open={showAuth} onOpenChange={setShowAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {isSignUp ? "Join PlotThePlot" : "Welcome Back"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isSignUp 
                ? "Create your account to start analyzing books"
                : "Sign in to continue your literary journey"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-black hover:bg-gray-800 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </div>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </Button>
            <p className="text-sm text-center text-gray-500">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                type="button" 
                className="text-gray-600 hover:underline"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showError} onOpenChange={setShowError}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Whoops! 🎭</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-700">{error}</p>
          </div>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setShowError(false)}
              className="border-gray-200 hover:bg-gray-50"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 