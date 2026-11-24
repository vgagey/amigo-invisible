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
  for (const hijo of hijos.flat()) {
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

function mostrar(...hijos) {
  raiz.replaceChildren(...hijos.flat().filter(Boolean));
  window.scrollTo(0, 0);
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

const campo = (texto, control) => h('label', {}, texto, control);
const enviar = (texto) => h('button', { type: 'submit' }, texto);
const enlace = (texto, alTocar) => h('button', { type: 'button', class: 'enlace', onclick: alTocar }, texto);
const opcion = (atributos, ...texto) => h('label', { class: 'opcion' }, h('input', atributos), h('span', {}, ...texto));
const selector = (atributos, opciones, elegido) =>
  h('select', atributos, opciones.map(([v, t]) => h('option', { value: v, selected: v === elegido }, t)));

const fechaCorta = (f) => f.slice(0, 10).split('-').reverse().join('/');
const importe = (n) => '$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
    else if (ruta === 'g') await pantallaGrupo(id, extra === 'elegir', vigente);
    else if (ruta === 's') await abrirLink(id, extra, vigente);
    else if (ruta === 'm') await pantallaRegalo(id, extra, vigente);
    else pantallaInicio();
  } catch (error) {
    if (!vigente()) return;
    mostrar(
      h('h1', {}, 'No pudimos entrar'),
      h('p', {}, error.message),
      error.sinAcceso
        ? h('p', { class: 'suave' }, 'Si entrabas con el link de tu mail, pedile a quien organiza que te lo reenvíe.',
          ...(ruta === 'm' ? [' Si entrabas con PIN, ', h('a', { href: `#/g/${id}/elegir` }, 'elegí tu nombre'), '.'] : []))
        : h('button', { type: 'button', onclick: navegar }, 'Reintentar')
    );
  }
}
window.addEventListener('hashchange', navegar);

function cargando() { mostrar(h('p', { class: 'suave' }, 'Cargando…')); }

/* ---------- Inicio ---------- */

