"use client";

interface SvgRendererProps {
  svg: string;
  className?: string;
}

export function SvgRenderer({ svg, className = "" }: SvgRendererProps) {
  return (
    <div
      className={`svg-renderer ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
