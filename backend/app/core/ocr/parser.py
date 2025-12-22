from app.models.receipt import ReceiptItem, ReceiptData
from typing import List
import re

class ReceiptParser:
    """Parser de Notas Fiscais (Otimizado para Layouts Fragmentados via Google Vision)."""
    
    def parse(self, raw_text: str) -> ReceiptData:
        """Parse completo de nota fiscal."""
        lines = self._clean_text(raw_text)
        items = self._extract_items(lines)
        total = self._extract_total(raw_text, items)
        
        print(f"✅ Parser extraiu {len(items)} itens da nota.")
        
        return ReceiptData(
            raw_text=raw_text,
            items=items,
            subtotal=sum(item.total_price for item in items),
            total=total,
            confidence_score=0.95 if items else 0.0
        )
    
    def _clean_text(self, text: str) -> List[str]:
        """Remove linhas vazias."""
        return [line.strip() for line in text.split('\n') if line.strip()]
    
    def _extract_items(self, lines: List[str]) -> List[ReceiptItem]:
        """Extrai itens da nota iterando linha a linha e olhando adiante."""
        items = []
        i = 0
        n = len(lines)
        
        while i < n:
            line = lines[i].strip()
            
            # Pular linhas irrelevantes / cabeçalhos / rodapé / descrições
            if not line or any(kw in line.lower() for kw in [
                'total', 'mesa', 'cupom', 'cpf', 'cnpj', 'pagar', 
                'consumo', 'servico', 'numero', 'pessoas', 'media', 
                'permanencia', 'www', 'http', 'operador', 'ateada',
                'produto', 'qtde', 'preco', 'valor', 'data:', 'oper.',
                'ir tal', 'pentos', 'mercado', 'pago', 'saldo', 'pedido'
            ]):
                 i += 1
                 continue
            
            # Pular linhas muito curtas (provavelmente descrições como "HH", "ML", etc)
            if len(line) < 4:
                i += 1
                continue
            
            # Pular linhas que são apenas unidades de medida ou sufixos
            if re.match(r'^(\d+\s*)?(ML|HH|UN|PC|KG|G|LT|LATA)[\s\-]*$', line, re.IGNORECASE):
                i += 1
                continue

            # IDENTIFICAÇÃO DE ITEM:
            # Procura por linhas que começam com código numérico (ex: "0103 ...")
            # OU linhas que são majoritariamente texto maiúsculo
            # Agora permite números/unidades E caracteres especiais (+, -, etc)
            is_item_start = re.match(r'^(\d+\s+)?[A-Z0-9\s\+\-\.,/]+(UN|PC|PECAO|G|KG|ML|LT|HH)?.*$', line)
            
            # Pular linhas que são apenas números (ex: "323,70" ou "002")
            if re.match(r'^\d+[,\.]?\d*$', line):
                i += 1
                continue
            
            # Pular linhas que parecem ser apenas valores numéricos (preços, cálculos)
            # Ex: "35.90 35.90", "8.00 8.00", "2 8.00 16.00"
            if re.match(r'^[\d\s,\.]+$', line) and ('.' in line or ',' in line):
                i += 1
                continue
            
            # Pular linhas que terminam com sufixos/unidades comuns
            # Ex: "LIMAO HH", "descricao ML", "Duo Espetos"
            if re.search(r'\s+(HH|ML|UN|PC|LT|LATA|Espetos)[\s\-]*$', line, re.IGNORECASE):
                i += 1
                continue
            
            # Refinamento: Se tiver "R$" ou "=" na linha, provavelmente não é só o nome, é cálculo
            # MAS: pode ser formato TABULAR onde tudo está na mesma linha
            
            # NOVO: Detectar formato TABULAR (Item Qtd Preço Total na mesma linha)
            # Padrão: "PREMIUM LAGER    10    6.90   69.00"
            # Regex: Nome (letras/números) seguido de números (qtd) seguido de dois valores decimais (preço e total)
            tabular_match = re.search(
                r'^([A-Z0-9\s\+\-\.]+?)\s+(\d+)\s+(\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})$',
                line,
                re.IGNORECASE
            )
            
            if tabular_match:
                name, qty_str, price_str, total_str = tabular_match.groups()
                name = name.strip()
                qty = int(qty_str)
                unit_price = self._parse_price(price_str)
                total = self._parse_price(total_str)
                
                item = ReceiptItem(name=name, quantity=qty, unit_price=unit_price, total_price=total)
                items.append(item)
                print(f"  ➕ Item {len(items)}: {name[:40]} - {qty}x R${unit_price:.2f} = R${total:.2f} [tabular]")
                i += 1
                continue
            
            # Se linha tem "R$" ou "=", pula (não é nome de item isolado)
            # OU se é um padrão de preço duplicado (ex: "35.90 35.90" ou "8.00 8.00")
            # Usa backreference \1 para detectar repetição
            duplicate_price = re.match(r'^(\d+[,\.]\d{2})\s+\1\s*$', line)
            if duplicate_price:
                i += 1
                continue
                
            if is_item_start and len(line) > 5 and not any(x in line for x in ["R$", "=", ":"]):
                # Antes de processar, verificar se é apenas uma combinação de unidades/números/sufixos
                # Ex: "300ML HH", "LIMAO HH", "Duo Espetos", "3ML HH"
                if re.match(r'^(\d+\s*)?(ML|HH|UN|PC|KG|G|LT|LATA|Espetos|Duo|Trio)[\s\w\+\-,]*$', line, re.IGNORECASE):
                    i += 1
                    continue
                    
                name = line
                # Limpar código inicial (Ex: "0103 COMBINADO" -> "COMBINADO")
                name = re.sub(r'^\d+\s+', '', name)

                # OLHAR ADIANTE (Lookahead) para encontrar o preço
                found_price = False
                
                # Tenta olhar até 6 linhas para baixo
                for offset in range(1, 7):
                    if i + offset >= n: break
                    
                    next_line = lines[i + offset]
                    
                    # Ignora linhas vazias/curtas no meio do caminho
                    if len(next_line) < 3: continue

                    # Padrão 0: Linha com números separados por espaço: "10 6.90 69.00" ou "9.99 19.98"
                    # Pode ter 2 números (preço total) ou 3 números (qtd preço total)
                    match_numbers = re.match(r'^(\d+)\s+(\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})$', next_line)
                    if not match_numbers:
                        # Tenta com apenas 2 números
                        match_numbers = re.match(r'^(\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})$', next_line)
                    
                    # Padrão 1: Cálculo explícito "R$ 94,90 X 1 = 94,90"
                    match_calc = re.search(r'(?:R\$)?\s*(\d+[,\.]\d{2})\s*[xX]\s*(\d+)', next_line, re.IGNORECASE)
                    
                    # Padrão 2: Preço com X mas sem quantidade explícita "R$ 12,90 X"
                    match_x_only = re.search(r'(?:R\$)?\s*(\d+[,\.]\d{2})\s*[xX]\s*$', next_line, re.IGNORECASE)
                    
                    # Padrão 3: Apenas valor total isolado "94,90"
                    match_simple = None
                    if re.match(r'^\d+[,\.]\d{2}$', next_line):
                         match_simple = re.match(r'^(\d+[,\.]\d{2})$', next_line)

                    if match_numbers:
                        # Linha com números separados
                        groups = match_numbers.groups()
                        if len(groups) == 3:
                            # Tem qtd, preço, total
                            qty_str, price_str, total_str = groups
                            qty = int(qty_str)
                            unit_price = self._parse_price(price_str)
                            total = self._parse_price(total_str)
                        else:
                            # Tem apenas preço e total (assume qtd=1)
                            price_str, total_str = groups
                            qty = 1
                            unit_price = self._parse_price(price_str)
                            total = self._parse_price(total_str)
                        
                        item = ReceiptItem(name=name, quantity=qty, unit_price=unit_price, total_price=total)
                        items.append(item)
                        print(f"  ➕ Item {len(items)}: {name[:40]} - {qty}x R${unit_price:.2f} = R${total:.2f} [numbers]")
                        found_price = True
                        i += offset
                        break
                    
                    elif match_calc:
                        # Achou multiplicador completo! "94,90 X 3"
                        price_str, qty_str = match_calc.groups()
                        unit_price = self._parse_price(price_str)
                        qty = int(qty_str)
                        total = unit_price * qty
                        
                        item = ReceiptItem(name=name, quantity=qty, unit_price=unit_price, total_price=total)
                        items.append(item)
                        print(f"  ➕ Item {len(items)}: {name[:30]} - {qty}x R${unit_price:.2f} = R${total:.2f}")
                        found_price = True
                        i += offset
                        break
                    
                    elif match_x_only:
                        # Achou "R$ 12,90 X" mas sem quantidade
                        # Tenta pegar a próxima linha como total
                        unit_price = self._parse_price(match_x_only.group(1))
                        
                        # Procura o total nas próximas 2 linhas
                        for extra_offset in range(1, 3):
                            if i + offset + extra_offset >= n: break
                            total_line = lines[i + offset + extra_offset]
                            match_total = re.search(r'(\d+[,\.]\d{2})', total_line)
                            if match_total:
                                total = self._parse_price(match_total.group(1))
                                # Calcula a quantidade: total / unit_price
                                if unit_price > 0:
                                    qty = int(round(total / unit_price))
                                else:
                                    qty = 1
                                item = ReceiptItem(name=name, quantity=qty, unit_price=unit_price, total_price=total)
                                items.append(item)
                                print(f"  ➕ Item {len(items)}: {name[:30]} - {qty}x R${unit_price:.2f} = R${total:.2f} [calc qty]")
                                found_price = True
                                i += offset + extra_offset
                                break
                        if found_price:
                            break
                        
                    elif match_simple and offset > 1:
                        # Achou só um número que parece ser o total
                        # Só aceita se já passou da linha imediatamente seguinte ao nome
                        # (para evitar pegar códigos ou outras coisas)
                        total = self._parse_price(match_simple.group(1))
                        item = ReceiptItem(name=name, quantity=1, unit_price=total, total_price=total)
                        items.append(item)
                        print(f"  ➕ Item {len(items)}: {name[:30]} - 1x R${total:.2f}")
                        found_price = True
                        i += offset
                        break

            i += 1
            
        return items
    
    def _extract_total(self, raw_text: str, items: List[ReceiptItem]) -> float:
        """Tenta encontrar o total na nota, ou soma os itens."""
        # Procurar por "TOTAL A PAGAR" ou "TOTAL" seguido de valor
        match = re.search(r'total.*?(?:R\$)?\s*(\d+[,\.]\d{2})', raw_text, re.IGNORECASE | re.DOTALL)
        if match:
             return self._parse_price(match.group(1))
             
        return sum(item.total_price for item in items)
    
    def _parse_price(self, price_str: str) -> float:
        """Converte string '1.200,50' para float 1200.50."""
        if not price_str: return 0.0
        clean_str = price_str.replace('R$', '').replace(' ', '')
        # Se tiver vírgula e ponto, assume formato brasileiro (1.000,00)
        if ',' in clean_str:
            clean_str = clean_str.replace('.', '').replace(',', '.')
        return float(clean_str)
