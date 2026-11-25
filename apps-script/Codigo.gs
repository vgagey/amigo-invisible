/**
 * yori, Sorteo Navideño: datos, permisos y mails.
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
var MAX_DATOS = 49000; // por sorteo: es lo que entra en una celda
var MAX_TEXTO_PERFIL = 500; // suma de los textos de una lista de deseos
var MAX_GUSTOS = 12;
var MAX_HIJOS = 5; // perfiles de hijos que no participan, por adulto
var DIAS_HASTA_BORRAR = 30;
var MAX_ESPECIALES = 20;
var ACCESOS_POR_MAIL = 5; // por día
var ACCESOS_POR_DIA = 60; // en total

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
  acceder: acceder_,
  // Quien organiza
  admin: function (p) { return verAdmin_(abrirAdmin_(p)); },
  guardarEvento: conAdmin_(guardarEvento_),
  agregarPersona: conAdmin_(agregarPersona_),
  editarPersona: conAdmin_(editarPersona_),
  quitarPersona: conAdmin_(quitarPersona_),
  agregarExclusion: conAdmin_(agregarExclusion_),
  quitarExclusion: conAdmin_(quitarExclusion_),
  limpiarExclusiones: conAdmin_(limpiarExclusiones_),
  aceptarPropuesta: conAdmin_(aceptarPropuesta_),
  descartarPropuesta: conAdmin_(descartarPropuesta_),
  mantenerExclusion: conAdmin_(mantenerExclusion_),
  reglaFamilia: conAdmin_(reglaFamilia_),
  guardarEspecial: conAdmin_(guardarEspecial_),
  quitarEspecial: conAdmin_(quitarEspecial_),
  proponerMail: conAdmin_(proponerMail_),
  corregirTelefono: conAdmin_(corregirTelefono_),
  liberar: conAdmin_(liberar_),
  reabrir: conAdmin_(reabrir_),
  sortear: sortear_,
  reenviar: reenviar_,
  invitar: invitar_,
  simular: simular_,
  pedirEmergencia: pedirEmergencia_,
  verSorteo: verSorteo_,
  // Participantes
  yo: yo_,
  descubrir: descubrir_,
  guardarDeseos: guardarDeseos_,
  guardarPerfil: guardarPerfil_,
  quitarPerfil: quitarPerfil_,
  dejarDeCompartir: dejarDeCompartir_,
  confirmarMail: confirmarMail_,
  rechazarMail: rechazarMail_
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
      propuestas: true, // los sorteos anteriores no tienen esta marca y siguen sin propuestas
      descartadas: [],
      reglaFamilia: true, // no se regala dentro de la familia
      especiales: [],
      estado: 'abierto',
      parejas: ''
    };
    enviarMail_({
      para: mail,
      asunto: 'Tu Sorteo Navideño en yori',
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
        pareja: p.pareja || '', padres: p.padres || [], mailPropuesto: p.mailPropuesto || '',
        validada: p.validada || '', entro: p.entro === true, vio: p.vio === true, envio: p.envio || ''
      };
    }),
    exclusiones: s.exclusiones,
    reglaFamilia: s.reglaFamilia === true,
    especiales: s.especiales || [],
    verificacion: s.estado === 'abierto' ? verificar_(s, s.exclusiones) : null,
    propuestas: propuestas_(s),
    verificacionConPropuestas: propuestas_(s).length ? verificar_(s, s.exclusiones.concat(comoExclusiones_(propuestas_(s)))) : null,
    sinRelacion: sinRelacion_(s)
  };
}

/** Usa la misma función que el sorteo real, sin guardar nada. */
function verificar_(s, exclusiones) {
  try {
    repartirRegalos_(s, exclusiones);
    return { ok: true, motivo: '' };
  } catch (error) {
    return { ok: false, motivo: error.message };
  }
}

/** Ejemplo de emparejamiento: no se guarda ni influye en el sorteo. */
function simular_(pedido) {
  var s = abrirAdmin_(pedido);
  exigirAbierto_(s);
  var parejas;
  try {
    parejas = repartirRegalos_(s, s.exclusiones);
  } catch (error) {
    throw aviso_(error.message);
  }
  return detalle_(s, parejas);
}

/* ---------- Reglas del sorteo: familia, exclusiones y regalos especiales ----------
 * Son tres cosas distintas y se guardan por separado. Acá se juntan solo para sortear,
 * siempre con la misma función de Sorteo.gs. */

/** De cada persona, a qué familia pertenece. Sale de la pareja y de madre o padre. */
function familias_(s) {
  var de = {};
  var raiz = function (id) { while (de[id] !== id) id = de[id]; return id; };
  s.personas.forEach(function (p) { de[p.id] = p.id; });
  s.personas.forEach(function (p) {
    [p.pareja].concat(p.padres || []).forEach(function (id) { if (id && de[id]) de[raiz(p.id)] = raiz(id); });
  });
  var grupo = {};
  s.personas.forEach(function (p) { grupo[p.id] = raiz(p.id); });
  return grupo;
}

function mismaFamilia_(s, a, b) {
  if (s.reglaFamilia !== true) return false;
  var grupo = familias_(s);
  return grupo[a] === grupo[b];
}

