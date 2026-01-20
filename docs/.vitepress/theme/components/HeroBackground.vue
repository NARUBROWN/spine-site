<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let animationFrameId: number
  let width = 0
  let height = 0

  const lines: any[] = []
  const lineCount = 40

  function initLines() {
    lines.length = 0
    for(let i=0; i<lineCount; i++) {
      lines.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.5 + Math.random() * 1.0,
        length: 100 + Math.random() * 300,
        amplitude: 15 + Math.random() * 20,
        period: (Math.random() * 0.005) + 0.002, // frequency
        phase: Math.random() * Math.PI * 2,
        thickness: 1 + Math.random(),
        opacity: 0.1 + Math.random() * 0.3
      })
    }
  }

  const resize = () => {
    // Parent should be the hero container.
    // If we want it to cover the hero background specifically, we rely on CSS positioning.
    // But to get the correct size, we can check a parent or just use window width/height if it's full screen.
    // Let's use parent element dimensions if possible, or window fallback.
    const parent = canvas.parentElement
    if (parent) {
        width = parent.clientWidth
        height = parent.clientHeight
    } else {
        width = window.innerWidth
        height = window.innerHeight
    }
    
    // Scale for high DPI
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    
    // Force CSS size
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    initLines()
  }
  
  window.addEventListener('resize', resize)
  // Initial resize
  // We might need a small delay to ensure parent is sized
  setTimeout(resize, 0)

  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    
    const time = Date.now() 
    
    // We want a subtle brand color or varying colors
    // VitePress default brand color is often around #646cff
    // Let's use a dynamic gradient or just the brand color with opacity
    
    lines.forEach(line => {
        ctx.beginPath()
        
        // Move line
        line.x += line.speed
        if(line.x > width + line.length) {
            line.x = -line.length
            line.y = Math.random() * height
        }
        
        const segmentCount = 30
        const segmentLen = line.length / segmentCount
        
        ctx.moveTo(line.x, line.y + Math.sin((line.x * line.period) + line.phase + time * 0.001) * line.amplitude)

        // Draw curved line
        for(let j=0; j<=segmentCount; j++) {
            const lx = line.x - j * segmentLen
            // Adding time to phase makes it undulate
            const ly = line.y + Math.sin(((line.x - j * segmentLen) * line.period) + line.phase + time * 0.001) * line.amplitude
            
            ctx.lineTo(lx, ly)
        }
        
        // Use a gradient for the stroke to make the tail fade
        const gradient = ctx.createLinearGradient(line.x, 0, line.x - line.length, 0)
        // Head is visible, tail fades
        const color = '100, 108, 255' // Brand-ish blue
        gradient.addColorStop(0, `rgba(${color}, ${line.opacity})`)
        gradient.addColorStop(1, `rgba(${color}, 0)`)

        ctx.strokeStyle = gradient
        ctx.lineWidth = line.thickness
        ctx.lineCap = 'round'
        ctx.stroke()
    })

    animationFrameId = requestAnimationFrame(draw)
  }

  draw()

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    cancelAnimationFrame(animationFrameId)
  })
})
</script>

<template>
  <div class="hero-bg-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.hero-bg-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 85vh; /* Limit height to viewport height or reasonable hero size */
  max-height: 900px;
  overflow: hidden;
  z-index: 0; 
  pointer-events: none;
  /* Mask to fade out the bottom */
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}
</style>
