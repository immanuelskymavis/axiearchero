import { useState, useEffect, useRef } from 'react';

type Position = {
  x: number;
  y: number;
};

type Direction = 'up' | 'down' | 'left' | 'right';

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [direction, setDirection] = useState<Direction>('right');
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [score, setScore] = useState(0);

  const cellSize = 20;
  const gridSize = 20;
  const canvasSize = cellSize * gridSize;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if ((key === 'arrowup' || key === 'w') && direction !== 'down') {
        setDirection('up');
      } else if ((key === 'arrowdown' || key === 's') && direction !== 'up') {
        setDirection('down');
      } else if ((key === 'arrowleft' || key === 'a') && direction !== 'right') {
        setDirection('left');
      } else if ((key === 'arrowright' || key === 'd') && direction !== 'left') {
        setDirection('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  const placeFood = () => {
    const newFood: Position = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize)
    };

    for (const segment of snake) {
      if (segment.x === newFood.x && segment.y === newFood.y) {
        return placeFood();
      }
    }

    setFood(newFood);
  };

  const resetGame = () => {
    setRunning(false);
    setGameOver(false);
    setDirection('right');
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ]);
    setScore(0);
    placeFood();
  };

  const toggleRunning = () => {
    if (!gameOver) {
      setRunning(!running);
    }
  };

  useEffect(() => {
    if (!running || gameOver) return;

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        
        switch (direction) {
          case 'up':
            head.y -= 1;
            break;
          case 'down':
            head.y += 1;
            break;
          case 'left':
            head.x -= 1;
            break;
          case 'right':
            head.x += 1;
            break;
        }

        if (
          head.x < 0 || 
          head.x >= gridSize || 
          head.y < 0 || 
          head.y >= gridSize
        ) {
          setGameOver(true);
          setRunning(false);
          return prevSnake;
        }

        for (let i = 1; i < prevSnake.length; i++) {
          if (head.x === prevSnake[i].x && head.y === prevSnake[i].y) {
            setGameOver(true);
            setRunning(false);
            return prevSnake;
          }
        }

        const newSnake = [head, ...prevSnake];
        
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 1);
          placeFood();
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 140);

    return () => clearInterval(gameLoop);
  }, [running, direction, food, gameOver]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasSize);
    bgGrad.addColorStop(0, '#BEE3F8');
    bgGrad.addColorStop(1, '#63B3ED');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 7;
    const cloud = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 0.8, y + r * 0.3, r * 0.9, 0, Math.PI * 2);
      ctx.arc(x - r * 0.8, y + r * 0.3, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    };
    cloud(canvasSize * 0.2, canvasSize * 0.25, cellSize * 1.6);
    cloud(canvasSize * 0.5, canvasSize * 0.15, cellSize * 2);
    cloud(canvasSize * 0.75, canvasSize * 0.35, cellSize * 1.8);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    
    snake.forEach((segment, index) => {
      const px = segment.x * cellSize;
      const py = segment.y * cellSize;
      if (index === 0) {
        const cx = px + cellSize / 2;
        const cy = py + cellSize / 2;
        const r = cellSize * 0.45;
        ctx.fillStyle = '#FFA44D';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#A65E2E';
        ctx.lineWidth = 2;
        ctx.stroke();
        const earW = cellSize * 0.28;
        const earH = cellSize * 0.28;
        ctx.fillStyle = '#FF8C3A';
        ctx.beginPath();
        ctx.moveTo(cx - earW, py - earH * 0.2);
        ctx.lineTo(cx - earW * 0.4, py - earH);
        ctx.lineTo(cx - earW * 1.4, py - earH);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + earW, py - earH * 0.2);
        ctx.lineTo(cx + earW * 0.4, py - earH);
        ctx.lineTo(cx + earW * 1.4, py - earH);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        const eyeR = cellSize * 0.12;
        ctx.beginPath();
        ctx.arc(cx - eyeR * 2, cy - eyeR, eyeR, 0, Math.PI * 2);
        ctx.arc(cx + eyeR * 2, cy - eyeR, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        const pupilR = eyeR * 0.5;
        ctx.beginPath();
        ctx.arc(cx - eyeR * 2, cy - eyeR, pupilR, 0, Math.PI * 2);
        ctx.arc(cx + eyeR * 2, cy - eyeR, pupilR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        const noseW = cellSize * 0.14;
        const noseH = cellSize * 0.08;
        ctx.beginPath();
        ctx.ellipse(cx, cy + eyeR * 0.9, noseW / 2, noseH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5B3B1E';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy + eyeR * 1.6, noseW, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#19E6B5';
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    });

    // reset any remaining shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    const fcx = food.x * cellSize + cellSize / 2;
    const fcy = food.y * cellSize + cellSize / 2;
    const potionR = cellSize * 0.48;
    const bodyGrad = ctx.createRadialGradient(
      fcx,
      fcy,
      potionR * 0.2,
      fcx,
      fcy,
      potionR
    );
    bodyGrad.addColorStop(0, '#FF94E7');
    bodyGrad.addColorStop(1, '#FF4FCC');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(fcx, fcy, potionR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const neckH = cellSize * 0.16;
    const neckW = cellSize * 0.34;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(fcx - neckW / 2, fcy - potionR - neckH, neckW, neckH);
    const corkH = cellSize * 0.14;
    const corkW = cellSize * 0.30;
    ctx.fillStyle = '#B07D4F';
    ctx.fillRect(fcx - corkW / 2, fcy - potionR - neckH - corkH, corkW, corkH);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fcx - potionR * 0.4, fcy - potionR * 0.4, potionR * 0.6, 1.3, 1.8);
    ctx.stroke();
    
  }, [snake, food]);

  return (
    <div className="snake-game">
      <div className="game-hud">
        <div className="score">Score: {score}</div>
        <div className="status">
          {gameOver ? 'Game Over!' : running ? 'Playing' : 'Paused'}
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className="game-canvas"
      />
      
      <div className="game-controls">
        <button onClick={toggleRunning} disabled={gameOver}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={resetGame}>Reset</button>
      </div>
    </div>
  );
}
