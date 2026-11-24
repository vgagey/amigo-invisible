/**
 * Yori, Sorteo Navideño: datos, permisos y mails.
 * Ver README.md para instalarlo.
 */

// Dirección pública de la app, terminada en "/". Se usa en los links de los mails.
var URL_APP = 'https://vgagey.github.io/amigo-invisible/';

var MAX_PERSONAS = 40;
var MAX_CREACIONES_POR_DIA = 30; // reserva cupo de mails para los sorteos
var MAX_CREACIONES_POR_MAIL = 3; // por día
var INTENTOS_PIN = 5;
var MINUTOS_ENTRE_PINES = 2; // espera para pedir otro PIN
var PINES_POR_PERSONA = 5; // por día
var PINES_POR_MAIL = 3; // por día
var PINES_POR_SORTEO = 60; // por día
var MINUTOS_PIN = 30; // validez de un PIN
var INTENTOS_TELEFONO = 5; // cada 15 minutos, por nombre
var INTENTOS_INVITACION = 10; // después hay que enviar otro PIN
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
  pedirPin: pedirPin_,
  entrar: entrar_,
  pedirLink: pedirLink_,
  // Quien organiza
  admin: function (p) { return verAdmin_(abrirAdmin_(p)); },
  guardarEvento: conAdmin_(guardarEvento_),
  agregarPersona: conAdmin_(agregarPersona_),
  editarPersona: conAdmin_(editarPersona_),
  quitarPersona: conAdmin_(quitarPersona_),
  agregarExclusion: conAdmin_(agregarExclusion_),
  quitarExclusion: conAdmin_(quitarExclusion_),
  corregirTelefono: conAdmin_(corregirTelefono_),
  liberar: conAdmin_(liberar_),
  reabrir: conAdmin_(reabrir_),
  sortear: sortear_,
  reenviar: reenviar_,
  invitar: invitar_,
  pedirEmergencia: pedirEmergencia_,
  verSorteo: verSorteo_,
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
  var evento = leerEvento_(pedido);

  return conCandado_(function () {
    contarCreacion_(huella_(mail));
    exigirCupo_(1);

    var token = nuevoToken_();
    var sorteo = {
      id: 's' + nuevoToken_().slice(0, 16),
      admin: huella_(token),
      organizador: { nombre: nombre, mail: mail },
      evento: evento,
      personas: [],
      exclusiones: [],
      estado: 'abierto',
      parejas: ''
    };
    enviarMail_({
      para: mail,
      asunto: 'Tu Sorteo Navideño en Yori',
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
        id: p.id, nombre: p.nombre, tipo: p.tipo, telefono: p.telefono || '', correo: p.correo || '', mail: p.mail, responsable: p.responsable || '',
        validada: p.validada || '', entro: p.entro === true, vio: p.vio === true, envio: p.envio || ''
      };
    }),
    exclusiones: s.exclusiones
  };
}

function guardarEvento_(s, pedido) {
  exigirAbierto_(s);
  s.evento = leerEvento_(pedido);
}

function leerEvento_(pedido) {
  return {
    nombre: validarTexto_(pedido.encuentro, 60) || 'Navidad en familia',
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
  var tipo = validarTipo_(pedido.tipo);
  var responsable = leerResponsable_(s, pedido, tipo, null);
  var contacto = leerContacto_(pedido, responsable);
  s.personas.push({
    id: 'p' + nuevoToken_().slice(0, 8),
    nombre: nombre,
    tipo: tipo,
    telefono: contacto.telefono,
    correo: contacto.correo,
    mail: '',
    responsable: responsable,
    deseos: '',
    sesiones: []
  });
}

function editarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  var nombre = validarNombre_(pedido.nombre);
  exigirNombreLibre_(s, nombre, p.id);
  var tipo = validarTipo_(pedido.tipo);
  if (tipo !== 'adulto') exigirSinNinos_(s, p);
  var responsable = leerResponsable_(s, pedido, tipo, p.id);
  var contacto = leerContacto_(pedido, responsable);
  if (responsable || contacto.correo !== p.correo) quitarAccesos_(p);
  p.telefono = contacto.telefono;
  p.correo = contacto.correo;
  p.nombre = nombre;
  p.tipo = tipo;
  p.responsable = responsable;
}

