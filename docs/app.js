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
const icono = (nombre) => dibujo('icono', ICONOS[nombre]);
const marca = () => h('a', { class: 'marca', href: '#/' }, dibujo('', MARCA.simbolo), MARCA.nombre);
const marcaNavidad = () => {
  const el = marca();
  if (NAVIDAD.decoracion) el.append(dibujo('destellos', NAVIDAD.destellos));
  return el;
};
const pie = () => h('footer', { class: 'pie' }, MARCA.firma);

function montar(...partes) {
  raiz.replaceChildren(...partes.flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
}

/** Pantalla simple, con la identidad general. */
function mostrar(...hijos) {
  montar(h('header', { class: 'cabecera' }, marca()), h('main', { class: 'angosto' }, hijos), pie());
}

/** Pantalla de participante, con la ambientación de la experiencia. */
function mostrarNavidad(titulo, bajada, ...hijos) {
  montar(
    h('header', { class: 'navidad' },
      h('div', { class: 'barra' }, marcaNavidad()),
      h('div', { class: 'titular' }, h('h1', {}, titulo), bajada ? h('p', {}, bajada) : null)),
    h('main', { class: 'angosto' }, hijos), pie());
}

/** Menú lateral y contenido. */
function conMenu(menu, ...hijos) {
  montar(h('div', { class: 'marco' },
    h('aside', { class: 'lateral' }, marca(), menu, h('p', { class: 'firma' }, MARCA.firma)),
    h('main', { class: 'contenido' }, hijos)));
}
const itemMenu = (nombre, texto, atributos) =>
  h(atributos.href ? 'a' : 'button', { class: 'item', ...(atributos.href ? {} : { type: 'button' }), ...atributos }, icono(nombre), h('span', {}, texto));

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

const campo = (texto, control) => h('label', {}, texto, control);
const enviar = (texto) => h('button', { type: 'submit' }, texto);
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
    else pantallaInicio();
  } catch (error) {
    if (!vigente()) return;
    mostrar(
      h('h1', {}, 'No pudimos entrar'),
      h('p', {}, error.message),
      error.sinAcceso
        ? h('p', { class: 'suave' }, 'Si entrabas con el link de tu mail, pedí uno nuevo desde el link del grupo.',
          ...(ruta === 'm' ? [' ', h('a', { href: `#/g/${id}/elegir` }, 'Ir al grupo'), '.'] : []))
        : h('button', { type: 'button', onclick: navegar }, 'Reintentar')
    );
  }
}
window.addEventListener('hashchange', navegar);

function cargando() { mostrar(h('p', { class: 'suave' }, 'Cargando…')); }

/* ---------- Portal ---------- */

const CONEXIONES_PORTAL = '<svg viewBox="0 0 240 260" aria-hidden="true"><defs><linearGradient id="cx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0090FF"/><stop offset="1" stop-color="#A855F7"/></linearGradient></defs><g fill="none" stroke="url(#cx)" stroke-width="3" stroke-linecap="round"><path d="M30 50C80 50 80 130 120 130S160 50 210 50"/><path d="M30 130.100H210V130"/><path d="M30 210C80 210 80 130 120 130S160 210 210 210"/></g><g fill="#0090FF"><circle cx="30" cy="50" r="9"/><circle cx="30" cy="130" r="9"/><circle cx="30" cy="210" r="9"/></g><g fill="#A855F7"><circle cx="210" cy="50" r="9"/><circle cx="210" cy="130" r="9"/><circle cx="210" cy="210" r="9"/></g><circle cx="120" cy="130" r="20" fill="url(#cx)"/></svg>';

const PROXIMAS = [
  ['Cumpleaños', 'Regalos y festejo compartido.'],
  ['Celebración familiar', 'Almuerzos y aniversarios.'],
  ['Dinámica de equipo', 'Integración y reconocimiento.'],
  ['Encuentro corporativo', 'Cierres de año y eventos.']
];

function pantallaInicio() {
  const paso = (nombre, titulo, texto) => h('div', { class: 'tarjeta' }, icono(nombre), h('h3', {}, titulo), h('p', { class: 'chico suave' }, texto));
  conMenu(
    h('nav', { 'aria-label': 'Principal' },
      h('p', { class: 'grupo' }, 'Menú'),
      itemMenu('inicio', 'Inicio', { href: '#/', 'aria-current': 'page' }),
      itemMenu('personas', NAVIDAD.nombre, { href: '#/navidad' })),
    h('p', { class: 'ruta' }, 'Inicio'),
    h('h1', {}, MARCA.lema),
    h('p', { class: 'suave' }, 'Elegí una experiencia y reuní a tu gente.'),
    h('section', { class: 'tarjetas' },
      h('div', { class: 'tarjeta ancha destacada' },
        dibujo('dibujo', CONEXIONES_PORTAL),
        h('div', { class: 'datos' },
          h('p', { class: 'chico suave' }, 'Experiencia destacada'),
          h('p', { class: 'titulo' }, NAVIDAD.nombre),
          h('p', {}, NAVIDAD.etiqueta),
          h('p', { class: 'chico suave' }, 'Amigo Invisible: cada persona descubre solo a quién le regala.'),
          h('a', { class: 'boton', href: '#/navidad' }, 'Entrar'))),
      sesiones.length ? h('div', { class: 'tarjeta' },
        h('h3', {}, 'Seguir como'),
        h('div', {}, sesiones.map((s) => h('div', { class: 'renglon' },
          h('button', { type: 'button', class: 'persona', onclick: () => ir(`#/m/${s.id}/${s.persona}`) }, h('span', {}, s.nombre), icono('seguir'))))),
        h('p', { class: 'chico suave' }, 'Recordados en este dispositivo')) : null),
    h('section', {},
      h('h2', {}, 'Próximamente'),
      h('div', { class: 'proximas' }, PROXIMAS.map(([nombre, texto]) =>
        h('div', { class: 'tarjeta' }, h('h3', {}, nombre), h('p', { class: 'chico' }, texto))))),
    h('section', { class: 'pasos' },
      h('h2', {}, 'Cómo funciona'),
      h('div', { class: 'tarjetas' },
        paso('resumen', 'Elegís', 'Entrás a la experiencia de tu encuentro.'),
        paso('invitar', 'Invitás', 'Sumás a las personas y compartís un link.'),
        paso('compartir', 'Compartís', 'Cada persona vive su parte desde el celular.'))));
}

/* ---------- Experiencia: Sorteo Navideño ---------- */

