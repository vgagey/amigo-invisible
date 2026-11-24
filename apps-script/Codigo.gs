/**
 * Amigo Invisible de Navidad: datos, permisos y mails.
 * Ver README.md para instalarlo.
 */

// Dirección pública de la app, terminada en "/". Se usa en los links de los mails.
var URL_APP = 'https://vgagey.github.io/amigo-invisible/';

var MAX_PERSONAS = 40;
var MAX_CREACIONES_POR_DIA = 30; // reserva cupo de mails para los sorteos
var MAX_CREACIONES_POR_MAIL = 3; // por día
var INTENTOS_PIN = 5;
var MINUTOS_BLOQUEO = 15;
var DIAS_HASTA_BORRAR = 30;

/** Ejecutar una sola vez, a mano, desde el editor. */
function instalar() {
  hoja_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'borrarVencidos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('borrarVencidos').timeBased().everyDays(1).atHour(4).create();
}

function doGet() {
  return responder_({ ok: true });
}

function doPost(e) {
  try {
    var pedido = JSON.parse(e.postData.contents);
    var accion = Object.prototype.hasOwnProperty.call(ACCIONES_, pedido.accion) && ACCIONES_[pedido.accion];
    if (!accion) throw aviso_('Acción desconocida.');
    return responder_({ ok: true, datos: accion(pedido) });
  } catch (error) {
    if (!error.paraMostrar) console.error(error.stack || error);
    return responder_({
      ok: false,
      error: error.paraMostrar ? error.message : 'Algo falló. Probá de nuevo en un rato.',
      sinAcceso: error.sinAcceso === true
    });
  }
}

function responder_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function aviso_(mensaje) {
  var error = new Error(mensaje);
  error.paraMostrar = true;
  return error;
}

function sinAcceso_(mensaje) {
  var error = aviso_(mensaje);
  error.sinAcceso = true;
  return error;
}

/* ---------- Acciones ---------- */

var ACCIONES_ = {
  // Sin cuenta
  crear: crear_,
  grupo: grupo_,
  crearPin: crearPin_,
  entrar: entrar_,
  // Quien organiza
  admin: function (p) { return verAdmin_(abrirAdmin_(p)); },
  guardarEvento: conAdmin_(guardarEvento_),
  agregarPersona: conAdmin_(agregarPersona_),
  editarPersona: conAdmin_(editarPersona_),
  quitarPersona: conAdmin_(quitarPersona_),
  agregarExclusion: conAdmin_(agregarExclusion_),
  quitarExclusion: conAdmin_(quitarExclusion_),
  reiniciarPin: conAdmin_(reiniciarPin_),
  reabrir: conAdmin_(reabrir_),
  sortear: sortear_,
  reenviar: reenviar_,
  // Participantes
  yo: yo_,
  descubrir: descubrir_,
  guardarDeseos: guardarDeseos_
};

function crear_(pedido) {
  var nombre = validarNombre_(pedido.nombre);
  var mail = validarMail_(pedido.mail);
  if (!mail) throw aviso_('Completá tu mail.');
  if (pedido.acepta !== true) throw aviso_('Para seguir, aceptá el aviso de privacidad.');

  return conCandado_(function () {
    contarCreacion_(huella_(mail));
    exigirCupo_(1);

    var token = nuevoToken_();
    var sorteo = {
      id: 's' + nuevoToken_().slice(0, 16),
      admin: huella_(token),
      organizador: { nombre: nombre, mail: mail },
      evento: { fecha: proximaNochebuena_(), presupuesto: null, mensaje: '', modalidad: 'A' },
      personas: [],
      exclusiones: [],
      estado: 'abierto',
      parejas: ''
    };
    enviarMail_({
      para: mail,
      asunto: 'Tu Amigo Invisible de Navidad',
      titulo: 'Hola, ' + nombre,
      texto: 'Con este link administrás tu sorteo. Es privado: no lo reenvíes. Si no creaste ningún sorteo, ignorá este mail.',
      boton: 'Administrar mi sorteo',
      url: URL_APP + '#/a/' + sorteo.id + '/' + token
    });
    guardar_(sorteo);
    return {};
  });
}

function verAdmin_(s) {
  return {
    id: s.id,
    organizador: s.organizador.nombre,
    evento: s.evento,
    estado: s.estado,
    personas: s.personas.map(function (p) {
      return {
        id: p.id, nombre: p.nombre, tipo: p.tipo, mail: p.mail,
        entro: p.entro === true, tienePin: !!p.pin, envio: p.envio || ''
      };
    }),
    exclusiones: s.exclusiones
  };
}

