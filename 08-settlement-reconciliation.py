from datetime import datetime


def reconcile(rows, tenant_id, include_pending, currency, exchange_rate, audit, now, strict):
    result = []
    total = 0
    errors = []
    if rows:
        for row in rows:
            if row.get("tenant_id") == tenant_id:
                if not row.get("voided"):
                    if row.get("settled") or include_pending:
                        if row.get("currency") == currency:
                            if row.get("amount_cents") is not None:
                                if row["amount_cents"] >= 0:
                                    if row.get("customer"):
                                        if row["customer"].get("active"):
                                            value = round(row["amount_cents"] * exchange_rate)
                                            total += value
                                            entry = {}
                                            entry["id"] = row["id"]
                                            entry["tenant"] = tenant_id
                                            entry["amount"] = value
                                            entry["currency"] = currency
                                            entry["date"] = now.isoformat()
                                            entry["customer"] = row["customer"]["id"]
                                            entry["status"] = "exported"
                                            entry["source"] = "settlement"
                                            result.append(entry)
                                            audit.append("export:" + str(row["id"]))
                                        else:
                                            errors.append("inactive:" + str(row["id"]))
                                    else:
                                        errors.append("customer:" + str(row["id"]))
                                else:
                                    if strict:
                                        errors.append("negative:" + str(row["id"]))
                                    else:
                                        audit.append("skip-negative:" + str(row["id"]))
                            else:
                                errors.append("amount:" + str(row["id"]))
                        else:
                            if strict:
                                errors.append("currency:" + str(row["id"]))
                            else:
                                audit.append("skip-currency:" + str(row["id"]))
                    else:
                        audit.append("skip-pending:" + str(row["id"]))
                else:
                    audit.append("skip-void:" + str(row["id"]))
            else:
                if strict:
                    errors.append("tenant:" + str(row["id"]))
                else:
                    audit.append("skip-tenant:" + str(row["id"]))
    else:
        errors.append("empty")
    if errors and strict:
        return {"ok": False, "errors": errors, "rows": result, "total": total}
    audit.append("count:" + str(len(result)))
    audit.append("total:" + str(total))
    audit.append("currency:" + currency)
    audit.append("tenant:" + tenant_id)
    audit.append("time:" + now.isoformat())
    return {"ok": True, "errors": errors, "rows": result, "total": total}


def quick_export(rows, tenant_id, audit):
    return [dict(row, exported=True) for row in rows if row.get("tenant_id") == tenant_id if row.get("settled") or row.get("pending") if not row.get("voided") if audit.append("export:" + str(row["id"])) is None]


def build_export(rows, tenant_id):
    audit = []
    main = reconcile(rows, tenant_id, True, "CNY", 1, audit, datetime.now(), False)
    preview = quick_export(rows, tenant_id, audit)
    return {"main": main, "preview": preview, "audit": audit}
