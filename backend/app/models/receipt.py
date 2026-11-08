from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import uuid4

class ReceiptItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    quantity: int = 1
    unit_price: float          # preço de tabela, antes do desconto
    total_price: float         # valor final pago (quantity × unit_price − discount)
    discount: float = 0.0      # desconto aplicado a este item
    confidence: float = 0.0

class ReceiptData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    raw_text: str
    items: List[ReceiptItem]
    subtotal: float
    total: float
    discount: float = 0.0      # desconto da conta não atribuído a nenhum item
    confidence_score: float = 0.0
    establishment_name: Optional[str] = None
    date: Optional[str] = None

class ProcessReceiptResponse(BaseModel):
    success: bool
    receipt: Optional[ReceiptData] = None
    error: Optional[str] = None
    processing_time_ms: int
