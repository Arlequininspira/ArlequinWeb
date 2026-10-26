# Panel de administración `/login` — puesta en marcha

Pasos únicos (≈10 min). Todo en el plan gratis de Supabase y Vercel Hobby.

## 1. Supabase
1. Crear proyecto en https://supabase.com (región São Paulo, la más cercana).
2. **SQL Editor → New query** → pegar todo `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: desactivar **"Allow new users to sign up"**
   (así nadie más puede crearse cuenta).
4. **Authentication → Users → Add user → Create new user** (×2): email + contraseña fuerte,
   tildar *Auto Confirm User*.
5. SQL Editor, con los emails reales:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('admin1@mail.com', 'admin2@mail.com')
   on conflict do nothing;
   ```
6. **Project Settings → API**: copiar *Project URL* y la key *anon / publishable*.
   (Nunca usar la `service_role` en el frontend.)

## 2. Variables de entorno
- Local: copiar `.env.example` a `.env.local` y completar las 2 `VITE_SUPABASE_*`.
- Vercel → Project → Settings → Environment Variables:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `CRON_SECRET` = cadena larga aleatoria (protege `/api/keepalive`)
- Redeploy.

## 3. Primer ingreso
`https://www.arlequininspira.com/login` → login → **Administración de cuentas** → crear la
**clave maestra** (una frase larga). La comparten los dos admins. **No se puede recuperar**:
anotarla fuera de la compu (papel / gestor de contraseñas personal).

## Seguridad — cómo funciona
| Capa | Qué protege |
|---|---|
| Supabase Auth + registro desactivado | Sólo existen los 2 usuarios. |
| RLS + tabla `admins` | Cualquier lectura/escritura sin ser admin devuelve vacío o error, aunque alguien tenga la anon key. |
| Bóveda cifrada en el navegador | Contraseñas cifradas con AES-256-GCM; la clave sale de la clave maestra (PBKDF2-SHA256, 600.000 iteraciones). La base sólo guarda texto cifrado. Ni Supabase, ni un dump de la base, ni el login robado de un admin alcanzan para leerlas. |
| Ojito | Descifra sólo esa contraseña, se oculta sola a los 20 s; copiar limpia el portapapeles a los 30 s; la bóveda se bloquea tras 5 min sin uso y al salir. |
| `/login` | `noindex`, `X-Frame-Options: DENY`, `no-store`, excluido en robots.txt; el código del panel es un chunk aparte que el sitio público no descarga. |

## Keep-alive
Supabase gratis pausa el proyecto tras 7 días sin actividad. `vercel.json` programa un
cron diario (12:00 UTC) a `/api/keepalive`, que llama a la función `keepalive_ping()`
(escribe una fila → actividad real). Ver último ping: `select * from public.keepalive;`.
Probar a mano: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.arlequininspira.com/api/keepalive`.

## Migraciones
Si la base ya estaba creada, correr en el SQL Editor cada archivo nuevo de
`supabase/migrations/` (en orden). Son idempotentes. `schema.sql` ya los incluye
para instalaciones desde cero.

- `002_domains.sql` — dominios de los trabajos con vencimiento anual.
- `003_account_auth_method.sql` — cuentas con Authenticator (sin contraseña) o contraseña + 2FA.
- `004_transaction_paid_by.sql` — quién pagó cada gasto (Ariel / Lucas).

## Cómo se conectan los datos
- **Clientes** → cada cliente tiene N **trabajos** (webs), mensuales o de pago único.
- **Cobrar** (en Resumen o Clientes) crea un **ingreso** en Administración de gastos,
  vinculado al cliente y trabajo. Un mismo mes de mantenimiento no se puede cobrar dos veces.
- **Gastos fijos** (ARCA, dominios, hosting) → **Pagar** crea el gasto y corre el vencimiento
  al mes/año siguiente.
- **Dominios** (Clientes → + Dominio): cada trabajo puede tener varios. El vencimiento se
  calcula solo como el próximo aniversario del registro. Faltando 45 días aparecen en
  **Resumen → Dominios por vencer** (dorado; rojo a 15 días o vencido). **Renovar** corre el
  vencimiento 1–5 años y, si lo paga la agencia, registra el gasto "Dominios" del cliente.
- **Resumen** muestra lo que falta cobrar este mes, gastos fijos y dominios por vencer, y los
  últimos 6 meses. El número rojo en el menú suma los avisos pendientes.
- Montos en ARS o USD; los totales se muestran por moneda (no se convierten).
