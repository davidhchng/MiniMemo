"""
Narrative service — presentation layer only.

Architecture
------------
NarrativeService is a Protocol with two implementations:
  - PassthroughNarrativeService  — deterministic default, returns bullets unchanged
  - LLMNarrativeService          — rewrites bullets via LLM for better phrasing

get_narrative_service() returns the appropriate implementation based on
whether OPENAI_API_KEY is set. main.py depends only on the Protocol — swapping
to a different provider requires no changes outside this file.
"""

from __future__ import annotations
import json
import os
from typing import Protocol, runtime_checkable


@runtime_checkable
class NarrativeService(Protocol):
    def rewrite_key_insights(self, bullets: list[str]) -> list[str] | None:
        """Return rewritten bullets, or None to keep the originals."""
        ...


class PassthroughNarrativeService:
    """Deterministic default — no rewriting. Always returns None so callers
    keep the original deterministic bullets."""

    def rewrite_key_insights(self, bullets: list[str]) -> list[str] | None:
        return None


class LLMNarrativeService:
    """Rewrites Key Insights bullets via an LLM for cleaner phrasing.

    Falls back gracefully to None on any failure so callers keep originals.
    """

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

    def __init__(self, client: object):
        self._client = client

    def rewrite_key_insights(self, bullets: list[str]) -> list[str] | None:
        if not bullets:
            return None
        try:
            raw = self._client.complete(
                system=self._SYSTEM_PROMPT,
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


def get_narrative_service() -> NarrativeService:
    """Return LLMNarrativeService if any API key is configured, else PassthroughNarrativeService."""
    from report.llm_client import get_llm_client, MockLLMClient
    client = get_llm_client()
    if isinstance(client, MockLLMClient):
        return PassthroughNarrativeService()
    return LLMNarrativeService(client=client)
