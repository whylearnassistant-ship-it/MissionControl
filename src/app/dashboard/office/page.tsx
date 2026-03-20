"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Building2, RefreshCw, Cpu } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface AgentStatus {
  id: string;
  name: string;
  type: "main" | "coder" | "subagent";
  status: "working" | "idle";
}

interface Character {
  agent: AgentStatus;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  deskX: number;
  deskY: number;
  frame: number;
  speechBubble: number; // countdown for speech bubble
  bobOffset: number;
}

// ─── Constants ───────────────────────────────────────────────────
const CANVAS_W = 960;
const CANVAS_H = 540;
const CHAR_W = 16;
const CHAR_H = 24;
const DESK_W = 32;
const DESK_H = 20;
const WALK_SPEED = 0.8;
const COOLER_X = 820;
const COOLER_Y = 320;
const FLOOR_Y = 200; // where floor starts

// ─── Color Palette ───────────────────────────────────────────────
const PAL = {
  wall: "#4a5568",
  wallLight: "#5a6578",
  wallDark: "#3a4558",
  floor: "#c4a882",
  floorDark: "#b49872",
  floorLine: "#b89a78",
  desk: "#8B6914",
  deskTop: "#A67C28",
  deskLeg: "#6B5010",
  monitor: "#1a1a2e",
  monitorScreen: "#16213e",
  monitorGlow: "#0f3460",
  screenText: "#53cf53",
  chair: "#333333",
  chairSeat: "#444444",
  coolerBody: "#d4e5f7",
  coolerWater: "#4d94ff",
  coolerBase: "#bbb",
  plant: "#2d6b3f",
  plantPot: "#a0522d",
  plantLight: "#3d8b4f",
  windowFrame: "#6B5010",
  windowGlass: "#1a2a4a",
  windowSky: "#0d1b3d",
  star: "#ffffff",
  clock: "#f5f5f5",
  clockHands: "#333",
  mug: "#e8e8e8",
  mugCoffee: "#5c3317",
  paper: "#f0ead6",
  blue: "#4488ff",
  blueDark: "#2266cc",
  blueLight: "#66aaff",
  purple: "#9944ff",
  purpleDark: "#7722dd",
  purpleLight: "#bb66ff",
  green: "#44cc66",
  greenDark: "#22aa44",
  greenLight: "#66ee88",
  skin: "#ffcc99",
  skinDark: "#eebb88",
  hair: "#553322",
  label: "#e0e0e0",
  labelBg: "rgba(0,0,0,0.5)",
  speechBg: "#ffffff",
  speechText: "#333333",
};

// ─── Drawing Helpers ─────────────────────────────────────────────
function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

