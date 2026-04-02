const tooltip = d3.select("#tooltip");

const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%b %d, %Y");
function isMidterm(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return (
    (month === 2 && day >= 10 && day <= 25) ||   // Feb midterm
    (month === 4 && day >= 15 && day <= 30) ||   // April finals
    (month === 10 && day >= 10 && day <= 25) ||  // Oct midterm
    (month === 12 && day >= 10 && day <= 25)     // Dec finals
  );
}
function isSemester(date){
  const month = date.getMonth()+1; 
  return(
    (month >= 1 && month <= 4) ||
    (month >= 9 && month <= 12)
  );
}
function getLinearRegression(data, xAccessor, yAccessor) {
  const n = data.length;

  const sumX = d3.sum(data, xAccessor);
  const sumY = d3.sum(data, yAccessor);
  const sumXY = d3.sum(data, d => xAccessor(d) * yAccessor(d));
  const sumX2 = d3.sum(data, d => xAccessor(d) * xAccessor(d));

  const slope =
    (n * sumXY - sumX * sumY) /
    (n * sumX2 - sumX * sumX);

  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}
function kernelDensityEstimator(kernel, X) {
  return function(V) {
    return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
  };
}

function kernelEpanechnikov(k) {
  return function(v) {
    return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
  };
}

d3.csv("final_sleep_dataset.csv").then(rawData => {
  const data = rawData.map(d => {

   const parsedDate = parseDate(d.date);

   return {
    date: parsedDate,
    dateString: d.date,
    sleep_hours: +d.sleep_hours,
    steps: +d.steps,
    day_type: d.day_type,
    sleep_category: d.sleep_category,
    sleep_deficit: +d.sleep_deficit,
    Sleep_Status: d.Sleep_Status,
    moving_avg_7: d.moving_avg_7 === "" ? null : +d.moving_avg_7,
    period: isMidterm(parsedDate) ? "Midterm" : "Regular"  ,
    semester: isSemester(parsedDate) ? "Semester" : "Break"
  };
});

  let currentFilter = "All";

  function getFilteredData() {
    if (currentFilter === "All") return data;
    return data.filter(d => d.day_type === currentFilter);
  }

  function renderAll() {
    const filtered = getFilteredData();
    d3.select("#line-chart").selectAll("*").remove();
    d3.select("#histogram").selectAll("*").remove();
    d3.select("#calendar-heatmap").selectAll("*").remove();
    d3.select("#scatter-plot").selectAll("*").remove();
    d3.select("#binned-steps-chart").selectAll("*").remove();
    d3.select("#boxplot-daytype").selectAll("*").remove();
    d3.select("#density-daytype").selectAll("*").remove();
    d3.select("#sleep-steps-heatmap").selectAll("*").remove();
    d3.select("#midterm-sleep-chart").selectAll("*").remove();
    d3.select("#midterm-slope-chart").selectAll("*").remove();



    drawLineChart(filtered);
    drawHistogram(filtered);
    drawCalendarHeatmap(filtered);
    drawScatterPlot(filtered);
    drawBinnedStepsChart(filtered);
    drawDayTypeBoxPlot(filtered);
    drawDayTypeDensityPlot(filtered);
    drawSleepStepsHeatmap(filtered);
    drawMidtermSleepChart(filtered);
    drawMidtermSlopeChart(filtered);

  }

  d3.select("#filterDayType").on("change", function () {
    currentFilter = this.value;
    renderAll();
  });

//Scatter Plot
  function drawScatterPlot(data) {
  const width = 960;
  const height = 350;
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };

  const svg = d3.select("#scatter-plot")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.sleep_hours))
    .nice()
    .range([margin.left, width - margin.right]);
    
  const maxSteps = d3.max(data, d => d.steps);

  const y = d3.scaleLinear()
    .domain([0, maxSteps * 1.1])  
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(["Weekday", "Weekend"])
    .range(["#1f77b4", "#ff7f0e"]);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Sleep Hours");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Steps");

  svg.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.sleep_hours))
    .attr("cy", d => y(d.steps))
    .attr("r", 4)
    .attr("fill", d => color(d.day_type))
    .attr("data-date", d => d.dateString)
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${formatDate(d.date)}</strong><br>
          Sleep: ${d.sleep_hours} hrs<br>
          Steps: ${d.steps}<br>
          ${d.day_type}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
    const regression = getLinearRegression(
      data,
      d => d.sleep_hours,
      d => d.steps
    );

    const xMin = d3.min(data, d => d.sleep_hours);
    const xMax = d3.max(data, d => d.sleep_hours);

    const trendLineData = [
     { x: xMin, y: regression.slope * xMin + regression.intercept },
     { x: xMax, y: regression.slope * xMax + regression.intercept }
    ];

     svg.append("line")
      .attr("x1", x(trendLineData[0].x))
      .attr("y1", y(trendLineData[0].y))
      .attr("x2", x(trendLineData[1].x))
      .attr("y2", y(trendLineData[1].y))
      .attr("stroke", "#d62728")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5 4");
}