/** Un niño puede entrar por su cuenta o a través de un adulto. */
function leerResponsable_(s, pedido, tipo, idPropio) {
  if (tipo !== 'nino' || !pedido.responsable) return '';
  var adulto = buscarPersona_(s, pedido.responsable);
  if (adulto.tipo !== 'adulto' || adulto.id === idPropio) throw aviso_('Quien gestiona a un niño tiene que ser un adulto.');
  return adulto.id;
}

/** Mail, teléfono o los dos. Con mail recibe link y PIN; sin mail, entra con su teléfono. */
function leerContacto_(pedido, responsable) {
  if (responsable) return { telefono: '', correo: '' };
  var correo = validarMail_(pedido.correo);
  var telefono = correo && !pedido.telefono ? '' : validarTelefono_(pedido.telefono);
  return { telefono: telefono, correo: correo };
}

function exigirSinNinos_(s, p) {
  var ninos = s.personas.filter(function (x) { return x.responsable === p.id; });
  if (ninos.length) throw aviso_(p.nombre + ' gestiona a ' + ninos.map(function (x) { return x.nombre; }).join(', ') + '. Cambialo primero.');
}

function quitarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  exigirSinNinos_(s, p);
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

function corregirTelefono_(s, pedido) {
  var p = buscarPersona_(s, pedido.persona);
  if (p.responsable) throw aviso_('A esta persona la gestiona un adulto.');
  if (p.validada) throw aviso_('Este nombre ya fue validado.');
  var contacto = leerContacto_(pedido, '');
  if (contacto.correo !== p.correo) quitarAccesos_(p);
  p.telefono = contacto.telefono;
  p.correo = contacto.correo;
}

/** Si validó la persona equivocada: corta su acceso y el nombre vuelve a quedar disponible. */
function liberar_(s, pedido) {
  var p = buscarPersona_(s, pedido.persona);
  if (!p.validada) throw aviso_('Este nombre todavía no fue validado.');
  quitarAccesos_(p);
  p.vio = false;
  p.reinicio = ahora_();
}

function reabrir_(s) {
  if (s.estado !== 'sorteado') return;
  s.estado = 'abierto';
  s.parejas = '';
  s.personas.forEach(function (p) { p.envio = ''; p.vio = false; });
}

function sortear_(pedido) {
  var envios = [];
  var sorteo = conCandado_(function () {
    var s = abrirAdmin_(pedido);
    exigirAbierto_(s);
    validarFecha_(s.evento.fecha);

    var parejas;
    try {
      parejas = sortearPersonas(s.personas, s.exclusiones, s.evento.modalidad);
    } catch (error) {
      throw aviso_(error.message);
    }
    var conMail = s.personas.filter(function (p) { return p.mail || p.correo; });
    exigirCupo_(conMail.length);

    s.parejas = ocultar_(parejas);
    s.estado = 'sorteado';
    conMail.forEach(function (p) {
      envios.push(p.validada ? { persona: p, token: darLink_(p) } : { persona: p, pin: darPin_(p) });
    });
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
    if (!p.mail) throw aviso_('Esta persona todavía no validó su mail.');
    exigirCupo_(1);
    envio = { persona: p, token: darLink_(p) };
    guardar_(s);
    return s;
  });
  enviarLinks_(sorteo, [envio]);
  return verAdmin_(abrir_(sorteo.id));
}

