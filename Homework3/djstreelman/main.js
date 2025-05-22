// Global variables
let margin = { top: 40, right: 40, bottom: 60, left: 80 };
let width, height;
let tooltip;
let filteredData;
let originalData;

// Load the data
d3.csv("data/ds_salaries.csv").then(data => {
    data.forEach(d => {
        d.salary_in_usd = +d.salary_in_usd;
        d.remote_ratio = +d.remote_ratio;
    });
    
    console.log("Loaded data:", data.slice(0, 5));
    
    originalData = data;
    filteredData = data.filter(d => d.employment_type === "FT");
    
    tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    createOverviewChart(data);
    createScatterPlot(filteredData);
    createParallelCoordinatesPlot(filteredData);
    
    // Add resize listener to make visualizations responsive
    window.addEventListener('resize', () => {
        // Clear previous charts
        d3.select("#job-salary-chart").selectAll("*").remove();
        d3.select("#scatter-chart").selectAll("*").remove();
        d3.select("#parallel-chart").selectAll("*").remove();
        
        // Recreate charts with new dimensions
        createOverviewChart(data);
        createScatterPlot(filteredData);
        createParallelCoordinatesPlot(filteredData);
    });
});

// Overview chart with brushing
function createOverviewChart(data) {
    const jobTitleData = d3.rollup(
        data,
        v => ({
            avg_salary: d3.mean(v, d => d.salary_in_usd),
            count: v.length
        }),
        d => d.job_title
    );
    
    let jobTitleArray = Array.from(jobTitleData, ([key, value]) => ({
        job_title: key,
        avg_salary: value.avg_salary,
        count: value.count
    }));
    
    jobTitleArray = jobTitleArray.filter(d => d.count >= 10);
    jobTitleArray.sort((a, b) => b.avg_salary - a.avg_salary);
    jobTitleArray = jobTitleArray.slice(0, 15);

    const containerElement = document.getElementById("job-salary-chart");
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    
    width = containerWidth - margin.left - margin.right;
    height = containerHeight - margin.top - margin.bottom;
    
    const svg = d3.select("#job-salary-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
    // Create a clip path to ensure bars don't overflow
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip-bars")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
        
    const x = d3.scaleBand()
        .domain(jobTitleArray.map(d => d.job_title))
        .range([0, width])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(jobTitleArray, d => d.avg_salary) * 1.05])
        .nice()
        .range([height, 0]);
        
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat("").tickSizeOuter(0))
        .attr("opacity", 0.1);
        
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").tickSizeOuter(0))
        .attr("opacity", 0.1);
    
    // Create a group for bars with clip path
    const barsGroup = svg.append("g")
        .attr("clip-path", "url(#clip-bars)");
        
    // Add bars
    const bars = barsGroup.selectAll(".bar")
        .data(jobTitleArray)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.job_title))
        .attr("width", x.bandwidth())
        .attr("y", height) // Start from bottom for animation
        .attr("height", 0) // Initial height 0 for animation
        .attr("fill", "#4e79a7")
        .attr("rx", 3)
        .attr("ry", 3);
    
    // Animate bars on load
    bars.transition()
        .duration(1000)
        .delay((d, i) => i * 50)
        .attr("y", d => y(d.avg_salary))
        .attr("height", d => height - y(d.avg_salary));
        
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-19)")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .style("font-size", "8px");
        
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => `$${d / 1000}k`));
        
    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Average Salary (USD)");
        
    svg.selectAll(".bar-label")
        .data(jobTitleArray)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.job_title) + x.bandwidth() / 2)
        .attr("y", d => y(d.avg_salary) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("opacity", 0) // Start hidden for animation
        .text(d => `$${Math.round(d.avg_salary / 1000)}k`)
        .transition() // Animate labels appearing
        .duration(1000)
        .delay((d, i) => i * 50 + 500)
        .style("opacity", 1);
    
    // Add brushing functionality
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", brushed);
    
    barsGroup.append("g")
        .attr("class", "brush")
        .call(brush);
    
    // Brush event handler
    function brushed(event) {
        if (!event.selection) return; // If brush is cleared, do nothing
        
        const [x0, x1] = event.selection;
        
        // Find selected job titles
        const selectedTitles = jobTitleArray
            .filter(d => {
                const barX = x(d.job_title);
                return barX >= x0 && barX + x.bandwidth() <= x1;
            })
            .map(d => d.job_title);
        
        // If no titles selected, use all data
        if (selectedTitles.length === 0) {
            filteredData = originalData.filter(d => d.employment_type === "FT");
        } else {
            filteredData = originalData.filter(d => 
                d.employment_type === "FT" && 
                selectedTitles.includes(d.job_title)
            );
        }
        
        // Update the other visualizations with the filtered data
        d3.select("#scatter-chart").selectAll("*").remove();
        d3.select("#parallel-chart").selectAll("*").remove();
        
        // Create the visualizations with animated transitions
        createScatterPlot(filteredData);
        createParallelCoordinatesPlot(filteredData);
        
        // Add a message about the filtering
        const count = filteredData.length;
        d3.select("#filter-message")
            .remove();
            
        svg.append("text")
            .attr("id", "filter-message")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "#e74c3c")
            .style("opacity", 0)
            .text(`${count} jobs${selectedTitles.length > 0 ? ' for ' + selectedTitles.length + ' job title(s)' : ''}`)
            .transition()
            .duration(500)
            .style("opacity", 1);
    }
    
    // Add instructions
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-style", "italic")
        .style("fill", "#666")
        .text("Drag to brush across bars to filter data");
}

