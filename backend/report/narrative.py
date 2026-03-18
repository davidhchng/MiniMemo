"""
Narrative service — presentation layer only.

Architecture
------------
NarrativeService is a Protocol with two implementations:
  - PassthroughNarrativeService  — deterministic default, returns None for all methods
  - LLMNarrativeService          — generates and rewrites content via LLM

get_narrative_service() returns the appropriate implementation based on
whether an LLM API key is configured. main.py depends only on the Protocol.
"""

from __future__ import annotations
import json
from typing import Protocol, runtime_checkable


@runtime_checkable
class NarrativeService(Protocol):
    def generate_analytical_insights(self, context: dict) -> list[str] | None:
        """Generate key insight bullets from rich analysis context. None = use deterministic fallback."""
        ...

    def rewrite_project_background(
        self, goals: str | None, background: str | None, dataset_info: dict
    ) -> str | None:
        """Return a fully-written project background section. None = use raw input."""
        ...

    def generate_recommendation_items(
        self,
        key_bullets: list[str],
        dataset_info: dict,
        goals: str | None,
        background: str | None,
    ) -> list[dict] | None:
        """Return list of {title, observation, action} dicts, or None to use fallback."""
        ...

    def generate_split_assumptions(self, context: dict) -> dict | None:
        """Return {assumptions: [...], limitations: [...]}, or None to use fallback."""
        ...

    def generate_conclusion(self, key_bullets: list[str], dataset_name: str) -> str | None:
        """Return a conclusion paragraph string, or None to use fallback."""
        ...


class PassthroughNarrativeService:
    """Deterministic default — no LLM calls. All methods return None."""

    def generate_analytical_insights(self, context: dict) -> list[str] | None:
        return None

    def rewrite_project_background(
        self, goals: str | None, background: str | None, dataset_info: dict
    ) -> str | None:
        return None

    def generate_recommendation_items(
        self,
        key_bullets: list[str],
        dataset_info: dict,
        goals: str | None,
        background: str | None,
    ) -> list[dict] | None:
        return None

    def generate_split_assumptions(self, context: dict) -> dict | None:
        return None

    def generate_conclusion(self, key_bullets: list[str], dataset_name: str) -> str | None:
        return None


