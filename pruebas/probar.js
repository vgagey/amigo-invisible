// node --test pruebas/probar.js
const test = require('node:test');
const assert = require('node:assert');
const cargar = require('./google-simulado');

const grupo = (a, n) => [
  ...Array.from({ length: a }, (_, i) => ({ id: 'a' + i, tipo: 'adulto' })),
  ...Array.from({ length: n }, (_, i) => ({ id: 'n' + i, tipo: 'nino' }))
];
const { sortearPersonas } = cargar().contexto;
const sortear = (p, e, m) => JSON.parse(JSON.stringify(sortearPersonas(p, e, m)));
const azarExcl = (p, prob) => p.flatMap((x) => p.filter((y) => y !== x && Math.random() < prob).map((y) => ({ de: x.id, a: y.id })));
const prohibe = (e, de, a) => e.some((x) => x.de === de && x.a === a);
const contar = (lista) => lista.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});

// Búsqueda exhaustiva independiente, para saber si existe solución.
function existePermutacion(ids, ok) {
  const usar = (i, libres) => i === ids.length || [...libres].some((x) => {
    if (!ok(ids[i], x)) return false;
    const resto = new Set(libres); resto.delete(x);
    return usar(i + 1, resto);
  });
  return usar(0, new Set(ids));
}
function mejorReparto(muchos, pocos, ok) {
  let mejor = null;
  const carga = Object.fromEntries(pocos.map((x) => [x, 0]));
  (function ir(i) {
    if (i === muchos.length) {
      const v = Object.values(carga);
      if (Math.min(...v) >= 1 && (mejor === null || Math.max(...v) < mejor)) mejor = Math.max(...v);
      return;
    }
    for (const x of pocos) if (ok(muchos[i], x)) { carga[x]++; ir(i + 1); carga[x]--; }
  })(0);
  return mejor;
}

test('modalidad A: válida siempre, y solo falla si es imposible', () => {
  let bien = 0, imposibles = 0;
  for (let k = 0; k < 3000; k++) {
    const p = grupo(3 + k % 4, [0, 3, 4, 5][k % 4 ^ (k >> 2) % 4]);
    const e = azarExcl(p, (k % 8) / 9);
    const ids = (t) => p.filter((x) => x.tipo === t).map((x) => x.id);
    const ok = (a, b) => a !== b && !prohibe(e, a, b);
    const posible = existePermutacion(ids('adulto'), ok) && existePermutacion(ids('nino'), ok);
    let r;
    try { r = sortear(p, e, 'A'); } catch (x) { assert.match(x.message, /imposible/); assert.equal(posible, false); imposibles++; continue; }
    assert.ok(posible); bien++;
    assert.deepEqual(Object.keys(r).sort(), p.map((x) => x.id).sort());
    const reciben = Object.values(r).flat();
    assert.equal(new Set(reciben).size, p.length);
    for (const [de, [a, ...mas]] of Object.entries(r)) {
      assert.equal(mas.length, 0); assert.ok(ok(de, a)); assert.equal(de[0], a[0]);
    }
  }
  assert.ok(bien > 500 && imposibles > 200, `${bien} / ${imposibles}`);
});

test('modalidad B: válida siempre, pareja, y solo falla si es imposible', () => {
  let bien = 0, imposibles = 0;
  for (let k = 0; k < 2500; k++) {
    const A = 3 + k % 4, N = 1 + (k >> 2) % 6;
    const p = grupo(A, N);
    const e = azarExcl(p, (k % 7) / 9);
    const ok = (a, b) => a !== b && !prohibe(e, a, b);
    const ad = p.filter((x) => x.tipo === 'adulto').map((x) => x.id);
    const ni = p.filter((x) => x.tipo === 'nino').map((x) => x.id);
    const mejor = A >= N ? mejorReparto(ad, ni, ok) : mejorReparto(ni, ad, (n, a) => ok(a, n));
    const posible = mejor !== null && existePermutacion(ad, ok);
    let r;
    try { r = sortear(p, e, 'B'); } catch (x) { assert.match(x.message, /imposible/); assert.equal(posible, false); imposibles++; continue; }
    assert.ok(posible); bien++;
    assert.deepEqual(Object.keys(r).sort(), [...ad].sort());
    const aAdultos = [], aNinos = [];
    for (const [de, lista] of Object.entries(r)) {
      lista.forEach((a) => assert.ok(ok(de, a)));
      const x = lista.filter((i) => i[0] === 'a'), y = lista.filter((i) => i[0] === 'n');
      assert.equal(x.length, 1); assert.ok(y.length >= 1);
      if (A >= N) assert.equal(y.length, 1);
      aAdultos.push(...x); aNinos.push(...y);
    }
    assert.equal(new Set(aAdultos).size, A);
    assert.equal(new Set(aNinos).size, N);
    if (A < N) assert.equal(aNinos.length, N);
    const cargas = A >= N ? Object.values(contar(aNinos)) : Object.values(r).map((l) => l.length - 1);
    if (!e.length) assert.ok(Math.max(...cargas) - Math.min(...cargas) <= 1);
    assert.equal(Math.max(...cargas), mejor, 'reparto más desparejo que el mejor posible');
  }
  assert.ok(bien > 500 && imposibles > 200, `${bien} / ${imposibles}`);
});

test('azar sin sesgo evidente y grupo máximo rápido', () => {
  const cuenta = {};
  for (let k = 0; k < 18000; k++) { const [x] = sortear(grupo(4, 0), [], 'A').a0; cuenta[x] = (cuenta[x] || 0) + 1; }
  for (const n of Object.values(cuenta)) assert.ok(Math.abs(n - 6000) < 400, JSON.stringify(cuenta));
  const t = Date.now();
  const p = grupo(25, 15);
  for (let k = 0; k < 50; k++) { try { sortear(p, azarExcl(p, 0.8), 'B'); } catch (x) { assert.match(x.message, /imposible/); } }
  assert.ok(Date.now() - t < 5000);
});

test('mínimos', () => {
  for (const [a, n, m] of [[2, 0, 'A'], [3, 1, 'A'], [3, 2, 'A'], [0, 0, 'A'], [2, 2, 'B'], [3, 0, 'B']]) {
    assert.throws(() => sortear(grupo(a, n), [], m));
  }
});

