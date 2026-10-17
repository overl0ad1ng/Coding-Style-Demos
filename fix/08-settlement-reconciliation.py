from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ReconciliationOptions:
    currency: str = "CNY"
    exchange_rate: float = 1
    strict: bool = False


def reconcile(rows, tenant_id, options, audit, now):
    result = []
    errors = []
    total = 0
    if not rows:
        errors.append("empty")
    for row in rows:
        issue = export_eligibility_issue(row, tenant_id) or validation_issue(row, options)
        if issue:
            record_issue(issue, row["id"], options, audit, errors)
            continue
        entry = settlement_entry(row, tenant_id, options, now)
        result.append(entry)
        total += entry["amount"]
        audit.append("export:" + str(row["id"]))
    outcome = {"ok": not (errors and options.strict), "errors": errors, "rows": result, "total": total}
    if errors and options.strict:
        return outcome
    audit.extend([
        "count:" + str(len(result)), "total:" + str(total),
        "currency:" + options.currency, "tenant:" + tenant_id, "time:" + now.isoformat(),
    ])
    return outcome


def export_eligibility_issue(row, tenant_id):
    if row.get("tenant_id") != tenant_id:
        return "tenant"
    if row.get("voided"):
        return "void"
    if not row.get("settled"):
        return "pending"
    return None


def validation_issue(row, options):
    if row.get("currency") != options.currency:
        return "currency"
    if row.get("amount_cents") is None:
        return "amount"
    if row["amount_cents"] < 0:
        return "negative"
    if not row.get("customer"):
        return "customer"
    if not row["customer"].get("active"):
        return "inactive"
    return None


def record_issue(issue, row_id, options, audit, errors):
    # 作废和未结算始终跳过；其余分类保留严格模式与宽松模式的区别。
    always_skip = issue in {"void", "pending"}
    always_error = issue in {"amount", "customer", "inactive"}
    if not always_skip and (options.strict or always_error):
        errors.append(issue + ":" + str(row_id))
        return
    audit.append("skip-" + issue + ":" + str(row_id))


def settlement_entry(row, tenant_id, options, now):
    return {
        "id": row["id"], "tenant": tenant_id,
        "amount": round(row["amount_cents"] * options.exchange_rate),
        "currency": options.currency, "date": now.isoformat(),
        "customer": row["customer"]["id"], "status": "exported", "source": "settlement",
    }


def quick_export(rows, tenant_id, audit):
    result = []
    for row in rows:
        if export_eligibility_issue(row, tenant_id):
            continue
        audit.append("export:" + str(row["id"]))
        result.append(dict(row, exported=True))
    return result


def build_export(rows, tenant_id):
    audit = []
    main = reconcile(rows, tenant_id, ReconciliationOptions(), audit, datetime.now())
    # 预览保留原始字段，主导出另负责币种、金额与客户校验和字段转换。
    preview = quick_export(rows, tenant_id, audit)
    return {"main": main, "preview": preview, "audit": audit}
