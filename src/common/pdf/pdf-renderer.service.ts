import { Injectable, Logger, OnModuleDestroy, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import * as Handlebars from 'handlebars';
import { registerHandlebarsHelpers } from './helpers/handlebars-helpers';

const MAX_PAGINAS_CONCURRENTES = 10; 
const TIMEOUT_RENDER_MS = 2500;

@Injectable()
export class PdfRendererService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private readonly logger = new Logger(PdfRendererService.name);
  private enCurso = 0;
  private cola: Array<() => void> = [];
  private readonly templatesCache = new Map<string, HandlebarsTemplateDelegate>();

  async onModuleInit() {
    registerHandlebarsHelpers();
    await this.lanzarBrowser();
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close().catch(() => undefined);
  }

  private async lanzarBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });

    this.browser.on('disconnected', () => {
      this.logger.warn('⚠️ Chromium se desconectó. Se relanzará en la próxima petición.');
      this.browser = null;
    });
  }

  private async obtenerBrowser(): Promise<Browser> {
    // 🔧 CORRECCIÓN 1: Se cambió .isConnected() por .connected
    if (!this.browser || !this.browser.connected) {
      this.logger.warn('🔄 Relanzando instancia de Chromium...');
      await this.lanzarBrowser();
    }
    return this.browser!;
  }

  /** Limita cuántas páginas de Chromium se renderizan en simultáneo. */
  private async adquirirSlot(): Promise<void> {
    if (this.enCurso < MAX_PAGINAS_CONCURRENTES) {
      this.enCurso++;
      return;
    }
    await new Promise<void>((resolve) => this.cola.push(resolve));
    this.enCurso++;
  }

  private liberarSlot(): void {
    this.enCurso--;
    const siguiente = this.cola.shift();
    if (siguiente) siguiente();
  }

  /** Compila y cachea plantillas .hbs en memoria (evita leer disco en cada PDF). */
  compilarTemplate(nombre: string, source: string): HandlebarsTemplateDelegate {
  if (process.env.NODE_ENV !== 'production') {
    return Handlebars.compile(source); // sin cache
  }
  if (!this.templatesCache.has(nombre)) {
    this.templatesCache.set(nombre, Handlebars.compile(source));
  }
  return this.templatesCache.get(nombre)!;
}



  async renderizarHtmlAPdf(html: string): Promise<Buffer> {
    await this.adquirirSlot();
    const browser = await this.obtenerBrowser();
    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;

    try {
      page = await browser.newPage();

      await Promise.race([
  (async () => {
    await page.setContent(html, {
      waitUntil: 'load', // válido en tus tipos
      timeout: TIMEOUT_RENDER_MS,
    });

    // Esperar imágenes externas (Supabase, etc.)
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve(); // no bloquear si falla
                }),
        ),
      );
    });
  })(),
  new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Timeout al cargar el contenido del PDF')),
      TIMEOUT_RENDER_MS,
    ),
  ),
]);

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        timeout: TIMEOUT_RENDER_MS,
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      this.logger.error(`Error generando PDF: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No se pudo generar el documento PDF. Intenta nuevamente.');
    } finally {
      if (page) await page.close().catch(() => undefined);
      this.liberarSlot();
    }
  }
}