# PlotThePlot – Character Relationship & Story Visualizer

> Extract, analyze, and visualize character relationships and narrative arcs from classic stories with AI. Powered by **Gemini 2.0 Flash**, visualized beautifully using **Next.js + D3.js**, and orchestrated with a lightweight **Flask backend API**.

---

## 🔍 Overview

**PlotThePlot** is a system that reads full-length books (e.g., from Project Gutenberg), extracts characters, relationships, and a detailed story summary using a structured prompt schema, and visualizes them interactively in the browser.

It’s designed to help:

- **Founders** quickly understand complex stories and adapt them for IP or product development.
- **Writers & Analysts** explore plots, character roles, and key dialogs.
- **Students & Educators** use a visual-first lens to understand classics.

---

## ⚙️ System Architecture

[User Input: Book ID] ➝ [Flask API] ➝ [Gemini 2.0 Flash LLM]
⬋                          ⬋
[Validation Logic]      [Schema-based Output]
⬋                          ⬋
➝ [Next.js Frontend] ⇄ [Interactive D3 Graph UI]

---

## 🧠 Why Gemini 2.0 Flash over LLaMA 3.2B?

We initially experimented with **LLaMA 3.2B**, but encountered these limitations:

**Decision**: We switched to **Gemini 2.0 Flash** for its **larger context window**, native **structured output tooling**, and **faster runtime**.

---

## 🧩 Backend – Flask API

### 🔧 Endpoints

#### `/api/analyze` (POST)

Extracts structured information from a book using a **Gemini-powered schema**.

**Payload**:

```json
{
  "book_id": 135,
  "validate": true
}
```

	-	book_id: ID from Project Gutenberg.
	-	validate: Optional flag to trigger validation.

Response:
```json
{
  "characters": [],
  "relations": [],
  "summary": "...",
  "validation": {
    "known_story": true,
    "issues": [],
    "notes": "...",
    "score": 9
  }
}
```


How Schema Tooling Works

We provide Gemini with a structured schema via Function Calling, which returns exactly:
-	characters with traits, aliases, and main_character flag
-	relations with directional roles (id1_to_id2_role, etc.), weights (1–10), and key dialogs
-	summary including main plot, key players, and act-level breakdown (as plain text)

⸻

🌐 Frontend – Next.js + Tailwind + D3.js

The frontend fetches the result of /api/analyze, parses the schema, and visualizes it with high interactivity.

📦 Features Visualized
-	📌 Nodes = Characters
-	Color: Red (Main), Blue (Supporting)
-	Shape: Circle
-	Hover shows:
-	Full description
-	Character traits
-	All known aliases
-	🔗 Edges = Relationships
-	Directional arrows (e.g., father → son)
-	Edge thickness = weight (1–10)
-	Hover shows:
-	Relation context
-	Key dialog lines between the pair
-	Also updates a summary panel below the graph
-	📝 Summary Panel
-	Shows the story summary, key players, act-wise breakdown
-	Updates live when hovering over edges
-	✅ Validation Results
-	If validate=true was passed, the validation result (score, issues, notes) is shown in a clean card at the bottom

⸻

🎮 Usage Instructions
-	🔢 Enter a Gutenberg Book ID (e.g., 16 for Peter Pan)
-	✅ Check the Validate box (optional)
-	🔍 Click Analyze
-	🎨 Explore the full interactive graph:
-	Hover nodes for character traits & aliases
-	Hover edges to see relationship + dialogs
-	Scroll down for the full plot summary and validation

⸻

🚀 How to Run Locally

🧩 Flask Backend
```bash
cd backend
export GEMINI_API_KEY=your_key_here
python app.py
```

🖼️ Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Environment variable (.env.local)

NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5328



🌍 Deployment on Vercel
-	You can host the frontend on Vercel
-	Use a public backend (Flask) deployed on Vercel or any server
-	Update NEXT_PUBLIC_BACKEND_URL in your Vercel project settings

🔮 Future Improvements
-	Add support for custom user-uploaded books
-	Add PDF export of the visualization for presentations
-	Evaluate LLaMA 4 as an alternative (Just released: April 6, 2025)

👥 Authors & Contributors
-	Developed by Suryaa Charan
-	Ideated by Nasr Maswood
-	Feedback & Suggestions welcome!
