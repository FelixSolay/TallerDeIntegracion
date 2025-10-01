export class ParticleEffectCircle {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: any[] = [];
  private animationFrameId: number = 0;
  private radius = 130;
  private particleCount = 300;

  private lastTime = 0;
  private fps = 20;
  private interval = 1000 / this.fps;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) throw new Error(`Canvas con ID "${canvasId}" no encontrado`);
    this.ctx = this.canvas.getContext('2d')!;
    this.setupCanvas();
    this.createParticles();
    requestAnimationFrame(this.animate);
  }

  private setupCanvas() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  private createParticles() {
    for (let i = 0; i < this.particleCount; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * this.radius;

      this.particles.push({
        x: this.canvas.width / 2 + Math.cos(angle) * distance,
        y: this.canvas.height / 2 + Math.sin(angle) * distance,
        radius: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.7,
        dy: (Math.random() - 0.5) * 0.7,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }
  }

  private animate = (time: number) => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (time - this.lastTime < this.interval) return
    this.lastTime = time;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 3. Dibujá partículas
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 223, 100, ${p.opacity})`;
      this.ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      const dx = p.x - this.canvas.width / 2;
      const dy = p.y - this.canvas.height / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.radius) {
        p.dx *= -1;
        p.dy *= -1;
      }
    });
  };

  public destroy() {
    cancelAnimationFrame(this.animationFrameId);
  }
}
  
  