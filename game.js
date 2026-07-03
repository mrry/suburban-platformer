// Game Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const GAME_STATE = {
  START: 'start',
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
  WIN: 'win',
  SECRET_ROOM: 'secret_room',
  SECRET_MINIGAME_ROOM: 'secret_minigame_room'
};
let currentState = GAME_STATE.START;
let score = 0;
let time = 0;

// Seedable Pseudo-Random Number Generator (Mulberry32)
let currentSeed = "HOUSE";
let seedVal = 12345;

function setSeed(str) {
  currentSeed = str.toUpperCase().trim().slice(0, 5);
  if (currentSeed === "") currentSeed = "HOUSE";
  
  let hash = 0;
  for (let i = 0; i < currentSeed.length; i++) {
    hash = (hash << 5) - hash + currentSeed.charCodeAt(i);
    hash |= 0;
  }
  seedVal = hash;
}

function seededRandom() {
  let t = seedVal += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function generateRandomSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// Dimensions
const LEVEL_WIDTH = 4800;
const LEVEL_HEIGHT = 700;
const VIEWPORT_WIDTH = canvas.width;
const VIEWPORT_HEIGHT = canvas.height;

// Camera
const camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  lerp: 0.1
};

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return; // Prevent jump loops / keydown repeat spam!
  const key = e.key.toLowerCase();
  keys[key] = true;
  
  if (key === 'r') {
    resetGame();
  }
  if (currentState === GAME_STATE.START) {
    if (key === 'a') {
      selectGameMode('baseball');
      startGame();
    } else if (key === 'b') {
      selectGameMode('basketball');
      startGame();
    }
  }
  if ((key === 'k' || e.key === 'Enter')) {
    if (currentState === GAME_STATE.SECRET_MINIGAME_ROOM && player.mode === 'baseball') {
      if (minigameSwingTimer === 0) {
        minigameSwingTimer = 15;
        AudioEffects.playBaseballThrow();
        if (minigamePitchedBall && minigamePitchedBall.active && !minigamePitchedBall.hit) {
          const dist = Math.hypot((player.x + player.width/2) - minigamePitchedBall.x, (player.y + player.height/2) - minigamePitchedBall.y);
          if (dist < 60) {
            minigamePitchedBall.hit = true;
            minigamePitchedBall.vx = 8 + Math.random() * 5;
            minigamePitchedBall.vy = -6 - Math.random() * 4;
            minigameScore++;
            minigameMessage = "HIT!";
            minigameMessageTimer = 90;
            // Synthesized bat crack
            AudioEffects.playBounce();
            const context = AudioEffects.ctx;
            if (context) {
              const osc = context.createOscillator();
              const gain = context.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(350, context.currentTime);
              osc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.15);
              gain.gain.setValueAtTime(0.35, context.currentTime);
              gain.gain.linearRampToValueAtTime(0.01, context.currentTime + 0.15);
              osc.connect(gain);
              gain.connect(context.destination);
              osc.start();
              osc.stop(context.currentTime + 0.15);
            }
            spawnParticles(minigamePitchedBall.x, minigamePitchedBall.y, '#fef08a', 20);
            
            const pType = Math.random() > 0.5 ? 'health' : 'speed';
            minigamePowerups.push({
              x: 250 + Math.random() * 200,
              y: 456,
              width: 24,
              height: 24,
              type: pType,
              draw(ctx, cx, cy) {
                ctx.fillStyle = this.type === 'health' ? '#ef4444' : '#fbbf24';
                ctx.fillRect(this.x - cx, this.y - cy, this.width, this.height);
                ctx.strokeStyle = '#05030d';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(this.x - cx, this.y - cy, this.width, this.height);
                ctx.fillStyle = '#ffffff';
                ctx.font = '6px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText(this.type === 'health' ? 'HP' : 'SPD', this.x + 12 - cx, this.y + 15 - cy);
              }
            });
          } else {
            minigameMessage = "MISS / STRIKE!";
            minigameMessageTimer = 60;
          }
        }
      }
    } else if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.SECRET_ROOM || currentState === GAME_STATE.SECRET_MINIGAME_ROOM) && !player.isCharging && player.attackCooldown === 0) {
      startCharging();
    }
  }
  // Prevent space/arrow scrolling default browser behavior
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;
  
  if ((key === 'k' || e.key === 'Enter') && (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.SECRET_ROOM || currentState === GAME_STATE.SECRET_MINIGAME_ROOM) && player.isCharging) {
    launchBall();
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (currentState === GAME_STATE.SECRET_MINIGAME_ROOM && player.mode === 'baseball') {
    if (minigameSwingTimer === 0) {
      minigameSwingTimer = 15;
      AudioEffects.playBaseballThrow();
      if (minigamePitchedBall && minigamePitchedBall.active && !minigamePitchedBall.hit) {
        const dist = Math.hypot((player.x + player.width/2) - minigamePitchedBall.x, (player.y + player.height/2) - minigamePitchedBall.y);
        if (dist < 60) {
          minigamePitchedBall.hit = true;
          minigamePitchedBall.vx = 8 + Math.random() * 5;
          minigamePitchedBall.vy = -6 - Math.random() * 4;
          minigameScore++;
          minigameMessage = "HIT!";
          minigameMessageTimer = 90;
          AudioEffects.playBounce();
          const context = AudioEffects.ctx;
          if (context) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, context.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.15);
            gain.gain.setValueAtTime(0.35, context.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, context.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(context.destination);
            osc.start();
            osc.stop(context.currentTime + 0.15);
          }
          spawnParticles(minigamePitchedBall.x, minigamePitchedBall.y, '#fef08a', 20);
          
          const pType = Math.random() > 0.5 ? 'health' : 'speed';
          minigamePowerups.push({
            x: 250 + Math.random() * 200,
            y: 456,
            width: 24,
            height: 24,
            type: pType,
            draw(ctx, cx, cy) {
              ctx.fillStyle = this.type === 'health' ? '#ef4444' : '#fbbf24';
              ctx.fillRect(this.x - cx, this.y - cy, this.width, this.height);
              ctx.strokeStyle = '#05030d';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(this.x - cx, this.y - cy, this.width, this.height);
              ctx.fillStyle = '#ffffff';
              ctx.font = '6px "Press Start 2P"';
              ctx.textAlign = 'center';
              ctx.fillText(this.type === 'health' ? 'HP' : 'SPD', this.x + 12 - cx, this.y + 15 - cy);
            }
          });
        } else {
          minigameMessage = "MISS / STRIKE!";
          minigameMessageTimer = 60;
        }
      }
    }
  } else if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.SECRET_ROOM || currentState === GAME_STATE.SECRET_MINIGAME_ROOM) {
    if (!player.isCharging && player.attackCooldown === 0) {
      startCharging();
    }
  } else if (currentState === GAME_STATE.START) {
    startGame();
  } else if (currentState === GAME_STATE.GAMEOVER || currentState === GAME_STATE.WIN) {
    resetGame();
  }
});
window.addEventListener('mouseup', (e) => {
  if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.SECRET_ROOM || currentState === GAME_STATE.SECRET_MINIGAME_ROOM) && player.isCharging) {
    launchBall();
  }
});

// Particles System
let particles = [];
function spawnParticles(x, y, color, count = 10, isMusic = false) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - (isMusic ? 3 : 1),
      color,
      size: isMusic ? Math.random() * 6 + 4 : Math.random() * 4 + 2,
      alpha: 1,
      life: 0.02 + Math.random() * 0.03,
      isMusicNote: isMusic,
      noteType: Math.floor(Math.random() * 3) // 0: ♪, 1: ♫, 2: ♩
    });
  }
}

// Player Class
class Player {
  constructor() {
    this.x = 100;
    this.y = 400;
    this.width = 48;
    this.height = 72;
    this.vx = 0;
    this.vy = 0;
    this.speed = 4;
    this.accel = 0.5;
    this.friction = 0.85;
    this.gravity = 0.45;
    this.jumpForce = -9.5;
    this.isGrounded = false;
    this.doubleJumpAvailable = true;
    this.facingRight = true;
    this.hp = 3;
    this.maxHp = 3;
    this.invincibilityFrames = 0;
    this.attackCooldown = 0;
    this.attackAnimTimer = 0;
    
    // Customization
    this.shirtColor = '#3b82f6';
    this.pantsColor = '#10b981';
    this.shoesColor = '#f59e0b';
    this.mode = 'baseball'; // 'baseball' or 'basketball'
    this.faceCanvas = null; // Stored 128x128 canvas of player's face
    this.powerupTimer = 0; // Timer for speed boost powerup
    
    // Aim / Charge States
    this.isCharging = false;
    this.chargePower = 0;
    this.maxChargePower = 10;
    this.chargeAngle = -Math.PI / 6;
    
    // Animation
    this.walkCycle = 0;
    this.isWalking = false;
    this.dropThroughTimer = 0;
    this.isDroppingThrough = false;
  }

  update() {
    // Handle Drop-Through timer
    if (this.dropThroughTimer > 0) {
      this.dropThroughTimer--;
      this.isDroppingThrough = true;
      this.isGrounded = false;
    } else {
      this.isDroppingThrough = false;
    }

    const crouchActive = keys['s'] || keys['arrowdown'];
    const moveActive = keys['a'] || keys['d'] || keys['arrowleft'] || keys['arrowright'];
    
    if (crouchActive && moveActive && this.isGrounded) {
      // Check if we are standing on a jump-through platform
      let onJumpThrough = false;
      for (const plat of platforms) {
        const isJumpThroughType = (
          plat.type === 'jump-through' ||
          plat.type === 'bookshelf' ||
          plat.type === 'couch' ||
          plat.type === 'fridge' ||
          plat.type === 'dining-table' ||
          plat.type === 'bed' ||
          plat.type === 'wardrobe' ||
          plat.type === 'box-pile' ||
          plat.type === 'counter' ||
          plat.label === '2nd Floor Deck' ||
          plat.label === 'Stairs' ||
          plat.label === 'Attic Ladder Step'
        );
        if (isJumpThroughType) {
          if (
            this.x + this.width > plat.x &&
            this.x < plat.x + plat.width &&
            Math.abs((this.y + this.height) - plat.y) < 6
          ) {
            onJumpThrough = true;
            break;
          }
        }
      }
      if (onJumpThrough) {
        this.dropThroughTimer = 15; // bypass collision for 15 frames
        this.isGrounded = false;
        this.y += 6; // nudge down past the platform top!
        this.vy = 1.5; // start falling down
        AudioEffects.playBounce(); // bounce sound for drop-through feedback
      }
    }

    // Handle Invincibility
    if (this.invincibilityFrames > 0) {
      this.invincibilityFrames--;
    }

    // Handle Attack timers
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.attackAnimTimer > 0) this.attackAnimTimer--;

    // Movement inputs
    let moveDir = 0;
    if (!this.isCharging) {
      if (keys['a'] || keys['arrowleft']) {
        moveDir = -1;
        this.facingRight = false;
      }
      if (keys['d'] || keys['arrowright']) {
        moveDir = 1;
        this.facingRight = true;
      }
    } else {
      // Direction swap while aiming
      if (keys['a'] || keys['arrowleft']) {
        if (this.facingRight) {
          this.facingRight = false;
          this.chargeAngle = -Math.PI - this.chargeAngle;
        }
      }
      if (keys['d'] || keys['arrowright']) {
        if (!this.facingRight) {
          this.facingRight = true;
          this.chargeAngle = -Math.PI - this.chargeAngle;
        }
      }
    }

    // Accelerate horizontal
    if (moveDir !== 0) {
      this.vx += moveDir * this.accel;
      if (Math.abs(this.vx) > this.speed) {
        this.vx = Math.sign(this.vx) * this.speed;
      }
      this.isWalking = true;
      this.walkCycle += 0.15;
    } else {
      this.vx *= this.friction;
      if (Math.abs(this.vx) < 0.1) {
        this.vx = 0;
        this.isWalking = false;
      }
    }

    // Apply gravity
    this.vy += this.gravity;
    if (this.vy > 12) this.vy = 12; // Terminal velocity

    // Charge & Aim adjustments
    if (this.isCharging) {
      this.chargePower = Math.min(this.maxChargePower, this.chargePower + 0.16);

      if (keys['w'] || keys['arrowup']) {
        if (this.facingRight) {
          this.chargeAngle = Math.max(-Math.PI / 2, this.chargeAngle - 0.04);
        } else {
          this.chargeAngle = Math.min(-Math.PI / 2, this.chargeAngle + 0.04);
        }
      }
      if (keys['s'] || keys['arrowdown']) {
        if (this.facingRight) {
          this.chargeAngle = Math.min(0, this.chargeAngle + 0.04);
        } else {
          this.chargeAngle = Math.max(-Math.PI, this.chargeAngle - 0.04);
        }
      }
    }

    // Jump Input
    if (!this.isCharging && (keys['w'] || keys['space'] || keys['arrowup'])) {
      if (this.isGrounded) {
        this.vy = this.jumpForce;
        this.isGrounded = false;
        this.doubleJumpAvailable = true;
        AudioEffects.playJump();
        keys['w'] = keys['space'] = keys['arrowup'] = false; // consume input
      } else if (this.doubleJumpAvailable) {
        this.vy = this.jumpForce * 0.9;
        this.doubleJumpAvailable = false;
        AudioEffects.playJump();
        // spawn double jump cloud puff
        spawnParticles(this.x + this.width / 2, this.y + this.height, '#ffffff', 8);
        keys['w'] = keys['space'] = keys['arrowup'] = false; // consume input
      }
    }

    // Apply velocities
    this.x += this.vx;
    this.y += this.vy;

