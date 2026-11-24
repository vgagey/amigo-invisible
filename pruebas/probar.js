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

function armar(g, personas) {
  assert.ok(g.pedir({ accion: 'crear', nombre: 'Orga', mail: 'org@x.com', acepta: true }).ok);
  const [, id, token] = g.correos.at(-1).body.match(/#\/a\/(\w+)\/(\w+)/);
  const ad = (accion, x) => g.pedir({ accion, id, token, ...x });
  let r;
  personas.forEach((p) => { r = ad('agregarPersona', { tipo: 'adulto', mail: '', ...p }); assert.ok(r.ok, r.error); });
  return { id, token, ad, por: (n) => ad('admin').datos.personas.find((p) => p.nombre === n) };
}
const link = (c) => { const [, id, token] = c.body.match(/#\/s\/(\w+)\/(\w+)/); return { id, token }; };

test('recorrido completo con mail y con PIN', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', mail: 'ana@x.com' }, { nombre: 'Beto', mail: 'beto@x.com' }, { nombre: 'Caro' }, { nombre: 'Dani' }]);
  assert.equal(g.correos.length, 1, 'cargar personas no manda mails');

  const pub = g.pedir({ accion: 'grupo', id: s.id }).datos;
  assert.deepEqual(pub.personas.map((p) => p.nombre), ['Caro', 'Dani']);
  assert.ok(!JSON.stringify(pub).includes('@'));

  assert.match(s.ad('sortear').error, /Caro, Dani/);
  const caro = s.por('Caro').id, dani = s.por('Dani').id;
  assert.match(g.pedir({ accion: 'crearPin', id: s.id, persona: caro, pin: '12' }).error, /4 números/);
  const ses = g.pedir({ accion: 'crearPin', id: s.id, persona: caro, pin: '1234' }).datos;
  assert.match(g.pedir({ accion: 'crearPin', id: s.id, persona: caro, pin: '9999' }).error, /ya tiene PIN/);
  g.pedir({ accion: 'crearPin', id: s.id, persona: dani, pin: '0000' });
  assert.ok(g.pedir({ accion: 'guardarDeseos', id: s.id, token: ses.token, deseos: 'Un libro de ñandúes 🎁' }).ok);
  assert.match(g.pedir({ accion: 'descubrir', id: s.id, token: ses.token }).error, /Todavía/);

  const r = s.ad('sortear');
  assert.ok(r.ok, r.error);
  assert.equal(g.correos.length, 3);
  const m = g.correos.find((c) => c.to === 'ana@x.com');
  assert.equal(m.replyTo, 'org@x.com');
  for (const n of ['Beto', 'Caro', 'Dani']) assert.ok(!(m.body + m.htmlBody + m.subject).includes(n), 'el mail no revela nombres');
  for (const n of ['parejas', 'pin"', 'enlace', 'sesiones']) assert.ok(!JSON.stringify(r).includes(n), 'admin no recibe ' + n);

  const accesos = [link(m), link(g.correos.find((c) => c.to === 'beto@x.com')), { id: s.id, token: ses.token }];
  const yos = accesos.map((a) => g.pedir({ accion: 'yo', ...a }).datos);
  assert.deepEqual(yos.map((y) => y.nombre), ['Ana', 'Beto', 'Caro']);
  const tocan = accesos.map((a) => g.pedir({ accion: 'descubrir', ...a }).datos);
  tocan.forEach((t, i) => { assert.equal(t.length, 1); assert.notEqual(t[0].nombre, yos[i].nombre); });
  tocan.flat().filter((t) => t.nombre === 'Caro').forEach((t) => assert.equal(t.deseos, 'Un libro de ñandúes 🎁'));

  // Fijo después de sortear
  for (const [a, x] of [['agregarPersona', { nombre: 'Eva', tipo: 'adulto' }], ['quitarPersona', { persona: caro }], ['editarPersona', { persona: caro, nombre: 'C', tipo: 'adulto' }],
    ['guardarEvento', { fecha: s.ad('admin').datos.evento.fecha }], ['agregarExclusion', { de: caro, a: dani }], ['sortear', {}]]) {
    assert.match(s.ad(a, x).error, /ya se hizo/, a);
  }

  // Reenvío: el link viejo deja de servir y la persona lo ve
  const viejo = accesos[0];
  const antes = tocan[0][0].nombre;
  assert.ok(s.ad('reenviar', { persona: yos[0].persona, mail: 'ana2@x.com' }).ok);
  assert.equal(g.pedir({ accion: 'yo', ...viejo }).sinAcceso, true);
  const nuevo = link(g.correos.at(-1));
  assert.equal(g.correos.at(-1).to, 'ana2@x.com');
  assert.ok(g.pedir({ accion: 'yo', ...nuevo }).datos.reinicio);
  assert.equal(g.pedir({ accion: 'descubrir', ...nuevo }).datos[0].nombre, antes);

  // Reinicio de PIN
  assert.ok(s.ad('reiniciarPin', { persona: caro }).ok);
  assert.equal(g.pedir({ accion: 'yo', id: s.id, token: ses.token }).sinAcceso, true);
  const otra = g.pedir({ accion: 'crearPin', id: s.id, persona: caro, pin: '4321' }).datos;
  assert.ok(g.pedir({ accion: 'yo', id: s.id, token: otra.token }).datos.reinicio);

  // Volver a sortear anula lo anterior
  assert.ok(s.ad('reabrir').ok);
  assert.match(g.pedir({ accion: 'descubrir', id: s.id, token: otra.token }).error, /Todavía/);
  assert.ok(s.ad('sortear').ok);
  assert.equal(g.pedir({ accion: 'yo', ...nuevo }).sinAcceso, true);
});

test('PIN: bloqueo tras intentos fallidos', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana' }]);
  const persona = s.por('Ana').id;
  g.pedir({ accion: 'crearPin', id: s.id, persona, pin: '1234' });
  assert.ok(g.pedir({ accion: 'entrar', id: s.id, persona, pin: '1234' }).datos.token);
  for (let i = 0; i < 5; i++) assert.match(g.pedir({ accion: 'entrar', id: s.id, persona, pin: '0000' }).error, /no es correcto/);
  assert.match(g.pedir({ accion: 'entrar', id: s.id, persona, pin: '1234' }).error, /Demasiados/);
});

test('cupo, mails que fallan y sorteo imposible', () => {
  const g = cargar('https://app/');
  const s = armar(g, ['Ana', 'Beto', 'Caro'].map((n) => ({ nombre: n, mail: n.toLowerCase() + '@x.com' })));
  g.estado.cupo = 2;
  assert.match(s.ad('sortear').error, /quedan 2 mails/);
  assert.equal(g.correos.length, 1);
  assert.equal(s.ad('admin').datos.estado, 'abierto');
  g.estado.cupo = 50;
  const [a, b, c] = ['Ana', 'Beto', 'Caro'].map((n) => s.por(n).id);
  s.ad('agregarExclusion', { de: a, a: b, ambos: true });
  s.ad('agregarExclusion', { de: a, a: c });
  assert.match(s.ad('sortear').error, /imposible/);
  assert.equal(g.correos.length, 1);
  s.ad('quitarExclusion', { de: a, a: c });
  g.estado.rebota = 'beto@x.com';
  // Ana<->Beto prohibidos con 3 personas también es imposible
  assert.match(s.ad('sortear').error, /imposible/);
  s.ad('quitarExclusion', { de: b, a: a });
  const r = s.ad('sortear');
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.datos.personas.map((p) => p.envio), ['enviado', 'error', 'enviado']);
});

