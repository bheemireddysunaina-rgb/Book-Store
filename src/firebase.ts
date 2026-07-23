import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore with Database ID and long polling (Critical for sandboxed environment execution)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// --- OPERATION TYPE ENUM ---
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

// --- FIRESTORE ERROR HANDLING ---
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Firebase Connection (Critical constraint)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// --- CATALOG SEEDING ---
const SEED_BOOKS = [
  {
    id: "book-dune",
    title: "Dune",
    author: "Frank Herbert",
    genre: "Sci-Fi",
    description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the spice 'melange'.",
    price: 14.99,
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400",
    rating: 4.8,
    stock: 25,
  },
  {
    id: "book-mockingbird",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    genre: "Classic",
    description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, Compassionate, dramatic, and deeply moving.",
    price: 11.99,
    coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400",
    rating: 4.9,
    stock: 12,
  },
  {
    id: "book-hobbit",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    genre: "Fantasy",
    description: "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life. But his contentment is disturbed when the wizard Gandalf and a company of dwarves arrive on his doorstep.",
    price: 15.99,
    coverUrl: "https://images.unsplash.com/photo-1629992101753-56d196c8aabb?auto=format&fit=crop&q=80&w=400",
    rating: 4.8,
    stock: 30,
  },
  {
    id: "book-atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Self-Help",
    description: "No matter your goals, Atomic Habits offers a proven framework for improving—every day. Learn practical strategies that will teach you exactly how to form good habits.",
    price: 16.99,
    coverUrl: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400",
    rating: 4.7,
    stock: 45,
  },
  {
    id: "book-thinking-fast",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    genre: "Psychology",
    description: "Kahneman takes us on a groundbreaking tour of the mind and explains the two systems that drive the way we think—System 1 (fast, intuitive) and System 2 (slow, deliberative).",
    price: 18.99,
    coverUrl: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=400",
    rating: 4.6,
    stock: 8,
  },
  {
    id: "book-pride-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    genre: "Classic",
    description: "Jane Austen's masterwork, centering on the turbulent relationship between Elizabeth Bennet and Fitzwilliam Darcy, exploring class, reputation, and love.",
    price: 9.99,
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400",
    rating: 4.8,
    stock: 15,
  }
];

export async function seedBooksIfEmpty() {
  const booksPath = "books";
  try {
    const querySnapshot = await getDocs(collection(db, booksPath));
    if (querySnapshot.empty) {
      console.log("Seeding books catalog into Firestore...");
      const batch = writeBatch(db);
      SEED_BOOKS.forEach((book) => {
        const { id, ...bookData } = book;
        const bookDocRef = doc(db, booksPath, id);
        batch.set(bookDocRef, {
          ...bookData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      console.log("Books seeded successfully.");
    }
  } catch (error) {
    console.error("Failed to seed books:", error);
  }
}
