export class ParticleEffectSquare {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: any[] = [];
  private animationFrameId: number = 0;
  private borderThickness = 40;
  private particleCount = 1200;

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
    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let i = 0; i < this.particleCount; i++) {
      let x, y;

      // Posición aleatoria en los bordes (superior, inferior, izquierdo, derecho)
      const side = Math.floor(Math.random() * 4);
      const offset = Math.random() * this.borderThickness;

      if (side === 0) { // top
        x = Math.random() * width;
        y = offset;
      } else if (side === 1) { // bottom
        x = Math.random() * width;
        y = height - offset;
      } else if (side === 2) { // left
        x = offset;
        y = Math.random() * height;
      } else { // right
        x = width - offset;
        y = Math.random() * height;
      }

      this.particles.push({
        side: side,
        x,
        y,
        radius: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.7,
        dy: (Math.random() - 0.5) * 0.7,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
  }

  private animate = (time: number) => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (time - this.lastTime < this.interval) return

    this.lastTime = time;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 215, 0, ${p.opacity})`; // dorado cálido
      this.ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      // Rebote para que se queden en el borde
      if (
        (p.x > this.borderThickness && p.x < this.canvas.width - this.borderThickness) &&
        (p.y > this.borderThickness && p.y < this.canvas.height - this.borderThickness)
      ) {
        p.dx *= -1;
        p.dy *= -1;
      }

      // Si se sale completamente, lo reposicionamos
      if (p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) {
        if(p.side == 0) {
          p.x = Math.random() * this.canvas.width;
          p.y = Math.random() * this.borderThickness;
        } else if(p.side == 1) {
          p.x = Math.random() * this.canvas.width;
          p.y = this.canvas.height - Math.random() * this.borderThickness;
        } else if(p.side == 2) {
          p.x = Math.random() * this.borderThickness;
          p.y = Math.random() * this.canvas.height;
        } else if(p.side == 3) {
          p.x = this.canvas.width - Math.random() * this.borderThickness;
          p.y = Math.random() * this.canvas.height;
        }
      }
    });
  };

  public destroy() {
    cancelAnimationFrame(this.animationFrameId);
  }
  }  