// ─── Scene Drawing ───────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  // Wall
  drawRect(ctx, 0, 0, CANVAS_W, FLOOR_Y, PAL.wall);
  // Wall texture - subtle horizontal lines
  for (let y = 10; y < FLOOR_Y; y += 20) {
    drawRect(ctx, 0, y, CANVAS_W, 1, PAL.wallLight);
  }
  // Baseboard
  drawRect(ctx, 0, FLOOR_Y - 6, CANVAS_W, 6, PAL.deskLeg);

  // Floor
  drawRect(ctx, 0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y, PAL.floor);
  // Floor tile pattern
  for (let y = FLOOR_Y; y < CANVAS_H; y += 32) {
    drawRect(ctx, 0, y, CANVAS_W, 1, PAL.floorLine);
  }
  for (let x = 0; x < CANVAS_W; x += 48) {
    drawRect(ctx, x, FLOOR_Y, 1, CANVAS_H - FLOOR_Y, PAL.floorLine);
  }
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 60;
  const h = 70;
  // Frame
  drawRect(ctx, x, y, w, h, PAL.windowFrame);
  // Glass
  drawRect(ctx, x + 3, y + 3, w - 6, h - 6, PAL.windowGlass);
  // Night sky
  drawRect(ctx, x + 4, y + 4, w - 8, h - 8, PAL.windowSky);
  // Stars
  const starPositions = [
    [12, 10],
    [30, 18],
    [45, 8],
    [20, 35],
    [40, 28],
    [15, 50],
    [35, 45],
  ];
  for (const [sx, sy] of starPositions) {
    drawPixel(ctx, x + 4 + sx, y + 4 + sy, PAL.star);
  }
  // Cross frame
  drawRect(ctx, x + w / 2 - 1, y + 3, 2, h - 6, PAL.windowFrame);
  drawRect(ctx, x + 3, y + h / 2 - 1, w - 6, 2, PAL.windowFrame);
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const r = 14;
  // Clock face
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = PAL.clock;
  ctx.fill();
  ctx.strokeStyle = PAL.deskLeg;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const ix = x + Math.cos(angle) * (r - 3);
    const iy = y + Math.sin(angle) * (r - 3);
    drawPixel(ctx, ix, iy, PAL.clockHands);
  }

  // Hands
  const sec = (time / 1000) % 60;
  const min = ((time / 60000) % 60) + sec / 60;
  const hr = ((time / 3600000) % 12) + min / 60;

  // Hour hand
  const ha = (hr / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ha) * (r - 6), y + Math.sin(ha) * (r - 6));
  ctx.strokeStyle = PAL.clockHands;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Minute hand
  const ma = (min / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ma) * (r - 3), y + Math.sin(ma) * (r - 3));
  ctx.strokeStyle = PAL.clockHands;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Pot
  drawRect(ctx, x, y + 10, 14, 12, PAL.plantPot);
  drawRect(ctx, x - 1, y + 9, 16, 3, PAL.plantPot);
  // Leaves
  drawRect(ctx, x + 4, y - 4, 6, 14, PAL.plant);
  drawRect(ctx, x + 1, y, 4, 8, PAL.plant);
  drawRect(ctx, x + 9, y + 2, 4, 6, PAL.plant);
  drawRect(ctx, x + 5, y - 6, 4, 4, PAL.plantLight);
  drawRect(ctx, x - 1, y - 2, 3, 5, PAL.plantLight);
  drawRect(ctx, x + 12, y + 1, 3, 4, PAL.plantLight);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Desktop surface
  drawRect(ctx, x, y, DESK_W, 3, PAL.deskTop);
  // Desk body
  drawRect(ctx, x + 1, y + 3, DESK_W - 2, DESK_H - 3, PAL.desk);
  // Legs
  drawRect(ctx, x + 2, y + DESK_H, 2, 8, PAL.deskLeg);
  drawRect(ctx, x + DESK_W - 4, y + DESK_H, 2, 8, PAL.deskLeg);
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean) {
  // Monitor body
  drawRect(ctx, x, y - 16, 18, 14, PAL.monitor);
  // Screen
  drawRect(ctx, x + 1, y - 15, 16, 12, active ? PAL.monitorGlow : PAL.monitorScreen);

  if (active) {
    // Screen text lines
    for (let i = 0; i < 4; i++) {
      const lineW = 4 + ((i * 7 + 3) % 8);
      drawRect(ctx, x + 3, y - 13 + i * 3, lineW, 1, PAL.screenText);
    }
  }

  // Stand
  drawRect(ctx, x + 7, y - 2, 4, 3, PAL.monitor);
  drawRect(ctx, x + 5, y + 1, 8, 1, PAL.monitor);
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Seat
  drawRect(ctx, x, y, 12, 4, PAL.chairSeat);
  // Back
  drawRect(ctx, x + 1, y - 10, 10, 10, PAL.chair);
  // Legs
  drawRect(ctx, x + 2, y + 4, 2, 6, PAL.chair);
  drawRect(ctx, x + 8, y + 4, 2, 6, PAL.chair);
}

function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x, y, 4, 5, PAL.mug);
  drawRect(ctx, x + 4, y + 1, 2, 3, PAL.mug);
  drawRect(ctx, x + 1, y + 1, 2, 2, PAL.mugCoffee);
}

function drawPaper(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x, y, 6, 8, PAL.paper);
  drawRect(ctx, x + 1, y + 1, 3, 1, "#ccc");
  drawRect(ctx, x + 1, y + 3, 4, 1, "#ccc");
  drawRect(ctx, x + 1, y + 5, 2, 1, "#ccc");
}