function guardarEvento_(s, pedido) {
  exigirAbierto_(s);
  s.evento = {
    fecha: validarFecha_(pedido.fecha),
    presupuesto: validarPresupuesto_(pedido.presupuesto),
    mensaje: validarTexto_(pedido.mensaje, 300),
    modalidad: pedido.modalidad === 'B' ? 'B' : 'A'
  };
}

function agregarPersona_(s, pedido) {
  exigirAbierto_(s);
  if (s.personas.length >= MAX_PERSONAS) throw aviso_('El máximo es de ' + MAX_PERSONAS + ' personas.');
  var nombre = validarNombre_(pedido.nombre);
  exigirNombreLibre_(s, nombre, null);
  s.personas.push({
    id: 'p' + nuevoToken_().slice(0, 8),
    nombre: nombre,
    tipo: validarTipo_(pedido.tipo),
    mail: validarMail_(pedido.mail),
    deseos: '',
    sesiones: []
  });
}

function editarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  var nombre = validarNombre_(pedido.nombre);
  exigirNombreLibre_(s, nombre, p.id);
  var mail = validarMail_(pedido.mail);
  if (mail !== p.mail) quitarAccesos_(p);
  p.nombre = nombre;
  p.tipo = validarTipo_(pedido.tipo);
  p.mail = mail;
}

function quitarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  s.personas = s.personas.filter(function (x) { return x.id !== p.id; });
  s.exclusiones = s.exclusiones.filter(function (e) { return e.de !== p.id && e.a !== p.id; });
}

function agregarExclusion_(s, pedido) {
  exigirAbierto_(s);
  var de = buscarPersona_(s, pedido.de).id;
  var a = buscarPersona_(s, pedido.a).id;
  if (de === a) throw aviso_('Elegí dos personas distintas.');
  sumarExclusion_(s, de, a);
  if (pedido.ambos === true) sumarExclusion_(s, a, de);
}

function sumarExclusion_(s, de, a) {
  var existe = s.exclusiones.some(function (e) { return e.de === de && e.a === a; });
  if (!existe) s.exclusiones.push({ de: de, a: a });
}

function quitarExclusion_(s, pedido) {
  exigirAbierto_(s);
  s.exclusiones = s.exclusiones.filter(function (e) { return !(e.de === pedido.de && e.a === pedido.a); });
}

function reiniciarPin_(s, pedido) {
  var p = buscarPersona_(s, pedido.persona);
  if (p.mail) throw aviso_('Esta persona entra con el link de su mail.');
  quitarAccesos_(p);
  p.reinicio = ahora_();
}

function reabrir_(s) {
  if (s.estado !== 'sorteado') return;
  s.estado = 'abierto';
  s.parejas = '';
  s.personas.forEach(function (p) { p.envio = ''; });
}

function sortear_(pedido) {
  var envios = [];
  var sorteo = conCandado_(function () {
    var s = abrirAdmin_(pedido);
    exigirAbierto_(s);
    validarFecha_(s.evento.fecha);
    var faltan = s.personas.filter(function (p) { return !p.mail && !p.pin; });
    if (faltan.length) throw aviso_('Falta que creen su PIN: ' + faltan.map(function (p) { return p.nombre; }).join(', ') + '.');

    var parejas;
    try {
      parejas = sortearPersonas(s.personas, s.exclusiones, s.evento.modalidad);
    } catch (error) {
      throw aviso_(error.message);
    }
    var conMail = s.personas.filter(function (p) { return p.mail; });
    exigirCupo_(conMail.length);

    s.parejas = ocultar_(parejas);
    s.estado = 'sorteado';
    conMail.forEach(function (p) { envios.push({ persona: p, token: darLink_(p) }); });
    guardar_(s);
    return s;
  });
  enviarLinks_(sorteo, envios);
  return verAdmin_(abrir_(sorteo.id));
}

function reenviar_(pedido) {
  var envio;
  var sorteo = conCandado_(function () {
    var s = abrirAdmin_(pedido);
    if (s.estado !== 'sorteado') throw aviso_('Los links se envían al sortear.');
    var p = buscarPersona_(s, pedido.persona);
    if (!p.mail) throw aviso_('Esta persona entra con el link del grupo.');
    var mail = validarMail_(pedido.mail);
    if (!mail) throw aviso_('Completá el mail.');
    exigirCupo_(1);
    // El link anterior deja de servir: pudo haber llegado a otra persona.
    p.mail = mail;
    p.reinicio = ahora_();
    envio = { persona: p, token: darLink_(p) };
    guardar_(s);
    return s;
  });
  enviarLinks_(sorteo, [envio]);
  return verAdmin_(abrir_(sorteo.id));
}

