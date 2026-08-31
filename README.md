# prueba

MVP de un sistema de planificación de transporte. Monorepo con pnpm workspaces.

## Stack

| Capa       | Tecnología                              |
| ---------- | --------------------------------------- |
| Lenguaje   | TypeScript                              |
| Backend    | NestJS + GraphQL (code-first, Apollo)   |
| Frontend   | Next.js                                 |
| Base datos | MongoDB (vía Mongoose)                  |
| Mapa       | Leaflet + OpenStreetMap (react-leaflet) |

## Estructura

```
backend/    NestJS API (GraphQL en /graphql)
frontend/   Next.js app
```

## Setup

```bash
pnpm install
```

Copia `backend/.env.example` a `backend/.env` y ajusta `MONGODB_URI` si tu Mongo local no corre en el default (`mongodb://localhost:27017/prueba`).

### Datos de ejemplo

```bash
pnpm --filter backend seed
```

Crea 5 unidades, 4 rutas (por la zona de Caracas) y 5 turnos, usando los mismos use cases que
usa la API — así que la data respeta todas las reglas de negocio, incluida la de no-solapamiento.
Si la base ya tiene unidades cargadas, el script no hace nada (para no duplicar); borrá las
colecciones `units`, `routes` y `duties` a mano si querés volver a correrlo desde cero.

## Desarrollo

```bash
# Backend (http://localhost:3001, GraphQL playground en /graphql)
pnpm --filter backend start:dev

# Frontend (http://localhost:3000)
pnpm --filter frontend dev
```

## Documentación de la API

No hay Swagger ni OpenAPI en este proyecto **a propósito, no por omisión**: ambos son formatos
pensados para describir múltiples endpoints REST (rutas, verbos, códigos de estado por endpoint), y
acá no hay ninguno — toda la API es un solo endpoint GraphQL (`/graphql`), así que OpenAPI no tiene
qué describir.

Lo que GraphQL usa en su lugar es su propio mecanismo de introspección: el schema completo (tipos,
inputs, queries, mutations) es auto-descriptivo y consultable en tiempo real. Con el backend
corriendo, **Apollo Sandbox en `http://localhost:3001/graphql`** es el equivalente exacto a Swagger
UI — muestra cada tipo, cada campo, cada query/mutation con su firma, y permite ejecutar requests de
prueba directo desde el navegador.

Además, cada tipo, campo, query y mutation del schema tiene una descripción escrita a mano (vía el
parámetro `description` de los decoradores `@ObjectType`/`@Field`/`@Query`/`@Mutation` de NestJS),
que aparece en el explorador de Apollo Sandbox igual que una descripción de endpoint en Swagger — por
ejemplo, `createDuty` documenta ahí mismo que lanza `dutyOverlap` si la unidad ya tiene un turno en
esa ventana. El archivo generado (`backend/src/schema.gql`, gitignored porque se regenera solo al
levantar el backend) es la fuente de verdad del contrato de la API.

## Calidad

```bash
pnpm format        # Prettier — todo el repo (agent_docs, README, backend/, frontend/)
pnpm format:check

pnpm --filter backend lint    # oxlint
pnpm --filter backend build   # typecheck + build
pnpm --filter backend test

pnpm --filter frontend lint   # ESLint
pnpm --filter frontend build  # typecheck + build
pnpm --filter frontend test   # Vitest + React Testing Library
```

## Convenciones

Ver `CLAUDE.md` y `agent_docs/` (arquitectura hexagonal en el backend, capas + Atomic Design en el
frontend).

## Qué construí

Un sistema de planificación de transporte con tres entidades: **rutas** (lista ordenada de puntos
geográficos), **unidades** (vehículo + conductor asignado) y **duties** (una ruta + una unidad + una
ventana horaria).

- **La regla central**: una unidad nunca puede tener dos duties con ventanas de tiempo solapadas —
  **ni siquiera bajo requests concurrentes**. Se garantiza con una operación atómica de MongoDB
  sobre un solo documento (`Unit.findOneAndUpdate` con un filtro de exclusión), no con una
  transacción ni con un lock en memoria — por lo que la garantía se sostiene aunque corran varias
  instancias del backend. Probado con 5 requests simultáneos a nivel de repositorio y a nivel
  HTTP/GraphQL completo.
- **Borrar una ruta o unidad con duties activos se bloquea**, no se hace en cascada — hay que sacar
  los duties primero.
