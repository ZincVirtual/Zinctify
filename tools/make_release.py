#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepara los archivos de una release de Zinctify para subirlos a GitHub.

Uso:   python3 tools/make_release.py [carpeta_con_los_instaladores]

  - Lee la version de SERVER_VERSION en zinctify.py.
  - Crea release/zinctify-server-X.Y.Z.zip con zinctify.py, web/, service/ y los avisos de licencia.
  - Copia a release/ los instaladores que encuentre en la carpeta indicada (.exe, .AppImage, .apk, latest*.yml, .blockmap).
  - Crea release/SHA256SUMS (el servidor lo usa para comprobar que la descarga no esta danada).
Despues sube todo lo de release/ a una release de GitHub cuyo tag sea vX.Y.Z.
"""
import hashlib
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "release")
INCLUDE = ["zinctify.py", "service", "web", "README.md", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md"]
CLIENT_EXT = (".exe", ".appimage", ".apk", ".blockmap")
CLIENT_NAMES = ("latest.yml", "latest-linux.yml")


def main():
    with open(os.path.join(ROOT, "zinctify.py"), encoding="utf-8") as f:
        ver = re.search(r'^SERVER_VERSION = "([^"]+)"', f.read(), re.M).group(1)
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    zpath = os.path.join(OUT, "zinctify-server-%s.zip" % ver)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for item in INCLUDE:
            p = os.path.join(ROOT, item)
            if os.path.isdir(p):
                for base, dirs, files in os.walk(p):
                    dirs[:] = [d for d in dirs if d != "__pycache__"]
                    for fn in sorted(files):
                        full = os.path.join(base, fn)
                        z.write(full, os.path.relpath(full, ROOT).replace(os.sep, "/"))
            elif os.path.isfile(p):
                z.write(p, item)
    if len(sys.argv) > 1:
        src = sys.argv[1]
        for fn in sorted(os.listdir(src)):
            if fn.lower().endswith(CLIENT_EXT) or fn in CLIENT_NAMES:
                shutil.copy2(os.path.join(src, fn), os.path.join(OUT, fn))
    lines = []
    for fn in sorted(os.listdir(OUT)):
        if fn == "SHA256SUMS":
            continue
        h = hashlib.sha256()
        with open(os.path.join(OUT, fn), "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        lines.append("%s  %s" % (h.hexdigest(), fn))
    with open(os.path.join(OUT, "SHA256SUMS"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("Release %s lista en %s:" % (ver, OUT))
    for fn in sorted(os.listdir(OUT)):
        print("  ", fn)
    print("\nSube todo eso a una release de GitHub con el tag v%s." % ver)


if __name__ == "__main__":
    main()
