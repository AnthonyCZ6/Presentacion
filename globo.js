/* ==========================================================================
   Mapa mundi - comportamiento del globo

   Control por arrastre, libre en los dos ejes, mas zoom, buscador,
   marcadores, recorrido guiado y el modo "Ahora".

   El giro no cuelga del scroll, asi que la pagina no se desplaza: la unica
   forma de mover el globo es agarrarlo. Eso obliga a JavaScript, porque un
   arrastre no se puede leer desde CSS.

   Todo lo que mueve el globo pasa por un unico bucle de requestAnimationFrame
   (latir), que solo corre mientras hay algo que animar: la inercia tras un
   arrastre, un vuelo hacia un lugar, el zoom suavizado o el giro automatico.
   Cuando todo se para, el bucle se apaga y la pagina deja de gastar.

   Las transformaciones se escriben DIRECTAMENTE en los elementos que giran,
   no a traves de una propiedad personalizada heredada. Con una variable
   heredada desde body, cambiarla obligaba al navegador a recalcular estilo
   en las cientos de teselas aunque ninguna la usara.

   Angulos, con las mismas convenciones que el CSS de las teselas:
     giro     rotateY de .corteza. El meridiano L mira a camara si L = -giro.
     inclina  rotateX de .eje. El paralelo P mira a camara si P = -inclina.
   ========================================================================== */