function grupo_(pedido) {
  var s = abrir_(pedido.id);
  return {
    organizador: s.organizador.nombre,
    personas: s.personas.filter(function (p) { return !p.mail; }).map(function (p) {
      return { id: p.id, nombre: p.nombre, tienePin: !!p.pin };
    })
  };
}

function crearPin_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = buscarPersona_(s, pedido.persona);
    if (p.mail) throw aviso_('Esta persona entra con el link de su mail.');
    if (p.pin) throw aviso_('Esta persona ya tiene PIN. Si no fuiste vos, avisale a quien organiza.');
    p.pin = huella_(p.id + ':' + validarPin_(pedido.pin));
    return abrirSesion_(s, p);
  });
}

function entrar_(pedido) {
  var clave = 'pin:' + String(pedido.id) + ':' + String(pedido.persona);
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = buscarPersona_(s, pedido.persona);
    if (p.mail || !p.pin) throw aviso_('Esta persona todavía no tiene PIN.');
    var cache = CacheService.getScriptCache();
    var fallos = Number(cache.get(clave) || 0);
    if (fallos >= INTENTOS_PIN) throw aviso_('Demasiados intentos. Probá de nuevo en ' + MINUTOS_BLOQUEO + ' minutos.');
    if (p.pin !== huella_(p.id + ':' + String(pedido.pin))) {
      cache.put(clave, String(fallos + 1), MINUTOS_BLOQUEO * 60);
      throw aviso_('El PIN no es correcto.');
    }
    cache.remove(clave);
    return abrirSesion_(s, p);
  });
}

function yo_(pedido) {
  var s = abrir_(pedido.id);
  var p = personaConToken_(s, pedido.token);
  if (!p.entro) {
    conCandado_(function () {
      s = abrir_(pedido.id);
      p = personaConToken_(s, pedido.token);
      p.entro = true;
      guardar_(s);
    });
  }
  return {
    persona: p.id,
    nombre: p.nombre,
    organizador: s.organizador.nombre,
    evento: { fecha: s.evento.fecha, presupuesto: s.evento.presupuesto, mensaje: s.evento.mensaje },
    sorteado: s.estado === 'sorteado',
    regala: s.estado === 'sorteado' && !!mostrar_(s.parejas)[p.id],
    conPin: !p.mail,
    reinicio: p.reinicio || '',
    deseos: p.deseos
  };
}

function descubrir_(pedido) {
  var s = abrir_(pedido.id);
  var p = personaConToken_(s, pedido.token);
  if (s.estado !== 'sorteado') throw aviso_('Todavía no se hizo el sorteo.');
  return (mostrar_(s.parejas)[p.id] || []).map(function (id) {
    var otra = buscarPersona_(s, id);
    return { nombre: otra.nombre, deseos: otra.deseos };
  });
}

function guardarDeseos_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaConToken_(s, pedido.token);
    p.deseos = validarTexto_(pedido.deseos, 500);
    guardar_(s);
    return {};
  });
}

/* ---------- Accesos ---------- */

function conAdmin_(cambio) {
  return function (pedido) {
    return conCandado_(function () {
      var s = abrirAdmin_(pedido);
      cambio(s, pedido);
      guardar_(s);
      return verAdmin_(s);
    });
  };
}

function abrirAdmin_(pedido) {
  var s = abrir_(pedido.id);
  if (s.admin !== huella_(pedido.token)) throw sinAcceso_('Este link no es válido.');
  return s;
}

function personaConToken_(s, token) {
  var h = huella_(token);
  var p = s.personas.filter(function (x) {
    return x.enlace === h || x.sesiones.indexOf(h) !== -1;
  })[0];
  if (!p) throw sinAcceso_('Este acceso ya no es válido.');
  return p;
}

function abrirSesion_(s, p) {
  var token = nuevoToken_();
  p.sesiones = p.sesiones.concat(huella_(token)).slice(-5); // hasta 5 dispositivos
  p.entro = true;
  guardar_(s);
  return { token: token, persona: p.id, nombre: p.nombre };
}

function darLink_(p) {
  var token = nuevoToken_();
  quitarAccesos_(p);
  p.enlace = huella_(token);
  p.envio = 'pendiente';
  return token;
}

