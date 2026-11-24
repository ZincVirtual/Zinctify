# Zinctify

Zinctify is a Self-hosted alternative to Spotify with user accounts and a Subsonic/OpenSubsonic-compatible API (works with Feishin, Symfonium, Substreamer…).

**IT IS COMPLETLY VIBE CODED**

- **Server + web**: `zinctify.py` + `web/` — Python 3.9+ standard library only, plus `ffmpeg`.
- **Desktop client** (Windows / Linux): `client/zinctify-desktop/` (Electron).
- **Android app**: `client/zinctify-android-native/` (Kotlin, Jetpack Compose, Media3).

Features: playlists (collaborative, import from Spotify/YouTube/SoundCloud/Deezer/CSV), listen-together rooms, friends chat, radios, lyrics, offline mode, Wrapped, mixes, theming, Discord Rich Presence (desktop), and one-click self-update from GitHub Releases.

## Install (Linux with systemd)

```bash
git clone https://github.com/YOUR_USER/zinctify.git
cd zinctify
./install.sh
```

The script installs `python3` and `ffmpeg` if they are missing, asks for your music folder and port, installs Zinctify as a service (`/opt/zinctify`, data in `/var/lib/zinctify`) and starts it. Then open `http://SERVER_IP:4534`: the first account you create becomes the administrator.

Options: `./install.sh --yes` (no questions), `--music /path`, `--port 4534`, `--uninstall` (keeps your data). Settings live in `/etc/zinctify.env`.

If the script is not executable (`Permission denied`): `chmod +x install.sh` or run `bash install.sh`.

### Run without installing

```bash
python3 zinctify.py              # http://IP:4534
```

Options (also as `ZINCTIFY_*` environment variables): `--port`, `--host`, `--music-dir`, `--data-dir`, `--web-dir`, `--scan-interval`. The music folder is only read; the database and cover cache go to `./zinctify-data`.

## Updates

See [UPDATES.md](UPDATES.md) (how to publish a release and enable the update button).

## Clients

Each client folder has its own README with build steps.

## License

[MIT](LICENSE) © Zinctify contributors. If you modify or redistribute Zinctify, keep the copyright and license notice (credit to the original project). Third-party components: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
