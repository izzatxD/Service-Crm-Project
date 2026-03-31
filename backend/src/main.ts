import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOriginValue = configService.get<string>('app.corsOrigin') ?? '';
  const corsOrigins = corsOriginValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // Swagger only for non-production environments.
  const isProd = configService.get<string>('app.nodeEnv') === 'production';
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CRM API')
      .setDescription(
        'NestJS + Prisma backend for the CRM platform.\n\n' +
          '**Autentifikatsiya:** "Authorize" tugmasini bosib, Bearer tokenni kiriting.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        // Keep the bearer token after page refresh while developing.
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        // Collapse all sections by default.
        docExpansion: 'none',
      },
    });

    const port = configService.get<number>('app.port') ?? 3000;
    console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  }

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}
void bootstrap();
