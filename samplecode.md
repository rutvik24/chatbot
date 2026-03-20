Here's a simple but complete **Jetpack Compose** example with a preview, perfect for beginners. This code creates a clickable counter button.

---

## **📁 Complete Code File: `MainActivity.kt`**

```kotlin
package com.example.mycomposeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.example.mycomposeapp.ui.theme.MyComposeAppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyComposeAppTheme {
                // A surface container using the 'background' color from the theme
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Greeting("Android")
                }
            }
        }
    }
}

@Composable
fun Greeting(name: String) {
    var clickCount by remember { mutableStateOf(0) }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "Hello $name!")
        Text(text = "You've clicked the button $clickCount times.")
        Button(onClick = { clickCount++ }) {
            Text("Click me!")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MyComposeAppTheme {
        Greeting("Android")
    }
}
```

---

## **📝 Detailed Explanation**

### **1. Imports**

- Essential Compose and Material 3 libraries.
- `androidx.compose.ui.tooling.preview.Preview` is required for the preview function.

### **2. `MainActivity`**

- Standard Android activity.
- `setContent { ... }` is the entry point where you place your Compose UI.

### **3. `@Composable` Functions**

- **`Greeting(name: String)`**:
  - Displays a greeting and a button.
  - `var clickCount by remember { mutableStateOf(0) }` creates **state** that survives recomposition.
  - When the button is clicked, `clickCount++` triggers a UI recomposition (the `Text` updates automatically).
- **`GreetingPreview()`**:
  - Annotated with `@Preview` and `showBackground = true`.
  - Must call your composable (here `Greeting("Android")`) inside a theme.
  - Android Studio renders this in the **Preview pane** without running the app.

### **4. Layout (`Column`)**

- Centers children vertically/horizontally.
- Uses `Modifier.fillMaxSize()` to take the full screen.

### **5. State Handling**

- `remember` saves state across recompositions.
- `mutableStateOf` makes Compose track changes—any read/write triggers recomposition.

---

## **🖼️ How Preview Works**

1. **Open in Android Studio** (with Compose-enabled project).
2. In the **`GreetingPreview`** function, click the **"Split"** or **"Preview"** tab on the right.
3. You’ll see:
   - The UI with "Hello Android!" and a button.
   - Clicking the button in the **preview** updates the counter instantly (preview supports interactive state).

> ⚠️ **Note**: Previews may not run all logic (e.g., network calls), but simple state works.

---

## **🔗 Online Go Compiler (as requested earlier)**

If you want to try **Go (Golang)** online, use:

- **[Go Playground](https://go.dev/play/)** – Official, safe, supports standard library.
- **[Replit](https://replit.com/languages/go)** – Full IDE with file system, packages.
- **[OneCompiler](https://onecompiler.com/go)** – Simple, clean interface.

---

## ✅ **Key Takeaways for Jetpack Compose**

- UI is **declarative**: you describe _what_ to show, not _how_ to update it.
- **State** (`mutableStateOf`) drives UI changes automatically.
- **Preview** speeds up UI development—no need to run the app constantly.
- Always wrap composables in a **Theme** (`MyComposeAppTheme`) for consistent styling.

Let me know if you'd like another example (e.g., lists, navigation, or custom drawing)!

