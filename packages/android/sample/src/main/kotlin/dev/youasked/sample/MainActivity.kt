package dev.youasked.sample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.youasked.AskAbout
import dev.youasked.AskBar
import dev.youasked.AskForIt
import dev.youasked.FeatureCard
import dev.youasked.NudgePosition
import dev.youasked.OpenOptions
import dev.youasked.OpenView
import dev.youasked.RequestButton
import dev.youasked.RequestButtonVariant
import dev.youasked.YouAsked
import dev.youasked.YouAskedAppearance
import dev.youasked.YouAskedHost
import dev.youasked.YouAskedNudge

/**
 * Launch extras (all optional) so screens can be reached from adb:
 *   --ez demo true            sample data instead of the live API
 *   --es open home|new|board|shipped|mine|detail   open the sheet on a screen
 *   --es request <id>         with open=detail
 *   --ez nudge true           show the nudge after 2 seconds
 *   --ez launcher false       hide the floating button
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val demo = intent.getBooleanExtra("demo", BuildConfig.YOUASKED_KEY.isEmpty())
        if (demo) YouAsked.configureDemo(this) else YouAsked.configure(this, BuildConfig.YOUASKED_KEY)
        if (intent.getStringExtra("identify") != null) {
            YouAsked.identify(dev.youasked.YouAskedUser(intent.getStringExtra("identify")!!, name = "Sample User"), null)
        }
        val nudge = if (intent.getBooleanExtra("nudge", false)) YouAskedNudge.Custom(everyDays = 1, activeSeconds = 2, skipVisits = 0) else YouAskedNudge.Dashboard
        val launcher = intent.getBooleanExtra("launcher", true)
        val open = intent.getStringExtra("open")
        setContent {
            val dark = isSystemInDarkTheme()
            androidx.compose.runtime.LaunchedEffect(Unit) {
                if (open != null) {
                    kotlinx.coroutines.delay(600)
                    YouAsked.open(
                        when (open) {
                            "new" -> OpenOptions(view = OpenView.New)
                            "board" -> OpenOptions(view = OpenView.Board)
                            "shipped" -> OpenOptions(view = OpenView.Shipped)
                            "mine" -> OpenOptions(view = OpenView.Mine)
                            "detail" -> OpenOptions(requestId = intent.getStringExtra("request") ?: "demo_12")
                            else -> OpenOptions()
                        },
                    )
                }
            }
            YouAskedHost(
                appearance = YouAskedAppearance(),
                appName = "Graiden",
                trigger = if (launcher) dev.youasked.LauncherTrigger.Floating else dev.youasked.LauncherTrigger.None,
                nudge = nudge,
            ) {
                Column(
                    Modifier.fillMaxSize().background(if (dark) Color(0xFF0E1322) else Color(0xFFF4F6FA)).safeDrawingPadding()
                        .verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text("Sample app", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall, color = if (dark) Color.White else Color(0xFF141B2D))
                    AskBar()
                    FeatureCard()
                    RequestButton(variant = RequestButtonVariant.Row)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        RequestButton(variant = RequestButtonVariant.Pill)
                        RequestButton(variant = RequestButtonVariant.Icon)
                    }
                    AskAbout("charts")
                    var q by remember { mutableStateOf("") }
                    OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), label = { Text("Search") })
                    AskForIt(q)
                }
            }
        }
    }
}