const FECHA = new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10);
const TEL = '+54 9 11 4321-9876';
function armar(g, personas) {
  assert.ok(g.pedir({ accion: 'crear', nombre: 'Orga', mail: 'org@x.com', acepta: true, encuentro: 'Navidad', fecha: FECHA }).ok);
  const [, id, token] = g.correos.at(-1).body.match(/#\/a\/(\w+)\/(\w+)/);
  const ad = (accion, x) => g.pedir({ accion, id, token, ...x });
  let r;
  personas.forEach((p) => { r = ad('agregarPersona', { tipo: 'adulto', telefono: TEL, ...p }); assert.ok(r.ok, r.error); });
  const por = (n) => ad('admin').datos.personas.find((p) => p.nombre === n);
  const pedirPin = (n, mail, telefono = '011 15 4321 9876') => g.pedir({ accion: 'pedirPin', id, persona: por(n).id, mail, telefono });
  const entrar = (n, mail, pin) => g.pedir({ accion: 'entrar', id, persona: por(n).id, mail, pin });
  const pinDe = (mail) => g.correos.filter((c) => c.to === mail).at(-1).body.match(/^(\d{6})$/m)[1];
  const validar = (n, mail = n.toLowerCase() + '@x.com') => {
    r = pedirPin(n, mail); assert.ok(r.ok, r.error);
    r = entrar(n, mail, pinDe(mail)); assert.ok(r.ok, r.error);
    return { id, token: r.datos.token };
  };
  return { id, token, ad, por, pedirPin, entrar, pinDe, validar };
}
const link = (c) => { const [, id, token] = c.body.match(/#\/s\/(\w+)\/(\w+)/); return { id, token }; };
const nombres = (...n) => n.map((nombre) => ({ nombre }));

test('recorrido completo: mail propio, PIN, sorteo y regalo', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro', 'Dani'));
  assert.equal(g.correos.length, 1, 'cargar personas no manda mails');
  const pedido = s.pedirPin('Caro', 'Caro@X.com');
  assert.ok(pedido.ok, pedido.error);
  assert.ok(!/\d{6}/.test(JSON.stringify(pedido)), 'el PIN no vuelve a la pantalla');
  assert.equal(g.correos.at(-1).to, 'caro@x.com');
  assert.match(s.entrar('Caro', 'caro@x.com', '').error, /no es correcto/);
  assert.equal(s.por('Caro').validada, '', 'pedir un PIN no valida');
  const ses = { id: s.id, token: s.entrar('Caro', 'caro@x.com', s.pinDe('caro@x.com')).datos.token };
  assert.ok(g.pedir({ accion: 'guardarDeseos', ...ses, deseos: 'Un libro de ñandúes 🎁' }).ok);
  assert.match(g.pedir({ accion: 'descubrir', ...ses }).error, /Todavía/);
  assert.equal(s.por('Caro').mail, 'caro@x.com', 'quien organiza ve con qué mail entró');
  assert.ok(s.por('Caro').validada);

  // Se sortea aunque no hayan entrado todos; solo reciben mail los validados
  const antes = g.correos.length;
  const x = s.ad('sortear');
  assert.ok(x.ok, x.error);
  assert.equal(g.correos.length, antes + 1);
  const m = g.correos.at(-1);
  assert.equal(m.replyTo, 'org@x.com');
  for (const n of ['Ana', 'Beto', 'Dani']) assert.ok(!(m.body + m.htmlBody + m.subject).includes(n), 'el mail no revela nombres');
  for (const n of ['parejas', 'enlace', 'sesiones']) assert.ok(!JSON.stringify(x).includes(n), 'el panel no recibe ' + n);

  // La sesión sigue, el link sirve y quien valida después también ve su regalo
  const ana = s.validar('Ana');
  const accesos = [ana, ses, link(m)];
  const yos = accesos.map((a) => g.pedir({ accion: 'yo', ...a }).datos);
  assert.deepEqual(yos.map((y) => y.nombre), ['Ana', 'Caro', 'Caro']);
  const tocan = accesos.map((a) => g.pedir({ accion: 'descubrir', ...a }).datos);
  tocan.forEach((t, i) => { assert.equal(t.length, 1); assert.notEqual(t[0].nombre, yos[i].nombre); });
  assert.deepEqual(tocan[1], tocan[2]);
  tocan.flat().filter((t) => t.nombre === 'Caro').forEach((t) => assert.equal(t.deseos, 'Un libro de ñandúes 🎁'));
  assert.match(g.pedir({ accion: 'descubrir', ...ana, persona: yos[1].persona }).error, /no está a tu cargo/);
  assert.match(g.pedir({ accion: 'guardarDeseos', ...ana, persona: yos[1].persona, deseos: 'x' }).error, /no está a tu cargo/);
  assert.deepEqual(['Ana', 'Caro', 'Beto'].map((n) => s.por(n).vio), [true, true, false]);

  for (const [a, d] of [['agregarPersona', { nombre: 'Eva', tipo: 'adulto' }], ['quitarPersona', { persona: yos[0].persona }], ['editarPersona', { persona: yos[0].persona, nombre: 'C', tipo: 'adulto' }],
    ['guardarEvento', { fecha: FECHA }], ['agregarExclusion', { de: yos[0].persona, a: yos[1].persona }], ['sortear', {}]]) {
    assert.match(s.ad(a, d).error, /ya se hizo/, a);
  }
  assert.ok(s.ad('reabrir').ok);
  assert.equal(s.por('Ana').vio, false);
  assert.match(g.pedir({ accion: 'descubrir', ...ana }).error, /Todavía/);
  assert.ok(g.pedir({ accion: 'yo', ...ana }).ok, 'volver a sortear no corta la sesión validada');
});

test('nombre validado: nadie más puede intentar entrar', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  // Dos personas piden PIN para el mismo nombre: gana la primera que valida
  s.pedirPin('Ana', 'intruso@x.com');
  s.pedirPin('Ana', 'ana@x.com');
  const pinIntruso = s.pinDe('intruso@x.com');
  assert.match(s.entrar('Ana', 'ana@x.com', pinIntruso === s.pinDe('ana@x.com') ? 'x' : pinIntruso).error, /no es correcto/, 'el PIN vale solo para su mail');
  const ana = { id: s.id, token: s.entrar('Ana', 'ana@x.com', s.pinDe('ana@x.com')).datos.token };
  assert.match(s.entrar('Ana', 'intruso@x.com', pinIntruso).error, /ya fue validado/);
  assert.match(s.pedirPin('Ana', 'intruso@x.com').error, /ya fue validado/);
  assert.match(s.pedirPin('Ana', 'ana@x.com').error, /ya fue validado/);
  assert.match(s.pedirPin('Beto', 'ana@x.com').error, /otro nombre/);
  const pub = JSON.stringify(g.pedir({ accion: 'grupo', id: s.id }).datos);
  assert.ok(!pub.includes('@') && pub.includes('"validada":true'), 'el link del grupo no muestra mails');

  // Volver desde otro dispositivo: el link va al mail validado
  const r = g.pedir({ accion: 'pedirLink', id: s.id, persona: s.por('Ana').id, mail: 'intruso@x.com' });
  assert.equal(r.datos.mail, 'a•••@x.com');
  assert.equal(g.correos.at(-1).to, 'ana@x.com');
  assert.ok(g.pedir({ accion: 'yo', ...link(g.correos.at(-1)) }).ok);
  assert.ok(g.pedir({ accion: 'yo', ...ana }).ok);
  assert.match(g.pedir({ accion: 'pedirLink', id: s.id, persona: s.por('Ana').id }).error, /Ya te enviamos/);
  assert.match(g.pedir({ accion: 'pedirLink', id: s.id, persona: s.por('Beto').id }).error, /no fue validado/);

  // Liberar corta el acceso y la siguiente persona lo ve
  const l = link(g.correos.at(-1));
  assert.ok(s.ad('liberar', { persona: s.por('Ana').id }).ok);
  for (const a of [ana, l]) assert.equal(g.pedir({ accion: 'yo', ...a }).sinAcceso, true);
  assert.equal(s.por('Ana').mail, '');
  const otra = s.validar('Ana', 'ana2@x.com');
  assert.ok(g.pedir({ accion: 'yo', ...otra }).datos.reinicio);
});

test('invitación: link y PIN al mail que cargó quien organiza', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', correo: 'ana@x.com', telefono: '' }, { nombre: 'Beto', correo: 'beto@x.com' }, { nombre: 'Caro' }, { nombre: 'Dani', correo: 'dani@x.com', telefono: '' }]);
  assert.match(s.ad('agregarPersona', { nombre: 'Eva', tipo: 'adulto' }).error, /código de área/, 'hace falta mail o teléfono');
  assert.equal(g.correos.length, 1, 'cargar no envía');
  assert.match(s.entrar('Ana', '', '123456').error, /no se envió tu PIN/);
  const r = s.ad('invitar');
  assert.ok(r.ok, r.error);
  assert.deepEqual(g.correos.slice(1).map((c) => c.to), ['ana@x.com', 'beto@x.com', 'dani@x.com']);
  assert.ok(g.correos[1].body.includes(`#/g/${s.id}/${s.por('Ana').id}`) && /^\d{6}$/m.test(g.correos[1].body), 'lleva link y PIN');
  assert.ok(!/"pin"|fallos/.test(JSON.stringify(r)), 'el panel no recibe el PIN');
  assert.match(s.ad('invitar').error, /No hay invitaciones/, 'no repite envíos');

  // Con mail cargado no sirve la vía del teléfono ni otro mail
  assert.match(s.pedirPin('Beto', 'intruso@x.com').error, /mail que cargó/);
  assert.match(s.pedirPin('Caro', 'ana@x.com').error, /otro nombre/);
  const pin = s.pinDe('ana@x.com');
  assert.equal(s.entrar('Dani', '', pin === s.pinDe('dani@x.com') ? 'x' : pin).ok, false, 'el PIN vale para un solo nombre');
  const e = s.entrar('Ana', 'intruso@x.com', pin);
  assert.ok(e.ok, e.error);
  assert.equal(s.por('Ana').mail, 'ana@x.com', 'queda el mail cargado');
  assert.match(s.entrar('Ana', '', pin).error, /ya fue validado/);
  s.validar('Caro');

  // Al sortear: link a quien validó, PIN nuevo a quien falta
  const antes = g.correos.length, viejo = s.pinDe('beto@x.com');
  assert.ok(s.ad('sortear').ok);
  const nuevos = g.correos.slice(antes);
  assert.deepEqual(nuevos.map((c) => [c.to, /^\d{6}$/m.test(c.body)]), [['ana@x.com', false], ['beto@x.com', true], ['caro@x.com', false], ['dani@x.com', true]]);
  if (viejo !== s.pinDe('beto@x.com')) assert.match(s.entrar('Beto', '', viejo).error, /no es correcto/);
  const b = { id: s.id, token: s.entrar('Beto', '', s.pinDe('beto@x.com')).datos.token };
  assert.equal(g.pedir({ accion: 'descubrir', ...b }).datos.length, 1);

  // Corregir el mail anula el PIN anterior
  const dani = s.por('Dani').id, pinDani = s.pinDe('dani@x.com');
  assert.ok(s.ad('corregirTelefono', { persona: dani, correo: 'dani2@x.com', telefono: '' }).ok);
  assert.equal(s.entrar('Dani', '', pinDani).ok, false);
  assert.ok(s.ad('invitar', { persona: dani }).ok);
  assert.match(s.ad('invitar', { persona: dani }).error, /Esperá/);
  for (let i = 0; i < 5; i++) assert.match(s.entrar('Dani', '', 'x').error, /no es correcto/);
  assert.match(s.entrar('Dani', '', s.pinDe('dani2@x.com')).error, /15 minutos/);
});

