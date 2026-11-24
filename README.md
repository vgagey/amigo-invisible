# yori

Inteligencia que conecta momentos. Powered by GIWA.

Primera experiencia: Sorteo Navideño, con Amigo Invisible. El sorteo es un algoritmo, no usa IA.

- `docs/`: pantallas (GitHub Pages).
  - `marca.js`: logo, lema e íconos generales de yori.
  - `navidad/`: textos, ilustraciones y colores de la experiencia. Con `decoracion: false` en `tema.js` se quitan los adornos.
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
- La fila de cada sorteo se elimina de la planilla 30 días después del evento. El historial de la planilla y los mails enviados no se borran.
- Quien organiza carga mail, teléfono o los dos. Con mail, la app envía a cada persona su link y un PIN de 6 números. Sin mail, la persona escribe su teléfono y su mail, y valida un PIN de 6 números, que vence en 30 minutos y se anula después de 5 intentos fallidos. Un nombre validado queda cerrado y un mail valida un solo nombre por sorteo.
- Quien organiza ve con qué mail entró cada persona y puede liberar un nombre. El acceso de emergencia al sorteo completo exige un PIN que llega a su mail.
- Las parejas no se leen a simple vista en la planilla, pero no están cifradas.
