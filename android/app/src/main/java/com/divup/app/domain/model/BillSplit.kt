package com.divup.app.domain.model

data class BillSplit(
    val selectedItems: List<ReceiptItem>,
    val itemsSubtotal: Double,
    val tipPercentage: Double,
    val tipAmount: Double,
    val total: Double
) {
    companion object {
        fun calculate(items: List<ReceiptItem>, tipPercentage: Double): BillSplit {
            // Filtra itens com alguma quantidade selecionada
            val selected = items.filter { it.selectedQuantity > 0 }
            
            // Calcula subtotal baseado na quantidade selecionada de cada item
            val subtotal = selected.sumOf { it.selectedPrice }
            val tip = subtotal * (tipPercentage / 100.0)
            
            return BillSplit(
                selectedItems = selected,
                itemsSubtotal = subtotal,
                tipPercentage = tipPercentage,
                tipAmount = tip,
                total = subtotal + tip
            )
        }
    }
}
