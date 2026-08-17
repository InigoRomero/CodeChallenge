1:
Runtime TypeError


Cannot read properties of undefined (reading 'portfolio')

src/app/page.tsx (56:42) @ Home.useEffect.timer


  54 |       fetch("/api/v1/user/portfolio-summary")
  55 |         .then((r) => r.json())
> 56 |         .then((j) => setPortfolio(j.data.portfolio));
     |                                          ^
  57 |       setRefreshCount(refreshCount + 1);
  58 |     }, 30000);
  59 |
Call Stack
1

Home.useEffect.timer
src/app/page.tsx (56:42)

RESUELTO (paso 6, resiliencia): el `.then(j => setPortfolio(j.data.portfolio))` del polling ahora comprueba `r.ok` antes de parsear (lanza si no) y tiene su propio `.catch` que solo hace `console.log` - un poll fallido ya no revienta nada, simplemente mantiene en pantalla el último valor conocido de `portfolio` y lo intenta de nuevo en el siguiente ciclo de 30s. (El acceso `j.data.portfolio` en sí ya no existe desde el paso 1, que renombró la respuesta a `j.portfolio` - eso ya había eliminado el TypeError original; esto añade además el manejo de fallo de red/500 que faltaba.)

2.
page.tsx:54 
 GET http://localhost:3000/api/v1/user/portfolio-summary 500 (Internal Server Error)
(anonymous)	@	page.tsx:54

3.
Cargando "/" con devtools abierto, si el fetch inicial (no el del timer, el del primer useEffect) de /api/v1/user/portfolio-summary pilla el 500 random, la pantalla NO crashea pero queda rota en silencio:

Total Worth: $NaN
Gain / Loss: NaN%
Properties: (vacío)