function reglaFamilia_(s, pedido) {
  exigirAbierto_(s);
  s.reglaFamilia = pedido.activa === true;
}

/** Quien recibe un regalo especial adicional y no recibe otro del sorteo. Solo quienes no regalan. */
function cubierta_(s, p) {
  return s.evento.modalidad === 'B' && p.tipo === 'nino' && (s.especiales || []).some(function (e) {
    return e.modo === 'adicional' && e.a === p.id && !e.tambien;
  }) && !s.especiales.some(function (e) { return e.modo === 'reemplaza' && e.a === p.id; });
}

function repartirRegalos_(s, exclusiones) {
  var personas = s.personas.filter(function (p) { return !cubierta_(s, p); });
  var reglas = exclusiones.slice();
  if (s.reglaFamilia === true) {
    var grupo = familias_(s);
    personas.forEach(function (x) {
      personas.forEach(function (y) { if (x.id !== y.id && grupo[x.id] === grupo[y.id]) reglas.push({ de: x.id, a: y.id }); });
    });
  }
  (s.especiales || []).forEach(function (e) {
    if (e.modo === 'adicional') {
      reglas.push({ de: e.de, a: e.a }); // su regalo del sorteo va a otra persona
      return;
    }
    var tipo = buscarPersona_(s, e.a).tipo;
    if (!cruza_(s, buscarPersona_(s, e.de), buscarPersona_(s, e.a))) throw new Error('Un regalo especial reemplaza a uno que esta modalidad no sortea. Revisalo en Especiales.');
    reglas = reglas.filter(function (x) { return !(x.de === e.de && x.a === e.a); });
    personas.forEach(function (x) { if (x.tipo === tipo && x.id !== e.a) reglas.push({ de: e.de, a: x.id }); });
  });
  // Sin niños por sortear, los adultos se regalan entre sí.
  var hayNinos = personas.some(function (p) { return p.tipo === 'nino'; });
  return sortearPersonas(personas, reglas, hayNinos ? s.evento.modalidad : 'A');
}

/** Lo que da una persona, con lo especial aparte de lo que salió del sorteo. */
function regalosDe_(s, parejas, id) {
  var propios = (s.especiales || []).filter(function (e) { return e.de === id; });
  var reemplazos = propios.filter(function (e) { return e.modo === 'reemplaza'; }).map(function (e) { return e.a; });
  return (parejas[id] || []).map(function (a) { return { a: a, especial: reemplazos.indexOf(a) !== -1 }; })
    .concat(propios.filter(function (e) { return e.modo === 'adicional'; }).map(function (e) { return { a: e.a, especial: true, aparte: true }; }));
}

function detalle_(s, parejas) {
  return s.personas.filter(function (p) { return parejas[p.id]; }).map(function (p) {
    var regalos = regalosDe_(s, parejas, p.id);
    var nombres = function (especial) {
      return regalos.filter(function (x) { return x.especial === especial; }).map(function (x) { return buscarPersona_(s, x.a).nombre; });
    };
    return { nombre: p.nombre, regalaA: nombres(false), especiales: nombres(true) };
  });
}

function guardarEspecial_(s, pedido) {
  exigirAbierto_(s);
  var de = buscarPersona_(s, pedido.de);
  var a = buscarPersona_(s, pedido.a);
  var modo = pedido.modo === 'reemplaza' ? 'reemplaza' : 'adicional';
  if (de.tipo !== 'adulto') throw aviso_('Quien regala tiene que ser un adulto.');
  if (de.id === a.id) throw aviso_('Elegí dos personas distintas.');
  var otros = (s.especiales || []).filter(function (e) { return e.id !== pedido.especial; });
  if (otros.length >= MAX_ESPECIALES) throw aviso_('El máximo es de ' + MAX_ESPECIALES + ' regalos especiales.');
  if (otros.some(function (e) { return e.de === de.id && e.a === a.id; })) throw aviso_('Ese regalo especial ya está cargado.');
  if (modo === 'reemplaza') {
    if (!cruza_(s, de, a)) throw aviso_('En esta modalidad ese regalo no sale del sorteo: elegí Adicional.');
    otros.forEach(function (e) {
      if (e.modo !== 'reemplaza') return;
      if (e.a === a.id && a.tipo === 'adulto') throw aviso_(a.nombre + ' ya tiene un regalo que reemplaza al del sorteo.');
      if (e.de === de.id && buscarPersona_(s, e.a).tipo === a.tipo) throw aviso_(de.nombre + ' ya tiene reemplazado ese regalo.');
    });
  }
  s.especiales = otros.concat({ id: pedido.especial || 'e' + nuevoToken_().slice(0, 8), de: de.id, a: a.id, modo: modo, tambien: pedido.tambien === true });
}

function quitarEspecial_(s, pedido) {
  exigirAbierto_(s);
  s.especiales = (s.especiales || []).filter(function (e) { return e.id !== pedido.especial; });
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
  guardarRelaciones_(s, s.personas[s.personas.length - 1], pedido);
}

function editarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  var nombre = validarNombre_(pedido.nombre);
  exigirNombreLibre_(s, nombre, p.id);
  var tipo = validarTipo_(pedido.tipo);
  if (tipo !== 'adulto') {
    exigirSinNinos_(s, p);
    exigirSinRelaciones_(s, p);
    if ((s.especiales || []).some(function (e) { return e.de === p.id; })) throw aviso_(p.nombre + ' da un regalo especial. Quitalo primero.');
    if (leerLista_(p.deseos).hijos.length) throw aviso_(p.nombre + ' tiene menores a cargo en su lista. Primero tiene que quitarlos desde Mi regalo.');
  }
  var responsable = leerResponsable_(s, pedido, tipo, p.id);
  var contacto = leerContacto_(pedido, responsable);
  if (p.validada && responsable) throw aviso_('Ya validó su acceso. Si va a quedar a cargo de otra persona, primero usá Liberar.');
  if (p.validada && contacto.correo !== (p.correo || '')) throw aviso_('Ya validó su mail. Para corregirlo usá Corregir mail; si cambia la persona, usá Liberar.');
  if ((p.responsable || '') !== responsable && (p.responsable || tieneLista_(p))) {
    if (pedido.vaciar !== true) throw aviso_('Cambia el responsable de ' + p.nombre + '. Para seguir hay que confirmarlo: si tiene deseos cargados, se borran.');
    p.deseos = '';
  }
  if (responsable || contacto.correo !== p.correo) quitarAccesos_(p);
  p.telefono = contacto.telefono;
  p.correo = contacto.correo;
  p.nombre = nombre;
  p.tipo = tipo;
  p.responsable = responsable;
  guardarRelaciones_(s, p, pedido);
}

/** Todo menor está a cargo de un único adulto. */
function leerResponsable_(s, pedido, tipo, idPropio) {
  if (tipo !== 'nino') return '';
  if (!pedido.responsable) throw aviso_('Elegí quién es el responsable.');
  var adulto = buscarPersona_(s, pedido.responsable);
  if (adulto.tipo !== 'adulto' || adulto.id === idPropio) throw aviso_('El responsable tiene que ser un adulto.');
  return adulto.id;
}

/** Mail, teléfono o los dos. Con mail recibe link y PIN; sin mail, entra con su teléfono. */
function leerContacto_(pedido, responsable) {
  if (responsable) return { telefono: '', correo: '' };
  var correo = validarMail_(pedido.correo);
  var telefono = correo && !pedido.telefono ? '' : validarTelefono_(pedido.telefono);
  return { telefono: telefono, correo: correo };
}

/**
 * Pareja y madre o padre son datos familiares: no dan acceso a nada. El único
 * permiso es p.responsable, que es uno solo. Si el pedido no trae relaciones, no se tocan.
 */
function guardarRelaciones_(s, p, pedido) {
  if (p.tipo !== 'adulto') {
    if (pedido.padre1 !== undefined || pedido.padre2 !== undefined) {
      var ids = [pedido.padre1, pedido.padre2].filter(Boolean);
      if (ids.length === 2 && ids[0] === ids[1]) ids.pop();
      p.padres = ids.map(function (id) { return adulto_(s, id, p.id, 'Madre / Padre').id; });
    }
  } else {
    p.padres = [];
    if (pedido.pareja !== undefined) {
      var otra = pedido.pareja ? adulto_(s, pedido.pareja, p.id, 'La pareja') : null;
      if (otra && otra.pareja && otra.pareja !== p.id) throw aviso_(otra.nombre + ' ya tiene otra pareja cargada.');
      s.personas.forEach(function (x) { if (x.pareja === p.id) x.pareja = ''; });
      p.pareja = otra ? otra.id : '';
      if (otra) otra.pareja = p.id;
    }
  }
  limpiarDescartes_(s);
}

function adulto_(s, id, idPropio, quien) {
  var x = buscarPersona_(s, id);
  if (x.tipo !== 'adulto' || x.id === idPropio) throw aviso_(quien + ' tiene que ser otro adulto.');
  return x;
}

function exigirSinRelaciones_(s, p) {
  if (p.pareja) throw aviso_('Primero quitá la pareja de ' + p.nombre + '.');
  var hijos = s.personas.filter(function (x) { return (x.padres || []).indexOf(p.id) !== -1; });
  if (hijos.length) throw aviso_(p.nombre + ' figura como Madre / Padre de ' + hijos.map(function (x) { return x.nombre; }).join(', ') + '. Cambialo primero.');
}

function exigirSinNinos_(s, p) {
  var ninos = s.personas.filter(function (x) { return x.responsable === p.id; });
  if (ninos.length) throw aviso_(p.nombre + ' es responsable de ' + ninos.map(function (x) { return x.nombre; }).join(', ') + '. Cambialo primero.');
}

/* ---------- Propuestas de exclusión ----------
 * Salen solo de relaciones cargadas y no influyen en el sorteo hasta que se aceptan.
 * Cada descarte se guarda como "idMenor|idMayor|motivo", nunca con nombres. */