//  BINNED CHART ----------------------------------
  function drawBinnedStepsChart(data) {
  const width = 960;
  const height = 320;
  const margin = { top: 30, right: 30, bottom: 60, left: 70 };

  const svg = d3.select("#binned-steps-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Create 1-hour sleep bins
  const minSleep = Math.floor(d3.min(data, d => d.sleep_hours));
  const maxSleep = Math.ceil(d3.max(data, d => d.sleep_hours));

  const binGenerator = d3.bin()
    .domain([minSleep + 2, maxSleep - 4])
    .thresholds(d3.range(minSleep, maxSleep - 1, 1))
    .value(d => d.sleep_hours);

  const bins = binGenerator(data);

  // Compute average steps in each bin
  const binnedData = bins
    .filter(bin => bin.length > 0)
    .map(bin => ({
      label: `${bin.x0}–${bin.x1}`,
      x0: bin.x0,
      x1: bin.x1,
      avgSteps: d3.mean(bin, d => d.steps),
      count: bin.length
    }));

  const x = d3.scaleBand()
    .domain(binnedData.map(d => d.label))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(binnedData, d => d.avgSteps) * 1.1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Grid lines
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    )
    .select(".domain")
    .remove();

  // X axis
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Y axis
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d3.format(".2s")));

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text("Sleep Duration Bin (hours)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Average Steps");

  // Bars
  svg.selectAll(".bin-bar")
    .data(binnedData)
    .enter()
    .append("rect")
    .attr("class", "bin-bar")
    .attr("x", d => x(d.label))
    .attr("y", d => y(d.avgSteps))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.avgSteps))
    .attr("fill", "#2ca02c")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.label} hrs</strong><br>
          Avg steps: ${Math.round(d.avgSteps).toLocaleString()}<br>
          Days in bin: ${d.count}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // Line through bar tops for extra clarity
  const line = d3.line()
    .x(d => x(d.label) + x.bandwidth() / 2)
    .y(d => y(d.avgSteps));

  svg.append("path")
    .datum(binnedData)
    .attr("fill", "none")
    .attr("stroke", "#145a32")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots on line
  svg.selectAll(".bin-dot")
    .data(binnedData)
    .enter()
    .append("circle")
    .attr("class", "bin-dot")
    .attr("cx", d => x(d.label) + x.bandwidth() / 2)
    .attr("cy", d => y(d.avgSteps))
    .attr("r", 4)
    .attr("fill", "#145a32");

  // Average reference line across bins
  const overallAvgSteps = d3.mean(data, d => d.steps);

  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(overallAvgSteps))
    .attr("y2", y(overallAvgSteps))
    .attr("stroke", "#d62728")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5 4");

  svg.append("text")
    .attr("x", width - margin.right - 140)
    .attr("y", y(overallAvgSteps) - 8)
    .attr("font-size", 11)
    .attr("fill", "#d62728")
    .text(`Overall avg: ${Math.round(overallAvgSteps).toLocaleString()}`);
}