function quitarAccesos_(p) {
  p.pin = '';
  p.enlace = '';
  p.sesiones = [];
  p.entro = false;
}

function nuevoToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function huella_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

// No es cifrado: evita leer las parejas sin querer al abrir la planilla.
function ocultar_(objeto) {
  return Utilities.base64Encode(JSON.stringify(objeto));
}

function mostrar_(texto) {
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(texto)).getDataAsString());
}

/* ---------- Validaciones ---------- */

function validarNombre_(valor) {
  var nombre = String(valor || '').replace(/\s+/g, ' ').trim();
  if (!nombre) throw aviso_('Completá el nombre.');
  if (nombre.length > 40) throw aviso_('El nombre es demasiado largo.');
  // Sin símbolos ni puntos internos: los nombres van en mails y no deben formar links.
  if (!/^[\p{L}\p{M}\p{N} '’.\-]+$/u.test(nombre) || /\.\S/.test(nombre)) throw aviso_('El nombre tiene caracteres no permitidos.');
  return nombre;
}

function validarMail_(valor) {
  var mail = String(valor || '').trim().toLowerCase();
  if (!mail) return '';
  if (mail.length > 100 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>".]{2,}$/.test(mail)) throw aviso_('Revisá el mail: no parece válido.');
  return mail;
}

function validarTipo_(valor) {
  if (valor !== 'adulto' && valor !== 'nino') throw aviso_('Elegí adulto o niño.');
  return valor;
}

function validarTexto_(valor, maximo) {
  var texto = String(valor || '').trim();
  if (texto.length > maximo) throw aviso_('El texto es demasiado largo (máximo ' + maximo + ' caracteres).');
  return texto;
}

function validarPin_(valor) {
  var pin = String(valor || '');
  if (!/^\d{4}$/.test(pin)) throw aviso_('El PIN tiene que tener 4 números.');
  return pin;
}

function validarFecha_(valor) {
  var fecha = String(valor || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(Date.parse(fecha))) throw aviso_('Completá la fecha.');
  if (fecha < hoy_()) throw aviso_('La fecha ya pasó.');
  if (fecha > sumarDias_(hoy_(), 366)) throw aviso_('La fecha tiene que ser dentro del próximo año.');
  return fecha;
}

function validarPresupuesto_(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  var numero = Number(valor);
  if (!isFinite(numero) || numero <= 0 || numero > 1e9) throw aviso_('Revisá el presupuesto.');
  return Math.round(numero * 100) / 100;
}

function exigirAbierto_(s) {
  if (s.estado !== 'abierto') throw aviso_('El sorteo ya se hizo. Para cambiar algo, volvé a sortear.');
}

function exigirNombreLibre_(s, nombre, idPropio) {
  var repetido = s.personas.some(function (p) {
    return p.id !== idPropio && p.nombre.toLowerCase() === nombre.toLowerCase();
  });
  if (repetido) throw aviso_('Ya hay alguien con ese nombre. Agregá un apellido o apodo.');
}

function buscarPersona_(s, id) {
  var p = s.personas.filter(function (x) { return x.id === id; })[0];
  if (!p) throw aviso_('Esa persona ya no está en el sorteo.');
  return p;
}

function exigirCupo_(cantidad) {
  var cupo = MailApp.getRemainingDailyQuota();
  if (cupo < cantidad) {
    throw aviso_('Hoy quedan ' + cupo + ' mails disponibles y hacen falta ' + cantidad + '. No se envió nada: probá mañana o usá el link del grupo.');
  }
}

function contarCreacion_(quien) {
  var propiedades = PropertiesService.getScriptProperties();
  var cuenta = JSON.parse(propiedades.getProperty('creaciones') || '{}');
  if (cuenta.fecha !== hoy_()) cuenta = { fecha: hoy_(), total: 0, porMail: {} };
  var propias = cuenta.porMail[quien] || 0;
  if (propias >= MAX_CREACIONES_POR_MAIL) throw aviso_('Ya creaste varios sorteos hoy. Revisá tu mail.');
  if (cuenta.total >= MAX_CREACIONES_POR_DIA) throw aviso_('Hoy ya se crearon muchos sorteos. Probá mañana.');
  cuenta.total++;
  cuenta.porMail[quien] = propias + 1;
  propiedades.setProperty('creaciones', JSON.stringify(cuenta));
}

/* ---------- Fechas ---------- */

function hoy_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function ahora_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', "yyyy-MM-dd'T'HH:mm");
}

function sumarDias_(fecha, dias) {
  return new Date(Date.parse(fecha) + dias * 86400000).toISOString().slice(0, 10);
}

function proximaNochebuena_() {
  var hoy = hoy_();
  var anio = Number(hoy.slice(0, 4));
  var fecha = anio + '-12-24';
  return fecha >= hoy ? fecha : (anio + 1) + '-12-24';
}

/* ---------- Mails ---------- */

function enviarLinks_(sorteo, envios) {
  if (!envios.length) return;
  var estados = {};
  envios.forEach(function (envio) {
    try {
      enviarMail_({
        para: envio.persona.mail,
        de: sorteo.organizador.nombre,
        responderA: sorteo.organizador.mail,
        asunto: 'Ya se sorteó el Amigo Invisible',
        titulo: 'Hola, ' + envio.persona.nombre,
        texto: sorteo.organizador.nombre + ' hizo el sorteo de Navidad. Entrá para ver a quién le regalás y cargar tu lista de deseos. El link es privado: no lo reenvíes.',
        boton: 'Entrar',
        url: URL_APP + '#/s/' + sorteo.id + '/' + envio.token
      });
      estados[envio.persona.id] = 'enviado';
    } catch (error) {
      console.error(error.stack || error);
      estados[envio.persona.id] = 'error';
    }
  });
  conCandado_(function () {
    var s = abrir_(sorteo.id);
    s.personas.forEach(function (p) { if (estados[p.id]) p.envio = estados[p.id]; });
    guardar_(s);
  });
}

function enviarMail_(m) {
  var opciones = {
    to: m.para,
    subject: m.asunto,
    name: m.de ? m.de + ' (Amigo Invisible)' : 'Amigo Invisible',
    body: m.titulo + '\n\n' + m.texto + '\n\n' + m.boton + ': ' + m.url + '\n\nPowered by GIWA',
    htmlBody:
      '<div style="font-family:Montserrat,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1d2723;font-size:15px;line-height:1.6">' +
      '<p style="font-size:18px;margin:0 0 16px">' + escapar_(m.titulo) + '</p>' +
      '<p style="margin:0 0 24px">' + escapar_(m.texto) + '</p>' +
      '<p style="margin:0 0 32px"><a href="' + escapar_(m.url) + '" style="background:#1f5c45;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">' + escapar_(m.boton) + '</a></p>' +
      '<p style="margin:0;font-size:11px;color:#6b7671">Powered by GIWA</p></div>'
  };
  if (m.responderA) opciones.replyTo = m.responderA;
  MailApp.sendEmail(opciones);
}

function escapar_(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- Planilla: una fila por sorteo (id, fecha de borrado, datos) ---------- */

function hoja_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName('Sorteos');
  if (!hoja) {
    hoja = libro.insertSheet('Sorteos');
    hoja.getRange('A:C').setNumberFormat('@');
    hoja.appendRow(['id', 'borrar', 'datos']);
  }
  return hoja;
}

function buscarFila_(hoja, id) {
  var ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  var ids = hoja.getRange(2, 1, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

function abrir_(id) {
  var hoja = hoja_();
  var fila = buscarFila_(hoja, String(id || ''));
  if (!fila) throw sinAcceso_('Este sorteo no existe o ya se borró.');
  return JSON.parse(hoja.getRange(fila, 3).getValue());
}

function guardar_(s) {
  var datos = JSON.stringify(s);
  if (datos.length > 49000) throw aviso_('El sorteo tiene demasiados datos. Acortá las listas de deseos.');
  var hoja = hoja_();
  var fila = buscarFila_(hoja, s.id) || hoja.getLastRow() + 1;
  if (fila > hoja.getMaxRows()) hoja.insertRowAfter(hoja.getMaxRows());
  hoja.getRange(fila, 1, 1, 3).setValues([[s.id, sumarDias_(s.evento.fecha, DIAS_HASTA_BORRAR), datos]]);
  SpreadsheetApp.flush();
}

function borrarVencidos() {
  conCandado_(function () {
    var hoja = hoja_();
    var hoy = hoy_();
    for (var fila = hoja.getLastRow(); fila >= 2; fila--) {
      if (String(hoja.getRange(fila, 2).getValue()) < hoy) hoja.deleteRow(fila);
    }
  });
}

function conCandado_(tarea) {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) throw aviso_('Hay mucha gente usando la app. Probá de nuevo en unos segundos.');
  try {
    return tarea();
  } finally {
    candado.releaseLock();
  }
}
