/**
 * script.js
 * Comportamiento interactivo del sitio sobre Cristiano Ronaldo.
 * JavaScript vanilla, sin dependencias ni APIs externas.
 *
 * Este archivo incluye además, al inicio, el motor de observabilidad
 * local "CR7Observability" (ver más abajo). Se coloca aquí porque
 * index.html ya carga script.js, así que la página principal queda
 * instrumentada sin necesidad de añadir otro <script>. El panel
 * observabilidad.html reutiliza este mismo motor cargando también
 * script.js antes de observabilidad.js.
 */

/**
 * ============================================================
 * Motor de observabilidad local — window.CR7Observability
 * ============================================================
 * Registra métricas y eventos ÚNICAMENTE en el localStorage de este
 * navegador. No se envía ningún dato a servidores ni servicios
 * externos: todo el procesamiento ocurre en el propio cliente.
 *
 * Categorías registradas, cada una bajo una clave de localStorage
 * con el prefijo "cr7-observability":
 *   cr7-observability:meta             (metadatos y contadores)
 *   cr7-observability:session-id       (identificador de sesión)
 *   cr7-observability:environment      (viewport, conexión, soporte de APIs)
 *   cr7-observability:navigation       (tiempos de navegación/carga)
 *   cr7-observability:errors           (errores JS y promesas rechazadas)
 *   cr7-observability:resource-errors  (recursos que no cargaron)
 *   cr7-observability:interactions     (clics en enlaces/botones/controles)
 *   cr7-observability:visibility       (cambios de visibilidad de pestaña)
 *
 * API pública:
 *   window.CR7Observability.getSnapshot()   -> objeto con todas las categorías
 *   window.CR7Observability.clear()         -> borra todo lo registrado
 *   window.CR7Observability.recordDemoEvent() -> genera datos de prueba
 *
 * Si el navegador no soporta alguna API (localStorage, Performance
 * API, Network Information API, etc.) esa parte simplemente se omite
 * sin romper el resto del sitio.
 */
