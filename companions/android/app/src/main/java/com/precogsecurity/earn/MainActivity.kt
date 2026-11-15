package com.precogsecurity.earn

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import android.widget.TextView

/**
 * PreCog Earn companion (pilot).
 *
 * Consent model: this activity is the whole node. Consent is a per-session
 * switch the operator sets deliberately; there is NO background service, no
 * wake lock, no autostart receiver, and no network. When the activity is
 * destroyed, work stops. Battery and thermal guards must land before any
 * production store release (see companions/README.md).
 *
 * This skeleton wires the consent UI. The SHA-256 worker lands in the pilot
 * milestone together with foreground-service rules and store review.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = layoutInflater.inflate(R.layout.activity_main, null)
        setContentView(root)

        val consent = root.findViewById<SwitchCompat>(R.id.consent_switch)
        val status = root.findViewById<TextView>(R.id.status_text)

        consent.setOnCheckedChangeListener { _, checked ->
            status.text = if (checked) {
                "Consent granted for this session. Work runs only while this screen is visible. " +
                    "Close the app at any time to stop instantly. Nothing is transmitted."
            } else {
                "Consent withdrawn. No work is running."
            }
        }
    }
}
