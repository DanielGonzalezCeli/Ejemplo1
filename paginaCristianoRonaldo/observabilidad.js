/**
 * observabilidad.js
 * Renderiza el panel de observabilidad local a partir de los datos
 * que expone window.CR7Observability (definido en script.js, que
 * esta página carga antes que este archivo).
 *
 * Este archivo NO recolecta datos por sí mismo: solo lee lo que el
 * motor ya guardó en localStorage y dibuja la interfaz. No depende
 * de ninguna API externa ni envía datos a servidores.
 */

document.addEventListener('DOMContentLoaded', function () {
  var elementoEstado = document.getElementById('estado-mensaje');

  if (!window.CR7Observability || typeof window.CR7Observability.getSnapshot !== 'function') {
    mostrarMensajeEstado(
      'No se pudo cargar el motor de observabilidad (script.js). ' +
      'Verifica que el archivo esté presente y que se cargue antes que observabilidad.js.',
      true
    );
    return;
  }

  vincularBotones();
  renderizarTodo();

  /* ---------------------------------------------------------
     Botones de la barra de herramientas
     --------------------------------------------------------- */
  function vincularBotones() {
    var btnActualizar = document.getElementById('btn-actualizar');
    var btnDemo = document.getElementById('btn-demo');
    var btnLimpiar = document.getElementById('btn-limpiar');
    var btnDescargar = document.getElementById('btn-descargar');

    if (btnActualizar) {
      btnActualizar.addEventListener('click', function () {
        renderizarTodo();
        mostrarMensajeEstado('Datos actualizados desde el almacenamiento local.');
      });
    }

    if (btnDemo) {
      btnDemo.addEventListener('click', function () {
        window.CR7Observability.recordDemoEvent();
        mostrarMensajeEstado('Evento de demostración generado: una interacción y un error de ejemplo.');
        // Se espera un instante porque el error de demostración se
        // provoca de forma asíncrona (setTimeout) dentro del motor,
        // para que el propio listener de errores lo capture como lo
        // haría con un fallo real.
        window.setTimeout(renderizarTodo, 80);
      });
    }

    if (btnLimpiar) {
      btnLimpiar.addEventListener('click', function () {
        var confirmado = window.confirm(
          '¿Seguro que deseas borrar todos los datos de observabilidad guardados en este navegador? Esta acción no se puede deshacer.'
        );
        if (!confirmado) {
          return;
        }
        window.CR7Observability.clear();
        renderizarTodo();
        mostrarMensajeEstado('Almacenamiento local de observabilidad borrado.');
      });
    }

    if (btnDescargar) {
      btnDescargar.addEventListener('click', descargarSnapshot);
    }
  }

  function mostrarMensajeEstado(texto, esError) {
    if (!elementoEstado) {
      return;
    }
    elementoEstado.textContent = texto;
    elementoEstado.classList.toggle('estado-mensaje--error', !!esError);
  }

  /* ---------------------------------------------------------
     Renderizado general
     --------------------------------------------------------- */
  function renderizarTodo() {
    var snapshot = window.CR7Observability.getSnapshot();
    renderizarResumen(snapshot);
    renderizarEntorno(snapshot.environment);
    renderizarNavegacion(snapshot.navigation);
    renderizarErrores(snapshot.errors);
    renderizarRecursos(snapshot.resourceErrors);
    renderizarInteracciones(snapshot.interactions);
    renderizarVisibilidad(snapshot.visibility);
  }

  function formatearFecha(iso) {
    if (!iso) {
      return null;
    }
    try {
      var fecha = new Date(iso);
      if (isNaN(fecha.getTime())) {
        return iso;
      }
      return fecha.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return iso;
    }
  }

  function formatearBooleano(valor) {
    if (valor === null || valor === undefined) {
      return null;
    }
    return valor ? 'Sí' : 'No';
  }

  function crearCelda(texto, esCabeceraDeFila) {
    var celda = document.createElement(esCabeceraDeFila ? 'th' : 'td');
    if (esCabeceraDeFila) {
      celda.scope = 'row';
    }
    var esVacio = texto === null || texto === undefined || texto === '';
    celda.textContent = esVacio ? '—' : String(texto);
    return celda;
  }

  function limpiarCuerpoTabla(idCuerpo) {
    var cuerpo = document.getElementById(idCuerpo);
    if (cuerpo) {
      cuerpo.innerHTML = '';
    }
    return cuerpo;
  }

  // Muestra la tabla u oculta y muestra en su lugar el mensaje de
  // "estado vacío" correspondiente, según si hay datos o no.
  function alternarVacio(idTabla, idVacio, estaVacio) {
    var tabla = document.getElementById(idTabla);
    var vacio = document.getElementById(idVacio);
    if (tabla) {
      tabla.hidden = estaVacio;
    }
    if (vacio) {
      vacio.hidden = !estaVacio;
    }
  }

  /* ---------------------------------------------------------
     Resumen
     --------------------------------------------------------- */
  function renderizarResumen(snapshot) {
    var contenedor = document.getElementById('resumen-grid');
    if (!contenedor) {
      return;
    }
    contenedor.innerHTML = '';

    var meta = snapshot.meta || {};
    var totales = meta.totalEventos || {};
    var totalGeneral = Object.keys(totales).reduce(function (suma, clave) {
      return suma + (totales[clave] || 0);
    }, 0);

    var items = [
      ['Identificador de sesión', meta.sessionId || 'Aún sin datos'],
      ['Primer registro', formatearFecha(meta.primeraVez) || 'Aún sin datos'],
      ['Última actualización', formatearFecha(meta.ultimaActualizacion) || 'Aún sin datos'],
      ['Eventos totales registrados', String(totalGeneral)],
      ['Cargas de página registradas', String((snapshot.navigation || []).length)],
      ['Errores de JavaScript', String((snapshot.errors || []).length)],
      ['Errores de recursos', String((snapshot.resourceErrors || []).length)],
      ['Interacciones', String((snapshot.interactions || []).length)],
      ['Cambios de visibilidad', String((snapshot.visibility || []).length)]
    ];

    items.forEach(function (par) {
      var bloque = document.createElement('div');
      bloque.className = 'resumen-item';

      var dt = document.createElement('dt');
      dt.textContent = par[0];

      var dd = document.createElement('dd');
      dd.textContent = par[1];

      bloque.appendChild(dt);
      bloque.appendChild(dd);
      contenedor.appendChild(bloque);
    });
  }

  /* ---------------------------------------------------------
     Entorno
     --------------------------------------------------------- */
  function renderizarEntorno(entorno) {
    var cuerpo = limpiarCuerpoTabla('tabla-entorno-cuerpo');
    if (!cuerpo) {
      return;
    }

    if (!entorno) {
      var fila = document.createElement('tr');
      var celda = document.createElement('td');
      celda.textContent = 'Aún no se capturó información del entorno.';
      celda.colSpan = 2;
      fila.appendChild(celda);
      cuerpo.appendChild(fila);
      return;
    }

    var conexion = entorno.conexion;
    var soporte = entorno.soporteAPIs || {};
    var navegador = entorno.navegador || {};
    var viewport = entorno.viewport || {};

    var filas = [
      ['Última captura', formatearFecha(entorno.timestamp)],
      ['Página', entorno.pagina],
      ['Ancho de viewport', viewport.ancho !== undefined ? viewport.ancho + ' px' : null],
      ['Alto de viewport', viewport.alto !== undefined ? viewport.alto + ' px' : null],
      ['Densidad de píxeles', viewport.densidadPixeles],
      ['Tipo de conexión', conexion ? conexion.tipoEfectivo : 'No disponible en este navegador'],
      ['Velocidad estimada', conexion && conexion.downlinkMbps !== null ? conexion.downlinkMbps + ' Mb/s' : null],
      ['Latencia estimada (RTT)', conexion && conexion.rttMs !== null ? conexion.rttMs + ' ms' : null],
      ['Ahorro de datos activado', conexion ? formatearBooleano(conexion.ahorroDatos) : null],
      ['Soporta localStorage', formatearBooleano(soporte.localStorage)],
      ['Soporta Performance API', formatearBooleano(soporte.performance)],
      ['Soporta PerformanceObserver', formatearBooleano(soporte.performanceObserver)],
      ['Soporta IntersectionObserver', formatearBooleano(soporte.intersectionObserver)],
      ['Soporta matchMedia', formatearBooleano(soporte.matchMedia)],
      ['Soporta Network Information API', formatearBooleano(soporte.connectionInfo)],
      ['Soporta Service Worker', formatearBooleano(soporte.serviceWorker)],
      ['Idioma del navegador', navegador.idioma],
      ['Plataforma', navegador.plataforma],
      ['Cookies habilitadas', formatearBooleano(navegador.cookiesHabilitadas)]
    ];

    filas.forEach(function (par) {
      var filaTabla = document.createElement('tr');
      filaTabla.appendChild(crearCelda(par[0], true));
      filaTabla.appendChild(crearCelda(par[1], false));
      cuerpo.appendChild(filaTabla);
    });
  }

  /* ---------------------------------------------------------
     Navegación y carga
     --------------------------------------------------------- */
  function renderizarNavegacion(lista) {
    lista = lista || [];
    var cuerpo = limpiarCuerpoTabla('tabla-navegacion-cuerpo');
    alternarVacio('tabla-navegacion', 'navegacion-vacio', lista.length === 0);
    if (!cuerpo) {
      return;
    }

    lista.slice().reverse().forEach(function (registro) {
      var fila = document.createElement('tr');
      fila.appendChild(crearCelda(formatearFecha(registro.timestamp)));
      fila.appendChild(crearCelda(registro.pagina));

      if (registro.soportado === false) {
        var celdaSinSoporte = document.createElement('td');
        celdaSinSoporte.colSpan = 3;
        celdaSinSoporte.textContent = 'Performance API no disponible en este navegador.';
        fila.appendChild(celdaSinSoporte);
      } else {
        fila.appendChild(crearCelda(registro.tiempoHastaDomContentLoaded));
        fila.appendChild(crearCelda(registro.tiempoHastaCargaCompleta));
        fila.appendChild(crearCelda(registro.primerPintadoConContenido !== undefined ? registro.primerPintadoConContenido : registro.primerPintado));
      }

      cuerpo.appendChild(fila);
    });
  }

  /* ---------------------------------------------------------
     Errores de JavaScript
     --------------------------------------------------------- */
  function renderizarErrores(lista) {
    lista = lista || [];
    var cuerpo = limpiarCuerpoTabla('tabla-errores-cuerpo');
    alternarVacio('tabla-errores', 'errores-vacio', lista.length === 0);
    if (!cuerpo) {
      return;
    }

    lista.slice().reverse().forEach(function (registro) {
      var fila = document.createElement('tr');
      fila.appendChild(crearCelda(formatearFecha(registro.timestamp)));
      fila.appendChild(crearCelda(registro.tipo));
      fila.appendChild(crearCelda(registro.mensaje));

      var ubicacion = null;
      if (registro.archivo) {
        ubicacion = registro.archivo.split('/').pop() + ':' + (registro.linea || '?') + ':' + (registro.columna || '?');
      }
      fila.appendChild(crearCelda(ubicacion));

      cuerpo.appendChild(fila);
    });
  }

  /* ---------------------------------------------------------
     Errores de carga de recursos
     --------------------------------------------------------- */
  function renderizarRecursos(lista) {
    lista = lista || [];
    var cuerpo = limpiarCuerpoTabla('tabla-recursos-cuerpo');
    alternarVacio('tabla-recursos', 'recursos-vacio', lista.length === 0);
    if (!cuerpo) {
      return;
    }

    lista.slice().reverse().forEach(function (registro) {
      var fila = document.createElement('tr');
      fila.appendChild(crearCelda(formatearFecha(registro.timestamp)));
      fila.appendChild(crearCelda(registro.etiqueta));
      fila.appendChild(crearCelda(registro.origen));
      cuerpo.appendChild(fila);
    });
  }

  /* ---------------------------------------------------------
     Interacciones
     --------------------------------------------------------- */
  function renderizarInteracciones(lista) {
    lista = lista || [];
    var cuerpo = limpiarCuerpoTabla('tabla-interacciones-cuerpo');
    alternarVacio('tabla-interacciones', 'interacciones-vacio', lista.length === 0);
    if (!cuerpo) {
      return;
    }

    lista.slice().reverse().forEach(function (registro) {
      var fila = document.createElement('tr');
      fila.appendChild(crearCelda(formatearFecha(registro.timestamp)));
      fila.appendChild(crearCelda(registro.pagina));
      fila.appendChild(crearCelda(registro.etiqueta));
      fila.appendChild(crearCelda(registro.texto));
      cuerpo.appendChild(fila);
    });
  }

  /* ---------------------------------------------------------
     Visibilidad
     --------------------------------------------------------- */
  function renderizarVisibilidad(lista) {
    lista = lista || [];
    var cuerpo = limpiarCuerpoTabla('tabla-visibilidad-cuerpo');
    alternarVacio('tabla-visibilidad', 'visibilidad-vacio', lista.length === 0);
    if (!cuerpo) {
      return;
    }

    lista.slice().reverse().forEach(function (registro) {
      var fila = document.createElement('tr');
      fila.appendChild(crearCelda(formatearFecha(registro.timestamp)));
      fila.appendChild(crearCelda(registro.pagina));
      fila.appendChild(crearCelda(registro.estado));
      cuerpo.appendChild(fila);
    });
  }

  /* ---------------------------------------------------------
     Descarga del snapshot como archivo JSON
     --------------------------------------------------------- */
  function descargarSnapshot() {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      mostrarMensajeEstado('Este navegador no admite la descarga de archivos desde JavaScript.', true);
      return;
    }

    var snapshot = window.CR7Observability.getSnapshot();
    var contenido = JSON.stringify(snapshot, null, 2);
    var blob = new Blob([contenido], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var marcaDeTiempoArchivo = new Date().toISOString().replace(/[:.]/g, '-');

    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'cr7-observability-snapshot-' + marcaDeTiempoArchivo + '.json';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    mostrarMensajeEstado('Snapshot descargado como archivo JSON.');
  }
});
