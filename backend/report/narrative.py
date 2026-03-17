"""
AI narrative layer — presentation only.

Takes pre-computed deterministic insight bullets and rewrites them for
clarity and professional tone. No statistics are computed here.

Contract:
- Input:  list of plain-English insight strings (from deterministic layer)
- Output: same-length list of rewritten strings, or None on any failure
- Caller must fall back to original bullets when None is returned
"""

from __future__ import annotations
import json
from report.llm_client import LLMClient

_SYSTEM_PROMPT = (
    "You are a data analyst writing a concise insights summary. "
    "You will receive a JSON array of pre-computed analytical findings. "
    "Rewrite each one as a clear, professional, single sentence.\n\n"
    "Rules:\n"
    "- Preserve every number and percentage exactly as given\n"
    "- Do not add new information or invent findings\n"
    "- Return exactly one output string per input string\n"
    "- Write in active voice, present tense\n"
    "- Return ONLY a JSON array of strings — no other text, no markdown"
)


def rewrite_insight_bullets(
    client: LLMClient,
    bullets: list[str],
) -> list[str] | None:
    """Rewrite deterministic bullets for clarity. Returns None on any failure."""
    if not bullets:
        return None

    try:
        raw = client.complete(
            system=_SYSTEM_PROMPT,
            user=json.dumps(bullets, ensure_ascii=False),
            max_tokens=400,
        )
        result = json.loads(raw)
    except Exception:
        return None

    if (
        not isinstance(result, list)
        or len(result) != len(bullets)
        or not all(isinstance(s, str) and s.strip() for s in result)
    ):
        return None

    return [s.strip() for s in result]
