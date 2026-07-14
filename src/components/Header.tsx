import { useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from "firebase/auth";
import { auth } from "../firebase";
import { 
  BookOpen, 
  ShoppingCart, 
  LogIn, 
  LogOut, 
  Sparkles, 
  ShoppingBag, 
  ShieldAlert,
  User as UserIcon,
  Search
} from "lucide-react";

interface HeaderProps {
  user: User | null;
  loadingAuth: boolean;
  cartCount: number;
  onOpenCart: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function Header({
  user,
  loadingAuth,
  cartCount,
  onOpenCart,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
}: HeaderProps) {
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Auth login failed:", err);
      setAuthError("Google Sign-In failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  // We bootstrap 'bheemireddysunaina@gmail.com' as our system admin
  const isUserAdmin = user?.email === "bheemireddysunaina@gmail.com";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setActiveTab("catalog")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition-all group-hover:bg-indigo-700 shadow-sm">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-extrabold tracking-tight text-slate-900 leading-none">
              BookVerse
            </h1>
            <span className="text-[9px] font-mono text-indigo-600 font-semibold uppercase tracking-wider block mt-0.5">
              POLISHED PLATFORM
            </span>
          </div>
        </div>

        {/* Dynamic Search (Only shown on catalog) */}
        {activeTab === "catalog" && (
          <div className="hidden md:flex relative max-w-xs flex-1 mx-8">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-0 rounded-full py-2 pl-10 pr-4 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-6 h-full">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`text-xs font-semibold uppercase tracking-wider transition-all h-16 border-b-2 flex items-center ${
              activeTab === "catalog"
                ? "text-indigo-600 border-indigo-600"
                : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            Catalog
          </button>

          <button
            onClick={() => setActiveTab("recommendations")}
            className={`text-xs font-semibold uppercase tracking-wider transition-all h-16 border-b-2 flex items-center gap-1.5 ${
              activeTab === "recommendations"
                ? "text-indigo-600 border-indigo-600"
                : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
            AI Finder
          </button>

          {user && (
            <button
              onClick={() => setActiveTab("orders")}
              className={`text-xs font-semibold uppercase tracking-wider transition-all h-16 border-b-2 flex items-center gap-1 ${
                activeTab === "orders"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-500 border-transparent hover:text-slate-800"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Orders
            </button>
          )}

          {/* Admin Dashboard Option for Bootstrap Admin & testing */}
          {(isUserAdmin || (user && user.email?.includes("bheemireddy"))) && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`text-xs font-bold uppercase tracking-wider transition-all h-16 border-b-2 flex items-center gap-1 ${
                activeTab === "admin"
                  ? "text-red-600 border-red-500"
                  : "text-red-500 border-transparent hover:text-red-700"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin
            </button>
          )}
        </nav>

        {/* Action Items: Cart & User Auth */}
        <div className="flex items-center gap-4">
          {/* Shopping Cart Button */}
          <button
            onClick={onOpenCart}
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100"
            id="cart-trigger-button"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 font-mono text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </button>

          {/* Auth Button */}
          {loadingAuth ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-slate-800 leading-none">
                  {user.displayName || "User"}
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {isUserAdmin ? "Administrator" : "Customer"}
                </p>
              </div>
              
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full ring-2 ring-indigo-50"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}

              <button
                onClick={handleLogout}
                title="Log Out"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-700 shadow-sm"
            >
              <LogIn className="h-3 w-3" />
              Sign In
            </button>
          )}
        </div>
      </div>
      
      {/* Mobile search bar */}
      {activeTab === "catalog" && (
        <div className="flex md:hidden px-4 pb-3">
          <div className="relative w-full">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-0 rounded-full py-2 pl-10 pr-4 text-xs text-slate-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {authError && (
        <div className="bg-red-50 px-4 py-1.5 text-center text-xs font-medium text-red-600 border-b border-red-100">
          {authError}
        </div>
      )}
    </header>
  );
}
