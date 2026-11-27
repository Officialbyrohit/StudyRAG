import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

# Local fallback storage for Qdrant if no cloud credentials provided
LOCAL_QDRANT_PATH = str(BASE_DIR / "qdrant_storage")

# RAG & Model Settings
COLLECTION_NAME = "study_assistant_notes"
EMBEDDING_MODEL = "models/gemini-embedding-001"
VECTOR_SIZE = 3072  # Dimension for gemini-embedding-001
LLM_MODEL = "gemini-3.5-flash"
FALLBACK_LLM_MODEL = "gemini-3.6-flash"

# Ingestion settings
CHUNK_SIZE = 700
CHUNK_OVERLAP = 120

# Strict Grounding & Refusal Threshold
# Set to 0.35 so natural/informal queries match, while totally unrelated queries are filtered.
SIMILARITY_THRESHOLD = 0.35
TOP_K_RETRIEVAL = 5