(function () {
  'use strict';

  var PREFIJO = 'cr7-observability';
  var LIMITES_POR_CATEGORIA = {
    navigation: 50,
    errors: 100,
    'resource-errors': 100,
    interactions: 200,
    visibility: 100
  };

  var soportaLocalStorage = probarLocalStorage();

  function probarLocalStorage() {
    try {
      var claveDePrueba = '__cr7_observability_test__';
      window.localStorage.setItem(claveDePrueba, '1');
      window.localStorage.removeItem(claveDePrueba);
      return true;
    } catch (error) {
      return false;
    }
  }

  function clavePara(categoria) {
    return PREFIJO + ':' + categoria;
  }

  function leerJSON(clave, valorPorDefecto) {
    if (!soportaLocalStorage) {
      return valorPorDefecto;
    }
    try {
      var crudo = window.localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : valorPorDefecto;
    } catch (error) {
      return valorPorDefecto;
    }
  }

  function escribirJSON(clave, valor) {
    if (!soportaLocalStorage) {
      return false;
    }
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (error) {
      // Cuota de almacenamiento excedida u otro problema: se ignora
      // de forma segura para no interrumpir la navegación del sitio.
      return false;
    }
  }

  function marcaDeTiempo() {
    return new Date().toISOString();
  }

  function paginaActual() {
    var nombre = window.location.pathname.split('/').pop();
    return nombre || 'index.html';
  }

  function redondear(numero) {
    return typeof numero === 'number' ? Math.round(numero * 100) / 100 : numero;
  }

  function obtenerSessionId() {
    var clave = clavePara('session-id');
    var idExistente = leerJSON(clave, null);
    if (idExistente) {
      return idExistente;
    }
    var nuevoId = 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    escribirJSON(clave, nuevoId);
    return nuevoId;
  }

  function actualizarMeta(categoriaIncrementada) {
    var clave = clavePara('meta');
    var meta = leerJSON(clave, null);
    var ahora = marcaDeTiempo();
    if (!meta) {
      meta = {
        sessionId: obtenerSessionId(),
        primeraVez: ahora,
        ultimaActualizacion: ahora,
        totalEventos: {}
      };
    }
    meta.ultimaActualizacion = ahora;
    if (categoriaIncrementada) {
      meta.totalEventos[categoriaIncrementada] = (meta.totalEventos[categoriaIncrementada] || 0) + 1;
    }
    escribirJSON(clave, meta);
    return meta;
  }

  // Añade un registro a una categoría (array) respetando un límite
  // máximo de entradas para evitar un crecimiento ilimitado del
  // localStorage; descarta los registros más antiguos primero.
  function agregarEvento(categoria, registro) {
    var clave = clavePara(categoria);
    var lista = leerJSON(clave, []);
    lista.push(registro);
    var limite = LIMITES_POR_CATEGORIA[categoria] || 100;
    if (lista.length > limite) {
      lista = lista.slice(lista.length - limite);
    }
    escribirJSON(clave, lista);
    actualizarMeta(categoria);
    return lista;
  }

  /* ---------------------------------------------------------
     1. Performance API: tiempos de navegación y carga
     --------------------------------------------------------- */
  function registrarNavegacion() {
    if (!('performance' in window) || typeof performance.getEntriesByType !== 'function') {
      agregarEvento('navigation', {
        timestamp: marcaDeTiempo(),
        pagina: paginaActual(),
        soportado: false
      });
      return;
    }

    var registro = {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      soportado: true
    };

    var entradasNav = performance.getEntriesByType('navigation');
    if (entradasNav && entradasNav.length) {
      var nav = entradasNav[0];
      registro.tipo = nav.type;
      registro.tiempoHastaDomInteractive = redondear(nav.domInteractive);
      registro.tiempoHastaDomContentLoaded = redondear(nav.domContentLoadedEventEnd);
      registro.tiempoHastaCargaCompleta = redondear(nav.loadEventEnd);
      registro.tiempoRespuestaServidor = redondear(nav.responseEnd - nav.requestStart);
      registro.tamanioTransferido = typeof nav.transferSize === 'number' ? nav.transferSize : null;
    } else if (performance.timing) {
      // Alternativa obsoleta (Navigation Timing L1) para navegadores muy antiguos
      var t = performance.timing;
      registro.tiempoHastaDomContentLoaded = t.domContentLoadedEventEnd - t.navigationStart;
      registro.tiempoHastaCargaCompleta = t.loadEventEnd - t.navigationStart;
    }

    if (typeof performance.getEntriesByType === 'function') {
      var entradasPintura = performance.getEntriesByType('paint') || [];
      entradasPintura.forEach(function (entrada) {
        if (entrada.name === 'first-paint') {
          registro.primerPintado = redondear(entrada.startTime);
        }
        if (entrada.name === 'first-contentful-paint') {
          registro.primerPintadoConContenido = redondear(entrada.startTime);
        }
      });
    }

    agregarEvento('navigation', registro);
  }

  if (document.readyState === 'complete') {
    // El script se cargó cuando la página ya había terminado de cargar
    // (por ejemplo, en una navegación posterior con caché); se registra
    // en el siguiente ciclo para permitir que las métricas se asienten.
    window.setTimeout(registrarNavegacion, 0);
  } else {
    window.addEventListener('load', function () {
      window.setTimeout(registrarNavegacion, 0);
    });
  }

  /* ---------------------------------------------------------
     2. Errores de JavaScript y promesas rechazadas
     --------------------------------------------------------- */
  function registrarErrorDeRecurso(elemento) {
    agregarEvento('resource-errors', {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      etiqueta: elemento.tagName ? elemento.tagName.toLowerCase() : 'desconocido',
      origen: elemento.currentSrc || elemento.src || elemento.href || null
    });
  }

  // Un único listener en fase de captura detecta tanto errores de
  // JavaScript (despachados sobre window, como ErrorEvent) como
  // errores de carga de recursos (despachados sobre el elemento que
  // falló, ej. <img>, <script>, <link>, que no burbujean).
  window.addEventListener('error', function (evento) {
    var esErrorDeJavaScript = (typeof ErrorEvent !== 'undefined' && evento instanceof ErrorEvent) ||
      evento.target === window;

    if (esErrorDeJavaScript) {
      agregarEvento('errors', {
        timestamp: marcaDeTiempo(),
        pagina: paginaActual(),
        tipo: 'error',
        mensaje: evento.message || 'Error de JavaScript sin mensaje disponible',
        archivo: evento.filename || null,
        linea: typeof evento.lineno === 'number' ? evento.lineno : null,
        columna: typeof evento.colno === 'number' ? evento.colno : null
      });
    } else if (evento.target && evento.target.tagName) {
      registrarErrorDeRecurso(evento.target);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (evento) {
    var razon = evento.reason;
    var mensaje = 'Promesa rechazada sin motivo especificado';
    if (razon instanceof Error) {
      mensaje = razon.message;
    } else if (typeof razon === 'string') {
      mensaje = razon;
    } else if (razon !== undefined && razon !== null) {
      try {
        mensaje = JSON.stringify(razon);
      } catch (error) {
        mensaje = String(razon);
      }
    }
    agregarEvento('errors', {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      tipo: 'promesa-rechazada',
      mensaje: mensaje,
      archivo: null,
      linea: null,
      columna: null
    });
  });

  /* ---------------------------------------------------------
     3. Clics en enlaces, botones y controles
     --------------------------------------------------------- */
  function obtenerTextoDescriptivo(elemento) {
    var texto = elemento.getAttribute('aria-label') ||
      elemento.getAttribute('alt') ||
      (elemento.textContent || '').trim();
    texto = texto.replace(/\s+/g, ' ').trim();
    return texto.length > 80 ? texto.slice(0, 77) + '…' : texto;
  }

  document.addEventListener('click', function (evento) {
    var objetivo = evento.target;
    var interactivo = objetivo && typeof objetivo.closest === 'function'
      ? objetivo.closest('a, button, input, select, textarea, [role="button"], [tabindex]')
      : null;

    if (!interactivo) {
      return;
    }

    agregarEvento('interactions', {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      etiqueta: interactivo.tagName.toLowerCase(),
      texto: obtenerTextoDescriptivo(interactivo),
      id: interactivo.id || null
    });
  }, true);

  /* ---------------------------------------------------------
     4. Cambios de visibilidad de la pestaña
     --------------------------------------------------------- */
  if (typeof document.visibilityState !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      agregarEvento('visibility', {
        timestamp: marcaDeTiempo(),
        pagina: paginaActual(),
        estado: document.visibilityState
      });
    });
  }

  /* ---------------------------------------------------------
     5. Entorno: viewport, conexión y soporte de APIs
     --------------------------------------------------------- */
  function obtenerInfoDeConexion() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  function capturarEntorno() {
    var conexion = obtenerInfoDeConexion();
    var entorno = {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      viewport: {
        ancho: window.innerWidth,
        alto: window.innerHeight,
        densidadPixeles: window.devicePixelRatio || 1
      },
      conexion: conexion ? {
        tipoEfectivo: conexion.effectiveType || null,
        downlinkMbps: typeof conexion.downlink === 'number' ? conexion.downlink : null,
        rttMs: typeof conexion.rtt === 'number' ? conexion.rtt : null,
        ahorroDatos: !!conexion.saveData
      } : null,
      soporteAPIs: {
        localStorage: soportaLocalStorage,
        performance: 'performance' in window,
        performanceObserver: typeof window.PerformanceObserver === 'function',
        intersectionObserver: typeof window.IntersectionObserver === 'function',
        matchMedia: typeof window.matchMedia === 'function',
        connectionInfo: !!conexion,
        serviceWorker: 'serviceWorker' in navigator,
        geolocalizacion: 'geolocation' in navigator
      },
      navegador: {
        idioma: navigator.language || null,
        idiomas: navigator.languages ? navigator.languages.slice(0, 5) : null,
        plataforma: navigator.platform || null,
        cookiesHabilitadas: !!navigator.cookieEnabled
      }
    };
    escribirJSON(clavePara('environment'), entorno);
    actualizarMeta(null);
  }

  capturarEntorno();

  var temporizadorRedimension = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(temporizadorRedimension);
    temporizadorRedimension = window.setTimeout(capturarEntorno, 400);
  });

  var conexionActual = obtenerInfoDeConexion();
  if (conexionActual && typeof conexionActual.addEventListener === 'function') {
    conexionActual.addEventListener('change', capturarEntorno);
  }

  /* ---------------------------------------------------------
     API pública: window.CR7Observability
     --------------------------------------------------------- */
  function obtenerSnapshot() {
    return {
      meta: leerJSON(clavePara('meta'), null),
      environment: leerJSON(clavePara('environment'), null),
      navigation: leerJSON(clavePara('navigation'), []),
      errors: leerJSON(clavePara('errors'), []),
      resourceErrors: leerJSON(clavePara('resource-errors'), []),
      interactions: leerJSON(clavePara('interactions'), []),
      visibility: leerJSON(clavePara('visibility'), [])
    };
  }

  function limpiarTodo() {
    if (!soportaLocalStorage) {
      return false;
    }
    var clavesAEliminar = [];
    for (var i = 0; i < window.localStorage.length; i++) {
      var clave = window.localStorage.key(i);
      if (clave && clave.indexOf(PREFIJO) === 0) {
        clavesAEliminar.push(clave);
      }
    }
    clavesAEliminar.forEach(function (clave) {
      window.localStorage.removeItem(clave);
    });
    obtenerSessionId();
    actualizarMeta(null);
    return true;
  }

  // Genera datos de prueba de forma realista: registra una interacción
  // de demostración y, además, provoca un error real y no controlado
  // (de forma asíncrona) para que sea el propio listener de errores
  // quien lo capture, igual que ocurriría con un fallo real del sitio.
  function generarEventoDeDemostracion() {
    agregarEvento('interactions', {
      timestamp: marcaDeTiempo(),
      pagina: paginaActual(),
      etiqueta: 'demo',
      texto: 'Evento de demostración generado manualmente desde el panel de observabilidad',
      id: null
    });

    window.setTimeout(function () {
      throw new Error('Error de demostración generado desde el panel de observabilidad (esto es intencional)');
    }, 0);

    return true;
  }

  window.CR7Observability = {
    prefijoAlmacenamiento: PREFIJO,
    getSnapshot: obtenerSnapshot,
    clear: limpiarTodo,
    recordDemoEvent: generarEventoDeDemostracion
  };
})();