class LLMNarrativeService:
    """Generates and rewrites report content via an LLM.

    Falls back gracefully to None on any failure so callers keep originals.
    """

    _ANALYTICAL_INSIGHTS_SYSTEM = (
        "You are a senior data analyst who has just finished examining a dataset. "
        "You have computed statistics, correlations, distributions, and category breakdowns in front of you. "
        "Write 5 to 7 analytical observations that a skilled analyst would highlight in a client review.\n\n"
        "What makes a good observation:\n"
        "- It notices something that is not obvious just from the column names\n"
        "- It connects two or more things (e.g. a correlation, a category that bucks a trend, a shift over time)\n"
        "- It includes an interpretation or implication, not just a raw number\n"
        "- It raises a question worth investigating or points to an action\n\n"
        "Style:\n"
        "- Write as if explaining to a client in a meeting — engaged, analytical, direct\n"
        "- Use interpretive language: 'This suggests...', 'Notably...', 'What stands out here is...', "
        "'This is worth investigating because...', 'Interestingly...'\n"
        "- Each observation is 1-2 sentences. Lead with the finding, then the implication.\n"
        "- Vary sentence structure — do not start every bullet the same way\n"
        "- Preserve every number and percentage exactly\n"
        "- If goals are provided, prioritize observations that are relevant to them\n\n"
        "Return ONLY a JSON array of strings — no markdown, no headers, no other text."
    )

    _PROJECT_BACKGROUND_SYSTEM = (
        "You are a senior data analyst writing the Project Background section of a formal analytics report.\n\n"
        "You will receive raw notes from the analyst — their stated goals, data context, and basic dataset metadata. "
        "Your job is to transform these raw notes into a formal, well-written project background. "
        "Treat the input as a rough brief, not as prose to be quoted.\n\n"
        "Write 2 to 3 paragraphs structured as follows:\n"
        "1. Introduce the dataset in context — what domain it covers, what is being measured, "
        "the apparent scope (time period, geography, entity type). Draw on the column names and "
        "dataset metadata to infer this, and connect it to the user's background notes.\n"
        "2. Articulate the analytical objective — frame the user's goals as a clear analytical question "
        "or business decision this analysis is designed to inform. Explain why answering it matters.\n"
        "3. Briefly describe the analytical lens — which dimensions and measures will be examined "
        "and what kinds of patterns (trends, segment differences, correlations) will be explored.\n\n"
        "Critical style rules:\n"
        "- Do NOT quote or closely paraphrase the user's raw input — reframe it entirely\n"
        "- Do NOT start any sentence with words directly lifted from the user's notes\n"
        "- Write in third person ('This analysis...', 'The dataset...', 'This report...')\n"
        "- Formal but human — like a skilled analyst who genuinely understands the project\n"
        "- Do not mention AI, automation, or that this was generated\n"
        "- Do not invent specific numbers or facts not implied by the input\n"
        "- Return ONLY the paragraph text — no JSON, no headers, no markdown, no bullet points"
    )

    _RECOMMENDATION_ITEMS_SYSTEM = (
        "You are a data analyst writing the Recommendations section of an analytics report.\n"
        "You will receive a JSON object with:\n"
        '  "key_findings": the most important patterns detected in the data\n'
        '  "dataset": basic dataset information\n'
        '  "goals": (optional) what the user is trying to find out or decide\n'
        '  "background": (optional) context about the data origin\n\n'
        "Generate 4 to 6 recommendations. Each must be a JSON object with exactly three keys:\n"
        '  "title": a short, action-oriented heading (5-10 words, title case)\n'
        '  "observation": one sentence about what the data shows that motivates this recommendation\n'
        '  "action": one sentence stating the specific action to take\n\n'
        "Rules:\n"
        "- Ground each observation in the key findings\n"
        "- If goals are provided, ensure recommendations directly address them\n"
        "- Preserve all numbers and percentages exactly\n"
        "- Be specific and actionable — sound like a real analyst, not a generic template\n"
        "- Return ONLY a JSON array of objects — no markdown, no other text"
    )

    _SPLIT_ASSUMPTIONS_SYSTEM = (
        "You are a data analyst writing the Assumptions and Limitations sections of an analytics report.\n"
        "You will receive a JSON object describing a dataset's structure and quality characteristics.\n\n"
        "Return a JSON object with exactly two keys:\n"
        '  "assumptions": array of 3 to 5 strings — things taken as true that cannot be verified from the data\n'
        '  "limitations": array of 2 to 4 strings — constraints on what this analysis can determine\n\n'
        "Rules:\n"
        "- Write each item as one plain, complete sentence\n"
        "- Be specific to this dataset — not generic boilerplate\n"
        "- Assumptions: start with 'Assume that...'\n"
        "- Limitations: describe what is NOT included or what CANNOT be concluded\n"
        "- Preserve any numbers from the context exactly\n"
        "- Return ONLY the JSON object — no markdown, no other text"
    )

    _CONCLUSION_SYSTEM = (
        "You are a senior data analyst writing the concluding paragraph of an analytics report. "
        "You will receive a JSON object with the dataset name and a list of key findings.\n\n"
        "Write a single paragraph of 3 to 5 sentences that:\n"
        "1. Opens by referencing the dataset and overall analytical context\n"
        "2. Weaves the key findings into flowing prose — do not list them as bullets\n"
        "3. Closes with a grounded forward-looking statement about what to investigate or act on next\n\n"
        "Style:\n"
        "- Write as if wrapping up a client presentation — engaged, authoritative, human\n"
        "- Use connective language: 'Taken together...', 'What this points to...', 'The clearest thread is...'\n"
        "- Preserve every number and percentage exactly\n"
        "- Do NOT start with 'In conclusion' or 'To summarize'\n"
        "- Return ONLY the paragraph text — no JSON, no markdown, no quotes"
    )

    def __init__(self, client: object):
        self._client = client

    def generate_analytical_insights(self, context: dict) -> list[str] | None:
        try:
            raw = self._client.complete(
                system=self._ANALYTICAL_INSIGHTS_SYSTEM,
                user=json.dumps(context, ensure_ascii=False),
                max_tokens=700,
            )
            result = json.loads(raw)
        except Exception:
            return None

        if (
            not isinstance(result, list)
            or not result
            or not all(isinstance(s, str) and s.strip() for s in result)
        ):
            return None

        return [s.strip() for s in result[:8]]

    def rewrite_project_background(
        self, goals: str | None, background: str | None, dataset_info: dict
    ) -> str | None:
        if not goals and not background:
            return None
        payload = {"dataset": dataset_info}
        if goals:
            payload["goals"] = goals
        if background:
            payload["background"] = background
        try:
            raw = self._client.complete(
                system=self._PROJECT_BACKGROUND_SYSTEM,
                user=json.dumps(payload, ensure_ascii=False),
                max_tokens=400,
            )
        except Exception:
            return None
        text = raw.strip().strip('"').strip()
        return text if len(text) > 50 else None

    def generate_recommendation_items(
        self,
        key_bullets: list[str],
        dataset_info: dict,
        goals: str | None,
        background: str | None,
    ) -> list[dict] | None:
        payload: dict = {"key_findings": key_bullets, "dataset": dataset_info}
        if goals:
            payload["goals"] = goals
        if background:
            payload["background"] = background
        try:
            raw = self._client.complete(
                system=self._RECOMMENDATION_ITEMS_SYSTEM,
                user=json.dumps(payload, ensure_ascii=False),
                max_tokens=700,
            )
            result = json.loads(raw)
        except Exception:
            return None

        if not isinstance(result, list) or not result:
            return None

        validated = []
        for item in result:
            if (
                isinstance(item, dict)
                and isinstance(item.get("title"), str) and item["title"].strip()
                and isinstance(item.get("observation"), str) and item["observation"].strip()
                and isinstance(item.get("action"), str) and item["action"].strip()
            ):
                validated.append({
                    "title": item["title"].strip(),
                    "observation": item["observation"].strip(),
                    "action": item["action"].strip(),
                })

        return validated[:6] if validated else None

    def generate_split_assumptions(self, context: dict) -> dict | None:
        try:
            raw = self._client.complete(
                system=self._SPLIT_ASSUMPTIONS_SYSTEM,
                user=json.dumps(context, ensure_ascii=False),
                max_tokens=500,
            )
            result = json.loads(raw)
        except Exception:
            return None

        if not isinstance(result, dict):
            return None

        assumptions = [s.strip() for s in result.get("assumptions", []) if isinstance(s, str) and s.strip()]
        limitations = [s.strip() for s in result.get("limitations", []) if isinstance(s, str) and s.strip()]

        if not assumptions and not limitations:
            return None

        return {"assumptions": assumptions, "limitations": limitations}

    def generate_conclusion(self, key_bullets: list[str], dataset_name: str) -> str | None:
        if not key_bullets:
            return None
        payload = {"dataset": dataset_name, "key_findings": key_bullets}
        try:
            raw = self._client.complete(
                system=self._CONCLUSION_SYSTEM,
                user=json.dumps(payload, ensure_ascii=False),
                max_tokens=350,
            )
        except Exception:
            return None
        text = raw.strip().strip('"').strip()
        return text if text else None


def get_narrative_service() -> NarrativeService:
    """Return LLMNarrativeService if any API key is configured, else PassthroughNarrativeService."""
    from report.llm_client import get_llm_client, MockLLMClient
    client = get_llm_client()
    if isinstance(client, MockLLMClient):
        return PassthroughNarrativeService()
    return LLMNarrativeService(client=client)