const perfil = (x) => ({ compartir: true, talles: { superior: 'M' }, gustos: ['Libros', 'Cerámica'], preferencias: 'Colores neutros', recibir: 'Una agenda', evitar: 'Chocolates', pistas: 'Zurda 🎁', ...x });
const guardarPerfil = (g, acceso, datos, mas) => g.pedir({ accion: 'guardarPerfil', ...acceso, datos, ...mas });
const fila = (g, id) => g.filas.find((f) => f[0] === id);
const leerFila = (g, id) => JSON.parse(fila(g, id)[2]);
const escribirFila = (g, id, cambio) => { const s = leerFila(g, id); cambio(s); fila(g, id)[2] = JSON.stringify(s); };
/** Quien le regala a esa persona, con su acceso. */
const quienRegalaA = (g, accesos, nombre) => Object.values(accesos).map((a) => g.pedir({ accion: 'descubrir', ...a }).datos).flat().find((t) => t.nombre === nombre);

test('deseos: se guardan, editan y recuperan por bloque', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const acc = Object.fromEntries(['Ana', 'Beto', 'Caro'].map((n) => [n, s.validar(n)]));
  const r = guardarPerfil(g, acc.Ana, perfil());
  assert.ok(r.ok, r.error);
  const guardado = leerFila(g, s.id).personas.find((p) => p.nombre === 'Ana').deseos;
  assert.deepEqual([guardado.talles.superior, guardado.gustos, guardado.evitar], ['M', ['Libros', 'Cerámica'], 'Chocolates'], 'cada bloque en su campo');
  guardarPerfil(g, acc.Ana, perfil({ evitar: '', gustos: [] }));
  const l = g.pedir({ accion: 'yo', ...acc.Ana }).datos.lista;
  assert.deepEqual([l.evitar, l.gustos, l.recibir, l.talles], ['', [], 'Una agenda', { superior: 'M', inferior: '', calzado: '', otro: '' }]);
  assert.ok(!JSON.stringify(s.ad('admin').datos).includes('Una agenda'), 'el panel no recibe listas');
  s.ad('sortear');
  const ve = quienRegalaA(g, acc, 'Ana');
  assert.deepEqual(ve.pistas, [{ hijo: '', talles: { superior: 'M' }, preferencias: 'Colores neutros', recibir: 'Una agenda', pistas: 'Zurda 🎁' }], 'solo bloques completos');
  guardarPerfil(g, acc.Ana, perfil({ compartir: false }));
  assert.ok(!JSON.stringify(quienRegalaA(g, acc, 'Ana')).includes('agenda'), 'sin compartir, el servidor no lo envía');
  assert.equal(g.pedir({ accion: 'yo', ...acc.Ana }).datos.lista.recibir, 'Una agenda', 'pero su dueña lo conserva');
  const emer = (s.ad('pedirEmergencia'), s.ad('verSorteo', { pin: s.pinDe('org@x.com') }));
  assert.ok(emer.ok && !JSON.stringify(emer).includes('agenda'), 'la emergencia no muestra listas');
});

test('deseos: formato anterior, vacíos e incompletos', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const acc = Object.fromEntries(['Ana', 'Beto', 'Caro'].map((n) => [n, s.validar(n)]));
  s.ad('sortear');
  const raros = [undefined, null, '', 0, true, [], {}, { gustos: 'x', talles: null, hijos: 'x' }, { hijos: [null, {}, { id: 'h1' }], gustos: [null, 3, {}] }, { compartir: 'no', recibir: { a: 1 } }];
  for (const raro of raros) {
    escribirFila(g, s.id, (d) => { const p = d.personas.find((x) => x.nombre === 'Ana'); if (raro === undefined) delete p.deseos; else p.deseos = raro; });
    const yo = g.pedir({ accion: 'yo', ...acc.Ana });
    assert.ok(yo.ok, JSON.stringify(raro));
    assert.ok(Array.isArray(yo.datos.lista.gustos) && Array.isArray(yo.datos.lista.hijos));
    assert.ok(Array.isArray(quienRegalaA(g, acc, 'Ana').pistas), JSON.stringify(raro));
  }
  escribirFila(g, s.id, (d) => { d.personas.find((x) => x.nombre === 'Ana').deseos = 'Un libro de ñandúes'; });
  const yo = g.pedir({ accion: 'yo', ...acc.Ana }).datos;
  assert.deepEqual([yo.deseos, yo.lista.recibir], ['Un libro de ñandúes', 'Un libro de ñandúes']);
  const ve = quienRegalaA(g, acc, 'Ana');
  assert.deepEqual([ve.deseos, ve.pistas], ['Un libro de ñandúes', [{ hijo: '', recibir: 'Un libro de ñandúes' }]]);
  assert.ok(g.pedir({ accion: 'guardarDeseos', ...acc.Ana, deseos: 'Otro libro' }).ok, 'una página vieja sigue guardando sobre texto');
  assert.ok(guardarPerfil(g, acc.Ana, perfil()).ok);
  assert.match(g.pedir({ accion: 'guardarDeseos', ...acc.Ana, deseos: 'pisar' }).error, /Recargá/, 'pero no pisa la lista nueva');
  assert.equal(g.pedir({ accion: 'yo', ...acc.Ana }).datos.lista.recibir, 'Una agenda');
  for (const datos of [undefined, null, 'x', []]) assert.ok(guardarPerfil(g, acc.Beto, datos).ok, 'se puede guardar vacío');
});

test('deseos: límites sin perder lo guardado', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const ana = s.validar('Ana');
  guardarPerfil(g, ana, perfil());
  const antes = fila(g, s.id)[2];
  for (const mal of [{ recibir: 'x'.repeat(501) }, { preferencias: 'x'.repeat(200), recibir: 'x'.repeat(200), evitar: 'x'.repeat(101), pistas: '' }, { talles: { calzado: 'x'.repeat(31) } }, { gustos: Array(13).fill('a') }, { gustos: ['x'.repeat(31)] }]) {
    assert.equal(guardarPerfil(g, ana, perfil(mal)).ok, false);
    assert.equal(fila(g, s.id)[2], antes, 'no cambia nada');
  }
  assert.ok(guardarPerfil(g, ana, perfil({ preferencias: '', recibir: 'x'.repeat(500), evitar: '', pistas: '' })).ok, 'justo en el límite');
  escribirFila(g, s.id, (d) => { d.evento.fecha = '2020-01-01'; });
  assert.match(guardarPerfil(g, ana, perfil()).error, /ya pasó/);
  assert.equal(g.pedir({ accion: 'yo', ...ana }).datos.editable, false);
});

test('deseos: un sorteo lleno de listas igual sortea, valida y entra', () => {
  const g = cargar('https://app/');
  g.estado.cupo = 1e6;
  const personas = Array.from({ length: 40 }, (_, i) => ({ nombre: 'Persona ' + i, correo: `persona${i}@ejemplo.com` }));
  const s = armar(g, personas);
  s.ad('invitar');
  const pines = personas.map((p) => s.pinDe(p.correo));
  const acc = personas.slice(0, 38).map((p, i) => ({ id: s.id, token: s.entrar(p.nombre, '', pines[i]).datos.token }));
  const grande = perfil({ preferencias: 'a'.repeat(125), recibir: 'a'.repeat(125), evitar: 'a'.repeat(125), pistas: 'a'.repeat(125) });
  let llenos = 0, rechazo = '';
  for (const a of acc) { const r = guardarPerfil(g, a, grande); if (r.ok) llenos++; else rechazo = r.error; }
  for (let i = 0; i < 5; i++) { const r = guardarPerfil(g, acc[0], grande, { perfil: 'nuevo', nombre: 'Hijo ' + i }); if (!r.ok) rechazo = r.error; }
  assert.match(rechazo, /más espacio/);
  assert.ok(llenos >= 25, 'listas completas que entran: ' + llenos);
  console.log('    listas completas con 40 personas:', llenos, '· tamaño:', fila(g, s.id)[2].length);
  assert.ok(s.ad('sortear').ok, 'sortea igual');
  for (const i of [38, 39]) assert.ok(s.entrar(personas[i].nombre, '', s.pinDe(personas[i].correo)).ok, 'valida igual');
  for (let i = 0; i < 10; i++) assert.ok(g.pedir({ accion: 'pedirLink', id: s.id, persona: s.por('Persona ' + i).id }).ok, 'reenvía links igual');
  assert.ok(g.pedir({ accion: 'descubrir', ...acc[5] }).ok);
});

