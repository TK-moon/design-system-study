/* eslint-disable */
import React, { useRef, useEffect } from "react";
import styled, { css } from "styled-components";
import * as d3 from "d3";
import { throttle } from "lodash";
import moment from "moment";
import { useWindowSize } from "@hooks";

const chartDotCss = css`
  stroke: var(--primary-30);
  stroke-width: 12px;
  fill: var(--primary-100);
  &[active="true"] {
    display: block;
  }
`;

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  svg {
    overflow: visible;
  }
  #tooltip {
    position: absolute;
    width: 82px;
    height: 58px;
    background-color: #fff;
    border: 1px solid var(--warm-grey-4);
    border-radius: 9px;
    box-shadow: 0 2px 4px 0 rgba(0, 50, 100, 0.05);
    pointer-events: none;
    opacity: 0;
    z-index: 1;
    left: 0;
    top: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    text-align: center;
    @media (min-width: 481px) and (max-width: 940px) {
      top: -58px;
    }
    @media (min-width: 320px) and (max-width: 480px) {
      top: -58px;
    }
    div:first-child {
      font-size: 16px;
      line-height: 20px;
      letter-spacing: -0.1px;
    }
    div:last-child {
      font-size: 12px;
      line-height: 18px;
      letter-spacing: -0.08px;
      color: var(--typography-3);
    }
  }
  #lines {
    line {
      stroke: unset;
    }
    line[active="true"] {
      stroke: var(--primary-100);
      stroke-width: 2;
      @media (min-width: 481px) and (max-width: 940px) {
        stroke: var(--warm-grey-2);
      }
      @media (min-width: 320px) and (max-width: 480px) {
        stroke: var(--warm-grey-2);
      }
    }
  }
  #dots {
    circle {
      display: none;
      @media (min-width: 481px) and (max-width: 940px) {
        ${chartDotCss}
      }
      @media (min-width: 320px) and (max-width: 480px) {
        ${chartDotCss}
      }
    }
  }
