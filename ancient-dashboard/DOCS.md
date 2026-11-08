# Installing Ancient Home Assistant

Requires Home Assistant OS with the app/add-on store, internet access during
installation, and a 64-bit device. Raspberry Pi 5 uses the `aarch64` architecture.
Initial installation and operation have been confirmed on Raspberry Pi 5.

1. Make sure the Home Assistant packaging is available in this repository.
2. Open **Settings → Apps → App store** (or **Add-ons → Add-on store**).
3. Select **⋮ → Repositories** and add:
   `https://github.com/leodenglovescode/ancienthomeassistant`
4. Refresh the store and install **Ancient Home Assistant**. Supervisor builds the
   container on your device; publishing your own container image is not required.
   The first installation may take several minutes.
5. Ensure port 7654 is available. Stop Retro Panel or change its port if necessary.
6. Start the app, enable start on boot, and open the web interface.
7. On the iPad, open `http://YOUR_HA_IP:7654`.
8. In the Ancient setup wizard, enter a reachable HA URL and a long-lived access
   token from a dedicated non-admin Home Assistant user. Use an IP address or DNS
   name reachable from the app, not `localhost`.
9. Set a dashboard password, select entities, and save the layout.
10. Use Safari's Add to Home Screen and configure Guided Access as needed.

## Moving from a separate packaging repository

Home Assistant identifies apps using both the repository and app slug. Installing
from another repository creates a separate app; it does not automatically reuse
existing data. Keep your current app and its backup until migration is verified.
Do not uninstall it to switch repositories. Test a second installation on a
different external port first. Automated data migration is not included.

## Storage, backups and updates

The database lives at `/data/dashboard/dashboard.sqlite3`. Supervisor preserves
`/data` across restarts and app updates. Include the app when creating a Home
Assistant backup. Uninstalling may remove its storage: create a backup first.
Backups contain the HA token and must remain private. The upstream app keeps the
token on the server and stores a hash of the dashboard password.

This release uses a pinned upstream container. Upstream changes are only adopted
when this repository explicitly updates its image digest. Increase `version` in
`config.yaml` for every published packaging update.

## Network

The default external port is **7654**, mapped to the internal port **8095**.
The Web UI button follows the configured mapping. Keep internal port 8095 and
change only the external mapping if you need a different host port.

Use the app on a trusted local network. Do not forward its port to the internet.
HTTP does not encrypt passwords or session traffic. Ingress and a sidebar panel
are not included; the iPad opens the app directly. If you access HA remotely over
HTTPS, open the local dashboard address directly on the iPad.

## Verification checklist

- Start the app and check the log for successful startup.
- Complete setup and add a sensor and a light.
- Refresh the page and test on the actual iPad.
- Restart the app: the connection and layout should persist.
- Create a Home Assistant backup and verify restore on a test installation.

When reporting errors, include relevant log messages without passwords or tokens.
