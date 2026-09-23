"""Genera geografia.js: paises, estados y ciudades para el buscador y las
etiquetas del globo, a partir de Natural Earth (dominio publico).

    python herramientas/geografia.py [carpeta-de-descargas]

Descarga los tres GeoJSON que necesita (unos 35 MB) si no estan ya en la
carpeta, y escribe geografia.js en la raiz del proyecto.
"""

import json
import math
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESCARGAS = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / ".natural-earth"
FUENTE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"

# Paises cuyos estados, provincias o regiones se muestran y se buscan. El
# resto del mundo queda a nivel de pais: sus divisiones en Natural Earth son
# demasiado finas (distritos, condados) para un globo de este tamano.
CON_ESTADOS = set("""
    MEX USA CAN GTM HND SLV NIC CRI PAN CUB DOM
    COL VEN ECU PER BOL CHL ARG URY PRY BRA
    ESP ITA FRA GBR DEU RUS CHN IND JPN AUS ZAF
""".split())

HISPANOS = set("MEX GTM HND SLV NIC CRI PAN CUB DOM COL VEN ECU PER BOL CHL ARG URY PRY ESP".split())

# En estos paises el primer nivel de Natural Earth son provincias o
# departamentos: se agrupan en sus regiones.
AGRUPAR = {"ESP": "region", "ITA": "region", "FRA": "region"}

NOMBRES_REGION = {
    # Espana: comunidades y ciudades autonomas
    "Canary Is.": "Canarias", "Foral de Navarra": "Navarra",
    "Valenciana": "Comunidad Valenciana", "Madrid": "Comunidad de Madrid",
    "Murcia": "Región de Murcia",
    # Italia
    "Abruzzo": "Abruzos", "Emilia-Romagna": "Emilia-Romaña",
    "Friuli-Venezia Giulia": "Friuli-Venecia Julia", "Lazio": "Lacio",
    "Lombardia": "Lombardía", "Marche": "Marcas", "Piemonte": "Piamonte",
    "Sardegna": "Cerdeña", "Sicily": "Sicilia", "Trentino-Alto Adige": "Trentino-Alto Adigio",
    "Umbria": "Umbría", "Valle d'Aosta": "Valle de Aosta", "Veneto": "Véneto",
    # Francia
    "Auvergne-Rhône-Alpes": "Auvernia-Ródano-Alpes", "Bourgogne-Franche-Comté": "Borgoña-Franco Condado",
    "Bretagne": "Bretaña", "Centre-Val de Loire": "Centro-Valle de Loira", "Corse": "Córcega",
    "Grand Est": "Gran Este", "Guadeloupe": "Guadalupe", "Guyane française": "Guayana Francesa",
    "Hauts-de-France": "Alta Francia", "Martinique": "Martinica", "Normandie": "Normandía",
    "Nouvelle-Aquitaine": "Nueva Aquitania", "Occitanie": "Occitania",
    "Pays de la Loire": "País del Loira", "Provence-Alpes-Côte-d'Azur": "Provenza-Alpes-Costa Azul",
    "Réunion": "Reunión", "Île-de-France": "Isla de Francia",
}

# Reino Unido: sus 232 autoridades locales se reducen a las cuatro naciones.
# El promedio de sus puntos caeria cerca de Londres, asi que van a mano.
NACIONES_GBR = [
    ("Inglaterra", 52.6, -1.5), ("Escocia", 56.8, -4.2),
    ("Gales", 52.3, -3.7), ("Irlanda del Norte", 54.6, -6.7),
]

# (pais, nombre en Natural Earth) -> nombre a mostrar
NOMBRES_ESTADO = {
    ("MEX", "Distrito Federal"): "Ciudad de México",
    ("MEX", "México"): "Estado de México",
    ("MEX", "Coahuila"): "Coahuila",
}

TIPOS = {
    "State": "Estado", "Province": "Provincia", "Department": "Departamento",
    "Region": "Región", "Autonomous Region": "Región autónoma", "Republic": "República",
    "Territory": "Territorio", "Union Territory": "Territorio", "Federal District": "Distrito federal",
    "Capital District": "Distrito capital", "Captial District": "Distrito capital",
    "Prefecture": "Prefectura", "Metropolis": "Prefectura", "Urban Prefecture": "Prefectura",
    "Autonomous Community": "Comunidad autónoma", "Autonomous City": "Ciudad autónoma",
    "Municipality": "Municipio", "Special Municipality": "Municipio especial",
    "Commissiary": "Departamento", "Intendancy": "Departamento",
    "National District": "Distrito nacional", "Federal Dependency": "Dependencias federales",
    "Autonomous Okrug": "Distrito autónomo", "Autonomous Oblast": "Óblast autónomo",
    "Indigenous Territory": "Comarca indígena",
}

