package com.divup.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

// Shapes modernos com bordas mais arredondadas
val Shapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

// Color Scheme - Modo Escuro (principal)
private val DarkColorScheme = darkColorScheme(
    primary = PrimaryPurple,
    onPrimary = TextOnPrimary,
    primaryContainer = PrimaryPurple.copy(alpha = 0.3f),
    onPrimaryContainer = TextPrimary,
    
    secondary = SecondaryPurple,
    onSecondary = TextOnPrimary,
    secondaryContainer = SecondaryPurple.copy(alpha = 0.2f),
    onSecondaryContainer = TextPrimary,
    
    tertiary = AccentCyan,
    onTertiary = TextOnPrimary,
    tertiaryContainer = AccentCyan.copy(alpha = 0.2f),
    onTertiaryContainer = TextPrimary,
    
    background = DarkBackground,
    onBackground = TextPrimary,
    
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    
    error = Error,
    onError = TextOnPrimary,
    errorContainer = Error.copy(alpha = 0.2f),
    onErrorContainer = Error,
    
    outline = GlassBorder,
    outlineVariant = GlassWhite
)

// Color Scheme - Modo Claro
private val LightColorScheme = lightColorScheme(
    primary = PrimaryPurple,
    onPrimary = TextOnPrimary,
    primaryContainer = PrimaryPurple.copy(alpha = 0.15f),
    onPrimaryContainer = PrimaryPurple,
    
    secondary = SecondaryPurple,
    onSecondary = TextOnPrimary,
    secondaryContainer = SecondaryPurple.copy(alpha = 0.15f),
    onSecondaryContainer = SecondaryPurple,
    
    tertiary = AccentCyan,
    onTertiary = TextOnPrimary,
    tertiaryContainer = AccentCyan.copy(alpha = 0.15f),
    onTertiaryContainer = AccentCyan,
    
    background = LightBackground,
    onBackground = Color(0xFF1A1A2E),
    
    surface = LightSurface,
    onSurface = Color(0xFF1A1A2E),
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = Color(0xFF64748B),
    
    error = Error,
    onError = TextOnPrimary,
    errorContainer = Error.copy(alpha = 0.15f),
    onErrorContainer = Error,
    
    outline = Color(0xFFE2E8F0),
    outlineVariant = Color(0xFFF1F5F9)
)

// Gradientes Premium
object DivUpGradients {
    val Primary: Brush = Brush.linearGradient(
        colors = listOf(PrimaryPurple, SecondaryPurple)
    )
    
    val PrimaryHorizontal: Brush = Brush.horizontalGradient(
        colors = listOf(PrimaryPurple, SecondaryPurple)
    )
    
    val Accent: Brush = Brush.linearGradient(
        colors = listOf(AccentPink, PrimaryPurple)
    )
    
    val SuccessGradient: Brush = Brush.horizontalGradient(
        colors = listOf(com.divup.app.ui.theme.Success, AccentCyan)
    )
    
    val Dark: Brush = Brush.verticalGradient(
        colors = listOf(DarkBackground, DarkSurface)
    )
}

@Composable
fun DivUpTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic Color disponível no Android 12+
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        // Dynamic Color - usa cores do wallpaper do usuário
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Barra de status transparente para efeito premium
            window.statusBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