function clavePar_(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

function relaciones_(s) {
  var lista = [];
  var sumar = function (a, b, motivo) { lista.push({ a: a, b: b, motivo: motivo, clave: clavePar_(a, b) + '|' + motivo }); };
  s.personas.forEach(function (p) {
    if (p.pareja && p.id < p.pareja) sumar(p.id, p.pareja, 'pareja');
    (p.padres || []).forEach(function (id) { sumar(id, p.id, 'progenitor'); });
    if (p.responsable) sumar(p.responsable, p.id, 'a_cargo');
  });
  return lista;
}

function motivosDe_(s, a, b) {
  var par = clavePar_(a, b);
  return relaciones_(s).filter(function (x) { return clavePar_(x.a, x.b) === par; }).map(function (x) { return x.motivo; });
}

/** Qué cruces usa cada modalidad. */
function cruza_(s, de, a) {
  return s.evento.modalidad === 'B' ? de.tipo === 'adulto' : de.tipo === a.tipo;
}

function propuestas_(s) {
  if (!s.propuestas || s.estado !== 'abierto') return [];
  var pares = {};
  var orden = [];
  relaciones_(s).forEach(function (x) {
    if ((s.descartadas || []).indexOf(x.clave) !== -1) return;
    var a = buscarPersona_(s, x.a);
    var b = buscarPersona_(s, x.b);
    var falta = [[a, b], [b, a]].some(function (c) { return cruza_(s, c[0], c[1]) && !excluida_(s, c[0].id, c[1].id) && !mismaFamilia_(s, c[0].id, c[1].id); });
    if (!falta) return;
    var par = clavePar_(x.a, x.b);
    if (!pares[par]) {
      pares[par] = { de: x.a, a: x.b, motivos: [] };
      orden.push(par);
    }
    pares[par].motivos.push(x.motivo);
  });
  return orden.map(function (par) { return pares[par]; });
}

function excluida_(s, de, a) {
  return s.exclusiones.some(function (e) { return e.de === de && e.a === a; });
}

function comoExclusiones_(propuestas) {
  return propuestas.reduce(function (lista, x) { return lista.concat({ de: x.de, a: x.a }, { de: x.a, a: x.de }); }, []);
}

/** Sin par indicado, acepta todas. */
function aceptarPropuesta_(s, pedido) {
  exigirAbierto_(s);
  elegirPropuestas_(s, pedido).forEach(function (x) {
    var motivos = motivosDe_(s, x.de, x.a);
    sumarExclusion_(s, x.de, x.a, motivos);
    sumarExclusion_(s, x.a, x.de, motivos);
  });
}

function descartarPropuesta_(s, pedido) {
  exigirAbierto_(s);
  elegirPropuestas_(s, pedido).forEach(function (x) { descartar_(s, x.de, x.a); });
}

function elegirPropuestas_(s, pedido) {
  var todas = propuestas_(s);
  if (!pedido.de) return todas;
  var par = clavePar_(String(pedido.de), String(pedido.a));
  var elegidas = todas.filter(function (x) { return clavePar_(x.de, x.a) === par; });
  if (!elegidas.length) throw aviso_('Esa propuesta ya no está. Actualizá la página.');
  return elegidas;
}

function descartar_(s, a, b) {
  var par = clavePar_(a, b);
  s.descartadas = s.descartadas || [];
  relaciones_(s).forEach(function (x) {
    if (clavePar_(x.a, x.b) === par && s.descartadas.indexOf(x.clave) === -1) s.descartadas.push(x.clave);
  });
}

/** Un descarte vale mientras exista la relación que lo originó. */
function limpiarDescartes_(s) {
  if (!s.propuestas) return;
  var vigentes = relaciones_(s).map(function (x) { return x.clave; });
  s.descartadas = (s.descartadas || []).filter(function (k) { return vigentes.indexOf(k) !== -1; });
}

/** Exclusiones aprobadas por una relación que ya no figura: se avisa, no se borran. */
function sinRelacion_(s) {
  if (!s.propuestas || s.estado !== 'abierto') return [];
  var vistos = {};
  return s.exclusiones.filter(function (e) {
    var par = clavePar_(e.de, e.a);
    if (!e.motivos || vistos[par]) return false;
    var actuales = motivosDe_(s, e.de, e.a);
    if (e.motivos.some(function (m) { return actuales.indexOf(m) !== -1; })) return false;
    vistos[par] = true;
    return true;
  }).map(function (e) { return { de: e.de, a: e.a, motivos: e.motivos }; });
}

/** La exclusión queda como decisión manual. */
function mantenerExclusion_(s, pedido) {
  exigirAbierto_(s);
  var par = clavePar_(String(pedido.de), String(pedido.a));
  s.exclusiones.forEach(function (e) { if (clavePar_(e.de, e.a) === par) delete e.motivos; });
}

function quitarPersona_(s, pedido) {
  exigirAbierto_(s);
  var p = buscarPersona_(s, pedido.persona);
  exigirSinNinos_(s, p);
  s.personas = s.personas.filter(function (x) { return x.id !== p.id; });
  s.exclusiones = s.exclusiones.filter(function (e) { return e.de !== p.id && e.a !== p.id; });
  s.especiales = (s.especiales || []).filter(function (e) { return e.de !== p.id && e.a !== p.id; });
  s.personas.forEach(function (x) {
    if (x.pareja === p.id) x.pareja = '';
    if (x.padres) x.padres = x.padres.filter(function (id) { return id !== p.id; });
  });
  limpiarDescartes_(s);
}

function agregarExclusion_(s, pedido) {
  exigirAbierto_(s);
  var de = buscarPersona_(s, pedido.de).id;
  var a = buscarPersona_(s, pedido.a).id;
  if (de === a) throw aviso_('Elegí dos personas distintas.');
  var motivos = s.propuestas ? motivosDe_(s, de, a) : [];
  sumarExclusion_(s, de, a, motivos);
  if (pedido.ambos === true) sumarExclusion_(s, a, de, motivos);
}

function sumarExclusion_(s, de, a, motivos) {
  var existe = s.exclusiones.some(function (e) { return e.de === de && e.a === a; });
  if (existe) return;
  var nueva = { de: de, a: a };
  if (motivos.length) nueva.motivos = motivos;
  s.exclusiones.push(nueva);
}

function quitarExclusion_(s, pedido) {
  exigirAbierto_(s);
  s.exclusiones = s.exclusiones.filter(function (e) {
    return !(e.de === pedido.de && e.a === pedido.a) && !(pedido.ambos === true && e.de === pedido.a && e.a === pedido.de);
  });
  // Quitar a mano es una decisión: no se vuelve a proponer.
  if (s.propuestas) descartar_(s, pedido.de, pedido.a);
}

function limpiarExclusiones_(s) {
  exigirAbierto_(s);
  s.exclusiones = [];
}

function corregirTelefono_(s, pedido) {
  var p = buscarPersona_(s, pedido.persona);
  if (p.responsable) throw aviso_('Esta persona está a cargo de un adulto.');
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
  // Cambia quién ocupa el lugar: no recibe nada de lo que cargó la persona anterior.
  p.mailPropuesto = '';
  p.deseos = '';
  s.personas.forEach(function (x) { if (x.responsable === p.id) x.deseos = ''; });
}

/* Corregir el mail de quien ya validó: lo propone quien organiza y lo confirma la propia
 * persona desde su acceso abierto. Sin esa confirmación no cambia nada. */

function proponerMail_(s, pedido) {
  var p = buscarPersona_(s, pedido.persona);
  if (!p.validada) throw aviso_('Todavía no validó: corregí el mail desde sus datos.');
  var mail = validarMail_(pedido.mail);
  if (!mail) throw aviso_('Completá el mail nuevo.');
  if (mail === p.mail) throw aviso_('Es el mismo mail que ya validó.');
  exigirMailDeNadie_(s, p, mail);
  p.mailPropuesto = mail;
}

function exigirMailDeNadie_(s, p, mail) {
  var otro = s.personas.some(function (x) { return x.id !== p.id && (x.mail === mail || x.correo === mail); });
  if (otro) throw aviso_('Ese mail ya corresponde a otro nombre de este sorteo.');
}

function confirmarMail_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaConToken_(s, pedido.token);
    if (!p.mailPropuesto || p.mailPropuesto !== pedido.mail) throw aviso_('Ese cambio de mail ya no está pendiente. Recargá la página.');
    exigirMailDeNadie_(s, p, p.mailPropuesto);
    p.mail = p.mailPropuesto;
    if (p.correo) p.correo = p.mailPropuesto;
    p.mailPropuesto = '';
    p.enlace = ''; // el link que llegó al mail anterior deja de servir
    return abrirSesion_(s, p);
  });
}

