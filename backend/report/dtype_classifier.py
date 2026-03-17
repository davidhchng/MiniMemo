"""
AI-assisted dtype classification.

Runs as a post-processing pass over columns that the heuristic left ambiguous
(classified as "categorical" or "unknown"). One LLM call per /analyze request.

The LLM receives only column names + sample values — no raw data rows.
All results are validated against the known dtype Literal before being applied.
If the LLM call fails for any reason, heuristic results are preserved unchanged.
"""

from __future__ import annotations
import json
import logging
from report.llm_client import LLMClient

logger = logging.getLogger(__name__)

VALID_DTYPES = frozenset({
    "numeric", "categorical", "datetime", "boolean",
    "email", "identifier", "text", "unknown",
})

_SYSTEM_PROMPT = """\
You are classifying columns in a tabular dataset.
For each column, choose the single best dtype from this list:
["numeric", "categorical", "datetime", "boolean", "email", "identifier", "text", "unknown"]

Definitions:
- numeric: values are numbers or parseable as numbers
- datetime: values are dates, times, or timestamps
- email: values are email addresses (contain @)
- identifier: values look like IDs, codes, or keys — high uniqueness, short, non-natural-language
- categorical: discrete repeated labels or categories (status, type, region, plan, country, etc.)
- text: free-form natural language (descriptions, notes, comments, reviews)
- boolean: values are true/false, yes/no, 0/1
- unknown: cannot determine from the available information

Use the column name as a strong hint. For example:
- "country", "region", "status", "plan" → almost always categorical
- "created_at", "date", "timestamp" → almost always datetime
- "id", "uuid", "customer_id" → almost always identifier
- "email", "email_address" → almost always email
- "notes", "description", "comments" → almost always text

Respond ONLY with a valid JSON object mapping column name to dtype.
No explanation, no markdown, no code fences. Just the JSON object.
Example: {"Country": "categorical", "Signup Date": "datetime"}
"""


def classify_columns_with_ai(
    client: LLMClient,
    columns: list[dict],
) -> dict[str, str]:
    """
    Ask the LLM to refine dtype classifications for ambiguous columns.

    Args:
        client: An LLMClient instance (real or mock).
        columns: List of dicts with keys:
                 name, heuristic_dtype, sample_values, null_pct, unique_pct

    Returns:
        Dict mapping column name → refined dtype string.
        Only includes columns where the LLM returned a valid known dtype.
        Falls back silently to empty dict on any error.
    """
    if not columns:
        return {}

    user_payload = {
        "columns": [
            {
                "name": col["name"],
                "samples": col["sample_values"][:5],
                "unique_pct": round(col["unique_pct"], 3),
                "null_pct": round(col["null_pct"], 3),
            }
            for col in columns
        ]
    }

    try:
        raw = client.complete(
            system=_SYSTEM_PROMPT,
            user=json.dumps(user_payload),
            max_tokens=256,
        )
        parsed = json.loads(raw)
    except Exception as exc:
        logger.warning("AI dtype classification failed, using heuristic results: %s", exc)
        return {}

    # Validate: only keep entries with known column names and valid dtypes
    result: dict[str, str] = {}
    known_names = {col["name"] for col in columns}
    for name, dtype in parsed.items():
        if name in known_names and dtype in VALID_DTYPES:
            result[name] = dtype

    return result
