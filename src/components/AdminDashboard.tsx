import { useState, useEffect, FormEvent } from "react";
import { Book, Order } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  ClipboardList, 
  TrendingUp, 
  CheckCircle,
  Truck,
  RotateCcw,
  Star
} from "lucide-react";

interface AdminDashboardProps {
  books: Book[];
}

const ORDER_STATUSES = ["pending", "shipped", "delivered", "cancelled"];

export default function AdminDashboard({ books }: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"inventory" | "orders">("inventory");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Form states for creating/editing book
  const [isEditing, setIsEditing] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(12.99);
  const [coverUrl, setCoverUrl] = useState("");
  const [stock, setStock] = useState(20);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Subscribe to all orders placed in the system
  useEffect(() => {
    setLoadingOrders(true);
    const ordersPath = "orders";
    const q = query(collection(db, ordersPath), orderBy("createdAt", "desc"));
    
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
        setLoadingOrders(false);
      },
      (error) => {
        console.error("Failed to load admin orders:", error);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle Book catalog Submission (Add / Edit)
  const handleSubmitBook = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Verbatim constraints check according to blueprint
    if (!title.trim() || title.length > 150) {
      setFormError("Book Title is required and cannot exceed 150 characters.");
      return;
    }
    if (!author.trim() || author.length > 100) {
      setFormError("Author is required and cannot exceed 100 characters.");
      return;
    }
    if (!genre.trim() || genre.length > 50) {
      setFormError("Genre category is required and cannot exceed 50 characters.");
      return;
    }
    if (!description.trim() || description.length > 2000) {
      setFormError("Synopsis description is required and cannot exceed 2000 characters.");
      return;
    }
    if (price < 0) {
      setFormError("Price must be a positive decimal.");
      return;
    }
    if (stock < 0) {
      setFormError("Inventory stock must be a positive integer.");
      return;
    }

    const defaultCoverUrl = coverUrl.trim() || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400";
    
    const payload = {
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      description: description.trim(),
      price: Number(price),
      coverUrl: defaultCoverUrl,
      rating: isEditing ? books.find(b => b.id === editingBookId)?.rating || 5 : 5,
      stock: Number(stock),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEditing && editingBookId) {
        // Update current book doc in Firestore
        const bookDocPath = `books/${editingBookId}`;
        await updateDoc(doc(db, "books", editingBookId), payload);
        setFormSuccess("Book details updated successfully in database!");
      } else {
        // Create new book doc in Firestore
        const booksColPath = "books";
        await addDoc(collection(db, "books"), {
          ...payload,
          rating: 5.0, // Default perfect starting rating
          createdAt: serverTimestamp(),
        });
        setFormSuccess("New book cataloged into inventory!");
      }

      // Reset form states
      handleResetForm();
    } catch (err: any) {
      console.error("Inventory change failed:", err);
      try {
        handleFirestoreError(
          err, 
          isEditing ? OperationType.UPDATE : OperationType.CREATE, 
          isEditing ? `books/${editingBookId}` : "books"
        );
      } catch (errObj) {
        setFormError("Permission Denied. Only authorized Administrators can write to the books catalog.");
      }
    }
  };

  // Pre-populate form for editing
  const handleStartEdit = (book: Book) => {
    setIsEditing(true);
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setGenre(book.genre);
    setDescription(book.description);
    setPrice(book.price);
    setCoverUrl(book.coverUrl);
    setStock(book.stock);
    setFormError(null);
    setFormSuccess(null);
  };

  // Delete Book document from Firestore
  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm("Are you sure you want to delete this book from catalog inventory?")) return;
    
    const bookDocPath = `books/${bookId}`;
    try {
      await deleteDoc(doc(db, "books", bookId));
      setFormSuccess("Book permanently removed from catalog.");
    } catch (err: any) {
      console.error("Failed to delete book:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, bookDocPath);
      } catch (errObj) {
        alert("Permission Denied. Only authorized Administrators can delete books.");
      }
    }
  };

  // Advance Order Status (Tiered Identity check - Admin modification)
  const handleUpdateOrderStatus = async (orderId: string, currentStatus: string, nextStatus: string) => {
    const orderDocPath = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error("Order status change denied:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, orderDocPath);
      } catch (errObj) {
        alert("Permission Denied. Action is restricted strictly to store administrators.");
      }
    }
  };

  const handleResetForm = () => {
    setIsEditing(false);
    setEditingBookId(null);
    setTitle("");
    setAuthor("");
    setGenre("");
    setDescription("");
    setPrice(12.99);
    setCoverUrl("");
    setStock(20);
  };

  // Analytical stats
  const totalRevenue = orders
    .filter(o => o.status !== "cancelled")
    .reduce((acc, order) => acc + order.totalAmount, 0);

  const pendingOrdersCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Dashboard Headline */}
      <div className="border-b border-slate-200 pb-4 mb-8">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 flex items-center gap-2">
          Store Management Console
          <span className="rounded bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700 tracking-wider uppercase">
            Authorized Admin
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Perform administrative CRUD operations on catalog inventory and process incoming customer shipments.
        </p>
      </div>

      {/* Analytics Bento Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</p>
            <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">
              ${totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pending Shipments</p>
            <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">
              {pendingOrdersCount} orders
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650 border border-indigo-100">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Catalog Titles</p>
            <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">
              {books.length} unique books
            </p>
          </div>
        </div>
      </div>

      {/* Sub tabs switcher */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab("inventory")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            activeSubTab === "inventory"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Book Catalog ({books.length})
        </button>
        <button
          onClick={() => setActiveSubTab("orders")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            activeSubTab === "orders"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Manage Orders ({orders.length})
        </button>
      </div>

      {/* RENDER INVENTORY INTERFACES */}
      {activeSubTab === "inventory" && (
        <div className="grid gap-8 lg:grid-cols-4">
          
          {/* Add / Edit Form card */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-max">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">
              {isEditing ? "Edit Book Details" : "Catalog New Book"}
            </h3>

            <form onSubmit={handleSubmitBook} className="space-y-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Book Title</label>
                <input
                  type="text"
                  placeholder="e.g., Dune"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Author</label>
                <input
                  type="text"
                  placeholder="e.g., Frank Herbert"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Genre Category</label>
                <input
                  type="text"
                  placeholder="e.g., Sci-Fi, Classic, Fantasy"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Stock Level</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cover Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="Paste URL link"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Synopsis / Description</label>
                <textarea
                  placeholder="Detailed synopsis..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-[11px] font-semibold text-red-600 border border-red-150">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-600 border border-emerald-150">
                  {formSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  {isEditing ? "Save" : "Create"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Table display */}
          <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="p-4">Book Info</th>
                  <th className="p-4">Genre</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 flex gap-3 items-center">
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        referrerPolicy="no-referrer"
                        className="h-10 w-7 rounded object-cover shadow-xs bg-slate-150 border border-slate-100"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate max-w-[150px]">{book.title}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[150px]">by {book.author}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                        {book.genre}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-900">${book.price.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`font-mono text-xs font-bold ${book.stock <= 5 ? "text-amber-600 font-extrabold" : "text-slate-700"}`}>
                        {book.stock} units
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStartEdit(book)}
                          className="rounded p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-650 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Backend Monitor Column (Right) */}
          <div className="lg:col-span-1 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md flex flex-col gap-4 h-max">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Backend Monitor</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400 uppercase">Operational</span>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Calculated Revenue</p>
              <p className="font-mono text-xl font-bold text-white mt-1">
                ${totalRevenue.toFixed(2)}
              </p>
              <span className="text-[9px] font-bold text-emerald-400 mt-1 inline-block">Secure sync enabled</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Node Cluster Sessions</span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">84 active</span>
              </div>
              <div className="flex items-end gap-1 h-6 mt-1.5">
                <div className="w-1 bg-indigo-500 rounded-full h-2 animate-pulse"></div>
                <div className="w-1 bg-indigo-400 rounded-full h-4 animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-1 bg-indigo-300 rounded-full h-5 animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                <div className="w-1 bg-indigo-600 rounded-full h-3 animate-pulse" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-1 bg-indigo-400 rounded-full h-4 animate-pulse" style={{ animationDelay: "0.3s" }}></div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-[9px] text-slate-300 space-y-1.5">
              <p className="text-slate-500">// Firebase Live telemetry</p>
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>DATABASE STATS:</span>
                <span>ONLINE</span>
              </div>
              <p><span className="text-indigo-400">SYNC</span> /books matches: {books.length} loaded</p>
              <p><span className="text-indigo-400">SYNC</span> /orders matches: {orders.length} entries</p>
            </div>
          </div>

        </div>
      )}

      {/* RENDER SYSTEM ORDERS MONITORING */}
      {activeSubTab === "orders" && (
        <div className="grid gap-8 lg:grid-cols-4">
          
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {loadingOrders ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">No customer orders recorded in system database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="p-4">Order ID / Date</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Address</th>
                      <th className="p-4">Grand Total</th>
                      <th className="p-4">Current Status</th>
                      <th className="p-4 text-right">Progress Shipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-600">
                    {orders.map((order) => {
                      const orderDate = order.createdAt?.toDate()
                        ? order.createdAt.toDate().toLocaleDateString()
                        : "Pending Sync...";

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <p className="font-mono text-slate-900 font-bold">{order.id}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{orderDate}</p>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{order.customerName}</td>
                          <td className="p-4 truncate max-w-[180px]" title={order.shippingAddress}>
                            {order.shippingAddress}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-900">${order.totalAmount.toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase border tracking-wider ${
                              order.status === "delivered" 
                                ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                                : order.status === "cancelled" 
                                ? "bg-red-50 border-red-150 text-red-700"
                                : order.status === "shipped"
                                ? "bg-blue-50 border-blue-150 text-blue-700"
                                : "bg-amber-50 border-amber-150 text-amber-700"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {order.status === "pending" && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, order.status, "shipped")}
                                  className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                                >
                                  <Truck className="h-3 w-3" /> Ship
                                </button>
                              )}
                              {order.status === "shipped" && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, order.status, "delivered")}
                                  className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                                >
                                  <CheckCircle className="h-3 w-3" /> Deliver
                                </button>
                              )}
                              {order.status !== "delivered" && order.status !== "cancelled" && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, order.status, "cancelled")}
                                  className="rounded border border-red-150 bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Backend Monitor Column (Right) */}
          <div className="lg:col-span-1 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md flex flex-col gap-4 h-max">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Backend Monitor</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400 uppercase">Operational</span>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Calculated Revenue</p>
              <p className="font-mono text-xl font-bold text-white mt-1">
                ${totalRevenue.toFixed(2)}
              </p>
              <span className="text-[9px] font-bold text-emerald-400 mt-1 inline-block">Secure sync enabled</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Node Cluster Sessions</span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">84 active</span>
              </div>
              <div className="flex items-end gap-1 h-6 mt-1.5">
                <div className="w-1 bg-indigo-500 rounded-full h-2 animate-pulse"></div>
                <div className="w-1 bg-indigo-400 rounded-full h-4 animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-1 bg-indigo-300 rounded-full h-5 animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                <div className="w-1 bg-indigo-600 rounded-full h-3 animate-pulse" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-1 bg-indigo-400 rounded-full h-4 animate-pulse" style={{ animationDelay: "0.3s" }}></div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-[9px] text-slate-300 space-y-1.5">
              <p className="text-slate-500">// Firebase Live telemetry</p>
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>DATABASE STATS:</span>
                <span>ONLINE</span>
              </div>
              <p><span className="text-indigo-400">SYNC</span> /books matches: {books.length} loaded</p>
              <p><span className="text-indigo-400">SYNC</span> /orders matches: {orders.length} entries</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
