"""Device Lab — motor (CLI).

Ejemplos:
  python lab.py open "iPhone 14 Pro / 15 / 15 Pro / 16"
  python lab.py shoot                      # todos los dispositivos, escenario arlequin
  python lab.py shoot --devices "iPhone XR / 11" "Notebook 1366×768 @100%"
  python lab.py shoot --full-screen        # usa tamaño DevTools (sin barras) para comparar
  python lab.py list
"""
import argparse
import html
import json
import os
import re
import sys
import time
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

from devices import DEVICES, by_name, viewport

HERE = Path(__file__).resolve().parent
DEFAULT_SCENARIO = HERE / "scenarios" / "arlequin.json"
OUT_ROOT = HERE / "capturas"

# Rects de elementos visibles (ignora display:none, opacity 0, tamaño 0).
RECTS_JS = """
(sels) => sels.map(sel => {
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    let r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    // Canvas: usar la caja de los píxeles NO transparentes (la imagen real),
    // no el rectángulo del canvas que suele tener márgenes vacíos.
    if (el.tagName === 'CANVAS' && el.width && el.height) {
      try {
        const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const st = 3;
        for (let y = 0; y < el.height; y += st) for (let x = 0; x < el.width; x += st) {
          if (d[(y * el.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) return;
        const sx = r.width / el.width, sy = r.height / el.height;
        r = {left: r.left + x0 * sx, top: r.top + y0 * sy, width: (x1 - x0) * sx, height: (y1 - y0) * sy};
      } catch (e) {}
    }
    let n = el, hidden = false;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) { hidden = true; break; }
      n = n.parentElement;
    }
    if (!hidden) out.push({x: r.left, y: r.top, w: r.width, h: r.height});
  });
  return out;
})
"""

# Mini HUD con el tamaño del viewport (sólo modo interactivo).
HUD_JS = """
(() => {
  const mk = () => {
    if (document.getElementById('__devicelab_hud')) return;
    const d = document.createElement('div');
    d.id = '__devicelab_hud';
    d.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483647;font:11px monospace;' +
      'background:rgba(0,0,0,.65);color:#0f0;padding:2px 5px;border-radius:3px;pointer-events:none';
    document.documentElement.appendChild(d);
    const upd = () => d.textContent = innerWidth + '×' + innerHeight + ' @' + devicePixelRatio + 'x';
    upd(); addEventListener('resize', upd);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mk); else mk();
})();
"""


def engine_for(dev, engine=None):
    # WebKit de Windows no decodifica AVIF (iOS sí), así que por defecto todo
    # corre en Chromium con el UA/tamaño/DPR del dispositivo. engine='webkit'
    # fuerza el motor de Safari para revisar diferencias de CSS.
    return engine or "chromium"


def context_options(dev, safari_bars=True, landscape=False, engine=None):
    w, h = viewport(dev, safari_bars, landscape)
    opts = dict(viewport={"width": w, "height": h},
                device_scale_factor=dev["dpr"],
                has_touch=dev["mobile"])
    if engine_for(dev, engine) == "chromium":
        opts["is_mobile"] = dev["mobile"]
    if dev.get("ua"):
        opts["user_agent"] = dev["ua"]
    return opts


def launch(p, engine, headless):
    bt = p.webkit if engine == "webkit" else p.chromium
    return bt.launch(headless=headless)


def check_layout(page, checks):
    """Devuelve lista de problemas encontrados en el estado actual."""
    problems = []
    vw, vh = page.evaluate("[innerWidth, innerHeight]")
    for a, b, label, *rest in checks.get("no_overlap", []):
        tol = rest[0] if rest else 2
        ra, rb = page.evaluate(RECTS_JS, [a, b])
        for x in ra:
            for y in rb:
                ix = min(x["x"] + x["w"], y["x"] + y["w"]) - max(x["x"], y["x"])
                iy = min(x["y"] + x["h"], y["y"] + y["h"]) - max(x["y"], y["y"])
                if ix > tol and iy > tol:
                    problems.append(f"{label} ({ix:.0f}×{iy:.0f}px)")
    for sel, label in checks.get("inside_viewport", []):
        (rs,) = page.evaluate(RECTS_JS, [sel])
        for r in rs:
            over = max(0, -r["x"], -r["y"], r["x"] + r["w"] - vw, r["y"] + r["h"] - vh)
            if over > 2:
                problems.append(f"{label} ({over:.0f}px afuera)")
    return sorted(set(problems))


