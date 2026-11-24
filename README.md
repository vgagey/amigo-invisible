# Amigo Invisible de Navidad

Sorteo familiar con mails automáticos, o link de grupo con PIN. Powered by GIWA.

- `docs/`: pantallas (GitHub Pages).
- `apps-script/`: datos, sorteo y mails (Google Apps Script).
- `pruebas/`: pruebas y servidor local. No envía mails reales.

En este repositorio no se guardan nombres, mails ni claves de nadie.

## Instalar

### 1. Publicar las pantallas
1. Subí todo a un repositorio público de GitHub.
2. En **Settings → Pages**, elegí la rama `main` y la carpeta `/docs`.
3. Copiá la dirección que te da, terminada en `/`.

### 2. Preparar Google
Con la cuenta de Gmail que va a enviar los mails:

1. Creá una planilla de Google vacía y abrí **Extensiones → Apps Script**.
2. En **Configuración del proyecto**, activá "Mostrar el archivo de manifiesto appsscript.json".
3. Creá los archivos `Sorteo` y `Codigo`, y pegá el contenido de `apps-script/`. Reemplazá también `appsscript.json`. Borrá el archivo de ejemplo.
4. En `Codigo`, cambiá `URL_APP` por la dirección del paso 1.
5. Elegí la función `instalar`, tocá **Ejecutar** y autorizá los permisos. Google avisa que la app no está verificada: es tu propio código.
6. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**.
7. Copiá la URL que termina en `/exec`.

### 3. Unir las dos partes
En `docs/config.js`, reemplazá `PEGAR_ACA_LA_URL_DE_APPS_SCRIPT` por la URL `/exec` y subí el cambio.

Si después cambiás el código de Apps Script: **Implementar → Gestionar implementaciones → Editar → Nueva versión**. Así se mantiene la misma URL.

## Probar en la computadora
```
node --test pruebas/probar.js
node pruebas/servidor-local.js
```
La app queda en http://localhost:4173 y los mails simulados en http://localhost:4173/correos

## Límites
- Un Gmail común envía a unos 100 destinatarios por día.
- 40 personas por sorteo, 3 sorteos por día por mail y 30 por día en total.
- Cada sorteo se borra 30 días después del evento.
- El PIN se bloquea 15 minutos después de 5 intentos fallidos.
- Las parejas no se leen a simple vista en la planilla, pero no están cifradas.
