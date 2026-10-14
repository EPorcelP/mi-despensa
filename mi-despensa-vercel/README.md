# Mi despensa — versión independiente para Vercel

Esta es la aplicación que hemos validado, adaptada a **Next.js + Vercel + Supabase**. Mantiene el diseño mobile-first, las cuatro columnas en PC, los botones − / + rápidos, la papelera, la lista de compra, las categorías automáticas, los nombres con iniciales en mayúscula y los mínimos de reposición. La cabecera y las tarjetas incluyen los últimos ajustes para reducir el scroll en móvil.

**El acceso utiliza una contraseña propia. No necesita ChatGPT ni una cuenta de ChatGPT.** La misma contraseña permite abrir la misma despensa desde los dispositivos de casa. Los datos se guardan en Supabase, no solo en el navegador.

Incluye una copia del inventario actual: **28 productos, exportados el 14 de octubre de 2026**. Las fotos y los tickets dentro de la aplicación siguen pendientes; no se ha añadido un OCR ficticio.

## 1. Descomprimir y abrir

1. Descarga y descomprime el ZIP.
2. En **Visual Studio Code → Archivo → Abrir carpeta**, abre `mi-despensa-vercel`, la carpeta que contiene `package.json`.
3. Abre **Terminal → Nueva terminal**.
4. Comprueba que tienes Node.js 22.13 o posterior:

```bash
node -v
```

Si tu PC no permite instalar Node.js, puedes hacer los mismos pasos en un **GitHub Codespace**. No es necesario instalar programas con permisos de administrador en tu PC.

## 2. Preparar Supabase

Puedes utilizar un proyecto existente, pero para esta despensa resulta más sencillo crear **un proyecto Supabase separado**. Los scripts usan tablas con prefijo `mdespensa_` y no modifican las tablas de MiGestor.

1. Abre el proyecto Supabase que vayas a usar.
2. Ve a **SQL Editor → New query**.
3. Copia el contenido completo de `supabase/001_setup.sql` y pulsa **Run**. Crea las tablas, el guardado y las funciones necesarias.
4. Abre otra consulta, copia `supabase/002_inventario_inicial.sql` y pulsa **Run**. Carga tus 28 productos. Si ya existe la despensa `casa`, no la sobrescribe.
5. Localiza la URL de tu proyecto y, en **Settings → API Keys**, una clave **secret** que empieza por `sb_secret_`. Esa clave se utilizará exclusivamente en el servidor. También se admite una clave antigua `service_role` si tu proyecto todavía la utiliza.

No necesitas configurar Supabase Auth, emails, usuarios ni el inicio de sesión de MiGestor: esta versión utiliza una única contraseña para la despensa familiar.

## 3. Configuración local

Copia `.env.example` y llama a la copia `.env.local`. Completa los cinco valores:

| Variable | Qué debes poner |
|---|---|
| `SUPABASE_URL` | La URL HTTPS de tu proyecto Supabase. |
| `SUPABASE_SECRET_KEY` | La clave secreta de Supabase. |
| `DESPENSA_PASSWORD` | Una contraseña propia de al menos 12 caracteres. |
| `SESSION_SECRET` | Una cadena aleatoria de al menos 32 caracteres, distinta de la contraseña. |
| `DESPENSA_ID` | Deja `casa` para utilizar el inventario incluido. |

Para generar `SESSION_SECRET`, ejecuta este comando en la terminal y copia el resultado en `.env.local`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

La contraseña y las claves van solamente en `.env.local` y en las variables de Vercel. **No las escribas en los archivos de código ni las subas a GitHub.** `.gitignore` ya excluye `.env.local`.

## 4. Arrancar y probar

