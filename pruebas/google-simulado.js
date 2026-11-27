// Carga el código de Apps Script con los servicios de Google simulados en memoria.
// Solo para pruebas locales: no envía mails ni usa ninguna planilla real.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

module.exports = function cargar(urlApp) {
  const filas = [];
  const correos = [];
  const cache = new Map();
  const propiedades = new Map([['ALMACEN', process.env.YORI_ALMACEN || 'planilla']]);
  const estado = { cupo: 100, rebota: null };

  const hoja = {
    getLastRow: () => filas.length,
    getMaxRows: () => 1000,
    insertRowAfter() {},
    appendRow: (f) => filas.push(f),
    deleteRow: (n) => filas.splice(n - 1, 1),
    getRange(f, c, alto = 1, ancho = 1) {
      if (typeof f === 'string') return { setNumberFormat() {} };
      return {
        getValue: () => filas[f - 1][c - 1],
        getValues: () => filas.slice(f - 1, f - 1 + alto).map((x) => x.slice(c - 1, c - 1 + ancho)),
        setValues: (v) => v.forEach((x, i) => { filas[f - 1 + i] = x; })
      };
    }
  };
  let creada = false;
  const contexto = {
    console: { error: (...x) => correos.errores.push(x.join(' ')), log() {} },
    SpreadsheetApp: {
      flush() {},
      getActiveSpreadsheet: () => ({
        getSheetByName: () => (creada ? hoja : null),
        insertSheet: () => { creada = true; return hoja; }
      })
    },
    MailApp: {
      getRemainingDailyQuota: () => estado.cupo,
      sendEmail(m) {
        if (m.to === estado.rebota) throw new Error('Dirección inválida');
        estado.cupo--;
        correos.push(m);
      }
    },
    // Con YORI_ALMACEN=supabase, las pruebas usan la base que se inyecte en global.YORI_JDBC.
    Jdbc: global.YORI_JDBC || { getConnection() { throw new Error('Sin base de datos'); } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k) ?? null,
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k)
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => propiedades.get(k) ?? null,
        setProperty: (k, v) => propiedades.set(k, v),
        getProperties: () => Object.fromEntries(propiedades)
      })
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (texto) => ({ texto, setMimeType() { return this; } })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_, t) => crypto.createHash('sha256').update(t, 'utf8').digest(),
      base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64url'),
      base64Encode: (t) => Buffer.from(t, 'utf8').toString('base64'),
      base64Decode: (t) => Buffer.from(t, 'base64'),
      newBlob: (b) => ({ getDataAsString: () => b.toString('utf8') }),
      formatDate: (d, _, f) => new Date(d - 3 * 3600e3).toISOString().slice(0, f === 'yyyy-MM-dd' ? 10 : 16)
    }
  };
  correos.errores = [];
  vm.createContext(contexto);
  for (const archivo of ['Sorteo.gs', 'Codigo.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script', archivo), 'utf8'), contexto, { filename: archivo });
  }
  if (urlApp) contexto.URL_APP = urlApp;
  // Vista local con una copia de sorteos (archivo fuera del repo). Nada sale de esta compu.
  if (process.env.YORI_COPIA) {
    filas.push(['id', 'borrar', 'datos'], ...JSON.parse(fs.readFileSync(process.env.YORI_COPIA, 'utf8')).map(([id, b, d]) => [id, b, JSON.stringify(d)]));
    creada = true;
  }

  return {
    contexto, correos, estado, filas,
    pedir: (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } }).texto)
  };
};