// Scatter plot with pan and zoom
function createScatterPlot(data) {
    const containerElement = document.getElementById("scatter-chart");
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    
    width = containerWidth - margin.left - margin.right;
    height = containerHeight - margin.top - margin.bottom;
    
    const svg = d3.select("#scatter-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight);
        
    // Create a clip path to ensure points don't overflow during zoom
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip-scatter")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
        
    // Create a group for the zoomable content
    const mainGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create a group with clip path for points
    const chartArea = mainGroup.append("g")
        .attr("clip-path", "url(#clip-scatter)");
        
    const experienceLevels = { "EN": 1, "MI": 2, "SE": 3, "EX": 4 };
    const experienceLabels = { 1: "Entry", 2: "Mid", 3: "Senior", 4: "Executive" };
    
    data.forEach(d => {
        d.experience_num = experienceLevels[d.experience_level];
    });
    
    // Create scales with zoom support
    const x = d3.scaleLinear()
        .domain([0.5, 4.5])
        .range([0, width]);
        
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.salary_in_usd) * 1.05])
        .nice()
        .range([height, 0]);
        
    const color = d3.scaleLinear()
        .domain([0, 50, 100])
        .range(["#e41a1c", "#377eb8", "#4daf4a"])
        .interpolate(d3.interpolateRgb);
        
    // Add grids
    chartArea.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat("").tickSizeOuter(0))
        .attr("opacity", 0.1);
        
    chartArea.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").tickSizeOuter(0))
        .attr("opacity", 0.1);
        
    // Add remote work ratio legend at top
    const legendWidth = Math.min(170, width * 0.4);
    const legendHeight = 12;
    
    const legendScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, legendWidth]);
        
    const legendAxis = d3.axisBottom(legendScale)
        .tickValues([0, 50, 100])
        .tickFormat(d => `${d}%`);
        
    const legend = mainGroup.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendWidth - 5}, ${5})`);
        
    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .text("Remote Work Ratio");
        
    const defs = mainGroup.append("defs");
    
    const linearGradient = defs.append("linearGradient")
        .attr("id", "remote-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
        
    linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color(0));
        
    linearGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", color(50));
        
    linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color(100));
        
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#remote-gradient)");
        
    legend.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "8px");
    
    // Create axis groups
    const xAxis = mainGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d => experienceLabels[d]).tickValues([1, 2, 3, 4]));
        
    const yAxis = mainGroup.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y).tickFormat(d => `$${d / 1000}k`));
    
    // Add axis labels
    mainGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 15)
        .style("font-size", "10px")
        .text("Experience Level");
        
    mainGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -height / 2)
        .style("font-size", "10px")
        .text("Salary (USD)");
    
    // Add dots with animation
    chartArea.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.experience_num))
        .attr("cy", height / 2) // Start from middle for animation
        .attr("r", 0) // Start with radius 0
        .attr("fill", d => color(d.remote_ratio))
        .attr("opacity", 0.7)
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .transition() // Animate points appearing
        .duration(1000)
        .delay((d, i) => Math.min(i * 2, 1000)) // Cap delay at 1000ms
        .attr("cy", d => y(d.salary_in_usd))
        .attr("r", 4);
    
    // Add zoom functionality
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Set min/max zoom levels
        .extent([[0, 0], [width, height]])
        .on("zoom", zoomed);
    
    // Add a transparent rectangle to capture zoom events
    chartArea.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all");
    
    // Apply zoom to svg
    svg.call(zoom);
    
    // Add zoom/pan instructions
    mainGroup.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-style", "italic")
        .style("fill", "#666")
        .text("Use mouse wheel to zoom, drag to pan");
    
    // Zoom event handler
    function zoomed(event) {
        // Get the transform from the event
        const transform = event.transform;
        
        // Create new scaled axes
        const newX = transform.rescaleX(x);
        const newY = transform.rescaleY(y);
        
        // Update axes
        xAxis.call(d3.axisBottom(newX).tickFormat(d => experienceLabels[d]).tickValues([1, 2, 3, 4]));
        yAxis.call(d3.axisLeft(newY).tickFormat(d => `$${d / 1000}k`));
        
        // Update points with the new scales
        chartArea.selectAll("circle")
            .attr("cx", d => newX(d.experience_num))
            .attr("cy", d => newY(d.salary_in_usd));
            
        // Update grid
        chartArea.selectAll(".grid")
            .attr("opacity", 0); // Hide grid during zoom for performance
    }
}

// Parallel Coordinates Plot (Advanced visualization)
function createParallelCoordinatesPlot(data) {
    const containerElement = document.getElementById("parallel-chart");
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    
    width = containerWidth - margin.left - margin.right;
    height = containerHeight - margin.top - margin.bottom;
    
    const svg = d3.select("#parallel-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
    const dimensions = [
        {
            name: "experience_level",
            label: "Experience Level",
            type: "categorical",
            values: ["EN", "MI", "SE", "EX"]
        },
        {
            name: "remote_ratio",
            label: "Remote Work %",
            type: "numerical"
        },
        {
            name: "company_size",
            label: "Company Size",
            type: "categorical",
            values: ["S", "M", "L"]
        },
        {
            name: "salary_in_usd",
            label: "Salary (USD)",
            type: "numerical"
        }
    ];
    
    const x = d3.scalePoint()
        .domain(dimensions.map(d => d.name))
        .range([0, width])
        .padding(0.1);
        
    const y = {};
    dimensions.forEach(dimension => {
        if (dimension.type === "categorical") {
            y[dimension.name] = d3.scalePoint()
                .domain(dimension.values)
                .range([height, 0])
                .padding(0.1);
        } else {
            y[dimension.name] = d3.scaleLinear()
                .domain(d3.extent(data, d => +d[dimension.name]))
                .range([height, 0]);
        }
    });
    
    svg.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("d", d => {
            const points = dimensions.map(dimension => {
                let value = d[dimension.name];
                if (value !== null && !isNaN(value)) {
                    return {
                        x: x(dimension.name),
                        y: y[dimension.name](value)
                    };
                }
                return null;
            }).filter(p => p !== null);
            return d3.line().defined(d => d !== null).x(d => d.x).y(d => d.y)(points);
        })
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("opacity", 0.1);
    
    const line = d3.line()
        .defined(d => d !== null)
        .x(d => d.x)
        .y(d => d.y);
    
    // Add lines with animation
    const paths = svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("d", d => {
            return line(dimensions.map(dimension => {
                return {
                    x: x(dimension.name),
                    y: y[dimension.name](d[dimension.name])
                };
            }));
        })
        .attr("fill", "none")
        .attr("stroke", "#69b3a2")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0) // Start invisible
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke", "red")
                .attr("stroke-width", 3)
                .attr("opacity", 1);
                
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
                
            tooltip.html(`
                <strong>${d.job_title}</strong><br>
                Experience: ${d.experience_level}<br>
                Remote: ${d.remote_ratio}%<br>
                Company Size: ${d.company_size}<br>
                Salary: $${d.salary_in_usd.toLocaleString()}<br>
                Location: ${d.company_location}
            `)
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("stroke", "#69b3a2")
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.3);
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Animate lines appearing with staggered delay
    paths.transition()
        .duration(1000)
        .delay((d, i) => Math.min(i * 2, 1000)) // Cap delay at 1000ms
        .attr("opacity", 0.3);
        
    svg.selectAll(".dimension")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d.name)}, 0)`)
        .each(function(d) {
            d3.select(this)
                .append("line")
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#000")
                .attr("stroke-width", 1);
            
            if (d.type === "categorical") {
                d3.select(this).call(d3.axisLeft(y[d.name]))
                    .selectAll("text")
                    .style("font-size", "9px");
            } else {
                let axis = d3.axisLeft(y[d.name]);
                if (d.name === "salary_in_usd") {
                    axis.tickFormat(d => `$${d/1000}k`);
                }
                d3.select(this).call(axis)
                    .selectAll("text")
                    .style("font-size", "9px");
            }
                
            d3.select(this)
                .append("text")
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("fill", "#333")
                .style("font-size", "10px")
                .text(d.label);
        });
    
    // Add count information
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .text(`Showing ${data.length} jobs - Hover over a line to see details`);
} 