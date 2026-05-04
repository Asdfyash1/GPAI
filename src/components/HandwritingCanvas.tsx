"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Send, X } from "lucide-react";

type HandwritingCanvasProps = {
  onSubmit: (dataUrl: string) => void;
  onClose: () => void;
};

export function HandwritingCanvas({ onSubmit, onClose }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  };

  const stopDraw = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setHasStrokes(false);
  }, []);

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(dataUrl);
  };

  return (
    <div className="handwriting-overlay">
      <div className="handwriting-dialog">
        <div className="handwriting-header">
          <span className="handwriting-title">Handwriting Input</span>
          <div className="handwriting-actions">
            <button type="button" className="icon-button" onClick={clearCanvas} title="Clear" aria-label="Clear canvas">
              <Eraser size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={handleSubmit}
              disabled={!hasStrokes}
              title="Send for OCR"
              aria-label="Submit handwriting"
            >
              <Send size={16} />
            </button>
            <button type="button" className="icon-button" onClick={onClose} title="Close" aria-label="Close handwriting">
              <X size={16} />
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="handwriting-canvas"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        <p className="handwriting-hint">Draw your problem, then tap Send to transcribe via OCR</p>
      </div>
    </div>
  );
}