test('seguridad: accesos cruzados, datos inválidos y abuso', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana', mail: 'ana@x.com' }, { nombre: 'Beto' }]);
  const t = armar(g, [{ nombre: 'Zoe' }]);
  for (const accion of ['admin', 'guardarEvento', 'agregarPersona', 'editarPersona', 'quitarPersona', 'agregarExclusion', 'quitarExclusion', 'reiniciarPin', 'reabrir', 'sortear', 'reenviar']) {
    assert.equal(g.pedir({ accion, id: s.id, token: t.token, nombre: 'X', tipo: 'adulto' }).sinAcceso, true, accion);
    assert.equal(g.pedir({ accion, id: s.id }).sinAcceso, true, accion);
  }
  // Un acceso vacío no coincide con quien no tiene link
  for (const token of ['', null, undefined, {}]) assert.equal(g.pedir({ accion: 'yo', id: s.id, token }).sinAcceso, true);
  assert.equal(g.pedir({ accion: 'yo', id: s.id, token: s.token }).sinAcceso, true, 'el link de admin no abre participantes');
  assert.match(g.pedir({ accion: 'crearPin', id: s.id, persona: s.por('Ana').id, pin: '1234' }).error, /link de su mail/);
  for (const accion of ['constructor', '__proto__', 'nada', undefined]) assert.equal(g.pedir({ accion }).ok, false);
  for (const nombre of ['', 'evil.com', 'a<b', 'http://x', 'x'.repeat(41)]) assert.equal(s.ad('agregarPersona', { nombre, tipo: 'adulto' }).ok, false, nombre);
  for (const nombre of ['Ma. José', "O'Neill", 'Íñigo 2']) assert.ok(s.ad('agregarPersona', { nombre, tipo: 'adulto' }).ok, nombre);
  assert.match(s.ad('agregarPersona', { nombre: 'ANA', tipo: 'adulto' }).error, /Ya hay/);
  for (const mail of ['x', 'a@b', 'a@b.com,c@d.com', 'a b@c.com']) assert.match(s.ad('agregarPersona', { nombre: 'Q', tipo: 'adulto', mail }).error, /mail/);
  for (const fecha of ['', '2020-01-01', '2099-01-01', '2026-13-45']) assert.equal(s.ad('guardarEvento', { fecha }).ok, false, fecha);
  for (const presupuesto of [-1, 'abc']) assert.equal(s.ad('guardarEvento', { fecha: s.ad('admin').datos.evento.fecha, presupuesto }).ok, false);
  assert.ok(g.pedir({ accion: 'crear', nombre: 'V', mail: 'org@x.com', acepta: true }).ok);
  assert.match(g.pedir({ accion: 'crear', nombre: 'V', mail: 'org@x.com', acepta: true }).error, /varios/);
  assert.equal(g.pedir('no es json').ok, false);
});

