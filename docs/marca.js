'use strict';
// Identidad general de yori: Y de nodos. Si cambia el símbolo, cambiar también los íconos PNG.
const MARCA = {
  nombre: 'yori',
  lema: 'Inteligencia que conecta momentos',
  firma: 'Powered by GIWA',
  simbolo: '<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke-width="13" stroke-linecap="round"><path d="M60 64V102" stroke="currentColor"/><path d="M26 24L60 64" stroke="#0090FF"/><path d="M94 24L60 64" stroke="#A855F7"/></g><circle cx="26" cy="24" r="14" fill="#0090FF"/><circle cx="94" cy="24" r="14" fill="#A855F7"/><circle cx="60" cy="64" r="11" fill="currentColor"/></svg>'
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
  destello: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.600 8.400L23 12l-8.400 2.600L12 23l-2.600-8.400L1 12l8.400-2.600z" fill="currentColor"/></svg>',
  compartir: trazo('<circle cx="5" cy="12" r="2.500"/><circle cx="19" cy="6" r="2.500"/><circle cx="19" cy="18" r="2.500"/><path d="M7.300 11l9.400-4M7.300 13l9.400 4"/>')
};
