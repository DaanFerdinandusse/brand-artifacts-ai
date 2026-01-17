import React, { memo } from "react";
import {
  IconSpecExpanded,
  PathGeometry,
  CircleGeometry,
  RectGeometry,
  LineGeometry,
  PolylineGeometry,
} from "./schema";

interface IconRendererProps {
  spec: IconSpecExpanded;
  size?: number;
  className?: string;
  color?: string;
}

function renderPath(
  path: PathGeometry,
  index: number
) {
  return (
    <path
      key={`path-${index}`}
      d={path.d}
    />
  );
}

function renderCircle(
  circle: CircleGeometry,
  index: number
) {
  return (
    <circle
      key={`circle-${index}`}
      cx={circle.cx}
      cy={circle.cy}
      r={circle.r}
    />
  );
}

function renderRect(
  rect: RectGeometry,
  index: number
) {
  return (
    <rect
      key={`rect-${index}`}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      rx={rect.rx}
      ry={rect.ry}
    />
  );
}

function renderLine(
  line: LineGeometry,
  index: number
) {
  return (
    <line
      key={`line-${index}`}
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
    />
  );
}

function renderPolyline(polyline: PolylineGeometry, index: number) {
  return (
    <polyline
      key={`polyline-${index}`}
      points={polyline.points}
    />
  );
}

export const IconRenderer = memo(function IconRenderer({
  spec,
  size,
  className,
  color,
}: IconRendererProps) {
  const displaySize = size ?? spec.size;
  const resolvedStroke =
    spec.style.stroke === "currentColor" && color ? color : spec.style.stroke;
  const resolvedFill =
    spec.style.fill === "currentColor" && color ? color : spec.style.fill;

  return (
    <svg
      width={displaySize}
      height={displaySize}
      viewBox={spec.viewBox}
      fill={resolvedFill}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke={resolvedStroke}
      strokeWidth={spec.style.strokeWidth}
      strokeLinecap={spec.style.strokeLinecap}
      strokeLinejoin={spec.style.strokeLinejoin}
    >
      {spec.geometry.paths.map((path, i) => renderPath(path, i))}
      {spec.geometry.rects.map((rect, i) => renderRect(rect, i))}
      {spec.geometry.circles.map((circle, i) => renderCircle(circle, i))}
      {spec.geometry.lines.map((line, i) => renderLine(line, i))}
      {spec.geometry.polylines.map((polyline, i) =>
        renderPolyline(polyline, i)
      )}
    </svg>
  );
});

export default IconRenderer;