/** Envía link y PIN al mail cargado: a una persona, o a todas las que falte invitar. */
function invitar_(pedido) {
  var envios;
  var sorteo = conCandado_(function () {
    var s = abrirAdmin_(pedido);
    var personas = s.personas.filter(function (p) {
      return p.correo && !p.validada && (pedido.persona ? p.id === pedido.persona : p.envio !== 'enviado');
    });
    if (!personas.length) throw aviso_('No hay invitaciones para enviar.');
    if (pedido.persona) {
      contarEnvio_('invitar:' + pedido.persona + personas[0].correo, 1, MINUTOS_ENTRE_PINES * 60, 'Ya le enviamos un PIN. Esperá ' + MINUTOS_ENTRE_PINES + ' minutos.');
      contarEnvio_('dia:' + pedido.persona + hoy_(), PINES_POR_PERSONA, 21600, 'Ya le enviamos varios PIN hoy. Probá más tarde.');
    }
    exigirCupo_(personas.length);
    envios = personas.map(function (p) { return { persona: p, pin: darPin_(p) }; });
    guardar_(s);
    return s;
  });
  enviarLinks_(sorteo, envios);
  return verAdmin_(abrir_(sorteo.id));
}

function darPin_(p) {
  var pin = nuevoPin_();
  p.pin = huella_(p.id + ':' + pin);
  p.fallos = 0;
  p.envio = 'pendiente';
  CacheService.getScriptCache().remove('invitacion:' + p.id);
  return pin;
}

/** PIN de la invitación: no vence, pero se anula después de varios intentos fallidos. */
function validarInvitacion_(s, p, pin) {
  if (!p.pin) throw aviso_('Todavía no se envió tu PIN. Consultale a quien organiza.');
  if (p.fallos >= INTENTOS_INVITACION) throw aviso_('Este PIN se anuló por demasiados intentos. Pedile otro a quien organiza.');
  var cache = CacheService.getScriptCache();
  var clave = 'invitacion:' + p.id;
  var recientes = Number(cache.get(clave) || 0);
  if (recientes >= INTENTOS_PIN) throw aviso_('Demasiados intentos. Probá de nuevo en 15 minutos.');
  if (p.pin !== huella_(p.id + ':' + String(pin || ''))) {
    cache.put(clave, String(recientes + 1), 900);
    p.fallos++;
    guardar_(s);
    throw aviso_('El PIN no es correcto.');
  }
  p.pin = '';
}

function grupo_(pedido) {
  var s = abrir_(pedido.id);
  return {
    organizador: s.organizador.nombre,
    encuentro: s.evento.nombre,
    personas: s.personas.filter(function (p) { return !p.responsable; }).map(function (p) {
      return { id: p.id, nombre: p.nombre, validada: !!p.validada, conMail: !!p.correo };
    })
  };
}

/** La persona escribe el teléfono que cargó quien organiza y su propio mail, donde recibe el PIN. */
function pedirPin_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaLibre_(s, pedido.persona);
    if (p.correo) throw aviso_('Tu PIN llega al mail que cargó quien organiza.');
    exigirTelefono_(p, pedido.telefono);
    var mail = mailLibre_(s, pedido.mail);
    var clave = clavePin_(s, p, mail);
    contarEnvio_(clave, 1, MINUTOS_ENTRE_PINES * 60, 'Ya te enviamos un PIN. Revisá tu mail o esperá ' + MINUTOS_ENTRE_PINES + ' minutos.');
    contarEnvio_('dia:' + huella_(mail) + hoy_(), PINES_POR_MAIL, 21600, 'Ya enviamos varios PIN a ese mail. Probá más tarde.');
    contarEnvio_('dia:' + p.id + hoy_(), PINES_POR_PERSONA, 21600, 'Ya se pidieron varios PIN para este nombre. Probá más tarde.');
    contarEnvio_('dia:' + s.id + hoy_(), PINES_POR_SORTEO, 21600, 'Este sorteo ya envió muchos PIN hoy. Probá más tarde.');
    exigirCupo_(1);
    var pin = nuevoPin_();
    enviarMail_({
      para: mail,
      de: s.organizador.nombre,
      responderA: s.organizador.mail,
      asunto: 'Tu PIN de Yori',
      titulo: 'Hola, ' + p.nombre,
      texto: 'Este es tu PIN para validar tu nombre en el sorteo que organiza ' + s.organizador.nombre + '. Vence en ' + MINUTOS_PIN + ' minutos. No lo compartas.',
      destacado: pin,
      boton: 'Entrar',
      url: URL_APP + '#/g/' + s.id + '/elegir'
    });
    guardarPin_(clave, pin);
    return { mail: mail };
  });
}

