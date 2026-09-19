import React from "react";
import { Composition } from "remotion";
import { loadBrandFonts } from "./brand/fonts";
import { BrandTest, brandTestDefaults } from "./compositions/BrandTest";

loadBrandFonts();

export const FPS = 30;

// Every composition is registered twice: "<Id>" at 1080p and "<Id>-720p".
// Components size everything relative to width, so both share one design.
const SIZES: Record<string, [number, number]> = { "": [1920, 1080], "-720p": [1280, 720] };

export const RemotionRoot: React.FC = () => (
  <>
    {Object.entries(SIZES).map(([suffix, [width, height]]) => (
      <Composition
        key={`BrandTest${suffix}`}
        id={`BrandTest${suffix}`}
        component={BrandTest}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={width}
        height={height}
        defaultProps={brandTestDefaults}
      />
    ))}
  </>
);
