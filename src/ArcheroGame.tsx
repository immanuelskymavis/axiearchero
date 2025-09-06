import { useState, useEffect, useRef } from 'react';

// Vite replaces these imports with the correct hashed URLs, so they work
// on GitHub Pages where the app is served from /axiearchero/ sub-path.
import playerSpriteUrl from '../assets/buba.png';
import enemySpriteUrl from '../assets/puffy.png';
import slpUrl from '../assets/SLP.png';
import coolGifUrl from '../assets/cool.gif';

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

type Enemy = Entity & {
  spawnInvulUntil: number;
};

type Drop = Vector2D & { radius: number };
type Obstacle = { x: number; y: number; width: number; height: number }; // center-based, axis-aligned

export default function ArcheroGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [slpCount, setSlpCount] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const nowRef = useRef(0);

  /* Load SLP from localStorage on mount */
  useEffect(() => {
    const saved = localStorage.getItem('slpCount');
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n)) setSlpCount(n);
    }
  }, []);

  /* Save SLP to localStorage when it changes */
  useEffect(() => {
    localStorage.setItem('slpCount', String(slpCount));
  }, [slpCount]);

  /* roguelike stats & perk ui */
  const [stats, setStats] = useState({
    playerSpeed: 3.12, // Increased by 20% from 2.6
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
    x: 640,
    y: 360,
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
  const [slpImg, setSlpImg] = useState<HTMLImageElement | null>(null);
  const groundPatternRef = useRef<CanvasPattern | null>(null);
  const stonePatternRef = useRef<CanvasPattern | null>(null);
  
  const [lastEnemySpawn, setLastEnemySpawn] = useState(0);
  /* dynamic enemy speed & ground colours */
  const [enemySpeed, setEnemySpeed] = useState(1.3);
  const [groundColors, setGroundColors] = useState({ top: '#7bd389', bottom: '#4caf50' });
  const [mousePos, setMousePos] = useState<Vector2D>({ x: 0, y: 0 });
  
  const canvasWidth = 1280;
  const canvasHeight = 720;
  const VISUAL_SCALE = 2;

  /* -------- trapezoid arena geometry -------- */
  const TOP_Y = canvasHeight * 0.06;
  const BOTTOM_Y = canvasHeight * 0.98;
  const TOP_HALF_W = canvasWidth * 0.16;
  const BOT_HALF_W = canvasWidth * 0.28;
  const cxArena = canvasWidth / 2;
  const STONE_WALL_WIDTH = 18;
  const halfWAt = (y: number) =>
    TOP_HALF_W + (BOT_HALF_W - TOP_HALF_W) * (y / canvasHeight);

  const dprRef = useRef(1);
  const MAX_ENEMIES = 35; /* --- perf: cap total enemies on screen --- */
  /* base values kept for reset calculations */
  const BASE_PLAYER_SPEED = 3.12; // Increased by 20% from 2.6
  const BASE_PROJECTILE_SPEED = 6;
  const fireRate = 500;
  const enemySpawnRate = 1200;
  const projectileLifetime = 2500;
  const dropChance = 0.25;
  const WALL_THICKNESS = 24;

  /* helper to pick two harmonious ground colours */
  const pickRandomGroundColors = () => {
    const hue = Math.floor(Math.random() * 360);
    return {
      top: `hsl(${hue} 55% 65%)`,
      bottom: `hsl(${hue} 55% 45%)`
    };
  };

  // Set up HiDPI canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    /* perf: clamp DPR so 4-5K monitors don't explode the GPU */
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
  }, []);

  function project(x: number, y: number) {
    const t = Math.max(0, Math.min(1, y / canvasHeight));
    const halfW = halfWAt(y);
    const sx = cxArena + (x - cxArena) * (halfW / BOT_HALF_W);
    const sy = TOP_Y + (BOTTOM_Y - TOP_Y) * t;
    const scale = halfW / BOT_HALF_W;
    return { sx, sy, scale };
  }

  useEffect(() => {
    const pImg = new Image();
    pImg.src = playerSpriteUrl;
    pImg.onload = () => setPlayerImg(pImg);
    
    const eImg = new Image();
    eImg.src = enemySpriteUrl;
    eImg.onload = () => setEnemyImg(eImg);
    
    const sImg = new Image();
    sImg.src = slpUrl;
    sImg.onload = () => setSlpImg(sImg);
  }, []);

  /* retry sprite load if the files were added after initial mount */
  useEffect(() => {
    if (playerImg && enemyImg && slpImg) return; // nothing to do

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
      if (!slpImg) {
        const img = new Image();
        img.src = slpUrl;
        img.onload = () => setSlpImg(img);
      }
    }, 800);

    return () => clearTimeout(id);
  }, [playerImg, enemyImg, slpImg]);

  // Collision helpers
  const circleRectCollides = (cx: number, cy: number, cr: number, ob: Obstacle): boolean => {
    // Calculate rectangle edges
    const left = ob.x - ob.width / 2;
    const right = ob.x + ob.width / 2;
    const top = ob.y - ob.height / 2;
    const bottom = ob.y + ob.height / 2;
    
    // Find closest point to circle center
    const closestX = Math.max(left, Math.min(cx, right));
    const closestY = Math.max(top, Math.min(cy, bottom));
    
    // Calculate distance from closest point to circle center
    const dx = cx - closestX;
    const dy = cy - closestY;
    
    return dx * dx + dy * dy < cr * cr;
  };
  
  const circleRectCollisionAxis = (cx: number, cy: number, cr: number, ob: Obstacle): 'x' | 'y' => {
    // Calculate rectangle edges
    const left = ob.x - ob.width / 2;
    const right = ob.x + ob.width / 2;
    const top = ob.y - ob.height / 2;
    const bottom = ob.y + ob.height / 2;
    
    // Find closest point to circle center
    const closestX = Math.max(left, Math.min(cx, right));
    const closestY = Math.max(top, Math.min(cy, bottom));
    
    // Calculate distance components
    const dx = Math.abs(cx - closestX);
    const dy = Math.abs(cy - closestY);
    
    // Return axis with greater penetration
    return dx > dy ? 'x' : 'y';
  };
  
  // Check collision with obstacles
  const checkObstacleCollision = (x: number, y: number, radius: number) => {
    for (const obstacle of obstacles) {
      if (circleRectCollides(x, y, radius, obstacle)) {
        return true; // Collision detected
      }
    }
    return false;
  };

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
    // Remove setSlpCount(0) to keep SLP persistent across runs
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
    setObstacles([]);
    setLastEnemySpawn(0);
    /* reset roguelike buffs & dynamics */
    setStats({
      playerSpeed: BASE_PLAYER_SPEED,
      projectileSpeed: 6,
      arrowCount: 1,
      pierce: false,
      ricochet: false
    });
    setNextMilestone(10);
    setPerkOpen(false);
    setEnemySpeed(1.3);
    setGroundColors({ top: '#7bd389', bottom: '#4caf50' });
  };
  
  const toggleRunning = () => {
    if (gameOver) {
      resetGame();
      setRunning(true);
      return;
    }
    setRunning(!running);
  };
  
  /* ---------- perk application ---------- */
  const applyPerk = (id: string) => {
    setStats(prev => {
      if (id === 'arrow_speed')
        return { ...prev, projectileSpeed: prev.projectileSpeed * 1.1 };
      if (id === 'player_speed')
        return { ...prev, playerSpeed: prev.playerSpeed * 1.25 }; // Increased from 1.1 to 1.25
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
    /* respect cap to avoid exponential work */
    if (enemies.length >= MAX_ENEMIES) {
      setLastEnemySpawn(time);
      return;
    }

    // Spawn within the arena
    let x, y;
    let validPosition = false;
    let attempts = 0;
    
    while (!validPosition && attempts < 20) {
      // Spawn within playable area, away from walls
      y = 40 + Math.random() * (canvasHeight - 80);
      const hw = halfWAt(y) - 40;
      x = cxArena - hw + Math.random() * (hw * 2);
      
      // Check distance from player
      const dx = player.x - x;
      const dy = player.y - y;
      const playerDist = Math.sqrt(dx * dx + dy * dy);
      
      // Check for obstacle collisions
      let collidesWithObstacle = false;
      for (const obstacle of obstacles) {
        if (circleRectCollides(x, y, 12, obstacle)) {
          collidesWithObstacle = true;
          break;
        }
      }
      
      if (playerDist > 160 && !collidesWithObstacle) {
        validPosition = true;
      }
      
      attempts++;
    }
    
    if (!validPosition) {
      // Fallback to a position that might be less ideal
      x = canvasWidth / 2 + (Math.random() - 0.5) * (canvasWidth - 200);
      y = canvasHeight / 2 + (Math.random() - 0.5) * (canvasHeight - 200);
    }
    
    setEnemies(prev => [...prev, {
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 12,
      spawnInvulUntil: time + 300 // 0.3 second invulnerability
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
  
  // Spawn obstacles at milestone
  const spawnObstacles = () => {
    const toAdd = 1 + Math.floor(Math.random() * 2); // 1-2 obstacles
    const newObstacles: Obstacle[] = [];
    
    for (let i = 0; i < toAdd; i++) {
      let validPosition = false;
      let attempts = 0;
      let x = 0, y = 0;
      
      // Try to find a valid position
      while (!validPosition && attempts < 20) {
        y = 50 + Math.random() * (canvasHeight - 100);
        const diam = player.radius * 2;
        const margin = diam/2 + 8;
        const hw = halfWAt(y) - margin;
        x = cxArena - hw + Math.random() * (hw * 2);
        
        // Check distance from player
        const dx = player.x - x;
        const dy = player.y - y;
        const playerDist = Math.sqrt(dx * dx + dy * dy);
        
        // Check overlap with existing obstacles
        let overlapsObstacle = false;
        for (const obstacle of [...obstacles, ...newObstacles]) {
          // AABB intersection test
          if (Math.abs(x - obstacle.x) < (diam + obstacle.width) / 2 && 
              Math.abs(y - obstacle.y) < (diam*2 + obstacle.height) / 2) {
            overlapsObstacle = true;
            break;
          }
        }
        
        if (playerDist > 120 && !overlapsObstacle) {
          validPosition = true;
        }
        
        attempts++;
      }
      
      if (validPosition) {
        const diam = player.radius * 2;
        newObstacles.push({
          x,
          y,
          width: diam,
          height: diam * 2 // 2x length rectangles
        });
      }
    }
    
    setObstacles(prev => [...prev, ...newObstacles]);
  };
  
  useEffect(() => {
    if (!running || gameOver) return;
    
    let animationId: number;
    let lastTime = 0;
    
    const gameLoop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      
      // Update current time reference for rendering
      nowRef.current = timestamp;
      
      if (timestamp - lastEnemySpawn >= enemySpawnRate) {
        spawnEnemy(timestamp);
      }
      
      if (player.vx === 0 && player.vy === 0 && timestamp - player.lastFireTime >= fireRate) {
        fireProjectile(timestamp);
      }
      
      setPlayer(prev => {
        let newX = prev.x + prev.vx;
        let newY = prev.y + prev.vy;
        
        // Check X-axis movement for obstacle collisions
        if (checkObstacleCollision(newX, prev.y, prev.radius)) {
          newX = prev.x; // Cancel X movement
        }
        
        // Check Y-axis movement for obstacle collisions
        if (checkObstacleCollision(prev.x, newY, prev.radius)) {
          newY = prev.y; // Cancel Y movement
        }
        
        // Trapezoid boundary clamp
        const hw = halfWAt(newY) - prev.radius;
        const minX = cxArena - hw;
        const maxX = cxArena + hw;
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(prev.radius, Math.min(canvasHeight - prev.radius, newY));
        
        return {
          ...prev,
          x: newX,
          y: newY
        };
      });
      
      // Update projectiles with obstacle collisions
      setProjectiles(prev => {
        const next: Projectile[] = [];
        for (const p of prev) {
          if (timestamp - p.createdAt >= projectileLifetime) continue;
          
          let vx = p.vx, vy = p.vy, x = p.x, y = p.y;
          
          let nx = x + vx;
          let ny = y + vy;
          
          // Trapezoid boundary check
          const hwN = halfWAt(ny) - p.radius;
          if (nx < cxArena - hwN || nx > cxArena + hwN) {
            if (p.canRicochet) { vx = -vx; nx = x + vx; } else { continue; }
          }
          if (ny < p.radius || ny > canvasHeight - p.radius) {
            if (p.canRicochet) { vy = -vy; ny = y + vy; } else { continue; }
          }
          
          // Test obstacles
          let hitAxis: 'x'|'y' | null = null;
          for (const ob of obstacles) {
            if (circleRectCollides(nx, ny, p.radius, ob)) {
              hitAxis = circleRectCollisionAxis(nx, ny, p.radius, ob);
              if (p.canRicochet) {
                if (hitAxis === 'x') vx = -vx; else vy = -vy;
                nx = x + vx; ny = y + vy;
              } else {
                // destroy projectile
                hitAxis = 'x'; // non-null
              }
              break;
            }
          }
          
          if (!p.canRicochet && hitAxis) continue;
          next.push({ ...p, x: nx, y: ny, vx, vy });
        }
        return next;
      });
      
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
          
          let newX = enemy.x + vx;
          let newY = enemy.y + vy;
          
          // Check X-axis movement for obstacle collisions
          if (checkObstacleCollision(newX, enemy.y, enemy.radius)) {
            newX = enemy.x; // Cancel X movement
          }
          
          // Check Y-axis movement for obstacle collisions
          if (checkObstacleCollision(enemy.x, newY, enemy.radius)) {
            newY = enemy.y; // Cancel Y movement
          }
          
          // Trapezoid boundary clamp
          const hw = halfWAt(newY) - enemy.radius;
          const minX = cxArena - hw;
          const maxX = cxArena + hw;
          newX = Math.max(minX, Math.min(maxX, newX));
          newY = Math.max(enemy.radius, Math.min(canvasHeight - enemy.radius, newY));
          
          return {
            ...enemy,
            x: newX,
            y: newY,
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
      let newSlp = slpCount;
      
      // Flags to track changes
      let dropsChanged = false;
      let enemiesChanged = false;
      let projectilesChanged = false;
      
      for (const enemy of enemies) {
        // Skip invulnerable enemies
        if (timestamp < enemy.spawnInvulUntil) continue;
        
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
            enemiesChanged = true;
            
            if (projectile.piercesLeft > 0) {
              projectile.piercesLeft -= 1;
            } else {
              newProjectiles = newProjectiles.filter((_, index) => index !== i);
              projectilesChanged = true;
            }
            
            if (Math.random() < dropChance) {
              newDrops.push({
                x: enemy.x,
                y: enemy.y,
                radius: 12
              });
              dropsChanged = true;
            }
            
            break;
          }
        }
      }
      
      const remainingDrops = [];
      
      for (const drop of newDrops) {
        const dx = player.x - drop.x;
        const dy = player.y - drop.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + drop.radius) {
          newSlp++;
          dropsChanged = true;
        } else {
          remainingDrops.push(drop);
        }
      }
      
      if (newGameOver !== gameOver) setGameOver(newGameOver);
      if (newKills !== kills) setKills(newKills);
      if (newSlp !== slpCount) setSlpCount(newSlp);
      
      // Use flags to determine when to update state
      if (dropsChanged) setDrops(remainingDrops);
      if (enemiesChanged) setEnemies(newEnemies);
      if (projectilesChanged) setProjectiles(newProjectiles);

      /* ----- roguelike milestone ----- */
      if (newKills >= nextMilestone && !perkOpen) {
        const pool = [
          { id: 'arrow_speed', label: 'Increase arrow speed by 10%' },
          { id: 'player_speed', label: 'Increase player movement speed by 25%' }, // Updated from 10% to 25%
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
        /* change floor colour & speed up enemies */
        setGroundColors(pickRandomGroundColors());
        setEnemySpeed(prev => prev * 1.1);
        setNextMilestone(nextMilestone + 10);
        
        // Spawn obstacles at milestone
        spawnObstacles();
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
  }, [running, gameOver, player, projectiles, enemies, drops, lastEnemySpawn, score, kills, slpCount, obstacles]);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
    ctx.imageSmoothingEnabled = true;

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
    
    /* ---------- build stone wall pattern once ---------- */
    if (!stonePatternRef.current) {
      const sCan = document.createElement('canvas');
      sCan.width = 32;
      sCan.height = 32;
      const sCtx = sCan.getContext('2d')!;
      
      // Base color
      sCtx.fillStyle = '#777';
      sCtx.fillRect(0, 0, 32, 32);
      
      // Add stone texture
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * 32;
        const y = Math.random() * 32;
        const size = 2 + Math.random() * 4;
        const shade = 70 + Math.floor(Math.random() * 40);
        sCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
        sCtx.beginPath();
        sCtx.arc(x, y, size, 0, Math.PI * 2);
        sCtx.fill();
      }
      
      // Add cracks/lines
      sCtx.strokeStyle = '#555';
      sCtx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        sCtx.beginPath();
        sCtx.moveTo(Math.random() * 32, Math.random() * 32);
        sCtx.lineTo(Math.random() * 32, Math.random() * 32);
        sCtx.stroke();
      }
      
      stonePatternRef.current = ctx.createPattern(sCan, 'repeat');
    }
    
    ctx.clearRect(0, 0, canvasWidth * dprRef.current, canvasHeight * dprRef.current);
    
    const groundGrad = ctx.createLinearGradient(0, TOP_Y, 0, BOTTOM_Y);
    groundGrad.addColorStop(0, groundColors.top);
    groundGrad.addColorStop(1, groundColors.bottom);
    ctx.fillStyle = groundGrad;

    ctx.beginPath();
    ctx.moveTo(cxArena - TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + BOT_HALF_W, BOTTOM_Y);
    ctx.lineTo(cxArena - BOT_HALF_W, BOTTOM_Y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    const N = 12;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const xTop = cxArena - TOP_HALF_W + (TOP_HALF_W * 2) * t;
      const xBot = cxArena - BOT_HALF_W + (BOT_HALF_W * 2) * t;
      ctx.beginPath();
      ctx.moveTo(xTop, TOP_Y);
      ctx.lineTo(xBot, BOTTOM_Y);
      ctx.stroke();
    }
    
    const M = 10;
    for (let j = 1; j < M; j++) {
      const ty = TOP_Y + (BOTTOM_Y - TOP_Y) * (j / M);
      const halfW = TOP_HALF_W + (BOT_HALF_W - TOP_HALF_W) * (j / M);
      ctx.beginPath();
      ctx.moveTo(cxArena - halfW, ty);
      ctx.lineTo(cxArena + halfW, ty);
      ctx.stroke();
    }

    /* ---------- textured overlay clipped to ground ---------- */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cxArena - TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + BOT_HALF_W, BOTTOM_Y);
    ctx.lineTo(cxArena - BOT_HALF_W, BOTTOM_Y);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.18;
    if (groundPatternRef.current) ctx.fillStyle = groundPatternRef.current;
    ctx.fillRect(0, TOP_Y, canvasWidth, BOTTOM_Y - TOP_Y);
    ctx.globalAlpha = 1;
    ctx.restore();
    
    /* ---------- draw stone walls ---------- */
    ctx.save();
    ctx.lineWidth = STONE_WALL_WIDTH;
    ctx.strokeStyle = (stonePatternRef.current as any) || '#777';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(cxArena - TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena - BOT_HALF_W, BOTTOM_Y);
    ctx.moveTo(cxArena + TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + BOT_HALF_W, BOTTOM_Y);
    ctx.moveTo(cxArena - TOP_HALF_W, TOP_Y);
    ctx.lineTo(cxArena + TOP_HALF_W, TOP_Y);
    ctx.stroke();
    ctx.restore();

    /* helper to draw soft shadow */
    const drawShadow = (sx: number, sy: number, rx: number, scale = 1) => {
      const ry = rx * 0.45;
      ctx.save();
      /* perf: remove blur filter (very slow), rely on alpha for softness */
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sx, sy + ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    
    // Draw obstacles
    for (const obstacle of obstacles) {
      const proj = project(obstacle.x, obstacle.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const sizeW = obstacle.width * proj.scale * VISUAL_SCALE;
      const sizeH = obstacle.height * proj.scale * VISUAL_SCALE;
      
      // Draw shadow under the obstacle
      drawShadow(sx, sy, Math.max(sizeW, sizeH) / 2);
      
      // Draw rock-like rectangular obstacle
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.rect(sx - sizeW/2, sy - sizeH/2, sizeW, sizeH);
      ctx.fill();
      
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add some texture to the rock
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.arc(sx - sizeW * 0.15, sy - sizeH * 0.1, sizeW * 0.2, 0, Math.PI * 2);
      ctx.fill();
      
      // Add a second texture spot
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(sx + sizeW * 0.1, sy + sizeH * 0.15, sizeW * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    for (const drop of drops) {
      const proj = project(drop.x, drop.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const size = drop.radius * 2 * proj.scale * VISUAL_SCALE;
      drawShadow(sx, sy, size * 0.45);
      
      if (slpImg) {
        ctx.drawImage(slpImg, sx - size/2, sy - size/2, size, size);
      } else {
        const bodyGrad = ctx.createRadialGradient(
          sx, sy, size * 0.1,
          sx, sy, size * 0.5
        );
        bodyGrad.addColorStop(0, '#FF94E7');
        bodyGrad.addColorStop(1, '#FF4FCC');
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Thicker white stroke for better visibility when image is missing
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    
    for (const enemy of enemies) {
      const proj = project(enemy.x, enemy.y);
      const sx = proj.sx;
      const sy = proj.sy;
      
      // Apply spawn animation if enemy is invulnerable
      const isSpawning = nowRef.current < enemy.spawnInvulUntil;
      const spawnProgress = isSpawning ? 
        1 - (enemy.spawnInvulUntil - nowRef.current) / 300 : 1;
      const scaleFactor = 0.5 + 0.5 * Math.max(0, Math.min(1, spawnProgress));
      
      const size = enemy.radius * 2 * 1.6 * proj.scale * VISUAL_SCALE * scaleFactor;
      
      if (!isSpawning) {
        drawShadow(sx, sy, enemy.radius * proj.scale * VISUAL_SCALE);
      }
      
      if (isSpawning) {
        ctx.globalAlpha = 0.6;
      }
      
      if (enemyImg) {
        ctx.drawImage(enemyImg, sx - size / 2, sy - size / 2, size, size);
      } else {
        ctx.fillStyle = '#2ECC71';
        ctx.beginPath();
        ctx.arc(sx, sy, enemy.radius * proj.scale * VISUAL_SCALE * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1E9250';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const eyeR = enemy.radius * 0.25 * proj.scale * VISUAL_SCALE * scaleFactor;
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
        ctx.arc(sx, sy + eyeR * 1.5, enemy.radius * 0.4 * proj.scale * VISUAL_SCALE * scaleFactor, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
      
      if (isSpawning) {
        ctx.globalAlpha = 1;
      }
    }
    
    for (const projectile of projectiles) {
      const proj = project(projectile.x, projectile.y);
      const sx = proj.sx;
      const sy = proj.sy;
      const scale = proj.scale;
      drawShadow(sx, sy, projectile.radius * scale * 1.2 * VISUAL_SCALE, scale);
      
      ctx.fillStyle = '#5B3B1E';
      
      const angle = Math.atan2(projectile.vy, projectile.vx);
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      
      ctx.beginPath();
      ctx.moveTo(projectile.radius * 2 * VISUAL_SCALE, 0);
      ctx.lineTo(-projectile.radius * VISUAL_SCALE, -projectile.radius * VISUAL_SCALE);
      ctx.lineTo(-projectile.radius * VISUAL_SCALE, projectile.radius * VISUAL_SCALE);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
    const pproj = project(player.x, player.y);
    const sx = pproj.sx;
    const sy = pproj.sy;
    const pScale = pproj.scale;
    const pSize = player.radius * 2 * 1.6 * pScale * VISUAL_SCALE;
    const r = player.radius * pScale * VISUAL_SCALE;
    drawShadow(sx, sy, r);
    
    // Draw aim line from player to mouse
    ctx.strokeStyle = 'rgba(180,180,180,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mousePos.x, mousePos.y);
    ctx.stroke();
    
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
    
    // Draw yellow highlight when player is idle (firing)
    if (player.vx === 0 && player.vy === 0 && running && !gameOver) {
      ctx.strokeStyle = 'rgba(255,230,0,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const ringR = playerImg ? (pSize/2) * 1.03 : r * 1.05;
      ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
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
    ctx.fillText(`SLP: ${slpCount}`, 20, 80);
    
    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', canvasWidth / 2, canvasHeight / 2 - 20);
      ctx.font = '20px Arial';
      ctx.fillText(`Final Score: ${score} | Kills: ${kills} | SLP: ${slpCount}`, canvasWidth / 2, canvasHeight / 2 + 20);
    }
    
  }, [player, projectiles, enemies, drops, score, kills, slpCount, gameOver, playerImg, enemyImg, slpImg, obstacles, mousePos, running]);
  
  return (
    <div className="snake-game">
      <div className="game-hud">
        <div className="score">Score: {score}</div>
        <div className="status">
          {gameOver ? 'Game Over!' : running ? 'Playing' : 'Paused'}
        </div>
      </div>
      {/* Game title */}
      <h1
        style={{
          fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
          margin: '8px 0 12px'
        }}
      >
        Archaxieo
      </h1>
      
      <div style={{ marginBottom: 8, lineHeight: 1.2 }}>
        <div>Kills: {kills}</div>
        <div>SLP: {slpCount}</div>
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
                  <div
                    key={c.id}
                    onClick={() => applyPerk(c.id)}
                    style={{
                      width: 140,
                      height: 240,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: 12,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      cursor: 'pointer',
                      color: '#fff',
                      fontWeight: 700
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {gameOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img 
              src={coolGifUrl} 
              alt="Cool animation" 
              style={{
                maxWidth: '80%',
                maxHeight: '80%',
                borderRadius: 12,
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
              }}
            />
          </div>
        )}
      </div>
      
      <div className="game-controls">
        <button onClick={toggleRunning} disabled={false}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={resetGame}>Reset</button>
      </div>
    </div>
  );
}