test('hijos que no participan: nunca entran al sorteo', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const acc = Object.fromEntries(['Ana', 'Beto', 'Caro'].map((n) => [n, s.validar(n)]));
  guardarPerfil(g, acc.Ana, perfil({ recibir: 'Agenda de Ana' }));
  const nuevo = (nombre, x) => guardarPerfil(g, acc.Ana, perfil({ gustos: [], talles: {}, preferencias: '', evitar: '', pistas: '', ...x }), { perfil: 'nuevo', nombre });
  const emma = nuevo('Emma', { recibir: 'Muñeca' }), leo = nuevo('Leo', { recibir: 'Secreto de Leo', compartir: false });
  assert.ok(emma.ok && leo.ok, emma.error || leo.error);
  assert.equal(s.ad('admin').datos.personas.length, 3, 'no son participantes');
  assert.equal(g.pedir({ accion: 'grupo', id: s.id }).datos.personas.length, 3);
  for (const persona of [emma.datos.perfil, leo.datos.perfil]) {
    assert.equal(s.entrar('Ana', '', '1').ok, false);
    assert.equal(g.pedir({ accion: 'entrar', id: s.id, persona, pin: '1' }).ok, false);
    assert.equal(g.pedir({ accion: 'descubrir', ...acc.Ana, persona }).ok, false);
    assert.equal(s.ad('agregarExclusion', { de: persona, a: s.por('Beto').id }).ok, false);
  }
  for (let i = 0; i < 20; i++) {
    const ids = leerFila(g, s.id).personas.map((p) => p.id);
    const parejas = JSON.parse(JSON.stringify(g.contexto.sortearPersonas(leerFila(g, s.id).personas, [], 'A')));
    assert.deepEqual(Object.keys(parejas).sort(), [...ids].sort());
    Object.values(parejas).flat().forEach((x) => assert.ok(ids.includes(x)));
  }
  assert.match(guardarPerfil(g, acc.Beto, perfil(), { perfil: emma.datos.perfil, nombre: 'X' }).error, /ya no existe/, 'nadie edita perfiles ajenos');
  assert.match(guardarPerfil(g, acc.Beto, perfil(), { persona: s.por('Ana').id }).error, /no está a tu cargo/);
  assert.match(g.pedir({ accion: 'quitarPerfil', ...acc.Beto, perfil: emma.datos.perfil }).error, /ya no existe/);
  guardarPerfil(g, acc.Ana, perfil({ recibir: 'Otra agenda' }));
  assert.equal(g.pedir({ accion: 'yo', ...acc.Ana }).datos.lista.hijos.length, 2, 'editar lo propio no toca a los hijos');
  assert.ok(guardarPerfil(g, acc.Ana, perfil({ recibir: 'Muñeca grande', gustos: [], talles: {}, preferencias: '', evitar: '', pistas: '' }), { perfil: emma.datos.perfil, nombre: 'Emma' }).ok);
  s.ad('sortear');
  const ve = JSON.stringify(quienRegalaA(g, acc, 'Ana'));
  assert.ok(ve.includes('"hijo":"Emma"') && ve.includes('Muñeca grande') && ve.includes('Otra agenda'));
  assert.ok(!ve.includes('Leo'), 'el perfil no compartido no viaja');
  guardarPerfil(g, acc.Ana, perfil({ compartir: false }));
  const solo = JSON.parse(JSON.stringify(quienRegalaA(g, acc, 'Ana').pistas));
  assert.deepEqual(solo.map((x) => x.hijo), ['Emma'], 'compartir es independiente por perfil');
  assert.ok(g.pedir({ accion: 'quitarPerfil', ...acc.Ana, perfil: emma.datos.perfil }).ok);
  assert.deepEqual(g.pedir({ accion: 'yo', ...acc.Ana }).datos.lista.hijos.map((h) => h.nombre), ['Leo']);
  for (let i = 0; i < 4; i++) nuevo('Hijo ' + i);
  assert.match(nuevo('De más').error, /máximo es de 5/);
});

test('hijos que participan: lista propia, aparte de la del adulto', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const ana = s.por('Ana').id;
  for (const nombre of ['Nico', 'Mia', 'Leo']) s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: ana });
  const nico = s.por('Nico').id;
  const acc = Object.fromEntries(['Ana', 'Beto', 'Caro'].map((n) => [n, s.validar(n)]));
  assert.ok(guardarPerfil(g, acc.Ana, perfil({ recibir: 'Pelota' }), { persona: nico }).ok);
  assert.ok(guardarPerfil(g, acc.Ana, perfil({ recibir: 'Agenda' })).ok);
  assert.match(guardarPerfil(g, acc.Ana, perfil(), { persona: nico, perfil: 'nuevo', nombre: 'X' }).error, /Solo un adulto/);
  assert.match(guardarPerfil(g, acc.Beto, perfil(), { persona: nico }).error, /no está a tu cargo/);
  s.ad('sortear');
  const yo = g.pedir({ accion: 'yo', ...acc.Ana }).datos;
  assert.deepEqual([yo.lista.recibir, yo.aCargo.find((x) => x.nombre === 'Nico').lista.recibir], ['Agenda', 'Pelota']);
  const deNinos = yo.aCargo.map((n) => g.pedir({ accion: 'descubrir', ...acc.Ana, persona: n.persona }).datos[0]);
  assert.equal(deNinos.find((t) => t.nombre === 'Nico').pistas[0].recibir, 'Pelota');
  assert.ok(!JSON.stringify(deNinos).includes('Agenda'), 'no se mezclan');
});

const prop = (s) => s.ad('admin').datos.propuestas.map((q) => [q.de, q.a].sort().join() + ':' + q.motivos.join('+')).sort();

test('liberar: quien entra después no recibe nada de la persona anterior', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', correo: 'ana@x.com' }, { nombre: 'Beto', correo: 'beto@x.com' }, { nombre: 'Caro', correo: 'caro@x.com' }]);
  const ana = s.por('Ana').id;
  for (const nombre of ['Nico', 'Mia', 'Leo']) s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: ana });
  s.ad('invitar');
  const a = { id: s.id, token: s.entrar('Ana', '', s.pinDe('ana@x.com')).datos.token };
  const b = { id: s.id, token: s.entrar('Beto', '', s.pinDe('beto@x.com')).datos.token };
  guardarPerfil(g, b, perfil({ recibir: 'de Beto' }));
  guardarPerfil(g, a, perfil({ recibir: 'SECRETO' }));
  guardarPerfil(g, a, perfil({ recibir: 'SECRETO' }), { perfil: 'nuevo', nombre: 'Emma' });
  guardarPerfil(g, a, perfil({ recibir: 'SECRETO' }), { persona: s.por('Nico').id });

  // Cambiar el mail de quien validó se bloquea y conserva todo
  const antes = fila(g, s.id)[2];
  assert.match(s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'adulto', correo: 'org@x.com' }).error, /Corregir mail/);
  assert.match(s.ad('corregirTelefono', { persona: ana, correo: 'org@x.com' }).error, /ya fue validado/);
  assert.equal(fila(g, s.id)[2], antes);
  assert.ok(s.ad('editarPersona', { persona: ana, nombre: 'Ana María', tipo: 'adulto', correo: 'ana@x.com' }).ok, 'cambiar el nombre no corta nada');
  assert.equal(g.pedir({ accion: 'yo', ...a }).datos.lista.recibir, 'SECRETO');

  // El organizador libera y entra él
  assert.ok(s.ad('liberar', { persona: ana }).ok);
  assert.ok(!fila(g, s.id)[2].includes('SECRETO') && !fila(g, s.id)[2].includes('Emma'), 'no queda nada guardado');
  assert.ok(fila(g, s.id)[2].includes('de Beto'), 'lo de los demás queda');
  s.ad('editarPersona', { persona: ana, nombre: 'Ana María', tipo: 'adulto', correo: 'org@x.com' });
  s.ad('invitar', { persona: ana });
  const n = { id: s.id, token: s.entrar('Ana María', '', s.pinDe('org@x.com')).datos.token };
  const yo = JSON.stringify(g.pedir({ accion: 'yo', ...n }).datos);
  assert.ok(!yo.includes('SECRETO') && !yo.includes('Emma'));
  assert.equal(g.pedir({ accion: 'yo', ...a }).sinAcceso, true);
});

test('corregir datos antes de validar no borra nada; cambiar quién gestiona pide confirmar', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', correo: 'ana@x.com' }, { nombre: 'Beto', correo: 'beto@x.com' }, { nombre: 'Caro', correo: 'caro@x.com' }]);
  s.ad('invitar');
  assert.ok(s.ad('editarPersona', { persona: s.por('Ana').id, nombre: 'Ana', tipo: 'adulto', correo: 'ana2@x.com' }).ok);
  s.ad('agregarPersona', { nombre: 'Nico', tipo: 'nino', responsable: s.por('Beto').id });
  const b = { id: s.id, token: s.entrar('Beto', '', s.pinDe('beto@x.com')).datos.token };
  const nico = s.por('Nico').id;
  guardarPerfil(g, b, perfil(), { persona: nico });
  const aCaro = { persona: nico, nombre: 'Nico', tipo: 'nino', responsable: s.por('Caro').id };
  assert.match(s.ad('editarPersona', aCaro).error, /confirmar/);
  assert.match(s.ad('editarPersona', { persona: nico, nombre: 'Nico', tipo: 'nino', correo: 'org@x.com' }).error, /confirmar/, 'ni sacándole el responsable');
  assert.equal(g.pedir({ accion: 'yo', ...b }).datos.aCargo[0].lista.recibir, 'Una agenda');
  assert.ok(s.ad('editarPersona', { ...aCaro, responsable: s.por('Beto').id, nombre: 'Nicolás' }).ok, 'mismo responsable: no pide nada');
  assert.equal(g.pedir({ accion: 'yo', ...b }).datos.aCargo[0].lista.recibir, 'Una agenda');
  assert.ok(s.ad('editarPersona', { ...aCaro, vaciar: true }).ok);
  assert.ok(!fila(g, s.id)[2].includes('Una agenda'));
});

