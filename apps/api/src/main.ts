import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.ts";
import { ENVIRONMENT, type Environment } from "./core/config/environment.ts";
import { setUpApp } from "./setup.ts";

const app = await NestFactory.create<NestExpressApplication>(AppModule);
setUpApp(app);
// Closes the connections to the database when the process is stopped.
app.enableShutdownHooks();
const { HOST, PORT } = app.get<Environment>(ENVIRONMENT);
await app.listen(PORT, HOST);