    // Constrain to level boundaries
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x > LEVEL_WIDTH - this.width) {
      this.x = LEVEL_WIDTH - this.width;
      this.vx = 0;
    }
    if (this.y > LEVEL_HEIGHT) {
      this.damage(); // Fell into pit (if any)
      this.y = 400;
      this.x = Math.max(100, this.x - 200);
      this.vy = 0;
    }

    // Resolve Platform Collisions
    this.isGrounded = false;
    for (const platform of platforms) {
      this.resolveCollision(platform);
    }
    // Check collision with powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (
        this.x + this.width > p.x &&
        this.x < p.x + p.width &&
        this.y + this.height > p.y &&
        this.y < p.y + p.height
      ) {
        // Collect!
        if (p.type === 'health') {
          this.hp = Math.min(this.maxHp, this.hp + 1);
          AudioEffects.playWin();
          spawnParticles(p.x + 12, p.y + 12, '#ef4444', 15);
        } else if (p.type === 'speed') {
          this.powerupTimer = 300; // 5 seconds
          this.speed = 6.5; // Speed boost!
          AudioEffects.playWin();
          spawnParticles(p.x + 12, p.y + 12, '#fef08a', 15);
        }
        updateHUD();
        powerups.splice(i, 1);
      }
    }

    // Update powerup speed timer
    if (this.powerupTimer > 0) {
      this.powerupTimer--;
      // Spawn golden particle trail when running
      if (this.isWalking && Math.random() < 0.3) {
        spawnParticles(this.x + this.width / 2, this.y + this.height - 10, '#fef08a', 2);
      }
      if (this.powerupTimer === 0) {
        this.speed = 4.0; // Reset speed
      }
    }
  }

  resolveCollision(platform) {
    // AABB overlap check
    const pLeft = this.x;
    const pRight = this.x + this.width;
    const pTop = this.y;
    const pBottom = this.y + this.height;

    const platLeft = platform.x;
    const platRight = platform.x + platform.width;
    const platTop = platform.y;
    const platBottom = platform.y + platform.height;

    if (pRight > platLeft && pLeft < platRight && pBottom > platTop && pTop < platBottom) {
      // Calculate depth of penetration on all sides
      const overlapX = Math.min(pRight - platLeft, platRight - pLeft);
      const overlapY = Math.min(pBottom - platTop, platBottom - pTop);

      // Handle jump-through platforms (only solid on top, when falling)
      const isJumpThroughType = (
        platform.type === 'jump-through' ||
        platform.type === 'bookshelf' ||
        platform.type === 'couch' ||
        platform.type === 'fridge' ||
        platform.type === 'dining-table' ||
        platform.type === 'bed' ||
        platform.type === 'wardrobe' ||
        platform.type === 'box-pile' ||
        platform.type === 'counter' ||
        platform.label === '2nd Floor Deck' ||
        platform.label === 'Stairs' ||
        platform.label === 'Attic Ladder Step'
      );

      if (isJumpThroughType) {
        const previousBottom = pBottom - this.vy;
        // Collide only if player bottom was above platform top in the previous frame AND player is moving down
        if (previousBottom <= platTop && this.vy >= 0) {
          this.y = platTop - this.height;
          this.vy = 0;
          this.isGrounded = true;
          this.doubleJumpAvailable = true;
        }
        return;
      }

      // Handle bouncy platforms (like bed mattress or couch cushion)
      if (platform.type === 'bouncy') {
        const previousBottom = pBottom - this.vy;
        if (previousBottom <= platTop && this.vy >= 0) {
          this.y = platTop - this.height;
          this.vy = -13.5; // Big bouncy jump!
          this.isGrounded = false;
          this.doubleJumpAvailable = true;
          AudioEffects.playBounce();
          spawnParticles(this.x + this.width / 2, platTop, '#ff00ff', 12);
        }
        return;
      }

      // Handle trampoline platforms
      if (platform.type === 'trampoline') {
        const previousBottom = pBottom - this.vy;
        if (previousBottom <= platTop && this.vy >= 0) {
          this.y = platTop - this.height;
          this.vy = -16.5; // EXTREME trampoline bounce!
          this.isGrounded = false;
          this.doubleJumpAvailable = true;
          AudioEffects.playBounce();
          spawnParticles(this.x + this.width / 2, platTop, '#00ff00', 20);
        }
        return;
      }

      // Standard solid platform resolution
      if (overlapX < overlapY) {
        // Resolve X
        if (pLeft + this.width / 2 < platLeft + platform.width / 2) {
          this.x = platLeft - this.width;
        } else {
          this.x = platRight;
        }
        this.vx = 0;
      } else {
        // Resolve Y
        if (pTop + this.height / 2 < platTop + platform.height / 2) {
          // Standing on top
          this.y = platTop - this.height;
          this.vy = 0;
          this.isGrounded = true;
          this.doubleJumpAvailable = true;
        } else {
          // Hitting ceiling
          this.y = platBottom;
          this.vy = 0.5; // start falling down
        }
      }
    }
  }

  damage() {
    if (this.invincibilityFrames > 0) return;
    this.hp--;
    this.invincibilityFrames = 60; // 1 second of invincibility
    AudioEffects.playHit();
    spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ff0000', 15);
    updateHUD();

    if (this.hp <= 0) {
      gameOver();
    }
  }

  draw(ctx, camX, camY) {
    const rx = Math.floor(this.x - camX);
    const ry = Math.floor(this.y - camY);

    // Flash when invincible
    if (this.invincibilityFrames > 0 && Math.floor(time / 4) % 2 === 0) {
      return;
    }

    // Walking animation offsets
    const walkOffset = this.isWalking ? Math.sin(this.walkCycle) * 4 : 0;
    const legSwing = this.isWalking ? Math.sin(this.walkCycle) * 6 : 0;

    // Draw Shoes/Shorts (y: 63 to 72 with 16-bit outline)
    ctx.fillStyle = this.shoesColor;
    if (this.isWalking && !this.isCharging) {
      // Left foot
      ctx.fillRect(rx + 6 + legSwing * 1.5, ry + 63, 12, 9);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 6 + legSwing * 1.5, ry + 63, 12, 9);
      // Right foot
      ctx.fillRect(rx + 30 - legSwing * 1.5, ry + 63, 12, 9);
      ctx.strokeRect(rx + 30 - legSwing * 1.5, ry + 63, 12, 9);
    } else {
      ctx.fillRect(rx + 8, ry + 63, 12, 9);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 8, ry + 63, 12, 9);
      ctx.fillRect(rx + 28, ry + 63, 12, 9);
      ctx.strokeRect(rx + 28, ry + 63, 12, 9);
    }

    // Draw Pants (y: 45 to 63 with 16-bit bevel/shading)
    ctx.fillStyle = this.pantsColor;
    ctx.fillRect(rx + 9, ry + 45, 30, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // Left highlight
    ctx.fillRect(rx + 9, ry + 45, 4, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // Right shadow
    ctx.fillRect(rx + 35, ry + 45, 4, 18);

    // Draw Shirt/Torso (y: 24 to 45 with 16-bit shading)
    ctx.fillStyle = this.shirtColor;
    ctx.fillRect(rx + 9, ry + 24, 30, 21);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // Left highlight
    ctx.fillRect(rx + 9, ry + 24, 4, 21);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // Right shadow
    ctx.fillRect(rx + 35, ry + 24, 4, 21);
    
    // Torso outline
    ctx.strokeStyle = '#05030d';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 9, ry + 24, 30, 39);

    // Draw Arms (with 16-bit outlines)
    ctx.fillStyle = this.shirtColor;
    const armY = ry + 30;
    const armSwing = this.isWalking ? Math.cos(this.walkCycle) * 12 : 0;
    if (this.isCharging) {
      // Draw arms raised up aiming
      const aimArmX = rx + (this.facingRight ? 32 : 16);
      const aimArmY = ry + 16;
      
      ctx.fillRect(rx + (this.facingRight ? 6 : 34), armY, 8, 12); // Back arm idle
      ctx.strokeRect(rx + (this.facingRight ? 6 : 34), armY, 8, 12);
      
      ctx.fillRect(aimArmX - 4, aimArmY, 8, 14); // Front arm pointing up
      ctx.strokeRect(aimArmX - 4, aimArmY, 8, 14);
    } else {
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      if (this.facingRight) {
        // Back arm
        ctx.fillRect(rx + 3, armY - armSwing / 2, 8, 15);
        ctx.strokeRect(rx + 3, armY - armSwing / 2, 8, 15);
        // Front arm
        ctx.fillRect(rx + 37 + armSwing / 2, armY + armSwing, 8, 15);
        ctx.strokeRect(rx + 37 + armSwing / 2, armY + armSwing, 8, 15);
      } else {
        // Back arm
        ctx.fillRect(rx + 37 - armSwing / 2, armY + armSwing / 2, 8, 15);
        ctx.strokeRect(rx + 37 - armSwing / 2, armY + armSwing / 2, 8, 15);
        // Front arm
        ctx.fillRect(rx + 3 + armSwing / 2, armY - armSwing, 8, 15);
        ctx.strokeRect(rx + 3 + armSwing / 2, armY - armSwing, 8, 15);
      }
    }

    // Draw Head (64x64 bobblehead, 4x larger than default 16x16 sprite scale)
    const headX = rx - 8; // Centered relative to 48px body
    const headY = ry + walkOffset / 2 - 24; // Sits on shoulders

    if (this.faceCanvas) {
      // Draw dynamic uploaded face (128x128 pixels scaled to 64x64 canvas units)
      ctx.save();
      if (!this.facingRight) {
        // Mirror the face if walking left
        ctx.translate(headX + 32, headY + 32);
        ctx.scale(-1, 1);
        ctx.drawImage(this.faceCanvas, -32, -32, 64, 64);
      } else {
        ctx.drawImage(this.faceCanvas, headX, headY, 64, 64);
      }
      ctx.restore();
    } else {
      // Draw 8-bit default head (Beige skin, Brown hair, Cool Sunglasses scaled to 64x64)
      ctx.fillStyle = '#ffdbac'; // Skin
      ctx.fillRect(headX, headY, 64, 64);

      ctx.fillStyle = '#5c4033'; // Hair
      ctx.fillRect(headX, headY, 64, 18);
      if (this.facingRight) {
        ctx.fillRect(headX, headY, 18, 48); // Back hair
      } else {
        ctx.fillRect(headX + 46, headY, 18, 48);
      }

      // Sunglasses
      ctx.fillStyle = '#000000';
      if (this.facingRight) {
        ctx.fillRect(headX + 24, headY + 24, 32, 10);
        ctx.fillStyle = '#00ffff'; // cyan reflection
        ctx.fillRect(headX + 30, headY + 24, 6, 4);
        ctx.fillRect(headX + 44, headY + 24, 6, 4);
      } else {
        ctx.fillRect(headX + 8, headY + 24, 32, 10);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(headX + 14, headY + 24, 6, 4);
        ctx.fillRect(headX + 28, headY + 24, 6, 4);
      }
    }

    // Draw charge power bar if charging
    if (this.isCharging) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(rx - 6, ry - 16, this.width + 12, 6);
      ctx.fillStyle = this.mode === 'baseball' ? '#f59e0b' : '#f97316';
      ctx.fillRect(rx - 6, ry - 16, (this.width + 12) * (this.chargePower / this.maxChargePower), 6);
      ctx.restore();

      // Draw raised ball
      if (this.mode === 'baseball') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx + (this.facingRight ? 32 : 16), ry + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444'; // stitches
        ctx.fillRect(rx + (this.facingRight ? 32 : 16) - 2, ry + 5, 1, 1);
        ctx.fillRect(rx + (this.facingRight ? 32 : 16) + 1, ry + 6, 1, 1);
      } else if (this.mode === 'basketball') {
        ctx.save();
        ctx.translate(rx + (this.facingRight ? 32 : 16), ry + 4);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
        ctx.moveTo(0, -8); ctx.lineTo(0, 8);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Draw mode specific equipment & attack animations when NOT charging
      if (this.mode === 'baseball') {
        // Bat
        ctx.save();
        ctx.translate(rx + (this.facingRight ? 36 : 12), ry + 36);
        let angle = this.facingRight ? -Math.PI / 4 : Math.PI / 4;
        if (this.attackAnimTimer > 0) {
          // Swing animation!
          const swingProgress = (10 - this.attackAnimTimer) / 10;
          angle += this.facingRight ? swingProgress * Math.PI : -swingProgress * Math.PI;
        }
        ctx.rotate(angle);
        
        // Draw 8-bit wooden bat (scaled up)
        ctx.fillStyle = '#b58a30'; // Brown
        ctx.fillRect(-3, -27, 6, 27);
        ctx.fillStyle = '#e5ba60'; // Highlight
        ctx.fillRect(-1.5, -27, 3, 18);
        ctx.fillStyle = '#fff'; // Grip
        ctx.fillRect(-3, -6, 6, 6);

        ctx.restore();
      } else if (this.mode === 'basketball') {
        // Basketball held in hands (chest height)
        ctx.save();
        const ballX = rx + (this.facingRight ? 28 : 10);
        const ballY = ry + 32 + walkOffset / 2;
        
        if (this.attackAnimTimer > 0) {
          // Throw release pose (hands pointing forward/up, no ball in hands)
          ctx.strokeStyle = this.shirtColor;
          ctx.lineWidth = 4;
          ctx.beginPath();
          if (this.facingRight) {
            ctx.moveTo(rx + 24, ry + 28);
            ctx.lineTo(rx + 42, ry + 20);
          } else {
            ctx.moveTo(rx + 24, ry + 28);
            ctx.lineTo(rx + 6, ry + 20);
          }
          ctx.stroke();
        } else {
          // Draw standard basketball
          ctx.translate(ballX, ballY);
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(10, 10, 8, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(2, 10); ctx.lineTo(18, 10);
          ctx.moveTo(10, 2); ctx.lineTo(10, 18);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}

const player = new Player();

// Projectiles (Baseball Mode)
let projectiles = [];
class Baseball {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.radius = 6;
    this.vx = vx;
    this.vy = vy;
    this.gravity = 0.25;
    this.bounces = 0;
    this.maxBounces = 3;
    this.spin = 0;
  }

  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.spin += 0.2;

    // Platform collisions (bounces)
    for (const plat of platforms) {
      if (
        this.x + this.radius > plat.x &&
        this.x - this.radius < plat.x + plat.width &&
        this.y + this.radius > plat.y &&
        this.y - this.radius < plat.y + plat.height
      ) {
        // Simple bounce resolution
        const overlapY = Math.min((this.y + this.radius) - plat.y, (plat.y + plat.height) - (this.y - this.radius));
        const overlapX = Math.min((this.x + this.radius) - plat.x, (plat.x + plat.width) - (this.x - this.radius));

        if (plat.type === 'jump-through') {
          continue; // baseball passes straight through empty door frames, shelves, stairs
        }

        if (overlapX < overlapY) {
          this.vx = -this.vx * 0.7; // lose some energy
          this.x += Math.sign(this.vx) * overlapX;
        } else {
          this.vy = -this.vy * 0.75;
          this.y += Math.sign(this.vy) * overlapY;
        }
        
        this.bounces++;
        AudioEffects.playBounce();
        break;
      }
    }
  }

  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;

    // Draw retro baseball (circle with red stitching pixels)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx, ry, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Red stitches
    ctx.fillStyle = '#ef4444';
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(this.spin);
    ctx.fillRect(-4, -2, 2, 2);
    ctx.fillRect(2, 0, 2, 2);
    ctx.restore();
  }
}

// Projectiles (Basketball Mode)
class Basketball {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.radius = 9;
    this.vx = vx;
    this.vy = vy;
    this.gravity = 0.35; // slightly heavier gravity
    this.bounces = 0;
    this.maxBounces = 5; // bounces 5 times!
    this.bounceFactor = 0.85; // high bounce!
    this.spin = 0;
  }

  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.spin += this.vx * 0.03; // spin based on movement speed

    // Platform collisions (bounces)
    for (const plat of platforms) {
      if (
        this.x + this.radius > plat.x &&
        this.x - this.radius < plat.x + plat.width &&
        this.y + this.radius > plat.y &&
        this.y - this.radius < plat.y + plat.height
      ) {
        const overlapY = Math.min((this.y + this.radius) - plat.y, (plat.y + plat.height) - (this.y - this.radius));
        const overlapX = Math.min((this.x + this.radius) - plat.x, (plat.x + plat.width) - (this.x - this.radius));

        if (plat.type === 'jump-through') {
          continue; // pass straight through empty door frames, shelves, stairs
        }

        if (overlapX < overlapY) {
          this.vx = -this.vx * this.bounceFactor;
          this.x += Math.sign(this.vx) * overlapX;
        } else {
          this.vy = -this.vy * this.bounceFactor;
          this.y += Math.sign(this.vy) * overlapY;
        }
        
        this.bounces++;
        AudioEffects.playBasketballBounce();
        
        // Spawn small orange splash particles on bounce
        spawnParticles(this.x, this.y, '#f97316', 4);
        break;
      }
    }
  }

  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;

    // Draw Basketball (Orange circle with black cross lines)
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(this.spin);
    
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Black lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    
    // Cross
    ctx.beginPath();
    ctx.moveTo(-this.radius, 0);
    ctx.lineTo(this.radius, 0);
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(0, this.radius);
    ctx.stroke();

    // Curved seams
    ctx.beginPath();
    ctx.arc(-this.radius * 0.7, 0, this.radius * 0.6, -Math.PI/3, Math.PI/3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.radius * 0.7, 0, this.radius * 0.6, Math.PI*2/3, Math.PI*4/3);
    ctx.stroke();

    ctx.restore();
  }
}

// Global Target Systems & Powerups
let powerups = [];

const BasketballHoop = {
  x: 360,
  y: 320,
  width: 30,
  height: 50,
  scored: false,
  update() {
    if (this.scored) return;
    // Check if any basketball enters from above
    for (const proj of projectiles) {
      if (proj instanceof Basketball && proj.vy > 0) {
        const dist = Math.hypot(proj.x - (this.x + 15), proj.y - this.y);
        if (dist < proj.radius + 15) {
          this.scored = true;
          AudioEffects.playWin();
          // Spawn speed powerup
          spawnPowerup(this.x + 15, this.y + 40, 'speed');
          spawnParticles(this.x + 15, this.y, '#eab308', 15);
          break;
        }
      }
    }
  },
  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;

    // Draw Backboard (white/red outline)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rx - 5, ry - 30, 8, 40);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(rx - 5, ry - 15, 3, 10);
    
    // Draw Rim (orange hoop)
    ctx.fillStyle = '#f97316';
    ctx.fillRect(rx + 3, ry, 20, 4);

    // Draw Net (white grid)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx + 5, ry + 4);
    ctx.lineTo(rx + 8, ry + 20);
    ctx.lineTo(rx + 18, ry + 20);
    ctx.lineTo(rx + 21, ry + 4);
    ctx.moveTo(rx + 13, ry + 4);
    ctx.lineTo(rx + 13, ry + 20);
    ctx.stroke();
  }
};

const BaseballTarget = {
  rebounderX: 1250,
  rebounderY: 420,
  rebounderW: 40,
  rebounderH: 30,
  
  bagX: 950,
  bagY: 470,
  bagW: 40,
  bagH: 30,
  
  scored: false,
  
  update() {
    if (this.scored) return;
    
    // Check if any baseball hits the rebounder
    for (const proj of projectiles) {
      if (proj instanceof Baseball) {
        if (
          proj.x + proj.radius > this.rebounderX &&
          proj.x - proj.radius < this.rebounderX + this.rebounderW &&
          proj.y + proj.radius > this.rebounderY &&
          proj.y - proj.radius < this.rebounderY + this.rebounderH
        ) {
          // Deflect back left/up
          proj.vx = -8.5;
          proj.vy = -6.5;
          proj.deflected = true; // Mark deflected!
          AudioEffects.playBounce();
          spawnParticles(proj.x, proj.y, '#3b82f6', 6);
        }
        
        // Bag collision check
        if (proj.deflected) {
          const dist = Math.hypot(proj.x - (this.bagX + 20), proj.y - (this.bagY + 15));
          if (dist < proj.radius + 20) {
            this.scored = true;
            AudioEffects.playWin();
            // Spawn health powerup
            spawnPowerup(this.bagX + 20, this.bagY - 20, 'health');
            spawnParticles(this.bagX + 20, this.bagY, '#eab308', 15);
            
            // Delete baseball
            const idx = projectiles.indexOf(proj);
            if (idx !== -1) projectiles.splice(idx, 1);
            break;
          }
        }
      }
    }
  },
  
  draw(ctx, camX, camY) {
    const rx = this.rebounderX - camX;
    const ry = this.rebounderY - camY;
    const bx = this.bagX - camX;
    const by = this.bagY - camY;

    // Draw Rebounder Net (angled 45 degrees blue)
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx, ry + this.rebounderH);
    ctx.lineTo(rx + this.rebounderW, ry);
    ctx.stroke();
    ctx.restore();

    // Draw laundry-style open brown bag
    ctx.fillStyle = '#b45309';
    ctx.fillRect(bx, by + 10, this.bagW, this.bagH - 10);
    ctx.fillStyle = '#d97706'; // highlight rim
    ctx.fillRect(bx - 3, by + 6, this.bagW + 6, 4);
    
    // Star symbol on bag
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bx + this.bagW / 2 - 4, by + 16, 8, 8);
  }
};

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.width = 24;
    this.height = 24;
    this.vy = 0;
    this.gravity = 0.2;
    this.type = type; // 'health' or 'speed'
    this.rotation = 0;
    this.bounceTimer = 0;
  }

  update() {
    this.rotation += 0.05;
    this.bounceTimer += 0.08;
    this.vy += this.gravity;
    this.y += this.vy;

    // Land on floors
    for (const plat of platforms) {
      if (
        this.x + this.width > plat.x &&
        this.x < plat.x + plat.width &&
        this.y + this.height > plat.y &&
        this.y + this.height - this.vy <= plat.y &&
        this.vy >= 0
      ) {
        this.y = plat.y - this.height;
        this.vy = 0;
      }
    }
  }

  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY + Math.sin(this.bounceTimer) * 4;

    ctx.save();
    ctx.translate(rx + 12, ry + 12);
    ctx.rotate(this.rotation);

    if (this.type === 'health') {
      // Red Heart
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.bezierCurveTo(-6, -12, -12, -6, -12, 0);
      ctx.bezierCurveTo(-12, 6, -6, 12, 0, 18);
      ctx.bezierCurveTo(6, 12, 12, 6, 12, 0);
      ctx.bezierCurveTo(12, -6, 6, -12, 0, -6);
      ctx.fill();
    } else {
      // Gold Star
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 12, -Math.sin((18 + i * 72) * Math.PI / 180) * 12);
        ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 6, -Math.sin((54 + i * 72) * Math.PI / 180) * 6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function spawnPowerup(x, y, type) {
  powerups.push(new Powerup(x, y, type));
}

