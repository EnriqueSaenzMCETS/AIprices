# Comparativa de costos de IA con catálogo JSON

El catálogo está en [models.json](models.json). La web genera tarjetas, tabla de precios, líneas del gráfico y exportación CSV a partir de sus modelos. Incluye GPT-6 Luna, GPT-6.1 Terra, Claude Haiku 5.5 y Gemini 3.5 Flash-Lite.

## Abrir con carga automática

Para probarlo localmente con carga automática, requiere Node.js 18 o superior. No hay dependencias externas ni hace falta ejecutar `npm install`. En esta carpeta ejecuta:

```bash
npm start
```

Abre **http://127.0.0.1:8000/**. Si ese puerto está ocupado, utiliza `npm start -- --port 8001`. También puedes ejecutar `node server.js` directamente o definir el puerto con `PORT=8001 npm start`. El servidor se limita a tu máquina y se detiene con Ctrl+C.

Después de editar `models.json`, pulsa **Recargar catálogo** o recarga la página. La lectura evita caché del navegador. Recargar el catálogo conserva volumen y tokens del formulario, pero restaura los precios y visibilidad según el JSON.

Al desplegarlo en Vercel, la web carga `/models.json` automáticamente por HTTP; no necesitas iniciar `server.js` ni seleccionar el archivo. El botón **Ver models.json** abre el catálogo publicado. Solo al abrir `index.html` directamente como `file://` el navegador bloquea la lectura automática del JSON por seguridad; en ese caso usa el servidor local o el botón **Cargar JSON**.

## Publicar en Vercel

El proyecto es estático y no necesita compilación ni dependencias de producción. La configuración de [vercel.json](vercel.json) publica los archivos de esta carpeta directamente.

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel, importa ese repositorio y conserva la carpeta raíz como **Root Directory**.
3. Despliega con **Build Command** vacío y **Output Directory** `.`. No hace falta configurar variables de entorno.

También puedes desplegar desde la CLI de Vercel ejecutando `vercel` en esta carpeta y luego `vercel --prod` para producción. La página y `models.json` deben permanecer en la misma carpeta para que la carga automática del catálogo funcione. Los cambios hechos en el navegador son temporales; para cambiar el catálogo publicado, actualiza `models.json` y vuelve a desplegar.

## Agregar un modelo

Añade un objeto a `models`, separado con coma de los anteriores:

```json
{
  "id": "modelo-nuevo",
  "name": "Modelo de ejemplo",
  "apiId": "modelo-api-id",
  "company": "Proveedor",
  "input": 1.00,
  "output": 5.00,
  "toolSystemTokens": 0,
  "color": "#db2777",
  "visible": true
}
```

Los precios del ejemplo son ficticios. `input` y `output` son USD por millón de tokens Standard, sin caché. El documento debe mantener `schemaVersion: 1`, `currency: "USD"` y `pricingBasis: "per_million_tokens"`.

Campos de cada modelo:

| Campo | Uso |
|---|---|
| `id` | Obligatorio y único; letra inicial minúscula, letras, números o guiones |
| `name` | Nombre mostrado, obligatorio |
| `apiId` | ID de API mostrado, obligatorio |
| `input`, `output` | Precios numéricos no negativos, obligatorios |
| `company` | Proveedor, opcional |
| `toolSystemTokens` | Tokens extra por solicitud con herramientas; entero, cero por defecto |
| `color` | Color hexadecimal, opcional; si falta se asigna uno automáticamente |
| `visible` | Mostrar línea al cargar; `true` por defecto |
| `dash` | Patrón opcional de línea, por ejemplo `"7 5"` |
| `lineWidth` | Grosor opcional entre 1 y 8 |
| `source` | Enlace de referencia del precio, documental |

Un JSON mal formado, IDs repetidos o precios inválidos se rechazan. Si ya existe un catálogo cargado, permanece disponible al rechazar una nueva carga. Los nombres del JSON se muestran como texto, no como HTML.

La aplicación admite tarifas planas. Para precios por longitud del prompt, región o promociones debes seleccionar y mantener manualmente la tarifa aplicable. No valida un umbral por solicitud a partir de tokens acumulados de conversación.

## Datos iniciales y uso

20 conversaciones al día, conversión del 45%, 30 días: 270 compras y 330 abandonos. El escenario promedio es provisional; los tokens no están medidos. El output ya incluye razonamiento supuesto.

- Cambia volumen, conversión por porcentaje o cantidad y días.
- Las curvas escalan el volumen manteniendo la tasa de conversión actual.
- La escala vertical es común a los escenarios de referencia para evitar comparaciones visuales engañosas.
- Oculta modelos con sus casillas para comparar líneas cercanas.
- Precios y tokens editados en la web son temporales; para cambios permanentes edita el JSON. Restaurar valores iniciales usa el último catálogo cargado, no una lista fija de tres modelos.
- Exporta CSV o imprime como PDF. Los documentos iniciales y el CSV inicial conservan la comparativa histórica de tres modelos; la web y su CSV descargado utilizan el catálogo actual.

Gemini 3.5 Flash-Lite usa USD 0.30 de input y USD 2.50 de output por millón de tokens, verificados el 27/10/2026 en [precios oficiales de Google](https://ai.google.dev/gemini-api/docs/pricing). Su costo promedio bajo estos supuestos y volumen es USD 16.16 al mes; no es consumo medido.

No se incluyen WhatsApp, pago, infraestructura, impuestos ni caché. El diseño usa Tailwind mediante CDN y requiere internet para cargarlo; hay estilos de respaldo. Los cálculos y SVG son locales y no realizan llamadas a modelos de IA.

Archivos principales: [simulador](index.html), [catálogo](models.json), `calculos.js`, `app.js`, `server.js`. Referencia histórica: [comparativa inicial](comparativa-conversion-45.md).