function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Base/stand
  drawRect(ctx, x + 2, y + 20, 12, 16, PAL.coolerBase);
  drawRect(ctx, x, y + 36, 16, 2, PAL.coolerBase);
  // Body
  drawRect(ctx, x + 1, y + 4, 14, 16, PAL.coolerBody);
  // Water jug on top
  drawRect(ctx, x + 3, y - 6, 10, 10, PAL.coolerWater);
  drawRect(ctx, x + 5, y - 8, 6, 3, PAL.coolerWater);
  // Spigot
  drawRect(ctx, x + 7, y + 16, 2, 4, "#888");
  // Highlight
  drawRect(ctx, x + 4, y - 4, 2, 6, "#77bbff");
}

// ─── Character Drawing ──────────────────────────────────────────
function getColors(type: "main" | "coder" | "subagent") {
  switch (type) {
    case "main":
      return { body: PAL.blue, bodyDark: PAL.blueDark, bodyLight: PAL.blueLight };
    case "coder":
      return { body: PAL.purple, bodyDark: PAL.purpleDark, bodyLight: PAL.purpleLight };
    case "subagent":
      return { body: PAL.green, bodyDark: PAL.greenDark, bodyLight: PAL.greenLight };
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  time: number,
  isTyping: boolean
) {
  const colors = getColors(char.agent.type);
  const x = Math.round(char.x);
  const y = Math.round(char.y) + Math.round(char.bobOffset);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + CHAR_W / 2, y + CHAR_H + 1, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const walkFrame = Math.abs(char.x - char.targetX) > 2;
  if (walkFrame) {
    const step = Math.sin(time / 80) * 2;
    drawRect(ctx, x + 4, y + 18, 3, 6, colors.bodyDark);
    drawRect(ctx, x + 9, y + 18, 3, 6, colors.bodyDark);
    // Animate legs
    drawRect(ctx, x + 4, y + 22 + step, 3, 2, "#222");
    drawRect(ctx, x + 9, y + 22 - step, 3, 2, "#222");
  } else {
    drawRect(ctx, x + 4, y + 18, 3, 6, colors.bodyDark);
    drawRect(ctx, x + 9, y + 18, 3, 6, colors.bodyDark);
    drawRect(ctx, x + 4, y + 22, 3, 2, "#222");
    drawRect(ctx, x + 9, y + 22, 3, 2, "#222");
  }

  // Body (shirt)
  drawRect(ctx, x + 3, y + 10, 10, 8, colors.body);
  drawRect(ctx, x + 4, y + 11, 8, 6, colors.bodyLight);

  // Arms
  if (isTyping) {
    const armAnim = Math.sin(time / 100) > 0 ? 1 : 0;
    // Left arm typing
    drawRect(ctx, x + 1, y + 11, 3, 5, colors.body);
    drawRect(ctx, x + 0 + armAnim, y + 15, 3, 2, PAL.skin);
    // Right arm typing
    drawRect(ctx, x + 12, y + 11, 3, 5, colors.body);
    drawRect(ctx, x + 13 - armAnim, y + 15, 3, 2, PAL.skin);
  } else {
    // Arms at sides
    drawRect(ctx, x + 1, y + 11, 3, 6, colors.body);
    drawRect(ctx, x + 1, y + 16, 3, 2, PAL.skin);
    drawRect(ctx, x + 12, y + 11, 3, 6, colors.body);
    drawRect(ctx, x + 12, y + 16, 3, 2, PAL.skin);
  }

  // Head
  drawRect(ctx, x + 4, y + 2, 8, 8, PAL.skin);
  // Hair
  drawRect(ctx, x + 4, y + 1, 8, 3, colors.bodyDark);
  drawRect(ctx, x + 3, y + 2, 1, 3, colors.bodyDark);
  drawRect(ctx, x + 12, y + 2, 1, 3, colors.bodyDark);

  // Eyes
  const blink = Math.sin(time / 2000) > 0.95;
  if (!blink) {
    drawPixel(ctx, x + 6, y + 5, "#222");
    drawPixel(ctx, x + 10, y + 5, "#222");
  } else {
    drawRect(ctx, x + 6, y + 5, 1, 1, PAL.skinDark);
    drawRect(ctx, x + 10, y + 5, 1, 1, PAL.skinDark);
  }

  // Mouth - small smile
  drawPixel(ctx, x + 7, y + 7, PAL.skinDark);
  drawPixel(ctx, x + 8, y + 8, PAL.skinDark);
  drawPixel(ctx, x + 9, y + 7, PAL.skinDark);

  // Name label
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  const labelWidth = ctx.measureText(char.agent.name).width + 6;
  drawRect(
    ctx,
    x + CHAR_W / 2 - labelWidth / 2,
    y + CHAR_H + 3,
    labelWidth,
    12,
    PAL.labelBg
  );
  ctx.fillStyle = PAL.label;
  ctx.fillText(char.agent.name, x + CHAR_W / 2, y + CHAR_H + 12);

  // Speech bubble when at cooler and talking
  if (!isTyping && char.speechBubble > 0) {
    const bubbleX = x + CHAR_W / 2;
    const bubbleY = y - 10;
    ctx.fillStyle = PAL.speechBg;
    // Bubble
    ctx.beginPath();
    ctx.roundRect(bubbleX - 12, bubbleY - 10, 24, 12, 3);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 2, bubbleY + 2);
    ctx.lineTo(bubbleX + 2, bubbleY + 2);
    ctx.lineTo(bubbleX, bubbleY + 5);
    ctx.fill();
    // Dots
    ctx.fillStyle = PAL.speechText;
    const dotPhase = Math.floor(time / 300) % 4;
    for (let i = 0; i < 3; i++) {
      if (i <= dotPhase) {
        ctx.beginPath();
        ctx.arc(bubbleX - 6 + i * 6, bubbleY - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ─── Scanline Effect ─────────────────────────────────────────────
function drawScanlines(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let y = 0; y < CANVAS_H; y += 2) {
    ctx.fillRect(0, y, CANVAS_W, 1);
  }
}

// ─── Desk positions ──────────────────────────────────────────────
function getDeskPositions(count: number): { deskX: number; deskY: number; charX: number; charY: number }[] {
  const positions: { deskX: number; deskY: number; charX: number; charY: number }[] = [];
  const startX = 60;
  const spacing = 160;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const dx = startX + col * spacing;
    const dy = FLOOR_Y + 40 + row * 100;
    positions.push({
      deskX: dx,
      deskY: dy,
      charX: dx + DESK_W / 2 - CHAR_W / 2 + 16, // In front of desk
      charY: dy + 4,
    });
  }
  return positions;
}

// ─── Main Component ─────────────────────────────────────────────
export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const charactersRef = useRef<Character[]>([]);
  const animFrameRef = useRef<number>(0);

  const fetchAgents = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/office");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      // keep existing
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Fetch on mount + interval
  useEffect(() => {
    fetchAgents();
    const iv = setInterval(() => fetchAgents(), 10000);
    return () => clearInterval(iv);
  }, [fetchAgents]);

  // Update characters when agents change
  useEffect(() => {
    const deskPos = getDeskPositions(agents.length);
    const existing = charactersRef.current;

    charactersRef.current = agents.map((agent, i) => {
      const prev = existing.find((c) => c.agent.id === agent.id);
      const dp = deskPos[i] || deskPos[0] || { deskX: 100, deskY: FLOOR_Y + 40, charX: 130, charY: FLOOR_Y + 44 };

      const isWorking = agent.status === "working";
      const targetX = isWorking ? dp.charX : COOLER_X + 10 + i * 22;
      const targetY = isWorking ? dp.charY : COOLER_Y;

      if (prev) {
        return {
          ...prev,
          agent,
          deskX: dp.deskX,
          deskY: dp.deskY,
          targetX,
          targetY,
          // Keep current position for smooth walking
        };
      }

      return {
        agent,
        x: isWorking ? dp.charX : COOLER_X + 10 + i * 22,
        y: isWorking ? dp.charY : COOLER_Y,
        targetX,
        targetY,
        deskX: dp.deskX,
        deskY: dp.deskY,
        frame: 0,
        speechBubble: 0,
        bobOffset: 0,
      };
    });
  }, [agents]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    let lastSpeechUpdate = 0;

    function render(time: number) {
      if (!ctx) return;

      // Update character positions
      for (const char of charactersRef.current) {
        // Smooth walking
        const dx = char.targetX - char.x;
        const dy = char.targetY - char.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
          char.x += (dx / dist) * WALK_SPEED;
          char.y += (dy / dist) * WALK_SPEED;
        } else {
          char.x = char.targetX;
          char.y = char.targetY;
        }

        // Bob animation
        char.bobOffset = Math.sin(time / 500 + char.x) * 0.8;

        // Speech bubbles for idle agents
        if (char.agent.status === "idle") {
          if (time - lastSpeechUpdate > 2000) {
            char.speechBubble = Math.random() > 0.5 ? 120 : 0;
          }
          if (char.speechBubble > 0) char.speechBubble--;
        } else {
          char.speechBubble = 0;
        }
      }

      if (time - lastSpeechUpdate > 2000) lastSpeechUpdate = time;

      // Clear
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      drawBackground(ctx);

      // Window
      drawWindow(ctx, 400, 40);

      // Clock
      drawClock(ctx, 530, 80, time);

      // Plant
      drawPlant(ctx, 20, FLOOR_Y - 30);
      drawPlant(ctx, 750, FLOOR_Y - 26);

      // Water cooler
      drawWaterCooler(ctx, COOLER_X, COOLER_Y - 38);

      // "WATER COOLER" label
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText("☕ break room", COOLER_X + 8, COOLER_Y + 6);

      // Desks, monitors, chairs, mugs, papers
      const deskPos = getDeskPositions(agents.length);
      for (let i = 0; i < agents.length; i++) {
        const dp = deskPos[i];
        if (!dp) continue;

        drawDesk(ctx, dp.deskX, dp.deskY);

        const agentWorking = agents[i].status === "working";
        drawMonitor(ctx, dp.deskX + 7, dp.deskY, agentWorking);
        drawChair(ctx, dp.deskX + DESK_W / 2 + 10, dp.deskY + 4);

        // Mug on desk
        drawMug(ctx, dp.deskX + 26, dp.deskY - 4);

        // Paper on some desks
        if (i % 2 === 0) {
          drawPaper(ctx, dp.deskX + 2, dp.deskY - 6);
        }
      }

      // Characters (sorted by y for depth)
      const sorted = [...charactersRef.current].sort((a, b) => a.y - b.y);
      for (const char of sorted) {
        const isTyping =
          char.agent.status === "working" &&
          Math.abs(char.x - char.targetX) < 2;
        drawCharacter(ctx, char, time, isTyping);
      }

      // Scanlines
      drawScanlines(ctx);

      // Vignette
      const grad = ctx.createRadialGradient(
        CANVAS_W / 2,
        CANVAS_H / 2,
        CANVAS_W * 0.3,
        CANVAS_W / 2,
        CANVAS_H / 2,
        CANVAS_W * 0.7
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [agents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex items-center gap-2 text-text-secondary">
          <Cpu className="w-4 h-4 animate-spin" />
          Loading office...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Office</h1>
          <p className="text-sm text-text-secondary mt-1">
            Watch your agents work in real-time
          </p>
        </div>
        <button
          onClick={() => fetchAgents(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-hover transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Canvas Container */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full max-w-[960px] rounded-lg border border-border/50"
            style={{
              imageRendering: "pixelated",
              aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
            }}
          />
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-4">
          Agent Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => {
            const colors = {
              main: { dot: "bg-blue-400", ring: "shadow-blue-400/50", badge: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
              coder: { dot: "bg-purple-400", ring: "shadow-purple-400/50", badge: "bg-purple-400/10 text-purple-400 border-purple-400/20" },
              subagent: { dot: "bg-green-400", ring: "shadow-green-400/50", badge: "bg-green-400/10 text-green-400 border-green-400/20" },
            }[agent.type];

            return (
              <div
                key={agent.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-secondary border border-border"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${
                      agent.status === "working"
                        ? `shadow-[0_0_6px] ${colors.ring} animate-pulse`
                        : "opacity-50"
                    }`}
                  />
                  <span className="text-sm font-medium text-text-primary">
                    {agent.name}
                  </span>
                </div>
                <span
                  className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}
                >
                  {agent.type}
                </span>
                <span className="text-xs text-text-tertiary">
                  {agent.status === "working" ? "⌨️ Working" : "☕ Break"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-400" />
          Main Agent
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-purple-400" />
          Coder
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-400" />
          Subagent
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          Auto-refreshes every 10s
        </div>
      </div>
    </div>
  );
}