function proximaFecha() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  return (new Date(`${anio}-${NAVIDAD.fecha}T23:59:59`) >= hoy ? anio : anio + 1) + '-' + NAVIDAD.fecha;
}

function pantallaNavidad() {
  const aviso = zonaAviso();
  const crear = h('main', { class: 'angosto' },
    h('h2', {}, 'Creá tu sorteo'),
    h('p', { class: 'suave' }, 'Amigo Invisible: cada persona le regala a otra.'),
    formulario(aviso, async (d) => {
      await pedir('crear', { ...d, acepta: d.acepta === 'on' });
      mostrarNavidad('Revisá tu mail', null,
        h('p', {}, 'Te enviamos un link privado a ', d.mail.trim(), '. Abrilo para cargar a las personas y hacer el sorteo.'),
        h('p', { class: 'suave' }, 'Si no llega, buscalo en correo no deseado.'));
    },
      campo('Nombre del encuentro', h('input', { name: 'encuentro', maxlength: 60, autocomplete: 'off', value: 'Navidad en familia' })),
      h('div', { class: 'dos' },
        campo('Fecha', h('input', { class: 'num', type: 'date', name: 'fecha', value: proximaFecha() })),
        campo('Presupuesto (opcional)', h('input', { class: 'num', type: 'number', name: 'presupuesto', min: 0, step: '0.01', inputmode: 'decimal' }))),
      h('div', { class: 'dos' },
        campo('Tu nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'name' })),
        campo('Tu mail', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'email' }))),
      h('details', {},
        h('summary', {}, 'Aviso de privacidad'),
        h('p', {}, 'Guardamos solo los nombres, teléfonos, mails y listas de deseos que se carguen, y los usamos únicamente para este sorteo. Los mails se envían a través de Google. La fila del sorteo se elimina de la planilla 30 días después del evento.'),
        h('p', {}, 'Quien organiza ve con qué mail entró cada persona y quién ya vio su regalo. En una emergencia, puede ver el sorteo completo.'),
        h('p', {}, 'Cargá solo a personas que estén de acuerdo. De los niños, alcanza con el nombre de pila.')),
      opcion({ type: 'checkbox', name: 'acepta' }, 'Leí y acepto el aviso de privacidad'),
      aviso,
      enviar('Crear sorteo')));
  montar(
    h('header', { class: 'navidad' },
      h('div', { class: 'barra' }, marcaNavidad(), h('a', { href: '#/' }, 'Volver al portal')),
      h('div', { class: 'heroe' },
        h('div', {},
          h('p', { class: 'etiqueta' }, NAVIDAD.etiqueta),
          h('h1', {}, NAVIDAD.nombre),
          h('p', {}, NAVIDAD.frase),
          h('a', { class: 'boton', href: '#/navidad', onclick: (e) => { e.preventDefault(); crear.scrollIntoView({ behavior: 'smooth' }); crear.querySelector('input').focus({ preventScroll: true }); } }, 'Crear sorteo')),
        NAVIDAD.decoracion ? dibujo('portada', NAVIDAD.lazo) : null)),
    crear, pie());
}

/* ---------- Quien organiza ---------- */