// Enemy Base Classes and Types
let enemies = [];
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'dust-bunny', 'vacuum', 'toy'
    this.vy = 0;
    this.vx = 0;
    this.facingRight = false;
    this.health = 1;
    this.maxHealth = 1;
    this.invulTime = 0;
    this.animTimer = 0;
    
    // Type specific config
    if (type === 'dust-bunny') {
      this.width = 24;
      this.height = 24;
      this.speed = 1.2;
      this.color = '#78716c'; // Stone/grey
      this.jumpTimer = Math.random() * 120;
    } else if (type === 'vacuum') {
      this.width = 44;
      this.height = 28;
      this.speed = 1.8;
      this.color = '#dc2626'; // Red
      this.health = 2;
      this.maxHealth = 2;
    } else if (type === 'toy') {
      this.width = 28;
      this.height = 24;
      this.speed = 1.0;
      this.color = '#a855f7'; // Purple key
      this.baseY = y;
      this.hoverOffset = Math.random() * 100;
    } else if (type === 'cat-boss') {
      this.width = 60;
      this.height = 45;
      this.speed = 1.6;
      this.color = '#ffffff'; // White cat
      this.health = 6;        // 6 hits to defeat
      this.maxHealth = 6;
      this.jumpTimer = 80;
    }
  }

  update() {
    this.animTimer++;
    if (this.invulTime > 0) this.invulTime--;

    if (this.type === 'dust-bunny') {
      // Hopping AI
      this.vy += 0.4; // Gravity
      this.jumpTimer--;
      
      if (this.jumpTimer <= 0 && this.vy === 0) {
        // Jump!
        this.vy = -6;
        this.vx = this.facingRight ? this.speed : -this.speed;
        this.jumpTimer = 90 + Math.random() * 90;
      }
      
      // Stop moving horizontal when on ground
      if (this.vy === 0 && Math.abs(this.vx) > 0) {
        this.vx *= 0.8;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }

      this.x += this.vx;
      this.y += this.vy;

      // Platform collisions
      this.resolveFloorCollisions();

      // Bounce off boundaries/walls
      if (this.x < 0 || this.x > LEVEL_WIDTH - this.width) {
        this.facingRight = !this.facingRight;
        this.vx = -this.vx;
      }
    } 
    else if (this.type === 'vacuum') {
      // Patrolling AI
      this.vx = this.facingRight ? this.speed : -this.speed;
      this.x += this.vx;

      // Check walls
      let hitWall = false;
      if (this.x < 0 || this.x > LEVEL_WIDTH - this.width) {
        hitWall = true;
      }

      // Check platform borders (so it doesn't fall off shelves!)
      let onPlatform = false;
      let nearEdge = true;
      
      for (const plat of platforms) {
        // Check if vacuum is standing on plat
        if (
          this.x + this.width / 2 > plat.x &&
          this.x + this.width / 2 < plat.x + plat.width &&
          Math.abs((this.y + this.height) - plat.y) < 4
        ) {
          onPlatform = true;
          // Check if moving right will take it off the right edge, or moving left off the left edge
          const nextX = this.x + (this.facingRight ? 15 : -15);
          if (nextX > plat.x && nextX + this.width < plat.x + plat.width) {
            nearEdge = false;
          }
        }
      }

      if (hitWall || (onPlatform && nearEdge)) {
        this.facingRight = !this.facingRight;
      }
    } 
    else if (this.type === 'toy') {
      // Floating sinusoidal wave movement
      this.y = this.baseY + Math.sin((this.animTimer + this.hoverOffset) * 0.05) * 45;
      
      // Slow float left/right
      this.vx = this.facingRight ? this.speed : -this.speed;
      this.x += this.vx;

      if (this.x < 100 || this.x > LEVEL_WIDTH - 100) {
        this.facingRight = !this.facingRight;
      }
    } else if (this.type === 'cat-boss') {
      // Gravity
      this.vy += 0.45;

      // Speed increases as health drops (angry mode!)
      const currentSpeed = this.speed * (1 + (this.maxHealth - this.health) * 0.25);
      this.vx = this.facingRight ? currentSpeed : -currentSpeed;

      this.x += this.vx;
      this.y += this.vy;

      // Resolve floor collisions
      this.resolveFloorCollisions();

      // Guard bounds: keep within x: 4220 and 4670 (Attic floor near goal)
      if (this.x < 4220) {
        this.facingRight = true;
        this.x = 4220;
      }
      if (this.x > 4670 - this.width) {
        this.facingRight = false;
        this.x = 4670 - this.width;
      }

      // Jump periodically
      this.jumpTimer--;
      if (this.jumpTimer <= 0 && this.vy === 0) {
        this.vy = -8.0; // hops high
        this.jumpTimer = 90 + Math.random() * 80;
        spawnParticles(this.x + this.width / 2, this.y + this.height, '#ffffff', 5);
      }
    }
  }

  resolveFloorCollisions() {
    for (const plat of platforms) {
      if (
        this.x + this.width > plat.x &&
        this.x < plat.x + plat.width &&
        this.y + this.height > plat.y &&
        this.y + this.height - this.vy <= plat.y &&
        this.vy >= 0
      ) {
        this.y = plat.y - this.height;
        this.vy = 0;
      }
    }
  }

  damage(amount) {
    if (this.invulTime > 0) return;
    this.health -= amount;
    this.invulTime = 20;
    AudioEffects.playHit();
    spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#fbbf24', 8);

    if (this.health <= 0) {
      // Defeated!
      if (this.type === 'cat-boss') {
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, this.color, 40);
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#fbbf24', 30); // gold stars
        score += 1000;
      } else {
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, this.color, 16);
        score += 100;
      }
      updateHUD();
      return true; // remove from list
    }
    return false;
  }

  draw(ctx, camX, camY) {
    const rx = Math.floor(this.x - camX);
    const ry = Math.floor(this.y - camY);

    // Flash when hit
    if (this.invulTime > 0 && Math.floor(time / 3) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, this.width, this.height);
      return;
    }

    if (this.type === 'dust-bunny') {
      // Draw angry dust bunny (fuzzy sphere with angry red eyes & 16-bit outline)
      ctx.fillStyle = this.color;
      ctx.fillRect(rx + 2, ry + 2, this.width - 4, this.height - 4);
      
      // Fur spikes
      ctx.fillRect(rx, ry + 8, 2, 8);
      ctx.fillRect(rx + 22, ry + 8, 2, 8);
      ctx.fillRect(rx + 8, ry, 8, 2);
      ctx.fillRect(rx + 8, ry + 22, 8, 2);
      
      // 16-bit outline
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 2, ry + 2, this.width - 4, this.height - 4);

      // Angry Eyes
      ctx.fillStyle = '#ef4444';
      if (this.facingRight) {
        ctx.fillRect(rx + 14, ry + 8, 3, 3);
        ctx.fillRect(rx + 8, ry + 8, 3, 3);
      } else {
        ctx.fillRect(rx + 7, ry + 8, 3, 3);
        ctx.fillRect(rx + 13, ry + 8, 3, 3);
      }
    } 
    else if (this.type === 'vacuum') {
      // Draw Red Vacuum with 16-bit outline and shading
      ctx.fillStyle = this.color;
      ctx.fillRect(rx, ry + 6, this.width, this.height - 6);
      
      // Shading highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(rx, ry + 6, 6, this.height - 6);
      
      // Wheels
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx + 4, ry + this.height - 4, 8, 6);
      ctx.fillRect(rx + this.width - 12, ry + this.height - 4, 8, 6);
      
      // Black outline
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry + 6, this.width, this.height - 6);

      // Handle
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (this.facingRight) {
        ctx.moveTo(rx + 8, ry + 6);
        ctx.lineTo(rx + 2, ry - 6);
      } else {
        ctx.moveTo(rx + this.width - 8, ry + 6);
        ctx.lineTo(rx + this.width - 2, ry - 6);
      }
      ctx.stroke();
      
      // Yellow headlight
      ctx.fillStyle = '#fef08a';
      if (this.facingRight) {
        ctx.fillRect(rx + this.width - 6, ry + 8, 6, 6);
      } else {
        ctx.fillRect(rx, ry + 8, 6, 6);
      }
    } 
    else if (this.type === 'toy') {
      // Floating wind up flying toy (16-bit outlines)
      ctx.fillStyle = this.color;
      ctx.fillRect(rx + 6, ry + 6, this.width - 12, this.height - 6); // main body
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(rx + 6, ry + 6, 4, this.height - 6);
      
      // Black body outline
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 6, ry + 6, this.width - 12, this.height - 6);
      
      // Golden key propeller
      ctx.fillStyle = '#eab308';
      const propSwing = Math.sin(this.animTimer * 0.4) * 8;
      ctx.fillRect(rx + 2 + propSwing, ry, 24 - propSwing * 2, 3);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 2 + propSwing, ry, 24 - propSwing * 2, 3);
      
      ctx.fillStyle = '#78716c';
      ctx.fillRect(rx + 13, ry + 3, 2, 3); // Propeller axis
      
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx + 9, ry + 10, 3, 3);
      ctx.fillRect(rx + 15, ry + 10, 3, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(rx + 10, ry + 11, 1, 1);
      ctx.fillRect(rx + 16, ry + 11, 1, 1);
    } else if (this.type === 'cat-boss') {
      const isAngry = this.health < this.maxHealth;
      
      // Face offsets depending on walking direction
      const headX = this.facingRight ? rx + 30 : rx + 6;
      const tailX = this.facingRight ? rx + 6 : rx + 48;
      
      // Draw Tail
      ctx.fillStyle = this.color;
      const tailWiggle = Math.sin(this.animTimer * 0.15) * 4;
      ctx.fillRect(tailX + tailWiggle, ry + 12, 6, 12);
      ctx.fillRect(tailX + 3 + tailWiggle * 1.5, ry + 6, 6, 6);
      
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tailX + tailWiggle, ry + 12, 6, 12);

      // Draw Legs
      ctx.fillStyle = '#e2e8f0';
      const walkCycle = Math.sin(this.animTimer * 0.2);
      if (this.vy !== 0) {
        ctx.fillRect(rx + 8, ry + 33, 6, 12);
        ctx.fillRect(rx + 20, ry + 33, 6, 12);
        ctx.fillRect(rx + 34, ry + 33, 6, 12);
        ctx.fillRect(rx + 46, ry + 33, 6, 12);
        ctx.strokeRect(rx + 8, ry + 33, 6, 12);
        ctx.strokeRect(rx + 20, ry + 33, 6, 12);
        ctx.strokeRect(rx + 34, ry + 33, 6, 12);
        ctx.strokeRect(rx + 46, ry + 33, 6, 12);
      } else {
        ctx.fillRect(rx + 8, ry + 33 + walkCycle * 4, 6, 12);
        ctx.fillRect(rx + 20, ry + 33 - walkCycle * 4, 6, 12);
        ctx.fillRect(rx + 34, ry + 33 + walkCycle * 4, 6, 12);
        ctx.fillRect(rx + 46, ry + 33 - walkCycle * 4, 6, 12);
        ctx.strokeRect(rx + 8, ry + 33 + walkCycle * 4, 6, 12);
        ctx.strokeRect(rx + 20, ry + 33 - walkCycle * 4, 6, 12);
        ctx.strokeRect(rx + 34, ry + 33 + walkCycle * 4, 6, 12);
        ctx.strokeRect(rx + 46, ry + 33 - walkCycle * 4, 6, 12);
      }

      // Draw Main Body
      ctx.fillStyle = this.color;
      ctx.fillRect(rx + 12, ry + 15, 36, 20);
      
      // Shading highlight on body
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(rx + 12, ry + 25, 36, 10);
      
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 12, ry + 15, 36, 20);

      // Draw Head
      ctx.fillStyle = this.color;
      ctx.fillRect(headX, ry + 6, 18, 18);
      ctx.strokeRect(headX, ry + 6, 18, 18);

      // Draw Ears
      ctx.fillStyle = this.color;
      ctx.fillRect(headX + 2, ry, 5, 6);
      ctx.fillRect(headX + 11, ry, 5, 6);
      ctx.strokeRect(headX + 2, ry, 5, 6);
      ctx.strokeRect(headX + 11, ry, 5, 6);
      
      ctx.fillStyle = '#fda4af'; // Pink inner ear
      ctx.fillRect(headX + 3, ry + 2, 3, 4);
      ctx.fillRect(headX + 12, ry + 2, 3, 4);

      // Draw Eyes (Green glowing, flashes red if angry)
      ctx.fillStyle = isAngry && Math.floor(time / 6) % 2 === 0 ? '#ef4444' : '#22c55e';
      if (this.facingRight) {
        ctx.fillRect(headX + 10, ry + 11, 2, 3);
        ctx.fillRect(headX + 15, ry + 11, 2, 3);
      } else {
        ctx.fillRect(headX + 2, ry + 11, 2, 3);
        ctx.fillRect(headX + 7, ry + 11, 2, 3);
      }

      // Draw Nose/Mouth (Pink)
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(headX + (this.facingRight ? 13 : 5), ry + 15, 2, 2);

      // Whiskers
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (this.facingRight) {
        ctx.moveTo(headX + 15, ry + 15);
        ctx.lineTo(headX + 23, ry + 14);
        ctx.moveTo(headX + 15, ry + 16);
        ctx.lineTo(headX + 24, ry + 17);
      } else {
        ctx.moveTo(headX + 3, ry + 15);
        ctx.lineTo(headX - 5, ry + 14);
        ctx.moveTo(headX + 3, ry + 16);
        ctx.lineTo(headX - 6, ry + 17);
      }
      ctx.stroke();
    }
  }
}

// Suburban Level Furniture Layout
let platforms = [];
// Generative level helpers
function generateRandomBooks(width) {
  const books = [];
  const bookCount = Math.floor(width / 8);
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#7c3aed', '#db2777'];
  for (let i = 0; i < bookCount; i++) {
    books.push({
      height: 12 + Math.floor(seededRandom() * 18),
      color: colors[Math.floor(seededRandom() * colors.length)],
      offset: i * 8
    });
  }
  return books;
}

defPillows = [];
function generateRandomPillows(width) {
  const pillows = [];
  const colors = ['#f59e0b', '#e11d48', '#0284c7', '#16a34a'];
  pillows.push({ xOffset: 12, color: colors[Math.floor(seededRandom() * colors.length)] });
  pillows.push({ xOffset: width - 24, color: colors[Math.floor(seededRandom() * colors.length)] });
  return pillows;
}

function buildLevel() {
  platforms = [];

  // Initialize PRNG using the active seed
  if (currentSeed === "RANDOM" || !currentSeed) {
    currentSeed = generateRandomSeed();
  }
  setSeed(currentSeed);
  
  // Update HTML labels if they exist
  const lbl = document.getElementById('current-seed-lbl');
  if (lbl) lbl.innerText = currentSeed;
  const inp = document.getElementById('level-seed-input');
  if (inp) inp.value = currentSeed;

  // Procedural House Zone Metrics
  const yardWidth = 600 + Math.floor(seededRandom() * 200);
  const houseX = yardWidth;
  const secondFloorY = 230 + Math.floor(seededRandom() * 35); // y = 230 to 265
  
  const livingRoomW = 750 + Math.floor(seededRandom() * 200);
  const kitchenW = 750 + Math.floor(seededRandom() * 200);
  const bedroomW = 750 + Math.floor(seededRandom() * 200);
  const atticW = LEVEL_WIDTH - (houseX + livingRoomW + kitchenW + bedroomW);
  
  const livingX = houseX;
  const kitchenX = livingX + livingRoomW;
  const bedroomX = kitchenX + kitchenW;
  const atticX = bedroomX + bedroomW;

  // 1. The Grounds / Floor
  platforms.push({ x: 0, y: 500, width: houseX, height: 200, color: '#166534', label: 'Yard Grass', type: 'standard' });
  platforms.push({ x: livingX, y: 500, width: livingRoomW, height: 200, color: '#78350f', label: 'Floorboards', type: 'standard' });
  platforms.push({ x: kitchenX, y: 500, width: kitchenW, height: 200, color: '#475569', label: 'Tiles', type: 'standard' });
  platforms.push({ x: bedroomX, y: 500, width: bedroomW, height: 200, color: '#1e3a8a', label: 'Bedroom Carpet', type: 'standard' });
  platforms.push({ x: atticX, y: 500, width: atticW, height: 200, color: '#3f3f46', label: 'Attic Floor', type: 'standard' });

  // --- SECTION 1: FRONT YARD ---
  // Mailbox
  const mailX = 140 + seededRandom() * 120;
  platforms.push({ x: mailX + 10, y: 430, width: 40, height: 70, color: '#b45309', label: 'Mailbox Post', type: 'standard' });
  platforms.push({ x: mailX, y: 410, width: 60, height: 20, color: '#475569', label: 'Mailbox', type: 'standard' });

  // Tree Branches
  const branchCount = 2 + Math.floor(seededRandom() * 2);
  for (let i = 0; i < branchCount; i++) {
    const bx = 380 + i * 95 + seededRandom() * 30;
    const by = 360 - i * 85;
    platforms.push({ x: bx, y: by, width: 95, height: 15, color: '#15803d', label: 'Tree Branch', type: 'jump-through' });
  }

  // Driveway Trampoline
  const trampX = houseX - 180 - seededRandom() * 100;
  platforms.push({ x: trampX, y: 470, width: 75, height: 30, color: '#10b981', label: 'Trampoline', type: 'trampoline' });

  // Front Entry Steps
  platforms.push({ x: houseX - 100, y: 465, width: 60, height: 35, color: '#64748b', label: 'Porch Step 1', type: 'standard' });
  platforms.push({ x: houseX - 40, y: 430, width: 40, height: 70, color: '#475569', label: 'Porch Step 2', type: 'standard' });

  // House walls & Canopy
  platforms.push({ x: houseX, y: 0, width: 40, height: 280, color: '#1e293b', label: 'House Front Wall Top', type: 'standard' });
  platforms.push({ x: houseX, y: 280, width: 40, height: 150, color: '#334155', label: 'Door Frame Canopy', type: 'jump-through' });

  // Windows
  platforms.push({ x: livingX + 120, y: 380, width: 65, height: 50, type: 'window' });
  platforms.push({ x: kitchenX + 300, y: 380, width: 65, height: 50, type: 'window' });
  platforms.push({ x: bedroomX + 150, y: 380, width: 65, height: 50, type: 'window' });


  // --- SECTION 2: LIVING ROOM ---
  // Bookshelf (custom procedurally generated books)
  const bsX = livingX + 80 + seededRandom() * 120;
  const bsW = 85 + Math.floor(seededRandom() * 25);
  const bsH = 140 + Math.floor(seededRandom() * 35);
  platforms.push({
    x: bsX, y: 500 - bsH, width: bsW, height: bsH,
    type: 'bookshelf',
    color: '#7c2d12',
    shelves: 3 + Math.floor(seededRandom() * 2),
    books: generateRandomBooks(bsW)
  });

  // Coffee Table
  const tableX = livingX + 340 + seededRandom() * 120;
  platforms.push({ x: tableX, y: 450, width: 120, height: 50, type: 'dining-table', color: '#854d0e' });

  // Couch (custom procedurally generated pillows)
  const couchX = livingX + 540 + seededRandom() * 120;
  const couchW = 150 + Math.floor(seededRandom() * 40);
  const couchColor = ['#c026d3', '#b91c1c', '#1d4ed8', '#7c2d12'][Math.floor(seededRandom() * 4)];
  platforms.push({
    x: couchX, y: 435, width: couchW, height: 65,
    type: 'couch',
    color: couchColor,
    pillows: generateRandomPillows(couchW)
  });

  // Stairs
  const stairsX = livingX + livingRoomW - 320;
  const stepsCount = Math.floor((500 - secondFloorY) / 30);
  for (let i = 0; i < stepsCount; i++) {
    platforms.push({
      x: stairsX + i * 40,
      y: 500 - (i + 1) * 30,
      width: 45,
      height: 300,
      color: '#92400e',
      label: 'Stairs',
      type: 'jump-through'
    });
  }


  // --- SECTION 3: 2ND FLOOR & KITCHEN ---
  // Deck
  platforms.push({ x: houseX, y: secondFloorY, width: livingRoomW + kitchenW + bedroomW, height: 20, color: '#7c2d12', label: '2nd Floor Deck', type: 'standard' });

  // Stable Countertop for the Secret Vault Door!
  platforms.push({ x: kitchenX + 180, y: 290, width: 80, height: 15, color: '#cbd5e1', label: 'Countertop', type: 'standard' });

  // Snap the Secret Door dynamically to this countertop coordinate!
  SecretDoor.x = kitchenX + 200;
  SecretDoor.y = 190;

  // Fridge (custom procedurally generated body notes & colors)
  const fridgeX = kitchenX + 80 + seededRandom() * 100;
  const fridgeColor = ['#cbd5e1', '#b91c1c', '#166534', '#1e293b'][Math.floor(seededRandom() * 4)];
  platforms.push({
    x: fridgeX, y: 330, width: 75, height: 170,
    type: 'fridge',
    color: fridgeColor
  });

  // Kitchen Table
  const kitchenTableX = kitchenX + 380 + seededRandom() * 150;
  const kTableW = 130 + Math.floor(seededRandom() * 40);
  platforms.push({
    x: kitchenTableX, y: 440, width: kTableW, height: 60,
    type: 'dining-table',
    color: '#b45309'
  });


  // --- SECTION 4: BEDROOM ---
  // Bunk Bed vs Single Bed
  const bedX = bedroomX + 80 + seededRandom() * 120;
  const bedW = 150 + Math.floor(seededRandom() * 25);
  const bedColor = ['#f43f5e', '#06b6d4', '#84cc16', '#a855f7'][Math.floor(seededRandom() * 4)];
  const isBunk = seededRandom() > 0.45;
  platforms.push({
    x: bedX, y: isBunk ? 310 : 430, width: bedW, height: isBunk ? 190 : 70,
    type: 'bed',
    color: bedColor,
    isBunk: isBunk
  });

  // Wardrobe
  const wardrobeX = bedroomX + 480 + seededRandom() * 120;
  platforms.push({
    x: wardrobeX, y: 320, width: 95, height: 180,
    type: 'wardrobe',
    color: '#78350f'
  });

  // Stable Countertop for the Second Secret Door!
  platforms.push({ x: bedroomX + 360, y: 290, width: 80, height: 15, color: '#cbd5e1', label: 'Countertop', type: 'standard' });

  // Snap the second secret door to this coordinate!
  SecretDoor2.x = bedroomX + 380;
  SecretDoor2.y = 190;


  // --- SECTION 5: ATTIC ---
  // Ladder / Attic stairway climber
  for (let i = 0; i < 5; i++) {
    platforms.push({
      x: bedroomX + bedroomW - 120 + i * 40,
      y: 230 - i * 30,
      width: 45,
      height: 400,
      color: '#4b5563',
      label: 'Attic Ladder Step',
      type: 'jump-through'
    });
  }

  // Attic Landing Deck (y: 110)
  platforms.push({ x: atticX, y: 110, width: atticW, height: 20, color: '#27272a', label: 'Attic Rafter Deck', type: 'standard' });

  // Stacked Cardboard Box Piles
  const boxX = atticX + 60 + seededRandom() * 80;
  platforms.push({
    x: boxX, y: 440, width: 140, height: 60,
    type: 'box-pile',
    color: '#d97706'
  });

  // Attic trampoline
  const atticTrampX = atticX + 240 + seededRandom() * 80;
  platforms.push({ x: atticTrampX, y: 470, width: 65, height: 30, color: '#10b981', label: 'Trampoline', type: 'trampoline' });

  // Laundry Basket
  const basketX = atticX + 360 + seededRandom() * 80;
  platforms.push({ x: basketX, y: 460, width: 50, height: 40, color: '#e2e8f0', label: 'Laundry Basket', type: 'bouncy' });

  // The Goal Trophy Pedestal
  platforms.push({ x: LEVEL_WIDTH - 120, y: 450, width: 60, height: 50, color: '#f59e0b', label: 'Trophy Stand', type: 'standard' });
}