# Territorios en disputa: no se asignan a ningun pais.
EXCLUIR_ESTADOS = {("RUS", "Crimea"), ("RUS", "Sevastopol")}

# Nombres de pais que Natural Earth da en forma oficial y no en la de uso.
NOMBRES_PAIS = {"TWN": "Taiwán"}

ALIAS_PAIS = {
    "USA": ["eeuu", "ee uu", "usa", "estados unidos de america"],
    "GBR": ["uk", "gran bretana"],
}


def descargar(nombre):
    ruta = DESCARGAS / f"{nombre}.geojson"
    if not ruta.exists():
        DESCARGAS.mkdir(parents=True, exist_ok=True)
        print("descargando", nombre)
        urllib.request.urlretrieve(FUENTE + ruta.name, ruta)
    return json.loads(ruta.read_text(encoding="utf-8"))["features"]


def r2(v):
    return round(v, 2)


def extension(geometria):
    """Tamano en grados del mayor poligono del pais, para decidir el zoom."""
    poligonos = geometria["coordinates"] if geometria["type"] == "MultiPolygon" else [geometria["coordinates"]]
    mayor = max(poligonos, key=lambda p: len(p[0]))
    lons = [c[0] for c in mayor[0]]
    lats = [c[1] for c in mayor[0]]
    lat_media = (max(lats) + min(lats)) / 2
    return max(max(lats) - min(lats), (max(lons) - min(lons)) * math.cos(math.radians(lat_media)))