function entrar_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaLibre_(s, pedido.persona);
    var mail = p.correo;
    if (mail) {
      validarInvitacion_(s, p, pedido.pin);
    } else {
      mail = mailLibre_(s, pedido.mail);
      validarPin_(clavePin_(s, p, mail), pedido.pin);
    }
    p.mail = mail;
    p.validada = ahora_();
    return abrirSesion_(s, p);
  });
}

/** Para volver desde otro dispositivo: el link va siempre al mail ya validado. */
function pedirLink_(pedido) {
  var envio;
  var sorteo = conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = buscarPersona_(s, pedido.persona);
    if (!p.mail) throw aviso_('Este nombre todavía no fue validado.');
    contarEnvio_('link:' + p.id, 1, MINUTOS_ENTRE_PINES * 60, 'Ya te enviamos el link. Revisá tu mail.');
    contarEnvio_('dia:' + p.id + hoy_(), PINES_POR_PERSONA, 21600, 'Ya te enviamos varios mails. Usá el último link.');
    exigirCupo_(1);
    envio = { persona: p, token: darLink_(p) };
    guardar_(s);
    return s;
  });
  enviarLinks_(sorteo, [envio]);
  return { mail: ocultarMail_(envio.persona.mail) };
}

function personaLibre_(s, id) {
  var p = buscarPersona_(s, id);
  if (p.responsable) throw aviso_('A esta persona la gestiona un adulto.');
  if (p.validada) throw aviso_('Este nombre ya fue validado. Si no fuiste vos, avisale a quien organiza.');
  return p;
}

/** Compara los últimos 6 números: cada uno escribe el suyo con o sin 54, 9, 0 o 15. */
function exigirTelefono_(p, valor) {
  var cache = CacheService.getScriptCache();
  var clave = 'telefono:' + p.id;
  var fallos = Number(cache.get(clave) || 0);
  if (fallos >= INTENTOS_TELEFONO) throw aviso_('Demasiados intentos. Probá de nuevo en 15 minutos.');
  var escrito = validarTelefono_(valor);
  if (!p.telefono || escrito.slice(-6) !== p.telefono.slice(-6)) {
    cache.put(clave, String(fallos + 1), 900);
    throw aviso_('El teléfono no coincide con el que cargó quien organiza.');
  }
}

/** Un mismo mail no puede validar dos nombres del mismo sorteo. */
function mailLibre_(s, valor) {
  var mail = validarMail_(valor);
  if (!mail) throw aviso_('Completá tu mail.');
  if (s.personas.some(function (p) { return p.mail === mail || p.correo === mail; })) throw aviso_('Ese mail ya corresponde a otro nombre de este sorteo.');
  return mail;
}

function clavePin_(s, p, mail) {
  return 'pin:' + s.id + ':' + p.id + ':' + huella_(mail);
}

function nuevoPin_() {
  return ('00000' + parseInt(nuevoToken_().slice(0, 8), 16) % 1000000).slice(-6);
}

function guardarPin_(clave, pin) {
  CacheService.getScriptCache().put('valor:' + clave, JSON.stringify({ huella: huella_(clave + pin), fallos: 0 }), MINUTOS_PIN * 60);
}

