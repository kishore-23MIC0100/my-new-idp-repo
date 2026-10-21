"""Create the compact, deterministic retail dataset used by the warehouse demo.

The source workbook is never copied into the repository. Run this script against an
authorized local copy of UCI Online Retail II to regenerate the browser dataset.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

SCHEMA_VERSION = "1.0.0"
SELECTED_PERIOD = "2011-11"
SOURCE_SHEET = "Year 2010-2011"
PRODUCT_CODE = re.compile(r"^\d{5}[A-Za-z]{0,2}$")
REQUIRED_COLUMNS = {"Invoice", "StockCode", "Description", "Quantity", "InvoiceDate"}


@dataclass(frozen=True)
class ProcessingConfig:
    selected_period: str = SELECTED_PERIOD
    selected_product_count: int = 100
    pick_frequency_definition: str = "Eligible units ordered"
    pick_definition: str = "One order line for a selected SKU; quantities are retained as units handled."
    product_code_rule: str = "StockCode matches ^\\d{5}[A-Za-z]{0,2}$"
    outside_selected_product_rule: str = "Discarded from exported orders; orders with no selected products are excluded."
    order_grouping_rule: str = "Invoice lines are aggregated by invoice and product code."


def standardize_frame(raw: pd.DataFrame) -> pd.DataFrame:
    """Return a copy with typed columns and source row position for stable ordering."""
    missing = REQUIRED_COLUMNS - set(raw.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    frame = raw.copy()
    frame["_source_row"] = range(len(frame))
    frame["Invoice"] = frame["Invoice"].astype("string").str.strip()
    frame["StockCode"] = frame["StockCode"].astype("string").str.strip()
    frame["Description"] = frame["Description"].astype("string").str.strip()
    frame["Quantity"] = pd.to_numeric(frame["Quantity"], errors="coerce")
    frame["InvoiceDate"] = pd.to_datetime(frame["InvoiceDate"], errors="coerce")
    return frame


def clean_month(raw: pd.DataFrame, period: str) -> tuple[pd.DataFrame, Counter[str]]:
    """Apply declared eligibility rules and return product order lines for one month."""
    frame = standardize_frame(raw)
    report: Counter[str] = Counter(rows_read=len(frame))
    target = pd.Period(period, freq="M")
    in_period = frame["InvoiceDate"].dt.to_period("M").eq(target)
    report["rows_outside_period"] = int((~in_period).sum())
    frame = frame.loc[in_period].copy()
    report["rows_in_selected_period"] = len(frame)

    cancelled = frame["Invoice"].fillna("").str.upper().str.startswith("C")
    report["excluded_cancelled_invoices"] = int(cancelled.sum())
    frame = frame.loc[~cancelled].copy()

    missing_invoice = frame["Invoice"].isna() | frame["Invoice"].eq("")
    report["excluded_missing_invoice"] = int(missing_invoice.sum())
    frame = frame.loc[~missing_invoice].copy()

    missing_date = frame["InvoiceDate"].isna()
    report["excluded_missing_timestamp"] = int(missing_date.sum())
    frame = frame.loc[~missing_date].copy()

    positive_quantity = frame["Quantity"].gt(0)
    report["excluded_nonpositive_quantity"] = int((~positive_quantity).sum())
    frame = frame.loc[positive_quantity].copy()

    product = frame["StockCode"].fillna("").str.fullmatch(PRODUCT_CODE)
    report["excluded_invalid_or_nonproduct_code"] = int((~product).sum())
    frame = frame.loc[product].copy()
    report["eligible_order_lines"] = len(frame)
    return frame, report


def build_dataset(raw: pd.DataFrame, source_name: str, selected_product_count: int = 100) -> tuple[dict[str, Any], dict[str, Any]]:
    """Create reproducible product and order records from a raw workbook sheet."""
    if selected_product_count < 1:
        raise ValueError("selected_product_count must be positive")
    eligible, counts = clean_month(raw, SELECTED_PERIOD)
    frequency = eligible.groupby("StockCode", sort=True)["Quantity"].sum().sort_values(ascending=False, kind="stable")
    # Explicit code ascending order resolves ties in a pandas-version-independent way.
    ranked = (
        frequency.rename("pick_frequency")
        .reset_index()
        .sort_values(["pick_frequency", "StockCode"], ascending=[False, True], kind="stable")
        .head(selected_product_count)
    )
    selected_codes = ranked["StockCode"].tolist()
    selected = eligible.loc[eligible["StockCode"].isin(selected_codes)].copy()
    descriptions = (
        selected.sort_values("_source_row")
        .groupby("StockCode", sort=False)["Description"]
        .agg(lambda values: next((str(value) for value in values if value and value != "<NA>"), "Unknown product"))
    )
    products = [
        {
            "id": row.StockCode,
            "code": row.StockCode,
            "description": str(descriptions.get(row.StockCode, "Unknown product")),
            "pickFrequency": int(row.pick_frequency) if float(row.pick_frequency).is_integer() else float(row.pick_frequency),
        }
        for row in ranked.itertuples(index=False)
    ]

    grouped = (
        selected.groupby(["Invoice", "InvoiceDate", "StockCode"], as_index=False, sort=True)["Quantity"]
        .sum()
        .sort_values(["InvoiceDate", "Invoice", "StockCode"], kind="stable")
    )
    orders: list[dict[str, Any]] = []
    for (invoice, timestamp), lines in grouped.groupby(["Invoice", "InvoiceDate"], sort=True):
        items = [{"productId": line.StockCode, "quantity": int(line.Quantity) if float(line.Quantity).is_integer() else float(line.Quantity)} for line in lines.itertuples(index=False)]
        orders.append({"id": str(invoice), "timestamp": pd.Timestamp(timestamp).isoformat(), "items": items})

    config = ProcessingConfig(selected_product_count=selected_product_count)
    dataset = {
        "schemaVersion": SCHEMA_VERSION,
        "metadata": {
            "source": "UCI Machine Learning Repository, Online Retail II",
            "sourceWorkbook": source_name,
            "sourceSheet": SOURCE_SHEET,
            "license": "CC BY 4.0",
            "selectedPeriod": SELECTED_PERIOD,
            "generatedOn": date.today().isoformat(),
        },
        "processingConfig": asdict(config),
        "products": products,
        "orders": orders,
    }
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "source": dataset["metadata"],
        "processingConfig": asdict(config),
        "quality": {
            **dict(sorted(counts.items())),
            "eligible_unique_products": int(eligible["StockCode"].nunique()),
            "eligible_invoices": int(eligible["Invoice"].nunique()),
            "selected_products": len(products),
            "selected_product_order_lines": int(len(selected)),
            "exported_orders": len(orders),
            "exported_order_items": sum(len(order["items"]) for order in orders),
            "exported_units": float(sum(item["quantity"] for order in orders for item in order["items"])),
        },
    }
    validate_dataset(dataset)
    return dataset, report


def validate_dataset(dataset: dict[str, Any]) -> None:
    """Small dependency-free schema and referential integrity check."""
    required = {"schemaVersion", "metadata", "processingConfig", "products", "orders"}
    if required - set(dataset):
        raise ValueError("Dataset is missing required top-level fields")
    products = dataset["products"]
    product_ids = [product["id"] for product in products]
    if not products or len(product_ids) != len(set(product_ids)):
        raise ValueError("Products must be present and have unique IDs")
    known = set(product_ids)
    previous: tuple[str, str] | None = None
    for order in dataset["orders"]:
        if not order["id"] or not order["items"]:
            raise ValueError("Exported orders must have an ID and at least one item")
        key = (order["timestamp"], order["id"])
        if previous and key < previous:
            raise ValueError("Orders must be in stable chronological order")
        previous = key
        seen: set[str] = set()
        for item in order["items"]:
            if item["productId"] not in known or item["productId"] in seen or item["quantity"] <= 0:
                raise ValueError("Order items must reference selected products once with a positive quantity")
            seen.add(item["productId"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Process UCI Online Retail II into warehouse demo JSON.")
    parser.add_argument("source", type=Path, help="Path to online_retail_II.xlsx")
    parser.add_argument("--output", type=Path, default=Path("public/data/retail-2011-11.json"))
    parser.add_argument("--report", type=Path, default=Path("docs/data-quality-report-2011-11.json"))
    parser.add_argument("--product-count", type=int, default=100)
    args = parser.parse_args()
    raw = pd.read_excel(args.source, sheet_name=SOURCE_SHEET, engine="openpyxl")
    dataset, report = build_dataset(raw, args.source.name, args.product_count)
    for path, payload in ((args.output, dataset), (args.report, report)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report["quality"], indent=2))


if __name__ == "__main__":
    main()
