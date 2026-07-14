import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

// Lazy-initialized Gemini client to prevent crash if key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: AI Book Recommendations
  app.post("/api/recommendations", async (req, res) => {
    const { genre, preference, currentCart } = req.body;
    
    try {
      const client = getGeminiClient();
      
      let cartContext = "";
      if (currentCart && Array.isArray(currentCart) && currentCart.length > 0) {
        cartContext = `The user currently has these books in their cart: ${currentCart.map(b => `'${b.title}' by ${b.author}`).join(", ")}.`;
      }

      const prompt = `You are an expert librarian at a premier online bookstore.
Provide exactly 3 custom book recommendations based on the user's reading preference:
- Genre of Interest: "${genre || "Any"}"
- Reading Vibe/Preference: "${preference || "A captivating story with rich characters"}"
${cartContext}

Ensure the recommended books are highly appealing, can be real or creatively imagined but realistic.
For each book, output a structured object containing:
1. "title": The title of the book.
2. "author": The author's name.
3. "genre": The genre.
4. "description": A highly engaging 2-sentence description explaining why this fits their vibe and why they will love it.
5. "price": A realistic retail price between $8.99 and $24.99.
6. "rating": A realistic floating-point rating between 4.1 and 5.0.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "A list of exactly 3 book recommendations matching the criteria.",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Book title" },
                author: { type: Type.STRING, description: "Book author" },
                genre: { type: Type.STRING, description: "Genre category" },
                description: { type: Type.STRING, description: "Why the user will love it" },
                price: { type: Type.NUMBER, description: "Price in USD" },
                rating: { type: Type.NUMBER, description: "Rating score (e.g. 4.7)" }
              },
              required: ["title", "author", "genre", "description", "price", "rating"]
            }
          }
        }
      });

      const jsonText = response.text || "[]";
      const recommendations = JSON.parse(jsonText.trim());
      res.json({ recommendations });
    } catch (error) {
      console.error("AI Recommendation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate recommendations",
        recommendations: [] 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
