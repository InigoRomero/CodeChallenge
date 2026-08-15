Por corregir en orden que voy encontrando:
 - Los datos hay que estandarizar los nombres, tanto usar un case como el idioma.
 - Uso de Var -> Cambiar a let, const
 - Quitar anys
 - css bad practices
 - Código de API tiene errores locos ->   await wait(1800 + Math.random() * 1200); Hay que limpiarlo entero todo.
 - Mal uso de los hooks:
   - page.tsx:
     - Un solo useEffect mezclando 4 cosas sin relación: fetch portfolio, fetch properties, fetch legacy (dead code, solo console.log), setInterval de polling, y addEventListener("focus"). Debería partirse en efectos/hooks separados.
     - Listener "focus" sin cleanup -> memory leak (el return solo limpia el setInterval).
     - Stale closure en el polling: `setRefreshCount(refreshCount + 1)` dentro del interval siempre parte de 0 capturado, nunca pasa de 1. Fix: forma funcional `setRefreshCount(c => c + 1)`.
     - `summaryStats` guardado en estado + recalculado en un 2o useEffect, siendo 100% derivable de portfolio/properties -> antipatron "estado derivado via efecto". Debe calcularse directo en el render (o useMemo si hiciera falta).
     - `properties.sort(...)` muta el array de estado en medio del render (side effect en función que debe ser pura), y se re-ordena en cada render sin memoizar.
     - useState<any> en portfolio/properties/selectedProperty/err -> anula TS en todo el árbol. Se resuelve solo al crear las interfaces.
     - selección por referencia de objeto (`selectedProperty === p`) se rompe si properties se vuelve a fetchear (nuevos objetos). Comparar por id.
     - Funciones normalizadoras (getVal, getIncome, getPropName...) viven dentro del componente pero no dependen de él -> deberían ser una capa de normalización compartida (mismo punto que estandarizar datos).
     - Sin estados loading/error reales, solo null checks ad hoc.
   - property/[id]/page.tsx:
     - Timer de 1s que fuerza re-render entero solo para un contador sin uso ("dont ask why this exists" en el propio código). Eliminar.
     - Fetch condicional (`if propertyId == "never"`) dentro del mismo efecto -> condición de carrera real, el que resuelva último pisa al otro con setDetail.
     - Sin cancelación al cambiar propertyId (falta AbortController / flag `ignore` en el cleanup) -> respuesta tardía de un id anterior puede pisar datos del id nuevo.
     - `detail && detail.stats.trend.direction` no cubre detail.stats ni detail.stats.trend undefined -> puede reventar en render con datos "sucios" de la API.
     - roi usa `detail?.purchasePrice` pero el resto de la página usa `detail?.purchase` -> posible bug de naming, no solo de hooks.
   - Recomendaciones generales: sacar el fetching de los componentes a custom hooks (usePortfolio, useProperties, usePropertyDetail) o librería de server-state (React Query/SWR); nunca useEffect+setState para derivar algo calculable en el render; todo addEventListener/subscribe limpia su contraparte; setState basado en valor previo usa forma funcional (sobre todo en timers/callbacks); no mutar arrays/objetos de estado directamente; un efecto = una responsabilidad; activar/revisar exhaustive-deps (ya está eslint-plugin-react-hooks vía next/core-web-vitals, correr `npm run lint`).

   - quitar alertas de ventana

 Orden:
 1. Vamos a priorizar el estandarizar toda la entrada de datos. Vamos a estandarizar tantos el casing como el naming y arrelgar la carpeta de API entera, para primero entender con los datos con los que tenemos que trabajar.
 2. Crear intefaces para entender con que objetos trabajamos en cada sitio.
 3. Refactor de hooks/data-fetching en los componentes ya con datos tipados: partir el useEffect gigante, arreglar el memory leak del listener, la stale closure del polling, la condición de carrera en property detail, eliminar el useEffect+setState derivado.
 4. Bugs de lógica que dependían de eso: mismatch purchase/purchasePrice, guard incompleto de detail.stats.trend, comparación de selección por id en vez de referencia.
 5. CSS / estética al final, no afecta corrección ni resiliencia.

 Nota: var -> const/let y quitar anys no son una fase aparte, se limpian sobre la marcha en cada archivo que se toca en los pasos 1-4, para no pasar dos veces por el mismo sitio.
