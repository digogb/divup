package com.divup.app.presentation.receipt

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.divup.app.domain.model.BillSplit
import com.divup.app.domain.model.ReceiptItem
import com.divup.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptScreen(
    viewModel: ReceiptViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    
    when (val state = uiState) {
        is ReceiptUiState.Loading -> {
            LoadingScreen()
        }
        
        is ReceiptUiState.Success -> {
            SuccessScreen(
                state = state,
                viewModel = viewModel
            )
        }
        
        is ReceiptUiState.Error -> {
            ErrorScreen(
                message = state.message,
                onNavigateBack = onNavigateBack
            )
        }
        
        else -> {
            Box(modifier = Modifier.fillMaxSize())
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Animação de pulso
            val infiniteTransition = rememberInfiniteTransition(label = "pulse")
            val scale by infiniteTransition.animateFloat(
                initialValue = 0.9f,
                targetValue = 1.1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(800, easing = EaseInOutCubic),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "scale"
            )
            
            CircularProgressIndicator(
                modifier = Modifier
                    .size(64.dp)
                    .scale(scale),
                color = PrimaryPurple,
                strokeWidth = 6.dp
            )
            
            Text(
                "Analisando conta...",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            
            Text(
                "Powered by Gemini AI ✨",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SuccessScreen(
    state: ReceiptUiState.Success,
    viewModel: ReceiptViewModel
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "Divisão de Conta",
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        },
        bottomBar = {
            BottomSummaryCard(
                billSplit = state.billSplit,
                tipPercentage = state.tipPercentage,
                onTipChange = { viewModel.updateTipPercentage(it) }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Botões de seleção
            item {
                SelectionButtons(
                    onSelectAll = { viewModel.selectAll() },
                    onClearSelection = { viewModel.clearSelection() }
                )
            }
            
            // Contador de itens
            item {
                val selectedCount = state.receipt.items.count { it.isSelected }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "${state.receipt.items.size} itens na conta",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (selectedCount > 0) {
                        Surface(
                            color = PrimaryPurple.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                "$selectedCount selecionados",
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = PrimaryPurple
                            )
                        }
                    }
                }
            }
            
            // Lista de itens com animação
            items(
                items = state.receipt.items,
                key = { it.id }
            ) { item ->
                AnimatedVisibility(
                    visible = true,
                    enter = fadeIn() + slideInVertically()
                ) {
                    ModernReceiptItemCard(
                        item = item,
                        onToggle = { viewModel.toggleItemSelection(item.id) },
                        onQuantityChange = { qty -> viewModel.updateItemQuantity(item.id, qty) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SelectionButtons(
    onSelectAll: () -> Unit,
    onClearSelection: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Botão Selecionar Tudo com gradiente
        GradientButton(
            text = "Selecionar Tudo",
            icon = Icons.Default.CheckCircle,
            onClick = onSelectAll,
            modifier = Modifier.weight(1f)
        )
        
        // Botão Limpar
        OutlinedButton(
            onClick = onClearSelection,
            modifier = Modifier
                .weight(1f)
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.onSurface
            )
        ) {
            Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Limpar", fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun GradientButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isPressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh),
        label = "scale"
    )
    
    Surface(
        onClick = {
            isPressed = true
            onClick()
        },
        modifier = modifier
            .height(48.dp)
            .scale(scale),
        shape = RoundedCornerShape(12.dp),
        color = Color.Transparent
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.horizontalGradient(
                        colors = listOf(PrimaryPurple, SecondaryPurple)
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text,
                    color = Color.White,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
    
    LaunchedEffect(isPressed) {
        if (isPressed) {
            kotlinx.coroutines.delay(100)
            isPressed = false
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ModernReceiptItemCard(
    item: ReceiptItem,
    onToggle: () -> Unit,
    onQuantityChange: (Int) -> Unit
) {
    val containerColor by animateColorAsState(
        targetValue = if (item.isSelected)
            PrimaryPurple.copy(alpha = 0.1f)
        else
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        label = "containerColor"
    )
    
    val borderColor by animateColorAsState(
        targetValue = if (item.isSelected)
            PrimaryPurple.copy(alpha = 0.5f)
        else
            Color.Transparent,
        label = "borderColor"
    )
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 2.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        onClick = onToggle
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header: Checkbox + Nome + Preço
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Checkbox animado
                AnimatedCheckbox(
                    checked = item.isSelected,
                    onCheckedChange = { onToggle() }
                )
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        item.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        "${item.quantity}x R$ ${String.format("%.2f", item.unitPrice)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                // Preço total com destaque
                Surface(
                    color = if (item.isSelected) PrimaryPurple else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        "R$ ${String.format("%.2f", item.totalPrice)}",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (item.isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
            
            // Seletor de quantidade (só para itens com qty > 1)
            if (item.quantity > 1) {
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(12.dp))
                
                QuantitySelector(
                    selectedQuantity = item.selectedQuantity,
                    maxQuantity = item.quantity,
                    unitPrice = item.unitPrice,
                    onQuantityChange = onQuantityChange
                )
            }
        }
    }
}

@Composable
private fun AnimatedCheckbox(
    checked: Boolean,
    onCheckedChange: () -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (checked) 1f else 0.9f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh),
        label = "checkboxScale"
    )
    
    IconButton(
        onClick = onCheckedChange,
        modifier = Modifier.size(32.dp)
    ) {
        Icon(
            imageVector = if (checked) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
            contentDescription = null,
            modifier = Modifier
                .size(28.dp)
                .scale(scale),
            tint = if (checked) PrimaryPurple else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun QuantitySelector(
    selectedQuantity: Int,
    maxQuantity: Int,
    unitPrice: Double,
    onQuantityChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            "Quantos você consumiu?",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Botão diminuir
            FilledIconButton(
                onClick = { onQuantityChange(selectedQuantity - 1) },
                enabled = selectedQuantity > 0,
                modifier = Modifier.size(36.dp),
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Icon(Icons.Default.Remove, contentDescription = "Diminuir", modifier = Modifier.size(20.dp))
            }
            
            // Contador
            Surface(
                color = PrimaryPurple.copy(alpha = 0.15f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    "$selectedQuantity / $maxQuantity",
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryPurple
                )
            }
            
            // Botão aumentar
            FilledIconButton(
                onClick = { onQuantityChange(selectedQuantity + 1) },
                enabled = selectedQuantity < maxQuantity,
                modifier = Modifier.size(36.dp),
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = PrimaryPurple
                )
            ) {
                Icon(Icons.Default.Add, contentDescription = "Aumentar", modifier = Modifier.size(20.dp), tint = Color.White)
            }
        }
    }
    
    // Valor parcial
    if (selectedQuantity > 0 && selectedQuantity < maxQuantity) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Sua parte: R$ ${String.format("%.2f", unitPrice * selectedQuantity)}",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = Success
        )
    }
}

@Composable
private fun BottomSummaryCard(
    billSplit: BillSplit,
    tipPercentage: Double,
    onTipChange: (Double) -> Unit
) {
    Surface(
        shadowElevation = 16.dp,
        tonalElevation = 2.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Seletor de gorjeta
            TipSelector(percentage = tipPercentage, onPercentageChange = onTipChange)
            
            // Resumo
            TotalSummary(billSplit = billSplit)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TipSelector(percentage: Double, onPercentageChange: (Double) -> Unit) {
    var showCustomDialog by remember { mutableStateOf(false) }
    val isCustomSelected = percentage != 0.0 && percentage != 10.0
    
    if (showCustomDialog) {
        CustomTipDialog(
            initialValue = if (isCustomSelected) percentage else 0.0,
            onDismiss = { showCustomDialog = false },
            onConfirm = { 
                onPercentageChange(it)
                showCustomDialog = false
            }
        )
    }
    
    Column {
        Text(
            "Gorjeta",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 0%
            FilterChip(
                selected = percentage == 0.0,
                onClick = { onPercentageChange(0.0) },
                label = { 
                    Text(
                        "0%",
                        fontWeight = if (percentage == 0.0) FontWeight.Bold else FontWeight.Normal
                    ) 
                },
                modifier = Modifier.weight(1f),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryPurple,
                    selectedLabelColor = Color.White
                )
            )
            
            // 10%
            FilterChip(
                selected = percentage == 10.0,
                onClick = { onPercentageChange(10.0) },
                label = { 
                    Text(
                        "10%",
                        fontWeight = if (percentage == 10.0) FontWeight.Bold else FontWeight.Normal
                    ) 
                },
                modifier = Modifier.weight(1f),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryPurple,
                    selectedLabelColor = Color.White
                )
            )
            
            // Custom
            FilterChip(
                selected = isCustomSelected,
                onClick = { showCustomDialog = true },
                label = { 
                    Text(
                        if (isCustomSelected) "${percentage.toInt()}%" else "Outro",
                        fontWeight = if (isCustomSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                modifier = Modifier.weight(1f),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryPurple,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun CustomTipDialog(
    initialValue: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var text by remember { mutableStateOf(if (initialValue > 0) initialValue.toInt().toString() else "") }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Gorjeta Personalizada") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { input -> 
                    // Aceita apenas números
                    if (input.all { it.isDigit() } && input.length <= 3) {
                        text = input
                    }
                },
                label = { Text("Porcentagem (%)") },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                ),
                shape = RoundedCornerShape(12.dp)
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val value = text.toDoubleOrNull() ?: 0.0
                    onConfirm(value)
                }
            ) {
                Text("OK", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(24.dp)
    )
}

@Composable
private fun TotalSummary(billSplit: BillSplit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            PrimaryPurple.copy(alpha = 0.15f),
                            SecondaryPurple.copy(alpha = 0.1f)
                        )
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
                .border(
                    width = 1.dp,
                    color = PrimaryPurple.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Subtotal", style = MaterialTheme.typography.bodyMedium)
                    Text("R$ ${String.format("%.2f", billSplit.itemsSubtotal)}", style = MaterialTheme.typography.bodyMedium)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Gorjeta (${billSplit.tipPercentage.toInt()}%)", style = MaterialTheme.typography.bodyMedium)
                    Text("R$ ${String.format("%.2f", billSplit.tipAmount)}", style = MaterialTheme.typography.bodyMedium)
                }
                
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 4.dp),
                    color = PrimaryPurple.copy(alpha = 0.3f)
                )
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "TOTAL",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "R$ ${String.format("%.2f", billSplit.total)}",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryPurple
                    )
                }
            }
        }
    }
}

@Composable
private fun ErrorScreen(
    message: String,
    onNavigateBack: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "😕",
                style = MaterialTheme.typography.displayLarge
            )
            Text(
                "Ops! Algo deu errado",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            
            GradientButton(
                text = "Tentar Novamente",
                icon = Icons.Default.Check,
                onClick = onNavigateBack
            )
        }
    }
}
