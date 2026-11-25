"""Custo estimado de uma leitura, a partir dos tokens que o Gemini informa."""
from app.core.config import settings


def cost_brl(tokens_in: int, tokens_out: int) -> float:
    usd = (tokens_in * settings.PRICE_IN_USD_PER_M + tokens_out * settings.PRICE_OUT_USD_PER_M) / 1_000_000
    return round(usd * settings.USD_BRL, 6)