// BOX PLOT --------------------------
function drawDayTypeBoxPlot(data) {
  const width = 700;
  const height = 320;
  const margin = { top: 30, right: 30, bottom: 60, left: 60 };

  const svg = d3.select("#boxplot-daytype")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const grouped = d3.groups(data, d => d.day_type)
    .map(([key, values]) => {
      const sorted = values
        .map(d => d.sleep_hours)
        .sort(d3.ascending);

      const q1 = d3.quantile(sorted, 0.25);
      const median = d3.quantile(sorted, 0.5);
      const q3 = d3.quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      const min = d3.min(sorted.filter(v => v >= lowerFence));
      const max = d3.max(sorted.filter(v => v <= upperFence));
      const outliers = sorted.filter(v => v < lowerFence || v > upperFence);

      return {
        key,
        q1,
        median,
        q3,
        iqr,
        min,
        max,
        outliers,
        values
      };
    });

  const x = d3.scaleBand()
    .domain(grouped.map(d => d.key))
    .range([margin.left, width - margin.right])
    .paddingInner(0.45)
    .paddingOuter(0.3);

  const y = d3.scaleLinear()
    .domain([
      d3.min(grouped, d => d3.min([d.min, ...d.outliers])),
      d3.max(grouped, d => d3.max([d.max, ...d.outliers]))
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(["Weekday", "Weekend"])
    .range(["#4e79a7", "#f28e2b"]);

  // Grid
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    )
    .select(".domain")
    .remove();

  // X axis
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Y axis
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 15)
    .attr("text-anchor", "middle")
    .text("Day Type");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Sleep Hours");

  // Draw boxplots
  grouped.forEach(group => {
    const boxWidth = x.bandwidth();
    const center = x(group.key) + boxWidth / 2;

    // Whisker line
    svg.append("line")
      .attr("x1", center)
      .attr("x2", center)
      .attr("y1", y(group.min))
      .attr("y2", y(group.max))
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);

    // Min cap
    svg.append("line")
      .attr("x1", center - 20)
      .attr("x2", center + 20)
      .attr("y1", y(group.min))
      .attr("y2", y(group.min))
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);

    // Max cap
    svg.append("line")
      .attr("x1", center - 20)
      .attr("x2", center + 20)
      .attr("y1", y(group.max))
      .attr("y2", y(group.max))
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);

    // Box
    svg.append("rect")
      .attr("x", x(group.key))
      .attr("y", y(group.q3))
      .attr("width", boxWidth)
      .attr("height", y(group.q1) - y(group.q3))
      .attr("fill", color(group.key))
      .attr("opacity", 0.75)
      .attr("stroke", "#333");

    // Median line
    svg.append("line")
      .attr("x1", x(group.key))
      .attr("x2", x(group.key) + boxWidth)
      .attr("y1", y(group.median))
      .attr("y2", y(group.median))
      .attr("stroke", "#111")
      .attr("stroke-width", 2);

    // Outliers
    svg.selectAll(`.outlier-${group.key}`)
      .data(group.outliers)
      .enter()
      .append("circle")
      .attr("cx", center)
      .attr("cy", d => y(d))
      .attr("r", 3.5)
      .attr("fill", "#111")
      .attr("opacity", 0.8);

    // Tooltip overlay for the box
    svg.append("rect")
      .attr("x", x(group.key))
      .attr("y", margin.top)
      .attr("width", boxWidth)
      .attr("height", height - margin.top - margin.bottom)
      .attr("fill", "transparent")
      .on("mousemove", (event) => {
        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${group.key}</strong><br>
            Median: ${group.median.toFixed(2)} hrs<br>
            Q1: ${group.q1.toFixed(2)} hrs<br>
            Q3: ${group.q3.toFixed(2)} hrs<br>
            Whisker min: ${group.min.toFixed(2)} hrs<br>
            Whisker max: ${group.max.toFixed(2)} hrs<br>
            Outliers: ${group.outliers.length}
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));
  });
}

