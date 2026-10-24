"""Device Lab — ventana de escritorio.

Doble click en DeviceLab.bat (o `python gui.py`).
"""
import queue
import subprocess
import sys
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import ttk

import lab
from devices import DEVICES, viewport

HERE = Path(__file__).resolve().parent


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Device Lab — simulador de pantallas")
        self.geometry("760x620")
        self.minsize(640, 520)
        self.msgs = queue.Queue()

        top = ttk.Frame(self, padding=10)
        top.pack(fill="x")
        ttk.Label(top, text="URL:").pack(side="left")
        self.url = tk.StringVar(value="http://localhost:5173/")
        ttk.Entry(top, textvariable=self.url).pack(side="left", fill="x", expand=True, padx=6)
        ttk.Button(top, text="Levantar npm run dev", command=self.start_dev).pack(side="left")

        opts = ttk.Frame(self, padding=(10, 0))
        opts.pack(fill="x")
        self.bars = tk.BooleanVar(value=True)
        self.land = tk.BooleanVar(value=False)
        self.webkit = tk.BooleanVar(value=False)
        self.theme = tk.StringVar(value="dark")
        ttk.Checkbutton(opts, text="Restar barras del navegador (tamaño REAL)", variable=self.bars,
                        command=self.refresh).pack(side="left")
        ttk.Checkbutton(opts, text="Horizontal", variable=self.land, command=self.refresh).pack(side="left", padx=10)
        ttk.Checkbutton(opts, text="Motor WebKit (Safari)", variable=self.webkit).pack(side="left")
        ttk.Label(opts, text="  Tema:").pack(side="left")
        ttk.Combobox(opts, textvariable=self.theme, values=["dark", "light"], width=6,
                     state="readonly").pack(side="left")

        mid = ttk.Frame(self, padding=10)
        mid.pack(fill="both", expand=True)
        cols = ("grupo", "viewport", "pantalla", "dpr")
        self.tree = ttk.Treeview(mid, columns=cols, show="tree headings", selectmode="extended", height=14)
        self.tree.heading("#0", text="Dispositivo")
        self.tree.column("#0", width=270)
        for c, w in zip(cols, (150, 90, 90, 50)):
            self.tree.heading(c, text=c.capitalize())
            self.tree.column(c, width=w, anchor="center")
        self.tree.pack(side="left", fill="both", expand=True)
        sb = ttk.Scrollbar(mid, command=self.tree.yview)
        sb.pack(side="left", fill="y")
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.bind("<Double-1>", lambda e: self.open_selected())
        self.refresh()

        btns = ttk.Frame(self, padding=(10, 0))
        btns.pack(fill="x")
        ttk.Button(btns, text="▶ Abrir seleccionado (interactivo)", command=self.open_selected).pack(side="left")
        ttk.Button(btns, text="📸 Probar seleccionados", command=lambda: self.shoot(False)).pack(side="left", padx=6)
        ttk.Button(btns, text="📸 Probar TODOS", command=lambda: self.shoot(True)).pack(side="left")
        ttk.Button(btns, text="Carpeta capturas", command=self.open_folder).pack(side="right")

        self.log = tk.Text(self, height=9, bg="#111", fg="#ddd", font=("Consolas", 9))
        self.log.pack(fill="both", padx=10, pady=10)
        self.say("Doble click en un dispositivo = abre navegador emulándolo (con su tamaño, DPR y touch).\n"
                 "'Probar' recorre la web, saca capturas y detecta superposiciones; abre un reporte HTML.\n"
                 "Tip: dejá tildado 'Restar barras' — así se ve en el celular real, no como en DevTools.")
        self.after(150, self.pump)

    # ── helpers ──────────────────────────────────────────────────────────
    def refresh(self):
        self.tree.delete(*self.tree.get_children())
        for d in DEVICES:
            w, h = viewport(d, self.bars.get(), self.land.get())
            self.tree.insert("", "end", iid=d["name"], text=d["name"],
                             values=(d["group"], f"{w}×{h}", f"{d['screen'][0]}×{d['screen'][1]}", d["dpr"]))

    def say(self, text):
        self.msgs.put(text)

    def pump(self):
        while not self.msgs.empty():
            self.log.insert("end", self.msgs.get() + "\n")
            self.log.see("end")
        self.after(150, self.pump)

    def selected(self):
        return list(self.tree.selection())

    def engine(self):
        return "webkit" if self.webkit.get() else None

    # ── actions ──────────────────────────────────────────────────────────
    def open_selected(self):
        sel = self.selected()
        if not sel:
            self.say("Elegí un dispositivo.")
            return
        for name in sel[:3]:
            self.say(f"Abriendo {name}… (cerrá la ventana del navegador para terminar)")
            threading.Thread(target=lab.open_interactive, daemon=True,
                             args=(name, self.url.get(), self.bars.get(), self.land.get()),
                             kwargs=dict(engine=self.engine(),
                                         on_close=lambda n=name: self.say(f"Cerrado {n}"))).start()

    def shoot(self, all_devices):
        names = None if all_devices else self.selected()
        if not all_devices and not names:
            self.say("Elegí uno o más dispositivos (Ctrl+click) o usá 'Probar TODOS'.")
            return
        self.say("Probando… (puede tardar unos minutos)")

        def run():
            try:
                lab.shoot(names, self.url.get(), safari_bars=self.bars.get(), landscape=self.land.get(),
                          theme=self.theme.get(), log=self.say, engine=self.engine())
            except Exception as e:  # noqa: BLE001
                self.say(f"ERROR: {e}")
        threading.Thread(target=run, daemon=True).start()

    def start_dev(self):
        root = HERE.parent.parent
        subprocess.Popen("start cmd /k npm run dev", cwd=root, shell=True)
        self.say(f"Levantando servidor en {root}…")

    def open_folder(self):
        lab.OUT_ROOT.mkdir(exist_ok=True)
        webbrowser.open(lab.OUT_ROOT.as_uri())


if __name__ == "__main__":
    App().mainloop()
