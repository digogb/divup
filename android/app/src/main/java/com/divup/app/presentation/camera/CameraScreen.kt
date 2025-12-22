package com.divup.app.presentation.camera

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.divup.app.ui.theme.*
import java.io.File
import java.util.concurrent.Executors

@Composable
fun CameraScreen(
    onImageCaptured: (File) -> Unit,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var isCapturing by remember { mutableStateOf(false) }
    
    // Photo Picker for Gallery
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
        onResult = { uri ->
            uri?.let {
                val inputStream = context.contentResolver.openInputStream(it)
                val tempFile = File(context.cacheDir, "gallery_receipt_${System.currentTimeMillis()}.jpg")
                inputStream?.use { input ->
                    tempFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                onImageCaptured(tempFile)
            }
        }
    )
    
    // Cleanup executor
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Camera Preview
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).apply {
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build()
                        preview.setSurfaceProvider(surfaceProvider)
                        
                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                            .build()
                        
                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageCapture
                            )
                        } catch (e: Exception) {
                            // Handle error
                        }
                    }, ContextCompat.getMainExecutor(ctx))
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        
        // Top Overlay - Título
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.6f),
                            Color.Transparent
                        )
                    )
                )
                .padding(top = 48.dp, bottom = 24.dp)
                .align(Alignment.TopCenter)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "📝 DivUp",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Fotografe a conta",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }
        
        // Frame Guide (área central)
        Box(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .fillMaxHeight(0.5f)
                .align(Alignment.Center)
                .border(
                    width = 3.dp,
                    brush = Brush.linearGradient(colors = listOf(PrimaryPurple, SecondaryPurple)),
                    shape = RoundedCornerShape(24.dp)
                )
        ) {
            // Corners decorativos
            CornerDecoration(modifier = Modifier.align(Alignment.TopStart))
            CornerDecoration(modifier = Modifier.align(Alignment.TopEnd).scale(scaleX = -1f, scaleY = 1f))
            CornerDecoration(modifier = Modifier.align(Alignment.BottomStart).scale(scaleX = 1f, scaleY = -1f))
            CornerDecoration(modifier = Modifier.align(Alignment.BottomEnd).scale(scaleX = -1f, scaleY = -1f))
        }
        
        // Dica
        Text(
            "Centralize a conta no quadro",
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = 160.dp)
                .background(
                    Color.Black.copy(alpha = 0.5f),
                    RoundedCornerShape(20.dp)
                )
                .padding(horizontal = 16.dp, vertical = 8.dp),
            style = MaterialTheme.typography.bodySmall,
            color = Color.White
        )
        
        // Bottom Controls
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))
                    )
                )
                .padding(bottom = 48.dp, top = 32.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Gallery Button
                GalleryButton(
                    onClick = {
                        photoPickerLauncher.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    }
                )
                
                // Camera Capture Button
                CaptureButton(
                    isCapturing = isCapturing,
                    onClick = {
                        if (isCapturing) return@CaptureButton
                        isCapturing = true
                        
                        val photoFile = File(context.cacheDir, "receipt_${System.currentTimeMillis()}.jpg")
                        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
                        
                        try {
                            imageCapture?.takePicture(
                                outputOptions,
                                cameraExecutor,
                                object : ImageCapture.OnImageSavedCallback {
                                    override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                        ContextCompat.getMainExecutor(context).execute {
                                            isCapturing = false
                                            onImageCaptured(photoFile)
                                        }
                                    }
                                    override fun onError(exception: ImageCaptureException) {
                                        isCapturing = false
                                        exception.printStackTrace()
                                    }
                                }
                            )
                        } catch (e: Exception) {
                            isCapturing = false
                            e.printStackTrace()
                        }
                    }
                )
                
                // Placeholder para balancear o layout
                Spacer(modifier = Modifier.size(56.dp))
            }
        }
    }
}

@Composable
private fun CornerDecoration(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(32.dp)
            .padding(4.dp)
    ) {
        // Linha horizontal
        Box(
            modifier = Modifier
                .width(20.dp)
                .height(4.dp)
                .background(
                    brush = Brush.horizontalGradient(colors = listOf(PrimaryPurple, SecondaryPurple)),
                    shape = RoundedCornerShape(2.dp)
                )
        )
        // Linha vertical
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(20.dp)
                .background(
                    brush = Brush.verticalGradient(colors = listOf(PrimaryPurple, SecondaryPurple)),
                    shape = RoundedCornerShape(2.dp)
                )
        )
    }
}

@Composable
private fun GalleryButton(onClick: () -> Unit) {
    FilledTonalButton(
        onClick = onClick,
        modifier = Modifier.height(56.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = Color.White.copy(alpha = 0.2f)
        )
    ) {
        Icon(
            Icons.Default.PhotoLibrary,
            contentDescription = "Galeria",
            tint = Color.White,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            "Galeria",
            color = Color.White,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun CaptureButton(
    isCapturing: Boolean,
    onClick: () -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (isCapturing) 0.9f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh),
        label = "captureScale"
    )
    
    // Efeito de pulso quando não está capturando
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = EaseInOutCubic),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )
    
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.scale(if (isCapturing) scale else scale * pulseScale)
    ) {
        // Anel externo
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(
                    brush = Brush.sweepGradient(
                        colors = listOf(PrimaryPurple, SecondaryPurple, AccentPink, PrimaryPurple)
                    )
                )
        )
        
        // Botão interno branco
        FloatingActionButton(
            onClick = onClick,
            modifier = Modifier.size(68.dp),
            shape = CircleShape,
            containerColor = Color.White,
            contentColor = PrimaryPurple
        ) {
            if (isCapturing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    strokeWidth = 3.dp,
                    color = PrimaryPurple
                )
            } else {
                Icon(
                    Icons.Default.CameraAlt,
                    contentDescription = "Capturar",
                    modifier = Modifier.size(32.dp)
                )
            }
        }
    }
}
