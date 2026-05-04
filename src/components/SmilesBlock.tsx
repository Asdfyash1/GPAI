"use client";

import { useEffect, useRef } from "react";

type SmilesBlockProps = {
  smiles: string;
  theme?: "light" | "dark";
};

export function SmilesBlock({ smiles, theme = "dark" }: SmilesBlockProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !smiles) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await (Function('return import("smiles-drawer")')() as Promise<{ default: { SvgDrawer: new (opts: Record<string, unknown>) => { draw: (tree: unknown, el: SVGSVGElement, t: string) => void }; parse: (s: string, cb: (tree: unknown) => void) => void } }>);
        if (cancelled) return;
        const SmilesDrawer = mod.default;
        const drawer = new SmilesDrawer.SvgDrawer({
          width: 500,
          height: 350,
          bondThickness: 1.5,
          fontSizeLarge: 11,
          fontSizeSmall: 8,
          padding: 30,
        });
        SmilesDrawer.parse(smiles, (tree: unknown) => {
          if (!cancelled && svgRef.current) {
            drawer.draw(tree, svgRef.current, theme);
          }
        });
      } catch {
        // smiles-drawer not available
      }
    })();

    return () => { cancelled = true; };
  }, [smiles, theme]);

  return (
    <div className="smiles-container">
      <svg ref={svgRef} className="smiles-svg" />
      <div className="smiles-string">{smiles}</div>
    </div>
  );
}
