from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import uuid4

class ReceiptItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    quantity: int = 1
    unit_price: float
    total_price: float
    confidence: float = 0.0

class ReceiptData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    raw_text: str
    items: List[ReceiptItem]
    subtotal: float
    total: float
    confidence_score: float = 0.0
    establishment_name: Optional[str] = None
    date: Optional[str] = None

class ProcessReceiptResponse(BaseModel):
    success: bool
    receipt: Optional[ReceiptData] = None
    error: Optional[str] = None
    processing_time_ms: int
