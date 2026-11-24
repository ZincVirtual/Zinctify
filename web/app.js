"use strict";

/* Zinctify - interfaz web. Sin librerías: JavaScript normal.
   Todo el texto que viene del servidor (títulos, nombres...) se inserta con textContent
   (a través de h()), nunca con innerHTML, para que un tag raro no pueda romper la página. */

const root = document.getElementById("app");
const $ = (sel, from = document) => from.querySelector(sel);

/* ---------- idioma ----------
   Por defecto usa el idioma del sistema/navegador (si no lo tenemos, inglés). Se puede forzar en Ajustes.
   Los textos están en español; EN tiene la traducción de cada uno. Un texto sin traducir se ve en español. */
const SUPPORTED = ["es", "en"];
function detectLang() {
  for (const l of navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return "en";
}
let langPref = "auto";
try { langPref = localStorage.getItem("zinctify.lang") || "auto"; } catch (e) { /* ignorar */ }
const LANG = SUPPORTED.includes(langPref) ? langPref : detectLang();
const LOCALE = (navigator.language || "").slice(0, 2).toLowerCase() === LANG ? navigator.language : (LANG === "es" ? "es-ES" : "en-US");
document.documentElement.lang = LANG;

const EN = {
  "Actualizaciones": "Updates",
  "Versión instalada: {v}": "Installed version: {v}",
  "Repositorio de GitHub": "GitHub repository",
  "Donde publicas las versiones (en «Releases»). Se escribe usuario/nombre.": "Where you publish the versions (in “Releases”). Written as user/name.",
  "Buscar actualizaciones automáticamente cada pocas horas": "Check for updates automatically every few hours",
  "Buscar ahora": "Check now",
  "Última búsqueda: {t}": "Last check: {t}",
  "todavía no": "not yet",
  "La versión {v} no arrancó bien y el servidor volvió a la anterior.": "Version {v} did not start properly and the server went back to the previous one.",
  "Esperando a que el servidor vuelva…": "Waiting for the server to come back…",
  "No se pudo actualizar: {e}": "The update failed: {e}",
  "Hay una versión nueva: {v}": "There is a new version: {v}",
  "También se descargarán los clientes de: {c}.": "The clients for {c} will also be downloaded.",
  "Esta versión no trae clientes nuevos.": "This version has no new clients.",
  "Actualizar ahora": "Update now",
  "Ver en GitHub": "View on GitHub",
  "Hay una versión nueva, pero no trae el paquete del servidor todavía.": "There is a new version, but it does not include the server package yet.",
  "Tienes la última versión.": "You have the latest version.",
  "Hay una versión nueva de Zinctify ({v}). Pulsa aquí para actualizar.": "There is a new version of Zinctify ({v}). Tap here to update.",
  "Se descargará la versión {v} (servidor y clientes) y el servidor se reiniciará unos segundos. ¿Seguir?": "Version {v} (server and clients) will be downloaded and the server will restart for a few seconds. Continue?",
  "Te avisamos de sus playlists nuevas: pulsa para no recibir avisos": "We notify you of their new playlists: tap to stop notifications",
  "Sin avisos de sus playlists nuevas: pulsa para recibirlos": "No notifications for their new playlists: tap to get them",
  "Te avisaremos cuando publique playlists nuevas": "We will notify you when they publish new playlists",
  "No te avisaremos de sus playlists nuevas": "We won't notify you of their new playlists",
  "Te avisamos de su música nueva: pulsa para no recibir avisos": "We notify you of their new music: tap to stop notifications",
  "Sin avisos de su música nueva: pulsa para recibirlos": "No notifications for their new music: tap to get them",
  "Te avisaremos cuando haya música nueva de este artista": "We will notify you when this artist has new music",
  "No te avisaremos de su música nueva": "We won't notify you of their new music",
  "Secciones": "Sections",
  "Elige qué secciones salen en el menú.": "Choose which sections show in the menu.",
  "tu lista (CSV/texto)": "your list (CSV/text)",
  "Guardo tu lista: cuando lleguen al servidor canciones que faltan, se añadirán solas al final de la playlist.": "I keep your list: when missing songs reach the server, they are added to the end of the playlist automatically.",
  "Mostrar la sección Radios a todos los usuarios": "Show the Radios section to all users",
  "Está desactivada por defecto. Aquí, como administrador, siempre puedes gestionar la lista.": "Off by default. Here, as an admin, you can always manage the list.",
  "Radios activadas para todos": "Radios enabled for everyone",
  "Radios ocultas para todos": "Radios hidden for everyone",
  "No se ha elegido ninguna imagen": "No image was chosen",
  "Portada guardada": "Cover saved",
  "Subir portada": "Upload cover",
  "Buscar logo": "Find logo",
  "Logo encontrado": "Logo found",
  "Quitar portada": "Remove cover",
  "Portada quitada": "Cover removed",
  "Sonando": "Playing",
  "Proponer a la sala": "Propose to the room",
  "Estás en una sala de Escuchar juntos. ¿Quieres proponer esta playlist ({n} canciones) para la sala? Se añadirá a la cola si la mayoría vota que sí.": "You are in a Listen together room. Do you want to propose this playlist ({n} songs) to the room? It will be added to the queue if most people vote yes.",
  "Sí, proponerla": "Yes, propose it",
  "Playlist propuesta: la sala está votando": "Playlist proposed: the room is voting",
  "{who} propone la playlist «{name}»: vota": "{who} proposes the playlist “{name}”: vote",
  "La sala ha aprobado «{name}»: añadida a la cola": "The room approved “{name}”: added to the queue",
  "La sala ha rechazado «{name}»": "The room rejected “{name}”",
  "… y {n} más": "… and {n} more",
  "Votación de playlist": "Playlist vote",
  "{who} la propone · {n} canciones": "Proposed by {who} · {n} songs",
  "Sí {y} · No {n} · {m} en la sala": "Yes {y} · No {n} · {m} in the room",
  "Sí, añadir": "Yes, add it",
  "Mezclar la cola de la sala": "Shuffle the room queue",
  "Mover, quitar y mezclar canciones": "Move, remove and shuffle songs",
  "Proponer playlists": "Propose playlists",
  "Zinctify de escritorio": "Zinctify desktop",
  "Navegador": "Browser",
  "en {device}": "on {device}",
  "Escuchando en {device}": "Listening on {device}",
  "Reproducir en…": "Play on…",
  "Aplicación de escritorio": "Desktop app",
  "App del móvil": "Phone app",
  "Este dispositivo": "This device",
  "Sonando": "Playing",
  "Abre Zinctify en otro dispositivo con tu cuenta y saldrá aquí.": "Open Zinctify on another device with your account and it will show up here.",
  "Has escuchado {n} minutos de radio en {year}. Tu radio del año:": "You listened to {n} minutes of radio in {year}. Your radio of the year:",
  "{n} veces que la has puesto": "tuned in {n} times",
  "Chat de la sala": "Room chat",
  "Escribe algo: lo ve toda la sala. Este chat se borra cuando la sala se cierra.": "Write something: the whole room sees it. This chat is deleted when the room closes.",
  "Mensajes": "Messages",
  "Mensaje": "Message",
  "Escribe un mensaje…": "Write a message…",
  "Enviar": "Send",
  "Enviado a {name}": "Sent to {name}",
  "Sube para ver mensajes anteriores": "Scroll up for older messages",
  "Aún no habéis hablado. Los mensajes se guardan cifrados y no se borran.": "You haven't talked yet. Messages are stored encrypted and never deleted.",
  "Hoy": "Today",
  "Ayer": "Yesterday",
  "Mandar a…": "Send to…",
  "Tú: ": "You: ",
  "Aún no tienes amigos. Los amigos son quienes os seguís los dos.": "You don't have friends yet. Friends are people who follow each other.",
  "Los mensajes con tus amigos se guardan cifrados en el servidor y no se borran.": "Messages with your friends are stored encrypted on the server and never deleted.",
  "Sonido cuando recibo un mensaje": "Sound when I get a message",
  "Cola de la sala": "Room queue",
  "La cola de la sala está vacía. Añade canciones y sonarán para todos.": "The room queue is empty. Add songs and they'll play for everyone.",
  "No hay más canciones en la cola de la sala.": "No more songs in the room queue.",
  "{n} canciones añadidas a la cola de la sala": "{n} songs added to the room queue",
  "El anfitrión no te ha dado permiso para hacer esto": "The host hasn't given you permission to do this",
  "Pausar y adelantar": "Pause and seek",
  "Cambiar de canción": "Change song",
  "Añadir canciones": "Add songs",
  "Mover y quitar canciones": "Move and remove songs",
  "invitado": "guest",
  "Puedes: {list}": "You can: {list}",
  "Solo puedes escuchar.": "You can only listen.",
  "Permisos de los invitados nuevos": "Permissions for new guests",
  "Lo que podrán hacer los que entren a partir de ahora. A cada uno ya presente se le cambia arriba.": "What people who join from now on will be able to do. Change those already here above.",
  "Crea una sala y comparte el código: todos los que entren oirán la misma canción a la vez. Tú eres el anfitrión y decides qué puede hacer cada invitado.": "Create a room and share the code: everyone who joins hears the same song at the same time. You are the host and decide what each guest can do.",
  "Olvidé mi contraseña": "Forgot my password",
  "Volver a entrar": "Back to sign in",
  "Recuperar contraseña": "Recover password",
  "Enviar código de recuperación": "Send recovery code",
  "Te hemos enviado un código a {email}. Caduca en 10 minutos.": "We've sent a code to {email}. It expires in 10 minutes.",
  "Escribe el correo de tu cuenta y te enviaremos un código para cambiar la contraseña.": "Enter your account's email and we'll send you a code to change your password.",
  "Escribe el código": "Enter the code",
  "Confirmar código": "Confirm code",
  "Código de 6 cifras": "6-digit code",
  "Pedir otro código": "Ask for another code",
  "Nueva contraseña": "New password",
  "Cambiar contraseña": "Change password",
  "Contraseña cambiada. Ya puedes entrar.": "Password changed. You can sign in now.",
  "Correo para recuperar contraseñas": "Email for password recovery",
  "Cuenta de correo que usa Zinctify para enviar los códigos de «Olvidé mi contraseña». Si dejas el servidor vacío, esa opción queda desactivada.": "Email account Zinctify uses to send the “Forgot my password” codes. If you leave the server empty, that option is disabled.",
  "Servidor SMTP": "SMTP server",
  "Puerto": "Port",
  "Cifrado": "Encryption",
  "Sin cifrado": "No encryption",
  "Remitente": "Sender",
  "(sin cambios)": "(unchanged)",
  "Correo para la prueba": "Email for the test",
  "Enviar correo de prueba a": "Send test email to",
  "Probar": "Test",
  "Correo enviado a {to}": "Email sent to {to}",
  "1 persona": "1 person",
  "Pública": "Public", "Privada": "Private", "Solo amigos": "Friends only",
  "Aparece en la lista y puede entrar cualquiera.": "Shown in the list; anyone can join.",
  "No sale en ninguna lista: solo entra quien tenga el código.": "Not listed anywhere: only people with the code can join.",
  "Solo la ven y pueden entrar tus amigos (os seguís los dos).": "Only your friends (you follow each other) can see and join it.",
  "Quién puede entrar": "Who can join",
  "Sala de {name}": "{name}'s room",
  "{n} personas": "{n} people",
  "Ahora mismo no hay salas abiertas.": "There are no open rooms right now.",
  "Nombre de la sala (opcional)": "Room name (optional)",
  "Salas abiertas": "Open rooms",
  "Unirme con un código": "Join with a code",
  "Elegir mi propia clave": "Choose my own key",
  "Clave guardada": "Key saved",
  "Escribe la clave que quieras usar en las apps (8 a 64 caracteres, sin espacios). Se guarda sin cifrar, así que no uses una contraseña que uses en otros sitios.": "Type the key you want to use in apps (8 to 64 characters, no spaces). It is stored unencrypted, so don't reuse a password from other sites.",
  "Cambiar servidor": "Change server",
  "Artistas, canciones, personas…": "Artists, songs, people…",
  "Más": "More",
  "Navegación": "Navigation",
  "Minimizar": "Minimize",
  "Opciones": "Options",
  "Reproduciendo ahora": "Now playing",
  "Añadida a la cola de la sala": "Added to the room queue",
  "Estás en una sala de Escuchar juntos y ya hay una playlist sonando. Sal de la sala para poner otra.": "You are in a Listen together room and a playlist is already playing. Leave the room to play another one.",
  "El archivo es demasiado grande (máximo 30 MB).": "The file is too large (30 MB maximum).",
  "Leyendo la playlist…": "Reading the playlist…",
  "Leyendo la playlist y buscando tus canciones. Puedes dejar esta ventana abierta mientras tanto.": "Reading the playlist and looking for your songs. You can leave this window open meanwhile.",
  "Buscando canciones: {done} de {total} ({pct} %)": "Looking for songs: {done} of {total} ({pct} %)",
  "quedan unos {t}": "about {t} left",
  "calculando el tiempo…": "estimating the time…",
  "Guardando…": "Saving…",
  "{n} s": "{n} s",
  "{n} min": "{n} min",
  "{h} h {m} min": "{h} h {m} min",
  "Este navegador no puede guardar música sin conexión.": "This browser can't store music offline.",
  "No se pudo descargar «{t}».": "Couldn't download “{t}”.",
  "Descargado": "Downloaded",
  "Quitar la descarga de este dispositivo": "Remove the download from this device",
  "Guardar para escuchar sin conexión": "Save to listen offline",
  "¿Quitar la descarga de «{name}» de este dispositivo?": "Remove the download of “{name}” from this device?",
  "Descarga quitada": "Download removed",
  "Listo: «{name}» ya está disponible sin conexión": "Done: “{name}” is now available offline",
  "Sin conexión": "Offline",
  "Música guardada en este dispositivo: se oye aunque no haya internet. Descarga álbumes y playlists con el botón «Descargar».": "Music saved on this device: it plays even without internet. Download albums and playlists with the “Download” button.",
  "espacio disponible: {n}": "free space: {n}",
  "Todavía no has descargado nada.": "You haven't downloaded anything yet.",
  "Sin conexión: solo puedes escuchar lo que descargaste": "Offline: you can only listen to what you downloaded",
  "Crossfade": "Crossfade",
  "Apagado": "Off",
  "Duración del fundido": "Fade length",
  "Las canciones se funden unas con otras: la siguiente empieza mientras la actual se apaga. Con 0 está apagado. No se usa en radios, en salas ni al repetir una canción.": "Songs blend into each other: the next one starts while the current one fades out. 0 means off. It isn't used for radios, rooms or when repeating one song.",
  "Tus amigos están escuchando": "Your friends are listening to",
  "Dejar que quienes me siguen vean lo que estoy escuchando": "Let people who follow me see what I'm listening to",
  "Las radios no se pueden escuchar en una sala": "Radios can't be played in a room",
  "La sala se ha cerrado": "The room has been closed",
  "Sala {code} · {n} personas": "Room {code} · {n} people",
  "Escuchar juntos": "Listen together",
  "Crea una sala y comparte el código: todos los que entren oirán la misma canción a la vez. Cualquiera puede pausar, saltar o cambiar la lista.": "Create a room and share the code: everyone who joins hears the same song at the same time. Anyone can pause, skip or change the list.",
  "Crear una sala con lo que suena": "Create a room with what's playing",
  "Crear una sala": "Create a room",
  "Unirme a una sala": "Join a room",
  "Unirme": "Join",
  "Código de la sala": "Room code",
  "Copiar enlace": "Copy link",
  "Salir de la sala": "Leave the room",
  "En la sala ({n})": "In the room ({n})",
  "anfitrión": "host",
  "Suena: {title}": "Now playing: {title}",
  "Todavía no hay música: pon una playlist o un álbum y sonará para todos.": "No music yet: play a playlist or an album and it will play for everyone.",
  "Tus mixes": "Your mixes",
  "Mix diario": "Daily Mix",
  "Redescubre": "Rediscover",
  "Anuncios": "Announcements",
  "Idioma en el que se ve": "Language it is shown in",
  "Todos los idiomas": "All languages",
  "Anuncios en la Home": "Home announcements",
  "Anuncio {n}": "Announcement {n}",
  "Enlace (opcional)": "Link (optional)",
  "Imagen de fondo (opcional, dirección)": "Background image (optional, address)",
  "Color": "Color",
  "Un banner arriba de la Home que va rotando entre los anuncios que añadas. Está desactivado por defecto.": "A banner at the top of the Home that rotates through the announcements you add. Off by default.",
  "Mostrar los anuncios en la Home": "Show announcements on the Home",
  "Segundos entre anuncios": "Seconds between announcements",
  "Añadir anuncio": "Add announcement",
  "Máximo 10 anuncios": "Maximum 10 announcements",
  "Playlists que has escuchado": "Playlists you've played",
  "Recomendado para ti": "Recommended for you",
  "Porque escuchas {names}": "Because you listen to {names}",
  "Banner": "Banner",
  "Sin banner": "No banner",
  "Cambiar el banner": "Change banner",
  "Quitar el banner": "Remove banner",
  "Banner cambiado": "Banner changed",
  "Se ve en la parte de arriba de tu perfil. Funciona con JPG, PNG, WEBP y GIF; se recorta en formato panorámico (3:1).": "Shown at the top of your profile. Works with JPG, PNG, WEBP and GIF; it is cropped to a wide 3:1 format.",
  "Tamaño de la interfaz": "Interface size",
  "En pantallas muy grandes (como una tele) la página se amplía sola para que no se vea enana. Aquí puedes fijar un tamaño concreto.": "On very large screens (like a TV) the page scales up automatically so it doesn't look tiny. You can set a fixed size here.",
  "Automático": "Automatic",
  "Copiado": "Copied",
  "No se pudo copiar. Selecciona el texto y cópialo a mano.": "Couldn't copy. Select the text and copy it by hand.",
  "Tu sesión ha caducado. Entra de nuevo.": "Your session has expired. Sign in again.",
  "en directo": "live",
  "Reproducir": "Play",
  "Pausar": "Pause",
  "La cola está vacía.": "The queue is empty.",
  "Nada sonando": "Nothing playing",
  "Elige un álbum o una radio para empezar": "Pick an album or a radio station to start",
  "Posición en la canción": "Position in song",
  "Volumen": "Volume",
  "Cola de reproducción": "Play queue",
  "Anterior": "Previous",
  "Siguiente": "Next",
  "Cola": "Queue",
  "No se puede reproducir «{title}»": "Can't play “{title}”",
  "Todavía no hay música en la biblioteca.": "There's no music in the library yet.",
  "Si acabas de arrancar el servidor, el escaneo puede estar en marcha: espera un momento y recarga. Comprueba también que la ruta de --music-dir es la correcta.": "If you just started the server, the scan may still be running: wait a moment and reload. Also check that the --music-dir path is correct.",
  "Ir a administración": "Go to administration",
  "No se pudo cargar esta página: {msg}": "This page couldn't be loaded: {msg}",
  "Reintentar": "Retry",
  "Hola, {name}": "Hello, {name}",
  "Lo último que has escuchado": "Recently played",
  "Añadido hace poco": "Recently added",
  "Para descubrir": "Discover",
  "Artistas": "Artists",
  "Álbumes": "Albums",
  "Cargar más": "Load more",
  "Disco {n}": "Disc {n}",
  "Aleatorio": "Shuffle",
  "Escribe en el buscador para encontrar artistas, álbumes o canciones.": "Type in the search box to find artists, albums or songs.",
  "Buscar": "Search",
  "No hay resultados para «{q}». Prueba con menos palabras.": "No results for “{q}”. Try fewer words.",
  "Resultados para «{q}»": "Results for “{q}”",
  "Canciones": "Songs",
  "Radio en directo": "Live radio",
  "Escuchar": "Listen",
  "Borrar": "Delete",
  "¿Borrar la radio «{name}»?": "Delete the radio “{name}”?",
  "Todavía no hay radios. Añade la URL directa de un stream (por ejemplo, una que termine en .mp3 o .aac).": "There are no radios yet. Add the direct URL of a stream (for example, one ending in .mp3 or .aac).",
  "Todavía no hay radios. Pídele al administrador que añada alguna.": "There are no radios yet. Ask the administrator to add some.",
  "https://... (opcional)": "https://... (optional)",
  "Nombre": "Name",
  "URL del stream": "Stream URL",
  "Página web": "Website",
  "Añadir radio": "Add radio",
  "Añadir una radio": "Add a radio",
  "Todavía no hay reproducciones en {year}. Cada canción que escuches desde aquí o desde tus apps cuenta para tu Wrapped.": "There are no plays in {year} yet. Every song you listen to here or in your apps counts towards your Wrapped.",
  "minutos de música en {year}: {plays} de {songs}.": "minutes of music in {year}: {plays} of {songs}.",
  "Tu artista del año, con {plays}.": "Your top artist of the year, with {plays}.",
  "Géneros": "Genres",
  "Por mes": "By month",
  "Por hora del día": "By hour of day",
  "Año": "Year",
  "Calculando...": "Calculating...",
  "Ajustes": "Settings",
  "Clave para apps": "App key",
  "Copiar": "Copy",
  "Conectar tus apps": "Connect your apps",
  "Feishin, Symfonium, Substreamer y otras apps usan una clave propia (la de abajo). Pon estos tres datos en la app. Si la app tiene la opción «API key», pega solo la clave.": "Feishin, Symfonium, Substreamer and other apps use their own key (below). Enter these three details in the app. If the app has an “API key” option, paste only the key.",
  "Dirección del servidor": "Server address",
  "Servidor": "Server",
  "Usuario": "Username",
  "Clave": "Key",
  "Copiar clave": "Copy key",
  "Las apps conectadas dejarán de funcionar hasta que les pongas la clave nueva. ¿Continuar?": "Connected apps will stop working until you enter the new key in them. Continue?",
  "Clave nueva generada": "New key generated",
  "Generar otra clave": "Generate a new key",
  "Cambiar la contraseña": "Change password",
  "Las contraseñas nuevas no coinciden.": "The new passwords don't match.",
  "Contraseña cambiada": "Password changed",
  "Contraseña actual": "Current password",
  "Contraseña nueva (mínimo 8 caracteres)": "New password (at least 8 characters)",
  "Repite la contraseña nueva": "Repeat the new password",
  "Cambiar contraseña": "Change password",
  "Sesión": "Session",
  "Cerrar sesión": "Sign out",
  "Idioma": "Language",
  "Automático (sistema)": "Automatic (system)",
  "Por defecto se usa el idioma de tu sistema.": "By default, your system's language is used.",
  "Escaneando... {n} archivos revisados": "Scanning... {n} files checked",
  "Último escaneo: {date}": "Last scan: {date}",
  "Todavía no ha terminado ningún escaneo.": "No scan has finished yet.",
  "Administrador": "Administrator",
  "Reproducciones": "Plays",
  "Alta": "Joined",
  "{user} es administrador": "{user} is an administrator",
  "Guardado": "Saved",
  "¿Borrar la cuenta «{user}» y su historial de reproducciones? No se puede deshacer.": "Delete the account “{user}” and its listening history? This can't be undone.",
  "Registro abierto": "Sign-up open",
  "Registro cerrado": "Sign-up closed",
  "Permitir que cualquiera cree una cuenta desde la pantalla de entrada. Si lo dejas desmarcado, solo tú puedes crear cuentas.": "Let anyone create an account from the sign-in screen. If left unchecked, only you can create accounts.",
  "Crear un usuario": "Create a user",
  "Contraseña (mínimo 8 caracteres)": "Password (at least 8 characters)",
  "Crear usuario": "Create user",
  "Administración": "Administration",
  "Biblioteca": "Library",
  "{songs}, {albums} y {artists}.": "{songs}, {albums} and {artists}.",
  "Buscar cambios": "Check for changes",
  "Releer todo": "Rescan everything",
  "Usuarios": "Users",
  "Entrar": "Sign in",
  "Crear cuenta": "Create account",
  "Crear cuenta de administrador": "Create administrator account",
  "El registro está cerrado. Pídele al administrador que te cree una cuenta.": "Sign-up is closed. Ask the administrator to create an account for you.",
  "Las contraseñas no coinciden.": "The passwords don't match.",
  "Contraseña": "Password",
  "Repite la contraseña": "Repeat the password",
  "Crea la primera cuenta. Será la administradora: podrá escanear la biblioteca y gestionar usuarios.": "Create the first account. It will be the administrator: it can scan the library and manage users.",
  "Tu música, en tu servidor.": "Your music, on your server.",
  "Inicio": "Home",
  "Principal": "Main",
  "Buscar artistas, álbumes o canciones": "Search artists, albums or songs",
  "Cargando...": "Loading...",
  "Esta página no existe.": "This page doesn't exist.",
  "Volver al inicio": "Back to home",
  "No se puede conectar con el servidor: {msg}": "Can't connect to the server: {msg}",
  "Aparece en": "Appears on",
  "Álbum desconocido": "Unknown album",
  "Artista desconocido": "Unknown artist",
  "Resumen": "Overview",
  "Metadatos": "Metadata",
  "Secciones de administración": "Administration sections",
  "Horas de música": "Hours of music",
  "Últimos 7 días": "Last 7 days",
  "Reproducciones, últimos 14 días": "Plays, last 14 days",
  "Zinctify {v} · activo desde hace {up} · base de datos {mb} MB": "Zinctify {v} · up for {up} · database {mb} MB",
  "Probar": "Test",
  "Editar": "Edit",
  "Editar la radio": "Edit the radio",
  "Guardar cambios": "Save changes",
  "Cancelar": "Cancel",
  "Las radios de esta lista las ven todos los usuarios en la sección Radios.": "Everyone can see the radios in this list in the Radios section.",
  "Título": "Title",
  "Artista": "Artist",
  "Álbum": "Album",
  "necesita una clave tuya": "needs your own key",
  "guardado; escribe otro para cambiarlo": "saved; type a new one to change it",
  "Escanear metadatos": "Scan metadata",
  "Parar": "Stop",
  "Revisando... {done} de {total} canciones, {n} propuestas nuevas": "Checking... {done} of {total} songs, {n} new suggestions",
  "Última pasada: {done} canciones revisadas, {n} propuestas nuevas": "Last run: {done} songs checked, {n} new suggestions",
  "Todavía no has escaneado metadatos.": "You haven't scanned metadata yet.",
  "{checked} de {songs} canciones revisadas · {pending} propuestas pendientes · {overrides} correcciones aplicadas": "{checked} of {songs} songs checked · {pending} pending suggestions · {overrides} corrections applied",
  "Pendientes": "Pending",
  "Aceptadas": "Accepted",
  "Descartadas": "Dismissed",
  "Aceptar": "Accept",
  "Descartar": "Dismiss",
  "Recuperar": "Restore",
  "{n} propuestas": "{n} suggestions",
  "No hay propuestas aquí.": "No suggestions here.",
  "¿Aceptar todas las propuestas pendientes con confianza del 95 % o más?": "Accept all pending suggestions with 95% confidence or more?",
  "{n} canciones corregidas": "{n} songs corrected",
  "Aceptar las de confianza alta": "Accept the high-confidence ones",
  "Correcciones aplicadas": "Applied corrections",
  "Deshacer": "Undo",
  "Todavía no has aceptado ninguna corrección.": "You haven't accepted any corrections yet.",
  "Compara los metadatos de tu biblioteca con servicios en línea y te propone correcciones (tildes, mayúsculas, caracteres raros). Tus archivos de música no se modifican: lo que aceptes se guarda en la base de datos de Zinctify.": "Compares your library's metadata with online services and suggests corrections (accents, capitalisation, odd characters). Your music files are never modified: what you accept is stored in Zinctify's database.",
  "Servicios": "Services",
  "Guardar servicios": "Save services",
  "A estos servicios se envían solo el título y el artista de cada canción. SoundCloud no está disponible porque ya no da claves de API a aplicaciones nuevas. Las claves de Spotify se crean gratis en developer.spotify.com.": "Only the title and artist of each song are sent to these services. SoundCloud isn't available because it no longer issues API keys to new apps. Spotify keys are free at developer.spotify.com.",
  "Canciones por pasada": "Songs per run",
  "Volver a revisar también las ya revisadas": "Also re-check songs that were already checked",
  "Escanear": "Scan",
  "Propuestas": "Suggestions",
  "Radios": "Radios",
  "Activar la normalización": "Turn on normalization",
  "Alta (MP3 320 kbps)": "High (MP3 320 kbps)",
  "Alto (−14 LUFS, como Spotify)": "Loud (−14 LUFS, like Spotify)",
  "Aquí aparecerán tus playlists y lo que guardes con el corazón.": "Your playlists and anything you save with the heart will show up here.",
  "Atrás": "Back",
  "Añade una descripción": "Add a description",
  "Añadido a «{name}»": "Added to “{name}”",
  "Baja (MP3 96 kbps)": "Low (MP3 96 kbps)",
  "Bio": "Bio",
  "Calidad del audio": "Audio quality",
  "Cambiar la foto": "Change photo",
  "Change log": "Change log",
  "Compacta": "Compact",
  "Con una calidad menor gastas menos datos: el servidor convierte la canción a MP3 al vuelo. «Original» envía el archivo tal cual.": "Lower quality uses less data: the server converts the song to MP3 on the fly. “Original” sends the file as it is.",
  "Contraseña actual (para cambiar el correo)": "Current password (to change your email)",
  "Correo electrónico": "Email",
  "Crear": "Create",
  "Crear playlist": "Create playlist",
  "Cuadrícula": "Grid",
  "Cualquiera con cuenta puede verla. Haz clic para hacerla privada.": "Anyone with an account can see it. Click to make it private.",
  "Cómo se ven tus playlists, álbumes y artistas en la barra de la izquierda.": "How your playlists, albums and artists look in the left sidebar.",
  "De {author}": "By {author}",
  "Descargar": "Download",
  "Disponible en el futuro: descargar el cliente": "Coming later: download the app",
  "Esta playlist está vacía.": "This playlist is empty.",
  "Esta playlist está vacía. Haz clic derecho en una canción o un álbum, o pulsa ⋯, y elige Playlists para añadirla.": "This playlist is empty. Right-click a song or an album, or tap ⋯, and choose Playlists to add it.",
  "Foto cambiada": "Photo changed",
  "Guardar en tu biblioteca": "Save to your library",
  "Hace que todas las canciones suenen igual de fuerte aunque cada archivo tenga un volumen distinto. El servidor mide el volumen de cada canción en segundo plano; hasta que lo haya medido, esa canción suena sin ajustar.": "Makes every song sound equally loud even if each file has a different volume. The server measures each song's loudness in the background; until it has, that song plays unadjusted.",
  "Haz clic para editar": "Click to edit",
  "Ir al álbum": "Go to album",
  "Medir el volumen de las canciones en segundo plano (para la normalización). Usa un poco de procesador.": "Measure song loudness in the background (for normalization). Uses a bit of CPU.",
  "Mi playlist n.º {n}": "My playlist #{n}",
  "Muy alto (−11 LUFS)": "Very loud (−11 LUFS)",
  "Más opciones": "More options",
  "No se pudo leer esa imagen.": "That image could not be read.",
  "Normal (MP3 160 kbps)": "Normal (MP3 160 kbps)",
  "Normal (−16 LUFS)": "Normal (−16 LUFS)",
  "Normalizar el volumen": "Volume normalization",
  "Original (sin convertir)": "Original (not converted)",
  "Perfil": "Profile",
  "Perfil guardado": "Profile saved",
  "Playlist privada": "Private playlist",
  "Playlist pública": "Public playlist",
  "Playlist «{name}» creada": "Playlist “{name}” created",
  "Playlists": "Playlists",
  "Portada grande, y debajo el nombre, el tipo y el autor.": "Large cover, with the name, type and author below.",
  "Privada": "Private",
  "Próximamente": "Coming soon",
  "Pública": "Public",
  "Quitar de la playlist": "Remove from playlist",
  "Quitar de tu biblioteca": "Remove from your library",
  "Quitar la foto": "Remove photo",
  "Sin nombre": "Untitled",
  "Solo el nombre y si es playlist, álbum o artista.": "Just the name and whether it is a playlist, album or artist.",
  "Solo tú puedes verla. Haz clic para hacerla pública.": "Only you can see it. Click to make it public.",
  "Suave (−19 LUFS)": "Quiet (−19 LUFS)",
  "Todos los artistas": "All artists",
  "Todos los álbumes": "All albums",
  "Tu biblioteca": "Your library",
  "Tu cuenta": "Your account",
  "Tu cuenta todavía no tiene correo. Añade uno.": "Your account has no email yet. Add one.",
  "Volumen de las canciones": "Song volume",
  "Volumen medido: {done} de {total} canciones": "Volume measured: {done} of {total} songs",
  "Volumen objetivo": "Target volume",
  "¿Borrar la playlist «{name}»? No se puede deshacer.": "Delete the playlist “{name}”? This cannot be undone.",
  "Playlist": "Playlist",
  "Carpeta de música (en el servidor)": "Music folder (on the server)",
  "Todavía no hay carpeta de música. Escribe la ruta en el servidor y pulsa Guardar.": "There's no music folder yet. Type its path on the server and press Save.",
  "Cambiar de carpeta vuelve a escanear: lo que no esté en la nueva carpeta desaparece de la biblioteca.": "Changing the folder rescans: anything not in the new folder disappears from the library.",
  "La carpeta no existe o no está montada.": "The folder doesn't exist or isn't mounted.",
  "Guardar": "Save",
  "La imagen pesa más de 20 MB": "The image is larger than 20 MB",
  "No son duplicadas": "They're not duplicates",
  "Los archivos eliminados se mueven a la carpeta «duplicadas-eliminadas» de los datos de Zinctify (no se borran del todo). Las playlists pasarán a usar la que te quedas. ¿Continuar?": "Removed files are moved to the \"duplicadas-eliminadas\" folder inside Zinctify's data (they aren't erased). Playlists will use the one you keep. Continue?",
  "Recomendada: mejor calidad": "Recommended: best quality",
  "Personas": "People",
  "Editar perfil": "Edit profile",
  "{n} siguiendo": "{n} following",
  "{n} canciones": "{n} songs",
  "Seguir": "Follow",
  "Canciones duplicadas": "Duplicate songs",
  "Pasar el escaneo de metadatos automáticamente a cada archivo nuevo": "Automatically run the metadata scan on every new file",
  "{n} grupos de canciones duplicadas": "{n} groups of duplicate songs",
  "{n} seguidores": "{n} followers",
  "Los archivos no se tocan, solo dejan de salir en la biblioteca. Las playlists pasarán a usar la que te quedas. ¿Continuar?": "The files aren't touched; they just stop showing in the library. Playlists will use the one you keep. Continue?",
  "Todavía no tiene playlists públicas.": "They don't have any public playlists yet.",
  "Buscar canciones, artistas, álbumes o personas": "Search songs, artists, albums or people",
  "Siguiendo": "Following",
  "{n} reproducciones": "{n} plays",
  "Quedarme con la marcada y eliminar las demás": "Keep the selected one and remove the rest",
  "Buscando...": "Searching...",
  "Busca canciones con el mismo título y artista y casi la misma duración.": "Finds songs with the same title and artist and almost the same length.",
  "Playlists públicas": "Public playlists",
  "Quedarme con la marcada y ocultar las demás": "Keep the selected one and hide the rest",
  "No hay canciones duplicadas. 🎉": "No duplicate songs. 🎉",
  "Escribe en el buscador para encontrar artistas, álbumes, canciones o personas.": "Type in the search box to find artists, albums, songs or people.",
  "Hecho": "Done",
  "Duplicadas": "Duplicates",
  "Se quitará la copia de peor calidad de {n} grupos con 95 % o más de seguridad. Los archivos van a la carpeta «duplicadas-eliminadas» (no se borran del todo). ¿Continuar?": "The lower-quality copy will be removed in {n} groups that are 95% or more certain. Files go to the \"duplicadas-eliminadas\" folder (they aren't erased). Continue?",
  "Se ocultará la copia de peor calidad de {n} grupos con 95 % o más de seguridad. Los archivos no se tocan. ¿Continuar?": "The lower-quality copy will be hidden in {n} groups that are 95% or more certain. Files aren't touched. Continue?",
  "{n} grupos resueltos": "{n} groups resolved",
  "{n} con error": "{n} failed",
  "Quedarme con la recomendada y eliminar las demás en las de 95 % o más de seguridad ({n})": "Keep the recommended one and remove the rest in groups 95% or more certain ({n})",
  "Quedarme con la recomendada y ocultar las demás en las de 95 % o más de seguridad ({n})": "Keep the recommended one and hide the rest in groups 95% or more certain ({n})",
  "{n} % seguro": "{n}% sure",
  "Añadida a la cola: «{title}»": "Added to queue: \"{title}\"",
  "{n} canciones añadidas a la cola": "{n} songs added to queue",
  "Quitar de la cola": "Remove from queue",
  "Aquí verás lo que suena y lo que viene después.": "Here you'll see what's playing and what's next.",
  "Siguiente de la playlist": "Next from playlist",
  "A continuación": "Next up",
  "En la cola": "In the queue",
  "Sobre el artista": "About the artist",
  "Repitiendo esta canción.": "Repeating this song.",
  "No hay más canciones en la cola.": "No more songs in the queue.",
  "En orden": "In order",
  "Bucle": "Loop",
  "Bucle de una canción": "Loop one song",
  "Añadir a la cola": "Add to queue",
  "Ir a la canción": "Go to song",
  "Ir al artista": "Go to artist",
  "Canción": "Song",
  "Enlace copiado": "Link copied",
  "Compartir": "Share",
  "Fijar arriba": "Pin to top",
  "Quitar de fijadas": "Unpin",
  "Fijada": "Pinned",
  "Borrar playlist": "Delete playlist",
  "Subir en la cola": "Move up in queue",
  "Bajar en la cola": "Move down in queue",
  "Reproducir a continuación": "Play next",
  "Sonará a continuación": "It will play next",
  "Copia el enlace:": "Copy the link:",
  "Acerca de": "About",
  "Biografía": "Biography",
  "Biografía del artista": "Artist biography",
  "Buscando la letra…": "Looking for the lyrics…",
  "Buscando…": "Searching…",
  "Buscar foto y biografía en internet": "Find photo and biography online",
  "Buscar letras que falten en internet (LRCLIB). Solo se envían título, artista, álbum y duración": "Look up missing lyrics online (LRCLIB). Only title, artist, album and duration are sent",
  "Cerrar": "Close",
  "Discografía": "Discography",
  "Este artista está en tu papelera: no sonará en tus colas.": "This artist is in your trash: it won't play in your queues.",
  "Foto guardada": "Photo saved",
  "Ir a este punto": "Jump to this point",
  "La papelera está vacía.": "The trash is empty.",
  "Letra": "Lyrics",
  "Lo que pones aquí solo lo dejas de oír tú: se salta al reproducir, pero no se borra del servidor.": "Only you stop hearing what you put here: it is skipped on playback, but not deleted from the server.",
  "Mover a la papelera": "Move to trash",
  "Movido a la papelera": "Moved to trash",
  "No hay letra para esta canción.": "No lyrics for this song.",
  "No se ha podido buscar la letra (sin conexión).": "Couldn't look up the lyrics (offline).",
  "Papelera": "Trash",
  "Papelera vaciada": "Trash emptied",
  "Perfil actualizado": "Profile updated",
  "Populares": "Popular",
  "Quitar foto": "Remove photo",
  "Restaurado": "Restored",
  "Restaurar": "Restore",
  "Restaurar de la papelera": "Restore from trash",
  "Restaurar todo": "Restore all",
  "Subir foto": "Upload photo",
  "Todo lo que había está en tu papelera": "Everything here is in your trash",
  "oyente": "listener",
  "oyentes": "listeners",
  "No se ha encontrado nada nuevo.": "Nothing new found.",
  "Menú": "Menu",
  "Ahora colaboras en «{name}»": "You now collaborate on “{name}”",
  "Amigos": "Friends",
  "Busca un usuario para invitarlo": "Search for a user to invite",
  "Cargando…": "Loading…",
  "Colaborador": "Collaborator",
  "Colaboradores": "Collaborators",
  "Dueño": "Owner",
  "Invitación enviada a {user}": "Invitation sent to {user}",
  "Invitación pendiente": "Invitation pending",
  "Invitación rechazada": "Invitation declined",
  "Invitar": "Invite",
  "Los colaboradores pueden añadir y quitar canciones. El nombre, la foto y la visibilidad solo los cambia el dueño.": "Collaborators can add and remove songs. Only the owner can change the name, photo and visibility.",
  "Marcar todo como leído": "Mark all as read",
  "No se han podido cargar los colaboradores.": "Couldn't load the collaborators.",
  "No tienes notificaciones.": "You have no notifications.",
  "Notificaciones": "Notifications",
  "Playlist colaborativa": "Collaborative playlist",
  "Quitar": "Remove",
  "Rechazar": "Decline",
  "Salir de la playlist": "Leave playlist",
  "Seguir también": "Follow back",
  "Sin resultados.": "No results.",
  "Te sigue": "Follows you",
  "Tus amigos": "Your friends",
  "Vaciar": "Clear",
  "Ya sois amigos": "You're friends now",
  "{artist} tiene música nueva en {album}": "{artist} has new music in {album}",
  "{artist} tiene un álbum nuevo: {album}": "{artist} has a new album: {album}",
  "{user} ha aceptado colaborar en {name}": "{user} accepted to collaborate on {name}",
  "{user} ha empezado a seguirte": "{user} started following you",
  "{user} ha publicado la playlist {name}": "{user} published the playlist {name}",
  "{user} te ha invitado a colaborar en esta playlist.": "{user} invited you to collaborate on this playlist.",
  "{user} te invita a colaborar en la playlist {name}": "{user} invites you to collaborate on the playlist {name}",
  "Abrir la playlist": "Open the playlist",
  "Una canción por línea: Artista - Título": "One song per line: Artist - Title",
  "Automática": "Automatic",
  "Buscar de nuevo": "Search again",
  "Buscar las letras que faltan": "Find missing lyrics",
  "Buscar letras que falten en internet (LRCLIB y NetEase). Solo se envían título, artista, álbum y duración": "Look up missing lyrics online (LRCLIB and NetEase). Only title, artist, album and duration are sent",
  "Contraer la biblioteca": "Collapse the library",
  "Desvincular": "Unlink",
  "Enlace": "Link",
  "Enlace de la playlist": "Playlist link",
  "Expandir la biblioteca": "Expand the library",
  "Fuente": "Source",
  "Funciona con enlaces de Spotify, YouTube, SoundCloud y Deezer. Solo se lee la lista y se busca cada canción entre la música de tu servidor; no se descarga nada.": "Works with Spotify, YouTube, SoundCloud and Deezer links. Only the list is read and each song is looked up in your server's music; nothing is downloaded.",
  "Horas entre sincronizaciones": "Hours between syncs",
  "Importando…": "Importing…",
  "Importar": "Import",
  "Importar playlist": "Import playlist",
  "La playlist queda vinculada a {source}: cuando aparezcan canciones nuevas allí o en tu servidor, se añadirán solas.": "The playlist stays linked to {source}: when new songs show up there or on your server, they are added automatically.",
  "Letra de la canción": "Song lyrics",
  "Leyendo la playlist y buscando tus canciones. Puede tardar un poco…": "Reading the playlist and looking for your songs. This may take a moment…",
  "Mejorar a sincronizadas": "Upgrade to synced",
  "Nombre (opcional)": "Name (optional)",
  "Pega un enlace o una lista de canciones.": "Paste a link or a list of songs.",
  "Pega una letra con tiempos (formato LRC) o solo texto. Se guarda para todos los usuarios. Si lo dejas vacío se vuelve a buscar sola.": "Paste lyrics with timestamps (LRC format) or plain text. It's saved for all users. If you leave it empty, it will be searched again automatically.",
  "Pegar letra": "Paste lyrics",
  "Playlist vacía": "Empty playlist",
  "Si la letra va adelantada o atrasada, ajústala aquí (se guarda en este dispositivo)": "If the lyrics run early or late, adjust them here (saved on this device)",
  "Sincronizando…": "Syncing…",
  "Sincronizar ahora": "Sync now",
  "Sincronizar las playlists vinculadas cada": "Sync linked playlists every",
  "Terminado": "Finished",
  "Todo al día": "Everything is up to date",
  "Vinculada a {source}": "Linked to {source}",
  "Vuelve a buscar, en las que solo tienen texto, una versión sincronizada": "Searches again, for those with text only, for a synced version",
  "horas (0 = nunca)": "hours (0 = never)",
  "nunca": "never",
  "o simplemente el texto, una línea por verso": "or just the text, one line per verse",
  "sin letra": "no lyrics",
  "sin sincronizar": "not synced",
  "sincronizadas": "synced",
  "solo texto": "text only",
  "{matched} de {total} canciones están en tu servidor": "{matched} of {total} songs are on your server",
  "{matched} de {total} en tu servidor": "{matched} of {total} on your server",
  "{n} canciones añadidas": "{n} songs added",
  "{n} canciones que no están en el servidor": "{n} songs that aren't on the server",
  "¿Desvincular? La playlist se queda como está, pero ya no se actualizará sola.": "Unlink? The playlist stays as it is but will no longer update itself.",
  "última sincronización: {when}": "last sync: {when}",
  "…o pega la lista de canciones": "…or paste the song list",
  "Archivo .lrc": ".lrc file",
  "Etiquetas del archivo": "File tags",
  "Letra subida": "Uploaded lyrics",
  "Archivo CSV": "CSV file",
  "El archivo es demasiado grande (máximo 7 MB).": "The file is too large (max 7 MB).",
  "{file}: {n} líneas cargadas": "{file}: {n} lines loaded",
  "No se ha podido leer el archivo.": "Couldn't read the file.",
  "…o sube un archivo CSV (por ejemplo el de Exportify) o de texto": "…or upload a CSV file (e.g. Exportify's) or a text file",
  "se muestran las primeras {n}": "showing the first {n}",
  "Dirección de redirección": "Redirect address",
  "Iniciar sesión con Spotify (importar playlists de más de 100 canciones)": "Log in with Spotify (import playlists of more than 100 songs)",
  "Crea una app en developer.spotify.com/dashboard, añade abajo la misma dirección como Redirect URI y pega su Client ID. La dirección debe ser https (por ejemplo la de Tailscale Serve) y terminar en /spotify-callback.": "Create an app at developer.spotify.com/dashboard, add the same address below as its Redirect URI and paste its Client ID. The address must be https (e.g. your Tailscale Serve one) and end in /spotify-callback.",
  "Para importar playlists de Spotify de más de 100 canciones, el administrador debe configurar el inicio de sesión de Spotify en Administración.": "To import Spotify playlists of more than 100 songs, the administrator must set up Spotify login in Administration.",
  "Desconectar": "Disconnect",
  "Spotify conectado: se leen enteras tus playlists (y las que compartes con otros).": "Spotify connected: your playlists (and ones you share with others) are read in full.",
  "Conectar Spotify": "Connect Spotify",
  "Dirección de vuelta de Spotify": "Address Spotify returned to",
  "Usar": "Use",
  "Spotify conectado": "Spotify connected",
  "Spotify solo deja leer sin sesión las primeras 100 canciones.": "Without logging in, Spotify only lets us read the first 100 songs.",
  "Si al volver la página no carga, pega aquí la dirección": "If the page doesn't load on return, paste the address here",
  "Fondo": "Background",
  "Paneles": "Panels",
  "Tarjetas": "Cards",
  "Líneas": "Lines",
  "Texto": "Text",
  "Texto apagado": "Muted text",
  "Acento": "Accent",
  "Medianoche": "Midnight",
  "Bosque": "Forest",
  "Atardecer": "Sunset",
  "Claro": "Light",
  "Arrástralo donde quieras": "Drag it anywhere",
  "Ese código no es válido.": "That code isn't valid.",
  "Personalizar": "Customize",
  "Tipo de fondo": "Background type",
  "Color liso": "Solid color",
  "Degradado": "Gradient",
  "Imagen o GIF": "Image or GIF",
  "Color 1": "Color 1",
  "Color 2": "Color 2",
  "Ángulo": "Angle",
  "Subir imagen o GIF": "Upload image or GIF",
  "Pesa demasiado (máximo 15 MB).": "Too large (15 MB max).",
  "Tu navegador no deja guardar la imagen.": "Your browser won't let us store the image.",
  "O una dirección de imagen": "Or an image address",
  "La dirección debe empezar por http:// o https://": "The address must start with http:// or https://",
  "Brillo": "Brightness",
  "Desenfoque": "Blur",
  "Barra de tiempo": "Time bar",
  "Barra normal": "Normal bar",
  "Onda de sonido": "Sound wave",
  "Tu código": "Your code",
  "Pega un código": "Paste a code",
  "Colores": "Colors",
  "La imagen subida se queda solo en este navegador.": "The uploaded image stays in this browser only.",
  "Reproductor": "Player",
  "Barra de tiempo arriba del reproductor, a lo ancho": "Time bar on top of the player, full width",
  "La barra del reproductor se ilumina según avanza la canción": "The player bar lights up as the song advances",
  "La onda es una forma decorativa generada a partir de la canción; no es el audio real.": "The wave is a decorative shape generated from the song; it isn't the real audio.",
  "Disposición": "Layout",
  "Ancho de la biblioteca": "Library width",
  "Widgets": "Widgets",
  "Reloj": "Clock",
  "Ahora suena": "Now playing",
  "Arrástralos con el ratón o el dedo hasta donde quieras. En el móvil no se muestran.": "Drag them with the mouse or your finger wherever you like. They aren't shown on mobile.",
  "Generar código": "Generate code",
  "Código copiado": "Code copied",
  "La imagen subida no va dentro del código; el resto sí. Usa una dirección de imagen si quieres compartir el fondo.": "The uploaded image isn't included in the code; everything else is. Use an image address if you want to share the background.",
  "Aplicar código": "Apply code",
  "Aplicado.": "Applied.",
  "Restablecer todo": "Reset everything",
  "Listo": "Done",
  "Este usuario no muestra esa lista.": "This user doesn't show that list.",
  "Seguidores de {name}": "{name}'s followers",
  "Seguidos por {name}": "Followed by {name}",
  "Nadie por aquí todavía.": "Nobody here yet.",
  "Lista": "List",
  "Portada pequeña a la izquierda, con el nombre y el autor al lado.": "Small cover on the left, with the name and author beside it.",
  "Suavidad de las animaciones": "Animation smoothness",
  "Animaciones": "Animations",
  "Suavidad": "Smoothness",
  "Controla lo suaves y lentas que son las animaciones (la letra que sube desde abajo, la portada que gira al pasar el ratón por una canción...). Con 0 no hay ninguna.": "Controls how smooth and slow the animations are (lyrics sliding up from the bottom, the cover that turns when you hover a song...). At 0 there are none.",
  "Privacidad": "Privacy",
  "Qué pueden ver los demás en tu perfil. Los números de seguidores y seguidos siempre se ven.": "What others can see on your profile. The follower and following counts are always visible.",
  "Mostrar la lista de quién me sigue": "Show the list of who follows me",
  "Mostrar la lista de a quién sigo": "Show the list of who I follow"
};
const T = (text, vars) => {
  let out = LANG === "en" && EN[text] !== undefined ? EN[text] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
};
const PL = {
  album: { es: ["álbum", "álbumes"], en: ["album", "albums"] },
  song: { es: ["canción", "canciones"], en: ["song", "songs"] },
  distinct: { es: ["canción distinta", "canciones distintas"], en: ["different song", "different songs"] },
  play: { es: ["reproducción", "reproducciones"], en: ["play", "plays"] },
  artist: { es: ["artista", "artistas"], en: ["artist", "artists"] },
};
const nf = new Intl.NumberFormat(LOCALE);
// Nombres que pone el servidor cuando faltan los tags: se muestran en tu idioma.
const nm = (name) => {
  if (name === "Unknown Artist" || name === "Artista desconocido") return T("Artista desconocido");
  if (name === "Unknown Album" || name === "Album desconocido" || name === "Álbum desconocido") return T("Álbum desconocido");
  return name;
};


/* ---------- utilidades ---------- */

// replaceChildren/append escribirian la palabra "null" si algun hijo es null; se descartan aqui para todo el programa.
for (const name of ["replaceChildren", "append", "prepend"]) {
  const orig = Element.prototype[name];
  Element.prototype[name] = function (...kids) { return orig.apply(this, kids.filter((k) => k !== null && k !== undefined && k !== false)); };
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}


const SVG_NS = "http://www.w3.org/2000/svg";
// Iconos rellenos (reproductor)
const ICONS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  prev: "M6 6h2v12H6zM20 6v12L9.5 12z",
  next: "M16 6h2v12h-2zM4 6v12l10.5-6z",
  queue: "M3 6h13v2H3zM3 11h13v2H3zM3 16h9v2H3zM18 12v7l5-3.5z",
  volume: "M3 10v4h4l5 4V6L7 10zM16 8.5a5 5 0 010 7l-1.4-1.4a3 3 0 000-4.2z",
};
// Iconos de línea, minimalistas (menú y botones)
const LINE_ICONS = {
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20",
  home: "M3.5 11 12 3.8 20.5 11M5.8 9.6V20h4.4v-5.6h3.6V20h4.4V9.6",
  radio: "M4 9h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1zM7 9l11-5M9 14.5m-2.2 0a2.2 2.2 0 104.4 0a2.2 2.2 0 10-4.4 0M15 13.5h3.5M15 16.5h3.5",
  wrapped: "M5 20v-7M12 20V5M19 20v-10",
  plus: "M12 5v14M5 12h14",
  heart: "M12 20.3S4.2 15.7 3 11.2C2.2 8.2 4.1 5.6 6.9 5.6c1.9 0 3.4 1 5.1 3 1.7-2 3.2-3 5.1-3 2.8 0 4.7 2.6 3.9 5.6C19.8 15.7 12 20.3 12 20.3z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  library: "M5 4v16M10 4v16M15.2 5.5l4.3 14",
  chevron: "M9.5 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  bell: "M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0",
  send: "M3 11.5L21 3l-8.5 18-2.2-7.3L3 11.5zM10.3 13.7L21 3",
  devices: "M3 5.5h13v9H3zM7 18.5h5M9.5 14.5v4M18 8.5h3v11h-3z",
  chat: "M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1h-9l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6M16 4.5a3.5 3.5 0 010 6.5M18.5 14.5c1.9.8 3 2.8 3 5.5",
  user: "M12 12.2a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.6-3.6 3.6-5.6 7.5-5.6s6.9 2 7.5 5.6",
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 7m-2 0a2 2 0 104 0a2 2 0 10-4 0M9 17m-2 0a2 2 0 104 0a2 2 0 10-4 0",
  shield: "M12 3.5l7 2.6v5.4c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6.1z",
  log: "M6 4h12v16H6zM9 9h6M9 13h6M9 17h3",
  out: "M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9.5",
  "mode-normal": "M4 12h12M12 7.5l4.5 4.5-4.5 4.5M20 6.5v11",
  "mode-loop": "M17 3.5l3 3-3 3M4.5 11V9.5a3 3 0 013-3H20M7 20.5l-3-3 3-3M19.5 13v1.5a3 3 0 01-3 3H4",
  "mode-one": "M17 3.5l3 3-3 3M4.5 11V9.5a3 3 0 013-3H20M7 20.5l-3-3 3-3M19.5 13v1.5a3 3 0 01-3 3H4M11 10.2l1.6-1v6.3",
  "mode-shuffle": "M16 3.5h4.5V8M3.5 20.5L20.5 3.5M20.5 16v4.5H16M14.5 14.5l6 6M3.5 3.5L9 9",
  share: "M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6.5h14V13",
  pin: "M9 4h6l-1 6 3 3v1.5H7V13l3-3zM12 14.5V20.5",
  mic: "M12 14.5a3 3 0 003-3V6a3 3 0 00-6 0v5.5a3 3 0 003 3zM6.5 11.5a5.5 5.5 0 0011 0M12 17v3.5M9 20.5h6",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4l.8-12.5M10 10.5v6M14 10.5v6",
  palette: "M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 003.5-3.5C20.5 6.7 16.8 3.5 12 3.5zM7.5 12h.01M9.5 8h.01M14.5 8h.01",
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5m-3.2 0a3.2 3.2 0 106.4 0a3.2 3.2 0 10-6.4 0",
};
function icon(name, size = 20) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  if (ICONS[name]) {
    svg.setAttribute("fill", "currentColor");
    path.setAttribute("d", ICONS[name]);
  } else {
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", name === "more" ? "3" : "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", LINE_ICONS[name]);
  }
  svg.append(path);
  return svg;
}


const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtTotal = (s) => {
  const m = Math.round((s || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
const plural = (n, key) => `${nf.format(n)} ${PL[key][LANG][n === 1 ? 0 : 1]}`;

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


function toast(message, href) {
  const el = h("div", { class: "toast", role: "status" }, href ? h("a", { href, onclick: () => el.remove() }, message) : message);
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
const showError = (e) => toast(e && e.message ? e.message : String(e));


const shareLink = (kind, id) => `${location.origin}/#/${kind}/${encodeURIComponent(id)}`;
async function shareItem(kind, id) { await copyText(shareLink(kind, id), T("Enlace copiado")); }
const shareBtn = (kind, id, name) => h("button", { class: "icon-btn", type: "button", title: T("Compartir"), "aria-label": T("Compartir"), dataset: { menuOwner: "1" },
  onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); shareMenu(r.left, r.bottom + 4, kind, id, name); } }, icon("share", 22));

function copyFallback(text) {
  const area = h("textarea", { readonly: true, style: { position: "fixed", top: "0", left: "0", opacity: "0" } });
  area.value = text;
  document.body.append(area);
  area.focus();
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  area.remove();
  return ok;
}
async function copyText(text, done) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
  } catch (e) { ok = false; }
  if (!ok) ok = copyFallback(text);
  if (ok) toast(done || T("Copiado"));
  else window.prompt(T("Copia el enlace:"), text);          // último recurso: se muestra para copiarlo a mano
}

/* ---------- estado y acceso al servidor ---------- */

const state = { user: null, apiKey: "", signup: "closed" };

// API Subsonic (/rest/...). Con la sesión de la web no hace falta usuario ni contraseña.
async function api(name, params = {}, post = false) {
  const query = new URLSearchParams({ f: "json" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) query.set(k, v);
  const res = await fetch(post ? `/rest/${name}` : `/rest/${name}?${query}`,
    post ? { method: "POST", body: query, headers: { "X-Lang": LANG } } : { headers: { "X-Lang": LANG } });
  let body;
  try { body = await res.json(); } catch (e) { throw new Error(`Error ${res.status}`); }
  const r = body["subsonic-response"];
  if (!r || r.status !== "ok") {
    const err = new Error((r && r.error && r.error.message) || `Error ${res.status}`);
    err.code = r && r.error && r.error.code;
    if ((err.code === 10 || err.code === 40) && state.user) sessionExpired();
    throw err;
  }
  return r;
}

// Rutas propias de la web (/web/...): cuentas y administración.
async function web(path, body) {
  const res = await fetch(`/web/${path}`, body === undefined ? { headers: { "X-Lang": LANG } } : {
    method: "POST", headers: { "Content-Type": "application/json", "X-Lang": LANG }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { "X-Lang": LANG } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.user) sessionExpired();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function sessionExpired() {
  if (!state.user) return;
  state.user = null;
  stopPlayback();
  renderAuth(T("Tu sesión ha caducado. Entra de nuevo."));
}


/* ---------- portadas ---------- */

const coverUrl = (id, size = 300, v) => `/rest/getCoverArt?id=${encodeURIComponent(id)}&size=${size}${v ? `&v=${v}` : ""}`;

function coverEl(id, name, size = 300, extra = "", v) {
  const box = h("div", { class: `cover ${extra}`.trim(), dataset: { initial: (name || "?").trim().charAt(0).toUpperCase() } });
  if (id) {
    const img = h("img", { src: coverUrl(id, size, v), alt: "", loading: "lazy" });
    img.addEventListener("error", () => img.remove());   // sin portada: se queda la inicial
    box.append(img);
  }
  return box;
}

// Foto de perfil: la imagen si la hay, y si no la inicial del nombre.
function avatarEl(user, extra = "") {
  const name = user.displayName || user.username || "?";
  const box = h("span", { class: `avatar ${extra}`.trim(), dataset: { initial: name.trim().charAt(0).toUpperCase() } });
  if (user.avatar) {
    const img = h("img", { src: `/img/avatar/${encodeURIComponent(user.username)}?v=${user.avatar}`, alt: "" });
    img.addEventListener("error", () => img.remove());
    box.append(img);
  }
  return box;
}

// Elige una foto del dispositivo (cualquier formato de imagen, GIF incluido, hasta 20 MB) y devuelve el File.
// El recorte cuadrado lo hace el servidor, asi que funciona con cualquier formato que ffmpeg lea.
function pickImage() {
  return new Promise((resolve, reject) => {
    const input = h("input", { type: "file", accept: "image/*,.gif,.webp,.avif,.heic,.bmp,.tiff", hidden: true });
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      if (file.size > 20 * 1024 * 1024) return reject(new Error(T("La imagen pesa más de 20 MB")));
      resolve(file);
    });
    input.addEventListener("cancel", () => { input.remove(); resolve(null); });
    document.body.append(input);
    input.click();
  });
}

async function uploadImage(path, file) {
  const res = await fetch(`/web/upload/${path}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Lang": LANG }, body: file });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 413 ? T("La imagen pesa más de 20 MB") : (data.error || `Error ${res.status}`));
  return data;
}


/* ---------- reproductor ----------
   Hay dos elementos de audio: uno para la música (la que pasa por el normalizador de volumen) y otro para
   las radios (vienen de otras webs y no se pueden pasar por el normalizador). */

const musicAudio = new Audio();
const musicAudio2 = new Audio();
const radioAudio = new Audio();
musicAudio.preload = "auto";
musicAudio2.preload = "auto";
const MUSIC = [musicAudio, musicAudio2];
radioAudio.preload = "none";
let audio = musicAudio;
/* ---------- papelera: lo que está aquí se salta al reproducir ---------- */
const trash = { song: new Set(), album: new Set(), artist: new Set(), items: [] };
async function loadTrash() {
  try {
    const r = await web("trash", {});
    trash.song = new Set(r.ids.song); trash.album = new Set(r.ids.album); trash.artist = new Set(r.ids.artist); trash.items = r.items;
  } catch (e) { /* se queda lo anterior */ }
}
const isTrashed = (t) => !!t && !t.radio && (trash.song.has(t.id) || trash.album.has(t.albumId) || trash.artist.has(t.artistId)
  || (t.artists || []).some((x) => trash.artist.has(x.id)));
async function setTrashed(kind, id, on) {
  try {
    await web(on ? "trash/add" : "trash/remove", { kind, id });
    await loadTrash();
    toast(on ? T("Movido a la papelera") : T("Restaurado"));
    render();
    drawQueue();
  } catch (e) { showError(e); }
}

const MODES = ["normal", "loop", "one", "shuffle"];
const player = { queue: [], index: -1, current: null, fromPending: false, pending: [], mode: "normal", order: [], pos: 0,
  history: [], scrobbled: false, ui: null, dragging: false, ctx: null };
try { const m = localStorage.getItem("zinctify.mode"); if (MODES.includes(m)) player.mode = m; } catch (e) { /* ignorar */ }
const prefs = () => (state.user && state.user.prefs) || {};
const QUALITY_KBPS = { high: 320, normal: 160, low: 96 };
function streamUrl(id) {
  const kbps = QUALITY_KBPS[prefs().quality];
  return `/rest/stream?id=${encodeURIComponent(id)}${kbps ? `&maxBitRate=${kbps}&format=mp3` : ""}`;
}
// Si la web va por HTTPS y la radio por HTTP, el navegador la bloquea: se pide a través del servidor.
function radioSrc(t) {
  return location.protocol === "https:" && /^http:/i.test(t.url || "") ? `/rest/radioStream?id=${encodeURIComponent(t.id)}` : t.url;
}
const currentTrack = () => player.current;

/* Normalización: sube o baja cada canción hasta el volumen objetivo (en LUFS) según lo que mide el servidor.
   Un limitador evita que al subir una canción suave se distorsionen los picos. */
const norm = { ctx: null, gain: null, comp: null };
function ensureNorm() {
  if (norm.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    norm.ctx = new AC();
    norm.gains = new Map();
    norm.comp = norm.ctx.createDynamicsCompressor();
    norm.comp.knee.value = 0;
    norm.comp.ratio.value = 20;
    norm.comp.attack.value = 0.003;
    norm.comp.release.value = 0.15;
    norm.comp.threshold.value = 0;
    norm.comp.connect(norm.ctx.destination);
    for (const el of MUSIC) {                       // cada reproductor tiene su propia ganancia (para el crossfade)
      const src = norm.ctx.createMediaElementSource(el), g = norm.ctx.createGain();
      src.connect(g); g.connect(norm.comp); norm.gains.set(el, g);
    }
    return true;
  } catch (e) { norm.ctx = null; return false; }
}
function applyRadiosPref() { document.body.classList.toggle("show-radios", state.radiosOn === true); }
function applyAnim() {
  const lvl = Math.max(0, Math.min(100, Number(prefs().animLevel ?? 50)));
  document.documentElement.style.setProperty("--anim", `${Math.round(lvl * 9)}ms`);
  document.body.classList.toggle("no-anim", lvl === 0);
}
function applyNorm() {
  const t = currentTrack();
  const want = !!(prefs().normalize && t && !t.radio && typeof t.loudnessLufs === "number");
  if (!want && !norm.ctx) return;
  if (!ensureNorm()) return;
  const target = Number(prefs().normTarget) || -14;
  const g = norm.gains.get(audio);
  if (g) g.gain.value = want ? Math.min(4, Math.max(0.1, Math.pow(10, (target - t.loudnessLufs) / 20))) : 1;
  norm.comp.threshold.value = want ? -2 : 0;
  if (norm.ctx.state === "suspended") norm.ctx.resume().catch(() => {});
}

/* Cola: "queue" es la lista que estás escuchando (playlist, álbum...), "index" dónde va, y "pending" lo que has
   añadido con «Añadir a la cola»: suena justo después de la canción actual y luego sigue la lista como si nada. */
function shuffleOrder(first) {
  const rest = player.queue.map((_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [rest[i], rest[k]] = [rest[k], rest[i]]; }
  player.order = first == null || first < 0 ? rest : [first, ...rest];
  player.pos = 0;
}

function playQueue(tracks, start = 0, ctx = null, opts = {}) {
  if (room.active && !room.applying && ctx && ctx.kind === "playlist" && !opts.single && tracks.length > 1) { roomAskPropose(ctx.id, tracks.length); return; }
  if (room.active && !room.applying) {
    // En una sala, «reproducir» no corta lo que suena: la canción (o la lista entera si le das a Reproducir en un álbum/playlist) va al final de la cola de la sala.
    const pick = tracks.length === 1 ? [tracks[start] || tracks[0]] : (opts.single ? [tracks[start]] : tracks);
    const real = pick.filter((t) => t && !t.radio);
    if (!real.length) { toast(T("Las radios no se pueden escuchar en una sala")); return; }
    roomAdd(real);
    return;
  }
  if (tracks.length > 1 && isTrashed(tracks[start])) {            // empieza por la primera que no esté en la papelera
    let k = start;
    while (k < tracks.length && isTrashed(tracks[k])) k++;
    if (k >= tracks.length) { k = 0; while (k < start && isTrashed(tracks[k])) k++; }
    if (isTrashed(tracks[k])) { toast(T("Todo lo que había está en tu papelera")); return; }
    start = k;
  }
  player.queue = tracks.slice();
  player.index = start;
  player.current = player.queue[start] || null;
  player.fromPending = false;
  player.history = [];
  player.ctx = ctx;
  if (player.mode === "shuffle") shuffleOrder(start);
  if (ctx) libraryTouch(ctx);
  loadCurrent();
}

function addToQueue(tracks) {
  const list = tracks.filter(Boolean);
  if (!list.length) return;
  if (room.active) {
    const real = list.filter((t) => !t.radio);
    if (!real.length) toast(T("Las radios no se pueden escuchar en una sala")); else roomAdd(real);
    return;
  }
  if (!player.current) { playQueue(list, 0); return; }
  player.pending.push(...list);
  drawQueue();
  toast(list.length === 1 ? T("Añadida a la cola: «{title}»", { title: list[0].title }) : T("{n} canciones añadidas a la cola", { n: list.length }));
}

/* Crossfade: unos segundos antes de que acabe la canción, la siguiente empieza en el otro reproductor
   mientras la actual baja de volumen. Se ajusta en Ajustes (0 = apagado). */
const xf = { pending: false, out: null, inEl: null, raf: 0, t0: 0, dur: 0, armedFor: null };
const xfSeconds = () => Math.max(0, Math.min(12, Number(prefs().crossfade) || 0));
const userVol = () => (player.ui && player.ui.vol ? player.ui.vol.value / 100 : 1);
function startFade(out, inEl) {
  xf.out = out; xf.inEl = inEl; xf.t0 = performance.now(); xf.dur = Math.max(1, xfSeconds()) * 1000;
  const step = (now) => {
    const k = Math.min(1, (now - xf.t0) / xf.dur), v = userVol();
    out.volume = Math.max(0, Math.min(1, v * Math.cos(k * Math.PI / 2)));          // potencia constante: no hay bajón de volumen en medio
    inEl.volume = Math.max(0, Math.min(1, v * Math.sin(k * Math.PI / 2)));
    if (k < 1) xf.raf = requestAnimationFrame(step); else finishFade();
  };
  inEl.volume = 0;
  xf.raf = requestAnimationFrame(step);
}
function finishFade() {
  if (xf.raf) cancelAnimationFrame(xf.raf);
  xf.raf = 0;
  if (xf.out) { xf.out.pause(); xf.out.removeAttribute("src"); xf.out.load(); }
  const v = userVol();
  for (const el of MUSIC) el.volume = v;
  xf.out = null; xf.inEl = null;
}
function maybeCrossfade() {
  const secs = xfSeconds();
  const t = currentTrack();
  if (!secs || !t || t.radio || room.active || player.mode === "one" || xf.out || audio.paused) return;
  const dur = audio.duration, left = dur - audio.currentTime;
  if (!isFinite(dur) || dur < secs * 3 || left > secs || left < 0.3 || xf.armedFor === t) return;
  if (!player.pending.length && contextNext(true) === -1) return;      // no hay siguiente: que termine normal
  xf.armedFor = t;
  xf.pending = true;
  next(true);
}

function loadCurrent() {
  const t = currentTrack();
  if (!t) return;
  setTimeout(markLibraryPlaying, 0);
  finishFade();
  let el;
  if (t.radio) el = radioAudio;
  else if (xf.pending && MUSIC.includes(audio)) el = audio === musicAudio ? musicAudio2 : musicAudio;     // crossfade: el nuevo suena en el otro reproductor
  else el = MUSIC.includes(audio) ? audio : musicAudio;
  if (el !== audio) {
    if (xf.pending && MUSIC.includes(audio) && !audio.paused) startFade(audio, el); else audio.pause();
    audio = el;
  }
  xf.pending = false;
  xf.armedFor = null;
  player.scrobbled = false;
  if (!t.radio && offline.has.has(t.id)) {
    const el0 = audio;
    offlineBlobUrl(t.id).then((url) => {
      if (el0 !== audio || player.current !== t) return;
      audio.src = url || streamUrl(t.id);
      applyNorm();
      audio.play().catch(() => {});
    }).catch(() => { if (el0 === audio && player.current === t) { audio.src = streamUrl(t.id); audio.play().catch(() => {}); } });
  } else {
    audio.src = t.radio ? radioSrc(t) : streamUrl(t.id);
    applyNorm();
    audio.play().catch(() => {});
  }
  refreshPlayer();
  setMediaSession(t);
}

// Siguiente posición de la lista (sin tocar nada): índice, o -1 si se acaba.
function contextNext(peek) {
  const n = player.queue.length;
  if (!n) return -1;
  if (player.mode === "shuffle") {
    if (player.pos + 1 < player.order.length) return player.order[player.pos + 1];
    if (peek) return -2;                                    // se volverá a mezclar
    const last = player.order[player.pos];
    shuffleOrder(null);
    if (n > 1 && player.order[0] === last) { const k = 1 + Math.floor(Math.random() * (n - 1)); [player.order[0], player.order[k]] = [player.order[k], player.order[0]]; }
    player.pos = -1;
    return player.order[0];
  }
  if (player.index + 1 < n) return player.index + 1;
  return player.mode === "normal" ? -1 : 0;                 // bucle: vuelve a empezar
}

function snapshot() { return { track: player.current, index: player.index, pos: player.pos, fromPending: player.fromPending }; }

function next(auto = false) {
  if (dev.remote) { devCommand("next"); return; }
  if (room.active) { roomSend("next", { from: room.index }); return; }
  if (auto && player.mode === "one" && player.current && !isTrashed(player.current)) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  for (let guard = 0; guard < 1000; guard++) {                    // salta lo que esté en la papelera
    if (player.pending.length) {
      player.history.push(snapshot());
      player.current = player.pending.shift();
      player.fromPending = true;
      if (isTrashed(player.current)) continue;
      loadCurrent();
      return;
    }
    const idx = contextNext(false);
    if (idx < 0) { audio.pause(); return; }
    player.history.push(snapshot());
    player.index = idx;
    if (player.mode === "shuffle") player.pos++;
    player.current = player.queue[idx];
    player.fromPending = false;
    if (isTrashed(player.current)) continue;
    loadCurrent();
    return;
  }
  audio.pause();
}
function prev() {
  if (dev.remote) { devCommand("prev"); return; }
  if (room.active) { roomSend("prev", { pos: audio.currentTime || 0 }); return; }
  if (audio.currentTime > 3 || !player.history.length) { audio.currentTime = 0; return; }
  let s = player.history.pop();
  while (s && isTrashed(s.track) && player.history.length) s = player.history.pop();
  if (!s) { audio.currentTime = 0; return; }
  player.current = s.track; player.index = s.index; player.pos = s.pos; player.fromPending = s.fromPending;
  loadCurrent();
}
function cycleMode() {
  if (room.active) {                                       // en una sala este botón mezcla lo que queda de la cola de la sala
    if (roomCan("move")) roomSend("shuffle"); else toast(T("El anfitrión no te ha dado permiso para hacer esto"));
    return;
  }
  player.mode = MODES[(MODES.indexOf(player.mode) + 1) % MODES.length];
  try { localStorage.setItem("zinctify.mode", player.mode); } catch (e) { /* ignorar */ }
  if (player.mode === "shuffle" && player.queue.length) shuffleOrder(player.fromPending ? null : player.index);
  if (player.mode === "shuffle" && player.fromPending) player.pos = -1;
  refreshMode();
  drawQueue();
}
const MODE_LABEL = { normal: "En orden", loop: "Bucle", one: "Bucle de una canción", shuffle: "Aleatorio" };
function refreshMode() {
  const ui = player.ui;
  if (!ui) return;
  if (room.active) {
    ui.mode.replaceChildren(icon("mode-shuffle", 20));
    ui.mode.title = ui.mode.ariaLabel = T("Mezclar la cola de la sala");
    ui.mode.classList.remove("on");
    ui.mode.classList.toggle("disabled", !roomCan("move"));
    return;
  }
  ui.mode.classList.remove("disabled");
  ui.mode.replaceChildren(icon(`mode-${player.mode}`, 20));
  const label = T(MODE_LABEL[player.mode]);
  ui.mode.title = ui.mode.ariaLabel = label;
  ui.mode.classList.toggle("on", player.mode !== "normal");
}
function togglePlay() {
  if (dev.remote) { devCommand(dev.remote.playing ? "pause" : "play"); return; }
  if (room.active && (audio.getAttribute("src") || room.songs.length)) { roomSend(audio.paused ? "play" : "pause", { pos: audio.currentTime || 0 }); return; }
  if (!audio.getAttribute("src")) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function stopPlayback() {
  try { stopChat(); stopDevices(); } catch (e) { /* aún no existe */ }
  finishFade();
  for (const el of [musicAudio, musicAudio2, radioAudio]) { el.pause(); el.removeAttribute("src"); el.load(); }
  audio = musicAudio;
  player.queue = [];
  player.index = -1;
  player.current = null;
  player.pending = [];
  player.history = [];
  player.ui = null;
}

function maybeScrobble() {
  const t = currentTrack();
  if (!t || t.radio || player.scrobbled) return;
  const dur = t.duration || audio.duration || 0;
  const needed = dur > 0 ? Math.min(dur / 2, 240) : 30;       // la mitad de la canción o 4 minutos
  if (audio.currentTime >= needed) {
    player.scrobbled = true;
    api("scrobble", { id: t.id, time: Date.now(), submission: "true" }, true).catch(() => {});
  }
}

for (const el of [musicAudio, musicAudio2, radioAudio]) {
  el.addEventListener("timeupdate", () => {
    if (el !== audio) return;
    const ui = player.ui;
    if (ui && !player.dragging) {
      const dur = audio.duration;
      const live = !isFinite(dur);
      ui.seek.disabled = live;
      ui.seek.value = live || !dur ? 0 : Math.round((audio.currentTime / dur) * 1000);
      ui.cur.textContent = fmtTime(audio.currentTime);
      ui.dur.textContent = live ? T("en directo") : fmtTime(dur);
    }
    if (typeof updateProgressVar === "function") updateProgressVar();
    maybeScrobble();
    syncLyrics();
    maybeCrossfade();
  });
  el.addEventListener("play", () => { if (el === audio) { refreshPlayButton(); announceNow(); devClaim(); } });
  el.addEventListener("pause", () => { if (el === audio) { if (xf.out) finishFade(); refreshPlayButton(); announceNow(); if (devIsMe()) devKick(); } });
  el.addEventListener("seeked", () => { if (el === audio) { announceNow(); if (devIsMe()) devKick(); } });
  el.addEventListener("loadedmetadata", () => { if (el === audio) announceNow(); });
  el.addEventListener("ended", () => { if (el === audio) next(true); });
  el.addEventListener("error", () => {
    const t = currentTrack();
    if (el === audio && t && audio.getAttribute("src")) toast(T("No se puede reproducir «{title}»", { title: t.title }));
  });
}

function refreshPlayButton() {
  markLibraryPlaying();
  const ui = player.ui;
  if (!ui) return;
  const paused = dev.remote ? !dev.remote.playing : audio.paused;
  ui.play.replaceChildren(icon(paused ? "play" : "pause", 24));
  ui.play.setAttribute("aria-label", paused ? T("Reproducir") : T("Pausar"));
}

function markPlaying() {
  const t = currentTrack();
  document.querySelectorAll(".track").forEach((el) => el.classList.toggle("playing", !!t && el.dataset.id === t.id));
}


/* ---------- letras ----------
   La letra puede venir sincronizada (con tiempos) o como texto. Si está sincronizada, la línea que suena se
   marca y se puede pulsar cualquier línea para saltar a ese punto de la canción. */

const lyricsCache = new Map();
const lyricsBoxes = new Set();            // cajas de letra que hay ahora en pantalla
async function getLyrics(id) {
  if (!lyricsCache.has(id)) lyricsCache.set(id, web("lyrics", { id }).catch(() => ({ synced: [], plain: "", source: "none" })));
  const r = await lyricsCache.get(id);
  if (r.source === "offline") lyricsCache.delete(id);          // sin red: se reintenta la próxima vez
  return r;
}

const lyOffKey = (id) => "zinctify.lyoff." + id;
function getLyOffset(id) { try { return parseFloat(localStorage.getItem(lyOffKey(id))) || 0; } catch (e) { return 0; } }
function setLyOffset(id, v) { try { if (v) localStorage.setItem(lyOffKey(id), String(v)); else localStorage.removeItem(lyOffKey(id)); } catch (e) { /* nada */ } }
const LY_SOURCE = { lrclib: "LRCLIB", netease: "NetEase", lrc: "Archivo .lrc", tags: "Etiquetas del archivo", manual: "Letra subida" };

function lyricsBox(songId, onSeek, refresh = false) {
  const box = h("div", { class: "lyrics" });
  box.songId = songId; box.active = -1; box.lines = [];
  box.userScrolledAt = 0;
  box.offset = getLyOffset(songId);
  box.addEventListener("wheel", () => { box.userScrolledAt = Date.now(); }, { passive: true });
  box.addEventListener("touchmove", () => { box.userScrolledAt = Date.now(); }, { passive: true });
  box.append(h("p", { class: "muted ly-msg" }, T("Buscando la letra…")));
  const load = (force) => {
    if (force) lyricsCache.delete(songId);
    const p = force ? web("lyrics", { id: songId, refresh: true }).catch(() => ({ synced: [], plain: "", source: "none" })) : getLyrics(songId);
    if (force) lyricsCache.set(songId, p);
    p.then((r) => {
      if (!box.isConnected && !lyricsBoxes.has(box)) return;
      box.result = r;
      box.classList.toggle("synced", !!(r.synced && r.synced.length));
      box.times = null; box.lines = []; box.active = -1;
      if (r.synced && r.synced.length) {
        box.lines = r.synced.map((l) => {
          const el = h("button", { class: "ly-line", type: "button", title: T("Ir a este punto"), onclick: () => onSeek(l.t) }, l.text || "♪");
          if (!l.text) el.classList.add("gap");
          return el;
        });
        box.replaceChildren(...box.lines);
        box.times = r.synced.map((l) => l.t);
        syncLyrics(true);
      } else if (r.plain) {
        box.replaceChildren(...r.plain.split("\n").map((ln) => h("p", { class: "ly-plain" }, ln || " ")));
      } else {
        box.replaceChildren(h("p", { class: "muted ly-msg" }, r.source === "offline" ? T("No se ha podido buscar la letra (sin conexión).") : T("No hay letra para esta canción.")));
      }
      if (box.onresult) box.onresult(r);
    });
  };
  box.reload = load;
  load(refresh);
  lyricsBoxes.add(box);
  return box;
}

/* Barra de la letra: de dónde viene, ajuste de desfase, buscar de nuevo y (admin) pegar una letra propia. */
function lyricsTools(box) {
  const info = h("span", { class: "muted small grow" });
  const off = h("span", { class: "ly-off" });
  const drawOff = () => { off.textContent = box.offset ? `${box.offset > 0 ? "+" : ""}${box.offset.toFixed(1)} s` : "0 s"; };
  const nudge = (d) => () => { box.offset = Math.round((box.offset + d) * 10) / 10; setLyOffset(box.songId, box.offset); drawOff(); syncLyrics(true); };
  drawOff();
  box.onresult = (r) => {
    const src = LY_SOURCE[r.source];
    info.textContent = src ? `${T("Fuente")}: ${T(src)}${r.synced && r.synced.length ? "" : " · " + T("sin sincronizar")}` : "";
  };
  if (box.result) box.onresult(box.result);
  const bar = h("div", { class: "ly-tools" }, info,
    h("span", { class: "ly-offset", title: T("Si la letra va adelantada o atrasada, ajústala aquí (se guarda en este dispositivo)") },
      h("button", { class: "btn small", type: "button", onclick: nudge(-0.5) }, "−0.5"), off, h("button", { class: "btn small", type: "button", onclick: nudge(0.5) }, "+0.5")),
    h("button", { class: "btn small", type: "button", onclick: () => box.reload(true) }, T("Buscar de nuevo")),
    state.user.isAdmin ? h("button", { class: "btn small", type: "button", onclick: () => editLyrics(box) }, T("Pegar letra")) : null);
  return bar;
}

function editLyrics(box) {
  const ta = h("textarea", { rows: 14, placeholder: "[00:12.30] Primera línea\n[00:16.80] Segunda línea\n\n" + T("o simplemente el texto, una línea por verso") });
  if (box.result) ta.value = (box.result.synced && box.result.synced.length)
    ? box.result.synced.map((l) => `[${String(Math.floor(l.t / 60)).padStart(2, "0")}:${(l.t % 60).toFixed(2).padStart(5, "0")}] ${l.text}`).join("\n")
    : (box.result.plain || "");
  openModal(T("Letra de la canción"), (body, close) => {
    body.append(h("p", { class: "muted" }, T("Pega una letra con tiempos (formato LRC) o solo texto. Se guarda para todos los usuarios. Si lo dejas vacío se vuelve a buscar sola.")), ta,
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", type: "button", onclick: async () => {
          try { await web("lyrics/save", { id: box.songId, text: ta.value }); lyricsCache.delete(box.songId); if (lyricsPanel && lyricsPanel.box && lyricsPanel.box.songId === box.songId) lyricsPanelUpdate(); else box.reload(true); close(); toast(T("Guardado")); } catch (e) { showError(e); }
        } }, T("Guardar")),
        h("button", { class: "btn", type: "button", onclick: close }, T("Cancelar"))));
  });
}

/* Ventana modal sencilla (la usa la importación de playlists y el editor de letras). */
function openModal(title, build) {
  const back = h("div", { class: "modal-back", role: "presentation" });
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey, true); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const body = h("div", { class: "modal-body" });
  const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "modal-head" }, h("h2", {}, title), h("button", { class: "icon-btn", type: "button", title: T("Cerrar"), "aria-label": T("Cerrar"), onclick: close }, icon("close", 20))), body);
  back.addEventListener("pointerdown", (e) => { if (e.target === back) close(); });
  back.append(box);
  document.body.append(back);
  document.addEventListener("keydown", onKey, true);
  build(body, close);
  const first = body.querySelector("input, textarea, button");
  if (first) first.focus({ preventScroll: true });
  return close;
}

function syncLyrics(force) {
  const t = currentTrack();
  for (const box of lyricsBoxes) {
    if (!box.isConnected) { lyricsBoxes.delete(box); continue; }
    if (!box.times || !t || t.id !== box.songId) { if (box.active !== -1) { box.lines.forEach((l) => l.classList.remove("active", "past")); box.active = -1; } continue; }
    const now = audio.currentTime + 0.15 + (box.offset || 0);
    let lo = 0, hi = box.times.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (box.times[mid] <= now) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    if (idx === box.active && !force) continue;
    box.active = idx;
    box.lines.forEach((l, i) => { l.classList.toggle("active", i === idx); l.classList.toggle("past", i < idx); });
    const cur = box.lines[idx];
    if (cur && Date.now() - box.userScrolledAt > 3000) {
      const sc = box.scroller || box;
      const r = cur.getBoundingClientRect(), p = sc.getBoundingClientRect();
      sc.scrollTo({ top: sc.scrollTop + ((r.top - p.top) - p.height / 2 + r.height / 2) / Z(), behavior: force ? "auto" : "smooth" });
    }
  }
}

function seekTo(t) { if (room.active && !room.applying) { roomSend("seek", { pos: t }); return; } if (isFinite(audio.duration)) { audio.currentTime = t; if (audio.paused) audio.play().catch(() => {}); syncLyrics(true); } }

let lyricsPanel = null;
function lyricsPanelUpdate() {
  if (!lyricsPanel) return;
  const t = currentTrack();
  lyricsPanel.head.replaceChildren(h("strong", {}, t ? t.title : ""), h("span", { class: "muted" }, t ? nm(t.artist || "") : ""));
  lyricsBoxes.delete(lyricsPanel.box);
  if (!t || t.radio) { lyricsPanel.body.replaceChildren(h("p", { class: "muted ly-msg" }, T("No hay letra para esta canción."))); lyricsPanel.tools.replaceChildren(); return; }
  const box = lyricsBox(t.id, seekTo);
  box.scroller = lyricsPanel.body;
  lyricsPanel.box = box;
  lyricsPanel.tools.replaceChildren(lyricsTools(box));
  lyricsPanel.body.replaceChildren(box);
  lyricsPanel.body.scrollTop = 0;
}
function toggleLyrics() {
  const on = !lyricsPanel;
  if (on) {
    const head = h("div", { class: "ly-head" });
    const body = h("div", { class: "ly-body" });
    const tools = h("div", { class: "ly-toolsbox" });
    const el = h("div", { class: "lyrics-panel", role: "region", "aria-label": T("Letra") },
      h("div", { class: "ly-top" }, head, h("button", { class: "icon-btn", title: T("Cerrar"), "aria-label": T("Cerrar"), onclick: toggleLyrics }, icon("close", 20))),
      tools, body);
    document.body.append(el);
    lyricsPanel = { el, head, body, tools, box: null };
    layoutVars();
    lyricsPanelUpdate();
  } else {
    lyricsBoxes.delete(lyricsPanel.box);
    const gone = lyricsPanel.el;
    lyricsPanel = null;
    if (document.body.classList.contains("no-anim")) gone.remove();
    else { gone.classList.add("closing"); setTimeout(() => gone.remove(), parseInt(getComputedStyle(document.documentElement).getPropertyValue("--anim")) || 0); }
  }
  if (player.ui && player.ui.lyricsBtn) { player.ui.lyricsBtn.classList.toggle("on", on); player.ui.lyricsBtn.setAttribute("aria-pressed", String(on)); }
}

/* Medidas de las columnas, para que la letra ocupe solo el centro y deje la biblioteca y la cola a los lados. */
function layoutVars() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const root = document.documentElement.style;
  const side = shell.querySelector(".sidebar"), queue = shell.querySelector(".queue-side"), top = shell.querySelector(".topbar");
  const mobile = window.innerWidth <= 860;
  root.setProperty("--ly-left", mobile ? "0px" : `${side ? side.getBoundingClientRect().width / Z() : 0}px`);
  root.setProperty("--ly-right", !mobile && shell.classList.contains("with-side") && queue ? `${queue.getBoundingClientRect().width / Z()}px` : "0px");
  root.setProperty("--ly-top", `${top ? top.getBoundingClientRect().bottom / Z() : 0}px`);
}
window.addEventListener("resize", layoutVars);
window.addEventListener("hashchange", () => {
  document.body.classList.remove("nav-open", "np-open");
  if (window.innerWidth <= 860) document.querySelector(".shell")?.classList.remove("with-side");
  if (lyricsPanel) toggleLyrics();
});

function refreshPlayer() {
  const ui = player.ui;
  const t = currentTrack();
  if (!ui || !t) return;
  ui.title.textContent = t.title;
  ui.artist.textContent = nm(t.artist || "");
  if (typeof drawWave === "function") { drawWave(t); updateNowWidget(); }
  ui.coverLink.replaceChildren(coverEl(t.coverArt, t.title, 120));
  if (t.albumId) ui.coverLink.setAttribute("href", `#/album/${t.albumId}`);
  else ui.coverLink.removeAttribute("href");
  refreshPlayButton();
  markPlaying();
  drawQueue();
  lyricsPanelUpdate();
}

const aboutCache = {};
function songTarget(t, extra) {
  return { type: "song", id: t.id, name: t.title, song: t, go: t.albumId ? `#/album/${t.albumId}` : null,
    artistId: (t.artists && t.artists[0] && t.artists[0].id) || t.artistId, extra,
    play: () => playQueue([t], 0, null) };
}

// Lista de la cola. items: { t, onPlay, extra, onRemove, onMove? }. onMove(from, to) activa arrastrar para reordenar.
function trackList(list, onMove) {
  const box = h("div", { class: "q-list" });
  list.forEach((it, idx) => {
    const row = h("div", { class: "q-item", draggable: onMove ? "true" : "false" },
      h("button", { class: "q-main", type: "button", onclick: it.onPlay },
        coverEl(it.t.coverArt, it.t.title, 80),
        h("span", { class: "q-text" }, h("span", { class: "q-title" }, it.t.title), h("span", { class: "muted small" }, nm(it.t.artist || "")))),
      it.onRemove ? h("button", { class: "icon-btn q-rm", type: "button", title: T("Quitar de la cola"), "aria-label": T("Quitar de la cola"), onclick: it.onRemove }, icon("close", 16)) : null);
    row.addEventListener("contextmenu", (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, songTarget(it.t, it.extra)); });
    if (onMove) {
      row.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(idx)); e.dataTransfer.effectAllowed = "move"; row.classList.add("dragging"); });
      row.addEventListener("dragend", () => { row.classList.remove("dragging"); box.querySelectorAll(".drop-before, .drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after")); });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const r = row.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        box.querySelectorAll(".drop-before, .drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
        row.classList.add(after ? "drop-after" : "drop-before");
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const r = row.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        let to = idx + (after ? 1 : 0);
        if (from < to) to--;
        if (!Number.isNaN(from) && from !== to) onMove(from, to);
      });
    }
    box.append(row);
  });
  return box;
}

function upcomingList() {
  const out = [];
  const n = player.queue.length;
  if (!n) return out;
  const LIMIT = 60;
  if (player.mode === "shuffle") {
    for (let p = player.pos + 1; p < player.order.length && out.length < LIMIT; p++) out.push(player.order[p]);
  } else if (player.mode === "one") {
    return out;
  } else {
    for (let i = player.index + 1; i < n && out.length < LIMIT; i++) out.push(i);
    if (player.mode === "loop") for (let i = 0; i < player.index && out.length < LIMIT; i++) out.push(i);
  }
  return out;
}

// Arrastrar para reordenar «A continuación»: se recolocan las canciones entre las mismas posiciones que ya ocupaban,
// así la canción que suena y la posición dentro de la lista no cambian.
function reorderUpcoming(shown, from, to) {
  const slots = upcomingList();
  const fromSlot = slots.indexOf(shown[from]), toSlot = slots.indexOf(shown[to]);
  if (fromSlot < 0 || toSlot < 0 || fromSlot === toSlot) return;
  const moved = slots.slice();
  const [x] = moved.splice(fromSlot, 1);
  moved.splice(toSlot, 0, x);
  if (player.mode === "shuffle") {
    moved.forEach((qi, k) => { player.order[player.pos + 1 + k] = qi; });
  } else {
    const tracks = moved.map((qi) => player.queue[qi]);
    slots.forEach((qi, k) => { player.queue[qi] = tracks[k]; });
  }
  drawQueue();
}

function drawQueue() {
  const ui = player.ui;
  if (!ui || !ui.side) return;
  const t = currentTrack();
  if (!t) { ui.side.replaceChildren(h("button", { class: "icon-btn side-close", type: "button", "aria-label": T("Cerrar"), onclick: toggleSide }, icon("close", 22)), room.active ? h("h3", {}, T("Cola de la sala")) : null,
    h("p", { class: "muted side-empty" }, room.active ? T("La cola de la sala está vacía. Añade canciones y sonarán para todos.") : T("Aquí verás lo que suena y lo que viene después."))); return; }
  const upIdx = upcomingList().filter((qi) => !isTrashed(player.queue[qi]));
  const ctxName = room.active ? T("Cola de la sala") : player.ctx && player.ctx.kind === "playlist" ? T("Siguiente de la playlist") : T("A continuación");
  const kids = [
    h("button", { class: "icon-btn side-close", type: "button", title: T("Cerrar"), "aria-label": T("Cerrar"), onclick: toggleSide }, icon("close", 22)),
    h("div", { class: "side-cover", oncontextmenu: (e) => { if (t.radio) return; e.preventDefault(); showMenu(e.clientX, e.clientY, songTarget(t)); } }, coverEl(t.coverArt, t.title, 640),
      h("div", { class: "side-title" }, t.radio ? t.title : h("a", { href: `#/song/${encodeURIComponent(t.id)}` }, t.title)),
      h("div", { class: "side-artist muted" }, t.radio ? "" : artistLinks(t))),
    h("div", { class: "side-about", id: "side-about" })];
  if (player.pending.length) {
    kids.push(h("h3", {}, T("En la cola")),
      trackList(player.pending.map((p, i) => ({ t: p, onPlay: () => { player.history.push(snapshot()); player.current = p; player.fromPending = true; player.pending.splice(i, 1); loadCurrent(); },
        onRemove: () => { player.pending.splice(i, 1); drawQueue(); },
        extra: [{ label: T("Subir en la cola"), fn: () => { if (i > 0) { [player.pending[i - 1], player.pending[i]] = [player.pending[i], player.pending[i - 1]]; drawQueue(); } } },
          { label: T("Bajar en la cola"), fn: () => { if (i < player.pending.length - 1) { [player.pending[i + 1], player.pending[i]] = [player.pending[i], player.pending[i + 1]]; drawQueue(); } } },
          { label: T("Quitar de la cola"), fn: () => { player.pending.splice(i, 1); drawQueue(); } }] })),
      (from, to) => { const [x] = player.pending.splice(from, 1); player.pending.splice(to, 0, x); drawQueue(); }));
  }
  if (upIdx.length && room.active) {
    const canMove = roomCan("move"), canSkip = roomCan("skip");
    kids.push(h("h3", {}, ctxName),
      trackList(upIdx.map((qi) => ({ t: player.queue[qi],
        extra: canMove ? [{ label: T("Reproducir a continuación"), fn: () => { if (qi > room.index + 1) roomSend("move", { from: qi, to: room.index + 1 }); } }] : [],
        onRemove: canMove ? () => roomSend("remove", { index: qi }) : null,
        onPlay: () => { if (canSkip) roomSend("jump", { index: qi }); else toast(T("El anfitrión no te ha dado permiso para hacer esto")); } })),
      canMove ? (from, to) => roomSend("move", { from: upIdx[from], to: upIdx[to] }) : null));
  } else if (upIdx.length) {
    kids.push(h("h3", {}, ctxName),
      trackList(upIdx.map((qi) => ({ t: player.queue[qi],
        extra: [{ label: T("Reproducir a continuación"), fn: () => { player.pending.unshift(player.queue[qi]); drawQueue(); toast(T("Sonará a continuación")); } }],
        onPlay: () => {
        player.history.push(snapshot()); player.index = qi; player.current = player.queue[qi]; player.fromPending = false;
        if (player.mode === "shuffle") player.pos = player.order.indexOf(qi);
        loadCurrent(); } })),
      (from, to) => reorderUpcoming(upIdx, from, to)));
  } else if (!player.pending.length) {
    kids.push(h("p", { class: "muted small side-empty" }, room.active ? T("No hay más canciones en la cola de la sala.") : player.mode === "one" ? T("Repitiendo esta canción.") : T("No hay más canciones en la cola.")));
  }
  const scroll = ui.side.scrollTop;
  ui.side.replaceChildren(...kids);
  ui.side.scrollTop = scroll;
  drawAbout(t);
}

async function drawAbout(t) {
  const box = document.getElementById("side-about");
  if (!box || t.radio) return;
  const id = (t.artists && t.artists[0] && t.artists[0].id) || t.artistId;
  if (!id) return;
  try {
    if (!aboutCache[id]) aboutCache[id] = (await api("getArtist", { id })).artist;
  } catch (e) { return; }
  const ar = aboutCache[id];
  const cur = document.getElementById("side-about");
  if (!cur || !currentTrack() || currentTrack().id !== t.id) return;
  const own = (ar.album || []).filter((x) => !x.appearsOn);
  cur.replaceChildren(
    h("h3", {}, T("Sobre el artista")),
    h("a", { class: "about-card", href: `#/artist/${id}` },
      coverEl(id, ar.name, 160, "round"),
      h("span", { class: "about-text" },
        h("span", { class: "about-name" }, nm(ar.name)),
        ar.bio ? h("span", { class: "muted small about-bio" }, ar.bio) : null,
        h("span", { class: "muted small" }, plural(own.length, "album")))));
}

/* Solo en el cliente de escritorio: avisa de lo que suena (para el Discord Rich Presence). */
let nowTimer = null, nowSent = "";
function reportNow(force) {
  clearTimeout(nowTimer);
  nowTimer = setTimeout(() => {
    const t = currentTrack();
    const playing = !!t && !audio.paused && !audio.ended;
    const body = { song: t && !t.radio ? t.id : "", title: t ? t.title : "", artist: t ? nm(t.artist || "") : "", radio: !!(t && t.radio), playing };
    const key = JSON.stringify(body);
    if (!force && key === nowSent) return;
    nowSent = key;
    web("now/update", body).catch(() => {});
  }, 800);
}
setInterval(() => { if (state.user && !audio.paused) reportNow(true); }, 30000);     // «sigo aquí»

/* Tiempo de radio para el Wrapped: cada 20 s, si suena una radio, se avisa de cuántos segundos han pasado. */
let radioTick = { id: null, at: 0 };
setInterval(() => {
  const t = currentTrack();
  if (!state.user || !t || !t.radio || audio.paused || audio.ended) { radioTick = { id: null, at: 0 }; return; }
  const now = Date.now(), start = radioTick.id !== t.id;
  const secs = start ? 0 : Math.round((now - radioTick.at) / 1000);
  radioTick = { id: t.id, at: now };
  web("radio/listen", { id: String(t.id), name: t.title, seconds: secs, start }).catch(() => {});
}, 20000);

function announceNow() {
  reportNow(false);
  if (!window.zinctifyDesktop) return;
  try {
    const t = currentTrack();
    const dur = audio.duration;
    window.postMessage({
      source: "zinctify-now", playing: !!t && !audio.paused && !audio.ended, title: t ? t.title : "", artist: t ? nm(t.artist || "") : "",
      album: t ? t.album || "" : "", position: audio.currentTime || 0, duration: isFinite(dur) ? dur : 0, radio: !!(t && t.radio),
    }, location.origin);
  } catch (e) { /* ignorar */ }
}

function setMediaSession(t) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: nm(t.artist || ""), album: t.album || "",
      artwork: t.coverArt ? [{ src: coverUrl(t.coverArt, 512), sizes: "512x512", type: "image/jpeg" }] : [],
    });
  } catch (e) { /* no pasa nada si el navegador no lo soporta */ }
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) { /* ignorar */ } };
  set("play", () => audio.play());
  set("pause", () => audio.pause());
  set("previoustrack", prev);
  set("nexttrack", next);
  set("seekto", (d) => { if (d.seekTime != null) audio.currentTime = d.seekTime; });
}

function sideOpen() { try { if (window.innerWidth <= 860) return false; const v = localStorage.getItem("zinctify.side"); return v === null ? window.innerWidth >= 1180 : v === "1"; } catch (e) { return false; } }
function toggleSide() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const on = !shell.classList.contains("with-side");
  shell.classList.toggle("with-side", on);
  layoutVars();
  if (on) document.body.classList.remove("nav-open");
  if (window.innerWidth <= 860) return;                      // en móvil no se recuerda: siempre empieza cerrada
  try { localStorage.setItem("zinctify.side", on ? "1" : "0"); } catch (e) { /* ignorar */ }
}

function buildPlayer() {
  const ui = {};
  ui.coverLink = h("a", { class: "np-cover" }, coverEl(null, "♪", 120));
  ui.title = h("div", { class: "np-title" }, T("Nada sonando"));
  ui.artist = h("div", { class: "np-artist muted" }, T("Elige un álbum o una radio para empezar"));
  ui.play = h("button", { class: "icon-btn play-btn", title: T("Reproducir"), "aria-label": T("Reproducir"), onclick: togglePlay }, icon("play", 24));
  ui.seek = h("input", { type: "range", min: 0, max: 1000, step: 1, value: 0, "aria-label": T("Posición en la canción") });
  ui.cur = h("span", {}, "0:00");
  ui.dur = h("span", {}, "0:00");
  ui.vol = h("input", { type: "range", min: 0, max: 100, value: 80, "aria-label": T("Volumen") });
  ui.mode = h("button", { class: "icon-btn mode-btn", type: "button", onclick: cycleMode });
  ui.side = h("aside", { class: "queue-side", "aria-label": T("Cola de reproducción") });

  ui.seek.addEventListener("input", () => {
    player.dragging = true;
    if (isFinite(audio.duration)) ui.cur.textContent = fmtTime((ui.seek.value / 1000) * audio.duration);
  });
  ui.seek.addEventListener("change", () => {
    if (dev.remote) { const d = dev.remote.track.duration || 0; if (d) devCommand("seek", { pos: (ui.seek.value / 1000) * d }); return; }
    if (isFinite(audio.duration)) { if (room.active) roomSend("seek", { pos: (ui.seek.value / 1000) * audio.duration }); else audio.currentTime = (ui.seek.value / 1000) * audio.duration; }
    player.dragging = false;
  });
  try { const saved = localStorage.getItem("zinctify.volume") ?? localStorage.getItem("minisonic.volume"); if (saved !== null) ui.vol.value = saved; } catch (e) { /* ignorar */ }
  musicAudio.volume = musicAudio2.volume = radioAudio.volume = ui.vol.value / 100;
  ui.vol.addEventListener("input", () => {
    if (dev.remote) { devVolumeRemote(ui.vol.value / 100); return; }
    if (!xf.out) musicAudio.volume = musicAudio2.volume = radioAudio.volume = ui.vol.value / 100;
    try { localStorage.setItem("zinctify.volume", ui.vol.value); } catch (e) { /* ignorar */ }
  });

  player.ui = ui;
  refreshMode();
  drawQueue();
  const rootEl = h("div", { class: "player" },
    h("div", { class: "np-top" },
      h("button", { class: "icon-btn np-min", type: "button", title: T("Minimizar"), "aria-label": T("Minimizar"), onclick: () => npOpen(false) }, icon("chevron", 24)),
      h("span", { class: "np-top-title" }, T("Reproduciendo ahora")),
      h("button", { class: "icon-btn np-opts", type: "button", title: T("Opciones"), "aria-label": T("Opciones"), onclick: (e) => {
        const t = currentTrack(); if (!t || t.radio) return;
        const r = e.currentTarget.getBoundingClientRect(); showMenu(r.right - 12, r.bottom, songTarget(t));
      } }, icon("more", 22))),
    h("div", { class: "np", onclick: (e) => { if (isMobile() && !document.body.classList.contains("np-open")) { e.preventDefault(); npOpen(true); } }, oncontextmenu: (e) => { const t = currentTrack(); if (!t || t.radio) return; e.preventDefault(); showMenu(e.clientX, e.clientY, songTarget(t)); } },
      ui.coverLink, h("div", { class: "np-meta" }, ui.title, ui.artist)),
    h("div", { class: "controls" },
      h("div", { class: "ctl-row" },
        ui.mode,
        h("button", { class: "icon-btn c-prev", title: T("Anterior"), "aria-label": T("Anterior"), onclick: prev }, icon("prev")),
        ui.play,
        h("button", { class: "icon-btn c-next", title: T("Siguiente"), "aria-label": T("Siguiente"), onclick: next }, icon("next"))),
      h("div", { class: "seek" }, ui.cur, h("div", { class: "seek-track" }, ui.seek, (ui.wave = h("div", { class: "wave", "aria-hidden": "true" }))), ui.dur)),
    h("div", { class: "right" },
      (ui.devBtn = h("button", { class: "icon-btn dev-btn", type: "button", title: T("Reproducir en…"), "aria-label": T("Reproducir en…"), dataset: { menuOwner: "1" }, onclick: devPicker }, icon("devices"))),
      (ui.lyricsBtn = h("button", { class: "icon-btn", title: T("Letra"), "aria-label": T("Letra"), "aria-pressed": "false", onclick: toggleLyrics }, icon("mic"))),
      icon("volume", 18), ui.vol,
      h("button", { class: "icon-btn", title: T("Cola"), "aria-label": T("Cola de reproducción"), onclick: toggleSide }, icon("queue"))));
  ui.root = rootEl;
  // Gestos: deslizar hacia arriba abre la pantalla del reproductor, hacia abajo la cierra.
  let ty = null;
  rootEl.addEventListener("touchstart", (e) => { ty = e.target.closest("input, .ly-body, .queue-side") ? null : e.touches[0].clientY; }, { passive: true });
  rootEl.addEventListener("touchend", (e) => {
    if (ty === null || !isMobile()) return;
    const dy = e.changedTouches[0].clientY - ty; ty = null;
    const open = document.body.classList.contains("np-open");
    if (!open && dy < -30) npOpen(true); else if (open && dy > 90) npOpen(false);
  }, { passive: true });
  return rootEl;
}

// El menú del navegador (Firefox, Chrome...) no sale en la página: solo el nuestro.
// Se deja en los campos de texto para poder copiar y pegar.
document.addEventListener("contextmenu", (e) => {
  if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
  e.preventDefault();
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || !state.user) return;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(e.target.tagName)) return;
  e.preventDefault();
  togglePlay();
});


/* ---------- tu biblioteca (lo que has guardado con el corazón + tus playlists) ---------- */

const lib = { items: [] };
const isSaved = (kind, id) => lib.items.some((i) => i.kind === kind && i.id === id);
let touchTimer = null;

async function loadLibrary() {
  try { lib.items = (await web("library", {})).items; } catch (e) { /* se queda lo anterior */ }
  drawLibrary();
  document.querySelectorAll(".heart, .bell-toggle").forEach((b) => b.refresh && b.refresh());
}
function libraryTouch(ctx) {
  web("library/touch", ctx).then(() => {
    clearTimeout(touchTimer);
    touchTimer = setTimeout(loadLibrary, 800);
  }).catch(() => {});
}

// Corazón de guardar en la biblioteca: álbumes, artistas y playlists de otros.
function heartBtn(kind, id) {
  const btn = h("button", { class: "icon-btn heart", type: "button" });
  btn.refresh = () => {
    const on = isSaved(kind, id);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    const label = on ? T("Quitar de tu biblioteca") : T("Guardar en tu biblioteca");
    btn.title = label;
    btn.setAttribute("aria-label", label);
  };
  btn.refresh();
  btn.append(icon("heart", 22));
  btn.addEventListener("click", async () => {
    try {
      await web("library/save", { kind, id, saved: !isSaved(kind, id) });
      await loadLibrary();
    } catch (e) { showError(e); }
  });
  return btn;
}

/* Campanita: avisar o no de lo nuevo de alguien a quien sigues / de un artista guardado. Solo se ve cuando lo sigues o lo guardas. */
function bellBtn(opts) {                                   // opts: { visible(), on(), set(on), onText, offText }
  const btn = h("button", { class: "icon-btn bell-toggle", type: "button" });
  btn.refresh = () => {
    const vis = opts.visible();
    btn.hidden = !vis;
    if (!vis) return;
    const on = opts.on();
    btn.classList.toggle("on", on); btn.classList.toggle("off", !on);
    btn.setAttribute("aria-pressed", String(on));
    btn.title = btn.ariaLabel = on ? opts.onLabel : opts.offLabel;
  };
  btn.append(icon("bell", 22));
  btn.refresh();
  btn.addEventListener("click", async (e) => {
    e.preventDefault(); e.stopPropagation();
    const next = !opts.on();
    try { await opts.set(next); btn.refresh(); toast(next ? opts.onText : opts.offText); } catch (ex) { showError(ex); }
  });
  return btn;
}
function userBell(card) {
  return bellBtn({ visible: () => card.isFollowing && !card.isMe, on: () => card.notifyNew !== false,
    set: async (v) => { Object.assign(card, (await web("user/notify", { username: card.username, notify: v })).user); },
    onLabel: T("Te avisamos de sus playlists nuevas: pulsa para no recibir avisos"), offLabel: T("Sin avisos de sus playlists nuevas: pulsa para recibirlos"),
    onText: T("Te avisaremos cuando publique playlists nuevas"), offText: T("No te avisaremos de sus playlists nuevas") });
}
function artistBell(id) {
  const item = () => lib.items.find((i) => i.kind === "artist" && i.id === id);
  return bellBtn({ visible: () => !!item(), on: () => !item() || item().notify !== false,
    set: async (v) => { await web("library/notify", { kind: "artist", id, notify: v }); await loadLibrary(); },
    onLabel: T("Te avisamos de su música nueva: pulsa para no recibir avisos"), offLabel: T("Sin avisos de su música nueva: pulsa para recibirlos"),
    onText: T("Te avisaremos cuando haya música nueva de este artista"), offText: T("No te avisaremos de su música nueva") });
}

const TYPE_LABEL = { playlist: "Playlist", album: "Álbum", artist: "Artista" };
function libraryItem(i, view) {
  const type = T(TYPE_LABEL[i.kind]);
  const cover = coverEl(i.kind === "playlist" ? (i.cover ? i.id : null) : i.coverArt, i.name, 200, i.kind === "artist" ? "round" : "", i.cover);
  const sub = i.kind === "artist" ? type : `${i.collaborative ? T("Playlist colaborativa") : type} · ${nm(i.author || "")}`;
  const a = h("a", { class: `lib-item lib-${view}`, href: `#/${i.kind}/${i.id}`, title: i.name, dataset: { href: `#/${i.kind}/${i.id}` } },
    cover, h("div", { class: "lib-text" }, h("div", { class: "lib-name" }, i.pinned ? h("span", { class: "pin-mark", title: T("Fijada") }, icon("pin", 13)) : null, nm(i.name)),
      h("div", { class: "lib-sub" }, view === "compact" ? type : sub)));
  a.addEventListener("contextmenu", (e) => { e.preventDefault(); libraryMenu(e.clientX, e.clientY, i); });
  a.append(h("button", { class: "icon-btn lib-more", type: "button", title: T("Más opciones"), "aria-label": T("Más opciones"), dataset: { menuOwner: "1" },
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); libraryMenu(Math.max(8, r.right - 200), r.bottom + 4, i); } }, icon("more", 18)));
  return a;
}
function drawLibrary(boxes = document.querySelectorAll(".library")) {
  const view = ["compact", "list"].includes(prefs().libraryView) ? prefs().libraryView : "grid";
  for (const box of boxes) {
    box.classList.remove("lib-grid", "lib-compact", "lib-list");
    box.classList.add(`lib-${view}`);
    box.replaceChildren(...(lib.items.length
      ? lib.items.map((i) => libraryItem(i, view))
      : [h("p", { class: "muted small lib-empty" }, T("Aquí aparecerán tus playlists y lo que guardes con el corazón."))]));
  }
  markLibraryCurrent();
  markLibraryPlaying();
}
/* Lo que suena (la playlist, el álbum o el artista desde donde se reproduce) queda marcado en la biblioteca, como en Spotify. */
function playingHref() {
  const t = currentTrack(), c = player.ctx;
  if (!t) return null;
  if (c && ["playlist", "album", "artist"].includes(c.kind)) return `#/${c.kind}/${c.id}`;
  if (!t.radio && t.albumId) return `#/album/${t.albumId}`;
  return null;
}
function markLibraryPlaying() {
  const href = playingHref();
  const live = !!href && (dev.remote ? !!dev.remote.playing : !audio.paused);
  document.querySelectorAll(".lib-item").forEach((a) => {
    const on = !!href && a.dataset.href === href;
    a.classList.toggle("playing", on);
    a.classList.toggle("is-playing", on && live);
    const name = a.querySelector(".lib-name");
    const eq = name && name.querySelector(".eq");
    if (on && name && !eq) name.append(h("span", { class: "eq", "aria-label": T("Sonando"), title: T("Sonando") }, h("i"), h("i"), h("i")));
    else if (!on && eq) eq.remove();
  });
}
function markLibraryCurrent() {
  document.querySelectorAll(".lib-item").forEach((a) =>
    a.classList.toggle("current", a.dataset.href === location.hash));
}

/* ---------- menú contextual (clic derecho, o el botón ⋯ en el móvil) ---------- */

let menuEl = null;
const closeMenu = () => { if (menuEl) { menuEl.remove(); menuEl = null; } if (typeof subEl !== "undefined" && subEl) { subEl.remove(); subEl = null; } };
document.addEventListener("pointerdown", (e) => { if (menuEl && !menuEl.contains(e.target) && !(e.target.closest && e.target.closest(".submenu")) && !(e.target.closest && e.target.closest("[data-menu-owner]"))) closeMenu(); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
window.addEventListener("hashchange", closeMenu);
document.addEventListener("scroll", closeMenu, true);

function openMenu(x, y, build) {
  closeMenu();
  const m = h("div", { class: "menu", role: "menu" });
  menuEl = m;
  document.body.append(m);
  const place = () => {
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) / Z()}px`;      // x, y y r vienen en píxeles de pantalla; el CSS va ampliado por Z()
    m.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) / Z()}px`;
  };
  build(m, place);
  place();
  const first = m.querySelector("button, a");
  if (first) first.focus({ preventScroll: true });
}
const menuItem = (label, fn, cls = "") => h("button", {
  class: `menu-item ${cls}`.trim(), role: "menuitem", type: "button",
  onclick: (e) => { e.stopPropagation(); fn(); },
}, label);

async function playlistFrom(target) {
  const body = target.type === "album" ? { name: target.name, albumId: target.id } : { name: target.name, songIds: [target.id] };
  try {
    const r = await web("playlist/create", body);
    toast(T("Playlist «{name}» creada", { name: r.playlist.name }), `#/playlist/${r.playlist.id}`);
    loadLibrary();
  } catch (e) { showError(e); }
}
async function addToPlaylist(pl, target) {
  const body = target.type === "album" ? { id: pl.id, albumId: target.id } : { id: pl.id, songIds: [target.id] };
  try {
    await web("playlist/add", body);
    toast(T("Añadido a «{name}»", { name: pl.name }), `#/playlist/${pl.id}`);
    loadLibrary();
  } catch (e) { showError(e); }
}

let subEl = null;
const closeSub = () => { if (subEl) { subEl.remove(); subEl = null; } };

async function targetSongs(target) {
  if (target.type === "song") return [target.song];
  const { album } = await api("getAlbum", { id: target.id });
  return album.song || [];
}

// target: { type: "song" | "album", id, name, song?, play?, go?, artistId? }
function showMenu(x, y, target) {
  openMenu(x, y, (m, place) => {
    let hoverTimer = null;
    const openSub = async (anchor) => {
      closeSub();
      const sub = h("div", { class: "menu submenu", role: "menu" }, h("div", { class: "menu-title" }, T("Cargando...")));
      subEl = sub;
      document.body.append(sub);
      const placeSub = () => {
        const r = anchor.getBoundingClientRect(), s = sub.getBoundingClientRect();
        const left = r.right + 4 + s.width > window.innerWidth - 8 ? r.left - s.width - 4 : r.right + 4;
        sub.style.left = `${Math.max(8, left) / Z()}px`;
        sub.style.top = `${Math.max(8, Math.min(r.top - 6, window.innerHeight - s.height - 8)) / Z()}px`;
      };
      placeSub();
      let mine = [];
      try { mine = (await web("playlist/mine", {})).playlists; } catch (e) { closeMenu(); showError(e); return; }
      if (subEl !== sub) return;
      sub.replaceChildren(
        menuItem([icon("plus", 16), h("span", {}, T("Crear playlist"))], () => { closeMenu(); playlistFrom(target); }, "create"),
        mine.length ? h("div", { class: "menu-sep" }) : null,
        h("div", { class: "menu-list" }, mine.map((pl) => menuItem(pl.name, () => { closeMenu(); addToPlaylist(pl, target); }))));
      placeSub();
    };
    const items = [];
    if (target.play) items.push(menuItem(T("Reproducir"), () => { closeMenu(); target.play(); }));
    items.push(menuItem(T("Añadir a la cola"), async () => {
      closeMenu();
      try { addToQueue(await targetSongs(target)); } catch (e) { showError(e); }
    }));
    for (const ex of target.extra || []) items.push(menuItem(ex.label, () => { closeMenu(); ex.fn(); }));
    const pl = menuItem([h("span", {}, T("Playlists")), icon("chevron", 16)], () => openSub(pl), "has-sub");
    pl.addEventListener("mouseenter", () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => openSub(pl), 120); });
    pl.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
    items.push(pl);
    if (target.type === "album") {
      const saved = isSaved("album", target.id);
      items.push(menuItem(saved ? T("Quitar de tu biblioteca") : T("Guardar en tu biblioteca"), async () => {
        closeMenu();
        try { await web("library/save", { kind: "album", id: target.id, saved: !saved }); loadLibrary(); } catch (e) { showError(e); }
      }));
    }
    const shKind = ["song", "album", "artist", "playlist"].includes(target.type) ? target.type : "album";
    const shr = menuItem([h("span", {}, T("Compartir")), icon("chevron", 16)], () => openShare(shr), "has-sub");
    let shTimer = null;
    const openShare = (anchor) => {
      closeSub();
      const sub = h("div", { class: "menu submenu", role: "menu" });
      subEl = sub; document.body.append(sub);
      const placeSub = () => {
        const r = anchor.getBoundingClientRect(), s = sub.getBoundingClientRect();
        const left = r.right + 4 + s.width > window.innerWidth - 8 ? r.left - s.width - 4 : r.right + 4;
        sub.style.left = `${Math.max(8, left) / Z()}px`;
        sub.style.top = `${Math.max(8, Math.min(r.top - 6, window.innerHeight - s.height - 8)) / Z()}px`;
      };
      const send = menuItem([h("span", {}, T("Mandar a…")), icon("chevron", 16)], () => openSend(), "has-sub");
      let sub2 = null, t2 = null;
      const openSend = () => {
        if (sub2) sub2.remove();
        sub2 = h("div", { class: "menu submenu", role: "menu" }, h("div", { class: "menu-title" }, T("Cargando...")));
        sub.classList.add("has-child"); sub._child = sub2; document.body.append(sub2);
        const place2 = () => {
          const r = send.getBoundingClientRect(), s = sub2.getBoundingClientRect();
          const left = r.right + 4 + s.width > window.innerWidth - 8 ? r.left - s.width - 4 : r.right + 4;
          sub2.style.left = `${Math.max(8, left) / Z()}px`;
          sub2.style.top = `${Math.max(8, Math.min(r.top - 6, window.innerHeight - s.height - 8)) / Z()}px`;
        };
        place2(); fillFriendMenu(sub2, { type: shKind, id: String(target.id), name: target.name || "" }, place2);
      };
      const copy = menuItem(T("Copiar enlace"), () => { closeMenu(); shareItem(shKind, target.id); });
      copy.addEventListener("mouseenter", () => { if (sub2) { sub2.remove(); sub2 = null; } });
      send.addEventListener("mouseenter", () => { clearTimeout(t2); t2 = setTimeout(openSend, 120); });
      send.addEventListener("mouseleave", () => clearTimeout(t2));
      sub.replaceChildren(copy, send);
      const origRemove = sub.remove.bind(sub);
      sub.remove = () => { if (sub2) { sub2.remove(); sub2 = null; } origRemove(); };
      placeSub();
    };
    shr.addEventListener("mouseenter", () => { clearTimeout(shTimer); shTimer = setTimeout(() => openShare(shr), 120); });
    shr.addEventListener("mouseleave", () => clearTimeout(shTimer));
    items.push(shr);
    if (target.type === "song" || target.type === "album") {
      const on = trash[target.type].has(target.id);
      items.push(menuItem(on ? T("Restaurar de la papelera") : T("Mover a la papelera"), () => { closeMenu(); setTrashed(target.type, target.id, !on); }, on ? "" : "danger"));
    }
    if (target.type === "song") items.push(menuItem(T("Ir a la canción"), () => { closeMenu(); location.hash = `#/song/${encodeURIComponent(target.id)}`; }));
    if (target.go) items.push(menuItem(T("Ir al álbum"), () => { closeMenu(); location.hash = target.go; }));
    if (target.artistId) items.push(menuItem(T("Ir al artista"), () => { closeMenu(); location.hash = `#/artist/${target.artistId}`; }));
    for (const it of items) if (it !== pl) it.addEventListener("mouseenter", closeSub);
    m.replaceChildren(...items);
    place();
  });
}
// Menú sencillo con una lista de { label, fn, cls }
function showSimpleMenu(x, y, entries) {
  openMenu(x, y, (m, place) => {
    const els = entries.map((e) => e.sep ? h("div", { class: "menu-sep" }) : e.node ? e.node() : menuItem(e.label, () => { closeMenu(); e.fn(); }, e.cls || ""));
    for (const el of els) if (!el.classList.contains("has-sub")) el.addEventListener("mouseenter", closeSub);
    m.replaceChildren(...els);
    place();
  });
}

function libraryMenu(x, y, i) {
  const entries = [{ label: i.pinned ? T("Quitar de fijadas") : T("Fijar arriba"), fn: async () => {
    try { await web("library/pin", { kind: i.kind, id: i.id, pinned: !i.pinned }); await loadLibrary(); } catch (e) { showError(e); }
  } }, { node: () => shareSubItem(i.kind, i.id, i.name) }, { sep: true }];
  if (i.kind === "playlist" && i.owned) {
    entries.push({ label: T("Borrar playlist"), cls: "danger", fn: async () => {
      if (!confirm(T("¿Borrar la playlist «{name}»? No se puede deshacer.", { name: i.name }))) return;
      try { await web("playlist/delete", { id: i.id }); await loadLibrary(); if (location.hash === `#/playlist/${i.id}`) location.hash = "#/"; } catch (e) { showError(e); }
    } });
  } else {
    entries.push({ label: T("Quitar de tu biblioteca"), fn: async () => {
      try { await web("library/save", { kind: i.kind, id: i.id, saved: false }); await loadLibrary(); } catch (e) { showError(e); }
    } });
  }
  showSimpleMenu(x, y, entries);
}

function onContext(el, getTarget) {
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, getTarget()); });
}
function moreBtn(getTarget) {
  const btn = h("button", { class: "icon-btn more", type: "button", title: T("Más opciones"), "aria-label": T("Más opciones"), dataset: { menuOwner: "1" },
    onclick: (e) => {
      e.stopPropagation();
      if (menuEl) { closeMenu(); return; }
      const r = btn.getBoundingClientRect();
      showMenu(r.right - 190, r.bottom + 4, getTarget());
    },
    onkeydown: (e) => e.stopPropagation() }, icon("more", 20));
  return btn;
}

/* ---------- piezas comunes ---------- */

const section = (title, ...kids) => h("section", { class: "section" }, h("h2", {}, title), ...kids);

async function playAlbumById(id) {
  const { album } = await api("getAlbum", { id });
  const songs = album.song || [];
  if (songs.length) playQueue(songs, 0, { kind: "album", id });
}

function albumTile(a) {
  const tile = h("a", { class: "tile", href: `#/album/${a.id}` },
    coverEl(a.coverArt, a.name, 300),
    h("div", { class: "t-title", title: nm(a.name) }, nm(a.name)),
    h("div", { class: "t-sub" }, [nm(a.artist), a.year].filter(Boolean).join(", ")));
  onContext(tile, () => ({ type: "album", id: a.id, name: a.name, play: () => playAlbumById(a.id).catch(showError) }));
  return tile;
}
const albumGrid = (list) => h("div", { class: "grid" }, list.map(albumTile));

// Varios artistas ("*NSYNC, Nelly"): cada uno es un enlace a su perfil.
function artistLinks(s) {
  if (!s.artists || !s.artists.length) return nm(s.artist);
  const out = [];
  s.artists.forEach((a, i) => {
    if (i) out.push(", ");
    out.push(h("a", { href: `#/artist/${a.id}`, onclick: (e) => e.stopPropagation(), onkeydown: (e) => e.stopPropagation() }, nm(a.name)));
  });
  return out;
}

// opts: { ctx } avisa de lo que estás escuchando; { onRemove } quita la canción de una playlist;
//       { noCover } (páginas de álbum) enseña el nº de pista en vez de la portada.
// Un clic en un hueco solo selecciona la fila; se reproduce con doble clic, con el botón sobre la portada o con Enter.
function songRow(s, index, queue, showArtist = false, numbered = false, opts = {}) {
  const play = () => playQueue(queue, index, opts.ctx || null, { single: true });
  const target = () => ({ type: "song", id: s.id, name: s.title, song: s, play, go: s.albumId ? `#/album/${s.albumId}` : null,
    artistId: (s.artists && s.artists[0] && s.artists[0].id) || s.artistId });
  const playBtn = h("button", { class: "pb", type: "button", title: T("Reproducir"), "aria-label": T("Reproducir"),
    onclick: (e) => { e.stopPropagation(); play(); }, onkeydown: (e) => e.stopPropagation() }, icon("play", 20));
  const lead = opts.noCover
    ? h("span", { class: "n thumb" }, h("span", { class: "num" }, numbered ? index + 1 : (s.track || index + 1)), playBtn)
    : h("span", { class: "thumb" }, coverEl(s.coverArt, s.title, 120), playBtn);
  const row = h("li", {
    class: "track" + (opts.noCover ? " no-cover" : "") + (isTrashed(s) ? " trashed" : ""), dataset: { id: s.id }, tabindex: 0,
    onclick: (e) => {
      // En el móvil un toque reproduce (los enlaces de artista y los botones siguen funcionando).
      if (isMobile()) {
        const a = e.target.closest("a, button");
        if (!a || a.classList.contains("t-name")) { e.preventDefault(); play(); return; }
      }
      document.querySelectorAll(".track.selected").forEach((el) => { if (el !== row) el.classList.remove("selected"); });
      row.classList.add("selected");
    },
    ondblclick: (e) => { if (!e.target.closest("a, button")) play(); },
    onkeydown: (e) => { if (e.key === "Enter") play(); },
  },
  lead,
  h("span", { class: "t" },
    h("a", { class: "t-name", href: `#/song/${encodeURIComponent(s.id)}`, onkeydown: (e) => e.stopPropagation() }, s.title),
    showArtist || !opts.noCover ? h("span", { class: "t-artist muted" }, artistLinks(s)) : null),
  h("span", { class: "d muted" }, fmtTime(s.duration)),
  opts.onRemove ? h("button", { class: "icon-btn rm", type: "button", title: T("Quitar de la playlist"), "aria-label": T("Quitar de la playlist"),
    onclick: (e) => { e.stopPropagation(); opts.onRemove(s); }, onkeydown: (e) => e.stopPropagation() }, icon("close", 18)) : null,
  moreBtn(target));
  onContext(row, target);
  return row;
}

/* Lista de canciones para playlists enormes: las primeras filas salen al instante y el resto se añade por trozos
   mientras el navegador está libre, para no bloquear la página con miles de filas a la vez. */
function scrollParent(el) {
  for (let p = el && el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}

// Arrastrar canciones de una playlist (ol.tracks) para cambiar su orden. onMove(from, to) con posiciones de la lista.
function sortableTracks(ol, onMove) {
  let from = -1;
  const rows = () => Array.from(ol.children);
  const clear = () => ol.querySelectorAll(".drop-before, .drop-after, .dragging").forEach((x) => x.classList.remove("drop-before", "drop-after", "dragging"));
  ol.addEventListener("pointerdown", (e) => { const r = e.target.closest("li.track"); if (r) r.draggable = !e.target.closest("a, button, input"); });
  ol.addEventListener("dragstart", (e) => {
    const row = e.target.closest && e.target.closest("li.track");
    if (!row || row.parentElement !== ol) return;
    from = rows().indexOf(row);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(from)); } catch (x) { /* nada */ }
    row.classList.add("dragging");
  });
  ol.addEventListener("dragend", () => { from = -1; clear(); });
  ol.addEventListener("dragover", (e) => {
    if (from < 0) return;
    const row = e.target.closest("li.track");
    if (!row) return;
    e.preventDefault();
    const r = row.getBoundingClientRect();
    ol.querySelectorAll(".drop-before, .drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
    row.classList.add(e.clientY > r.top + r.height / 2 ? "drop-after" : "drop-before");
    const sc = scrollParent(ol);                                   // se desplaza sola al acercarte al borde
    if (sc) { const b = sc.getBoundingClientRect ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight }; if (e.clientY < b.top + 60) sc.scrollTop -= 18; else if (e.clientY > b.bottom - 60) sc.scrollTop += 18; }
  });
  ol.addEventListener("drop", (e) => {
    if (from < 0) return;
    const row = e.target.closest("li.track");
    if (!row) return;
    e.preventDefault();
    const idx = rows().indexOf(row), r = row.getBoundingClientRect();
    let to = idx + (e.clientY > r.top + r.height / 2 ? 1 : 0);
    const f = from;
    from = -1; clear();
    if (f < to) to--;
    if (to !== f) onMove(f, to);
  });
  return ol;
}

function chunkedList(items, make, first = 120, chunk = 400) {
  const ol = h("ol", { class: "tracks" }, items.slice(0, first).map((s, i) => make(s, i)));
  let next = first, waits = 0;
  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 300 }) : (f) => setTimeout(f, 30);
  const step = () => {
    if (next >= items.length) return;
    if (!ol.isConnected) { if (++waits < 40) setTimeout(() => idle(step), 100); return; }   // aún no está en pantalla, o ya se cambió de página
    waits = 0;
    const end = Math.min(items.length, next + chunk), frag = document.createDocumentFragment();
    for (let i = next; i < end; i++) frag.append(make(items[i], i));
    ol.append(frag);
    next = end;
    idle(step);
  };
  if (items.length > first) idle(step);
  return ol;
}

function emptyLibrary() {
  return h("div", { class: "empty" },
    h("p", {}, T("Todavía no hay música en la biblioteca.")),
    h("p", {}, T("Si acabas de arrancar el servidor, el escaneo puede estar en marcha: espera un momento y recarga. Comprueba también que la ruta de --music-dir es la correcta.")),
    state.user && state.user.isAdmin ? h("a", { class: "btn", href: "#/admin" }, T("Ir a administración")) : null);
}

const errorBox = (e) => h("div", { class: "empty" },
  h("p", {}, T("No se pudo cargar esta página: {msg}", { msg: e.message })),
  h("button", { class: "btn", onclick: () => render() }, T("Reintentar")));


/* ---------- vistas ---------- */


/* ---------- escuchar juntos (salas) ----------
   El servidor guarda la lista, la canción y el momento; cada persona de la sala lo consulta cada 2 s y se pone al
   día. Cualquiera puede pausar, saltar o cambiar la lista: lo que hace se manda al servidor y todos lo reciben. */
const room = { chat: [], active: false, code: "", host: "", visibility: "private", name: "", members: [], memberInfo: [], perms: {}, defaults: {}, songs: [], index: 0, version: -1, timer: null, applying: false };

/* ¿Puedo hacer esto en la sala? El anfitrión puede todo; el resto, lo que él les haya dado. */
function roomCan(key) {
  if (!room.active) return true;
  if (room.host === state.user.username) return true;
  const p = room.perms[state.user.username];
  return !!(p && p[key]);
}
async function roomAdd(tracks) {
  const ids = tracks.map((t) => t.id);
  await roomSend("add", { ids });
  toast(ids.length === 1 ? T("Añadida a la cola de la sala") : T("{n} canciones añadidas a la cola de la sala", { n: ids.length }));
}

function roomLink(code) { return `${location.origin}/#/together/${code}`; }

/* Playlists en la sala: al darle a reproducir se pregunta si proponerla; si se propone, toda la sala vota. */
function roomAskPropose(plId, count) {
  openModal(T("Proponer a la sala"), (body, close) => {
    body.append(h("p", {}, T("Estás en una sala de Escuchar juntos. ¿Quieres proponer esta playlist ({n} canciones) para la sala? Se añadirá a la cola si la mayoría vota que sí.", { n: count })),
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", type: "button", onclick: async () => {
          close();
          if (!roomCan("propose")) { toast(T("El anfitrión no te ha dado permiso para hacer esto")); return; }
          await roomSend("propose", { playlist: plId });
          toast(T("Playlist propuesta: la sala está votando"));
        } }, T("Sí, proponerla")),
        h("button", { class: "btn", type: "button", onclick: close }, T("No"))));
  });
}

const roomProps = { seen: new Set(), done: new Set(), box: null, sig: "", timer: 0 };
function roomPropsClear() { if (roomProps.box) roomProps.box.remove(); roomProps.box = null; roomProps.sig = ""; clearInterval(roomProps.timer); roomProps.seen.clear(); roomProps.done.clear(); }
function roomProposals(list) {
  const me = state.user.username, members = room.members.length || 1;
  for (const p of list) {
    const key = room.code + ":" + p.id;
    if (p.status === "open") {
      if (!roomProps.seen.has(key)) { roomProps.seen.add(key); p.exp = Date.now() + p.left * 1000; if (p.by !== me) { chatBeep(); toast(T("{who} propone la playlist «{name}»: vota", { who: p.by, name: p.playlist.name })); } }
    } else if (!roomProps.done.has(key)) {
      roomProps.done.add(key);
      toast(p.status === "approved" ? T("La sala ha aprobado «{name}»: añadida a la cola", { name: p.playlist.name }) : T("La sala ha rechazado «{name}»", { name: p.playlist.name }));
    }
  }
  const open = list.filter((p) => p.status === "open");
  for (const p of open) { const old = roomProps.exps && roomProps.exps[p.id]; if (!roomProps.exps) roomProps.exps = {}; if (!old) roomProps.exps[p.id] = Date.now() + p.left * 1000; }
  const sig = open.map((p) => p.id + ":" + JSON.stringify(p.votes) + ":" + members).join("|");
  if (sig === roomProps.sig) return;
  roomProps.sig = sig;
  if (!open.length) { if (roomProps.box) roomProps.box.replaceChildren(); return; }
  if (!roomProps.box || !roomProps.box.isConnected) { roomProps.box = h("div", { class: "prop-dock", "aria-live": "polite" }); document.body.append(roomProps.box); }
  roomProps.box.replaceChildren(...open.map((p) => roomPropCard(p, me, members)));
  clearInterval(roomProps.timer);
  roomProps.timer = setInterval(() => {
    for (const el of document.querySelectorAll(".prop-left")) { const e = roomProps.exps && roomProps.exps[el.dataset.id]; if (e) el.textContent = Math.max(0, Math.round((e - Date.now()) / 1000)) + " s"; }
  }, 1000);
}
function roomPropCard(p, me, members) {
  const yes = Object.values(p.votes).filter((v) => v).length, no = Object.values(p.votes).filter((v) => !v).length;
  const mine = p.votes[me];
  const vote = async (v) => { try { applyRoom((await web("room/control", { code: room.code, action: "vote", proposal: p.id, yes: v })).room); } catch (e) { toast(e.message || String(e)); } };
  const rows = p.preview.map((t) => h("li", {}, coverEl(t.coverArt, t.title, 40), h("span", { class: "prop-t" }, t.title), h("span", { class: "muted small prop-a" }, t.artist || "")));
  if (p.total > p.preview.length) rows.push(h("li", { class: "muted small" }, T("… y {n} más", { n: p.total - p.preview.length })));
  return h("div", { class: "prop-card", role: "dialog", "aria-label": T("Votación de playlist") },
    h("div", { class: "prop-head" }, h("strong", {}, p.playlist.name), h("span", { class: "muted small" }, T("{who} la propone · {n} canciones", { who: p.by, n: p.total })),
      h("span", { class: "prop-left muted small", dataset: { id: String(p.id) } }, p.left + " s")),
    h("ul", { class: "prop-list" }, rows),
    h("div", { class: "prop-foot" },
      h("span", { class: "muted small" }, T("Sí {y} · No {n} · {m} en la sala", { y: yes, n: no, m: members })),
      h("button", { class: "btn" + (mine === true ? " primary" : ""), type: "button", onclick: () => vote(true) }, T("Sí, añadir")),
      h("button", { class: "btn" + (mine === false ? " danger" : ""), type: "button", onclick: () => vote(false) }, T("No"))));
}

async function roomSend(action, extra = {}) {
  try {
    const r = await web("room/control", { code: room.code, action, ...extra });
    applyRoom(r.room);
  } catch (e) { if (/ya no existe/i.test(e.message || "") || /no existe|no longer/i.test(e.message || "")) roomGone(); else toast(e.message || String(e)); }
}

function roomGone() {
  if (!room.active) return;
  roomStop();
  toast(T("La sala se ha cerrado"));
  if (parseHash().name === "together") render();
}

function roomStop() {
  clearInterval(room.timer);
  roomPropsClear();
  room.active = false; room.code = ""; room.members = []; room.memberInfo = []; room.perms = {}; room.songs = []; room.version = -1; room.loadedId = null;
  refreshMode();
  drawRoomBtn();
}

function drawRoomBtn() {
  const b = document.getElementById("room-btn");
  if (!b) return;
  b.classList.toggle("on", room.active);
  b.title = b.ariaLabel = room.active ? T("Sala {code} · {n} personas", { code: room.code, n: room.members.length }) : T("Escuchar juntos");
  const badge = b.querySelector(".bell-badge");
  if (badge) { badge.hidden = !room.active; badge.textContent = String(room.members.length); }
}

function applyRoom(st) {
  for (const m of st.chat || []) if (!room.chat.some((x) => x.id === m.id)) { room.chat.push(m); roomChatAdd(m); }
  const memSig = (st.members || []).join("|");
  const memChanged = memSig !== room.memSig;
  room.memSig = memSig;
  room.code = st.code; room.host = st.host; room.members = st.members; room.memberInfo = st.memberInfo || []; room.perms = st.perms || {}; room.defaults = st.defaults || {}; room.index = st.index; room.visibility = st.visibility || "private"; room.name = st.name || "";
  const changed = st.version !== room.version;
  room.version = st.version;
  if (st.songs) room.songs = st.songs;
  roomProposals(st.proposals || []);
  refreshMode();
  drawRoomBtn();
  if ((changed || memChanged) && parseHash().name === "together") drawTogetherPage();
  if (!room.songs.length) { if (changed) drawQueue(); return; }
  room.applying = true;
  try {
    const t = room.songs[st.index];
    if (!t) return;
    const expected = st.pos;
    if (changed || !player.current || player.current.id !== t.id) {
      player.queue = room.songs.slice(); player.index = st.index; player.current = t;
      player.fromPending = false; player.pending = []; player.history = []; player.ctx = null; player.mode = "normal"; refreshMode();
    }
    if (room.loadedId !== t.id || !audio.getAttribute("src")) {
      room.loadedId = t.id;
      loadCurrent();
      audio.addEventListener("loadedmetadata", () => { if (expected > 1) audio.currentTime = expected; if (!st.playing) audio.pause(); }, { once: true });
      return;
    }
    if (st.playing && audio.paused) audio.play().catch(() => {});
    if (!st.playing && !audio.paused) audio.pause();
    if (Math.abs((audio.currentTime || 0) - expected) > (st.playing ? 2.5 : 1) && isFinite(audio.duration)) audio.currentTime = expected;
  } finally { room.applying = false; if (changed) drawQueue(); }
}

/* Al entrar en una sala (o crearla) la cola de antes se vacía: manda la cola de la sala. */
function roomClearLocal() {
  finishFade();
  for (const el of [musicAudio, musicAudio2, radioAudio]) { el.pause(); el.removeAttribute("src"); el.load(); }
  audio = musicAudio;
  player.queue = []; player.index = -1; player.current = null; player.pending = []; player.history = []; player.fromPending = false; player.ctx = null;
  room.loadedId = null;
  if (player.ui && player.ui.title) { player.ui.title.textContent = ""; player.ui.artist.textContent = ""; try { refreshPlayButton(); } catch (e) { /* ignorar */ } }
  drawQueue();
}

function roomStart(st) {
  clearInterval(room.timer);
  roomClearLocal();
  room.active = true;
  room.version = -1;
  room.chat = []; roomChatUI = null;
  applyRoom(st);
  room.timer = setInterval(async () => {
    try { applyRoom((await web("room/state", { code: room.code, since: room.version, chatSince: room.chat.length ? room.chat[room.chat.length - 1].id : 0 })).room); }
    catch (e) { if (/existe|exist/i.test(e.message || "")) roomGone(); }
  }, 2000);
}

async function roomJoin(code) {
  const r = await web("room/join", { code });
  roomStart(r.room);
  return r.room;
}
async function roomCreate(visibility = "private", name = "") {
  const r = await web("room/create", { visibility, name });
  roomStart(r.room);
  return r.room;
}
async function roomLeave() {
  const code = room.code;
  roomStop();
  try { await web("room/leave", { code }); } catch (e) { /* ignorar */ }
}

let togetherBox = null;
function drawTogetherPage() {
  if (!togetherBox || !document.contains(togetherBox)) return;
  // El chat de la sala es un elemento que se conserva: al volver a colocarlo pierde el foco, así que se guarda y se restaura (si no, al pasar de canción dejaba de escribir).
  const ui = roomChatUI, inp = ui && ui.input;
  const keep = inp && document.activeElement === inp ? { a: inp.selectionStart, b: inp.selectionEnd } : null;
  const top = ui ? ui.list.scrollTop : 0, atEnd = ui ? ui.list.scrollHeight - ui.list.scrollTop - ui.list.clientHeight < 40 : true;
  togetherBox.replaceChildren(...(room.active ? roomInside() : roomOutside()));
  if (ui && ui.list.isConnected) ui.list.scrollTop = atEnd ? ui.list.scrollHeight : top;
  if (keep && inp.isConnected) { inp.focus({ preventScroll: true }); try { inp.setSelectionRange(keep.a, keep.b); } catch (e) { /* nada */ } }
}
const VIS_LABEL = () => ({ public: T("Pública"), private: T("Privada"), friends: T("Solo amigos") });
const VIS_HELP = () => ({ public: T("Aparece en la lista y puede entrar cualquiera."), private: T("No sale en ninguna lista: solo entra quien tenga el código."),
  friends: T("Solo la ven y pueden entrar tus amigos (os seguís los dos).") });
function visSelect(value, onchange) {
  const sel = h("select", { "aria-label": T("Quién puede entrar"), onchange: () => onchange(sel.value) },
    ["private", "friends", "public"].map((v) => h("option", { value: v, selected: v === value }, VIS_LABEL()[v])));
  return sel;
}
function openRoomsList(box) {
  const draw = (rooms) => box.replaceChildren(rooms.length ? h("ul", { class: "open-rooms" }, rooms.map((r) => h("li", {},
    h("div", { class: "or-info" },
      h("strong", {}, r.name || T("Sala de {name}", { name: r.hostName || r.host })),
      h("span", { class: "muted" }, ` · ${VIS_LABEL()[r.visibility]} · ${r.members === 1 ? T("1 persona") : T("{n} personas", { n: r.members })}`),
      r.title ? h("div", { class: "muted small" }, `${r.playing ? "▶" : "⏸"} ${r.title}${r.artist ? " — " + r.artist : ""}`) : null),
    h("button", { class: "btn", type: "button", onclick: async () => { try { await roomJoin(r.code); drawTogetherPage(); } catch (e) { showError(e); } } }, T("Unirme")))))
    : h("p", { class: "muted" }, T("Ahora mismo no hay salas abiertas.")));
  const load = async () => { try { draw((await web("room/list", {})).rooms); } catch (e) { /* ignorar */ } };
  load();
  const tick = setInterval(() => { if (!document.contains(box)) return clearInterval(tick); load(); }, 6000);
}
function roomOutside() {
  const code = h("input", { type: "text", maxlength: 8, placeholder: "ABCDE", autocomplete: "off", style: { textTransform: "uppercase", width: "140px" } });
  const join = async () => { try { await roomJoin(code.value.trim()); drawTogetherPage(); } catch (e) { showError(e); } };
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); join(); } });
  let vis = "private";
  const help = h("p", { class: "muted small" }, VIS_HELP().private);
  const name = h("input", { type: "text", maxlength: 40, placeholder: T("Nombre de la sala (opcional)"), "aria-label": T("Nombre de la sala (opcional)") });
  const list = h("div", {});
  openRoomsList(list);
  return [
    h("p", { class: "muted" }, T("Crea una sala y comparte el código: todos los que entren oirán la misma canción a la vez. Tú eres el anfitrión y decides qué puede hacer cada invitado.")),
    h("div", { class: "panel" },
      h("div", { class: "field" }, h("label", {}, T("Nombre")), name),
      h("div", { class: "field" }, h("label", {}, T("Quién puede entrar")), visSelect(vis, (v) => { vis = v; help.textContent = VIS_HELP()[v]; }), help),
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", type: "button", onclick: async () => { try { await roomCreate(vis, name.value.trim()); drawTogetherPage(); } catch (e) { showError(e); } } },
          icon("users", 16), T("Crear una sala")))),
    h("h2", {}, T("Salas abiertas")), list,
    h("h2", {}, T("Unirme con un código")),
    h("div", { class: "trow" }, code, h("button", { class: "btn", type: "button", onclick: join }, T("Unirme")))];
}
const ROOM_PERM_KEYS = ["play", "skip", "add", "move", "propose"];
const PERM_LABEL = () => ({ play: T("Pausar y adelantar"), skip: T("Cambiar de canción"), add: T("Añadir canciones"), move: T("Mover, quitar y mezclar canciones"), propose: T("Proponer playlists") });
function permChecks(perms, onchange) {
  return h("div", { class: "perm-checks" }, ROOM_PERM_KEYS.map((k) => h("label", { class: "check" },
    h("input", { type: "checkbox", checked: !!perms[k], onchange: (e) => onchange(k, e.target.checked, e.target) }), h("span", {}, PERM_LABEL()[k]))));
}
function memberRow(m) {
  const isHost = m.username === room.host, imHost = room.host === state.user.username;
  const perms = room.perms[m.username] || {};
  const li = h("li", { class: "room-member" },
    h("div", { class: "rm-line" },
      avatarEl(m, "sm"),
      h("a", { href: `#/user/${encodeURIComponent(m.username)}` }, m.displayName ? `${m.displayName} (@${m.username})` : m.username),
      h("span", { class: "muted small rm-role" }, isHost ? T("anfitrión") : T("invitado"))));
  if (imHost && !isHost) {
    li.append(permChecks(perms, async (k, v, box) => {
      try { applyRoom((await web("room/perms", { code: room.code, username: m.username, perms: { [k]: v } })).room); }
      catch (e) { box.checked = !v; showError(e); }
    }));
  } else if (!isHost && m.username === state.user.username) {
    const on = ROOM_PERM_KEYS.filter((k) => perms[k]).map((k) => PERM_LABEL()[k]);
    li.append(h("div", { class: "muted small" }, on.length ? T("Puedes: {list}", { list: on.join(", ") }) : T("Solo puedes escuchar.")));
  }
  return li;
}
function defaultPermsBox() {
  return h("details", { class: "panel" }, h("summary", {}, T("Permisos de los invitados nuevos")),
    h("p", { class: "muted small" }, T("Lo que podrán hacer los que entren a partir de ahora. A cada uno ya presente se le cambia arriba.")),
    permChecks(room.defaults, async (k, v, box) => {
      try { applyRoom((await web("room/perms", { code: room.code, perms: { [k]: v } })).room); }
      catch (e) { box.checked = !v; showError(e); }
    }));
}
/* Chat de la sala: lo ven todos los que están dentro y se borra al cerrarse la sala. Es un solo elemento que se conserva al redibujar la página. */
let roomChatUI = null;
function roomChatAdd(m) {
  if (!roomChatUI) return;
  const l = roomChatUI.list, near = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
  roomChatUI.empty.remove();
  const info = room.memberInfo.find((x) => x.username === m.user) || { username: m.user };
  l.append(h("div", { class: "rchat-msg" + (m.user === state.user.username ? " mine" : "") },
    avatarEl(info, "xs"), h("div", { class: "rchat-body" }, h("span", { class: "rchat-user" }, info.displayName || m.user), h("span", { class: "rchat-text" }, m.text))));
  if (near || m.user === state.user.username) l.scrollTop = l.scrollHeight;
}
function roomChatBox() {
  if (!roomChatUI) {
    const list = h("div", { class: "rchat-list" });
    const empty = h("p", { class: "muted small rchat-empty" }, T("Escribe algo: lo ve toda la sala. Este chat se borra cuando la sala se cierra."));
    list.append(empty);
    const input = h("input", { type: "text", class: "rchat-input", maxlength: 500, placeholder: T("Escribe un mensaje…"), "aria-label": T("Chat de la sala"), autocomplete: "off" });
    const form = h("form", { class: "rchat-form", onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      try { await web("room/chat", { code: room.code, text }); } catch (ex) { input.value = text; showError(ex); }
    } }, input, h("button", { class: "icon-btn chat-send", type: "submit", title: T("Enviar"), "aria-label": T("Enviar") }, icon("send", 20)));
    const el = h("section", { class: "panel rchat" }, h("h2", {}, T("Chat de la sala")), list, form);
    roomChatUI = { el, list, empty, input };
    for (const m of room.chat) roomChatAdd(m);
  }
  return roomChatUI.el;
}
function roomInside() {
  const link = roomLink(room.code);
  return [
    h("div", { class: "panel" },
      room.name ? h("h2", {}, room.name) : null,
      h("p", { class: "muted" }, `${T("Código de la sala")} · ${VIS_LABEL()[room.visibility]}`),
      h("div", { class: "room-code" }, room.code),
      room.host === state.user.username ? h("div", { class: "field" }, h("label", {}, T("Quién puede entrar")),
        visSelect(room.visibility, async (v) => { try { applyRoom((await web("room/settings", { code: room.code, visibility: v })).room); toast(T("Guardado")); } catch (e) { showError(e); drawTogetherPage(); } })) : null,
      h("div", { class: "album-actions" },
        h("button", { class: "btn", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(link); toast(T("Enlace copiado")); } catch (e) { toast(link); } } }, T("Copiar enlace")),
        h("button", { class: "btn danger", type: "button", onclick: async () => { await roomLeave(); drawTogetherPage(); } }, T("Salir de la sala")))),
    h("h2", {}, T("En la sala ({n})", { n: room.members.length })),
    h("ul", { class: "room-members" }, (room.memberInfo.length ? room.memberInfo : room.members.map((u) => ({ username: u }))).map((m) => memberRow(m))),
    room.host === state.user.username ? defaultPermsBox() : null,
    roomChatBox(),
    room.songs.length ? h("p", { class: "muted" }, T("Suena: {title}", { title: (room.songs[room.index] || {}).title || "" }))
      : h("p", { class: "muted" }, T("Todavía no hay música: pon una playlist o un álbum y sonará para todos."))];
}
async function togetherView(arg) {
  if (arg && !room.active) { try { await roomJoin(arg); } catch (e) { toast(e.message); } }
  togetherBox = h("div", {});
  const page = h("div", {}, h("h1", {}, T("Escuchar juntos")), togetherBox);
  setTimeout(drawTogetherPage, 0);
  return page;
}

/* ---------- amigos escuchando ---------- */
function friendsNowSection(list) {
  return section(T("Tus amigos están escuchando"), h("ul", { class: "friends-now" }, list.map((f) => h("li", {},
    h("a", { href: `#/user/${encodeURIComponent(f.username)}` }, avatarEl({ username: f.username, displayName: f.displayName, avatar: f.avatar }, "sm")),
    h("button", { class: "linkish friend-song", type: "button", disabled: !f.song, onclick: () => f.song && playQueue([f.song], 0, null) },
      h("strong", {}, f.displayName || f.username), h("span", { class: "muted" }, ` · ${f.title}${f.artist ? " — " + f.artist : ""}`))))));
}

function mixTile(m) {
  const names = { daily: T("Mix diario"), rediscover: T("Redescubre") };
  const title = names[m.id] || m.name;
  const first = m.songs[0];
  const sub = [...new Set(m.songs.slice(0, 4).map((s) => nm(s.artist || "")))].join(", ");
  return h("button", { class: "tile mix-tile", type: "button", onclick: () => playQueue(m.songs, 0, null) },
    h("div", { class: "mix-cover" }, coverEl(first && first.coverArt, title, 300), h("span", { class: "mix-badge" }, icon("play", 18))),
    h("div", { class: "t-title", title }, title), h("div", { class: "t-sub" }, sub));
}

function bannerCarousel(banners, seconds) {
  let cur = 0, hover = false;
  const slide = (b) => {
    const tag = b.link ? "a" : "div";
    const attrs = { class: "ad-slide", style: { background: b.image ? `linear-gradient(90deg, rgba(0,0,0,.65), rgba(0,0,0,.15)), url("${b.image.replace(/"/g, "%22")}") center/cover` : `linear-gradient(120deg, ${b.color || "#3b4cca"}, color-mix(in srgb, ${b.color || "#3b4cca"} 40%, #000))` } };
    if (b.link) { attrs.href = b.link; if (/^https?:/i.test(b.link)) { attrs.target = "_blank"; attrs.rel = "noopener noreferrer"; } }
    return h(tag, attrs, b.title ? h("h2", {}, b.title) : null, b.text ? h("p", {}, b.text) : null);
  };
  const slides = banners.map(slide);
  const dots = banners.map((_, i) => h("button", { class: "ad-dot", type: "button", "aria-label": `${i + 1}`, onclick: () => go(i) }));
  const root = h("div", { class: "ad-banner", onmouseenter: () => { hover = true; }, onmouseleave: () => { hover = false; } },
    h("div", { class: "ad-slides" }, slides), banners.length > 1 ? h("div", { class: "ad-dots" }, dots) : null);
  function go(i) {
    cur = (i + banners.length) % banners.length;
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    dots.forEach((d, k) => d.classList.toggle("on", k === cur));
  }
  go(0);
  if (banners.length > 1) {
    const tick = setInterval(() => { if (!document.contains(root)) return clearInterval(tick); if (!hover && !document.hidden) go(cur + 1); }, (seconds || 7) * 1000);
  }
  return root;
}

async function homeView() {
  const get = (type) => api("getAlbumList2", { type, size: 12 }).then((r) => r.albumList2.album || []);
  const [lib, rec, mixes, newest, random] = await Promise.all([
    web("library", {}).catch(() => ({ items: [] })), web("home/recommend", {}).catch(() => ({ albums: [], basedOn: [] })),
    web("home/mixes", {}).catch(() => ({ mixes: [], rediscover: null })), get("newest"), get("random")]);
  const friends = await web("friends/now", {}).catch(() => ({ friends: [] }));
  const mixList = [...mixes.mixes, ...(mixes.rediscover ? [mixes.rediscover] : [])];
  const ads = await web("home/banners", { lang: LANG }).catch(() => ({ enabled: false, banners: [] }));
  const lists = lib.items.filter((i) => i.kind === "playlist").sort((a, b) => b.stamp - a.stamp).slice(0, 12);
  const name = state.user.displayName || state.user.username;
  return h("div", {},
    ads.enabled && ads.banners.length ? bannerCarousel(ads.banners, ads.seconds) : null,
    h("h1", {}, T("Hola, {name}", { name })),
    h("div", { class: "pill-links" },
      h("a", { class: "pill", href: "#/artists" }, T("Todos los artistas")),
      h("a", { class: "pill", href: "#/albums" }, T("Todos los álbumes"))),
    !newest.length ? emptyLibrary() : null,
    friends.friends.length ? friendsNowSection(friends.friends) : null,
    lists.length ? section(T("Playlists que has escuchado"), h("div", { class: "grid" }, lists.map((p) => h("a", { class: "tile", href: `#/playlist/${p.id}` },
      coverEl(p.cover ? p.id : null, p.name, 300, "", p.cover),
      h("div", { class: "t-title", title: p.name }, p.name),
      h("div", { class: "t-sub" }, p.author || ""))))) : null,
    rec.albums.length ? section(T("Recomendado para ti"),
      h("p", { class: "muted small", style: { marginTop: "-6px" } }, T("Porque escuchas {names}", { names: rec.basedOn.join(", ") })), albumGrid(rec.albums)) : null,
    mixList.length ? section(T("Tus mixes"), h("div", { class: "grid" }, mixList.map((m) => mixTile(m)))) : null,
    random.length ? section(T("Para descubrir"), albumGrid(random)) : null,
    newest.length ? section(T("Añadido hace poco"), albumGrid(newest)) : null);
}


async function artistsView() {
  const r = await api("getArtists");
  const groups = r.artists.index || [];
  if (!groups.length) return h("div", {}, h("h1", {}, T("Artistas")), emptyLibrary());
  return h("div", {}, h("h1", {}, T("Artistas")),
    groups.map((g) => h("section", {},
      h("h2", { class: "letter" }, g.name),
      h("ul", { class: "artist-list" }, g.artist.map((a) => h("li", {},
        h("a", { href: `#/artist/${a.id}` },
          coverEl(a.coverArt, a.name, 120, "round"),
          h("span", { class: "a-name" }, nm(a.name)),
          h("span", { class: "muted small" }, plural(a.albumCount, "album")))))))));
}


async function artistView(id) {
  const [{ artist }, page] = await Promise.all([api("getArtist", { id }), web("artist/page", { id })]);
  const all = artist.album || [];
  const own = all.filter((a) => !a.appearsOn);          // discos del artista
  const feat = all.filter((a) => a.appearsOn);          // discos de otros donde colabora
  const ctx = { kind: "artist", id: artist.id };
  const songs = page.songs || [];
  const trashed = trash.artist.has(artist.id);
  const target = () => ({ type: "artist", id: artist.id, name: artist.name, play: () => playQueue(songs, 0, ctx) });
  const root = h("div", { class: "artist-page" });

  const photo = coverEl(page.photo ? artist.id : null, artist.name, 600, "round", page.photo);
  const stats = [plural(page.songCount, "song"), page.plays ? plural(page.plays, "play") : null,
    page.listeners ? `${nf.format(page.listeners)} ${page.listeners === 1 ? T("oyente") : T("oyentes")}` : null].filter(Boolean).join(" · ");
  const bioBox = h("p", { class: "artist-bio" }, page.bio || "");
  const hero = h("div", { class: "artist-hero" },
    photo,
    h("div", { class: "artist-hero-meta" },
      h("p", { class: "kind" }, T("Artista")),
      h("h1", {}, nm(artist.name)),
      h("p", { class: "muted" }, stats),
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", onclick: () => playQueue(songs, 0, ctx), disabled: !songs.length }, icon("play", 16), T("Reproducir")),
        h("button", { class: "btn", onclick: () => playQueue(shuffled(songs), 0, ctx), disabled: !songs.length }, T("Aleatorio")),
        heartBtn("artist", artist.id), artistBell(artist.id),
        shareBtn("artist", artist.id, artist.name),
        h("button", { class: "btn small", onclick: () => setTrashed("artist", artist.id, !trashed) }, icon("trash", 16),
          trashed ? T("Restaurar de la papelera") : T("Mover a la papelera")),
        state.user.isAdmin ? h("button", { class: "btn small", onclick: () => openEditor() }, T("Editar perfil")) : null)));
  root.append(hero);
  if (trashed) root.append(h("p", { class: "notice" }, T("Este artista está en tu papelera: no sonará en tus colas.")));

  if (page.popular.length) {
    const pctx = { kind: "artist", id: artist.id };
    root.append(section(T("Populares"), h("ol", { class: "tracks" },
      page.popular.map((s, i) => songRow(s, i, page.popular, true, true, { ctx: pctx })))));
  }
  const bioSection = h("section", { class: "section artist-about" }, h("h2", {}, T("Acerca de")), bioBox);
  bioSection.hidden = !page.bio;
  root.append(bioSection);
  if (own.length) root.append(section(T("Discografía"), albumGrid(own)));
  if (feat.length) root.append(section(T("Aparece en"), albumGrid(feat)));

  function openEditor() {
    const old = root.querySelector(".artist-editor");
    if (old) { old.remove(); return; }
    const bio = h("textarea", { rows: 7, maxlength: 4000, placeholder: T("Biografía del artista") }, page.bio || "");
    const msg = h("p", { class: "muted small" });
    const guard = async (fn) => { try { await fn(); } catch (e) { showError(e); } };
    const ed = h("section", { class: "panel artist-editor" },
      h("h2", {}, T("Editar perfil")),
      h("div", { class: "field" }, h("label", {}, T("Biografía"), bio)),
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", onclick: () => guard(async () => { await web("artist/update", { id: artist.id, bio: bio.value }); toast(T("Guardado")); render(); }) }, T("Guardar")),
        h("button", { class: "btn", onclick: () => guard(async () => {
          const f = await pickImage(); if (!f) return;
          await uploadImage("artist-photo?id=" + encodeURIComponent(artist.id), f); toast(T("Foto guardada")); render();
        }) }, T("Subir foto")),
        h("button", { class: "btn", onclick: () => guard(async () => { await web("artist/update", { id: artist.id, bio: bio.value, removePhoto: true }); render(); }) }, T("Quitar foto")),
        h("button", { class: "btn", onclick: () => guard(async () => {
          msg.textContent = T("Buscando…");
          const r = await web("artist/autofill", { id: artist.id, lang: LANG, force: true });
          if (!r.found.photo && !r.found.bio) { msg.textContent = (r.errors && r.errors[0]) || T("No se ha encontrado nada nuevo."); return; }
          toast(T("Perfil actualizado")); render();
        }) }, T("Buscar foto y biografía en internet"))),
      msg);
    hero.after(ed);
  }

  onContext(hero, target);
  // Si no hay foto ni biografía y eres admin, se intentan rellenar solos una vez (necesita internet en el servidor).
  if (state.user.isAdmin && !page.photo && !page.bio && !sessionStorageGet("af-" + artist.id)) {
    sessionStorageSet("af-" + artist.id, "1");
    web("artist/autofill", { id: artist.id, lang: LANG }).then((r) => { if (r.found.photo || r.found.bio) render(); }).catch(() => {});
  }
  return root;
}

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* nada */ } }


async function trashView() {
  await loadTrash();
  const kinds = [["artist", T("Artistas")], ["album", T("Álbumes")], ["song", T("Canciones")]];
  const clear = h("button", { class: "btn small", onclick: async () => {
    try { await web("trash/remove", { all: true }); await loadTrash(); toast(T("Papelera vaciada")); render(); } catch (e) { showError(e); }
  } }, T("Restaurar todo"));
  const blocks = kinds.map(([k, label]) => {
    const items = trash.items.filter((x) => x.kind === k);
    if (!items.length) return null;
    return section(label, h("ul", { class: "trash-list" }, items.map((x) =>
      h("li", { class: "user-row" },
        h("a", { class: "user-link", href: k === "song" ? `#/song/${x.id}` : `#/${k}/${x.id}` },
          x.coverArt ? coverEl(x.coverArt, x.name, 80, k === "artist" ? "round" : "") : null,
          h("span", { class: "grow" }, h("span", { class: "a-name" }, nm(x.name)), x.sub ? h("span", { class: "muted small block" }, nm(x.sub)) : null)),
        h("button", { class: "btn small", onclick: () => setTrashed(k, x.id, false) }, T("Restaurar"))))));
  }).filter(Boolean);
  return h("div", {}, h("div", { class: "title-row" }, h("h1", {}, T("Papelera")), trash.items.length ? clear : null),
    h("p", { class: "muted" }, T("Lo que pones aquí solo lo dejas de oír tú: se salta al reproducir, pero no se borra del servidor.")),
    blocks.length ? blocks : h("p", { class: "muted" }, T("La papelera está vacía.")));
}


async function albumsView() {
  const SIZE = 60;
  let offset = 0;
  const grid = h("div", { class: "grid" });
  const more = h("button", { class: "btn", hidden: true }, T("Cargar más"));
  async function load() {
    const r = await api("getAlbumList2", { type: "alphabeticalByName", size: SIZE, offset });
    const list = r.albumList2.album || [];
    list.forEach((a) => grid.append(albumTile(a)));
    offset += list.length;
    more.hidden = list.length < SIZE;
  }
  more.addEventListener("click", () => load().catch(showError));
  await load();
  if (!offset) return h("div", {}, h("h1", {}, T("Álbumes")), emptyLibrary());
  return h("div", {}, h("h1", {}, T("Álbumes")), grid, h("p", {}, more));
}


async function albumView(id) {
  const { album } = await api("getAlbum", { id });
  const songs = album.song || [];
  const total = songs.reduce((n, s) => n + (s.duration || 0), 0);
  const multiDisc = songs.some((s) => (s.discNumber || 1) > 1);
  const ctx = { kind: "album", id: album.id };
  const rows = [];
  let lastDisc = null;
  songs.forEach((s, i) => {
    const disc = s.discNumber || 1;
    if (multiDisc && disc !== lastDisc) { rows.push(h("li", { class: "disc" }, T("Disco {n}", { n: disc }))); lastDisc = disc; }
    rows.push(songRow(s, i, songs, s.artist !== album.artist, false, { ctx, noCover: true }));
  });
  const facts = [album.year, album.genre, plural(songs.length, "song"), fmtTotal(total)].filter(Boolean).join(", ");
  const target = () => ({ type: "album", id: album.id, name: album.name, play: () => playQueue(songs, 0, ctx) });
  const head = h("div", { class: "album-head" },
    coverEl(album.coverArt, album.name, 600),
    h("div", {},
      h("h1", {}, nm(album.name)),
      h("p", { class: "album-meta" }, h("a", { href: `#/artist/${album.artistId}` }, nm(album.artist))),
      h("p", { class: "muted" }, facts),
      h("div", { class: "album-actions" },
        h("button", { class: "btn primary", onclick: () => playQueue(songs, 0, ctx) }, icon("play", 16), T("Reproducir")),
        h("button", { class: "btn", onclick: () => playQueue(shuffled(songs), 0, ctx) }, T("Aleatorio")),
        heartBtn("album", album.id),
        offlineBtn("album", album.id, album.name, () => songs, album.coverArt),
        moreBtn(target))));
  onContext(head, target);
  return h("div", {}, head, h("ol", { class: "tracks" }, rows));
}


function followBtn(card, onChange) {
  const btn = h("button", { class: "btn small" });
  const draw = () => {
    btn.textContent = card.isFollowing ? T("Siguiendo") : T("Seguir");
    btn.classList.toggle("primary", !card.isFollowing);
    btn.setAttribute("aria-pressed", String(card.isFollowing));
  };
  draw();
  btn.addEventListener("click", async (e) => {
    e.preventDefault(); e.stopPropagation();
    try {
      Object.assign(card, (await web("user/follow", { username: card.username, follow: !card.isFollowing })).user);
      draw();
      if (onChange) onChange(card);
    } catch (ex) { showError(ex); }
  });
  return btn;
}

function userRow(card) {
  return h("li", { class: "user-row" },
    h("a", { href: `#/user/${encodeURIComponent(card.username)}`, class: "user-link" },
      avatarEl(card), h("span", { class: "grow" }, h("span", { class: "a-name" }, card.displayName || card.username),
        h("span", { class: "muted small block" }, `@${card.username}`, card.friend ? [" · ", h("span", { class: "friend-tag" }, icon("users", 13), T("Amigos"))] : card.followsMe ? ` · ${T("Te sigue")}` : ""))),
    card.isMe ? null : followBtn(card));
}

async function songView(id) {
  const { song: s } = await api("getSong", { id });
  const play = () => playQueue([s], 0, null);
  const target = () => ({ type: "song", id: s.id, name: s.title, song: s, play, go: s.albumId ? `#/album/${s.albumId}` : null,
    artistId: (s.artists && s.artists[0] && s.artists[0].id) || s.artistId });
  return h("div", { class: "song-page" },
    h("div", { class: "album-head" },
      h("div", { class: "cover" }, coverEl(s.coverArt, s.title, 600)),
      h("div", {},
        h("p", { class: "kind" }, T("Canción")),
        h("h1", {}, s.title),
        h("p", { class: "album-meta" }, artistLinks(s)),
        h("p", { class: "muted" }, [s.albumId ? null : null, s.year, fmtTime(s.duration)].filter(Boolean).join(" · ")),
        s.albumId ? h("p", { class: "album-meta" }, h("a", { href: `#/album/${s.albumId}` }, nm(s.album))) : null,
        h("div", { class: "album-actions" },
          h("button", { class: "btn primary", onclick: play }, icon("play", 18), " ", T("Reproducir")),
          h("button", { class: "btn", onclick: () => addToQueue([s]) }, T("Añadir a la cola")),
          shareBtn("song", s.id, s.title),
          moreBtn(target)))),
    songLyrics(s, play));
}

function songLyrics(s, play) {
  const box = lyricsBox(s.id, (t) => {
    if (!currentTrack() || currentTrack().id !== s.id) { play(); audio.addEventListener("loadedmetadata", () => seekTo(t), { once: true }); } else seekTo(t);
  });
  return h("section", { class: "section lyrics-slot" }, h("h2", {}, T("Letra")), lyricsTools(box), box);
}

async function searchView(query) {
  const q = (query || "").trim();
  if (!q) return h("div", { class: "empty" }, h("p", {}, T("Escribe en el buscador para encontrar artistas, álbumes, canciones o personas.")));
  const r = await web("search", { q });
  const artists = r.artist || [], albums = r.album || [], songs = r.song || [], people = r.users || [];
  if (!artists.length && !albums.length && !songs.length && !people.length) {
    return h("div", {}, h("h1", {}, T("Buscar")), h("div", { class: "empty" }, h("p", {}, T("No hay resultados para «{q}». Prueba con menos palabras.", { q }))));
  }
  const blocks = {
    users: () => people.length ? section(T("Personas"), h("ul", { class: "user-list" }, people.map(userRow))) : null,
    artist: () => artists.length ? section(T("Artistas"), h("ul", { class: "artist-list" }, artists.map((a) => h("li", {},
      h("a", { href: `#/artist/${a.id}` }, coverEl(a.coverArt, a.name, 120, "round"), h("span", { class: "a-name" }, nm(a.name))))))) : null,
    song: () => songs.length ? section(T("Canciones"), h("ol", { class: "tracks" }, songs.map((s, i) => songRow(s, i, songs, true, true)))) : null,
    album: () => albums.length ? section(T("Álbumes"), albumGrid(albums)) : null,
  };
  return h("div", {}, h("h1", {}, T("Resultados para «{q}»", { q })), (r.order || ["song", "artist", "album", "users"]).map((k) => blocks[k] && blocks[k]()));
}

function showFollowList(u, kind) {
  openModal(kind === "followers" ? T("Seguidores de {name}", { name: u.displayName || u.username }) : T("Seguidos por {name}", { name: u.displayName || u.username }), (body, close) => {
    window.addEventListener("hashchange", close, { once: true });
    body.append(h("p", { class: "muted" }, T("Cargando…")));
    web("user/follows", { username: u.username, kind }).then((r) => {
      body.replaceChildren(r.users.length ? h("ul", { class: "user-list one-col" }, r.users.map(userRow)) : h("p", { class: "muted" }, T("Nadie por aquí todavía.")));
    }).catch((e) => { body.replaceChildren(h("p", { class: "muted" }, e.message)); });
  });
}

async function userView(username) {
  const data = await web("user/profile", { username });
  const u = data.user;
  const counts = h("span", { class: "muted" });
  const drawCounts = () => {
    const mk = (kind, label, can) => can
      ? h("button", { class: "linkish", type: "button", onclick: () => showFollowList(u, kind) }, label)
      : h("span", { title: T("Este usuario no muestra esa lista.") }, label);
    counts.replaceChildren(mk("followers", T("{n} seguidores", { n: nf.format(u.followers) }), u.canSeeFollowers), " · ",
      mk("following", T("{n} siguiendo", { n: nf.format(u.following) }), u.canSeeFollowing));
    if (u.friend) counts.append(" · ", h("span", { class: "friend-tag" }, icon("users", 14), T("Amigos")));
    else if (u.followsMe) counts.append(` · ${T("Te sigue")}`);
  };
  drawCounts();
  const ubell = userBell(u);
  return h("div", { class: "profile-page user-page" },
    u.banner ? h("div", { class: "user-banner", style: { backgroundImage: `url("/img/banner/${encodeURIComponent(u.username)}?v=${u.banner}")` } }) : null,
    h("div", { class: "user-head" + (u.banner ? " has-banner" : "") },
      avatarEl(u, "xl"),
      h("div", { class: "grow" },
        h("p", { class: "eyebrow" }, T("Perfil")),
        h("h1", {}, u.displayName || u.username),
        u.bio ? h("p", { class: "bio" }, u.bio) : null,
        h("p", {}, counts),
        u.isMe ? h("a", { class: "btn", href: "#/profile" }, T("Editar perfil")) : h("span", { class: "album-actions" }, followBtn(u, (c) => { drawCounts(c); ubell.refresh(); }), ubell,
          u.friend ? h("button", { class: "btn small", type: "button", onclick: () => chatOpen(u) }, icon("chat", 15), T("Mensaje")) : null))),
    section(T("Playlists públicas"), data.playlists.length
      ? h("div", { class: "grid" }, data.playlists.map((p) => h("a", { class: "tile", href: `#/playlist/${p.id}` },
        coverEl(p.cover ? p.id : null, p.name, 300, "", p.cover),
        h("div", { class: "t-title", title: p.name }, p.name),
        h("div", { class: "t-sub" }, T("{n} canciones", { n: nf.format(p.songCount) })))))
      : h("p", { class: "muted" }, T("Todavía no tiene playlists públicas."))));
}

async function radiosView() {
  const r = await api("getInternetRadioStations");
  const stations = r.internetRadioStations.internetRadioStation || [];
  const isAdmin = state.user.isAdmin;
  const list = stations.length
    ? h("ul", { class: "radio-list" }, stations.map((s) => h("li", {},
      h("button", { class: "btn", onclick: () => playQueue([{ radio: true, id: s.id, title: s.name, artist: T("Radio en directo"), url: s.streamUrl, coverArt: s.coverArt }], 0) }, icon("play", 16), T("Escuchar")),
      h("div", { class: "r-cover" }, coverEl(s.coverArt, s.name, 120)),
      h("div", { class: "grow" }, h("div", { class: "r-name" }, s.name), h("div", { class: "muted small" }, s.streamUrl)),
      isAdmin ? h("button", {
        class: "btn danger",
        onclick: async () => {
          if (!confirm(T("¿Borrar la radio «{name}»?", { name: s.name }))) return;
          try { await api("deleteInternetRadioStation", { id: s.id }, true); render(); } catch (e) { showError(e); }
        },
      }, T("Borrar")) : null)))
    : h("div", { class: "empty" }, h("p", {}, isAdmin
      ? T("Todavía no hay radios. Añade la URL directa de un stream (por ejemplo, una que termine en .mp3 o .aac).")
      : T("Todavía no hay radios. Pídele al administrador que añada alguna.")));

  let form = null;
  if (isAdmin) {
    const name = h("input", { type: "text", required: true, autocomplete: "off" });
    const url = h("input", { type: "url", required: true, placeholder: "https://...", autocomplete: "off" });
    const home = h("input", { type: "url", placeholder: T("https://... (opcional)"), autocomplete: "off" });
    form = h("form", {
      class: "inline-form",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          await api("createInternetRadioStation", { name: name.value.trim(), streamUrl: url.value.trim(), homepageUrl: home.value.trim() || undefined }, true);
          render();
        } catch (ex) { showError(ex); }
      },
    },
    h("div", { class: "field" }, h("label", {}, T("Nombre"), name)),
    h("div", { class: "field" }, h("label", {}, T("URL del stream"), url)),
    h("div", { class: "field" }, h("label", {}, T("Página web"), home)),
    h("button", { class: "btn primary", type: "submit" }, T("Añadir radio")));
  }
  return h("div", {}, h("h1", {}, "Radios"), list, isAdmin ? h("h2", {}, T("Añadir una radio")) : null, form);
}


/* ---------- Wrapped ---------- */

function rankList(title, items) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.plays));
  return h("section", {},
    h("h2", {}, title),
    h("ol", { class: "rank" }, items.map((it, i) => h("li", {},
      h("span", { class: "rank-n" }, i + 1),
      h("div", {},
        h("div", { class: "rank-label" }, it.label, it.sub ? h("span", { class: "muted" }, it.sub) : null),
        h("div", { class: "bar" }, h("i", { style: { width: `${Math.max(2, Math.round((it.plays / max) * 100))}%` } }))),
      h("span", { class: "rank-count" }, nf.format(it.plays))))));
}

function barChart(title, values, labels, unit) {
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return h("section", {},
    h("h2", {}, title),
    h("div", { class: "bars" }, values.map((v, i) => h("div", {
      class: i === peak && v > 0 ? "peak" : "", style: { height: `${Math.max(3, Math.round((v / max) * 100))}%` },
      title: `${unit(i)}: ${plural(v, "play")}`,
    }))),
    h("div", { class: "bar-labels" }, labels.map((l) => h("span", {}, l))));
}

function renderWrapped(w) {
  if (!w.totalPlays && !(w.topRadios && w.topRadios.length)) {
    return h("div", { class: "empty" }, h("p", {},
      T("Todavía no hay reproducciones en {year}. Cada canción que escuches desde aquí o desde tus apps cuenta para tu Wrapped.", { year: w.year })));
  }
  const top = w.topArtists[0];
  const radios = w.topRadios || [];
  const monthFmt = (style) => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(LOCALE, { month: style }).format(new Date(2000, i, 1)));
  const months = monthFmt("long");
  const monthLetters = monthFmt("short").map((m) => m.charAt(0).toUpperCase());
  return h("div", {},
    h("div", {},
      h("div", { class: "big-num" }, nf.format(w.minutesListened)),
      h("div", { class: "big-label" }, T("minutos de música en {year}: {plays} de {songs}.", { year: w.year, plays: plural(w.totalPlays, "play"), songs: plural(w.uniqueSongs, "distinct") }))),
    !w.totalPlays ? null : top ? h("div", { class: "wrapped-artist" },
      h("div", { class: "top-artist" }, nm(top.name)),
      h("p", { class: "muted" }, T("Tu artista del año, con {plays}.", { plays: plural(top.plays, "play") }))) : null,
    h("div", { class: "wrapped-cols" },
      rankList(T("Artistas"), w.topArtists.map((a) => ({ label: nm(a.name), plays: a.plays }))),
      rankList(T("Canciones"), w.topSongs.map((s) => ({ label: s.title, sub: nm(s.artist), plays: s.plays }))),
      rankList(T("Álbumes"), w.topAlbums.map((a) => ({ label: nm(a.album), sub: nm(a.artist), plays: a.plays }))),
      rankList(T("Géneros"), w.topGenres.map((g) => ({ label: g.name, plays: g.plays })))),
    radios.length ? h("section", { class: "wrapped-radios" },
      h("div", { class: "big-label" }, T("Has escuchado {n} minutos de radio en {year}. Tu radio del año:", { n: nf.format(w.radioMinutes), year: w.year })),
      h("div", { class: "top-artist" }, radios[0].name),
      h("div", { class: "wrapped-cols" }, rankList(T("Radios"), radios.map((r) => ({ label: r.name, sub: T("minutos · puesta {n} veces", { n: r.sessions }), plays: r.minutes }))))) : null,
    h("div", { class: "wrapped-cols" },
      barChart(T("Por mes"), w.playsByMonth, monthLetters, (i) => months[i]),
      barChart(T("Por hora del día"), w.playsByHour, Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? String(i) : "")), (i) => `${i}:00`)));
}

async function wrappedView() {
  const thisYear = new Date().getFullYear();
  const select = h("select", { "aria-label": T("Año") }, [0, 1, 2, 3, 4].map((i) => h("option", { value: thisYear - i }, thisYear - i)));
  const body = h("div", {});
  async function load() {
    body.replaceChildren(h("p", { class: "muted" }, T("Calculando...")));
    body.replaceChildren(renderWrapped(await getJSON(`/api/wrapped?year=${select.value}&limit=10`)));
  }
  select.addEventListener("change", () => load().catch((e) => body.replaceChildren(errorBox(e))));
  const view = h("div", {}, h("div", { class: "wrapped-top" }, h("h1", {}, "Wrapped"), select), body);
  await load();
  return view;
}


/* ---------- playlists ---------- */

/* Copia de las playlists ya abiertas (IndexedDB): al volver a abrir una playlist enorme se ve al instante y se actualiza detrás. */
const plCache = {
  db: null,
  open() {
    if (!this.db) this.db = new Promise((ok, no) => {
      if (!window.indexedDB) return no(new Error("sin IndexedDB"));
      const rq = indexedDB.open("zinctify-cache", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("pl", { keyPath: "key" });
      rq.onsuccess = () => ok(rq.result); rq.onerror = () => no(rq.error);
    });
    return this.db;
  },
  key(id) { return `${state.user ? state.user.username : ""}:${id}`; },
  async get(id) {
    try {
      const d = await this.open();
      return await new Promise((ok) => { const r = d.transaction("pl").objectStore("pl").get(this.key(id)); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
    } catch (e) { return null; }
  },
  async put(id, data) {
    try {
      const d = await this.open();
      d.transaction("pl", "readwrite").objectStore("pl").put({ key: this.key(id), data, ts: Date.now() });
    } catch (e) { /* sin caché, no pasa nada */ }
  },
};

async function playlistView(id) {
  const cached = await plCache.get(id);
  const data = cached ? cached.data : await web("playlist/get", { id });
  if (!cached) plCache.put(id, data);
  let pl = data.playlist;
  let songs = data.songs;
  const owned = pl.owned;
  const ctx = { kind: "playlist", id: pl.id };
  const wrap = h("div", {});

  const patch = async (body) => {
    const r = await web("playlist/update", { id: pl.id, ...body });
    pl = r.playlist;
    loadLibrary();
    return r;
  };

  // Texto que se edita al hacer clic (solo en tus playlists)
  const editable = (tag, getValue, key, placeholder, multiline) => {
    const el = h(tag, {
      class: `editable${getValue() ? "" : " empty-text"}`, tabindex: owned ? 0 : null, role: owned ? "button" : null,
      title: owned ? T("Haz clic para editar") : null,
    }, getValue() || (owned ? placeholder : ""));
    if (!owned) return el;
    const start = () => {
      const input = multiline ? h("textarea", { rows: 3, maxlength: 500 }) : h("input", { type: "text", maxlength: 100 });
      input.value = getValue();
      input.className = `edit-input ${tag}`;
      el.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = async (save) => {
        if (done) return;
        done = true;
        if (save && input.value.trim() !== getValue() && (key === "description" || input.value.trim())) {
          try { await patch({ [key]: input.value.trim() }); } catch (e) { showError(e); }
        }
        draw();
      };
      input.addEventListener("blur", () => finish(true));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") finish(false);
        if (e.key === "Enter" && (!multiline || !e.shiftKey)) { e.preventDefault(); finish(true); }
      });
    };
    el.addEventListener("click", start);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") start(); });
    return el;
  };

  const changeCover = async () => {
    try {
      const image = await pickImage();
      if (!image) return;
      pl = (await uploadImage("playlist-cover?id=" + encodeURIComponent(pl.id), image)).playlist;
      loadLibrary();
      draw();
    } catch (e) { showError(e); }
  };

  const linkBox = h("div", { class: "link-box", hidden: true });
  async function drawLink() {
    if (!owned || !pl.linkSource) { linkBox.hidden = true; return; }
    let lk;
    try { lk = (await web("import/link", { id: pl.id })).link; } catch (e) { return; }
    if (!lk) { linkBox.hidden = true; return; }
    linkBox.hidden = false;
    const when = lk.lastSync ? agoText(lk.lastSync) : T("nunca");
    const sync = h("button", { class: "btn small", type: "button" }, T("Sincronizar ahora"));
    sync.addEventListener("click", async () => {
      sync.disabled = true; sync.textContent = T("Sincronizando…");
      try {
        const r = await web("import/sync", { id: pl.id });
        pl = (await web("playlist/get", { id: pl.id })).playlist;
        songs = (await web("playlist/get", { id: pl.id })).songs;
        loadLibrary(); toast(r.added ? T("{n} canciones añadidas", { n: r.added }) : T("Todo al día"));
        draw();
        await drawLink();
      } catch (e) { showError(e); sync.disabled = false; sync.textContent = T("Sincronizar ahora"); }
    });
    linkBox.replaceChildren(...[
      h("div", { class: "link-head" },
        h("span", { class: "grow" }, icon("link", 16), " ", T("Vinculada a {source}", { source: lk.source === "text" ? T("tu lista (CSV/texto)") : (LINK_NAMES[lk.source] || lk.source) }), " · ",
          T("{matched} de {total} en tu servidor", { matched: nf.format(lk.matched), total: nf.format(lk.total) }), " · ", T("última sincronización: {when}", { when })),
        sync,
        h("label", { class: "check small" }, h("input", { type: "checkbox", checked: lk.auto, style: { accentColor: "var(--accent)" }, onchange: async (e) => {
          try { await web("import/auto", { id: pl.id, auto: e.target.checked }); } catch (ex) { showError(ex); }
        } }), h("span", {}, T("Automática"))),
        h("button", { class: "btn small", type: "button", onclick: async () => {
          if (!confirm(T("¿Desvincular? La playlist se queda como está, pero ya no se actualizará sola."))) return;
          try { await web("import/unlink", { id: pl.id }); pl = (await web("playlist/get", { id: pl.id })).playlist; linkBox.hidden = true; draw(); } catch (e) { showError(e); }
        } }, T("Desvincular"))),
      lk.status && lk.status !== "ok" ? h("p", { class: "import-error small" }, lk.status.replace(/^(error|aviso): /, "")) : null,
      unmatchedList(lk.unmatched, lk.unmatchedTotal)].filter(Boolean));
  }
  const collabBox = h("section", { class: "section collab-box", hidden: true });
  let collabOpen = false;
  const toggleCollab = async () => {
    collabOpen = !collabOpen;
    collabBox.hidden = !collabOpen;
    if (collabOpen) await drawCollab();
  };
  const inviteBanner = () => h("div", { class: "notice-banner" },
    h("span", { class: "grow" }, T("{user} te ha invitado a colaborar en esta playlist.", { user: pl.author })),
    h("button", { class: "btn small primary", type: "button", onclick: async () => {
      try { const r = await web("playlist/respond", { id: pl.id, accept: true }); pl = r.playlist; loadLibrary(); pollBell(); draw(); } catch (e) { showError(e); }
    } }, T("Aceptar")),
    h("button", { class: "btn small", type: "button", onclick: async () => {
      try { await web("playlist/respond", { id: pl.id, accept: false }); loadLibrary(); pollBell(); location.hash = "#/"; } catch (e) { showError(e); }
    } }, T("Rechazar")));

  async function drawCollab() {
    collabBox.replaceChildren(h("p", { class: "muted" }, T("Cargando…")));
    try {
      const r = await web("playlist/members", { id: pl.id });
      const rows = [r.owner, ...r.members].map((m) => h("li", { class: "user-row" },
        h("a", { href: `#/user/${encodeURIComponent(m.username)}`, class: "user-link" }, avatarEl(m),
          h("span", { class: "grow" }, h("span", { class: "a-name" }, m.displayName || m.username),
            h("span", { class: "muted small block" }, m.status === "owner" ? T("Dueño") : m.status === "pending" ? T("Invitación pendiente") : T("Colaborador")))),
        (owned && m.status !== "owner") || (m.isMe && m.status === "accepted")
          ? h("button", { class: "btn small", type: "button", onclick: async () => {
            try {
              await web("playlist/leave", { id: pl.id, username: m.username });
              if (m.isMe) { loadLibrary(); location.hash = "#/"; return; }
              pl = (await web("playlist/get", { id: pl.id })).playlist; draw(); collabOpen = true; collabBox.hidden = false; drawCollab();
            } catch (e) { showError(e); }
          } }, m.isMe ? T("Salir de la playlist") : T("Quitar")) : null));
      const parts = [h("h2", {}, T("Colaboradores")),
        h("p", { class: "muted" }, T("Los colaboradores pueden añadir y quitar canciones. El nombre, la foto y la visibilidad solo los cambia el dueño.")),
        h("ul", { class: "user-list" }, rows)];
      if (owned) {
        const have = new Set([r.owner.username, ...r.members.map((m) => m.username)]);
        const out = h("ul", { class: "user-list invite-results" });
        const input = h("input", { type: "search", placeholder: T("Busca un usuario para invitarlo"), "aria-label": T("Busca un usuario para invitarlo") });
        const show = (users, title) => {
          const list = users.filter((u) => !have.has(u.username) && !u.isMe);
          out.replaceChildren(...(list.length ? [h("li", { class: "muted small" }, title), ...list.map((u) => h("li", { class: "user-row" },
            h("span", { class: "user-link" }, avatarEl(u), h("span", { class: "grow" }, h("span", { class: "a-name" }, u.displayName || u.username),
              h("span", { class: "muted small block" }, `@${u.username}`, u.friend ? [" · ", h("span", { class: "friend-tag" }, icon("users", 13), T("Amigos"))] : ""))),
            h("button", { class: "btn small primary", type: "button", onclick: async () => {
              try { await web("playlist/invite", { id: pl.id, username: u.username }); toast(T("Invitación enviada a {user}", { user: u.displayName || u.username })); pl = (await web("playlist/get", { id: pl.id })).playlist; drawCollab(); } catch (e) { showError(e); }
            } }, T("Invitar"))))]
            : [h("li", { class: "muted small" }, T("Sin resultados."))]));
        };
        web("user/friends", {}).then((f) => { if (!input.value) show(f.users, T("Tus amigos")); }).catch(() => {});
        let timer = 0;
        input.addEventListener("input", () => {
          clearTimeout(timer);
          const q = input.value.trim();
          if (!q) { web("user/friends", {}).then((f) => show(f.users, T("Tus amigos"))).catch(() => {}); return; }
          timer = setTimeout(async () => { try { show((await web("search", { q })).users, T("Usuarios")); } catch (e) { /* nada */ } }, 250);
        });
        parts.push(h("div", { class: "field" }, input), out);
      }
      collabBox.replaceChildren(...parts);
    } catch (e) { collabBox.replaceChildren(h("p", { class: "muted" }, T("No se han podido cargar los colaboradores."))); showError(e); }
  }

  function draw() {
    const cover = coverEl(pl.cover ? pl.id : null, pl.name, 600, "", pl.cover);
    const coverBox = owned
      ? h("button", { class: "cover-edit", type: "button", title: T("Cambiar la foto"), "aria-label": T("Cambiar la foto"), onclick: changeCover },
        cover, h("span", { class: "cover-edit-hint" }, icon("camera", 28), h("span", {}, T("Cambiar la foto"))))
      : cover;
    const facts = [plural(pl.songCount, "song"), pl.songCount ? fmtTotal(pl.duration) : null].filter(Boolean).join(", ");
    const visibility = owned
      ? h("button", {
        class: "btn small-btn", type: "button",
        title: pl.public ? T("Cualquiera con cuenta puede verla. Haz clic para hacerla privada.") : T("Solo tú puedes verla. Haz clic para hacerla pública."),
        onclick: async () => { try { await patch({ public: !pl.public }); draw(); } catch (e) { showError(e); } },
      }, pl.public ? T("Pública") : T("Privada"))
      : null;
    const makeRow = (s, i) => songRow(s, i, songs, true, true, {
      ctx,
      onRemove: pl.canEdit ? async () => {
        try {
          pl = (await web("playlist/remove", { id: pl.id, entryIds: [s.entryId] })).playlist;
          songs = songs.filter((x) => x.entryId !== s.entryId);
          loadLibrary();
          draw();
        } catch (e) { showError(e); }
      } : null,
    });
    wrap.replaceChildren(
      h("div", { class: "album-head" },
        coverBox,
        h("div", {},
          h("p", { class: "kind" }, [pl.collaborative ? T("Playlist colaborativa") : null, pl.public ? T("Playlist pública") : T("Playlist privada")].filter(Boolean).join(" · ")),
          editable("h1", () => pl.name, "name", T("Sin nombre")),
          editable("p", () => pl.description, "description", T("Añade una descripción"), true),
          h("p", { class: "muted" }, ...(() => {
            const parts = T("De {author}", { author: "\u0001" }).split("\u0001");
            const who = pl.authorUsername ? h("a", { href: `#/user/${encodeURIComponent(pl.authorUsername)}`, class: "user-link" }, pl.author) : pl.author;
            return [parts[0], who, parts[1] || "", facts ? `, ${facts}` : ""];
          })()),
          h("div", { class: "album-actions" },
            songs.length ? h("button", { class: "btn primary", onclick: () => playQueue(songs, 0, ctx) }, icon("play", 16), T("Reproducir")) : null,
            songs.length ? h("button", { class: "btn", onclick: () => playQueue(shuffled(songs), 0, ctx) }, T("Aleatorio")) : null,
            owned ? visibility : heartBtn("playlist", pl.id),
            owned && pl.cover ? h("button", { class: "btn", type: "button", onclick: async () => {
              try { pl = (await web("playlist/cover", { id: pl.id, remove: true })).playlist; loadLibrary(); draw(); } catch (e) { showError(e); }
            } }, T("Quitar la foto")) : null,
            owned || pl.public ? shareBtn("playlist", pl.id, pl.name) : null,
            songs.length ? offlineBtn("playlist", pl.id, pl.name, () => songs, pl.cover ? pl.id : (songs[0] && songs[0].coverArt)) : null,
            owned || pl.myStatus === "accepted" ? h("button", { class: "btn", type: "button", onclick: toggleCollab }, icon("users", 16), T("Colaboradores")) : null))),
      pl.myStatus === "pending" ? inviteBanner() : null,
      linkBox,
      collabBox,
      songs.length ? (pl.canEdit ? sortableTracks(chunkedList(songs, makeRow), async (from, to) => {
        // from y to son posiciones en la lista; to = posición final de la canción movida
        const s = songs[from];
        const without = songs.filter((_, i) => i !== from);
        const beforeEntry = to < without.length ? without[to].entryId : null;
        try {
          pl = (await web("playlist/move", { id: pl.id, entryId: s.entryId, beforeEntryId: beforeEntry })).playlist;
          without.splice(to, 0, s);
          songs.splice(0, songs.length, ...without);
          const sc = scrollParent(wrap), top = sc ? sc.scrollTop : 0;
          loadLibrary(); draw();
          if (sc) sc.scrollTop = top;
        } catch (e) { showError(e); }
      }) : chunkedList(songs, makeRow))
        : h("div", { class: "empty" }, h("p", {}, owned
          || pl.canEdit ? T("Esta playlist está vacía. Haz clic derecho en una canción o un álbum, o pulsa ⋯, y elige Playlists para añadirla.")
          : T("Esta playlist está vacía."))));
    markPlaying();
  }
  draw();
  drawLink();
  if (cached) {                                     // se enseñó la copia guardada: se pide la buena y, si cambió algo, se redibuja
    web("playlist/get", { id }).then((fresh) => {
      plCache.put(id, fresh);
      if (!document.contains(wrap)) return;
      if (fresh.playlist.changed !== pl.changed || fresh.songs.length !== songs.length || fresh.playlist.name !== pl.name || fresh.playlist.cover !== pl.cover) {
        pl = fresh.playlist; songs = fresh.songs; draw();
      }
    }).catch(() => {});
  }
  return wrap;
}

// Solo móvil: la biblioteca a pantalla completa (en el ordenador está en la barra lateral).
async function libraryView() {
  await loadLibrary();
  const box = h("div", { class: "library page" });
  drawLibrary([box]);
  return h("div", {}, h("h1", {}, T("Tu biblioteca")), box);
}


/* ---------- perfil ---------- */

async function profileView() {
  const me = await web("me");
  state.user = me.user;
  state.apiKey = me.apiKey;
  const u = me.user;

  const avatarBox = h("div", { class: "avatar-lg-box" });
  const drawAvatar = () => avatarBox.replaceChildren(avatarEl(state.user, "lg"));
  drawAvatar();
  const changePhoto = async () => {
    try {
      const image = await pickImage();
      if (!image) return;
      state.user = (await uploadImage("avatar", image)).user;
      drawAvatar();
      drawTopbarAvatar();
      toast(T("Foto cambiada"));
    } catch (e) { showError(e); }
  };
  const removePhoto = async () => {
    try { state.user = (await web("profile/avatar", { remove: true })).user; drawAvatar(); drawTopbarAvatar(); } catch (e) { showError(e); }
  };

  const bannerBox = h("div", { class: "banner-preview" });
  const bannerBtns = h("div", { class: "album-actions", style: { marginTop: "10px" } });
  const drawBanner = () => {
    const b = state.user.banner;
    bannerBox.style.backgroundImage = b ? `url("/img/banner/${encodeURIComponent(state.user.username)}?v=${b}")` : "";
    bannerBox.classList.toggle("empty", !b);
    bannerBox.textContent = b ? "" : T("Sin banner");
    bannerBtns.replaceChildren(
      h("button", { class: "btn", type: "button", onclick: changeBanner }, icon("camera", 16), T("Cambiar el banner")),
      b ? h("button", { class: "btn", type: "button", onclick: removeBanner }, T("Quitar el banner")) : null);
  };
  async function changeBanner() {
    try {
      const image = await pickImage();
      if (!image) return;
      state.user = (await uploadImage("banner", image)).user;
      drawBanner();
      toast(T("Banner cambiado"));
    } catch (e) { showError(e); }
  }
  async function removeBanner() {
    try { state.user = (await web("profile/banner", {})).user; drawBanner(); } catch (e) { showError(e); }
  }
  drawBanner();

  const name = h("input", { type: "text", maxlength: 40, value: u.displayName || "", placeholder: u.username, autocomplete: "name" });
  const bio = h("textarea", { rows: 3, maxlength: 300 });
  bio.value = u.bio || "";
  const email = h("input", { type: "email", value: u.email || "", autocomplete: "email", required: true });
  const emailPass = h("input", { type: "password", autocomplete: "current-password" });
  const emailPassField = h("div", { class: "field", hidden: true }, h("label", {}, T("Contraseña actual (para cambiar el correo)"), emailPass));
  email.addEventListener("input", () => { emailPassField.hidden = email.value.trim().toLowerCase() === (state.user.email || "").toLowerCase(); });
  const err = h("div", { class: "error", role: "alert" });

  const cur = h("input", { type: "password", required: true, autocomplete: "current-password" });
  const nw = h("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
  const nw2 = h("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
  const msg = h("div", { class: "error", role: "alert" });

  const keyBox = h("input", { type: "text", readonly: true, value: me.apiKey, "aria-label": T("Clave para apps") });
  const row = (label, value, copyable) => h("div", { class: "kv" },
    h("span", {}, label), value,
    copyable ? h("button", { class: "btn", onclick: () => copyText(copyable) }, T("Copiar")) : h("span", {}));

  return h("div", {},
    h("h1", {}, T("Perfil")),
    h("section", { class: "panel" },
      h("h2", {}, T("Banner")),
      h("p", { class: "muted" }, T("Se ve en la parte de arriba de tu perfil. Funciona con JPG, PNG, WEBP y GIF; se recorta en formato panorámico (3:1).")),
      bannerBox, bannerBtns),
    h("section", { class: "panel" },
      h("div", { class: "avatar-row" },
        avatarBox,
        h("div", { class: "album-actions", style: { marginTop: 0 } },
          h("button", { class: "btn", type: "button", onclick: changePhoto }, icon("camera", 16), T("Cambiar la foto")),
          state.user.avatar ? h("button", { class: "btn", type: "button", onclick: removePhoto }, T("Quitar la foto")) : null)),
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          err.textContent = "";
          const body = { displayName: name.value.trim(), bio: bio.value.trim() };
          if (email.value.trim().toLowerCase() !== (state.user.email || "").toLowerCase()) {
            body.email = email.value.trim();
            body.currentPassword = emailPass.value;
          }
          try {
            state.user = (await web("profile", body)).user;
            emailPass.value = "";
            emailPassField.hidden = true;
            drawTopbarAvatar();
            toast(T("Perfil guardado"));
          } catch (ex) { err.textContent = ex.message; }
        },
      },
      h("div", { class: "field" }, h("label", {}, T("Nombre"), name)),
      h("div", { class: "field" }, h("label", {}, T("Bio"), bio)),
      h("div", { class: "field" }, h("label", {}, T("Correo electrónico"), email),
        u.email ? null : h("span", { class: "hint" }, T("Tu cuenta todavía no tiene correo. Añade uno."))),
      emailPassField,
      err,
      h("button", { class: "btn primary", type: "submit" }, T("Guardar cambios")))),
    h("section", { class: "panel" },
      h("h2", {}, T("Cambiar la contraseña")),
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          msg.textContent = "";
          if (nw.value !== nw2.value) { msg.textContent = T("Las contraseñas nuevas no coinciden."); return; }
          try { await web("password", { current: cur.value, new: nw.value }); e.target.reset(); toast(T("Contraseña cambiada")); } catch (ex) { msg.textContent = ex.message; }
        },
      },
      h("div", { class: "field" }, h("label", {}, T("Contraseña actual"), cur)),
      h("div", { class: "field" }, h("label", {}, T("Contraseña nueva (mínimo 8 caracteres)"), nw)),
      h("div", { class: "field" }, h("label", {}, T("Repite la contraseña nueva"), nw2)),
      msg,
      h("button", { class: "btn primary", type: "submit" }, T("Cambiar contraseña")))),
    h("section", { class: "panel" },
      h("h2", {}, T("Conectar tus apps")),
      h("p", {}, T("Feishin, Symfonium, Substreamer y otras apps usan una clave propia (la de abajo). Pon estos tres datos en la app. Si la app tiene la opción «API key», pega solo la clave.")),
      row(T("Servidor"), h("input", { type: "text", readonly: true, value: location.origin, "aria-label": T("Dirección del servidor") }), location.origin),
      row(T("Usuario"), h("input", { type: "text", readonly: true, value: state.user.username, "aria-label": T("Usuario") }), state.user.username),
      row(T("Clave"), keyBox, null),
      h("div", { class: "album-actions" },
        h("button", { class: "btn", onclick: () => copyText(keyBox.value) }, T("Copiar clave")),
        h("button", {
          class: "btn danger",
          onclick: async () => {
            if (!confirm(T("Las apps conectadas dejarán de funcionar hasta que les pongas la clave nueva. ¿Continuar?"))) return;
            try { const r = await web("regen-key", {}); keyBox.value = r.apiKey; state.apiKey = r.apiKey; toast(T("Clave nueva generada")); } catch (e) { showError(e); }
          },
        }, T("Generar otra clave")),
        h("button", {
          class: "btn",
          onclick: async () => {
            const k = prompt(T("Escribe la clave que quieras usar en las apps (8 a 64 caracteres, sin espacios). Se guarda sin cifrar, así que no uses una contraseña que uses en otros sitios."));
            if (!k) return;
            try { const r = await web("set-key", { key: k }); keyBox.value = r.apiKey; state.apiKey = r.apiKey; toast(T("Clave guardada")); } catch (e) { showError(e); }
          },
        }, T("Elegir mi propia clave")))));
}

/* ---------- ajustes ---------- */

async function savePrefs(patch) {
  try {
    state.user.prefs = (await web("prefs", patch)).prefs;
    applyRadiosPref();
    applyNorm();
    applyAnim();
    drawLibrary();
    toast(T("Guardado"));
  } catch (e) { showError(e); }
}

function settingsView() {
  const p = prefs();
  const select = (value, options, onchange, label) => h("select", { "aria-label": label, onchange: (e) => onchange(e.target.value) },
    options.map(([v, l]) => h("option", { value: v, selected: String(v) === String(value) }, l)));
  const target = select(p.normTarget ?? -14, [
    [-19, T("Suave (−19 LUFS)")], [-16, T("Normal (−16 LUFS)")], [-14, T("Alto (−14 LUFS, como Spotify)")], [-11, T("Muy alto (−11 LUFS)")],
  ], (v) => savePrefs({ normTarget: Number(v) }), T("Volumen objetivo"));
  const normBox = h("input", { type: "checkbox", checked: !!p.normalize, style: { accentColor: "var(--accent)" },
    onchange: (e) => { target.disabled = !e.target.checked; savePrefs({ normalize: e.target.checked }); } });
  target.disabled = !p.normalize;
  const view = (value, label, hint) => h("label", { class: "choice" },
    h("input", { type: "radio", name: "libview", value, checked: (p.libraryView || "grid") === value, style: { accentColor: "var(--accent)" },
      onchange: () => savePrefs({ libraryView: value }) }),
    h("span", {}, label, h("span", { class: "hint" }, hint)));

  const animOut = h("output", { class: "muted small" }, String(p.animLevel ?? 50));
  const animRange = h("input", { type: "range", min: 0, max: 100, step: 5, value: p.animLevel ?? 50, "aria-label": T("Suavidad de las animaciones") });
  animRange.addEventListener("input", () => { animOut.textContent = animRange.value; state.user.prefs.animLevel = Number(animRange.value); applyAnim(); });
  animRange.addEventListener("change", () => savePrefs({ animLevel: Number(animRange.value) }));
  const xfOut = h("output", { class: "muted small" }, p.crossfade ? `${p.crossfade} s` : T("Apagado"));
  const xfRange = h("input", { type: "range", min: 0, max: 12, step: 1, value: p.crossfade || 0, "aria-label": T("Crossfade") });
  xfRange.addEventListener("input", () => { xfOut.textContent = Number(xfRange.value) ? `${xfRange.value} s` : T("Apagado"); state.user.prefs.crossfade = Number(xfRange.value); });
  xfRange.addEventListener("change", () => savePrefs({ crossfade: Number(xfRange.value) }));
  const privacy = (key, label) => h("label", { class: "check" },
    h("input", { type: "checkbox", checked: p[key] !== false, style: { accentColor: "var(--accent)" }, onchange: (e) => savePrefs({ [key]: e.target.checked }) }), h("span", {}, label));

  return h("div", {},
    h("h1", {}, T("Ajustes")),
    h("section", { class: "panel" },
      h("h2", {}, T("Idioma")),
      h("p", { class: "muted" }, T("Por defecto se usa el idioma de tu sistema.")),
      langSelect()),
    h("section", { class: "panel" },
      h("h2", {}, T("Calidad del audio")),
      h("p", { class: "muted" }, T("Con una calidad menor gastas menos datos: el servidor convierte la canción a MP3 al vuelo. «Original» envía el archivo tal cual.")),
      select(p.quality || "original", [
        ["original", T("Original (sin convertir)")], ["high", T("Alta (MP3 320 kbps)")], ["normal", T("Normal (MP3 160 kbps)")], ["low", T("Baja (MP3 96 kbps)")],
      ], (v) => savePrefs({ quality: v }), T("Calidad del audio"))),
    h("section", { class: "panel" },
      h("h2", {}, T("Normalizar el volumen")),
      h("p", { class: "muted" }, T("Hace que todas las canciones suenen igual de fuerte aunque cada archivo tenga un volumen distinto. El servidor mide el volumen de cada canción en segundo plano; hasta que lo haya medido, esa canción suena sin ajustar.")),
      h("label", { class: "check" }, normBox, h("span", {}, T("Activar la normalización"))),
      h("div", { class: "field", style: { marginTop: "14px" } }, h("label", {}, T("Volumen objetivo"), target))),
    h("section", { class: "panel" },
      h("h2", {}, T("Tamaño de la interfaz")),
      h("p", { class: "muted" }, T("En pantallas muy grandes (como una tele) la página se amplía sola para que no se vea enana. Aquí puedes fijar un tamaño concreto.")),
      select(uiScalePref(), [["auto", T("Automático")], ...[75, 100, 125, 150, 175, 200, 250, 300].map((n) => [String(n), n + " %"])],
        (v) => { try { localStorage.setItem("zinctify.uiscale", v); } catch (e) {} uiScaleApplied = 0; applyUiScale(); }, T("Tamaño de la interfaz"))),
    h("section", { class: "panel" },
      h("h2", {}, T("Crossfade")),
      h("p", { class: "muted" }, T("Las canciones se funden unas con otras: la siguiente empieza mientras la actual se apaga. Con 0 está apagado. No se usa en radios, en salas ni al repetir una canción.")),
      h("div", { class: "trow" }, h("span", {}, T("Duración del fundido")), h("span", { class: "trange" }, xfRange, xfOut))),
    h("section", { class: "panel" },
      h("h2", {}, T("Animaciones")),
      h("p", { class: "muted" }, T("Controla lo suaves y lentas que son las animaciones (la letra que sube desde abajo, la portada que gira al pasar el ratón por una canción...). Con 0 no hay ninguna.")),
      h("div", { class: "trow" }, h("span", {}, T("Suavidad")), h("span", { class: "trange" }, animRange, animOut))),
    h("section", { class: "panel" },
      h("h2", {}, T("Privacidad")),
      h("p", { class: "muted" }, T("Qué pueden ver los demás en tu perfil. Los números de seguidores y seguidos siempre se ven.")),
      privacy("showFollowers", T("Mostrar la lista de quién me sigue")),
      privacy("showFollowing", T("Mostrar la lista de a quién sigo")),
      privacy("showListening", T("Dejar que quienes me siguen vean lo que estoy escuchando"))),
    h("section", { class: "panel" },
      h("h2", {}, T("Mensajes")),
      h("p", { class: "muted" }, T("Los mensajes con tus amigos se guardan cifrados en el servidor y no se borran.")),
      privacy("chatSound", T("Sonido cuando recibo un mensaje"))),
    h("section", { class: "panel" },
      h("h2", {}, T("Biblioteca")),
      h("p", { class: "muted" }, T("Cómo se ven tus playlists, álbumes y artistas en la barra de la izquierda.")),
      h("div", { class: "choices" },
        view("grid", T("Cuadrícula"), T("Portada grande, y debajo el nombre, el tipo y el autor.")),
        view("list", T("Lista"), T("Portada pequeña a la izquierda, con el nombre y el autor al lado.")),
        view("compact", T("Compacta"), T("Solo el nombre y si es playlist, álbum o artista.")))));
}

/* ---------- novedades (change log) ---------- */

async function changelogView() {
  let list = [];
  try { list = await getJSON("/changelog.json"); } catch (e) { return errorBox(e); }
  const pick = (v) => (v && typeof v === "object" ? (v[LANG] || v.es || v.en || "") : v || "");
  return h("div", { class: "changelog" },
    h("h1", { class: "brand-font" }, T("Change log")),
    list.map((e) => h("article", { class: "release" },
      h("div", { class: "release-head" },
        h("span", { class: "version" }, `v${e.version}`),
        e.date ? h("time", { class: "muted small", datetime: e.date }, new Date(e.date + "T12:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })) : null),
      h("h2", { class: "brand-font" }, pick(e.title)),
      h("ul", {}, (e.items && (e.items[LANG] || e.items.es) || []).map((t) => h("li", {}, t))))));
}


function langSelect() {
  const opts = [["auto", T("Automático (sistema)")], ["es", "Español"], ["en", "English"]];
  return h("select", {
    "aria-label": T("Idioma"),
    onchange: (e) => {
      try {
        if (e.target.value === "auto") localStorage.removeItem("zinctify.lang");
        else localStorage.setItem("zinctify.lang", e.target.value);
      } catch (ex) { /* ignorar */ }
      location.reload();
    },
  }, opts.map(([v, l]) => h("option", { value: v, selected: v === langPref }, l)));
}

async function logout() {
  try { await web("logout", {}); } catch (e) { /* da igual: recargamos */ }
  stopPlayback();
  location.hash = "";
  location.reload();
}


/* ---------- panel de administración (solo administradores) ---------- */

const ADMIN_TABS = [["overview", "Resumen"], ["radios", "Radios"], ["metadata", "Metadatos"], ["dups", "Duplicadas"], ["users", "Usuarios"], ["banners", "Anuncios"]];

/* Actualizar el servidor desde GitHub (Releases): avisa, descarga servidor y clientes, y se reinicia solo. */
function adminUpdatePanel(st0) {
  let st = st0, timer = null, waiting = false;
  const box = h("section", { class: "panel update-panel" });
  const when = (ts) => ts ? new Date(ts * 1000).toLocaleString() : T("todavía no");
  const repo = h("input", { type: "text", value: st.repo, placeholder: "usuario/nombre", spellcheck: "false", autocomplete: "off", style: { maxWidth: "280px" } });
  const auto = h("input", { type: "checkbox", checked: st.auto, style: { accentColor: "var(--accent)" } });
  const apply = (r) => { st = r; draw(); };
  const saveSettings = async () => { try { apply(await web("admin/update/settings", { repo: repo.value.trim(), auto: auto.checked })); toast(T("Guardado")); } catch (e) { showError(e); } };
  const checkNow = async () => { try { await saveSettings(); apply(await web("admin/update/check", {})); } catch (e) { showError(e); } };
  const poll = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!box.isConnected) return;
      try {
        const r = await web("admin/update", {});
        if (r.current !== st.current) { location.reload(); return; }
        apply(r);
        if (["downloading", "installing", "restarting"].includes(r.state.phase)) poll();
      } catch (e) { waiting = true; poll(); }              // el servidor se está reiniciando: se sigue intentando hasta que vuelva
    }, 1000);
  };
  const install = async () => {
    if (!confirm(T("Se descargará la versión {v} (servidor y clientes) y el servidor se reiniciará unos segundos. ¿Seguir?", { v: st.version }))) return;
    try { apply(await web("admin/update/install", {})); poll(); } catch (e) { showError(e); }
  };
  const draw = () => {
    const ph = st.state.phase, busy = ["downloading", "installing", "restarting"].includes(ph);
    box.replaceChildren(
      h("h2", {}, T("Actualizaciones")),
      h("p", { class: "muted" }, T("Versión instalada: {v}", { v: st.current })),
      h("div", { class: "field" }, h("label", {}, T("Repositorio de GitHub"), repo),
        h("p", { class: "muted small" }, T("Donde publicas las versiones (en «Releases»). Se escribe usuario/nombre."))),
      h("label", { class: "check" }, auto, h("span", {}, T("Buscar actualizaciones automáticamente cada pocas horas"))),
      h("div", { class: "album-actions" },
        h("button", { class: "btn", type: "button", disabled: busy, onclick: checkNow }, T("Buscar ahora")),
        h("button", { class: "btn", type: "button", disabled: busy, onclick: saveSettings }, T("Guardar")),
        h("span", { class: "muted small" }, T("Última búsqueda: {t}", { t: when(st.checked) }))),
      st.rolledBack ? h("p", { class: "error" }, T("La versión {v} no arrancó bien y el servidor volvió a la anterior.", { v: st.rolledBack.version || "" })) : null,
      busy ? h("div", { class: "update-progress" },
        h("div", { class: "bar" }, h("div", { class: "fill", style: { width: Math.round((st.state.progress || 0) * 100) + "%" } })),
        h("p", { class: "muted" }, waiting ? T("Esperando a que el servidor vuelva…") : st.state.msg))
      : st.state.error ? h("p", { class: "error" }, T("No se pudo actualizar: {e}", { e: st.state.error }))
      : st.available ? h("div", { class: "update-avail" },
        h("strong", {}, T("Hay una versión nueva: {v}", { v: st.version })),
        st.notes ? h("pre", { class: "update-notes" }, st.notes.length > 700 ? st.notes.slice(0, 700) + "…" : st.notes) : null,
        h("p", { class: "muted small" }, st.clients.length ? T("También se descargarán los clientes de: {c}.", { c: st.clients.map((c) => ({ windows: "Windows", linux: "Linux", android: "Android" }[c])).join(", ") }) : T("Esta versión no trae clientes nuevos.")),
        st.canInstall ? h("button", { class: "btn primary", type: "button", onclick: install }, T("Actualizar ahora"))
          : h("p", { class: "error" }, st.whyNot),
        st.url ? h("a", { class: "muted small", href: st.url, target: "_blank", rel: "noopener" }, T("Ver en GitHub")) : null)
      : st.newer ? h("p", { class: "muted" }, T("Hay una versión nueva, pero no trae el paquete del servidor todavía."))
      : st.checked ? h("p", { class: "muted" }, T("Tienes la última versión.")) : null);
  };
  draw();
  if (["downloading", "installing", "restarting"].includes(st.state.phase)) poll();
  return box;
}

async function adminView(tab) {
  tab = ADMIN_TABS.some(([id]) => id === tab) ? tab : "overview";
  const builders = { overview: adminOverview, radios: adminRadios, metadata: adminMetadata, dups: adminDups, users: adminUsers, banners: adminBanners };
  const [body, upd] = await Promise.all([builders[tab](), web("admin/update", {}).catch(() => null)]);
  return h("div", { class: "dash" },
    h("h1", {}, T("Administración")),
    upd && upd.available && tab !== "overview" ? h("a", { class: "update-banner", href: "#/admin/overview" }, icon("download", 18), T("Hay una versión nueva de Zinctify ({v}). Pulsa aquí para actualizar.", { v: upd.version })) : null,
    h("nav", { class: "dash-tabs", "aria-label": T("Secciones de administración") },
      ADMIN_TABS.map(([id, label]) => h("a", { href: `#/admin/${id}`, "aria-current": id === tab ? "page" : null }, T(label)))),
    tab === "overview" && upd ? adminUpdatePanel(upd) : null,
    body);
}

async function adminBanners() {
  const st = await web("admin/banners", {});
  let list = st.banners.map((b) => ({ ...b }));
  const on = h("input", { type: "checkbox", checked: st.enabled, style: { accentColor: "var(--accent)" } });
  const secs = h("input", { type: "number", min: 3, max: 60, value: st.seconds, style: { width: "80px" } });
  const box = h("div", { class: "banner-admin" });
  const field = (label, input) => h("div", { class: "field" }, h("label", {}, label, input));
  const draw = () => box.replaceChildren(...list.map((b, i) => {
    const bind = (key, el) => { el.value = b[key] || ""; el.addEventListener("input", () => { b[key] = el.value; }); return el; };
    const color = h("input", { type: "color", value: b.color || "#3b4cca" });
    color.addEventListener("input", () => { b.color = color.value; });
    return h("div", { class: "panel" },
      h("div", { class: "trow" }, h("strong", {}, T("Anuncio {n}", { n: i + 1 })), h("span", { class: "grow" }),
        h("button", { class: "btn small", type: "button", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, "↑"),
        h("button", { class: "btn small", type: "button", disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); } }, "↓"),
        h("button", { class: "btn small danger", type: "button", onclick: () => { list.splice(i, 1); draw(); } }, T("Borrar"))),
      h("div", { class: "field" }, h("label", {}, T("Idioma en el que se ve"), (() => {
        const sel = h("select", { onchange: () => { b.lang = sel.value; } },
          [["", T("Todos los idiomas")], ["es", "Español"], ["en", "English"]].map(([v, l]) => h("option", { value: v, selected: (b.lang || "") === v }, l)));
        return sel; })())),
      field(T("Título"), bind("title", h("input", { type: "text", maxlength: 80 }))),
      field(T("Texto"), bind("text", h("textarea", { rows: 2, maxlength: 400 }))),
      field(T("Enlace (opcional)"), bind("link", h("input", { type: "text", placeholder: "https://...  o  #/albums" }))),
      field(T("Imagen de fondo (opcional)"), bind("image", h("input", { type: "text", placeholder: "https://...  " + T("o sube una imagen") }))),
      h("div", { class: "album-actions", style: { marginTop: 0, marginBottom: "12px" } },
        h("button", { class: "btn small", type: "button", onclick: async () => {
          try { const img = await pickImage(); if (!img) return; b.image = (await uploadImage("ad-image", img)).url; draw(); toast(T("Imagen subida")); } catch (e) { showError(e); }
        } }, icon("camera", 14), T("Subir imagen")),
        b.image ? h("button", { class: "btn small", type: "button", onclick: () => { b.image = ""; draw(); } }, T("Quitar imagen")) : null),
      field(T("Color"), color));
  }));
  draw();
  const err = h("div", { class: "error", role: "alert" });
  const save = async () => {
    err.textContent = "";
    try {
      const r = await web("admin/banners", { enabled: on.checked, seconds: Number(secs.value) || 7, banners: list });
      list = r.banners.map((b) => ({ ...b })); draw(); toast(T("Guardado"));
    } catch (e) { err.textContent = e.message; }
  };
  return h("div", {},
    h("section", { class: "panel" },
      h("h2", {}, T("Anuncios en la Home")),
      h("p", { class: "muted" }, T("Un banner arriba de la Home que va rotando entre los anuncios que añadas. Está desactivado por defecto.")),
      h("label", { class: "check" }, on, h("span", {}, T("Mostrar los anuncios en la Home"))),
      h("div", { class: "field", style: { marginTop: "12px" } }, h("label", {}, T("Segundos entre anuncios"), secs))),
    box,
    h("div", { class: "album-actions" },
      h("button", { class: "btn", type: "button", onclick: () => { if (list.length >= 10) return toast(T("Máximo 10 anuncios")); list.push({ title: "", text: "", link: "", image: "", color: "", lang: "" }); draw(); } }, T("Añadir anuncio")),
      h("button", { class: "btn primary", type: "button", onclick: save }, T("Guardar"))),
    err);
}

const fmtUptime = (s) => {
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${hh} h` : hh ? `${hh} h ${m} min` : `${m} min`;
};

function figure(value, label) {
  return h("div", { class: "figure" }, h("dd", {}, nf.format(value)), h("dt", {}, label));
}

// Un bloque que se mantiene al día mientras esté en pantalla.
function pollWhile(el, fn, ms = 1500) {
  const tick = async () => {
    if (!document.contains(el)) return;
    let again = false;
    try { again = await fn(); } catch (e) { /* ignorar */ }
    if (again) setTimeout(tick, ms);
  };
  setTimeout(tick, ms);
}

function musicDirForm(st) {
  const input = h("input", { type: "text", value: st.musicDir || "", placeholder: "/srv/musica", autocomplete: "off", spellcheck: "false" });
  const note = h("p", { class: st.musicDir && !st.musicDirOk ? "error" : "muted small" },
    !st.musicDir ? T("Todavía no hay carpeta de música. Escribe la ruta en el servidor y pulsa Guardar.")
      : st.musicDirOk ? T("Cambiar de carpeta vuelve a escanear: lo que no esté en la nueva carpeta desaparece de la biblioteca.")
        : T("La carpeta no existe o no está montada."));
  return h("form", { class: "inline-form", style: { marginBottom: "14px" }, onsubmit: async (e) => {
    e.preventDefault();
    try { await web("admin/music-dir", { path: input.value }); toast(T("Guardado")); render(); } catch (ex) { showError(ex); }
  } },
  h("div", { class: "field" }, h("label", {}, T("Carpeta de música (en el servidor)"), input)),
  note,
  h("button", { class: "btn primary", type: "submit" }, T("Guardar")));
}

async function adminOverview() {
  const st = await web("admin/state");
  const scanText = h("p", { class: "muted" });
  const drawScan = (s) => {
    scanText.textContent = s.scanning
      ? T("Escaneando... {n} archivos revisados", { n: nf.format(s.count) })
      : (s.last ? T("Último escaneo: {date}", { date: new Date(s.last * 1000).toLocaleString(LOCALE) }) : T("Todavía no ha terminado ningún escaneo."));
  };
  drawScan(st.scan);
  const watchScan = () => pollWhile(scanText, async () => {
    const s = (await web("admin/state")).scan;
    drawScan(s);
    return s.scanning;
  });
  if (st.scan.scanning) watchScan();
  const scan = (full) => async () => {
    try { await web("admin/scan", { full }); drawScan({ scanning: true, count: 0 }); watchScan(); } catch (e) { showError(e); }
  };
  const loud = st.loudness || { enabled: true, done: 0, total: 0 };
  const loudText = h("p", { class: "muted" });
  const drawLoud = (l) => { loudText.textContent = T("Volumen medido: {done} de {total} canciones", { done: nf.format(l.done), total: nf.format(l.total) }); };
  drawLoud(loud);
  if (loud.enabled && loud.done < loud.total) pollWhile(loudText, async () => {
    const l = (await web("admin/state")).loudness;
    drawLoud(l);
    return l.enabled && l.done < l.total;
  }, 5000);
  const days = Array.from({ length: 14 }, (_, i) => new Date((st.plays.startTs + i * 86400) * 1000));
  const L = st.library;
  return h("div", {},
    h("dl", { class: "figures" },
      figure(L.songs, T("Canciones")), figure(L.albums, T("Álbumes")), figure(L.artists, T("Artistas")),
      figure(L.hours, T("Horas de música")), figure(L.radios, T("Radios")), figure(st.users.length, T("Usuarios")),
      figure(st.plays.total, T("Reproducciones")), figure(st.plays.last7, T("Últimos 7 días"))),
    h("div", { class: "dash-grid" },
      h("section", { class: "panel" },
        barChart(T("Reproducciones, últimos 14 días"), st.plays.byDay, days.map((d) => String(d.getDate())),
          (i) => days[i].toLocaleDateString(LOCALE, { day: "numeric", month: "long" }))),
      h("section", { class: "panel" },
        h("h2", {}, T("Biblioteca")),
        musicDirForm(st),
        scanText,
        h("div", { class: "album-actions" },
          h("button", { class: "btn", onclick: scan(false) }, T("Buscar cambios")),
          h("button", { class: "btn", onclick: scan(true) }, T("Releer todo"))),
        h("h2", { style: { marginTop: "26px" } }, T("Volumen de las canciones")),
        loudText,
        h("label", { class: "check" },
          h("input", { type: "checkbox", checked: loud.enabled, onchange: async (e) => {
            try { await web("admin/loudness", { enabled: e.target.checked }); toast(T("Guardado")); } catch (ex) { e.target.checked = !e.target.checked; showError(ex); }
          } }),
          h("span", {}, T("Medir el volumen de las canciones en segundo plano (para la normalización). Usa un poco de procesador."))),
        h("p", { class: "muted small", style: { marginTop: "18px" } },
          T("Zinctify {v} · activo desde hace {up} · base de datos {mb} MB", { v: st.server.version, up: fmtUptime(st.server.uptime), mb: st.server.dbMB })))));
}

async function adminDups() {
  const box = h("div", {});
  const fmtSize = (b) => `${(b / 1048576).toFixed(1)} MB`;
  const info = h("p", { class: "muted" }, T("Busca canciones con el mismo título y artista y casi la misma duración."));
  async function load() {
    box.replaceChildren(h("p", { class: "muted" }, T("Buscando...")));
    let r;
    try { r = await web("admin/dups", {}); } catch (e) { box.replaceChildren(errorBox(e)); return; }
    if (!r.groups.length) { box.replaceChildren(h("p", { class: "muted" }, T("No hay canciones duplicadas. 🎉"))); return; }
    const sure = r.groups.filter((g) => g.confidence >= 0.95).length;
    const bulk = async (mode) => {
      const msg = mode === "trash"
        ? T("Se quitará la copia de peor calidad de {n} grupos con 95 % o más de seguridad. Los archivos van a la carpeta «duplicadas-eliminadas» (no se borran del todo). ¿Continuar?", { n: sure })
        : T("Se ocultará la copia de peor calidad de {n} grupos con 95 % o más de seguridad. Los archivos no se tocan. ¿Continuar?", { n: sure });
      if (!confirm(msg)) return;
      try {
        const res = await web("admin/dups/resolve-all", { mode, min: 0.95 });
        toast(T("{n} grupos resueltos", { n: res.groups }) + (res.errors ? ` · ${T("{n} con error", { n: res.errors })}` : ""));
        load();
      } catch (e) { showError(e); }
    };
    box.replaceChildren(h("p", { class: "muted" }, T("{n} grupos de canciones duplicadas", { n: nf.format(r.total) })),
      h("div", { class: "sug-tools" },
        h("button", { class: "btn danger", disabled: !sure, onclick: () => bulk("trash") },
          T("Quedarme con la recomendada y eliminar las demás en las de 95 % o más de seguridad ({n})", { n: sure })),
        h("button", { class: "btn", disabled: !sure, onclick: () => bulk("hide") },
          T("Quedarme con la recomendada y ocultar las demás en las de 95 % o más de seguridad ({n})", { n: sure }))),
      ...r.groups.map(group));
  }
  function group(g) {
    let keep = g.recommended;
    const el = h("section", { class: "panel dup-group" });
    const draw = () => {
      const first = g.songs[0];
      el.replaceChildren(
        h("h3", {}, `${first.title} — ${first.artist}`, h("span", { class: "badge conf" }, T("{n} % seguro", { n: Math.round(g.confidence * 100) }))),
        h("ul", { class: "dup-list" }, g.songs.map((s) => h("li", { class: s.id === keep ? "keep" : "" },
          h("label", {},
            h("input", { type: "radio", name: `keep-${g.key}`, checked: s.id === keep, style: { accentColor: "var(--accent)" }, onchange: () => { keep = s.id; draw(); } }),
            h("span", { class: "grow" },
              h("span", { class: "dup-file" }, s.file),
              h("span", { class: "muted small block" },
                [s.album, (s.suffix || "").toUpperCase(), s.bitrate ? `${s.bitrate} kbps` : null, fmtSize(s.size), fmtTime(s.duration || 0),
                  s.plays ? T("{n} reproducciones", { n: s.plays }) : null].filter(Boolean).join(" · ")),
              s.id === g.recommended ? h("span", { class: "badge" }, T("Recomendada: mejor calidad")) : null)))) ),
        h("div", { class: "album-actions" },
          h("button", { class: "btn danger", onclick: () => resolve("trash") }, T("Quedarme con la marcada y eliminar las demás")),
          h("button", { class: "btn", onclick: () => resolve("hide") }, T("Quedarme con la marcada y ocultar las demás")),
          h("button", { class: "btn", onclick: dismiss }, T("No son duplicadas"))));
    };
    const resolve = async (mode) => {
      const msg = mode === "trash"
        ? T("Los archivos eliminados se mueven a la carpeta «duplicadas-eliminadas» de los datos de Zinctify (no se borran del todo). Las playlists pasarán a usar la que te quedas. ¿Continuar?")
        : T("Los archivos no se tocan, solo dejan de salir en la biblioteca. Las playlists pasarán a usar la que te quedas. ¿Continuar?");
      if (!confirm(msg)) return;
      try {
        await web("admin/dups/resolve", { keep, remove: g.songs.map((s) => s.id), mode });
        el.remove(); toast(T("Hecho"));
      } catch (e) { showError(e); }
    };
    const dismiss = async () => { try { await web("admin/dups/dismiss", { key: g.key }); el.remove(); } catch (e) { showError(e); } };
    draw();
    return el;
  }
  load();
  return h("div", {}, h("h2", {}, T("Canciones duplicadas")), info, box);
}


async function adminRadios() {
  const r = await api("getInternetRadioStations");
  const stations = r.internetRadioStations.internetRadioStation || [];
  let editing = null;
  const name = h("input", { type: "text", required: true, autocomplete: "off" });
  const url = h("input", { type: "url", required: true, placeholder: "https://...", autocomplete: "off" });
  const home = h("input", { type: "url", placeholder: T("https://... (opcional)"), autocomplete: "off" });
  const formTitle = h("h2", {}, T("Añadir una radio"));
  const submit = h("button", { class: "btn primary", type: "submit" }, T("Añadir radio"));
  const cancel = h("button", { class: "btn", type: "button", hidden: true, onclick: () => resetForm() }, T("Cancelar"));
  function resetForm() {
    editing = null;
    name.value = url.value = home.value = "";
    formTitle.textContent = T("Añadir una radio");
    submit.textContent = T("Añadir radio");
    cancel.hidden = true;
  }
  const form = h("form", {
    class: "inline-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const params = { name: name.value.trim(), streamUrl: url.value.trim(), homepageUrl: home.value.trim() || undefined };
      try {
        if (editing) await api("updateInternetRadioStation", { ...params, id: editing }, true);
        else await api("createInternetRadioStation", params, true);
        toast(T("Guardado"));
        render();
      } catch (ex) { showError(ex); }
    },
  },
  h("div", { class: "field" }, h("label", {}, T("Nombre"), name)),
  h("div", { class: "field" }, h("label", {}, T("URL del stream"), url)),
  h("div", { class: "field" }, h("label", {}, T("Página web"), home)),
  submit, cancel);

  const coverAct = async (fn, okMsg) => { try { await fn(); toast(okMsg); render(); } catch (e) { showError(e); } };
  const rows = stations.map((s) => h("tr", {},
    h("td", {}, h("div", { class: "r-admin-name" }, h("div", { class: "r-cover small" }, coverEl(s.coverArt, s.name, 80)), s.name)),
    h("td", { class: "url" }, s.streamUrl),
    h("td", { class: "actions" },
      h("button", { class: "btn", onclick: () => playQueue([{ radio: true, id: s.id, title: s.name, artist: T("Radio en directo"), url: s.streamUrl, coverArt: s.coverArt }], 0) }, icon("play", 14), T("Probar")),
      h("button", {
        class: "btn",
        onclick: () => {
          editing = s.id;
          name.value = s.name; url.value = s.streamUrl; home.value = s.homePageUrl || "";
          formTitle.textContent = T("Editar la radio");
          submit.textContent = T("Guardar cambios");
          cancel.hidden = false;
          name.focus();
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      }, T("Editar")),
      h("button", { class: "btn", onclick: () => coverAct(async () => { const f = await pickImage(); if (!f) throw new Error(T("No se ha elegido ninguna imagen")); await uploadImage("radio-cover?id=" + encodeURIComponent(s.id), f); }, T("Portada guardada")) }, T("Subir portada")),
      h("button", { class: "btn", onclick: () => coverAct(() => web("radio/cover-fetch", { id: s.id }), T("Logo encontrado")) }, T("Buscar logo")),
      s.coverArt ? h("button", { class: "btn", onclick: () => coverAct(() => web("radio/cover-remove", { id: s.id }), T("Portada quitada")) }, T("Quitar portada")) : null,
      h("button", {
        class: "btn danger",
        onclick: async () => {
          if (!confirm(T("¿Borrar la radio «{name}»?", { name: s.name }))) return;
          try { await api("deleteInternetRadioStation", { id: s.id }, true); render(); } catch (e) { showError(e); }
        },
      }, T("Borrar")))));
  const radiosOn = h("input", { type: "checkbox", checked: state.radiosOn === true, style: { accentColor: "var(--accent)" },
    onchange: async (e) => {
      try { const r = await web("admin/radios/visible", { enabled: e.target.checked }); state.radiosOn = r.enabled; applyRadiosPref(); toast(r.enabled ? T("Radios activadas para todos") : T("Radios ocultas para todos")); }
      catch (err) { e.target.checked = !e.target.checked; showError(err); }
    } });
  return h("div", {},
    h("section", { class: "panel" },
      h("label", { class: "check" }, radiosOn, h("span", {}, T("Mostrar la sección Radios a todos los usuarios"))),
      h("p", { class: "muted" }, T("Está desactivada por defecto. Aquí, como administrador, siempre puedes gestionar la lista."))),
    h("p", { class: "muted lead" }, T("Las radios de esta lista las ven todos los usuarios en la sección Radios.")),
    stations.length
      ? h("table", { class: "table wide" }, h("thead", {}, h("tr", {}, [T("Nombre"), T("URL del stream"), ""].map((x) => h("th", {}, x)))), h("tbody", {}, rows))
      : h("div", { class: "empty" }, h("p", {}, T("Todavía no hay radios. Añade la URL directa de un stream (por ejemplo, una que termine en .mp3 o .aac)."))),
    formTitle, form);
}

const FIELD_LABEL = { title: "Título", artist: "Artista", album: "Álbum" };

async function adminMetadata() {
  const st = await web("admin/meta");
  const provName = Object.fromEntries(st.providers.map((p) => [p.id, p.name]));

  /* servicios */
  const checks = st.providers.map((p) => {
    const box = h("input", { type: "checkbox", checked: p.selected, dataset: { id: p.id }, style: { accentColor: "var(--accent)" } });
    return h("label", { class: "check" }, box, h("span", {}, p.name,
      p.needsKey ? h("span", { class: "muted" }, ` — ${T("necesita una clave tuya")}`) : null));
  });
  const spId = h("input", { type: "text", value: st.spotifyId, autocomplete: "off", spellcheck: "false" });
  const spSecret = h("input", { type: "password", autocomplete: "new-password", placeholder: st.spotifySecretSet ? T("guardado; escribe otro para cambiarlo") : "" });
  const saveProviders = async () => {
    const providers = checks.map((c) => c.querySelector("input")).filter((i) => i.checked).map((i) => i.dataset.id);
    try {
      await web("admin/meta/config", { providers, spotifyId: spId.value.trim(), spotifySecret: spSecret.value });
      toast(T("Guardado")); render();
    } catch (e) { showError(e); }
  };

  /* escaneo */
  const limit = h("input", { type: "number", min: 1, max: 20000, value: 200 });
  const recheck = h("input", { type: "checkbox", style: { accentColor: "var(--accent)" } });
  const bar = h("progress", { max: 1, value: 0 });
  const status = h("p", { class: "muted" });
  const errBox = h("ul", { class: "errors" });
  const startBtn = h("button", { class: "btn primary" }, T("Escanear metadatos"));
  const stopBtn = h("button", { class: "btn", hidden: true, onclick: () => web("admin/meta/stop", {}).catch(showError) }, T("Parar"));
  const counts = h("p", { class: "muted small" });
  const autoBox = h("label", { class: "check" },
    h("input", { type: "checkbox", checked: st.auto, style: { accentColor: "var(--accent)" }, onchange: async (e) => {
      try { await web("admin/meta/config", { providers: st.providers.filter((p) => p.selected).map((p) => p.id), auto: e.target.checked }); toast(T("Guardado")); } catch (ex) { e.target.checked = !e.target.checked; showError(ex); }
    } }),
    h("span", {}, T("Pasar el escaneo de metadatos automáticamente a cada archivo nuevo")));
  const lyBox = h("label", { class: "check" },
    h("input", { type: "checkbox", checked: st.lyricsOnline, style: { accentColor: "var(--accent)" }, onchange: async (e) => {
      try { await web("admin/meta/config", { providers: st.providers.filter((p) => p.selected).map((p) => p.id), lyricsOnline: e.target.checked }); toast(T("Guardado")); } catch (ex) { e.target.checked = !e.target.checked; showError(ex); }
    } }),
    h("span", {}, T("Buscar letras que falten en internet (LRCLIB y NetEase). Solo se envían título, artista, álbum y duración")));
  const lyJob = h("p", { class: "muted small ly-job" });
  const lyStartBtn = h("button", { class: "btn small", type: "button" }, T("Buscar las letras que faltan"));
  const lyUpgradeBtn = h("button", { class: "btn small", type: "button", title: T("Vuelve a buscar, en las que solo tienen texto, una versión sincronizada") }, T("Mejorar a sincronizadas"));
  const lyStopBtn = h("button", { class: "btn small", type: "button", hidden: true }, T("Parar"));
  let lyTimer = null;
  const drawLyJob = (j) => {
    lyStartBtn.disabled = lyUpgradeBtn.disabled = j.running;
    lyStopBtn.hidden = !j.running;
    lyJob.textContent = j.running || j.done
      ? `${j.running ? T("Buscando…") : T("Terminado")} ${nf.format(j.done)}/${nf.format(j.total)} · ${T("sincronizadas")}: ${nf.format(j.synced)} · ${T("solo texto")}: ${nf.format(j.plain)} · ${T("sin letra")}: ${nf.format(j.none)}${j.error ? " · " + j.error : ""}`
      : "";
  };
  const pollLy = async () => {
    try {
      const r = await web("admin/lyrics", { action: "status" });
      drawLyJob(r.job);
      clearTimeout(lyTimer);
      if (r.job.running && lyJob.isConnected) lyTimer = setTimeout(pollLy, 2000);
    } catch (e) { /* nada */ }
  };
  const startLy = (mode) => async () => { try { drawLyJob((await web("admin/lyrics", { action: "start", mode })).job); pollLy(); } catch (e) { showError(e); } };
  lyStartBtn.addEventListener("click", startLy("missing"));
  lyUpgradeBtn.addEventListener("click", startLy("upgrade"));
  lyStopBtn.addEventListener("click", async () => { try { await web("admin/lyrics", { action: "stop" }); pollLy(); } catch (e) { showError(e); } });
  pollLy();
  const hours = h("input", { type: "number", min: 0, max: 720, step: 1, style: { width: "5em" }, "aria-label": T("Horas entre sincronizaciones") });
  web("admin/import/config", {}).then((r) => { hours.value = r.hours; }).catch(() => {});
  hours.addEventListener("change", async () => { try { await web("admin/import/config", { hours: hours.value }); toast(T("Guardado")); } catch (e) { showError(e); } });
  const importBox = h("label", { class: "check" }, T("Sincronizar las playlists vinculadas cada"), hours, T("horas (0 = nunca)"));
  const spLoginId = h("input", { type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "Client ID" });
  const spLoginRedir = h("input", { type: "url", autocomplete: "off", spellcheck: "false", placeholder: "https://mi-maquina.mi-tailnet.ts.net/spotify-callback", "aria-label": T("Dirección de redirección") });
  web("admin/spotify/config").then((r) => { spLoginId.value = r.clientId; spLoginRedir.value = r.redirect; }).catch(() => {});
  const spLoginSave = h("button", { class: "btn", type: "button" }, T("Guardar"));
  spLoginSave.addEventListener("click", async () => {
    try { await web("admin/spotify/config", { clientId: spLoginId.value.trim(), redirect: spLoginRedir.value.trim() }); toast(T("Guardado")); } catch (e) { showError(e); }
  });
  const spotifyLoginBox = h("div", { class: "field" },
    h("strong", {}, T("Iniciar sesión con Spotify (importar playlists de más de 100 canciones)")),
    h("p", { class: "muted small" }, T("Crea una app en developer.spotify.com/dashboard, añade abajo la misma dirección como Redirect URI y pega su Client ID. La dirección debe ser https (por ejemplo la de Tailscale Serve) y terminar en /spotify-callback.")),
    h("label", {}, "Client ID", spLoginId),
    h("label", {}, T("Dirección de redirección"), spLoginRedir),
    spLoginSave);
  let wasRunning = false;
  const draw = (s) => {
    const job = s.job;
    startBtn.disabled = job.running;
    stopBtn.hidden = !job.running;
    bar.hidden = !job.running && !job.total;
    bar.max = Math.max(1, job.total); bar.value = job.done;
    status.textContent = job.running
      ? T("Revisando... {done} de {total} canciones, {n} propuestas nuevas", { done: nf.format(job.done), total: nf.format(job.total), n: nf.format(job.suggested) })
      : (job.finished ? T("Última pasada: {done} canciones revisadas, {n} propuestas nuevas", { done: nf.format(job.done), n: nf.format(job.suggested) }) : T("Todavía no has escaneado metadatos."));
    errBox.replaceChildren(...Object.entries(job.errors).map(([k, v]) => h("li", {}, `${provName[k] || k}: ${v}`)));
    counts.textContent = T("{checked} de {songs} canciones revisadas · {pending} propuestas pendientes · {overrides} correcciones aplicadas",
      { checked: nf.format(s.counts.checked), songs: nf.format(s.counts.songs), pending: nf.format(s.counts.pending), overrides: nf.format(s.counts.overrides) });
  };
  draw(st);
  const watch = () => pollWhile(status, async () => {
    const s = await web("admin/meta");
    draw(s);
    if (wasRunning && !s.job.running) loadList(true);
    wasRunning = s.job.running;
    return s.job.running;
  });
  if (st.job.running) { wasRunning = true; watch(); }
  startBtn.addEventListener("click", async () => {
    try {
      await web("admin/meta/run", { limit: Number(limit.value) || 200, recheck: recheck.checked });
      wasRunning = true;
      draw({ ...st, job: { running: true, total: 0, done: 0, suggested: 0, errors: {}, finished: null }, counts: st.counts });
      watch();
    } catch (e) { showError(e); }
  });

  /* propuestas */
  let filter = "pending", offset = 0;
  const list = h("ul", { class: "sugs" });
  const more = h("button", { class: "btn", hidden: true }, T("Cargar más"));
  const total = h("p", { class: "muted" });
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const drawTabs = () => tabs.replaceChildren(...[["pending", T("Pendientes")], ["accepted", T("Aceptadas")], ["rejected", T("Descartadas")]].map(([id, label]) =>
    h("button", { type: "button", role: "tab", "aria-selected": String(filter === id), onclick: () => { filter = id; drawTabs(); loadList(true); } }, label)));
  drawTabs();

  async function decide(ids, action, row) {
    try {
      await web("admin/meta/decide", { ids, action });
      if (row) row.remove();
      const s = await web("admin/meta"); draw(s);
      if (!list.children.length) loadList(true);
    } catch (e) { showError(e); }
  }
  function suggestionRow(g) {
    const row = h("li", { class: "sug" },
      h("div", { class: "sug-what" }, h("strong", {}, g.song), h("span", { class: "muted" }, ` ${g.artist}`), h("div", { class: "muted small file" }, g.file)),
      h("div", { class: "sug-change" },
        h("span", { class: "sug-field" }, T(FIELD_LABEL[g.field])),
        h("del", {}, g.current), h("ins", {}, g.suggested)),
      h("div", { class: "muted small sug-meta" }, `${Math.round(g.score * 100)} % · ${g.providers.map((p) => provName[p] || p).join(", ")}`),
      g.status === "pending" ? h("div", { class: "sug-actions" },
        h("button", { class: "btn primary", onclick: () => decide([g.id], "accept", row) }, T("Aceptar")),
        h("button", { class: "btn", onclick: () => decide([g.id], "reject", row) }, T("Descartar"))) : null,
      g.status === "rejected" ? h("div", { class: "sug-actions" },
        h("button", { class: "btn", onclick: () => decide([g.id], "reopen", row) }, T("Recuperar"))) : null);
    return row;
  }
  async function loadList(reset) {
    if (reset) { offset = 0; list.replaceChildren(); }
    try {
      const r = await web("admin/meta/list", { status: filter, offset });
      r.items.forEach((g) => list.append(suggestionRow(g)));
      offset += r.items.length;
      more.hidden = offset >= r.total;
      total.textContent = r.total ? T("{n} propuestas", { n: nf.format(r.total) }) : T("No hay propuestas aquí.");
    } catch (e) { showError(e); }
  }
  more.addEventListener("click", () => loadList(false));
  loadList(true);
  const acceptSure = h("button", {
    class: "btn",
    onclick: async () => {
      if (!confirm(T("¿Aceptar todas las propuestas pendientes con confianza del 95 % o más?"))) return;
      try {
        const r = await web("admin/meta/decide", { minScore: 0.95, action: "accept" });
        toast(T("{n} canciones corregidas", { n: r.changed })); loadList(true); draw(await web("admin/meta"));
      } catch (e) { showError(e); }
    },
  }, T("Aceptar las de confianza alta"));

  /* correcciones aplicadas */
  const applied = h("ul", { class: "sugs" });
  const appliedBox = h("details", { class: "applied" }, h("summary", {}, T("Correcciones aplicadas")), applied);
  appliedBox.addEventListener("toggle", async () => {
    if (!appliedBox.open) return;
    try {
      const r = await web("admin/meta/overrides", {});
      applied.replaceChildren(...(r.items.length ? r.items.map((o) => {
        const row = h("li", { class: "sug" },
          h("div", { class: "sug-what" }, h("strong", {}, o.title || o.album || o.artist || ""), h("div", { class: "muted small file" }, o.file)),
          h("div", { class: "sug-change" }, [o.title && `${T("Título")}: ${o.title}`, o.artist && `${T("Artista")}: ${o.artist}`, o.album && `${T("Álbum")}: ${o.album}`].filter(Boolean).join("  ·  ")),
          h("div", { class: "sug-actions" }, h("button", {
            class: "btn danger",
            onclick: async () => { try { await web("admin/meta/undo", { file: o.file }); row.remove(); draw(await web("admin/meta")); } catch (e) { showError(e); } },
          }, T("Deshacer"))));
        return row;
      }) : [h("li", { class: "muted" }, T("Todavía no has aceptado ninguna corrección."))]));
    } catch (e) { showError(e); }
  });

  return h("div", {},
    h("p", { class: "muted lead" }, T("Compara los metadatos de tu biblioteca con servicios en línea y te propone correcciones (tildes, mayúsculas, caracteres raros). Tus archivos de música no se modifican: lo que aceptes se guarda en la base de datos de Zinctify.")),
    h("section", { class: "panel" },
      h("h2", {}, T("Servicios")),
      h("div", { class: "checks" }, checks),
      h("div", { class: "inline-form keys" },
        h("div", { class: "field" }, h("label", {}, "Spotify Client ID", spId)),
        h("div", { class: "field" }, h("label", {}, "Spotify Client Secret", spSecret))),
      h("p", { class: "muted small" }, T("A estos servicios se envían solo el título y el artista de cada canción. SoundCloud no está disponible porque ya no da claves de API a aplicaciones nuevas. Las claves de Spotify se crean gratis en developer.spotify.com.")),
      h("button", { class: "btn", onclick: saveProviders }, T("Guardar servicios"))),
    h("section", { class: "panel" },
      h("h2", {}, T("Escanear")),
      h("div", { class: "inline-form" },
        h("div", { class: "field" }, h("label", {}, T("Canciones por pasada"), limit)),
        h("label", { class: "check" }, recheck, h("span", {}, T("Volver a revisar también las ya revisadas")))),
      autoBox,
      lyBox,
      h("div", { class: "album-actions" }, lyStartBtn, lyUpgradeBtn, lyStopBtn), lyJob,
      importBox,
      spotifyLoginBox,
      h("div", { class: "album-actions" }, startBtn, stopBtn),
      bar, status, errBox, counts),
    h("section", { class: "panel wide" },
      h("h2", {}, T("Propuestas")),
      tabs,
      h("div", { class: "sug-tools" }, total, acceptSure),
      list, h("p", {}, more)),
    appliedBox);
}

async function adminUsers() {
  const st = await web("admin/state");
  const meName = state.user.username;
  const users = h("table", { class: "table" },
    h("thead", {}, h("tr", {}, [T("Usuario"), T("Correo electrónico"), T("Administrador"), T("Reproducciones"), T("Alta"), ""].map((t) => h("th", {}, t)))),
    h("tbody", {}, st.users.map((u) => h("tr", {},
      h("td", {}, u.username),
      h("td", { class: "muted" }, u.email || "—"),
      h("td", {}, h("input", {
        type: "checkbox", checked: u.isAdmin, "aria-label": T("{user} es administrador", { user: u.username }),
        style: { accentColor: "var(--accent)" },
        onchange: async (e) => {
          try { await web("admin/set-admin", { username: u.username, isAdmin: e.target.checked }); toast(T("Guardado")); }
          catch (ex) { e.target.checked = !e.target.checked; showError(ex); }
        },
      })),
      h("td", { class: "num" }, nf.format(u.plays)),
      h("td", {}, new Date(u.created).toLocaleDateString(LOCALE)),
      h("td", {}, u.username === meName ? null : h("button", {
        class: "btn danger",
        onclick: async () => {
          if (!confirm(T("¿Borrar la cuenta «{user}» y su historial de reproducciones? No se puede deshacer.", { user: u.username }))) return;
          try { await web("admin/delete-user", { username: u.username }); render(); } catch (e) { showError(e); }
        },
      }, T("Borrar")))))));

  const newName = h("input", { type: "text", required: true, autocomplete: "off", autocapitalize: "none" });
  const newPass = h("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
  const newMail = h("input", { type: "email", required: true, autocomplete: "off" });
  return h("div", {},
    users,
    h("label", { class: "check" },
      h("input", {
        type: "checkbox", checked: st.signupOpen,
        onchange: async (e) => {
          try { await web("admin/signup", { open: e.target.checked }); toast(e.target.checked ? T("Registro abierto") : T("Registro cerrado")); }
          catch (ex) { e.target.checked = !e.target.checked; showError(ex); }
        },
      }),
      h("span", {}, T("Permitir que cualquiera cree una cuenta desde la pantalla de entrada. Si lo dejas desmarcado, solo tú puedes crear cuentas."))),
    h("h2", { style: { marginTop: "28px" } }, T("Correo para recuperar contraseñas")),
    smtpSection(),
    h("h2", { style: { marginTop: "28px" } }, T("Crear un usuario")),
    h("form", {
      class: "inline-form",
      onsubmit: async (e) => {
        e.preventDefault();
        try { await web("admin/create-user", { username: newName.value.trim(), password: newPass.value, email: newMail.value.trim() }); render(); } catch (ex) { showError(ex); }
      },
    },
    h("div", { class: "field" }, h("label", {}, T("Usuario"), newName)),
    h("div", { class: "field" }, h("label", {}, T("Correo electrónico"), newMail)),
    h("div", { class: "field" }, h("label", {}, T("Contraseña (mínimo 8 caracteres)"), newPass)),
    h("button", { class: "btn primary", type: "submit" }, T("Crear usuario"))));
}


function smtpSection() {
  const box = h("div", {});
  const f = (label, el) => h("div", { class: "field" }, h("label", {}, label, el));
  (async () => {
    let c;
    try { c = await web("admin/smtp"); } catch (e) { box.append(h("p", { class: "error" }, e.message)); return; }
    const host = h("input", { type: "text", value: c.host, placeholder: "smtp.gmail.com", autocomplete: "off" });
    const port = h("input", { type: "number", value: c.port, min: 1, max: 65535 });
    const sec = h("select", {}, ...[["starttls", "STARTTLS (587)"], ["ssl", "SSL/TLS (465)"], ["none", T("Sin cifrado")]].map(([v, l]) => h("option", { value: v, selected: c.security === v }, l)));
    const user = h("input", { type: "text", value: c.user, autocomplete: "off", autocapitalize: "none" });
    const pass = h("input", { type: "password", placeholder: c.hasPass ? T("(sin cambios)") : "", autocomplete: "new-password" });
    const from = h("input", { type: "text", value: c.from, placeholder: "Zinctify <zinctify@tudominio.com>", autocomplete: "off" });
    const to = h("input", { type: "email", placeholder: T("Correo para la prueba"), autocomplete: "off" });
    const save = async () => {
      await web("admin/smtp", { host: host.value, port: port.value, security: sec.value, user: user.value, password: pass.value, from: from.value });
      pass.value = ""; pass.placeholder = T("(sin cambios)");
    };
    box.append(
      h("p", { class: "muted" }, T("Cuenta de correo que usa Zinctify para enviar los códigos de «Olvidé mi contraseña». Si dejas el servidor vacío, esa opción queda desactivada.")),
      h("form", { class: "inline-form", onsubmit: async (e) => { e.preventDefault(); try { await save(); toast(T("Guardado")); } catch (ex) { showError(ex); } } },
        f(T("Servidor SMTP"), host), f(T("Puerto"), port), f(T("Cifrado"), sec), f(T("Usuario"), user), f(T("Contraseña"), pass), f(T("Remitente"), from),
        h("button", { class: "btn primary", type: "submit" }, T("Guardar"))),
      h("div", { class: "inline-form", style: { marginTop: "10px" } }, f(T("Enviar correo de prueba a"), to),
        h("button", { class: "btn", type: "button", onclick: async (e) => {
          e.target.disabled = true;
          try { await save(); const r = await web("admin/smtp-test", { to: to.value.trim() }); toast(T("Correo enviado a {to}", { to: r.to })); }
          catch (ex) { showError(ex); } finally { e.target.disabled = false; }
        } }, T("Probar"))));
  })();
  return box;
}

/* ---------- entrar y crear cuenta ---------- */

function renderAuth(notice = "") {
  stopPlayback();
  let mode = state.signup === "first" ? "signup" : "login";
  const box = h("div", { class: "auth-box" });
  root.replaceChildren(h("div", { class: "auth" }, box));


  /* «Olvidé mi contraseña»: correo → código → contraseña nueva */
  function drawForgot(step, ctx = {}) {
    const err = h("div", { class: "error", role: "alert" });
    const info = ctx.info ? h("p", { class: "muted" }, ctx.info) : null;
    const back = h("a", { class: "forgot-link", href: "#", onclick: (e) => { e.preventDefault(); mode = "login"; draw(); } }, T("Volver a entrar"));
    let title, form;
    const run = (btn, fn) => async (e) => {
      e.preventDefault(); err.textContent = ""; btn.disabled = true;
      try { await fn(); } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
    if (step === "email") {
      title = T("Recuperar contraseña");
      const mail = h("input", { type: "email", required: true, autocomplete: "email", value: ctx.email || "" });
      const btn = h("button", { class: "btn primary wide", type: "submit" }, T("Enviar código de recuperación"));
      form = h("form", { onsubmit: run(btn, async () => {
        await web("reset/request", { email: mail.value.trim() });
        drawForgot("code", { email: mail.value.trim(), info: T("Te hemos enviado un código a {email}. Caduca en 10 minutos.", { email: mail.value.trim() }) });
      }) },
      h("p", { class: "muted" }, T("Escribe el correo de tu cuenta y te enviaremos un código para cambiar la contraseña.")),
      h("div", { class: "field" }, h("label", {}, T("Correo electrónico"), mail)), err, btn);
      setTimeout(() => mail.focus(), 0);
    } else if (step === "code") {
      title = T("Escribe el código");
      const code = h("input", { type: "text", required: true, inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, pattern: "[0-9 ]{6,7}", placeholder: "000000", class: "code-input" });
      const btn = h("button", { class: "btn primary wide", type: "submit" }, T("Confirmar código"));
      form = h("form", { onsubmit: run(btn, async () => {
        const r = await web("reset/verify", { email: ctx.email, code: code.value });
        drawForgot("new", { email: ctx.email, token: r.token });
      }) },
      info, h("div", { class: "field" }, h("label", {}, T("Código de 6 cifras"), code)), err, btn,
      h("a", { class: "forgot-link", href: "#", onclick: (e) => { e.preventDefault(); drawForgot("email", { email: ctx.email }); } }, T("Pedir otro código")));
      setTimeout(() => code.focus(), 0);
    } else {
      title = T("Nueva contraseña");
      const p1 = h("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
      const p2 = h("input", { type: "password", required: true, autocomplete: "new-password" });
      const btn = h("button", { class: "btn primary wide", type: "submit" }, T("Cambiar contraseña"));
      form = h("form", { onsubmit: async (e) => {
        if (p1.value !== p2.value) { e.preventDefault(); err.textContent = T("Las contraseñas no coinciden."); return; }
        return run(btn, async () => {
          await web("reset/confirm", { email: ctx.email, token: ctx.token, password: p1.value });
          mode = "login"; draw(T("Contraseña cambiada. Ya puedes entrar."));
        })(e);
      } },
      h("div", { class: "field" }, h("label", {}, T("Contraseña (mínimo 8 caracteres)"), p1)),
      h("div", { class: "field" }, h("label", {}, T("Repite la contraseña"), p2)), err, btn);
      setTimeout(() => p1.focus(), 0);
    }
    box.replaceChildren(
      h("img", { class: "auth-logo", src: "/logo.svg", alt: "", width: 72, height: 72 }),
      h("h1", { class: "brand-font" }, "Zinctify"), h("h2", { class: "forgot-title" }, title),
      form, back, h("div", { class: "auth-lang" }, langSelect()));
  }

  function draw(message = "") {
    const tab = (id, label) => h("button", {
      type: "button", role: "tab", "aria-selected": String(mode === id),
      onclick: () => { mode = id; draw(); },
    }, label);
    const closed = mode === "signup" && state.signup === "closed";
    const first = state.signup === "first";

    const user = h("input", { type: "text", name: "username", required: true, autocomplete: "username", autocapitalize: "none", spellcheck: "false" });
    const pass = h("input", { type: "password", name: "password", required: true, autocomplete: mode === "login" ? "current-password" : "new-password", minlength: mode === "signup" ? 8 : null });
    const pass2 = mode === "signup" ? h("input", { type: "password", required: true, autocomplete: "new-password" }) : null;
    const email = mode === "signup" ? h("input", { type: "email", name: "email", required: true, autocomplete: "email" }) : null;
    const err = h("div", { class: "error", role: "alert" }, message);
    const submit = h("button", { class: "btn primary wide", type: "submit" },
      mode === "login" ? T("Entrar") : first ? T("Crear cuenta de administrador") : T("Crear cuenta"));

    const form = closed
      ? h("p", { class: "muted" }, T("El registro está cerrado. Pídele al administrador que te cree una cuenta."))
      : h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          err.textContent = "";
          if (pass2 && pass.value !== pass2.value) { err.textContent = T("Las contraseñas no coinciden."); return; }
          submit.disabled = true;
          try {
            const r = await web(mode, { username: user.value.trim(), password: pass.value, email: email ? email.value.trim() : undefined });
            state.user = r.user;
            state.apiKey = r.apiKey;
            renderShell();
            await render();
          } catch (ex) { err.textContent = ex.message; submit.disabled = false; }
        },
      },
      h("div", { class: "field" }, h("label", {}, T("Usuario"), user)),
      email ? h("div", { class: "field" }, h("label", {}, T("Correo electrónico"), email)) : null,
      h("div", { class: "field" }, h("label", {}, mode === "signup" ? T("Contraseña (mínimo 8 caracteres)") : T("Contraseña"), pass)),
      mode === "login" ? h("a", { class: "forgot-link", href: "#", onclick: (e) => { e.preventDefault(); drawForgot("email"); } }, T("Olvidé mi contraseña")) : null,
      pass2 ? h("div", { class: "field" }, h("label", {}, T("Repite la contraseña"), pass2)) : null,
      err, submit);

    box.replaceChildren(
      h("img", { class: "auth-logo", src: "/logo.svg", alt: "", width: 72, height: 72 }),
      h("h1", { class: "brand-font" }, "Zinctify"),
      h("p", { class: "tag" }, first
        ? T("Crea la primera cuenta. Será la administradora: podrá escanear la biblioteca y gestionar usuarios.")
        : T("Tu música, en tu servidor.")),
      ...(first ? [] : [h("div", { class: "tabs", role: "tablist" }, tab("login", T("Entrar")), tab("signup", T("Crear cuenta")))]),
      form,
      h("div", { class: "auth-lang" }, langSelect()));
    const firstInput = $("input", box);
    if (firstInput) firstInput.focus();
  }
  draw(notice);
}


/* ---------- estructura general y rutas ---------- */

const ROUTES = {
  "": homeView, artists: artistsView, artist: artistView, albums: albumsView, album: albumView,
  search: searchView, radios: radiosView, wrapped: wrappedView, settings: settingsView, admin: adminView,
  together: togetherView, offline: offlineView, playlist: playlistView, song: songView, trash: trashView, user: userView, library: libraryView, profile: profileView, changelog: changelogView,
};

function parseHash() {
  const [name, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  let arg = rest.join("/");
  try { arg = decodeURIComponent(arg); } catch (e) { /* dejar tal cual */ }
  return { name: name || "", arg };
}

function drawTopbarAvatar() {
  const btn = $("#user-btn");
  if (btn) btn.replaceChildren(avatarEl(state.user));
}


/* ---------- campana de notificaciones ---------- */

const bell = { badge: null, btn: null, panel: null, timer: null };
function setBadge(n) {
  if (!bell.badge) return;
  bell.badge.textContent = n > 99 ? "99+" : String(n);
  bell.badge.hidden = !n;
}
async function pollBell() {
  try { setBadge((await web("notifications/count", {})).unread); } catch (e) { /* sin red: se queda como estaba */ }
}
function startBellPolling() {
  clearInterval(bell.timer);
  pollBell();
  bell.timer = setInterval(() => { if (!document.hidden) pollBell(); }, 45000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.user) pollBell(); });

function agoText(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (s < 60) return rtf.format(0, "second");
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  return rtf.format(-Math.floor(s / 86400), "day");
}

function closeBell() {
  if (bell.panel) { bell.panel.remove(); bell.panel = null; }
  if (bell.btn) bell.btn.setAttribute("aria-expanded", "false");
}
document.addEventListener("pointerdown", (e) => {
  if (bell.panel && !bell.panel.contains(e.target) && !(bell.btn && bell.btn.contains(e.target))) closeBell();
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBell(); });
window.addEventListener("hashchange", closeBell);

function bellItem(n, redraw) {
  const who = n.displayName || n.username || "";
  let text, href = null, actions = null;
  const strong = (t) => h("strong", {}, t);
  const parts = (tpl, vars) => tpl.split(/(\{\w+\})/).map((p) => { const m = p.match(/^\{(\w+)\}$/); return m ? strong(vars[m[1]]) : p; });
  if (n.kind === "artist_music") {
    text = parts(n.whole ? T("{artist} tiene un álbum nuevo: {album}") : T("{artist} tiene música nueva en {album}"), { artist: nm(n.artist), album: nm(n.album) });
    href = `#/album/${n.albumId}`;
  } else if (n.kind === "follower") {
    text = parts(T("{user} ha empezado a seguirte"), { user: who });
    href = `#/user/${encodeURIComponent(n.username)}`;
    if (n.friend) actions = h("span", { class: "friend-tag" }, icon("users", 14), T("Ya sois amigos"));
    else if (!n.following) actions = h("button", { class: "btn small primary", type: "button", onclick: async (e) => {
      e.stopPropagation();
      try { await web("user/follow", { username: n.username, follow: true }); n.following = true; n.friend = true; redraw(); } catch (ex) { showError(ex); }
    } }, T("Seguir también"));
  } else if (n.kind === "follow_playlist") {
    text = parts(T("{user} ha publicado la playlist {name}"), { user: who, name: n.name });
    href = `#/playlist/${n.playlistId}`;
  } else if (n.kind === "collab_invite") {
    text = parts(T("{user} te invita a colaborar en la playlist {name}"), { user: who, name: n.name });
    href = `#/playlist/${n.playlistId}`;
    const answer = (accept) => async (e) => {
      e.stopPropagation();
      try {
        await web("playlist/respond", { id: n.playlistId, accept });
        n.gone = true; redraw(); loadLibrary(); pollBell();
        toast(accept ? T("Ahora colaboras en «{name}»", { name: n.name }) : T("Invitación rechazada"), accept ? `#/playlist/${n.playlistId}` : null);
      } catch (ex) { showError(ex); }
    };
    actions = h("span", { class: "notice-actions" },
      h("button", { class: "btn small primary", type: "button", onclick: answer(true) }, T("Aceptar")),
      h("button", { class: "btn small", type: "button", onclick: answer(false) }, T("Rechazar")));
  } else if (n.kind === "collab_accept") {
    text = parts(T("{user} ha aceptado colaborar en {name}"), { user: who, name: n.name });
    href = `#/playlist/${n.playlistId}`;
  } else return null;
  const kindIcon = n.kind === "artist_music" ? icon("heart", 18) : null;
  const open = () => {
    if (!n.read) web("notifications/read", { ids: [n.id] }).then(pollBell).catch(() => {});
    n.read = true;
    closeBell();
    if (href) location.hash = href;
  };
  const row = h("li", { class: "notice" + (n.read ? "" : " unread"), tabindex: 0, role: "button", onclick: open,
    onkeydown: (e) => { if (e.key === "Enter") open(); } },
    n.username ? avatarEl(n) : h("span", { class: "avatar notice-ico" }, kindIcon),
    h("div", { class: "grow" }, h("div", { class: "notice-text" }, text), h("div", { class: "muted small" }, agoText(n.ts)), actions));
  return row;
}

async function toggleBell() {
  if (bell.panel) { closeBell(); return; }
  document.body.classList.remove("nav-open");
  const list = h("ul", { class: "notice-list" });
  const panel = h("div", { class: "bell-panel", role: "dialog", "aria-label": T("Notificaciones") });
  bell.panel = panel;
  bell.btn.setAttribute("aria-expanded", "true");
  let items = [];
  const redraw = () => {
    const shown = items.filter((n) => !n.gone);
    const rows = shown.map((n) => bellItem(n, redraw)).filter(Boolean);
    list.replaceChildren(...(rows.length ? rows : [h("li", { class: "muted notice-empty" }, T("No tienes notificaciones."))]));
  };
  panel.append(
    h("div", { class: "bell-head" }, h("strong", {}, T("Notificaciones")),
      h("span", { class: "grow" }),
      h("button", { class: "btn small", type: "button", onclick: async () => {
        try { await web("notifications/read", { all: true }); items.forEach((n) => { n.read = true; }); setBadge(0); redraw(); } catch (e) { showError(e); }
      } }, T("Marcar todo como leído")),
      h("button", { class: "btn small", type: "button", onclick: async () => {
        try { await web("notifications/clear", { all: true }); items = items.filter((n) => n.kind === "collab_invite"); redraw(); pollBell(); } catch (e) { showError(e); }
      } }, T("Vaciar"))),
    list);
  document.body.append(panel);
  list.replaceChildren(h("li", { class: "muted notice-empty" }, T("Cargando…")));
  try {
    const r = await web("notifications", {});
    items = r.items;
    setBadge(r.unread);
    if (bell.panel === panel) redraw();
  } catch (e) { closeBell(); showError(e); }
}

function showUserMenu() {
  const btn = $("#user-btn");
  if (menuEl) { closeMenu(); return; }
  const r = btn.getBoundingClientRect();
  openMenu(r.right - 230, r.bottom + 8, (m) => {
    m.classList.add("user-menu");
    const link = (iconName, label, href) => h("a", { class: "menu-item", role: "menuitem", href, onclick: closeMenu }, icon(iconName, 18), h("span", {}, label));
    m.replaceChildren(
      h("a", { class: "menu-head", href: `#/user/${encodeURIComponent(state.user.username)}`, onclick: closeMenu, title: T("Perfil") }, h("div", { class: "menu-name" }, state.user.displayName || state.user.username), h("div", { class: "muted small" }, `@${state.user.username}`)),
      h("div", { class: "menu-sep" }),
      link("user", T("Perfil"), "#/profile"),
      // Página de descargas aparte (sin barras ni música). En el cliente de escritorio no se ofrece, porque ya lo tienes.
      window.zinctifyDesktop ? null : h("a", { class: "menu-item", role: "menuitem", href: "/download.html" },
        icon("download", 18), h("span", {}, T("Descargar"))),
      link("download", T("Sin conexión"), "#/offline"),
      link("settings", T("Ajustes"), "#/settings"),
      link("trash", T("Papelera"), "#/trash"),
      state.user.isAdmin ? link("shield", T("Administración"), "#/admin") : null,
      h("div", { class: "menu-sep" }),
      link("log", T("Change log"), "#/changelog"),
      h("button", { class: "menu-item", role: "menuitem", type: "button", onclick: () => { closeMenu(); logout(); } }, icon("out", 18), h("span", {}, T("Cerrar sesión"))));
  });
}

/* ---------- biblioteca: contraer / expandir ---------- */

function libraryCollapsed() { try { return localStorage.getItem("zinctify.libcollapsed") === "1"; } catch (e) { return false; } }
function applyLibraryCollapsed() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const on = libraryCollapsed();
  shell.classList.toggle("lib-collapsed", on);
  const b = document.getElementById("lib-toggle");
  if (b) {
    const label = on ? T("Expandir la biblioteca") : T("Contraer la biblioteca");
    b.title = label; b.setAttribute("aria-label", label); b.setAttribute("aria-expanded", String(!on));
  }
  layoutVars();
}
function toggleLibrary() {
  try { localStorage.setItem("zinctify.libcollapsed", libraryCollapsed() ? "0" : "1"); } catch (e) { /* ignorar */ }
  applyLibraryCollapsed();
}

/* ---------- importar una playlist de otro servicio ---------- */

const LINK_NAMES = { spotify: "Spotify", youtube: "YouTube", soundcloud: "SoundCloud", deezer: "Deezer", text: "tu lista (CSV/texto)" };

function unmatchedList(list, total) {
  if (!list.length) return null;
  return h("details", { class: "unmatched" },
    h("summary", {}, T("{n} canciones que no están en el servidor", { n: nf.format(total || list.length) }), list.length < (total || 0) ? ` (${T("se muestran las primeras {n}", { n: list.length })})` : ""),
    h("ul", {}, list.map((u) => h("li", {}, h("strong", {}, u.title), u.artist ? ` — ${u.artist}` : ""))));
}

function fmtEta(s) {
  s = Math.max(1, Math.round(s));
  if (s < 90) return T("{n} s", { n: s });
  const m = Math.round(s / 60);
  return m < 90 ? T("{n} min", { n: m }) : T("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 });
}

function openImportDialog() {
  openModal(T("Importar playlist"), (body, close) => {
    const url = h("input", { type: "url", placeholder: "https://open.spotify.com/playlist/…", "aria-label": T("Enlace de la playlist") });
    const text = h("textarea", { rows: 5, placeholder: T("Artista - Título\\nArtista - Título\\n…") });
    const name = h("input", { type: "text", maxlength: 100, placeholder: T("Nombre (opcional)"), "aria-label": T("Nombre (opcional)") });
    const fileInfo = h("span", { class: "muted small" });
    const file = h("input", { type: "file", accept: ".csv,.txt,text/csv,text/plain", "aria-label": T("Archivo CSV") });
    const readFile = async (f) => {
      if (!f) return;
      if (f.size > 30 * 1024 * 1024) { fileInfo.textContent = T("El archivo es demasiado grande (máximo 30 MB)."); return; }
      try {
        text.value = await f.text();
        url.value = "";
        if (!name.value.trim()) name.value = f.name.replace(/\.[^.]+$/, "");
        const n = text.value.split(/\r?\n/).filter((l) => l.trim()).length;
        fileInfo.textContent = T("{file}: {n} líneas cargadas", { file: f.name, n: nf.format(n) });
      } catch (e) { fileInfo.textContent = T("No se ha podido leer el archivo."); }
    };
    file.addEventListener("change", () => readFile(file.files[0]));
    text.addEventListener("dragover", (e) => { e.preventDefault(); });
    text.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); } });
    const spBox = h("div", { class: "sp-box muted small" });
    const drawSp = (st) => {
      if (!st.ready) { spBox.replaceChildren(T("Para importar playlists de Spotify de más de 100 canciones, el administrador debe configurar el inicio de sesión de Spotify en Administración.")); return; }
      if (st.connected) {
        const off = h("button", { class: "btn small", type: "button" }, T("Desconectar"));
        off.addEventListener("click", async () => { try { drawSp(await web("spotify/disconnect", {})); } catch (e) { showError(e); } });
        spBox.replaceChildren("✓ " + T("Spotify conectado: se leen enteras tus playlists (y las que compartes con otros)."), " ", off);
        return;
      }
      const on = h("button", { class: "btn small", type: "button" }, T("Conectar Spotify"));
      on.addEventListener("click", async () => {
        try {
          const r = await web("spotify/start", {});
          try { localStorage.setItem("zinctify.spReturn", "1"); } catch (e) { /* nada */ }
          location.href = r.url;
        } catch (e) { showError(e); }
      });
      const paste = h("input", { type: "url", placeholder: "https://…/spotify-callback?code=…&state=…", "aria-label": T("Dirección de vuelta de Spotify") });
      const pasteBtn = h("button", { class: "btn small", type: "button" }, T("Usar"));
      pasteBtn.addEventListener("click", async () => {
        try { drawSp(await web("spotify/paste", { url: paste.value.trim() })); toast(T("Spotify conectado")); } catch (e) { showError(e); }
      });
      spBox.replaceChildren(T("Spotify solo deja leer sin sesión las primeras 100 canciones."), " ", on,
        h("details", {}, h("summary", {}, T("Si al volver la página no carga, pega aquí la dirección")), paste, pasteBtn));
    };
    web("spotify/status", {}).then(drawSp).catch(() => {});
    const out = h("div", { class: "import-result" });
    const go = h("button", { class: "btn primary", type: "button" }, T("Importar"));
    go.addEventListener("click", async () => {
      if (!url.value.trim() && !text.value.trim()) { out.replaceChildren(h("p", { class: "muted" }, T("Pega un enlace o una lista de canciones."))); return; }
      go.disabled = true; go.textContent = T("Importando…");
      const bar = h("progress", { class: "imp-bar", max: 100, value: 0 });
      const label = h("p", { class: "muted small" }, T("Leyendo la playlist…"));
      out.replaceChildren(h("p", { class: "muted" }, T("Leyendo la playlist y buscando tus canciones. Puedes dejar esta ventana abierta mientras tanto.")), bar, label);
      try {
        const { job } = await web("import/start", { url: url.value.trim(), text: url.value.trim() ? "" : text.value, name: name.value.trim() });
        let r = null;
        while (!r) {
          await new Promise((ok) => setTimeout(ok, 1000));
          const st = await web("import/progress", { job });
          if (st.state === "error") throw new Error(st.error);
          if (st.state === "done") { r = st.result; break; }
          if (st.phase === "matching" && st.total) {
            const pct = Math.round((st.done / st.total) * 100);
            bar.value = pct;
            label.textContent = T("Buscando canciones: {done} de {total} ({pct} %)", { done: nf.format(st.done), total: nf.format(st.total), pct })
              + (st.eta != null ? ` · ${T("quedan unos {t}", { t: fmtEta(st.eta) })}` : ` · ${T("calculando el tiempo…")}`);
          } else if (st.phase === "saving") { bar.value = 100; label.textContent = T("Guardando…"); }
          else { bar.removeAttribute("value"); label.textContent = T("Leyendo la playlist…"); }
        }
        await loadLibrary();
        out.replaceChildren(...[
          h("p", {}, h("strong", {}, T("{matched} de {total} canciones están en tu servidor", { matched: nf.format(r.matched), total: nf.format(r.total) }))),
          ...(r.warnings || []).map((w) => h("p", { class: "import-warn" }, "⚠ " + w)),
          r.linked ? h("p", { class: "muted" }, r.source === "text"
            ? T("Guardo tu lista: cuando lleguen al servidor canciones que faltan, se añadirán solas al final de la playlist.")
            : T("La playlist queda vinculada a {source}: cuando aparezcan canciones nuevas allí o en tu servidor, se añadirán solas.", { source: LINK_NAMES[r.source] || r.source })) : null,
          unmatchedList(r.unmatched, r.unmatchedTotal),
          h("div", { class: "album-actions" }, h("button", { class: "btn primary", type: "button", onclick: () => { close(); location.hash = `#/playlist/${r.playlist.id}`; } }, T("Abrir la playlist")))].filter(Boolean));
        go.remove();
      } catch (e) { out.replaceChildren(h("p", { class: "import-error" }, e.message || String(e))); go.disabled = false; go.textContent = T("Importar"); }
    });
    body.append(
      h("p", { class: "muted" }, T("Funciona con enlaces de Spotify, YouTube, SoundCloud y Deezer. Solo se lee la lista y se busca cada canción entre la música de tu servidor; no se descarga nada.")),
      h("div", { class: "field" }, h("label", {}, T("Enlace"), url)),
      spBox,
      h("div", { class: "field" }, h("label", {}, T("…o sube un archivo CSV (por ejemplo el de Exportify) o de texto"), file), fileInfo),
      h("div", { class: "field" }, h("label", {}, T("…o pega la lista de canciones"), text)),
      h("div", { class: "field" }, h("label", {}, T("Nombre"), name)),
      go, out);
  });
}

async function createEmptyPlaylist() {
  try {
    const mine = lib.items.filter((i) => i.kind === "playlist" && i.owned).length;
    const r = await web("playlist/create", { name: T("Mi playlist n.º {n}", { n: mine + 1 }) });
    await loadLibrary();
    location.hash = `#/playlist/${r.playlist.id}`;
  } catch (e) { showError(e); }
}

const isMobile = () => window.innerWidth <= 860;
const bnLink = (route, iconName, label) => h("a", { class: "bn-link", href: `#/${route}`, dataset: { route }, "aria-label": label }, icon(iconName, 24), h("span", {}, label));

/* Pantalla del reproductor (móvil): el mismo reproductor, pero a pantalla completa. */
function npOpen(on) {
  const b = document.body;
  if (on === b.classList.contains("np-open")) return;
  if (on && !isMobile()) return;
  b.classList.toggle("np-open", on);
  if (on) { try { history.pushState({ np: 1 }, ""); } catch (e) { /* nada */ } }
  else {
    if (lyricsPanel) toggleLyrics();
    document.querySelector(".shell")?.classList.remove("with-side");
    if (history.state && history.state.np) { try { history.back(); } catch (e) { /* nada */ } }
  }
}
window.addEventListener("popstate", () => {
  if (document.body.classList.contains("np-open") && !(history.state && history.state.np)) {
    document.body.classList.remove("np-open");
    if (lyricsPanel) toggleLyrics();
  }
});

/* Hoja "Más" de la barra inferior: todo lo que no cabe en las 4 pestañas. */
function openMoreSheet() {
  closeMenu && closeMenu();
  const back = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === back) close(); } });
  back.addEventListener("touchstart", (e) => { if (e.target === back) { e.preventDefault(); close(); } }, { passive: false });
  let closed = false;
  const close = (fromPop) => {
    if (closed) return; closed = true;
    sheet.classList.remove("in"); setTimeout(() => back.remove(), 180);
    document.removeEventListener("keydown", onKey); window.removeEventListener("popstate", onPop);
    if (fromPop !== true && history.state && history.state.sheet) { try { history.back(); } catch (e) { /* nada */ } }
  };
  const onPop = () => close(true);                     // el botón «atrás» del móvil cierra la hoja
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const row = (iconName, label, fn, href) => h(href ? "a" : "button", { class: "sheet-row", type: href ? undefined : "button", href, role: "menuitem",
    onclick: () => { close(true); if (fn) setTimeout(fn, 120); } }, icon(iconName, 22), h("span", {}, label));
  const u = state.user;
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-label": T("Más") },
    h("div", { class: "sheet-head" },
      h("div", { class: "sheet-grip" }),
      h("button", { class: "icon-btn sheet-x", type: "button", title: T("Cerrar"), "aria-label": T("Cerrar"), onclick: () => close() }, icon("close", 22))),
    h("a", { class: "sheet-user", href: `#/user/${encodeURIComponent(u.username)}`, onclick: () => close(true) },
      h("div", { class: "sheet-name" }, u.displayName || u.username), h("div", { class: "muted small" }, `@${u.username}`)),
    h("div", { class: "sheet-list" },
      row("users", T("Escuchar juntos"), null, "#/together"),
      row("wrapped", "Wrapped", null, "#/wrapped"),
      row("plus", T("Playlist vacía"), createEmptyPlaylist),
      row("download", T("Importar playlist"), openImportDialog),
      row("download", T("Sin conexión"), null, "#/offline"),
      row("palette", T("Personalizar"), openThemeDialog),
      row("bell", T("Notificaciones"), toggleBell),
      row("settings", T("Ajustes"), null, "#/settings"),
      row("trash", T("Papelera"), null, "#/trash"),
      u.isAdmin ? row("shield", T("Administración"), null, "#/admin") : null,
      window.zinctifyDesktop ? null : h("a", { class: "sheet-row", href: "/download.html" }, icon("download", 22), h("span", {}, T("Descargar"))),
      row("log", T("Change log"), null, "#/changelog"),
      /ZinctifyAndroid/.test(navigator.userAgent) ? row("settings", T("Cambiar servidor"), null, "https://localhost/?change=1") : null,
      row("out", T("Cerrar sesión"), logout)));
  back.append(sheet);
  document.body.append(back);
  document.addEventListener("keydown", onKey);
  try { history.pushState({ sheet: 1 }, ""); window.addEventListener("popstate", onPop); } catch (e) { /* nada */ }
  // la hoja sigue al dedo al arrastrar hacia abajo (desde arriba del todo) y se cierra o rebota al soltar
  let sy = null, dy = 0, t0 = 0, drag = false;
  sheet.addEventListener("touchstart", (e) => { sy = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; drag = false; t0 = Date.now(); }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (sy === null) return;
    dy = e.touches[0].clientY - sy;
    if (dy > 0 && sheet.scrollTop <= 0) {
      drag = true; e.preventDefault();
      sheet.style.transition = "none"; sheet.style.transform = `translateY(${dy}px)`;
      back.style.background = `rgba(0,0,0,${Math.max(0, .55 * (1 - dy / 500))})`;
    } else if (drag) { dy = 0; sheet.style.transform = "translateY(0)"; }
  }, { passive: false });
  const release = () => {
    if (!drag) { sy = null; return; }
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
    sheet.style.transition = "transform .2s ease";
    back.style.transition = "background .2s ease";
    if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = "translateY(100%)"; back.style.background = "rgba(0,0,0,0)"; close(); }
    else { sheet.style.transform = ""; back.style.background = ""; }
    sy = null; drag = false;
  };
  sheet.addEventListener("touchend", release, { passive: true });
  sheet.addEventListener("touchcancel", release, { passive: true });
  requestAnimationFrame(() => sheet.classList.add("in"));
}

function renderShell() {
  try { if (state.user && !state.offline) localStorage.setItem("zinctify.lastMe", JSON.stringify({ user: state.user, apiKey: state.apiKey })); } catch (e) { /* nada */ }
  const nav = (route, iconName, label) => h("a", { class: "rail-link", href: `#/${route}`, dataset: { route }, title: label, "aria-label": label }, icon(iconName, 24));
  let timer = null;
  const search = h("input", {
    class: "search", type: "search", placeholder: isMobile() ? T("Artistas, canciones, personas…") : T("Buscar canciones, artistas, álbumes o personas"),
    "aria-label": T("Buscar"), autocomplete: "off",
    oninput: (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = e.target.value.trim();
        location.hash = q ? `#/search/${encodeURIComponent(q)}` : "#/";
      }, 300);
    },
  });
  const playerEl = buildPlayer();
  root.replaceChildren(
    h("div", { class: "shell" + (sideOpen() ? " with-side" : "") },
      h("aside", { class: "sidebar" },
        h("a", { class: "brand", href: "#/", "aria-label": "Zinctify" },
          h("img", { src: "/logo.svg", alt: "", width: 34, height: 34 }), h("span", { class: "wordmark" }, "Zinctify")),
        h("nav", { class: "rail", "aria-label": T("Principal") },
          nav("", "home", T("Inicio")), nav("radios", "radio", "Radios"), nav("wrapped", "wrapped", "Wrapped"),
          h("span", { class: "only-mobile" }, nav("library", "library", T("Tu biblioteca"))),
          h("button", { class: "create-btn", type: "button", "aria-haspopup": "menu", dataset: { menuOwner: "1" }, title: T("Crear"), onclick: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            showSimpleMenu(r.left, r.bottom + 6, [{ label: T("Playlist vacía"), fn: createEmptyPlaylist }, { label: T("Importar playlist"), fn: openImportDialog }]);
          } }, icon("plus", 18), h("span", {}, T("Crear")))),
        h("div", { class: "lib-head" },
          h("span", { class: "lib-head-title" }, icon("library", 20), h("span", {}, T("Tu biblioteca"))),
          h("button", { id: "lib-toggle", class: "icon-btn lib-toggle", type: "button", onclick: toggleLibrary }, icon("chevron", 18))),
        h("div", { class: "library lib-grid", "aria-label": T("Tu biblioteca") })),
      h("div", { class: "content", id: "content" },
        h("div", { class: "topbar" },
          h("a", { class: "top-brand", href: "#/", "aria-label": "Zinctify" }, h("img", { src: "/logo.svg", alt: "", width: 28, height: 28 }), h("span", { class: "wordmark" }, "Zinctify")),
          h("button", { class: "icon-btn menu-btn", type: "button", title: T("Menú"), "aria-label": T("Menú"), onclick: () => {
            document.body.classList.toggle("nav-open");
            if (document.body.classList.contains("nav-open")) document.querySelector(".shell").classList.remove("with-side");
          } }, icon("menu", 22)),
          search,
          h("button", { id: "theme-btn", class: "icon-btn theme-btn", type: "button", title: T("Personalizar"), "aria-label": T("Personalizar"), onclick: openThemeDialog }, icon("palette", 22)),
          h("button", { id: "chat-btn", class: "icon-btn room-btn", type: "button", title: T("Mensajes"), "aria-label": T("Mensajes"), dataset: { menuOwner: "1" }, onclick: chatInbox },
            icon("chat", 22), h("span", { class: "bell-badge", hidden: true })),
          h("a", { id: "room-btn", class: "icon-btn room-btn", href: "#/together", title: T("Escuchar juntos"), "aria-label": T("Escuchar juntos") }, icon("users", 22), h("span", { class: "bell-badge", hidden: true })),
          h("button", { id: "bell-btn", class: "icon-btn bell-btn", type: "button", title: T("Notificaciones"), "aria-label": T("Notificaciones"),
            "aria-haspopup": "dialog", "aria-expanded": "false", dataset: { menuOwner: "1" }, onclick: toggleBell },
            icon("bell", 22), (bell.badge = h("span", { class: "bell-badge", hidden: true }))),
          h("button", { id: "user-btn", class: "user-btn", type: "button", title: T("Tu cuenta"), "aria-label": T("Tu cuenta"), "aria-haspopup": "menu", dataset: { menuOwner: "1" }, onclick: showUserMenu })),
        h("main", { id: "main" })),
      player.ui.side,
      h("div", { class: "scrim", onclick: () => { document.body.classList.remove("nav-open"); document.querySelector(".shell").classList.remove("with-side"); } })),
    playerEl,
    h("nav", { class: "bottom-nav", "aria-label": T("Navegación") },
      bnLink("", "home", T("Inicio")), bnLink("search", "search", T("Buscar")), bnLink("library", "library", T("Biblioteca")),
      bnLink("radios", "radio", "Radios"),
      h("button", { class: "bn-link", type: "button", onclick: openMoreSheet, "aria-haspopup": "dialog" }, icon("menu", 24), h("span", {}, T("Más")))));
  applyLibraryCollapsed();
  applyRadiosPref();
  applyAnim();
  applyTheme();
  bell.btn = document.getElementById("bell-btn");
  startBellPolling();
  startChat();
  startDevices();
  drawTopbarAvatar();
  drawLibrary();
  setupMediaSession();
  loadLibrary();
}

let renderToken = 0;
async function render() {
  if (!state.user) return;
  const main = $("#main");
  if (!main) return;
  const { name, arg } = parseHash();
  const token = ++renderToken;
  document.querySelectorAll(".rail-link").forEach((a) => {
    if (a.dataset.route === name && name !== "search") a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.body.dataset.route = name;
  document.querySelectorAll(".bn-link").forEach((a) => {
    if (a.dataset.route === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  markLibraryCurrent();
  const searchBox = $(".search");
  if (searchBox && document.activeElement !== searchBox) searchBox.value = name === "search" ? arg : "";
  if (name === "search" && !arg && isMobile() && searchBox) setTimeout(() => searchBox.focus(), 60);
  main.replaceChildren(h("p", { class: "muted" }, T("Cargando...")));
  try {
    const view = ROUTES[name];
    const el = view ? await view(arg) : h("div", { class: "empty" }, h("p", {}, T("Esta página no existe.")), h("a", { class: "btn", href: "#/" }, T("Volver al inicio")));
    if (token !== renderToken) return;
    main.replaceChildren(el);
    $("#content").scrollTop = 0;
    markPlaying();
  } catch (e) {
    if (token === renderToken && state.user) main.replaceChildren(errorBox(e));
  }
}


/* ---------- modo sin conexión ----------
   Las canciones descargadas se guardan en este navegador (IndexedDB) y se reproducen desde ahí, con o sin internet.
   El service worker (sw.js) solo guarda la propia aplicación para que abra sin conexión. */
const offline = { has: new Set(), urls: new Map(), busy: new Set(), db: null };
function offDB() {
  if (offline.db) return offline.db;
  offline.db = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error(T("Este navegador no puede guardar música sin conexión.")));
    const rq = indexedDB.open("zinctify-offline", 1);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      d.createObjectStore("songs", { keyPath: "id" });
      d.createObjectStore("cols", { keyPath: "key" });
      d.createObjectStore("covers", { keyPath: "id" });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  return offline.db;
}
async function offTx(store, mode, fn) {
  const d = await offDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode), st = tx.objectStore(store);
    let out;
    Promise.resolve(fn(st)).then((v) => { out = v; }).catch(reject);
    tx.oncomplete = () => resolve(out);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("IndexedDB"));
  });
}
const idbReq = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
const offGet = (store, key) => offTx(store, "readonly", (st) => idbReq(st.get(key)));
const offAll = (store) => offTx(store, "readonly", (st) => idbReq(st.getAll()));
const offPut = (store, val) => offTx(store, "readwrite", (st) => idbReq(st.put(val)));
const offDel = (store, key) => offTx(store, "readwrite", (st) => idbReq(st.delete(key)));
const colKey = (kind, id) => `${state.user ? state.user.username : ""}:${kind}:${id}`;
const fmtBytes = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

async function offlineInit() {
  try {
    const ids = await offTx("songs", "readonly", (st) => idbReq(st.getAllKeys()));
    offline.has = new Set(ids);
  } catch (e) { offline.has = new Set(); }
}
async function offlineBlobUrl(id) {
  if (offline.urls.has(id)) return offline.urls.get(id);
  const rec = await offGet("songs", id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  offline.urls.set(id, url);
  if (offline.urls.size > 4) { const old = offline.urls.keys().next().value; URL.revokeObjectURL(offline.urls.get(old)); offline.urls.delete(old); }
  return url;
}
async function offlineCoverUrl(id) {
  const rec = id ? await offGet("covers", id).catch(() => null) : null;
  return rec ? URL.createObjectURL(rec.blob) : null;
}
async function offlineSaveCover(coverId) {
  if (!coverId || await offGet("covers", coverId).catch(() => null)) return;
  try {
    const r = await fetch(coverUrl(coverId, 300));
    if (r.ok) await offPut("covers", { id: coverId, blob: await r.blob() });
  } catch (e) { /* sin portada */ }
}
async function offlineDownload(kind, id, name, songs, coverId, onProgress) {
  const real = songs.filter((s) => s && !s.radio);
  let done = 0, idx = 0;
  const worker = async () => {
    while (idx < real.length) {
      const s = real[idx++];
      if (!offline.has.has(s.id)) {
        const r = await fetch(streamUrl(s.id));
        if (!r.ok) throw new Error(T("No se pudo descargar «{t}».", { t: s.title }));
        const blob = await r.blob();
        await offPut("songs", { id: s.id, blob, size: blob.size, song: s });
        offline.has.add(s.id);
      }
      await offlineSaveCover(s.coverArt);
      onProgress && onProgress(++done, real.length);
    }
  };
  await Promise.all([worker(), worker()]);
  await offlineSaveCover(coverId);
  await offPut("cols", { key: colKey(kind, id), kind, id, name, coverId: coverId || "", songIds: real.map((s) => s.id), ts: Date.now() });
}
async function offlineRemove(kind, id) {
  const cols = await offAll("cols");
  const mine = cols.find((c) => c.key === colKey(kind, id));
  if (!mine) return;
  await offDel("cols", mine.key);
  const keep = new Set(cols.filter((c) => c.key !== mine.key).flatMap((c) => c.songIds));
  for (const sid of mine.songIds) if (!keep.has(sid)) { await offDel("songs", sid); offline.has.delete(sid); }
}
// Botón «Descargar / Quitar la descarga» para álbumes y playlists.
function offlineBtn(kind, id, name, getSongs, coverId) {
  const btn = h("button", { class: "btn", type: "button" });
  let have = false, working = false;
  const draw = (label) => {
    btn.replaceChildren(icon("download", 16), label || (have ? T("Descargado") : T("Descargar")));
    btn.classList.toggle("on", have);
    btn.title = have ? T("Quitar la descarga de este dispositivo") : T("Guardar para escuchar sin conexión");
  };
  offGet("cols", colKey(kind, id)).then((c) => { have = !!c; draw(); }).catch(() => draw());
  draw();
  btn.addEventListener("click", async () => {
    if (working) return;
    working = true;
    try {
      if (have) {
        if (!confirm(T("¿Quitar la descarga de «{name}» de este dispositivo?", { name }))) return;
        await offlineRemove(kind, id); have = false; draw(); toast(T("Descarga quitada"));
      } else {
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
        const songs = getSongs();
        await offlineDownload(kind, id, name, songs, coverId, (d, n) => draw(`${d}/${n}`));
        have = true; draw(); toast(T("Listo: «{name}» ya está disponible sin conexión", { name }));
      }
    } catch (e) { draw(); showError(e); }
    finally { working = false; }
  });
  return btn;
}

async function offlineView() {
  const cols = (await offAll("cols").catch(() => [])).filter((c) => c.key.startsWith(`${state.user.username}:`)).sort((a, b) => b.ts - a.ts);
  const all = await offAll("songs").catch(() => []);
  const total = all.reduce((n, r) => n + (r.size || 0), 0);
  let quota = "";
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota) quota = ` · ${T("espacio disponible: {n}", { n: fmtBytes(e.quota - e.usage) })}`; } } catch (e) { /* nada */ }
  const box = h("div", {});
  const head = h("div", {},
    h("h1", {}, T("Sin conexión")),
    h("p", { class: "muted" }, T("Música guardada en este dispositivo: se oye aunque no haya internet. Descarga álbumes y playlists con el botón «Descargar».")),
    h("p", { class: "muted" }, `${T("{n} canciones", { n: nf.format(all.length) })} · ${fmtBytes(total)}${quota}`));
  if (!cols.length) return h("div", {}, head, h("div", { class: "empty" }, h("p", {}, T("Todavía no has descargado nada."))));
  const draw = async () => {
    box.replaceChildren(...(await Promise.all(cols.map(async (c) => {
      const songs = (await Promise.all(c.songIds.map((sid) => offGet("songs", sid).catch(() => null)))).filter(Boolean);
      const list = songs.map((r) => r.song);
      const size = songs.reduce((n, r) => n + (r.size || 0), 0);
      const cover = h("div", { class: "cover" });
      offlineCoverUrl(c.coverId || (list[0] && list[0].coverArt)).then((u) => { if (u) cover.replaceChildren(h("img", { src: u, alt: "" })); else cover.dataset.initial = (c.name || "?").charAt(0).toUpperCase(); });
      return h("section", { class: "section off-col" },
        h("div", { class: "off-head" }, cover,
          h("div", { class: "grow" }, h("h2", {}, c.name), h("p", { class: "muted small" }, `${T(c.kind === "album" ? "Álbum" : "Playlist")} · ${T("{n} canciones", { n: nf.format(list.length) })} · ${fmtBytes(size)}`)),
          h("button", { class: "btn primary", type: "button", onclick: () => list.length && playQueue(list, 0, null) }, icon("play", 16), T("Reproducir")),
          h("button", { class: "btn", type: "button", onclick: async () => {
            if (!confirm(T("¿Quitar la descarga de «{name}» de este dispositivo?", { name: c.name }))) return;
            await offlineRemove(c.kind, c.id); cols.splice(cols.indexOf(c), 1); if (!cols.length) render(); else draw();
          } }, T("Quitar"))),
        h("ol", { class: "off-tracks" }, list.map((s, i) => h("li", {},
          h("button", { class: "linkish", type: "button", onclick: () => playQueue(list, i, null) }, `${i + 1}. ${s.title}`),
          h("span", { class: "muted small" }, ` — ${nm(s.artist || "")}`)))));
    }))));
  };
  await draw();
  return h("div", {}, head, box);
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

async function boot() {
  try {
    const me = await web("me");
    state.signup = me.signup;
    state.radiosOn = me.radios === true;
    if (me.user) {
      try { localStorage.setItem("zinctify.lastMe", JSON.stringify(me)); } catch (e) { /* nada */ }
      state.user = me.user;
      state.apiKey = me.apiKey;
      offlineInit();
      await loadTrash();
      renderShell();
      await render();
      let back = false;
      try { back = localStorage.getItem("zinctify.spReturn") === "1"; localStorage.removeItem("zinctify.spReturn"); } catch (e) { /* nada */ }
      if (back) { toast(T("Spotify conectado")); openImportDialog(); }
    } else {
      renderAuth();
    }
  } catch (e) {
    let last = null;
    try { last = JSON.parse(localStorage.getItem("zinctify.lastMe") || "null"); } catch (e2) { /* nada */ }
    if (last && last.user && (!navigator.onLine || /fetch|network|conect/i.test(String(e.message)))) {
      state.user = last.user; state.apiKey = last.apiKey; state.offline = true;
      await offlineInit();
      renderShell();
      location.hash = "#/offline";
      await render();
      toast(T("Sin conexión: solo puedes escuchar lo que descargaste"));
      return;
    }
    root.replaceChildren(h("div", { class: "auth" }, h("div", { class: "auth-box" },
      h("h1", { class: "brand-font" }, "Zinctify"),
      h("p", { class: "error" }, T("No se puede conectar con el servidor: {msg}", { msg: e.message })),
      h("button", { class: "btn", onclick: () => location.reload() }, T("Reintentar")))));
  }
}

/* ---------- tamaño de la interfaz (pantallas grandes / TV) ----------
   «Auto» amplía la interfaz cuando la pantalla es muy ancha (por encima de ~2000 px CSS): en una TV 4K a 100 % todo
   se veía diminuto. Se guarda por dispositivo (en este navegador), no en tu cuenta, porque cada pantalla es distinta. */
function uiScalePref() { try { return localStorage.getItem("zinctify.uiscale") || "auto"; } catch (e) { return "auto"; } }
function uiScaleValue() {
  const p = uiScalePref();
  if (p !== "auto") { const n = Number(p); return Number.isFinite(n) ? Math.min(3, Math.max(0.5, n / 100)) : 1; }
  const w = window.innerWidth || 1920;
  return w <= 2000 ? 1 : Math.min(3, Math.round((w / 2000) * 20) / 20);
}
let uiScaleApplied = 0;
function Z() { return uiScaleApplied || 1; }
function applyUiScale() {
  const z = uiScaleValue();
  if (z === uiScaleApplied) return;
  uiScaleApplied = z;
  const root = document.documentElement;
  root.style.setProperty("--z", String(z));
  root.style.zoom = z === 1 ? "" : String(z);
  if (typeof layoutVars === "function") setTimeout(layoutVars, 0);
  if (typeof drawWidgets === "function") setTimeout(() => document.querySelectorAll("#widgets-layer .widget").forEach((el) => placeWidget(el, el.dataset.kind)), 0);
}
let uiScaleTimer = 0;
window.addEventListener("resize", () => { clearTimeout(uiScaleTimer); uiScaleTimer = setTimeout(applyUiScale, 150); });
applyUiScale();

/* ---------- fase 6: personalización ---------- */

const THEME_DEFAULT = {
  c: { bg: "#101a3a", bgDeep: "#0b1230", raised: "#18254f", line: "#2a3868", text: "#f1efe8", muted: "#9aa6cf", accent: "#ffb84d" },
  bgMode: "solid", grad: { a: "#1b2a6b", b: "#0b1230", angle: 160 }, img: "", bright: 100, blur: 0,
  timeline: "bar", seekTop: false, fill: false, libW: 300, widgets: { clock: false, now: false }, wpos: {},
};
const THEME_PRESETS = {
  "Zinctify": THEME_DEFAULT.c,
  "Medianoche": { bg: "#0f0f14", bgDeep: "#08080b", raised: "#1a1a22", line: "#2a2a36", text: "#ececf1", muted: "#8b8b9a", accent: "#7c8cff" },
  "Bosque": { bg: "#12261d", bgDeep: "#0b1a13", raised: "#1b3a2b", line: "#2b5640", text: "#e9f2e6", muted: "#8fb09c", accent: "#9be564" },
  "Atardecer": { bg: "#2a1530", bgDeep: "#1c0d21", raised: "#3b1f42", line: "#5b2f63", text: "#fbeee6", muted: "#c79ab5", accent: "#ff7a59" },
  "Claro": { bg: "#f4f1ea", bgDeep: "#e8e3d8", raised: "#ffffff", line: "#cfc8b8", text: "#1d1b16", muted: "#6b665a", accent: "#d9480f" },
};
const THEME_LABELS = { bg: "Fondo", bgDeep: "Paneles", raised: "Tarjetas", line: "Líneas", text: "Texto", muted: "Texto apagado", accent: "Acento" };
const THEME_KEY = "zinctify.theme";
let theme = themeLoad();
let themeImgUrl = null;

function cloneTheme(o) { return JSON.parse(JSON.stringify(o)); }
function themeClean(src) {
  const t = cloneTheme(THEME_DEFAULT);
  if (!src || typeof src !== "object") return t;
  const hex = (v, d) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  for (const k of Object.keys(t.c)) t.c[k] = hex(src.c && src.c[k], t.c[k]);
  t.bgMode = ["solid", "gradient", "image"].includes(src.bgMode) ? src.bgMode : "solid";
  t.grad = { a: hex(src.grad && src.grad.a, t.grad.a), b: hex(src.grad && src.grad.b, t.grad.b), angle: num(src.grad && src.grad.angle, 0, 360, 160) };
  t.img = typeof src.img === "string" && (src.img === "idb" || /^https?:\/\//i.test(src.img)) ? src.img.slice(0, 1000) : "";
  t.bright = num(src.bright, 20, 150, 100);
  t.blur = num(src.blur, 0, 30, 0);
  t.timeline = src.timeline === "wave" ? "wave" : "bar";
  t.seekTop = !!src.seekTop;
  t.fill = !!src.fill;
  t.libW = num(src.libW, 240, 420, 300);
  t.widgets = { clock: !!(src.widgets && src.widgets.clock), now: !!(src.widgets && src.widgets.now) };
  t.wpos = {};
  for (const k of ["clock", "now"]) {
    const p = src.wpos && src.wpos[k];
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) t.wpos[k] = { x: Number(p.x), y: Number(p.y) };
  }
  return t;
}
function themeLoad() { try { return themeClean(JSON.parse(localStorage.getItem(THEME_KEY) || "null")); } catch (e) { return themeClean(null); } }
let themeSaveTimer = 0;
function themeSave() { clearTimeout(themeSaveTimer); themeSaveTimer = setTimeout(() => { try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); } catch (e) { /* ignorar */ } }, 250); }

function inkFor(hexColor) {
  const n = parseInt(hexColor.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#14110a" : "#ffffff";
}

/* La imagen subida se guarda en IndexedDB (localStorage se queda corto para imágenes y GIF). */
function idbOpen() {
  return new Promise((res, rej) => {
    try {
      const rq = indexedDB.open("zinctify-theme", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("files");
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  });
}
async function idbPut(key, blob) { const d = await idbOpen(); return new Promise((res, rej) => { const q = d.transaction("files", "readwrite").objectStore("files").put(blob, key); q.onsuccess = () => res(); q.onerror = () => rej(q.error); }); }
async function idbGet(key) { const d = await idbOpen(); return new Promise((res, rej) => { const q = d.transaction("files").objectStore("files").get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }

async function themeImageSource() {
  if (theme.img && theme.img !== "idb") return theme.img;
  if (theme.img === "idb") {
    try {
      const blob = await idbGet("bg");
      if (blob) { if (themeImgUrl) URL.revokeObjectURL(themeImgUrl); themeImgUrl = URL.createObjectURL(blob); return themeImgUrl; }
    } catch (e) { /* sin IndexedDB */ }
  }
  return "";
}

let themeApplyToken = 0;
async function applyTheme() {
  const token = ++themeApplyToken;
  const root = document.documentElement, body = document.body;
  for (const [k, v] of [["bg", "--bg"], ["bgDeep", "--bg-deep"], ["raised", "--raised"], ["line", "--line"], ["text", "--text"], ["muted", "--muted"], ["accent", "--accent"]]) root.style.setProperty(v, theme.c[k]);
  root.style.setProperty("--accent-ink", inkFor(theme.c.accent));
  root.style.setProperty("--lib-w", theme.libW + "px");
  root.style.background = theme.c.bg;
  let layer = document.getElementById("bg-layer");
  if (!layer) { layer = h("div", { id: "bg-layer", "aria-hidden": "true" }); body.prepend(layer); }
  let src = "";
  if (theme.bgMode === "image") src = await themeImageSource();
  if (token !== themeApplyToken) return;
  const custom = theme.bgMode === "gradient" || (theme.bgMode === "image" && !!src);
  body.classList.toggle("has-bg", custom);
  layer.style.filter = "";
  layer.style.transform = "";
  layer.style.backgroundImage = "";
  if (theme.bgMode === "gradient") {
    layer.style.backgroundImage = `linear-gradient(${theme.grad.angle}deg, ${theme.grad.a}, ${theme.grad.b})`;
  } else if (custom) {
    layer.style.backgroundImage = `url(${JSON.stringify(src)})`;
    layer.style.filter = `brightness(${theme.bright / 100}) blur(${theme.blur}px)`;
    if (theme.blur) layer.style.transform = "scale(1.06)";
  }
  root.style.setProperty("--panel-op", custom ? "78%" : "100%");
  root.style.setProperty("--lyrics-bg", custom ? "color-mix(in srgb, var(--bg) 70%, transparent)" : "var(--bg)");
  const pl = document.querySelector(".player");
  if (pl) {
    pl.classList.toggle("seek-top", theme.seekTop);
    pl.classList.toggle("fill", theme.fill);
    pl.classList.toggle("wave-on", theme.timeline === "wave");
    if (player.ui) { drawWave(currentTrack()); updateProgressVar(); }
  }
  drawWidgets();
  if (typeof layoutVars === "function") setTimeout(layoutVars, 0);
}

/* ---- barra de progreso estilizada ("soundwave") y brillo progresivo ---- */
function updateProgressVar() {
  const ui = player.ui;
  if (!ui || !ui.root) return;
  const dur = audio.duration;
  ui.root.style.setProperty("--prog", isFinite(dur) && dur ? Math.min(1, audio.currentTime / dur).toFixed(4) : "0");
}
function waveSeed(str) { let s = 2166136261; for (let i = 0; i < str.length; i++) { s ^= str.charCodeAt(i); s = Math.imul(s, 16777619); } return s >>> 0; }
function drawWave(t) {
  const ui = player.ui;
  if (!ui || !ui.wave) return;
  let s = waveSeed(String((t && t.id) || "none"));
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const bars = [];
  let level = 0.5;
  for (let i = 0; i < 96; i++) {
    level = Math.min(1, Math.max(0.12, level + (rnd() - 0.5) * 0.55));
    bars.push(Math.round(level * 100));
  }
  const layer = (cls) => h("div", { class: cls }, bars.map((b) => h("span", { style: { height: b + "%" } })));
  ui.wave.replaceChildren(layer("wave-base"), layer("wave-fill"));
}

/* ---- widgets que se arrastran ---- */
const WIDGETS = { clock: { w: 150, h: 70 }, now: { w: 240, h: 78 } };
let widgetTimer = 0;
function widgetEl(kind) {
  const el = h("div", { class: "widget widget-" + kind, dataset: { kind }, title: T("Arrástralo donde quieras") });
  el.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const move = (ev) => {
      const x = Math.min(window.innerWidth - r.width, Math.max(0, ev.clientX - dx)) / Z();    // pantalla -> píxeles CSS
      const y = Math.min(window.innerHeight - r.height, Math.max(0, ev.clientY - dy)) / Z();
      el.style.left = x + "px"; el.style.top = y + "px";
      theme.wpos[kind] = { x: Math.round(x), y: Math.round(y) };
    };
    const up = () => { el.classList.remove("dragging"); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); themeSave(); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    e.preventDefault();
  });
  return el;
}
function placeWidget(el, kind) {
  const d = WIDGETS[kind];
  const vw = window.innerWidth / Z(), vh = window.innerHeight / Z();
  const def = kind === "clock" ? { x: vw - d.w - 40, y: 90 } : { x: vw - d.w - 40, y: 180 };
  const p = theme.wpos[kind] || def;
  el.style.left = Math.min(Math.max(0, p.x), Math.max(0, vw - d.w)) + "px";
  el.style.top = Math.min(Math.max(0, p.y), Math.max(0, vh - d.h - 90)) + "px";
}
function drawWidgets() {
  let layer = document.getElementById("widgets-layer");
  if (!layer) { layer = h("div", { id: "widgets-layer" }); document.body.append(layer); }
  clearInterval(widgetTimer);
  for (const kind of ["clock", "now"]) {
    let el = layer.querySelector(".widget-" + kind);
    if (!theme.widgets[kind] || !state.user) { if (el) el.remove(); continue; }
    if (!el) { el = widgetEl(kind); layer.append(el); }
    placeWidget(el, kind);
  }
  const tick = () => {
    const c = layer.querySelector(".widget-clock");
    if (c) {
      const d = new Date();
      c.replaceChildren(h("div", { class: "w-time" }, d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })),
        h("div", { class: "w-date muted" }, d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short" })));
    }
  };
  tick();
  if (theme.widgets.clock) widgetTimer = setInterval(tick, 15000);
  updateNowWidget();
}
function updateNowWidget() {
  const el = document.querySelector("#widgets-layer .widget-now");
  const ui = player.ui;
  if (!el || !ui) return;
  const cover = ui.coverLink && ui.coverLink.firstChild ? ui.coverLink.firstChild.cloneNode(true) : null;
  el.replaceChildren(h("div", { class: "w-cover" }, cover), h("div", { class: "w-meta" }, h("div", { class: "w-title" }, ui.title.textContent), h("div", { class: "w-artist muted" }, ui.artist.textContent)));
}
window.addEventListener("resize", () => { document.querySelectorAll("#widgets-layer .widget").forEach((el) => placeWidget(el, el.dataset.kind)); });

/* ---- código para compartir ---- */
function themeCode() {
  const t = cloneTheme(theme);
  const uploaded = t.img === "idb";
  if (uploaded) { t.img = ""; if (t.bgMode === "image") t.bgMode = "solid"; }
  const keys = Object.keys(THEME_DEFAULT.c);
  const pi = Object.values(THEME_PRESETS).findIndex((pc) => keys.every((k) => pc[k] === t.c[k]));
  const colors = pi >= 0 ? "P" + pi : keys.map((k) => t.c[k].slice(1)).join("");
  const mode = { solid: "s", gradient: "g", image: "i" }[t.bgMode] || "s";
  const grad = t.bgMode === "gradient" ? [t.grad.a.slice(1), t.grad.b.slice(1), t.grad.angle].join(".") : "";
  const nums = [t.bright, t.blur, t.libW].join(".");
  const flags = [t.timeline === "wave", t.seekTop, t.fill, t.widgets.clock, t.widgets.now].map((x) => (x ? 1 : 0)).join("");
  const img = t.bgMode === "image" && t.img ? encodeURIComponent(t.img) : "";
  return { code: "ZT2." + [colors, mode, grad, nums, flags, img].join(","), uploaded };
}
function themeFromCode(code) {
  const bad = () => new Error(T("Ese código no es válido."));
  const txt = String(code || "").trim();
  const m1 = txt.match(/^ZT1\.([A-Za-z0-9+/=]+)$/);       // códigos antiguos (largos)
  if (m1) { try { return themeClean(JSON.parse(decodeURIComponent(escape(atob(m1[1]))))); } catch (e) { throw bad(); } }
  if (!/^ZT2\./.test(txt)) throw bad();
  try {
    const [colors, mode, grad, nums, flags, ...rest] = txt.slice(4).split(",");
    const src = { c: {}, widgets: {}, grad: {} };
    const keys = Object.keys(THEME_DEFAULT.c);
    if (/^P\d+$/.test(colors)) {
      const pc = Object.values(THEME_PRESETS)[Number(colors.slice(1))];
      if (!pc) throw bad();
      src.c = { ...pc };
    } else {
      if (!/^[0-9a-fA-F]{42}$/.test(colors)) throw bad();
      keys.forEach((k, i) => { src.c[k] = "#" + colors.slice(i * 6, i * 6 + 6); });
    }
    src.bgMode = { s: "solid", g: "gradient", i: "image" }[mode];
    if (!src.bgMode) throw bad();
    if (grad) { const [ga, gb, an] = grad.split("."); src.grad = { a: "#" + ga, b: "#" + gb, angle: an }; }
    const [br, bl, lw] = nums.split(".");
    src.bright = br; src.blur = bl; src.libW = lw;
    if (!/^[01]{5}$/.test(flags)) throw bad();
    src.timeline = flags[0] === "1" ? "wave" : "bar";
    src.seekTop = flags[1] === "1"; src.fill = flags[2] === "1";
    src.widgets = { clock: flags[3] === "1", now: flags[4] === "1" };
    src.img = rest.length && rest[0] ? decodeURIComponent(rest.join(",")) : "";
    return themeClean(src);
  } catch (e) { throw bad(); }
}

/* ---- ventana de personalización ---- */
function openThemeDialog() {
  openModal(T("Personalizar"), (body, close) => {
    body.classList.add("theme-dialog");
    const set = (fn) => { fn(); themeSave(); applyTheme(); };
    const row = (label, ...ctl) => h("div", { class: "trow" }, h("span", {}, label), ...ctl);
    const range = (min, max, get, onSet, unit = "") => {
      const out = h("output", { class: "muted small" }, get() + unit);
      const inp = h("input", { type: "range", min, max, value: get() });
      inp.addEventListener("input", () => { out.textContent = inp.value + unit; set(() => onSet(Number(inp.value))); });
      return h("span", { class: "trange" }, inp, out);
    };
    const section = (title, open, ...kids) => h("details", { class: "tsec", open }, h("summary", {}, title), ...kids);
    const sync = [];                                         // vuelve a pintar los controles tras aplicar un preset o un código
    const colorInput = (k) => {
      const inp = h("input", { type: "color", value: theme.c[k], "aria-label": T(THEME_LABELS[k]) });
      inp.addEventListener("input", () => set(() => { theme.c[k] = inp.value; }));
      sync.push(() => { inp.value = theme.c[k]; });
      return row(T(THEME_LABELS[k]), inp);
    };
    const presets = h("div", { class: "tpresets" }, Object.entries(THEME_PRESETS).map(([name, c]) =>
      h("button", { type: "button", class: "tpreset", title: T(name), onclick: () => { set(() => { theme.c = { ...c }; }); sync.forEach((f) => f()); } },
        h("span", { class: "sw", style: { background: `linear-gradient(135deg, ${c.bg} 50%, ${c.accent} 50%)` } }), T(name))));

    const modeSel = h("select", { "aria-label": T("Tipo de fondo") },
      [["solid", T("Color liso")], ["gradient", T("Degradado")], ["image", T("Imagen o GIF")]].map(([v, l]) => h("option", { value: v }, l)));
    modeSel.value = theme.bgMode;
    const gradBox = h("div", {}, 
      row(T("Color 1"), (() => { const i = h("input", { type: "color", value: theme.grad.a }); i.addEventListener("input", () => set(() => { theme.grad.a = i.value; })); sync.push(() => { i.value = theme.grad.a; }); return i; })()),
      row(T("Color 2"), (() => { const i = h("input", { type: "color", value: theme.grad.b }); i.addEventListener("input", () => set(() => { theme.grad.b = i.value; })); sync.push(() => { i.value = theme.grad.b; }); return i; })()),
      row(T("Ángulo"), range(0, 360, () => theme.grad.angle, (v) => { theme.grad.angle = v; }, "°")));
    const imgInfo = h("span", { class: "muted small" });
    const file = h("input", { type: "file", accept: "image/*", "aria-label": T("Subir imagen o GIF") });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { imgInfo.textContent = T("Pesa demasiado (máximo 15 MB)."); return; }
      try {
        await idbPut("bg", f);
        set(() => { theme.img = "idb"; theme.bgMode = "image"; });
        modeSel.value = "image"; showMode();
        imgInfo.textContent = f.name;
      } catch (e) { imgInfo.textContent = T("Tu navegador no deja guardar la imagen."); }
    });
    const urlIn = h("input", { type: "url", placeholder: "https://…", value: theme.img && theme.img !== "idb" ? theme.img : "", "aria-label": T("O una dirección de imagen") });
    urlIn.addEventListener("change", () => {
      const v = urlIn.value.trim();
      if (v && !/^https?:\/\//i.test(v)) { imgInfo.textContent = T("La dirección debe empezar por http:// o https://"); return; }
      set(() => { theme.img = v; if (v) theme.bgMode = "image"; });
      if (v) { modeSel.value = "image"; showMode(); }
    });
    const imgBox = h("div", {},
      row(T("Subir imagen o GIF"), file), imgInfo,
      row(T("O una dirección de imagen"), urlIn),
      row(T("Brillo"), range(20, 150, () => theme.bright, (v) => { theme.bright = v; }, "%")),
      row(T("Desenfoque"), range(0, 30, () => theme.blur, (v) => { theme.blur = v; }, " px")));
    const showMode = () => { gradBox.hidden = modeSel.value !== "gradient"; imgBox.hidden = modeSel.value !== "image"; };
    modeSel.addEventListener("change", () => { set(() => { theme.bgMode = modeSel.value; }); showMode(); });
    showMode();

    const tlSel = h("select", { "aria-label": T("Barra de tiempo") }, [["bar", T("Barra normal")], ["wave", T("Onda de sonido")]].map(([v, l]) => h("option", { value: v }, l)));
    tlSel.value = theme.timeline;
    tlSel.addEventListener("change", () => set(() => { theme.timeline = tlSel.value; }));
    const check = (label, get, onSet) => {
      const inp = h("input", { type: "checkbox" });
      inp.checked = get();
      inp.addEventListener("change", () => set(() => onSet(inp.checked)));
      sync.push(() => { inp.checked = get(); });
      return h("label", { class: "check" }, inp, label);
    };

    const codeOut = h("textarea", { rows: 3, readonly: true, "aria-label": T("Tu código") });
    const codeNote = h("p", { class: "muted small" });
    const codeIn = h("textarea", { rows: 3, placeholder: "ZT1.…", "aria-label": T("Pega un código") });
    const codeMsg = h("p", { class: "small" });

    body.append(
      section(T("Colores"), true, presets, ...Object.keys(THEME_LABELS).map(colorInput)),
      section(T("Fondo"), false, row(T("Tipo de fondo"), modeSel), gradBox, imgBox,
        h("p", { class: "muted small" }, T("La imagen subida se queda solo en este navegador."))),
      section(T("Reproductor"), false, row(T("Barra de tiempo"), tlSel),
        check(T("Barra de tiempo arriba del reproductor, a lo ancho"), () => theme.seekTop, (v) => { theme.seekTop = v; }),
        check(T("La barra del reproductor se ilumina según avanza la canción"), () => theme.fill, (v) => { theme.fill = v; }),
        h("p", { class: "muted small" }, T("La onda es una forma decorativa generada a partir de la canción; no es el audio real."))),
      section(T("Disposición"), false, row(T("Ancho de la biblioteca"), range(240, 420, () => theme.libW, (v) => { theme.libW = v; }, " px"))),
      section(T("Widgets"), false,
        check(T("Reloj"), () => theme.widgets.clock, (v) => { theme.widgets.clock = v; }),
        check(T("Ahora suena"), () => theme.widgets.now, (v) => { theme.widgets.now = v; }),
        h("p", { class: "muted small" }, T("Arrástralos con el ratón o el dedo hasta donde quieras. En el móvil no se muestran."))),
      section(T("Compartir"), false,
        h("button", { class: "btn", type: "button", onclick: async () => {
          const r = themeCode();
          codeOut.value = r.code;
          codeNote.textContent = r.uploaded ? T("La imagen subida no va dentro del código; el resto sí. Usa una dirección de imagen si quieres compartir el fondo.") : "";
          try { await navigator.clipboard.writeText(r.code); toast(T("Código copiado")); } catch (e) { codeOut.select(); }
        } }, T("Generar código")), codeOut, codeNote,
        h("div", { class: "field" }, h("label", {}, T("Pega un código"), codeIn)),
        h("button", { class: "btn", type: "button", onclick: () => {
          try {
            const t = themeFromCode(codeIn.value);
            const keepImg = theme.img === "idb" && !t.img;
            const wpos = theme.wpos;
            theme = t; theme.wpos = wpos;
            if (keepImg && theme.bgMode === "image") theme.bgMode = "solid";
            themeSave(); applyTheme();
            codeMsg.textContent = T("Aplicado."); codeMsg.className = "small";
            close(); openThemeDialog();
          } catch (e) { codeMsg.textContent = e.message; codeMsg.className = "small import-error"; }
        } }, T("Aplicar código")), codeMsg),
      h("div", { class: "album-actions" },
        h("button", { class: "btn", type: "button", onclick: () => { theme = themeClean(null); themeSave(); applyTheme(); close(); openThemeDialog(); } }, T("Restablecer todo")),
        h("button", { class: "btn primary", type: "button", onclick: close }, T("Listo"))));
  });
}

/* ---------- Chat entre amigos ----------
   Abajo a la derecha: una pestaña por conversación (foto + nombre). Si llega un mensaje suena un aviso y la pestaña
   se ilumina; al abrirla se ve el chat en pequeño. Los mensajes se guardan cifrados en el servidor y no se borran. */
const chat = { dock: null, tabs: {}, order: [], last: null, unread: {}, timer: null, audioCtx: null, friends: null };

const chatUserLabel = (u) => u.displayName || u.username;
function chatStore() { try { return JSON.parse(localStorage.getItem("zinctify.chat") || "[]"); } catch (e) { return []; } }
function chatSave() { try { localStorage.setItem("zinctify.chat", JSON.stringify(chat.order.map((u) => ({ u, open: !!(chat.tabs[u] && chat.tabs[u].open) })))); } catch (e) { /* sin almacenamiento */ } }

function chatBeep() {
  if (state.user && state.user.prefs && state.user.prefs.chatSound === false) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    chat.audioCtx = chat.audioCtx || new A();
    const ctx = chat.audioCtx, t = ctx.currentTime;
    if (ctx.state === "suspended") ctx.resume();
    [[880, 0], [1320, 0.11]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t + d); o.stop(t + d + 0.25);
    });
  } catch (e) { /* el navegador no deja sonar aún */ }
}

function chatShareCard(sh) {
  const href = `#/${sh.type}/${sh.type === "song" || sh.type === "playlist" ? encodeURIComponent(sh.id) : sh.id}`;
  const kind = { song: T("Canción"), album: T("Álbum"), artist: T("Artista"), playlist: T("Playlist") }[sh.type] || sh.type;
  return h("a", { class: "chat-share", href, onclick: () => { if (window.innerWidth <= 860) chatClose(null); } },
    h("span", { class: "chat-share-ico" }, icon(sh.type === "artist" ? "users" : "music", 20)),
    h("span", { class: "chat-share-text" }, h("span", { class: "chat-share-kind" }, kind), h("span", { class: "chat-share-name" }, sh.name || "")));
}

function chatMsgEl(m) {
  const d = new Date(m.ts * 1000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return h("div", { class: "chat-msg" + (m.mine ? " mine" : "") },
    h("div", { class: "chat-bubble" }, m.share ? chatShareCard(m.share) : null, m.text ? h("span", { class: "chat-text" }, m.text) : null),
    h("span", { class: "chat-time", title: d.toLocaleString() }, time));
}

function chatDayLabel(ts) {
  const d = new Date(ts * 1000), n = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, n)) return T("Hoy");
  const y = new Date(n); y.setDate(n.getDate() - 1);
  return same(d, y) ? T("Ayer") : d.toLocaleDateString([], { day: "numeric", month: "long" });
}

function chatEnsureDock() {
  if (chat.dock && document.body.contains(chat.dock)) return chat.dock;
  chat.dock = h("div", { id: "chat-dock", class: "chat-dock", "aria-label": T("Mensajes") });
  document.body.append(chat.dock);
  return chat.dock;
}

function chatTab(username, info) {
  let t = chat.tabs[username];
  if (t) { if (info) Object.assign(t.user, info); return t; }
  t = chat.tabs[username] = { user: { username, displayName: "", avatar: 0, ...(info || {}) }, open: false, msgs: [], loaded: false, more: false, el: null, list: null, input: null, badge: null, sending: false };
  if (!chat.order.includes(username)) chat.order.push(username);
  return t;
}

function chatRender() {
  const dock = chatEnsureDock();
  const snap = {};                                   // guardar borrador, foco y scroll antes de reconstruir
  for (const u of chat.order) {
    const t = chat.tabs[u];
    if (t.input && t.input.isConnected) {
      snap[u] = { focus: document.activeElement === t.input, a: t.input.selectionStart, b: t.input.selectionEnd, top: t.list ? t.list.scrollTop : 0, end: t.list ? t.list.scrollHeight - t.list.scrollTop - t.list.clientHeight < 40 : true };
      t.draft = t.input.value;
    }
  }
  dock.replaceChildren(...chat.order.map((u) => chatTabEl(chat.tabs[u])).filter(Boolean));
  const open = chat.order.filter((u) => chat.tabs[u].open).length;
  dock.classList.toggle("has-open", open > 0);
  document.body.classList.toggle("chat-open", open > 0);
  for (const u of chat.order) {
    const t = chat.tabs[u];
    if (!t.open) continue;
    const s = snap[u];
    if (t.input && t.draft) { t.input.value = t.draft; t.input.style.height = "auto"; t.input.style.height = Math.min(90, t.input.scrollHeight) + "px"; }
    if (!s || s.end) chatScrollEnd(t, true); else if (t.list) t.list.scrollTop = s.top;
    if (s && s.focus && t.input) { t.input.focus({ preventScroll: true }); try { t.input.setSelectionRange(s.a, s.b); } catch (e) { /* nada */ } }
  }
}

function chatTabEl(t) {
  const u = t.user, unread = chat.unread[u.username] || 0;
  const head = h("div", { class: "chat-head", onclick: () => chatToggle(u.username) },
    avatarEl(u, "sm"), h("span", { class: "chat-name" }, chatUserLabel(u)),
    unread ? h("span", { class: "chat-badge" }, unread > 9 ? "9+" : String(unread)) : null,
    h("button", { class: "icon-btn chat-x", type: "button", title: T("Cerrar"), "aria-label": T("Cerrar"), onclick: (e) => { e.stopPropagation(); chatClose(u.username); } }, icon("close", 16)));
  const box = h("div", { class: "chat-tab" + (t.open ? " open" : "") + (unread ? " has-unread" : ""), dataset: { user: u.username } }, head);
  t.el = box;
  if (t.open) {
    t.list = h("div", { class: "chat-list", onscroll: () => { if (t.list.scrollTop < 40 && t.more && !t.loadingMore) chatLoadMore(t); } });
    t.input = h("textarea", { class: "chat-input", rows: 1, maxlength: 2000, placeholder: T("Escribe un mensaje…"), "aria-label": T("Escribe un mensaje…"),
      onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatSend(t); } },
      oninput: () => { t.input.style.height = "auto"; t.input.style.height = Math.min(90, t.input.scrollHeight) + "px"; } });
    box.append(t.list, h("form", { class: "chat-form", onsubmit: (e) => { e.preventDefault(); chatSend(t); } },
      t.input, h("button", { class: "icon-btn chat-send", type: "submit", title: T("Enviar"), "aria-label": T("Enviar") }, icon("send", 20))));
    chatDrawList(t);
    if (!t.loaded) chatLoad(t);
  }
  return box;
}

function chatDrawList(t) {
  if (!t.list) return;
  const kids = [];
  if (t.more) kids.push(h("div", { class: "chat-more muted small" }, T("Sube para ver mensajes anteriores")));
  let day = "";
  for (const m of t.msgs) {
    const label = chatDayLabel(m.ts);
    if (label !== day) { day = label; kids.push(h("div", { class: "chat-day" }, label)); }
    kids.push(chatMsgEl(m));
  }
  if (!t.msgs.length && t.loaded) kids.push(h("p", { class: "muted small chat-empty" }, T("Aún no habéis hablado. Los mensajes se guardan cifrados y no se borran.")));
  t.list.replaceChildren(...kids);
}
function chatScrollEnd(t, force) {
  if (!t.list) return;
  const near = t.list.scrollHeight - t.list.scrollTop - t.list.clientHeight < 120;
  if (force || near) t.list.scrollTop = t.list.scrollHeight;
}

async function chatLoad(t) {
  try {
    const r = await web("chat/messages", { user: t.user.username, limit: 40 });
    Object.assign(t.user, r.user);
    t.msgs = r.messages; t.more = r.more; t.loaded = true;
    chatDrawList(t); chatScrollEnd(t, true);
    chatMarkRead(t);
  } catch (e) { t.loaded = true; if (t.list) t.list.replaceChildren(h("p", { class: "error chat-empty" }, e.message)); }
}
async function chatLoadMore(t) {
  if (!t.msgs.length) return;
  t.loadingMore = true;
  try {
    const prevH = t.list.scrollHeight;
    const r = await web("chat/messages", { user: t.user.username, limit: 40, before: t.msgs[0].id });
    t.msgs = r.messages.concat(t.msgs); t.more = r.more;
    chatDrawList(t); t.list.scrollTop = t.list.scrollHeight - prevH;
  } catch (e) { /* se reintenta al volver a subir */ } finally { t.loadingMore = false; }
}

function chatBadgeTotal() {
  const n = Object.values(chat.unread).reduce((a, b) => a + b, 0);
  const b = document.querySelector("#chat-btn .bell-badge");
  if (b) { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; }
}

async function chatMarkRead(t) {
  const u = t.user.username;
  if (!chat.unread[u]) return;
  delete chat.unread[u];
  chatBadgeTotal(); chatRefreshTab(u);
  try { await web("chat/read", { user: u }); } catch (e) { /* se marcará la próxima vez */ }
}

function chatRefreshTab(u) {
  const t = chat.tabs[u];
  if (!t || !t.el) return;
  const unread = chat.unread[u] || 0;
  t.el.classList.toggle("has-unread", !!unread);
  const old = t.el.querySelector(".chat-badge");
  if (old) old.remove();
  if (unread) t.el.querySelector(".chat-head").insertBefore(h("span", { class: "chat-badge" }, unread > 9 ? "9+" : String(unread)), t.el.querySelector(".chat-x"));
}

function chatToggle(u) {
  const t = chat.tabs[u];
  if (!t) return;
  const willOpen = !t.open;
  if (willOpen && window.innerWidth <= 860) for (const o of chat.order) chat.tabs[o].open = false;   // en móvil solo una ventana abierta
  t.open = willOpen;
  chatSave(); chatRender();
  if (t.open) { chatMarkRead(t); setTimeout(() => t.input && t.input.focus(), 30); }
}
function chatClose(u) {
  if (u === null) { for (const o of chat.order) chat.tabs[o].open = false; chatSave(); chatRender(); return; }
  chat.order = chat.order.filter((x) => x !== u);
  delete chat.tabs[u];
  chatSave(); chatRender();
}

/* Abre (o crea) la conversación con alguien. */
function chatOpen(user) {
  const info = typeof user === "string" ? { username: user } : { username: user.username, displayName: user.displayName || "", avatar: user.avatar || 0 };
  const t = chatTab(info.username, info);
  if (window.innerWidth <= 860) for (const o of chat.order) chat.tabs[o].open = false;
  t.open = true;
  chatSave(); chatRender();
  chatMarkRead(t);
  setTimeout(() => t.input && t.input.focus(), 30);
  return t;
}

async function chatSend(t, share) {
  const text = t.input ? t.input.value.trim() : "";
  if ((!text && !share) || t.sending) return;
  t.sending = true;
  try {
    const r = await web("chat/send", { to: t.user.username, text: share ? "" : text, share });
    if (t.input && !share) { t.input.value = ""; t.input.style.height = "auto"; t.draft = ""; }
    chatAdd(t, r.message);
    chat.last = Math.max(chat.last || 0, 0);
  } catch (e) { showError(e); } finally { t.sending = false; if (t.input) t.input.focus(); }
}

function chatAdd(t, m) {
  if (t.msgs.some((x) => x.id === m.id)) return;
  t.msgs.push(m);
  chatDrawList(t); chatScrollEnd(t, m.mine);
}

/* Manda algo (canción, álbum, artista, playlist) a un amigo sin abrir su ventana de chat. */
async function chatShareTo(friend, share) {
  try {
    await web("chat/send", { to: friend.username, text: "", share });
    toast(T("Enviado a {name}", { name: chatUserLabel(friend) }));
    const t = chat.tabs[friend.username];
    if (t && t.loaded) chatLoad(t);
  } catch (e) { showError(e); }
}

async function chatFriends(force) {
  if (!chat.friends || force) chat.friends = (await web("chat/friends", {})).friends;
  return chat.friends;
}

/* Lista de amigos, del más reciente al más antiguo, dentro de un submenú. */
async function fillFriendMenu(sub, share, place) {
  let friends = [];
  try { friends = await chatFriends(true); } catch (e) { sub.replaceChildren(h("div", { class: "menu-title" }, e.message)); place(); return; }
  if (!friends.length) { sub.replaceChildren(h("div", { class: "menu-title" }, T("Aún no tienes amigos. Los amigos son quienes os seguís los dos."))); place(); return; }
  sub.replaceChildren(h("div", { class: "menu-list friend-list" }, friends.map((f) => h("button", { class: "menu-item friend-item", type: "button", role: "menuitem",
    onclick: (e) => { e.stopPropagation(); closeMenu(); chatShareTo(f, share); } }, avatarEl(f, "xs"), h("span", { class: "fi-name" }, chatUserLabel(f))))));
  place();
}

/* Entrada «Compartir» con desplegable (Copiar enlace / Mandar a…) para menús sencillos. */
function shareSubItem(kind, id, name) {
  const share = { type: kind, id: String(id), name: name || "" };
  let timer = null;
  const item = menuItem([h("span", {}, T("Compartir")), icon("chevron", 16)], () => open(), "has-sub");
  const open = () => {
    closeSub();
    const sub = h("div", { class: "menu submenu", role: "menu" });
    subEl = sub; document.body.append(sub);
    const placeAt = (anchor, box) => {
      const r = anchor.getBoundingClientRect(), s = box.getBoundingClientRect();
      const left = r.right + 4 + s.width > window.innerWidth - 8 ? r.left - s.width - 4 : r.right + 4;
      box.style.left = `${Math.max(8, left) / Z()}px`;
      box.style.top = `${Math.max(8, Math.min(r.top - 6, window.innerHeight - s.height - 8)) / Z()}px`;
    };
    let sub2 = null, t2 = null;
    const send = menuItem([h("span", {}, T("Mandar a…")), icon("chevron", 16)], () => openSend(), "has-sub");
    const openSend = () => {
      if (sub2) sub2.remove();
      sub2 = h("div", { class: "menu submenu", role: "menu" }, h("div", { class: "menu-title" }, T("Cargando...")));
      sub.classList.add("has-child"); sub._child = sub2; document.body.append(sub2);
      const place2 = () => placeAt(send, sub2);
      place2(); fillFriendMenu(sub2, share, place2);
    };
    const copy = menuItem(T("Copiar enlace"), () => { closeMenu(); shareItem(kind, id); });
    copy.addEventListener("mouseenter", () => { if (sub2) { sub2.remove(); sub2 = null; } });
    send.addEventListener("mouseenter", () => { clearTimeout(t2); t2 = setTimeout(openSend, 120); });
    send.addEventListener("mouseleave", () => clearTimeout(t2));
    sub.replaceChildren(copy, send);
    const origRemove = sub.remove.bind(sub);
    sub.remove = () => { if (sub2) { sub2.remove(); sub2 = null; } origRemove(); };
    placeAt(item, sub);
  };
  item.addEventListener("mouseenter", () => { clearTimeout(timer); timer = setTimeout(open, 120); });
  item.addEventListener("mouseleave", () => clearTimeout(timer));
  return item;
}

/* Menú propio (sin menú contextual de canción): Copiar enlace / Mandar a… */
function shareMenu(x, y, kind, id, name) {
  const share = { type: kind, id: String(id), name: name || "" };
  openMenu(x, y, (m, place) => {
    let sub = null, timer = null;
    const items = [menuItem(T("Copiar enlace"), () => { closeMenu(); shareItem(kind, id); })];
    const send = menuItem([h("span", {}, T("Mandar a…")), icon("chevron", 16)], () => open(), "has-sub");
    const open = () => {
      closeSub();
      sub = h("div", { class: "menu submenu", role: "menu" }, h("div", { class: "menu-title" }, T("Cargando...")));
      subEl = sub; document.body.append(sub);
      const placeSub = () => {
        const r = send.getBoundingClientRect(), s = sub.getBoundingClientRect();
        const left = r.right + 4 + s.width > window.innerWidth - 8 ? r.left - s.width - 4 : r.right + 4;
        sub.style.left = `${Math.max(8, left) / Z()}px`;
        sub.style.top = `${Math.max(8, Math.min(r.top - 6, window.innerHeight - s.height - 8)) / Z()}px`;
      };
      placeSub(); fillFriendMenu(sub, share, placeSub);
    };
    send.addEventListener("mouseenter", () => { clearTimeout(timer); timer = setTimeout(open, 120); });
    send.addEventListener("mouseleave", () => clearTimeout(timer));
    items[0].addEventListener("mouseenter", closeSub);
    items.push(send);
    m.replaceChildren(...items);
    place();
  });
}

/* Botón del buzón: lista de conversaciones. */
function chatInbox(e) {
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(Math.max(8, r.right - 300), r.bottom + 6, async (m, place) => {
    m.classList.add("chat-inbox");
    m.replaceChildren(h("div", { class: "menu-title" }, T("Mensajes")), h("div", { class: "menu-title muted" }, T("Cargando...")));
    place();
    let friends;
    try { friends = await chatFriends(true); } catch (ex) { m.replaceChildren(h("div", { class: "menu-title" }, ex.message)); place(); return; }
    if (!menuEl) return;
    m.replaceChildren(h("div", { class: "menu-title" }, T("Mensajes")),
      friends.length ? h("div", { class: "menu-list friend-list" }, friends.map((f) => h("button", { class: "menu-item friend-item", type: "button", role: "menuitem",
        onclick: (ev) => { ev.stopPropagation(); closeMenu(); chatOpen(f); } },
        avatarEl(f, "xs"),
        h("span", { class: "fi-text" }, h("span", { class: "fi-name" }, chatUserLabel(f)),
          f.last ? h("span", { class: "fi-last muted small" }, (f.last.mine ? T("Tú: ") : "") + (f.last.share ? "♪ " : "") + f.last.text) : null),
        chat.unread[f.username] ? h("span", { class: "chat-badge" }, String(chat.unread[f.username])) : null)))
        : h("div", { class: "menu-title muted" }, T("Aún no tienes amigos. Los amigos son quienes os seguís los dos.")));
    place();
  });
}

async function chatPoll() {
  if (!state.user) return;
  try {
    const r = await web("chat/poll", { after: chat.last });
    const first = chat.last === null;
    chat.last = r.last;
    chat.unread = r.unread;
    let ring = false;
    if (!first) for (const m of r.messages) {
      const t = chatTab(m.from.username, m.from);
      if (t.loaded) chatAdd(t, m);
      const viewing = t.open && !document.hidden;
      if (viewing) { chatMarkRead(t); } else { ring = true; }
    }
    if (first) {                                       // al abrir la web: recuperar las pestañas que tenías y las que tienen mensajes sin leer
      for (const u of Object.keys(r.unread)) chatTab(u);
    }
    for (const u of Object.keys(r.unread)) if (!chat.tabs[u]) chatTab(u);
    chatBadgeTotal();
    chatRender();
    if (ring) chatBeep();
  } catch (e) { /* sin red */ }
}

function startChat() {
  clearInterval(chat.timer);
  chat.last = null; chat.unread = {}; chat.tabs = {}; chat.order = []; chat.friends = null;
  for (const { u, open } of chatStore()) { const t = chatTab(u); t.open = !!open && window.innerWidth > 860; }
  chatRender();
  chatPoll().then(() => { for (const u of chat.order) if (!chat.tabs[u].user.displayName && !chat.tabs[u].loaded) chatLoadInfo(chat.tabs[u]); });
  chat.timer = setInterval(() => { if (!document.hidden) chatPoll(); }, 4000);
}
async function chatLoadInfo(t) {
  try { Object.assign(t.user, (await web("chat/messages", { user: t.user.username, limit: 1 })).user); chatRender(); } catch (e) { chatClose(t.user.username); }
}
function stopChat() {
  clearInterval(chat.timer);
  if (chat.dock) chat.dock.remove();
  chat.dock = null; document.body.classList.remove("chat-open");
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.user) chatPoll(); });

/* ---------- Reproducir en… ----------
   Todos tus dispositivos (navegador, cliente de escritorio…) comparten lo que suena. Uno es el «activo» (el que
   tiene el audio y cuenta por dónde va); los demás muestran lo mismo y lo manejan a distancia. Desde el botón
   «Reproducir en» pasas la reproducción de uno a otro, empezando en el mismo segundo. */
const dev = { id: "", name: "", active: null, remote: null, devices: [], claimNext: false, qsig: "", timer: null, busy: false, fast: false };
function devId() {
  try {
    let id = localStorage.getItem("zinctify.device");
    if (!id) { id = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("zinctify.device", id); }
    return id;
  } catch (e) { return dev.fallback || (dev.fallback = "d" + Math.random().toString(36).slice(2, 12)); }
}
function devName() {
  if (window.zinctifyDesktop) return T("Zinctify de escritorio");
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : T("Navegador");
  return os ? `${br} · ${os}` : br;
}
const devIsMe = () => dev.active === dev.id;

/* Orden de «pasa lo que suena aquí»: la cola, por dónde iba y en qué segundo. */
function devTake(s) {
  const el0 = audio;
  player.queue = (s.queue || []).slice();
  player.pending = (s.pending || []).slice();
  player.index = Math.max(0, Math.min(s.index || 0, Math.max(0, player.queue.length - 1)));
  player.current = s.track;
  player.fromPending = !player.queue.some((q) => q && s.track && q.id === s.track.id) || (player.queue[player.index] || {}).id !== s.track.id;
  player.history = []; player.ctx = null;
  if (player.mode === "shuffle") shuffleOrder(player.fromPending ? null : player.index);
  dev.taking = true;
  loadCurrent();
  const a = audio;
  const go = () => {
    try { if (isFinite(a.duration) && s.pos > 0) a.currentTime = Math.min(s.pos, Math.max(0, a.duration - 0.5)); } catch (e) { /* radio */ }
    if (!s.playing) a.pause();
    dev.taking = false;
    devKick();
  };
  if (s.track.radio) { dev.taking = false; if (!s.playing) a.pause(); } else a.addEventListener("loadedmetadata", go, { once: true });
  void el0;
}

function devApply(c) {
  if (c.cmd === "stop") { audio.pause(); }
  else if (c.cmd === "take") devTake(c.state);
  else if (c.cmd === "play") audio.play().catch(() => {});
  else if (c.cmd === "pause") audio.pause();
  else if (c.cmd === "next") next();
  else if (c.cmd === "prev") prev();
  else if (c.cmd === "seek") { if (isFinite(audio.duration)) audio.currentTime = Math.min(c.pos, audio.duration); }
  else if (c.cmd === "jump") {
    const t = player.queue[c.index];
    if (t) { player.history.push(snapshot()); player.index = c.index; player.current = t; player.fromPending = false; if (player.mode === "shuffle") player.pos = player.order.indexOf(c.index); loadCurrent(); }
  }
  else if (c.cmd === "volume") { if (player.ui) { player.ui.vol.value = Math.round(c.volume * 100); player.ui.vol.dispatchEvent(new Event("input")); } }
  else if (c.cmd === "load") playQueue(c.items, c.index);
}

function devSig() {
  return player.queue.map((t) => t && t.id).join(",") + "|" + player.pending.map((t) => t && t.id).join(",");
}

async function devSync() {
  if (!state.user || dev.busy || room.active) return;
  dev.busy = true;
  try {
    const t = currentTrack();
    const mine = devIsMe() || dev.claimNext;
    const body = { id: dev.id, name: dev.name, kind: window.zinctifyDesktop ? "desktop" : "web" };
    if (dev.claimNext && t) body.claim = true;
    if ((devIsMe() || body.claim) && t) {
      body.np = { playing: !audio.paused && !audio.ended, pos: audio.currentTime || 0, index: player.index, track: t, volume: userVol() };
      const sig = devSig();
      if (sig !== dev.qsig || body.claim) { body.queue = { items: player.queue.slice(0, 800), pending: player.pending.slice(0, 200) }; dev.qsig = sig; }
    }
    dev.claimNext = false;
    void mine;
    const r = await web("play/sync", body);
    for (const c of r.cmds || []) devApply(c);
    dev.active = r.active;
    dev.devices = r.devices || [];
    const wasRemote = !!dev.remote;
    if (r.state && r.active !== dev.id) {
      const d = dev.devices.find((x) => x.id === r.active);
      dev.remote = { ...r.state, at: performance.now(), device: d ? d.name : "" };
      if (!audio.paused) audio.pause();
    } else dev.remote = null;
    if (dev.remote) devRenderRemote();
    else if (wasRemote) devLeaveRemote();
    drawDevBtn();
    const many = dev.devices.length > 1;
    if (many !== dev.fast) { dev.fast = many; devSchedule(); }
  } catch (e) { /* sin red */ } finally { dev.busy = false; }
}
function devSchedule() {
  clearInterval(dev.timer);
  dev.timer = setInterval(() => { if (!document.hidden || devIsMe()) devSync(); }, dev.fast ? 1000 : 4000);
}
function devKick() { setTimeout(devSync, 60); }
function devClaim() { if (dev.taking || room.active) return; if (!devIsMe()) { dev.claimNext = true; dev.active = dev.id; dev.remote = null; } devKick(); }

function devRemotePos() {
  const r = dev.remote;
  return r ? r.pos + (r.playing ? (performance.now() - r.at) / 1000 : 0) : 0;
}
function devRenderRemote() {
  const ui = player.ui, r = dev.remote;
  if (!ui || !r) return;
  const t = r.track, dur = t.duration || 0, pos = Math.min(devRemotePos(), dur || Infinity);
  if (ui.title.textContent !== t.title) { ui.title.textContent = t.title; ui.coverLink.replaceChildren(coverEl(t.coverArt, t.title, 120)); }
  ui.artist.textContent = `${nm(t.artist || "")} · ${T("en {device}", { device: r.device })}`;
  if (r.volume != null && document.activeElement !== ui.vol) ui.vol.value = Math.round(r.volume * 100);
  if (!player.dragging) {
    ui.seek.disabled = !dur;
    ui.seek.value = dur ? Math.round((pos / dur) * 1000) : 0;
    ui.cur.textContent = fmtTime(pos);
    ui.dur.textContent = dur ? fmtTime(dur) : T("en directo");
  }
  refreshPlayButton();
}
let devVolTimer = null;
function devVolumeRemote(v) {
  clearTimeout(devVolTimer);
  devVolTimer = setTimeout(() => web("play/command", { cmd: "volume", volume: v }).catch(() => {}), 120);
}
function devLeaveRemote() {
  const ui = player.ui;
  if (!ui) return;
  try { const saved = localStorage.getItem("zinctify.volume"); if (saved !== null) ui.vol.value = saved; } catch (e) { /* ignorar */ }
  if (currentTrack()) refreshPlayer();
  else { ui.title.textContent = T("Nada sonando"); ui.artist.textContent = T("Elige un álbum o una radio para empezar"); ui.seek.value = 0; ui.cur.textContent = "0:00"; ui.dur.textContent = "0:00"; ui.coverLink.replaceChildren(coverEl(null, "", 120)); }
  refreshPlayButton();
}
setInterval(() => { if (dev.remote) devRenderRemote(); }, 500);

async function devCommand(cmd, extra) {
  try { await web("play/command", { cmd, ...(extra || {}) }); } catch (e) { showError(e); return; }
  if (dev.remote) {                                    // se ve al instante; el aviso del otro dispositivo lo confirma
    if (cmd === "play" || cmd === "pause") { dev.remote.pos = devRemotePos(); dev.remote.at = performance.now(); dev.remote.playing = cmd === "play"; devRenderRemote(); }
    if (cmd === "seek") { dev.remote.pos = extra.pos; dev.remote.at = performance.now(); devRenderRemote(); }
  }
  devKick();
}

function drawDevBtn() {
  const b = player.ui && player.ui.devBtn;
  if (!b) return;
  const others = dev.devices.length > 1;
  b.classList.toggle("on", !!dev.remote);
  b.classList.toggle("has-others", others);
  b.title = dev.remote ? T("Escuchando en {device}", { device: dev.remote.device }) : T("Reproducir en…");
}

async function devTransfer(to) {
  try {
    await web("play/transfer", { to });
    dev.active = to;
    devKick();
    setTimeout(devSync, 700);
  } catch (e) { showError(e); }
}

function devPicker(e) {
  const r = e.currentTarget.getBoundingClientRect();
  devSync();
  openMenu(Math.max(8, r.right - 260), r.top - 8, (m, place) => {
    m.classList.add("dev-menu");
    const draw = () => {
      if (!menuEl) return;
      const kindLabel = { desktop: T("Aplicación de escritorio"), web: T("Navegador"), android: T("App del móvil") };
      m.replaceChildren(h("div", { class: "menu-title" }, T("Reproducir en…")),
        ...dev.devices.map((d) => h("button", { class: "menu-item dev-item" + (d.active ? " active" : ""), type: "button", role: "menuitem",
          onclick: (ev) => { ev.stopPropagation(); closeMenu(); if (!d.active) devTransfer(d.id); } },
          icon(d.kind === "android" ? "user" : "queue", 18),
          h("span", { class: "dev-text" }, h("span", { class: "dev-name" }, d.id === dev.id ? T("Este dispositivo") : d.name),
            h("span", { class: "muted small" }, d.id === dev.id ? d.name : kindLabel[d.kind] || "")),
          d.active ? h("span", { class: "dev-now" }, T("Sonando")) : null)),
        dev.devices.length < 2 ? h("div", { class: "menu-title muted small" }, T("Abre Zinctify en otro dispositivo con tu cuenta y saldrá aquí.")) : null);
      place();
    };
    draw();
    const iv = setInterval(() => { if (!menuEl) clearInterval(iv); else draw(); }, 1200);
  });
}

function startDevices() {
  dev.id = devId(); dev.name = devName(); dev.active = null; dev.remote = null; dev.devices = []; dev.qsig = ""; dev.fast = false;
  devSchedule(); devSync();
}
function stopDevices() { clearInterval(dev.timer); dev.remote = null; dev.active = null; }

applyTheme();

window.addEventListener("hashchange", render);
boot();
