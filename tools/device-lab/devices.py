"""Catálogo de dispositivos para Device Lab.

Cada dispositivo tiene:
  screen    (w, h)  tamaño CSS de la pantalla completa (lo que muestra DevTools)
  visible   (w, h)  área REAL donde se dibuja la web con las barras del navegador
                    visibles (Safari iOS con barra abajo, Chrome Android, Chrome
                    desktop con pestañas + barra de direcciones). Valores medidos
                    aproximados (±15px según versión de iOS/navegador).
  dpr       devicePixelRatio
  engine    'webkit' (Safari / todos los navegadores de iOS) o 'chromium'
  mobile    True = touch + isMobile + sin hover

Por qué existen las dos alturas: DevTools emula `screen` completo, pero en un
iPhone real Safari se come ~190px entre status bar, barra de direcciones y
barra inferior. Una web que "entra justo" en DevTools se pisa en el teléfono.
"""

IOS_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
          "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
IPAD_UA = ("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
           "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
ANDROID_UA = ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")


def _iphone(name, sw, sh, vh, dpr=3):
    return dict(name=name, group="iPhone (Safari)", screen=(sw, sh), visible=(sw, vh),
                dpr=dpr, engine="webkit", mobile=True, ua=IOS_UA)


def _android(name, sw, sh, vh, dpr=3):
    return dict(name=name, group="Android (Chrome)", screen=(sw, sh), visible=(sw, vh),
                dpr=dpr, engine="chromium", mobile=True, ua=ANDROID_UA)


def _tablet(name, sw, sh, vh, dpr=2):
    return dict(name=name, group="Tablet", screen=(sw, sh), visible=(sw, vh),
                dpr=dpr, engine="webkit", mobile=True, ua=IPAD_UA)


def _desk(name, w, h, vh, dpr=1, group="Notebook / PC (Chrome)"):
    return dict(name=name, group=group, screen=(w, h), visible=(w, vh),
                dpr=dpr, engine="chromium", mobile=False, ua=None)


DEVICES = [
    _iphone("iPhone SE (2/3)",        375, 667, 553, dpr=2),
    _iphone("iPhone 13 mini",         375, 812, 629),
    _iphone("iPhone XR / 11",         414, 896, 715, dpr=2),
    _iphone("iPhone 12/13/14",        390, 844, 664),
    _iphone("iPhone 14 Pro / 15 / 15 Pro / 16", 393, 852, 659),
    _iphone("iPhone 16 Pro",          402, 874, 681),
    _iphone("iPhone 14 Plus / 15 Pro Max", 430, 932, 739),
    _iphone("iPhone 16 Pro Max",      440, 956, 763),
    _android("Galaxy S8 / chico",     360, 740, 640, dpr=4),
    _android("Galaxy S23 / A54",      360, 780, 690),
    _android("Pixel 7 / 8",           412, 915, 830, dpr=2.625),
    _android("Galaxy S24 Ultra",      384, 824, 740, dpr=3.75),
    _tablet("iPad Mini (vertical)",   744, 1133, 1060),
    _tablet("iPad Air (vertical)",    820, 1180, 1106),
    _tablet("iPad Air (horizontal)",  1180, 820, 746),
    _desk("Notebook 1366×768 @100%",           1366, 768, 641),
    _desk("Notebook 1280×800 @100%",           1280, 800, 689),
    _desk("Notebook 1920×1080 @150% (1280×720)", 1280, 720, 593, dpr=1.5),
    _desk("Notebook 1920×1080 @125% (1536×864)", 1536, 864, 730, dpr=1.25),
    _desk("MacBook Air 13 (1440×900)",         1440, 900, 789, dpr=2),
    _desk("MacBook Pro 14 (1512×982)",         1512, 982, 871, dpr=2),
    _desk("Monitor 1920×1080 @100%",           1920, 1080, 953),
    _desk("Monitor 2560×1440 @100%",           2560, 1440, 1313),
]


def by_name(name):
    for d in DEVICES:
        if d["name"] == name:
            return d
    raise KeyError(name)


def viewport(device, safari_bars=True, landscape=False):
    """Viewport CSS a usar. safari_bars=True usa el área visible real."""
    w, h = device["visible"] if safari_bars else device["screen"]
    if landscape:
        sw, sh = device["screen"]
        # En horizontal las barras ocupan menos en proporción; aprox.
        bars = (device["screen"][1] - device["visible"][1]) if safari_bars else 0
        w, h = sh, sw - min(bars, 90)
    return w, h
