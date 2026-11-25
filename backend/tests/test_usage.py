import pytest
from fastapi import HTTPException

from app.core import usage
from app.core.db import connect


def add_casa(slug="bar-teste", name="Bar Teste", active=1):
    with connect() as conn:
        conn.execute("INSERT INTO casas (slug, name, active) VALUES (?, ?, ?)", (slug, name, active))
    return usage.find_casa(slug)


def add_reads(n, *, casa=None, device="d1", ip="i1", cost=0.01, success=True):
    for _ in range(n):
        usage.record_read(casa=casa, device_hash=device, ip_hash=ip, usage={"cost_brl": cost},
                          establishment_name="Bar X", success=success, ms=1)


def blocked(casa=None, device="d1", ip="i1", reason=None):
    with pytest.raises(HTTPException) as exc:
        usage.check_allowed(casa, device, ip)
    assert exc.value.status_code == 429
    if reason:
        assert exc.value.headers["X-Limit"] == reason
    return exc.value.detail


def test_personal_quota_by_device():
    add_reads(2)
    assert usage.check_allowed(None, "d1", "i1") is None
    add_reads(1)
    assert "3 leituras grátis" in blocked(reason="personal")
    # outro aparelho no mesmo IP (CGNAT) continua podendo
    assert usage.check_allowed(None, "d2", "i1") is None


def test_failed_reads_do_not_use_quota():
    add_reads(3, success=False)
    assert usage.check_allowed(None, "d1", "i1") is None


def test_ip_cap_is_10x_with_device_and_1x_without():
    usage.save_limits({"ip_reads_per_hour": 1000})  # isola a regra mensal da regra por hora
    add_reads(29, device="", ip="i9")  # muitos aparelhos "sem id" no mesmo IP
    assert "leituras grátis" in blocked(device="", ip="i9")
    assert usage.check_allowed(None, "novo", "i9") is None
    add_reads(1, device="", ip="i9")
    assert "leituras grátis" in blocked(device="novo", ip="i9")


def test_partner_reads_ignore_personal_quota():
    casa = add_casa()
    add_reads(10, casa=casa)
    assert usage.check_allowed(casa, "d1", "i2")["slug"] == "bar-teste"


def test_inactive_casa_is_not_found():
    add_casa(slug="fechado", active=0)
    assert usage.find_casa("fechado") is None


def test_casa_over_limit_falls_back_to_personal_quota():
    casa = add_casa()
    usage.save_limits({"casa_reads_per_month": 2})
    add_reads(2, casa=casa)
    assert usage.check_allowed(casa, "d1", "i1") is None  # conta como fora de parceiro


def test_monthly_budget_blocks_only_outside_partners():
    casa = add_casa()
    usage.save_limits({"monthly_budget_brl": 0.05})
    add_reads(5, casa=casa, device="x", ip="x")
    assert "acabaram" in blocked(device="d5", ip="i5", reason="budget")
    assert usage.check_allowed(casa, "d5", "i5") is not None


def test_hard_budget_blocks_everything():
    casa = add_casa()
    usage.save_limits({"monthly_budget_brl": 0.01, "hard_budget_brl": 0.05})
    add_reads(5, casa=casa, device="x", ip="x")
    assert "limite de leituras deste mês" in blocked(casa=casa, device="d6", ip="i6", reason="hard")


def test_hourly_limit_per_ip():
    usage.save_limits({"ip_reads_per_hour": 3})
    add_reads(3, casa=None, device="a", ip="i7", success=False)
    assert "Espere" in blocked(device="b", ip="i7", reason="hourly")


def test_limits_use_env_defaults_and_overrides():
    assert usage.limits()["free_reads_per_month"] == 3
    usage.save_limits({"free_reads_per_month": 5, "desconhecida": 1})
    lim = usage.limits()
    assert lim["free_reads_per_month"] == 5 and "desconhecida" not in lim


def test_month_range_and_previous_month():
    start, end = usage.month_range("2026-12")
    assert start == "2026-12-01T03:00:00Z" and end == "2027-01-01T03:00:00Z"
    assert usage.previous_month("2027-01") == "2026-12"