def main():
    paises_ne = descargar("ne_50m_admin_0_countries")
    estados_ne = [f["properties"] for f in descargar("ne_10m_admin_1_label_points_details")]
    ciudades_ne = [f["properties"] for f in descargar("ne_10m_populated_places")]

    # Capitales, por pais y por estado
    capital_pais, capital_estado = {}, {}
    for c in ciudades_ne:
        if c["FEATURECLA"] == "Admin-0 capital":
            capital_pais.setdefault(c["ADM0_A3"], c)
        if c["FEATURECLA"] in ("Admin-1 capital", "Admin-0 capital"):
            capital_estado.setdefault((c["ADM0_A3"], c["ADM1NAME"]), c)

    def nombre_ciudad(c):
        """El nombre en espanol, salvo que solo alargue el comun: "Puebla de
        Zaragoza" se queda en "Puebla". En los paises hispanohablantes manda
        el nombre local, que es el de uso ("Durango", no "Victoria de
        Durango"), menos cuando Natural Earth lo da en ingles ("Mexico City")."""
        comun, es = c["NAME"], c.get("NAME_ES") or c["NAME"]
        if c["ADM0_A3"] in HISPANOS and not comun.endswith(" City"):
            return comun
        return comun if es != comun and es.startswith(comun) else es

    # ---------------------------------------------------------- paises ---
    paises = []
    for f in paises_ne:
        p = f["properties"]
        codigo = p["ADM0_A3"]
        nombre = NOMBRES_PAIS.get(codigo, p["NAME_ES"])
        alias = {p["NAME"], p["NAME_EN"], p["NAME_LONG"], p["NAME_ES"]} - {nombre}
        alias = [a for a in alias if a] + ALIAS_PAIS.get(codigo, [])
        capital = capital_pais.get(codigo)
        zoom = min(2.6, max(1.0, 55 / max(extension(f["geometry"]), 1)))
        paises.append([
            codigo, nombre, r2(p["LABEL_Y"]), r2(p["LABEL_X"]),
            p["LABELRANK"], round(p["MIN_LABEL"], 1),
            p["POP_EST"], p["POP_YEAR"],
            nombre_ciudad(capital) if capital else "",
            1 if p["TYPE"] in ("Sovereign country", "Country") else 0,
            round(zoom, 2), 1 if codigo in CON_ESTADOS else 0, alias,
        ])
    nombres_pais = {p[0]: p[1] for p in paises}

    # --------------------------------------------------------- estados ---
    estados = []
    grupos = defaultdict(list)
    estado_mostrado = {}              # (pais, nombre en Natural Earth) -> nombre mostrado
    naciones = {"England": "Inglaterra", "Scotland": "Escocia", "Wales": "Gales",
                "Northern Ireland": "Irlanda del Norte"}
    for e in estados_ne:
        codigo = e.get("adm0_a3")
        if codigo not in CON_ESTADOS or not e.get("name") or (codigo, e["name"]) in EXCLUIR_ESTADOS:
            continue
        if codigo == "GBR":
            estado_mostrado[(codigo, e["name"])] = naciones.get(e["geonunit"], "")
            continue
        if codigo in AGRUPAR:
            region = e[AGRUPAR[codigo]]
            grupos[(codigo, region)].append(e)
            estado_mostrado[(codigo, e["name"])] = NOMBRES_REGION.get(region, region)
            continue
        nombre = NOMBRES_ESTADO.get((codigo, e["name"]))
        if not nombre:
            nombre = e["name"] if codigo in HISPANOS else (e.get("name_es") or e["name"])
            if codigo not in HISPANOS and nombre.startswith("Estado de "):
                nombre = nombre[len("Estado de "):]
        capital = capital_estado.get((codigo, e["name"]))
        tipo = "Entidad federativa" if nombre == "Ciudad de México" else TIPOS.get(e.get("type_en"), "Región")
        alias = [a for a in {e["name"], e.get("name_es") or ""} if a and a != nombre]
        estados.append([codigo, nombre, r2(e["latitude"]), r2(e["longitude"]), e["labelrank"],
                        tipo, nombre_ciudad(capital) if capital else "", alias,
                        capital["POP_MAX"] if capital else 0])
        estado_mostrado[(codigo, e["name"])] = nombre

    for (codigo, region), miembros in grupos.items():
        nombre = NOMBRES_REGION.get(region, region)
        tipo = {"ESP": "Comunidad autónoma", "ITA": "Región", "FRA": "Región"}[codigo]
        if nombre in ("Ceuta", "Melilla"):
            tipo = "Ciudad autónoma"
        lat = sum(m["latitude"] for m in miembros) / len(miembros)
        lon = sum(m["longitude"] for m in miembros) / len(miembros)
        estados.append([codigo, nombre, r2(lat), r2(lon), min(m["labelrank"] for m in miembros),
                        tipo, "", [region] if region != nombre else [], 0])

    for nombre, lat, lon in NACIONES_GBR:
        estados.append(["GBR", nombre, lat, lon, 3, "Nación", "", [], 0])

    # --------------------------------------------------------- ciudades ---
    ciudades, vistas = [], set()
    for c in sorted(ciudades_ne, key=lambda c: -c["POP_MAX"]):
        codigo = c["ADM0_A3"]
        entra = (
            c["FEATURECLA"].startswith("Admin-0 capital")
            or (c["FEATURECLA"] == "Admin-1 capital" and codigo in CON_ESTADOS)
            or c["POP_MAX"] >= 300_000
            or codigo == "MEX"
        )
        if not entra or codigo not in nombres_pais:
            continue
        nombre = nombre_ciudad(c)
        if (codigo, nombre) in vistas:
            continue
        vistas.add((codigo, nombre))
        estado = estado_mostrado.get((codigo, c["ADM1NAME"]), "") if codigo in CON_ESTADOS else ""
        alias = [a for a in {c["NAME"], c.get("NAME_ES") or "", c["NAMEASCII"]} if a and a != nombre]
        ciudades.append([codigo, nombre, r2(c["LATITUDE"]), r2(c["LONGITUDE"]), estado, c["POP_MAX"], alias])

    salida = RAIZ / "geografia.js"
    datos = json.dumps({"paises": paises, "estados": estados, "ciudades": ciudades},
                       ensure_ascii=False, separators=(",", ":"))
    salida.write_text(
        "/* Generado por herramientas/geografia.py a partir de Natural Earth\n"
        "   (naturalearthdata.com, dominio publico). No editar a mano.\n\n"
        "   paises:   [codigo, nombre, lat, lon, rango, zoomEtiqueta, poblacion, anio,\n"
        "              capital, esPais, zoomVuelo, tieneEstados, alias]\n"
        "   estados:  [pais, nombre, lat, lon, rango, tipo, capital, alias, poblacionCapital]\n"
        "   ciudades: [pais, nombre, lat, lon, estado, poblacion, alias] */\n"
        f"window.GEOGRAFIA = {datos};\n",
        encoding="utf-8", newline="\n")
    print(f"{len(paises)} paises, {len(estados)} estados, {len(ciudades)} ciudades -> "
          f"{salida.name} ({salida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
