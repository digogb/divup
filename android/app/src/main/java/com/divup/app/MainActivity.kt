package com.divup.app

import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.divup.app.presentation.camera.CameraScreen
import com.divup.app.presentation.receipt.ReceiptScreen
import com.divup.app.presentation.receipt.ReceiptViewModel
import dagger.hilt.android.AndroidEntryPoint
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import java.io.File

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    // Request camera permission
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted
        } else {
            // Permission denied
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) 
            != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(android.Manifest.permission.CAMERA)
        }
        
        setContent {
            com.divup.app.ui.theme.DivUpTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DivUpApp()
                }
            }
        }
    }
}

@Composable
fun DivUpApp() {
    val navController = rememberNavController()
    
    NavHost(navController = navController, startDestination = "camera") {
        composable("camera") {
            // Quando a ViewModel é injetada via hiltViewModel(), ela é escopada ao grafo de navegação ou Owner
            // Aqui vamos passar a imagem para o ViewModel compartilhado ou passar via argumento de navegação
            // Para simplificar, vou usar hiltViewModel() na ReceiptScreen e passar o arquivo como argumento/state se conseguir,
            // mas o ideal é ter um SharedViewModel ou passar o path na rota.
            // Vou passar o path na rota.
            
            CameraScreen(
                onImageCaptured = { file ->
                    try {
                        // Usar APENAS o nome do arquivo codificado
                        // O File deve ser reconstruído no destino usando cacheDir
                        val encodedName = java.net.URLEncoder.encode(file.name, java.nio.charset.StandardCharsets.UTF_8.toString())
                        navController.navigate("receipt/$encodedName")
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                },
                onNavigateBack = { /* Exit? */ }
            )
        }
        
        composable("receipt/{fileName}") { backStackEntry ->
            val fileNameEnc = backStackEntry.arguments?.getString("fileName")
            val context = LocalContext.current
            val viewModel = hiltViewModel<ReceiptViewModel>()
            
            // Disparar processamento apenas uma vez
            LaunchedEffect(fileNameEnc) {
                if (fileNameEnc != null) {
                    try {
                        val fileName = java.net.URLDecoder.decode(fileNameEnc, java.nio.charset.StandardCharsets.UTF_8.toString())
                        val file = File(context.cacheDir, fileName)
                        if (file.exists()) {
                           viewModel.processImage(file)
                        } else {
                            android.util.Log.e("DivUp", "File not found: ${file.absolutePath}")
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            
            ReceiptScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
