package com.divup.app.presentation.receipt

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.divup.app.domain.model.BillSplit
import com.divup.app.domain.model.Receipt
import com.divup.app.domain.repository.ReceiptRepository
import com.divup.app.domain.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class ReceiptViewModel @Inject constructor(
    private val repository: ReceiptRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ReceiptUiState>(ReceiptUiState.Idle)
    val uiState: StateFlow<ReceiptUiState> = _uiState.asStateFlow()
    
    private var currentReceipt: Receipt? = null
    
    // Mapa de itemId -> quantidade selecionada
    private val selectedQuantities = mutableMapOf<String, Int>()
    private var currentTipPercentage = 10.0
    
    fun processImage(imageFile: File) {
        viewModelScope.launch {
            repository.processReceipt(imageFile).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = ReceiptUiState.Loading
                    is Result.Success -> {
                        currentReceipt = result.data
                        selectedQuantities.clear()
                        updateUiState()
                    }
                    is Result.Error -> _uiState.value = ReceiptUiState.Error(result.message)
                }
            }
        }
    }
    
    // Toggle: se está selecionado, limpa; se não está, seleciona tudo
    fun toggleItemSelection(itemId: String) {
        val item = currentReceipt?.items?.find { it.id == itemId } ?: return
        val currentQty = selectedQuantities[itemId] ?: 0
        
        if (currentQty > 0) {
            selectedQuantities.remove(itemId)
        } else {
            selectedQuantities[itemId] = item.quantity
        }
        updateUiState()
    }
    
    // Atualizar quantidade específica de um item
    fun updateItemQuantity(itemId: String, quantity: Int) {
        val item = currentReceipt?.items?.find { it.id == itemId } ?: return
        val clampedQty = quantity.coerceIn(0, item.quantity)
        
        if (clampedQty == 0) {
            selectedQuantities.remove(itemId)
        } else {
            selectedQuantities[itemId] = clampedQty
        }
        updateUiState()
    }
    
    // Selecionar TODOS os itens com quantidade máxima
    fun selectAll() {
        currentReceipt?.items?.forEach { item ->
            selectedQuantities[item.id] = item.quantity
        }
        updateUiState()
    }
    
    // Limpar TODAS as seleções
    fun clearSelection() {
        selectedQuantities.clear()
        updateUiState()
    }
    
    fun updateTipPercentage(percentage: Double) {
        if (currentReceipt != null) {
            currentTipPercentage = percentage
            updateUiState()
        }
    }
    
    private fun updateUiState() {
        currentReceipt?.let { receipt ->
            val updatedItems = receipt.items.map { item ->
                item.copy(selectedQuantity = selectedQuantities[item.id] ?: 0)
            }
            val billSplit = BillSplit.calculate(updatedItems, currentTipPercentage)
            
            _uiState.value = ReceiptUiState.Success(
                receipt = receipt.copy(items = updatedItems),
                billSplit = billSplit,
                tipPercentage = currentTipPercentage
            )
        }
    }
}

sealed class ReceiptUiState {
    object Idle : ReceiptUiState()
    object Loading : ReceiptUiState()
    data class Success(
        val receipt: Receipt,
        val billSplit: BillSplit,
        val tipPercentage: Double = 10.0
    ) : ReceiptUiState()
    data class Error(val message: String) : ReceiptUiState()
}