function pantallaInicio() {
  const aviso = zonaAviso();
  mostrar(
    h('h1', {}, 'Amigo Invisible'),
    h('p', { class: 'suave' }, 'Organizá el sorteo de Navidad de tu familia.'),
    sesiones.length ? h('section', {},
      h('h2', {}, 'Seguir como'),
      h('ul', {}, sesiones.map((s) => h('li', {},
        h('button', { type: 'button', class: 'persona', onclick: () => ir(`#/m/${s.id}/${s.persona}`) }, h('span', {}, s.nombre)))))
    ) : null,
    h('section', {},
      h('h2', {}, 'Crear un sorteo'),
      formulario(aviso, async (d) => {
        await pedir('crear', { nombre: d.nombre, mail: d.mail, acepta: d.acepta === 'on' });
        mostrar(
          h('h1', {}, 'Revisá tu mail'),
          h('p', {}, 'Te enviamos un link privado a ', d.mail.trim(), '. Abrilo para cargar a las personas y hacer el sorteo.'),
          h('p', { class: 'suave' }, 'Si no llega, buscalo en correo no deseado.')
        );
      },
        campo('Tu nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'name' })),
        campo('Tu mail', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'email' })),
        h('details', {},
          h('summary', {}, 'Aviso de privacidad'),
          h('p', {}, 'Guardamos solo los nombres, mails y listas de deseos que se carguen, y los usamos únicamente para este sorteo. Los mails se envían a través de Google. Todo se borra 30 días después del evento.'),
          h('p', {}, 'Cargá solo a personas que estén de acuerdo. De los niños, alcanza con el nombre de pila.')),
        opcion({ type: 'checkbox', name: 'acepta' }, 'Leí y acepto el aviso de privacidad'),
        aviso,
        enviar('Crear sorteo'))
    )
  );
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
  const zonas = { evento: h('section'), personas: h('section'), exclusiones: h('section'), grupo: h('section'), sorteo: h('section') };
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
    pintarGrupo();
    pintarSorteo();
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
      } catch (error) {
        eventoSinGuardar = error.message;
        aviso.decir(error.message, 'rojo');
      }
    };
    const form = h('form', { onsubmit: (ev) => ev.preventDefault(), onchange: guardar },
      h('div', { class: 'dos' },
        campo('Fecha', h('input', { class: 'num', type: 'date', name: 'fecha', value: e.fecha })),
        campo('Presupuesto (opcional)', h('input', { class: 'num', type: 'number', name: 'presupuesto', min: 0, step: '0.01', inputmode: 'decimal', value: e.presupuesto === null ? '' : e.presupuesto.toFixed(2) }))),
      campo('Mensaje (opcional)', h('textarea', { name: 'mensaje', maxlength: 300, value: e.mensaje })),
      h('fieldset', {},
        h('legend', {}, 'Cómo se reparten los regalos'),
        opcion({ type: 'radio', name: 'modalidad', value: 'A', checked: e.modalidad === 'A' }, 'Cada uno con su grupo: adulto con adulto, niño con niño'),
        opcion({ type: 'radio', name: 'modalidad', value: 'B', checked: e.modalidad === 'B' }, 'Adulto y niño: cada adulto regala a un adulto y a un niño. Los niños solo reciben')),
      aviso);
    if (abierto()) zonas.evento.replaceChildren(h('h2', {}, 'Evento'), form);
    else zonas.evento.replaceChildren(h('h2', {}, 'Evento'), datosEvento(e),
      h('p', { class: 'suave' }, e.modalidad === 'A' ? 'Cada uno con su grupo.' : 'Adulto y niño.'));
  }

  function camposPersona(p) {
    return [
      h('div', { class: 'dos' },
        campo('Nombre', h('input', { name: 'nombre', maxlength: 40, autocomplete: 'off', value: p.nombre || '' })),
        campo('Es', selector({ name: 'tipo' }, [['adulto', 'Adulto'], ['nino', 'Niño']], p.tipo || 'adulto'))),
      campo('Mail (opcional)', h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'off', value: p.mail || '' }))
    ];
  }

  function estadoPersona(p) {
    if (p.mail) {
      if (abierto()) return ['Recibe el link por mail al sortear', 'suave'];
      if (p.entro) return ['Entró', 'verde'];
      if (p.envio === 'error') return ['No se pudo enviar el mail', 'rojo'];
      if (p.envio === 'enviado') return ['Mail enviado, todavía no entró', 'ambar'];
      return ['Envío pendiente', 'ambar'];
    }
    return p.tienePin ? ['Entró y creó su PIN', 'verde'] : ['Falta que cree su PIN', 'ambar'];
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
            h('p', { class: 'chico suave' }, (p.tipo === 'nino' ? 'Niño' : 'Adulto') + (p.mail ? ' · ' + p.mail : '')),
            h('p', { class: 'chico ' + clase }, texto)),
          h('div', { class: 'acciones' },
            !p.mail && p.tienePin ? accion('Reiniciar PIN', `¿Reiniciar el PIN de ${p.nombre}? Va a tener que crear otro y verá que se reinició.`, 'reiniciarPin') : null,
            abierto() ? enlace('Editar', editar) : null,
            abierto() ? accion('Quitar', `¿Quitar a ${p.nombre}?`, 'quitarPersona') : null,
            !abierto() && p.mail ? enlace('Corregir o reenviar', reenviar) : null)),
        aviso);
    };
    const editar = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => cambiar('editarPersona', { persona: p.id, ...d }),
        ...camposPersona(p), aviso,
        h('div', { class: 'acciones' }, enviar('Guardar'), enlace('Cancelar', ver))));
    };
    const reenviar = () => {
      const aviso = zonaAviso();
      li.replaceChildren(formulario(aviso, (d) => cambiar('reenviar', { persona: p.id, mail: d.mail }),
        campo('Mail de ' + p.nombre, h('input', { name: 'mail', type: 'email', maxlength: 100, autocomplete: 'off', value: p.mail })),
        h('p', { class: 'chico suave' }, 'El link anterior deja de funcionar.'), aviso,
        h('div', { class: 'acciones' }, enviar('Reenviar link'), enlace('Cancelar', ver))));
    };
    ver();
    return li;
  }

  function pintarPersonas() {
    const aviso = zonaAviso();
    zonas.personas.replaceChildren(
      h('h2', {}, 'Personas' + (s.personas.length ? ` (${s.personas.length})` : '')),
      ...(s.personas.length ? [h('ul', {}, s.personas.map(filaPersona))] : []),
      ...(abierto() ? [
        formulario(aviso, async (d) => {
          await cambiar('agregarPersona', d);
          zonas.personas.querySelector(':scope > form input[name=nombre]')?.focus();
        },
          ...camposPersona({}),
          h('p', { class: 'chico suave' }, 'Con mail, recibe su link automáticamente al sortear. Sin mail, entra con el link del grupo y un PIN. Si participás, sumate.'),
          aviso, enviar('Agregar persona'))
      ] : []));
  }

  function pintarExclusiones() {
    zonas.exclusiones.hidden = abierto() ? s.personas.length < 2 : !s.exclusiones.length;
    const aviso = zonaAviso();
    const personas = [['', 'Elegir'], ...s.personas.map((p) => [p.id, p.nombre])];
    zonas.exclusiones.replaceChildren(
      h('h2', {}, 'Exclusiones (opcional)'),
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

  function pintarGrupo() {
    zonas.grupo.hidden = !s.personas.some((p) => !p.mail);
    const aviso = zonaAviso();
    const url = linkGrupo(id);
    const texto = abierto()
      ? `Amigo Invisible de Navidad: entrá, tocá tu nombre y creá tu PIN. ${url}`
      : `¡Ya se hizo el sorteo del Amigo Invisible! Entrá para ver a quién le regalás. ${url}`;
    zonas.grupo.replaceChildren(
      h('h2', {}, 'Link del grupo'),
      h('p', { class: 'suave' }, abierto()
        ? 'Es el mismo para todos los que entran sin mail. No revela nada del sorteo.'
        : 'Avisá en el grupo que ya pueden entrar.'),
      h('div', { class: 'acciones' },
        h('a', { class: 'boton segundo', href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener' }, 'Compartir por WhatsApp'),
        enlace('Copiar link', async () => {
          try { await navigator.clipboard.writeText(url); aviso.decir('Link copiado', 'verde'); } catch { aviso.decir(url); }
        })),
      aviso);
  }

  function pintarSorteo() {
    const aviso = zonaAviso();
    if (!abierto()) {
      zonas.sorteo.replaceChildren(
        h('h2', {}, 'Sorteo'),
        h('p', { class: 'verde' }, 'El sorteo está hecho.'),
        h('p', { class: 'suave' }, 'Para cambiar personas o exclusiones hay que volver a sortear. El sorteo actual se anula.'),
        aviso,
        h('button', {
          type: 'button', class: 'segundo', onclick: (ev) => {
            if (!confirm('¿Anular el sorteo actual? Quienes ya vieron a quién le regalan van a tener otra persona.')) return;
            ejecutar(ev.target, aviso, () => cambiar('reabrir'));
          }
        }, 'Volver a sortear'));
      return;
    }
    const faltan = s.personas.filter((p) => !p.mail && !p.tienePin);
    const conMail = s.personas.filter((p) => p.mail).length;
    zonas.sorteo.replaceChildren(
      h('h2', {}, 'Sorteo'),
      faltan.length
        ? h('p', { class: 'ambar' }, 'Falta que creen su PIN: ' + faltan.map((p) => p.nombre).join(', ') + '.')
        : h('p', { class: 'suave' }, conMail ? `Al sortear se envían ${conMail} ${conMail === 1 ? 'mail' : 'mails'}.` : 'Al sortear, avisá en el grupo.'),
      aviso,
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', disabled: faltan.length > 0 || !s.personas.length, onclick: (ev) => ejecutar(ev.target, aviso, async () => {
            await cola;
            if (eventoSinGuardar) throw new Error('Revisá los datos del evento: ' + eventoSinGuardar);
            if (!confirm('¿Hacer el sorteo? Después las personas quedan fijas.')) return;
            aviso.decir('Sorteando…', 'suave');
            await cambiar('sortear');
          })
        }, 'Sortear'),
        enlace('Actualizar', (ev) => ejecutar(ev.target, aviso, () => cambiar('admin')))));
  }

  mostrar(
    h('h1', {}, 'Tu sorteo'),
    h('p', { class: 'suave' }, `Hola, ${s.organizador}. Guardá el link de tu mail para volver a esta pantalla.`),
    ...Object.values(zonas));
  pintar(true);
}

