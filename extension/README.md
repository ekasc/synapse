# Synapse Focus Guard

Chrome/Edge Manifest V3 extension for enforcing the Study Timer blocklist.

## Install locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `extension` directory.
5. Refresh the Synapse timer page.

The extension only accepts timer commands from local Synapse origins. It uses dynamic navigation rules and stores the active session locally in the browser. It does not collect browsing history.
