/*
 * Voice Recognition - Lógica de la aplicación
 *
 * 1. Captura de audio: se solicita permiso al micrófono (getUserMedia) y el
 *    navegador captura el audio que llega al reconocedor.
 * 2. Reconocimiento de voz: SpeechRecognition (Web Speech API) envía el audio al
 *    motor de voz del navegador, configurado en español (es-CO).
 * 3. Conversión de voz a texto: el motor del navegador devuelve la transcripción.
 *    Esta aplicación NO entrena ni ejecuta una red neuronal propia.
 * 4. Interpretación del comando: el texto se normaliza (minúsculas, sin tildes ni
 *    signos) y se busca si contiene una frase clave. Es un conjunto de reglas.
 * 5. Ejecución de acciones: el comando identificado ejecuta una función que
 *    produce la respuesta mostrada en pantalla.
 */

// ===== Referencias a elementos del DOM =====
const btnMicrofono = document.getElementById('btnMicrofono');
const estadoContenedor = document.getElementById('estado');
const textoEstado = document.getElementById('textoEstado');
const mensaje = document.getElementById('mensaje');
const avisoContexto = document.getElementById('avisoContexto');
const elTranscripcion = document.getElementById('transcripcion');
const elComando = document.getElementById('comandoIdentificado');
const elRespuesta = document.getElementById('respuesta');
const listaComandos = document.getElementById('listaComandos');
const listaHistorial = document.getElementById('listaHistorial');
const metricEstado = document.getElementById('metricEstado');

// ===== Configuración general =====
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const IDIOMA = 'es-CO';
const MAX_HISTORIAL = 5;
const TEXTO_NO_RECONOCIDO = 'No reconocí ese comando. Intenta nuevamente';
const TEXTO_SIN_RESULTADOS = 'El reconocimiento no devolvió resultados. Intenta nuevamente.';
const TEXTO_VACIO = '\u2014';

// Colores oscuros para el fondo; cada vez que se pide cambiar, se usa el siguiente.
const COLORES_FONDO = [
    { nombre: 'azul marino', valor: '#0b1d3a' },
    { nombre: 'verde oscuro', valor: '#0f2e24' },
    { nombre: 'morado oscuro', valor: '#2a1842' },
    { nombre: 'granate', valor: '#3a1420' },
    { nombre: 'gris carbón', valor: '#1f2328' },
    { nombre: 'azul petróleo', valor: '#0d3340' }
];
let indiceColor = 0;

// ===== Datos para los comandos =====
const CHISTES = [
    '¿Por qué el libro de matemáticas estaba triste? Porque tenía demasiados problemas.',
    '¿Por qué los programadores confunden Halloween con Navidad? Porque OCT 31 es igual a DEC 25.',
    '¿Qué le dice una impresora a otra? ¿Esa hoja es tuya o es una impresión tuya?',
    '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
    '¿Cómo se despiden los químicos? Ácido un placer.'
];

const FRASES_MOTIVADORAS = [
    'Cada línea de código que escribes te acerca a tu meta.',
    'Los errores también son parte del aprendizaje.',
    'Hoy es un buen día para aprender algo nuevo.',
    'Confía en tu proceso: cada práctica cuenta.',
    'Tu esfuerzo de hoy será tu ventaja de mañana.'
];

const DATOS_CURIOSOS = [
    'El corazón de una ballena azul puede pesar alrededor de 180 kilogramos.',
    'El pulpo tiene tres corazones.',
    'La miel casi nunca se echa a perder.',
    'Un día en Venus dura más que su propio año.',
    'La Tierra gira a unos 1.670 km/h en el ecuador.'
];

// Palabras en español (ya sin tildes) que se convierten a número en los comandos.
const NUMEROS_EN_PALABRAS = {
    cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
    quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100
};

const OPERACIONES = {
    mas: { simbolo: 'más', calcular: (a, b) => a + b },
    menos: { simbolo: 'menos', calcular: (a, b) => a - b },
    por: { simbolo: 'por', calcular: (a, b) => a * b },
    x: { simbolo: 'por', calcular: (a, b) => a * b },
    entre: { simbolo: 'entre', calcular: (a, b) => a / b }
};

function elegirAleatorio(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
}

// Cambia palabras numéricas por dígitos: "cinco mas tres" -> "5 mas 3".
function convertirPalabrasANumeros(textoNormalizado) {
    return textoNormalizado
        .split(' ')
        .map(palabra => (Object.prototype.hasOwnProperty.call(NUMEROS_EN_PALABRAS, palabra)
            ? String(NUMEROS_EN_PALABRAS[palabra])
            : palabra))
        .join(' ');
}

