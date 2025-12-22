package com.divup.app.data.repository

import com.divup.app.data.remote.ReceiptApi
import com.divup.app.domain.model.Receipt
import com.divup.app.domain.model.ReceiptItem
import com.divup.app.domain.repository.ReceiptRepository
import com.divup.app.domain.repository.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import javax.inject.Inject

class ReceiptRepositoryImpl @Inject constructor(
    private val api: ReceiptApi
) : ReceiptRepository {
    
    override fun processReceipt(imageFile: File): Flow<Result<Receipt>> = flow {
        emit(Result.Loading)
        
        try {
            // "image/jpeg" matches allowed extensions
            val requestFile = imageFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
            val body = MultipartBody.Part.createFormData("file", imageFile.name, requestFile)
            
            val response = api.processReceipt(body)
            
            if (response.isSuccessful) {
                val responseBody = response.body()
                if (responseBody != null && responseBody.success) {
                    val dto = responseBody.receipt
                    if (dto != null) {
                        val receipt = Receipt(
                            id = dto.id,
                            rawText = dto.raw_text,
                            items = dto.items.map { 
                                ReceiptItem(
                                    id = it.id,
                                    name = it.name,
                                    quantity = it.quantity,
                                    unitPrice = it.unit_price,
                                    totalPrice = it.total_price
                                )
                            },
                            subtotal = dto.subtotal,
                            total = dto.total,
                            confidenceScore = dto.confidence_score
                        )
                        emit(Result.Success(receipt))
                    } else {
                        emit(Result.Error("Resposta do servidor incompleta (receipt is null)"))
                    }
                } else {
                    emit(Result.Error(responseBody?.error ?: "Erro no processamento do servidor"))
                }
            } else {
                emit(Result.Error("Erro HTTP: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emit(Result.Error("Falha na conexão: ${e.message}"))
        }
    }
}
