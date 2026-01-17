import React, { memo } from "react";
import {
  IconSpec,
  PathElement,
  CircleElement,
  RectElement,
  LineElement,
} from "./schema";
import { getPreset } from "./presets";

interface IconRendererProps {
  spec: IconSpec;
  size?: number;
  className?: string;
  color?: string;
}

function renderPath(
  path: PathElement,
  index: number,
  defaults: { stroke: string; strokeWidth: number; fill: string }
) {
  return (
    <path
      key={`path-${index}`}
      d={path.d}
      fill={path.fill ?? defaults.fill}
      stroke={path.stroke ?? defaults.stroke}
      strokeWidth={path.strokeWidth ?? defaults.strokeWidth}
      opacity={path.opacity}
    />
  );
}

function renderCircle(
  circle: CircleElement,
  index: number,
  defaults: { stroke: string; strokeWidth: number; fill: string }
) {
  return (
    <circle
      key={`circle-${index}`}
      cx={circle.cx}
      cy={circle.cy}
      r={circle.r}
      fill={circle.fill ?? defaults.fill}
      stroke={circle.stroke ?? defaults.stroke}
      strokeWidth={circle.strokeWidth ?? defaults.strokeWidth}
      opacity={circle.opacity}
    />
  );
}

function renderRect(
  rect: RectElement,
  index: number,
  defaults: { stroke: string; strokeWidth: number; fill: string }
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
      fill={rect.fill ?? defaults.fill}
      stroke={rect.stroke ?? defaults.stroke}
      strokeWidth={rect.strokeWidth ?? defaults.strokeWidth}
      opacity={rect.opacity}
    />
  );
}

function renderLine(
  line: LineElement,
  index: number,
  defaults: { stroke: string; strokeWidth: number }
) {
  return (
    <line
      key={`line-${index}`}
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
      stroke={line.stroke ?? defaults.stroke}
      strokeWidth={line.strokeWidth ?? defaults.strokeWidth}
      opacity={line.opacity}
    />
  );
}

export const IconRenderer = memo(function IconRenderer({
  spec,
  size,
  className,
  color,
}: IconRendererProps) {
  const preset = getPreset(spec.preset);
  const displaySize = size ?? spec.size;

  const defaults = {
    stroke: color ?? spec.stroke,
    strokeWidth: spec.strokeWidth,
    fill: spec.fill === "currentColor" && color ? color : spec.fill,
  };

  return (
    <svg
      width={displaySize}
      height={displaySize}
      viewBox={spec.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color }}
      strokeLinecap={preset.strokeLinecap}
      strokeLinejoin={preset.strokeLinejoin}
    >
      {spec.paths.map((path, i) => renderPath(path, i, defaults))}
      {spec.circles?.map((circle, i) => renderCircle(circle, i, defaults))}
      {spec.rects?.map((rect, i) => renderRect(rect, i, defaults))}
      {spec.lines?.map((line, i) =>
        renderLine(line, i, { stroke: defaults.stroke, strokeWidth: defaults.strokeWidth })
      )}
    </svg>
  );
});

export default IconRenderer;
