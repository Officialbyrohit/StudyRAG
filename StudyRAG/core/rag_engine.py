import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
import requests
import config
from core.vector_store import vector_store
from core.ingestion import embed_query
from core.feedback_memory import feedback_memory
from core.gemini_helper import build_genai_client, run_with_model_fallback

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
        return build_genai_client(genai, types, api_key)
    else:
        genai_legacy.configure(api_key=api_key)
        return genai_legacy


class RAGEngine:
    def __init__(self):
        self.refusal_message = (
            "I don't know based on the provided notes. "
            "This information is not mentioned in your uploaded documents."
        )

    def _fetch_web_search_results(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Fetch live web results from free public JSON APIs (DuckDuckGo Instant Answer + Wikipedia)."""
        headers = {"User-Agent": "StudyRAG/1.0 (https://localhost)"}

        def query_ddg() -> List[Dict[str, str]]:
            items: List[Dict[str, str]] = []
            try:
                res = requests.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                    headers=headers,
                    timeout=5
                )
                if res.status_code in (200, 202):
                    data = res.json()
                    abs_text = (data.get("AbstractText") or "").strip()
                    abs_url = (data.get("AbstractURL") or "").strip()
                    heading = (data.get("Heading") or "").strip()
                    if abs_text and abs_url:
                        items.append({
                            "title": heading or "DuckDuckGo Instant Answer",
                            "uri": abs_url,
                            "domain": urlparse(abs_url).netloc,
                            "snippet": abs_text
                        })
                    for topic in data.get("RelatedTopics", [])[:3]:
                        if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                            t_url = topic["FirstURL"]
                            items.append({
                                "title": topic["Text"].split(" - ")[0][:80],
                                "uri": t_url,
                                "domain": urlparse(t_url).netloc,
                                "snippet": topic["Text"]
                            })
            except Exception as e:
                logger.warning(f"DuckDuckGo web search failed: {e}")
            return items

        def query_wiki() -> List[Dict[str, str]]:
            items: List[Dict[str, str]] = []
            try:
                res = requests.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={
                        "action": "query",
                        "generator": "search",
                        "gsrsearch": query,
                        "gsrlimit": 3,
                        "prop": "extracts|info",
                        "exintro": 1,
                        "explaintext": 1,
                        "exsentences": 4,
                        "inprop": "url",
                        "format": "json"
                    },
                    headers=headers,
                    timeout=5
                )
                if res.status_code == 200:
                    pages = res.json().get("query", {}).get("pages", {})
                    for page in sorted(pages.values(), key=lambda p: p.get("index", 99)):
                        url = (page.get("fullurl") or "").strip()
                        extract = (page.get("extract") or "").strip()
                        title = (page.get("title") or "").strip()
                        if url and extract:
                            items.append({
                                "title": f"{title} - Wikipedia" if title else "Wikipedia",
                                "uri": url,
                                "domain": "en.wikipedia.org",
                                "snippet": extract[:600]
                            })
            except Exception as e:
                logger.warning(f"Wikipedia web search failed: {e}")
            return items

        results: List[Dict[str, str]] = []
        seen_uris = set()
        with ThreadPoolExecutor(max_workers=2) as pool:
            ddg_future = pool.submit(query_ddg)
            wiki_future = pool.submit(query_wiki)
            for item in ddg_future.result() + wiki_future.result():
                uri = item.get("uri")
                if uri and uri not in seen_uris:
                    seen_uris.add(uri)
                    results.append(item)
                    if len(results) >= max_results:
                        break
        return results

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

    def _classify_and_reply_simple_chat(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None,
        active_docs: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        Let the chat model decide whether the message is casual/simple chat (answered without
        searching files or web) or a real study/factual/research query that needs search.
        Returns a natural reply string for simple chat, or None when search is needed.
        """
        recent_history = self._format_history(history[-4:] if history else None)
        docs_label = ", ".join(active_docs) if active_docs else "None selected"

        router_prompt = (
            "Decide whether the student's latest message is SIMPLE CHAT or needs SEARCH.\n\n"
            "Return ONLY valid JSON in one of these two formats:\n"
            '1) {"mode": "simple_chat", "reply": "<natural, friendly, concise reply>"}\n'
            '2) {"mode": "search"}\n\n'
            "Use \"simple_chat\" ONLY for:\n"
            "- Greetings & small talk (e.g., hi, hii, hello, how are you, good morning)\n"
            "- Personal introductions or remarks (e.g., i am rohit, my name is..., you know that)\n"
            "- Brief acknowledgements (e.g., k, ok, okay, thanks, thank you, got it, cool)\n"
            "- Casual banter about you as an assistant (e.g., who are you, what can you do, help)\n"
            "- Light casual non-study chat that does NOT require looking up facts, definitions, formulas, notes, or web info\n\n"
            "Use \"search\" for:\n"
            "- ANY question about uploaded files, syllabus, units, topics, definitions, or formulas\n"
            "- ANY factual, academic, coding, science, history, current-events, or research question (e.g., what is..., capital of..., how does... work, who is...)\n"
            "- ANY follow-up asking for details, examples, or explanation of a study topic (e.g., more details, explain point 2, elaborate)\n\n"
            "IMPORTANT for simple_chat reply: Use CONVERSATION HISTORY if helpful (for example remembering the student's name). "
            "Do NOT use backticks (`), citations like [1], or mention external info.\n\n"
            f"Active documents: {docs_label}\n"
            + (f"Recent conversation:\n{recent_history}\n\n" if recent_history else "")
            + f"Student message: {query}"
        )

        client = get_genai_client()

        def _call_router(model_name: str) -> Dict[str, Any]:
            if _NEW_GENAI:
                res = client.models.generate_content(
                    model=model_name,
                    contents=router_prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                    ),
                )
                raw = (res.text or "").strip()
            else:
                model = genai_legacy.GenerativeModel(model_name=model_name)
                res = model.generate_content(
                    router_prompt,
                    generation_config={"temperature": 0.1, "response_mime_type": "application/json"},
                )
                raw = (res.text or "").strip()

            if not raw:
                raise ValueError("Empty response from router")
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:].strip()
            return json.loads(raw)

        try:
            decision = run_with_model_fallback(config.CHAT_MODELS, _call_router)
            if isinstance(decision, dict) and decision.get("mode") == "simple_chat":
                reply = (decision.get("reply") or "").replace("`", "").strip()
                if reply:
                    return reply
            return None
        except Exception as e:
            logger.warning(f"Simple chat classification failed, falling back: {e}")
            greetings_regex = r"^(hi|hii+|hello|heyy*|hey|howdy|greetings|hola|namaste|good\s*(morning|afternoon|evening)|who\s*are\s*you|what\s*is\s*your\s*name|what\s*can\s*you\s*do|help|thanks|thank\s*you|ok|okay|k|kk)[\s\.\?!]*$"
            if re.match(greetings_regex, query.strip().lower()):
                return "Hello! I am your AI study assistant. How can I help you with your notes and documents today?"
            return None

    def generate_grounded_answer(
        self,
        query: str,
        active_docs: Optional[List[str]] = None,
        user_id: Optional[str] = "guest",
        history: Optional[List[Dict[str, str]]] = None,
        web_search: bool = False
    ) -> Dict[str, Any]:
        """
        Executes Smart RAG retrieval and generation:
        - Model automatically decides if the message is simple chat (answered without searching files or web)
        - Grounds study/factual answers in uploaded documents with inline citations [1], [2]
        - Optionally uses live Web Search when web_search=True
        """
        simple_reply = self._classify_and_reply_simple_chat(query, history=history, active_docs=active_docs)
        if simple_reply is not None:
            print(f"[SIMPLE CHAT] Query: '{query}' -> answered directly without file/web search")
            return {
                "answer": simple_reply,
                "citations": [],
                "is_refusal": False,
                "used_external_info": False,
                "web_search_used": False,
                "web_sources": [],
                "retrieved_count": 0
            }

        # Step 1 & 2: Retrieve top matching chunks from Qdrant (unless active_docs is explicitly empty)
        if active_docs is not None and len(active_docs) == 0:
            retrieved_chunks = []
        else:
            retrieval_query = self._build_retrieval_query(query, history)
            query_vector = embed_query(retrieval_query)
            retrieved_chunks = vector_store.search(
                query_vector=query_vector,
                top_k=config.TOP_K_RETRIEVAL,
                active_docs=active_docs
            )

        # Step 3: Smart Refusal Check (strictly require retrieved chunks when Web Search is off)
        if not web_search and not retrieved_chunks:
            return {
                "answer": self.refusal_message,
                "citations": [],
                "is_refusal": True,
                "used_external_info": False,
                "web_search_used": False,
                "web_sources": [],
                "retrieved_count": 0
            }

        max_score = max((c["score"] for c in retrieved_chunks), default=0.0)
        print(f"[RAG SEARCH] Query: '{query}' | Docs: {active_docs} | WebSearch: {web_search} | Top Score: {max_score:.4f} | Threshold: {config.SIMILARITY_THRESHOLD}")

        # Let the AI brain decide for low-score queries when there is conversation history or active docs;
        # only hard-refuse if Web Search is off, there is no history, and score is very low (< 0.20).
        if not web_search and not history and max_score < 0.20:
            print(f"[RAG REFUSAL] Top score {max_score:.4f} < hard floor 0.20 (no history)")
            return {
                "answer": self.refusal_message,
                "citations": [],
                "is_refusal": True,
                "used_external_info": False,
                "web_search_used": False,
                "web_sources": [],
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

        if web_search:
            system_instruction = (
                "You are StudyRAG, an intelligent, friendly, and interactive AI study tutor. "
                "Web Search is ENABLED: you prioritize the student's uploaded notes and syllabus, "
                "while also using live Web Search results and your academic knowledge when helpful.\n\n"
                "MANDATORY RULES:\n"
                "1. NOTES FIRST & CITATIONS: Always check the provided DOCUMENT SOURCES and CONVERSATION HISTORY first. "
                "Every fact taken from the document sources MUST include an inline citation like [1], [2], etc.\n"
                "2. DEFINITIONS & FORMULAS: Keep definitions short and simple to understand. When formulas are relevant, write them in a simple, clear way and cover all relevant formulas for the topic.\n"
                "3. FOLLOW-UPS & INTENT: Use CONVERSATION HISTORY to understand short follow-ups like 'more details', "
                "'explain point 2', 'give an example', or 'elaborate'. Never say you don't know to a valid follow-up about the notes.\n"
                "4. WEB SEARCH ENABLED: Live Web Search results are provided below under LIVE WEB SEARCH RESULTS. "
                "Prioritize DOCUMENT SOURCES (with inline citations [1], [2]) if relevant, and use LIVE WEB SEARCH RESULTS "
                "plus your verified knowledge to answer clearly and accurately. Do NOT output the document refusal message when Web Search is enabled.\n"
                "5. CRITICAL: NEVER use backticks (`) anywhere in your output. Do NOT wrap words, phrases, or terms in backticks. Use normal text and **bold** for key terms. "
                "Do NOT add any 'External Information Used' labels, tags, or disclaimers.\n\n"
                "INTERACTIVE CHAT STYLE:\n"
                "- Be warm, clear, and engaging like a great tutor so the student enjoys learning.\n"
                "- Use **bold** for section headers and key concepts.\n"
                "- Use bullet points (•) with clear spacing between points so the student can read easily.\n"
                "- When appropriate, end with a short, helpful follow-up question or offer (e.g., offering an example or practice question)."
            )
        else:
            system_instruction = (
                "You are StudyRAG, a strictly grounded academic study assistant. "
                "Web Search is OFF: you MUST answer strictly and EXCLUSIVELY from the provided DOCUMENT SOURCES from the student's selected file(s).\n\n"
                "MANDATORY RULES:\n"
                "1. SELECTED FILE ONLY (STRICT): Every single fact, definition, explanation, or formula in your response MUST come literally and directly "
                "from the provided DOCUMENT SOURCES, and MUST include an inline citation like [1], [2], etc.\n"
                "2. ZERO EXTERNAL INFORMATION: Do NOT use any outside knowledge, general academic knowledge, internet facts, or unstated definitions/expansions "
                "not explicitly written in DOCUMENT SOURCES — even if the document only lists topic names (such as a syllabus) or the student asks for 'more details' beyond what is written in the file.\n"
                "3. WHEN TO REFUSE: If the requested answer or detail is not explicitly written in DOCUMENT SOURCES, output EXACTLY:\n"
                f'   "{self.refusal_message}"\n'
                "4. FOLLOW-UPS: Use CONVERSATION HISTORY only to understand which topic in the selected file the student is referring to, "
                "then answer strictly using ONLY facts written in DOCUMENT SOURCES with inline citations [1], [2].\n"
                "5. DEFINITIONS & FORMULAS: Keep definitions short and simple, and state formulas simply — using ONLY what appears in DOCUMENT SOURCES.\n"
                "6. CRITICAL: NEVER use backticks (`) anywhere in your output. Do NOT wrap words, phrases, or terms in backticks. Use normal text and **bold** for key terms."
            )

        # Inject continuous learning & user feedback guidance dynamically
        learned_guidance = feedback_memory.get_learned_guidance(user_id=user_id)
        if learned_guidance:
            system_instruction += "\n" + learned_guidance
            if not web_search:
                system_instruction += "\nSTRICT REMINDER: Web Search is OFF — never add external information outside DOCUMENT SOURCES."

        web_results = self._fetch_web_search_results(query) if web_search else []
        web_sources = [
            {"title": w["title"], "uri": w["uri"], "domain": w["domain"]}
            for w in web_results
        ]
        web_context_section = ""
        if web_search:
            if web_results:
                web_blocks = [
                    f"[Web {i}] ({w['title']} | {w['uri']}):\n{w['snippet']}"
                    for i, w in enumerate(web_results, 1)
                ]
                web_context_section = "=== LIVE WEB SEARCH RESULTS ===\n" + "\n\n".join(web_blocks) + "\n\n"
            else:
                web_context_section = "=== LIVE WEB SEARCH RESULTS ===\nNo instant web snippets returned; answer using verified general knowledge.\n\n"

        history_section = (
            f"=== CONVERSATION HISTORY ===\n{formatted_history}\n\n"
            if formatted_history else ""
        )

        user_prompt = (
            f"{history_section}"
            f"Student Question: {query}\n\n"
            f"=== DOCUMENT SOURCES ===\n"
            f"{formatted_context}\n\n"
            f"{web_context_section}"
            + (
                "Respond helpfully using the document sources (with inline citations [1], [2]) and conversation context, plus live web search results and external knowledge as needed."
                if web_search else
                "Answer strictly and ONLY from the DOCUMENT SOURCES above with inline citations [1], [2]. Do NOT add any outside or external information. If the answer is not in DOCUMENT SOURCES, reply with the exact refusal message."
            )
        )

        # Step 5: Call Gemini API with multi-model fallback (max 1 retry per model)
        client = get_genai_client()
        response_text = ""

        def _call_chat(model_name: str) -> str:
            if _NEW_GENAI:
                response = client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.1,
                    )
                )
                text = (response.text or "").strip()
            else:
                model = genai_legacy.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction,
                    generation_config={"temperature": 0.1}
                )
                res = model.generate_content(user_prompt)
                text = (res.text or "").strip()
            if not text:
                raise ValueError("Empty response from model")
            return text

        try:
            response_text = run_with_model_fallback(config.CHAT_MODELS, _call_chat)
        except Exception as e:
            logger.error(f"All chat fallback models failed: {e}")
            response_text = self.refusal_message

        # Step 6: Post-process & verify refusal
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

        # When Web Search is OFF, strictly require at least one cited source from the selected file(s)
        if not web_search and not is_refusal and len(active_citations) == 0:
            response_text = self.refusal_message
            is_refusal = True
            active_citations = []

        used_external_info = False
        if not web_search:
            web_search_used = False
            web_sources = []
        else:
            web_search_used = (not is_refusal) and bool(len(web_sources) > 0)

        return {
            "answer": response_text,
            "citations": active_citations,
            "is_refusal": is_refusal,
            "used_external_info": used_external_info,
            "web_search_used": web_search_used,
            "web_sources": web_sources if not is_refusal else [],
            "retrieved_count": len(retrieved_chunks),
            "top_score": max_score
        }

rag_engine = RAGEngine()