function rechazarMail_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaConToken_(s, pedido.token);
    p.mailPropuesto = '';
    guardar_(s);
    return {};
  });
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
    var sinRevisar = propuestas_(s).length;
    if (sinRevisar) throw aviso_('Hay ' + sinRevisar + (sinRevisar === 1 ? ' exclusión propuesta' : ' exclusiones propuestas') + ' sin revisar. Aceptalas o descartalas primero.');

    var parejas;
    try {
      parejas = repartirRegalos_(s, s.exclusiones);
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
      asunto: 'Tu PIN de yori',
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

/**
 * Ingreso con el mail: envía a ese mail los accesos que le correspondan. La respuesta es
 * siempre la misma, así nadie puede averiguar si un mail participa.
 */
function acceder_(pedido) {
  return conCandado_(function () {
    var mail = validarMail_(pedido.mail);
    if (!mail) throw aviso_('Completá tu mail.');
    contarEnvio_('acceso:' + huella_(mail), 1, MINUTOS_ENTRE_PINES * 60, 'Ya te enviamos tu acceso. Revisá tu mail o esperá ' + MINUTOS_ENTRE_PINES + ' minutos.');
    contarEnvio_('acceso:' + huella_(mail) + hoy_(), ACCESOS_POR_MAIL, 21600, 'Ya pediste tu acceso varias veces hoy. Usá el último mail.');
    exigirCupo_(1);
    var lista = [];
    var cambios = [];
    todos_().forEach(function (s) {
      var antes = lista.length;
      if (s.organizador.mail === mail) {
        var token = nuevoToken_();
        s.admins = (s.admins || []).concat(huella_(token)).slice(-5);
        lista.push({ texto: s.evento.nombre + ', que organizás', url: URL_APP + '#/a/' + s.id + '/' + token });
      }
      s.personas.forEach(function (p) {
        if (p.responsable) return;
        if (p.validada && p.mail === mail) {
          var envio = p.envio;
          lista.push({ texto: s.evento.nombre + ', como ' + p.nombre, url: URL_APP + '#/s/' + s.id + '/' + darLink_(p) });
          p.envio = envio;
        } else if (!p.validada && p.correo === mail) {
          lista.push({ texto: s.evento.nombre + ', como ' + p.nombre + '. Tu PIN:', destacado: darPin_(p), url: URL_APP + '#/g/' + s.id + '/' + p.id });
          p.envio = 'enviado';
        }
      });
      if (lista.length > antes) cambios.push(s);
    });
    if (!lista.length) return {};
    // Sin aviso propio: no debe distinguir si el mail participa.
    try { contarEnvio_('accesos:' + hoy_(), ACCESOS_POR_DIA, 21600, 'cupo de accesos'); } catch (error) { console.error(error); return {}; }
    cambios.forEach(guardar_);
    enviarMail_({
      para: mail,
      asunto: 'Tu acceso a yori',
      titulo: 'Hola',
      texto: 'Estos son tus accesos. Son privados: no los reenvíes. Si no los pediste, ignorá este mail.',
      lista: lista
    });
    return {};
  });
}

function personaLibre_(s, id) {
  var p = buscarPersona_(s, id);
  if (p.responsable) throw aviso_('Esta persona está a cargo de un adulto.');
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
      asunto: 'PIN de emergencia de yori',
      titulo: 'Hola, ' + s.organizador.nombre,
      texto: 'Este PIN permite ver el sorteo completo. Vence en ' + MINUTOS_PIN + ' minutos. Si no lo pediste, no lo uses ni lo compartas.',
      destacado: pin,
      boton: 'Ir a yori',
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
    return detalle_(s, mostrar_(s.parejas));
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
    evento: { nombre: s.evento.nombre, fecha: s.evento.fecha, presupuesto: s.evento.presupuesto, mensaje: s.evento.mensaje, modalidad: s.evento.modalidad },
    sorteado: s.estado === 'sorteado',
    regala: regala_(s, p),
    aCargo: s.personas.filter(function (x) { return x.responsable === p.id; }).map(function (x) {
      return { persona: x.id, nombre: x.nombre, deseos: textoDeseos_(x), lista: leerLista_(x.deseos), regala: regala_(s, x) };
    }),
    // Los especiales adicionales no son sorpresa para quien los da.
    especiales: s.estado !== 'sorteado' ? [] : regalosDe_(s, {}, p.id).map(function (x) { return verRegalo_(s, x); }),
    reinicio: p.reinicio || '',
    mailPropuesto: p.mailPropuesto || '',
    editable: hoy_() <= s.evento.fecha,
    puedeSumarHijos: p.tipo === 'adulto',
    deseos: textoDeseos_(p),
    lista: leerLista_(p.deseos)
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
  if (otra.responsable !== yo.id) throw aviso_('Esta persona no está a tu cargo.');
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
    return regalosDe_(s, mostrar_(s.parejas), p.id).filter(function (x) { return !x.aparte; }).map(function (x) {
      return verRegalo_(s, x);
    });
  });
}

