'use strict';

/* ---------- Base ---------- */

const raiz = document.getElementById('app');
let turno = 0; // evita que una pantalla vieja pise a la nueva

/** Crea un elemento. Los números del texto van siempre con su tipografía. */
function h(etiqueta, atributos, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (hijo instanceof Node) el.append(hijo);
    else if (etiqueta === 'option' || etiqueta === 'textarea') el.append(String(hijo));
    else {
      for (const parte of String(hijo).split(/((?:\$ )?\d(?:[\d.,:/]*\d)?)/)) {
        if (!parte) continue;
        if (/^(\$ )?\d/.test(parte)) {
          const n = document.createElement('span');
          n.className = 'num';
          n.textContent = parte;
          el.append(n);
        } else el.append(parte);
      }
    }
  }
  return el;
}

/** Dibujos propios y fijos (marca.js, tema.js): nunca contenido cargado por personas. */
function dibujo(clase, svg) {
  const el = h('span', { class: clase });
  el.innerHTML = svg;
  return el;
}

/* ---------- Pantallas ---------- */

const imagen = (clase, src, estilo) => h('img', { class: clase, src, alt: '', style: estilo });
const icono = (nombre) => dibujo('icono', ICONOS[nombre]);
const marca = () => h('a', { class: 'marca', href: sesiones.length ? '#/portal' : '#/' }, dibujo('', MARCA.simbolo), MARCA.nombre);
const marcaNavidad = () => {
  const el = marca();
  if (NAVIDAD.decoracion) el.append(imagen('estrella', NAVIDAD.estrella), imagen('estrella', NAVIDAD.estrella));
  return el;
};
const pie = () => h('footer', { class: 'pie' }, MARCA.firma);
const copos = () => NAVIDAD.decoracion
  ? [[22, 8, 0, 14], [14, 24, 4, 18], [26, 41, 9, 16], [16, 58, 2, 20], [24, 76, 12, 14], [15, 91, 7, 17]]
    .map(([ancho, x, antes, dura]) => imagen('copo', NAVIDAD.copo, `width:${ancho}px;left:${x}%;animation-delay:-${antes}s;animation-duration:${dura}s`))
  : null;

function montar(...partes) {
  document.querySelectorAll('dialog').forEach((d) => d.remove());
  raiz.replaceChildren(...partes.flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
}

/** Ficha centrada, con la identidad general. */
function mostrar(...hijos) {
  montar(h('header', { class: 'barra' }, marca()), h('main', { class: 'centro' }, h('div', { class: 'ficha vidrio entra' }, hijos)), pie());
}

/** Ficha centrada, con la ambientación de la experiencia. */
function mostrarNavidad(titulo, bajada, ...hijos) {
  montar(copos(), h('header', { class: 'barra' }, marcaNavidad()),
    h('main', { class: 'centro' },
      NAVIDAD.decoracion ? imagen('flota', NAVIDAD.regalo) : null,
      h('div', { class: 'ficha vidrio entra' }, h('div', {}, h('h1', {}, titulo), bajada ? h('p', { class: 'suave' }, bajada) : null), hijos)),
    pie());
}

/** Menú lateral y contenido. */
function conMenu(clase, menu, ...hijos) {
  montar(h('div', { class: 'marco vidrio entra' },
    h('aside', { class: 'lado ' + clase }, marca(), menu, h('p', { class: 'firma' }, MARCA.firma)),
    h('main', { class: 'cont' }, hijos)));
}
const itemMenu = (nombre, texto, atributos) =>
  h(atributos.href ? 'a' : 'button', { class: 'item', 'aria-label': texto, ...(atributos.href ? {} : { type: 'button' }), ...atributos }, icono(nombre), h('span', {}, texto));

/** Ventana sobre la pantalla. Se cierra con la cruz o con Escape. */
function ventana(titulo, ...hijos) {
  const d = h('dialog', { class: 'ventana', 'aria-label': titulo },
    h('header', {}, h('h2', {}, titulo), h('button', { type: 'button', class: 'cruz', 'aria-label': 'Cerrar', onclick: () => d.close() }, icono('cerrar'))), hijos);
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

/** Opciones excluyentes: guarda el valor en un campo oculto del formulario. */
function segmento(nombre, opciones, valor, alCambiar) {
  const campoOculto = h('input', { type: 'hidden', name: nombre, value: valor });
  const botones = opciones.map(([v, texto, dib]) => h('button', {
    type: 'button', 'aria-pressed': String(v === valor), onclick: () => {
      campoOculto.value = v;
      botones.forEach((b, i) => b.setAttribute('aria-pressed', String(opciones[i][0] === v)));
      alCambiar(v);
    }
  }, dib ? icono(dib) : null, texto));
  return h('div', { class: 'seg', role: 'group' }, botones, campoOculto);
}

function llave(texto, activa, alCambiar) {
  const b = h('button', {
    type: 'button', class: 'llave', role: 'switch', 'aria-checked': String(activa), onclick: () => {
      activa = !activa;
      b.setAttribute('aria-checked', String(activa));
      alCambiar(activa, b);
    }
  }, h('i'), h('span', {}, texto));
  return b;
}

function rafaga() {
  if (!NAVIDAD.decoracion) return null;
  return h('div', { class: 'rafaga' }, Array.from({ length: 12 }, (_, i) =>
    imagen('', NAVIDAD.estrella, `--x:${Math.round(Math.cos(i * Math.PI / 6) * (120 + i % 3 * 30))}px;--y:${Math.round(Math.sin(i * Math.PI / 6) * (90 + i % 2 * 30))}px`)));
}

/** Destellos y copos que caen una sola vez, al sortear. */
function festejo() {
  if (!NAVIDAD.decoracion) return;
  const el = h('div', { class: 'festejo' }, Array.from({ length: 28 }, (_, i) =>
    imagen('', i % 3 ? NAVIDAD.estrella : NAVIDAD.copo, `left:${(i * 37) % 100}%;width:${12 + i % 4 * 5}px;animation-delay:${(i % 7) / 6}s`)));
  document.body.append(el);
  setTimeout(() => el.remove(), 4200);
}

async function pedir(accion, datos) {
  let respuesta;
  try {
    // text/plain evita la consulta previa de CORS, que Apps Script no responde.
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...datos })
    });
    respuesta = await r.json();
  } catch {
    throw new Error('No se pudo conectar. Revisá tu conexión y probá de nuevo.');
  }
  if (!respuesta.ok) {
    const error = new Error(respuesta.error);
    error.sinAcceso = respuesta.sinAcceso;
    throw error;
  }
  return respuesta.datos;
}

/** Zona de avisos de un formulario o sección. */
function zonaAviso() {
  const el = h('p', { class: 'chico', role: 'status', hidden: true });
  el.decir = (texto, clase) => {
    el.className = 'chico ' + (clase || '');
    el.textContent = texto || '';
    el.hidden = !texto;
  };
  return el;
}

/** Ejecuta una acción con el botón bloqueado y muestra el error si falla. */
async function ejecutar(boton, aviso, tarea) {
  if (boton.disabled) return;
  boton.disabled = true;
  aviso.decir('');
  try {
    await tarea();
  } catch (error) {
    aviso.decir(error.message, 'rojo');
  } finally {
    boton.disabled = false;
  }
}

function formulario(aviso, alEnviar, ...hijos) {
  const form = h('form', {
    novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      ejecutar(form.querySelector('button[type=submit]'), aviso, () => alEnviar(Object.fromEntries(new FormData(form))));
    }
  }, ...hijos);
  return form;
}

const campo = (texto, control) => h('label', { class: 'campo' }, texto, control);
const enviar = (texto) => h('button', { type: 'submit', class: 'boton' }, texto);
const enlace = (texto, alTocar) => h('button', { type: 'button', class: 'enlace', onclick: alTocar }, texto);
const opcion = (atributos, ...texto) => h('label', { class: 'opcion' }, h('input', atributos), h('span', {}, ...texto));
const selector = (atributos, opciones, elegido) =>
  h('select', atributos, opciones.map(([v, t]) => h('option', { value: v, selected: v === elegido }, t)));

const fechaCorta = (f) => f.slice(0, 10).split('-').reverse().join('/');
const importe = (n) => '$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fechaDe = (f) => new Date(f + 'T12:00:00');
const parteFecha = (f, opciones) => new Intl.DateTimeFormat('es-AR', opciones).format(fechaDe(f));
const linkGrupo = (id) => location.href.split('#')[0] + '#/g/' + id;

/* ---------- Accesos recordados en este dispositivo ---------- */

let sesiones = [];
try { sesiones = JSON.parse(localStorage.getItem('amigo-invisible') || '[]'); } catch { /* sin memoria */ }

function recordar(sesion) {
  sesiones = sesiones.filter((s) => !(s.id === sesion.id && s.persona === sesion.persona)).concat(sesion);
  guardarSesiones();
}
function olvidar(id, persona) {
  sesiones = sesiones.filter((s) => !(s.id === id && s.persona === persona));
  guardarSesiones();
}
function guardarSesiones() {
  try { localStorage.setItem('amigo-invisible', JSON.stringify(sesiones)); } catch { /* sin memoria */ }
}

/* ---------- Rutas ---------- */

function ir(ruta) {
  if (location.hash === ruta) navegar();
  else location.hash = ruta;
}

async function navegar() {
  const mio = ++turno;
  const vigente = () => mio === turno;
  const [, ruta, id, extra] = location.hash.split('/');
  try {
    if (ruta === 'a') await pantallaAdmin(id, extra, vigente);
    else if (ruta === 'g') await pantallaGrupo(id, extra, vigente);
    else if (ruta === 's') await abrirLink(id, extra, vigente);
    else if (ruta === 'm') await pantallaRegalo(id, extra, vigente);
    else if (ruta === 'navidad') pantallaNavidad();
    else if (ruta === 'crear') pantallaCrear();
    else if (ruta === 'portal' || (!ruta && location.hash !== '#/' && sesiones.length)) pantallaPortal();
    else pantallaIngreso();
  } catch (error) {
    if (!vigente()) return;
    mostrar(
      h('h1', {}, 'No pudimos entrar'),
      h('p', {}, error.message),
      error.sinAcceso
        ? h('p', { class: 'suave' }, 'Si entrabas con el link de tu mail, pedí uno nuevo con tu mail.')
        : h('button', { type: 'button', class: 'boton', onclick: navegar }, 'Reintentar'),
      error.sinAcceso ? h('a', { class: 'boton', href: '#/' }, 'Entrar con mi mail') : null
    );
  }
}
window.addEventListener('hashchange', navegar);

function cargando() { mostrar(h('p', { class: 'suave' }, 'Cargando…')); }

/* ---------- Ingreso y portal ---------- */

