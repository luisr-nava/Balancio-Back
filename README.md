# Balancio Backend

Backend de Balancio, una API para gestion comercial de negocios: usuarios y tiendas, inventario, ventas, compras, caja, clientes, proveedores, promociones, notificaciones, reportes, tickets, facturacion de suscripciones e integraciones de pago.

El proyecto esta construido con NestJS, TypeScript, TypeORM y PostgreSQL. La aplicacion esta pensada para ejecutarse localmente fuera de Docker, usando PostgreSQL y MailHog desde Docker Compose.

## Caracteristicas principales

- Autenticacion con JWT, refresh token en cookie HTTP-only y roles.
- Gestion multi-tienda mediante relacion usuario-tienda.
- Inventario por tienda, categorias, proveedores, unidades de medida y carga masiva desde Excel.
- Ventas, anulaciones, devoluciones, compras y devoluciones a proveedor.
- Caja diaria, movimientos de caja y reportes descargables en PDF/XLSX.
- Cuentas corrientes de clientes.
- Promociones, evaluacion/aplicacion de beneficios y notificaciones.
- Tickets de venta configurables y recibos PDF en formatos 58 mm, 80 mm y A4.
- Billing con Stripe para planes de suscripcion.
- Pagos con Mercado Pago y webhooks.
- Imagenes de productos en Cloudinary.
- WebSockets para eventos en tiempo real por tienda.
- Health check simple.
- Rate limiting global con excepcion para webhook de Stripe.

## Stack tecnologico

| Area | Tecnologia |
| --- | --- |
| Runtime | Node.js |
| Framework | NestJS 11 |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL 16 |
| ORM | TypeORM 0.3 |
| Configuracion | `@nestjs/config`, `dotenv`, `joi` |
| Autenticacion | Passport JWT, `@nestjs/jwt`, `jsonwebtoken`, `bcrypt` |
| Validacion | `class-validator`, `class-transformer`, `ValidationPipe` |
| Jobs | `@nestjs/schedule` |
| Eventos | `@nestjs/event-emitter` |
| WebSockets | Socket.IO, `@nestjs/websockets` |
| Rate limiting | `@nestjs/throttler` |
| Email | Nodemailer + MailHog en desarrollo |
| Billing | Stripe |
| Pagos | Mercado Pago |
| Imagenes | Cloudinary |
| Archivos | Multer |
| Excel | ExcelJS |
| PDF | PDFKit, pdfmake |
| Codigos de barras | bwip-js |
| Infraestructura local | Docker Compose |
| Testing configurado | Jest, ts-jest, Supertest |

## Arquitectura

La aplicacion sigue la estructura modular de NestJS:

```text
src/
├── app.module.ts
├── main.ts
├── analytics/
├── auth/
├── billing/
├── cash-register/
├── cash-movement/
├── cash-report/
├── catalog/
├── common/
├── config/
├── customer/
├── customer-account/
├── database/
├── dashboard-visibility/
├── email/
├── error-log/
├── expense/
├── health/
├── income/
├── jobs/
├── measurement-unit/
├── notification/
├── payment/
├── payment-method/
├── product/
├── product-category/
├── promotion/
├── purchase/
├── purchase-return/
├── realtime/
├── sale/
├── sale-return/
├── settings/
├── shop/
├── supplier/
├── supplier-category/
└── ticket-settings/
```

El prefijo global de la API es:

```text
/api/v1
```

`main.ts` configura:

- `cookie-parser`.
- `bodyParser.raw()` solo para `/api/v1/billing/webhook`.
- JSON y URL encoded body parser para el resto de endpoints.
- CORS con credenciales para `FRONTEND_URL`, `http://localhost:3001` y `http://localhost:5173`.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- Middleware de logging para respuestas 4xx/5xx.
- Ejecucion de seeds base mediante `SeedRunner` antes de levantar el servidor.

## Modulos

Los modulos importados por `AppModule` son:

