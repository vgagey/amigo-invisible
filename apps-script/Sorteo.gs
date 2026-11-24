/**
 * Lógica del sorteo. No usa servicios de Google, así se puede probar aparte.
 *
 * personas:    [{ id, tipo: 'adulto' | 'nino' }]
 * exclusiones: [{ de, a }]  ("de" no puede regalarle a "a")
 * modalidad:   'A' (cada uno con su grupo) | 'B' (adulto + niño)
 *
 * Devuelve { idDeQuienRegala: [ids de quienes reciben] } o lanza un Error
 * con un mensaje para mostrar en pantalla.
 */
function sortearPersonas(personas, exclusiones, modalidad) {
  var adultos = idsDe_(personas, 'adulto');
  var ninos = idsDe_(personas, 'nino');
  var puede = armarPermitidos_(exclusiones);
  var resultado = {};

  if (modalidad === 'A') {
    if (!adultos.length && !ninos.length) throw new Error('Todavía no hay personas cargadas.');
    if (adultos.length && adultos.length < 3) throw new Error('En esta modalidad hacen falta al menos 3 adultos.');
    if (ninos.length && ninos.length < 3) throw new Error('En esta modalidad hacen falta al menos 3 niños. Con 1 o 2, usá "Adulto y niño".');
    agregar_(resultado, unoAUno_(adultos, puede));
    agregar_(resultado, unoAUno_(ninos, puede));
    return resultado;
  }

  if (adultos.length < 3) throw new Error('En esta modalidad hacen falta al menos 3 adultos.');
  if (!ninos.length) throw new Error('En esta modalidad hace falta al menos 1 niño.');
  agregar_(resultado, unoAUno_(adultos, puede));
  agregar_(resultado, adultosANinos_(adultos, ninos, puede));
  return resultado;
}

var ERROR_IMPOSIBLE_ = 'Con estas exclusiones el sorteo es imposible. Quitá alguna y probá de nuevo.';

function idsDe_(personas, tipo) {
  return personas.filter(function (p) { return p.tipo === tipo; }).map(function (p) { return p.id; });
}

function armarPermitidos_(exclusiones) {
  var prohibido = {};
  exclusiones.forEach(function (e) { prohibido[e.de + '>' + e.a] = true; });
  return function (de, a) { return de !== a && !prohibido[de + '>' + a]; };
}

function agregar_(destino, pares) {
  pares.forEach(function (par) {
    if (!destino[par[0]]) destino[par[0]] = [];
    destino[par[0]].push(par[1]);
  });
}

function mezclar_(lista) {
  var copia = lista.slice();
  for (var i = copia.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var x = copia[i]; copia[i] = copia[j]; copia[j] = x;
  }
  return copia;
}

/** Cada id regala a otro del mismo grupo y recibe de uno solo. */
function unoAUno_(ids, puede) {
  if (!ids.length) return [];
  // Mezclar hasta acertar da todas las combinaciones con la misma probabilidad.
  for (var intento = 0; intento < 500; intento++) {
    var mezcla = mezclar_(ids);
    if (ids.every(function (id, i) { return puede(id, mezcla[i]); })) {
      return ids.map(function (id, i) { return [id, mezcla[i]]; });
    }
  }
  // Con muchas exclusiones, se busca una combinación válida de forma exacta.
  var pares = emparejar_(mezclar_(ids), mezclar_(ids), puede, {}, {});
  if (pares.length < ids.length) throw new Error(ERROR_IMPOSIBLE_);
  return pares;
}

/**
 * Reparte adultos y niños lo más parejo posible: todo adulto regala al menos
 * a un niño y todo niño recibe al menos un regalo.
 */
function adultosANinos_(adultos, ninos, puede) {
  if (adultos.length >= ninos.length) {
    return repartir_(adultos, ninos, puede);
  }
  return repartir_(ninos, adultos, function (nino, adulto) { return puede(adulto, nino); })
    .map(function (par) { return [par[1], par[0]]; });
}

/** Cada uno de "muchos" va con exactamente uno de "pocos", con cargas parejas. */
function repartir_(muchos, pocos, puede) {
  var piso = Math.floor(muchos.length / pocos.length);
  var techo = Math.ceil(muchos.length / pocos.length);

  for (var margen = 0; techo + margen <= muchos.length; margen++) {
    var minimo = Math.max(1, piso - margen);
    var obligatorios = [];
    var opcionales = [];
    mezclar_(pocos).forEach(function (id) {
      for (var k = 0; k < techo + margen; k++) {
        (k < minimo ? obligatorios : opcionales).push({ id: id });
      }
    });
    var pares = llenarLugares_(mezclar_(muchos), obligatorios, mezclar_(opcionales), puede);
    if (pares) return pares;
  }
  throw new Error(ERROR_IMPOSIBLE_);
}

/** Primero cubre los lugares obligatorios y después ubica al resto. */
function llenarLugares_(muchos, obligatorios, opcionales, puede) {
  var lugares = obligatorios.concat(opcionales);
  var deLugar = {}; // índice de lugar -> id
  var dePersona = {}; // id -> índice de lugar
  var indices = lugares.map(function (_, i) { return i; });
  var sirve = function (id, i) { return puede(id, lugares[i].id); };

  var cubiertos = emparejar_(indices.slice(0, obligatorios.length), muchos,
    function (i, id) { return sirve(id, i); }, deLugar, dePersona);
  if (cubiertos.length < obligatorios.length) return null;

  var ubicados = emparejar_(muchos, indices, sirve, dePersona, deLugar);
  if (ubicados.length < muchos.length) return null;
  return ubicados.map(function (par) { return [par[0], lugares[par[1]].id]; });
}

/**
 * Emparejamiento máximo entre dos listas (algoritmo de Kuhn). Parte de las
 * parejas que ya estén en deIzq / deDer y nunca deja libre a quien tenía pareja.
 */
function emparejar_(izq, der, sirve, deIzq, deDer) {
  function ubicar(i, vistos) {
    for (var k = 0; k < der.length; k++) {
      var d = der[k];
      if (vistos[d] || !sirve(i, d)) continue;
      vistos[d] = true;
      if (deDer[d] === undefined || ubicar(deDer[d], vistos)) {
        deIzq[i] = d;
        deDer[d] = i;
        return true;
      }
    }
    return false;
  }
  izq.forEach(function (i) { if (deIzq[i] === undefined) ubicar(i, {}); });
  return izq.filter(function (i) { return deIzq[i] !== undefined; })
    .map(function (i) { return [i, deIzq[i]]; });
}