`;

interface ChartDataInterface {
  max: number;
  min: number;
  dataSet: dataSetInterface[];
}

interface dataSetInterface {
  x: number;
  currency: number;
  createTime: Date;
}

interface ChartSvgProps {
  items: { createTime: string; currency: number }[];
}

const ChartSvg = (props: ChartSvgProps) => {
  const { width: windowWidth } = useWindowSize();

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const getChartData = (data: { currency: number; createTime: string }[]) => {
    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
    const measure = 1000;
    data = data.map((v) => ({ ...v, currency: v.currency * measure }));
    const currencyArr = data.map((v) => v.currency);
    let max = Math.max(...currencyArr) / measure;
    let min = Math.min(...currencyArr) / measure;

    const dataSet = data.map((value, index: number) => ({
      x: index,
      currency: value.currency / measure,
      createTime: parseTime(value.createTime),
    }));
    return { max, min, dataSet };
  };

  const chartData = getChartData(props.items);

  useEffect(() => {
    d3.select(containerRef.current).selectAll("svg").remove();

    const parentPosition = containerRef.current.getBoundingClientRect();
    const width = parentPosition.width;
    const height = parentPosition.height;
    const itemCount = props.items.length;

    const margin = { top: 0, bottom: 0, left: 0, right: 0 };

    const updateScales = (data: ChartDataInterface) => {
      const xDomain = d3.extent(data.dataSet, (d) => d.createTime) as [
        Date,
        Date
      ];
      const xScale = d3
        .scaleTime()
        .domain(xDomain)
        .range([margin.left, width - margin.right]);
      const yScale = d3
        .scaleLinear()
        .domain([data.min, data.max])
        .range([height - margin.bottom, 20]);
      return { xScale, yScale };
    };

    const { xScale, yScale } = updateScales(chartData);

    const createLine = () => {
      const line = d3
        .line<dataSetInterface>()
        .x((value) => xScale(value.createTime))
        .y((value) => yScale(value.currency));
      return line;
    };

    const createArea = () => {
      const area = d3
        .area<dataSetInterface>()
        .x((value) => xScale(value.createTime))
        .y0(height)
        .y1((value) => yScale(value.currency));
      return area;
    };

    const createDots = (g) => {
      g.attr("id", "dots")
        .selectAll("myCircles")
        .data(chartData.dataSet)
        .enter()
        .append("circle")
        .attr("cx", (d: dataSetInterface) => xScale(d.createTime))
        .attr("cy", (d: dataSetInterface) => yScale(d.currency))
        .attr("r", 4);
    };

    const createLines = (g) => {
      g.attr("id", "lines")
        .selectAll("myLines")
        .data(chartData.dataSet)
        .enter()
        .append("line")
        .attr("x1", (d: dataSetInterface) => xScale(d.createTime))
        .attr("x2", (d: dataSetInterface) => xScale(d.createTime))
        .attr("y2", (d: dataSetInterface) => height);
    };

    const onMouseOutOrDragEndTooltipInteraction = () => {
      d3.select(tooltipRef.current).style("opacity", 0);
      d3.select("#lines").call((g) =>
        g.selectAll("line").attr("active", false)
      );
      d3.select("#dots").call((g) =>
        g.selectAll("circle").attr("active", false)
      );
    };

    const onMouseMoveOrDragTooltipInteraction = () => {
      if (!d3.event) return; // throttle 적용 시, d3.event가 없는 경우 존재
      const event = d3.event.sourceEvent || d3.event;
      const mouseX =
        (event.layerX ||
          event.offsetX ||
          event.targetTouches[0].pageX - svgRect.left) - margin.left;
      if (mouseX < 0 || mouseX > pathRect.width) return;
      const index = Math.round(mouseX / (pathRect.width / (itemCount - 1)));
      if (index < 0 || index > itemCount - 1) return;
      const item = props.items[index];

      let tooltipPositionLeft =
        mouseX + margin.left - tooltipRef.current.offsetWidth / 2;
      if (tooltipPositionLeft < limitLeftPosition)
        tooltipPositionLeft = limitLeftPosition;
      else if (tooltipPositionLeft > limitRightPosition)
        tooltipPositionLeft = limitRightPosition;

      d3.select(tooltipRef.current)
        .style("opacity", 1)
        .style("left", `${tooltipPositionLeft}px`)
        .html(
          `<div>${item.currency}</div><div>${moment(item.createTime).format(
            "M.D HH:mm"
          )}</div>`
        );

      d3.select(containerRef.current)
        .select("#lines")
        .call((g) => {
          const lineElements = g.selectAll("line");
          lineElements.filter((d, i) => i === index).attr("active", true);
          lineElements.filter((d, i) => i !== index).attr("active", false);
        });

      d3.select(containerRef.current)
        .select("#dots")
        .call((g) => {
          const dotElements = g.selectAll("circle");
          dotElements.filter((d, i) => i === index).attr("active", true);
          dotElements.filter((d, i) => i !== index).attr("active", false);
        });
    };

    const throttleMouseMoveOrDragTooltipInteraction = throttle(
      onMouseMoveOrDragTooltipInteraction,
      5
    );

    const line = createLine();
    const area = createArea();

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .on("mousemove", throttleMouseMoveOrDragTooltipInteraction)
      .on("mouseout", onMouseOutOrDragEndTooltipInteraction)
      .call(
        d3
          .drag()
          .on("start", throttleMouseMoveOrDragTooltipInteraction)
          .on("drag", throttleMouseMoveOrDragTooltipInteraction)
          .on("end", onMouseOutOrDragEndTooltipInteraction)
      );

    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "gradient")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");

    gradient
      .append("stop")
      .attr("offset", "0%")
      .style("stop-color", "rgba(8, 140, 255, 0.54)")
      .style("stop-opacity", 1);
    gradient
      .append("stop")
      .attr("offset", "100%")
      .style("stop-color", "rgba(255, 255, 255, 0)")
      .style("stop-opacity", 0);

    svg.append("g").call(createLines);

    svg
      .append("path")
      .datum(chartData.dataSet)
      .attr("id", "area")
      .style("fill", "url(#gradient)")
      .attr("d", (d) => area(d));

    const linePath = svg
      .append("path")
      .datum(chartData.dataSet)
      .attr("id", "line")
      .attr("fill", "none")
      .attr("stroke", "rgba(52, 122, 219, 150)")
      .attr("stroke-width", 1)
      .attr("d", (d) => line(d));

    const svgRect = svg.node().getBoundingClientRect();
    const pathRect = linePath.node().getBoundingClientRect();
    const limitLeftPosition = margin.left;
    const limitRightPosition =
      pathRect.width - tooltipRef.current.offsetWidth + margin.right;

    svg.append("g").call(createDots);

    svg.node();
  }, [windowWidth, props.items]);

  return (
    <Container ref={containerRef}>
      <div ref={tooltipRef} id="tooltip"></div>
    </Container>
  );
};

export default ChartSvg;