function pantallaIngreso() {
  const aviso = zonaAviso();
  const zona = h('div', { class: 'grupo' }, formulario(aviso, async (d) => {
    await pedir('acceder', { mail: d.mail });
    zona.replaceChildren(h('p', { class: 'entra' }, 'Listo. Si ese mail participa de un sorteo, te llega tu acceso.'), h('p', { class: 'suave chico' }, 'Si no lo ves, buscalo en correo no deseado.'));
  },
    campo('Tu mail', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'email', placeholder: 'nombre@mail.com' })),
    aviso, enviar('Entrar'),
    h('p', { class: 'suave chico' }, 'Te llega tu acceso. Sin claves para recordar.')));
  montar(h('main', { class: 'centro' },
    h('div', { class: 'bienvenida entra' }, imagen('flor', 'img/flor.svg'), h('b', {}, MARCA.nombre), h('p', { class: 'suave' }, MARCA.lema)),
    h('div', { class: 'ficha vidrio entra e2' },
      h('h1', {}, 'Hola, qué bueno verte'),
      zona,
      h('div', { class: 'raya' }, h('span', { class: 'suave' }, '¿Organizás vos?'), h('a', { class: 'enlace', href: '#/crear' }, 'Crear un sorteo')),
      sesiones.length ? h('a', { class: 'enlace', href: '#/portal', style: 'align-self: flex-start' }, 'Ver mis sorteos') : null)),
    pie());
}

const PROXIMAS = [['torta', 'Cumpleaños'], ['personas', 'Familia'], ['copa', 'Amigos'], ['valija', 'Compañeros']];

function pantallaPortal() {
  conMenu('',
    h('nav', { 'aria-label': 'Principal' },
      itemMenu('inicio', 'Inicio', { href: '#/portal', 'aria-current': 'page' }),
      itemMenu('especiales', 'Navidad', { href: '#/navidad' })),
    h('div', {},
      h('div', {}, h('h1', {}, 'Navidad'), h('p', { class: 'suave', style: 'margin-top: 4px' }, 'Con tu familia, tus amigos o tus compañeros.')),
      h('a', { class: 'destacada entra e2', href: '#/navidad' },
        h('div', {}, h('h2', {}, 'Navidad'), h('p', {}, NAVIDAD.titulo), h('span', { class: 'blanco' }, 'Entrar')),
        imagen('flor', 'img/flor.svg'),
        NAVIDAD.decoracion ? [imagen('estrella', NAVIDAD.estrella, 'width:18px;right:212px;top:30px'), imagen('estrella', NAVIDAD.estrella, 'width:13px;right:44px;top:34px;animation-delay:.9s'), imagen('estrella', NAVIDAD.estrella, 'width:16px;right:30px;bottom:44px;animation-delay:1.7s')] : null),
      h('div', { class: 'partes entra e3' },
        h('div', {}, h('h3', {}, 'Mis sorteos'),
          sesiones.length
            ? sesiones.map((s) => h('a', { class: 'fila', href: s.admin ? `#/a/${s.id}/${s.token}` : `#/m/${s.id}/${s.persona}` },
              h('span', {}, s.encuentro || 'Amigo Invisible'),
              h('span', { class: 'suave' }, h('span', {}, s.admin ? 'Organizás' : s.nombre), s.fecha ? h('span', {}, fechaCorta(s.fecha)) : null, icono('seguir'))))
            : h('a', { class: 'enlace', href: '#/' }, 'Entrar con mi mail')),
        h('div', {}, h('h3', {}, 'Próximamente'),
          h('div', { class: 'dos' }, PROXIMAS.map(([dib, texto]) => h('div', { class: 'prox' }, icono(dib), texto)))))));
}

/* ---------- Navidad ---------- */

function proximaFecha() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  return (new Date(`${anio}-${NAVIDAD.fecha}T23:59:59`) >= hoy ? anio : anio + 1) + '-' + NAVIDAD.fecha;
}

function pantallaNavidad() {
  const estrella = (estilo) => imagen('estrella', NAVIDAD.estrella, estilo);
  montar(copos(),
    h('header', { class: 'barra' }, marcaNavidad(), h('a', { class: 'enlace', href: '#/portal' }, 'Inicio')),
    h('main', { class: 'portada' },
      h('div', { class: 'entra' },
        h('h1', {}, NAVIDAD.titulo),
        h('p', {}, NAVIDAD.frase),
        h('div', { class: 'acciones' }, h('a', { class: 'boton', href: '#/crear' }, 'Crear sorteo'), h('a', { class: 'segundo', href: '#/' }, 'Ya tengo uno'))),
      NAVIDAD.decoracion ? h('div', { class: 'regalos entra e2' },
        imagen('flota', NAVIDAD.regaloAzul), imagen('flota', NAVIDAD.regalo),
        estrella('width:26px;right:18%;top:6%'), estrella('width:16px;right:2%;top:30%;animation-delay:.8s'), estrella('width:18px;left:-2%;bottom:14%;animation-delay:1.6s')) : null));
}

function avisoPrivacidad() {
  ventana('Aviso de privacidad',
    h('p', {}, 'Guardamos solo los nombres, teléfonos, mails y listas de deseos que se carguen, y los usamos únicamente para este sorteo. Los mails se envían a través de Google. La fila del sorteo se elimina de la planilla 30 días después del evento.'),
    h('p', {}, 'Quien organiza ve con qué mail entró cada persona y quién ya vio su regalo. En una emergencia, puede ver el sorteo completo.'),
    h('p', {}, 'Cargá solo a personas que estén de acuerdo. De los niños, alcanza con el nombre de pila.'));
}

function pantallaCrear() {
  const aviso = zonaAviso();
  const encuentro = h('input', { name: 'encuentro', maxlength: 60, autocomplete: 'off', value: 'Navidad en familia' });
  const fecha = h('input', { class: 'num', type: 'date', name: 'fecha', value: proximaFecha() });
  const resumen = h('span');
  const mostrarResumen = () => resumen.replaceChildren(...h('p', {}, `${encuentro.value || 'Navidad en familia'} `, h('span', { class: 'suave' }, fecha.value ? fechaCorta(fecha.value) : '')).childNodes);
  mostrarResumen();
  const datos = h('div', { class: 'plegado', hidden: true }, campo('Nombre del encuentro', encuentro), campo('Fecha', fecha));
  const cambiar = enlace('Cambiar', () => {
    datos.hidden = !datos.hidden;
    cambiar.textContent = datos.hidden ? 'Cambiar' : 'Listo';
    mostrarResumen();
  });
  montar(copos(),
    h('header', { class: 'barra' }, marcaNavidad(), h('a', { class: 'enlace', href: '#/navidad' }, 'Volver')),
    h('main', { class: 'centro' },
      NAVIDAD.decoracion ? imagen('flota', NAVIDAD.regalo) : null,
      h('div', { class: 'ficha vidrio entra' },
        h('h1', {}, 'Creá tu Amigo Invisible'),
        formulario(aviso, async (d) => {
          await pedir('crear', { ...d, modalidad: 'B', acepta: d.acepta === 'on' });
          mostrarNavidad('Revisá tu mail', null,
            h('p', {}, 'Te enviamos tu acceso a ', d.mail.trim(), '. Abrilo para sumar a los participantes y sortear.'),
            h('p', { class: 'suave chico' }, 'Si no llega, buscalo en correo no deseado.'));
        },
          campo('Tu nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'name' })),
          campo('Tu mail', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'email' })),
          h('div', { class: 'cab' }, resumen, cambiar),
          datos,
          h('div', { class: 'acciones', style: 'gap: 0 6px' }, opcion({ type: 'checkbox', name: 'acepta' }, 'Acepto el'), h('button', { type: 'button', class: 'enlace chico', onclick: avisoPrivacidad }, 'aviso de privacidad')),
          aviso,
          enviar('Crear sorteo')))),
    pie());
}

/* ---------- Quien organiza ---------- */

const regalosEnTexto = (x) => [
  x.regalaA.length ? 'le regala a ' + x.regalaA.join(' y ') : '',
  x.especiales.length ? h('span', { class: 'violeta' }, (x.regalaA.length ? ' · ' : '') + 'Especial: ' + x.especiales.join(' y ')) : null];
const listaSorteo = (lista) => h('div', {}, lista.map((x) => h('div', { class: 'suma' }, h('span', {}, x.nombre), h('span', {}, regalosEnTexto(x)))));