/** Un PIN sirve una sola vez y se anula después de varios intentos fallidos. */
function validarPin_(clave, pin) {
  var cache = CacheService.getScriptCache();
  var guardado = JSON.parse(cache.get('valor:' + clave) || 'null');
  if (!guardado) throw aviso_('El PIN venció o no existe. Pedí otro.');
  if (guardado.huella !== huella_(clave + String(pin || ''))) {
    guardado.fallos++;
    if (guardado.fallos >= INTENTOS_PIN) {
      cache.remove('valor:' + clave);
      throw aviso_('Demasiados intentos. Pedí otro PIN.');
    }
    cache.put('valor:' + clave, JSON.stringify(guardado), MINUTOS_PIN * 60);
    throw aviso_('El PIN no es correcto.');
  }
  cache.remove('valor:' + clave);
}

function contarEnvio_(clave, maximo, segundos, mensaje) {
  var cache = CacheService.getScriptCache();
  var cantidad = Number(cache.get('envio:' + clave) || 0);
  if (cantidad >= maximo) throw aviso_(mensaje);
  cache.put('envio:' + clave, String(cantidad + 1), segundos);
}

/* Acceso de emergencia: solo quien organiza, con un PIN que llega a su mail. */

function pedirEmergencia_(pedido) {
  return conCandado_(function () {
    var s = abrirAdmin_(pedido);
    if (s.estado !== 'sorteado') throw aviso_('Todavía no se hizo el sorteo.');
    contarEnvio_('emergencia:' + s.id, 1, MINUTOS_ENTRE_PINES * 60, 'Ya te enviamos un PIN. Revisá tu mail o esperá ' + MINUTOS_ENTRE_PINES + ' minutos.');
    exigirCupo_(1);
    var pin = nuevoPin_();
    enviarMail_({
      para: s.organizador.mail,
      asunto: 'PIN de emergencia de Yori',
      titulo: 'Hola, ' + s.organizador.nombre,
      texto: 'Este PIN permite ver el sorteo completo. Vence en ' + MINUTOS_PIN + ' minutos. Si no lo pediste, no lo uses ni lo compartas.',
      destacado: pin,
      boton: 'Ir a Yori',
      url: URL_APP
    });
    guardarPin_('emergencia:' + s.id, pin);
    return { mail: ocultarMail_(s.organizador.mail) };
  });
}

function verSorteo_(pedido) {
  return conCandado_(function () {
    var s = abrirAdmin_(pedido);
    if (s.estado !== 'sorteado') throw aviso_('Todavía no se hizo el sorteo.');
    validarPin_('emergencia:' + s.id, pedido.pin);
    var parejas = mostrar_(s.parejas);
    return s.personas.filter(function (p) { return parejas[p.id]; }).map(function (p) {
      return { nombre: p.nombre, regalaA: parejas[p.id].map(function (id) { return buscarPersona_(s, id).nombre; }) };
    });
  });
}

function ocultarMail_(mail) {
  var partes = mail.split('@');
  return partes[0].slice(0, 1) + '•••@' + partes[1];
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
    evento: { nombre: s.evento.nombre, fecha: s.evento.fecha, presupuesto: s.evento.presupuesto, mensaje: s.evento.mensaje },
    sorteado: s.estado === 'sorteado',
    regala: regala_(s, p),
    aCargo: s.personas.filter(function (x) { return x.responsable === p.id; }).map(function (x) {
      return { persona: x.id, nombre: x.nombre, deseos: x.deseos, regala: regala_(s, x) };
    }),
    reinicio: p.reinicio || '',
    deseos: p.deseos
  };
}

function regala_(s, p) {
  return s.estado === 'sorteado' && !!mostrar_(s.parejas)[p.id];
}

/** La propia persona o un niño que gestiona. */
function personaPedida_(s, pedido) {
  var yo = personaConToken_(s, pedido.token);
  if (!pedido.persona || pedido.persona === yo.id) return yo;
  var otra = buscarPersona_(s, pedido.persona);
  if (otra.responsable !== yo.id) throw aviso_('No gestionás a esta persona.');
  return otra;
}

