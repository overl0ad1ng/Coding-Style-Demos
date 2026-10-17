import os
from pathlib import Path
import runpy
import unittest
from datetime import datetime


SOURCE_ROOT = Path(os.environ.get("SAMPLE_ROOT", Path(__file__).resolve().parents[1]))
settlement = runpy.run_path(str(SOURCE_ROOT / "08-settlement-reconciliation.py"))


def row(record_id, **changes):
    record = {
        "id": record_id, "tenant_id": "a", "settled": True, "pending": False,
        "voided": False, "currency": "CNY", "amount_cents": 100,
        "customer": {"id": "c1", "active": True},
    }
    return record | changes


class SettlementTests(unittest.TestCase):
    def test_main_and_preview_exclude_unsettled_voided_and_other_tenants(self):
        records = [
            row("valid"), row("pending", settled=False, pending=True),
            row("neither", settled=False), row("voided", voided=True),
            row("other", tenant_id="b"),
        ]
        result = settlement["build_export"](records, "a")
        self.assertEqual([record["id"] for record in result["main"]["rows"]], ["valid"])
        self.assertEqual([record["id"] for record in result["preview"]], ["valid"])
        self.assertEqual(result["main"]["total"], 100)

    def test_strict_validation_keeps_partial_rows_and_errors_without_summary(self):
        options = settlement["ReconciliationOptions"](strict=True)
        audit = []
        records = [row("valid"), row("negative", amount_cents=-1), row("currency", currency="USD")]
        result = settlement["reconcile"](records, "a", options, audit, datetime(2026, 10, 17))
        self.assertFalse(result["ok"])
        self.assertEqual(result["errors"], ["negative:negative", "currency:currency"])
        self.assertEqual(result["total"], 100)
        self.assertEqual(audit, ["export:valid"])

    def test_lenient_validation_audits_skips_and_keeps_required_errors(self):
        options = settlement["ReconciliationOptions"]()
        audit = []
        records = [row("negative", amount_cents=-1), row("missing", amount_cents=None)]
        result = settlement["reconcile"](records, "a", options, audit, datetime(2026, 10, 17))
        self.assertTrue(result["ok"])
        self.assertEqual(result["errors"], ["amount:missing"])
        self.assertEqual(result["rows"], [])
        self.assertIn("skip-negative:negative", audit)
        self.assertIn("total:0", audit)

    def test_empty_strict_export_fails(self):
        options = settlement["ReconciliationOptions"](strict=True)
        result = settlement["reconcile"]([], "a", options, [], datetime(2026, 10, 17))
        self.assertFalse(result["ok"])
        self.assertEqual(result["errors"], ["empty"])


if __name__ == "__main__":
    unittest.main()
