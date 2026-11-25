'use strict';
// Identidad general de yori: Destello Translúcido (img/flor.svg). Si cambia el símbolo, cambiar también los íconos PNG.
const MARCA = {
  nombre: 'yori',
  lema: 'Inteligencia que conecta momentos',
  firma: 'Powered by GIWA',
  simbolo: '<img src="img/flor.svg" alt="">'
};

const trazo = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS = {
  inicio: trazo('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  resumen: trazo('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  personas: trazo('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-4 2.5-6 5.500-6s5.500 2 5.500 6M15 15c3-.5 6 1 6.500 5"/>'),
  exclusiones: trazo('<circle cx="12" cy="12" r="8.500"/><path d="M6 6l12 12"/>'),
  evento: trazo('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  volver: trazo('<path d="M15 5l-7 7 7 7"/>'),
  seguir: trazo('<path d="M9 5l7 7-7 7"/>'),
  invitar: trazo('<circle cx="9" cy="8" r="3.500"/><path d="M2.5 20c0-4 3-6 6.500-6s6.500 2 6.500 6M18 8v6M15 11h6"/>'),
  familias: trazo('<rect x="3" y="4" width="7" height="5" rx="1.5"/><rect x="14" y="4" width="7" height="5" rx="1.5"/><rect x="8.5" y="15" width="7" height="5" rx="1.5"/><path d="M6.500 9v3h11V9M12 12v3"/>'),
  especiales: trazo('<path d="M4 11h16v9H4zM3 7.500h18V11H3zM12 7.500V20M12 7.500C9 7.500 7 6 7.500 4.500S11 4 12 7.500C13 4 16 3 16.500 4.500S15 7.500 12 7.500"/>'),
  persona: trazo('<circle cx="12" cy="8" r="3.500"/><path d="M5 20c0-4 3-6.500 7-6.500s7 2.500 7 6.500"/>'),
  flecha: trazo('<path d="M4 12h16M14 6l6 6-6 6"/>'),
  mas: trazo('<path d="M12 5v14M5 12h14"/>'),
  cerrar: trazo('<path d="M6 6l12 12M18 6L6 18"/>'),
  salir: trazo('<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>'),
  torta: trazo('<path d="M4 20h16v-8H4zM4 15c2 1.500 4 1.500 5.300 0s3.400-1.500 5.400 0 3.300 1.500 5.300 0M12 12V8M12 5v.5"/>'),
  copa: trazo('<path d="M7 3h10l-1 7a4 4 0 0 1-8 0zM12 14v6M8 20h8"/>'),
  valija: trazo('<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16"/>'),
  corazon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15 4 9.500A4 4 0 0 1 12 8a4 4 0 0 1 8 1.500C20 15 12 20 12 20Z" fill="currentColor"/></svg>',
  destello: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.600 8.400L23 12l-8.400 2.600L12 23l-2.600-8.400L1 12l8.400-2.600z" fill="currentColor"/></svg>',
  compartir: trazo('<circle cx="5" cy="12" r="2.500"/><circle cx="19" cy="6" r="2.500"/><circle cx="19" cy="18" r="2.500"/><path d="M7.300 11l9.400-4M7.300 13l9.400 4"/>')
};
