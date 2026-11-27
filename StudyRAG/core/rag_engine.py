import logging
import os
import re
from typing import List, Dict, Any, Optional
import config
from core.vector_store import vector_store
from core.ingestion import embed_query
from core.feedback_memory import feedback_memory

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    _NEW_GENAI = True
except ImportError:
    import google.generativeai as genai_legacy
    _NEW_GENAI = False


def get_genai_client():
    api_key = config.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Please set it in .env or environment.")
    
    if _NEW_GENAI:
        return genai.Client(api_key=api_key)
    else:
        genai_legacy.configure(api_key=api_key)
        return genai_legacy


class RAGEngine:
    def __init__(self):
        self.refusal_message = (
            "I don't know based on the provided notes. "
            "This information is not mentioned in your uploaded documents."
        )

    def _build_retrieval_query(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Resolve short or anaphoric follow-ups (e.g. 'more details', 'explain point 2')
        using recent conversation turns so vector search retrieves relevant chunks.
        """
        if not history:
            return query

        words = query.strip().lower().split()
        followup_markers = {
            "more", "detail", "details", "explain", "elaborate", "example",
            "examples", "why", "how", "that", "this", "it", "above", "point",
            "topic", "continue", "next", "deep", "deeper", "expand", "clarify"
        }
        is_followup = len(words) <= 6 or any(w.strip(".,?!:") in followup_markers for w in words)
        if not is_followup:
            return query

        recent_snippets = []
        for msg in history[-3:]:
            content = (msg.get("content") or "").strip()
            if content:
                recent_snippets.append(content[:250])

        if not recent_snippets:
            return query
        return f"{' | '.join(recent_snippets)} | Follow-up: {query}"

    def _format_history(self, history: Optional[List[Dict[str, str]]]) -> str:
        """Format recent conversation turns for the LLM prompt."""
        if not history:
            return ""
        lines = []
        for msg in history[-6:]:
            role = "Student" if msg.get("role") == "user" else "StudyRAG"
            content = (msg.get("content") or "").strip()
            if content:
                lines.append(f"{role}: {content[:600]}")
        return "\n".join(lines)

    def generate_grounded_answer(
        self,
        query: str,
        active_docs: Optional[List[str]] = None,
        user_id: Optional[str] = "guest",
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Executes Hybrid Smart RAG retrieval and generation:
        - Understands follow-ups using conversation history
        - Grounds facts in uploaded documents with inline citations [1], [2]
        - Uses AI knowledge to explain/expand topics from the notes & syllabus
        - Only refuses when the query is genuinely unrelated to the notes and study session
        """
        clean_q = query.strip().lower()

        # Handle simple greetings and non-document conversational queries immediately with NO citations
        greetings_regex = r"^(hi|hii+|hello|heyy*|hey|howdy|greetings|hola|namaste|good\s*(morning|afternoon|evening)|who\s*are\s*you|what\s*is\s*your\s*name|what\s*can\s*you\s*do|help|thanks|thank\s*you|ok|okay)[\s\.\?!]*$"
        if re.match(greetings_regex, clean_q):
            return {
                "answer": "Hello! I am your AI study assistant. How can I help you with your notes and documents today?",
                "citations": [],
                "is_refusal": False,
                "used_external_info": False,
                "retrieved_count": 0
            }

        # Step 1: Generate query vector (enriched with recent context for follow-ups)
        retrieval_query = self._build_retrieval_query(query, history)
        query_vector = embed_query(retrieval_query)

        # Step 2: Retrieve top matching chunks from Qdrant
        retrieved_chunks = vector_store.search(
            query_vector=query_vector,
            top_k=config.TOP_K_RETRIEVAL,
            active_docs=active_docs
        )

        # Step 3: Smart Refusal Check (only hard-refuse when there are no chunks AND no active conversation)
        if not retrieved_chunks and not history:
            return {
                "answer": self.refusal_message,
                "citations": [],
                "is_refusal": True,
                "used_external_info": False,
                "retrieved_count": 0
            }

        max_score = max((c["score"] for c in retrieved_chunks), default=0.0)
        print(f"[RAG SEARCH] Query: '{query}' | Docs: {active_docs} | Top Score: {max_score:.4f} | Threshold: {config.SIMILARITY_THRESHOLD}")

        # Let the AI brain decide for low-score queries when there is conversation history or active docs;
        # only hard-refuse if there is no history and score is very low (< 0.20).
        if not history and max_score < 0.20:
            print(f"[RAG REFUSAL] Top score {max_score:.4f} < hard floor 0.20 (no history)")
            return {
                "answer": self.refusal_message,
                "citations": [],
                "is_refusal": True,
                "used_external_info": False,
                "retrieved_count": len(retrieved_chunks),
                "top_score": max_score
            }

        # Step 4: Build Context with structured citation sources
        context_blocks = []
        citation_sources = []
        for idx, chunk in enumerate(retrieved_chunks, 1):
            source_id = idx
            doc_name = chunk["doc_name"]
            page = chunk["page"]
            text = chunk["text"]
            
            context_blocks.append(
                f"[Source {source_id}] (Document: {doc_name}, Page {page}):\n{text}"
            )
            citation_sources.append({
                "id": source_id,
                "doc_name": doc_name,
                "page": page,
                "text": text,
                "score": chunk["score"]
            })

        formatted_context = "\n\n".join(context_blocks) if context_blocks else "No matching excerpts retrieved."
        formatted_history = self._format_history(history)

        system_instruction = (
            "You are StudyRAG, an intelligent, friendly, and interactive AI study tutor. "
            "You operate in Hybrid Smart Mode: you prioritize the student's uploaded notes and syllabus, "
            "while also using your academic knowledge when helpful to explain concepts clearly.\n\n"
            "MANDATORY RULES:\n"
            "1. NOTES FIRST & CITATIONS: Always check the provided DOCUMENT SOURCES and CONVERSATION HISTORY first. "
            "Every fact taken from the document sources MUST include an inline citation like [1], [2], etc.\n"
            "2. EXTERNAL / OUT-OF-FILES INFORMATION DISCLOSURE (STRICT): Whenever ANY part of your answer uses external information "
            "or academic knowledge not literally written inside the provided DOCUMENT SOURCES (such as expanding a syllabus topic, "
            "defining a term not defined in the file, adding examples, or supplying formulas outside the file), you MUST:\n"
            "   a) Put [EXTERNAL_INFO_USED] on the very first line of your response.\n"
            "   b) Explicitly tell the student in clear text that external information from outside their uploaded files was used "
            "(for example: **External Information Used:** This response includes external information from outside your uploaded files.).\n"
            "   c) Clearly separate what comes from the files vs external knowledge "
            "(for example: **From your uploaded files:** ... [1] followed by **External information (outside your files):** ...).\n"
            "   If 100% of your answer comes strictly from DOCUMENT SOURCES, do NOT put [EXTERNAL_INFO_USED].\n"
            "3. DEFINITIONS & FORMULAS: Keep definitions short and simple to understand. When formulas are relevant, write them in a simple, clear way and cover all relevant formulas for the topic.\n"
            "4. FOLLOW-UPS & INTENT: Use CONVERSATION HISTORY to understand short follow-ups like 'more details', "
            "'explain point 2', 'give an example', or 'elaborate'. Never say you don't know to a valid follow-up about the notes.\n"
            "5. WHEN TO REFUSE: ONLY output EXACTLY:\n"
            f'   "{self.refusal_message}"\n'
            "   when the user's question is completely off-topic and unrelated to the uploaded documents and study conversation "
            "(such as cooking recipes, sports scores, celebrity gossip, or random unrelated trivia).\n"
            "6. CRITICAL: NEVER use backticks (`) anywhere in your output. Do NOT wrap words, phrases, or terms in backticks. Use normal text and **bold** for key terms.\n\n"
            "INTERACTIVE CHAT STYLE:\n"
            "- Be warm, clear, and engaging like a great tutor so the student enjoys learning.\n"
            "- Use **bold** for section headers and key concepts.\n"
            "- Use bullet points (•) with clear spacing between points so the student can read easily.\n"
            "- When appropriate, end with a short, helpful follow-up question or offer (e.g., offering an example or practice question)."
        )

        # Inject continuous learning & user feedback guidance dynamically
        learned_guidance = feedback_memory.get_learned_guidance(user_id=user_id)
        if learned_guidance:
            system_instruction += "\n" + learned_guidance

        history_section = (
            f"=== CONVERSATION HISTORY ===\n{formatted_history}\n\n"
            if formatted_history else ""
        )

        user_prompt = (
            f"{history_section}"
            f"Student Question: {query}\n\n"
            f"=== DOCUMENT SOURCES ===\n"
            f"{formatted_context}\n\n"
            f"Respond helpfully using the document sources (with inline citations [1], [2]) and conversation context, "
            f"and expand with clear academic explanations when the student asks for more details."
        )

        # Step 5: Call Gemini API with multi-model fallback
        client = get_genai_client()
        response_text = ""
        models_to_try = list(dict.fromkeys([
            config.LLM_MODEL,
            config.FALLBACK_LLM_MODEL,
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite"
        ]))

        for idx_model, model_name in enumerate(models_to_try):
            try:
                if _NEW_GENAI:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=user_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.1,
                        )
                    )
                    response_text = response.text.strip()
                else:
                    model = genai_legacy.GenerativeModel(
                        model_name=model_name,
                        system_instruction=system_instruction,
                        generation_config={"temperature": 0.1}
                    )
                    res = model.generate_content(user_prompt)
                    response_text = res.text.strip()
                break
            except Exception as e:
                logger.warning(f"Error calling {model_name}: {e}")
                if idx_model == len(models_to_try) - 1:
                    logger.error(f"All fallback models failed: {e}")
                    response_text = self.refusal_message

        # Step 6: Post-process & verify refusal + external information disclosure
        has_external_tag = "[EXTERNAL_INFO_USED]" in response_text
        response_text = re.sub(r"\[EXTERNAL_INFO_USED\]\s*", "", response_text).strip()

        is_refusal = (
            "i don't know based on the provided notes" in response_text.lower() or
            "not mentioned in your uploaded documents" in response_text.lower()
        )

        # Filter citations: ONLY include citations if they were EXPLICITLY cited in the answer (e.g. [1], [2])
        # If no document info was cited, NEVER return any citations.
        active_citations = []
        if not is_refusal:
            cited_indices = set(re.findall(r'\[(\d+)\]', response_text))
            for c in citation_sources:
                if str(c["id"]) in cited_indices:
                    active_citations.append(c)
        else:
            active_citations = []

        has_external_phrase = bool(
            re.search(
                r"\b(external information|outside (?:your |the )?(?:uploaded )?files?|beyond (?:your |the )?(?:uploaded )?(?:notes|files|documents))\b",
                response_text,
                re.IGNORECASE
            )
        )
        used_external_info = (not is_refusal) and (
            has_external_tag or has_external_phrase or len(active_citations) == 0
        )

        if used_external_info and not has_external_phrase:
            response_text = (
                "**External Information Used:** Note — this response includes external information from outside your uploaded files.\n\n"
                + response_text
            )

        return {
            "answer": response_text,
            "citations": active_citations,
            "is_refusal": is_refusal,
            "used_external_info": used_external_info,
            "retrieved_count": len(retrieved_chunks),
            "top_score": max_score
        }

rag_engine = RAGEngine()
