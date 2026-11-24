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
      for (const parte of String(hijo).split(/(\d(?:[\d.,:/]*\d)?)/)) {
        if (!parte) continue;
        if (/^\d/.test(parte)) {
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
      NAVIDAD.decoracion ? dibujo('luces', NAVIDAD.luces) : null,
      h('div', { class: 'barra' }, marca()),
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

const ARCOS_PORTAL = '<svg viewBox="0 0 200 260" aria-hidden="true"><g fill="none" stroke-width="18" stroke-linecap="round"><path d="M22 22A108 108 0 0 1 22 238" stroke="#EEF0F8"/><path d="M22 56A74 74 0 0 1 22 204" stroke="#EEF0F8"/><path d="M22 90A40 40 0 0 1 22 170" stroke="#EEF0F8"/><path d="M22 22A108 108 0 0 1 22 238" stroke="#0090FF" pathLength="100" stroke-dasharray="64 200"/><path d="M22 56A74 74 0 0 1 22 204" stroke="#A855F7" pathLength="100" stroke-dasharray="80 200"/><path d="M22 90A40 40 0 0 1 22 170" stroke="#0B1F4B" pathLength="100" stroke-dasharray="46 200"/></g></svg>';

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
        dibujo('dibujo', ARCOS_PORTAL),
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
        h('p', {}, 'Guardamos solo los nombres, teléfonos, mails y listas de deseos que se carguen, y los usamos únicamente para este sorteo. Los mails se envían a través de Google. Todo se borra 30 días después del evento.'),
        h('p', {}, 'Quien organiza ve con qué mail entró cada persona y quién ya vio su regalo. En una emergencia, puede ver el sorteo completo.'),
        h('p', {}, 'Cargá solo a personas que estén de acuerdo. De los niños, alcanza con el nombre de pila.')),
      opcion({ type: 'checkbox', name: 'acepta' }, 'Leí y acepto el aviso de privacidad'),
      aviso,
      enviar('Crear sorteo')));
  montar(
    h('header', { class: 'navidad' },
      NAVIDAD.decoracion ? dibujo('luces', NAVIDAD.luces) : null,
      h('div', { class: 'barra' }, marca(), h('a', { href: '#/' }, 'Volver al portal')),
      h('div', { class: 'heroe' },
        h('div', {},
          h('p', { class: 'etiqueta' }, NAVIDAD.etiqueta),
          h('h1', {}, NAVIDAD.nombre),
          h('p', {}, NAVIDAD.frase),
          h('a', { class: 'boton', href: '#/navidad', onclick: (e) => { e.preventDefault(); crear.scrollIntoView({ behavior: 'smooth' }); crear.querySelector('input').focus({ preventScroll: true }); } }, 'Crear sorteo')),
        NAVIDAD.decoracion ? dibujo('portada', NAVIDAD.portada) : null)),
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
    else zonas.evento.replaceChildren(h('h1', {}, 'Evento'), datosEvento(e),
      h('p', { class: 'suave' }, e.modalidad === 'A' ? 'Cada uno con su grupo.' : 'Adulto y niño.'));
  }

  function camposPersona(p) {
    const adultos = s.personas.filter((x) => x.tipo === 'adulto' && x.id !== p.id).map((x) => [x.id, x.nombre]);
    const gestiona = selector({ name: 'responsable', onchange: () => acomodar() }, [['', 'Nadie, entra por su cuenta'], ...adultos], p.responsable || '');
    const responsable = campo('Quién gestiona su regalo', gestiona);
    const tipo = selector({ name: 'tipo', onchange: () => acomodar() }, [['adulto', 'Adulto'], ['nino', 'Niño']], p.tipo || 'adulto');
    const telefono = campo('Teléfono, con código de área (opcional con mail)', h('input', { class: 'num', name: 'telefono', type: 'tel', maxlength: 25, autocomplete: 'off', value: p.telefono || '' }));
    const correo = campo('Mail, ahí recibe su link y su PIN', h('input', { name: 'correo', type: 'email', maxlength: 100, autocomplete: 'off', value: p.correo || '' }));
    const acomodar = () => {
      correo.hidden = tipo.value === 'nino' && gestiona.value !== '';
      responsable.hidden = tipo.value !== 'nino';
      telefono.hidden = tipo.value === 'nino' && gestiona.value !== '';
    };
    acomodar();
    return [
      h('div', { class: 'dos' },
        campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre || '' })),
        campo('Es', tipo)),
      responsable, correo, telefono
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
      if (!regala(p)) return [p.validada ? 'Validó, solo recibe' : 'Solo recibe', 'suave'];
      if (p.responsable) return ['Todavía no se vio su regalo', 'ambar'];
      if (!p.validada) return sinValidar(p);
      if (p.envio === 'error') return ['Validó, pero no se pudo enviar el link', 'rojo'];
      return ['Entró, todavía no vio su regalo', 'ambar'];
    }
    if (p.responsable) return ['Entra con ' + nombreDe(p.responsable), 'suave'];
    return p.validada ? ['Validó', 'verde'] : sinValidar(p);
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
            h('p', { class: 'chico suave' }, (p.tipo === 'nino' ? 'Niño' : 'Adulto') + (p.responsable ? ' · lo gestiona ' + nombreDe(p.responsable) : [p.correo || p.mail, p.telefono].filter(Boolean).map((x) => ' · ' + x).join('') + (!p.validada ? '' : ` · validó el ${fechaCorta(p.validada)} a las ${p.validada.slice(11)}`))),
            h('p', { class: 'chico ' + clase }, texto)),
          h('div', { class: 'acciones' },
            abierto() ? enlace('Editar', editar) : null,
            abierto() ? accion('Quitar', `¿Quitar a ${p.nombre}?`, 'quitarPersona') : null,
            !abierto() && !p.validada && !p.responsable ? enlace('Corregir datos', corregir) : null,
            p.correo && !p.validada ? accion(p.envio === 'enviado' ? 'Reenviar PIN' : 'Enviar PIN', '', 'invitar') : null,
            !abierto() && p.validada ? accion('Reenviar link', '', 'reenviar') : null,
            p.validada ? accion('Liberar', `¿Liberar el nombre de ${p.nombre}? Se corta el acceso de ${p.mail} y el nombre vuelve a quedar disponible.`, 'liberar') : null)),
        aviso);
    };
    const editar = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => cambiar('editarPersona', { persona: p.id, ...d }),
        ...camposPersona(p), aviso,
        h('div', { class: 'acciones' }, enviar('Guardar'), enlace('Cancelar', ver))));
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

  function pintarExclusiones() {
    const aviso = zonaAviso();
    const personas = [['', 'Elegir'], ...s.personas.map((p) => [p.id, p.nombre])];
    zonas.exclusiones.replaceChildren(
      h('h1', {}, 'Exclusiones'),
      h('p', { class: 'suave' }, 'Opcional: elegí quién no le regala a quién.'),
      ...(s.exclusiones.length ? [h('ul', {}, s.exclusiones.map((e) => h('li', {}, h('div', { class: 'fila' },
        h('p', {}, `${nombreDe(e.de)} no le regala a ${nombreDe(e.a)}`),
        abierto() ? enlace('Quitar', (ev) => ejecutar(ev.target, aviso, () => cambiar('quitarExclusion', e))) : null))))] : []),
      ...(abierto() ? [formulario(aviso, (d) => {
        if (!d.de || !d.a) throw new Error('Elegí a las dos personas.');
        return cambiar('agregarExclusion', { de: d.de, a: d.a, ambos: d.ambos === 'on' });
      },
        h('div', { class: 'dos' },
          campo('Persona', selector({ name: 'de' }, personas, '')),
          campo('No le regala a', selector({ name: 'a' }, personas, ''))),
        opcion({ type: 'checkbox', name: 'ambos', checked: true }, 'En los dos sentidos'),
        aviso,
        h('button', { type: 'submit', class: 'segundo' }, 'Agregar exclusión'))] : []));
  }

  /** Avance según el momento: antes del sorteo, quién entró; después, quién vio su regalo. */
  function avance() {
    const base = s.personas.filter((p) => abierto() ? !p.responsable : regala(p));
    const hecho = (p) => abierto() ? p.validada : p.vio;
    const contar = (lista) => [lista.filter(hecho).length, lista.length];
    const filas = [['En total', '#0B1F4B', contar(base)]];
    if (base.some((p) => p.tipo === 'nino')) {
      filas.push(['Adultos', '#0090FF', contar(base.filter((p) => p.tipo === 'adulto'))]);
      filas.push(['Niños', '#A855F7', contar(base.filter((p) => p.tipo === 'nino'))]);
    }
    return { titulo: abierto() ? 'Ya entraron' : 'Ya vieron su regalo', filas, faltan: base.filter((p) => !hecho(p)) };
  }

  function arcos(filas) {
    const trazos = ['M22 20A100 100 0 0 1 22 220', 'M22 52A68 68 0 0 1 22 188', 'M22 84A36 36 0 0 1 22 156'];
    const fondo = trazos.map((d) => `<path d="${d}" stroke="#EEF0F8"/>`).join('');
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
      NAVIDAD.decoracion ? dibujo('regalo-dibujo', NAVIDAD.regalo) : null,
      h('h3', {}, abierto() ? 'Invitá a tu grupo' : 'Avisá que ya se sorteó'),
      pendientes ? h('button', { type: 'button', onclick: (ev) => ejecutar(ev.currentTarget, aviso, () => cambiar('invitar')) }, pendientes === 1 ? 'Enviar 1 invitación' : `Enviar ${pendientes} invitaciones`) : null,
      h('p', { class: 'chico' }, 'El link del grupo no revela nada del sorteo.'),
      h('div', { class: 'acciones' },
        h('a', { href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener' }, 'Compartir por WhatsApp'),
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
      h('p', { class: 'chico suave' }, 'Si no ves tu nombre, consultale a quien organiza. Los niños pueden estar a cargo de un adulto.')));
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
      ...(e.presupuesto !== null ? [h('dt', {}, 'Presupuesto'), h('dd', {}, importe(e.presupuesto))] : [])),
    e.mensaje ? h('p', { class: 'mensaje' }, e.mensaje) : null);
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
      zona.replaceChildren(
        h('p', { class: 'suave' }, esOtro ? `Tocá para ver a quién le regala ${quien.nombre}.` : 'Tocá para ver a quién le regalás. Que nadie mire tu pantalla.'),
        aviso,
        h('button', {
          type: 'button', onclick: (ev) => ejecutar(ev.currentTarget, aviso, async () => {
            const lista = await pedir('descubrir', { ...acceso, persona: quien.persona });
            zona.replaceChildren(
              ...lista.map((r) => h('div', { class: 'regalo' },
                h('p', { class: 'nombre' }, r.nombre),
                r.deseos ? h('p', { class: 'mensaje' }, r.deseos) : h('p', { class: 'suave' }, 'Todavía no cargó su lista de deseos.'))),
              h('button', { type: 'button', class: 'segundo', onclick: oculto }, 'Ocultar'));
          })
        }, 'Descubrir'));
    }
    if (quien.regala) oculto();
    else zona.append(h('p', { class: 'suave' }, !yo.sorteado
      ? 'Todavía no se hizo el sorteo.'
      : esOtro ? `${quien.nombre} solo recibe.` : 'Esta vez solo recibís.'));
    return zona;
  }

  function formularioDeseos(quien, etiqueta) {
    const aviso = zonaAviso();
    return formulario(aviso, async (d) => {
      await pedir('guardarDeseos', { ...acceso, persona: quien.persona, deseos: d.deseos });
      aviso.decir('Guardado', 'verde');
    },
      h('textarea', { name: 'deseos', maxlength: 500, 'aria-label': etiqueta, value: quien.deseos }),
      aviso, enviar('Guardar lista'));
  }

  mostrarNavidad('Hola, ' + yo.nombre, `${yo.evento.nombre}, organizado por ${yo.organizador}.`,
    yo.reinicio ? h('p', { class: 'ambar' }, `Tu acceso se reinició el ${fechaCorta(yo.reinicio)} a las ${yo.reinicio.slice(11)}. Si no lo pediste, consultale a quien organiza.`) : null,
    h('div', {}, h('h2', {}, 'Tu regalo'), zonaRegalo(yo, false)),
    h('section', {}, h('h2', {}, 'Evento'), datosEvento(yo.evento)),
    h('section', {}, h('h2', {}, 'Tu lista de deseos'), formularioDeseos(yo, 'Tu lista de deseos')),
    yo.aCargo.map((n) => h('section', {},
      h('h2', {}, 'Gestionás a ' + n.nombre),
      zonaRegalo(n, true),
      h('h3', { style: 'margin: 28px 0 14px' }, 'Lista de deseos de ' + n.nombre),
      formularioDeseos(n, 'Lista de deseos de ' + n.nombre))),
    h('section', { class: 'acciones' },
      enlace('Cambiar de persona', () => ir(`#/g/${id}/elegir`)),
      enlace('Salir', () => {
        olvidar(id, persona);
        ir('#/');
      })));
}

navegar();