| Modulo | Responsabilidad |
| --- | --- |
| `AuthModule` | Registro, login, refresh, logout, verificacion por codigo, recuperacion de password, usuarios empleados y roles. |
| `EmailModule` | Envio de emails de verificacion y recuperacion con Nodemailer. |
| `BillingModule` | Suscripciones, checkout, cambios de plan, cancelaciones y webhook de Stripe. |
| `ShopModule` | Alta y administracion de tiendas, configuracion por tienda y acceso de usuarios. |
| `AnalyticsModule` | Dashboard y metricas agregadas por tienda/producto/dia. |
| `CashRegisterModule` | Apertura/cierre de caja, estado actual, movimientos y actualizaciones en tiempo real. |
| `CashMovementModule` | Registro de movimientos vinculados a ventas, compras, ingresos, gastos y devoluciones. |
| `CashReportModule` | Reportes de caja cerrada, exportacion PDF y Excel. |
| `CustomerModule` | Clientes por tienda. |
| `CustomerAccountModule` | Cuentas corrientes, deudas, pagos, movimientos y bloqueo/desbloqueo de clientes. |
| `ExpenseModule` | Gastos asociados a tienda y metodo de pago. |
| `IncomeModule` | Ingresos manuales asociados a tienda, empleado y metodo de pago. |
| `MeasurementUnitModule` | Unidades de medida globales y habilitacion por tienda. |
| `NotificationModule` | Inbox, preferencias por tienda y gateway de notificaciones. |
| `PaymentMethodModule` | Metodos de pago globales y habilitacion por tienda. |
| `PaymentModule` | Webhook/finalizacion de pagos Mercado Pago. |
| `ProductModule` | Productos, stock por tienda, imagenes, importacion Excel y bajas. |
| `PrintModule` | PDFs de codigos de barras y etiquetas de precio. |
| `ProductCategoryModule` | Categorias de productos globales/por tienda y baja logica. |
| `PromotionModule` | Promociones, alcance por tienda, items, beneficios, evaluacion y aplicacion. |
| `PurchaseModule` | Compras, items, actualizacion de stock, cancelacion e historico. |
| `PurchaseReturnModule` | Devoluciones a proveedor, notas de credito y reemplazos. |
| `SaleModule` | Ventas, items, tickets, actualizacion/cancelacion, Mercado Pago y eventos en tiempo real. |
| `SaleReturnModule` | Devoluciones de venta. |
| `SupplierModule` | Proveedores por tienda. |
| `SupplierCategoryModule` | Categorias de proveedores por tienda. |
| `SeedModule` | Seeds base de unidades de medida y metodos de pago. |
| `SettingsModule` | Perfil y cambio de password del usuario autenticado. |
| `HealthModule` | Endpoint de estado. |
| `DashboardVisibilityModule` | Preferencias de visibilidad del dashboard por tienda. |
| `TicketSettingsModule` | Configuracion de tickets por tienda. |
| `ReceiptModule` | Recibos/tickets PDF de ventas y previews. |
| `ErrorLogModule` | Registro y consulta de errores frontend/backend. |
| `CatalogModule` | Generacion y vista previa de catalogos HTML. |

## API

No hay configuracion Swagger/OpenAPI en el repositorio actual. Las rutas se organizan por controllers con prefijo global `/api/v1`.

