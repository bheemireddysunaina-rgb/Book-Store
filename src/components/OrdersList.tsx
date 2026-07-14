import { useEffect, useState } from "react";
import { Order } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { ShoppingBag, Calendar, Truck, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { User } from "firebase/auth";

interface OrdersListProps {
  user: User | null;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    bg: "bg-amber-50 border-amber-100 text-amber-700",
    icon: Clock,
  },
  shipped: {
    label: "Shipped",
    bg: "bg-blue-50 border-blue-100 text-blue-700",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    bg: "bg-emerald-50 border-emerald-100 text-emerald-700",
    icon: Truck,
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-red-50 border-red-100 text-red-700",
    icon: XCircle,
  }
};

export default function OrdersList({ user }: OrdersListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const ordersPath = "orders";

    // Query past orders belonging to current signed-in user
    const q = query(
      collection(db, ordersPath),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedOrders.push({
            id: docSnap.id,
            userId: data.userId,
            customerName: data.customerName,
            shippingAddress: data.shippingAddress,
            items: data.items,
            totalAmount: data.totalAmount,
            status: data.status,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setOrders(loadedOrders);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load user orders:", err);
        try {
          handleFirestoreError(err, OperationType.GET, ordersPath);
        } catch (errorObj: any) {
          setError("Failed to retrieve your orders. Please verify your connection.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Cancel order (Standard users can cancel pending orders)
  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    setCancellingId(orderId);
    const orderDocPath = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, orderDocPath);
      } catch (errorObj: any) {
        alert("Action denied. Standard users can only cancel pending shipments.");
      }
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 text-slate-400 mb-4 border border-slate-200">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">No Orders Available</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
          Please sign in using your Google Account above to view your personalized book order logs.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
        <div>
          <h2 className="font-sans text-xl font-extrabold text-slate-900">Your Past Orders</h2>
          <p className="text-xs text-slate-400 mt-1">
            Track and manage your online book orders and delivery progress.
          </p>
        </div>
        
        {loading && (
          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-150 p-4 text-xs font-semibold text-red-650 mb-6">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-slate-200">
          <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-850">You haven't placed any orders yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Explore our book catalog, build your cart, and checkout to see your orders here!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            const orderDate = order.createdAt?.toDate() 
              ? order.createdAt.toDate().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Processing date...";

            return (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Order header specs */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Order Placed</p>
                      <p className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {orderDate}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Charged</p>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ship To</p>
                      <p className="font-semibold text-slate-700 mt-0.5">{order.customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status badge */}
                    <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${statusInfo.bg.replace("rounded-full", "").replace("border-amber-100", "border-amber-150").replace("border-blue-100", "border-blue-150").replace("border-emerald-100", "border-emerald-150").replace("border-red-100", "border-red-150")}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </div>

                    {/* Quick cancellation button */}
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="rounded border border-red-150 bg-red-50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-red-650 transition-all hover:bg-red-100 cursor-pointer"
                      >
                        {cancellingId === order.id ? "Stopping..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Shipping address details */}
                <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/30">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Shipping Address</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{order.shippingAddress}</p>
                </div>

                {/* Item list */}
                <div className="px-4 sm:px-6 py-4 divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <div key={item.bookId} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-12 w-9 rounded object-cover shadow-xs bg-slate-100 border border-slate-150"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate">by {item.author}</p>
                      </div>
                      <div className="text-right flex flex-col justify-center">
                        <p className="font-mono text-xs font-bold text-slate-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Qty: {item.quantity} • ${item.price.toFixed(2)} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
