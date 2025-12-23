package com.divup.app.domain.model

data class Receipt(
    val id: String,
    val rawText: String,
    val items: List<ReceiptItem>,
    val subtotal: Double,
    val total: Double,
    val confidenceScore: Float,
    val establishmentName: String? = null,
    val date: String? = null
)
