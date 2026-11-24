'use strict';
// Ambientación de la experiencia. Con decoracion: false desaparecen los adornos
// sin afectar la marca ni el funcionamiento.
const NAVIDAD = {
  nombre: 'Sorteo Navideño',
  etiqueta: 'Navidad 2026',
  frase: 'La forma más inteligente y cálida de celebrar el Amigo Invisible.',
  fecha: '12-24',
  decoracion: true,
  // Destellos alrededor del símbolo, sin modificarlo.
  destellos: '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#E9C77B"><path d="M54 4l1.800 5.200L61 11l-5.200 1.800L54 18l-1.800-5.200L47 11l5.200-1.800z"/><path d="M6 44l1.400 4.100L11.500 49.500l-4.100 1.400L6 55l-1.400-4.100L.5 49.500l4.100-1.400z"/><path d="M58 47l1 2.900 2.900 1-2.900 1-1 2.900-1-2.900-2.900-1 2.900-1z"/></g></svg>',
  // Lazo geométrico continuo.
  lazo: '<svg viewBox="0 0 360 240" aria-hidden="true"><defs><linearGradient id="lz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F766E"/><stop offset="1" stop-color="#E9C77B"/></linearGradient></defs><g fill="none" stroke="url(#lz)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path class="cinta" pathLength="100" d="M180 108L96 52C64 32 36 52 36 84S64 136 96 124L180 108L264 124C296 136 324 116 324 84S296 32 264 52L180 108"/><path class="cinta" pathLength="100" d="M180 108L118 208M180 108L242 208"/></g><circle cx="180" cy="108" r="9" fill="#E9C77B"/></svg>'
};
