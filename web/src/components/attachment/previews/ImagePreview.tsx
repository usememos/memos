import { Maximize2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ImagePreviewProps {
  src: string;
  alt: string;
  isLoading?: boolean;
}

export function ImagePreview({ src, alt, isLoading }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Reset state when src changes
  useEffect(() => {
    handleReset();
  }, [src]);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.25, Math.min(5, s + delta)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Drag to pan
  const handleMouseDown = () => {
    if (scale > 1) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition((p) => ({
        x: p.x + e.movementX,
        y: p.y + e.movementY,
      }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex gap-1 bg-black/50 rounded-lg p-1.5">
        <button onClick={handleZoomOut} className="p-2 hover:bg-white/20 rounded" title="Zoom out">
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white self-center px-2 text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} className="p-2 hover:bg-white/20 rounded" title="Zoom in">
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button onClick={handleRotate} className="p-2 hover:bg-white/20 rounded" title="Rotate">
          <RotateCw className="w-5 h-5 text-white" />
        </button>
        <button onClick={handleReset} className="p-2 hover:bg-white/20 rounded" title="Reset">
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
