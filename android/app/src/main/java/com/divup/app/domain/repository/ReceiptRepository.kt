package com.divup.app.domain.repository

import com.divup.app.domain.model.Receipt
import kotlinx.coroutines.flow.Flow
import java.io.File


// Let's define Result here for simplicity if not common
sealed class Result<out T> {
    object Loading : Result<Nothing>()
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

interface ReceiptRepository {
    fun processReceipt(imageFile: File): Flow<Result<Receipt>>
}