function calcularOperacion(textoNormalizado) {
    const coincidencia = convertirPalabrasANumeros(textoNormalizado).match(/(\d+) (mas|menos|por|x|entre) (\d+)/);
    if (!coincidencia) {
        return 'No entendí la operación. Ejemplo: "cuánto es cinco más tres".';
    }
    const [, a, operador, b] = coincidencia;
    const x = Number(a);
    const y = Number(b);
    if (operador === 'entre' && y === 0) {
        return 'No se puede dividir entre cero.';
    }
    const resultado = Math.round(OPERACIONES[operador].calcular(x, y) * 100) / 100;
    return `${x} ${OPERACIONES[operador].simbolo} ${y} es ${resultado}.`;
}

function contarHasta(textoNormalizado) {
    const coincidencia = convertirPalabrasANumeros(textoNormalizado).match(/hasta (\d+)/);
    const limite = coincidencia ? Number(coincidencia[1]) : NaN;
    if (!(limite >= 1 && limite <= 20)) {
        return 'Dime un número del 1 al 20. Ejemplo: "cuenta hasta cinco".';
    }
    return Array.from({ length: limite }, (_, i) => i + 1).join(', ') + '.';
}

function repetirTexto(textoNormalizado) {
    const palabra = 'repite';
    const resto = textoNormalizado.slice(textoNormalizado.indexOf(palabra) + palabra.length).trim();
    return resto ? `Repito: ${resto}.` : 'Dime qué quieres que repita. Ejemplo: "repite hola mundo".';
}

function diasParaNavidad() {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let navidad = new Date(inicioHoy.getFullYear(), 11, 25);
    if (navidad < inicioHoy) {
        navidad = new Date(inicioHoy.getFullYear() + 1, 11, 25);
    }
    const dias = Math.round((navidad - inicioHoy) / 86400000);
    if (dias === 0) {
        return '¡Hoy es Navidad!';
    }
    return `Faltan ${dias} ${dias === 1 ? 'día' : 'días'} para Navidad.`;
}

