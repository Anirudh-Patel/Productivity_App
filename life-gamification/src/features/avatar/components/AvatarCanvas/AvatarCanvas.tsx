import React, { useEffect, useRef } from 'react';
import { useAvatarStore } from '../../../../store/slices/avatarSlice';
import '../../styles/avatar.css';

const RARITY_COLORS = {
  common: { primary: '#808080', glow: null },
  uncommon: { primary: '#1EFF00', glow: null },
  rare: { primary: '#0070DD', glow: 'rgba(0, 112, 221, 0.3)' },
  epic: { primary: '#A335EE', glow: 'rgba(163, 53, 238, 0.4)' },
  legendary: { primary: '#FF8000', glow: 'rgba(255, 128, 0, 0.5)' },
};

export const AvatarCanvas: React.FC<{
  width?: number;
  height?: number;
  zoom?: number;
}> = ({ width = 128, height = 128, zoom = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const { equipped, config, currentAnimation = 'idle', animationFrame = 0, nextFrame } = useAvatarStore();

  // Color-coded placeholder colors for easy identification
  const PLACEHOLDER_COLORS = {
    head: '#FF6B6B',      // Red - Helmet/Hat
    chest: '#9B59B6',     // Purple - Armor/Shirt  
    legs: '#3498DB',      // Bright Blue - Pants/Leggings
    weapon: '#2ECC71',    // Bright Green - Sword/Staff
    accessory: '#F39C12', // Orange - Pendant/Ring
    background: '#E74C3C', // Dark Red - Background Scene
  };

  // Draw placeholder background
  const drawPlaceholderBackground = (
    ctx: CanvasRenderingContext2D,
    background: any,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (!background) return;

    const backgroundType = background.spriteData?.backgroundType || 'solid';
    
    switch (backgroundType) {
      case 'gradient':
        const colors = background.spriteData?.backgroundData?.colors || [PLACEHOLDER_COLORS.background, '#3498DB'];
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1] || colors[0]);
        ctx.fillStyle = gradient;
        break;
      case 'solid':
      default:
        ctx.fillStyle = PLACEHOLDER_COLORS.background;
        break;
    }

    // Fill the entire background
    ctx.fillRect(x, y, width, height);
  };

  // Draw placeholder shapes for equipment
  const drawPlaceholderItem = (
    ctx: CanvasRenderingContext2D,
    slot: string,
    equipment: any,
    x: number,
    y: number,
    size: number
  ) => {
    if (!equipment) return;

    const rarityColor = RARITY_COLORS[equipment.rarity as keyof typeof RARITY_COLORS];
    
    // Draw glow effect for rare+ items
    if (rarityColor.glow) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = rarityColor.glow;
    }

    // Use color-coded placeholder colors instead of equipment sprite data
    ctx.fillStyle = PLACEHOLDER_COLORS[slot as keyof typeof PLACEHOLDER_COLORS] || rarityColor.primary;

    switch (slot) {
      case 'head':
        // Draw circle for head items
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/4, size/4, 0, Math.PI * 2);
        ctx.fill();
        break;
      
      case 'chest':
        // Draw rectangle for chest
        ctx.fillRect(x + size/4, y + size/3, size/2, size/3);
        break;
      
      case 'weapon':
        // Draw elongated rectangle for weapon
        ctx.save();
        ctx.translate(x + size * 0.8, y + size/2);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-size/8, -size/2, size/4, size);
        ctx.restore();
        break;
      
      case 'legs':
        // Draw two rectangles for legs
        ctx.fillRect(x + size/3 - 5, y + size * 0.6, size/6, size/3);
        ctx.fillRect(x + size/2 + 5, y + size * 0.6, size/6, size/3);
        break;
        
      case 'accessory':
        // Draw small circle for accessory (like a pendant)
        ctx.beginPath();
        ctx.arc(x + size/2, y + size * 0.45, size/12, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.shadowBlur = 0;
  };

  // Draw base character
  const drawCharacterBase = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    // Body
    ctx.fillStyle = config.skinColor;
    ctx.fillRect(x + size/3, y + size/3, size/3, size/3);
    
    // Head
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/4, size/5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = config.eyeColor;
    ctx.fillRect(x + size/2 - 10, y + size/4 - 5, 5, 5);
    ctx.fillRect(x + size/2 + 5, y + size/4 - 5, 5, 5);
    
    // Hair (if no head equipment or head equipment doesn't cover hair)
    ctx.fillStyle = config.hairColor;
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/4 - 8, size/6, 0, Math.PI);
    ctx.fill();
    
    // Arms
    ctx.fillStyle = config.skinColor;
    // Left arm (non-weapon arm)
    ctx.fillRect(x + size/4 - 8, y + size/3 + 8, size/8, size/4);
    // Right arm (weapon arm)
    ctx.fillRect(x + size * 0.75, y + size/3 + 8, size/8, size/4);
    
    // Legs (if no leg equipment)
    if (!equipped.legs) {
      ctx.fillStyle = '#4169E1'; // Default pants color
      ctx.fillRect(x + size/3, y + size * 0.6, size/6, size/3);
      ctx.fillRect(x + size/2, y + size * 0.6, size/6, size/3);
    }
  };

  // Main render loop
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Enable pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;
    
    // Draw background first (behind everything) to fill the entire blue box area
    if (equipped.background) {
      drawPlaceholderBackground(ctx, equipped.background, 0, 0, width, height);
    }
    
    // Apply zoom for character rendering
    ctx.save();
    ctx.scale(zoom, zoom);
    
    const centerX = (width / zoom - 64) / 2;
    const centerY = (height / zoom - 64) / 2;
    
    // Add animation offset based on current animation
    let animationOffset = { x: 0, y: 0 };
    if (currentAnimation === 'walk') {
      animationOffset.y = Math.sin(animationFrame * Math.PI / 2) * 2;
    }
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX + 32, centerY + 60, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Apply animation offset
    ctx.translate(animationOffset.x, animationOffset.y);
    
    // Draw character base
    drawCharacterBase(ctx, centerX, centerY, 64);
    
    // Draw equipment layers in order
    if (equipped.legs) {
      drawPlaceholderItem(ctx, 'legs', equipped.legs, centerX, centerY, 64);
    }
    if (equipped.chest) {
      drawPlaceholderItem(ctx, 'chest', equipped.chest, centerX, centerY, 64);
    }
    if (equipped.head) {
      drawPlaceholderItem(ctx, 'head', equipped.head, centerX, centerY, 64);
    }
    if (equipped.accessory) {
      drawPlaceholderItem(ctx, 'accessory', equipped.accessory, centerX, centerY, 64);
    }
    if (equipped.weapon) {
      drawPlaceholderItem(ctx, 'weapon', equipped.weapon, centerX, centerY, 64);
    }
    
    ctx.restore();
  };

  // Initial render
  useEffect(() => {
    render();
  }, [equipped, config]);

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const fps = config.animationSpeed;
    const frameInterval = 1000 / fps;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= frameInterval) {
        nextFrame();
        render();
        lastTime = currentTime;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [equipped, config, currentAnimation, animationFrame, nextFrame, zoom, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixelated"
      style={{
        imageRendering: 'pixelated',
        width: width * zoom,
        height: height * zoom,
      }}
    />
  );
};