def run_scenario(page, scenario, outdir, prefix, log=print):
    results = []
    for step in scenario["steps"]:
        if "wait" in step:
            page.wait_for_timeout(step["wait"])
        elif "wait_for" in step:
            try:
                page.locator(step["wait_for"]).first.wait_for(state="visible", timeout=step.get("timeout", 10000))
            except Exception:  # noqa: BLE001
                log(f"   ! no apareció {step['wait_for']}")
        elif "click" in step:
            loc = page.locator(step["click"]).nth(step.get("nth", 0))
            try:
                loc.click(timeout=4000, force=True)
            except Exception as e:  # noqa: BLE001
                log(f"   ! no pude clickear {step['click']}: {str(e).splitlines()[0]}")
        elif "shot" in step:
            name = step["shot"]
            path = outdir / f"{prefix}__{name}.png"
            page.screenshot(path=str(path))
            probs = check_layout(page, scenario.get("checks", {}))
            results.append(dict(state=name, file=path.name, problems=probs))
            log(f"   {name}: {'OK' if not probs else '; '.join(probs)}")
    return results


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def shoot(device_names=None, url=None, scenario_path=DEFAULT_SCENARIO, safari_bars=True,
          landscape=False, theme=None, headless=True, log=print, open_report=True, engine=None, jobs=4):
    scenario = json.loads(Path(scenario_path).read_text(encoding="utf-8"))
    url = url or scenario["url"]
    devs = [by_name(n) for n in device_names] if device_names else DEVICES
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    outdir = OUT_ROOT / stamp
    outdir.mkdir(parents=True, exist_ok=True)
    storage = dict(scenario.get("init_storage", {}))
    if theme:
        storage["themeMode"] = theme

    def worker(chunk):
        out = []
        with sync_playwright() as p:
            browsers = {}
            for dev in chunk:
                w, h = viewport(dev, safari_bars, landscape)
                eng = engine_for(dev, engine)
                if eng not in browsers:
                    browsers[eng] = launch(p, eng, headless)
                ctx = browsers[eng].new_context(**context_options(dev, safari_bars, landscape, engine))
                ctx.add_init_script(
                    "(s => { if (!sessionStorage.__dl) { localStorage.clear();"
                    " for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.__dl = 1; } })("
                    + json.dumps(storage) + ")")
                page = ctx.new_page()
                lines = [f"▶ {dev['name']}  {w}×{h} @{dev['dpr']}x  [{eng}]"]
                try:
                    page.goto(url, wait_until="load", timeout=30000)
                    res = run_scenario(page, scenario, outdir, slug(dev["name"]), lines.append)
                except Exception as e:  # noqa: BLE001
                    lines.append(f"   ERROR: {e}")
                    res = [dict(state="error", file=None, problems=[str(e).splitlines()[0]])]
                log(chr(10).join(lines))
                out.append(dict(device=dev, size=(w, h), engine=eng, results=res))
                ctx.close()
            for b in browsers.values():
                b.close()
        return out

    jobs = max(1, min(jobs, len(devs)))
    chunks = [devs[i::jobs] for i in range(jobs)]
    with ThreadPoolExecutor(jobs) as ex:
        parts = list(ex.map(worker, chunks))
    order = {d["name"]: i for i, d in enumerate(devs)}
    report = sorted((r for part in parts for r in part), key=lambda r: order[r["device"]["name"]])

    html_path = write_report(report, outdir, scenario, safari_bars, landscape)
    total = sum(len(r["problems"]) for d in report for r in d["results"])
    log(f"\nListo: {total} problema(s). Reporte: {html_path}")
    if open_report:
        webbrowser.open(html_path.as_uri())
    return html_path, report


def write_report(report, outdir, scenario, safari_bars, landscape):
    states = []
    for d in report:
        for r in d["results"]:
            if r["state"] not in states:
                states.append(r["state"])
    mode = "área visible real (con barras del navegador)" if safari_bars else "pantalla completa (como DevTools)"
    rows = []
    for d in report:
        dev = d["device"]
        cells = []
        by_state = {r["state"]: r for r in d["results"]}
        for s in states:
            r = by_state.get(s)
            if not r:
                cells.append("<td></td>")
                continue
            img = f'<a href="{r["file"]}" target="_blank"><img src="{r["file"]}" loading="lazy"></a>' if r["file"] else ""
            probs = "".join(f"<li>{html.escape(p)}</li>" for p in r["problems"])
            badge = f'<ul class="bad">{probs}</ul>' if probs else '<div class="ok">OK</div>'
            cells.append(f"<td>{img}{badge}</td>")
        n = sum(len(r["problems"]) for r in d["results"])
        rows.append(
            f'<tr class="{"has-bad" if n else ""}"><th><b>{html.escape(dev["name"])}</b>'
            f'<small>{d["size"][0]}×{d["size"][1]} @{dev["dpr"]}x · {d["engine"]}'
            f'<br>pantalla {dev["screen"][0]}×{dev["screen"][1]}</small>'
            f'<span class="{"nbad" if n else "nok"}">{n} problema(s)</span></th>{"".join(cells)}</tr>')
    head = "".join(f"<th>{html.escape(s)}</th>" for s in states)
    doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Device Lab — {html.escape(scenario['name'])}</title>