// ===== Definición de comandos =====
// Cada comando tiene frases clave (ya en minúsculas y sin tildes) y una acción.
// "repetir" va primero para que "repite hola" no se confunda con "hola".
const COMANDOS = [
    {
        id: 'repetir',
        nombre: 'Repetir',
        descripcion: 'Repite lo que digas después de "repite".',
        ejemplo: '"Repite hola mundo"',
        frases: ['repite'],
        accion: transcripcion => repetirTexto(normalizarTexto(transcripcion))
    },
    {
        id: 'hola',
        nombre: 'Hola',
        descripcion: 'Muestra un saludo.',
        ejemplo: '"Hola"',
        frases: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'saludos'],
        accion: () => '¡Hola! ¿En qué puedo ayudarte?'
    },
    {
        id: 'hora',
        nombre: '¿Qué hora es?',
        descripcion: 'Muestra la hora actual.',
        ejemplo: '"¿Qué hora es?"',
        frases: ['que hora es', 'que hora', 'dime la hora', 'hora actual', 'me dices la hora'],
        accion: () => {
            const hora = new Date().toLocaleTimeString(IDIOMA, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `Son las ${hora}.`;
        }
    },
    {
        id: 'fecha',
        nombre: '¿Qué fecha es?',
        descripcion: 'Muestra la fecha actual.',
        ejemplo: '"¿Qué fecha es?"',
        frases: ['que fecha es', 'que fecha', 'dime la fecha', 'fecha actual', 'que dia es hoy'],
        accion: () => {
            const fecha = new Date().toLocaleDateString(IDIOMA, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return `Hoy es ${fecha}.`;
        }
    },
    {
        id: 'ano',
        nombre: '¿Qué año es?',
        descripcion: 'Muestra el año actual.',
        ejemplo: '"¿Qué año es?"',
        frases: ['que ano es', 'en que ano estamos'],
        accion: () => `Estamos en el año ${new Date().getFullYear()}.`
    },
    {
        id: 'navidad',
        nombre: '¿Cuánto falta para Navidad?',
        descripcion: 'Calcula los días que faltan para el 25 de diciembre.',
        ejemplo: '"¿Cuánto falta para Navidad?"',
        frases: ['cuanto falta para navidad', 'dias para navidad', 'cuantos dias faltan para navidad'],
        accion: diasParaNavidad
    },
    {
        id: 'calcular',
        nombre: 'Calcular',
        descripcion: 'Resuelve sumas, restas, multiplicaciones y divisiones sencillas.',
        ejemplo: '"¿Cuánto es cinco más tres?"',
        frases: ['cuanto es', 'cuanto son', 'cuanto da', 'calcula', 'calcular'],
        accion: transcripcion => calcularOperacion(normalizarTexto(transcripcion))
    },
    {
        id: 'contar',
        nombre: 'Contar',
        descripcion: 'Cuenta del 1 hasta el número indicado (máximo 20).',
        ejemplo: '"Cuenta hasta cinco"',
        frases: ['cuenta hasta'],
        accion: transcripcion => contarHasta(normalizarTexto(transcripcion))
    },
    {
        id: 'estado',
        nombre: '¿Cómo estás?',
        descripcion: 'Responde con un mensaje de estado.',
        ejemplo: '"¿Cómo estás?"',
        frases: ['como estas', 'como te va'],
        accion: () => 'Muy bien, listo para escucharte.'
    },
    {
        id: 'identidad',
        nombre: '¿Cómo te llamas?',
        descripcion: 'Presenta la aplicación.',
        ejemplo: '"¿Cómo te llamas?"',
        frases: ['como te llamas', 'cual es tu nombre', 'quien eres'],
        accion: () => 'Soy Voice Recognition, un asistente de comandos por voz.'
    },
    {
        id: 'gracias',
        nombre: 'Gracias',
        descripcion: 'Responde con cortesía.',
        ejemplo: '"Gracias"',
        frases: ['gracias', 'muchas gracias'],
        accion: () => 'De nada, para eso estoy.'
    },
    {
        id: 'despedida',
        nombre: 'Adiós',
        descripcion: 'Se despide del usuario.',
        ejemplo: '"Adiós"',
        frases: ['adios', 'chao', 'hasta luego', 'nos vemos'],
        accion: () => '¡Hasta luego! Vuelve cuando quieras.'
    },
    {
        id: 'chiste',
        nombre: 'Chiste',
        descripcion: 'Cuenta un chiste al azar.',
        ejemplo: '"Cuéntame un chiste"',
        frases: ['chiste', 'hazme reir'],
        accion: () => elegirAleatorio(CHISTES)
    },
    {
        id: 'dato',
        nombre: 'Dato curioso',
        descripcion: 'Muestra un dato curioso al azar.',
        ejemplo: '"Dime un dato curioso"',
        frases: ['dato curioso', 'dime un dato', 'cuentame un dato'],
        accion: () => elegirAleatorio(DATOS_CURIOSOS)
    },
    {
        id: 'motivacion',
        nombre: 'Motivación',
        descripcion: 'Muestra una frase motivadora al azar.',
        ejemplo: '"Motívame"',
        frases: ['motivame', 'animame', 'frase motivadora', 'dame animo'],
        accion: () => elegirAleatorio(FRASES_MOTIVADORAS)
    },
    {
        id: 'moneda',
        nombre: 'Cara o cruz',
        descripcion: 'Lanza una moneda.',
        ejemplo: '"Lanza una moneda"',
        frases: ['cara o cruz', 'lanza una moneda', 'tira una moneda'],
        accion: () => `Salió ${Math.random() < 0.5 ? 'cara' : 'cruz'}.`
    },
    {
        id: 'dado',
        nombre: 'Lanzar dado',
        descripcion: 'Tira un dado de seis caras.',
        ejemplo: '"Tira un dado"',
        frases: ['tira un dado', 'lanza un dado'],
        accion: () => `Salió el ${Math.floor(Math.random() * 6) + 1}.`
    },
    {
        id: 'color',
        nombre: 'Cambiar color',
        descripcion: 'Cambia el color de fondo de la interfaz.',
        ejemplo: '"Cambiar color"',
        frases: ['cambiar color', 'cambia color', 'cambiar el color', 'cambia el color', 'cambiar de color', 'cambia de color'],
        accion: cambiarColorFondo
    },
    {
        id: 'limpiar',
        nombre: 'Limpiar pantalla',
        descripcion: 'Limpia la transcripción y el resultado.',
        ejemplo: '"Limpiar pantalla"',
        frases: ['limpiar pantalla', 'limpia pantalla', 'limpiar la pantalla', 'limpia la pantalla', 'borrar pantalla', 'limpiar'],
        accion: limpiarPantalla
    },
    {
        id: 'ayuda',
        nombre: 'Ayuda',
        descripcion: 'Muestra los comandos disponibles.',
        ejemplo: '"Ayuda"',
        frases: ['ayuda', 'ayudame', 'ayudarme', 'que puedes hacer', 'que comandos', 'comandos'],
        accion: () => `Puedes decir: ${COMANDOS.map(c => c.ejemplo).join(', ')}.`
    }
];

// ===== Estado del reconocimiento =====
let reconocimiento = null;
let escuchando = false;
let solicitandoPermiso = false;
let detenidoPorUsuario = false;
let hayResultado = false;
let huboError = false;

// ===== Utilidades =====

// Pasa el texto a minúsculas, quita tildes y signos para comparar de forma sencilla.
function normalizarTexto(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Crea un elemento HTML con texto seguro (sin innerHTML).
function crearElemento(etiqueta, texto) {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = texto;
    return elemento;
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${tipo}`;
    mensaje.hidden = false;
}

// Estados visibles: 'inactivo', 'escuchando' o 'procesando'.
function setEstado(estado) {
    const etiquetas = { inactivo: 'Inactivo', escuchando: 'Escuchando', procesando: 'Procesando' };
    estadoContenedor.dataset.estado = estado;
    textoEstado.textContent = etiquetas[estado];
    if (metricEstado) {
        metricEstado.textContent = etiquetas[estado];
    }
}

// ===== 4. Interpretación del comando (reglas de programación) =====
// Busca frases completas dentro del texto, con espacios como límites de palabra.
function identificarComando(transcripcion) {
    const texto = ` ${normalizarTexto(transcripcion)} `;
    for (const comando of COMANDOS) {
        for (const frase of comando.frases) {
            if (texto.includes(` ${frase} `)) {
                return comando;
            }
        }
    }
    return null;
}

// ===== 5. Ejecución de acciones =====
function cambiarColorFondo() {
    indiceColor = (indiceColor + 1) % COLORES_FONDO.length;
    const color = COLORES_FONDO[indiceColor];
    document.documentElement.style.setProperty('--color-fondo', color.valor);
    return `Color de fondo cambiado a ${color.nombre}.`;
}

function limpiarPantalla() {
    elTranscripcion.textContent = TEXTO_VACIO;
    elComando.textContent = TEXTO_VACIO;
    elRespuesta.textContent = TEXTO_VACIO;
    return 'Pantalla limpiada.';
}

// Recibe la transcripción, identifica el comando, ejecuta su acción y muestra el resultado.
function procesarTranscripcion(transcripcion) {
    elTranscripcion.textContent = transcripcion;

    const comando = identificarComando(transcripcion);
    if (!comando) {
        elComando.textContent = TEXTO_VACIO;
        elRespuesta.textContent = TEXTO_NO_RECONOCIDO;
        agregarHistorial(transcripcion, 'Ninguno', TEXTO_NO_RECONOCIDO);
        return;
    }

    const respuesta = comando.accion(transcripcion);
    if (comando.id === 'limpiar') {
        mostrarMensaje(respuesta, 'info');
        return; // Limpiar no se guarda en el historial: la acción ya reinició la pantalla.
    }

    elComando.textContent = comando.nombre;
    elRespuesta.textContent = respuesta;
    agregarHistorial(transcripcion, comando.nombre, respuesta);
}

// ===== Historial en memoria (máximo 5 elementos) =====
function agregarHistorial(transcripcion, comando, respuesta) {
    historial.unshift({ transcripcion, comando, respuesta });
    historial.splice(MAX_HISTORIAL);
    renderHistorial();
}

const historial = [];

function renderHistorial() {
    listaHistorial.innerHTML = '';
    if (historial.length === 0) {
        listaHistorial.appendChild(crearElemento('li', 'Aún no hay interacciones.'));
        return;
    }
    historial.forEach(item => {
        const li = document.createElement('li');
        li.append(
            crearElemento('strong', `"${item.transcripcion}"`),
            crearElemento('span', `${item.comando}: ${item.respuesta}`)
        );
        listaHistorial.appendChild(li);
    });
}

function renderListaComandos() {
    COMANDOS.forEach(comando => {
        const li = document.createElement('li');
        li.append(
            crearElemento('strong', comando.nombre),
            crearElemento('span', `${comando.descripcion} Ejemplo: ${comando.ejemplo}`)
        );
        listaComandos.appendChild(li);
    });
}

// ===== 1. Captura de audio: permiso del micrófono =====
// Si el navegador no expone getUserMedia, se deja que SpeechRecognition pida el permiso.
async function solicitarPermisoMicrofono() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return true;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(pista => pista.stop()); // Solo se necesita el permiso.
        return true;
    } catch (error) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
            mostrarMensaje('Permiso de micrófono denegado. Permite el acceso al micrófono en el navegador e intenta de nuevo.', 'error');
        } else if (error.name === 'NotFoundError') {
            mostrarMensaje('No se encontró ningún micrófono conectado al computador.', 'error');
        } else {
            mostrarMensaje(`No se pudo acceder al micrófono: ${error.message}`, 'error');
        }
        return false;
    }
}

// ===== 2 y 3. Reconocimiento de voz y conversión a texto =====
function crearReconocimiento() {
    const r = new SpeechRecognitionAPI();
    r.lang = IDIOMA;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = manejarInicio;
    r.onresult = manejarResultado;
    r.onnomatch = manejarSinCoincidencia;
    r.onerror = manejarError;
    r.onend = manejarFin;
    return r;
}

// Se ejecuta al presionar el botón: inicia o detiene el reconocimiento.
async function alPulsarMicrofono() {
    if (escuchando) {
        detenidoPorUsuario = true;
        reconocimiento.stop(); // Dispara onend cuando termina.
        return;
    }
    if (solicitandoPermiso) {
        return;
    }

    solicitandoPermiso = true;
    mostrarMensaje('Solicitando acceso al micrófono...', 'info');
    const permitido = await solicitarPermisoMicrofono();
    solicitandoPermiso = false;
    if (!permitido) {
        return;
    }

    detenidoPorUsuario = false;
    hayResultado = false;
    huboError = false;
    try {
        reconocimiento.start();
    } catch (error) {
        mostrarMensaje('No se pudo iniciar el reconocimiento. Espera un momento e intenta de nuevo.', 'error');
    }
}

function manejarInicio() {
    escuchando = true;
    btnMicrofono.classList.add('escuchando');
    btnMicrofono.setAttribute('aria-pressed', 'true');
    setEstado('escuchando');
    mostrarMensaje('Habla ahora. Presiona el micrófono de nuevo para detener.', 'info');
}

function manejarResultado(evento) {
    setEstado('procesando');
    const ultimo = evento.results[evento.results.length - 1];
    const transcripcion = ultimo ? ultimo[0].transcript.trim() : '';

    if (!transcripcion) {
        mostrarMensaje(TEXTO_SIN_RESULTADOS, 'error');
        return;
    }
    hayResultado = true;
    procesarTranscripcion(transcripcion);
}

function manejarSinCoincidencia() {
    huboError = true;
    mostrarMensaje(TEXTO_SIN_RESULTADOS, 'error');
}

// Traduce los códigos de error del motor a mensajes comprensibles.
function manejarError(evento) {
    huboError = true;
    const mensajes = {
        'not-allowed': 'Permiso de micrófono denegado. Permite el acceso al micrófono en el navegador.',
        'service-not-allowed': 'El navegador no permite el reconocimiento de voz en este sitio. Revisa los permisos o usa localhost o HTTPS.',
        'no-speech': 'No se detectó ningún audio. Revisa tu micrófono e intenta hablar más cerca.',
        'audio-capture': 'No se encontró un micrófono disponible.',
        'network': 'Error de red: el reconocimiento de voz del navegador necesita conexión a internet.',
        'language-not-supported': 'El idioma español no está disponible en este navegador.',
        'aborted': 'Reconocimiento detenido.'
    };
    const texto = mensajes[evento.error] || `Se produjo un error durante el reconocimiento (${evento.error}).`;
    mostrarMensaje(texto, evento.error === 'aborted' ? 'info' : 'error');
}

function manejarFin() {
    escuchando = false;
    btnMicrofono.classList.remove('escuchando');
    btnMicrofono.setAttribute('aria-pressed', 'false');
    setEstado('inactivo');

    if (hayResultado || huboError) {
        return;
    }
    if (detenidoPorUsuario) {
        mostrarMensaje('Reconocimiento detenido por el usuario.', 'info');
    } else {
        mostrarMensaje(TEXTO_SIN_RESULTADOS, 'error');
    }
}

// ===== Inicialización y compatibilidad =====
function iniciar() {
    renderListaComandos();
    renderHistorial();

    if (!window.isSecureContext) {
        avisoContexto.textContent = 'Esta página no está en un contexto seguro. Ábrela con localhost o HTTPS para usar el micrófono.';
        avisoContexto.hidden = false;
    }

    if (!SpeechRecognitionAPI) {
        mostrarMensaje('Tu navegador no soporta la Web Speech API. Usa Google Chrome o Microsoft Edge.', 'error');
        btnMicrofono.disabled = true;
        return;
    }

    reconocimiento = crearReconocimiento();
    btnMicrofono.addEventListener('click', alPulsarMicrofono);
    setEstado('inactivo');
    mostrarMensaje('Presiona el micrófono y di un comando en español.', 'info');
}

iniciar();