| Controller | Base path | Rutas principales |
| --- | --- | --- |
| `AuthController` | `/auth` | `register`, `login`, `refresh`, `logout`, `verify-code`, `resend-verification-code`, `forgot-password`, `reset-password`, `employee`, `get-user`, `get-employees`, `profile/:id`, `:id/role`, `delete/:id` |
| `BillingController` | `/billing` | `subscription`, `webhook`, `checkout`, `change-plan`, `cancel` |
| `ShopController` | `/shop` | crear tienda, `my-shops`, detalle, settings y actualizacion |
| `ProductController` | `/product` | CRUD, importacion Excel, baja bulk |
| `PrintController` | `/print` | PDFs de codigos de barras y etiquetas |
| `ProductCategoryController` | `/product-category` | CRUD/baja logica de categorias |
| `SupplierController` | `/supplier` | CRUD/baja logica de proveedores |
| `SupplierCategoryController` | `/supplier-category` | CRUD/baja logica de categorias de proveedor |
| `SaleController` | `/sale` | crear/listar/detalle/actualizar/cancelar venta y webhook Mercado Pago |
| `PurchaseController` | `/purchase` | crear/listar/actualizar/cancelar compra |
| `PurchaseReturnController` | `/purchase-return` | CRUD de devoluciones a proveedor |
| `SaleReturnController` | `/sale-return` | crear/listar devoluciones de venta |
| `CashRegisterController` | `/cash-register` | abrir/cerrar caja, movimientos, caja actual, vivo, historico por tienda |
| `CashReportController` | `/cash-reports` | listar reportes, exportar PDF/XLSX |
| `CustomerController` | `/customer` | CRUD/baja de clientes |
| `CustomerAccountController` | `/customer-account` | pagos, deudores, movimientos, bloqueo, detalle |
| `IncomeController` | `/income` | CRUD de ingresos |
| `ExpenseController` | `/expense` | CRUD de gastos |
| `MeasurementUnitController` | `/measurement-unit` | CRUD/habilitacion de unidades |
| `PaymentMethodController` | `/payment-method` | CRUD/habilitacion de metodos de pago |
| `PaymentController` | `/payment` | webhook Mercado Pago y finalizacion por venta |
| `PromotionController` | `/promotion` | CRUD, propias, evaluar y aplicar |
| `NotificationController` | `/notifications` | inbox, conteo no leidas, marcar leidas, preferencias |
| `AnalyticsController` | `/analytics` | dashboard |
| `DashboardVisibilityController` | `/dashboard-visibility` | obtener/actualizar visibilidad |
| `TicketSettingsController` | `/ticket-settings` | obtener/actualizar configuracion |
| `ReceiptController` | `/receipts` | PDF por venta, PDF por recibo, preview |
| `ErrorLogController` | `/error-logs` | crear/listar/stats |
| `CatalogController` | `/catalog` | generar, preview y detalle |
| `SettingsController` | `/settings` | perfil y cambio de password |
| `HealthController` | `/health` | estado simple |

## Base de datos

### PostgreSQL

El repositorio usa PostgreSQL 16 mediante Docker Compose. El servicio se llama `db`, el contenedor `balancio-postgres` y el volumen `postgres_data`.

En el estado actual de `docker-compose.yml`, PostgreSQL publica:

```text
Host Windows/local: localhost:5433
Dentro de Docker: db:5432
Contenedor: balancio-postgres
Base inicial: balancio
```

Si el backend se ejecuta fuera de Docker, `DB_HOST` debe apuntar a `localhost` y `DB_PORT` al puerto publicado en el host (`5433` con el Compose actual).

### TypeORM

La aplicacion registra TypeORM en `AppModule` con:

```text
ConfigModule
↓
ConfigService
↓
src/config/typeorm.config.ts
↓
TypeOrmModule.forRootAsync()
```

Variables usadas por TypeORM:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`

La configuracion incluye entidades, subscribers y migraciones por glob. `migrationsRun` esta en `false`.

Advertencia: en `src/config/typeorm.config.ts` el comentario indica que `synchronize` esta deshabilitado, pero el valor real actual es `synchronize: true`. Esto puede modificar el esquema al iniciar la app.

### Modelo de datos de alto nivel

Entidades principales:

- `User`, `UserShop`, `Shop`: usuarios, roles globales y pertenencia a tiendas.
- `Subscription`: plan y estado de billing por owner.
- `Product`, `ShopProduct`, `ProductCategory`, `CategoryProductShop`, `ProductHistory`: catalogo e inventario por tienda.
- `Supplier`, `SupplierShop`, `SupplierCategory`: proveedores y clasificacion por tienda.
- `Customer`, `CustomerShop`, `CustomerAccountMovement`: clientes, deuda y movimientos de cuenta corriente.
- `Sale`, `SaleItem`, `SaleHistory`, `SaleItemHistory`, `SaleReturn`, `SaleReturnItem`: ventas, items, historicos y devoluciones.
- `Purchase`, `PurchaseItem`, `PurchaseDeletionHistory`, `PurchaseReturn`, `PurchaseReturnItem`: compras y devoluciones a proveedor.
- `CreditNote`, `CreditNoteApplication`, `MerchandiseReplacement`, `ReplacementItem`: resoluciones de devoluciones de compra.
- `CashRegister`, `CashMovement`: caja, estado y movimientos asociados.
- `Payment`, `PaymentMethod`, `ShopPaymentMethod`: pagos externos y metodos de pago.
- `Income`, `Expense`: ingresos/gastos manuales.
- `MeasurementUnit`, `ShopMeasurementUnit`: unidades globales y activacion por tienda.
- `Promotion`, `PromotionShop`, `PromotionItem`, `PromotionBenefit`: promociones por alcance, productos y beneficios.
- `Notification`, `ShopNotificationPreference`: notificaciones y preferencias.
- `ShopStats`, `ShopDailyMetrics`, `ShopProductStats`: metricas analiticas.
- `ShopTicketSettings`, `SaleReceipt`: configuracion y snapshots de recibos.
- `Catalog`: catalogos generados.
- `ErrorLog`: errores registrados para auditoria.

### Migraciones

Las migraciones estan en:

```text
src/database/migrations/
```

El `DataSource` de CLI esta en:

```text
src/database/data-source.ts
```

Comandos disponibles:

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/database/migrations/NombreMigracion
```

