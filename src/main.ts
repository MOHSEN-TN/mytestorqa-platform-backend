import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-require-imports
  app.use(require('cookie-parser')());

  app.enableCors({
    origin: "*",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('App Name')
    .setDescription('App Name APIs')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT bearer token',
        in: 'header',
      },
      'access-token', // This is the name used in swagger to refer to this security scheme
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const auth = app.get(AuthService);
  await auth.ensureAdmin();

  await app.listen(3001);
}
void bootstrap();
