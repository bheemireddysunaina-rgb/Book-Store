import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { 
  db, 
  auth, 
  seedBooksIfEmpty, 
  testConnection, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { Book, CartItem } from "./types";

// Import Custom Modular Components
import Header from "./components/Header";
import BookCard from "./components/BookCard";
import BookDetailsModal from "./components/BookDetailsModal";
import CartDrawer from "./components/CartDrawer";
import AIRecommender from "./components/AIRecommender";
import OrdersList from "./components/OrdersList";
import AdminDashboard from "./components/AdminDashboard";

import { 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Award
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  
  const [activeTab, setActiveTab] = useState<string>("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  
  // Shopping Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Global checkout notifications
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Persist cart items
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Firebase connection checks, seeding & auth monitoring
  useEffect(() => {
    testConnection();

    // Subscribe to Firebase Authentication state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    // Seed book catalog if empty, then attach real-time listener
    const initStore = async () => {
      await seedBooksIfEmpty();
      
      const booksPath = "books";
      const q = query(collection(db, booksPath), orderBy("createdAt", "desc"));
      
      const unsubscribeBooks = onSnapshot(
        q,
        (snapshot) => {
          const loadedBooks: Book[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedBooks.push({
              id: docSnap.id,
              title: data.title,
              author: data.author,
              description: data.description,
              genre: data.genre,
              price: data.price,
              coverUrl: data.coverUrl,
              rating: data.rating,
              stock: data.stock,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });
          setBooks(loadedBooks);
          setLoadingBooks(false);
        },
        (error) => {
          console.error("Vite: failed to sync books catalog:", error);
          handleFirestoreError(error, OperationType.GET, booksPath);
        }
      );

      return unsubscribeBooks;
    };

    let unsubscribeBooksPromise = initStore();

    return () => {
      unsubscribeAuth();
      unsubscribeBooksPromise.then(unsub => unsub?.());
    };
  }, []);

  // Cart Management Functions
  const handleAddToCart = (book: Book) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.bookId === book.id);
      if (existing) {
        if (existing.quantity >= book.stock) {
          alert(`Sorry, only ${book.stock} copies are in stock.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.bookId === book.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          bookId: book.id,
          title: book.title,
          author: book.author,
          price: book.price,
          quantity: 1,
          coverUrl: book.coverUrl,
        },
      ];
    });
    // Visual feedback
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (bookId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.bookId === bookId) {
            const targetBook = books.find((b) => b.id === bookId);
            const newQty = item.quantity + delta;
            
            if (targetBook && newQty > targetBook.stock) {
              alert(`Only ${targetBook.stock} copies of this book are available.`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const handleRemoveItem = (bookId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.bookId !== bookId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Filter books based on active sidebar and search query
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenre = selectedGenre === "All" || book.genre === selectedGenre;
    
    return matchesSearch && matchesGenre;
  });

  const uniqueGenres = ["All", ...Array.from(new Set(books.map((b) => b.genre)))];
  const isUserAdmin = user?.email === "bheemireddysunaina@gmail.com";

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-800">
      
      {/* Header bar */}
      <Header
        user={user}
        loadingAuth={loadingAuth}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Global Success Banner */}
      {orderSuccess && (
        <div className="mx-auto mt-4 max-w-4xl w-full px-4 sm:px-6">
          <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-150 p-4 shadow-sm text-emerald-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Checkout Successful!</p>
                <p className="text-xs text-emerald-600 mt-0.5">Your books order has been placed. You can track progress in the Orders tab.</p>
              </div>
            </div>
            <button 
              onClick={() => setOrderSuccess(false)}
              className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1">
        
        {/* CATALOG VIEW TAB */}
        {activeTab === "catalog" && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            
            {/* Promo hero banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-8 md:p-12 mb-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="relative z-10 max-w-xl">
                <span className="bg-indigo-500 rounded text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mb-4 inline-block">
                  SPOTLIGHT RELEASES
                </span>
                <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl mt-1 leading-tight">
                  Find your next favorite book today.
                </h2>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-md">
                  Browse a curated library of best-selling literature, write deep community reviews, and get customized AI book choices instantly.
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <button 
                    onClick={() => setActiveTab("recommendations")}
                    className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all"
                  >
                    Try AI Finder
                  </button>
                  <span className="text-xs font-mono text-slate-400">
                    Free shipping on orders over $50
                  </span>
                </div>
              </div>
              
              {/* Elegant 3D-like book illustration container on the right */}
              <div className="relative w-40 h-52 shrink-0 hidden md:block">
                <div className="w-32 h-44 bg-indigo-600 rounded shadow-2xl absolute right-8 top-4 border-l-4 border-indigo-500 transform rotate-6 transition-transform hover:rotate-2 duration-300">
                  <div className="p-3 h-full flex flex-col justify-between text-white">
                    <BookOpen className="h-6 w-6 opacity-80" />
                    <div className="font-sans font-bold text-[10px] leading-tight">THE ART OF COGNITION</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Catalog Grid + Sidebar layout */}
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Left Sidebar: Genre categories filtering */}
              <div className="w-full lg:w-48 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 block">
                  Genres
                </p>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-1 scrollbar-none">
                  {uniqueGenres.map((genre) => {
                    const count = books.filter(b => b.genre === genre).length;
                    return (
                      <button
                        key={genre}
                        onClick={() => setSelectedGenre(genre)}
                        className={`whitespace-nowrap flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all w-full text-left ${
                          selectedGenre === genre
                            ? "bg-slate-100 text-indigo-600 font-bold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        <span>{genre}</span>
                        {genre !== "All" && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            selectedGenre === genre ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Premium promotion banner */}
                <div className="mt-8 bg-indigo-600 rounded-xl text-white p-5 shadow-sm hidden lg:block">
                  <Sparkles className="h-5 w-5 text-indigo-200 mb-3" />
                  <h4 className="font-bold text-sm mb-1">Premium Books Club</h4>
                  <p className="text-[11px] text-indigo-100 leading-relaxed mb-4">Get access to custom digital reading logs & unlimited AI reviews.</p>
                  <button 
                    onClick={() => setActiveTab("recommendations")}
                    className="w-full bg-white text-indigo-600 font-bold text-[10px] uppercase tracking-wider py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Join for Free
                  </button>
                </div>
              </div>

              {/* Right Side: Books list */}
              <div className="flex-1">
                {loadingBooks ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
                  </div>
                ) : filteredBooks.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl">
                    <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-800">No books matched your criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing your filters or search query!</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onViewDetails={(b) => setSelectedBook(b)}
                        onAddToCart={handleAddToCart}
                        isAdmin={isUserAdmin}
                        onEdit={(b) => {
                          setSelectedBook(null);
                          setActiveTab("admin");
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* AI RECOMENDER TAB */}
        {activeTab === "recommendations" && (
          <AIRecommender
            currentCart={cart}
            onAddToCart={handleAddToCart}
            isAdmin={isUserAdmin}
          />
        )}

        {/* PAST ORDERS TAB */}
        {activeTab === "orders" && (
          <OrdersList user={user} />
        )}

        {/* ADMIN DASHBOARD TAB */}
        {activeTab === "admin" && (
          <AdminDashboard books={books} />
        )}

      </main>

      {/* --- FLOATING OVERLAY MODALS --- */}

      {/* Book details slide overlay */}
      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onAddToCart={handleAddToCart}
          user={user}
        />
      )}

      {/* Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        user={user}
        onOrderSuccess={() => setOrderSuccess(true)}
      />

      {/* Footer credits */}
      <footer className="border-t border-slate-100 bg-white py-6 mt-16 text-center text-xs text-slate-400 font-sans">
        <p>© 2026 BookVerse Inc. Driven securely by Firebase Firestore & Gemini AI recommendations.</p>
      </footer>
    </div>
  );
}
