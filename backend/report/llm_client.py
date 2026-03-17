"""
Provider-abstracted LLM client.

Used for:
- dtype classification (Phase 1.5 — now)
- narrative report generation (Phase 3 — later)

Any code that needs an LLM depends only on the LLMClient Protocol,
never on a concrete provider. Swap providers by changing LLM_PROVIDER in .env.
"""

from __future__ import annotations
import os
from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMClient(Protocol):
    def complete(self, system: str, user: str, max_tokens: int) -> str: ...


class OpenAIClient:
    """Concrete OpenAI implementation of LLMClient."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        try:
            from openai import OpenAI
        except ImportError as e:
            raise ImportError("openai package is required: pip install openai") from e
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete(self, system: str, user: str, max_tokens: int) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0,  # deterministic output
        )
        return response.choices[0].message.content or ""


class MockLLMClient:
    """
    No-op client used when no API key is configured.
    Returns empty JSON so callers fall back to heuristic results gracefully.
    """

    def complete(self, system: str, user: str, max_tokens: int) -> str:
        return "{}"


def get_llm_client() -> LLMClient:
    """
    Returns a real LLM client if OPENAI_API_KEY is set in the environment,
    otherwise returns MockLLMClient so the app works without any API key.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key:
        return OpenAIClient(api_key=api_key)
    return MockLLMClient()