function verRegalo_(s, x) {
  var otra = buscarPersona_(s, x.a);
  return { nombre: otra.nombre, especial: x.especial, deseos: textoDeseos_(otra), pistas: pistasDe_(otra) };
}

/** Formato anterior, de un solo texto: se conserva para páginas que quedaron abiertas. */
function guardarDeseos_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
    if (p.deseos && typeof p.deseos === 'object') throw aviso_('Recargá la página para editar tu lista de deseos.');
    exigirEditable_(s);
    var texto = validarTexto_(pedido.deseos, MAX_TEXTO_PERFIL);
    var achica = texto.length <= textoDeseos_(p).length;
    p.deseos = texto;
    if (achica) guardar_(s); else guardarConReserva_(s);
    return {};
  });
}

/* ---------- Lista de deseos ---------- */

// Se guarda en persona.deseos: { compartir, talles, gustos, preferencias, recibir, evitar, pistas, personajes, hijos }.
// Los hijos viven acá y nunca en s.personas, que es lo único que recibe el sorteo.

var TALLES_ = ['superior', 'inferior', 'calzado', 'otro'];
var TEXTOS_ = ['preferencias', 'recibir', 'evitar', 'pistas', 'personajes'];

/** Acepta el texto anterior, el objeto nuevo y datos vacíos o incompletos. */
function leerLista_(valor) {
  if (typeof valor === 'string') return leerPerfil_(valor ? { recibir: valor } : {}, true);
  return leerPerfil_(valor, true);
}