// Goal Definition
const Goal = {
  x: 4690,
  y: 370,
  width: 40,
  height: 80,
  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;

    // Draw a big retro pixelated Golden Trophy
    ctx.fillStyle = '#f59e0b'; // Amber Gold
    ctx.fillRect(rx + 10, ry + 20, 20, 30); // Main bowl
    ctx.fillRect(rx + 15, ry + 50, 10, 20); // stem
    ctx.fillRect(rx + 5, ry + 70, 30, 10); // base

    // Handles
    ctx.fillRect(rx + 2, ry + 25, 8, 5);
    ctx.fillRect(rx + 2, ry + 25, 3, 15);
    ctx.fillRect(rx + 5, ry + 35, 5, 5);

    ctx.fillRect(rx + 30, ry + 25, 8, 5);
    ctx.fillRect(rx + 35, ry + 25, 3, 15);
    ctx.fillRect(rx + 30, ry + 35, 5, 5);

    // Gem sparkles
    ctx.fillStyle = '#ffffff';
    if (Math.floor(time / 8) % 2 === 0) {
      ctx.fillRect(rx + 15, ry + 25, 3, 3);
      ctx.fillRect(rx + 25, ry + 35, 3, 3);
    }
  }
};

// Special Secret Hideout Door
const SecretDoor = {
  x: 2360, // Sits on stairs tread at x = 2360
  y: 190,
  width: 40,
  height: 100,
  opened: false,
  update() {
    if (this.opened) {
      // Transition if player overlaps
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pTop = player.y;
      const pBottom = player.y + player.height;
      if (pRight > this.x && pLeft < this.x + this.width && pBottom > this.y && pTop < this.y + this.height) {
        // Save level pos and go to secret studio
        player.mainLevelX = player.x;
        player.mainLevelY = player.y;
        player.x = 100;
        player.y = 350;
        player.vx = 0;
        player.vy = 0;
        player.isGrounded = true;
        
        SecretRoomElements.truck.x = 550;
        SecretRoomElements.truck.vx = 0;
        SecretRoomElements.truck.vy = 0;
        
        currentState = GAME_STATE.SECRET_ROOM;
        AudioEffects.playWin();
      }
      return;
    }
    // Check if hit by ball projectile
    for (const proj of projectiles) {
      const dist = Math.hypot(proj.x - (this.x + this.width/2), proj.y - (this.y + this.height/2));
      if (dist < proj.radius + 35) {
        this.opened = true;
        AudioEffects.playWin();
        spawnParticles(this.x + this.width/2, this.y + this.height/2, '#06b6d4', 20);
        break;
      }
    }
  },
  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;
    
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(rx - 4, ry - 4, this.width + 8, this.height + 8);
    
    if (this.opened) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx, ry, this.width, this.height);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, this.width, this.height);
      
      ctx.fillStyle = '#06b6d4';
      ctx.font = '7px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ENTER!', rx + this.width / 2, ry - 10 + Math.sin(time * 0.1) * 3);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillRect(rx, ry, this.width, this.height);
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx + 6, ry + 6, this.width - 12, this.height - 12);
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 25, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 60, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 60, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Special Secret Hideout Door 2 (Sports Arena minigame)
const SecretDoor2 = {
  x: 3500, // Sits in bedroom area
  y: 190,
  width: 40,
  height: 100,
  opened: false,
  update() {
    if (this.opened) {
      // Transition if player overlaps
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pTop = player.y;
      const pBottom = player.y + player.height;
      if (pRight > this.x && pLeft < this.x + this.width && pBottom > this.y && pTop < this.y + this.height) {
        // Save level pos and go to secret minigame room
        player.mainLevelX = player.x;
        player.mainLevelY = player.y;
        player.x = 150;
        player.y = 400;
        player.vx = 0;
        player.vy = 0;
        player.isGrounded = true;
        
        // Reset minigame states
        minigameScore = 0;
        minigameMessage = "GET READY!";
        minigameMessageTimer = 120;
        minigamePitchTimer = 120;
        minigamePitchedBall = null;
        minigameBalls = [];
        minigamePowerups = [];
        
        currentState = GAME_STATE.SECRET_MINIGAME_ROOM;
        AudioEffects.playWin();
      }
      return;
    }
    // Check if hit by ball projectile
    for (const proj of projectiles) {
      const dist = Math.hypot(proj.x - (this.x + this.width/2), proj.y - (this.y + this.height/2));
      if (dist < proj.radius + 35) {
        this.opened = true;
        AudioEffects.playWin();
        spawnParticles(this.x + this.width/2, this.y + this.height/2, '#fbbf24', 20);
        break;
      }
    }
  },
  draw(ctx, camX, camY) {
    const rx = this.x - camX;
    const ry = this.y - camY;
    
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(rx - 4, ry - 4, this.width + 8, this.height + 8);
    
    if (this.opened) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx, ry, this.width, this.height);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, this.width, this.height);
      
      ctx.fillStyle = '#fbbf24';
      ctx.font = '7px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PLAY!', rx + this.width / 2, ry - 10 + Math.sin(time * 0.1) * 3);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillRect(rx, ry, this.width, this.height);
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx + 6, ry + 6, this.width - 12, this.height - 12);
      
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 25, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 60, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(rx + this.width / 2, ry + 60, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Secret Studio Manager
const SecretRoomElements = {
  floorY: 480,
  
  drums: {
    x: 320,
    y: 410,
    width: 100,
    height: 70,
    activeTimer: 0,
    checkInteraction() {
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pBottom = player.y + player.height;
      if (pRight > this.x && pLeft < this.x + this.width && Math.abs(pBottom - (this.y + this.height)) < 15) {
        if (keys['k'] || keys['enter'] || player.isCharging) {
          if (this.activeTimer === 0) {
            AudioEffects.playDrum();
            AudioEffects.playBasketballThrow(); // cymbal crash
            spawnParticles(this.x + this.width / 2, this.y + 10, '#ec4899', 8, true);
            this.activeTimer = 15;
          }
        }
      }
      if (this.activeTimer > 0) this.activeTimer--;
    },
    draw(ctx) {
      const rx = this.x;
      const ry = this.y;
      
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(rx + 50, ry + 45, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(rx + 50, ry + 45, 21, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(rx + 30, ry + 12, 18, 10);
      ctx.fillRect(rx + 52, ry + 12, 18, 10);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx + 30, ry + 10, 18, 2);
      ctx.fillRect(rx + 52, ry + 10, 18, 2);
      
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(rx + 10, ry + 5, 20, 4);
      ctx.fillRect(rx + 70, ry + 5, 20, 4);
      
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(rx + 20, ry + 9, 2, 61);
      ctx.fillRect(rx + 80, ry + 9, 2, 61);
      
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(rx + 10, ry + 25, 18, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx + 10, ry + 23, 18, 2);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(rx + 19, ry + 33, 2, 37);
      
      if (this.activeTimer > 0) {
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3;
        ctx.strokeRect(rx - 5, ry - 5, this.width + 10, this.height + 10);
      }
    }
  },
  
  guitar: {
    x: 180,
    y: 400,
    width: 40,
    height: 80,
    activeTimer: 0,
    checkInteraction() {
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pBottom = player.y + player.height;
      if (pRight > this.x && pLeft < this.x + this.width && Math.abs(pBottom - (this.y + this.height)) < 15) {
        if (keys['k'] || keys['enter'] || player.isCharging) {
          if (this.activeTimer === 0) {
            AudioEffects.playGuitarShred();
            spawnParticles(this.x + 20, this.y + 20, '#06b6d4', 12);
            this.activeTimer = 35;
          }
        }
      }
      if (this.activeTimer > 0) this.activeTimer--;
    },
    draw(ctx) {
      const rx = this.x;
      const ry = this.y;
      
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 20, ry + 30);
      ctx.lineTo(rx + 20, ry + 80);
      ctx.moveTo(rx + 10, ry + 80);
      ctx.lineTo(rx + 30, ry + 80);
      ctx.stroke();
      
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(rx + 20, ry + 35);
      ctx.lineTo(rx + 8, ry + 65);
      ctx.lineTo(rx + 16, ry + 60);
      ctx.lineTo(rx + 24, ry + 60);
      ctx.lineTo(rx + 32, ry + 65);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#b45309';
      ctx.fillRect(rx + 18, ry + 10, 4, 25);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx + 16, ry + 42, 8, 12);
      ctx.restore();
      
      if (this.activeTimer > 0) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(rx + 14 + i*4, ry + 10);
          ctx.lineTo(rx + 14 + i*4 + Math.sin(time*0.5 + i)*2, ry + 55);
          ctx.stroke();
        }
      }
    }
  },
  
  truck: {
    x: 550,
    y: 390,
    width: 100,
    height: 90,
    vx: 0,
    vy: 0,
    gravity: 0.35,
    update() {
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      
      if (this.y + this.height > SecretRoomElements.floorY) {
        this.y = SecretRoomElements.floorY - this.height;
        this.vy = -this.vy * 0.55;
        if (Math.abs(this.vy) < 0.8) this.vy = 0;
        this.vx *= 0.95;
      }
      
      if (this.x < 10) {
        this.x = 10;
        this.vx = -this.vx * 0.85;
      }
      if (this.x + this.width > 790) {
        this.x = 790 - this.width;
        this.vx = -this.vx * 0.85;
      }
      
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pTop = player.y;
      const pBottom = player.y + player.height;
      
      if (pRight > this.x && pLeft < this.x + this.width && pBottom > this.y && pTop < this.y + this.height) {
        const previousBottom = pBottom - player.vy;
        if (previousBottom <= this.y && player.vy >= 0) {
          player.y = this.y - player.height;
          player.vy = -16.5;
          player.isGrounded = false;
          player.doubleJumpAvailable = true;
          
          AudioEffects.playMonsterTruck();
          
          this.vy = 6.5;
          this.vx = player.facingRight ? 9.5 : -9.5;
          spawnParticles(this.x + this.width/2, this.y, '#ef4444', 15);
        } else {
          if (pLeft + player.width/2 < this.x + this.width/2) {
            this.vx = Math.min(8.0, this.vx + 0.35);
          } else {
            this.vx = Math.max(-8.0, this.vx - 0.35);
          }
        }
      }
    },
    draw(ctx) {
      const rx = this.x;
      const ry = this.y;
      
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(rx + 25, ry + 70, 20, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx + 75, ry + 70, 20, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.arc(rx + 25, ry + 70, 10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx + 75, ry + 70, 10, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx + 25, ry + 50); ctx.lineTo(rx + 25, ry + 70);
      ctx.moveTo(rx + 75, ry + 50); ctx.lineTo(rx + 75, ry + 70);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(rx + 15, ry + 15, 70, 35);
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx + 25, ry, 40, 15);
      
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(rx + 55, ry + 5, 10, 10);
      
      ctx.fillStyle = '#f97316';
      ctx.fillRect(rx + 25, ry + 25, 20, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(rx + 30, ry + 27, 10, 4);
    }
  },
  
  exitDoor: {
    x: 40,
    y: 380,
    width: 50,
    height: 100,
    update() {
      const pLeft = player.x;
      const pRight = player.x + player.width;
      const pTop = player.y;
      const pBottom = player.y + player.height;
      if (pRight > this.x && pLeft < this.x + this.width && pBottom > this.y && pTop < this.y + this.height) {
        player.x = player.mainLevelX;
        player.y = player.mainLevelY - 10;
        currentState = GAME_STATE.PLAYING;
        AudioEffects.playWin();
      }
    },
    draw(ctx) {
      const rx = this.x;
      const ry = this.y;
      
      ctx.fillStyle = '#581c87';
      ctx.fillRect(rx - 4, ry - 4, this.width + 8, this.height + 8);
      
      const cycle = Math.sin(time * 0.15) * 20;
      ctx.fillStyle = `rgb(${219 + cycle}, 39, ${119 + cycle})`;
      ctx.fillRect(rx, ry, this.width, this.height);
      
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, this.width, this.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', rx + this.width/2, ry - 10);
    }
  }
};

// Secret Sports Arena Minigame Room State
let minigamePitchedBall = null;
let minigamePitchTimer = 120;
let minigameSwingTimer = 0; // if > 0, player is swinging bat in minigame
let minigameScore = 0;
let minigameMessage = "";
let minigameMessageTimer = 0;
let minigameBalls = [];
let minigamePowerups = [];

function updateSecretRoom() {
  time++;
  
  player.vx *= player.friction;
  let moveDir = 0;
  if (!player.isCharging) {
    if (keys['a'] || keys['arrowleft']) {
      moveDir = -1;
      player.facingRight = false;
    }
    if (keys['d'] || keys['arrowright']) {
      moveDir = 1;
      player.facingRight = true;
    }
  } else {
    if (keys['a'] || keys['arrowleft']) {
      if (player.facingRight) {
        player.facingRight = false;
        player.chargeAngle = -Math.PI - player.chargeAngle;
      }
    }
    if (keys['d'] || keys['arrowright']) {
      if (!player.facingRight) {
        player.facingRight = true;
        player.chargeAngle = -Math.PI - player.chargeAngle;
      }
    }
  }

  if (moveDir !== 0) {
    player.vx += moveDir * player.accel;
    if (Math.abs(player.vx) > player.speed) {
      player.vx = Math.sign(player.vx) * player.speed;
    }
    player.isWalking = true;
    player.walkCycle += 0.15;
  } else {
    if (Math.abs(player.vx) < 0.1) {
      player.vx = 0;
      player.isWalking = false;
    }
  }

  player.vy += player.gravity;
  if (player.vy > 12) player.vy = 12;

  if (!player.isCharging && (keys['w'] || keys['space'] || keys['arrowup'])) {
    if (player.isGrounded) {
      player.vy = player.jumpForce;
      player.isGrounded = false;
      player.doubleJumpAvailable = true;
      AudioEffects.playJump();
      keys['w'] = keys['space'] = keys['arrowup'] = false;
    } else if (player.doubleJumpAvailable) {
      player.vy = player.jumpForce * 0.9;
      player.doubleJumpAvailable = false;
      AudioEffects.playJump();
      spawnParticles(player.x + player.width/2, player.y + player.height, '#ffffff', 8);
      keys['w'] = keys['space'] = keys['arrowup'] = false;
    }
  }

  player.x += player.vx;
  player.y += player.vy;

  if (player.x < 0) { player.x = 0; player.vx = 0; }
  if (player.x > 800 - player.width) { player.x = 800 - player.width; player.vx = 0; }
  
  player.isGrounded = false;
  const floorY = SecretRoomElements.floorY;
  if (player.y + player.height > floorY) {
    player.y = floorY - player.height;
    player.vy = 0;
    player.isGrounded = true;
    player.doubleJumpAvailable = true;
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update();
    
    if (proj.y + proj.radius > floorY) {
      proj.y = floorY - proj.radius;
      proj.vy = -proj.vy * 0.75;
      proj.bounces++;
    }
    
    if (proj.x < 0 || proj.x > 800 || proj.y > 600 || proj.bounces >= proj.maxBounces) {
      projectiles.splice(i, 1);
    }
  }

  SecretRoomElements.drums.checkInteraction();
  SecretRoomElements.guitar.checkInteraction();
  SecretRoomElements.truck.update();
  SecretRoomElements.exitDoor.update();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (!p.isMusicNote) p.vy += 0.15;
    p.alpha -= p.life;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.attackAnimTimer > 0) player.attackAnimTimer--;
  
  if (player.isCharging) {
    player.chargePower = Math.min(player.maxChargePower, player.chargePower + 0.16);
    if (keys['w'] || keys['arrowup']) {
      if (player.facingRight) player.chargeAngle = Math.max(-Math.PI / 2, player.chargeAngle - 0.04);
      else player.chargeAngle = Math.min(-Math.PI / 2, player.chargeAngle + 0.04);
    }
    if (keys['s'] || keys['arrowdown']) {
      if (player.facingRight) player.chargeAngle = Math.min(0, player.chargeAngle + 0.04);
      else player.chargeAngle = Math.max(-Math.PI, player.chargeAngle - 0.04);
    }
  }
}

