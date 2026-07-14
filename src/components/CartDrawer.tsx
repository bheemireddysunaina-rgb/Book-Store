import { useState, FormEvent } from "react";
import { CartItem, Book } from "../types";
import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (bookId: string, delta: number) => void;
  onRemoveItem: (bookId: string) => void;
  onClearCart: () => void;
  user: User | null;
  onOrderSuccess: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  user,
  onOrderSuccess,
}: CartDrawerProps) {
  const [shippingAddress, setShippingAddress] = useState("");
  const [customerName, setCustomerName] = useState(user?.displayName || "");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * 0.08; // 8% sales tax
  const shipping = subtotal > 50 ? 0 : 5.99; // Free shipping over $50
  const total = subtotal + tax + shipping;

  // Transaction-based Checkout
  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setCheckoutError("Please sign in first to place your order.");
      return;
    }

    if (!customerName.trim()) {
      setCheckoutError("Name is required for shipping.");
      return;
    }

    if (!shippingAddress.trim()) {
      setCheckoutError("Delivery shipping address is required.");
      return;
    }

    if (shippingAddress.length > 500) {
      setCheckoutError("Address is too long. Please restrict to 500 characters.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

    const orderId = `order-${Date.now()}`;
    const ordersPath = `orders/${orderId}`;

    try {
      // Execute multi-document ACID transaction: Write order AND decrement books inventory stock
      await runTransaction(db, async (transaction) => {
        const bookRefsWithStock: { ref: any, currentStock: number, orderedQty: number }[] = [];

        // 1. Read all required book documents first within transaction to check stock levels
        for (const item of cartItems) {
          const bookRef = doc(db, "books", item.bookId);
          const bookSnap = await transaction.get(bookRef);
          
          if (!bookSnap.exists()) {
            throw new Error(`Book '${item.title}' does not exist in inventory.`);
          }

          const currentStock = bookSnap.data().stock || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for '${item.title}'. Available stock is only ${currentStock}.`);
          }

          bookRefsWithStock.push({
            ref: bookRef,
            currentStock,
            orderedQty: item.quantity,
          });
        }

        // 2. Perform updates to adjust stock levels
        for (const item of bookRefsWithStock) {
          transaction.update(item.ref, {
            stock: item.currentStock - item.orderedQty,
            updatedAt: serverTimestamp(),
          });
        }

        // 3. Create the order record
        const orderRef = doc(db, "orders", orderId);
        transaction.set(orderRef, {
          userId: user.uid,
          customerName: customerName.trim(),
          shippingAddress: shippingAddress.trim(),
          items: cartItems,
          totalAmount: total,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Checkout complete
      onClearCart();
      onOrderSuccess();
      onClose();
    } catch (error) {
      console.error("Transaction checkout failed:", error);
      try {
        handleFirestoreError(error, OperationType.WRITE, ordersPath);
      } catch (err: any) {
        setCheckoutError(error instanceof Error ? error.message : "Checkout transaction failed. Please try again.");
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
      {/* Backdrop closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Cart Drawer content */}
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-250 border-l border-slate-200">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-900">Your Shopping Cart</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer transition-all border border-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {cartItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 text-slate-400 mb-4 border border-slate-150">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Your cart is empty</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Explore our catalog and find your next favorite book to read!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {cartItems.map((item) => (
                  <div key={item.bookId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="h-16 w-12 rounded object-cover shadow-xs bg-slate-100 border border-slate-150"
                    />
                    <div className="flex-1 flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      <p className="text-[10px] text-slate-450 truncate mb-2">by {item.author}</p>
                      
                      {/* Quantity controls */}
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                          <button
                            onClick={() => onUpdateQuantity(item.bookId, -1)}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-slate-500 shadow-xs hover:bg-slate-100 cursor-pointer border border-slate-150"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-mono text-xs font-bold text-slate-800 px-3">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.bookId, 1)}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-slate-500 shadow-xs hover:bg-slate-100 cursor-pointer border border-slate-150"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => onRemoveItem(item.bookId)}
                          className="text-slate-400 hover:text-red-650 transition-colors cursor-pointer p-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-slate-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-400">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cost Summary card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Estimated Tax (8%)</span>
                    <span className="font-mono font-bold">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Shipping</span>
                    <span className="font-mono font-bold">
                      {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  {shipping > 0 && (
                    <p className="text-[10px] text-indigo-650 font-bold italic mt-1">
                      Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                    </p>
                  )}
                  <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900 text-sm">
                    <span>Grand Total</span>
                    <span className="font-mono text-slate-950">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Checkout Form */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                  <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
                  Delivery & Shipping
                </h3>

                {user ? (
                  <form onSubmit={handleCheckout} className="space-y-4">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Shipping Name
                      </label>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs outline-none transition-all placeholder:text-slate-450 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Delivery Address
                      </label>
                      <textarea
                        placeholder="123 Bookshelf Ave, Library District, NY 10001 (max 500 characters)"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        required
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs outline-none transition-all placeholder:text-slate-450 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {checkoutError && (
                      <div className="rounded-lg bg-red-50 p-3 text-[11px] font-bold text-red-650 border border-red-150">
                        {checkoutError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={checkingOut}
                      className="w-full rounded-lg bg-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700 disabled:bg-slate-300 cursor-pointer"
                    >
                      {checkingOut ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent"></span>
                          Processing checkout...
                        </span>
                      ) : (
                        `Checkout & Buy ($${total.toFixed(2)})`
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="rounded-xl bg-amber-50 border border-amber-150 p-4 text-center">
                    <p className="text-xs text-amber-800 font-semibold">
                      Please sign in using the Google authentication button at the top to complete your bookstore checkout.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
