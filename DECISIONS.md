# Bitácora de decisiones

Este documento cuenta cómo se construyó el MVP: qué propuso la IA (Claude) y acepté tal cual, dónde
corregí o rechacé una propuesta y por qué, y qué decisiones de arquitectura tomé yo. El código lo
escribió principalmente la IA (yo dirigí el proceso, aprobé el diseño por secciones y revisé los
resultados en los puntos de control), así que el criterio que quiero mostrar acá es justamente eso:
qué decidí, qué cuestioné, y qué dejé pasar porque el argumento era sólido.

## Cómo se trabajó

Usé un proceso de **desarrollo dirigido por sub-agentes**: por cada tarea del plan, un agente
implementador nuevo (sin memoria de las tareas anteriores) escribe el código y los tests, y después
un agente revisor —también nuevo, sin haber visto la implementación— audita esa tarea contra el
spec. Al terminar todas las tareas de una fase (backend, después frontend), un revisor final más
exigente audita toda la rama junta buscando inconsistencias que solo aparecen al ver el conjunto.
Elegí este proceso a propósito en vez de pedirle a la IA que escribiera todo de corrido sin
controles: quería que cada pieza pasara por un segundo par de ojos antes de mergear, incluso siendo
todo IA.

## Decisiones de arquitectura que tomé yo

- **GraphQL en vez de REST** para la capa de API. Lo pedí explícitamente desde el arranque del
  proyecto, antes de que se escribiera una línea de código.
- **Arquitectura hexagonal en el backend** (dominio puro sin dependencias de framework, casos de
  uso, adaptadores de infraestructura) y **Atomic Design en el frontend**. Eran los patrones que ya
  traía de otro proyecto mío y pedí que se adaptaran a este stack (Mongoose en vez de
  Postgres/Drizzle, GraphQL en vez de REST, sin CQRS).
- **Agregué el campo `driverName` a `Unit`** durante el diseño — la propuesta inicial de la IA no lo
  tenía, y me pareció que una unidad sin conductor asignado no tenía sentido para el caso de uso.
- **La regla de no-solapamiento se decide por unidad, no por ruta.** Le pregunté explícitamente qué
  pasa si la misma unidad tiene un duty y le asignan otro a la misma hora en una ruta distinta — la
  respuesta correcta (y la que se implementó) es que se rechaza igual, porque el recurso escaso es
  el vehículo, no la ruta.
- **Bloquear el borrado en vez de cascada.** Cuando la IA presentó las dos opciones para
  borrar una ruta o unidad con duties activos (bloquear vs. borrar en cascada), pedí que me
  explicara el tradeoff antes de decidir. Elegí bloquear: borrar en cascada un duty como efecto
  secundario de borrar su ruta/unidad me pareció peligroso — un duty representa trabajo real
  asignado, no algo para descartar silenciosamente.
- **Todos los identificadores en inglés, sin excepción**, aunque toda la conversación y la UI final
  quedaran en español. Lo dejé como regla dura desde el principio del proyecto porque es la
  convención que uso en mis otros repos.
- **Worktrees aislados + merge local, no push directo a `main`.** En cada fase grande (backend,
  frontend) pedí que el trabajo se hiciera en una rama aislada y que se me presentaran las opciones
  de merge al terminar — elegí mergear localmente después de verificar tests, no subir un PR ni
  pushear directo.

## Dónde acepté lo que la IA propuso

- El mecanismo central de concurrencia: un `findOneAndUpdate` atómico sobre el array
  `busyWindows` embebido en `Unit`, en vez de una transacción multi-documento o un mutex en memoria.
  Me presentaron las tres opciones con sus tradeoffs (transacciones necesitan replica set; un mutex
  no sobrevive a múltiples instancias del backend) y la lógica me convenció sin pedir cambios.
- El schema GraphQL completo (tipos, inputs, queries, mutations) tal como se propuso en el diseño.
- El plan de implementación de 15 tareas para el backend y 8 para el frontend, con su desglose de
  archivos y tests — los aprobé como estaban antes de empezar a ejecutar.
- Instalar `sonner` para los toasts en vez de construir un sistema propio desde cero — me pareció
  razonable no reinventar algo tan estándar.

## Dónde corregí o rechacé

- **Traducir toda la interfaz a español y mover los errores de mutación a toast.** El MVP original
  se construyó en inglés con errores inline (siguiendo el spec técnico, que decía explícitamente
  "no un toast genérico"). Después, ya con la app funcionando, decidí que para el uso real quería
  todo en español y los errores de acción (crear/editar/borrar) como toast — más visibles que un
  párrafo rojo en medio del formulario. Los errores de validación de campo (ej. "el nombre es
  obligatorio") los dejé inline a propósito: ahí sí quiero que el usuario vea el error pegado al
  campo que falló, no en una notificación que puede perderse.
- **Reemplazar el `confirm()` nativo del navegador por un modal propio.** El diálogo nativo
  ("localhost:3000 dice...") se ve poco profesional y no se puede estilizar — pedí un modal
  consistente con el resto de la UI.
- **Mantener la palabra "duty" sin traducir**, mezclada con el resto de la UI en español, en vez de
  traducirla a "turno" o "asignación" (que la IA había sugerido). Preferí eso a introducir un
  término que no uso en la conversación real con el equipo.

## Bugs reales que encontró el proceso de revisión (y por qué me importa mostrarlos)

No fue todo aprobación directa. El proceso de revisión en capas encontró y corrigió errores reales
antes de que llegaran a `main`:

- **Un error de solapamiento que podía reaparecer falsamente.** Si fallaba un intento de crear un
  duty por solapamiento, y el usuario cambiaba a editar otro duty y cancelaba, el mensaje de error
  viejo podía reaparecer sobre un formulario en blanco que nunca se había enviado. Lo encontró el
  revisor final (no el que implementó la tarea) y se corrigió antes de mergear — es exactamente el
  tipo de bug de estado que un humano leyendo el código de corrido no siempre detecta a la primera.
- **El mismo patrón de bug, sin corregir, en otro formulario.** El revisor de toda la rama notó que
  el fix de arriba se había aplicado solo en un lugar (duties) y el mismo problema seguía latente en
  la creación de unidades — encontrado por comparación cruzada entre archivos, algo que un review
  tarea-por-tarea no ve.
- **El formulario de rutas no mostraba errores de validación por punto.** Si borrabas una
  coordenada o ponías una latitud fuera de rango, el botón de "crear ruta" simplemente no hacía
  nada, sin ningún mensaje — un bug de UX real que pasó desapercibido hasta la revisión final de
  toda la rama.
- **Rechazos de promesa sin capturar en cinco lugares.** Un patrón que ya se había corregido en un
  formulario (por una falla de test) seguía sin corregirse en otros cinco puntos del código con la
  misma forma — ruido en consola en producción, y una trampa para el próximo test que tocara esa
  ruta.
- **La documentación de Apollo Client estaba desactualizada antes de escribir una sola línea de
  código de UI.** El proyecto instaló Apollo Client v4, pero la documentación de convenciones
  (heredada, escrita para v3) tenía rutas de import viejas. Se corrigió la documentación primero,
  antes de implementar features, para no propagar el error a cada archivo nuevo.

Ninguno de estos bugs lo encontré yo leyendo código línea por línea — los encontró el proceso de
revisión que pedí que se siguiera. Lo que sí decidí yo fue insistir en tener ese proceso en vez de
aceptar el primer resultado que funcionara.

## Qué dejé fuera a propósito

Ver la sección "Qué dejé fuera conscientemente" en el `README.md`.
