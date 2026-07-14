export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  price: number;
  coverUrl: string;
  rating: number;
  stock: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any; // Firestore Timestamp
}

export interface CartItem {
  bookId: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
  coverUrl: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  shippingAddress: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface AIRecommendation {
  title: string;
  author: string;
  genre: string;
  description: string;
  price: number;
  rating: number;
}