function leerPerfil_(valor, conHijos) {
  var x = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
  var talles = x.talles && typeof x.talles === 'object' ? x.talles : {};
  // Solo true comparte. Los registros anteriores al campo se siguen leyendo como compartidos.
  var perfil = { compartir: x.compartir === undefined || x.compartir === true, talles: {}, gustos: [] };
  TALLES_.forEach(function (t) { perfil.talles[t] = texto_(talles[t]); });
  if (Array.isArray(x.gustos)) perfil.gustos = x.gustos.map(texto_).filter(String);
  TEXTOS_.forEach(function (t) { perfil[t] = texto_(x[t]); });
  if (conHijos) {
    perfil.hijos = (Array.isArray(x.hijos) ? x.hijos : []).filter(function (h) { return h && h.id; }).map(function (h) {
      var hijo = leerPerfil_(h, false);
      hijo.id = texto_(h.id);
      hijo.nombre = texto_(h.nombre);
      return hijo;
    });
  }
  return perfil;
}

function texto_(valor) {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';
}

function textoDeseos_(p) {
  return typeof p.deseos === 'string' ? p.deseos : '';
}

/** Lo que ve quien regala: solo perfiles compartidos y bloques completos. */
function pistasDe_(p) {
  var lista = leerLista_(p.deseos);
  return [lista].concat(lista.hijos).filter(function (x) { return x.compartir; }).map(function (x) {
    var visible = { hijo: x.nombre || '' };
    var talles = {};
    TALLES_.forEach(function (t) { if (x.talles[t]) talles[t] = x.talles[t]; });
    if (Object.keys(talles).length) visible.talles = talles;
    if (x.gustos.length) visible.gustos = x.gustos;
    TEXTOS_.forEach(function (t) { if (x[t]) visible[t] = x[t]; });
    return visible;
  }).filter(function (x) { return Object.keys(x).length > 1; });
}

/** Guarda un solo perfil: el propio, o el de un hijo que no participa ("nuevo" lo crea). */
function guardarPerfil_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
    exigirEditable_(s);
    var lista = leerLista_(p.deseos);
    var perfil = validarPerfil_(pedido.datos);
    var achica = false;
    if (!pedido.perfil) {
      conservar_(perfil, lista, pedido.datos);
      achica = largoPerfil_(perfil) <= largoPerfil_(lista);
      perfil.hijos = lista.hijos;
      lista = perfil;
    } else {
      if (p.tipo !== 'adulto') throw aviso_('Solo un adulto puede sumar menores a cargo.');
      perfil.nombre = validarNombre_(pedido.nombre);
      if (pedido.perfil === 'nuevo') {
        if (lista.hijos.length >= MAX_HIJOS) throw aviso_('El máximo es de ' + MAX_HIJOS + ' menores a cargo.');
        exigirHijoLibre_(s, p, perfil.nombre);
        perfil.id = 'h' + nuevoToken_().slice(0, 8);
        lista.hijos.push(perfil);
      } else {
        var lugar = lugarDeHijo_(lista, pedido.perfil);
        if (perfil.nombre !== lista.hijos[lugar].nombre) exigirHijoLibre_(s, p, perfil.nombre);
        perfil.id = lista.hijos[lugar].id;
        conservar_(perfil, lista.hijos[lugar], pedido.datos);
        achica = largoPerfil_(perfil) <= largoPerfil_(lista.hijos[lugar]);
        lista.hijos[lugar] = perfil;
      }
    }
    p.deseos = lista;
    if (achica) guardar_(s); else guardarConReserva_(s);
    return { perfil: perfil.id || '' };
  });
}

/** Una página abierta antes de existir un dato no lo envía: no se borra. */
function conservar_(perfil, anterior, datos) {
  if (datos && datos.personajes === undefined) perfil.personajes = anterior.personajes;
}

function quitarPerfil_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
    exigirEditable_(s);
    var lista = leerLista_(p.deseos);
    lista.hijos.splice(lugarDeHijo_(lista, pedido.perfil), 1);
    p.deseos = lista;
    guardar_(s);
    return {};
  });
}

/** Revocar es privacidad: no depende de la fecha ni del espacio. No edita nada más. */
function dejarDeCompartir_(pedido) {
  return conCandado_(function () {
    var s = abrir_(pedido.id);
    var p = personaPedida_(s, pedido);
    var lista = leerLista_(p.deseos);
    (pedido.perfil ? lista.hijos[lugarDeHijo_(lista, pedido.perfil)] : lista).compartir = false;
    p.deseos = lista;
    guardar_(s);
    return {};
  });
}

/** Tamaño del contenido, sin contar el permiso de compartir ni los perfiles de hijos. */
function largoPerfil_(x) {
  return JSON.stringify([x.nombre || '', x.talles, x.gustos, x.preferencias, x.recibir, x.evitar, x.pistas, x.personajes]).length;
}

function tieneLista_(p) {
  if (!p.deseos) return false;
  var lista = leerLista_(p.deseos);
  return lista.hijos.length > 0 || largoPerfil_(lista) > largoPerfil_(leerPerfil_({}, false));
}

/**
 * El primer progenitor que incorpora a un niño es su único responsable: ni su pareja ni
 * el otro progenitor pueden incorporarlo de nuevo. No se muestra quién lo gestiona.
 */