test('corregir el mail de quien validó: solo lo completa esa persona', () => {
  const g = cargar('https://app/');
  const s = armar(g, ['ana', 'beto', 'caro'].map((n) => ({ nombre: n, correo: n + '@x.com' })));
  s.ad('invitar');
  const entra = (n) => ({ id: s.id, token: s.entrar(n, '', s.pinDe(n + '@x.com')).datos.token });
  const a = entra('ana'), b = entra('beto');
  guardarPerfil(g, a, perfil());
  guardarPerfil(g, a, perfil(), { perfil: 'nuevo', nombre: 'Emma' });
  s.ad('sortear');
  const ana = s.por('ana').id;
  const viejo = link(g.correos.filter((c) => c.to === 'ana@x.com').at(-1));
  const parejas = leerFila(g, s.id).parejas;
  const toca = g.pedir({ accion: 'descubrir', ...a }).datos;
  for (const [mail, e] of [['', /Completá/], ['x', /válido/], ['ana@x.com', /mismo/], ['beto@x.com', /otro nombre/]]) assert.match(s.ad('proponerMail', { persona: ana, mail }).error, e);
  assert.match(s.ad('proponerMail', { persona: s.por('caro').id, mail: 'z@x.com' }).error, /Todavía no validó/);
  const enviados = g.correos.length;
  assert.ok(s.ad('proponerMail', { persona: ana, mail: 'nuevo@x.com' }).ok);
  assert.deepEqual([s.por('ana').mail, g.correos.length], ['ana@x.com', enviados], 'proponer no cambia ni envía nada');
  for (const quien of [b, { id: s.id, token: s.token }]) assert.equal(g.pedir({ accion: 'confirmarMail', ...quien, mail: 'nuevo@x.com' }).ok, false, 'ni otro participante ni el organizador');
  assert.match(g.pedir({ accion: 'confirmarMail', ...a, mail: 'otro@x.com' }).error, /no está pendiente/);
  const r = g.pedir({ accion: 'confirmarMail', ...a, mail: 'nuevo@x.com' });
  assert.ok(r.ok, r.error);
  const n = { id: s.id, token: r.datos.token };
  assert.equal(g.pedir({ accion: 'yo', ...viejo }).sinAcceso, true, 'el link anterior no sirve');
  const yo = g.pedir({ accion: 'yo', ...n }).datos;
  assert.deepEqual([yo.lista.recibir, yo.lista.hijos.length, yo.mailPropuesto], ['Una agenda', 1, '']);
  assert.deepEqual(g.pedir({ accion: 'descubrir', ...n }).datos, toca);
  assert.equal(leerFila(g, s.id).parejas, parejas, 'las asignaciones no cambian');
  assert.ok(s.por('ana').validada);
  g.pedir({ accion: 'pedirLink', id: s.id, persona: ana });
  assert.equal(g.correos.at(-1).to, 'nuevo@x.com');
  s.ad('proponerMail', { persona: ana, mail: 'tres@x.com' });
  assert.ok(g.pedir({ accion: 'rechazarMail', ...n }).ok);
  assert.deepEqual([s.por('ana').mail, s.por('ana').mailPropuesto], ['nuevo@x.com', '']);
});

test('casi lleno: se puede reducir y revocar, no agregar', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const a = s.validar('Ana');
  guardarPerfil(g, a, perfil());
  const emma = guardarPerfil(g, a, perfil(), { perfil: 'nuevo', nombre: 'Emma' }).datos.perfil;
  escribirFila(g, s.id, (d) => { d.relleno = ''; d.relleno = 'x'.repeat(44500 - JSON.stringify(d).length); });
  const antes = fila(g, s.id)[2];
  for (const [d, m] of [[perfil({ pistas: 'algo más largo que antes' }), {}], [perfil({ gustos: ['Libros', 'Cerámica', 'Café'] }), {}], [perfil(), { perfil: 'nuevo', nombre: 'Leo' }]]) {
    assert.match(guardarPerfil(g, a, d, m).error, /más espacio/);
    assert.equal(fila(g, s.id)[2], antes, 'no pierde ni pisa nada');
  }
  assert.ok(guardarPerfil(g, a, perfil({ compartir: false })).ok, 'dejar de compartir');
  assert.ok(guardarPerfil(g, a, perfil({ recibir: '' })).ok, 'acortar');
  assert.ok(guardarPerfil(g, a, perfil({ compartir: false }), { perfil: emma, nombre: 'Emma' }).ok);
  assert.ok(g.pedir({ accion: 'dejarDeCompartir', ...a }).ok);
  const l = g.pedir({ accion: 'yo', ...a }).datos.lista;
  assert.deepEqual([l.compartir, l.hijos[0].compartir, l.evitar], [false, false, 'Chocolates']);
});

test('compartir: solo true', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const acc = Object.fromEntries(['Ana', 'Beto', 'Caro'].map((n) => [n, s.validar(n)]));
  s.ad('sortear');
  for (const c of ['true', 'false', 1, 0, null, undefined, {}]) {
    guardarPerfil(g, acc.Ana, perfil({ compartir: c }));
    assert.deepEqual(quienRegalaA(g, acc, 'Ana').pistas, [], 'envío con ' + JSON.stringify(c));
    if (c !== undefined) {
      escribirFila(g, s.id, (d) => { d.personas.find((x) => x.nombre === 'Ana').deseos = { compartir: c, recibir: 'x' }; });
      assert.deepEqual(quienRegalaA(g, acc, 'Ana').pistas, [], 'guardado con ' + JSON.stringify(c));
    }
  }
  guardarPerfil(g, acc.Ana, perfil({ compartir: true }));
  assert.equal(quienRegalaA(g, acc, 'Ana').pistas.length, 1);
  for (const viejo of ['Un libro', { recibir: 'Un libro' }]) {
    escribirFila(g, s.id, (d) => { d.personas.find((x) => x.nombre === 'Ana').deseos = viejo; });
    assert.equal(quienRegalaA(g, acc, 'Ana').pistas[0].recibir, 'Un libro', 'registro anterior sin el campo');
  }
});

test('adulto a niño: se bloquea si tiene hijos, pareja o figura como padre', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const a = s.validar('Ana');
  const ana = s.por('Ana').id;
  const pasar = () => s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'nino', telefono: TEL });
  const emma = guardarPerfil(g, a, perfil(), { perfil: 'nuevo', nombre: 'Emma' }).datos.perfil;
  assert.match(pasar().error, /menores a cargo/);
  assert.equal(g.pedir({ accion: 'yo', ...a }).datos.lista.hijos.length, 1, 'siguen y se pueden editar');
  g.pedir({ accion: 'quitarPerfil', ...a, perfil: emma });
  s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'adulto', telefono: TEL, pareja: s.por('Beto').id });
  assert.match(pasar().error, /pareja/);
  s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'adulto', telefono: TEL, pareja: '' });
  s.ad('agregarPersona', { nombre: 'Nico', tipo: 'nino', telefono: TEL, padre1: ana });
  assert.match(pasar().error, /Madre \/ Padre/);
  s.ad('editarPersona', { persona: s.por('Nico').id, nombre: 'Nico', tipo: 'nino', telefono: TEL, padre1: '', padre2: '' });
  assert.ok(pasar().ok);
});

test('después del encuentro: se deja de compartir, nada más', () => {
  const g = cargar('https://app/');
  const s = armar(g, [...nombres('Ana', 'Beto', 'Caro')]);
  s.ad('agregarPersona', { nombre: 'Nico', tipo: 'nino', responsable: s.por('Ana').id });
  const nico = s.por('Nico').id;
  const a = s.validar('Ana'), b = s.validar('Beto');
  guardarPerfil(g, a, perfil());
  guardarPerfil(g, a, perfil(), { persona: nico });
  const emma = guardarPerfil(g, a, perfil(), { perfil: 'nuevo', nombre: 'Emma' }).datos.perfil;
  escribirFila(g, s.id, (d) => { d.evento.fecha = '2020-01-01'; });
  assert.match(guardarPerfil(g, a, perfil({ recibir: 'otra' })).error, /ya pasó/);
  assert.equal(g.pedir({ accion: 'dejarDeCompartir', ...b, persona: s.por('Ana').id }).ok, false, 'nadie revoca por otro');
  for (const m of [{}, { perfil: emma }, { persona: nico }]) assert.ok(g.pedir({ accion: 'dejarDeCompartir', ...a, ...m }).ok);
  const yo = g.pedir({ accion: 'yo', ...a }).datos;
  assert.deepEqual([yo.lista.compartir, yo.lista.hijos[0].compartir, yo.aCargo[0].lista.compartir], [false, false, false]);
  assert.equal(yo.lista.recibir, 'Una agenda', 'el contenido no cambia');
  assert.equal(g.pedir({ accion: 'dejarDeCompartir', ...a, compartir: true, datos: perfil({ recibir: 'x' }) }).ok, true);
  assert.equal(g.pedir({ accion: 'yo', ...a }).datos.lista.recibir, 'Una agenda');
  assert.equal(g.pedir({ accion: 'yo', ...a }).datos.lista.compartir, false, 'no se puede volver a compartir');
});

