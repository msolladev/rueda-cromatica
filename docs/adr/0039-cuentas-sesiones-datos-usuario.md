# ADR-0039: Cuentas, sesiones y datos del usuario

- **Estado:** aceptada
- **Fecha:** 2026-11-24
- **Corrige en parte:** [ADR-0017](0017-arquitectura-objetivo-backend.md)

## Contexto

El [ADR-0017](0017-arquitectura-objetivo-backend.md) prevé cuentas con dos roles, usuario y administrador, y los datos del usuario sincronizados entre dispositivos y offline primero. Cuenta entre esos datos la colección y, más adelante, las recetas y la lista de la compra, que CLAUDE.md tiene en «Futuro». Dejó abiertos la autenticación, si la cuenta es obligatoria, los conflictos de sincronización y el RGPD.

Hoy la web se usa sin cuenta, y las preferencias se guardan en el navegador ([docs/07](../07-web.md) §6): las marcas desactivadas, los filtros, la vista, el tema, el idioma, la rueda y la pintura elegida.

## Decisión

### Qué datos del usuario entran en la fase 6

- **Solo las preferencias.** La colección, las recetas y la lista de la compra siguen en «Futuro».
- **Cada tipo de dato del usuario tiene su propio registro y su propia regla de sincronización**, para que la colección pueda entrar después sin rehacer la de las preferencias.

### La cuenta es opcional

- **Todo funciona sin cuenta, como hoy.** La cuenta solo añade la sincronización.
- **Al iniciar sesión** en un dispositivo, lo que hay en el navegador y lo que hay en la cuenta se juntan con la misma regla que dos dispositivos.

### Cómo se inicia sesión

- **Con una cuenta de GitHub, de Google o de Microsoft** (OAuth y OpenID Connect). La API no guarda contraseñas ni envía correos.
- **El correo con contraseña** se añadirá después, con su propia decisión sobre el proveedor de envío de correo, porque desde el homelab no se envían correos de forma fiable. Las llaves de acceso (passkeys) podrán añadirse como otra forma de entrar.
- **Una persona que entra con dos proveedores** con el mismo correo es la misma cuenta.
- **Los roles** son usuario y administrador. El primer administrador se fija en la configuración del servidor, y los demás roles se gestionan en `apps/admin`.

### Sesiones

- **Guardadas en la base de datos, con una cookie** `HttpOnly`, `Secure` y `SameSite`, que solo contiene un identificador aleatorio. Es lo que recomienda OWASP para una web con su propia API.
- **Cerrar una sesión es borrar su fila**, por ejemplo la del móvil perdido, desde otro dispositivo.
- **Duran 30 días y se renuevan con el uso**, para que la PWA no obligue a volver a entrar a menudo.
- **Protección contra CSRF**: `SameSite` y la comprobación que trae la librería.
- **La web y `apps/admin` tienen sesiones distintas**, cada una con la cookie de su dominio ([ADR-0040](0040-despliegue-fase-6.md)).
- **Una app nativa**, si algún día existiera, usaría la misma sesión enviada en la cabecera `Authorization`, no un JWT.

### La librería: Better Auth

- **Better Auth**, con su adaptador de Prisma y la integración `@thallesp/nestjs-better-auth`. Trae los tres proveedores, las sesiones en la base de datos, la protección contra CSRF y el límite de intentos, y ya tiene el correo con contraseña y los tokens para apps nativas.
- **Los guards de NestJS** que protegen las rutas de usuario y de administración se escriben sobre la sesión de Better Auth.

### Conflictos de sincronización

- **Gana el último cambio de cada preferencia**, no del conjunto: cada preferencia guarda su instante de cambio, en UTC ([ADR-0038](0038-stack-backend.md)). Si el móvil desactiva AK y el PC cambia el tema, los dos sin conexión, se conservan los dos cambios. Solo si los dos cambian la misma preferencia gana el último.
- **La API rechaza los instantes en el futuro**, para que un dispositivo con el reloj adelantado no gane siempre.

### Datos personales (RGPD)

- **La regla de oro: solo se guarda lo estrictamente necesario para que la app funcione.** Ni DNI, ni sexo, ni fecha de nacimiento, ni la IP, ni el navegador, ni los datos del dispositivo. La analítica, si llega, tendrá su propia decisión.
- **Lo que se guarda:**
  - el identificador del usuario en su proveedor;
  - el correo, para vincular los proveedores de una misma persona y para el futuro correo con contraseña;
  - las preferencias;
  - las sesiones, sin IP ni navegador.
- **Lo que no se guarda:** el nombre y la foto del perfil, que la app no usa. Better Auth guarda por defecto la IP y el navegador de cada sesión y la foto del usuario: se desactivan o se dejan vacíos, y un test comprueba que no se guardan.
- **En autoservicio**, desde la cuenta: «Descargar mis datos» (un JSON) y «Eliminar mi cuenta», que borra al momento la cuenta, sus preferencias y sus sesiones. Lo del navegador se queda.
- **Una página de privacidad** en los 13 idiomas, prerenderizada como las demás: qué se guarda, para qué, dónde (un servidor en España) y cómo ejercer los derechos.
- **La cookie de sesión** es estrictamente necesaria, así que no necesita aviso de cookies.
- **Los registros del servidor**, sin datos personales.

## Alternativas descartadas

- **Sincronizar también la colección**: es una funcionalidad sin diseñar, con conflictos de verdad (añadir y quitar la misma pintura en dos dispositivos sin conexión), y está en «Futuro».
- **Ningún dato del usuario, solo la cuenta del administrador**: deja fuera la mitad de lo que CLAUDE.md define como fase 6.
- **La cuenta obligatoria**: rompe el uso de hoy, el SEO y el funcionamiento sin conexión desde la primera visita.
- **Empezar por el correo y la contraseña**: es la opción más cara (envío de correo, contraseñas con argon2id, límite de intentos y comprobación de contraseñas filtradas), y los tres proveedores son gratis y fáciles.
- **Un enlace por correo en cada inicio de sesión**: obliga a enviar un correo cada vez.
- **Tokens JWT**: un token emitido no se revoca hasta que caduca, y guardado en `localStorage` lo puede robar cualquier script que se cuele en la página.
- **Passport con `@nestjs/passport`**: es la forma documentada de NestJS, pero las estrategias de los proveedores están mal mantenidas (`passport-github2` no publica desde 2022, `passport-google-oauth20` desde 2023, y `passport-azure-ad` está obsoleta), y las sesiones se montan con piezas sueltas.
- **`openid-client` y lo demás a mano**: GitHub no usa OpenID Connect, y la seguridad de las sesiones se escribiría a mano.
- **Gana el último cambio del conjunto de preferencias**: un dispositivo pisaría los cambios del otro en preferencias que no tocó.
- **Preguntar al usuario en cada conflicto**: una molestia desproporcionada para un tema o un filtro.
- **Los derechos del RGPD por correo**: obliga a publicar un contacto, responder en un mes y borrar a mano.

## Consecuencias

- Corrige en parte el [ADR-0017](0017-arquitectura-objetivo-backend.md): los datos del usuario de la fase 6 son solo las preferencias, y cierra sus puntos abiertos sobre la autenticación, la cuenta opcional, los conflictos y el RGPD.
- Hay que registrar la aplicación en GitHub, Google y Microsoft, con una dirección de vuelta por entorno, y guardar sus secretos en la VM de cada entorno, fuera del repositorio.
- Las preferencias de docs/07 §6 se guardan con un instante por preferencia.
