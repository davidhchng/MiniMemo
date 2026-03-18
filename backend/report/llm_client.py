"""
Provider-abstracted LLM client.

Used for:
- narrative rewriting (Key Insights bullets)
- dtype classification (future)

Any code that needs an LLM depends only on the LLMClient Protocol,
never on a concrete provider. get_llm_client() picks the right one based on .env.

Priority: GEMINI_API_KEY → OPENAI_API_KEY → MockLLMClient (no-op)
"""

from __future__ import annotations
import os
from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMClient(Protocol):
    def complete(self, system: str, user: str, max_tokens: int) -> str: ...


class GeminiClient:
    """Google Gemini implementation of LLMClient (uses google-genai SDK)."""

    def __init__(self, api_key: str, model: str = "models/gemini-2.0-flash"):
        try:
            from google import genai  # noqa: F401
        except ImportError as e:
            raise ImportError("google-genai required: pip install google-genai") from e
        self._api_key = api_key
        self._model_name = model

    def complete(self, system: str, user: str, max_tokens: int) -> str:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=self._api_key)
        response = client.models.generate_content(
            model=self._model_name,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.0,
            ),
        )
        return response.text or ""


class OpenAIClient:
    """OpenAI implementation of LLMClient."""

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
            temperature=0,
        )
        return response.choices[0].message.content or ""


class MockLLMClient:
    """
    No-op client used when no API key is configured.
    Returns empty JSON so callers fall back gracefully.
    """

    def complete(self, system: str, user: str, max_tokens: int) -> str:
        return "{}"


def get_llm_client() -> LLMClient:
    """
    Returns the best available LLM client based on environment variables.
    Priority: GEMINI_API_KEY > OPENAI_API_KEY > MockLLMClient
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key:
        return GeminiClient(api_key=gemini_key)
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        return OpenAIClient(api_key=openai_key)
    return MockLLMClient()
