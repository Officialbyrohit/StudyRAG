import logging
import os
import json
import re
from typing import Dict, Any, List
import config
from core.vector_store import vector_store

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
        raise ValueError("GEMINI_API_KEY is not set.")
    
    if _NEW_GENAI:
        return genai.Client(api_key=api_key)
    else:
        genai_legacy.configure(api_key=api_key)
        return genai_legacy


def _clean_json_response(raw_text: str) -> str:
    """Extract and clean valid JSON object from model response."""
    text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start:end+1]
    return text.strip()


def _normalize_external_info(
    result: Dict[str, Any],
    item_lists: List[List[Dict[str, Any]]],
    default_notice: str,
    web_search: bool = True
) -> Dict[str, Any]:
    """Ensure top-level and item-level external info flags and notice are consistent."""
    if not web_search:
        for items in item_lists:
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        item["uses_external_info"] = False
        result["used_external_info"] = False
        result["external_info_notice"] = ""
        return result

    used_ext = bool(result.get("used_external_info", False))
    for items in item_lists:
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                item_ext = bool(item.get("uses_external_info", False))
                item["uses_external_info"] = item_ext
                if item_ext:
                    used_ext = True

    notice = (result.get("external_info_notice") or "").strip()
    if notice:
        used_ext = True
    if used_ext and not notice:
        notice = default_notice

    result["used_external_info"] = used_ext
    result["external_info_notice"] = notice if used_ext else ""
    return result


