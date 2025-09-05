import { useState, useEffect, useRef } from 'react';

// Vite replaces these imports with the correct hashed URLs, so they work
// on GitHub Pages where the app is served from /axiearchero/ sub-path.
import playerSpriteUrl from '../assets/buba.png';
import enemySpriteUrl from '../assets/puffy.png';

type Vector2D = {
  x: number;
  y: number;
};

type Entity = Vector2D & {
  vx: number;
  vy: number;
  radius: number;
};

type Player = Entity & {
  aimX: number;
  aimY: number;
  lastFireTime: number;
};

type Projectile = Entity & {
  createdAt: number;
  piercesLeft: number;
  canRicochet: boolean;
};

type Enemy = Entity;
type Drop = Vector2D & { radius: number };

export default function ArcheroGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);

  /* roguelike stats & perk ui */
  const [stats, setStats] = useState({
    playerSpeed: 2.6,
    projectileSpeed: 6,
    arrowCount: 1,
    pierce: false,
    ricochet: false
  });
  const [perkOpen, setPerkOpen] = useState(false);
  const [perkChoices, setPerkChoices] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [nextMilestone, setNextMilestone] = useState(10);
  
  const [player, setPlayer] = useState<Player>({
    x: 320,
    y: 180,
    vx: 0,
    vy: 0,
    radius: 14,
    aimX: 1,
    aimY: 0,
    lastFireTime: 0
  });
  
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [playerImg, setPlayerImg] = useState<HTMLImageElement | null>(null);
  const [enemyImg, setEnemyImg] = useState<HTMLImageElement | null>(null);
  const groundPatternRef = useRef<CanvasPattern | null>(null);
  
  const [lastEnemySpawn, setLastEnemySpawn] = useState(0);
  const [mousePos, setMousePos] = useState<Vector2D>({ x: 0, y: 0 });
  
  const canvasWidth = 640;
  const canvasHeight = 360;
  /* base values kept for reset calculations */
  const BASE_PLAYER_SPEED = 2.6;
  const BASE_PROJECTILE_SPEED = 6;
  const enemySpeed = 1.3;
  const fireRate = 500;
  const enemySpawnRate = 1200;
  const projectileLifetime = 2500;
  const dropChance = 0.35;

  function project(x: number, y: number) {
    const topY = canvasHeight * 0.2;
    const bottomY = canvasHeight * 0.95;
    const t = Math.max(0, Math.min(1, y / canvasHeight));
    const widthScale = 0.6 + (1 - 0.6) * t;
    const sx = canvasWidth / 2 + (x - canvasWidth / 2) * widthScale;
    const sy = topY + (bottomY - topY) * t;
    return { sx, sy, scale: widthScale };
  }

  useEffect(() => {
    const pImg = new Image();
    pImg.src = playerSpriteUrl;
    pImg.onload = () => setPlayerImg(pImg);
    
    const eImg = new Image();
    eImg.src = enemySpriteUrl;
    eImg.onload = () => setEnemyImg(eImg);
  }, []);

  /* retry sprite load if the files were added after initial mount */
  useEffect(() => {
    if (playerImg && enemyImg) return; // nothing to do

    const id = window.setTimeout(() => {
      if (!playerImg) {
        const img = new Image();
        img.src = playerSpriteUrl;
        img.onload = () => setPlayerImg(img);
      }
      if (!enemyImg) {
        const img = new Image();
        img.src = enemySpriteUrl;
        img.onload = () => setEnemyImg(img);
      }
    }, 800);

    return () => clearTimeout(id);
  }, [playerImg, enemyImg]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!running || gameOver) return;

      const key = e.key.toLowerCase();

      setPlayer(prev => {
        const newPlayer = { ...prev };

        if (key === 'w' || key === 'arrowup') newPlayer.vy = -stats.playerSpeed;
        if (key === 's' || key === 'arrowdown') newPlayer.vy = stats.playerSpeed;
        if (key === 'a' || key === 'arrowleft') newPlayer.vx = -stats.playerSpeed;
        if (key === 'd' || key === 'arrowright') newPlayer.vx = stats.playerSpeed;

        return newPlayer;
      });
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!running || gameOver) return;
      
      const key = e.key.toLowerCase();
      
      setPlayer(prev => {
        const newPlayer = { ...prev };
        
        if ((key === 'w' || key === 'arrowup') && prev.vy < 0) newPlayer.vy = 0;
        if ((key === 's' || key === 'arrowdown') && prev.vy > 0) newPlayer.vy = 0;
        if ((key === 'a' || key === 'arrowleft') && prev.vx < 0) newPlayer.vx = 0;
        if ((key === 'd' || key === 'arrowright') && prev.vx > 0) newPlayer.vx = 0;
        
        return newPlayer;
      });
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setMousePos({ x: mouseX, y: mouseY });
      
      if (!running || gameOver) return;
      
      const pScr = project(player.x, player.y);
      const dx = mouseX - pScr.sx;
      const dy = mouseY - pScr.sy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        setPlayer(prev => ({
          ...prev,
          aimX: dx / distance,
          aimY: dy / distance
        }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [running, gameOver, player.x, player.y]);
  
  const resetGame = () => {
    setRunning(false);
    setGameOver(false);
    setScore(0);
    setKills(0);
    setPlayer({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      vx: 0,
      vy: 0,
      radius: 14,
      aimX: 1,
      aimY: 0,
      lastFireTime: 0
    });
    setProjectiles([]);
    setEnemies([]);
    setDrops([]);
    setLastEnemySpawn(0);
  };
  
  const toggleRunning = () => {
    if (!gameOver) {
      setRunning(!running);
    }
  };
  
  /* ---------- perk application ---------- */
  const applyPerk = (id: string) => {
    setStats(prev => {
      if (id === 'arrow_speed')
        return { ...prev, projectileSpeed: prev.projectileSpeed * 1.1 };
      if (id === 'player_speed')
        return { ...prev, playerSpeed: prev.playerSpeed * 1.1 };
      if (id === 'arrow_count')
        return { ...prev, arrowCount: prev.arrowCount + 1 };
      if (id === 'pierce')
        return { ...prev, pierce: true };
      if (id === 'ricochet')
        return { ...prev, ricochet: true };
      return prev;
    });
    setPerkOpen(false);
    if (!gameOver) setRunning(true);
  };
  
  const spawnEnemy = (time: number) => {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch (side) {
      case 0:
        x = Math.random() * canvasWidth;
        y = -20;
        break;
      case 1:
        x = canvasWidth + 20;
        y = Math.random() * canvasHeight;
        break;
      case 2:
        x = Math.random() * canvasWidth;
        y = canvasHeight + 20;
        break;
      case 3:
        x = -20;
        y = Math.random() * canvasHeight;
        break;
      default:
        x = 0;
        y = 0;
    }
    
    setEnemies(prev => [...prev, {
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 12
    }]);
    
    setLastEnemySpawn(time);
  };
  
  const fireProjectile = (time: number) => {
    const baseAngle = Math.atan2(player.aimY, player.aimX);
    const count = stats.arrowCount;
    const spread = Math.min(0.3, 0.08 * (count - 1));
    const newShots: Projectile[] = [];
    for (let i = 0; i < count; i++) {
      const offset =
        count === 1 ? 0 : -spread / 2 + (spread / (count - 1)) * i;
      const angle = baseAngle + offset;
      newShots.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * stats.projectileSpeed,
        vy: Math.sin(angle) * stats.projectileSpeed,
        radius: 4,
        createdAt: time,
        piercesLeft: stats.pierce ? 1 : 0,
        canRicochet: stats.ricochet
      });
    }
    setProjectiles(prev => [...prev, ...newShots]);
    
    setPlayer(prev => ({
      ...prev,
      lastFireTime: time
    }));
  };
  
  useEffect(() => {
    if (!running || gameOver) return;
    
    let animationId: number;
    let lastTime = 0;
    
    const gameLoop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      
      if (timestamp - lastEnemySpawn >= enemySpawnRate) {
        spawnEnemy(timestamp);
      }
      
      if (player.vx === 0 && player.vy === 0 && timestamp - player.lastFireTime >= fireRate) {
        fireProjectile(timestamp);
      }
      
      setPlayer(prev => {
        const newX = prev.x + prev.vx;
        const newY = prev.y + prev.vy;
        
        return {
          ...prev,
          x: Math.max(prev.radius, Math.min(canvasWidth - prev.radius, newX)),
          y: Math.max(prev.radius, Math.min(canvasHeight - prev.radius, newY))
        };
      });
      
      setProjectiles(prev => 
        prev
          .filter(p => timestamp - p.createdAt < projectileLifetime)
          .map(p => {
            let nx = p.x + p.vx;
            let ny = p.y + p.vy;
            let nvx = p.vx;
            let nvy = p.vy;
            if (p.canRicochet) {
              if (nx <= p.radius || nx >= canvasWidth - p.radius) nvx = -nvx;
              if (ny <= p.radius || ny >= canvasHeight - p.radius) nvy = -nvy;
              nx = p.x + nvx;
              ny = p.y + nvy;
            }
            return { ...p, x: nx, y: ny, vx: nvx, vy: nvy };
          })
      );
      
      setEnemies(prev => {
        return prev.map(enemy => {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          let vx = 0;
          let vy = 0;
          
          if (distance > 0) {
            vx = (dx / distance) * enemySpeed;
            vy = (dy / distance) * enemySpeed;
          }
          
          return {
            ...enemy,
            x: enemy.x + vx,
            y: enemy.y + vy,
            vx,
            vy
          };
        });
      });
      
      let newGameOver = gameOver;
      let newKills = kills;
      let newDrops = [...drops];
      let newEnemies = [...enemies];
      let newProjectiles = [...projectiles];
      
      for (const enemy of enemies) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + enemy.radius) {
          newGameOver = true;
          break;
        }
        
        for (let i = 0; i < projectiles.length; i++) {
          const projectile = projectiles[i];
          const pdx = projectile.x - enemy.x;
          const pdy = projectile.y - enemy.y;
          const pDistance = Math.sqrt(pdx * pdx + pdy * pdy);
          
          if (pDistance < projectile.radius + enemy.radius) {
            newKills++;
            newEnemies = newEnemies.filter(e => e !== enemy);
            if (projectile.piercesLeft > 0) {
              projectile.piercesLeft -= 1;
            } else {
              newProjectiles = newProjectiles.filter((_, index) => index !== i);
            }
            
            if (Math.random() < dropChance) {
              newDrops.push({
                x: enemy.x,
                y: enemy.y,
                radius: 12
              });
            }
            
            break;
          }
        }
      }
      
      let newScore = score;
      const remainingDrops = [];
      
      for (const drop of newDrops) {
        const dx = player.x - drop.x;
        const dy = player.y - drop.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + drop.radius) {
          newScore++;
        } else {
          remainingDrops.push(drop);
        }
      }
      
      if (newGameOver !== gameOver) setGameOver(newGameOver);
      if (newKills !== kills) setKills(newKills);
      if (newScore !== score) setScore(newScore);
      if (newDrops.length !== remainingDrops.length) setDrops(remainingDrops);
      if (newEnemies.length !== enemies.length) setEnemies(newEnemies);
      if (newProjectiles.length !== projectiles.length) setProjectiles(newProjectiles);

      /* ----- roguelike milestone ----- */
      if (newKills >= nextMilestone && !perkOpen) {
        const pool = [
          { id: 'arrow_speed', label: 'Increase arrow speed by 10%' },
          { id: 'player_speed', label: 'Increase player movement speed by 10%' },
          { id: 'arrow_count', label: 'Increase amount of arrows +1' },
          { id: 'pierce', label: 'Allow arrows to pierce first enemy' },
          { id: 'ricochet', label: 'Allow arrows to ricochet off borders' }
        ];
        const picks: typeof pool = [];
        while (picks.length < 3) {
          const c = pool[Math.floor(Math.random() * pool.length)];
          if (!picks.find(p => p.id === c.id)) picks.push(c);
        }
        setPerkChoices(picks);
        setPerkOpen(true);
        setRunning(false);
        setNextMilestone(nextMilestone + 10);
      }
      
      if (!newGameOver) {
        animationId = requestAnimationFrame(gameLoop);
      } else {
        setRunning(false);
      }
    };
    
    animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [running, gameOver, player, projectiles, enemies, drops, lastEnemySpawn, score, kills]);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ---------- build mottled ground pattern once ---------- */
    if (!groundPatternRef.current) {
      const pCan = document.createElement('canvas');
      pCan.width = 64;
      pCan.height = 64;
      const pCtx = pCan.getContext('2d')!;
      pCtx.fillStyle = '#6dcf74';
      pCtx.fillRect(0, 0, 64, 64);
      const grad = pCtx.createRadialGradient(32, 32, 4, 32, 32, 32);
      grad.addColorStop(0, 'rgba(90,183,101,0.6)');
      grad.addColorStop(1, 'rgba(90,183,101,0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 30; i++) {
        pCtx.fillStyle = 'rgba(255,255,255,0.08)';
        pCtx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
      }
      groundPatternRef.current = ctx.createPattern(pCan, 'repeat');
    }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    const topY = canvasHeight * 0.2;
    const bottomY = canvasHeight * 0.95;
    const topHalfW = (canvasWidth / 2) * 0.6;
    const botHalfW = canvasWidth / 2;
    const cx = canvasWidth / 2;

    const groundGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
    groundGrad.addColorStop(0, '#7bd389');
    groundGrad.addColorStop(1, '#4caf50');
    ctx.fillStyle = groundGrad;

    ctx.beginPath();
    ctx.moveTo(cx - topHalfW, topY);
    ctx.lineTo(cx + topHalfW, topY);
    ctx.lineTo(cx + botHalfW, bottomY);
    ctx.lineTo(cx - botHalfW, bottomY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    const N = 12;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const xTop = cx - topHalfW + (topHalfW * 2) * t;
      const xBot = cx - botHalfW + (botHalfW * 2) * t;
      ctx.beginPath();
      ctx.moveTo(xTop, topY);
      ctx.lineTo(xBot, bottomY);
      ctx.stroke();
    }
    
    const M = 10;
    for (let j = 1; j < M; j++) {
      const ty = topY + (bottomY - topY) * (j / M);
      const halfW = topHalfW + (botHalfW - topHalfW) * (j / M);
      ctx.beginPath();
      ctx.moveTo(cx - halfW, ty);
      ctx.lineTo(cx + halfW, ty);
      ctx.stroke();
    }

    /* ---------- textured overlay clipped to ground ---------- */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - topHalfW, topY);
    ctx.lineTo(cx + topHalfW, topY);
    ctx.lineTo(cx + botHalfW, bottomY);
    ctx.lineTo(cx - botHalfW, bottomY);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.18;
    if (groundPatternRef.current) ctx.fillStyle = groundPatternRef.current;
    ctx.fillRect(0, topY, canvasWidth, bottomY - topY);
    ctx.globalAlpha = 1;
    ctx.restore();

    /* helper to draw soft shadow */
    const drawShadow = (sx: number, sy: number, rx: number, scale = 1) => {
      const ry = rx * 0.45;
      ctx.save();
      ctx.filter = 'blur(2px)';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sx, sy + ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    
    for (const drop of drops) {
      const proj = project(drop.x, drop.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const potionR = drop.radius * proj.scale;
      drawShadow(sx, sy, potionR);
      
      const bodyGrad = ctx.createRadialGradient(
        sx, sy, potionR * 0.2,
        sx, sy, potionR
      );
      bodyGrad.addColorStop(0, '#FF94E7');
      bodyGrad.addColorStop(1, '#FF4FCC');
      
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, potionR, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const neckH = potionR * 0.35;
      const neckW = potionR * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(sx - neckW / 2, sy - potionR - neckH, neckW, neckH);
      
      const corkH = potionR * 0.3;
      const corkW = potionR * 0.65;
      ctx.fillStyle = '#B07D4F';
      ctx.fillRect(sx - corkW / 2, sy - potionR - neckH - corkH, corkW, corkH);
      
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx - potionR * 0.4, sy - potionR * 0.4, potionR * 0.6, 1.3, 1.8);
      ctx.stroke();
    }
    
    for (const enemy of enemies) {
      const proj = project(enemy.x, enemy.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const size = enemy.radius * 2 * 1.6 * proj.scale;
      drawShadow(sx, sy, enemy.radius * proj.scale);
      
      if (enemyImg) {
        ctx.drawImage(enemyImg, sx - size / 2, sy - size / 2, size, size);
      } else {
        ctx.fillStyle = '#2ECC71';
        ctx.beginPath();
        ctx.arc(sx, sy, enemy.radius * proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1E9250';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const eyeR = enemy.radius * 0.25 * proj.scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx - eyeR * 1.5, sy - eyeR, eyeR, 0, Math.PI * 2);
        ctx.arc(sx + eyeR * 1.5, sy - eyeR, eyeR, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000000';
        const pupilR = eyeR * 0.5;
        ctx.beginPath();
        ctx.arc(sx - eyeR * 1.5, sy - eyeR, pupilR, 0, Math.PI * 2);
        ctx.arc(sx + eyeR * 1.5, sy - eyeR, pupilR, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#1E9250';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy + eyeR * 1.5, enemy.radius * 0.4 * proj.scale, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    }
    
    for (const projectile of projectiles) {
      const proj = project(projectile.x, projectile.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const scale = proj.scale;
      drawShadow(sx, sy, projectile.radius * scale * 1.2, scale);
      
      ctx.fillStyle = '#5B3B1E';
      
      const angle = Math.atan2(projectile.vy, projectile.vx);
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      
      ctx.beginPath();
      ctx.moveTo(projectile.radius * 2, 0);
      ctx.lineTo(-projectile.radius, -projectile.radius);
      ctx.lineTo(-projectile.radius, projectile.radius);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
    const pproj = project(player.x, player.y);
    const sx = pproj.sx;
    const sy = pproj.sy;
    const pScale = pproj.scale;
    const pSize = player.radius * 2 * 1.6 * pScale;
    const r = player.radius * pScale;
    drawShadow(sx, sy, r);
    
    if (playerImg) {
      ctx.drawImage(playerImg, sx - pSize / 2, sy - pSize / 2, pSize, pSize);
    } else {
      ctx.fillStyle = '#FFA44D';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#A65E2E';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const earW = r * 0.55;
      const earH = r * 0.55;
      ctx.fillStyle = '#FF8C3A';
      
      ctx.beginPath();
      ctx.moveTo(sx - earW, sy - earH * 0.2);
      ctx.lineTo(sx - earW * 0.4, sy - earH);
      ctx.lineTo(sx - earW * 1.4, sy - earH);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(sx + earW, sy - earH * 0.2);
      ctx.lineTo(sx + earW * 0.4, sy - earH);
      ctx.lineTo(sx + earW * 1.4, sy - earH);
      ctx.closePath();
      ctx.fill();
      
      const eyeR = r * 0.25;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx - eyeR * 2, sy - eyeR, eyeR, 0, Math.PI * 2);
      ctx.arc(sx + eyeR * 2, sy - eyeR, eyeR, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      const pupilR = eyeR * 0.5;
      ctx.beginPath();
      ctx.arc(sx - eyeR * 2, sy - eyeR, pupilR, 0, Math.PI * 2);
      ctx.arc(sx + eyeR * 2, sy - eyeR, pupilR, 0, Math.PI * 2);
      ctx.fill();
      
      const noseW = r * 0.3;
      const noseH = r * 0.2;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(sx, sy + eyeR * 0.9, noseW / 2, noseH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#5B3B1E';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy + eyeR * 1.6, noseW, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    
    const bowRadius = r * 1.2;
    const bowAngle = Math.atan2(player.aimY, player.aimX);
    
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(bowAngle);
    
    ctx.strokeStyle = '#5B3B1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bowRadius, -0.3 * Math.PI, 0.3 * Math.PI);
    ctx.stroke();
    
    ctx.strokeStyle = '#5B3B1E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bowRadius * Math.cos(0.3 * Math.PI), bowRadius * Math.sin(0.3 * Math.PI));
    ctx.lineTo(bowRadius * Math.cos(-0.3 * Math.PI), bowRadius * Math.sin(-0.3 * Math.PI));
    ctx.stroke();
    
    ctx.restore();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 30);
    ctx.fillText(`Kills: ${kills}`, 20, 55);
    
    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', canvasWidth / 2, canvasHeight / 2 - 20);
      ctx.font = '20px Arial';
      ctx.fillText(`Final Score: ${score} | Kills: ${kills}`, canvasWidth / 2, canvasHeight / 2 + 20);
    }
    
  }, [player, projectiles, enemies, drops, score, kills, gameOver, playerImg, enemyImg]);
  
  return (
    <div className="snake-game">
      <div className="game-hud">
        <div className="score">Score: {score}</div>
        <div className="status">
          {gameOver ? 'Game Over!' : running ? 'Playing' : 'Paused'}
        </div>
      </div>
      
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="game-canvas"
        />
        {perkOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                background: 'rgba(20,20,20,0.9)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: '16px 20px',
                maxWidth: 520,
                width: '90%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 18 }}>
                Choose a power-up
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}
              >
                {perkChoices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => applyPerk(c.id)}
                    className="perk-btn"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      background: 'var(--factory-orange)',
                      color: '#fff'
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="game-controls">
        <button onClick={toggleRunning} disabled={gameOver}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={resetGame}>Reset</button>
      </div>
    </div>
  );
}

