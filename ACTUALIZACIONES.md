# Actualizar Zinctify desde GitHub

Zinctify puede buscar versiones nuevas en tu repositorio de GitHub y actualizarse con un botón (Administración → Resumen → Actualizaciones).

## Activarlo (una sola vez, en el servidor)
1. Copia la carpeta del proyecto al servidor y ejecuta `sudo bash service/install-service.sh`. No borra tus datos.
   Esto instala el script `apply-update.sh` y deja el servicio preparado para reiniciarse solo.
2. En la web: Administración → Resumen → Actualizaciones → escribe el repositorio (`usuario/nombre`) y pulsa Guardar.

## Publicar una versión nueva
1. Sube el número de versión: `SERVER_VERSION` en `zinctify.py` y la versión de los clientes.
2. Compila los clientes (Windows `.exe`, Linux `.AppImage`, Android `.apk`) y deja los archivos en una carpeta, junto con `latest.yml` y `latest-linux.yml`.
3. En la carpeta del proyecto: `python3 tools/make_release.py ruta/a/esa/carpeta`
   Crea `release/` con `zinctify-server-X.Y.Z.zip`, los clientes y `SHA256SUMS`.
4. En GitHub: Releases → Draft a new release → tag `vX.Y.Z` → sube **todo** lo de `release/` → Publish.
5. El servidor lo detecta solo en unas horas, o al pulsar "Buscar ahora". Entonces aparece "Actualizar ahora".

## Qué hace el botón
Descarga el paquete del servidor y los clientes, comprueba que no estén dañados (SHA256SUMS), guarda una copia de la versión actual, coloca los archivos nuevos y reinicia. Si en el arranque la versión nueva se cae tres veces seguidas, vuelve sola a la anterior y no vuelve a ofrecerte esa versión.

## Notas
- El tag de la release tiene que coincidir con `SERVER_VERSION` (v1.3.1 ↔ "1.3.1"), si no se rechaza.
- Sin `SHA256SUMS` no se instala (no se podría comprobar la descarga).
- Los datos (`/var/lib/zinctify`) nunca se tocan. La copia anterior queda en `/var/lib/zinctify/backups/last`.
- Si lo arrancas a mano (sin systemd) también funciona, siempre que el programa pueda escribir en su carpeta.
