// Corta public/Firma/firma_arlequin.png en piezas para la firma de mail.
// Los clientes de correo no soportan SVG ni <map>, así que la imagen
// "interactiva" se arma como tabla de recortes, cada uno con su link.
// Uso: node tools/firma-mail-slices.mjs  → public/Firma/mail/*.png + layout.json
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'public/Firma/firma_arlequin.png';   // 1950×660 (mismo viewBox que /firma)
const OUT = 'public/Firma/mail';
const W = 1950, OUT_W = 960;                      // se muestra a 480px (2x para retina)

const SITE = 'https://arlequininspira.com';
const WA = 'https://wa.me/5491155706893';
const X = 'https://x.com/arlequininspira';
const IG = 'https://www.instagram.com/arlequininspira/';
const FB = 'https://www.facebook.com/arlequininspira';

// Bandas horizontales (coordenadas del original) y cortes con su link.
// Posiciones de los links tomadas de getBBox() de los <a> del SVG en /firma.
const ROWS = [
  { y: [0, 312], cells: [[0, W, SITE]] },
  { y: [312, 382], cells: [[0, 712, SITE], [712, 1200, WA], [1200, W, SITE]] },
  { y: [382, 546], cells: [[0, W, SITE]] },
  { y: [546, 628], cells: [[0, 712, SITE], [712, 806, X], [806, 906, IG], [906, 1002, FB], [1002, W, SITE]] },
  { y: [628, 660], cells: [[0, W, SITE]] },
];

const k = OUT_W / W;
const px = (v) => Math.round((v * k) / 2) * 2;   // par → mitad entera al mostrar a 480

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const base = await sharp(SRC).resize({ width: OUT_W }).flatten({ background: '#ffffff' }).png().toBuffer();
const meta = await sharp(base).metadata();

const layout = [];
let total = 0;
for (const [r, row] of ROWS.entries()) {
  const top = px(row.y[0]);
  const height = Math.min(px(row.y[1]), meta.height) - top;
  const cells = [];
  for (const [c, [x0, x1, href]] of row.cells.entries()) {
    const left = px(x0);
    const width = Math.min(px(x1), meta.width) - left;
    const file = `r${r}c${c}.png`;
    const buf = await sharp(base).extract({ left, top, width, height })
      .png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(`${OUT}/${file}`, buf);
    total += buf.length;
    cells.push({ file, w: width / 2, h: height / 2, href });
  }
  layout.push(cells);
}
fs.writeFileSync(`${OUT}/layout.json`, JSON.stringify(layout, null, 1));
console.log(`OK: ${layout.flat().length} piezas, ${(total / 1024).toFixed(1)} KB`);