function descubrir_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
    if (s.estado !== 'sorteado') throw aviso_('Todavía no se hizo el sorteo.');
    if (!p.vio) {
      p.vio = true;
      guardar_(s);
    }
    return (mostrar_(s.parejas)[p.id] || []).map(function (id) {
      var otra = buscarPersona_(s, id);
      return { nombre: otra.nombre, deseos: otra.deseos };
    });
  });
}

function guardarDeseos_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
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
  p.enlace = huella_(token);
  p.envio = 'pendiente';
  return token;
}

function quitarAccesos_(p) {
  p.mail = '';
  p.pin = '';
  p.validada = '';
  p.enlace = '';
  p.sesiones = [];
  p.entro = false;
  p.envio = '';
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

function validarTelefono_(valor) {
  var numeros = String(valor || '').replace(/\D/g, '');
  if (numeros.length < 8 || numeros.length > 15) throw aviso_('Revisá el teléfono: escribilo con código de área.');
  return numeros;
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
    throw aviso_('Hoy quedan ' + cupo + ' mails disponibles y hacen falta ' + cantidad + '. No se envió nada: probá mañana.');
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

/* ---------- Mails ---------- */

function enviarLinks_(sorteo, envios) {
  if (!envios.length) return;
  var estados = {};
  var sorteado = sorteo.estado === 'sorteado';
  var organiza = sorteo.organizador.nombre;
  envios.forEach(function (envio) {
    try {
      enviarMail_({
        para: envio.pin ? envio.persona.correo : envio.persona.mail,
        de: organiza,
        responderA: sorteo.organizador.mail,
        asunto: sorteado ? 'Ya se hizo el Sorteo Navideño' : envio.pin ? 'Te invitaron a un Sorteo Navideño' : 'Tu link de Yori',
        titulo: 'Hola, ' + envio.persona.nombre,
        texto: (sorteado ? organiza + ' hizo el sorteo de Navidad. Entrá para ver a quién le regalás y cargar tu lista de deseos.'
          : envio.pin ? organiza + ' te invitó a participar de su sorteo de Navidad.'
            : 'Con este link volvés a entrar al sorteo que organiza ' + organiza + '.') +
          (envio.pin ? ' Abrí el link y escribí este PIN para validar tu nombre. Es personal: no lo compartas.' : ' El link es privado: no lo reenvíes.'),
        destacado: envio.pin,
        boton: 'Entrar',
        url: URL_APP + (envio.pin ? '#/g/' + sorteo.id + '/' + envio.persona.id : '#/s/' + sorteo.id + '/' + envio.token)
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
    name: m.de ? m.de + ' (Yori)' : 'Yori',
    body: m.titulo + '\n\n' + m.texto + '\n\n' + (m.destacado ? m.destacado + '\n\n' : '') + m.boton + ': ' + m.url + '\n\nYori · Powered by GIWA',
    htmlBody:
      '<div style="font-family:Montserrat,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0b1f4b;font-size:15px;line-height:1.6">' +
      '<p style="font-size:18px;margin:0 0 16px">' + escapar_(m.titulo) + '</p>' +
      '<p style="margin:0 0 24px">' + escapar_(m.texto) + '</p>' +
      (m.destacado ? '<p style="margin:0 0 24px;font-family:Courier New,monospace;font-size:30px;letter-spacing:4px">' + escapar_(m.destacado) + '</p>' : '') +
      '<p style="margin:0 0 32px"><a href="' + escapar_(m.url) + '" style="background:#0090ff;color:#0b1f4b;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">' + escapar_(m.boton) + '</a></p>' +
      '<p style="margin:0;font-size:11px;color:#5b6785">Yori · Powered by GIWA</p></div>'
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
