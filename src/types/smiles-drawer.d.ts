declare module "smiles-drawer" {
  interface SmilesDrawerOptions {
    width?: number;
    height?: number;
    bondThickness?: number;
    fontSizeLarge?: number;
    fontSizeSmall?: number;
    padding?: number;
  }

  const SmilesDrawer: {
    SvgDrawer: new (options?: SmilesDrawerOptions) => {
      draw(tree: unknown, target: SVGElement, theme?: string): void;
    };
    parse(
      smiles: string,
      callback: (tree: unknown) => void,
      errorCallback?: (err: unknown) => void,
    ): void;
  };

  export default SmilesDrawer;
}