function drawSecretRoom() {
  ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
  ctx.fillRect(0, 100, VIEWPORT_WIDTH, 4);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
  ctx.fillRect(0, 110, VIEWPORT_WIDTH, 4);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let x = 0; x < 800; x += 40) {
    for (let y = 0; y < 600; y += 20) {
      ctx.fillRect(x + (y % 40 === 0 ? 20 : 0), y, 38, 18);
    }
  }

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, SecretRoomElements.floorY, 800, 120);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, SecretRoomElements.floorY, 800, 6);
  
  ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
  ctx.beginPath();
  ctx.moveTo(400, 0);
  ctx.lineTo(200, 480);
  ctx.lineTo(600, 480);
  ctx.closePath();
  ctx.fill();

  SecretRoomElements.exitDoor.draw(ctx);
  SecretRoomElements.guitar.draw(ctx);
  SecretRoomElements.drums.draw(ctx);
  SecretRoomElements.truck.draw(ctx);
  
  for (const proj of projectiles) {
    proj.draw(ctx, 0, 0);
  }

  player.draw(ctx, 0, 0);
  
  drawAimTrajectory(ctx);

  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    if (p.isMusicNote) {
      ctx.font = `${Math.floor(p.size * 2.5)}px sans-serif`;
      const notes = ['♪', '♫', '♩'];
      ctx.fillText(notes[p.noteType], p.x, p.y);
    } else {
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.restore();
  }
  
  ctx.save();
  ctx.fillStyle = '#fef08a';
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('SECRET MUSIC STUDIO', 400, 40);
}

function updateSecretMinigameRoom() {
  time++;
  
  if (minigameMessageTimer > 0) minigameMessageTimer--;
  if (minigameSwingTimer > 0) minigameSwingTimer--;

  // Player physics (friction, walk cycle, inputs)
  player.vx *= player.friction;
  let moveDir = 0;
  
  if (!player.isCharging && minigameSwingTimer === 0) {
    if (keys['a'] || keys['arrowleft']) {
      moveDir = -1;
      player.facingRight = false;
    }
    if (keys['d'] || keys['arrowright']) {
      moveDir = 1;
      player.facingRight = true;
    }
  } else {
    if (keys['a'] || keys['arrowleft']) {
      if (player.facingRight) {
        player.facingRight = false;
        player.chargeAngle = -Math.PI - player.chargeAngle;
      }
    }
    if (keys['d'] || keys['arrowright']) {
      if (!player.facingRight) {
        player.facingRight = true;
        player.chargeAngle = -Math.PI - player.chargeAngle;
      }
    }
  }

  if (moveDir !== 0) {
    player.vx += moveDir * player.accel;
    if (Math.abs(player.vx) > player.speed) {
      player.vx = Math.sign(player.vx) * player.speed;
    }
    player.isWalking = true;
    player.walkCycle += 0.15;
  } else {
    if (Math.abs(player.vx) < 0.1) {
      player.vx = 0;
      player.isWalking = false;
    }
  }

  player.vy += player.gravity;
  if (player.vy > 12) player.vy = 12;

  // Jump input
  if (!player.isCharging && minigameSwingTimer === 0 && (keys['w'] || keys['space'] || keys['arrowup'])) {
    if (player.isGrounded) {
      player.vy = player.jumpForce;
      player.isGrounded = false;
      player.doubleJumpAvailable = true;
      AudioEffects.playJump();
      keys['w'] = keys['space'] = keys['arrowup'] = false;
    } else if (player.doubleJumpAvailable) {
      player.vy = player.jumpForce * 0.9;
      player.doubleJumpAvailable = false;
      AudioEffects.playJump();
      spawnParticles(player.x + player.width/2, player.y + player.height, '#ffffff', 8);
      keys['w'] = keys['space'] = keys['arrowup'] = false;
    }
  }

  player.x += player.vx;
  player.y += player.vy;

  // Constrain inside room
  if (player.x < 0) { player.x = 0; player.vx = 0; }
  if (player.x > 800 - player.width) { player.x = 800 - player.width; player.vx = 0; }
  
  // Floor collision (floorY = 480)
  const floorY = 480;
  player.isGrounded = false;
  if (player.y + player.height > floorY) {
    player.y = floorY - player.height;
    player.vy = 0;
    player.isGrounded = true;
    player.doubleJumpAvailable = true;
  }

  // Update projectiles (Standard basketball/baseball throws inside room)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update();
    
    // Bounce off walls and floor inside minigame
    if (proj.y + proj.radius > floorY) {
      proj.y = floorY - proj.radius;
      proj.vy = -proj.vy * 0.75;
      proj.bounces++;
    }
    
    // Out of bounds check
    if (proj.x < 0 || proj.x > 800 || proj.y > 600 || proj.bounces >= proj.maxBounces) {
      projectiles.splice(i, 1);
      continue;
    }

    // Score hoop check (Basketball mode only)
    if (player.mode === 'basketball' && !proj.scoredInMinigame) {
      // Hoop center: x = 612, y = 260
      if (proj.x > 595 && proj.x < 630 && proj.y >= 255 && proj.y <= 275 && proj.vy > 0) {
        proj.scoredInMinigame = true;
        minigameScore++;
        minigameMessage = "SWISH! SCORE!";
        minigameMessageTimer = 90;
        AudioEffects.playWin();
        spawnParticles(612, 260, '#fbbf24', 20);

        // Spawn a powerup
        const pType = Math.random() > 0.5 ? 'health' : 'speed';
        minigamePowerups.push({
          x: 250 + Math.random() * 200,
          y: floorY - 24,
          width: 24,
          height: 24,
          type: pType,
          draw(ctx, cx, cy) {
            ctx.fillStyle = this.type === 'health' ? '#ef4444' : '#fbbf24';
            ctx.fillRect(this.x - cx, this.y - cy, this.width, this.height);
            ctx.strokeStyle = '#05030d';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(this.x - cx, this.y - cy, this.width, this.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '6px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(this.type === 'health' ? 'HP' : 'SPD', this.x + 12 - cx, this.y + 15 - cy);
          }
        });
      }
    }
  }

  // Update pitched baseball (Baseball mode only)
  if (player.mode === 'baseball') {
    minigamePitchTimer--;
    if (minigamePitchTimer <= 0) {
      minigamePitchTimer = 140 + Math.random() * 60;
      minigamePitchedBall = {
        x: 640,
        y: 420,
        vx: -5.0 - Math.random() * 1.5,
        vy: -3.0 - Math.random() * 1.5,
        radius: 8,
        active: true,
        hit: false
      };
      AudioEffects.playBaseballThrow();
      minigameMessage = "PITCH!";
      minigameMessageTimer = 60;
    }

    if (minigamePitchedBall && minigamePitchedBall.active) {
      minigamePitchedBall.x += minigamePitchedBall.vx;
      minigamePitchedBall.y += minigamePitchedBall.vy;
      minigamePitchedBall.vy += 0.15; // Gravity

      // Check floor bounce if not hit
      if (minigamePitchedBall.y + minigamePitchedBall.radius > floorY) {
        minigamePitchedBall.y = floorY - minigamePitchedBall.radius;
        minigamePitchedBall.vy = -minigamePitchedBall.vy * 0.65;
      }

      // Strike boundary check
      if (minigamePitchedBall.x < 0 || minigamePitchedBall.x > 800) {
        if (!minigamePitchedBall.hit) {
          minigameMessage = "STRIKE!";
          minigameMessageTimer = 60;
          AudioEffects.playLose();
        }
        minigamePitchedBall.active = false;
      }
    }
  }

  // Update Minigame Powerups
  for (let i = minigamePowerups.length - 1; i >= 0; i--) {
    const p = minigamePowerups[i];
    if (
      player.x + player.width > p.x &&
      player.x < p.x + p.width &&
      player.y + player.height > p.y &&
      player.y < p.y + p.height
    ) {
      // Collect!
      if (p.type === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        AudioEffects.playWin();
        spawnParticles(p.x + 12, p.y + 12, '#ef4444', 15);
      } else if (p.type === 'speed') {
        player.powerupTimer = 300;
        player.speed = 6.5;
        AudioEffects.playWin();
        spawnParticles(p.x + 12, p.y + 12, '#fbbf24', 15);
      }
      updateHUD();
      minigamePowerups.splice(i, 1);
    }
  }

  // Exit Portal check
  const exitX = 50;
  const exitY = 400;
  const exitW = 50;
  const exitH = 80;
  if (
    player.x + player.width > exitX &&
    player.x < exitX + exitW &&
    player.y + player.height > exitY &&
    player.y < exitY + exitH
  ) {
    currentState = GAME_STATE.PLAYING;
    player.x = player.mainLevelX;
    player.y = player.mainLevelY;
    player.vx = 0;
    player.vy = 0;
    AudioEffects.playWin();
    projectiles = [];
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (!p.isMusicNote) p.vy += 0.15;
    p.alpha -= p.life;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Charge aim update
  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.attackAnimTimer > 0) player.attackAnimTimer--;
  
  if (player.isCharging) {
    player.chargePower = Math.min(player.maxChargePower, player.chargePower + 0.16);
    if (keys['w'] || keys['arrowup']) {
      if (player.facingRight) player.chargeAngle = Math.max(-Math.PI / 2, player.chargeAngle - 0.04);
      else player.chargeAngle = Math.min(-Math.PI / 2, player.chargeAngle + 0.04);
    }
    if (keys['s'] || keys['arrowdown']) {
      if (player.facingRight) player.chargeAngle = Math.min(0, player.chargeAngle + 0.04);
      else player.chargeAngle = Math.max(-Math.PI, player.chargeAngle - 0.04);
    }
  }
}

