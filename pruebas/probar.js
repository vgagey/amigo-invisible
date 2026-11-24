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
  assert.match(g.pedir({ accion: 'descubrir', ...ana, persona: yos[1].persona }).error, /No gestionás/);
  assert.match(g.pedir({ accion: 'guardarDeseos', ...ana, persona: yos[1].persona, deseos: 'x' }).error, /No gestionás/);
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
  assert.match(s.ad('editarPersona', { persona: ana, nombre: 'Ana', tipo: 'nino' }).error, /gestiona/);
  assert.deepEqual(g.pedir({ accion: 'grupo', id: s.id }).datos.personas.map((p) => p.nombre), ['Ana', 'Beto', 'Caro']);
  assert.match(s.pedirPin('Nico', 'n@x.com').error, /gestiona un adulto/);
  const acceso = s.validar('Ana');
  assert.ok(g.pedir({ accion: 'guardarDeseos', ...acceso, persona: nico, deseos: 'Pelota' }).ok);
  assert.ok(s.ad('sortear').ok);
  const yo = g.pedir({ accion: 'yo', ...acceso }).datos;
  assert.deepEqual(yo.aCargo.map((x) => [x.nombre, x.deseos, x.regala]), [['Nico', 'Pelota', true], ['Mia', '', true]]);
  const toca = g.pedir({ accion: 'descubrir', ...acceso, persona: nico }).datos;
  assert.ok(['Mia', 'Leo'].includes(toca[0].nombre));
  assert.deepEqual([s.por('Nico').vio, s.por('Ana').vio], [true, false]);
  assert.match(g.pedir({ accion: 'descubrir', ...acceso, persona: leo }).error, /No gestionás/);
  assert.match(g.pedir({ accion: 'guardarDeseos', ...acceso, persona: leo, deseos: 'x' }).error, /No gestionás/);
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
  for (const accion of ['admin', 'guardarEvento', 'agregarPersona', 'editarPersona', 'quitarPersona', 'agregarExclusion', 'quitarExclusion', 'corregirTelefono', 'liberar', 'reabrir', 'sortear', 'reenviar', 'invitar', 'pedirEmergencia', 'verSorteo']) {
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
