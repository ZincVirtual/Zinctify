# Updating Zinctify from GitHub

Zinctify can check your GitHub repository for new versions and update itself with one button (Administration → Overview → Updates).

## Turn it on (once, on the server)
1. Copy the project folder to the server and run `sudo bash service/install-service.sh`. Your data is not touched.
   This installs the `apply-update.sh` script and sets the service up so it can restart itself.
2. In the web app: Administration → Overview → Updates → type the repository (`user/name`) and press Save.

## Publish a new version
1. Raise the version number: `SERVER_VERSION` in `zinctify.py`, and the version of the clients.
2. Build the clients (Windows `.exe`, Linux `.AppImage`, Android `.apk`) and put the files in one folder, together with `latest.yml` and `latest-linux.yml`.
3. In the project folder run: `python3 tools/make_release.py path/to/that/folder`
   It creates `release/` with `zinctify-server-X.Y.Z.zip`, the clients and `SHA256SUMS`.
4. On GitHub: Releases → Draft a new release → tag `vX.Y.Z` → upload **everything** in `release/` → Publish.
5. The server notices it on its own within a few hours, or right away with "Check now". Then "Update now" appears.

## What the button does
It downloads the server package and the clients, checks that they are not corrupted (SHA256SUMS), keeps a copy of the current version, puts the new files in place and restarts. If the new version crashes three times in a row at startup, it goes back to the previous one by itself and does not offer that version again.

## Notes
- The release tag must match `SERVER_VERSION` (v1.3.1 ↔ "1.3.1"); otherwise it is rejected.
- Without `SHA256SUMS` nothing is installed (the download could not be verified).
- Your data (`/var/lib/zinctify`) is never touched. The previous copy is kept in `/var/lib/zinctify/backups/last`.
- If you start the server by hand (without systemd) it also works, as long as the program can write to its own folder.
