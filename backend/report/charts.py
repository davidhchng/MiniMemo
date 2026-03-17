"""
Deterministic chart specification generators.

Backend computes all aggregation and binning.
Frontend renders the pre-computed x/y arrays with Plotly — no data logic there.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from models import ChartSpec


def bar_spec(
    groups: list,
    means: list[float],
    dim_name: str,
    measure_name: str,
) -> ChartSpec:
    """Bar chart: mean of a measure across the top N groups of a dimension."""
    return ChartSpec(
        type="bar",
        title=f"{measure_name} by {dim_name}",
        x_label=dim_name,
        y_label=f"Avg {measure_name}",
        x=[str(g) for g in groups],
        y=[round(float(v), 2) for v in means],
    )


def histogram_spec(series: pd.Series, col_name: str, n_bins: int = 10) -> ChartSpec | None:
    """Pre-binned distribution. Uses numpy to compute bin edges and counts."""
    clean = series.dropna()
    if len(clean) < 2:
        return None
    n_unique = int(clean.nunique())
    if n_unique < 2:
        return None

    actual_bins = min(n_bins, n_unique)
    try:
        counts, edges = np.histogram(clean.astype(float), bins=actual_bins)
    except Exception:
        return None

    # Label each bin as "lo – hi" using compact numeric formatting
    x = [f"{_fmt_num(edges[i])}–{_fmt_num(edges[i + 1])}" for i in range(len(edges) - 1)]
    y = [int(c) for c in counts]

    return ChartSpec(
        type="histogram",
        title=f"Distribution of {col_name}",
        x_label=col_name,
        y_label="Count",
        x=x,
        y=y,
    )


def line_spec(
    df: pd.DataFrame,
    time_col_name: str,
    measure_col_name: str,
) -> ChartSpec | None:
    """Monthly (or yearly) average of a measure over time."""
    try:
        dates = pd.to_datetime(df[time_col_name], errors="coerce")
        valid_mask = dates.notna()
        if valid_mask.sum() < 2:
            return None

        date_range_days = (dates[valid_mask].max() - dates[valid_mask].min()).days
        if date_range_days <= 60:
            period = "D"
            period_label = "Daily"
        elif date_range_days <= 730:
            period = "ME"   # month-end (pandas ≥ 2.2)
            period_label = "Monthly"
        else:
            period = "YE"   # year-end (pandas ≥ 2.2)
            period_label = "Yearly"

        temp = pd.DataFrame({
            "_date": dates,
            "_measure": pd.to_numeric(df[measure_col_name], errors="coerce"),
        }).dropna()

        if len(temp) < 2:
            return None

        grouped = (
            temp.set_index("_date")["_measure"]
            .resample(period)
            .mean()
            .dropna()
            .round(2)
        )

        if len(grouped) < 2:
            return None

        return ChartSpec(
            type="line",
            title=f"{measure_col_name} over Time ({period_label} avg)",
            x_label=time_col_name,
            y_label=f"Avg {measure_col_name}",
            x=[str(ts) for ts in grouped.index],
            y=list(grouped.values),
        )
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_num(v: float) -> str:
    """Compact numeric label: integer if whole, else up to 2 significant figures."""
    if v == int(v):
        return f"{int(v):,}"
    # 2 significant figures
    from decimal import Decimal
    d = Decimal(str(v))
    return f"{float(f'{v:.2g}'):,}"