### Seeds

Hay dos mecanismos:

- `SeedRunner`, importado por `SeedModule`, ejecuta seeds base de unidades de medida y metodos de pago al arrancar la app.
- `npm run db:reset` ejecuta `src/database/seed.ts`.

Advertencia: `npm run db:reset` usa un `DataSource` propio y trunca tablas antes de crear datos de prueba. No usarlo contra datos importantes.

## Docker

`docker-compose.yml` define dos servicios:

| Servicio | Imagen | Contenedor | Puertos |
| --- | --- | --- | --- |
| `db` | `postgres:16` | `balancio-postgres` | `5433:5432` |
| `mailhog` | `mailhog/mailhog:v1.0.1` | `balancio-mailhog` | `1025:1025`, `8025:8025` |

Levantar infraestructura:

```bash
docker compose up -d
```

Ver estado:

```bash
docker compose ps
docker port balancio-postgres
docker logs --tail 100 balancio-postgres
```

MailHog:

```text
SMTP: localhost:1025
Web UI: http://localhost:8025
```

Nota: el archivo Compose todavia contiene `version: "3.9"`. Docker Compose moderno puede mostrar un warning porque ese campo se considera obsoleto, aunque normalmente no impide levantar servicios.

## Instalacion

### Requisitos

- Node.js compatible con NestJS 11.
- npm.
- Docker y Docker Compose.
- PostgreSQL local opcional solo si no se usa el servicio Docker.

### Clonar repositorio

```bash
git clone <repository-url>
cd balancio-back
```

### Instalar dependencias

```bash
npm install
```

### Configurar variables de entorno

Crear `.env` en la raiz del proyecto. No commitear este archivo; `.gitignore` ya ignora `.env`.

Con el Compose actual, la configuracion local de base deberia usar:

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=balancio
```

### Levantar infraestructura

```bash
docker compose up -d
```

### Levantar backend en desarrollo

```bash
npm run start:dev
```

Por defecto, si `PORT=3002`, la API queda en:

```text
http://localhost:3002/api/v1
```

## Variables de entorno

Variables encontradas en `.env` o consumidas por el codigo. No se incluyen secretos reales.

| Variable | Descripcion | Requerida | Ejemplo seguro |
| --- | --- | --- | --- |
| `PORT` | Puerto HTTP de NestJS. | Si | `3002` |
| `NODE_ENV` | Entorno: `development`, `production` o `test`. | No | `development` |
| `DB_HOST` | Host PostgreSQL para TypeORM. | Si para DB | `localhost` |
| `DB_PORT` | Puerto PostgreSQL para TypeORM. | Si | `5433` |
| `DB_USER` | Presente en `.env`, pero el codigo usa `DB_USERNAME`. | No usado por TypeORM actual | `postgres` |
| `DB_USERNAME` | Usuario PostgreSQL usado por TypeORM. | Si para DB | `postgres` |
| `DB_PASSWORD` | Password PostgreSQL. | Si | vacio en template |
| `DB_NAME` | Nombre de base de datos. | Si | `balancio` |
| `DATABASE_URL` | Presente en `.env`, no usado por TypeORM actual. | No | `postgres://postgres:<password>@localhost:5433/balancio` |
| `JWT_SECRET` | Secreto para access tokens JWT. | Si | vacio en template |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens JWT. | Si | vacio en template |
| `ISSUER` | Presente en `.env`; no se detecto uso directo en `src/`. | No comprobado | `http://localhost:3001` |
| `COOKIE_SECURE` | Presente en `.env`; cookies usan `NODE_ENV === production`. | No comprobado | `false` |
| `MAIL_PROVIDER` | Presente en `.env`; el servicio actual usa Nodemailer/MailHog. | No comprobado | `mailhog` |
| `MAIL_HOST` | Host SMTP usado por `EmailService`. | Si para emails | `localhost` |
| `MAIL_PORT` | Presente en `.env`; el codigo tiene puerto SMTP hardcodeado en `1025`. | No usado actualmente | `1025` |
| `MAIL_FROM` | Presente en `.env`; el codigo usa remitente hardcodeado. | No usado actualmente | `Balancio Dev <dev@example.test>` |
| `STRIPE_SECRET_KEY` | API secret de Stripe. | Si para billing | vacio en template |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma webhook Stripe. | Si para webhook Stripe | vacio en template |
| `STRIPE_PRICE_BASIC` | Price ID del plan BASIC. | Si para billing | vacio en template |
| `STRIPE_PRICE_PRO` | Price ID del plan PRO. | Si para billing | vacio en template |
| `PAYMENT_WEBHOOK_SECRET` | Presente en `.env`; no se detecto uso directo en `src/`. | No comprobado | vacio en template |
| `PAYMENT_WEBHOOK_HEADER` | Presente en `.env`; no se detecto uso directo en `src/`. | No comprobado | vacio en template |
| `URL_BALANZIO` | Presente en `.env`; no se detecto uso directo en `src/`. | No comprobado | `http://localhost:3000/` |
| `FRONTEND_URL` | URL frontend para CORS, emails y Stripe success/cancel. | Recomendado | `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. | Si para imagenes | vacio en template |
| `CLOUDINARY_API_KEY` | Cloudinary API key. | Si para imagenes | vacio en template |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. | Si para imagenes | vacio en template |
| `MP_ACCESS_TOKEN` | Access token de Mercado Pago. | Si para Mercado Pago | vacio en template |
| `MP_WEBHOOK_SECRET` | Secreto para validar firma de webhooks Mercado Pago. | Requerido en produccion | vacio en template |
| `API_URL` | URL publica usada para webhook Mercado Pago. | Si para Mercado Pago | `https://example.com/api/v1` |