test('borrado a los 30 días', () => {
  const g = cargar('https://app/');
  const s = armar(g, [{ nombre: 'Ana' }]);
  armar(g, [{ nombre: 'Zoe' }]);
  g.filas[1][1] = '2020-01-01';
  g.contexto.borrarVencidos();
  assert.equal(g.filas.length, 2);
  assert.match(g.pedir({ accion: 'grupo', id: s.id }).error, /no existe/);
});

test('modalidad B por la API: los niños no regalan', () => {
  const g = cargar('https://app/');
  const s = armar(g, [...['Ana', 'Beto', 'Caro'].map((n) => ({ nombre: n, mail: n + '@x.com' })), { nombre: 'Nico', tipo: 'nino', mail: 'ana@x.com' }]);
  s.ad('guardarEvento', { fecha: s.ad('admin').datos.evento.fecha, presupuesto: '20000.5', modalidad: 'B' });
  assert.ok(s.ad('sortear').ok);
  const nico = g.correos.filter((c) => c.to === 'ana@x.com').map(link).map((l) => [l, g.pedir({ accion: 'yo', ...l }).datos]).find(([, y]) => y.nombre === 'Nico');
  assert.equal(nico[1].regala, false);
  assert.deepEqual(g.pedir({ accion: 'descubrir', ...nico[0] }).datos, []);
  const caro = link(g.correos.find((c) => c.to === 'caro@x.com'));
  assert.deepEqual(g.pedir({ accion: 'descubrir', ...caro }).datos.map((x) => x.nombre === 'Nico').sort(), [false, true]);
});