/* =========================================================
   Comportamiento de la interfaz del sitio (menú, timeline,
   estadísticas, galería, etc.)
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
  inicializarMenuMovil();
  inicializarLineaDeTiempo();
  inicializarContadoresEstadisticas();
  inicializarGaleriaLightbox();
  inicializarAnioFooter();
});

/* =========================================================
   1. Menú de navegación en móvil
   ========================================================= */
function inicializarMenuMovil() {
  var boton = document.getElementById('nav-toggle');
  var nav = document.getElementById('nav-principal');

  if (!boton || !nav) {
    return;
  }

  boton.addEventListener('click', function () {
    var estaAbierto = nav.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', estaAbierto ? 'true' : 'false');
  });

  // Cierra el menú al elegir un enlace (útil en pantallas pequeñas)
  var enlaces = nav.querySelectorAll('a');
  enlaces.forEach(function (enlace) {
    enlace.addEventListener('click', function () {
      nav.classList.remove('abierto');
      boton.setAttribute('aria-expanded', 'false');
    });
  });
}

/* =========================================================
   2. Línea de tiempo interactiva (trayectoria)
   ========================================================= */
function inicializarLineaDeTiempo() {
  var botones = document.querySelectorAll('.timeline-item');
  var placeholder = document.getElementById('timeline-placeholder');

  if (!botones.length) {
    return;
  }

  botones.forEach(function (boton) {
    boton.addEventListener('click', function () {
      var idObjetivo = boton.getAttribute('data-target');
      var panelObjetivo = document.getElementById(idObjetivo);

      // Oculta todos los paneles y desmarca todos los botones
      document.querySelectorAll('.timeline-detalle-contenido').forEach(function (panel) {
        panel.hidden = true;
      });
      botones.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });

      // Muestra el panel elegido
      if (panelObjetivo) {
        panelObjetivo.hidden = false;
        boton.setAttribute('aria-expanded', 'true');
        if (placeholder) {
          placeholder.hidden = true;
        }
      }
    });
  });
}

