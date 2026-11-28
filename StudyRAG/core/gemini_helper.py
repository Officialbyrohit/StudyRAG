import json
import logging
import time
from typing import Callable, List, TypeVar

import config

logger = logging.getLogger(__name__)
T = TypeVar("T")


def build_genai_client(genai_module, types_module, api_key: str, timeout_ms: int = config.GEMINI_TIMEOUT_MS):
    """Create a google-genai client with SDK auto-retries disabled (1 attempt per call) and explicit timeout."""
    return genai_module.Client(
        api_key=api_key,
        http_options=types_module.HttpOptions(
            timeout=timeout_ms,
            retry_options=types_module.HttpRetryOptions(attempts=1),
        ),
    )


def is_retryable_or_fallback_error(exc: Exception) -> bool:
    """Identify 503, 429, timeout, invalid JSON, or empty-response failures."""
    if isinstance(exc, (json.JSONDecodeError, TimeoutError)):
        return True
    status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if status in (408, 429, 503, 504):
        return True
    msg = str(exc).lower()
    markers = (
        "503",
        "unavailable",
        "429",
        "resource_exhausted",
        "rate limit",
        "quota",
        "timeout",
        "timed out",
        "deadline",
        "json",
        "expecting value",
        "empty response",
    )
    return any(marker in msg for marker in markers)


def run_with_model_fallback(
    models: List[str],
    call_fn: Callable[[str], T],
    max_retries: int = config.GEMINI_MAX_RETRIES_PER_MODEL,
    retry_delay_sec: float = 0.5,
) -> T:
    """Execute call_fn across models in order, retrying each model at most max_retries times on transient/JSON errors."""
    last_error = None
    for model_name in models:
        for attempt in range(max_retries + 1):
            try:
                return call_fn(model_name)
            except Exception as exc:
                last_error = exc
                logger.warning(f"Model '{model_name}' failed (attempt {attempt + 1}/{max_retries + 1}): {exc}")
                if attempt < max_retries and is_retryable_or_fallback_error(exc):
                    if retry_delay_sec > 0:
                        time.sleep(retry_delay_sec)
                    continue
                break
    if last_error is not None:
        raise last_error
    raise RuntimeError("No models configured for execution.")
