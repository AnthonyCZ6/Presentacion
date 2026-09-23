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

  /* Lugares del buscador. Los que llevan marca: true salen como marcadores,
     elegidos para que sus etiquetas no se pisen. zoom es el acercamiento al
     volar hasta ahi; los paises, que son grandes, se miran de mas lejos. */
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

    { nombre: "México", zona: "País", lat: 23.63, lon: -102.55 },
    { nombre: "Estados Unidos", zona: "País", lat: 39.83, lon: -98.58, alias: ["eeuu", "ee uu", "usa"] },
    { nombre: "Canadá", zona: "País", lat: 56.13, lon: -106.35, zoom: 1 },
    { nombre: "Guatemala", zona: "País", lat: 15.78, lon: -90.23 },
    { nombre: "Cuba", zona: "País", lat: 21.52, lon: -77.78 },
    { nombre: "Colombia", zona: "País", lat: 4.57, lon: -74.3 },
    { nombre: "Venezuela", zona: "País", lat: 6.42, lon: -66.59 },
    { nombre: "Perú", zona: "País", lat: -9.19, lon: -75.02 },
    { nombre: "Brasil", zona: "País", lat: -14.24, lon: -51.93, zoom: 1 },
    { nombre: "Argentina", zona: "País", lat: -38.42, lon: -63.62 },
    { nombre: "Chile", zona: "País", lat: -35.68, lon: -71.54 },
    { nombre: "España", zona: "País", lat: 40.46, lon: -3.75 },
    { nombre: "Francia", zona: "País", lat: 46.23, lon: 2.21 },
    { nombre: "Alemania", zona: "País", lat: 51.17, lon: 10.45 },
    { nombre: "Italia", zona: "País", lat: 41.87, lon: 12.57 },
    { nombre: "Reino Unido", zona: "País", lat: 55.38, lon: -3.44 },
    { nombre: "Rusia", zona: "País", lat: 61.52, lon: 105.32, zoom: 1 },
    { nombre: "China", zona: "País", lat: 35.86, lon: 104.2, zoom: 1 },
    { nombre: "India", zona: "País", lat: 20.59, lon: 78.96 },
    { nombre: "Japón", zona: "País", lat: 36.2, lon: 138.25 },
    { nombre: "Australia", zona: "País", lat: -25.27, lon: 133.78, zoom: 1 },
    { nombre: "Egipto", zona: "País", lat: 26.82, lon: 30.8 },
    { nombre: "Nigeria", zona: "País", lat: 9.08, lon: 8.68 },
    { nombre: "Sudáfrica", zona: "País", lat: -30.56, lon: 22.94 },
    { nombre: "Kenia", zona: "País", lat: -0.02, lon: 37.91 },
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
     tesela ocupa unos 48 en pantalla: a 1,5 ya se estiran casi al limite. */
  const ZOOM_MIN = 0.8;
  const ZOOM_MAX = 1.5;

  const GIRO_AUTO = 0.005;            // grados por ms: una vuelta cada 72 s
  const ESPERA_AUTO = 6000;           // ms sin tocar nada antes de volver a girar solo

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
  const opciones = document.getElementById("lugares");
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

  const preferencias = (() => {
    try { return JSON.parse(localStorage.getItem("mapa-mundi")) || {}; } catch { return {}; }
  })();
  function guardarPreferencias() {
    try {
      localStorage.setItem("mapa-mundi", JSON.stringify({ autoGiro, verMarcas }));
    } catch { /* sin almacenamiento: se vuelve a lo de siempre en la proxima visita */ }
  }

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

  let autoGiro = preferencias.autoGiro ?? suave;
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

      const ritmo = ritmoAutomatico(ahora);
      if (ritmo > 0) {
        giro += GIRO_AUTO * ritmo * ms;
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
    const quieto = ahora - ultimoToque - ESPERA_AUTO;
    if (quieto <= 0) return 0;
    return Math.min(1, quieto / 1500);
  }

  /* Cualquier interaccion para el giro automatico y lo deja programado para
     cuando todo vuelva a estar quieto. */
  function interaccion() {
    ultimoToque = performance.now();
    document.body.classList.add("tocado");
    clearTimeout(relojAuto);
    if (autoGiro) relojAuto = setTimeout(despertar, ESPERA_AUTO + 50);
  }

  /* ---------------------------------------------------------- marcadores --- */

  function crearMarca(clase, nombre) {
    const el = document.createElement("div");
    el.className = "marca" + (clase ? " " + clase : "");
    el.innerHTML = '<span class="punto"></span><span class="nombre"></span>';
    el.lastChild.textContent = nombre;
    el.style.visibility = "hidden";
    capaMarcas.append(el);
    return el;
  }

  const marcas = LUGARES.filter((l) => l.marca)
    .map((l) => ({ lugar: l, lat: l.lat, lon: l.lon, el: crearMarca("", l.nombre) }));
  const destino = { lugar: null, lat: 0, lon: 0, el: crearMarca("destacada", "") };
  const sol = { lat: 0, lon: 0, el: crearMarca("sol", "Sol en el cénit") };

  /* Orden de prioridad cuando dos etiquetas chocan: gana la primera. El Sol
     y el lugar elegido siempre; despues, el orden de LUGARES. */
  const todasLasMarcas = [sol, destino, ...marcas];

  /* El ancho de cada etiqueta se mide una vez y se guarda; hay que volver a
     medir cuando carga la fuente, cambia el texto o cambia la ventana. */
  const olvidarMedidas = () => { for (const m of todasLasMarcas) m.ancho = null; };
  document.fonts?.ready.then(() => { olvidarMedidas(); pintar(); });

  /* Los marcadores no viven en la malla 3D: son etiquetas planas que se
     colocan encima proyectando su punto con la misma cadena de transformadas
     que las teselas. Asi el texto queda siempre derecho y legible, en vez de
     inclinarse con el eje y aplastarse hacia el borde. */
  function colocarMarcas(k) {
    const R = tam / 2;
    const d = tam * 3;                // el perspective de .globo
    const sb = Math.sin(inclina * RAD), cb = Math.cos(inclina * RAD);
    const sc = Math.sin(INCLINACION_AXIAL * RAD), cc = Math.cos(INCLINACION_AXIAL * RAD);
    const contraescala = " scale(" + (1 / k).toFixed(4) + ")";
    const ocupado = [];               // cajas ya puestas, en px sin zoom

    for (const m of todasLasMarcas) {
      const activa =
        m === sol ? modo === "ahora" :
        m === destino ? destino.lugar !== null :
        verMarcas && m.lugar !== destino.lugar;

      let opacidad = 0;
      let x = 0, y = 0;
      if (activa) {
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
        opacidad = limitar((pz - 1 / 6) / 0.12, 0, 1);
        const f = d / (d - R * pz);
        x = R + R * px * f;
        y = R + R * py * f;
      }

      if (opacidad > 0) {
        /* La etiqueta va a la derecha del punto, salvo que se salga de la
           atmosfera: entonces a la izquierda, para no cortarse en el borde
           de la pantalla. Las medidas van en px sin zoom, porque la marca
           esta contraescalada. */
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
        /* Si choca con una etiqueta de mas prioridad, no se pone. Las que
           se estan desvaneciendo en el borde no reservan sitio. */
        const caja = izquierda
          ? { x0: x - r - w, x1: x + r, y0: y - h / 2, y1: y + h / 2 }
          : { x0: x - r, x1: x + r + w, y0: y - h / 2, y1: y + h / 2 };
        const choca = ocupado.some((o) =>
          caja.x0 < o.x1 && o.x0 < caja.x1 && caja.y0 < o.y1 && o.y0 < caja.y1);
        if (choca) opacidad = 0;
        else if (opacidad > 0.5) ocupado.push(caja);
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
         que se esta volando: los lugares se miran acercados. */
      const ancho = tam * 1.16 * zoomObjetivo;
      if (hojaInferior.matches) {
        const arriba = barra.getBoundingClientRect().bottom + 8;
        const abajo = caja.top - 8;
        k = limitar((abajo - arriba) / ancho, 0.3, 1);
        dy = Math.min(0, (arriba + abajo) / 2 - cy);
      } else {
        const izquierda = caja.right + 12;
        const derecha = innerWidth - 12;
        k = limitar((derecha - izquierda) / ancho, 0.3, 1);
        dx = Math.max(0, (izquierda + derecha) / 2 - cx);
      }
    }
    escena.style.transform = dx || dy
      ? "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px)"
      : "";
    encajeObjetivo = k;
    despertar();
  }

  tarjeta.cerrar.addEventListener("click", cerrarTarjeta);

  /* ------------------------------------------------------------- lugares --- */

  const etiquetaDe = (l) => (l.zona === "País" ? l.nombre : l.nombre + ", " + l.zona);

  function irALugar(lugar, paso = null) {
    dejarModo();
    modo = paso ? "recorrido" : "lugar";
    destino.lugar = lugar;
    destino.lat = lugar.lat;
    destino.lon = lugar.lon;
    destino.el.lastChild.textContent = lugar.nombre;
    destino.ancho = null;

    volarA(lugar.lat, lugar.lon, lugar.zoom ?? (lugar.zona === "País" ? 1.05 : 1.25));
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

  function buscar(texto) {
    const q = simplificar(texto);
    if (!q) return;
    aviso.textContent = "";

    const c = leerCoordenadas(texto);
    const lugar = c
      ? { nombre: coordenadas(c.lat, c.lon), zona: "Coordenadas", lat: c.lat, lon: c.lon }
      : LUGARES.find((l) =>
          simplificar(etiquetaDe(l)) === q || simplificar(l.nombre) === q || l.alias?.includes(q)) ||
        LUGARES.find((l) => simplificar(l.nombre).startsWith(q)) ||
        LUGARES.find((l) => simplificar(etiquetaDe(l)).includes(q));

    if (lugar) {
      irALugar(lugar);
      entrada.blur();                 // en el movil, cierra el teclado
    } else {
      aviso.textContent = "No encontré «" + texto.trim() +
        "». Prueba con una ciudad, un país o unas coordenadas como 19.4, -99.1";
    }
  }

  for (const l of LUGARES) {
    const o = document.createElement("option");
    o.value = etiquetaDe(l);
    opciones.append(o);
  }

  buscador.addEventListener("submit", (e) => {
    e.preventDefault();
    buscar(entrada.value);
  });

  /* Elegir una sugerencia de la lista ya es la busqueda: no hace falta
     pulsar Intro. Escribir letra a letra no dispara nada. */
  entrada.addEventListener("input", (e) => {
    aviso.textContent = "";
    if (e.inputType && e.inputType !== "insertReplacementText") return;
    const elegida = [...opciones.options].some((o) => o.value === entrada.value);
    if (elegida) buscar(entrada.value);
  });

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
      const el = e.target.closest(".marca");
      gesto = {
        x: e.clientX, y: e.clientY, movido: false,
        marca: marcas.find((m) => m.el === el) ?? null,
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
      case "+": case "=": e.preventDefault(); acercar(1.15); return;
      case "-": case "_": e.preventDefault(); acercar(1 / 1.15); return;
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
  pintar();
  if (autoGiro) relojAuto = setTimeout(despertar, 1600);
})();