/* =========================================================
   3. Contadores animados para la sección de estadísticas
   ========================================================= */
function inicializarContadoresEstadisticas() {
  var tarjetas = document.querySelectorAll('.stat-numero');

  if (!tarjetas.length) {
    return;
  }

  // Si el usuario prefiere movimiento reducido, mostramos el valor final sin animar
  if (prefiereMovimientoReducido()) {
    tarjetas.forEach(function (elemento) {
      mostrarValorFinal(elemento);
    });
    return;
  }

  // Si el navegador no soporta IntersectionObserver, mostramos el valor final directamente
  if (typeof IntersectionObserver === 'undefined') {
    tarjetas.forEach(function (elemento) {
      mostrarValorFinal(elemento);
    });
    return;
  }

  var observador = new IntersectionObserver(function (entradas, obs) {
    entradas.forEach(function (entrada) {
      if (entrada.isIntersecting) {
        animarContador(entrada.target);
        obs.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.4 });

  tarjetas.forEach(function (elemento) {
    observador.observe(elemento);
  });
}

function prefiereMovimientoReducido() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mostrarValorFinal(elemento) {
  var valorFinal = parseInt(elemento.getAttribute('data-valor'), 10) || 0;
  var sufijo = elemento.getAttribute('data-sufijo') || '';
  elemento.textContent = valorFinal + sufijo;
}

function animarContador(elemento) {
  var valorFinal = parseInt(elemento.getAttribute('data-valor'), 10) || 0;
  var sufijo = elemento.getAttribute('data-sufijo') || '';
  var duracionMs = 900;
  var inicio = null;

  function paso(marcaTiempo) {
    if (inicio === null) {
      inicio = marcaTiempo;
    }
    var progreso = Math.min((marcaTiempo - inicio) / duracionMs, 1);
    var valorActual = Math.floor(progreso * valorFinal);
    elemento.textContent = valorActual + sufijo;

    if (progreso < 1) {
      window.requestAnimationFrame(paso);
    } else {
      elemento.textContent = valorFinal + sufijo;
    }
  }

  window.requestAnimationFrame(paso);
}

/* =========================================================
   4. Galería con visor (lightbox) accesible
   ========================================================= */
function inicializarGaleriaLightbox() {
  var botonesGaleria = document.querySelectorAll('.galeria-boton');
  var lightbox = document.getElementById('lightbox');
  var lightboxImagen = document.getElementById('lightbox-imagen');
  var lightboxFondo = document.getElementById('lightbox-fondo');
  var lightboxCerrar = document.getElementById('lightbox-cerrar');
  var lightboxContenido = lightbox ? lightbox.querySelector('.lightbox-contenido') : null;
  var elementoConFocoPrevio = null;

  if (!botonesGaleria.length || !lightbox || !lightboxImagen || !lightboxContenido) {
    return;
  }

  // Devuelve los elementos que pueden recibir foco dentro del lightbox,
  // para poder atrapar el foco del teclado mientras el diálogo está abierto.
  function obtenerElementosFocables() {
    var selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(lightboxContenido.querySelectorAll(selector));
  }

  // Mantiene el foco dentro de #lightbox-contenido al presionar Tab o Shift+Tab,
  // para que un usuario de teclado no pueda moverse a la página de detrás.
  function tramparFoco(evento) {
    var focables = obtenerElementosFocables();
    if (!focables.length) {
      return;
    }

    var primero = focables[0];
    var ultimo = focables[focables.length - 1];

    if (evento.shiftKey) {
      if (document.activeElement === primero || !lightboxContenido.contains(document.activeElement)) {
        evento.preventDefault();
        ultimo.focus();
      }
    } else {
      if (document.activeElement === ultimo || !lightboxContenido.contains(document.activeElement)) {
        evento.preventDefault();
        primero.focus();
      }
    }
  }

  function abrirLightbox(boton) {
    var urlCompleta = boton.getAttribute('data-full');
    var imagenOriginal = boton.querySelector('img');
    var textoAlt = imagenOriginal ? imagenOriginal.getAttribute('alt') : '';

    lightboxImagen.src = urlCompleta;
    lightboxImagen.alt = textoAlt;
    lightbox.hidden = false;
    elementoConFocoPrevio = boton;
    lightboxCerrar.focus();
    document.body.style.overflow = 'hidden';
  }

  function cerrarLightbox() {
    lightbox.hidden = true;
    lightboxImagen.src = '';
    document.body.style.overflow = '';
    if (elementoConFocoPrevio) {
      elementoConFocoPrevio.focus();
    }
  }

  botonesGaleria.forEach(function (boton) {
    boton.addEventListener('click', function () {
      abrirLightbox(boton);
    });
  });

  lightboxCerrar.addEventListener('click', cerrarLightbox);
  lightboxFondo.addEventListener('click', cerrarLightbox);

  document.addEventListener('keydown', function (evento) {
    if (lightbox.hidden) {
      return;
    }
    if (evento.key === 'Escape') {
      cerrarLightbox();
      return;
    }
    if (evento.key === 'Tab') {
      tramparFoco(evento);
    }
  });
}

/* =========================================================
   5. Año actual en el pie de página
   ========================================================= */
function inicializarAnioFooter() {
  var elementoAnio = document.getElementById('anio-actual');
  if (elementoAnio) {
    elementoAnio.textContent = new Date().getFullYear();
  }
}
