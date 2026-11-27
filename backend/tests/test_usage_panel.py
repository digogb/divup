from app.api.routes.admin import usage_panel
from app.core import usage


def read(device, success=True, ms=2000):
    usage.record_read(casa=None, device_hash=device, ip_hash="ip", usage={"cost_brl": 0.01},
                      establishment_name="Bar X", success=success, ms=ms)


def test_usage_panel_counts_funnel_distribution_and_events():
    for d in ("a", "b", "c"):
        usage.record_event("open", d)
    usage.record_event("open", "a", standalone=True)
    usage.record_event("open", "a", detail="conta")
    usage.record_event("open", "b", detail="meta")
    usage.record_event("open", "c", detail="meta")
    usage.record_event("invite", "a", detail="native")
    usage.record_event("invite", "a", detail="native")
    for _ in range(5):
        read("a")
    read("b", ms=4000)
    read("c", success=False)
    usage.record_event("share", "a", detail="whatsapp-one")
    usage.record_event("blocked", "c", detail="personal")
    usage.record_event("install", "b", detail="shown")
    usage.record_event("install", "b", detail="accepted")

    p = usage_panel(mes=usage.current_month())

    assert p["funnel"] == {"opened": 3, "tried": 3, "read_ok": 2, "shared": 1}
    assert p["quality"]["attempts"] == 7 and p["quality"]["ok"] == 6 and p["quality"]["success_pct"] == 86
    assert p["quality"]["p50_s"] == 2.0 and p["quality"]["p90_s"] == 4.0
    dist = {b["label"]: b["devices"] for b in p["distribution"]}
    assert dist["1"] == 1 and dist["4–10"] == 1 and p["over_3"] == 1
    assert p["blocked"] == {"personal": 1}
    assert p["shares"] == {"whatsapp-one": 1}
    assert p["install"] == {"shown": 1, "accepted": 1}
    assert p["opened_installed"] == 1
    assert p["sources"] == {"meta": 2, "conta": 1}
    assert p["invited"] == 1
    today = p["daily"][-1]
    assert today["opens"] == 3 and today["reads_ok"] == 6 and today["reads_failed"] == 1 and today["blocked"] == 1


def test_usage_panel_empty_month():
    p = usage_panel(mes="2026-01")
    assert len(p["daily"]) == 31 and p["funnel"]["opened"] == 0 and p["quality"]["success_pct"] is None
