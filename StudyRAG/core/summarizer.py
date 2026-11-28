import logging
import os
import json
from typing import Dict, Any
import config
from core.vector_store import vector_store
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
        raise ValueError("GEMINI_API_KEY is not set.")
    
    if _NEW_GENAI:
        return build_genai_client(genai, types, api_key)
    else:
        genai_legacy.configure(api_key=api_key)
        return genai_legacy


class DocumentSummarizer:
    def summarize_document(self, doc_name: str, web_search: bool = False) -> Dict[str, Any]:
        """
        Generate a structured study summary for an uploaded document/chapter
        using Gemini Flash's long context window.
        """
        full_text = vector_store.get_document_full_text(doc_name)
        if not full_text:
            return {
                "doc_name": doc_name,
                "error": f"No content found for document '{doc_name}'. Please ensure it is uploaded."
            }

        strict_rule = (
            "EXTERNAL INFO RULE: If ANY fact, definition, expansion, or explanation uses knowledge outside CONTENT, set \"used_external_info\": true and explain what was added in \"external_info_notice\"."
            if web_search else
            "STRICT FILE-ONLY RULE (Web Search is OFF): Use ONLY facts, topics, definitions, and formulas literally present in CONTENT. Do NOT add any external information, outside definitions, or explanations not written in CONTENT. Always set \"used_external_info\": false and \"external_info_notice\": \"\"."
        )

        prompt = f"""
You are an expert academic tutor summarizing study notes, syllabi, and lecture slides for a student.

DOCUMENT: {doc_name}
CONTENT:
{full_text}

{strict_rule}

Generate a thorough, well-structured study summary in valid JSON format with the following fields:
1. "title": A clear title summarizing the chapter or document (e.g., "Document Summary: Computer Networks Syllabus").
2. "badge": A short tag (e.g. "Ch 4 · Core Lecture" or "Course Syllabus").
3. "executive_summary": A short, crisp 1-2 sentence overview summarizing the main purpose and scope of this document.
4. "key_points": A comprehensive list of 6-10 detailed bullet points covering every major unit, topic, definition, algorithm, or formula in the document (keep any definitions short and simple to understand, and write any formulas simply).
5. "highlights": An array of exactly 3 quick-glance highlight objects, each with:
   - "label": (e.g., "Core Focus", "Key Topics", "Main Takeaway")
   - "value": (concise specific phrase from the document)
6. "used_external_info": Boolean (`true` if ANY fact, definition, expansion, or explanation in your summary uses external knowledge not explicitly written in CONTENT; `false` only if 100% comes strictly from CONTENT).
7. "external_info_notice": String — if "used_external_info" is true, clearly tell the user that external information outside the uploaded file was used and briefly note which parts; otherwise "".

OUTPUT ONLY THE JSON OBJECT. No preamble, no backticks, just raw valid JSON.
"""

        client = get_genai_client()

        def _call_summary(model_name: str) -> Dict[str, Any]:
            if _NEW_GENAI:
                res = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )
                response_text = (res.text or "").strip()
            else:
                model = genai_legacy.GenerativeModel(model_name=model_name)
                res = model.generate_content(
                    prompt,
                    generation_config={"temperature": 0.2, "response_mime_type": "application/json"}
                )
                response_text = (res.text or "").strip()

            if not response_text:
                raise ValueError("Empty response from model")

            if response_text.startswith("```"):
                response_text = response_text.strip("`")
                if response_text.lower().startswith("json"):
                    response_text = response_text[4:].strip()

            data = json.loads(response_text)
            data["doc_name"] = doc_name
            if not web_search:
                data["used_external_info"] = False
                data["external_info_notice"] = ""
            else:
                used_ext = bool(data.get("used_external_info", False))
                notice = (data.get("external_info_notice") or "").strip()
                if notice and not used_ext:
                    used_ext = True
                if used_ext and not notice:
                    notice = "External information from outside your uploaded file was used to explain or expand topics not fully detailed in the document."
                data["used_external_info"] = used_ext
                data["external_info_notice"] = notice
            return data

        try:
            return run_with_model_fallback(config.SUMMARY_MODELS, _call_summary)
        except Exception as last_error:
            logger.error(f"Error generating JSON summary across all models: {last_error}")
        return {
            "doc_name": doc_name,
            "title": f"Summary: {doc_name}",
            "badge": "Retry Needed",
            "executive_summary": f"Could not generate the AI summary for {doc_name} right now because the AI service is temporarily busy. Please try again in a moment.",
            "key_points": [
                "The document is uploaded and ready, but the model returned a temporary service error.",
                "Click Summary again or ask a specific question in the chat below."
            ],
            "highlights": [
                {"label": "Document", "value": doc_name},
                {"label": "Status", "value": "Temporary Error"},
                {"label": "Action", "value": "Try Again"}
            ],
            "used_external_info": False,
            "external_info_notice": ""
        }

summarizer = DocumentSummarizer()