function drawSecretMinigameRoom() {
  ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  // Background gradient: retro sunset stadium color
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 600);
  bgGrad.addColorStop(0, '#090514');
  bgGrad.addColorStop(1, '#1b1437');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  // Draw stadium floodlight structures
  ctx.fillStyle = '#2e1f4d';
  ctx.fillRect(150, 80, 8, 120);
  ctx.fillRect(640, 80, 8, 120);
  ctx.fillRect(120, 70, 70, 15);
  ctx.fillRect(610, 70, 70, 15);
  
  // Bulbs
  ctx.fillStyle = '#fef08a';
  for (let b = 0; b < 4; b++) {
    ctx.fillRect(130 + b * 16, 74, 8, 8);
    ctx.fillRect(620 + b * 16, 74, 8, 8);
  }

  // Draw Gym wood court floorboards
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 480, 800, 120);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 480, 800, 6);
  
  // Floorboard panels lines
  ctx.fillStyle = '#92400e';
  for (let lx = 0; lx < 800; lx += 60) {
    ctx.fillRect(lx, 486, 2, 114);
  }

  // Draw exit portal on the left
  const exitX = 50;
  const exitY = 400;
  const exitW = 50;
  const exitH = 80;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(exitX, exitY, exitW, exitH);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(exitX, exitY, exitW, exitH);
  
  // Swirling portal center
  ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.fillRect(exitX + 8, exitY + 8, exitW - 16, exitH - 16);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '7px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exitX + exitW/2, exitY - 10 + Math.sin(time * 0.1) * 3);

  // Draw mode specific target elements
  if (player.mode === 'basketball') {
    // Basketball Hoop
    // Base post
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(645, 260, 10, 220);
    ctx.strokeStyle = '#05030d';
    ctx.lineWidth = 2;
    ctx.strokeRect(645, 260, 10, 220);
    // Backboard
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(620, 180, 60, 45);
    ctx.strokeRect(620, 180, 60, 45);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(630, 190, 40, 25);
    // Rim
    ctx.fillStyle = '#ea580c'; // Red rim
    ctx.fillRect(598, 260, 26, 6);
    ctx.strokeRect(598, 260, 26, 6);
    // Net
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(600, 266);
    ctx.lineTo(606, 290);
    ctx.lineTo(616, 290);
    ctx.lineTo(622, 266);
    ctx.moveTo(606, 290);
    ctx.lineTo(611, 305);
    ctx.lineTo(616, 290);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#fbbf24';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('HOOP', 650, 160);
  } else {
    // Baseball Pitching Machine
    // Base
    ctx.fillStyle = '#475569';
    ctx.fillRect(640, 410, 50, 70);
    ctx.strokeStyle = '#05030d';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(640, 410, 50, 70);
    
    // Bevel highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(640, 410, 50, 4);
    
    // Pitching pipe
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(615, 420, 30, 18);
    ctx.strokeRect(615, 420, 30, 18);
    
    // Yellow hazard stripe
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(645, 430, 40, 6);
    ctx.fillRect(645, 450, 40, 6);

    // Draw pitched ball
    if (minigamePitchedBall && minigamePitchedBall.active) {
      ctx.fillStyle = '#ffffff'; // White baseball
      ctx.beginPath();
      ctx.arc(minigamePitchedBall.x, minigamePitchedBall.y, minigamePitchedBall.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444'; // Red stitches
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#ef4444';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('PITCHER', 665, 390);
  }

  // Draw minigame powerups
  for (const p of minigamePowerups) {
    p.draw(ctx, 0, 0);
  }

  // Draw projectiles (Basketball shots)
  for (const proj of projectiles) {
    proj.draw(ctx, 0, 0);
  }

  // Draw Player
  player.draw(ctx, 0, 0);

  // Draw swing bat if active (Baseball only)
  if (player.mode === 'baseball' && minigameSwingTimer > 0) {
    ctx.save();
    ctx.strokeStyle = '#b45309'; // wood brown
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    // Swing angle calculation
    const angle = (15 - minigameSwingTimer) * (Math.PI / 8) - Math.PI / 2;
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 55, Math.sin(angle) * 55);
    ctx.stroke();
    
    // Add white swing motion arcs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 55, -Math.PI/2, angle, false);
    ctx.stroke();
    
    ctx.restore();
  }

  // Draw aim trajectory (Basketball only)
  if (player.mode === 'basketball') {
    drawAimTrajectory(ctx);
  }

  // Draw particles
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    ctx.restore();
  }

  // Render scores / text info
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${minigameScore}`, 30, 40);
  
  ctx.textAlign = 'right';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText(player.mode === 'baseball' ? 'SWING BAT: PRESS ENTER / K / CLICK' : 'AIM & THROW: HOLD ENTER / K / CLICK', 770, 40);
  ctx.restore();

  // Floating Minigame Messages (like HIT!, SWISH!, STRIKE!)
  if (minigameMessageTimer > 0) {
    ctx.save();
    ctx.fillStyle = minigameMessage.includes('HIT') || minigameMessage.includes('SWISH') ? '#22c55e' : '#ef4444';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    const scale = 1 + Math.sin(minigameMessageTimer * 0.1) * 0.15;
    ctx.translate(400, 180);
    ctx.scale(scale, scale);
    ctx.fillText(minigameMessage, 0, 0);
    ctx.restore();
  }
}

// Spawn Enemies in appropriate locations (seed-randomized)
function spawnEnemies() {
  enemies = [];
  
  // Initialize PRNG using the active seed to get the exact same metrics!
  setSeed(currentSeed);
  
  // Recalculate metrics
  const yardWidth = 600 + Math.floor(seededRandom() * 200);
  const houseX = yardWidth;
  const secondFloorY = 230 + Math.floor(seededRandom() * 35); // y = 230 to 265
  
  const livingRoomW = 750 + Math.floor(seededRandom() * 200);
  const kitchenW = 750 + Math.floor(seededRandom() * 200);
  const bedroomW = 750 + Math.floor(seededRandom() * 200);
  const atticW = LEVEL_WIDTH - (houseX + livingRoomW + kitchenW + bedroomW);
  
  const livingX = houseX;
  const kitchenX = livingX + livingRoomW;
  const bedroomX = kitchenX + kitchenW;
  const atticX = bedroomX + bedroomW;

  const stairsX = livingX + livingRoomW - 320;
  
  // Now set the seed for enemy generation offsets
  setSeed(currentSeed + "E");
  
  // 1. Yard (x: 200 to yardWidth - 100)
  const yardCount = 2 + Math.floor(seededRandom() * 2);
  for (let i = 0; i < yardCount; i++) {
    const ex = 200 + seededRandom() * (yardWidth - 300);
    enemies.push(new Enemy(ex, 476, 'dust-bunny'));
  }
  
  // 2. Living Room (x: livingX + 50 to livingX + livingRoomW - 100)
  enemies.push(new Enemy(livingX + 80 + seededRandom() * 200, 476, 'vacuum'));
  enemies.push(new Enemy(livingX + 350 + seededRandom() * 300, 476, 'dust-bunny'));
  if (seededRandom() > 0.4) {
    enemies.push(new Enemy(livingX + 550 + seededRandom() * 150, 476, 'vacuum'));
  }
  
  // 3. Kitchen (x: kitchenX + 50 to kitchenX + kitchenW - 100)
  enemies.push(new Enemy(kitchenX + 150 + seededRandom() * 250, 476, 'dust-bunny'));
  enemies.push(new Enemy(kitchenX + 450 + seededRandom() * 250, 476, 'vacuum'));
  
  // 4. Hallway 2nd floor (x: houseX + 50 to bedroomX + bedroomW - 100)
  const secondFloorFloorY = secondFloorY - 24;
  const hallVacuumCount = 1 + Math.floor(seededRandom() * 2);
  for (let i = 0; i < hallVacuumCount; i++) {
    const ex = houseX + 100 + seededRandom() * (livingRoomW + kitchenW + bedroomW - 200);
    enemies.push(new Enemy(ex, secondFloorFloorY, 'vacuum'));
  }
  const hallBunnyCount = 1 + Math.floor(seededRandom() * 2);
  for (let i = 0; i < hallBunnyCount; i++) {
    const ex = houseX + 150 + seededRandom() * (livingRoomW + kitchenW + bedroomW - 300);
    enemies.push(new Enemy(ex, secondFloorFloorY, 'dust-bunny'));
  }

  // 5. Bedroom (x: bedroomX + 50 to bedroomX + bedroomW - 100)
  enemies.push(new Enemy(bedroomX + 100 + seededRandom() * 300, 476, 'dust-bunny'));
  enemies.push(new Enemy(bedroomX + 450 + seededRandom() * 250, 476, 'vacuum'));

  // 6. Attic (x: atticX + 50 to LEVEL_WIDTH - 200)
  enemies.push(new Enemy(atticX + 100 + seededRandom() * 250, 476, 'dust-bunny'));
  enemies.push(new Enemy(atticX + 50, 86, 'vacuum')); // rafter patrol
  enemies.push(new Enemy(atticX + 250, 86, 'vacuum')); // rafter patrol
  
  // M'gee the final boss is always at the end attic region, guarding the trophy.
  // Boss height is 40, so boss y = 500 - 40 = 460.
  const bossX = LEVEL_WIDTH - 260 + seededRandom() * 80;
  enemies.push(new Enemy(bossX, 460, 'cat-boss'));

  // Flying Toys hovering at transition points
  enemies.push(new Enemy(houseX - 40, 200, 'toy')); // near door entrance
  enemies.push(new Enemy(stairsX - 20, 180, 'toy')); // near Living room stairs
  enemies.push(new Enemy(kitchenX + kitchenW / 2, 160, 'toy')); // middle of hallway
  enemies.push(new Enemy(bedroomX + bedroomW - 130, 200, 'toy')); // near bunk bed / attic ladder
  enemies.push(new Enemy(atticX - 100, 150, 'toy')); // attic entryway
}

// Attack Execution
function startCharging() {
  player.isCharging = true;
  player.chargePower = 0;
  player.chargeAngle = player.facingRight ? -Math.PI / 6 : -Math.PI * 5 / 6;
}

function launchBall() {
  player.isCharging = false;
  player.attackAnimTimer = 10;
  player.attackCooldown = 25;
  
  const launchSpeed = 4.5 + player.chargePower;
  const vx = Math.cos(player.chargeAngle) * launchSpeed;
  const vy = Math.sin(player.chargeAngle) * launchSpeed;
  
  const spawnX = player.x + (player.facingRight ? player.width + 5 : -15);
  const spawnY = player.y + 30;

  if (player.mode === 'baseball') {
    AudioEffects.playBaseballThrow();
    projectiles.push(new Baseball(spawnX, spawnY, vx, vy));
  } else if (player.mode === 'basketball') {
    AudioEffects.playBasketballThrow();
    projectiles.push(new Basketball(spawnX, spawnY, vx, vy));
  }
}

function drawAimTrajectory(ctx) {
  if (!player.isCharging) return;
  
  ctx.save();
  ctx.strokeStyle = player.mode === 'baseball' ? '#f59e0b' : '#f97316';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  
  const startX = player.x + (player.facingRight ? player.width + 5 : -15);
  const startY = player.y + 30;
  const launchSpeed = 4.5 + player.chargePower;
  const vx = Math.cos(player.chargeAngle) * launchSpeed;
  const vy = Math.sin(player.chargeAngle) * launchSpeed;
  const gravity = player.mode === 'baseball' ? 0.25 : 0.35;

  ctx.beginPath();
  let px = startX;
  let py = startY;
  let pvx = vx;
  let pvy = vy;

  ctx.moveTo(px - camera.x, py - camera.y);
  // Plot 25 steps ahead
  for (let step = 0; step < 25; step++) {
    pvy += gravity;
    px += pvx;
    py += pvy;
    ctx.lineTo(px - camera.x, py - camera.y);
  }
  ctx.stroke();
  ctx.restore();
}

// HUD Utility
function updateHUD() {
  // Pad score
  let scoreStr = score.toString();
  while (scoreStr.length < 6) scoreStr = '0' + scoreStr;
  document.getElementById('hud-score').innerText = scoreStr;

  // HP hearts
  let heartStr = '';
  for (let i = 0; i < player.maxHp; i++) {
    if (i < player.hp) heartStr += '❤';
    else heartStr += '🖤'; // lost heart
  }
  document.getElementById('hud-hp').innerText = heartStr;

  // Update virtual touchscreen action button label if present
  const btnAction = document.getElementById('btn-touch-action');
  if (btnAction) {
    if (currentState === GAME_STATE.SECRET_MINIGAME_ROOM && player.mode === 'baseball') {
      btnAction.innerText = 'SWING';
    } else if (player.mode === 'baseball') {
      btnAction.innerText = 'THROW';
    } else {
      btnAction.innerText = 'LOB';
    }
  }
}

// Main Game Loop Updates
function update() {
  time++;

  // Update Player
  player.update();

  // Update Secret Door
  SecretDoor.update();
  SecretDoor2.update();

  // Update Projectiles (Baseballs)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update();

    // Out of level bounds check
    if (proj.x < 0 || proj.x > LEVEL_WIDTH || proj.y > LEVEL_HEIGHT || proj.bounces >= proj.maxBounces) {
      projectiles.splice(i, 1);
      continue;
    }

    // Check hit against enemies
    let hitSomething = false;
    for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
      const enemy = enemies[eIdx];
      const dist = Math.hypot(proj.x - (enemy.x + enemy.width/2), proj.y - (enemy.y + enemy.height/2));
      
      if (dist < proj.radius + Math.max(enemy.width, enemy.height) / 2) {
        // Hit!
        const dead = enemy.damage(1);
        if (dead) {
          enemies.splice(eIdx, 1);
        }
        hitSomething = true;
        break;
      }
    }

    if (hitSomething) {
      projectiles.splice(i, 1);
    }
  }

  // Basketball logic handled dynamically in projectiles array

  // Update Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update();

    // Player touch collision
    const pLeft = player.x;
    const pRight = player.x + player.width;
    const pTop = player.y;
    const pBottom = player.y + player.height;

    const eLeft = enemy.x;
    const eRight = enemy.x + enemy.width;
    const eTop = enemy.y;
    const eBottom = enemy.y + enemy.height;

    if (pRight > eLeft && pLeft < eRight && pBottom > eTop && pTop < eBottom) {
      // Stomping check: player is falling, and player's bottom edge was previously above the top of the enemy
      const prevPlayerBottom = pBottom - player.vy;
      if (player.vy > 0 && prevPlayerBottom <= eTop + 16) {
        const dead = enemy.damage(1);
        if (dead) {
          enemies.splice(i, 1);
        }
        // Snap player to top and bounce them upward!
        player.y = eTop - player.height;
        player.vy = -8.5;
        player.isGrounded = false;
        player.doubleJumpAvailable = true;
        
        spawnParticles(player.x + player.width / 2, eTop, '#ffffff', 10);
        AudioEffects.playBounce();
      } else {
        player.damage();
      }
    }
  }

  // Check Win condition (touching Trophy)
  const pLeft = player.x;
  const pRight = player.x + player.width;
  const pTop = player.y;
  const pBottom = player.y + player.height;

  if (
    pRight > Goal.x && 
    pLeft < Goal.x + Goal.width && 
    pBottom > Goal.y && 
    pTop < Goal.y + Goal.height
  ) {
    winGame();
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (!p.isMusicNote) {
      p.vy += 0.15; // Gravity on debris
    }
    p.alpha -= p.life;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update Camera Target
  camera.targetX = player.x - VIEWPORT_WIDTH / 3;
  camera.targetY = player.y - VIEWPORT_HEIGHT / 2 - 30;

  // Clamp camera
  if (camera.targetX < 0) camera.targetX = 0;
  if (camera.targetX > LEVEL_WIDTH - VIEWPORT_WIDTH) camera.targetX = LEVEL_WIDTH - VIEWPORT_WIDTH;
  
  if (camera.targetY < 0) camera.targetY = 0;
  if (camera.targetY > LEVEL_HEIGHT - VIEWPORT_HEIGHT) camera.targetY = LEVEL_HEIGHT - VIEWPORT_HEIGHT;

  // Lerp camera
  camera.x += (camera.targetX - camera.x) * camera.lerp;
  camera.y += (camera.targetY - camera.y) * camera.lerp;

  // Update targets and powerups
  BasketballHoop.update();
  BaseballTarget.update();
  for (let i = powerups.length - 1; i >= 0; i--) {
    powerups[i].update();
  }
}

// Drawing Functions
function draw() {
  ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  const camX = Math.floor(camera.x);
  const camY = Math.floor(camera.y);

  // 1. Draw Environmental Background Parallax
  drawParallaxBackground(camX, camY);

  // 2. Draw Furniture Platforms
  for (const plat of platforms) {
    const rx = Math.floor(plat.x - camX);
    const ry = Math.floor(plat.y - camY);

    // Skip drawing if completely out of screen bounds
    if (rx + plat.width < 0 || rx > VIEWPORT_WIDTH || ry + plat.height < 0 || ry > VIEWPORT_HEIGHT) {
      continue;
    }

    // --- PROCEDURAL pixel art drawings based on type ---
    if (plat.type === 'bookshelf') {
      // Wood base frame
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, plat.height);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, plat.height);
      
      // Horizontal shelves
      const shelfSpacing = plat.height / plat.shelves;
      ctx.fillStyle = '#451a03'; // Dark shelf inserts
      for (let s = 1; s < plat.shelves; s++) {
        const sy = ry + s * shelfSpacing;
        ctx.fillRect(rx + 4, sy, plat.width - 8, 4);
        
        // Draw colorful books
        if (plat.books) {
          for (const b of plat.books) {
            if ((b.offset + s * 13) % 7 < 5) {
              ctx.fillStyle = b.color;
              ctx.fillRect(rx + 6 + b.offset, sy - b.height, 6, b.height);
              ctx.strokeStyle = '#05030d';
              ctx.lineWidth = 1;
              ctx.strokeRect(rx + 6 + b.offset, sy - b.height, 6, b.height);
            }
          }
        }
      }
    }
    else if (plat.type === 'couch') {
      // Backrest
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, plat.height - 18);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, plat.height - 18);
      
      // Bottom frame base
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(rx, ry + plat.height - 18, plat.width, 18);
      
      // Seat cushion
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx + 8, ry + plat.height - 35, plat.width - 16, 25);
      ctx.strokeRect(rx + 8, ry + plat.height - 35, plat.width - 16, 25);
      
      // Left armrest
      ctx.fillRect(rx, ry + plat.height - 38, 16, 28);
      ctx.strokeRect(rx, ry + plat.height - 38, 16, 28);
      
      // Right armrest
      ctx.fillRect(rx + plat.width - 16, ry + plat.height - 38, 16, 28);
      ctx.strokeRect(rx + plat.width - 16, ry + plat.height - 38, 16, 28);
      
      // Draw Pillows
      if (plat.pillows) {
        for (const p of plat.pillows) {
          ctx.fillStyle = p.color;
          ctx.fillRect(rx + p.xOffset, ry + plat.height - 38, 12, 14);
          ctx.strokeStyle = '#05030d';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx + p.xOffset, ry + plat.height - 38, 12, 14);
        }
      }
    }
    else if (plat.type === 'fridge') {
      // Body
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, plat.height);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, plat.height);
      
      // Freezer split door line
      ctx.fillStyle = '#05030d';
      ctx.fillRect(rx, ry + 60, plat.width, 3);
      
      // Handles
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(rx + 8, ry + 15, 6, 30);
      ctx.fillRect(rx + 8, ry + 70, 6, 25);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 8, ry + 15, 6, 30);
      ctx.strokeRect(rx + 8, ry + 70, 6, 25);
      
      // Magnets & Notes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(rx + 35, ry + 25, 8, 8);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(rx + 50, ry + 85, 8, 10);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(rx + 42, ry + 38, 14, 14);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 42, ry + 38, 14, 14);
    }
    else if (plat.type === 'dining-table') {
      // Table top
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, 14);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, 14);
      
      // Bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(rx, ry, plat.width, 3);
      
      // Legs
      ctx.fillStyle = '#451a03';
      ctx.fillRect(rx + 15, ry + 14, 10, plat.height - 14);
      ctx.fillRect(rx + plat.width - 25, ry + 14, 10, plat.height - 14);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 15, ry + 14, 10, plat.height - 14);
      ctx.strokeRect(rx + plat.width - 25, ry + 14, 10, plat.height - 14);
    }
    else if (plat.type === 'bed') {
      if (plat.isBunk) {
        // Wood posts
        ctx.fillStyle = '#451a03';
        ctx.fillRect(rx, ry, 15, plat.height);
        ctx.fillRect(rx + plat.width - 15, ry, 15, plat.height);
        ctx.strokeStyle = '#05030d';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, 15, plat.height);
        ctx.strokeRect(rx + plat.width - 15, ry, 15, plat.height);
        
        // Mattresses
        ctx.fillStyle = plat.color;
        ctx.fillRect(rx + 15, ry + plat.height - 25, plat.width - 30, 15);
        ctx.strokeRect(rx + 15, ry + plat.height - 25, plat.width - 30, 15);
        ctx.fillRect(rx + 15, ry + 20, plat.width - 30, 15);
        ctx.strokeRect(rx + 15, ry + 20, plat.width - 30, 15);
        
        // Pillows
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx + 20, ry + plat.height - 35, 20, 10);
        ctx.strokeRect(rx + 20, ry + plat.height - 35, 20, 10);
        ctx.fillRect(rx + 20, ry + 10, 20, 10);
        ctx.strokeRect(rx + 20, ry + 10, 20, 10);
      } else {
        // Bed post left
        ctx.fillStyle = '#451a03';
        ctx.fillRect(rx, ry + 15, 12, plat.height - 15);
        ctx.fillRect(rx + plat.width - 12, ry + 40, 12, plat.height - 40);
        ctx.strokeStyle = '#05030d';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry + 15, 12, plat.height - 15);
        ctx.strokeRect(rx + plat.width - 12, ry + 40, 12, plat.height - 40);
        
        // Mattress
        ctx.fillStyle = plat.color;
        ctx.fillRect(rx + 12, ry + 30, plat.width - 24, 18);
        ctx.strokeRect(rx + 12, ry + 30, plat.width - 24, 18);
        
        // Pillow
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx + 18, ry + 20, 24, 10);
        ctx.strokeRect(rx + 18, ry + 20, 24, 10);
      }
    }
    else if (plat.type === 'wardrobe') {
      // Outer cabinet
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, plat.height);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, plat.height);
      
      // Double doors line
      ctx.fillStyle = '#451a03';
      ctx.fillRect(rx + plat.width / 2 - 1, ry + 10, 2, plat.height - 20);
      
      // Brass Handles
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(rx + plat.width / 2 - 6, ry + 80, 3, 10);
      ctx.fillRect(rx + plat.width / 2 + 3, ry + 80, 3, 10);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + plat.width / 2 - 6, ry + 80, 3, 10);
      ctx.strokeRect(rx + plat.width / 2 + 3, ry + 80, 3, 10);
    }
    else if (plat.type === 'box-pile') {
      // Bottom box left
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx + 5, ry + 25, 40, 35);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 5, ry + 25, 40, 35);
      // Tape
      ctx.fillStyle = '#b45309';
      ctx.fillRect(rx + 20, ry + 25, 10, 35);
      
      // Bottom box right
      ctx.fillStyle = '#b45309';
      ctx.fillRect(rx + 55, ry + 10, 50, 50);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 55, ry + 10, 50, 50);
      // Tape
      ctx.fillStyle = '#d97706';
      ctx.fillRect(rx + 75, ry + 10, 10, 50);
      
      // Top box
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx + 30, ry, 35, 30);
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 30, ry, 35, 30);
      // Tape
      ctx.fillStyle = '#b45309';
      ctx.fillRect(rx + 42, ry, 8, 30);
    }
    else if (plat.type === 'window') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.fillRect(rx, ry, plat.width, plat.height);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, plat.width, plat.height);
      
      ctx.beginPath();
      ctx.moveTo(rx + plat.width / 2, ry);
      ctx.lineTo(rx + plat.width / 2, ry + plat.height);
      ctx.moveTo(rx, ry + plat.height / 2);
      ctx.lineTo(rx + plat.width, ry + plat.height / 2);
      ctx.stroke();
    }
    else if (plat.type === 'trampoline') {
      ctx.fillStyle = '#4b5563'; // metal grey frame
      ctx.fillRect(rx, ry + 20, plat.width, 10);
      ctx.fillRect(rx + 8, ry + 25, 4, 15);
      ctx.fillRect(rx + plat.width - 12, ry + 25, 4, 15);
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx + 8, ry + 20, plat.width - 16, 5);
      
      ctx.fillStyle = '#22c55e';
      for (let sx = rx + 8; sx < rx + plat.width - 16; sx += 8) {
        ctx.fillRect(sx, ry + 21, 4, 3);
      }
      
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry + 20, plat.width, 10);
      ctx.strokeRect(rx + 8, ry + 25, 4, 15);
      ctx.strokeRect(rx + plat.width - 12, ry + 25, 4, 15);
    }
    else {
      // Standard block drawing (Grass, Floorboards, Deck, Stairs, Counters)
      ctx.fillStyle = plat.color;
      ctx.fillRect(rx, ry, plat.width, plat.height);
      
      ctx.strokeStyle = '#05030d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, plat.width, plat.height);
      
      // Bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(rx, ry, plat.width, 3);
      ctx.fillRect(rx, ry, 3, plat.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(rx, ry + plat.height - 3, plat.width, 3);
      ctx.fillRect(rx + plat.width - 3, ry, 3, plat.height);

      // Floorboard seams
      if (plat.label === 'Floorboards') {
        ctx.fillStyle = '#542600';
        for (let bx = Math.floor(plat.x / 80) * 80; bx < plat.x + plat.width; bx += 80) {
          ctx.fillRect(bx - camX, ry, 2, plat.height);
        }
        ctx.fillRect(rx, ry, plat.width, 4);
      } 
      else if (plat.label === 'Yard Grass') {
        ctx.fillStyle = '#14532d';
        for (let gx = plat.x; gx < plat.x + plat.width; gx += 40) {
          ctx.fillRect(gx - camX + 10, ry, 4, 8);
          ctx.fillRect(gx - camX + 25, ry, 4, 12);
        }
        ctx.fillRect(rx, ry, plat.width, 6);
      }
      else if (plat.label === 'Attic Floor') {
        ctx.fillStyle = '#1e1b1e';
        for (let bx = Math.floor(plat.x / 60) * 60; bx < plat.x + plat.width; bx += 60) {
          ctx.fillRect(bx - camX, ry, 3, plat.height);
        }
        ctx.fillRect(rx, ry, plat.width, 4);
      }
      else if (plat.label === 'Stairs' || plat.label === 'Attic Ladder Step') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(rx, ry, plat.width, 6);
      }
      else if (plat.label === 'Countertop') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rx, ry, plat.width, 4);
      }
    }
  }

  // 3. Draw Goal
  Goal.draw(ctx, camX, camY);

  // 3.2 Draw Secret Door
  SecretDoor.draw(ctx, camX, camY);
  SecretDoor2.draw(ctx, camX, camY);

  // 3.5 Draw Hoop, Rebounder, and Powerups
  BasketballHoop.draw(ctx, camX, camY);
  BaseballTarget.draw(ctx, camX, camY);
  for (const p of powerups) {
    p.draw(ctx, camX, camY);
  }

  // 4. Draw Enemies
  for (const enemy of enemies) {
    enemy.draw(ctx, camX, camY);
  }

  // 5. Draw Projectiles
  for (const proj of projectiles) {
    proj.draw(ctx, camX, camY);
  }

  // 6. Draw Player
  player.draw(ctx, camX, camY);

  // 7. Draw Aim Trajectory
  drawAimTrajectory(ctx);

  // 8. Draw Particles
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    if (p.isMusicNote) {
      // Draw a retro music note symbol
      ctx.font = `${Math.floor(p.size * 2.5)}px sans-serif`;
      const notes = ['♪', '♫', '♩'];
      ctx.fillText(notes[p.noteType], p.x - camX, p.y - camY);
    } else {
      ctx.fillRect(Math.floor(p.x - camX), Math.floor(p.y - camY), p.size, p.size);
    }
    ctx.restore();
  }

  // 8.5 Draw Boss HUD if fighting the boss
  const boss = enemies.find(e => e.type === 'cat-boss');
  if (boss && currentState === GAME_STATE.PLAYING) {
    ctx.save();
    // Background bar
    ctx.fillStyle = 'rgba(15, 12, 30, 0.75)';
    ctx.fillRect(VIEWPORT_WIDTH / 2 - 150, 20, 300, 26);
    
    // Glowing red border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEWPORT_WIDTH / 2 - 150, 20, 300, 26);
    
    // Filled Health Bar
    const healthPercent = Math.max(0, boss.health / boss.maxHealth);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(VIEWPORT_WIDTH / 2 - 146, 24, 292 * healthPercent, 18);
    
    // Text: BOSS: M'GEE
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText("BOSS: M'GEE", VIEWPORT_WIDTH / 2, 36);
    ctx.restore();
  }

  // 9. Overlay HUD / Menus if not in playing state
  if (currentState === GAME_STATE.START) {
    drawStartScreen();
  } else if (currentState === GAME_STATE.GAMEOVER) {
    drawGameOverScreen();
  } else if (currentState === GAME_STATE.WIN) {
    drawWinScreen();
  }
}

function drawParallaxBackground(camX, camY) {
  // Indoor Background wallpapers, sky outside
  // Sky
  const skyColor = '#100e26';
  ctx.fillStyle = skyColor;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  // Moon outside window
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(450 - camX * 0.15, 120 - camY * 0.05, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skyColor;
  ctx.beginPath();
  ctx.arc(465 - camX * 0.15, 110 - camY * 0.05, 34, 0, Math.PI * 2);
  ctx.fill();

  // Stars
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 15; i++) {
    const sx = (i * 280 + 100 - camX * 0.1) % (LEVEL_WIDTH + 800);
    const sy = (i * 45 + 50) % 250;
    if (sx >= 0 && sx < VIEWPORT_WIDTH) {
      ctx.fillRect(sx, sy, 2, 2);
      if (Math.floor(time / 20 + i) % 3 === 0) {
        ctx.fillRect(sx - 1, sy, 4, 2);
        ctx.fillRect(sx, sy - 1, 2, 4);
      }
    }
  }

  // Yard Tree (x: 400 to 580)
  ctx.fillStyle = '#3f220f';
  ctx.fillRect(500 - camX, 220 - camY, 30, 280); // trunk
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.arc(515 - camX, 190 - camY, 65, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(460 - camX, 170 - camY, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(570 - camX, 175 - camY, 50, 0, Math.PI * 2);
  ctx.fill();

  // Indoor Wallpaper boundaries (Everything after x: 900 is inside the house)
  const houseStart = 900 - camX;
  const houseEnd = 4800 - camX;

  if (houseStart < VIEWPORT_WIDTH) {
    ctx.fillStyle = '#1e1a3a'; // indoor wall dark backing
    ctx.fillRect(Math.max(0, houseStart), 0, Math.min(VIEWPORT_WIDTH, houseEnd - Math.max(0, houseStart)), 500 - camY);

    // Wall Separators (Room Walls / Doors)
    ctx.fillStyle = '#0f0c24';
    // Living Room / Kitchen wall
    if (2200 - camX >= 0 && 2200 - camX < VIEWPORT_WIDTH) {
      ctx.fillRect(2200 - camX, 0, 15, 500 - camY);
    }
    // Kitchen / Bedroom wall
    if (3200 - camX >= 0 && 3200 - camX < VIEWPORT_WIDTH) {
      ctx.fillRect(3200 - camX, 0, 15, 500 - camY);
    }
    // Bedroom / Attic wall
    if (4200 - camX >= 0 && 4200 - camX < VIEWPORT_WIDTH) {
      ctx.fillRect(4200 - camX, 0, 15, 500 - camY);
    }

    // Windows showing sky/moon inside the house
    ctx.fillStyle = '#312e81'; // dark blue windows
    const windowY = 160 - camY;
    const windowW = 80;
    const windowH = 100;

    const windowPositions = [1180, 1700, 2600, 3100, 3550, 3850];
    for (const wx of windowPositions) {
      const rx = wx - camX;
      if (rx + windowW >= 0 && rx < VIEWPORT_WIDTH) {
        ctx.fillRect(rx, windowY, windowW, windowH);
        // Glass grid frame
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(rx, windowY, windowW, 3);
        ctx.fillRect(rx, windowY + windowH - 3, windowW, 3);
        ctx.fillRect(rx, windowY, 3, windowH);
        ctx.fillRect(rx + windowW - 3, windowY, 3, windowH);
        ctx.fillRect(rx + windowW / 2 - 1, windowY, 2, windowH);
        ctx.fillRect(rx, windowY + windowH / 2 - 1, windowW, 2);
      }
    }
    
    // Attic cobwebs & rafter backing
    ctx.fillStyle = '#141226'; // attic darker backing
    const atticStartX = 4200 - camX;
    if (atticStartX < VIEWPORT_WIDTH) {
      ctx.fillRect(Math.max(0, atticStartX), 0, VIEWPORT_WIDTH, 500 - camY);
      
      // Wooden roof slant
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(4200 - camX, 0);
      ctx.lineTo(4800 - camX, 150 - camY);
      ctx.lineTo(4800 - camX, 0);
      ctx.closePath();
      ctx.fill();

      // Cobwebs in top right corner
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4780 - camX, 0);
      ctx.lineTo(4800 - camX, 30 - camY);
      ctx.moveTo(4750 - camX, 0);
      ctx.lineTo(4800 - camX, 60 - camY);
      ctx.moveTo(4800 - camX, 0);
      ctx.lineTo(4760 - camX, 50 - camY);
      ctx.stroke();
    }
  }
}

// Overlay Screens (Text using Press Start 2P)
function drawStartScreen() {
  ctx.fillStyle = 'rgba(15, 12, 30, 0.85)';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px "Press Start 2P"';
  ctx.fillText('SUBURBAN RETRO RUNNER', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 60);

  ctx.font = '10px "Press Start 2P"';
  ctx.fillStyle = 'var(--secondary-glow)';
  ctx.fillText('CUSTOMIZE OUTFIT & FACE ON THE RIGHT PANEL', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 20);

  // 16-Bit Choice display
  ctx.save();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  ctx.strokeRect(VIEWPORT_WIDTH / 2 - 250, VIEWPORT_HEIGHT / 2 + 10, 500, 70);
  ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
  ctx.fillRect(VIEWPORT_WIDTH / 2 - 250, VIEWPORT_HEIGHT / 2 + 10, 500, 70);
  
  ctx.fillStyle = '#f59e0b';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText('PRESS [A] FOR BASEBALL MODE ⚾', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 32);
  ctx.fillStyle = '#f97316';
  ctx.fillText('PRESS [B] FOR BASKETBALL MODE 🏀', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 55);
  ctx.restore();

  ctx.fillStyle = 'var(--text-muted)';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('CONTROLS: A/D (MOVE) | SPACE/W (JUMP) | K/ENTER (ATTACK)', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 110);
  
  // Retro pulsing press start
  if (Math.floor(time / 20) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('CLICK THE SCREEN TO START (DEFAULT: BASEBALL)', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 150);
  }
}

function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '36px "Press Start 2P"';
  ctx.fillText('GAME OVER', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 40);

  ctx.font = '12px "Press Start 2P"';
  ctx.fillText(`FINAL SCORE: ${score}`, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 20);
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('PRESS R OR CLICK THE SCREEN TO RESTART', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 70);
}

function drawWinScreen() {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f59e0b';
  ctx.font = '32px "Press Start 2P"';
  ctx.fillText('YOU WIN!', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText('YOU DEFENDED THE SUBURBS!', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 10);
  ctx.fillText(`TOTAL SCORE: ${score}`, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 50);

  ctx.fillStyle = 'var(--secondary-glow)';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('CLICK SCREEN OR PRESS R TO PLAY AGAIN', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 110);
}

// State Changes
function startGame() {
  currentState = GAME_STATE.PLAYING;
  score = 0;
  player.hp = player.maxHp;
  buildLevel();
  spawnEnemies();
  updateHUD();
}

function gameOver() {
  currentState = GAME_STATE.GAMEOVER;
  AudioEffects.playLose();
}

function winGame() {
  currentState = GAME_STATE.WIN;
  AudioEffects.playWin();
}

function resetGame() {
  if (currentSeed === "RANDOM") {
    currentSeed = generateRandomSeed();
  }
  projectiles = [];
  particles = [];
  powerups = [];
  BasketballHoop.scored = false;
  BaseballTarget.scored = false;
  SecretDoor.opened = false;
  SecretDoor2.opened = false;
  minigameScore = 0;
  player.x = 100;
  player.y = 400;
  player.vx = 0;
  player.vy = 0;
  player.hp = player.maxHp;
  score = 0;
  camera.x = 0;
  camera.y = 0;
  buildLevel();
  spawnEnemies();
  updateHUD();
  currentState = GAME_STATE.PLAYING;
}

// ----------------------------------------------------
// DYNAMIC FACE PIXELATION & IMAGE UPLOAD LOGIC
// ----------------------------------------------------
const faceInput = document.getElementById('face-input');
const uploadZone = document.getElementById('upload-zone');
const previewWrapper = document.getElementById('face-preview-wrapper');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const btnRemoveFace = document.getElementById('btn-remove-face');
let editorInitialImageData = null;
let editorUnmaskedImageData = null;

// Serialization & LocalStorage helpers
function imageDataToDataURL(imageData) {
  if (!imageData) return null;
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

function saveFaceToLocalStorage() {
  try {
    if (player.faceCanvas) {
      localStorage.setItem('suburban_player_face', previewCanvas.toDataURL());
      if (editorInitialImageData) {
        localStorage.setItem('suburban_player_face_initial', imageDataToDataURL(editorInitialImageData));
      } else {
        localStorage.removeItem('suburban_player_face_initial');
      }
      if (editorUnmaskedImageData) {
        localStorage.setItem('suburban_player_face_unmasked', imageDataToDataURL(editorUnmaskedImageData));
      } else {
        localStorage.removeItem('suburban_player_face_unmasked');
      }
    } else {
      localStorage.removeItem('suburban_player_face');
      localStorage.removeItem('suburban_player_face_initial');
      localStorage.removeItem('suburban_player_face_unmasked');
    }
  } catch (e) {
    console.error('Failed to save face to localStorage:', e);
  }
}

function saveColorsToLocalStorage() {
  try {
    localStorage.setItem('suburban_shirt_color', player.shirtColor);
    localStorage.setItem('suburban_pants_color', player.pantsColor);
    localStorage.setItem('suburban_shoes_color', player.shoesColor);
  } catch (e) {
    console.error('Failed to save outfit colors to localStorage:', e);
  }
}

function loadCustomizations() {
  try {
    // Colors
    const savedShirt = localStorage.getItem('suburban_shirt_color');
    if (savedShirt) {
      player.shirtColor = savedShirt;
      const inputShirt = document.getElementById('color-shirt');
      if (inputShirt) inputShirt.value = savedShirt;
    }
    const savedPants = localStorage.getItem('suburban_pants_color');
    if (savedPants) {
      player.pantsColor = savedPants;
      const inputPants = document.getElementById('color-pants');
      if (inputPants) inputPants.value = savedPants;
    }
    const savedShoes = localStorage.getItem('suburban_shoes_color');
    if (savedShoes) {
      player.shoesColor = savedShoes;
      const inputShoes = document.getElementById('color-shoes');
      if (inputShoes) inputShoes.value = savedShoes;
    }

    // Face Canvas
    const savedFace = localStorage.getItem('suburban_player_face');
    if (savedFace) {
      const img = new Image();
      img.onload = () => {
        previewCtx.clearRect(0, 0, 128, 128);
        previewCtx.drawImage(img, 0, 0);
        player.faceCanvas = previewCanvas;
        
        // Show face preview and hide upload zone
        if (uploadZone) uploadZone.style.display = 'none';
        if (previewWrapper) previewWrapper.style.display = 'flex';
        
        // Load editor states if available
        const savedInitial = localStorage.getItem('suburban_player_face_initial');
        if (savedInitial) {
          const imgInit = new Image();
          imgInit.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 128;
            tempCanvas.height = 128;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(imgInit, 0, 0);
            editorInitialImageData = tempCtx.getImageData(0, 0, 128, 128);
          };
          imgInit.src = savedInitial;
        } else {
          editorInitialImageData = previewCtx.getImageData(0, 0, 128, 128);
        }
        
        const savedUnmasked = localStorage.getItem('suburban_player_face_unmasked');
        if (savedUnmasked) {
          const imgUnmasked = new Image();
          imgUnmasked.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 128;
            tempCanvas.height = 128;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(imgUnmasked, 0, 0);
            editorUnmaskedImageData = tempCtx.getImageData(0, 0, 128, 128);
          };
          imgUnmasked.src = savedUnmasked;
        } else {
          editorUnmaskedImageData = previewCtx.getImageData(0, 0, 128, 128);
        }
      };
      img.src = savedFace;
    }
  } catch (e) {
    console.error('Failed to load customizations from localStorage:', e);
  }
}


// Pixelate source image and apply filters
function processFaceImage(imgSource) {
  // Size is 128x128
  previewCtx.clearRect(0, 0, 128, 128);
  
  // Calculate crop rectangle (center square)
  let srcX = 0, srcY = 0, srcW = imgSource.width, srcH = imgSource.height;
  if (imgSource instanceof HTMLVideoElement) {
    srcW = imgSource.videoWidth;
    srcH = imgSource.videoHeight;
  }
  
  const minDim = Math.min(srcW, srcH);
  srcX = (srcW - minDim) / 2;
  srcY = (srcH - minDim) / 2;

  // Draw scaled face onto 128x128 canvas with circular crop path
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.ellipse(64, 64, 52, 60, 0, 0, Math.PI * 2);
  previewCtx.clip();
  previewCtx.drawImage(imgSource, srcX, srcY, minDim, minDim, 0, 0, 128, 128);
  previewCtx.restore();
  
  // Capture the raw, unmasked photo crop state (erases automatic mask entirely)
  editorUnmaskedImageData = previewCtx.getImageData(0, 0, 128, 128);
  
  // Get image pixels for a clean, high-contrast boost
  const imgData = previewCtx.getImageData(0, 0, 128, 128);
  const data = imgData.data;
  
  // --- BACKGROUND REMOVAL (Radial Sobel Edge Contour Detector) ---
  const width = 128;
  const height = 128;

  // 1. Convert to Grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Compute Sobel Edge Magnitudes
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        -1 * gray[(y - 1) * width + (x - 1)] + 1 * gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)]       + 2 * gray[y * width + (x + 1)] +
        -1 * gray[(y + 1) * width + (x - 1)] + 1 * gray[(y + 1) * width + (x + 1)];
        
      const gy =
        -1 * gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - 1 * gray[(y - 1) * width + (x + 1)] +
         1 * gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + 1 * gray[(y + 1) * width + (x + 1)];
         
      mag[y * width + x] = Math.hypot(gx, gy);
    }
  }

  // 3. Cast 72 radial rays outward from center (64, 64)
  const R = new Float32Array(72);
  const threshold = 35; // Sensitivity of face edge detection
  for (let t = 0; t < 72; t++) {
    const angle = (t * 5) * (Math.PI / 180);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    let detectedRadius = 56; // Default circular cutout radius
    for (let r = 18; r < 64; r++) {
      const px = Math.floor(64 + r * cosA);
      const py = Math.floor(64 + r * sinA);
      
      if (px < 0 || px >= 128 || py < 0 || py >= 128) break;
      
      const edgeVal = mag[py * width + px];
      if (edgeVal > threshold) {
        detectedRadius = r;
        break;
      }
    }
    R[t] = detectedRadius;
  }

  // 4. Smooth the radial boundary to avoid jagged steps
  const smoothedR = new Float32Array(72);
  for (let t = 0; t < 72; t++) {
    const prev = R[(t - 1 + 72) % 72];
    const curr = R[t];
    const next = R[(t + 1) % 72];
    smoothedR[t] = (prev + curr + next) / 3;
  }

  // 5. Clear all pixels outside the smoothed radial edge boundary
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Inner Box Safeguard: NEVER clear any pixels inside the inner 64x64 square (x/y in [32, 96])
      if (x >= 32 && x <= 96 && y >= 32 && y <= 96) {
        continue;
      }
      
      const dx = x - 64;
      const dy = y - 64;
      const dist = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      
      const tIdx = Math.floor(angle / 5) % 72;
      const boundaryR = smoothedR[tIdx];
      
      if (dist > boundaryR + 2.5) {
        data[(y * width + x) * 4 + 3] = 0; // Set alpha to transparent
      }
    }
  }
  // ----------------------------------------------------

  const contrast = 35; // Light contrast boost
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // Skip circular transparent areas

    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      val = factor * (val - 128) + 128;
      val += 10; // Light brightness boost
      data[i + c] = Math.max(0, Math.min(255, val));
    }
  }

  // Draw back to preview canvas
  previewCtx.putImageData(imgData, 0, 0);

  // Save the initial state for face reversion
  editorInitialImageData = previewCtx.getImageData(0, 0, 128, 128);

  // Set as player's face
  player.faceCanvas = previewCanvas;
  
  // Show UI elements
  uploadZone.style.display = 'none';
  previewWrapper.style.display = 'flex';
  
  saveFaceToLocalStorage();
}

// Face Editor Modal & Undo/Revert Controls
const editorOverlay = document.getElementById('face-editor-overlay');
const editorCanvas = document.getElementById('editor-canvas');
const editorCtx = editorCanvas.getContext('2d');
const btnEditorUndo = document.getElementById('btn-editor-undo');
const btnEditorRevertAuto = document.getElementById('btn-editor-revert-auto');
const btnEditorRevertPhoto = document.getElementById('btn-editor-revert-photo');
const btnEditorCancel = document.getElementById('btn-editor-cancel');
const btnEditorDone = document.getElementById('btn-editor-done');

let editorUndoHistory = [];
let isErasingInEditor = false;

// Open Face Editor on clicking preview canvas
previewCanvas.addEventListener('click', () => {
  if (!editorInitialImageData) return; // No image loaded yet
  
  // Copy current preview pixels to editor
  editorCtx.clearRect(0, 0, 128, 128);
  editorCtx.drawImage(previewCanvas, 0, 0);
  
  // Reset undo history
  editorUndoHistory = [];
  
  // Show overlay
  editorOverlay.style.display = 'flex';
});

// Map coordinates relative to 128x128 resolution
function getEditorCoordinates(e) {
  const rect = editorCanvas.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  const x = ((clientX - rect.left) / rect.width) * editorCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * editorCanvas.height;
  return { x, y };
}

function eraseEditorPixels(e) {
  const { x, y } = getEditorCoordinates(e);
  const brushRadius = 5; // Precise brush size for editing
  
  editorCtx.save();
  
  // 1. Draw circular brush spot
  editorCtx.globalCompositeOperation = 'destination-out';
  editorCtx.fillStyle = 'rgba(0,0,0,1)';
  editorCtx.beginPath();
  editorCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
  editorCtx.fill();
  
  // 2. Convexity Sweep: assuming centered face at (64, 64),
  // clear the entire quadrant corner beyond the clicked point.
  const cx = 64;
  const cy = 64;
  let startX = 0, startY = 0, sweepW = 0, sweepH = 0;
  if (x <= cx && y <= cy) {
    // Top-Left: clear above and to the left of the click
    startX = 0;
    startY = 0;
    sweepW = Math.max(0, x);
    sweepH = Math.max(0, y);
  } else if (x > cx && y <= cy) {
    // Top-Right: clear above and to the right of the click
    startX = x;
    startY = 0;
    sweepW = Math.max(0, 128 - x);
    sweepH = Math.max(0, y);
  } else if (x <= cx && y > cy) {
    // Bottom-Left: clear below and to the left of the click
    startX = 0;
    startY = y;
    sweepW = Math.max(0, x);
    sweepH = Math.max(0, 128 - y);
  } else {
    // Bottom-Right: clear below and to the right of the click
    startX = x;
    startY = y;
    sweepW = Math.max(0, 128 - x);
    sweepH = Math.max(0, 128 - y);
  }
  
  // Apply clearRect for the swept corner bounding box
  editorCtx.clearRect(startX, startY, sweepW, sweepH);
  
  editorCtx.restore();
}

// Push current image state to undo history
function pushEditorUndo() {
  if (editorUndoHistory.length >= 15) {
    editorUndoHistory.shift();
  }
  editorUndoHistory.push(editorCtx.getImageData(0, 0, 128, 128));
}

editorCanvas.addEventListener('mousedown', (e) => {
  pushEditorUndo();
  isErasingInEditor = true;
  eraseEditorPixels(e);
});

window.addEventListener('mousemove', (e) => {
  if (isErasingInEditor) {
    eraseEditorPixels(e);
  }
});

window.addEventListener('mouseup', () => {
  isErasingInEditor = false;
});

// Mobile touch controls for editor
editorCanvas.addEventListener('touchstart', (e) => {
  pushEditorUndo();
  isErasingInEditor = true;
  eraseEditorPixels(e);
  e.preventDefault();
}, { passive: false });

editorCanvas.addEventListener('touchmove', (e) => {
  if (isErasingInEditor) {
    eraseEditorPixels(e);
    e.preventDefault();
  }
}, { passive: false });

editorCanvas.addEventListener('touchend', () => {
  isErasingInEditor = false;
});

// Button: Undo last stroke
btnEditorUndo.addEventListener('click', () => {
  if (editorUndoHistory.length > 0) {
    const prevState = editorUndoHistory.pop();
    editorCtx.putImageData(prevState, 0, 0);
  }
});

// Button: Revert to initial automatic clip (Auto Mask)
btnEditorRevertAuto.addEventListener('click', () => {
  if (editorInitialImageData) {
    pushEditorUndo();
    editorCtx.putImageData(editorInitialImageData, 0, 0);
  }
});

// Button: Revert to unmasked raw photo (Raw Photo)
btnEditorRevertPhoto.addEventListener('click', () => {
  if (editorUnmaskedImageData) {
    pushEditorUndo();
    editorCtx.putImageData(editorUnmaskedImageData, 0, 0);
  }
});

// Button: Cancel
btnEditorCancel.addEventListener('click', () => {
  editorOverlay.style.display = 'none';
  isErasingInEditor = false;
});

// Button: Done (save and sync)
btnEditorDone.addEventListener('click', () => {
  // Sync back to preview
  previewCtx.clearRect(0, 0, 128, 128);
  previewCtx.drawImage(editorCanvas, 0, 0);
  
  // Set player face
  player.faceCanvas = previewCanvas;
  
  // Hide overlay
  editorOverlay.style.display = 'none';
  isErasingInEditor = false;
  
  saveFaceToLocalStorage();
});

// Set cursor style to indicate clickability
previewCanvas.style.cursor = 'pointer';

// File Selector Upload
faceInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      processFaceImage(img);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Drag and Drop Upload
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--secondary-glow)';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = 'rgba(168, 85, 247, 0.4)';
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'rgba(168, 85, 247, 0.4)';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processFaceImage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Remove Face option
btnRemoveFace.addEventListener('click', () => {
  player.faceCanvas = null;
  faceInput.value = '';
  uploadZone.style.display = 'flex';
  previewWrapper.style.display = 'none';
  saveFaceToLocalStorage();
});

// ----------------------------------------------------
// WEBCAM CAPTURE INTERFACE
// ----------------------------------------------------
const btnWebcam = document.getElementById('btn-webcam');
const webcamOverlay = document.getElementById('webcam-overlay');
const video = document.getElementById('webcam-video');
const btnCapture = document.getElementById('btn-capture');
const btnCloseWebcam = document.getElementById('btn-close-webcam');
const countdownDiv = document.getElementById('webcam-countdown');

let videoStream = null;

btnWebcam.addEventListener('click', async () => {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 480, height: 480, facingMode: 'user' },
      audio: false
    });
    video.srcObject = videoStream;
    webcamOverlay.style.display = 'flex';
  } catch (err) {
    alert('Webcam access was denied or is not available on this device: ' + err.message);
  }
});

function stopWebcamStream() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  video.srcObject = null;
  webcamOverlay.style.display = 'none';
}

btnCloseWebcam.addEventListener('click', stopWebcamStream);

// Capture face snapshot
btnCapture.addEventListener('click', () => {
  // Start countdown visual
  let counter = 3;
  countdownDiv.innerText = counter;
  countdownDiv.style.display = 'block';
  btnCapture.disabled = true;

  const timer = setInterval(() => {
    counter--;
    if (counter > 0) {
      countdownDiv.innerText = counter;
    } else {
      clearInterval(timer);
      countdownDiv.style.display = 'none';
      
      // Perform camera snapshot flash animation
      const flash = document.createElement('div');
      flash.style.position = 'absolute';
      flash.style.top = '0'; flash.style.left = '0'; flash.style.right = '0'; flash.style.bottom = '0';
      flash.style.background = '#ffffff';
      flash.style.zIndex = '999';
      video.parentElement.appendChild(flash);
      
      setTimeout(() => {
        flash.remove();
        
        // Grab frame from video
        const capCanvas = document.createElement('canvas');
        capCanvas.width = video.videoWidth || 480;
        capCanvas.height = video.videoHeight || 480;
        const capCtx = capCanvas.getContext('2d');
        capCtx.translate(capCanvas.width, 0);
        capCtx.scale(-1, 1); // Flip mirrored webcam feed
        capCtx.drawImage(video, 0, 0, capCanvas.width, capCanvas.height);
        
        // Process snapshot image
        processFaceImage(capCanvas);
        
        btnCapture.disabled = false;
        stopWebcamStream();
      }, 150);
    }
  }, 600);
});

// ----------------------------------------------------
// COLOR PICKERS & OUTFIT CUSTOMIZATION
// ----------------------------------------------------
document.getElementById('color-shirt').addEventListener('input', (e) => {
  player.shirtColor = e.target.value;
  saveColorsToLocalStorage();
});
document.getElementById('color-pants').addEventListener('input', (e) => {
  player.pantsColor = e.target.value;
  saveColorsToLocalStorage();
});
document.getElementById('color-shoes').addEventListener('input', (e) => {
  player.shoesColor = e.target.value;
  saveColorsToLocalStorage();
});

// ----------------------------------------------------
// GAME MODE TOGGLES
// ----------------------------------------------------
function selectGameMode(mode) {
  player.mode = mode;
  const cards = document.querySelectorAll('.mode-card');
  cards.forEach(c => {
    if (c.getAttribute('data-mode') === mode) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  
  if (mode === 'baseball') {
    AudioEffects.playBaseballThrow();
  } else {
    AudioEffects.playBasketballBounce();
  }
}

const modeCards = document.querySelectorAll('.mode-card');
modeCards.forEach(card => {
  card.addEventListener('click', () => {
    const selectedMode = card.getAttribute('data-mode');
    selectGameMode(selectedMode);
  });
});

// Seed Control Panel Event Handlers
const seedInput = document.getElementById('level-seed-input');
const btnApplySeed = document.getElementById('btn-apply-seed');
const btnRandomSeed = document.getElementById('btn-random-seed');

btnApplySeed.addEventListener('click', () => {
  let val = seedInput.value.trim().toUpperCase().slice(0, 5);
  if (val.length > 0) {
    currentSeed = val;
  } else {
    currentSeed = "HOUSE";
  }
  resetGame();
});

btnRandomSeed.addEventListener('click', () => {
  currentSeed = "RANDOM";
  resetGame();
});

// Allow pressing Enter in seed input
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnApplySeed.click();
  }
});

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
// Load customization states from localStorage
loadCustomizations();

// Setup initial canvas dimensions & HUD
buildLevel();
spawnEnemies();
updateHUD();

// Animation Frame ticker
function tick() {
  if (currentState === GAME_STATE.PLAYING) {
    update();
  } else if (currentState === GAME_STATE.SECRET_ROOM) {
    updateSecretRoom();
  } else if (currentState === GAME_STATE.SECRET_MINIGAME_ROOM) {
    updateSecretMinigameRoom();
  } else {
    // Keep time ticking for UI animations on start screen
    time++;
  }
  
  if (currentState === GAME_STATE.SECRET_ROOM) {
    drawSecretRoom();
  } else if (currentState === GAME_STATE.SECRET_MINIGAME_ROOM) {
    drawSecretMinigameRoom();
  } else {
    draw();
  }
  requestAnimationFrame(tick);
}

// Kickstart
tick();

// ----------------------------------------------------
// TOUCH CONTROLS OVERLAY SETUP
// ----------------------------------------------------
(function initTouchControls() {
  const touchControls = document.getElementById('touch-controls-overlay');
  const toggleTouchCheckbox = document.getElementById('toggle-touch-controls');

  if (!touchControls || !toggleTouchCheckbox) return;

  const joystickBase = document.getElementById('joystick-base');
  const joystickKnob = document.getElementById('joystick-knob');
  const btnTouchJump = document.getElementById('btn-touch-jump');
  const btnTouchAction = document.getElementById('btn-touch-action');

  // Virtual key states to prevent duplicate events
  const activeVirtualKeys = {};

  function simulateKeyDown(keyStr) {
    if (activeVirtualKeys[keyStr]) return;
    activeVirtualKeys[keyStr] = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: keyStr }));
  }

  function simulateKeyUp(keyStr) {
    if (!activeVirtualKeys[keyStr]) return;
    activeVirtualKeys[keyStr] = false;
    window.dispatchEvent(new KeyboardEvent('keyup', { key: keyStr }));
  }

  // Detect touch capability on load
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  toggleTouchCheckbox.checked = isTouchDevice;
  if (isTouchDevice) {
    touchControls.style.display = 'flex';
  }

  toggleTouchCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      touchControls.style.display = 'flex';
    } else {
      touchControls.style.display = 'none';
      // Release all virtual keys
      for (const key in activeVirtualKeys) {
        if (activeVirtualKeys[key]) {
          simulateKeyUp(key);
        }
      }
    }
  });

  // Joystick state variables
  let joystickTouchId = null;
  let joystickCenter = { x: 0, y: 0 };
  const maxDragRadius = 40; // in pixels
  const joystickThreshold = 12; // deadzone threshold

  function handleJoystickStart(e) {
    e.preventDefault();
    if (joystickTouchId !== null) return; // Only track one touch for joystick

    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;

    // Calculate center of base in viewport coordinates
    const rect = joystickBase.getBoundingClientRect();
    joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    handleJoystickMove(e);
  }

  function handleJoystickMove(e) {
    if (joystickTouchId === null) return;

    let targetTouch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchId) {
        targetTouch = e.touches[i];
        break;
      }
    }

    if (!targetTouch) return;
    e.preventDefault();

    // Displacement
    let dx = targetTouch.clientX - joystickCenter.x;
    let dy = targetTouch.clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    // Clamp
    if (dist > maxDragRadius) {
      dx = (dx / dist) * maxDragRadius;
      dy = (dy / dist) * maxDragRadius;
    }

    // Move knob visually
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Map to virtual keys: Left/Right
    if (dx < -joystickThreshold) {
      simulateKeyDown('a');
      simulateKeyUp('d');
    } else if (dx > joystickThreshold) {
      simulateKeyDown('d');
      simulateKeyUp('a');
    } else {
      simulateKeyUp('a');
      simulateKeyUp('d');
    }

    // Map to virtual keys: Up/Down (only when charging or down for crouching)
    const isCharging = (typeof player !== 'undefined') && player.isCharging;
    if (dy < -joystickThreshold) {
      if (isCharging) {
        simulateKeyDown('w');
      } else {
        simulateKeyUp('w');
      }
      simulateKeyUp('s');
    } else if (dy > joystickThreshold) {
      simulateKeyDown('s');
      simulateKeyUp('w');
    } else {
      simulateKeyUp('w');
      simulateKeyUp('s');
    }
  }

  function handleJoystickEnd(e) {
    if (joystickTouchId === null) return;

    let ended = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        ended = true;
        break;
      }
    }

    if (!ended) return;
    e.preventDefault();

    // Reset knob position and touch ID
    joystickKnob.style.transform = 'translate(0px, 0px)';
    joystickTouchId = null;

    // Release movement/aim keys
    simulateKeyUp('a');
    simulateKeyUp('d');
    simulateKeyUp('w');
    simulateKeyUp('s');
  }

  // Bind joystick touch events
  joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
  window.addEventListener('touchmove', handleJoystickMove, { passive: false });
  window.addEventListener('touchend', handleJoystickEnd, { passive: false });
  window.addEventListener('touchcancel', handleJoystickEnd, { passive: false });

  // Buttons Touch Handlers
  btnTouchJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    simulateKeyDown(' '); // Space simulates Jump
  }, { passive: false });

  btnTouchJump.addEventListener('touchend', (e) => {
    e.preventDefault();
    simulateKeyUp(' ');
  }, { passive: false });

  btnTouchJump.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    simulateKeyUp(' ');
  }, { passive: false });

  btnTouchAction.addEventListener('touchstart', (e) => {
    e.preventDefault();
    simulateKeyDown('k'); // 'k' simulates Throw/Swing Action
  }, { passive: false });

  btnTouchAction.addEventListener('touchend', (e) => {
    e.preventDefault();
    simulateKeyUp('k');
  }, { passive: false });

  btnTouchAction.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    simulateKeyUp('k');
  }, { passive: false });

  // Safety cleanup: release all keys if no touches are active
  window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      joystickTouchId = null;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      for (const key in activeVirtualKeys) {
        if (activeVirtualKeys[key]) {
          simulateKeyUp(key);
        }
      }
    }
  });
})();

// ----------------------------------------------------
// FULLSCREEN MODE HANDLER
// ----------------------------------------------------
(function initFullscreenControls() {
  const crtMonitor = document.querySelector('.crt-monitor');
  const btnSidebarFullscreen = document.getElementById('btn-sidebar-fullscreen');
  const btnMonitorFullscreen = document.getElementById('btn-monitor-fullscreen');

  if (!crtMonitor) return;

  function toggleFullscreen() {
    const isCurrentlyFullscreen = document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  crtMonitor.classList.contains('css-fullscreen');
                                  
    if (!isCurrentlyFullscreen) {
      // Enter fullscreen
      if (crtMonitor.requestFullscreen) {
        crtMonitor.requestFullscreen().catch(err => {
          enterCSSFullscreen();
        });
      } else if (crtMonitor.webkitRequestFullscreen) {
        crtMonitor.webkitRequestFullscreen();
      } else {
        enterCSSFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          exitCSSFullscreen();
        });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else {
        exitCSSFullscreen();
      }
    }
  }

  function enterCSSFullscreen() {
    crtMonitor.classList.add('css-fullscreen');
    updateFullscreenUI(true);
  }

  function exitCSSFullscreen() {
    crtMonitor.classList.remove('css-fullscreen');
    updateFullscreenUI(false);
  }

  function updateFullscreenUI(isFullscreen) {
    const text = isFullscreen ? '📺 Exit Fullscreen' : '📺 Enter Fullscreen';
    if (btnSidebarFullscreen) btnSidebarFullscreen.innerText = text;
    
    if (btnMonitorFullscreen) {
      btnMonitorFullscreen.innerText = isFullscreen ? '✕' : '⛶';
      btnMonitorFullscreen.title = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
  }

  // Bind events
  if (btnSidebarFullscreen) btnSidebarFullscreen.addEventListener('click', toggleFullscreen);
  if (btnMonitorFullscreen) btnMonitorFullscreen.addEventListener('click', toggleFullscreen);

  // Listen to native fullscreen changes to keep UI in sync
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  function handleFullscreenChange() {
    const isNativeFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    updateFullscreenUI(isNativeFS);
  }
})();