En la terminal, dentro de la carpeta del proyecto:

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000`. En un Codespace, abre el enlace del puerto 3000 que ofrece la pestaña **Ports**.

1. Introduce tu contraseña.
2. Comprueba que aparecen tus productos.
3. Pulsa + en uno, recarga y verifica que la cantidad se conserva.
4. Prueba buscar, filtrar y la lista de compra.
5. Si pruebas la papelera, utiliza **Deshacer** para recuperar el producto.

Estos comandos comprueban el proyecto:

```bash
npm run typecheck
npm test
npm run build
```

## 5. Subir a GitHub

1. En el panel **Control de código fuente** de VS Code, inicializa el repositorio si hace falta.
2. Guarda un primer commit y utiliza **Publicar en GitHub**.
3. Selecciona **repositorio privado**, porque el paquete incluye tu inventario.
4. Verifica que se suben `app`, `lib`, `public`, `supabase`, `data`, `tests`, `package.json`, `package-lock.json` y los archivos de configuración.
5. No subas `node_modules`, `.next`, `.env.local` ni el ZIP dentro del repositorio.

## 6. Publicar en producción con Vercel

1. En Vercel, abre **Add New → Project** e importa este repositorio.
2. Vercel debe detectar **Next.js**.
3. La carpeta raíz debe ser la que contiene `package.json`. Si has subido todo dentro de otra carpeta, selecciónala en **Root Directory**.
4. En **Environment Variables**, añade los mismos cinco nombres y valores de `.env.local`. Selecciona **Production**. Si también quieres probar previews, añade las variables a **Preview**; recuerda que, con el mismo Supabase y `DESPENSA_ID`, esas previews utilizan la misma despensa real.
5. Pulsa **Deploy**.
6. Cuando aparezca **Ready**, abre la URL de Vercel e introduce tu contraseña.

Al cambiar variables de entorno en Vercel, haz un **Redeploy** para que se apliquen. Si cambias `DESPENSA_PASSWORD` o `SESSION_SECRET` y vuelves a desplegar, las sesiones anteriores dejan de ser válidas.

## 7. Añadir tu subdominio

1. En el proyecto de Vercel, entra en **Settings → Domains**.
2. Añade el subdominio que hayas elegido, por ejemplo `despensa.tudominio.com`.
3. Vercel te mostrará el registro DNS que necesita. Copia exactamente el tipo, nombre y destino indicados allí en el panel donde administras tu dominio.
4. Espera hasta que Vercel muestre la configuración válida.
5. Abre el subdominio desde el móvil y desde otro PC. Ambos verán la misma despensa.

En esta guía, “producción” se refiere al despliegue principal del proyecto. La selección de un plan de Vercel es independiente de estos pasos.

## 8. NFC y acceso desde el móvil

Graba en la etiqueta NFC la URL HTTPS definitiva del subdominio. El primer acceso pedirá tu contraseña; la sesión permanece abierta hasta 14 días en ese navegador. También puedes añadir la web a la pantalla de inicio del móvil. No necesitas instalar una app ni entrar en ChatGPT.

El acceso es una contraseña común para una única despensa familiar. No hay registro público ni cuentas individuales. **Salir** cierra la sesión de ese dispositivo; cambiar la contraseña invalida las sesiones de todos tras el nuevo despliegue.

## Si algo no funciona

| Qué ves | Qué revisar |
|---|---|
| El terminal no reconoce `node` | Usa un Codespace si no puedes instalar Node.js. |
| La aplicación no está disponible al entrar | Revisa las cinco variables y que ejecutaste `001_setup.sql`. |
| La despensa aparece vacía | Ejecuta `002_inventario_inicial.sql` y deja `DESPENSA_ID=casa`. |
| Las cantidades no se guardan | Comprueba la conexión con Supabase y la clave secreta. Pulsa Reintentar; los toques + / − no se duplican. |
| Demasiados intentos de acceso | Espera 15 minutos antes de volver a probar. |
| Vercel no encuentra el proyecto | Revisa que Root Directory apunta a la carpeta con `package.json`. |
| El subdominio no carga | Revisa el estado en Domains y el registro DNS indicado por Vercel. |

## Qué contiene el paquete

- `app/pantry.tsx`, `app/globals.css`: interfaz validada y diseño adaptable.
- `app/login`, `app/api/auth`: acceso privado y cierre de sesión.
- `app/api/pantry`, `lib/database.ts`: lectura y guardado en Supabase.
- `lib/session.ts`, `lib/auth.ts`, `lib/origin.ts`: sesiones privadas y protección de las peticiones.
- `lib/pantry.ts`, `lib/quick-queue.ts`: categorías, mínimos, compras y cambios instantáneos.
- `supabase/001_setup.sql`: estructura y funciones de base de datos.
- `supabase/002_inventario_inicial.sql`, `data/inventario-inicial.json`: inventario exportado.
- `tests/security.test.mjs`: comprobaciones de sesiones, compras y cola de guardado.

No se incluyen claves reales, contraseñas, dependencias descargadas ni herramientas de alojamiento de ChatGPT.

Referencias oficiales de configuración:
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/functions
