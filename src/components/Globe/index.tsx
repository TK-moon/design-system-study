import React, { useEffect, useRef } from "react";
import styled from "styled-components";

import * as d3 from "d3";
import { GeoPermissibleObjects } from "d3-geo";
import * as topojson from "topojson-client";
import { Feature, Geometry, GeoJsonProperties, GeoJsonObject } from "geojson";
import * as topojsonSimplify from "topojson-simplify";
import { GeometryObject, Topology } from "topojson-specification";

import geoJson from "./land-110m.json";

const CanvasContainer = styled.div<{ scale: number }>`
  position: relative;
  width: ${(p) => `${p.scale}px`};
  height: ${(p) => `${p.scale}px`};
  border-radius: ${(p) => `${p.scale / 2}px`};
  overflow: hidden;
`;

const GlobeOverlay = styled.div<{ background: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: ${(p) => p.background};
  border-radius: 100%;
`;

interface GlobeProps {
  /** @prop props.size - Globe Size (px) */
  size: number;
  /** @prop props.offsetX - Rotate Offset x. Default 0 */
  offsetX?: number;
  /** @prop props.offsetY - Rotate Offset y. Default 0 */
  offsetY?: number;
  /** @prop props.grid - Display Grid. Default #ccc */
  grid?: boolean | string;
  /** @prop props.animate - Rotate Globe */
  animate?: boolean;
  /** @prop props.duration - Animate Duration. Default 1500(ms) */
  duration?: number;
  /** @prop props.animateToX - Animate To X coord. Default -180 */
  animateToX?: number;
  /** @prop props.animateToY - Animate To Y coord. Default 30 */
  animateToY?: number;
  /** @prop props.outline - Globe outline. default #000 */
  outline?: string;
  /** @prop props.landColor - Globe Land Color. default #ccc */
  landColor?: string;
  /** @prop props.landSimplify - Globe Land Simplify. Round land edges */
  landSimplify?: boolean;
  /** @prop props.landOutline - Globe Land Outline. Default #000 */
  landOutline?: string;
  /** @prop props.oceanColor - Globe ocean color. Default #fff */
  oceanColor?: string;
  /** @prop props.overlayColor - Globe Overlay color. Default linear-gradient(to bottom, transparent, rgba(255, 255, 255, 200)) */
  overlayColor?: string;
}

const defaultProps: GlobeProps = {
  size: 300,
  offsetX: 0,
  offsetY: 0,
  animateToX: 180,
  animateToY: 30,
  duration: 1500,
  grid: false,
  animate: false,
  overlayColor:
    "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(255, 255, 255, 200))",
};

/**
 * Render a Globe
 * @returns React.Node
 */

const Globe = (props: GlobeProps) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const scale = props.size;
  const cx: number = scale / 2;
  const cy: number = scale / 2;

  const offset = {
    x: props.offsetX as number,
    y: props.offsetY as number,
  };
  const animateTo = {
    x: props.animateToX as number,
    y: props.animateToY as number,
  };

  // const offsetX = props.offsetX || 0;
  // const offsetY = props.offsetY || 0;

  // const animateToX = props.animateToX || 180;
  // const animateToY = props.animateToY || 30;

  // const duration = props.duration || 1500;

  const curveContext = (curve: d3.CurveGenerator): d3.GeoContext => ({
    moveTo(x: number, y: number) {
      curve.lineStart();
      curve.point(x, y);
    },
    lineTo(x: number, y: number) {
      curve.point(x, y);
    },
    closePath() {
      curve.lineEnd();
    },
    beginPath() {},
    arc() {},
  });

  type ObjectType = Feature<Geometry | null> | Geometry | { type: string };
  // eslint-disable-next-line
  const geoCurvePath =
    (
      curve: d3.CurveFactory,
      projection: d3.GeoProjection,
      context: CanvasRenderingContext2D
    ): ((object: GeoPermissibleObjects) => void) =>
    (object: GeoPermissibleObjects) => {
      const pathContext: CanvasRenderingContext2D | d3.Path =
        context === undefined ? d3.path() : context;
      d3.geoPath(projection, curveContext(curve(pathContext)))(object);
      return context === undefined ? `${pathContext}` : undefined;
    };

  const simplifyWorld = (_world: Topology<any>) => {
    const w = topojsonSimplify.presimplify(_world);
    const min_weight = topojsonSimplify.quantile(w, 0.1);
    return topojsonSimplify.simplify(w, min_weight);
  };

  useEffect(() => {
    const currentElement = canvasContainerRef.current as HTMLDivElement;
    const canvas = d3
      .select(currentElement)
      .append("canvas")
      .attr("width", scale)
      .attr("height", scale);

    const node = canvas.node() as HTMLCanvasElement;
    const context = node.getContext("2d") as CanvasRenderingContext2D;

    const bufferCanvas = document.createElement("canvas");
    const bufferCanvasContext = bufferCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;

    bufferCanvasContext.canvas.width = scale;
    bufferCanvasContext.canvas.height = scale;

    const projection = d3
      .geoOrthographic()
      .scale(scale / 2)
      .translate([cx, cy])
      .rotate([props.offsetX as number, props.offsetY as number]);

    const geoPath = geoCurvePath(
      d3.curveBasisClosed,
      projection,
      bufferCanvasContext
    );

    let world = geoJson as unknown as Topology<any>;
    if (props.landSimplify) {
      world = simplifyWorld(world);
    }
    const land = topojson.feature(world, world.objects.land);

    const drawWorld = () => {
      bufferCanvasContext.save();
      bufferCanvasContext.clearRect(
        0,
        0,
        bufferCanvas.width,
        bufferCanvas.height
      );

      if (props.outline) {
        bufferCanvasContext.beginPath();
        geoPath({ type: "Sphere" });
        bufferCanvasContext.lineWidth = 1;
        bufferCanvasContext.strokeStyle = props.outline || "#000";
        bufferCanvasContext.stroke();
      }

      bufferCanvasContext.beginPath();
      geoPath({ type: "Sphere" });
      bufferCanvasContext.fillStyle = props.oceanColor || "#fff";
      bufferCanvasContext.fill();

      if (props.grid) {
        const graticule = d3.geoGraticule();
        const grid = graticule();
        bufferCanvasContext.beginPath();
        geoPath(grid);
        bufferCanvasContext.lineWidth = 0.5;
        bufferCanvasContext.strokeStyle = (props.grid as string) || "#aaa";
        bufferCanvasContext.stroke();
      }

      bufferCanvasContext.beginPath();
      geoPath(land);
      bufferCanvasContext.fillStyle = props.landColor || "#ccc";
      bufferCanvasContext.fill();

      if (props.landOutline) {
        bufferCanvasContext.beginPath();
        geoPath(land);
        bufferCanvasContext.lineWidth = 0.5;
        bufferCanvasContext.strokeStyle = props.landOutline || "#000";
        bufferCanvasContext.stroke();
      }

      context.clearRect(0, 0, cx, cy);
      context.drawImage(
        bufferCanvas,
        0,
        0,
        bufferCanvas.width,
        bufferCanvas.height
      );

      bufferCanvasContext.restore();
    };

    const animateGlobe = () => {
      const timer = d3.timer((elapsed) => {
        const duration = props.duration as number;
        const t = Math.min(1, d3.easeCubic(elapsed / duration));
        projection.rotate([
          offset.x + t * animateTo.x,
          offset.y + t * animateTo.y,
        ]);
        requestAnimationFrame(drawWorld);
        if (t === 1) {
          timer.stop();
        }
      }, 1000);
    };

    requestAnimationFrame(drawWorld); // FirstRender

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateGlobe();
        else {
          projection.rotate([offset.x, offset.y]);
          drawWorld();
        }
      });
    });

    if (props.animate) {
      if (canvasContainerRef.current)
        observer.observe(canvasContainerRef.current);
      else animateGlobe();
    }

    return () => observer.unobserve(canvasContainerRef.current as Element);
  }, []);

  return (
    <CanvasContainer ref={canvasContainerRef} scale={scale}>
      {props.overlayColor && <GlobeOverlay background={props.overlayColor} />}
    </CanvasContainer>
  );
};

// Globe.defaultProps = {
//   offsetX: 0,
//   offsetY: 0,
//   animateToX: 180,
//   animateToY: 30,
//   duration: 1500,
//   grid: false,
//   animate: false,
//   overlayColor:
//     "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(255, 255, 255, 200))",
// };

Globe.defaultProps = defaultProps;

export default Globe;