Network:
GET http://localhost:3000/api/v1/user/portfolio-summary => 500 Internal Server Error
Console:
[ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3000/api/v1/user/portfolio-summary:0

Lo que pasa: el fetch de mount SÍ tiene .catch, así que no revienta como el del timer (bug 1), pero como el body de error es {ok:false, err_msg:"..."} sin "data", el .then(json => setPortfolio(json.data.portfolio)) tira su propio TypeError "Cannot read properties of undefined (reading 'portfolio')" que cae en el mismo .catch de abajo -> portfolio se queda null -> totalWorth = portfolio?.total_worth + 0 = NaN, gainPercent = NaN. No hay ningún mensaje de error visible para el usuario, la página se ve "cargada" pero con basura. Esperaba algún estado de error o loading, no "$NaN" tal cual en pantalla.

RESUELTO (paso 6, resiliencia): nuevo estado `portfolioStatus: "loading"|"error"|"ready"`. El fetch inicial comprueba `response.ok` y lanza si no; el `.catch` pone `portfolioStatus="error"` en vez de dejar `portfolio` en null en silencio. El render de la sección Summary ahora es un `if/else` real: con `portfolio` -> números; sin `portfolio` y error -> "Couldn't load your portfolio summary. Try reloading the page."; sin `portfolio` y cargando -> "Loading summary...". Verificado con Playwright interceptando la ruta para forzar 500 con localStorage vacío (sin caché que enmascare el error): ya no aparece ningún "$NaN" en ningún sitio, aparece el mensaje.

4.
Monthly Cashflow sale "$NaN" SIEMPRE que la API responde 200 (no hace falta el 500 random, esto es 100% reproducible). Recargué 5 veces seguidas y las 5 veces salió $NaN en cuanto portfolio-summary no fallaba.

Repro: cargar "/", esperar a que cargue el summary sin el 500 random.
Esperado: un número.
Real: "Monthly Cashflow: $NaN" (o "€NaN" si cambias a EUR).

Causa (mirando el código, pero el síntoma es 100% visible en runtime): en src/data/mockProperties.ts hay una transacción con `amount: Number("N/A")` (txn-012, prop-004, expense). En route.ts de portfolio-summary se suma con `(t.amount ?? t.monto ?? 0)` - como NaN no es null/undefined, el `??` NO lo sustituye por 0, así que totalExpenses da NaN y monthly_cashflow = String(NaN) = "NaN". El front hace Number("NaN").toFixed(2) = "NaN" y lo muestra tal cual, sin ningún guard.

RESUELTO (paso 1, normalización de datos): `sumTransactions()` en src/data/normalize.ts usa `Number.isFinite(amount)` en vez de `?? 0` para decidir si el monto es válido, así que un `NaN` (como el de txn-012) cuenta como 0 en vez de contaminar la suma. `monthly_cashflow` ahora es un `number` real (ya no `String(...)`), campo renombrado a `monthlyCashflow`. Root cause arreglada en un solo sitio, no solo en portfolio-summary.

5.
El selector de moneda (USD/EUR) sólo afecta a la sección "Summary". Las tarjetas de propiedades de la lista de abajo siguen mostrando "$" fijo pase lo que pase.

Repro: en "/", cambiar el combo a "EUR (€)".
Esperado: toda la pantalla (summary + lista) se pasa a €.
Real: Summary cambia a "€22260000.00" etc., pero cada property card sigue con "$215.000", "$267.000"... (el símbolo € nunca aparece ahí). Column PropertyCard hardcodea "$" en vez de usar formatMoney/displayCurrency.

RESUELTO (paso 5, estética): `formatMoney` centralizado en src/lib/formatMoney.ts, usado por Home (Summary, modal Y PropertyCard) y por Detail. `PropertyCardProps` ahora recibe `displayCurrency` desde Home. Verificado: al cambiar el combo a EUR, tanto el Summary como cada card cambian a "€" (mismo comportamiento "solo cambia el símbolo, no convierte el número" que ya tenía Summary - seguimos sin tabla de FX, ver bug 19).

6.
Los números con `.toLocaleString()` (property cards y el "$xxx/sqft") salen con formato raro: "$215.000/sqft", "$215.000" en vez de "$215,000". No es que el dato esté mal, es que toLocaleString() sin argumento de locale usa el locale del navegador (navigator.language = "es-ES" en este entorno), así que separa miles con punto en vez de coma, quedando ambiguo con el símbolo "$" delante (parece 215 dólares con 3 decimales, no 215 mil). Confirmado con:
  await page.evaluate(() => navigator.language) => "es-ES"
Esto pasa en la lista de home y en formatMoney (modo "sin céntimos") también.

RESUELTO (paso 5, estética): `formatMoney` (src/lib/formatMoney.ts) fuerza `toLocaleString("en-US", ...)` en vez de dejar que el navegador decida el locale. De propina, ahora TAMBIÉN se aplican separadores de miles en modo "con céntimos" (antes usaba `toFixed(2)` sin locale ninguno: "$1875000.00" -> ahora "$1,875,000.00"), y se unificó con el formatter separado que tenía property/[id]/page.tsx ("different formatter than the home page on purpose (nobody noticed)" - ya no hay dos implementaciones divergentes).

7.
PATCH /api/properties/update tiene un bug de "último campo gana" bastante grave: tanto el value como el income terminan escribiendo en el MISMO campo (currentValue) del objeto en memoria. El income nunca se guarda en ningún sitio.

route.ts:
  if (body.value !== undefined) { prop.currentValue = body.value; }
  if (body.income !== undefined) { prop.currentValue = body.income; }

Repro:
1. Ir a /property/prop-001 (Sunset Apartments, currentValue real = 215000).
2. Quick Edit -> Current Value: 999000, Monthly Income: 5000 -> Save Changes -> alert "saved!".
3. Volver a "/": Sunset Apartments ahora tiene currentValue = "5000" (el income pisó al value), NO 999000 ni 215000. En la lista sale literalmente "$5000/sqft" y "$5000" de precio.
4. Bonus: como currentValue ahora es el STRING "5000" (los inputs nunca se parsean a Number, ni en el front ni en el backend), el reduce de "Avg. Property Value" en home hace concatenación de strings en vez de suma:
   Avg. Property Value: $7.143238571925715e+38
   (0 + "5000" -> "05000" string, luego se van concatenando el resto de currentValue numéricos, y al dividir por properties.length se fuerza a Number ese string gigante -> notación científica absurda).
Esto persiste entre reloads porque muta el array RAW_PROPERTIES del servidor directamente (estado compartido en memoria, sin "reset").

RESUELTO (paso 1, normalización de datos): route.ts de properties/update ya no escribe income en `currentValue`. Se añadió `monthlyIncomeOverride?: number` a `RawPropertyRow` (src/data/mockProperties.ts) y el income se persiste ahí; `getMonthlyIncome()` en normalize.ts lo usa con prioridad sobre la suma de transacciones. También se parsean ambos campos con `Number(...)` antes de guardar (ver bug 8), así que el "bonus" de concatenación de strings en Avg. Property Value ya no puede ocurrir con datos escritos desde ahora en adelante.

8.
Quick Edit no valida nada, ni en cliente ni en servidor: metí "abc" en "Current Value" y guardó igual (alert "saved!", 200 OK). El property queda con currentValue = "abc" (string no numérico) persistido. Efecto visible: en /property/prop-004 el "12mo trend" pasó de ↑ a ↓ solo por esto (el ROI del server, `(value - purchase)/purchase`, da NaN con "abc" y decide "down" porque `NaN >= 0` es false). No hay ningún mensaje de "valor inválido" en ningún momento.

PARCIALMENTE RESUELTO (paso 1, lado servidor): route.ts de properties/update ahora hace `Number(body.value)`/`Number(body.income)` y responde 400 `{ok:false, reason:"invalid value"|"invalid income"}` si no es finito, en vez de persistir el string tal cual.
RESUELTO (paso 3, lado cliente): property/[id]/page.tsx ahora comprueba `res.ok`/`body.ok` de la respuesta del PATCH y muestra el `reason` del servidor en pantalla (ver bug 15) en vez de asumir éxito. Sigue sin validar el input ANTES de enviarlo (podrías seguir mandando "abc" y ver el mensaje de error del servidor tras el POST, en vez de que el campo se marque inválido al momento) - validación de formulario en el propio input queda fuera de alcance, es una mejora de UX no un bug de datos.

9.
En /property/[id], "Monthly Expenses" y "Net Cashflow" pueden mostrar un número con pinta de válido pero completamente inventado, en vez de un error visible. Ejemplo con prop-004 (Riverside Cottage), reproducible siempre (no es random):

GET /api/property-details?property_id=prop-004 =>
{
  "property": {
    "purchase": 240000,
    "value_now": 267000,
    "rent": 1900,
    "costs": null,   <- esto debería ser un número
    ...
  }
}

En pantalla:
Monthly Expenses: $0
Net Cashflow: $-238100.00   <- esto NO es 1900 - 0

Lo que pasa: internamente costs da NaN (por la misma transacción rota txn-012 de arriba), pero NextResponse.json()/JSON.stringify convierte NaN en null en el JSON (así que ni siquiera se ve el NaN, se ve null). El front calcula `cashflow = (detail?.rent || 0) - (detail?.costs || detail?.purchase || 0)`, y como costs es null (falsy), cae al fallback `detail?.purchase` (240000) como si fuera el gasto mensual. Resultado: Net Cashflow = 1900 - 240000 = -238100, un número con pinta de real pero completamente falso, sin ningún indicio visual de que algo falló.

PARCIALMENTE RESUELTO (paso 1, normalización de datos): la causa raíz (NaN por Number("N/A") en txn-012, que luego JSON.stringify convertía en null) está arreglada de origen con el mismo `sumTransactions()` NaN-safe del bug 4 — `monthlyExpenses` (antes `costs`) para prop-004 ya no es `NaN`/`null`, es 780 (número real). Sigue existiendo el bug de lógica en el componente: `(detail?.monthlyExpenses || detail?.purchasePrice || 0)` cae igualmente al purchase price como "gasto mensual" para CUALQUIER propiedad con 0 gastos reales (ej. prop-006, que no tiene transacciones) porque `0` es falsy. Ese fallback vive en property/[id]/page.tsx y su arreglo (quitar el `|| detail?.purchasePrice`) es lógica de componente, fuera del alcance del paso 1 - queda para el paso 4 (bugs de lógica) del AGENDA.

10.
GET /api/properties/list falla ~10% de las veces (500 aleatorio, visto varias veces recargando "/"). Cuando falla, la sección de propiedades queda así, sin ningún error visible:

Your Properties (0)

... pero el Summary de arriba sigue mostrando el Total Worth viejo/agregado (ej. "$22260000.00"), porque viene de otro endpoint que sí tuvo éxito. O sea: pantalla dice "tienes $22 millones en propiedades" y "Your Properties (0)" a la vez, sin mensaje de error ni botón de reintentar.

Console: [ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3000/api/properties/list:0
Network: GET http://localhost:3000/api/properties/list => 500 Internal Server Error

Causa: el .catch del fetch de properties sólo hace console.log(err), properties se queda en el [] inicial, no hay estado de error.

RESUELTO (paso 6, resiliencia): nuevo estado `propertiesStatus: "loading"|"error"|"ready"`. El fetch comprueba `response.ok`; si falla, se muestra una franja roja "Couldn't load your properties." con botón "Retry" (dispara un `reloadPropertiesToken` que el useEffect tiene en sus deps, sin recargar la página). Verificado con Playwright forzando 500: aparece el mensaje + Retry, y al quitar el fallo y pulsar Retry la lista de 6 propiedades aparece sin recargar. El listener de "focus" y el problema de fondo del Summary desincronizado con la lista (bug de UX, no de datos) siguen igual - solo se cubrió la carga inicial, que es donde vivía el bug documentado.

11.
/property/never crashea SIEMPRE (100% reproducible, no es random). Pantalla en blanco + overlay de Next.js:

Runtime TypeError
Cannot read properties of undefined (reading 'trend')
src/app/property/[id]/page.tsx (60:45) @ PropertyDetailPage

> 60 | const trendLabel = detail && detail.stats.trend.direction;

Console:
TypeError: Cannot read properties of undefined (reading 'trend')
    at PropertyDetailPage (http://localhost:3000/_next/static/chunks/_a92b4703._.js:86:47)
    at Object.react_stack_bottom_frame (...)
    ... (stack completo de react-dom, recortado)

Network:
GET http://localhost:3000/api/property-details?property_id=never => 404 Not Found
GET http://localhost:3000/api/legacy/portfolio => 200 OK

Causa: para propertyId === "never" el código pide /api/legacy/portfolio y hace setDetail(d.result.assets[0]). Ese endpoint devuelve un shape totalmente distinto ({uuid, label, addr, boughtFor, worth}), SIN "stats" en absoluto. detail queda truthy pero sin .stats, y detail.stats.trend explota en el render. Toda la página muere (no hay error boundary), no solo esa línea.

PARCIALMENTE RESUELTO (paso 3, hooks): la condición de carrera de fondo (el código original pedía property-details Y legacy/portfolio a la vez para propertyId === "never", y el que respondiera último pisaba el setDetail del otro - por eso el crash no era realmente "no-random" en el sentido estricto, dependía de qué fetch ganara) está arreglada: ahora es un if/else, solo se pide un endpoint u otro según el id, con flag `ignore` en el cleanup para descartar respuestas tardías si el id cambia otra vez antes de que resuelva. El crash en sí (guard incompleto de `detail.stats.trend`) sigue intacto a propósito - sigue siendo bug de lógica del paso 4 del AGENDA, no de hooks.

RESUELTO (paso 4, bugs de lógica): `detail.stats!.trend.direction` → `detail?.stats?.trend.direction ?? null`, con el "12mo trend" mostrando "N/A" cuando no hay stats en vez de asumir "↓". Ya NO crashea en /property/never. De propina, este mismo guard incompleto también crasheaba en cualquier propiedad con `analytics: null` (ej. prop-006, Lakeview Studio) - no solo en el caso "never" que documentaba este bug; verificado que ahora tampoco crashea ahí ("12mo trend: N/A").

Importante: arreglar el guard NO arregla el problema de fondo de "never" - sigue pidiendo /api/legacy/portfolio (un endpoint con un shape totalmente distinto, pensado para otro consumidor) para un id que no existe. Sin crash, ahora se ve basura silenciosa: título clavado en "Loading property...", "Current Value: $NaN", "ROI: NaN%". Es decir, cambió de "página rota visiblemente" a "página con datos falsos sin ningún aviso" - mismo patrón que el bug 9. El propio "never" como caso especial es un gancho de test/debug sin ningún propósito de producto (ningún id real será jamás "never"); no lo he quitado porque no estaba pedido en ningún paso del AGENDA, pero probablemente no debería existir en el código final.

12.
Discrepancia de datos entre Home y Detail para la MISMA propiedad: en la home, "Current Value" de una property card es el valor real (currentValue/market_value). En /property/[id], la fila "Current Value" muestra el PURCHASE PRICE, no el valor actual — siempre, con cualquier propiedad, porque `headerValue = detail?.purchase ?? detail?.value_now` nunca cae al segundo operando (purchase siempre viene con valor).

Ejemplo con Sunset Apartments Unit 4B (prop-001), antes de tocar Quick Edit:
Home:            $215.000 (currentValue real)
/property/prop-001 "Current Value": $185000.00 (== Purchase Price, no el currentValue real)

RESUELTO (paso 4, bugs de lógica): `headerValue = detail?.purchasePrice ?? detail?.currentValue` → `detail?.currentValue ?? detail?.purchasePrice` (orden invertido). Verificado en prop-001: "Current Value" ahora muestra $215000.00 (coincide con el home), "Purchase Price" sigue en $185000.00 (fila separada, correcta). De propina, ROI pasó de dar siempre 0.0% (porque restaba purchasePrice de sí mismo) a calcular de verdad: 16.2% en prop-001.

13.
El contador "page refresh counter" en /property/[id] se queda clavado en "1" para siempre (probé esperando 5s reales con browser_wait_for). No sube a 2, 3, etc. aunque el setInterval dispare cada segundo. Es el mismo patrón de stale closure del refreshCount de home (bug ya anotado en AGENDA.md a nivel de código), pero aquí se confirma en runtime: el contador literal se ve roto en pantalla, no es solo un detalle de implementación.

RESUELTO (paso 3, hooks): eliminado por completo (interval, estado `tick` y el párrafo "page refresh counter"), no arreglado - el propio código lo marcaba con "(dont ask why this exists)" y no alimentaba nada más en la página; AGENDA.md ya decía "Eliminar" para este timer, no "corregir el stale closure". El patrón de stale closure real (`setRefreshCount(refreshCount + 1)` en home) sí se corrigió con forma funcional, porque ese contador sí se muestra con intención ("auto-refresh count").

14.
Con un id de propiedad inexistente pero "normal" (ej. /property/does-not-exist), la página se queda PARA SIEMPRE en "Loading property..." con todos los campos financieros en $0, sin ningún mensaje de error ni forma de saber que el id no existe. El fetch a /api/property-details devuelve 404 (o, ~30% de las veces, un 200 con {property:null,status:"not_found"}), pero como no hay .catch ni check de status, detail simplemente nunca se rellena y la UI queda indistinguible de "todavía está cargando".

Network (caso 404):
GET http://localhost:3000/api/property-details?property_id=does-not-exist => 404 Not Found
Console:
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:3000/api/property-details?property_id=does-not-exist:0

RESUELTO (paso 6, resiliencia): nuevo estado `detailStatus: "loading"|"not_found"|"error"|"ready"`. El fetch trata el 404 Y el 200 `{property:null}` como el mismo caso "not_found" (no como error de red); cualquier otro fallo (status !ok o excepción) es "error". El título pasa a "Property not found" o "Couldn't load this property" según el caso, con un botón "Back to portfolio" para el not_found, y las secciones "Financial Overview"/"Quick Edit" ya no se renderizan en absoluto sin `detail` real (antes mostraban $0 en todos los campos, dando la falsa impresión de una propiedad válida con valores en cero). Verificado en navegador: /property/does-not-exist ya muestra "Property not found" en vez de quedarse en "Loading property..." para siempre.

15.
Detalle menor: el botón "Save Changes" del Quick Edit muestra siempre alert("saved!") aunque no se haya escrito nada en ninguno de los dos campos (petición PATCH se manda igual con sólo {id: propertyId}, sin value ni income). No hay forma de saber si de verdad se guardó algo o no.

RESUELTO (paso 3, hooks/CLAUDE.md "fuera los window.alert"): quitado el `alert("saved!")`. El handler ahora comprueba `res.ok` y `body.ok` de la respuesta y guarda el resultado en un estado `saveStatus`, que se renderiza como texto bajo el botón ("Saved." en verde, o el `reason` del servidor en rojo si falla/valor inválido). Sigue mandando el PATCH aunque no se haya tocado ningún campo (eso es un comportamiento distinto, no cubierto por este bug - el mensaje en pantalla ahora al menos refleja si el servidor realmente aceptó el cambio).

--- Bugs nuevos encontrados durante el paso 1 (normalización de datos) ---

16.
[NUEVO - encontrado leyendo properties/list route.ts durante el paso 1] La propiedad soft-deleted "prop-002-dup" (Oak Street Duplex, is_active: 0, duplicado de prop-002) no se filtraba en ningún agregador: aparecía en "Your Properties" como entrada duplicada, y su currentValue/purchasePrice se sumaba en Total Worth/Total Invested/Avg. Property Value junto con el original activo. El propio código lo señalaba con un comentario `// NOTE: doesn't filter is_active/activo` pero nunca se llegó a arreglar.

RESUELTO (paso 1): `getActiveProperties()` en src/data/normalize.ts filtra por `is_active`/`activo` (con fallback a "activo" si ninguno de los dos campos viene informado) antes de normalizar. Lo usan properties/list, portfolio-summary y legacy/portfolio por igual, así que el filtrado es consistente entre los tres.

17.
[NUEVO - encontrado leyendo legacy/portfolio route.ts durante el paso 1] Ese endpoint leía `p.currentValue`/`p.purchasePrice`/`p.name`/`p.address`/`p.id` directamente sobre RAW_PROPERTIES, ignorando por completo los sinónimos del sistema español (`valor_actual`, `precio_compra`, `nombre`, `direccion`/`ciudad`, `property_id`). Las propiedades PROP-002 (Oak Street Duplex) y PROP-005 (Harbor View Condo) - ambas dadas de alta solo con campos en español - se devolvían como `{uuid: undefined, label: undefined, addr: undefined, boughtFor: undefined, worth: undefined}`, y su valor no se sumaba en `netWorth`. No estaba capturado en ningún repro anterior porque el único consumidor actual de este endpoint (el fallback de propertyId === "never" en property/[id]/page.tsx) solo lee `assets[0]`, que siempre resuelve a prop-001 (sistema US, sin este problema).

RESUELTO (paso 1): legacy/portfolio ahora construye `assets`/`netWorth` a partir de `getActiveProperties()` (mismos datos normalizados que el resto de endpoints), manteniendo el contrato de salida legacy (`uuid/label/addr/boughtFor/worth`) sin cambios para no romper al consumidor actual.

18.
[NUEVO - encontrado leyendo property/[id]/page.tsx durante el paso 1, no lo arreglo por ser hueco de producto y no de naming] "Cash-on-Cash Return" en /property/[id] muestra siempre "NaN%": `cashOnCash = ((cashflow * 12) / detail?.downPayment) * 100` usa `detail?.downPayment`, un campo que no existe en ningún RAW_* ni en ningún endpoint - no hay ningún concepto de "down payment"/entrada financiada modelado en los datos. A diferencia de purchase/purchasePrice (bug de naming, mismo dato con nombre distinto), aquí simplemente no hay dato que normalizar: haría falta decidir de producto qué significa "down payment" en este dominio (¿% fijo? ¿campo nuevo por propiedad?) antes de poder calcularlo. Queda como limitación conocida para el write-up final.

19.
[NUEVO - encontrado leyendo portfolio-summary route.ts durante el paso 1, no lo arreglo por falta de fuente de datos] Total Worth/Total Invested/Monthly Cashflow agregados suman `currentValue`/`purchasePrice`/transacciones de propiedades en USD y EUR (prop-004 es EUR, el resto USD) como si fueran la misma unidad, sin ninguna conversión de moneda. No hay ninguna tabla de tipo de cambio en mockProperties.ts ni en ningún otro sitio del proyecto. El selector de moneda del home (bug 5) tampoco lo soluciona porque solo formatea con otro símbolo, no convierte el valor numérico. Limitación conocida, requiere una fuente de FX rates que hoy no existe - queda para el write-up.

20.
[NUEVO - encontrado en page.tsx (PropertyCard) durante el paso 2, tipando props] El "$xxx/sqft" de cada property card en el home no es un precio por metro/pie cuadrado real: `props.squareFeet` no existe en ningún RAW_*, endpoint ni interfaz - nunca se ha modelado superficie en ningún sitio del proyecto. El código cae siempre al fallback `props.squareFeet || 1`, así que ese número es literalmente el precio total de la propiedad otra vez, con "/sqft" pegado al lado (ej. "$215.000/sqft" en Sunset Apartments, un piso normal, no 215.000 el pie cuadrado). Al tipar PropertyCardProps se hizo explícito: `squareFeet?: number` queda como opcional porque hoy nunca llega, no por elección de UI. No lo arreglo aquí (quitar la línea o la lógica es cambio de render, fuera del alcance de tipado); requiere decisión de producto (¿se añade squareFeet a los datos, o se quita el dato de la card?).