test('relaciones: no dan permisos y hay un único responsable', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro', 'Dani'));
  const [ana, beto, caro] = ['Ana', 'Beto', 'Caro'].map((n) => s.por(n).id);
  const editar = (persona, nombre, x) => s.ad('editarPersona', { persona, nombre, tipo: 'adulto', telefono: TEL, ...x });
  assert.ok(editar(ana, 'Ana', { pareja: beto }).ok);
  assert.equal(s.por('Beto').pareja, ana, 'es recíproca');
  assert.match(editar(caro, 'Caro', { pareja: ana }).error, /otra pareja/);
  assert.match(editar(ana, 'Ana', { pareja: ana }).error, /otro adulto/);
  assert.ok(s.ad('agregarPersona', { nombre: 'Nico', tipo: 'nino', responsable: ana, padre1: ana, padre2: beto }).ok);
  assert.match(s.ad('agregarPersona', { nombre: 'X', tipo: 'nino', responsable: ana, padre1: s.por('Nico').id }).error, /otro adulto/);
  assert.ok(s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'adulto', telefono: TEL }).ok);
  assert.equal(s.por('Ana').pareja, beto, 'un pedido sin relaciones no las borra');
  const a = s.validar('Ana'), b = s.validar('Beto'), c = s.validar('Caro');
  const nico = s.por('Nico').id;
  guardarPerfil(g, a, perfil({ recibir: 'de Nico' }), { persona: nico });
  const yoB = g.pedir({ accion: 'yo', ...b }).datos;
  assert.ok(yoB.aCargo.length === 0 && !JSON.stringify(yoB).includes('Nico'), 'el otro progenitor no ve nada');
  for (const accion of ['descubrir', 'guardarPerfil', 'dejarDeCompartir']) assert.match(g.pedir({ accion, ...b, persona: nico, datos: perfil() }).error, /no está a tu cargo/);
  assert.match(guardarPerfil(g, b, perfil(), { perfil: 'nuevo', nombre: 'nico' }).error, /tiene un responsable/, 'no lo incorpora de nuevo');
  const emma = guardarPerfil(g, a, perfil(), { perfil: 'nuevo', nombre: 'Emma' });
  assert.ok(emma.ok);
  assert.match(guardarPerfil(g, b, perfil(), { perfil: 'nuevo', nombre: 'EMMA' }).error, /ya fue incorporado/);
  const leo = guardarPerfil(g, b, perfil(), { perfil: 'nuevo', nombre: 'Leo' });
  assert.ok(leo.ok);
  assert.match(guardarPerfil(g, b, perfil(), { perfil: leo.datos.perfil, nombre: 'Emma' }).error, /ya fue incorporado/, 'tampoco renombrando');
  assert.ok(guardarPerfil(g, c, perfil(), { perfil: 'nuevo', nombre: 'Emma' }).ok, 'otra familia puede tener una Emma');
  assert.ok(s.ad('quitarPersona', { persona: beto }).ok);
  assert.deepEqual([s.por('Ana').pareja, s.por('Nico').padres], ['', [ana]], 'al quitar a alguien no quedan relaciones sueltas');
});

test('propuestas: por id y motivo, en ambos sentidos y según modalidad', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro', 'Dani'));
  const [ana, beto, caro] = ['Ana', 'Beto', 'Caro'].map((n) => s.por(n).id);
  const editar = (persona, nombre, x) => { const r = s.ad('editarPersona', { persona, nombre, tipo: 'adulto', telefono: TEL, ...x }); assert.ok(r.ok, r.error); };
  const modo = (modalidad) => assert.ok(s.ad('guardarEvento', { fecha: FECHA, modalidad }).ok);
  const k = (...ids) => ids.sort().join();
  assert.deepEqual(prop(s), [], 'sin relaciones no propone nada');
  editar(ana, 'Ana', { pareja: beto });
  for (const nombre of ['Nico', 'Mia', 'Leo']) s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: caro, ...(nombre === 'Nico' ? { padre1: ana, padre2: caro } : {}) });
  const [nico, mia, leo] = ['Nico', 'Mia', 'Leo'].map((n) => s.por(n).id);
  assert.deepEqual(prop(s), [k(ana, beto) + ':pareja'], 'cada uno con su grupo: solo parejas');
  modo('B');
  const todas = [k(ana, beto) + ':pareja', k(ana, nico) + ':progenitor', k(caro, nico) + ':progenitor+a_cargo', k(caro, mia) + ':a_cargo', k(caro, leo) + ':a_cargo'].sort();
  assert.deepEqual(prop(s), todas, 'a cargo y madre o padre son motivos distintos');

  // Pendientes: no cuentan ni dejan sortear
  assert.deepEqual(s.ad('admin').datos.exclusiones, []);
  assert.match(s.ad('sortear').error, /5 exclusiones propuestas sin revisar/);
  assert.equal(s.ad('admin').datos.verificacion.ok, true);

  // Aceptar: dos sentidos y motivo
  const r = s.ad('aceptarPropuesta', { de: beto, a: ana });
  assert.deepEqual(r.datos.exclusiones.map((e) => [k(e.de, e.a), e.motivos.join()]), [[k(ana, beto), 'pareja'], [k(ana, beto), 'pareja']]);
  // Descartar: por ids, y no vuelve aunque cambien nombres
  assert.ok(s.ad('descartarPropuesta', { de: caro, a: nico }).ok);
  const d = leerFila(g, s.id).descartadas;
  assert.deepEqual(d.sort(), ['a_cargo', 'progenitor'].map((m) => [caro, nico].sort().join('|') + '|' + m));
  editar(caro, 'Carolina');
  s.ad('editarPersona', { persona: nico, nombre: 'Nicolás', tipo: 'nino', responsable: caro, padre1: ana, padre2: caro });
  const quedan = [k(ana, nico) + ':progenitor', k(caro, mia) + ':a_cargo', k(caro, leo) + ':a_cargo'].sort();
  assert.deepEqual(prop(s), quedan);
  assert.match(s.ad('descartarPropuesta', { de: caro, a: nico }).error, /ya no está/);
  // Quitar y recargar la relación la propone otra vez, solo por ese motivo
  s.ad('editarPersona', { persona: nico, nombre: 'Nicolás', tipo: 'nino', responsable: caro, padre1: ana, padre2: '' });
  assert.deepEqual(prop(s), quedan);
  s.ad('editarPersona', { persona: nico, nombre: 'Nicolás', tipo: 'nino', responsable: caro, padre1: ana, padre2: caro });
  assert.deepEqual(prop(s), [...quedan, k(caro, nico) + ':progenitor'].sort());
  // Quitar a mano una aprobada no la vuelve a proponer
  s.ad('quitarExclusion', { de: ana, a: beto, ambos: true });
  assert.deepEqual(s.ad('admin').datos.exclusiones, []);
  assert.ok(!prop(s).some((q) => q.endsWith(':pareja')));
  // Marcar a mano la acepta
  s.ad('agregarExclusion', { de: ana, a: nico, ambos: true });
  assert.deepEqual(s.ad('admin').datos.exclusiones.map((e) => e.motivos.join()), ['progenitor', 'progenitor']);
  // Cambia la relación: lo aprobado queda y avisa
  s.ad('editarPersona', { persona: nico, nombre: 'Nicolás', tipo: 'nino', responsable: caro, padre1: beto, padre2: '' });
  let v = s.ad('admin').datos;
  assert.deepEqual([v.exclusiones.length, v.sinRelacion.length], [2, 1]);
  assert.ok(prop(s).includes(k(beto, nico) + ':progenitor'), 'par nuevo, propuesta nueva');
  v = s.ad('mantenerExclusion', { de: ana, a: nico }).datos;
  assert.deepEqual([v.exclusiones.length, v.sinRelacion.length], [2, 0]);
  s.ad('aceptarPropuesta');
  assert.deepEqual(prop(s), []);
  modo('A');
  assert.deepEqual(s.ad('admin').datos.propuestas, []);
});

