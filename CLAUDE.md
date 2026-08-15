# CLAUDE.md

Guía de trabajo para este repo. Es el take-home "Code Improvement Challenge" (ver [README.md](README.md)): una app Next.js (PropHero, portfolio de real estate) deliberadamente en mal estado que hay que llevar a calidad de producción en ~3-4h, con un write-up final explicando prioridades y decisiones.

## Dónde está el estado del trabajo

- **[AGENDA.md](AGENDA.md)** — plan y orden de refactor, según se va diagnosticando el código. Es la fuente de verdad del "qué toca ahora".
- **[BUGS.md](BUGS.md)** — bugs confirmados en runtime (navegador, consola, network), numerados, con repro y causa. Se generó explorando la app real, no solo leyendo código.

Antes de tocar un archivo, mira si AGENDA.md o BUGS.md ya dicen algo sobre él.

## Cómo trabajamos el refactor

1. Seguimos el orden establecido en AGENDA.md (normalizar datos/API → interfaces/tipos → hooks y data-fetching → bugs de lógica que dependían de eso → CSS/estética al final). No saltar fases porque "ya que estamos" salvo el punto 2.
2. **Mientras se refactoriza un archivo por el motivo planeado, si alguno de los bugs listados en BUGS.md vive en ese mismo archivo y tiene sentido arreglarlo sin desviarse del alcance del paso actual, se arregla ahí mismo** en vez de dejarlo para una pasada aparte. No abrir archivos nuevos solo para cazar bugs de la lista fuera de orden — eso rompe la priorización ya acordada.
3. `var`→`const/let` y quitar `any` no son fases propias: se limpian sobre la marcha en cada archivo que se toca (evita pasar dos veces por el mismo sitio).
4. Al arreglar un bug de BUGS.md, marcarlo como resuelto en ese mismo archivo (no se borra la entrada, se anota qué se hizo) para que el write-up final pueda salir directamente de ahí.
5. Cualquier bug nuevo que aparezca haciendo el refactor (no estaba en la lista) se añade a BUGS.md con el mismo formato que los existentes, no se arregla en silencio sin dejar rastro.

## Reglas de código acordadas

- Sin `any`. Los tipos salen de las interfaces normalizadas del punto 2 de AGENDA.md.
- Sin `var`.
- Un `useEffect` = una responsabilidad. Nada de mezclar fetch + timers + listeners en el mismo efecto.
- Nunca `useEffect` + `setState` para derivar algo calculable directamente en el render (usar cálculo directo o `useMemo` si hiciera falta).
- No mutar arrays/objetos de estado directamente (`.sort()`, `.push()` in place) — copiar antes.
- Todo `addEventListener`/`subscribe` limpia su contraparte en el cleanup del efecto.
- `setState` basado en el valor anterior usa la forma funcional (`setX(prev => ...)`), sobre todo en timers/callbacks.
- Fetches dependientes de un id que puede cambiar necesitan cancelación (`AbortController` o flag `ignore`) para evitar condiciones de carrera.
- Fuera los `window.alert(...)` como feedback de UI (bug de BUGS.md #15 relacionado) — usar estado en pantalla.
- Capa de normalización de datos (nombres de campo inconsistentes entre endpoints) centralizada, no reimplementada por componente.

## Verificación

- `npm run lint` antes de dar un paso por cerrado (ya incluye `eslint-plugin-react-hooks` vía `next/core-web-vitals`, así que exhaustive-deps debería pillar buena parte de los efectos mal formados).
- Para bugs de runtime, hay un servidor MCP de Playwright configurado en [.mcp.json](.mcp.json) — se puede navegar la app real para confirmar que un fix efectivamente resuelve lo que decía BUGS.md, no solo que compila.
