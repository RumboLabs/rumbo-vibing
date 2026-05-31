/**
 * Buffer de salida de terminal con tope por bytes (UTF-8). Acumula texto y, al
 * superar el máximo, recorta por el principio. Pensado para reproducir el
 * scrollback de una sesión al (re)conectar un WebSocket.
 */
export class RingBuffer {
  private chunks: string[] = [];
  private size = 0; // bytes UTF-8 acumulados

  constructor(private readonly maxBytes: number) {}

  append(chunk: string): void {
    if (!chunk) return;
    this.chunks.push(chunk);
    this.size += Buffer.byteLength(chunk, 'utf8');
    this.trim();
  }

  /** Todo el contenido retenido, como una sola cadena. */
  snapshot(): string {
    if (this.chunks.length > 1) {
      this.chunks = [this.chunks.join('')];
    }
    return this.chunks[0] ?? '';
  }

  /** Últimos `chars` caracteres (para heurísticas de estado). */
  recentText(chars: number): string {
    const all = this.snapshot();
    return all.length > chars ? all.slice(all.length - chars) : all;
  }

  private trim(): void {
    if (this.size <= this.maxBytes) return;
    let all = this.snapshot();
    while (Buffer.byteLength(all, 'utf8') > this.maxBytes && all.length > 0) {
      const exceso = Buffer.byteLength(all, 'utf8') - this.maxBytes;
      all = all.slice(Math.max(1, exceso));
    }
    this.chunks = [all];
    this.size = Buffer.byteLength(all, 'utf8');
  }
}
