# Maintaining the Home Assistant app

Supervisor builds this wrapper locally around the existing published application
image. No additional container publishing workflow is required.

The Dockerfile pins source commit `77c998fc988795e6647160bced029f0f750152b4`
using multi-platform digest
`sha256:c3aa8fa5f2012779c41114a09ca5275ec2df37c4334b22f48fe02dfb5c12b011`.
The registry manifest includes linux/arm64 and linux/amd64.

## Updating

1. Publish and review the application image using the existing workflow.
2. Verify both architectures are present in the registry manifest.
3. Update the Dockerfile digest and source commit, and this document.
4. Confirm Python, UID/GID 10001, `/app/server.py`, `--data-dir` and `/api/status`
   remain compatible with the startup wrapper.
5. Run `python3 -m unittest discover -s tests -v` from the repository root.
6. Build the wrapper and test installation, setup, restart persistence, watchdog,
   legacy Safari and backup restoration in Home Assistant.
7. Bump the app version in `config.yaml` and update `CHANGELOG.md`.

Publishing a new upstream image alone does not update this app. Keep the image
pinned so app updates are explicit. The wrapper only initializes its own
`/data/dashboard` directory, leaving Supervisor options untouched, then clears
supplementary groups and drops to the dashboard user's UID/GID.

## Container smoke test

```sh
docker build -t ancient-ha-addon ./ancient-dashboard
docker run --rm -p 7654:8095 -v ancient-ha-addon-test:/data ancient-ha-addon
```

Initial equivalent packaging installation and operation were confirmed by a
contributor on Raspberry Pi 5. Installation from this upstream repository, AMD64
operation and backup restoration still need verification on actual HA systems.