function exigirHijoLibre_(s, p, nombre) {
  var igual = function (x) { return x.toLowerCase() === nombre.toLowerCase(); };
  var propios = s.personas.filter(function (x) { return x.responsable === p.id || (x.padres || []).indexOf(p.id) !== -1; });
  if (propios.some(function (x) { return igual(x.nombre); })) throw aviso_(nombre + ' ya participa del sorteo y tiene un responsable.');
  var vinculados = [p.pareja].concat(propios.reduce(function (l, x) { return l.concat(x.padres || []); }, []));
  var repetido = s.personas.some(function (x) {
    return x.id !== p.id && vinculados.indexOf(x.id) !== -1 && leerLista_(x.deseos).hijos.some(function (h) { return igual(h.nombre); });
  });
  if (repetido) throw aviso_(nombre + ' ya fue incorporado por otra persona, que es su responsable.');
}

function lugarDeHijo_(lista, id) {
  for (var i = 0; i < lista.hijos.length; i++) {
    if (lista.hijos[i].id === id) return i;
  }
  throw aviso_('Ese perfil ya no existe. Recargá la página.');
}

function validarPerfil_(datos) {
  var perfil = leerPerfil_(datos, false);
  perfil.compartir = !!datos && datos.compartir === true;
  TALLES_.forEach(function (t) { if (perfil.talles[t].length > 30) throw aviso_('Cada talle admite hasta 30 caracteres.'); });
  if (perfil.gustos.length > MAX_GUSTOS) throw aviso_('Elegí hasta ' + MAX_GUSTOS + ' gustos.');
  perfil.gustos.forEach(function (g) { if (g.length > 30) throw aviso_('Cada gusto admite hasta 30 caracteres.'); });
  var largo = TEXTOS_.reduce(function (suma, t) { return suma + perfil[t].length; }, 0);
  if (largo > MAX_TEXTO_PERFIL) throw aviso_('Los textos suman ' + largo + ' caracteres y el máximo es ' + MAX_TEXTO_PERFIL + '. No se guardó: acortá alguno.');
  return perfil;
}

function exigirEditable_(s) {
  if (hoy_() > s.evento.fecha) throw aviso_('El encuentro ya pasó: la lista no se puede editar.');
}

/** Las listas nunca ocupan el espacio que necesitan el sorteo y los accesos. */
function guardarConReserva_(s) {
  if (JSON.stringify(s).length > MAX_DATOS - 5000 - 100 * s.personas.length) {
    throw aviso_('Este sorteo no tiene más espacio para listas de deseos. No se guardó este cambio; lo anterior sigue igual.');
  }
  guardar_(s);
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
  var h = huella_(pedido.token);
  if (s.admin !== h && (s.admins || []).indexOf(h) === -1) throw sinAcceso_('Este link no es válido.');
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
        asunto: sorteado ? 'Ya se hizo el Sorteo Navideño' : envio.pin ? 'Te invitaron a un Sorteo Navideño' : 'Tu link de yori',
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
  var accesos = m.lista || [{ destacado: m.destacado, texto: '', boton: m.boton, url: m.url }];
  var opciones = {
    to: m.para,
    subject: m.asunto,
    name: m.de ? m.de + ' (yori)' : 'yori',
    body: m.titulo + '\n\n' + m.texto + '\n\n' + accesos.map(function (x) {
      return (x.texto ? x.texto + '\n' : '') + (x.destacado ? x.destacado + '\n\n' : '') + (x.boton || 'Entrar') + ': ' + x.url;
    }).join('\n\n') + '\n\nyori · Powered by GIWA',
    htmlBody:
      '<div style="font-family:Montserrat,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a;font-size:15px;line-height:1.6">' +
      '<p style="font-size:18px;font-weight:600;margin:0 0 16px">' + escapar_(m.titulo) + '</p>' +
      '<p style="margin:0 0 24px">' + escapar_(m.texto) + '</p>' +
      accesos.map(function (x) {
        return (x.texto ? '<p style="margin:0 0 10px">' + escapar_(x.texto) + '</p>' : '') +
          (x.destacado ? '<p style="margin:0 0 20px;font-family:Courier New,monospace;font-size:30px;letter-spacing:4px">' + escapar_(x.destacado) + '</p>' : '') +
          '<p style="margin:0 0 28px"><a href="' + escapar_(x.url) + '" style="background:#4b4be0;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:12px;display:inline-block">' + escapar_(x.boton || 'Entrar') + '</a></p>';
      }).join('') +
      '<p style="margin:0;font-size:11px;color:#4a5875">yori · Powered by GIWA</p></div>'
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

function todos_() {
  var hoja = hoja_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  return hoja.getRange(2, 3, ultima - 1, 1).getValues().map(function (f) { return JSON.parse(f[0]); });
}

function guardar_(s) {
  var datos = JSON.stringify(s);
  if (datos.length > MAX_DATOS) throw aviso_('El sorteo tiene demasiados datos. Acortá las listas de deseos.');
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
  if (!candado.tryLock(20000)) throw aviso_('Hay muchas personas usando la app. Probá de nuevo en unos segundos.');
  try {
    return tarea();
  } finally {
    candado.releaseLock();
  }
}
