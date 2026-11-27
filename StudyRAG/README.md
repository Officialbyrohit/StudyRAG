# StudyRAG - AI Study Assistant (Key Features Edition)

An academic, strictly-grounded **Retrieval-Augmented Generation (RAG)** study assistant inspired by **Google NotebookLM**. Built using **100% cloud AI APIs (zero local model downloads)**, a **Qdrant vector database**, a high-performance **FastAPI** backend, and a custom **Stitch-designed 3-panel split UI**.

---

## 🌟 Key Features Implemented

1. **Document Ingestion (PDFs & Notes)**
   - Upload course syllabi, lecture slides, textbooks, and notes.
   - Extracts page-by-page text using PyMuPDF and preserves page boundaries.
   - Chunks text and embeds via Google Gemini `text-embedding-004` Cloud API (768 dimensions).
   - Indexes into **Qdrant** with full metadata payload.

2. **Strictly Grounded Chat**
   - Answers questions strictly and exclusively from your uploaded notes.
   - Zero hallucination: acts like handing an intern your books and instructing them to answer *only* from the text.

3. **Precise Citations**
   - Every factual answer links to inline citation badges `[1]`, `[2]` and verified citation cards.
   - Clicking a citation chip jumps the right-hand **Source Ground-Truth Viewer** directly to that document and page, highlighting the exact matching sentence.

4. **"I Don't Know" Fallback (Refusal Guardrail)**
   - Two-tier safety check:
     - Vector similarity thresholding catches off-topic queries immediately.
     - System prompt forces deterministic refusal: *"I don't know based on the provided notes. This information is not mentioned in your uploaded documents."*

5. **Document & Chapter Summaries**
   - One-click structured summaries for any indexed document.
   - Generates executive thesis, key definitions, and quick-glance highlights (Core Strategy, Average Runtime, Worst Case).

---

## 🏗️ Architecture & Tech Stack

* **Frontend**: Custom **Stitch UI** (HTML5 + Tailwind CSS + Material Symbols + Vanilla JS).
* **Backend**: **FastAPI** (`main.py`) serving REST endpoints and static files.
* **Vector Store**: **Qdrant** (Supports both **Qdrant Cloud Free Forever 1GB Cluster** and automatic local disk fallback).
* **Embeddings**: **Google Gemini `text-embedding-004` API** (Free Tier via Google AI Studio).
* **LLM**: **Google Gemini 2.0 Flash / 1.5 Flash API** (Free Tier via Google AI Studio).

---

## 🚀 Quick Start Guide

### 1. Configure API Keys
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and paste your free Google AI Studio key:
```env
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Qdrant Cloud Free Cluster (if left empty, runs locally on disk in ./qdrant_storage)
QDRANT_URL=https://your-cluster-id.eu-central.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here
```

### 2. Run the Application
Activate the virtual environment and start the FastAPI server:

On Windows:
```powershell
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### 3. Open in Browser
Visit **`http://localhost:8000`** in your browser.

---

## 📁 Project Structure

```
RAG AI Study assistance/
├── main.py                     # FastAPI application & API endpoints
├── config.py                   # Configuration & environment variables
├── requirements.txt            # Python dependencies
├── .env.example                # Example environment file
├── core/
│   ├── ingestion.py            # PDF parsing, chunking & Gemini embeddings
│   ├── vector_store.py         # Qdrant client & retrieval logic
│   ├── rag_engine.py           # Grounded prompting & citation engine
│   └── summarizer.py           # Document & chapter summarizer
├── static/
│   ├── index.html              # Stitch-designed 3-panel UI
│   └── js/
│       └── app.js              # Frontend interactive logic
└── tests/
    ├── create_sample_doc.py    # Script to create initial sample lecture notes
    └── CS210_Lecture4_Sorting.pdf # Sample lecture notes PDF
```