//MIDTERM AND NORMAL DAYS SLEEP -------------------
function drawMidtermSleepChart(data) {
  const width = 520;
  const height = 320;
  const margin = { top: 30, right: 30, bottom: 60, left: 60 };

  const svg = d3.select("#midterm-sleep-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Group data
  const grouped = d3.groups(data, d => d.period)
    .map(([key, values]) => ({
      key,
      avgSleep: d3.mean(values, d => d.sleep_hours),
      count: values.length
    }));

  const x = d3.scaleBand()
    .domain(grouped.map(d => d.key))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.avgSleep) * 1.1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(["Midterm", "Regular"])
    .range(["#e15759", "#4e79a7"]);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Period");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Average Sleep (hours)");

  // Bars
  svg.selectAll(".bar")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("x", d => x(d.key))
    .attr("y", d => y(d.avgSleep))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.avgSleep))
    .attr("fill", d => color(d.key))
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.key}</strong><br>
          Avg sleep: ${d.avgSleep.toFixed(2)} hrs<br>
          Days: ${d.count}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // Value labels
  svg.selectAll(".bar-label")
    .data(grouped)
    .enter()
    .append("text")
    .attr("x", d => x(d.key) + x.bandwidth() / 2)
    .attr("y", d => y(d.avgSleep) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text(d => d.avgSleep.toFixed(2));
}


