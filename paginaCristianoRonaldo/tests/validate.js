#!/usr/bin/env node
/**
 * tests/validate.js
 * Pruebas básicas de integridad del sitio estático, pensadas para
 * ejecutarse en local y en GitHub Actions antes de publicar en
 * GitHub Pages. No requiere dependencias externas: usa solo módulos
 * nativos de Node.js.
 *
 * Verifica:
 *   1. Que existan los archivos principales del sitio.
 *   2. Que cada archivo .js tenga sintaxis válida (`node --check`).
 *   3. Que las etiquetas HTML clave estén balanceadas y no haya IDs
 *      duplicados en cada .html.
 *   4. Que los recursos locales referenciados (href/src) existan en
 *      el repositorio (los enlaces externos se ignoran).
 *   5. Que las llaves de cada .css estén balanceadas.
 *
 * Uso: node tests/validate.js
 * Termina con código de salida distinto de 0 si algo falla, para que
 * el job de GitHub Actions se marque como fallido.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
let errores = 0;

function fallo(mensaje) {
  console.error('✗ ' + mensaje);
  errores += 1;
}

function ok(mensaje) {
  console.log('✓ ' + mensaje);
}

const ARCHIVOS_REQUERIDOS = [
  'index.html',
  'styles.css',
  'script.js',
  'observabilidad.html',
  'observabilidad.css',
  'observabilidad.js'
];

/* ---------------------------------------------------------
   1. Archivos requeridos
   --------------------------------------------------------- */
ARCHIVOS_REQUERIDOS.forEach(function (nombre) {
  var ruta = path.join(RAIZ, nombre);
  if (fs.existsSync(ruta)) {
    ok('Existe ' + nombre);
  } else {
    fallo('Falta el archivo ' + nombre);
  }
});

/* ---------------------------------------------------------
   2. Sintaxis JavaScript válida
   --------------------------------------------------------- */
var archivosJS = ARCHIVOS_REQUERIDOS.filter(function (nombre) {
  return nombre.endsWith('.js');
});

archivosJS.forEach(function (nombre) {
  var ruta = path.join(RAIZ, nombre);
  if (!fs.existsSync(ruta)) {
    return;
  }
  try {
    execFileSync(process.execPath, ['--check', ruta], { stdio: 'pipe' });
    ok('Sintaxis JavaScript válida: ' + nombre);
  } catch (error) {
    fallo('Sintaxis JavaScript inválida en ' + nombre + ': ' + error.message);
  }
});

/* ---------------------------------------------------------
   3 y 4. HTML: balance de etiquetas, IDs duplicados y
   recursos locales referenciados
   --------------------------------------------------------- */
var ETIQUETAS_A_VERIFICAR = [
  'div', 'section', 'ul', 'li', 'header', 'nav', 'main', 'footer',
  'figure', 'article', 'aside', 'dl', 'table', 'thead', 'tbody', 'tr', 'th'
];

var archivosHTML = ARCHIVOS_REQUERIDOS.filter(function (nombre) {
  return nombre.endsWith('.html');
});

archivosHTML.forEach(function (nombre) {
  var ruta = path.join(RAIZ, nombre);
  if (!fs.existsSync(ruta)) {
    return;
  }
  var html = fs.readFileSync(ruta, 'utf8');

  ETIQUETAS_A_VERIFICAR.forEach(function (etiqueta) {
    var apertura = (html.match(new RegExp('<' + etiqueta + '(\\s|>)', 'g')) || []).length;
    var cierre = (html.match(new RegExp('</' + etiqueta + '>', 'g')) || []).length;
    if (apertura !== cierre) {
      fallo(nombre + ': etiqueta <' + etiqueta + '> desbalanceada (' + apertura + ' apertura(s) vs ' + cierre + ' cierre(s))');
    }
  });

  var ids = (html.match(/id="([^"]+)"/g) || []).map(function (coincidencia) {
    return coincidencia.slice(4, -1);
  });
  var vistos = Object.create(null);
  var duplicados = [];
  ids.forEach(function (id) {
    if (vistos[id]) {
      duplicados.push(id);
    }
    vistos[id] = true;
  });
  if (duplicados.length) {
    fallo(nombre + ': IDs duplicados -> ' + duplicados.join(', '));
  } else {
    ok(nombre + ': sin IDs duplicados (' + ids.length + ' encontrados)');
  }

  var referencias = (html.match(/(?:href|src)="([^"]+)"/g) || []).map(function (coincidencia) {
    return coincidencia.replace(/^(?:href|src)="/, '').replace(/"$/, '');
  });
  referencias.forEach(function (referencia) {
    var esExterna = /^([a-z][a-z0-9+.-]*:)?\/\//i.test(referencia) ||
      referencia.indexOf('#') === 0 ||
      referencia.indexOf('mailto:') === 0;
    if (esExterna) {
      return;
    }
    var rutaRecurso = path.join(RAIZ, referencia.split('#')[0]);
    if (!fs.existsSync(rutaRecurso)) {
      fallo(nombre + ': el recurso local "' + referencia + '" no existe en el repositorio');
    }
  });
});

if (archivosHTML.length) {
  ok('Recursos locales (href/src) verificados en todos los .html');
}

/* ---------------------------------------------------------
   5. CSS: balance de llaves
   --------------------------------------------------------- */
var archivosCSS = ARCHIVOS_REQUERIDOS.filter(function (nombre) {
  return nombre.endsWith('.css');
});

archivosCSS.forEach(function (nombre) {
  var ruta = path.join(RAIZ, nombre);
  if (!fs.existsSync(ruta)) {
    return;
  }
  var css = fs.readFileSync(ruta, 'utf8');
  var apertura = (css.match(/{/g) || []).length;
  var cierre = (css.match(/}/g) || []).length;
  if (apertura !== cierre) {
    fallo(nombre + ': llaves CSS desbalanceadas (' + apertura + ' vs ' + cierre + ')');
  } else {
    ok(nombre + ': llaves CSS balanceadas (' + apertura + ')');
  }
});

/* ---------------------------------------------------------
   Resultado final
   --------------------------------------------------------- */
console.log('');
if (errores > 0) {
  console.error(errores + ' problema(s) encontrado(s).');
  process.exit(1);
}

console.log('Todas las pruebas básicas pasaron correctamente.');
process.exit(0);