### `.env.example`

```env
PORT=3002
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=balancio
DATABASE_URL=postgres://postgres:<password>@localhost:5433/balancio

JWT_SECRET=
JWT_REFRESH_SECRET=
ISSUER=http://localhost:3001
COOKIE_SECURE=false

MAIL_PROVIDER=mailhog
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM="Balancio Dev <dev@example.test>"

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PRO=

PAYMENT_WEBHOOK_SECRET=
PAYMENT_WEBHOOK_HEADER=

URL_BALANZIO=http://localhost:3000/
FRONTEND_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
API_URL=http://localhost:3002/api/v1
```

## Scripts disponibles

| Script | Comando | Descripcion |
| --- | --- | --- |
| `npm run build` | `nest build` | Compila TypeScript a `dist/`. |
| `npm run format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | Formatea codigo fuente y tests si existen. |
| `npm run start:dev` | `nest start --watch` | Ejecuta NestJS en modo desarrollo con watch. |
| `npm run start:prod` | `node dist/src/main.js` | Ejecuta el build compilado. Requiere correr `npm run build` antes. |
| `npm run lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Ejecuta ESLint con autofix. |
| `npm run migration:run` | TypeORM CLI | Aplica migraciones pendientes. |
| `npm run migration:revert` | TypeORM CLI | Revierte la ultima migracion aplicada. |
| `npm run migration:show` | TypeORM CLI | Muestra estado de migraciones. |
| `npm run migration:generate` | TypeORM CLI | Genera una migracion usando `src/database/data-source.ts`. |
| `npm run db:reset` | `ts-node src/database/seed.ts` | Resetea datos de desarrollo truncando tablas y creando datos base de prueba. |

No existen scripts `start`, `test`, `test:e2e` ni `test:cov` en el `package.json` actual.

## Autenticacion y autorizacion

Flujo comprobado:

1. `POST /api/v1/auth/register` crea usuario.
2. Se genera codigo de verificacion y se envia email.
3. `POST /api/v1/auth/verify-code` verifica la cuenta.
4. `POST /api/v1/auth/login` devuelve access token y setea refresh token en cookie.
5. Endpoints protegidos usan `Authorization: Bearer <token>`.
6. `POST /api/v1/auth/refresh` lee la cookie `refreshToken`, rota el refresh token y devuelve nuevo access token.
7. `POST /api/v1/auth/logout` limpia la cookie de refresh.

