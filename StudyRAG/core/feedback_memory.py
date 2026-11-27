import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import config

logger = logging.getLogger(__name__)

FEEDBACK_FILE = config.BASE_DIR / "feedback_data.json"


class FeedbackMemory:
    def __init__(self):
        self.file_path = FEEDBACK_FILE
        self._ensure_file()

    def _ensure_file(self):
        if not self.file_path.exists():
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump({"feedbacks": [], "learned_rules": []}, f, indent=2)

    def _load_data(self) -> Dict[str, Any]:
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading feedback data: {e}")
            return {"feedbacks": [], "learned_rules": []}

    def _save_data(self, data: Dict[str, Any]):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving feedback data: {e}")

    def add_feedback(
        self,
        query: str,
        answer: str,
        rating: str,  # "like" or "dislike"
        opinion: Optional[str] = None,
        active_docs: Optional[List[str]] = None,
        user_id: Optional[str] = "guest"
    ) -> Dict[str, Any]:
        """Save a new user reaction/feedback entry and update learned rules per user."""
        data = self._load_data()
        uid = (user_id or "guest").strip() or "guest"
        
        feedback_entry = {
            "id": f"fb_{int(datetime.utcnow().timestamp() * 1000)}",
            "user_id": uid,
            "query": query.strip(),
            "answer": answer.strip()[:600],  # store snapshot
            "rating": rating,
            "opinion": opinion.strip() if opinion else "",
            "active_docs": active_docs or [],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        data["feedbacks"].append(feedback_entry)
        
        # Ensure per-user structure exists
        if "user_rules" not in data:
            data["user_rules"] = {}
        if uid not in data["user_rules"]:
            data["user_rules"][uid] = []
        
        # Update quick rule abstractions based on feedback opinions
        if opinion and opinion.strip():
            self._extract_learning_rule(data, opinion.strip(), rating, uid)
            
        self._save_data(data)
        return feedback_entry

    def _extract_learning_rule(self, data: Dict[str, Any], opinion: str, rating: str, user_id: str = "guest"):
        """Extract a structured guidance rule from user feedback opinion specifically for this user."""
        op_lower = opinion.lower()
        global_rules = data.get("learned_rules", [])
        user_rules = data.setdefault("user_rules", {}).setdefault(user_id, [])

        # Categorize common student feedback patterns
        rule_text = None
        if "detail" in op_lower or "elaborate" in op_lower or "deep" in op_lower or "more" in op_lower or ("brief" in op_lower and "too" in op_lower):
            rule_text = "Provide thorough, detailed coverage of key concepts and sub-topics explicitly found in the notes."
        elif "short" in op_lower or "concise" in op_lower or ("brief" in op_lower and "too" not in op_lower):
            rule_text = "Keep explanations especially concise and direct; focus on high-yield exam takeaways."
        elif "bullet" in op_lower or "point" in op_lower or "list" in op_lower:
            rule_text = "Structure information primarily in crisp, bulleted lists with bold terms for easy revision."
        elif "simple" in op_lower or "easy" in op_lower or "plain" in op_lower or "jargon" in op_lower:
            rule_text = "Use simple, accessible language. Clarify technical jargon in intuitive student-friendly terms."
        elif "example" in op_lower:
            rule_text = "Highlight practical examples or problem applications mentioned in the source materials."
        elif "step" in op_lower:
            rule_text = "Break down complex answers into structured step-by-step numbered walkthroughs."
        elif "exam" in op_lower or "takeaway" in op_lower:
            rule_text = "Emphasize key definitions, formulas, and critical exam takeaways prominently."
        else:
            # Custom opinion directly
            prefix = "User likes when:" if rating == "like" else "User prefers you to avoid:"
            rule_text = f"{prefix} {opinion}"

        if rule_text:
            if rule_text not in user_rules:
                user_rules.append(rule_text)
                if len(user_rules) > 8:
                    user_rules = user_rules[-8:]
                data["user_rules"][user_id] = user_rules

            if rule_text not in global_rules:
                global_rules.append(rule_text)
                if len(global_rules) > 8:
                    global_rules = global_rules[-8:]
                data["learned_rules"] = global_rules

    def get_learned_guidance(self, user_id: str = "guest") -> str:
        """
        Synthesizes active feedback into dynamic context instructions for Gemini for a specific individual user.
        Returns empty string if no feedback has been recorded yet.
        """
        data = self._load_data()
        feedbacks = data.get("feedbacks", [])
        uid = (user_id or "guest").strip() or "guest"
        
        # User-specific feedback & rules
        user_feedbacks = [fb for fb in feedbacks if fb.get("user_id", "guest") == uid]
        user_rules = data.get("user_rules", {}).get(uid, [])
        
        # Fall back to general if user has no entries yet
        active_feedbacks = user_feedbacks if user_feedbacks else feedbacks
        active_rules = user_rules if user_rules else data.get("learned_rules", [])

        if not active_feedbacks and not active_rules:
            return ""

        likes = sum(1 for fb in active_feedbacks if fb.get("rating") == "like")
        dislikes = sum(1 for fb in active_feedbacks if fb.get("rating") == "dislike")
        recent_opinions = [
            fb["opinion"] for fb in reversed(active_feedbacks)
            if fb.get("opinion")
        ][:4]

        guidance_lines = [
            f"\nCONTINUOUS LEARNING & USER PREFERENCES (Personalized for user '{uid}'):",
            f"- Individual feedback profile: {likes} liked responses, {dislikes} disliked responses."
        ]

        if active_rules:
            guidance_lines.append(f"- Active preferences learned from user '{uid}' unlike/like reactions:")
            for r in active_rules:
                guidance_lines.append(f"  * {r}")

        if recent_opinions:
            guidance_lines.append(f"- Recent direct feedback from user '{uid}':")
            for op in recent_opinions:
                guidance_lines.append(f'  * "{op}"')

        guidance_lines.append(
            f"- Always tailor your response style specifically for user '{uid}' based on these learned preferences while strictly adhering to grounding rules.\n"
        )

        return "\n".join(guidance_lines)

    def get_stats(self) -> Dict[str, Any]:
        """Return analytics for UI display."""
        data = self._load_data()
        feedbacks = data.get("feedbacks", [])
        rules = data.get("learned_rules", [])

        likes = sum(1 for fb in feedbacks if fb.get("rating") == "like")
        dislikes = sum(1 for fb in feedbacks if fb.get("rating") == "dislike")

        return {
            "total_feedbacks": len(feedbacks),
            "likes": likes,
            "dislikes": dislikes,
            "satisfaction_rate": f"{(likes / len(feedbacks) * 100):.1f}%" if feedbacks else "100%",
            "learned_rules": rules,
            "recent_feedbacks": feedbacks[-5:]
        }

    def clear_all(self):
        """Reset feedback memory."""
        self._save_data({"feedbacks": [], "learned_rules": []})


feedback_memory = FeedbackMemory()
