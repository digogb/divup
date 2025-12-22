package com.divup.app.domain.model

data class ReceiptItem(
    val id: String,
    val name: String,
    val quantity: Int,
    val unitPrice: Double,
    val totalPrice: Double,
    val selectedQuantity: Int = 0  // Quantidade selecionada pelo usuário (0 = não selecionado)
) {
    // Se alguma quantidade está selecionada
    val isSelected: Boolean get() = selectedQuantity > 0
    
    // Se todas as unidades estão selecionadas
    val isFullySelected: Boolean get() = selectedQuantity == quantity
    
    // Valor que o usuário vai pagar (baseado na quantidade selecionada)
    val selectedPrice: Double get() = unitPrice * selectedQuantity
    
    // Selecionar tudo
    fun selectAll() = copy(selectedQuantity = quantity)
    
    // Limpar seleção
    fun clearSelection() = copy(selectedQuantity = 0)
    
    // Atualizar quantidade selecionada
    fun withSelectedQuantity(qty: Int) = copy(selectedQuantity = qty.coerceIn(0, quantity))
}