Detalles:

- Access token: 15 minutos.
- Refresh token: 7 dias.
- Cookie de refresh:
  - `httpOnly: true`
  - `sameSite: strict`
  - `path: /api/v1/auth/refresh`
  - `secure: true` solo en `NODE_ENV=production`
- Roles detectados: `OWNER`, `MANAGER`, `EMPLOYEE`.
- `JwtStrategy` toma el access token del header `Authorization: Bearer`.
- `RolesGuard` valida roles declarados con `@Roles`.
- `TokenBlacklistGuard` existe, pero no se encontro integrado como guard global ni usado en controllers.

## Integraciones externas

### Stripe

Usado por `BillingModule` para:

- Crear sesiones de checkout.
- Cambiar plan.
- Cancelar suscripciones al final del periodo.
- Procesar webhooks:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

El webhook es:

```text
POST /api/v1/billing/webhook
```

`main.ts` configura body raw especificamente para esa ruta.

### Mercado Pago

Usado para crear preferencias de pago y procesar pagos externos:

- `MP_ACCESS_TOKEN`
- `API_URL`
- `MP_WEBHOOK_SECRET`

Endpoints relacionados:

```text
POST /api/v1/sale/webhooks/mercadopago
POST /api/v1/payment/webhook/mercadopago
POST /api/v1/payment/finalize/:saleId
```

En produccion, si `MP_WEBHOOK_SECRET` no esta configurado, la validacion de firma falla explicitamente.

### Cloudinary

Usado para subir y borrar imagenes de productos. Las imagenes se suben al folder `products` con transformaciones de tamano, calidad y formato automatico.

Variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Email y MailHog

`EmailService` usa Nodemailer. En desarrollo, el Compose levanta MailHog:

```text
SMTP: localhost:1025
UI: http://localhost:8025
```

El servicio envia:

- Email de verificacion de cuenta.
- Email de recuperacion de password.

Nota: `MAIL_HOST` se lee desde `process.env`, pero el puerto SMTP esta hardcodeado en `1025` en el servicio.

## WebSockets y eventos

Hay tres gateways:

- `RealtimeGateway`: canal general por tienda (`shop_<shopId>`) para ventas, compras, caja y promociones.
- `NotificationGateway`: entrega de notificaciones a usuarios autenticados.
- `CashRegisterGateway`: actualizaciones live de caja por `shopId`.

Los gateways validan token JWT en `handshake.auth.token`. Los canales por tienda requieren `shopId` y validan acceso mediante `UserShop`.

El proyecto usa `EventEmitterModule` para desacoplar eventos como:

- Movimientos/cierre de caja.
- Creacion de promociones.
- Notificaciones.

## Tareas programadas

`ScheduleModule` esta habilitado globalmente.

Job detectado:

```text
VerificationCodeCleanupJob
Cron: 0 3 * * *
```

El job elimina codigos de verificacion expirados o ya usados.

## Rate limiting

`ThrottlerModule` define tres perfiles:

| Nombre | TTL | Limite |
| --- | ---: | ---: |
| `short` | 1000 ms | 3 |
| `medium` | 10000 ms | 20 |
| `long` | 60000 ms | 100 |

`CustomThrottlerGuard` esta registrado como guard global y omite rate limiting para `/billing/webhook`.

Algunos controllers tambien usan `@Throttle`, por ejemplo webhooks de Mercado Pago.

## Manejo de errores y logging

`HttpExceptionFilter` esta registrado globalmente con `APP_FILTER`.

Comportamiento:

- Normaliza respuestas de error con `statusCode`, `message` y `timestamp`.
- Loguea 4xx como warning, excepto 401/403 para reducir ruido.
- Persiste errores 5xx en `ErrorLogService` cuando esta disponible.
- Evita loops al no registrar errores de `/error-logs`.

Ademas, `main.ts` registra warnings para requests que terminan en 4xx/5xx.

## Health check

Endpoint:

```text
GET /api/v1/health
```

Respuesta:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Testing

El repositorio tiene configuracion Jest dentro de `package.json` y dependencias como `jest`, `ts-jest`, `@nestjs/testing` y `supertest`.

Estado actual:

- No se encontraron archivos `*.spec.ts`.
- No existe carpeta `test/`.
- No existen scripts `test`, `test:e2e` ni `test:cov` en `package.json`.
- Existe `test-socket.js`, orientado a prueba manual de sockets.