test('propuestas aceptadas se respetan; las de adulto y niño no afectan a cada uno con su grupo', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro', 'Dani', 'Eva'));
  const ids = Object.fromEntries(['Ana', 'Beto', 'Caro', 'Dani', 'Eva'].map((n) => [n, s.por(n).id]));
  s.ad('editarPersona', { persona: ids.Ana, nombre: 'Ana', tipo: 'adulto', telefono: TEL, pareja: ids.Beto });
  for (const nombre of ['Nico', 'Mia', 'Leo']) s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: ids.Ana, padre1: ids.Ana, padre2: ids.Beto });
  s.ad('guardarEvento', { fecha: FECHA, modalidad: 'B' });
  // Si todos los niños son de la misma pareja, no tiene solución y se avisa antes de aceptar
  assert.equal(s.ad('admin').datos.verificacionConPropuestas.ok, false);
  s.ad('agregarPersona', { nombre: 'Otro', tipo: 'nino', telefono: TEL });
  assert.equal(s.ad('admin').datos.verificacionConPropuestas.ok, true);
  s.ad('aceptarPropuesta');
  for (let i = 0; i < 60; i++) {
    const d = leerFila(g, s.id);
    const b = g.contexto.sortearPersonas(d.personas, d.exclusiones, 'B');
    for (const [de, l] of Object.entries(b)) for (const a of l) {
      assert.ok(!d.exclusiones.some((e) => e.de === de && e.a === a));
      assert.ok(g.contexto.cruza_({ evento: { modalidad: 'B' } }, d.personas.find((p) => p.id === de), d.personas.find((p) => p.id === a)), 'solo cruces de la modalidad');
    }
    const A = g.contexto.sortearPersonas(d.personas, d.exclusiones, 'A');
    for (const [de, l] of Object.entries(A)) assert.ok(g.contexto.cruza_({ evento: { modalidad: 'A' } }, d.personas.find((p) => p.id === de), d.personas.find((p) => p.id === l[0])));
  }
  // En A, con y sin las exclusiones de adulto y niño, el resultado es idéntico con el mismo azar
  const d = leerFila(g, s.id);
  const tipo = Object.fromEntries(d.personas.map((p) => [p.id, p.tipo]));
  const sinCruzadas = d.exclusiones.filter((e) => tipo[e.de] === tipo[e.a]);
  assert.ok(sinCruzadas.length < d.exclusiones.length);
  const conAzar = (semilla, ex) => {
    let n = semilla;
    g.contexto.__azar = () => (n = (n * 16807) % 2147483647) / 2147483647;
    require('vm').runInContext('var __m = Math.random; Math.random = __azar;', g.contexto);
    const r = JSON.stringify(g.contexto.sortearPersonas(d.personas, ex, 'A'));
    require('vm').runInContext('Math.random = __m;', g.contexto);
    return r;
  };
  for (let i = 1; i <= 60; i++) assert.equal(conAzar(i * 7919, d.exclusiones), conAzar(i * 7919, sinCruzadas));

  // Si aceptarlas lo vuelve imposible, lo avisa antes
  const t = armar(g, nombres('Uno', 'Dos', 'Tres'));
  t.ad('editarPersona', { persona: t.por('Uno').id, nombre: 'Uno', tipo: 'adulto', telefono: TEL, pareja: t.por('Dos').id });
  let v = t.ad('admin').datos;
  assert.deepEqual([v.verificacion.ok, v.verificacionConPropuestas.ok], [true, false]);
  v = t.ad('aceptarPropuesta').datos;
  assert.equal(v.verificacion.ok, false);
  v = t.ad('quitarExclusion', { de: t.por('Uno').id, a: t.por('Dos').id, ambos: true }).datos;
  assert.deepEqual([v.verificacion.ok, v.propuestas], [true, []]);
  assert.ok(t.ad('sortear').ok);
});

test('sorteo existente: idéntico byte a byte, sin propuestas ni bloqueo', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro', 'Dani'));
  const [ana, beto] = ['Ana', 'Beto'].map((n) => s.por(n).id);
  for (const nombre of ['Nico', 'Mia', 'Leo']) s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: ana });
  s.ad('agregarExclusion', { de: ana, a: beto });
  const a = s.validar('Ana');
  // Formato publicado antes de esta entrega
  escribirFila(g, s.id, (d) => {
    delete d.propuestas; delete d.descartadas;
    d.personas.forEach((p) => { delete p.padres; delete p.pareja; delete p.mailPropuesto; });
    d.exclusiones.forEach((e) => { delete e.motivos; });
    d.personas[0].deseos = { compartir: true, talles: {}, gustos: ['Libros'], preferencias: '', recibir: 'x', evitar: '', pistas: '', hijos: [{ id: 'h1', nombre: 'Emma', compartir: true, talles: {}, gustos: [], recibir: 'y' }] };
  });
  const mirar = () => {
    const antes = fila(g, s.id)[2];
    for (let i = 0; i < 3; i++) { s.ad('admin'); g.pedir({ accion: 'grupo', id: s.id }); g.pedir({ accion: 'yo', ...a }); }
    assert.equal(fila(g, s.id)[2], antes, 'abrirlo no cambia un byte');
  };
  mirar();
  for (const modalidad of ['A', 'B']) {
    s.ad('guardarEvento', { fecha: FECHA, modalidad });
    const v = s.ad('admin').datos;
    assert.deepEqual([v.propuestas, v.sinRelacion, v.verificacionConPropuestas, v.exclusiones], [[], [], null, [{ de: ana, a: beto }]]);
  }
  s.ad('editarPersona', { persona: s.por('Nico').id, nombre: 'Nico', tipo: 'nino', responsable: ana, padre1: ana, padre2: beto });
  assert.deepEqual(s.ad('admin').datos.propuestas, [], 'ni cargando relaciones');
  const d = leerFila(g, s.id);
  assert.ok(!('propuestas' in d) && !('descartadas' in d));
  assert.ok(s.ad('sortear').ok, 'sortea sin bloqueo');
  const parejas = leerFila(g, s.id).parejas;
  mirar();
  assert.ok(g.pedir({ accion: 'descubrir', ...a }).ok);
  mirar();
  assert.equal(leerFila(g, s.id).parejas, parejas, 'asignaciones sin recalcular');
});

test('matriz: misma función que el sorteo real', () => {
  const g = cargar('https://app/');
  let ok = 0, conflicto = 0;
  for (let k = 0; k < 60; k++) {
    g.contexto.MAX_CREACIONES_POR_MAIL = g.contexto.MAX_CREACIONES_POR_DIA = 1e9; g.estado.cupo = 1e6;
    const s = armar(g, [...nombres('Ana', 'Beto', 'Caro', 'Dani'), ...(k % 2 ? [{ nombre: 'Nico', tipo: 'nino' }] : [])]);
    if (k % 2) s.ad('guardarEvento', { fecha: FECHA, modalidad: 'B' });
    const ps = s.ad('admin').datos.personas;
    for (const de of ps) for (const a of ps) if (de !== a && Math.random() < .42) s.ad('agregarExclusion', { de: de.id, a: a.id });
    const v = s.ad('admin').datos.verificacion;
    const sim = s.ad('simular');
    assert.equal(sim.ok, v.ok);
    assert.equal(leerFila(g, s.id).parejas, '', 'simular no guarda nada');
    const real = s.ad('sortear');
    assert.equal(real.ok, v.ok, 'lo validado se puede sortear, y al revés');
    if (v.ok) ok++; else { conflicto++; assert.equal(real.error, v.motivo); assert.ok(s.ad('limpiarExclusiones').datos.verificacion.ok); }
  }
  assert.ok(ok > 8 && conflicto > 8, ok + '/' + conflicto);
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  s.ad('sortear');
  assert.match(s.ad('simular').error, /ya se hizo/);
  assert.match(s.ad('limpiarExclusiones').error, /ya se hizo/);
  assert.equal(s.ad('admin').datos.verificacion, null);
  for (let i = 0; i < 2; i++) assert.ok(s.ad('reabrir').ok);
  const [a, b] = ['Ana', 'Beto'].map((n) => s.por(n).id);
  for (let i = 0; i < 3; i++) s.ad('agregarExclusion', { de: a, a: b });
  assert.equal(s.ad('admin').datos.exclusiones.length, 1, 'repetir no duplica');
  for (let i = 0; i < 2; i++) assert.equal(s.ad('quitarExclusion', { de: a, a: b }).datos.exclusiones.length, 0);
});

test('teléfono: tiene que coincidir con el cargado', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', telefono: '2966 15-123456' }, { nombre: 'Beto' }, { nombre: 'Caro' }]);
  for (const telefono of ['', '123', 'abc']) assert.match(s.ad('agregarPersona', { nombre: 'Eva', tipo: 'adulto', telefono }).error, /código de área/);
  assert.ok(!JSON.stringify(g.pedir({ accion: 'grupo', id: s.id })).includes('123456'), 'el link del grupo no muestra teléfonos');
  const antes = g.correos.length;
  assert.match(s.pedirPin('Ana', 'x@x.com', '11 4321 9876').error, /no coincide/);
  assert.match(s.pedirPin('Ana', 'x@x.com', '').error, /código de área/);
  assert.equal(g.correos.length, antes, 'sin teléfono correcto no sale ningún mail');
  for (const t of ['+54 9 2966 123456', '02966-123456']) assert.ok(s.pedirPin('Ana', `m${t.length}@x.com`, t).ok, t);
  for (let i = 0; i < 4; i++) s.pedirPin('Ana', 'x@x.com', '11 0000 0000');
  assert.match(s.pedirPin('Ana', 'x@x.com', '2966123456').error, /Demasiados intentos/);
  s.ad('sortear');
  const beto = s.por('Beto').id;
  assert.ok(s.ad('corregirTelefono', { persona: beto, telefono: '351 555 4444' }).ok, 'se corrige aun después del sorteo');
  assert.match(s.pedirPin('Beto', 'b@x.com').error, /no coincide/);
  assert.ok(s.pedirPin('Beto', 'b@x.com', '0351 155554444').ok);
  s.validar('Caro');
  assert.match(s.ad('corregirTelefono', { persona: s.por('Caro').id, telefono: '351 555 4444' }).error, /ya fue validado/);
});

test('PIN: se usa una vez, vence por intentos y limita envíos', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto'));
  s.pedirPin('Ana', 'ana@x.com');
  assert.match(s.pedirPin('Ana', 'ana@x.com').error, /esperá/);
  const pin = s.pinDe('ana@x.com');
  const malo = pin === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) assert.match(s.entrar('Ana', 'ana@x.com', malo).error, /no es correcto/);
  assert.match(s.entrar('Ana', 'ana@x.com', malo).error, /Demasiados/);
  assert.match(s.entrar('Ana', 'ana@x.com', pin).error, /venció/);
  for (const m of ['', 'x', 'a@b', 'a@b.com,c@d.com']) assert.equal(s.pedirPin('Ana', m).ok, false);
  for (let i = 0; i < 4; i++) assert.ok(s.pedirPin('Ana', `m${i}@x.com`).ok);
  assert.match(s.pedirPin('Ana', 'm9@x.com').error, /varios PIN para este nombre/);
  g.estado.cupo = 0;
  assert.match(s.pedirPin('Beto', 'beto@x.com').error, /quedan 0 mails/);
});