// 2.0 MIDTERM VS REGULAR 
function drawMidtermSlopeChart(data) {
  const width = 760;
  const height = 320;
  const margin = { top: 40, right: 80, bottom: 50, left: 80 };

  const svg = d3.select("#midterm-slope-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Group by day_type and period
  const summary = d3.rollups(
    data,
    v => d3.mean(v, d => d.sleep_hours),
    d => d.day_type,
    d => d.period
  );

  // Convert to easier structure
  const slopeData = summary.map(([dayType, periods]) => {
    const periodMap = new Map(periods);
    return {
      group: dayType,
      Regular: periodMap.get("Regular") ?? null,
      Midterm: periodMap.get("Midterm") ?? null
    };
  });

  const x = d3.scalePoint()
    .domain(["Regular", "Midterm"])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(slopeData, d => Math.min(d.Regular, d.Midterm)) - 0.5,
      d3.max(slopeData, d => Math.max(d.Regular, d.Midterm)) + 0.5
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(["Weekday", "Weekend"])
    .range(["#4e79a7", "#f28e2b"]);

  // Y-axis grid
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    )
    .select(".domain")
    .remove();

  // X-axis
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Y-axis
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Academic Period");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Average Sleep Hours");

  // Draw slope lines
  slopeData.forEach(d => {
    svg.append("line")
      .attr("x1", x("Regular"))
      .attr("y1", y(d.Regular))
      .attr("x2", x("Regular"))   // start collapsed for animation
      .attr("y2", y(d.Regular))
      .attr("stroke", color(d.group))
      .attr("stroke-width", 3)
      .transition()
      .duration(1000)
      .attr("x2", x("Midterm"))
      .attr("y2", y(d.Midterm));

    // Left point (Regular)
    svg.append("circle")
      .attr("cx", x("Regular"))
      .attr("cy", y(d.Regular))
      .attr("r", 0)
      .attr("fill", color(d.group))
      .transition()
      .duration(600)
      .attr("r", 6);

    // Right point (Midterm)
    svg.append("circle")
      .attr("cx", x("Midterm"))
      .attr("cy", y(d.Midterm))
      .attr("r", 0)
      .attr("fill", color(d.group))
      .transition()
      .delay(600)
      .duration(600)
      .attr("r", 6);

    // Labels for Regular values
    svg.append("text")
      .attr("x", x("Regular") - 10)
      .attr("y", y(d.Regular) - 10)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill", color(d.group))
      .style("opacity", 0)
      .text(`${d.group}: ${d.Regular.toFixed(2)}h`)
      .transition()
      .delay(700)
      .duration(500)
      .style("opacity", 1);

    // Labels for Midterm values
    svg.append("text")
      .attr("x", x("Midterm") + 10)
      .attr("y", y(d.Midterm) - 10)
      .attr("text-anchor", "start")
      .attr("font-size", 11)
      .attr("fill", color(d.group))
      .style("opacity", 0)
      .text(`${d.Midterm.toFixed(2)}h`)
      .transition()
      .delay(900)
      .duration(500)
      .style("opacity", 1);

    // Hover layer
    [
      { period: "Regular", value: d.Regular },
      { period: "Midterm", value: d.Midterm }
    ].forEach(point => {
      svg.append("circle")
        .attr("cx", x(point.period))
        .attr("cy", y(point.value))
        .attr("r", 12)
        .attr("fill", "transparent")
        .on("mousemove", (event) => {
          tooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.group}</strong><br>
              ${point.period} period<br>
              Avg sleep: ${point.value.toFixed(2)} hrs
            `)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseleave", () => tooltip.style("opacity", 0));
    });
  });

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 140}, ${margin.top})`);

  ["Weekday", "Weekend"].forEach((key, i) => {
    const g = legend.append("g")
      .attr("transform", `translate(0, ${i * 20})`);

    g.append("line")
      .attr("x1", 0)
      .attr("x2", 18)
      .attr("y1", 7)
      .attr("y2", 7)
      .attr("stroke", color(key))
      .attr("stroke-width", 3);

    g.append("circle")
      .attr("cx", 9)
      .attr("cy", 7)
      .attr("r", 4)
      .attr("fill", color(key));

    g.append("text")
      .attr("x", 25)
      .attr("y", 11)
      .attr("font-size", 12)
      .text(key);
  });
}

// DENSITY PLOT ----------------------------------
function drawDayTypeDensityPlot(data) {
  const width = 760;
  const height = 320;
  const margin = { top: 30, right: 30, bottom: 50, left: 60 };

  const svg = d3.select("#density-daytype")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const grouped = d3.groups(data, d => d.day_type);

  const x = d3.scaleLinear()
    .domain([
      Math.floor(d3.min(data, d => d.sleep_hours)) - 0.5,
      Math.ceil(d3.max(data, d => d.sleep_hours)) + 0.5
    ])
    .range([margin.left, width - margin.right]);

  // Density estimation points
  const xTicks = d3.range(x.domain()[0], x.domain()[1], 0.1);

  const kde = kernelDensityEstimator(kernelEpanechnikov(0.6), xTicks);

  const densityData = grouped.map(([key, values]) => ({
    key,
    density: kde(values.map(d => d.sleep_hours))
  }));

  const y = d3.scaleLinear()
    .domain([
      0,
      d3.max(densityData, d => d3.max(d.density, p => p[1]))
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(["Weekday", "Weekend"])
    .range(["#4e79a7", "#f28e2b"]);

  // Grid
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    )
    .select(".domain")
    .remove();

  // X axis
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Y axis
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Sleep Hours");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Density");

  const area = d3.area()
    .curve(d3.curveBasis)
    .x(d => x(d[0]))
    .y0(y(0))
    .y1(d => y(d[1]));

  const line = d3.line()
    .curve(d3.curveBasis)
    .x(d => x(d[0]))
    .y(d => y(d[1]));

  densityData.forEach(group => {
    // Filled area
    svg.append("path")
      .datum(group.density)
      .attr("fill", color(group.key))
      .attr("opacity", 0.22)
      .attr("stroke", "none")
      .attr("d", area);

    // Outline
    svg.append("path")
      .datum(group.density)
      .attr("fill", "none")
      .attr("stroke", color(group.key))
      .attr("stroke-width", 2.5)
      .attr("d", line);

    // Invisible hover layer with sampled points
    svg.selectAll(`.density-hover-${group.key}`)
      .data(group.density)
      .enter()
      .append("circle")
      .attr("cx", d => x(d[0]))
      .attr("cy", d => y(d[1]))
      .attr("r", 6)
      .attr("fill", "transparent")
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${group.key}</strong><br>
            Sleep hours: ${d[0].toFixed(1)}<br>
            Density: ${d[1].toFixed(3)}
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));
  });

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 170}, ${margin.top})`);

  ["Weekday", "Weekend"].forEach((key, i) => {
    const g = legend.append("g")
      .attr("transform", `translate(0, ${i * 22})`);

    g.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", color(key))
      .attr("opacity", 0.7);

    g.append("text")
      .attr("x", 20)
      .attr("y", 11)
      .attr("font-size", 12)
      .text(key);
  });
}

//  LINE CHART --------------------------------
  function drawLineChart(data) {
  const width = 960;
  const height = 320;
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };

  const svg = d3.select("#line-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sleep_hours) + 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y)
      .tickSize(-(width - margin.left - margin.right))
      .tickFormat(""))
    .select(".domain")
    .remove();

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(d3.timeMonth.every(2)).tickFormat(d3.timeFormat("%b %Y")));  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Date");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Sleep Hours");

  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(8))
    .attr("y2", y(8))
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4 4");

  const line = d3.line()
    .defined(d => d.moving_avg_7 !== null)
    .x(d => x(d.date))
    .y(d => y(d.moving_avg_7));

  svg.selectAll(".daily-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "daily-point")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.sleep_hours))
    .attr("r", 3)
    .attr("fill", "#4682b4")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${formatDate(d.date)}</strong><br>
          Sleep: ${d.sleep_hours} hrs<br>
          Day type: ${d.day_type}<br>
          Deficit: ${d.sleep_deficit}<br>
          Status: ${d.Sleep_Status}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#d62728")
    .attr("stroke-width", 1.5)
    .attr("d", line);
}
function drawHistogram(data) {
  const width = 960;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };

  const svg = d3.select("#histogram")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleLinear()
    .domain([4, 15])
    .range([margin.left, width - margin.right]);

  const bins = d3.bin()
    .domain(x.domain())
    .thresholds(d3.range(4, 16, 1))
    .value(d => d.sleep_hours)(data);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y)
      .tickSize(-(width - margin.left - margin.right))
      .tickFormat(""))
    .select(".domain")
    .remove();

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d => `${d}`));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Sleep Hours (1-hour bins)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Number of Days");

  svg.selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", d => x(d.x0) + 1)
    .attr("y", d => y(d.length))
    .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr("height", d => y(0) - y(d.length))
    .attr("fill", "#69b3a2")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.x0}–${d.x1} hrs</strong><br>
          Days: ${d.length}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
    const avgSleep = d3.mean(data, d => d.sleep_hours);
    const medianSleep = d3.median(data, d => d.sleep_hours);
    // Average line
    svg.append("line")
    .attr("x1", x(avgSleep))
   .attr("x2", x(avgSleep))
   .attr("y1", margin.top)
   .attr("y2", height - margin.bottom)
   .attr("stroke", "#d62728")
   .attr("stroke-width", 2)
   .attr("stroke-dasharray", "4 4");

// Median line
svg.append("line")
  .attr("x1", x(medianSleep))
  .attr("x2", x(medianSleep))
  .attr("y1", margin.top)
  .attr("y2", height - margin.bottom)
  .attr("stroke", "#1f77b4")
  .attr("stroke-width", 2)
  .attr("stroke-dasharray", "2 2");
  svg.append("text")
  .attr("x", x(avgSleep) + 4)
  .attr("y", margin.top + 14)
  .attr("font-size", 11)
  .attr("fill", "#d62728")
  .text(`Avg: ${avgSleep.toFixed(2)}h`);

svg.append("text")
  .attr("x", x(medianSleep) + 4)
  .attr("y", margin.top + 28)
  .attr("font-size", 11)
  .attr("fill", "#1f77b4")
  .text(`Median: ${medianSleep.toFixed(2)}h`);
}

// SLEEPSTEPS HEATMAP
function drawSleepStepsHeatmap(data) {
  const width = 820;
  const height = 420;
  const margin = { top: 30, right: 90, bottom: 60, left: 80 };

  const svg = d3.select("#sleep-steps-heatmap")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Sleep bins: 1-hour bins
  const sleepMin = Math.floor(d3.min(data, d => d.sleep_hours));
  const sleepMax = Math.ceil(d3.max(data, d => d.sleep_hours));
  const sleepBins = d3.range(sleepMin, sleepMax, 1);

  // Steps bins: 2000-step bins
  const stepsMax = d3.max(data, d => d.steps);
  const stepBinSize = 2000;
  const stepBins = d3.range(0, Math.ceil(stepsMax / stepBinSize) * stepBinSize, stepBinSize);

  // Create cell counts
  const heatmapData = [];

  sleepBins.forEach(s0 => {
    const s1 = s0 + 1;

    stepBins.forEach(t0 => {
      const t1 = t0 + stepBinSize;

      const count = data.filter(d =>
        d.sleep_hours >= s0 &&
        d.sleep_hours < s1 &&
        d.steps >= t0 &&
        d.steps < t1
      ).length;

      heatmapData.push({
        sleepBin: `${s0}–${s1}`,
        sleepStart: s0,
        sleepEnd: s1,
        stepBin: `${t0 / 1000}k–${t1 / 1000}k`,
        stepStart: t0,
        stepEnd: t1,
        count: count
      });
    });
  });

  const xDomain = sleepBins.map(s => `${s}–${s + 1}`);
  const yDomain = stepBins.map(t => `${t / 1000}k–${(t + stepBinSize) / 1000}k`);

  const x = d3.scaleBand()
    .domain(xDomain)
    .range([margin.left, width - margin.right])
    .padding(0.03);

  const y = d3.scaleBand()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top])
    .padding(0.03);

  const maxCount = d3.max(heatmapData, d => d.count);

  const color = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolatePuBu);

  // Grid axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text("Sleep Duration Bin (hours)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .text("Steps Bin");

  // Cells
  svg.selectAll(".heat-cell")
    .data(heatmapData)
    .enter()
    .append("rect")
    .attr("class", "heat-cell")
    .attr("x", d => x(d.sleepBin))
    .attr("y", d => y(d.stepBin))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.count))
    .attr("stroke", "#fff")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>Sleep:</strong> ${d.sleepBin} hrs<br>
          <strong>Steps:</strong> ${d.stepBin}<br>
          <strong>Days:</strong> ${d.count}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // Optional count labels for nonzero cells
  svg.selectAll(".heat-label")
    .data(heatmapData.filter(d => d.count > 0))
    .enter()
    .append("text")
    .attr("x", d => x(d.sleepBin) + x.bandwidth() / 2)
    .attr("y", d => y(d.stepBin) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", d => d.count > maxCount * 0.55 ? "#fff" : "#222")
    .text(d => d.count);

  // Legend
  const legendHeight = 180;
  const legendWidth = 14;
  const legendX = width - margin.right + 30;
  const legendY = margin.top;

  const legendScale = d3.scaleLinear()
    .domain([0, maxCount])
    .range([legendHeight, 0]);

  const defs = svg.append("defs");

  const gradient = defs.append("linearGradient")
    .attr("id", "heatmap-gradient")
    .attr("x1", "0%")
    .attr("x2", "0%")
    .attr("y1", "100%")
    .attr("y2", "0%");

  d3.range(0, 1.01, 0.1).forEach(t => {
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(t * maxCount));
  });

  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#heatmap-gradient)");

  svg.append("g")
    .attr("transform", `translate(${legendX + legendWidth},${legendY})`)
    .call(d3.axisRight(legendScale).ticks(5));

  svg.append("text")
    .attr("x", legendX - 8)
    .attr("y", legendY - 8)
    .attr("font-size", 11)
    .text("Days");
}


function drawCalendarHeatmap(data) {
  const width = 980;
  const cellSize = 16;

  // Keep all 2024 data, including December
  const yearData = data.filter(d => d.date.getFullYear() === 2024);

  // More vertical room so legend doesn't overlap
  const height = cellSize * 9 + 120;

  const svg = d3.select("#calendar-heatmap")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const minDeficit = d3.min(yearData, d => d.sleep_deficit);
  const maxDeficit = d3.max(yearData, d => d.sleep_deficit);

  // Red = more deficit, white = balanced, blue = extra sleep
  const color = d3.scaleDiverging()
    .domain([maxDeficit, 0, minDeficit])
    .interpolator(d3.interpolateRdBu);

  svg.append("text")
    .attr("x", 20)
    .attr("y", 22)
    .attr("font-size", 16)
    .attr("font-weight", "bold")
    .text("2024");

  const g = svg.append("g")
    .attr("transform", "translate(50,35)");

  const day = d => (d.getDay() + 6) % 7; // Monday-first
  const week = d3.timeFormat("%U");

  // Month labels
  const months = d3.timeMonths(new Date(2024, 0, 1), new Date(2025, 0, 1));

  g.selectAll(".month-label")
    .data(months)
    .enter()
    .append("text")
    .attr("class", "month-label")
    .attr("x", d => +week(d) * cellSize)
    .attr("y", -8)
    .attr("font-size", 10)
    .text(d3.timeFormat("%b"));

  // Day labels
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  g.selectAll(".day-label")
    .data(labels)
    .enter()
    .append("text")
    .attr("x", -8)
    .attr("y", (d, i) => i * cellSize + 12)
    .attr("text-anchor", "end")
    .attr("font-size", 10)
    .text(d => d);

  // Day cells
  g.selectAll(".heat-day")
    .data(yearData)
    .enter()
    .append("rect")
    .attr("class", "heat-day")
    .attr("data-date", d => d.dateString)
    .attr("width", cellSize - 2)
    .attr("height", cellSize - 2)
    .attr("x", d => +week(d.date) * cellSize)
    .attr("y", d => day(d.date) * cellSize)
    .attr("fill", d => color(d.sleep_deficit))
    .attr("stroke", d => d.semester === "Semester" ? "#d4a017" : "#fff")
    .attr("stroke-width", d => d.semester === "Semester" ? 1.8 : 1)
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${formatDate(d.date)}</strong><br>
          Sleep: ${d.sleep_hours} hrs<br>
          Sleep deficit: ${d.sleep_deficit.toFixed(2)} hrs<br>
          Status: ${d.Sleep_Status}<br>
          Semester period: ${d.semester}
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // ---------- Legend ----------
  const legendWidth = 260;
  const legendHeight = 12;
  const legendX = 50;
  const legendY = cellSize * 8 + 48;

  const defs = svg.append("defs");

  const gradient = defs.append("linearGradient")
    .attr("id", "sleep-deficit-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  gradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", color(maxDeficit)); // red side

  gradient.append("stop")
    .attr("offset", "50%")
    .attr("stop-color", color(0)); // near balanced

  gradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", color(minDeficit)); // blue side

  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#sleep-deficit-gradient)");

  const legendScale = d3.scaleLinear()
    .domain([maxDeficit, minDeficit])
    .range([legendX, legendX + legendWidth]);

  svg.append("g")
    .attr("transform", `translate(0, ${legendY + legendHeight})`)
    .call(d3.axisBottom(legendScale).ticks(5));

  svg.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 20)
    .attr("font-size", 11)
    .text("Sleep deficit color scale");

  svg.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 6)
    .attr("font-size", 11)
    .text("Sleep deficit = 8 − sleep hours");

  // Semester legend
  svg.append("rect")
    .attr("x", legendX + 360)
    .attr("y", legendY - 2)
    .attr("width", 14)
    .attr("height", 14)
    .attr("fill", "#fff")
    .attr("stroke", "#d4a017")
    .attr("stroke-width", 2);

  svg.append("text")
    .attr("x", legendX + 382)
    .attr("y", legendY + 10)
    .attr("font-size", 11)
    .text("Semester period (Jan–Apr, Sep–Dec)");
}  renderAll();
});