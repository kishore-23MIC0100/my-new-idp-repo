import importlib.util
from pathlib import Path
import sys
import unittest

import pandas as pd

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "process_retail_data.py"
SPEC = importlib.util.spec_from_file_location("process_retail_data", MODULE_PATH)
assert SPEC and SPEC.loader
PROCESSOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PROCESSOR
SPEC.loader.exec_module(PROCESSOR)


def fixture_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            ["100", "10001", "ALPHA", 3, "2011-11-01 08:00:00"],
            ["100", "10001", "ALPHA", 2, "2011-11-01 08:00:00"],
            ["101", "10002A", "BETA", 1, "2011-11-02 08:00:00"],
            ["C102", "10003", "CANCELLED", 5, "2011-11-03 08:00:00"],
            ["103", "POST", "POSTAGE", 1, "2011-11-03 08:00:00"],
            ["104", "10004", "RETURN", -1, "2011-11-04 08:00:00"],
            ["105", "10005", "OTHER MONTH", 4, "2011-10-31 08:00:00"],
        ],
        columns=["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate"],
    )


class ProcessRetailDataTest(unittest.TestCase):
    def test_clean_month_applies_cancellation_quantity_and_code_rules(self) -> None:
        clean, report = PROCESSOR.clean_month(fixture_frame(), "2011-11")
        self.assertEqual(clean["StockCode"].tolist(), ["10001", "10001", "10002A"])
        self.assertEqual(report["excluded_cancelled_invoices"], 1)
        self.assertEqual(report["excluded_nonpositive_quantity"], 1)
        self.assertEqual(report["excluded_invalid_or_nonproduct_code"], 1)

    def test_build_dataset_aggregates_duplicate_product_lines_and_validates(self) -> None:
        dataset, report = PROCESSOR.build_dataset(fixture_frame(), "source.xlsx", selected_product_count=2)
        self.assertEqual([product["id"] for product in dataset["products"]], ["10001", "10002A"])
        self.assertEqual(dataset["orders"][0]["items"], [{"productId": "10001", "quantity": 5}])
        self.assertEqual(report["quality"]["exported_orders"], 2)

    def test_validate_rejects_unknown_product_reference(self) -> None:
        dataset, _ = PROCESSOR.build_dataset(fixture_frame(), "source.xlsx", selected_product_count=2)
        dataset["orders"][0]["items"][0]["productId"] = "UNKNOWN"
        with self.assertRaisesRegex(ValueError, "reference"):
            PROCESSOR.validate_dataset(dataset)