<style>
body{{font:13px system-ui,sans-serif;background:#111;color:#ddd;margin:16px}}
h1{{font-size:18px;margin:0 0 4px}} p{{margin:0 0 12px;color:#999}}
label{{cursor:pointer}} table{{border-collapse:collapse}}
th,td{{border:1px solid #333;padding:6px;vertical-align:top;text-align:left}}
thead th{{position:sticky;top:0;background:#222;z-index:1}}
tbody th{{width:170px;background:#1a1a1a}} th small{{display:block;color:#888;font-weight:normal;margin:4px 0}}
img{{display:block;max-height:340px;max-width:260px;border:1px solid #444}}
.ok{{color:#4c4;margin-top:4px}} .bad{{color:#f66;margin:4px 0 0;padding-left:16px;max-width:260px}}
.nbad{{color:#f66}} .nok{{color:#4c4}}
body.only-bad tbody tr:not(.has-bad){{display:none}}
</style></head><body>
<h1>Device Lab — {html.escape(scenario['name'])}</h1>
<p>Modo: {mode}{' · horizontal' if landscape else ''} · {datetime.now():%d/%m/%Y %H:%M} ·
<label><input type="checkbox" onchange="document.body.classList.toggle('only-bad',this.checked)"> sólo con problemas</label></p>
<table><thead><tr><th>Dispositivo</th>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table>
</body></html>"""
    path = outdir / "reporte.html"
    path.write_text(doc, encoding="utf-8")
    (outdir / "reporte.json").write_text(json.dumps(
        [dict(device=d["device"]["name"], size=d["size"], results=d["results"]) for d in report],
        ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def open_interactive(device_name, url, safari_bars=True, landscape=False, on_close=None, engine=None):
    """Abre un navegador real (con ventana) emulando el dispositivo. Bloquea hasta cerrarlo."""
    dev = by_name(device_name)
    with sync_playwright() as p:
        b = launch(p, engine_for(dev, engine), headless=False)
        ctx = b.new_context(**context_options(dev, safari_bars, landscape, engine))
        ctx.add_init_script(HUD_JS)
        page = ctx.new_page()
        page.goto(url)
        try:
            page.wait_for_event("close", timeout=0)
        except Exception:  # noqa: BLE001
            pass
        try:
            b.close()
        except Exception:  # noqa: BLE001
            pass
    if on_close:
        on_close()


def main():
    ap = argparse.ArgumentParser(description="Device Lab")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    o = sub.add_parser("open")
    o.add_argument("device")
    o.add_argument("--url", default="http://localhost:5173/")
    o.add_argument("--full-screen", action="store_true")
    o.add_argument("--landscape", action="store_true")
    o.add_argument("--webkit", action="store_true", help="motor Safari (no muestra AVIF en Windows)")
    s = sub.add_parser("shoot")
    s.add_argument("--devices", nargs="*")
    s.add_argument("--url")
    s.add_argument("--scenario", default=str(DEFAULT_SCENARIO))
    s.add_argument("--full-screen", action="store_true", help="tamaño DevTools sin barras")
    s.add_argument("--landscape", action="store_true")
    s.add_argument("--theme", choices=["dark", "light"])
    s.add_argument("--no-open", action="store_true")
    s.add_argument("--jobs", type=int, default=4, help="navegadores en paralelo")
    s.add_argument("--webkit", action="store_true", help="motor Safari (no muestra AVIF en Windows)")
    a = ap.parse_args()

    if a.cmd == "list":
        for d in DEVICES:
            print(f"{d['group']:<24} {d['name']:<40} visible {d['visible'][0]}×{d['visible'][1]}")
    elif a.cmd == "open":
        open_interactive(a.device, a.url, not a.full_screen, a.landscape,
                         engine="webkit" if a.webkit else None)
    elif a.cmd == "shoot":
        _, report = shoot(a.devices, a.url, a.scenario, not a.full_screen, a.landscape,
                          a.theme, open_report=not a.no_open,
                          engine="webkit" if a.webkit else None, jobs=a.jobs)
        bad = sum(len(r["problems"]) for d in report for r in d["results"])
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    os.chdir(HERE)
    sys.stdout.reconfigure(encoding="utf-8")
    main()
