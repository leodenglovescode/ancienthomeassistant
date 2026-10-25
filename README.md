<p align="center">
  <img src="docs/logo.svg" width="112" height="112" alt="Ancient Home Assistant logo">
</p>

<h1 align="center">Ancient Home Assistant</h1>

<p align="center">A lightweight Home Assistant dashboard for older iPads.</p>

Home Assistant-style cards, touch controls, and camera views in a buildless frontend targeting iOS 9 Safari. A small Python bridge handles authentication and API requests. Run it directly or deploy with Docker Compose.

## Example dashboard

The screenshots show the interactive demo with sample values and illustrated camera previews. No Home Assistant connection is required to explore it.

![Example dashboard in light mode](docs/ipad-landscape.jpg)

<details>
<summary>Dark mode</summary>

![Example dashboard in dark mode](docs/ipad-dark.jpg)

</details>

## Features

- Light and switch controls, brightness sliders, and Home Assistant scenes.
- Temperature and humidity gauges, current weather, and thermostat controls.
- Camera snapshots, optional MJPEG viewing, and native HLS/MP4 playback.
- Light and dark themes, responsive layouts, and 44-pixel switch targets.
- Settings to connect Home Assistant and map entities to dashboard cards.
- No frontend framework, CDN, package installation, or JavaScript build step.

Cards have a fixed, configurable layout. This is an independent client, not a full Lovelace dashboard renderer or Home Assistant administration interface.

## Quick start

### Docker Compose

Clone this repository, enter its directory, then run:

```sh
docker compose up -d --build
docker compose ps
```

Open `http://SERVER_LAN_IP:8095` in a browser. The server and dashboard device must be able to reach each other over the network.

Optionally copy `.env.example` to `.env` to change the published address or port:

```dotenv
ANCIENT_BIND_IP=0.0.0.0
ANCIENT_PORT=8095
```

Docker publishes on all interfaces by default. Use a trusted LAN, or bind to a specific LAN address. Allow the selected port through the server firewall. The container runs as a non-root user with a read-only filesystem and a health check.

After pulling updates, rebuild:

```sh
git pull
docker compose up -d --build
```

### Python

Requires Python 3.9 or newer; no third-party packages are needed.

```sh
python3 server.py
```

Open <http://127.0.0.1:8095>. To accept connections from other devices:

```sh
python3 server.py --host 0.0.0.0 --port 8095
```

## Connect Home Assistant

1. Open **Settings** in the dashboard.
2. Enter the Home Assistant base address reachable from the dashboard server, such as `http://homeassistant.local:8123`.
3. Create a long-lived access token in **Home Assistant → profile → Security** and enter it in Settings.
4. Select entities for the cards and choose **Save dashboard**.

Inside Docker, `127.0.0.1` refers to the dashboard container. Use the Home Assistant host's LAN address, or its service name on a shared Docker network. If `.local` names do not resolve inside the container, use an IP address or regular DNS name.

States refresh every five seconds while the page is visible. Unconfigured or unavailable entities remain labeled accordingly. The all-off action affects only the four configured light slots. Activity shows successful actions from the current dashboard session.

## Authentication

The browser connects to the same-origin Python bridge; Home Assistant CORS configuration is not required. Access tokens stay in server memory after connection and are not written to disk, logged, or saved in browser storage. An HttpOnly cookie identifies the session. Sessions expire after 12 hours or a server restart.

Entity mappings, theme, the server address, and optional video URLs are saved in the browser. Use a trusted LAN or compatible HTTPS: plain HTTP does not encrypt token submission or session traffic. Do not expose the dashboard directly to the internet or embed credentials in video URLs.

## Cameras and compatibility

| Mode | Behavior |
| --- | --- |
| Snapshots | Default. Uses Home Assistant's authenticated camera image proxy. Expanded views refresh every five seconds after a successful image. |
| MJPEG | Select in the camera viewer. Uses Home Assistant's camera stream proxy; integration support varies. |
| Native video | Configure an HLS `.m3u8` or MP4 URL in Settings. Safari opens the URL directly, so it must be reachable from the viewing device. |

For legacy iPads, H.264/AAC video at 480p or 720p is a practical starting point. Older Safari may need MPEG-TS HLS segments. RTSP, HEVC, and WebRTC sources require a compatible camera/NVR output or a separate transcoder; no transcoder is bundled. Native video requires a tap to play, and HTTPS pages need HTTPS video sources.

The frontend targets iPad 2 / iOS 9 Safari using ES5, XMLHttpRequest, inline SVG, and table/block layouts. It does not require CSS Grid, CSS variables, `fetch`, JavaScript modules, or service workers. Landscape (1024 × 768) and portrait (768 × 1024) layouts are included. Safari's **Add to Home Screen** option provides a standalone view.

Rendering and video decoding happen on the viewing device. Actual device behavior and camera playback depend on the OS version, codecs, network, and Home Assistant integration.

## Development

```sh
python3 -m unittest discover -s tests -v
node --check static/app.js
```

Bridge tests use a local fake Home Assistant server; no real credentials are required.

## References

- [Apple iPad 2 specifications](https://support.apple.com/en-in/111990)
- [Safari 9 JavaScript support](https://webkit.org/blog/4054/es6-in-webkit/)
- [Apple's archived Safari audio/video guide](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Introduction/Introduction.html)
- [Home Assistant tile cards](https://www.home-assistant.io/dashboards/tile/) and [REST API](https://developers.home-assistant.io/docs/api/rest/)

Not affiliated with or endorsed by Home Assistant.