async function pantallaAdmin(id, token, vigente) {
  cargando();
  let s = await pedir('admin', { id, token });
  if (!vigente()) return;
  const recordarme = () => recordar({ id, persona: 'admin', admin: true, token, encuentro: s.evento.nombre, fecha: s.evento.fecha });
  recordarme();

  let cola = Promise.resolve(); // las acciones van de a una, en orden
  const pedirAdmin = (accion, datos) => {
    const turnoEnCola = cola.then(() => pedir(accion, { id, token, ...datos }));
    cola = turnoEnCola.catch(() => {});
    return turnoEnCola;
  };
  let eventoSinGuardar = '';
  const SECCIONES = [['resumen', 'Resumen', 'resumen'], ['participantes', 'Participantes', 'personas'], ['familias', 'Familias', 'familias'], ['exclusiones', 'Exclusiones', 'exclusiones'], ['especiales', 'Especiales', 'especiales'], ['evento', 'Evento', 'evento']];
  const zonas = Object.fromEntries(SECCIONES.map(([z]) => [z, h('div')]));
  const botones = {};
  function ver(cual) {
    for (const z in zonas) {
      zonas[z].hidden = z !== cual;
      if (z === cual) botones[z].setAttribute('aria-current', 'page'); else botones[z].removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
  }
  const abierto = () => s.estado === 'abierto';
  const nombreDe = (pid) => s.personas.find((p) => p.id === pid)?.nombre || '';
  const adultos = () => s.personas.filter((p) => p.tipo === 'adulto');
  const regala = (p) => s.evento.modalidad === 'A' || p.tipo === 'adulto';

  async function cambiar(accion, datos) {
    const antes = s.estado;
    s = await pedirAdmin(accion, datos);
    if (!vigente()) return;
    fallaMatriz = '';
    pintar(antes !== s.estado);
  }

  function pintar(todo) {
    if (todo) pintarEvento();
    pintarParticipantes();
    pintarFamilias();
    pintarExclusiones();
    pintarEspeciales();
    pintarResumen();
  }

  function pintarEvento() {
    const e = s.evento;
    const aviso = zonaAviso();
    const guardar = async () => {
      const d = Object.fromEntries(new FormData(form));
      try {
        aviso.decir('Guardando…', 'suave');
        s = await pedirAdmin('guardarEvento', d);
        eventoSinGuardar = '';
        if (s.evento.presupuesto !== null) form.presupuesto.value = s.evento.presupuesto.toFixed(2);
        aviso.decir('Guardado', 'verde');
        recordarme();
        pintar(false);
      } catch (error) {
        eventoSinGuardar = error.message;
        aviso.decir(error.message, 'rojo');
      }
    };
    const form = h('form', { style: 'max-width: 560px', onsubmit: (ev) => ev.preventDefault(), onchange: guardar },
      campo('Nombre del encuentro', h('input', { name: 'encuentro', maxlength: 60, autocomplete: 'off', value: e.nombre })),
      h('div', { class: 'dos' },
        campo('Fecha', h('input', { class: 'num', type: 'date', name: 'fecha', value: e.fecha })),
        campo('Presupuesto (opcional)', h('input', { class: 'num', type: 'number', name: 'presupuesto', min: 0, step: '0.01', inputmode: 'decimal', value: e.presupuesto === null ? '' : e.presupuesto.toFixed(2) }))),
      campo('Mensaje (opcional)', h('textarea', { name: 'mensaje', maxlength: 300, value: e.mensaje })),
      h('fieldset', {},
        h('legend', {}, 'Cómo se reparten los regalos'),
        opcion({ type: 'radio', name: 'modalidad', value: 'B', checked: e.modalidad === 'B' }, 'Cada adulto regala a un adulto y a un niño'),
        opcion({ type: 'radio', name: 'modalidad', value: 'A', checked: e.modalidad === 'A' }, 'Adultos entre sí y niños entre sí')),
      aviso);
    zonas.evento.replaceChildren(h('h1', {}, 'Evento'), abierto() ? form : datosEvento(e));
  }

  /* ---------- Participantes ---------- */

  function sinValidar(p) {
    if (p.envio === 'error') return ['No se pudo enviar el mail', 'rojo'];
    if (p.envio === 'enviado') return ['Invitación enviada', 'ambar'];
    return [p.correo ? 'Falta invitar' : 'Todavía no entró', 'ambar'];
  }

  function estadoPersona(p) {
    if (p.responsable && !(regala(p) && !abierto())) return ['A cargo de ' + nombreDe(p.responsable), 'suave'];
    if (!abierto()) {
      if (regala(p) && p.vio) return ['Vio su regalo', 'verde'];
      if (p.responsable) return ['Todavía no se vio su regalo', 'ambar'];
      if (!p.validada) return sinValidar(p);
      if (p.envio === 'error') return ['No se pudo enviar el link', 'rojo'];
      return regala(p) ? ['Todavía no vio su regalo', 'ambar'] : ['Entró', 'verde'];
    }
    return p.validada ? ['Entró', 'verde'] : sinValidar(p);
  }

  const entro = (p) => p.responsable ? !!s.personas.find((x) => x.id === p.responsable)?.validada : !!p.validada;

  /** Datos completos de una persona y qué se puede hacer con ella. */
  function verPersona(p) {
    const aviso = zonaAviso();
    const [estado, clase] = estadoPersona(p);
    const dato = (titulo, valor) => valor ? [h('dt', {}, titulo), h('dd', {}, valor)] : [];
    const accion = (texto, pregunta, cual) => enlace(texto, (ev) => {
      if (pregunta && !confirm(pregunta)) return;
      ejecutar(ev.target, aviso, async () => {
        await cambiar(cual, { persona: p.id });
        d.close();
      });
    });
    const abrir = (texto, otra) => enlace(texto, () => { d.close(); otra(p); });
    const d = ventana(p.nombre,
      h('p', { class: clase }, estado),
      h('dl', {},
        dato('Es', p.tipo === 'adulto' ? 'Adulto' : regala(p) ? 'Participante menor de edad' : 'Destinatario adicional'),
        dato('Responsable', nombreDe(p.responsable)),
        dato('Mail', p.correo || p.mail), dato('Teléfono', p.telefono),
        dato('Pareja', nombreDe(p.pareja)), dato('Madre / Padre', p.padres.map(nombreDe).join(' y ')),
        dato('Entró', p.validada ? `${fechaCorta(p.validada)} a las ${p.validada.slice(11)}` : ''),
        dato('Cambio de mail', p.mailPropuesto ? `${p.mailPropuesto}, falta que lo confirme` : '')),
      aviso,
      h('div', { class: 'acciones' },
        abierto() ? abrir('Editar', formularioPersona) : null,
        p.correo && !p.validada ? accion(p.envio === 'enviado' ? 'Reenviar invitación' : 'Invitar', '', 'invitar') : null,
        !abierto() && !p.validada && !p.responsable ? abrir('Corregir datos', corregir) : null,
        !abierto() && p.validada ? accion('Reenviar link', '', 'reenviar') : null,
        p.validada ? abrir('Corregir mail', corregirMail) : null,
        p.validada ? accion('Liberar', `¿Liberar el nombre de ${p.nombre}? Se corta el acceso de ${p.mail}. Se borran su lista y las de todos los menores a su cargo.`, 'liberar') : null,
        abierto() ? accion('Quitar', `¿Quitar a ${p.nombre}?`, 'quitarPersona') : null));
  }

  function corregirMail(p) {
    const aviso = zonaAviso();
    const d = ventana('Corregir mail', formulario(aviso, async (x) => { await cambiar('proponerMail', { persona: p.id, mail: x.mail }); d.close(); },
      campo('Mail nuevo de ' + p.nombre, h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'off', value: p.mailPropuesto })),
      h('p', { class: 'chico suave' }, 'Cambia recién cuando lo confirma desde su Mi regalo. No se pierde ningún dato.'), aviso, enviar('Proponer cambio')));
  }

  function corregir(p) {
    const aviso = zonaAviso();
    const d = ventana('Corregir datos', formulario(aviso, async (x) => { await cambiar('corregirTelefono', { persona: p.id, ...x }); d.close(); },
      campo('Mail de ' + p.nombre, h('input', { name: 'correo', type: 'email', maxlength: 100, autocomplete: 'off', value: p.correo })),
      campo('Teléfono de ' + p.nombre, h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'off', value: p.telefono })), aviso, enviar('Guardar')));
  }

  /** Cambiar de responsable es un paso aparte, siempre confirmado. */
  const confirmaResponsable = (p, nuevo) => !p.id || !p.responsable || p.responsable === nuevo
    || confirm(`¿Cambiar el responsable de ${p.nombre} a ${nombreDe(nuevo)}? Si tiene deseos cargados, se borran.`);

  async function guardarPersona(p, d) {
    await cambiar(p.id ? 'editarPersona' : 'agregarPersona', { ...(p.id ? { persona: p.id, vaciar: !!p.responsable && p.responsable !== d.responsable } : {}), ...d });
  }

  function formularioPersona(p = {}) {
    const aviso = zonaAviso();
    const mayores = adultos().filter((x) => x.id !== p.id).map((x) => [x.id, x.nombre]);
    const elegir = (nombre, texto, valor) => campo(texto, selector({ name: nombre }, [['', 'Sin indicar'], ...mayores], valor || ''));
    const nombre = h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre || '' });
    const deAdulto = h('div', { class: 'plegado' },
      p.validada ? h('input', { type: 'hidden', name: 'correo', value: p.correo }) : campo('Mail', h('input', { name: 'correo', type: 'email', maxlength: 100, autocomplete: 'off', value: p.correo || '' })),
      h('details', { open: !!p.telefono && !p.correo }, h('summary', {}, 'Más datos'), h('div', { class: 'plegado' },
        campo('Teléfono, con código de área', h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'off', value: p.telefono || '' })),
        mayores.length ? elegir('pareja', 'Pareja', p.pareja) : null)));
    const deMenor = h('div', { class: 'plegado' }, mayores.length ? [
      campo('A cargo de', selector({ name: 'responsable' }, [['', 'Elegir'], ...mayores], p.responsable || '')),
      h('details', {}, h('summary', {}, 'Más datos'), h('div', { class: 'dos' }, [0, 1].map((i) => elegir('padre' + (i + 1), 'Madre / Padre', (p.padres || [])[i]))))]
      : h('p', { class: 'ambar chico' }, 'Primero sumá al adulto que va a ser su responsable.'));
    const acomodar = (tipo) => { deAdulto.hidden = tipo === 'nino'; deMenor.hidden = tipo !== 'nino'; };
    acomodar(p.tipo || 'adulto');
    const form = formulario(aviso, async (d) => {
      const nino = d.tipo === 'nino';
      if (nino && !confirmaResponsable(p, d.responsable)) return;
      await guardarPersona(p, nino ? { nombre: d.nombre, tipo: 'nino', responsable: d.responsable || '', padre1: d.padre1 || '', padre2: d.padre2 || '' }
        : { nombre: d.nombre, tipo: 'adulto', correo: d.correo, telefono: d.telefono, pareja: d.pareja });
      if (p.id) return d_.close();
      // Queda abierta para seguir sumando.
      const tipo = d.tipo, responsable = d.responsable;
      d_.close();
      const otra = formularioPersona({ tipo, responsable });
      otra.decir(`${d.nombre.trim()} ya está. Podés sumar a otra persona.`);
    },
      segmento('tipo', [['adulto', 'Adulto'], ['nino', 'Menor']], p.tipo || 'adulto', acomodar),
      campo('Nombre', nombre), deAdulto, deMenor, aviso, enviar(p.id ? 'Guardar' : 'Sumar'));
    const d_ = ventana(p.id ? 'Editar a ' + p.nombre : 'Personas que querés sumar', form);
    nombre.focus();
    d_.decir = (texto) => aviso.decir(texto, 'verde');
    return d_;
  }

  function pintarParticipantes() {
    const columna = (titulo, color, lista) => lista.length ? h('div', {},
      h('h2', {}, h('span', { class: 'punto', style: 'background:' + color }), titulo),
      lista.map((p) => {
        const [texto, clase] = estadoPersona(p);
        return h('button', { type: 'button', class: 'fila', onclick: () => verPersona(p) }, h('span', {}, p.nombre), h('span', { class: clase }, texto === 'Entró' ? '' : texto, icono('seguir')));
      })) : null;
    const n = s.personas.length;
    zonas.participantes.replaceChildren(...[
      h('div', { class: 'cab' },
        h('div', {}, h('h1', {}, s.evento.nombre), h('p', { class: 'suave' }, n === 1 ? '1 participante' : `${n} participantes`)),
        abierto() ? h('button', { type: 'button', class: 'boton', onclick: () => formularioPersona() }, icono('mas'), 'Sumar') : null),
      n ? h('div', { class: 'partes' }, columna('Ya entraron', '#00c896', s.personas.filter(entro)), columna('Invitados', '#f2b84b', s.personas.filter((p) => !entro(p))))
        : h('p', { class: 'suave' }, 'Sumá a tu familia, tus amigos o tus compañeros. Si participás, sumate también.')].filter(Boolean));
  }

  /* ---------- Familias ---------- */

  const cerradas = new Set(); // familias plegadas, por el id de su primer adulto

  /** Grupos según pareja y madre o padre. Cada adulto está en uno solo. */
  function familias() {
    const de = new Map(s.personas.map((p) => [p.id, p.id]));
    const raizDe = (x) => { while (de.get(x) !== x) x = de.get(x); return x; };
    for (const p of s.personas) for (const otro of [p.pareja, ...p.padres]) if (otro && de.has(otro)) de.set(raizDe(p.id), raizDe(otro));
    const grupos = new Map();
    for (const p of s.personas) {
      const r = raizDe(p.id);
      if (!grupos.has(r)) grupos.set(r, []);
      grupos.get(r).push(p);
    }
    return [...grupos.values()].map((g) => {
      const mayores = [];
      for (const p of g.filter((x) => x.tipo === 'adulto')) if (!mayores.includes(p)) mayores.push(p, ...g.filter((x) => x.id === p.pareja && !mayores.includes(x)));
      return { mayores, hijos: g.filter((x) => x.tipo === 'nino') };
    }).filter((g) => g.mayores.length).sort((a, b) => (b.mayores.length + b.hijos.length > 1) - (a.mayores.length + a.hijos.length > 1));
  }
  const mismaFamilia = (a, b) => s.reglaFamilia && familias().some((g) => [a, b].every((x) => g.mayores.concat(g.hijos).some((p) => p.id === x)));

  function editarAdulto(p) {
    const aviso = zonaAviso();
    const libres = adultos().filter((x) => x.id !== p.id && (!x.pareja || x.pareja === p.id)).map((x) => [x.id, x.nombre]);
    const d = ventana('Editar a ' + p.nombre, formulario(aviso, async (x) => {
      await guardarPersona(p, { tipo: 'adulto', nombre: x.nombre, correo: p.correo, telefono: p.telefono, pareja: x.pareja });
      d.close();
    },
      campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre })),
      campo('Pareja', selector({ name: 'pareja' }, [['', 'Sin pareja'], ...libres], p.pareja || '')), aviso, enviar('Guardar')));
  }

  /** Sumar, vincular o editar un hijo. El responsable se elige: el parentesco no da acceso. */
  function formularioHijo(mayores, p = {}) {
    const aviso = zonaAviso();
    const sueltos = s.personas.filter((x) => x.tipo === 'nino' && !x.padres.length);
    const quien = !p.id && sueltos.length ? selector({ name: 'existe', onchange: () => acomodar() }, [['', 'Niño nuevo'], ...sueltos.map((x) => [x.id, x.nombre])], '') : null;
    const nombre = campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre || '' }));
    const posibles = (x) => [...mayores, ...adultos().filter((a) => a.id === x.responsable && !mayores.includes(a))].map((a) => [a.id, a.nombre]);
    const responsable = h('select', { name: 'responsable' });
    const acomodar = () => {
      const x = s.personas.find((y) => y.id === quien?.value) || p;
      nombre.hidden = !!quien?.value;
      responsable.replaceChildren(...selector({}, [['', 'Elegir'], ...posibles(x)], x.responsable || '').children);
      responsable.value = x.responsable || '';
    };
    acomodar();
    const d = ventana(p.id ? 'Editar a ' + p.nombre : 'Sumar hijo', formulario(aviso, async (x) => {
      const actual = s.personas.find((y) => y.id === x.existe) || p;
      if (!confirmaResponsable(actual, x.responsable)) return;
      const padres = p.id ? p.padres : mayores.map((m) => m.id);
      await guardarPersona(actual, { tipo: 'nino', nombre: x.existe ? actual.nombre : x.nombre, responsable: x.responsable, padre1: padres[0] || '', padre2: padres[1] || '' });
      d.close();
    },
      quien ? campo('Quién es', quien) : null, nombre, campo('Responsable', responsable),
      h('p', { class: 'chico suave' }, 'Solo el responsable gestiona su participación.'), aviso, enviar(p.id ? 'Guardar' : 'Sumar')));
  }

  function formularioFamilia() {
    const aviso = zonaAviso();
    const libres = adultos().filter((x) => !x.pareja).map((x) => [x.id, x.nombre]);
    const uno = (n, texto, vacio) => {
      const nuevo = h('div', { class: 'plegado' }, campo('Nombre', h('input', { name: 'nombre' + n, maxlength: 40, autocomplete: 'off' })), campo('Mail', h('input', { name: 'correo' + n, type: 'email', maxlength: 100, autocomplete: 'off' })));
      const cual = selector({ name: 'persona' + n, onchange: () => { nuevo.hidden = cual.value !== 'nueva'; } }, [...(vacio ? [['', 'Sin pareja']] : []), ['nueva', 'Nueva persona'], ...libres], vacio ? '' : 'nueva');
      nuevo.hidden = cual.value !== 'nueva';
      return h('div', { class: 'plegado' }, campo(texto, cual), nuevo);
    };
    const d = ventana('Sumar familia', formulario(aviso, async (x) => {
      const alta = async (n) => {
        if (x['persona' + n] !== 'nueva') return x['persona' + n];
        await cambiar('agregarPersona', { tipo: 'adulto', nombre: x['nombre' + n], correo: x['correo' + n] });
        const creada = s.personas.at(-1).id;
        x['persona' + n] = creada; // si falla lo que sigue, no se carga dos veces
        return creada;
      };
      const a = await alta(1), b = await alta(2);
      if (b) {
        const p = s.personas.find((y) => y.id === a);
        await guardarPersona(p, { tipo: 'adulto', nombre: p.nombre, correo: p.correo, telefono: p.telefono, pareja: b });
      }
      d.close();
    }, uno(1, 'Adulto', false), uno(2, 'Pareja', true), aviso, enviar('Sumar')));
  }

  function pintarFamilias() {
    const aviso = zonaAviso();
    const n = adultos().length, m = s.personas.length - n;
    const per = (p, clase, alTocar) => h('button', { type: 'button', class: 'per ' + clase, disabled: !abierto(), onclick: alTocar }, p.nombre);
    const arbol = ({ mayores, hijos }) => {
      const clave = mayores[0].id;
      const cuerpo = h('div', { class: 'arbol', hidden: cerradas.has(clave) },
        h('div', { class: 'par' + (mayores.length === 1 ? ' solo' : '') }, mayores.map((p, i) => [
          i ? h('span', { class: 'lazo' + (p.pareja === mayores[i - 1].id ? '' : ' suelto') }, p.pareja === mayores[i - 1].id ? icono('corazon') : null) : null,
          per(p, 'adulto', () => editarAdulto(p))])),
        hijos.length || abierto() ? h('div', { class: 'hijos' },
          hijos.map((p) => h('div', { class: 'rama' }, per(p, '', () => formularioHijo(p.padres.length ? adultos().filter((a) => p.padres.includes(a.id)) : mayores, p)))),
          abierto() ? h('div', { class: 'rama' }, h('button', { type: 'button', class: 'per mas', 'aria-label': 'Sumar hijo', onclick: () => formularioHijo(mayores.slice(0, 2)) }, '+')) : null) : null);
      const boton = h('button', {
        type: 'button', class: 'fila', 'aria-expanded': String(!cerradas.has(clave)), onclick: () => {
          if (!cerradas.delete(clave)) cerradas.add(clave);
          cuerpo.hidden = cerradas.has(clave);
          boton.setAttribute('aria-expanded', String(!cuerpo.hidden));
        }
      }, h('b', { style: 'font-weight: 600' }, mayores.map((p) => p.nombre).join(' y ')), h('span', {}, icono('seguir')));
      return h('section', {}, boton, cuerpo);
    };
    const lista = familias();
    if (!pintarFamilias.vista && matchMedia('(max-width: 760px)').matches) lista.slice(1).forEach((g) => cerradas.add(g.mayores[0].id));
    pintarFamilias.vista = true;
    zonas.familias.replaceChildren(...[
      h('div', { class: 'cab' },
        h('div', {}, h('h1', {}, 'Familias'), h('p', { class: 'suave' }, `${n} ${n === 1 ? 'adulto' : 'adultos'} y ${m} ${m === 1 ? 'niño' : 'niños'}`)),
        abierto() ? h('button', { type: 'button', class: 'boton', onclick: formularioFamilia }, icono('mas'), 'Sumar familia') : null),
      abierto() ? llave('No regalar dentro de la familia', s.reglaFamilia, async (activa, b) => {
        try { await cambiar('reglaFamilia', { activa }); } catch (error) { aviso.decir(error.message, 'rojo'); b.setAttribute('aria-checked', String(!activa)); }
      }) : h('p', { class: 'suave' }, s.reglaFamilia ? 'Nadie regala dentro de su familia.' : 'Se puede regalar dentro de la familia.'),
      aviso,
      h('div', { class: 'arboles' }, lista.map(arbol))].filter(Boolean));
  }

  /* Matriz: los toques se ven al instante y se guardan de a uno, en orden. Si una misma
     celda cambia varias veces, solo se guarda el último valor. El estado se muestra
     cuando no queda nada por guardar, así nunca corresponde a una versión vieja. */
  const porGuardar = new Map(); // par de ids -> excluida
  let enCurso = null; // [par, excluida] que se está guardando
  let guardado = Promise.resolve();
  let guardando = false;
  let fallaMatriz = '';
  const celdas = new Map(); // 'de>a' -> botón
  const par = (de, a) => de < a ? de + '>' + a : a + '>' + de;
  const guardada = (de, a) => s.exclusiones.some((e) => e.de === de && e.a === a);
  function excluida(de, a) {
    const k = par(de, a);
    if (porGuardar.has(k)) return porGuardar.get(k);
    if (enCurso && enCurso[0] === k) return enCurso[1];
    return guardada(de, a);
  }
  function propuesta(de, a) {
    const k = par(de, a);
    if (porGuardar.has(k) || (enCurso && enCurso[0] === k)) return null;
    return s.propuestas.find((x) => par(x.de, x.a) === k) || null;
  }
  const MOTIVOS = { pareja: 'Pareja', progenitor: 'Madre / Padre', a_cargo: 'Responsable' };
  const motivos = (x) => x.motivos.map((m) => MOTIVOS[m] || m).join(', ');
  /** Los cruces que la modalidad no usa nunca se sortean. */
  const aplica = (de, a) => de.id !== a.id && (s.evento.modalidad === 'A' ? de.tipo === a.tipo : de.tipo === 'adulto');

  function alternar(de, a) {
    porGuardar.set(par(de.id, a.id), !excluida(de.id, a.id));
    fallaMatriz = '';
    for (const [x, y] of [[de, a], [a, de]]) {
      const boton = celdas.get(x.id + '>' + y.id);
      if (boton) pintarCelda(boton, x, y);
    }
    pintarEstadoMatriz();
    if (!guardando) guardado = guardarMatriz();
  }

  async function guardarMatriz() {
    guardando = true;
    const propuestasAntes = JSON.stringify(s.propuestas);
    try {
      while (porGuardar.size) {
        const [k, valor] = porGuardar.entries().next().value;
        porGuardar.delete(k);
        const [de, a] = k.split('>');
        if (valor === guardada(de, a) && valor === guardada(a, de)) continue;
        enCurso = [k, valor];
        s = await pedirAdmin(valor ? 'agregarExclusion' : 'quitarExclusion', { de, a, ambos: true });
        enCurso = null;
      }
    } catch (error) {
      enCurso = null;
      porGuardar.clear();
      fallaMatriz = error.message + ' Se muestra lo último guardado.';
      try { s = await pedirAdmin('admin'); } catch { /* queda lo último recibido */ }
    } finally {
      guardando = false;
      if (vigente()) {
        if (fallaMatriz || JSON.stringify(s.propuestas) !== propuestasAntes) pintarExclusiones(); else pintarEstadoMatriz();
        if (!fallaMatriz) pintarResumen();
      }
    }
  }

  /** Espera a que la matriz termine de guardar; si algo falló, lo informa. */
  async function matrizLista() {
    await guardado;
    if (fallaMatriz) throw new Error('Revisá las exclusiones: ' + fallaMatriz);
  }

  function pintarCelda(boton, de, a) {
    const no = excluida(de.id, a.id);
    const sugerida = no ? null : propuesta(de.id, a.id);
    boton.setAttribute('aria-pressed', no);
    boton.classList.toggle('sugerida', !!sugerida);
    boton.setAttribute('aria-label', no ? `${de.nombre} no le regala a ${a.nombre}`
      : sugerida ? `Propuesta, ${motivos(sugerida)}: ${de.nombre} no le regala a ${a.nombre}. Tocá para aceptarla.` : `${de.nombre} puede regalarle a ${a.nombre}`);
    boton.textContent = no ? '✕' : sugerida ? '?' : '○';
  }

  const estadoMatriz = h('div', { role: 'status' });
  function pintarEstadoMatriz() {
    const cruces = s.personas.flatMap((de) => s.personas.filter((a) => aplica(de, a)).map((a) => [de, a]));
    const n = cruces.filter(([de, a]) => excluida(de.id, a.id)).length;
    const cuenta = n === 1 ? '1 exclusión activa' : `${n} exclusiones activas`;
    const v = s.verificacion;
    const [texto, clase] = fallaMatriz ? [fallaMatriz, 'rojo']
      : guardando || porGuardar.size ? ['Verificando…', 'suave']
        : !v ? ['', 'suave']
          : v.ok ? ['Resoluble: el sorteo se puede hacer.', 'verde'] : ['Conflicto: ' + v.motivo, 'rojo'];
    const vp = guardando || porGuardar.size || fallaMatriz ? null : s.verificacionConPropuestas;
    estadoMatriz.replaceChildren(...[h('p', { class: clase }, texto),
      vp ? h('p', { class: 'chico ' + (vp.ok ? 'verde' : 'rojo') }, vp.ok ? 'Si aceptás todas las propuestas, sigue siendo resoluble.' : 'Si aceptás todas las propuestas, hay conflicto.') : null,
      h('p', { class: 'chico suave' }, cuenta)].filter(Boolean));
  }

  /** Propuestas y relaciones que ya no figuran: nada cambia sin una decisión. */
  function revisar(aviso) {
    const decidir = (texto, accion, x) => enlace(texto, (ev) => ejecutar(ev.currentTarget, aviso, async () => {
      await matrizLista();
      await cambiar(accion, x);
    }));
    const renglon = (x, texto, ...botones) => h('div', { class: 'suma' },
      h('div', {}, h('p', {}, `${nombreDe(x.de)} y ${nombreDe(x.a)}`), h('p', { class: 'chico suave' }, texto)), h('div', { class: 'acciones' }, botones));
    if (!s.propuestas.length && !s.sinRelacion.length) return null;
    return h('div', { class: 'tarjeta' },
      s.propuestas.length ? [
        h('h3', {}, 'Exclusiones propuestas'),
        h('p', { class: 'chico suave' }, 'Salen de las relaciones que cargaste. No cuentan hasta que las aceptes.'),
        s.propuestas.map((x) => renglon(x, motivos(x),
          decidir('Aceptar', 'aceptarPropuesta', { de: x.de, a: x.a }), decidir('Descartar', 'descartarPropuesta', { de: x.de, a: x.a }))),
        s.propuestas.length > 1 ? decidir('Aceptar todas', 'aceptarPropuesta', {}) : null] : null,
      s.sinRelacion.length ? [
        h('h3', {}, 'La relación ya no figura'),
        s.sinRelacion.map((x) => renglon(x, 'Aprobada por: ' + motivos(x),
          decidir('Mantener', 'mantenerExclusion', { de: x.de, a: x.a }), decidir('Quitar', 'quitarExclusion', { de: x.de, a: x.a, ambos: true })))] : null);
  }

  function pintarExclusiones() {
    const aviso = zonaAviso();
    const ejemplo = h('div');
    celdas.clear();
    const filas = s.personas.filter((de) => s.personas.some((a) => aplica(de, a)));
    const celda = (de, a) => {
      if (!aplica(de, a)) return h('td', {}, h('span', { 'aria-label': 'No corresponde' }, '—'));
      if (mismaFamilia(de.id, a.id)) return h('td', {}, h('span', { class: 'familia', 'aria-label': 'Misma familia', title: 'Misma familia' }, icono('familias')));
      if (!abierto()) return h('td', {}, h('span', {}, guardada(de.id, a.id) ? '✕' : '○'));
      const boton = h('button', { type: 'button', onclick: () => alternar(de, a) });
      celdas.set(de.id + '>' + a.id, boton);
      pintarCelda(boton, de, a);
      return h('td', {}, boton);
    };
    zonas.exclusiones.replaceChildren(...[
      h('div', {}, h('h1', {}, 'Exclusiones'),
        h('p', { class: 'suave', style: 'margin-top: 4px' }, !filas.length ? 'Sumá participantes para ver los cruces.' : abierto() ? 'Opcional. La fila regala, la columna recibe. Tocá un cruce para bloquearlo.' : 'El sorteo está hecho: las exclusiones quedan fijas.')),
      revisar(aviso),
      filas.length ? h('div', { class: 'matriz', tabindex: 0, role: 'region', 'aria-label': 'Matriz de exclusiones' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Regala'), s.personas.map((a) => h('th', { scope: 'col' }, a.nombre)))),
        h('tbody', {}, filas.map((de) => h('tr', {}, h('th', { scope: 'row' }, de.nombre), s.personas.map((a) => celda(de, a))))))) : null,
      filas.length ? h('p', { class: 'chico suave' }, ['○ permitido', '✕ excluido', s.propuestas.length ? '? propuesta sin revisar' : '', '— no corresponde', s.reglaFamilia ? 'violeta: misma familia' : ''].filter(Boolean).join(' · ')) : null,
      abierto() && filas.length ? estadoMatriz : null,
      aviso,
      abierto() && filas.length ? h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'segundo', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
            ejemplo.replaceChildren();
            await matrizLista();
            const lista = await pedirAdmin('simular');
            ejemplo.replaceChildren(
              h('p', { class: 'ambar' }, 'Esto es un ejemplo. El sorteo real va a ser otro.' + (s.propuestas.length ? ' No incluye las propuestas sin revisar.' : '')),
              listaSorteo(lista));
          })
        }, 'Simular'),
        enlace('Limpiar exclusiones', (ev) => {
          if (!confirm('¿Quitar todas las exclusiones?')) return;
          ejecutar(ev.currentTarget, aviso, async () => { await matrizLista(); await cambiar('limpiarExclusiones'); });
        })) : null,
      ejemplo].filter(Boolean));
    pintarEstadoMatriz();
  }

  /* ---------- Regalos especiales ---------- */

  function formularioEspecial(e = { modo: 'adicional', tambien: false }) {
    const aviso = zonaAviso();
    const mayores = adultos().map((p) => [p.id, p.nombre]);
    const todos = s.personas.map((p) => [p.id, p.nombre]);
    const nota = h('p', { class: 'chico suave' });
    let modo = e.modo, tambien = e.tambien;
    const tambienRecibe = llave('También recibe uno del sorteo', tambien, (v) => { tambien = v; });
    const recibe = selector({ name: 'a', onchange: () => acomodar() }, [['', 'Elegir'], ...todos], e.a || '');
    const acomodar = () => {
      const a = s.personas.find((p) => p.id === recibe.value);
      nota.textContent = modo === 'adicional' ? 'Quien regala mantiene sus regalos del sorteo y suma este.' : 'Este regalo ocupa el lugar del que le tocaba por sorteo.';
      tambienRecibe.hidden = modo !== 'adicional' || !a || regala(a); // quien participa siempre recibe del sorteo
    };
    acomodar();
    const d = ventana('Regalo especial', formulario(aviso, async (x) => {
      if (!x.de || !x.a) throw new Error('Elegí quién regala y quién recibe.');
      await cambiar('guardarEspecial', { especial: e.id, de: x.de, a: x.a, modo, tambien });
      d.close();
    },
      campo('Quién regala', selector({ name: 'de' }, [['', 'Elegir'], ...mayores], e.de || '')),
      campo('Quién recibe', recibe),
      segmento('modo', [['adicional', 'Adicional'], ['reemplaza', 'Reemplaza']], modo, (v) => { modo = v; acomodar(); }),
      nota, tambienRecibe, aviso,
      h('div', { class: 'cierre' }, enviar('Guardar'), e.id ? enlace('Quitar', (ev) => ejecutar(ev.target, aviso, async () => { await cambiar('quitarEspecial', { especial: e.id }); d.close(); })) : null)));
  }

  /** Cuántos regalos hay, con lo especial aparte de lo que sale del sorteo. */
  function cuentas() {
    const ninos = s.personas.filter((p) => p.tipo === 'nino');
    const n = adultos().length;
    const tipoDe = (pid) => s.personas.find((p) => p.id === pid)?.tipo;
    const reemplaza = (tipo) => s.especiales.filter((e) => e.modo === 'reemplaza' && tipoDe(e.a) === tipo).length;
    const cubiertos = s.evento.modalidad === 'B' ? ninos.filter((p) => s.especiales.some((e) => e.a === p.id && e.modo === 'adicional' && !e.tambien) && !s.especiales.some((e) => e.a === p.id && e.modo === 'reemplaza')).length : 0;
    const libres = ninos.length - cubiertos;
    const aNinos = !libres ? 0 : s.evento.modalidad === 'B' ? Math.max(n, libres) : libres;
    return { adultos: n - reemplaza('adulto'), ninos: Math.max(0, aNinos - reemplaza('nino')), especiales: s.especiales.length };
  }

  function pintarEspeciales() {
    const fila = (e) => {
      const solo = e.modo === 'adicional' && !e.tambien && s.personas.some((p) => p.id === e.a && !regala(p));
      return h(abierto() ? 'button' : 'div', { class: 'especial', ...(abierto() ? { type: 'button', onclick: () => formularioEspecial(e) } : {}) },
        imagen('flota', NAVIDAD.regalo),
        h('span', {}, h('b', {}, nombreDe(e.de), icono('flecha'), nombreDe(e.a)),
          h('span', { class: 'chico suave' }, e.modo === 'reemplaza' ? 'Reemplaza al regalo del sorteo.' : solo ? `Adicional. ${nombreDe(e.a)} recibe solo este regalo.` : 'Adicional.')));
    };
    const c = cuentas();
    const suma = (texto, n, clase) => h('div', { class: 'suma ' + (clase || '') }, h('span', {}, texto), h('span', {}, typeof n === 'number' ? String(n) : n));
    const primero = s.especiales[0];
    zonas.especiales.replaceChildren(...[
      h('div', { class: 'cab' },
        h('div', {}, h('h1', {}, 'Regalos especiales'), h('p', { class: 'suave' }, 'Los elegís vos. Van aparte del sorteo.')),
        abierto() && adultos().length ? h('button', { type: 'button', class: 'boton', onclick: () => formularioEspecial() }, icono('mas'), 'Sumar') : null),
      ...s.especiales.map(fila),
      s.personas.length ? h('div', { class: 'partes' },
        h('div', {}, h('h3', {}, 'Regalos en total'),
          suma('Del sorteo, entre adultos', c.adultos),
          s.personas.some((p) => p.tipo === 'nino') ? suma('Del sorteo, a niños', c.ninos) : null,
          suma(c.especiales === 1 ? 'Especial' : 'Especiales', c.especiales, 'violeta'),
          suma('Total', c.adultos + c.ninos + c.especiales)),
        primero ? h('div', {}, h('h3', {}, 'Así lo ve ' + nombreDe(primero.de)),
          suma('Regalos del sorteo', 'Mantener para revelar'),
          suma('Regalo especial', primero.modo === 'reemplaza' ? 'Mantener para revelar' : s.especiales.filter((e) => e.de === primero.de && e.modo === 'adicional').map((e) => nombreDe(e.a)).join(', '), 'violeta')) : null) : null].filter(Boolean));
  }

  /* ---------- Resumen ---------- */

  /** Avance según el momento: antes del sorteo, quién entró; después, quién vio su regalo. */
  function avance() {
    const base = s.personas.filter((p) => abierto() ? !p.responsable : regala(p));
    const hecho = (p) => abierto() ? p.validada : p.vio;
    const contar = (lista) => [lista.filter(hecho).length, lista.length];
    const filas = [[abierto() ? 'Adultos' : 'En total', '#0090ff', contar(base)]];
    if (base.some((p) => p.tipo === 'nino')) {
      filas.push(['Adultos', '#a855f7', contar(base.filter((p) => p.tipo === 'adulto'))]);
      filas.push(['Niños', '#00c9a0', contar(base.filter((p) => p.tipo === 'nino'))]);
    }
    return { titulo: abierto() ? 'Ya entraron' : 'Ya vieron su regalo', filas, faltan: base.filter((p) => !hecho(p)) };
  }

  function arcos(filas) {
    const trazos = ['M22 20A100 100 0 0 1 22 220', 'M22 52A68 68 0 0 1 22 188', 'M22 84A36 36 0 0 1 22 156'];
    const fondo = trazos.map((d) => `<path d="${d}" stroke="#EEF1F8"/>`).join('');
    const valores = filas.map(([, color, [n, total]], i) =>
      n ? `<path d="${trazos[i]}" stroke="${color}" pathLength="100" stroke-dasharray="${Math.round(n / total * 100)} 200"/>` : '').join('');
    return dibujo('', `<svg viewBox="0 0 170 240" aria-hidden="true"><g fill="none" stroke-width="18" stroke-linecap="round">${fondo}${valores}</g></svg>`).firstChild;
  }

  function pintarResumen() {
    const e = s.evento;
    const a = avance();
    const aviso = zonaAviso();
    const conMail = s.personas.filter((p) => p.mail || p.correo).length;
    const sinMail = s.personas.some((p) => !p.responsable && !p.validada && !p.correo);
    const nombres = a.faltan.map((p) => p.nombre).join(', ');
    const estado = !s.personas.length ? 'Empezá por sumar a los participantes.'
      : !abierto() ? (a.faltan.length ? `El sorteo está hecho. ${a.faltan.length === 1 ? 'Falta 1 persona' : `Faltan ${a.faltan.length} personas`} por ver su regalo.` : 'El sorteo está hecho y todos vieron su regalo.')
        : a.faltan.length ? `${a.faltan.length === 1 ? 'Falta entrar 1 persona' : `Faltan entrar ${a.faltan.length} personas`}. Podés sortear igual.` : 'Está todo listo para sortear.';

    const sortear = h('button', {
      type: 'button', class: 'boton', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
        await cola;
        await matrizLista();
        if (s.propuestas.length) throw new Error('Hay exclusiones propuestas sin revisar: aceptalas o descartalas en Exclusiones.');
        if (eventoSinGuardar) throw new Error('Revisá los datos del evento: ' + eventoSinGuardar);
        const partes = ['¿Hacer el sorteo? Después los participantes quedan fijos.'];
        if (conMail) partes.push(`Se ${conMail === 1 ? 'envía 1 mail' : `envían ${conMail} mails`}.`);
        if (a.faltan.length) partes.push(`Todavía no entraron: ${nombres}.`);
        if (!confirm(partes.join(' '))) return;
        aviso.decir('Sorteando…', 'suave');
        await cambiar('sortear');
        festejo();
      })
    }, 'Sortear');
    const repetir = h('button', {
      type: 'button', class: 'segundo', onclick: (ev) => {
        if (!confirm('¿Anular el sorteo actual? Quienes ya vieron a quién le regalan van a tener otra persona.')) return;
        ejecutar(ev.currentTarget, aviso, () => cambiar('reabrir'));
      }
    }, 'Volver a sortear');
    const agregar = h('button', { type: 'button', class: 'boton', onclick: () => { ver('participantes'); formularioPersona(); } }, icono('mas'), 'Sumar participantes');

    zonas.resumen.replaceChildren(...[
      h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Hola, ' + s.organizador), h('p', { class: 'suave' }, estado)), !s.personas.length ? agregar : abierto() ? sortear : repetir),
      aviso,
      h('div', { class: 'datos' },
        a.filas[0][2][1] ? h('div', { class: 'tarjeta arcos' }, arcos(a.filas),
          h('div', { class: 'columna' }, h('h3', {}, a.titulo),
            a.filas.map(([texto, color, [n, total]]) => h('div', { class: 'dato', style: `--color:${color}` }, h('span', {}, h('span', { class: 'cifra' }, `${n}/${total}`), h('span', { class: 'chico suave' }, texto)))))) : null,
        h('div', { class: 'tarjeta' }, h('span', { class: 'chico suave' }, e.nombre), h('span', { class: 'cifra' }, parteFecha(e.fecha, { day: 'numeric' }), ' de ' + parteFecha(e.fecha, { month: 'long' })), h('span', { class: 'chico suave' }, parteFecha(e.fecha, { weekday: 'long' }))),
        h('div', { class: 'tarjeta' }, h('span', { class: 'chico suave' }, 'Presupuesto por regalo'), h('span', { class: 'cifra' }, e.presupuesto !== null ? importe(e.presupuesto) : 'Sin definir')),
        s.personas.length ? tarjetaCompartir() : null),
      a.faltan.length ? h('div', {},
        h('div', { class: 'cab' }, h('h3', {}, abierto() ? 'Falta que entren' : 'Falta que vean su regalo'), enlace('Actualizar', (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('admin')))),
        a.faltan.slice(0, 4).map((p) => {
          const [texto, clase] = estadoPersona(p);
          return h('button', { type: 'button', class: 'fila', onclick: () => verPersona(p) }, h('span', {}, p.nombre), h('span', { class: clase }, texto, icono('seguir')));
        }),
        a.faltan.length > 4 ? enlace(`Ver ${a.faltan.length - 4} más`, () => ver('participantes')) : null) : null,
      sinMail && !abierto() ? h('p', { class: 'chico ambar' }, 'Hay nombres sin validar: quien conozca su teléfono podría entrar primero y ver ese regalo. Revisá en Participantes quién entró.') : null,
      abierto() ? null : emergencia()].filter(Boolean));
  }

  /** Solo quien organiza: exige un PIN que llega a su mail y no queda en pantalla al salir. */
  function emergencia() {
    const aviso = zonaAviso();
    const zona = h('div', { class: 'plegado' });
    const cerrar = () => {
      aviso.decir('');
      zona.replaceChildren(h('button', { type: 'button', class: 'segundo', onclick: (ev) => {
        if (!confirm('¿Ver el sorteo completo? Vas a saber a quién le regala cada persona, incluso quién te regala a vos.')) return;
        ejecutar(ev.currentTarget, aviso, async () => {
          const r = await pedir('pedirEmergencia', { id, token });
          aviso.decir(`Te enviamos un PIN a ${r.mail}.`, 'verde');
          zona.replaceChildren(formulario(aviso, async (d) => {
            const lista = await pedir('verSorteo', { id, token, pin: d.pin });
            zona.replaceChildren(listaSorteo(lista), h('button', { type: 'button', class: 'segundo', onclick: cerrar }, 'Ocultar'));
          },
            campo('PIN', h('input', { class: 'num', name: 'pin', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code' })),
            h('div', { class: 'acciones' }, enviar('Ver sorteo completo'), enlace('Cancelar', cerrar))));
        });
      } }, 'Pedir PIN'));
    };
    cerrar();
    return h('details', {}, h('summary', {}, 'Acceso de emergencia'),
      h('div', { class: 'plegado' }, h('p', { class: 'suave' }, 'Muestra a quién le regala cada persona. Solo para quien organiza.'), zona, aviso));
  }

  function tarjetaCompartir() {
    const pendientes = s.personas.filter((p) => p.correo && !p.validada && p.envio !== 'enviado').length;
    const aviso = zonaAviso();
    const url = linkGrupo(id);
    const texto = abierto()
      ? `${s.evento.nombre}: entrá, tocá tu nombre y validá tu PIN. ${url}`
      : `¡Ya se hizo el sorteo de ${s.evento.nombre}! Entrá para ver a quién le regalás. ${url}`;
    const copiar = (que, listo) => enlace(que, async () => {
      const t = listo();
      try { await navigator.clipboard.writeText(t); aviso.decir('Copiado', 'verde'); } catch { aviso.decir(t, 'mensaje'); }
    });
    return h('div', { class: 'tarjeta calido ancha' },
      h('h3', {}, abierto() ? 'Invitá a los participantes' : 'Avisá que ya se sorteó'),
      pendientes ? h('button', { type: 'button', class: 'boton', style: 'align-self: flex-start', onclick: (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('invitar')) }, pendientes === 1 ? 'Enviar 1 invitación' : `Enviar ${pendientes} invitaciones`) : null,
      h('div', { class: 'acciones' },
        h('a', { class: 'enlace', href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
        copiar('Copiar invitación', () => [
          s.evento.nombre,
          'Fecha: ' + fechaCorta(s.evento.fecha),
          s.evento.presupuesto !== null ? 'Presupuesto: ' + importe(s.evento.presupuesto) : '',
          s.evento.mensaje,
          abierto() ? 'Entrá, tocá tu nombre y validá tu PIN:' : 'Ya se hizo el sorteo. Entrá para ver a quién le regalás:',
          url
        ].filter(Boolean).join('\n')),
        copiar('Copiar link', () => url)),
      aviso);
  }

  for (const [z, texto, dib] of SECCIONES) botones[z] = itemMenu(dib, texto, { onclick: () => ver(z) });
  conMenu('largo',
    [h('nav', { 'aria-label': 'Sorteo' }, Object.values(botones)),
      h('div', { class: 'aparte' }, itemMenu('salir', 'Salir', { onclick: () => { olvidar(id, 'admin'); ir('#/'); } }))],
    ...Object.values(zonas));
  pintar(true);
  ver('resumen');
}

/* ---------- Participantes ---------- */

async function pantallaGrupo(id, extra, vigente) {
  const propias = sesiones.filter((s) => s.id === id && !s.admin);
  if (propias.some((s) => s.persona === extra)) return ir(`#/m/${id}/${extra}`);
  if (propias.length === 1 && !extra) return ir(`#/m/${id}/${propias[0].persona}`);
  cargando();
  const grupo = await pedir('grupo', { id });
  if (!vigente()) return;

  const elegida = grupo.personas.find((p) => p.id === extra);
  if (elegida) return pantallaPin(id, elegida);

  mostrarNavidad(grupo.encuentro, `${grupo.organizador} te invitó a participar.`,
    h('div', {},
      h('h2', { style: 'margin-bottom: 8px' }, '¿Quién sos?'),
      grupo.personas.length
        ? grupo.personas.map((p) => {
          const recordada = propias.some((s) => s.persona === p.id);
          return h('button', { type: 'button', class: 'fila', onclick: () => recordada ? ir(`#/m/${id}/${p.id}`) : pantallaPin(id, p) },
            h('span', {}, p.nombre), h('span', { class: 'suave' }, recordada ? 'En este dispositivo' : p.validada ? 'Ya entró' : '', icono('seguir')));
        })
        : h('p', {}, 'Todavía no hay nombres para elegir.')),
    h('p', { class: 'chico suave' }, 'Si no ves tu nombre, consultale a quien organiza. Los menores están a cargo de un adulto.'));
}

function pantallaPin(id, p) {
  const aviso = zonaAviso();
  const zona = h('div');
  const otra = enlace('No soy ' + p.nombre, () => ir(`#/g/${id}/elegir`));
  otra.style.alignSelf = 'flex-start';
  if (p.validada) {
    mostrarNavidad('Hola, ' + p.nombre, null,
      h('p', { class: 'suave' }, 'Este nombre ya entró y nadie más puede usarlo. Si cambiaste de dispositivo, te enviamos tu acceso al mail que validaste.'),
      h('button', {
        type: 'button', class: 'boton', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
          const r = await pedir('pedirLink', { id, persona: p.id });
          aviso.decir(`Te enviamos el acceso a ${r.mail}.`, 'verde');
        })
      }, 'Enviarme mi acceso'),
      aviso, h('p', { class: 'chico suave' }, 'Si no fuiste vos, avisale a quien organiza.'), otra);
    return;
  }

  let mail = '';
  let telefono = '';
  function pasoMail() {
    zona.replaceChildren(formulario(aviso, async (d) => {
      const r = await pedir('pedirPin', { id, persona: p.id, telefono: d.telefono, mail: d.mail });
      telefono = d.telefono;
      mail = r.mail;
      pasoPin();
      aviso.decir(`Te enviamos un PIN a ${mail}. Si no llega, buscalo en correo no deseado.`, 'verde');
    },
      campo('Tu teléfono', h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'tel', value: telefono })),
      campo('Tu mail', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'email', value: mail })),
      enviar('Enviarme el PIN')));
  }
  function pasoPin() {
    zona.replaceChildren(formulario(aviso, async (d) => {
      const r = await pedir('entrar', { id, persona: p.id, mail, pin: d.pin });
      recordar({ id, persona: r.persona, nombre: r.nombre, token: r.token });
      ir(`#/m/${id}/${r.persona}`);
    },
      campo('PIN', h('input', { class: 'num', name: 'pin', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code' })),
      enviar('Entrar'), p.conMail ? null : enlace('Cambiar mail o pedir otro PIN', () => { aviso.decir(''); pasoMail(); })));
    zona.querySelector('input').focus();
  }
  if (p.conMail) pasoPin(); else pasoMail();
  mostrarNavidad('Hola, ' + p.nombre, null,
    h('p', { class: 'suave' }, p.conMail ? 'Escribí el PIN que recibiste por mail. Si no te llegó, revisá correo no deseado o consultale a quien organiza.' : 'Escribí tu teléfono y tu mail. Te enviamos un PIN para confirmar que sos vos. Quien organiza ve con qué mail entraste.'),
    zona, aviso, otra);
  zona.querySelector('input').focus();
}

async function abrirLink(id, token, vigente) {
  cargando();
  const yo = await pedir('yo', { id, token });
  if (!vigente()) return;
  recordar({ id, persona: yo.persona, nombre: yo.nombre, token });
  location.replace(`#/m/${id}/${yo.persona}`);
}

function datosEvento(e) {
  return h('dl', {},
    h('dt', {}, 'Encuentro'), h('dd', {}, e.nombre),
    h('dt', {}, 'Fecha'), h('dd', {}, fechaCorta(e.fecha)),
    e.presupuesto !== null ? [h('dt', {}, 'Presupuesto'), h('dd', {}, importe(e.presupuesto))] : [],
    e.mensaje ? [h('dt', {}, 'Mensaje'), h('dd', {}, e.mensaje)] : []);
}

/** Día completo, sin datos privados ni links de acceso. */
function calendario(e) {
  const dia = e.fecha.replaceAll('-', '');
  const fin = new Date(Date.parse(e.fecha) + 86400000).toISOString().slice(0, 10).replaceAll('-', '');
  const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.nombre) + `&dates=${dia}/${fin}`;
  const limpio = e.nombre.replace(/([\;,])/g, '\\$1').replace(/\s+/g, ' ');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yori//ES', 'BEGIN:VEVENT', `UID:${dia}-${encodeURIComponent(e.nombre).slice(0, 30)}@yori`,
    `DTSTAMP:${dia}T000000Z`, `DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${fin}`, `SUMMARY:${limpio}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return h('div', { class: 'acciones' },
    h('span', { class: 'suave' }, 'Agregar al calendario'),
    h('a', { class: 'enlace', href: google, target: '_blank', rel: 'noopener' }, 'Google'),
    h('a', { class: 'enlace', href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), download: 'encuentro.ics' }, 'Apple'));
}

/* ---------- Lista de deseos ---------- */

const TALLES = [['superior', 'Remera'], ['inferior', 'Pantalón'], ['calzado', 'Calzado'], ['otro', 'Otro talle']];
const GUSTOS = ['Decoración', 'Tecnología', 'Libros', 'Café', 'Belleza', 'Deportes', 'Plantas', 'Experiencias'];
const TEXTOS = [
  ['preferencias', 'Gustos y preferencias', 'Colores neutros, aromas cítricos, cosas prácticas'],
  ['recibir', 'Lo que me gustaría recibir', 'Una taza linda, una planta, algo para mi escritorio'],
  ['evitar', 'Lo que prefiero evitar', 'Perfumes dulces, ropa estampada'],
  ['pistas', 'Otra pista', 'Cualquier detalle que ayude a elegir'],
  ['personajes', 'Personajes favoritos', '¿Con quién sueña jugar?']
];
const MAX_TEXTO = 500;
const MAX_GUSTOS = 12;

/** Tolera listas vacías, incompletas o con el formato de texto anterior. */
function leerPerfil(x) {
  const o = typeof x === 'string' ? { recibir: x } : x && typeof x === 'object' ? x : {};
  const t = (v) => typeof v === 'string' ? v : '';
  return {
    id: t(o.id), nombre: t(o.nombre), compartir: o.compartir === undefined || o.compartir === true,
    talles: Object.fromEntries(TALLES.map(([k]) => [k, t(o.talles?.[k])])),
    gustos: Array.isArray(o.gustos) ? o.gustos.filter((g) => typeof g === 'string') : [],
    ...Object.fromEntries(TEXTOS.map(([k]) => [k, t(o[k])])),
    hijos: Array.isArray(o.hijos) ? o.hijos.map(leerPerfil) : []
  };
}

/** Formulario de un perfil. Todo es opcional; lo que se usa menos queda plegado. */
function formularioPerfil(perfil, deHijo, editable, alGuardar, alRevocar, extra) {
  const aviso = zonaAviso();
  const propios = perfil.gustos.filter((g) => !GUSTOS.includes(g));
  const cuenta = h('p', { class: 'chico suave', hidden: true });
  const grupo = (titulo, ...hijos) => h('div', { class: 'grupo' }, h('h3', {}, titulo), hijos);
  const area = (k, titulo) => h('textarea', { name: k, maxlength: MAX_TEXTO, 'aria-label': titulo, placeholder: deHijo && k === 'recibir' ? 'Un juego de mesa, libros, una pelota' : TEXTOS.find((t) => t[0] === k)[2], value: perfil[k] });
  const talle = ([k, texto]) => campo(texto, h('input', { name: 'talle-' + k, maxlength: 30, autocomplete: 'off', value: perfil.talles[k] }));
  const masTextos = TEXTOS.filter(([k]) => !['recibir', 'personajes'].includes(k));
  const form = formulario(aviso, async () => {
    const d = new FormData(form);
    const v = (k) => String(d.get(k) || '').trim();
    const otros = v('otros').split(',').map((g) => g.trim()).filter(Boolean);
    const gustos = [...new Set([...d.getAll('gusto'), ...otros])];
    const largo = TEXTOS.reduce((suma, [k]) => suma + v(k).length, 0);
    if (largo > MAX_TEXTO) throw new Error(`No se envió: los textos suman ${largo} caracteres y el máximo es ${MAX_TEXTO}. Acortá alguno.`);
    if (gustos.length > MAX_GUSTOS) throw new Error(`No se envió: elegiste ${gustos.length} gustos y el máximo es ${MAX_GUSTOS}.`);
    const gustoLargo = gustos.find((g) => g.length > 30);
    if (gustoLargo) throw new Error(`No se envió: "${gustoLargo}" supera los 30 caracteres por gusto.`);
    await alGuardar({
      compartir: d.get('compartir') === 'on',
      talles: Object.fromEntries(TALLES.map(([k]) => [k, v('talle-' + k)])),
      gustos,
      ...Object.fromEntries(TEXTOS.map(([k]) => [k, v(k)]))
    }, v('nombre'));
    aviso.decir('Guardado', 'verde');
  },
    extra,
    deHijo ? grupo('Ideas para mis hijos', area('recibir', 'Ideas para mis hijos')) : null,
    grupo(deHijo ? 'Los talles de mis hijos' : 'Mis talles', h('div', { class: 'tres' }, TALLES.slice(0, 3).map(talle))),
    grupo(deHijo ? 'Sus gustos' : 'Mis gustos', h('div', { class: 'gustos' }, GUSTOS.map((g) => h('label', { class: 'gusto' }, h('input', { type: 'checkbox', name: 'gusto', value: g, checked: perfil.gustos.includes(g) }), g)))),
    deHijo ? h('label', { class: 'campo' }, h('h3', {}, 'Sus personajes favoritos'), h('input', { name: 'personajes', maxlength: 200, autocomplete: 'off', placeholder: '¿Con quién sueña jugar?', value: perfil.personajes }))
      : [grupo('Lo que me gustaría recibir', area('recibir', 'Lo que me gustaría recibir')), h('input', { type: 'hidden', name: 'personajes', value: perfil.personajes })],
    h('details', { open: !!(propios.length || perfil.talles.otro || masTextos.some(([k]) => perfil[k])) }, h('summary', {}, 'Sumar otra pista'), h('div', { class: 'plegado' },
      h('div', { class: 'dos' },
        campo('Otros gustos, separados por coma', h('input', { name: 'otros', maxlength: 200, autocomplete: 'off', value: propios.join(', ') })),
        talle(TALLES[3])),
      masTextos.map(([k, texto]) => campo(texto, area(k, texto))))),
    cuenta, aviso,
    h('div', { class: 'cierre' },
      opcion({ type: 'checkbox', name: 'compartir', checked: perfil.compartir }, deHijo ? 'Compartir estas pistas' : 'Compartir con quien me regala'),
      editable ? enviar('Guardar mis deseos') : h('p', { class: 'suave' }, 'El encuentro ya pasó: la lista no se puede editar.')));
  const contar = () => {
    const n = TEXTOS.reduce((suma, [k]) => suma + form.elements[k].value.trim().length, 0);
    cuenta.replaceChildren(...h('p', {}, `Textos: ${n} de ${MAX_TEXTO} caracteres`).childNodes);
    cuenta.className = 'chico ' + (n > MAX_TEXTO ? 'rojo' : 'suave');
    cuenta.hidden = n < MAX_TEXTO * .8; // solo cuando se acerca al límite
  };
  form.addEventListener('input', contar);
  contar();
  if (!editable) {
    for (const el of form.elements) el.disabled = true;
    if (perfil.compartir) {
      const revocar = h('button', {
        type: 'button', class: 'segundo', onclick: () => ejecutar(revocar, aviso, async () => {
          await alRevocar();
          form.elements.compartir.checked = false;
          revocar.remove();
          aviso.decir('Ya no se comparte.', 'verde');
        })
      }, 'Dejar de compartir');
      form.querySelector('.cierre').append(revocar);
    }
  }
  return form;
}

/** Lo que ve quien regala. */
function verPistas(pistas, adulto) {
  if (!pistas.length) return h('p', { class: 'suave chico' }, 'Todavía no dejó pistas. Podés volver más tarde o sorprender con algo simple.');
  return h('div', { class: 'pistas' }, pistas.map((x) => h('div', {},
    x.hijo ? h('h3', { style: 'margin-top: 14px' }, x.hijo + ', a cargo de ' + adulto) : null,
    h('dl', {},
      x.talles ? [h('dt', {}, 'Talles'), h('dd', {}, TALLES.filter(([k]) => x.talles[k]).map(([k, t]) => `${t}: ${x.talles[k]}`).join('\n'))] : [],
      x.gustos ? [h('dt', {}, 'Le gusta'), h('dd', {}, x.gustos.join(', '))] : [],
      [['personajes', 'Personajes favoritos'], ['preferencias', 'Preferencias'], ['recibir', 'Le gustaría recibir'], ['evitar', 'Prefiere evitar'], ['pistas', 'Otra pista']]
        .map(([k, t]) => x[k] ? [h('dt', {}, t), h('dd', {}, x[k])] : [])))));
}

async function pantallaRegalo(id, persona, vigente) {
  const sesion = sesiones.find((s) => s.id === id && s.persona === persona && !s.admin);
  if (!sesion) return ir(`#/g/${id}/elegir`);
  cargando();
  const acceso = { id, token: sesion.token };
  let yo;
  try {
    yo = await pedir('yo', acceso);
  } catch (error) {
    if (error.sinAcceso) olvidar(id, persona);
    throw error;
  }
  if (!vigente()) return;
  recordar({ ...sesion, nombre: yo.nombre, encuentro: yo.evento.nombre, fecha: yo.evento.fecha });
  const editable = yo.editable !== false;
  const especiales = yo.especiales || [];

  /** Descubrir y ocultar el regalo propio o el de un menor a cargo. */
  function zonaRegalo(quien, esOtro) {
    const zona = h('div', { style: 'display: flex; flex: 1' });
    const caja = (...hijos) => zona.replaceChildren(h('div', { class: 'caja entra' }, hijos));
    const dib = (estilo) => NAVIDAD.decoracion ? imagen('flota', NAVIDAD.regalo, estilo) : null;

    function cerrado() {
      const aviso = zonaAviso();
      let reloj;
      const abrir = () => ejecutar(boton, aviso, async () => {
        boton.classList.remove('tocando');
        mostrarRegalos(await pedir('descubrir', { ...acceso, persona: quien.persona }));
      });
      const soltar = () => { clearTimeout(reloj); boton.classList.remove('tocando'); };
      const boton = h('button', {
        type: 'button', class: 'boton mantener',
        onpointerdown: () => { if (boton.disabled) return; boton.classList.add('tocando'); clearTimeout(reloj); reloj = setTimeout(abrir, 900); },
        onpointerup: soltar, onpointerleave: soltar, onpointercancel: soltar, oncontextmenu: (e) => e.preventDefault(),
        onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); abrir(); } }
      }, h('i'), h('span', {}, 'Mantener para revelar'));
      caja(dib(), h('h2', {}, esOtro ? `La asignación de ${quien.nombre} está lista` : 'Tu asignación está lista'),
        h('p', { class: 'suave chico' }, 'Revelala cuando estés en un lugar privado.'),
        boton, aviso,
        enlace('Revelar más adelante', () => caja(dib('width: 64px'), h('p', {}, 'Tu sorpresa te espera acá.'), h('button', { type: 'button', class: 'segundo', onclick: cerrado }, 'Quiero verla'))));
    }

    function mostrarRegalos(lista) {
      const hayEspecial = lista.some((r) => r.especial) || (!esOtro && especiales.length);
      caja(rafaga(), lista.map((r) => h('div', { class: 'regalo' },
        h('p', { class: r.especial ? 'violeta' : 'suave' }, hayEspecial ? (r.especial ? 'Regalo especial' : 'Regalo del sorteo') : 'Le regalás a'),
        h('p', { class: 'nombre' }, r.nombre),
        verPistas(r.pistas || [], r.nombre))),
        enlace('Ocultar', cerrado));
    }

    if (quien.regala) cerrado();
    else caja(dib(), h('p', {}, !yo.sorteado ? 'Todavía no se hizo el sorteo.'
      : esOtro ? `${quien.nombre} es destinatario adicional: recibe un regalo y no tiene asignación propia.` : 'Sos destinatario adicional: recibís un regalo y no tenés asignación propia.'));
    return zona;
  }

  /** Los especiales no son sorpresa para quien los da: se ven aparte del sorteo. */
  const filaEspecial = (r) => h('button', {
    type: 'button', class: 'especial', onclick: () => ventana('Regalo especial', h('p', { class: 'nombre' }, r.nombre), verPistas(r.pistas || [], r.nombre))
  }, imagen('flota', NAVIDAD.regaloAzul), h('span', {}, h('b', {}, r.nombre), h('span', { class: 'chico violeta' }, 'Regalo especial')), icono('seguir'));

  /* Cada persona tiene su regalo (izquierda) y su lista (derecha). Cambiar no pierde lo escrito. */
  const izquierda = h('div', { style: 'display: flex; flex-direction: column; flex: 1' });
  const derecha = h('div');
  const barra = h('div', { class: 'acciones', role: 'tablist', 'aria-label': 'Hijos', hidden: true });
  const vacio = h('p', { class: 'suave', hidden: true }, 'Todavía no hay menores a tu cargo.');
  const fichas = []; // { quien, regalo, lista, boton }

  function agregarFicha(quien, regalo, lista, rotulo) {
    const f = { quien, regalo, lista };
    if (rotulo !== undefined) {
      f.boton = h('button', { type: 'button', class: 'enlace', role: 'tab', onclick: () => elegir(f) }, rotulo);
      barra.insertBefore(f.boton, sumar);
    }
    if (regalo) izquierda.append(regalo);
    derecha.append(lista);
    fichas.push(f);
    return f;
  }
  function elegir(f) {
    vacio.hidden = true;
    for (const x of fichas) {
      x.lista.hidden = x !== f;
      x.boton?.setAttribute('aria-selected', String(x === f));
      if (x.regalo) x.regalo.hidden = x !== (f.regalo ? f : fichas[0]);
    }
  }

  /** Menor que no entra al sorteo: vive en la lista de su adulto. */
  function fichaHijo(hijo) {
    let idPerfil = hijo.id || 'nuevo';
    const aviso = zonaAviso();
    const cerrar = () => {
      f.boton.remove();
      f.lista.remove();
      fichas.splice(fichas.indexOf(f), 1);
      paraHijos();
    };
    const quitar = enlace('Quitar', (ev) => {
      if (idPerfil === 'nuevo') return cerrar();
      if (!confirm('¿Quitar este perfil y sus deseos?')) return;
      ejecutar(ev.currentTarget, aviso, async () => {
        await pedir('quitarPerfil', { ...acceso, perfil: idPerfil });
        cerrar();
      });
    });
    const f = agregarFicha(hijo, null, h('div', {},
      formularioPerfil(hijo, true, editable, async (datos, nombre) => {
        const r = await pedir('guardarPerfil', { ...acceso, perfil: idPerfil, nombre, datos });
        idPerfil = r.perfil;
        f.boton.textContent = nombre;
      }, () => pedir('dejarDeCompartir', { ...acceso, perfil: idPerfil }),
      h('div', { class: 'grupo' }, campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: hijo.nombre })),
        h('p', { class: 'chico suave' }, 'A cargo de un adulto. Responsable: vos. Sus pistas las ve quien te regala a vos, solo si las compartís.'))),
      editable ? quitar : null, aviso), hijo.nombre || 'Nuevo menor a cargo');
    f.esNuevo = () => idPerfil === 'nuevo';
    return f;
  }

  const sumar = h('button', {
    type: 'button', class: 'enlace', hidden: !(yo.puedeSumarHijos && editable), onclick: () => {
      const f = fichas.find((x) => x.esNuevo?.()) || fichaHijo(leerPerfil({}));
      elegir(f);
      f.lista.querySelector('input').focus();
    }
  }, '+ Agregar');
  barra.append(sumar);
  const propia = agregarFicha(yo, zonaRegalo(yo, false), h('div', {}, formularioPerfil(leerPerfil(yo.lista || yo.deseos), false, editable,
    (datos) => pedir('guardarPerfil', { ...acceso, persona: yo.persona, datos }), () => pedir('dejarDeCompartir', { ...acceso, persona: yo.persona }))));
  for (const n of yo.aCargo) {
    agregarFicha(n, n.regala ? zonaRegalo(n, true) : null, h('div', {}, formularioPerfil(leerPerfil(n.lista || n.deseos), true, editable,
      (datos) => pedir('guardarPerfil', { ...acceso, persona: n.persona, datos }), () => pedir('dejarDeCompartir', { ...acceso, persona: n.persona }))), n.nombre);
  }
  leerPerfil(yo.lista).hijos.forEach(fichaHijo);
  derecha.append(vacio);
  function paraMi() { barra.hidden = true; elegir(propia); }
  function paraHijos() {
    const primera = fichas[1];
    barra.hidden = false;
    if (primera) return elegir(primera);
    for (const f of fichas) f.lista.hidden = true;
    vacio.hidden = false;
  }
  const conHijos = fichas.length > 1 || (yo.puedeSumarHijos && editable);
  elegir(propia);

  function avisoMail() {
    const aviso = zonaAviso();
    const caja = h('div', { class: 'tarjeta calido' },
      h('p', {}, `Quien organiza propone cambiar tu mail a ${yo.mailPropuesto}. Confirmalo solo si es tuyo.`),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'segundo', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
            const r = await pedir('confirmarMail', { ...acceso, mail: yo.mailPropuesto });
            acceso.token = r.token;
            recordar({ id, persona: r.persona, nombre: r.nombre, token: r.token, encuentro: yo.evento.nombre, fecha: yo.evento.fecha });
            caja.replaceChildren(h('p', { class: 'verde' }, 'Tu mail se actualizó. El link anterior ya no sirve.'));
          })
        }, 'Es mi mail, confirmar'),
        enlace('Rechazar', (ev) => ejecutar(ev.currentTarget, aviso, async () => {
          await pedir('rechazarMail', acceso);
          caja.remove();
        }))),
      aviso);
    return caja;
  }

  montar(h('div', { class: 'marco vidrio entra mio' },
    h('header', { class: 'cab' }, marcaNavidad(),
      h('div', { class: 'acciones' },
        enlace(`${yo.evento.nombre} · ${fechaCorta(yo.evento.fecha)}`, () => ventana(yo.evento.nombre, h('p', { class: 'suave' }, 'Organiza ' + yo.organizador + '.'), datosEvento(yo.evento), calendario(yo.evento))),
        enlace('Salir', () => { olvidar(id, persona); ir('#/'); }))),
    h('main', {},
      h('div', { class: 'columna' },
        h('h1', {}, 'Hola, ' + yo.nombre),
        yo.reinicio ? h('p', { class: 'ambar chico' }, `Tu acceso se reinició el ${fechaCorta(yo.reinicio)} a las ${yo.reinicio.slice(11)}. Si no lo pediste, consultale a quien organiza.`) : null,
        yo.mailPropuesto ? avisoMail() : null,
        izquierda,
        especiales.map(filaEspecial)),
      h('div', { class: 'columna' },
        h('div', {}, h('h2', {}, 'Contale a yori qué te gusta'), h('p', { class: 'suave chico' }, 'Todo es opcional.')),
        conHijos ? segmento('para', [['yo', 'Para mí', 'persona'], ['hijos', 'Para mis hijos', 'personas']], 'yo', (v) => v === 'yo' ? paraMi() : paraHijos()) : null,
        barra,
        derecha))));
}

navegar();