class StudyToolsService:
    def _call_gemini_json(self, prompt: str) -> Dict[str, Any]:
        client = get_genai_client()
        try:
            if _NEW_GENAI:
                res = client.models.generate_content(
                    model=config.LLM_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )
                raw_text = res.text
            else:
                model = genai_legacy.GenerativeModel(model_name=config.LLM_MODEL)
                res = model.generate_content(
                    prompt,
                    generation_config={"temperature": 0.2, "response_mime_type": "application/json"}
                )
                raw_text = res.text

            clean_text = _clean_json_response(raw_text)
            return json.loads(clean_text)
        except Exception as e:
            logger.error(f"Error calling Gemini JSON: {e}")
            raise e

    def generate_mcqs(self, doc_name: str, count: int = 5, web_search: bool = False) -> Dict[str, Any]:
        """Generate high-yield multiple choice questions strictly based on the document."""
        full_text = vector_store.get_document_full_text(doc_name)
        if not full_text:
            return {"doc_name": doc_name, "error": f"No content found for '{doc_name}'."}

        # Truncate text if very large to fit comfortably
        context = full_text[:40000]

        rules_block = (
            """RULES:
- Prioritize facts written directly in CONTENT.
- If ANY question, option, or explanation uses external knowledge NOT explicitly written in CONTENT (for example, expanding a syllabus topic or defining an acronym not expanded in the file), you MUST set "uses_external_info": true on that question, set top-level "used_external_info": true, and write a clear "external_info_notice" explaining which questions/topics used external information from outside the uploaded file.
- If 100% of all questions, options, and explanations come strictly from CONTENT, set "used_external_info": false and "external_info_notice": "".
- Keep definitions and explanations simple and easy to understand.
- Generate questions that test conceptual understanding, definitions, algorithms, or formulas mentioned in the document."""
            if web_search else
            """RULES (STRICT FILE-ONLY MODE - Web Search is OFF):
- Every question, option, and explanation MUST come strictly and ONLY from facts explicitly written in CONTENT.
- Do NOT use any external knowledge, outside facts, or unstated definitions/expansions beyond what is literally written in CONTENT.
- Always set "used_external_info": false, "external_info_notice": "", and "uses_external_info": false on every question.
- Keep definitions and explanations simple and easy to understand."""
        )

        prompt = f"""
You are an expert exam designer and academic tutor.
Create {count} high-quality Multiple Choice Questions (MCQs) grounded in the following study document.

DOCUMENT: {doc_name}
CONTENT:
{context}

Respond in strictly valid JSON with the following structure:
{{
  "doc_name": "{doc_name}",
  "title": "Practice Quiz: {doc_name}",
  "total_questions": {count},
  "used_external_info": false,
  "external_info_notice": "",
  "questions": [
    {{
      "id": 1,
      "question": "Clear, precise academic question based on the text",
      "options": {{
        "A": "Option text 1",
        "B": "Option text 2",
        "C": "Option text 3",
        "D": "Option text 4"
      }},
      "correct_answer": "A",
      "explanation": "Clear explanation citing the reason why this option is correct.",
      "topic": "Core topic name",
      "uses_external_info": false
    }}
  ]
}}

{rules_block}
OUTPUT ONLY RAW JSON.
"""
        try:
            result = self._call_gemini_json(prompt)
            result["doc_name"] = doc_name
            return _normalize_external_info(
                result,
                [result.get("questions", [])],
                "Some questions, options, or explanations use external information from outside your uploaded file.",
                web_search=web_search
            )
        except Exception as e:
            logger.exception("Failed to generate MCQs")
            return {
                "doc_name": doc_name,
                "error": f"Failed to generate MCQs: {str(e)}"
            }

    def generate_flashcards(self, doc_name: str, count: int = 6, web_search: bool = False) -> Dict[str, Any]:
        """Generate active recall flashcards based on the document."""
        full_text = vector_store.get_document_full_text(doc_name)
        if not full_text:
            return {"doc_name": doc_name, "error": f"No content found for '{doc_name}'."}

        context = full_text[:40000]

        rules_block = (
            """RULES:
- Keep definitions short and simple to understand. Write any formulas in a simple, clear way.
- Prioritize facts written directly in CONTENT.
- If ANY card prompt or answer uses external knowledge NOT explicitly written in CONTENT (for example, defining/expanding a syllabus topic), you MUST set "uses_external_info": true on that card, set top-level "used_external_info": true, and write a clear "external_info_notice" explaining which cards/topics used external information from outside the uploaded file.
- If 100% of all flashcards come strictly from CONTENT, set "used_external_info": false and "external_info_notice": ""."""
            if web_search else
            """RULES (STRICT FILE-ONLY MODE - Web Search is OFF):
- Every flashcard prompt and answer MUST come strictly and ONLY from facts, definitions, and formulas explicitly written in CONTENT.
- Do NOT add any external knowledge, outside definitions, or explanations not written in CONTENT.
- Always set "used_external_info": false, "external_info_notice": "", and "uses_external_info": false on every card.
- Keep definitions short and simple to understand, and write any formulas from CONTENT in a simple, clear way."""
        )

        prompt = f"""
You are an expert tutor creating active recall flashcards for students.
Create {count} study flashcards grounded in the following notes.

DOCUMENT: {doc_name}
CONTENT:
{context}

Respond in strictly valid JSON with the following structure:
{{
  "doc_name": "{doc_name}",
  "title": "Flashcard Deck: {doc_name}",
  "used_external_info": false,
  "external_info_notice": "",
  "flashcards": [
    {{
      "id": 1,
      "front": "Clear concept, term, or question to prompt memory",
      "back": "Short, simple, easy-to-understand definition, formula, or answer",
      "tag": "Key Category / Difficulty (e.g., Definition, Formula, Concept)",
      "uses_external_info": false
    }}
  ]
}}

{rules_block}
OUTPUT ONLY RAW JSON.
"""
        try:
            result = self._call_gemini_json(prompt)
            result["doc_name"] = doc_name
            return _normalize_external_info(
                result,
                [result.get("flashcards", [])],
                "Some flashcards include external information from outside your uploaded file to explain or define topics.",
                web_search=web_search
            )
        except Exception as e:
            logger.exception("Failed to generate Flashcards")
            return {
                "doc_name": doc_name,
                "error": f"Failed to generate Flashcards: {str(e)}"
            }

    def generate_cheatsheet(self, doc_name: str, web_search: bool = False) -> Dict[str, Any]:
        """Generate a high-yield exam cheat sheet with key formulas, definitions, and pitfalls."""
        full_text = vector_store.get_document_full_text(doc_name)
        if not full_text:
            return {"doc_name": doc_name, "error": f"No content found for '{doc_name}'."}

        context = full_text[:60000]

        rules_block = (
            """MANDATORY RULES:
1. SIMPLE & SHORT DEFINITIONS: Every definition in "core_definitions" MUST be short (1 crisp sentence, ~10-20 words) and written in simple, everyday language that is easy to understand without dense jargon.
2. SIMPLE & COMPLETE FORMULAS (COVER ALL FORMULAS): In "key_formulas_or_rules", make sure ALL formulas, equations, scoring functions, recurrences, probabilities, complexity bounds, and mathematical/algorithmic rules from the document AND for every topic/algorithm named in the document are completely covered — do NOT skip any formula! Write every formula in a simple, clean, easy-to-read format with a short plain-English explanation of what the variables mean.
3. EXTERNAL INFORMATION DISCLOSURE: Prioritize facts explicitly in CONTENT. Whenever ANY definition, formula, rule, pitfall, or tip uses external knowledge NOT literally written inside CONTENT (for example, providing a simple definition or formula for a topic/algorithm listed in a syllabus), you MUST set "uses_external_info": true on that item, set top-level "used_external_info": true, and write a clear "external_info_notice" stating that external information outside the uploaded file was used and summarizing what it supplied. If 100% of the cheat sheet comes strictly from CONTENT, set "used_external_info": false and "external_info_notice": ""."""
            if web_search else
            """MANDATORY RULES (STRICT FILE-ONLY MODE - Web Search is OFF):
1. STRICTLY FROM FILE ONLY: Every overview sentence, definition, formula/rule, pitfall, and quick tip MUST come strictly and ONLY from information literally written in CONTENT. Do NOT add any external information, outside definitions, or external formulas not written in CONTENT.
2. SIMPLE & SHORT DEFINITIONS: Keep definitions in "core_definitions" short, simple, and based strictly on CONTENT.
3. SIMPLE & COMPLETE FORMULAS FROM CONTENT: Include ALL formulas, equations, or rules that appear in CONTENT written in a simple, clear format. If CONTENT contains no explicit formulas or equations, return [] for "key_formulas_or_rules" instead of pulling formulas from outside the file.
4. ALWAYS set "used_external_info": false, "external_info_notice": "", and "uses_external_info": false on all items."""
        )

        prompt = f"""
You are an expert academic tutor creating a High-Yield Revision Cheat Sheet for students studying for an exam.
Analyze the following document and extract essential high-yield material.

DOCUMENT: {doc_name}
CONTENT:
{context}

Respond in strictly valid JSON with the following structure:
{{
  "doc_name": "{doc_name}",
  "title": "High-Yield Cheat Sheet: {doc_name}",
  "used_external_info": false,
  "external_info_notice": "",
  "overview": "1-2 simple sentences summarizing the subject.",
  "core_definitions": [
    {{ "term": "Term Name", "definition": "Short, simple, easy-to-understand definition (1 brief sentence)", "uses_external_info": false }}
  ],
  "key_formulas_or_rules": [
    {{ "name": "Formula or Rule Name", "detail": "Simple, clean formula/equation + short plain meaning of terms", "uses_external_info": false }}
  ],
  "common_pitfalls": [
    "Short, simple exam mistake or pitfall to avoid"
  ],
  "quick_tips": [
    "Short, practical exam tip or problem-solving rule"
  ]
}}

{rules_block}

OUTPUT ONLY RAW JSON.
"""
        try:
            result = self._call_gemini_json(prompt)
            result["doc_name"] = doc_name
            return _normalize_external_info(
                result,
                [result.get("core_definitions", []), result.get("key_formulas_or_rules", [])],
                "Some definitions or formulas use external information from outside your uploaded file.",
                web_search=web_search
            )
        except Exception as e:
            logger.exception("Failed to generate Cheatsheet")
            return {
                "doc_name": doc_name,
                "error": f"Failed to generate Cheat Sheet: {str(e)}"
            }


study_tools = StudyToolsService()
