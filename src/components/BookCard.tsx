import { Book } from "../types";
import { Star, ShoppingCart, Info, Edit, PackageX } from "lucide-react";
import { motion } from "motion/react";

interface BookCardProps {
  book: Book;
  onViewDetails: (book: Book) => void;
  onAddToCart: (book: Book) => void;
  isAdmin: boolean;
  onEdit: (book: Book) => void;
}

export default function BookCard({
  book,
  onViewDetails,
  onAddToCart,
  isAdmin,
  onEdit,
}: BookCardProps) {
  const isOutOfStock = book.stock <= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col bg-white border border-slate-200 rounded-xl p-3 gap-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
    >
      {/* Book Cover Image Container */}
      <div className="relative h-56 w-full bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src={book.coverUrl}
          alt={book.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Genre Tag */}
        <span className="absolute top-2 left-2 rounded bg-slate-900/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          {book.genre}
        </span>

        {/* Stock Badge */}
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
            <PackageX className="h-2.5 w-2.5" />
            Sold Out
          </span>
        ) : book.stock <= 5 ? (
          <span className="absolute top-2 right-2 rounded bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
            {book.stock} Left
          </span>
        ) : null}

        {/* Floating Quick Action Overlays */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/40 opacity-0 transition-all duration-300 group-hover:opacity-100 backdrop-blur-xs">
          <button
            onClick={() => onViewDetails(book)}
            className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-850 shadow-sm transition-all hover:bg-indigo-600 hover:text-white"
          >
            <Info className="h-3 w-3" />
            Quick View
          </button>
          
          {isAdmin && (
            <button
              onClick={() => onEdit(book)}
              className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-white shadow-sm transition-all hover:bg-amber-600"
              title="Edit Book Details"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Book Metadata details */}
      <div className="flex flex-1 flex-col gap-1.5">
        {/* Author */}
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          {book.author}
        </p>
        
        {/* Title */}
        <h3 className="font-sans text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={book.title}>
          {book.title}
        </h3>

        {/* Rating star display */}
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-slate-700">
            {book.rating.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">/ 5.0</span>
        </div>

        {/* Description Snippet */}
        <p className="font-sans text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {book.description}
        </p>

        {/* Bottom Price & Add to Cart */}
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span className="font-mono text-sm font-bold text-indigo-600">
            ${book.price.toFixed(2)}
          </span>

          <button
            onClick={() => onAddToCart(book)}
            disabled={isOutOfStock}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-all ${
              isOutOfStock
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 text-indigo-600 hover:bg-indigo-650 hover:text-white"
            }`}
          >
            <ShoppingCart className="h-3 w-3" />
            {isOutOfStock ? "Empty" : "Add"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