(() => {
  "use strict";

  /* ------------------------------------------------------------- datos --- */

  /* Lugares con texto propio o con marcador. Los que llevan marca: true
     salen como marcadores; zoom es el acercamiento al volar hasta ahi. Los
     paises, estados y el resto de ciudades llegan despues desde
     geografia.js, generado a partir de Natural Earth. */
  const LUGARES = [
    { nombre: "Ciudad de México", zona: "México", lat: 19.43, lon: -99.13, marca: true, zoom: 1.3,
      alias: ["cdmx", "df", "mexico df"],
      texto: "Una de las metrópolis más grandes del mundo, levantada sobre el antiguo lago de Texcoco a 2240 m de altitud. Su suelo de arcilla se compacta y hay zonas que se hunden varios centímetros al año." },
    { nombre: "Selva amazónica", zona: "Sudamérica", lat: -3.47, lon: -62.37, zoom: 1.2,
      alias: ["amazonas", "amazonia", "rio amazonas"],
      texto: "La selva tropical más extensa del planeta, de unos 5,5 millones de km². El río Amazonas lleva al mar más agua que ningún otro: cerca de una quinta parte del agua dulce que llega a los océanos." },
    { nombre: "Sahara", zona: "Norte de África", lat: 23.0, lon: 13.0, zoom: 1.15,
      alias: ["desierto del sahara"],
      texto: "El mayor desierto cálido del mundo: unos 9 millones de km², casi tanto como Estados Unidos. Solo los desiertos fríos de la Antártida y el Ártico son más grandes." },
    { nombre: "Everest", zona: "Nepal y China", lat: 27.99, lon: 86.93, zoom: 1.3,
      alias: ["monte everest", "himalaya"],
      texto: "En la frontera entre Nepal y China, el Everest alcanza 8849 m: la cumbre más alta sobre el nivel del mar. El Himalaya sigue creciendo porque la India empuja contra el resto de Asia." },
    { nombre: "Fosa de las Marianas", zona: "Océano Pacífico", lat: 11.35, lon: 142.2, zoom: 1.25,
      alias: ["marianas", "abismo challenger"],
      texto: "Aquí está el punto más profundo del océano, el abismo Challenger, a casi 11 000 m. Si el Everest se hundiera en él, su cima quedaría a más de 2 km bajo el agua." },
    { nombre: "Gran Barrera de Coral", zona: "Australia", lat: -18.29, lon: 147.7, zoom: 1.3,
      alias: ["gran barrera", "barrera de coral"],
      texto: "La mayor estructura construida por seres vivos: unos 2900 arrecifes a lo largo de más de 2300 km frente a la costa noreste de Australia." },
    { nombre: "Antártida", zona: "Estación Vóstok", lat: -78.46, lon: 106.84, zoom: 1.15,
      alias: ["antartica", "antartico", "vostok"],
      texto: "El continente más frío, seco y ventoso. En la estación Vóstok, aquí marcada, se midieron −89,2 °C en 1983: la temperatura más baja registrada con un termómetro en la superficie." },
    { nombre: "Groenlandia", zona: "Reino de Dinamarca", lat: 72.0, lon: -40.0, zoom: 1.15,
      texto: "La isla más grande del mundo, con unos 2,2 millones de km². Cerca del 80 % está cubierta por un manto de hielo que en su parte más gruesa supera los 3 km." },

    { nombre: "Guadalajara", zona: "México", lat: 20.67, lon: -103.35 },
    { nombre: "Monterrey", zona: "México", lat: 25.69, lon: -100.32 },
    { nombre: "Puebla", zona: "México", lat: 19.04, lon: -98.21 },
    { nombre: "Cuernavaca", zona: "México", lat: 18.92, lon: -99.23 },
    { nombre: "Mérida", zona: "México", lat: 20.97, lon: -89.62 },
    { nombre: "Cancún", zona: "México", lat: 21.16, lon: -86.85 },
    { nombre: "Tijuana", zona: "México", lat: 32.51, lon: -117.04 },
    { nombre: "Oaxaca", zona: "México", lat: 17.07, lon: -96.73 },

    { nombre: "Nueva York", zona: "Estados Unidos", lat: 40.71, lon: -74.01, marca: true, alias: ["new york", "nyc"] },
    { nombre: "Los Ángeles", zona: "Estados Unidos", lat: 34.05, lon: -118.24, marca: true },
    { nombre: "Chicago", zona: "Estados Unidos", lat: 41.88, lon: -87.63 },
    { nombre: "Washington D. C.", zona: "Estados Unidos", lat: 38.91, lon: -77.04, alias: ["washington"] },
    { nombre: "Anchorage", zona: "Estados Unidos", lat: 61.22, lon: -149.9, marca: true },
    { nombre: "Honolulu", zona: "Estados Unidos", lat: 21.31, lon: -157.86, marca: true },
    { nombre: "Toronto", zona: "Canadá", lat: 43.65, lon: -79.38 },
    { nombre: "Vancouver", zona: "Canadá", lat: 49.28, lon: -123.12 },
    { nombre: "La Habana", zona: "Cuba", lat: 23.11, lon: -82.37 },
    { nombre: "Ciudad de Guatemala", zona: "Guatemala", lat: 14.63, lon: -90.51 },
    { nombre: "San José", zona: "Costa Rica", lat: 9.93, lon: -84.08 },
    { nombre: "Ciudad de Panamá", zona: "Panamá", lat: 8.98, lon: -79.52 },
    { nombre: "Santo Domingo", zona: "República Dominicana", lat: 18.49, lon: -69.93 },
    { nombre: "San Juan", zona: "Puerto Rico", lat: 18.47, lon: -66.11 },

    { nombre: "Bogotá", zona: "Colombia", lat: 4.71, lon: -74.07, marca: true },
    { nombre: "Caracas", zona: "Venezuela", lat: 10.49, lon: -66.88 },
    { nombre: "Quito", zona: "Ecuador", lat: -0.18, lon: -78.47 },
    { nombre: "Lima", zona: "Perú", lat: -12.05, lon: -77.04, marca: true },
    { nombre: "La Paz", zona: "Bolivia", lat: -16.5, lon: -68.15 },
    { nombre: "Santiago", zona: "Chile", lat: -33.45, lon: -70.67, alias: ["santiago de chile"] },
    { nombre: "Buenos Aires", zona: "Argentina", lat: -34.6, lon: -58.38, marca: true },
    { nombre: "Montevideo", zona: "Uruguay", lat: -34.9, lon: -56.16 },
    { nombre: "Asunción", zona: "Paraguay", lat: -25.26, lon: -57.58 },
    { nombre: "São Paulo", zona: "Brasil", lat: -23.55, lon: -46.63, marca: true },
    { nombre: "Río de Janeiro", zona: "Brasil", lat: -22.91, lon: -43.17 },
    { nombre: "Brasilia", zona: "Brasil", lat: -15.79, lon: -47.88 },

    { nombre: "Madrid", zona: "España", lat: 40.42, lon: -3.7, marca: true },
    { nombre: "Barcelona", zona: "España", lat: 41.39, lon: 2.17 },
    { nombre: "Lisboa", zona: "Portugal", lat: 38.72, lon: -9.14 },
    { nombre: "París", zona: "Francia", lat: 48.86, lon: 2.35 },
    { nombre: "Londres", zona: "Reino Unido", lat: 51.51, lon: -0.13, marca: true },
    { nombre: "Berlín", zona: "Alemania", lat: 52.52, lon: 13.4 },
    { nombre: "Roma", zona: "Italia", lat: 41.9, lon: 12.5 },
    { nombre: "Atenas", zona: "Grecia", lat: 37.98, lon: 23.73 },
    { nombre: "Moscú", zona: "Rusia", lat: 55.76, lon: 37.62, marca: true },
    { nombre: "Estambul", zona: "Turquía", lat: 41.01, lon: 28.98 },
    { nombre: "Reikiavik", zona: "Islandia", lat: 64.15, lon: -21.94, marca: true },

    { nombre: "El Cairo", zona: "Egipto", lat: 30.04, lon: 31.24, marca: true, alias: ["cairo"] },
    { nombre: "Casablanca", zona: "Marruecos", lat: 33.57, lon: -7.59 },
    { nombre: "Dakar", zona: "Senegal", lat: 14.69, lon: -17.44 },
    { nombre: "Lagos", zona: "Nigeria", lat: 6.52, lon: 3.38, marca: true },
    { nombre: "Addis Abeba", zona: "Etiopía", lat: 9.03, lon: 38.74 },
    { nombre: "Nairobi", zona: "Kenia", lat: -1.29, lon: 36.82, marca: true },
    { nombre: "Kinsasa", zona: "R. D. del Congo", lat: -4.44, lon: 15.27 },
    { nombre: "Johannesburgo", zona: "Sudáfrica", lat: -26.2, lon: 28.05 },
    { nombre: "Ciudad del Cabo", zona: "Sudáfrica", lat: -33.92, lon: 18.42, marca: true },

    { nombre: "Dubái", zona: "Emiratos Árabes Unidos", lat: 25.2, lon: 55.27 },
    { nombre: "Teherán", zona: "Irán", lat: 35.69, lon: 51.39 },
    { nombre: "Nueva Delhi", zona: "India", lat: 28.61, lon: 77.21, marca: true, alias: ["delhi"] },
    { nombre: "Bombay", zona: "India", lat: 19.08, lon: 72.88, alias: ["mumbai"] },
    { nombre: "Bangkok", zona: "Tailandia", lat: 13.76, lon: 100.5 },
    { nombre: "Singapur", zona: "Singapur", lat: 1.35, lon: 103.82, marca: true },
    { nombre: "Yakarta", zona: "Indonesia", lat: -6.21, lon: 106.85 },
    { nombre: "Manila", zona: "Filipinas", lat: 14.6, lon: 120.98 },
    { nombre: "Hong Kong", zona: "China", lat: 22.32, lon: 114.17 },
    { nombre: "Shanghái", zona: "China", lat: 31.23, lon: 121.47, alias: ["shanghai"] },
    { nombre: "Pekín", zona: "China", lat: 39.9, lon: 116.41, marca: true, alias: ["beijing"] },
    { nombre: "Seúl", zona: "Corea del Sur", lat: 37.57, lon: 126.98 },
    { nombre: "Tokio", zona: "Japón", lat: 35.68, lon: 139.69, marca: true, alias: ["tokyo"] },

    { nombre: "Sídney", zona: "Australia", lat: -33.87, lon: 151.21, marca: true, alias: ["sydney"] },
    { nombre: "Melbourne", zona: "Australia", lat: -37.81, lon: 144.96 },
    { nombre: "Perth", zona: "Australia", lat: -31.95, lon: 115.86 },
    { nombre: "Auckland", zona: "Nueva Zelanda", lat: -36.85, lon: 174.76, marca: true },

    { nombre: "Polo Norte", zona: "Ártico", lat: 90, lon: 0, zoom: 1 },
    { nombre: "Polo Sur", zona: "Antártida", lat: -90, lon: 0, zoom: 1 },
  ];

  /* Vuelta al mundo de oeste a este, de la ciudad al hielo. */
  const RECORRIDO = [
    "Ciudad de México", "Selva amazónica", "Sahara", "Everest",
    "Fosa de las Marianas", "Gran Barrera de Coral", "Antártida", "Groenlandia",
  ].map((nombre) => LUGARES.find((l) => l.nombre === nombre));

  /* --------------------------------------------------------- constantes --- */

  const RAD = Math.PI / 180;
  const INCLINACION_AXIAL = -23.44;   // la de la Tierra

  /* Hasta los polos, y ahi se para. Con 90 grados ya se alcanza cualquier
     punto de la esfera; pasar de ahi solo pondria el globo del reves. */
  const TOPE = 90;

  const POR_PIXEL_X = 0.38;           // grados de giro por pixel
  const POR_PIXEL_Y = 0.30;
  const ROCE = 0.94;                  // frenado de la inercia, por fotograma de 60 Hz

  /* Las texturas de la franja ecuatorial miden 68 px de alto y a zoom 1 su
     tesela ocupa unos 48 en pantalla. A 3 ya van ampliadas al doble y se
     ablandan; mas alla se ven borrosas y asoman las costuras entre teselas. */
  const ZOOM_MIN = 0.8;
  const ZOOM_MAX = 3;

  /* Niveles de etiquetas: los paises se ven desde el principio, cada vez
     mas al acercarse; las ciudades marcadas entran algo mas cerca, y de
     cerca los paises dejan paso a sus estados. Cada entrada es un fundido
     entre dos zooms. */
  const CIUDADES_DESDE = [1.2, 1.35];
  const ESTADOS_DESDE = [1.85, 2.1];

  const GIRO_AUTO = 0.005;            // grados por ms: una vuelta cada 72 s
  const ESPERA_AUTO = 6000;           // ms quieto antes de girar solo
  /* Con zoom se esta mirando algo de cerca: la inactividad espera mas antes
     de alejar el globo y ponerlo a girar. */
  const ESPERA_CERCA = 20000;
  const PISTA_DE_NUEVO = 30000;       // ms quieto para volver a mostrar la pista

  const INICIO = { giro: 0, inclina: -8, zoom: 1 };

  /* Punto de la esfera que cae bajo el centro de la luz fija: el 33 % 26 %
     que comparten .luz y la mascara de .noche. En coordenadas de vista (x a
     la derecha, y hacia abajo, z hacia la camara). Se deshace la perspectiva,
     que agranda lo cercano en d / (d - R z); con d = 3 diametros eso es
     3 / (3 - z / 2). */
  const LUZ = (() => {
    const sx = (0.33 - 0.5) / 0.5;
    const sy = (0.26 - 0.5) / 0.5;
    let x = sx, y = sy, z = Math.sqrt(1 - sx * sx - sy * sy);
    for (let i = 0; i < 8; i++) {
      const f = 3 / (3 - z / 2);
      x = sx / f;
      y = sy / f;
      z = Math.sqrt(1 - x * x - y * y);
    }
    return [x, y, z];
  })();

  /* ---------------------------------------------------------- elementos --- */

  const raiz = document.documentElement;
  const escena = document.querySelector(".escena");
  const sistema = document.querySelector(".sistema");
  const barra = document.querySelector(".barra");
  const ejes = [...document.querySelectorAll(".eje")];
  const capas = [...document.querySelectorAll(".corteza, .luces")];
  const capaMarcas = document.querySelector(".marcas");
  const salidaLon = document.getElementById("meridiano");
  const salidaLat = document.getElementById("paralelo");

  const buscador = document.getElementById("buscador");
  const entrada = document.getElementById("buscar");
  const lista = document.getElementById("sugerencias");
  const aviso = document.getElementById("aviso");
  const anuncio = document.getElementById("anuncio");

  const botones = {
    recorrido: document.getElementById("b-recorrido"),
    ahora: document.getElementById("b-ahora"),
    giro: document.getElementById("b-giro"),
    marcas: document.getElementById("b-marcas"),
    inicio: document.getElementById("b-inicio"),
    pantalla: document.getElementById("b-pantalla"),
  };

  const tarjeta = {
    caja: document.getElementById("tarjeta"),
    etiqueta: document.getElementById("t-etiqueta"),
    titulo: document.getElementById("t-titulo"),
    texto: document.getElementById("t-texto"),
    coords: document.getElementById("t-coords"),
    pasos: document.getElementById("t-pasos"),
    progreso: document.getElementById("t-progreso"),
    anterior: document.getElementById("t-anterior"),
    siguiente: document.getElementById("t-siguiente"),
    cerrar: document.getElementById("t-cerrar"),
  };

  /* ---------------------------------------------------------- utilidades --- */

  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  const limitarZoom = (z) => limitar(z, ZOOM_MIN, ZOOM_MAX);
  const mezclar = (a, b, t) => a + (b - a) * t;
  const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  /* Longitud del meridiano que mira al frente. Una tesela de longitud L
     acaba en L + giro, asi que da a camara cuando L = -giro. */
  const normalizar = (a) => ((a % 360) + 540) % 360 - 180;

  const formato = (v, positivo, negativo) =>
    Math.abs(v).toFixed(1).replace(".", ",") + "° " +
    (v >= 0 ? positivo : negativo);

  const coordenadas = (lat, lon) =>
    formato(lat, "N", "S") + " · " + formato(normalizar(lon), "E", "O");

  /* Sin tildes, sin mayusculas y sin signos: "Ciudad de México" y
     "ciudad de mexico" tienen que dar lo mismo. */
  const simplificar = (s) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();

  /* Distancia angular entre dos puntos de la esfera, en grados. */
  function distancia(lat1, lon1, lat2, lon2) {
    const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2 +
      Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(a))) / RAD;
  }

  /* Solo se recuerda si se quieren ver las etiquetas. El giro automatico no:
     un clic suelto en su boton lo dejaba apagado para siempre y la pagina
     parecia no tener animacion de inactividad. */
  const preferencias = (() => {
    try { return JSON.parse(localStorage.getItem("mapa-mundi")) || {}; } catch { return {}; }
  })();
  function guardarPreferencias() {
    try {
      localStorage.setItem("mapa-mundi", JSON.stringify({ verMarcas }));
    } catch { /* sin almacenamiento: se vuelve a lo de siempre en la proxima visita */ }
  }

  /* 0 por debajo de a, 1 por encima de b y un fundido entre medias. */
  const rampa = (v, [a, b]) => limitar((v - a) / (b - a), 0, 1);

  const millones = (n) => (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(".", ",").replace(/,0$/, "");
  const habitantes = (n) =>
    n >= 1e6 ? (millones(n) === "1" ? "1 millón" : millones(n) + " millones") + " de habitantes" :
    n >= 1e4 ? Math.round(n / 1000) + " mil habitantes" :
    n.toLocaleString("es") + " habitantes";

  /* -------------------------------------------------------------- estado --- */

  const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)");
  let suave = !movimientoReducido.matches;
  movimientoReducido.addEventListener("change", () => { suave = !movimientoReducido.matches; });

  let giro = INICIO.giro;
  let inclina = INICIO.inclina;
  let zoom = 1;
  let zoomObjetivo = 1;
  let velocidad = 0;
  let vuelo = null;           // { desde, hasta, inicio, duracion, arco }

  /* Encaje: cuando se abre la tarjeta, el globo se aparta y, si no cabe en
     el hueco que queda, se encoge. Va aparte del zoom del usuario. */
  let encaje = 1;
  let encajeObjetivo = 1;

  let autoGiro = suave;
  let verMarcas = preferencias.verMarcas ?? true;

  /* Que ocupa la tarjeta: null, "lugar", "recorrido" o "ahora". Mientras hay
     tarjeta el globo no gira solo, para no llevarse lo que se esta leyendo. */
  let modo = null;
  let pasoActual = 0;
  let relojAhora = 0;

  let tam = sistema.offsetWidth;      // diametro sin zoom, en px
  let latiendo = false;
  let ultimoLatido = 0;
  let relojAuto = 0;

  /* El giro automatico arranca poco despues de cargar, no de golpe. */
  let ultimoToque = performance.now() - ESPERA_AUTO + 1500;

  /* ----------------------------------------------------------- dibujado --- */

  let ultimoEje = "";
  let ultimaVuelta = "";
  let ultimaEscala = "";
  let ultimaLon = "";
  let ultimaLat = "";

  function pintar() {
    const eje =
      "rotateZ(" + INCLINACION_AXIAL + "deg) rotateX(" + inclina.toFixed(2) + "deg)";
    if (eje !== ultimoEje) {
      for (const e of ejes) e.style.transform = eje;
      ultimoEje = eje;
    }

    const vuelta = "rotateY(" + giro.toFixed(2) + "deg)";
    if (vuelta !== ultimaVuelta) {
      for (const c of capas) c.style.transform = vuelta;
      ultimaVuelta = vuelta;
    }

    /* El zoom escala la caja entera con transform: cambiar --s obligaria a
       recalcular estilo y maquetacion de las 334 teselas en cada paso. */
    const k = zoom * encaje;
    const escala = Math.abs(k - 1) < 1e-4 ? "" : "scale(" + k.toFixed(4) + ")";
    if (escala !== ultimaEscala) {
      sistema.style.transform = escala;
      ultimaEscala = escala;
    }

    const lon = formato(normalizar(-giro), "E", "O");
    const lat = formato(-inclina, "N", "S");
    if (lon !== ultimaLon) { salidaLon.textContent = lon; ultimaLon = lon; }
    if (lat !== ultimaLat) { salidaLat.textContent = lat; ultimaLat = lat; }

    colocarMarcas(k);
  }

  function despertar() {
    if (latiendo) return;
    latiendo = true;
    ultimoLatido = performance.now();
    requestAnimationFrame(latir);
  }

  function latir(ahora) {
    const ms = limitar(ahora - ultimoLatido, 0, 50);
    const fotogramas = ms / (1000 / 60);
    ultimoLatido = ahora;
    let sigue = false;

    if (vuelo) {
      const t = limitar((ahora - vuelo.inicio) / vuelo.duracion, 0, 1);
      const e = suavizar(t);
      giro = mezclar(vuelo.desde.giro, vuelo.hasta.giro, e);
      inclina = mezclar(vuelo.desde.inclina, vuelo.hasta.inclina, e);
      /* En los vuelos largos se aleja un poco a mitad de camino, como una
         camara que toma altura para cruzar. */
      zoom = mezclar(vuelo.desde.zoom, vuelo.hasta.zoom, e) *
        (1 - vuelo.arco * Math.sin(Math.PI * t));
      if (t < 1) sigue = true;
      else vuelo = null;
    } else {
      /* Inercia: el globo sigue girando y frena solo. Sin esto el arrastre
         se siente pegajoso, como mover una imagen en vez de un objeto. */
      if (!arrastrando && Math.abs(velocidad) >= 0.02) {
        giro += velocidad * fotogramas;
        velocidad *= ROCE ** fotogramas;
        sigue = true;
      } else if (!arrastrando) {
        velocidad = 0;
      }

      if (Math.abs(zoomObjetivo - zoom) > 0.0005) {
        zoom += (zoomObjetivo - zoom) * (suave ? 1 - 0.72 ** fotogramas : 1);
        sigue = true;
      } else {
        zoom = zoomObjetivo;
      }

      /* Inactividad: el globo gira solo y, poco a poco, vuelve a su postura
         de partida, sin zoom y con el ecuador cerca del centro. Pasado un
         rato largo reaparece la pista, por si quien llega no sabe que hacer. */
      const ritmo = ritmoAutomatico(ahora);
      if (ritmo > 0) {
        giro += GIRO_AUTO * ritmo * ms;
        const vuelta = (1 - 0.985 ** fotogramas) * ritmo;
        inclina += (INICIO.inclina - inclina) * vuelta;
        zoom += (INICIO.zoom - zoom) * vuelta;
        zoomObjetivo = zoom;
        if (ahora - ultimoToque > PISTA_DE_NUEVO) document.body.classList.remove("tocado");
        sigue = true;
      }
    }

    if (Math.abs(encajeObjetivo - encaje) > 0.0005) {
      encaje += (encajeObjetivo - encaje) * (suave ? 1 - 0.8 ** fotogramas : 1);
      sigue = true;
    } else {
      encaje = encajeObjetivo;
    }

    pintar();
    if (sigue) requestAnimationFrame(latir);
    else latiendo = false;
  }

  /* 0 si no toca girar solo; hasta 1 cuando ya gira a pleno ritmo. Arranca
     en rampa durante 1,5 s para que no parezca un tiron. */
  function ritmoAutomatico(ahora) {
    if (!autoGiro || modo || arrastrando || vuelo || Math.abs(velocidad) >= 0.02) return 0;
    const quieto = ahora - ultimoToque - esperaInactividad();
    if (quieto <= 0) return 0;
    return Math.min(1, quieto / 1500);
  }

  const esperaInactividad = () => (zoomObjetivo > 1.2 ? ESPERA_CERCA : ESPERA_AUTO);

  /* Cualquier interaccion para el giro automatico y lo deja programado para
     cuando todo vuelva a estar quieto. */
  function interaccion() {
    ultimoToque = performance.now();
    document.body.classList.add("tocado");
    clearTimeout(relojAuto);
    if (autoGiro) relojAuto = setTimeout(despertar, esperaInactividad() + 50);
  }

  /* ---------------------------------------------------------- marcadores --- */

  /* Tres clases de etiqueta sobre el globo: marcadores de ciudad (punto y
     nombre), paises y estados (solo el nombre, centrado en su sitio). Todas
     pasan por colocarMarcas, que las proyecta y evita que se pisen. */

  const marcaDe = new WeakMap();      // elemento -> su marca, para los toques

  function crearMarca(m, clase) {
    const el = document.createElement("div");
    el.className = "marca" + (clase ? " " + clase : "");
    el.innerHTML = '<span class="punto"></span><span class="nombre"></span>';
    el.lastChild.textContent = m.nombre ?? "";
    el.style.visibility = "hidden";
    capaMarcas.append(el);
    marcaDe.set(el, m);
    m.el = el;
    return m;
  }

  const marcas = LUGARES.filter((l) => l.marca)
    .map((l) => crearMarca({ lugar: l, nombre: l.nombre, lat: l.lat, lon: l.lon }, ""));
  const destino = crearMarca({ lugar: null, lat: 0, lon: 0 }, "destacada");
  const sol = crearMarca({ nombre: "Sol en el cénit", lat: 0, lon: 0 }, "sol");

  /* Paises y estados se llenan al llegar geografia.js. Son cientos, asi que
     su elemento se crea la primera vez que hay que ensenarlos. */
  const etiquetasPais = [];
  const etiquetasEstado = [];

  /* Orden de prioridad cuando dos etiquetas chocan: gana la primera. El Sol
     y el lugar elegido siempre. Despues depende del nivel: de lejos mandan
     los nombres de pais sobre las ciudades marcadas ("Colombia" antes que
     "Bogotá"); de cerca, las ciudades sobre los estados. Cada grupo va de mas
     a menos importante. */
  let ordenLejos = [sol, destino, ...marcas];
  let ordenCerca = ordenLejos;

  /* Ancho de las etiquetas. Las de ciudad se miden una vez y se guardan; las
     de pais y estado, que son muchas, se calculan: la fuente es monoespaciada
     y todas sus letras miden lo mismo, asi que basta medir una muestra por
     clase. Todo hay que volver a medirlo al cargar la fuente o cambiar la
     ventana. */
  const letra = { pais: null, estado: null };

  function medirLetras() {
    for (const clase of Object.keys(letra)) {
      const muestra = crearMarca({ nombre: "M".repeat(20) }, clase);
      muestra.el.style.visibility = "hidden";
      const ancho20 = muestra.el.lastChild.offsetWidth;
      muestra.el.lastChild.textContent = "M".repeat(10);
      const ancho10 = muestra.el.lastChild.offsetWidth;
      letra[clase] = { ancho: (ancho20 - ancho10) / 10, relleno: ancho10 - (ancho20 - ancho10),
                       alto: muestra.el.lastChild.offsetHeight };
      muestra.el.remove();
    }
  }

  function olvidarMedidas() {
    for (const m of ordenCerca) m.ancho = null;
    letra.pais = letra.estado = null;
  }
  document.fonts?.ready.then(() => { olvidarMedidas(); pintar(); });

  /* Las etiquetas no viven en la malla 3D: son planas y se colocan encima
     proyectando su punto con la misma cadena de transformadas que las
     teselas. Asi el texto queda siempre derecho y legible, en vez de
     inclinarse con el eje y aplastarse hacia el borde. */
  function colocarMarcas(k) {
    const R = tam / 2;
    const d = tam * 3;                // el perspective de .globo
    const sb = Math.sin(inclina * RAD), cb = Math.cos(inclina * RAD);
    const sc = Math.sin(INCLINACION_AXIAL * RAD), cc = Math.cos(INCLINACION_AXIAL * RAD);
    const contraescala = " scale(" + (1 / k).toFixed(4) + ")";

    /* Paso de pantalla a coordenadas del globo sin zoom, y vuelta. La barra,
       el rotulo y el medidor cuentan como sitio ya ocupado, y lo que se
       saldria de la ventana no se pone: con zoom el globo desborda la
       pantalla y sus etiquetas quedarian cortadas en el borde. */
    const ox = pantalla.cx + pantalla.dx - R * k, oy = pantalla.cy + pantalla.dy - R * k;
    const aLocal = (r) => ({ x0: (r.left - ox) / k, x1: (r.right - ox) / k, y0: (r.top - oy) / k, y1: (r.bottom - oy) / k });
    const ocupado = pantalla.reservado.map(aLocal);   // cajas ya puestas, en px sin zoom
    const borde = aLocal({ left: 4, top: 4, right: innerWidth - 4, bottom: innerHeight - 4 });

    /* Niveles por zoom. Los paises se ven siempre, pero no todos: cada uno
       trae de Natural Earth el nivel de zoom de mapa web al que merece
       etiqueta, y aqui se traduce el tamano del globo a ese nivel. Sin zoom
       salen los grandes; al acercarse, los medianos y pequenos. Mas cerca
       aun, los que tienen estados ceden su sitio a ellos. Un movil, con el
       globo mas pequeno, muestra menos. */
    const z = zoom;
    const nivelWeb = Math.log2(Math.PI * tam * z / 256);
    const verPaises = verMarcas ? 1 : 0;
    const verCiudades = verMarcas ? rampa(z, CIUDADES_DESDE) : 0;
    const verEstados = verMarcas ? rampa(z, ESTADOS_DESDE) : 0;
    if ((verPaises || verEstados) && !letra.pais) medirLetras();

    for (const m of verEstados > 0.5 ? ordenCerca : ordenLejos) {
      let nivel;
      if (m === sol) nivel = modo === "ahora" ? 1 : 0;
      else if (m === destino) nivel = destino.lugar ? 1 : 0;
      else if (m.lugar === destino.lugar) nivel = 0;
      else if (m.clase === "pais") {
        nivel = m.minimo <= nivelWeb + 0.7 ? verPaises * (m.tieneEstados ? 1 - verEstados : 1) : 0;
      } else if (m.clase === "estado") nivel = verEstados;
      else nivel = verCiudades;

      let opacidad = 0;
      let x = 0, y = 0;
      if (nivel > 0) {
        const fi = (giro + m.lon) * RAD;
        const la = m.lat * RAD;
        /* rotateY(giro + lon) rotateX(lat) aplicado al punto (0, 0, 1)... */
        let px = Math.cos(la) * Math.sin(fi);
        let py = -Math.sin(la);
        let pz = Math.cos(la) * Math.cos(fi);
        /* ...luego rotateX(inclina)... */
        [py, pz] = [py * cb - pz * sb, py * sb + pz * cb];
        /* ...y rotateZ(inclinacion axial). */
        [px, py] = [px * cc - py * sc, px * sc + py * cc];

        /* Con la camara a 3 diametros, un punto de la esfera se ve cuando su
           normal cumple z > R / d = 1/6. Se desvanece al acercarse a ese
           borde para no aparecer ni desaparecer de golpe. */
        opacidad = limitar((pz - 1 / 6) / 0.12, 0, 1) * nivel;
        const f = d / (d - R * pz);
        x = R + R * px * f;
        y = R + R * py * f;
      }

      if (opacidad > 0) {
        if (!m.el) crearMarca(m, m.clase);
        let caja;
        if (m.clase) {
          /* Pais o estado: el nombre centrado en su punto. */
          const l = letra[m.clase];
          const w = (m.nombre.length * l.ancho + l.relleno) / k, h = l.alto / k;
          caja = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
        } else {
          /* Ciudad: el nombre a la derecha del punto, salvo que se salga de
             la atmosfera; entonces a la izquierda, para no cortarse en el
             borde de la pantalla. Las medidas van en px sin zoom, porque la
             marca esta contraescalada. */
          if (m.ancho == null) {
            m.ancho = m.el.lastChild.offsetWidth;
            m.alto = m.el.lastChild.offsetHeight;
          }
          const w = m.ancho / k, h = m.alto / k, r = 8 / k;
          const izquierda = x + r + w > tam * 1.04;
          if (izquierda !== m.izquierda) {
            m.el.classList.toggle("izquierda", izquierda);
            m.izquierda = izquierda;
          }
          caja = izquierda
            ? { x0: x - r - w, x1: x + r, y0: y - h / 2, y1: y + h / 2 }
            : { x0: x - r, x1: x + r + w, y0: y - h / 2, y1: y + h / 2 };
        }
        /* Si choca con una etiqueta de mas prioridad, no se pone. Tambien
           reservan sitio las que se estan desvaneciendo en el borde: si no,
           dos vecinas medio transparentes se pintarian una sobre otra. */
        const fuera = caja.x0 < borde.x0 || caja.x1 > borde.x1 || caja.y0 < borde.y0 || caja.y1 > borde.y1;
        const choca = fuera || ocupado.some((o) =>
          caja.x0 < o.x1 && o.x0 < caja.x1 && caja.y0 < o.y1 && o.y0 < caja.y1);
        if (choca) opacidad = 0;
        else ocupado.push(caja);
      }

      if (opacidad === 0) {
        if (m.visible) { m.el.style.visibility = "hidden"; m.visible = false; }
        continue;
      }
      if (!m.visible) { m.el.style.visibility = ""; m.visible = true; }
      m.el.style.opacity = opacidad.toFixed(2);
      m.el.style.transform =
        "translate(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px)" + contraescala;
    }
  }

  /* -------------------------------------------------------------- vuelos --- */

  function volarHacia(hasta) {
    hasta = {
      giro: giro + normalizar(hasta.giro - giro),   // por el camino corto
      inclina: limitar(hasta.inclina, -TOPE, TOPE),
      zoom: limitarZoom(hasta.zoom ?? zoomObjetivo),
    };
    velocidad = 0;
    zoomObjetivo = hasta.zoom;

    if (!suave) {
      vuelo = null;
      ({ giro, inclina, zoom } = hasta);
      despertar();
      return;
    }
    const tramo = distancia(-inclina, -giro, -hasta.inclina, -hasta.giro);
    vuelo = {
      desde: { giro, inclina, zoom },
      hasta,
      inicio: performance.now(),
      duracion: 650 + tramo * 6,
      arco: 0.2 * tramo / 180,
    };
    despertar();
  }

  const volarA = (lat, lon, z) => volarHacia({ giro: -lon, inclina: -lat, zoom: z });

  function irAlInicio() {
    cerrarTarjeta();
    volarHacia({ ...INICIO });
  }

  /* ------------------------------------------------------------- tarjeta --- */

  function mostrarTarjeta({ etiqueta, titulo, texto = "", coords = "", paso = null }) {
    tarjeta.etiqueta.textContent = etiqueta;
    tarjeta.titulo.textContent = titulo;
    tarjeta.texto.textContent = texto;
    tarjeta.texto.hidden = !texto;
    tarjeta.coords.textContent = coords;

    tarjeta.pasos.hidden = !paso;
    if (paso) {
      tarjeta.anterior.disabled = paso.i === 0;
      tarjeta.siguiente.textContent = paso.i === paso.n - 1 ? "Terminar" : "Siguiente";
      tarjeta.progreso.replaceChildren(...Array.from({ length: paso.n }, (_, i) => {
        const punto = document.createElement("i");
        if (i === paso.i) punto.className = "actual";
        return punto;
      }));
    }

    anuncio.textContent = titulo + ". " + texto;
    tarjeta.caja.hidden = false;
    document.body.classList.add("con-tarjeta");
    encajar();                        // cada parada mide distinto
    actualizarBotones();
  }

  /* Sale del modo en curso sin cerrar la tarjeta: lo usa quien va a poner
     otra encima. */
  function dejarModo() {
    clearInterval(relojAhora);
    modo = null;
    destino.lugar = null;
  }

  function cerrarTarjeta() {
    if (tarjeta.caja.hidden && !modo) return;
    dejarModo();
    tarjeta.caja.hidden = true;
    document.body.classList.remove("con-tarjeta");
    encajar();
    actualizarBotones();
    interaccion();
    despertar();
  }

  /* Aparta el globo del hueco que ocupa la tarjeta: a la derecha si la
     tarjeta es un panel lateral, hacia arriba si es una hoja inferior. Si en
     el hueco no cabe entero, lo encoge. */
  const hojaInferior = matchMedia("(max-width: 899px) and (orientation: portrait)");

  function encajar() {
    let dx = 0, dy = 0, k = 1;
    if (!tarjeta.caja.hidden) {
      /* offset* y no getBoundingClientRect: la tarjeta entra deslizandose
         con translate y aqui interesa donde queda, no donde empieza. */
      const caja = {
        top: tarjeta.caja.offsetTop,
        right: tarjeta.caja.offsetLeft + tarjeta.caja.offsetWidth,
      };
      /* offsetLeft y offsetTop ignoran las transformadas: dan el sitio
         natural del globo aunque ya este desplazado. */
      const cx = escena.offsetLeft + sistema.offsetLeft + tam / 2;
      const cy = escena.offsetTop + sistema.offsetTop + tam / 2;
      /* Con la atmosfera, que sobresale un 8 % por lado, y con el zoom al
         que se esta volando: los lugares se miran acercados. Si ese zoom es
         alto, el globo no cabria de todas formas y encogerlo solo le quitaria
         el acercamiento; basta con centrar el lugar en el hueco. */
      const ancho = tam * 1.16 * zoomObjetivo;
      const encoger = zoomObjetivo <= 1.35;
      if (hojaInferior.matches) {
        const arriba = barra.getBoundingClientRect().bottom + 8;
        const abajo = caja.top - 8;
        if (encoger) k = limitar((abajo - arriba) / ancho, 0.3, 1);
        dy = Math.min(0, (arriba + abajo) / 2 - cy);
      } else {
        const izquierda = caja.right + 12;
        const derecha = innerWidth - 12;
        if (encoger) k = limitar((derecha - izquierda) / ancho, 0.3, 1);
        dx = Math.max(0, (izquierda + derecha) / 2 - cx);
      }
    }
    escena.style.transform = dx || dy
      ? "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px)"
      : "";
    encajeObjetivo = k;
    medirPantalla(dx, dy);
    despertar();
  }

  /* Donde queda el globo en la ventana y que zonas tapan los controles. Se
     mide aqui, al abrir o cerrar la tarjeta y al cambiar la ventana, y no en
     cada fotograma: leer posiciones de la pagina mientras se escriben
     transformadas obliga al navegador a recalcularlo todo. */
  const pantalla = { cx: 0, cy: 0, dx: 0, dy: 0, reservado: [] };

  function medirPantalla(dx = pantalla.dx, dy = pantalla.dy) {
    pantalla.cx = escena.offsetLeft + sistema.offsetLeft + tam / 2;
    pantalla.cy = escena.offsetTop + sistema.offsetTop + tam / 2;
    pantalla.dx = dx;
    pantalla.dy = dy;
    const tapan = [...document.querySelectorAll(".rotulo, .controles")]
      .filter((el) => el.offsetWidth)
      .map((el) => el.getBoundingClientRect());
    /* El medidor va dentro de la escena, que puede estar a mitad de su
       deslizamiento: su caja se calcula en su sitio final. Con tarjeta no
       cuenta, porque se oculta. */
    const medidor = document.querySelector(".medidor");
    if (!document.body.classList.contains("con-tarjeta")) {
      const left = escena.offsetLeft + medidor.offsetLeft + dx;
      const top = escena.offsetTop + medidor.offsetTop + dy;
      tapan.push({ left, top, right: left + medidor.offsetWidth, bottom: top + medidor.offsetHeight });
    }
    pantalla.reservado = tapan.map((r) => ({ left: r.left - 6, right: r.right + 6, top: r.top - 4, bottom: r.bottom + 4 }));
  }

  tarjeta.cerrar.addEventListener("click", cerrarTarjeta);

  /* ------------------------------------------------------------- lugares --- */

  function irALugar(lugar, paso = null) {
    dejarModo();
    modo = paso ? "recorrido" : "lugar";
    destino.lugar = lugar;
    destino.lat = lugar.lat;
    destino.lon = lugar.lon;
    destino.el.lastChild.textContent = lugar.nombre;
    destino.ancho = null;

    volarA(lugar.lat, lugar.lon, lugar.zoom ?? 1.25);
    mostrarTarjeta({
      etiqueta: paso ? "Recorrido · " + (paso.i + 1) + " de " + paso.n : lugar.zona,
      titulo: lugar.nombre,
      texto: lugar.texto,
      coords: coordenadas(lugar.lat, lugar.lon),
      paso,
    });
    interaccion();
  }

  /* Acepta "19.43, -99.13", "19,43 -99,13" o "19.4 N 99.1 O". */
  function leerCoordenadas(texto) {
    const m = texto.trim().match(
      /^([-+]?\d+(?:[.,]\d+)?)\s*°?\s*([nsNS])?\s*(?:[,;]\s*|\s+)([-+]?\d+(?:[.,]\d+)?)\s*°?\s*([eowEOW])?$/
    );
    if (!m) return null;
    let lat = parseFloat(m[1].replace(",", "."));
    let lon = parseFloat(m[3].replace(",", "."));
    if (/s/i.test(m[2] || "")) lat = -Math.abs(lat);
    if (/[ow]/i.test(m[4] || "")) lon = -Math.abs(lon);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }

  /* ------------------------------------------------------------ buscador --- */

  /* Indice de busqueda: cada lugar con su nombre ya simplificado y un peso.
     A igual coincidencia gana lo mas relevante: lo escrito a mano, luego los
     paises, los estados y las ciudades segun su poblacion. */
  const indice = [];

  function indexar(lugar, peso) {
    const clave = simplificar(lugar.nombre);
    const alias = (lugar.alias || []).map(simplificar);
    indice.push({
      lugar, peso, clave, alias,
      palabras: clave.split(" "),
      todo: [clave, simplificar(lugar.zona || ""), ...alias].join(" "),
    });
  }
  for (const l of LUGARES) indexar(l, 1000);

  /* Nombre exacto, luego empieza igual, luego una de sus palabras empieza
     igual ("mexico" da "Estado de México") y por ultimo todas las palabras
     buscadas aparecen en nombre o zona ("cuernavaca morelos"). */
  function puntuar(e, q, palabras) {
    if (e.clave === q || e.alias.includes(q)) return 5000 + e.peso;
    if (e.clave.startsWith(q)) return 4000 + e.peso - e.clave.length;
    if (e.alias.some((a) => a.startsWith(q))) return 3000 + e.peso;
    if (e.palabras.some((p) => p.startsWith(q))) return 2000 + e.peso;
    if (palabras.every((p) => e.todo.includes(p))) return 1000 + e.peso;
    return 0;
  }

  function sugerir(texto, cuantas = 8) {
    const q = simplificar(texto);
    if (!q) return [];
    const palabras = q.split(" ");
    const hallados = [];
    for (const e of indice) {
      const p = puntuar(e, q, palabras);
      if (p) hallados.push([p, e.lugar]);
    }
    hallados.sort((a, b) => b[0] - a[0]);
    return hallados.slice(0, cuantas).map(([, lugar]) => lugar);
  }

  /* Lista de sugerencias propia en vez de un datalist: con miles de lugares
     el del navegador no ignora las tildes ni ordena por relevancia. Sigue el
     patron combobox de ARIA: el foco se queda en el campo y la opcion activa
     se anuncia con aria-activedescendant. */
  let sugeridas = [];
  let activa = -1;

  function mostrarSugerencias() {
    const texto = entrada.value;
    sugeridas = texto.trim() && !leerCoordenadas(texto) ? sugerir(texto) : [];
    lista.replaceChildren(...sugeridas.map((l, i) => {
      const li = document.createElement("li");
      li.id = "sugerencia-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.innerHTML = '<span class="sug-nombre"></span><span class="sug-zona"></span>';
      li.firstChild.textContent = l.nombre;
      li.lastChild.textContent = l.zona || "";
      return li;
    }));
    lista.hidden = !sugeridas.length;
    entrada.setAttribute("aria-expanded", String(!lista.hidden));
    marcarActiva(-1);
  }

  function cerrarSugerencias() {
    sugeridas = [];
    lista.hidden = true;
    entrada.setAttribute("aria-expanded", "false");
    marcarActiva(-1);
  }

  function marcarActiva(i) {
    activa = i;
    [...lista.children].forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    if (i < 0) {
      entrada.removeAttribute("aria-activedescendant");
    } else {
      entrada.setAttribute("aria-activedescendant", "sugerencia-" + i);
      lista.children[i].scrollIntoView({ block: "nearest" });
    }
  }

  function elegir(lugar) {
    entrada.value = lugar.nombre;
    cerrarSugerencias();
    aviso.textContent = "";
    irALugar(lugar);
    entrada.blur();                   // en el movil, cierra el teclado
  }

  function buscar(texto) {
    if (!simplificar(texto)) return;
    aviso.textContent = "";
    const c = leerCoordenadas(texto);
    const lugar = c
      ? { nombre: coordenadas(c.lat, c.lon), zona: "Coordenadas", lat: c.lat, lon: c.lon, zoom: 2 }
      : sugerir(texto, 1)[0];
    if (lugar) {
      elegir(lugar);
    } else {
      cerrarSugerencias();
      aviso.textContent = "No encontré «" + texto.trim() +
        "». Prueba con una ciudad, un estado, un país o unas coordenadas como 19.4, -99.1";
    }
  }

  buscador.addEventListener("submit", (e) => {
    e.preventDefault();
    buscar(entrada.value);
  });

  entrada.addEventListener("input", () => {
    aviso.textContent = "";
    mostrarSugerencias();
  });

  entrada.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (lista.hidden) mostrarSugerencias();
      if (!sugeridas.length) return;
      e.preventDefault();
      const n = sugeridas.length;
      const abajo = e.key === "ArrowDown";
      marcarActiva(activa < 0 ? (abajo ? 0 : n - 1) : (activa + (abajo ? 1 : n - 1)) % n);
    } else if (e.key === "Enter" && activa >= 0) {
      e.preventDefault();
      elegir(sugeridas[activa]);
    } else if (e.key === "Escape" && !lista.hidden) {
      e.preventDefault();             // la primera Escape solo cierra la lista
      cerrarSugerencias();
    }
  });

  entrada.addEventListener("blur", cerrarSugerencias);
  /* Pulsar una opcion no debe quitarle el foco al campo antes del clic. */
  lista.addEventListener("pointerdown", (e) => e.preventDefault());
  lista.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) elegir(sugeridas[[...lista.children].indexOf(li)]);
  });

  /* ----------------------------------------------------------- geografia --- */

  /* Paises, estados y ciudades de Natural Earth. Llegan en su propio archivo
     y despues de arrancar, para no retrasar el globo: son 180 KB. Si no
     cargara, el buscador sigue con los lugares escritos a mano. */
  function incorporar({ paises, estados, ciudades }) {
    const nombrePais = {};
    const capitalDe = new Map();      // "MEX|Cuernavaca" -> "Morelos"

    for (const [codigo, nombre, lat, lon, rango, minimo, poblacion, anio,
                capital, esPais, zoomVuelo, tieneEstados, alias] of paises) {
      nombrePais[codigo] = nombre;
      if (capital) capitalDe.set(codigo + "|" + capital, nombre);
      const partes = [];
      if (capital) partes.push("Capital: " + capital + ".");
      if (poblacion > 0) partes.push("Unos " + habitantes(poblacion) + (anio ? " (" + anio + ")" : "") + ".");
      const lugar = {
        nombre, zona: esPais ? "País" : "Territorio", lat, lon,
        zoom: zoomVuelo, alias, texto: partes.join(" "),
      };
      indexar(lugar, 900 - rango * 20);
      etiquetasPais.push({ clase: "pais", nombre, lat, lon, rango, minimo, tieneEstados: !!tieneEstados, lugar, peso: poblacion });
    }

    for (const [codigo, nombre, lat, lon, rango, tipo, capital, alias, poblacionCapital] of estados) {
      if (capital && !capitalDe.has(codigo + "|" + capital)) capitalDe.set(codigo + "|" + capital, nombre);
      const lugar = {
        nombre, zona: tipo + " · " + (nombrePais[codigo] || ""), lat, lon, zoom: 2.6, alias,
        texto: capital && capital !== nombre ? "Capital: " + capital + "." : "",
      };
      indexar(lugar, 650 - rango * 15);
      etiquetasEstado.push({ clase: "estado", nombre, lat, lon, rango, lugar, peso: poblacionCapital });
    }

    /* Lo escrito a mano manda: una ciudad que ya esta en LUGARES no se
       repite, pero le presta su estado y su poblacion si no tenia texto. */
    const escritos = LUGARES.map((l) => [simplificar(l.nombre), l]);
    for (const [codigo, nombre, lat, lon, estado, poblacion, alias] of ciudades) {
      const pais = nombrePais[codigo] || "";
      const de = capitalDe.get(codigo + "|" + nombre);
      const partes = [];
      if (de) partes.push("Capital de " + de + ".");
      if (poblacion > 0) partes.push("Unos " + habitantes(poblacion) + " en su área urbana.");
      const zona = estado ? estado + ", " + pais : pais;
      const texto = partes.join(" ");

      const clave = simplificar(nombre);
      const escrito = escritos.find(([c, l]) => c === clave && distancia(l.lat, l.lon, lat, lon) < 1.5);
      if (escrito) {
        const l = escrito[1];
        if (!l.texto) Object.assign(l, { zona, texto });
        continue;
      }
      indexar({ nombre, zona, lat, lon, zoom: 2.5, alias, texto }, 200 + 40 * Math.log10(Math.max(poblacion, 10)));
    }

    /* A igual rango, primero el mas poblado: Jalisco, con Guadalajara, antes
       que Nayarit. De los estados solo se sabe la poblacion de su capital. */
    const importancia = (a, b) => a.rango - b.rango || b.peso - a.peso;
    etiquetasPais.sort(importancia);
    etiquetasEstado.sort(importancia);
    ordenLejos = [sol, destino, ...etiquetasPais, ...marcas, ...etiquetasEstado];
    ordenCerca = [sol, destino, ...marcas, ...etiquetasPais, ...etiquetasEstado];
    pintar();
  }

  const guion = document.createElement("script");
  guion.src = "geografia.js";
  guion.onload = () => { if (window.GEOGRAFIA) incorporar(window.GEOGRAFIA); };
  document.head.append(guion);

  /* ----------------------------------------------------------- recorrido --- */

  function irAPaso(i) {
    pasoActual = limitar(i, 0, RECORRIDO.length - 1);
    irALugar(RECORRIDO[pasoActual], { i: pasoActual, n: RECORRIDO.length });
  }

  function siguientePaso() {
    if (pasoActual >= RECORRIDO.length - 1) cerrarTarjeta();
    else irAPaso(pasoActual + 1);
  }

  function pasoAnterior() {
    if (pasoActual > 0) irAPaso(pasoActual - 1);
  }

  botones.recorrido.addEventListener("click", () => {
    if (modo === "recorrido") cerrarTarjeta();
    else irAPaso(0);
  });
  tarjeta.siguiente.addEventListener("click", siguientePaso);
  tarjeta.anterior.addEventListener("click", pasoAnterior);

  /* --------------------------------------------------------------- ahora --- */

  /* Punto donde el Sol esta en el cenit en un instante dado. Formulas
     aproximadas del Almanaque Nautico: error por debajo de 0,1 grados, de
     sobra para un globo de 460 px. */
  function puntoSubsolar(fecha) {
    const n = fecha.getTime() / 86400000 - 10957.5;        // dias desde J2000.0
    const L = 280.46 + 0.9856474 * n;                       // longitud media
    const g = (357.528 + 0.9856003 * n) * RAD;              // anomalia media
    const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
    const epsilon = (23.439 - 0.0000004 * n) * RAD;         // oblicuidad
    const declinacion = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
    const ascension = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const sideral = 280.46061837 + 360.98564736629 * n;     // tiempo sideral de Greenwich
    return { lat: declinacion / RAD, lon: normalizar(ascension / RAD - sideral) };
  }

  /* Giro e inclinacion que dejan el punto (lat, lon) justo bajo la luz.
     La luz esta pintada fija en la pantalla, asi que para que el dia y la
     noche sean los de verdad hay que mover la Tierra, no el Sol.

     Hay que resolver rotZ(eje) rotX(inclina) rotY(giro + lon) rotX(lat) z = LUZ.
     Deshecha la inclinacion axial queda u = rotX(inclina) w, y como rotX no
     toca la x, la componente x de w ya fija giro + lon. Lo que falta es el
     angulo que lleva (w.y, w.z) a (u.y, u.z). */
  function orientarHaciaLuz(lat, lon) {
    const c = -INCLINACION_AXIAL * RAD;
    const ux = LUZ[0] * Math.cos(c) - LUZ[1] * Math.sin(c);
    const uy = LUZ[0] * Math.sin(c) + LUZ[1] * Math.cos(c);
    const uz = LUZ[2];
    const fi = Math.asin(limitar(ux / Math.cos(lat * RAD), -1, 1));
    const wy = -Math.sin(lat * RAD);
    const wz = Math.cos(lat * RAD) * Math.cos(fi);
    const inc = Math.atan2(uz, uy) - Math.atan2(wz, wy);
    return { giro: fi / RAD - lon, inclina: normalizar(inc / RAD) };
  }

  function seguirAlSol(volando) {
    const ahora = new Date();
    const p = puntoSubsolar(ahora);
    sol.lat = p.lat;
    sol.lon = p.lon;

    const hacia = orientarHaciaLuz(p.lat, p.lon);
    if (volando) {
      volarHacia({ ...hacia, zoom: zoomObjetivo });
    } else if (!vuelo) {
      giro += normalizar(hacia.giro - giro);
      inclina = hacia.inclina;
      despertar();
    }

    const hora = ahora.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    if (volando) {
      mostrarTarjeta({
        etiqueta: "Ahora · " + hora,
        titulo: "Día y noche en este momento",
        texto: "La luz del globo cae ahora desde donde está el Sol de verdad: la cara iluminada es donde es de día y en la sombra se encienden las ciudades. Si giras el globo, la luz deja de coincidir.",
        coords: "Sol en el cénit · " + coordenadas(p.lat, p.lon),
      });
    } else {
      /* Actualizacion periodica: sin volver a anunciar la tarjeta. */
      tarjeta.etiqueta.textContent = "Ahora · " + hora;
      tarjeta.coords.textContent = "Sol en el cénit · " + coordenadas(p.lat, p.lon);
    }
  }

  function activarAhora() {
    dejarModo();
    modo = "ahora";
    seguirAlSol(true);
    /* La Tierra gira un cuarto de grado por minuto: basta con retocar la
       vista cada medio minuto. */
    relojAhora = setInterval(() => seguirAlSol(false), 30000);
    interaccion();
  }

  botones.ahora.addEventListener("click", () => {
    if (modo === "ahora") cerrarTarjeta();
    else activarAhora();
  });

  /* ----------------------------------------------------- resto de botones --- */

  function actualizarBotones() {
    botones.recorrido.setAttribute("aria-pressed", String(modo === "recorrido"));
    botones.ahora.setAttribute("aria-pressed", String(modo === "ahora"));
    botones.giro.setAttribute("aria-pressed", String(autoGiro));
    botones.marcas.setAttribute("aria-pressed", String(verMarcas));
    botones.pantalla.setAttribute("aria-pressed", String(!!enPantallaCompleta()));
  }

  botones.giro.addEventListener("click", () => {
    autoGiro = !autoGiro;
    guardarPreferencias();
    actualizarBotones();
    clearTimeout(relojAuto);
    if (autoGiro) {
      ultimoToque = performance.now() - ESPERA_AUTO;   // que arranque ya
      despertar();
    }
  });

  botones.marcas.addEventListener("click", () => {
    verMarcas = !verMarcas;
    guardarPreferencias();
    actualizarBotones();
    pintar();
  });

  botones.inicio.addEventListener("click", irAlInicio);

  const enPantallaCompleta = () =>
    document.fullscreenElement || document.webkitFullscreenElement;

  function alternarPantalla() {
    const peticion = enPantallaCompleta()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (raiz.requestFullscreen || raiz.webkitRequestFullscreen).call(raiz);
    Promise.resolve(peticion).catch(() => {});
  }

  /* El iPhone no deja poner una pagina a pantalla completa: ahi el boton
     sobra. */
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    botones.pantalla.hidden = true;
  }
  botones.pantalla.addEventListener("click", alternarPantalla);
  document.addEventListener("fullscreenchange", actualizarBotones);
  document.addEventListener("webkitfullscreenchange", actualizarBotones);

  /* ------------------------------------------------------------ arrastre --- */

  const punteros = new Map();         // pointerId -> { x, y }
  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let ultimoMovimiento = 0;
  let gesto = null;                   // { x, y, movido }: para distinguir toque de arrastre
  let ultimoTap = null;
  let pellizco = null;                // { separacion, zoom }

  const separacion = () => {
    const [a, b] = punteros.values();
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  sistema.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    sistema.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    /* Agarrar el globo lo detiene donde este. Salvo en "Ahora": ahi el
       vuelo es la alineacion con el Sol y se completa de golpe. */
    if (vuelo && modo === "ahora") ({ giro, inclina } = vuelo.hasta);
    vuelo = null;
    velocidad = 0;
    interaccion();

    if (punteros.size === 1) {
      arrastrando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      /* Sobre un marcador tambien se puede arrastrar: en el movil las
         etiquetas ocupan mucho globo. Solo si se suelta sin moverse cuenta
         como pulsar el marcador. */
      const marca = marcaDe.get(e.target.closest(".marca"));
      gesto = {
        x: e.clientX, y: e.clientY, movido: false,
        marca: marca?.lugar && marca !== destino ? marca : null,
      };
      sistema.classList.add("agarrado");
    } else if (punteros.size === 2) {
      /* Dos dedos: pellizco. El giro se congela mientras dura. */
      pellizco = { separacion: separacion(), zoom: zoomObjetivo };
      gesto = null;
    }
  });

  sistema.addEventListener("pointermove", (e) => {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pellizco) {
      if (punteros.size >= 2) {
        zoom = zoomObjetivo = limitarZoom(pellizco.zoom * separacion() / pellizco.separacion);
        interaccion();
        despertar();
      }
      return;
    }
    if (!arrastrando) return;

    const dx = e.clientX - ultimoX;
    const dy = e.clientY - ultimoY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    ultimoMovimiento = e.timeStamp;

    if (gesto && !gesto.movido &&
        Math.hypot(e.clientX - gesto.x, e.clientY - gesto.y) > 6) {
      gesto.movido = true;
      /* Girar a mano deshace la alineacion con el Sol. */
      if (modo === "ahora") cerrarTarjeta();
    }

    /* Con zoom, el mismo gesto recorre menos globo: asi el punto agarrado
       sigue bajo el dedo. */
    const escala = 1 / (zoom * encaje);
    giro += dx * POR_PIXEL_X * escala;
    velocidad = dx * POR_PIXEL_X * escala;

    /* Al tirar hacia abajo el frente del globo baja y asoma el polo
       norte, que es lo que espera la mano. En rotateX eso es restar. */
    inclina = limitar(inclina - dy * POR_PIXEL_Y * escala, -TOPE, TOPE);
    interaccion();
    despertar();
  });

  const soltar = (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.delete(e.pointerId);
    if (sistema.hasPointerCapture(e.pointerId)) sistema.releasePointerCapture(e.pointerId);

    if (punteros.size === 1) {
      /* De dos dedos a uno: el que queda sigue arrastrando desde donde esta,
         sin salto. */
      const [queda] = punteros.values();
      ultimoX = queda.x;
      ultimoY = queda.y;
      pellizco = null;
      velocidad = 0;
      gesto = { x: queda.x, y: queda.y, movido: true };
      return;
    }
    if (punteros.size > 0) return;

    arrastrando = false;
    pellizco = null;
    sistema.classList.remove("agarrado");

    /* Si la mano se paro antes de soltar, no hay lanzamiento. */
    if (!suave || e.timeStamp - ultimoMovimiento > 90) velocidad = 0;

    /* Toque sin arrastrar: sobre un marcador, ir a su lugar; si es el
       segundo toque seguido, vuelta a la vista inicial. */
    if (e.type === "pointerup" && gesto && !gesto.movido) {
      const tap = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (gesto.marca) {
        ultimoTap = null;
        irALugar(gesto.marca.lugar);
      } else if (ultimoTap && tap.t - ultimoTap.t < 350 &&
          Math.hypot(tap.x - ultimoTap.x, tap.y - ultimoTap.y) < 30) {
        ultimoTap = null;
        irAlInicio();
      } else {
        ultimoTap = tap;
      }
    }
    gesto = null;
    interaccion();
    despertar();
  };
  sistema.addEventListener("pointerup", soltar);
  sistema.addEventListener("pointercancel", soltar);

  /* Rueda del raton, y el pellizco del trackpad, que llega como rueda con
     ctrlKey. Se escucha en toda la escena, no solo sobre el globo. */
  escena.addEventListener("wheel", (e) => {
    e.preventDefault();
    const pixeles = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    acercar(Math.exp(-pixeles * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  /* El zoom no corta un vuelo en marcha: solo le cambia el destino. */
  function acercar(factor) {
    zoomObjetivo = limitarZoom(zoomObjetivo * factor);
    if (vuelo) vuelo.hasta.zoom = zoomObjetivo;
    interaccion();
    despertar();
  }

  /* ------------------------------------------------------------- teclado --- */

  /* Flechas: el globo es un control, no una imagen, y tiene que poder
     manejarse sin raton. Misma convencion que el arrastre, o sea agarrar el
     objeto y no mover la camara. */
  sistema.addEventListener("keydown", (e) => {
    const paso = e.shiftKey ? 15 : 5;

    switch (e.key) {
      case "ArrowLeft": giro -= paso; break;
      case "ArrowRight": giro += paso; break;
      case "ArrowUp": inclina = Math.min(TOPE, inclina + paso); break;
      case "ArrowDown": inclina = Math.max(-TOPE, inclina - paso); break;
      case "+": case "=": e.preventDefault(); acercar(1.25); return;
      case "-": case "_": e.preventDefault(); acercar(1 / 1.25); return;
      case "Home": e.preventDefault(); irAlInicio(); return;
      default: return;
    }

    e.preventDefault();
    if (modo === "ahora") cerrarTarjeta();
    velocidad = 0;
    vuelo = null;
    interaccion();
    despertar();
  });

  /* Atajos de toda la pagina. Las flechas y Av Pag / Re Pag pasan las
     paradas del recorrido, que es lo que mandan los mandos de presentacion. */
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const escribiendo = e.target.closest?.("input, textarea, select");

    if (e.key === "Escape") {
      if (escribiendo && entrada.value) return;  // el buscador se vacia solo
      if (modo) {
        e.preventDefault();
        cerrarTarjeta();
      }
      return;
    }
    if (escribiendo) return;

    if ((e.key === "f" || e.key === "F") && !botones.pantalla.hidden) {
      e.preventDefault();
      alternarPantalla();
    } else if (modo === "recorrido") {
      const enGlobo = e.target === sistema;
      if (e.key === "PageDown" || (!enGlobo && e.key === "ArrowRight")) {
        e.preventDefault();
        siguientePaso();
      } else if (e.key === "PageUp" || (!enGlobo && e.key === "ArrowLeft")) {
        e.preventDefault();
        pasoAnterior();
      }
    }
  });

  /* ------------------------------------------------------------- arranque --- */

  addEventListener("resize", () => {
    tam = sistema.offsetWidth;
    olvidarMedidas();
    encajar();
    pintar();
  });
  document.fonts?.ready.then(() => medirPantalla());

  /* La superficie aparece de una vez cuando sus texturas estan listas. El
     navegador las pide por el CSS; estas copias solo esperan a que esten
     decodificadas, y salen de la misma cache. */
  const texturas = [...document.querySelectorAll(".tesela")]
    .map((t) => getComputedStyle(t).backgroundImage.slice(5, -2));
  Promise.allSettled(texturas.map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode();
  })).then(() => raiz.classList.remove("cargando"));

  actualizarBotones();
  medirPantalla();
  pintar();
  if (autoGiro) relojAuto = setTimeout(despertar, 1600);
})();
