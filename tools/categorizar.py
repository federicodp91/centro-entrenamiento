"""Genera data/exercises.js a partir de data/ejercicios.txt.

Uso:  python tools/categorizar.py

Cada ejercicio recibe una categoría (la primera regla que coincide gana)
y una lista de equipamiento detectado por palabras clave.
"""
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "ejercicios.txt"
OUT = ROOT / "data" / "exercises.js"


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


# Casos ambiguos que las reglas generales clasificarían mal.
OVERRIDES = {
    "aperturas con mancuernas": "Pecho y empuje",
    "aperturas en anillas": "Pecho y empuje",
    "plyo push ups": "Pecho y empuje",
    "empuje de cadera plyo unipodal": "Glúteos e isquios",
    "pasaje de kettlebell unipodal": "Piernas",
    "caminata en la pared": "Habilidades",
    "estocada con press landmine": "Piernas",
    "sentadilla isometrica + abduccion": "Piernas",
    "press vertical unilateral": "Hombros",
    "tijeras": "Core",
    "elevacion alternada": "Core",
    "nudo para lastres": "Otros",
    "medio puente": "Movilidad y flexibilidad",
    "chin ups asistidas con soga": "Espalda y tracción",
    "plancha con desplazamiento lateral": "Core",
    "plancha de oso + desplazamiento de carga": "Core",
}

# Orden importa: la primera categoría con alguna palabra clave gana.
RULES = [
    ("Movilidad y flexibilidad", [
        "estiramiento", "movilidad", "elongacion", "apertura", "90/90", "foam roller",
        "masajes", "stretch", "pancake", "cobra", "thread the needle", "jefferson",
        "mobility", "rebotes", "mariposa", "psoas", "piramidal", "paloma", "cuarta",
        "segunda", "dorsiflexion", "prono-supinacion", "toracica", "pnf", "animal flow",
        "hand behind back", "rotacion interna", "camello", "entrada a puente",
        "puente cangrejo", "caminata a puente", "arco de espalda", "plegado frontal",
        "plegado lateral", "plegado a piernas", "plegado con pierna", "ondas en plegado",
        "empujar la piedra", "vitalizaciones",
    ]),
    ("Potencia (olímpicos y kettlebell)", [
        "clean", "snatch", "jerk", "swing", "cargada", "push press", "thruster",
        "high pull", "thigh pull", "thight pull", "devil press", "cluster",
        "power landmine", "trap bar con salto", "tiron + press",
    ]),
    ("Pliometría y cardio", [
        "salto", "jump", "burpee", "jack", "escaladores", "skipping", "soga", "bolsa",
        "kick", "repiqueteo", "monigotes", "desplazamiento", "entro y salgo",
        "recepcion de caida", "desaceleraciones", "cmj", "pliometri", "cambio de pierna",
        "primer paso", "take off", "pogo",
    ]),
    ("Core", [
        "hollow", "plancha", "plank", "abdomen", "abdominal", "crunch", "bicho muerto",
        "bird dog", "rollout", "pallof", "dragon", "plegado", "sit up", "curl up",
        "giros rusos", "toes to bar", "rodillas al pecho", "elevacion de piernas",
        "oblicuos", "woodchop", "skate p", "caminata del oso", "caminata del granjero",
        "caminata con manos", "revolver la olla", "rompo la ventana", "bisagras laterales",
        "molinos", "ocho con kettlebell", "compresiones", "construccion de piernas",
        "bracing", "suelo pelvico", "tgu", "piston",
    ]),
    ("Habilidades", [
        "front lever", "back lever", "planche", "l-sit", "muscle up", "vertical",
        "handstand", "hs pared", "skin the cat", "hip up", "inversion", "escuadra",
        "tripode", "ranita", "paradilla", "meat hook", "ice cream", "pull over",
        "tijera invertida", "giros en", "sosten en", "postura vertical", "tuck",
        "straddle", "pasaje",
    ]),
    ("Brazos", [
        "biceps", "triceps", "extension de codo", "extensiones de codo", "press frances",
        "curl en banco scott", "curl inclinado", "curl inverso", "curl reverso",
        "finger curls", "curl + press", "extension con banda",
    ]),
    ("Hombros", [
        "press militar", "elevaciones frontales", "vuelo", "manguito",
        "rotaciones externas", "press con kettlebell", "press landmine",
        "flexion de hombros", "pike push", "ywt", "y en trx", "w raises", "halo",
        "bottom up",
    ]),
    ("Espalda y tracción", [
        "pull up", "chin up", "dominada", "remo", "remada", "jalon", "rack chin",
        "face pull", "facepull", "pull apart", "hang ", "retraccion", "seal row",
        "pasamanos", "semidominada", "pin pull", "pin chin",
    ]),
    ("Pecho y empuje", [
        "push up", "press plano", "fondos", "aperturas", "peck deck", "crossover",
        "cruce de polea", "floor press", "press inclinado", "iso push",
    ]),
    ("Glúteos e isquios", [
        "empuje de cadera", "hip thrust", "peso muerto", "isquio", "femoral", "nordic",
        "nordico", "buenos dias", "bisagra", "gluteo", "glute", "abduccion",
        "abducciones", "frog pump", "pull through", "hiperextension", "espinales",
        "lumbar", "puente", "monster walk", "rack pull", "heel pulls",
        "cadena posterior", "patada", "hip lift",
    ]),
    ("Piernas", [
        "sentadilla", "squat", "estocada", "prensa", "cuadriceps", "step", "subida",
        "subir", "escalon", "pistol", "split", "rodilla", "pantorrilla", "tibial",
        "tobillo", "equilibrio", "estabilidad", "sumo", "paso lateral", "aductores",
        "horse stance", "cosaco", "pendulo",
    ]),
]