test('adulto que gestiona a sus niños', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  const ana = s.por('Ana').id, beto = s.por('Beto').id;
  for (const nombre of ['Nico', 'Mia', 'Leo']) assert.ok(s.ad('agregarPersona', { nombre, tipo: 'nino', responsable: nombre === 'Leo' ? beto : ana }).ok);
  const nico = s.por('Nico').id, leo = s.por('Leo').id;
  assert.match(s.ad('agregarPersona', { nombre: 'Otro', tipo: 'nino', responsable: nico }).error, /tiene que ser un adulto/);
  assert.match(s.ad('quitarPersona', { persona: ana }).error, /Nico, Mia/);
  assert.match(s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'nino' }).error, /es responsable de/);
  assert.deepEqual(g.pedir({ accion: 'grupo', id: s.id }).datos.personas.map((p) => p.nombre), ['Ana', 'Beto', 'Caro']);
  assert.match(s.pedirPin('Nico', 'n@x.com').error, /a cargo de un adulto/);
  const acceso = s.validar('Ana');
  assert.ok(g.pedir({ accion: 'guardarDeseos', ...acceso, persona: nico, deseos: 'Pelota' }).ok);
  assert.ok(s.ad('sortear').ok);
  const yo = g.pedir({ accion: 'yo', ...acceso }).datos;
  assert.deepEqual(yo.aCargo.map((x) => [x.nombre, x.deseos, x.regala]), [['Nico', 'Pelota', true], ['Mia', '', true]]);
  const toca = g.pedir({ accion: 'descubrir', ...acceso, persona: nico }).datos;
  assert.ok(['Mia', 'Leo'].includes(toca[0].nombre));
  assert.deepEqual([s.por('Nico').vio, s.por('Ana').vio], [true, false]);
  assert.match(g.pedir({ accion: 'descubrir', ...acceso, persona: leo }).error, /no está a tu cargo/);
  assert.match(g.pedir({ accion: 'guardarDeseos', ...acceso, persona: leo, deseos: 'x' }).error, /no está a tu cargo/);
});

test('acceso de emergencia: solo quien organiza y con PIN de su mail', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  assert.match(s.ad('pedirEmergencia').error, /Todavía/);
  const ana = s.validar('Ana');
  s.ad('sortear');
  for (const accion of ['pedirEmergencia', 'verSorteo']) {
    assert.equal(g.pedir({ accion, ...ana, pin: '1' }).sinAcceso, true, 'una persona participante no puede');
    assert.equal(g.pedir({ accion, id: s.id }).sinAcceso, true);
  }
  assert.match(s.ad('verSorteo').error, /venció o no existe/, 'el link de administración solo no alcanza');
  assert.ok(s.ad('pedirEmergencia').ok);
  assert.equal(g.correos.at(-1).to, 'org@x.com');
  const pin = s.pinDe('org@x.com');
  const r = s.ad('verSorteo', { pin });
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.datos.map((x) => x.nombre), ['Ana', 'Beto', 'Caro']);
  assert.deepEqual(r.datos[0].regalaA, g.pedir({ accion: 'descubrir', ...ana }).datos.map((x) => x.nombre));
  assert.match(s.ad('verSorteo', { pin }).error, /venció/, 'el PIN sirve una sola vez');
});

test('cupo, mails que fallan y sorteo imposible', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto', 'Caro'));
  ['Ana', 'Beto', 'Caro'].forEach((n) => s.validar(n));
  const antes = g.correos.length;
  g.estado.cupo = 2;
  assert.match(s.ad('sortear').error, /quedan 2 mails/);
  assert.equal(g.correos.length, antes);
  assert.equal(s.ad('admin').datos.estado, 'abierto');
  g.estado.cupo = 50;
  const [a, b, c] = ['Ana', 'Beto', 'Caro'].map((n) => s.por(n).id);
  s.ad('agregarExclusion', { de: a, a: b, ambos: true });
  s.ad('agregarExclusion', { de: a, a: c });
  assert.match(s.ad('sortear').error, /imposible/);
  assert.equal(g.correos.length, antes);
  s.ad('quitarExclusion', { de: a, a: c });
  s.ad('quitarExclusion', { de: b, a: a });
  g.estado.rebota = 'beto@x.com';
  const r = s.ad('sortear');
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.datos.personas.map((p) => p.envio), ['enviado', 'error', 'enviado']);
  g.estado.rebota = null;
  assert.equal(s.ad('reenviar', { persona: b, mail: 'otro@x.com' }).datos.personas[1].envio, 'enviado');
  assert.equal(g.correos.at(-1).to, 'beto@x.com', 'reenviar no cambia el mail');
});

test('seguridad: accesos cruzados, datos inválidos y abuso', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana', 'Beto'));
  const t = armar(g, nombres('Zoe'));
  for (const accion of ['admin', 'guardarEvento', 'agregarPersona', 'editarPersona', 'quitarPersona', 'agregarExclusion', 'quitarExclusion', 'limpiarExclusiones', 'aceptarPropuesta', 'descartarPropuesta', 'mantenerExclusion', 'proponerMail', 'simular', 'corregirTelefono', 'liberar', 'reabrir', 'sortear', 'reenviar', 'invitar', 'pedirEmergencia', 'verSorteo']) {
    assert.equal(g.pedir({ accion, id: s.id, token: t.token, nombre: 'X', tipo: 'adulto' }).sinAcceso, true, accion);
    assert.equal(g.pedir({ accion, id: s.id }).sinAcceso, true, accion);
  }
  for (const token of ['', null, undefined, {}]) assert.equal(g.pedir({ accion: 'yo', id: s.id, token }).sinAcceso, true);
  assert.equal(g.pedir({ accion: 'yo', id: s.id, token: s.token }).sinAcceso, true, 'el link de admin no abre participantes');
  for (const accion of ['constructor', '__proto__', 'nada', undefined]) assert.equal(g.pedir({ accion }).ok, false);
  for (const nombre of ['', 'evil.com', 'a<b', 'http://x', 'x'.repeat(41)]) assert.equal(s.ad('agregarPersona', { nombre, tipo: 'adulto', telefono: TEL }).ok, false, nombre);
  for (const nombre of ['Ma. José', "O'Neill", 'Íñigo 2']) assert.ok(s.ad('agregarPersona', { nombre, tipo: 'adulto', telefono: TEL }).ok, nombre);
  assert.match(s.ad('agregarPersona', { nombre: 'ANA', tipo: 'adulto', telefono: TEL }).error, /Ya hay/);
  s.ad('agregarPersona', { nombre: 'Eva', tipo: 'adulto', telefono: TEL, mail: 'plantado@x.com', validada: 'si' });
  assert.deepEqual([s.por('Eva').mail, s.por('Eva').validada], ['', ''], 'quien organiza no carga mails');
  for (const fecha of ['', '2020-01-01', '2099-01-01', '2026-13-45']) assert.equal(s.ad('guardarEvento', { fecha }).ok, false, fecha);
  for (const presupuesto of [-1, 'abc']) assert.equal(s.ad('guardarEvento', { fecha: FECHA, presupuesto }).ok, false);
  assert.ok(g.pedir({ accion: 'crear', nombre: 'V', mail: 'org@x.com', acepta: true, fecha: FECHA }).ok);
  assert.match(g.pedir({ accion: 'crear', nombre: 'V', mail: 'org@x.com', acepta: true, fecha: FECHA }).error, /varios/);
  assert.equal(g.pedir('no es json').ok, false);
});

test('borrado a los 30 días', () => {
  const g = cargar('https://app/');
  const s = armar(g, nombres('Ana'));
  armar(g, nombres('Zoe'));
  g.filas[1][1] = '2020-01-01';
  g.contexto.borrarVencidos();
  assert.equal(g.filas.length, 2);
  assert.match(g.pedir({ accion: 'grupo', id: s.id }).error, /no existe/);
});

test('modalidad B por la API: los niños no regalan', () => {
  const g = cargar('https://app/');
  const s = armar(g, [...nombres('Ana', 'Beto', 'Caro'), { nombre: 'Nico', tipo: 'nino' }]);
  s.ad('guardarEvento', { fecha: FECHA, presupuesto: '20000.5', modalidad: 'B' });
  const [nico, caro] = [s.validar('Nico'), s.validar('Caro')];
  assert.ok(s.ad('sortear').ok);
  assert.equal(g.pedir({ accion: 'yo', ...nico }).datos.regala, false);
  assert.deepEqual(g.pedir({ accion: 'descubrir', ...nico }).datos, []);
  assert.deepEqual(g.pedir({ accion: 'descubrir', ...caro }).datos.map((x) => x.nombre === 'Nico').sort(), [false, true]);
});