/* ---------- Participantes ---------- */

async function pantallaGrupo(id, elegir, vigente) {
  const propias = sesiones.filter((s) => s.id === id);
  if (propias.length === 1 && !elegir) return ir(`#/m/${id}/${propias[0].persona}`);
  cargando();
  const grupo = await pedir('grupo', { id });
  if (!vigente()) return;

  mostrar(
    h('h1', {}, 'Amigo Invisible'),
    h('p', { class: 'suave' }, `${grupo.organizador} organiza el sorteo de Navidad.`),
    h('section', {},
      h('h2', {}, '¿Quién sos?'),
      grupo.personas.length
        ? h('ul', {}, grupo.personas.map((p) => {
          const recordada = propias.some((s) => s.persona === p.id);
          return h('li', {}, h('button', {
            type: 'button', class: 'persona',
            onclick: () => recordada ? ir(`#/m/${id}/${p.id}`) : pantallaPin(id, p)
          }, h('span', {}, p.nombre), h('span', { class: 'chico suave' }, recordada ? 'En este dispositivo' : p.tienePin ? 'Ya tiene PIN' : '')));
        }))
        : h('p', {}, 'Todavía no hay nombres para elegir.'),
      h('p', { class: 'chico suave' }, 'Si no ves tu nombre, buscá el link en tu mail o consultale a quien organiza.')));
}