# (etiqueta, regex sobre el nombre normalizado)
EQUIPMENT = [
    ("Barra", r"\bbarra\b|rack pull|pendlay|zercher|safety|cluster|power clean|squat clean|toes to bar"),
    ("Mancuernas", r"mancuerna"),
    ("Kettlebell", r"kettlebell|hardstyle swing|\bswing\b"),
    ("Banda elástica", r"\bbanda"),
    ("Anillas", r"anillas"),
    ("Paralelas", r"paralelas"),
    ("TRX", r"\btrx\b"),
    ("Fitball", r"fitball"),
    ("Polea", r"polea|crossover|jalon"),
    ("Máquina", r"maquina|multipower|prensa|peck deck|hackenschmidt|extension de cuadriceps|curl femoral$"),
    ("Cajón / banco", r"cajon|cajones|banco|\bstep\b|tacos|bloque|silla|escalon"),
    ("Slider / skate", r"skate|slider|trapo"),
    ("Disco", r"disco"),
    ("Landmine", r"landmine"),
    ("Trap bar", r"trap bar"),
    ("Bastón", r"baston"),
    ("Rueda abdominal", r"rueda abdominal"),
    ("Soga", r"soga"),
    ("Bolsa de boxeo", r"bolsa"),
    ("Foam roller / pelota", r"foam roller|pelota|rodillo"),
]


def categorize(name):
    n = norm(name)
    if n in OVERRIDES:
        return OVERRIDES[n]
    # "semi - dominadas", "semi-dominada", "semi dominadas" -> "semidominada"
    compact = re.sub(r"semi\s*-?\s*dominad", "semidominad", n)
    for cat, keys in RULES:
        if any(k in compact for k in keys):
            return cat
    return "Otros"


def equipment(name):
    n = norm(name)
    tags = [label for label, rx in EQUIPMENT if re.search(rx, n)]
    return tags or ["Peso corporal"]


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", norm(name)).strip("-")
    return s or "ejercicio"


def main():
    seen, items = set(), []
    for line in SRC.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or norm(name) in seen:
            continue
        seen.add(norm(name))
        base, i = slug(name), 2
        sid = base
        while any(x["id"] == sid for x in items):
            sid, i = f"{base}-{i}", i + 1
        items.append({"id": sid, "nombre": name, "categoria": categorize(name),
                      "equipo": equipment(name)})

    OUT.write_text(
        "// Generado por tools/categorizar.py — no editar a mano.\n"
        "window.EXERCISES = " + json.dumps(items, ensure_ascii=False, indent=0) + ";\n",
        encoding="utf-8",
    )
    counts = {}
    for x in items:
        counts[x["categoria"]] = counts.get(x["categoria"], 0) + 1
    print(f"{len(items)} ejercicios -> {OUT.relative_to(ROOT)}")
    for cat, c in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {c:4d}  {cat}")


if __name__ == "__main__":
    main()