- **Frontend**: lista y creación de unidades y rutas, detalle de ruta con mapa (Leaflet +
  OpenStreetMap, sin API key), tabla de duties de esa ruta (conductor, descripción opcional, hora
  de partida/llegada) con asignar/editar/borrar, y el error de solapamiento como mensaje específico
  (toast), no un error genérico.
- **Estado de una ruta (activa/inactiva)** mostrado como badge en la lista de rutas — calculado a
  partir de si tiene duties asignados (`dutyCount > 0`), no un campo guardado aparte que haya que
  mantener sincronizado.
- **Toda la interfaz en español**, con notificaciones toast para errores de acciones (crear, editar,
  borrar), validación de campo mostrada junto al campo que falló, y un modal de confirmación propio
  (en vez del `confirm()` nativo del navegador) antes de borrar una ruta, unidad o turno.
- **Tests**: dominio puro (reglas de solapamiento, entidades), casos de uso con repositorios
  mockeados, integración contra MongoDB real, y el test de concurrencia (repositorio + HTTP/GraphQL
  completo) que prueba la garantía central. En el frontend, componentes probados con Vitest +
  Testing Library, mockeando en el borde de Apollo Client.
- **Script de datos de ejemplo** (`pnpm --filter backend seed`, ver sección "Datos de ejemplo" más
  abajo) para que la app no arranque vacía — pasa por los mismos use cases que la API real, así que
  la data respeta todas las reglas de negocio, incluida la de no-solapamiento.

## Concurrencia y casos borde — qué queda protegido y qué no

No todos los casos borde de los use cases tienen el mismo nivel de dureza. Se endureció al máximo
la única invariante que el ejercicio pide garantizar bajo concurrencia; el resto de las validaciones
son las normales de un caso de uso, sin la misma protección atómica. Referencia completa, caso de
uso por caso de uso (inputs, todos los errores que puede lanzar, y qué cubre cada uno) en
[`agent_docs/backend/use-cases.md`](agent_docs/backend/use-cases.md).

**Lo que sí está cubierto en todos los use cases:**

- Validación de dominio con defensa en profundidad: `InvalidDutyWindowError` (`endsAt <= startsAt`),
  `InvalidRoutePointError` (coordenadas fuera de rango) — el dominio revalida esto aunque el
  frontend ya lo valide con Zod, porque un cliente GraphQL directo puede saltarse el frontend.
- Errores "no encontrado" consistentes (`RouteNotFoundError`, `UnitNotFoundError`,
  `DutyNotFoundError`) antes de operar sobre un id que no existe.
- Integridad referencial al crear/editar un duty: se valida que la ruta y la unidad referenciadas
  existan de verdad antes de guardar (evita duties huérfanos apuntando a nada).
- Rollback en el camino de escritura de `Duty`: si la reserva atómica de `busyWindows` tiene éxito
  pero el segundo write (persistir el documento `Duty`) falla, se libera la reserva para no dejar
  una unidad bloqueada por un duty que nunca se llegó a guardar. En `UpdateDutyUseCase` esto se
  maneja dos veces: si falla la nueva reserva se revierte a la ventana vieja, y si esa reversión en
  sí falla, se lanza un error específico (`DutyReservationLostError`) en vez de tragarse el fallo.

**Lo que NO tiene el mismo nivel de dureza (limitaciones conocidas, no descubiertas después):**

- **El bloqueo de borrado (ruta/unidad con duties activos) no es atómico.** Es un chequeo
  secuencial — "¿tiene duties activos? → si no, borrar" — sin garantía a nivel de documento como la
  del guard de solapamiento. Existe una ventana de carrera teórica: si se crea un duty para esa
  ruta/unidad justo entre el chequeo y el borrado, el borrado podría ejecutarse igual, dejando un
  duty huérfano. No se le dio el mismo tratamiento atómico porque no era el requisito que el
  ejercicio pedía endurecer; para el volumen de un MVP es un riesgo aceptado, no ignorado.
- **Edición concurrente del mismo duty por dos usuarios.** No hay control de concurrencia optimista
  (versión/timestamp) — si dos personas editan el mismo duty a la vez, gana el último write sin
  aviso de que se pisó el cambio del otro. Es un tipo de concurrencia distinto al que protege el
  guard de solapamiento (ahí compiten dos duties distintos por el mismo slot de una unidad; acá es
  el mismo registro editado dos veces) y tampoco está cubierto.
