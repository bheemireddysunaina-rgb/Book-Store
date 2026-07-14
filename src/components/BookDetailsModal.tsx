import { useState, useEffect, FormEvent } from "react";
import { Book, Review } from "../types";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { X, Star, MessageSquare, Send, CheckCircle } from "lucide-react";
import { User } from "firebase/auth";

interface BookDetailsModalProps {
  book: Book;
  onClose: () => void;
  onAddToCart: (book: Book) => void;
  user: User | null;
}

export default function BookDetailsModal({
  book,
  onClose,
  onAddToCart,
  user,
}: BookDetailsModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Subscribe to real-time reviews from Firestore subcollection /books/{bookId}/reviews
  useEffect(() => {
    setLoadingReviews(true);
    const reviewsPath = `books/${book.id}/reviews`;
    
    const q = query(
      collection(db, reviewsPath),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedReviews: Review[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedReviews.push({
            id: docSnap.id,
            userId: data.userId,
            userName: data.userName,
            rating: data.rating,
            comment: data.comment,
            createdAt: data.createdAt,
          });
        });
        setReviews(loadedReviews);
        setLoadingReviews(false);
      },
      (error) => {
        console.error("Failed to load reviews:", error);
        // Conform to critical skill error formatting
        try {
          handleFirestoreError(error, OperationType.GET, reviewsPath);
        } catch (err: any) {
          setReviewError("You must be signed in with a verified account to interact with reviews.");
        }
        setLoadingReviews(false);
      }
    );

    return () => unsubscribe();
  }, [book.id]);

  // Submit Review Handler
  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setReviewError("Please sign in to write a review.");
      return;
    }
    
    if (!user.emailVerified) {
      setReviewError("Your email must be verified to submit a review.");
      return;
    }

    if (!newComment.trim()) {
      setReviewError("Comment cannot be empty.");
      return;
    }

    if (newComment.length > 1000) {
      setReviewError("Review comment cannot exceed 1000 characters.");
      return;
    }

    setSubmitting(true);
    setReviewError(null);
    setReviewSuccess(false);

    const reviewsPath = `books/${book.id}/reviews`;
    const reviewData = {
      userId: user.uid,
      userName: user.displayName || "Anonymous Reader",
      rating: newRating,
      comment: newComment.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, reviewsPath), reviewData);
      setNewComment("");
      setNewRating(5);
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (error) {
      console.error("Error creating review:", error);
      try {
        handleFirestoreError(error, OperationType.CREATE, reviewsPath);
      } catch (err: any) {
        // Human readable warning
        setReviewError("Failed to submit review. You must be signed in with a verified email.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isOutOfStock = book.stock <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      {/* Modal Card container */}
      <div className="relative flex flex-col md:flex-row w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-y-auto md:overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left Side: Book Cover and Quick Checkout */}
        <div className="w-full md:w-2/5 md:h-[90vh] bg-slate-50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
          <div className="relative aspect-3/4 w-3/4 rounded-xl overflow-hidden shadow-md mb-6 bg-white border border-slate-200">
            <img
              src={book.coverUrl}
              alt={book.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          
          <div className="w-full text-center md:text-left px-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-2xl font-bold text-slate-900">
                ${book.price.toFixed(2)}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                isOutOfStock 
                  ? "bg-red-50 border-red-150 text-red-700" 
                  : "bg-indigo-50 border-indigo-150 text-indigo-700"
              }`}>
                {isOutOfStock ? "Out of Stock" : `${book.stock} units`}
              </span>
            </div>

            <button
              onClick={() => onAddToCart(book)}
              disabled={isOutOfStock}
              className={`w-full rounded-lg py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all cursor-pointer ${
                isOutOfStock
                  ? "bg-slate-300 shadow-none cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
              }`}
            >
              {isOutOfStock ? "Sold Out" : "Add to Shopping Cart"}
            </button>
          </div>
        </div>

        {/* Right Side: Detailed specs, description, and real-time reviews thread */}
        <div className="w-full md:w-3/5 flex flex-col md:h-[90vh] overflow-y-auto p-6 md:p-8">
          
          {/* Header Specs */}
          <div className="mb-6">
            <span className="inline-block rounded bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">
              {book.genre}
            </span>
            <h2 className="font-sans text-xl font-extrabold text-slate-900 leading-tight mb-1">
              {book.title}
            </h2>
            <p className="font-sans text-xs text-slate-500">
              by <span className="text-slate-800 font-semibold">{book.author}</span>
            </p>
          </div>

          {/* Star Average Display */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(book.rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-800">{book.rating.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({reviews.length} reviews)</span>
          </div>

          {/* Full description */}
          <div className="mb-8">
            <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Synopsis</h4>
            <p className="font-sans text-xs text-slate-600 leading-relaxed">
              {book.description}
            </p>
          </div>

          {/* Reviews Panel */}
          <div className="flex-1 flex flex-col border-t border-slate-200 pt-6">
            <div className="flex items-center gap-1.5 mb-4">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-900">
                Customer Feedback
              </h3>
            </div>

            {/* Write a review form */}
            {user ? (
              <form onSubmit={handleSubmitReview} className="mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-3">Add Your Review</p>
                
                {/* Rating selection stars */}
                <div className="flex items-center gap-1 mb-3">
                  <span className="text-xs text-slate-500 mr-2">Your Rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="transition-transform active:scale-95 cursor-pointer"
                    >
                      <Star
                        className={`h-4.5 w-4.5 ${
                          star <= newRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Comment box */}
                <div className="relative">
                  <textarea
                    placeholder="Describe your reading experience with this book... (max 1000 characters)"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <span className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-400">
                    {newComment.length}/1000
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-350 cursor-pointer transition-all"
                  >
                    {submitting ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent"></span>
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Submit
                  </button>

                  {/* Feedback alerts */}
                  {reviewSuccess && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 animate-pulse">
                      <CheckCircle className="h-3 w-3" /> Published!
                    </span>
                  )}
                  {reviewError && (
                    <span className="text-[10px] font-bold text-red-500">
                      {reviewError}
                    </span>
                  )}
                </div>
              </form>
            ) : (
              <div className="mb-6 rounded-xl bg-amber-50 border border-amber-150 p-4 text-center">
                <p className="text-xs text-amber-800 font-semibold">
                  Please sign in to share your thoughts and rate this book!
                </p>
              </div>
            )}

            {/* List of reviews */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {loadingReviews ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border border-slate-200 border-t-indigo-600"></div>
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 italic">
                  No reviews submitted yet for this book. Be the first to share your review!
                </p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className="border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-slate-800">{rev.userName}</p>
                      
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s <= rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pr-2">
                      {rev.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
