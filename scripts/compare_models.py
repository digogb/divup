"""
Compara modelos do Gemini na leitura das mesmas notas: acerto, tempo e custo.

Uso (dentro do container da API, que já tem as dependências e a GOOGLE_API_KEY):

    docker compose run --rm --no-deps \
        -v "$PWD/scripts:/app/scripts:ro" -v "$PWD/notas:/notas:ro" \
        api python scripts/compare_models.py /notas/*.jpg

    # outros modelos:  ... compare_models.py --models gemini-3.5-flash-lite,gemini-3.8-flash /notas/*.jpg

"Bate?" compara a soma dos itens (já com descontos) com o subtotal impresso
que o modelo leu; é um sinal de leitura consistente, não prova de acerto.
Confira os itens de uma ou duas notas à mão.
"""
import argparse
import sys
import time

sys.path.insert(0, "/app")  # pacote app/ do container

from app.core.ocr.gemini_vision import GeminiVisionExtractor  # noqa: E402

DEFAULT_MODELS = "gemini-3.5-flash-lite,gemini-2.5-flash"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("images", nargs="+", help="fotos de notas (JPEG ou PNG)")
    parser.add_argument("--models", default=DEFAULT_MODELS, help=f"lista separada por vírgula (padrão: {DEFAULT_MODELS})")
    args = parser.parse_args()
    models = [m.strip() for m in args.models.split(",") if m.strip()]

    extractor = GeminiVisionExtractor()
    totals = {m: {"ok": 0, "n": 0, "err": 0, "ms": 0, "cost": 0.0} for m in models}

    for path in args.images:
        with open(path, "rb") as f:
            image = f.read()
        print(f"\n=== {path}")
        for model in models:
            t0 = time.time()
            try:
                receipt, usage = extractor.extract(image, model=model)
            except Exception as e:  # noqa: BLE001 — queremos ver a falha de cada modelo e seguir
                print(f"  {model:<24} ERRO: {e}")
                totals[model]["err"] += 1
                continue
            ms = int((time.time() - t0) * 1000)
            items_sum = round(sum(i.total_price for i in receipt.items) - receipt.discount, 2)
            matches = abs(items_sum - receipt.subtotal) <= 0.05
            t = totals[model]
            t["n"] += 1
            t["ok"] += matches
            t["ms"] += ms
            t["cost"] += usage["cost_brl"]
            print(
                f"  {model:<24} {len(receipt.items):>3} itens | soma R$ {items_sum:>8.2f} | "
                f"subtotal R$ {receipt.subtotal:>8.2f} | {'bate' if matches else 'NÃO BATE'} | "
                f"{ms:>5} ms | {usage['tokens_in']}+{usage['tokens_out']} tokens | R$ {usage['cost_brl']:.4f}"
            )

    print("\n=== Resumo")
    for model, t in totals.items():
        n = max(t["n"], 1)
        print(
            f"  {model:<24} bate em {t['ok']}/{t['n']} | erros {t['err']} | média {t['ms'] // n} ms | "
            f"R$ {t['cost'] / n:.4f} por nota | R$ {t['cost'] / n * 1000:.2f} por 1.000 notas"
        )


if __name__ == "__main__":
    main()
