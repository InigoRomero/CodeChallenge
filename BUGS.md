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

4.
Monthly Cashflow sale "$NaN" SIEMPRE que la API responde 200 (no hace falta el 500 random, esto es 100% reproducible). Recargué 5 veces seguidas y las 5 veces salió $NaN en cuanto portfolio-summary no fallaba.

Repro: cargar "/", esperar a que cargue el summary sin el 500 random.
Esperado: un número.
Real: "Monthly Cashflow: $NaN" (o "€NaN" si cambias a EUR).

Causa (mirando el código, pero el síntoma es 100% visible en runtime): en src/data/mockProperties.ts hay una transacción con `amount: Number("N/A")` (txn-012, prop-004, expense). En route.ts de portfolio-summary se suma con `(t.amount ?? t.monto ?? 0)` - como NaN no es null/undefined, el `??` NO lo sustituye por 0, así que totalExpenses da NaN y monthly_cashflow = String(NaN) = "NaN". El front hace Number("NaN").toFixed(2) = "NaN" y lo muestra tal cual, sin ningún guard.

5.
El selector de moneda (USD/EUR) sólo afecta a la sección "Summary". Las tarjetas de propiedades de la lista de abajo siguen mostrando "$" fijo pase lo que pase.

Repro: en "/", cambiar el combo a "EUR (€)".
Esperado: toda la pantalla (summary + lista) se pasa a €.
Real: Summary cambia a "€22260000.00" etc., pero cada property card sigue con "$215.000", "$267.000"... (el símbolo € nunca aparece ahí). Column PropertyCard hardcodea "$" en vez de usar formatMoney/displayCurrency.

6.
Los números con `.toLocaleString()` (property cards y el "$xxx/sqft") salen con formato raro: "$215.000/sqft", "$215.000" en vez de "$215,000". No es que el dato esté mal, es que toLocaleString() sin argumento de locale usa el locale del navegador (navigator.language = "es-ES" en este entorno), así que separa miles con punto en vez de coma, quedando ambiguo con el símbolo "$" delante (parece 215 dólares con 3 decimales, no 215 mil). Confirmado con:
  await page.evaluate(() => navigator.language) => "es-ES"
Esto pasa en la lista de home y en formatMoney (modo "sin céntimos") también.

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

8.
Quick Edit no valida nada, ni en cliente ni en servidor: metí "abc" en "Current Value" y guardó igual (alert "saved!", 200 OK). El property queda con currentValue = "abc" (string no numérico) persistido. Efecto visible: en /property/prop-004 el "12mo trend" pasó de ↑ a ↓ solo por esto (el ROI del server, `(value - purchase)/purchase`, da NaN con "abc" y decide "down" porque `NaN >= 0` es false). No hay ningún mensaje de "valor inválido" en ningún momento.

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

10.
GET /api/properties/list falla ~10% de las veces (500 aleatorio, visto varias veces recargando "/"). Cuando falla, la sección de propiedades queda así, sin ningún error visible:

Your Properties (0)

... pero el Summary de arriba sigue mostrando el Total Worth viejo/agregado (ej. "$22260000.00"), porque viene de otro endpoint que sí tuvo éxito. O sea: pantalla dice "tienes $22 millones en propiedades" y "Your Properties (0)" a la vez, sin mensaje de error ni botón de reintentar.

Console: [ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3000/api/properties/list:0
Network: GET http://localhost:3000/api/properties/list => 500 Internal Server Error

Causa: el .catch del fetch de properties sólo hace console.log(err), properties se queda en el [] inicial, no hay estado de error.

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

12.
Discrepancia de datos entre Home y Detail para la MISMA propiedad: en la home, "Current Value" de una property card es el valor real (currentValue/market_value). En /property/[id], la fila "Current Value" muestra el PURCHASE PRICE, no el valor actual — siempre, con cualquier propiedad, porque `headerValue = detail?.purchase ?? detail?.value_now` nunca cae al segundo operando (purchase siempre viene con valor).

Ejemplo con Sunset Apartments Unit 4B (prop-001), antes de tocar Quick Edit:
Home:            $215.000 (currentValue real)
/property/prop-001 "Current Value": $185000.00 (== Purchase Price, no el currentValue real)

13.
El contador "page refresh counter" en /property/[id] se queda clavado en "1" para siempre (probé esperando 5s reales con browser_wait_for). No sube a 2, 3, etc. aunque el setInterval dispare cada segundo. Es el mismo patrón de stale closure del refreshCount de home (bug ya anotado en AGENDA.md a nivel de código), pero aquí se confirma en runtime: el contador literal se ve roto en pantalla, no es solo un detalle de implementación.

14.
Con un id de propiedad inexistente pero "normal" (ej. /property/does-not-exist), la página se queda PARA SIEMPRE en "Loading property..." con todos los campos financieros en $0, sin ningún mensaje de error ni forma de saber que el id no existe. El fetch a /api/property-details devuelve 404 (o, ~30% de las veces, un 200 con {property:null,status:"not_found"}), pero como no hay .catch ni check de status, detail simplemente nunca se rellena y la UI queda indistinguible de "todavía está cargando".

Network (caso 404):
GET http://localhost:3000/api/property-details?property_id=does-not-exist => 404 Not Found
Console:
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:3000/api/property-details?property_id=does-not-exist:0

15.
Detalle menor: el botón "Save Changes" del Quick Edit muestra siempre alert("saved!") aunque no se haya escrito nada en ninguno de los dos campos (petición PATCH se manda igual con sólo {id: propertyId}, sin value ni income). No hay forma de saber si de verdad se guardó algo o no.