function pantallaPin(id, p) {
  const aviso = zonaAviso();
  const pin = (name) => h('input', { class: 'num', name, type: 'password', inputmode: 'numeric', maxlength: 4, autocomplete: 'off' });
  mostrar(
    h('h1', {}, 'Hola, ' + p.nombre),
    h('p', { class: 'suave' }, p.tienePin
      ? 'Ingresá tu PIN. Si lo olvidaste, pedile a quien organiza que lo reinicie.'
      : 'Creá un PIN de 4 números para entrar. Este dispositivo te va a recordar.'),
    h('section', {}, formulario(aviso, async (d) => {
      if (!p.tienePin && d.pin !== d.otra) throw new Error('Los PIN no coinciden.');
      const r = await pedir(p.tienePin ? 'entrar' : 'crearPin', { id, persona: p.id, pin: d.pin });
      recordar({ id, persona: r.persona, nombre: r.nombre, token: r.token });
      ir(`#/m/${id}/${r.persona}`);
    },
      campo('PIN', pin('pin')),
      p.tienePin ? null : campo('Repetí el PIN', pin('otra')),
      aviso,
      h('div', { class: 'acciones' }, enviar('Entrar'), enlace('No soy ' + p.nombre, navegar)))));
  raiz.querySelector('input').focus();
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

  const zona = h('div');
  const aviso = zonaAviso();
  function oculto() {
    aviso.decir('');
    zona.replaceChildren(
      h('p', { class: 'suave' }, 'Tocá para ver a quién le regalás. Que nadie mire tu pantalla.'),
      aviso,
      h('button', {
        type: 'button', onclick: (ev) => ejecutar(ev.target, aviso, async () => {
          const lista = await pedir('descubrir', acceso);
          zona.replaceChildren(
            ...lista.map((r) => h('div', { class: 'regalo' },
              h('p', { class: 'nombre' }, r.nombre),
              r.deseos ? h('p', { class: 'mensaje' }, r.deseos) : h('p', { class: 'suave' }, 'Todavía no cargó su lista de deseos.'))),
            h('button', { type: 'button', class: 'segundo', onclick: oculto }, 'Ocultar'));
        })
      }, 'Descubrir'));
  }
  if (yo.regala) oculto();
  else zona.append(h('p', { class: 'suave' }, yo.sorteado
    ? 'Esta vez solo recibís. Cargá tu lista de deseos para dar ideas.'
    : 'Todavía no se hizo el sorteo. Mientras tanto, cargá tu lista de deseos.'));

  const avisoDeseos = zonaAviso();
  mostrar(
    h('h1', {}, 'Hola, ' + yo.nombre),
    h('p', { class: 'suave' }, `Amigo Invisible de ${yo.organizador}.`),
    yo.reinicio ? h('p', { class: 'ambar' }, `Tu acceso se reinició el ${fechaCorta(yo.reinicio)} a las ${yo.reinicio.slice(11)}. Si no lo pediste, consultale a quien organiza.`) : null,
    h('section', {}, h('h2', {}, 'Tu regalo'), zona),
    h('section', {}, h('h2', {}, 'Evento'), datosEvento(yo.evento)),
    h('section', {},
      h('h2', {}, 'Tu lista de deseos'),
      formulario(avisoDeseos, async (d) => {
        await pedir('guardarDeseos', { ...acceso, deseos: d.deseos });
        avisoDeseos.decir('Guardado', 'verde');
      },
        h('textarea', { name: 'deseos', maxlength: 500, 'aria-label': 'Tu lista de deseos', value: yo.deseos }),
        avisoDeseos, enviar('Guardar lista'))),
    h('section', { class: 'acciones' },
      yo.conPin ? enlace('Cambiar de persona', () => ir(`#/g/${id}/elegir`)) : null,
      enlace('Salir', () => {
        if (!yo.conPin && !confirm('Para volver a entrar vas a necesitar el link de tu mail. ¿Salir?')) return;
        olvidar(id, persona);
        ir('#/');
      })));
}

navegar();
