package com.divup.app.data.remote

import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface ReceiptApi {
    @Multipart
    @POST("api/v1/receipt/process")
    suspend fun processReceipt(
        @Part image: MultipartBody.Part
    ): Response<ProcessReceiptResponse>
}

// DTOs
data class ProcessReceiptResponse(
    val success: Boolean,
    val receipt: ReceiptDto?,
    val error: String?,
    val processing_time_ms: Int
)

data class ReceiptDto(
    val id: String,
    val raw_text: String,
    val items: List<ReceiptItemDto>,
    val subtotal: Double,
    val total: Double,
    val confidence_score: Float,
    val establishment_name: String? = null,
    val date: String? = null
)

data class ReceiptItemDto(
    val id: String,
    val name: String,
    val quantity: Int,
    val unit_price: Double,
    val total_price: Double,
    val confidence: Float
)