async function pantallaAdmin(id, token, vigente) {
  cargando();
  let s = await pedir('admin', { id, token });
  if (!vigente()) return;

  let cola = Promise.resolve(); // las acciones van de a una, en orden
  const pedirAdmin = (accion, datos) => {
    const turnoEnCola = cola.then(() => pedir(accion, { id, token, ...datos }));
    cola = turnoEnCola.catch(() => {});
    return turnoEnCola;
  };
  let eventoSinGuardar = '';
  const zonas = { resumen: h('div'), personas: h('div'), exclusiones: h('div'), evento: h('div') };
  const titulos = { resumen: 'Resumen', personas: 'Personas', exclusiones: 'Exclusiones', evento: 'Evento' };
  const botones = {};
  const ruta = h('p', { class: 'ruta' });
  function ver(cual) {
    for (const z in zonas) {
      zonas[z].hidden = z !== cual;
      if (z === cual) botones[z].setAttribute('aria-current', 'page'); else botones[z].removeAttribute('aria-current');
    }
    ruta.textContent = `${NAVIDAD.nombre} / ${titulos[cual]}`;
    window.scrollTo(0, 0);
  }
  const abierto = () => s.estado === 'abierto';
  const nombreDe = (pid) => s.personas.find((p) => p.id === pid)?.nombre || '';

  async function cambiar(accion, datos) {
    const antes = s.estado;
    s = await pedirAdmin(accion, datos);
    if (!vigente()) return;
    fallaMatriz = '';
    pintar(antes !== s.estado);
  }

  function pintar(todo) {
    if (todo) pintarEvento();
    pintarPersonas();
    pintarExclusiones();
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
        pintarExclusiones();
        pintarResumen();
      } catch (error) {
        eventoSinGuardar = error.message;
        aviso.decir(error.message, 'rojo');
      }
    };
    const form = h('form', { onsubmit: (ev) => ev.preventDefault(), onchange: guardar },
      campo('Nombre del encuentro', h('input', { name: 'encuentro', maxlength: 60, autocomplete: 'off', value: e.nombre })),
      h('div', { class: 'dos' },
        campo('Fecha', h('input', { class: 'num', type: 'date', name: 'fecha', value: e.fecha })),
        campo('Presupuesto (opcional)', h('input', { class: 'num', type: 'number', name: 'presupuesto', min: 0, step: '0.01', inputmode: 'decimal', value: e.presupuesto === null ? '' : e.presupuesto.toFixed(2) }))),
      campo('Mensaje (opcional)', h('textarea', { name: 'mensaje', maxlength: 300, value: e.mensaje })),
      h('fieldset', {},
        h('legend', {}, 'Cómo se reparten los regalos'),
        opcion({ type: 'radio', name: 'modalidad', value: 'A', checked: e.modalidad === 'A' }, 'Cada uno con su grupo: adulto con adulto, niño con niño'),
        opcion({ type: 'radio', name: 'modalidad', value: 'B', checked: e.modalidad === 'B' }, 'Adulto y niño: cada adulto regala a un adulto y a un niño. Los niños solo reciben')),
      aviso);
    if (abierto()) zonas.evento.replaceChildren(h('h1', {}, 'Evento'), form);
    else zonas.evento.replaceChildren(h('h1', {}, 'Evento'), datosEvento(e));
  }

  function camposPersona(p) {
    const adultos = s.personas.filter((x) => x.tipo === 'adulto' && x.id !== p.id).map((x) => [x.id, x.nombre]);
    const gestiona = selector({ name: 'responsable', onchange: () => acomodar() }, [['', 'Sin responsable, entra por su cuenta'], ...adultos], p.responsable || '');
    const responsable = campo('Responsable', gestiona);
    const tipo = selector({ name: 'tipo', onchange: () => acomodar() }, [['adulto', 'Adulto'], ['nino', 'Niño']], p.tipo || 'adulto');
    const telefono = campo('Teléfono, con código de área (opcional con mail)', h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'off', value: p.telefono || '' }));
    const correo = campo('Mail, ahí recibe su link y su PIN', h('input', { name: 'correo', type: 'email', maxlength: 100, autocomplete: 'off', value: p.correo || '' }));
    const elegirAdulto = (nombre, texto, valor) => campo(texto, selector({ name: nombre }, [['', 'Sin indicar'], ...adultos], valor || ''));
    const pareja = elegirAdulto('pareja', 'Pareja (opcional)', p.pareja);
    const padres = h('div', { class: 'dos' }, [0, 1].map((i) => elegirAdulto('padre' + (i + 1), 'Madre / Padre (opcional)', (p.padres || [])[i])));
    const acomodar = () => {
      pareja.hidden = tipo.value === 'nino' || !adultos.length;
      padres.hidden = tipo.value !== 'nino' || !adultos.length;
      correo.hidden = tipo.value === 'nino' && gestiona.value !== '';
      responsable.hidden = tipo.value !== 'nino';
      telefono.hidden = tipo.value === 'nino' && gestiona.value !== '';
    };
    acomodar();
    return [
      h('div', { class: 'dos' },
        campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre || '' })),
        campo('Es', tipo)),
      responsable, correo, telefono, pareja, padres
    ];
  }

  const regala = (p) => s.evento.modalidad === 'A' || p.tipo === 'adulto';

  function sinValidar(p) {
    if (p.envio === 'error') return ['No se pudo enviar el mail', 'rojo'];
    if (p.envio === 'enviado') return ['PIN enviado, todavía no validó', 'ambar'];
    return [p.correo ? 'Falta enviarle el PIN' : 'Todavía no validó', 'ambar'];
  }

  function estadoPersona(p) {
    if (!abierto()) {
      if (regala(p) && p.vio) return [p.responsable ? 'Su regalo ya se vio' : 'Vio su regalo', 'verde'];
      if (!regala(p)) return p.responsable ? ['A cargo de un adulto', 'suave'] : p.validada ? ['Validó', 'verde'] : sinValidar(p);
      if (p.responsable) return ['Todavía no se vio su regalo', 'ambar'];
      if (!p.validada) return sinValidar(p);
      if (p.envio === 'error') return ['Validó, pero no se pudo enviar el link', 'rojo'];
      return ['Entró, todavía no vio su regalo', 'ambar'];
    }
    if (p.responsable) return ['A cargo de un adulto', 'suave'];
    return p.validada ? ['Validó', 'verde'] : sinValidar(p);
  }

  function relacionesDe(p) {
    return [p.pareja ? 'Pareja: ' + nombreDe(p.pareja) : '',
      p.padres.length ? 'Madre / Padre: ' + p.padres.map(nombreDe).join(' y ') : ''].filter(Boolean).join(' · ');
  }

  function filaPersona(p) {
    const li = h('li');
    const ver = () => {
      const aviso = zonaAviso();
      const [texto, clase] = estadoPersona(p);
      const accion = (nombre, pregunta, cual) => enlace(nombre, (ev) => {
        if (pregunta && !confirm(pregunta)) return;
        ejecutar(ev.target, aviso, () => cambiar(cual, { persona: p.id }));
      });
      li.replaceChildren(
        h('div', { class: 'fila' },
          h('div', {},
            h('p', {}, p.nombre),
            h('p', { class: 'chico suave' }, (p.tipo === 'adulto' ? 'Adulto' : regala(p) ? 'Participante menor de edad' : 'Destinatario adicional') + (p.responsable ? ' · Responsable: ' + nombreDe(p.responsable) : [p.correo || p.mail, p.telefono].filter(Boolean).map((x) => ' · ' + x).join('') + (!p.validada ? '' : ` · validó el ${fechaCorta(p.validada)} a las ${p.validada.slice(11)}`))),
            relacionesDe(p) ? h('p', { class: 'chico suave' }, relacionesDe(p)) : null,
            p.mailPropuesto ? h('p', { class: 'chico ambar' }, `Cambio de mail a ${p.mailPropuesto}: falta que lo confirme desde Mi regalo.`) : null,
            h('p', { class: 'chico ' + clase }, texto)),
          h('div', { class: 'acciones' },
            abierto() ? enlace('Editar', editar) : null,
            abierto() ? accion('Quitar', `¿Quitar a ${p.nombre}?`, 'quitarPersona') : null,
            !abierto() && !p.validada && !p.responsable ? enlace('Corregir datos', corregir) : null,
            p.correo && !p.validada ? accion(p.envio === 'enviado' ? 'Reenviar PIN' : 'Enviar PIN', '', 'invitar') : null,
            !abierto() && p.validada ? accion('Reenviar link', '', 'reenviar') : null,
            p.validada ? enlace('Corregir mail', corregirMail) : null,
            p.validada ? accion('Liberar', `¿Liberar el nombre de ${p.nombre}? Se corta el acceso de ${p.mail}. Se borran su lista y las de todos los menores a su cargo.`, 'liberar') : null)),
        aviso);
    };
    const editar = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => {
        const gestor = d.tipo === 'nino' ? d.responsable : '';
        const vaciar = !!p.responsable && gestor !== p.responsable;
        if (vaciar && !confirm(`Cambia quién accede a ${p.nombre}. Si tiene deseos cargados, se borran. ¿Seguir?`)) return;
        return cambiar('editarPersona', { persona: p.id, ...d, vaciar });
      },
        ...camposPersona(p), aviso,
        h('div', { class: 'acciones' }, enviar('Guardar'), enlace('Cancelar', ver))));
    };
    const corregirMail = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => cambiar('proponerMail', { persona: p.id, mail: d.mail }),
        campo('Mail nuevo de ' + p.nombre, h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'off', value: p.mailPropuesto })),
        h('p', { class: 'chico suave' }, 'Cambia recién cuando lo confirma desde su Mi regalo. No se pierde ningún dato.'), aviso,
        h('div', { class: 'acciones' }, enviar('Proponer cambio'), enlace('Cancelar', ver))));
    };
    const corregir = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => cambiar('corregirTelefono', { persona: p.id, correo: d.correo, telefono: d.telefono }),
        campo('Mail de ' + p.nombre, h('input', { name: 'correo', type: 'email', maxlength: 100, autocomplete: 'off', value: p.correo })),
        campo('Teléfono de ' + p.nombre, h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'off', value: p.telefono })), aviso,
        h('div', { class: 'acciones' }, enviar('Guardar'), enlace('Cancelar', ver))));
    };
    ver();
    return li;
  }

  function pintarPersonas() {
    const aviso = zonaAviso();
    zonas.personas.replaceChildren(
      h('h1', {}, 'Personas' + (s.personas.length ? ` (${s.personas.length})` : '')),
      ...(s.personas.length ? [h('ul', {}, s.personas.map(filaPersona))] : []),
      ...(abierto() ? [
        formulario(aviso, async (d) => {
          await cambiar('agregarPersona', d);
          zonas.personas.querySelector(':scope > form input[name=nombre]')?.focus();
        },
          ...camposPersona({}),
          h('p', { class: 'chico suave' }, 'Con mail, recibe su link y su PIN. Sin mail, entra escribiendo este teléfono y su propio mail. Al validar, nadie más puede entrar con ese nombre. Si participás, sumate.'),
          aviso, enviar('Agregar persona'))
      ] : []));
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
    const renglon = (x, texto, ...botones) => h('div', { class: 'fila renglon' },
      h('div', {}, h('p', {}, `${nombreDe(x.de)} y ${nombreDe(x.a)}`), h('p', { class: 'chico suave' }, texto)), h('div', { class: 'acciones' }, botones));
    if (!s.propuestas.length && !s.sinRelacion.length) return null;
    return h('div', { class: 'tarjeta revisar' },
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
    const ejemplo = h('div', { class: 'ejemplo' });
    celdas.clear();
    const filas = s.personas.filter((de) => s.personas.some((a) => aplica(de, a)));
    const celda = (de, a) => {
      if (!aplica(de, a)) return h('td', {}, h('span', { 'aria-label': 'No corresponde' }, '—'));
      if (!abierto()) return h('td', {}, h('span', {}, guardada(de.id, a.id) ? '✕' : '○'));
      const boton = h('button', { type: 'button', onclick: () => alternar(de, a) });
      celdas.set(de.id + '>' + a.id, boton);
      pintarCelda(boton, de, a);
      return h('td', {}, boton);
    };
    zonas.exclusiones.replaceChildren(...[
      h('h1', {}, 'Exclusiones'),
      h('p', { class: 'suave' }, !filas.length ? 'Agregá personas para ver los cruces.' : abierto() ? 'Opcional. La fila regala, la columna recibe. Tocá un cruce para bloquearlo o permitirlo en los dos sentidos.' : 'El sorteo está hecho: las exclusiones quedan fijas.'),
      filas.length ? h('p', { class: 'chico suave' }, s.propuestas.length ? '○ permitido · ✕ excluido · ? propuesta sin revisar · — no corresponde' : '○ permitido · ✕ excluido · — no corresponde') : null,
      revisar(aviso),
      filas.length ? h('div', { class: 'matriz', tabindex: 0, role: 'region', 'aria-label': 'Matriz de exclusiones' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Regala'), s.personas.map((a) => h('th', { scope: 'col' }, a.nombre)))),
        h('tbody', {}, filas.map((de) => h('tr', {}, h('th', { scope: 'row' }, de.nombre), s.personas.map((a) => celda(de, a))))))) : null,
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
              ...lista.map((x) => h('div', { class: 'renglon' }, h('span', {}, x.nombre), h('span', {}, 'le regala a ' + x.regalaA.join(' y ')))));
          })
        }, 'Simular'),
        enlace('Limpiar exclusiones', (ev) => {
          if (!confirm('¿Quitar todas las exclusiones?')) return;
          ejecutar(ev.currentTarget, aviso, async () => { await matrizLista(); await cambiar('limpiarExclusiones'); });
        })) : null,
      ejemplo].filter(Boolean));
    pintarEstadoMatriz();
  }

  /** Avance según el momento: antes del sorteo, quién entró; después, quién vio su regalo. */
  function avance() {
    const base = s.personas.filter((p) => abierto() ? !p.responsable : regala(p));
    const hecho = (p) => abierto() ? p.validada : p.vio;
    const contar = (lista) => [lista.filter(hecho).length, lista.length];
    const filas = [['En total', '#0F172A', contar(base)]];
    if (base.some((p) => p.tipo === 'nino')) {
      filas.push(['Adultos', '#0090FF', contar(base.filter((p) => p.tipo === 'adulto'))]);
      filas.push(['Niños', '#A855F7', contar(base.filter((p) => p.tipo === 'nino'))]);
    }
    return { titulo: abierto() ? 'Ya entraron' : 'Ya vieron su regalo', filas, faltan: base.filter((p) => !hecho(p)) };
  }

  function arcos(filas) {
    const trazos = ['M22 20A100 100 0 0 1 22 220', 'M22 52A68 68 0 0 1 22 188', 'M22 84A36 36 0 0 1 22 156'];
    const fondo = trazos.map((d) => `<path d="${d}" stroke="#EEF1F8"/>`).join('');
    const valores = filas.map(([, color, [n, total]], i) =>
      n ? `<path d="${trazos[i]}" stroke="${color}" pathLength="100" stroke-dasharray="${Math.round(n / total * 100)} 200"/>` : '').join('');
    const el = dibujo('', `<svg viewBox="0 0 170 240" aria-hidden="true"><g fill="none" stroke-width="18" stroke-linecap="round">${fondo}${valores}</g></svg>`);
    return el.firstChild;
  }

  function pintarResumen() {
    const e = s.evento;
    const a = avance();
    const aviso = zonaAviso();
    const conMail = s.personas.filter((p) => p.mail || p.correo).length;
    const sinValidar = s.personas.some((p) => !p.responsable && !p.validada && !p.correo);
    const nombres = a.faltan.map((p) => p.nombre).join(', ');
    const estado = !s.personas.length ? 'Empezá por agregar a las personas.'
      : !abierto() ? (a.faltan.length ? `El sorteo está hecho. ${a.faltan.length === 1 ? 'Falta 1 persona' : `Faltan ${a.faltan.length} personas`} por ver su regalo.` : 'El sorteo está hecho y todos vieron su regalo.')
        : a.faltan.length ? `${a.faltan.length === 1 ? 'Falta entrar 1 persona' : `Faltan entrar ${a.faltan.length} personas`}. Podés sortear igual.` : 'Está todo listo para sortear.';

    const sortear = h('button', {
      type: 'button', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
        await cola;
        await matrizLista();
        if (s.propuestas.length) throw new Error('Hay exclusiones propuestas sin revisar: aceptalas o descartalas en Exclusiones.');
        if (eventoSinGuardar) throw new Error('Revisá los datos del evento: ' + eventoSinGuardar);
        const partes = ['¿Hacer el sorteo? Después las personas quedan fijas.'];
        if (conMail) partes.push(`Se ${conMail === 1 ? 'envía 1 mail' : `envían ${conMail} mails`}.`);
        if (a.faltan.length) partes.push(`Todavía no entraron: ${nombres}.`);
        if (!confirm(partes.join(' '))) return;
        aviso.decir('Sorteando…', 'suave');
        await cambiar('sortear');
      })
    }, 'Sortear');
    const repetir = h('button', {
      type: 'button', class: 'segundo', onclick: (ev) => {
        if (!confirm('¿Anular el sorteo actual? Quienes ya vieron a quién le regalan van a tener otra persona.')) return;
        ejecutar(ev.currentTarget, aviso, () => cambiar('reabrir'));
      }
    }, 'Volver a sortear');
    const agregar = h('button', { type: 'button', onclick: () => ver('personas') }, 'Agregar personas');

    zonas.resumen.replaceChildren(...[
      h('div', { class: 'encabezado' },
        h('div', {}, h('h1', {}, 'Hola, ' + s.organizador), h('p', { class: 'suave' }, estado)),
        !s.personas.length ? agregar : abierto() ? sortear : repetir),
      aviso,
      h('div', { class: 'tarjetas' },
        a.filas[0][2][1] ? h('div', { class: 'tarjeta ancha arcos' },
          arcos(a.filas),
          h('div', { class: 'leyenda' }, h('h3', {}, a.titulo),
            a.filas.map(([texto, color, [n, total]]) => h('div', { class: 'dato', style: `--color:${color}` },
              h('span', {}, h('span', { class: 'cifra' }, `${n}/${total}`), h('span', { class: 'chico suave' }, texto))))))
          : h('div', { class: 'tarjeta ancha' }, h('h3', {}, 'Personas'),
            h('p', {}, h('span', { class: 'cifra' }, String(s.personas.length))),
            h('p', { class: 'chico suave' }, 'Todavía no hay personas cargadas.')),
        h('div', { class: 'columna' },
          h('div', { class: 'tarjeta fecha' },
            h('div', {}, h('h3', {}, 'Encuentro'), h('p', { class: 'chico suave' }, e.nombre)),
            h('div', { class: 'calendario' },
              h('span', {}, parteFecha(e.fecha, { weekday: 'long' })),
              h('span', { class: 'dia' }, parteFecha(e.fecha, { day: 'numeric' })),
              h('span', {}, parteFecha(e.fecha, { month: 'long' })))),
          h('div', { class: 'tarjeta' }, h('h3', {}, 'Presupuesto'),
            e.presupuesto !== null ? h('p', {}, h('span', { class: 'cifra' }, importe(e.presupuesto))) : null,
            h('p', { class: 'chico suave' }, e.presupuesto !== null ? 'Por regalo' : 'Sin definir')))),
      h('div', { class: 'tarjetas' },
        a.faltan.length ? h('div', { class: 'tarjeta ancha' },
          h('div', { class: 'fila' }, h('h3', {}, abierto() ? 'Falta que entren' : 'Falta que vean su regalo'),
            h('div', { class: 'acciones' }, enlace('Actualizar', (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('admin'))), enlace('Ver personas', () => ver('personas')))),
          h('div', {}, a.faltan.slice(0, 5).map((p) => {
            const [texto, clase] = estadoPersona(p);
            return h('div', { class: 'renglon' }, h('span', {}, p.nombre), h('span', { class: 'chico ' + clase }, texto));
          })),
          a.faltan.length > 5 ? h('p', { class: 'chico suave' }, `Y ${a.faltan.length - 5} más.`) : null)
          : s.personas.length ? h('div', { class: 'tarjeta ancha' }, h('h3', {}, 'Al día'), h('p', { class: 'suave' }, 'No falta nadie.'),
            enlace('Actualizar', (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('admin')))) : null,
        s.personas.length ? tarjetaCompartir() : null),
      sinValidar && !abierto() ? h('p', { class: 'chico ambar' }, 'Hay nombres sin validar: quien conozca su teléfono podría validarlos primero y ver ese regalo. Revisá en Personas quién entró.') : null,
      abierto() ? null : emergencia()].filter(Boolean));
  }

  /** Solo quien organiza: exige un PIN que llega a su mail y no queda en pantalla al salir. */
  function emergencia() {
    const aviso = zonaAviso();
    const zona = h('div');
    const cerrar = () => {
      aviso.decir('');
      zona.replaceChildren(h('button', { type: 'button', class: 'segundo', onclick: (ev) => {
        if (!confirm('¿Ver el sorteo completo? Vas a saber a quién le regala cada persona, incluso quién te regala a vos.')) return;
        ejecutar(ev.currentTarget, aviso, async () => {
          const r = await pedir('pedirEmergencia', { id, token });
          aviso.decir(`Te enviamos un PIN a ${r.mail}.`, 'verde');
          zona.replaceChildren(formulario(aviso, async (d) => {
            const lista = await pedir('verSorteo', { id, token, pin: d.pin });
            zona.replaceChildren(
              ...lista.map((x) => h('div', { class: 'renglon' }, h('span', {}, x.nombre), h('span', {}, 'le regala a ' + x.regalaA.join(' y ')))),
              h('button', { type: 'button', class: 'segundo', style: 'margin-top: 20px', onclick: cerrar }, 'Ocultar'));
          },
            campo('PIN', h('input', { class: 'num', name: 'pin', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code' })),
            h('div', { class: 'acciones' }, enviar('Ver sorteo completo'), enlace('Cancelar', cerrar))));
        });
      } }, 'Pedir PIN'));
    };
    cerrar();
    return h('details', { class: 'emergencia' },
      h('summary', {}, 'Acceso de emergencia'),
      h('p', {}, 'Muestra a quién le regala cada persona. Solo para quien organiza.'),
      zona, aviso);
  }

  function tarjetaCompartir() {
    const pendientes = s.personas.filter((p) => p.correo && !p.validada && p.envio !== 'enviado').length;
    const aviso = zonaAviso();
    const url = linkGrupo(id);
    const texto = abierto()
      ? `${s.evento.nombre}: entrá, tocá tu nombre y validá tu PIN. ${url}`
      : `¡Ya se hizo el sorteo de ${s.evento.nombre}! Entrá para ver a quién le regalás. ${url}`;
    return h('div', { class: 'tarjeta invitar' },
      h('h3', {}, abierto() ? 'Invitá a tu grupo' : 'Avisá que ya se sorteó'),
      pendientes ? h('button', { type: 'button', onclick: (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('invitar')) }, pendientes === 1 ? 'Enviar 1 invitación' : `Enviar ${pendientes} invitaciones`) : null,
      h('p', { class: 'chico' }, 'El link del grupo no revela nada del sorteo.'),
      h('div', { class: 'acciones' },
        h('a', { href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener' }, 'Compartir por WhatsApp'),
        enlace('Copiar invitación', async () => {
          const e = s.evento;
          const invitacion = [
            e.nombre,
            'Fecha: ' + fechaCorta(e.fecha),
            e.presupuesto !== null ? 'Presupuesto: ' + importe(e.presupuesto) : '',
            'Modalidad: Amigo Invisible, ' + (e.modalidad === 'A' ? 'cada uno con su grupo' : 'adulto y niño'),
            'Personas: ' + s.personas.length,
            e.mensaje,
            abierto() ? 'Entrá, tocá tu nombre y validá tu PIN:' : 'Ya se hizo el sorteo. Entrá para ver a quién le regalás:',
            url
          ].filter(Boolean).join('\n');
          try { await navigator.clipboard.writeText(invitacion); aviso.decir('Invitación copiada'); } catch { aviso.decir(invitacion, 'mensaje'); }
        }),
        enlace('Copiar link', async () => {
          try { await navigator.clipboard.writeText(url); aviso.decir('Link copiado'); } catch { aviso.decir(url); }
        })),
      aviso);
  }

  for (const [z, nombre] of [['resumen', 'resumen'], ['personas', 'personas'], ['exclusiones', 'exclusiones'], ['evento', 'evento']]) {
    botones[z] = itemMenu(nombre, titulos[z], { onclick: () => ver(z) });
  }
  conMenu(
    [h('nav', { 'aria-label': 'Sorteo' }, h('p', { class: 'grupo' }, NAVIDAD.nombre), Object.values(botones)),
      h('div', { class: 'aparte' }, itemMenu('volver', 'Volver al portal', { href: '#/' }))],
    ruta, ...Object.values(zonas));
  pintar(true);
  ver('resumen');
}

/* ---------- Participantes ---------- */

async function pantallaGrupo(id, extra, vigente) {
  const propias = sesiones.filter((s) => s.id === id);
  if (propias.some((s) => s.persona === extra)) return ir(`#/m/${id}/${extra}`);
  if (propias.length === 1 && !extra) return ir(`#/m/${id}/${propias[0].persona}`);
  cargando();
  const grupo = await pedir('grupo', { id });
  if (!vigente()) return;

  const elegida = grupo.personas.find((p) => p.id === extra);
  if (elegida) return pantallaPin(id, elegida);

  mostrarNavidad(grupo.encuentro, `${grupo.organizador} te invitó a participar.`,
    h('div', {},
      h('h2', {}, '¿Quién sos?'),
      grupo.personas.length
        ? h('ul', {}, grupo.personas.map((p) => {
          const recordada = propias.some((s) => s.persona === p.id);
          return h('li', {}, h('button', {
            type: 'button', class: 'persona',
            onclick: () => recordada ? ir(`#/m/${id}/${p.id}`) : pantallaPin(id, p)
          }, h('span', {}, p.nombre), h('span', { class: 'chico suave' }, recordada ? 'En este dispositivo' : p.validada ? 'Validado' : '')));
        }))
        : h('p', {}, 'Todavía no hay nombres para elegir.'),
      h('p', { class: 'chico suave' }, 'Si no ves tu nombre, consultale a quien organiza. Los menores pueden estar a cargo de un adulto.')));
}

function pantallaPin(id, p) {
  const aviso = zonaAviso();
  const zona = h('div');
  const otra = enlace('No soy ' + p.nombre, () => ir(`#/g/${id}/elegir`));
  if (p.validada) {
    mostrarNavidad('Hola, ' + p.nombre, null,
      h('p', { class: 'suave' }, 'Este nombre ya está validado y nadie más puede entrar con él. Si sos vos y cambiaste de dispositivo, te enviamos tu link al mail que validaste.'),
      h('button', {
        type: 'button', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
          const r = await pedir('pedirLink', { id, persona: p.id });
          aviso.decir(`Te enviamos el link a ${r.mail}.`, 'verde');
        })
      }, 'Enviarme mi link'),
      aviso, h('p', { class: 'chico suave', style: 'margin-top: 24px' }, 'Si no lo validaste vos, avisale a quien organiza.'), otra);
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
      h('div', { class: 'acciones' }, enviar('Validar y entrar'), p.conMail ? null : enlace('Cambiar mail o pedir otro PIN', () => { aviso.decir(''); pasoMail(); }))));
    zona.querySelector('input').focus();
  }
  if (p.conMail) pasoPin(); else pasoMail();
  mostrarNavidad('Hola, ' + p.nombre, null,
    h('p', { class: 'suave' }, p.conMail ? 'Escribí el PIN que recibiste por mail. Si no te llegó, revisá correo no deseado o consultale a quien organiza.' : 'Escribí tu teléfono y tu mail. Te enviamos un PIN al mail para validar que sos vos. Quien organiza ve con qué mail entraste. Este dispositivo te va a recordar.'),
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
  return h('div', {},
    h('dl', {},
      h('dt', {}, 'Fecha'), h('dd', {}, fechaCorta(e.fecha)),
      ...(e.presupuesto !== null ? [h('dt', {}, 'Presupuesto'), h('dd', {}, importe(e.presupuesto))] : []),
      ...(e.modalidad ? [h('dt', {}, 'Modalidad'), h('dd', {}, 'Amigo Invisible, ' + (e.modalidad === 'A' ? 'cada uno con su grupo' : 'adulto y niño'))] : [])),
    e.mensaje ? h('p', { class: 'mensaje' }, e.mensaje) : null);
}

/** Día completo, sin datos privados ni links de acceso. */
function calendario(e) {
  const dia = e.fecha.replaceAll('-', '');
  const fin = new Date(Date.parse(e.fecha) + 86400000).toISOString().slice(0, 10).replaceAll('-', '');
  const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.nombre) + `&dates=${dia}/${fin}`;
  const limpio = e.nombre.replace(/([\\;,])/g, '\\$1').replace(/\s+/g, ' ');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yori//ES', 'BEGIN:VEVENT', `UID:${dia}-${encodeURIComponent(e.nombre).slice(0, 30)}@yori`,
    `DTSTAMP:${dia}T000000Z`, `DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${fin}`, `SUMMARY:${limpio}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return h('div', { class: 'acciones' },
    h('span', { class: 'chico suave' }, 'Agregar al calendario:'),
    h('a', { class: 'chico', href: google, target: '_blank', rel: 'noopener' }, 'Google'),
    h('a', { class: 'chico', href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), download: 'encuentro.ics' }, 'Apple'));
}

/* ---------- Lista de deseos ---------- */

const TALLES = [['superior', 'Remeras, camisas'], ['inferior', 'Pantalones'], ['calzado', 'Calzado'], ['otro', 'Otro talle o característica']];
const GUSTOS = ['Decoración', 'Tecnología', 'Libros', 'Café', 'Belleza', 'Deportes', 'Plantas', 'Experiencias'];
const TEXTOS = [
  ['preferencias', 'Gustos y preferencias', 'Me gustan los colores neutros, los aromas cítricos y las cosas prácticas'],
  ['recibir', 'Cosas que me gustaría recibir', 'Una taza linda, una agenda, una planta'],
  ['evitar', 'Cosas que prefiero evitar', 'Perfumes dulces, ropa estampada'],
  ['pistas', 'Pistas adicionales', 'Cualquier detalle que ayude a elegir']
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

/** Formulario de un perfil: bloques plegados, todos opcionales. */
function formularioPerfil(perfil, editable, alGuardar, alRevocar, extra) {
  const aviso = zonaAviso();
  const bloque = (titulo, ...hijos) => h('details', { class: 'bloque' }, h('summary', {}, titulo), h('div', {}, hijos));
  const propios = perfil.gustos.filter((g) => !GUSTOS.includes(g));
  const cuenta = h('p', { class: 'chico suave' });
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
    bloque('Talles', h('div', { class: 'dos' }, TALLES.map(([k, texto]) => campo(texto, h('input', { name: 'talle-' + k, maxlength: 30, autocomplete: 'off', value: perfil.talles[k] }))))),
    bloque('Qué cosas me gustan',
      h('div', { class: 'gustos' }, GUSTOS.map((g) => opcion({ type: 'checkbox', name: 'gusto', value: g, checked: perfil.gustos.includes(g) }, g))),
      campo('Otros, separados por coma', h('input', { name: 'otros', maxlength: 200, autocomplete: 'off', value: propios.join(', ') }))),
    TEXTOS.map(([k, texto, ayuda]) => bloque(texto, h('textarea', { name: k, maxlength: MAX_TEXTO, 'aria-label': texto, placeholder: ayuda, value: perfil[k] }))),
    h('div', { class: 'cierre' },
      opcion({ type: 'checkbox', name: 'compartir', checked: perfil.compartir }, 'Compartir con quien me regala'),
      cuenta, aviso,
      editable ? enviar('Guardar') : h('p', { class: 'suave' }, 'El encuentro ya pasó: la lista no se puede editar.')));
  const contar = () => {
    const n = TEXTOS.reduce((suma, [k]) => suma + form.elements[k].value.trim().length, 0);
    cuenta.replaceChildren(...h('p', {}, `Textos: ${n} de ${MAX_TEXTO} caracteres`).childNodes);
    cuenta.className = 'chico ' + (n > MAX_TEXTO ? 'rojo' : 'suave');
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
  if (!pistas.length) return h('p', { class: 'suave' }, 'Todavía no dejó pistas. Podés volver más tarde o sorprender con algo simple.');
  return h('div', { class: 'pistas' }, pistas.map((x) => h('div', {},
    x.hijo ? h('h3', { style: 'margin-top: 24px' }, x.hijo + ', a cargo de ' + adulto) : null,
    h('dl', {},
      x.talles ? [h('dt', {}, 'Talles'), h('dd', {}, TALLES.filter(([k]) => x.talles[k]).map(([k, t]) => `${t}: ${x.talles[k]}`).join('\n'))] : [],
      x.gustos ? [h('dt', {}, 'Le gusta'), h('dd', {}, x.gustos.join(', '))] : [],
      [['preferencias', 'Preferencias'], ['recibir', 'Ideas de regalos'], ['evitar', 'Prefiere evitar'], ['pistas', 'Pistas']]
        .map(([k, t]) => x[k] ? [h('dt', {}, t), h('dd', {}, x[k])] : [])))));
}

async function pantallaRegalo(id, persona, vigente) {
  const sesion = sesiones.find((s) => s.id === id && s.persona === persona);
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

  /** Descubrir y ocultar el regalo propio o el de un niño a cargo. */
  function zonaRegalo(quien, esOtro) {
    const zona = h('div');
    const aviso = zonaAviso();
    function oculto() {
      aviso.decir('');
      const sello = h('div', { class: 'sello' },
        NAVIDAD.decoracion ? dibujo('lazo', NAVIDAD.lazo) : null,
        h('p', { class: 'suave' }, esOtro ? `Acá está a quién le regala ${quien.nombre}.` : 'Tu asignación está lista. Que nadie mire tu pantalla.'),
        aviso,
        h('button', {
          type: 'button', class: 'encender', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
            const lista = await pedir('descubrir', { ...acceso, persona: quien.persona });
            sello.classList.add('abierto');
            if (NAVIDAD.decoracion && !matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise((listo) => setTimeout(listo, 1000));
            zona.replaceChildren(h('div', { class: 'sello' },
              NAVIDAD.decoracion ? rafaga() : null,
              ...lista.map((r) => h('div', { class: 'regalo' },
                h('p', { class: 'nombre' }, r.nombre),
                verPistas(r.pistas || [], r.nombre))),
              h('button', { type: 'button', class: 'segundo', onclick: oculto }, 'Ocultar')));
          })
        }, icono('destello'), 'Tocar para encender el encuentro'));
      zona.replaceChildren(sello);
    }
    if (quien.regala) oculto();
    else zona.append(h('p', { class: 'suave' }, !yo.sorteado
      ? 'Todavía no se hizo el sorteo.'
      : esOtro ? `${quien.nombre} es destinatario adicional: recibe un regalo y no tiene asignación propia.` : 'Sos destinatario adicional: recibís un regalo y no tenés asignación propia.'));
    return zona;
  }

  function rafaga() {
    const el = h('div', { class: 'rafaga' });
    for (let i = 0; i < 10; i++) {
      const d = icono('destello');
      const angulo = i / 10 * Math.PI * 2;
      d.style.setProperty('--x', Math.round(Math.cos(angulo) * 150) + 'px');
      d.style.setProperty('--y', Math.round(Math.sin(angulo) * 90) + 'px');
      el.append(d);
    }
    return el;
  }

  /** Perfil propio o de un niño a cargo que participa. */
  function listaDe(quien) {
    const lista = leerPerfil(quien.lista || quien.deseos);
    return h('div', { class: 'perfil' }, formularioPerfil(lista, yo.editable !== false,
      (datos) => pedir('guardarPerfil', { ...acceso, persona: quien.persona, datos }),
      () => pedir('dejarDeCompartir', { ...acceso, persona: quien.persona })));
  }

  /* Pestañas: una por persona. Cambiar de pestaña no pierde lo escrito. */
  const editable = yo.editable !== false;
  const barra = h('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Personas' });
  const paneles = h('div');
  function pestana(titulo, panel) {
    const n = ++pestana.n;
    const boton = h('button', { type: 'button', role: 'tab', id: 'tab' + n, 'aria-controls': 'panel' + n, onclick: () => elegir(boton) }, titulo);
    panel.id = 'panel' + n;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab' + n);
    boton.panel = panel;
    barra.append(boton);
    paneles.append(panel);
    return boton;
  }
  pestana.n = 0;
  const tabs = () => [...barra.querySelectorAll('[role=tab]')];
  function elegir(boton) {
    for (const t of tabs()) {
      t.setAttribute('aria-selected', t === boton);
      t.tabIndex = t === boton ? 0 : -1;
      t.panel.hidden = t !== boton;
    }
    boton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    unaSola();
  }
  function unaSola() { for (const t of tabs()) t.hidden = tabs().length === 1; }
  barra.addEventListener('keydown', (e) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const i = tabs().indexOf(document.activeElement);
    if (!paso || i < 0) return;
    const otra = tabs()[(i + paso + tabs().length) % tabs().length];
    elegir(otra);
    otra.focus();
  });

  /** Hijo que no participa: vive en la lista de su adulto y no entra al sorteo. */
  function pestanaHijo(hijo) {
    let idPerfil = hijo.id || 'nuevo';
    const aviso = zonaAviso();
    const rotulo = (nombre) => nombre || 'Nuevo menor a cargo';
    const titulo = h('h2', {}, hijo.nombre ? 'Lista de deseos de ' + hijo.nombre : 'Nuevo menor a cargo');
    const cerrar = () => {
      boton.panel.remove();
      boton.remove();
      elegir(tabs()[0]);
    };
    const quitar = enlace('Quitar perfil', (ev) => {
      if (idPerfil === 'nuevo') return cerrar();
      if (!confirm('¿Quitar este perfil y sus deseos?')) return;
      ejecutar(ev.currentTarget, aviso, async () => {
        await pedir('quitarPerfil', { ...acceso, perfil: idPerfil });
        cerrar();
      });
    });
    const boton = pestana(rotulo(hijo.nombre), h('div', { class: 'perfil' },
      titulo,
      h('p', { class: 'suave' }, 'A cargo de un adulto. Responsable: vos. Sus pistas las ve quien te regala a vos, solo si las compartís.'),
      formularioPerfil(hijo, editable, async (datos, nombre) => {
        const r = await pedir('guardarPerfil', { ...acceso, perfil: idPerfil, nombre, datos });
        idPerfil = r.perfil;
        boton.textContent = rotulo(nombre);
        titulo.textContent = 'Lista de deseos de ' + nombre;
      }, () => pedir('dejarDeCompartir', { ...acceso, perfil: idPerfil }),
      h('div', { style: 'padding-bottom: 20px' }, campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: hijo.nombre })))),
      editable ? quitar : null, aviso));
    boton.esNuevo = () => idPerfil === 'nuevo';
    return boton;
  }

  const propia = pestana(yo.nombre + ' (vos)', h('div', {},
    h('div', {}, h('h2', {}, 'Tu regalo'), zonaRegalo(yo, false)),
    h('section', {},
      h('h2', {}, 'Tu lista de deseos'),
      h('p', { class: 'suave' }, 'Dejá algunas pistas para quien te regala. Todo es opcional.'),
      listaDe(yo))));
  for (const n of yo.aCargo) {
    pestana(n.nombre, h('div', {},
      h('div', {}, h('h2', {}, 'El regalo de ' + n.nombre), zonaRegalo(n, true)),
      h('section', {}, h('h2', {}, 'Lista de deseos de ' + n.nombre), listaDe(n))));
  }
  leerPerfil(yo.lista).hijos.forEach(pestanaHijo);
  const sumar = yo.puedeSumarHijos && editable ? h('button', {
    type: 'button', class: 'sumar', onclick: () => {
      const boton = tabs().find((t) => t.esNuevo?.()) || pestanaHijo(leerPerfil({}));
      barra.append(sumar);
      elegir(boton);
      boton.panel.querySelector('input').focus();
    }
  }, '+ Menor a cargo') : null;
  if (sumar) barra.append(sumar);
  elegir(propia);

  function avisoMail() {
    const aviso = zonaAviso();
    const caja = h('div', { class: 'tarjeta', style: 'margin-bottom: 32px' },
      h('p', {}, `Quien organiza propone cambiar tu mail a ${yo.mailPropuesto}. Confirmalo solo si es tuyo.`),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'segundo', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
            const r = await pedir('confirmarMail', { ...acceso, mail: yo.mailPropuesto });
            acceso.token = r.token;
            recordar({ id, persona: r.persona, nombre: r.nombre, token: r.token });
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

  mostrarNavidad('Hola, ' + yo.nombre, `${yo.evento.nombre}, organizado por ${yo.organizador}.`,
    yo.reinicio ? h('p', { class: 'ambar' }, `Tu acceso se reinició el ${fechaCorta(yo.reinicio)} a las ${yo.reinicio.slice(11)}. Si no lo pediste, consultale a quien organiza.`) : null,
    yo.mailPropuesto ? avisoMail() : null,
    h('div', {}, datosEvento(yo.evento), calendario(yo.evento)),
    h('section', {}, barra, paneles),
    h('section', { class: 'acciones' },
      enlace('Cambiar de persona', () => ir(`#/g/${id}/elegir`)),
      enlace('Salir', () => {
        olvidar(id, persona);
        ir('#/');
      })));
}

navegar();