## Build y produccion

Compilar:

```bash
npm run build
```

Ejecutar build:

```bash
npm run start:prod
```

`nest-cli.json` copia assets de:

```text
catalog/templates/**/*
```

No se encontro `Dockerfile` en la raiz del repositorio. El Compose actual solo levanta infraestructura (`db` y `mailhog`), no el backend.

## Desarrollo local recomendado

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` seguro basado en la tabla anterior.

3. Levantar infraestructura:

```bash
docker compose up -d
```

4. Verificar PostgreSQL:

```bash
docker compose ps
docker port balancio-postgres
```

5. Ejecutar migraciones si corresponde:

```bash
npm run migration:run
```

6. Levantar backend:

```bash
npm run start:dev
```

7. Abrir MailHog si se prueban emails:

```text
http://localhost:8025
```

## Troubleshooting

### PostgreSQL `28P01`

Mensaje tipico:

```text
password authentication failed for user "postgres"
```

Posibles causas:

- `DB_PASSWORD` no coincide con la contrasena real de PostgreSQL.
- El volumen `postgres_data` fue inicializado antes con otra contrasena.
- El backend conecta al puerto equivocado.
- Hay otro PostgreSQL local atendiendo en el puerto usado.
- Variables de entorno externas estan sobrescribiendo `.env`.

Comandos utiles:

```bash
docker compose ps
docker port balancio-postgres
docker logs --tail 100 balancio-postgres
```

Con el Compose actual, el backend local debe usar:

```env
DB_HOST=localhost
DB_PORT=5433
```

### `ECONNREFUSED`

Verificar:

```bash
docker compose ps
docker port balancio-postgres
```

Tambien confirmar que `DB_HOST` y `DB_PORT` coinciden con el entorno desde donde corre el backend:

- Backend local: `localhost:5433`.
- Backend dentro de Docker: `db:5432`.

### Compose warning de `version`

Si Docker Compose muestra un warning por:

```yaml
version: "3.9"
```

es porque Compose moderno ya no necesita ese campo. No necesariamente rompe el entorno.

### MailHog no recibe emails

Verificar:

- Servicio `mailhog` corriendo en `docker compose ps`.
- `MAIL_HOST=localhost`.
- Puerto SMTP `1025`.
- UI disponible en `http://localhost:8025`.

### Webhooks externos en local

Stripe y Mercado Pago necesitan una URL publica para llamar al backend local. El proyecto usa `API_URL` para construir la URL de webhook de Mercado Pago y `FRONTEND_URL` para URLs de retorno de Stripe.

## Seguridad

- `.env` esta ignorado por `.gitignore`; no debe subirse al repositorio.
- No copiar valores reales de `JWT_SECRET`, `JWT_REFRESH_SECRET`, Stripe, Mercado Pago, Cloudinary ni webhooks.
- En produccion, usar secretos largos y rotables.
- Configurar `NODE_ENV=production` para cookies `secure`.
- Proteger webhooks con sus secretos correspondientes.
- Revisar `synchronize: true` antes de conectar a bases con datos reales.
- Confirmar que `MP_WEBHOOK_SECRET` este definido en produccion.
- Verificar que los logs no expongan identificadores sensibles de proveedores externos.

## Deployment

No se encontro configuracion especifica de plataforma de deployment ni `Dockerfile` para construir la API.

Para produccion, el flujo minimo comprobado por scripts es:

```bash
npm install
npm run build
npm run migration:run
npm run start:prod
```

Antes de desplegar, revisar:

- Variables de entorno completas.
- Conectividad a PostgreSQL.
- `synchronize`.
- Webhooks de Stripe y Mercado Pago.
- CORS (`FRONTEND_URL`).
- Cookies seguras con HTTPS.

## Estado del proyecto

El backend tiene una superficie funcional amplia y varios modulos de dominio ya implementados. Hay integraciones externas y migraciones existentes, pero tambien puntos a revisar antes de produccion:

- No hay scripts de test aunque Jest esta configurado.
- No hay Swagger/OpenAPI.
- No hay Dockerfile para la API.
- `synchronize: true` esta activo.
- Algunas variables de `.env` estan presentes pero no se detecto uso directo en `src/`.

## Licencia

El `package.json` declara:

```text
UNLICENSED
```