- **`DeleteDutyUseCase`** borra el documento `Duty` primero y **después** libera la ventana
  (`$pull` de `busyWindows`) en la unidad. Si el segundo paso falla después de que el primero tuvo
  éxito, queda una inconsistencia real: el duty ya no existe (no aparece en ningún listado), pero la
  unidad sigue "ocupada" para ese horario para siempre, porque nada más limpia una reserva huérfana
  — no hay rollback ni test que pruebe recuperación en ese punto específico.

## Qué dejé fuera conscientemente

- **Autenticación/autorización.** El brief no la pidió y no hay un caso de uso claro de roles/login
  todavía — agregarla sin eso sería inventar alcance que nadie definió.
- **Visualización gráfica de conflictos** (mencionada como opcional en el spec). El requisito real —
  que el conflicto se rechace y se avise — está cubierto; mostrarlo en el mapa o un timeline es una
  mejora de UX, no una garantía de datos.
- **Sistema de i18n real** (`next-intl`, `react-i18next`, etc.). El texto en español está escrito
  directamente en los componentes. Para un solo idioma no vale la pena la infraestructura extra; si
  el producto necesitara varios idiomas de verdad, ahí sí lo agregaría.
- **CI/CD.** No hay pipeline que corra tests automáticamente en cada push — se corrieron localmente
  y se verificaron antes de cada merge, pero no hay gate automático en GitHub.
- **Selección de puntos de ruta haciendo click en el mapa.** Hoy es una lista de filas lat/lng
  editables a mano — suficiente para el core, mencionado en el spec como mejora futura razonable.
- **Servicio de mapas de producción** (Mapbox, Google Maps). Uso OpenStreetMap gratis, que alcanza
  para el MVP pero tiene límites de uso que no serían aceptables con tráfico real.
- **Paginación en las listas.** `/routes` y `/units` traen todos los registros de una — bien para un
  MVP con pocos datos, no escala a miles de registros.

## Qué haría distinto con más tiempo

- Mostrar en el mensaje de solapamiento **cuál** es el duty conflictivo (el backend ya devuelve su
  id; el frontend hoy lo descarta y muestra un mensaje genérico de "ya está ocupado"), y una
  visualización simple del conflicto en el mapa o en una vista de calendario por unidad.
- Nivelar la cobertura de tests del frontend — algunos organismos solo prueban 1-2 de sus casos
  (por ejemplo, los estados de loading/error de un componente están cubiertos de forma dispareja).
- CI con GitHub Actions corriendo build/lint/test en cada PR, no solo localmente.
- Paginación o scroll infinito en las listas si el volumen de datos creciera.
- Reconsiderar si `busyWindows` debería seguir embebido en `Unit` o pasar a una colección aparte si
  el volumen de duties por unidad creciera mucho — hoy es la elección correcta para el volumen de un
  MVP, pero un array que crece sin límite dentro de un documento tiene un techo práctico en MongoDB
  (16MB por documento).
- **Control de concurrencia optimista** en las actualizaciones (`UpdateRouteUseCase`,
  `UpdateUnitUseCase`, `UpdateDutyUseCase` para campos que no son la ventana horaria). Hoy dos
  personas editando el mismo registro a la vez resuelven en "gana el último write" sin ningún
  aviso — un campo de versión permitiría detectar el conflicto y avisarle al segundo usuario en vez
  de pisar el cambio del primero en silencio. Es un tipo de concurrencia distinto al que sí está
  endurecido (el guard de solapamiento protege dos duties compitiendo por el mismo slot; esto es el
  mismo registro editado dos veces).
- **Manejo explícito de zona horaria.** Hoy las fechas de un duty se toman tal cual las entrega el
  navegador del usuario (`datetime-local` interpretado en su hora local) y se guardan en UTC, sin
  fijar ni mostrar una zona horaria de referencia en ningún punto de la UI. Funciona bien mientras
  todos los que usan la app estén en la misma zona horaria, pero para operar rutas en varias
  ciudades a la vez esto se vuelve un problema real — dos personas en zonas distintas verían
  "la misma hora" de forma diferente sin saberlo.

## Imagenes del sistema MVP
  <img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/c631dc65-46cc-44e2-9326-01bdc2ec8932" />
  <img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/23ff079a-1b7b-4780-8b87-73d04fdbecc0" />
  <img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/d31b387c-e1e0-4234-9962-5ee58b6f4e0e" />



