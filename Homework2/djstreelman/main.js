// Global variables
let margin = { top: 40, right: 40, bottom: 60, left: 80 };
let width, height;
let tooltip;

// Load the data
d3.csv("data/ds_salaries.csv").then(data => {
    data.forEach(d => {
        d.salary_in_usd = +d.salary_in_usd;
        d.remote_ratio = +d.remote_ratio;
    });
    
    console.log("Loaded data:", data.slice(0, 5));
    
    tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    createOverviewChart(data);
    createScatterPlot(data);
    createParallelCoordinatesPlot(data);
    
    // Add resize listener to make visualizations responsive
    window.addEventListener('resize', () => {
        // Clear previous charts
        d3.select("#job-salary-chart").selectAll("*").remove();
        d3.select("#scatter-chart").selectAll("*").remove();
        d3.select("#parallel-chart").selectAll("*").remove();
        
        // Recreate charts with new dimensions
        createOverviewChart(data);
        createScatterPlot(data);
        createParallelCoordinatesPlot(data);
    });
});

// Overview chart - Bar chart of salary by job title
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
        
    svg.selectAll(".bar")
        .data(jobTitleArray)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.job_title))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.avg_salary))
        .attr("height", d => height - y(d.avg_salary))
        .attr("fill", "#4e79a7")
        .attr("rx", 3)
        .attr("ry", 3);
        
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
        .text(d => `$${Math.round(d.avg_salary / 1000)}k`);
}

// Scatter plot - Experience level vs Salary with remote ratio as color
function createScatterPlot(data) {
    const containerElement = document.getElementById("scatter-chart");
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    
    width = containerWidth - margin.left - margin.right;
    height = containerHeight - margin.top - margin.bottom;
    
    const svg = d3.select("#scatter-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
    const experienceLevels = { "EN": 1, "MI": 2, "SE": 3, "EX": 4 };
    const experienceLabels = { 1: "Entry", 2: "Mid", 3: "Senior", 4: "Executive" };
    
    data.forEach(d => {
        d.experience_num = experienceLevels[d.experience_level];
    });
    
    const filteredData = data.filter(d => d.employment_type === "FT");
    
    const x = d3.scaleLinear()
        .domain([0.5, 4.5])
        .range([0, width]);
        
    const y = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.salary_in_usd)])
        .nice()
        .range([height, 0]);
        
    const color = d3.scaleLinear()
        .domain([0, 50, 100])
        .range(["#e41a1c", "#377eb8", "#4daf4a"])
        .interpolate(d3.interpolateRgb);
        
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat("").tickSizeOuter(0))
        .attr("opacity", 0.1);
        
    svg.append("g")
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
        
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendWidth - 5}, ${5})`);
        
    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .text("Remote Work Ratio");
        
    const defs = svg.append("defs");
    
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
        
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d => experienceLabels[d]).tickValues([1, 2, 3, 4]));
        
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => `$${d / 1000}k`));
        
    svg.append("g")
        .selectAll("dot")
        .data(filteredData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.experience_num))
        .attr("cy", d => y(d.salary_in_usd))
        .attr("r", 4)
        .attr("fill", d => color(d.remote_ratio))
        .attr("opacity", 0.7)
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5);
        
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 15)
        .style("font-size", "10px")
        .text("Experience Level");
        
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -height / 2)
        .style("font-size", "10px")
        .text("Salary (USD)");
}

// Parallel Coordinates Plot (Advanced visualization)
function createParallelCoordinatesPlot(data) {
    const filteredData = data.filter(d => d.employment_type === "FT");
    
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
                .domain(d3.extent(filteredData, d => +d[dimension.name]))
                .range([height, 0]);
        }
    });
    
    svg.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(filteredData)
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
    
    svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(filteredData)
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
        .attr("opacity", 0.3)
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
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text("Each line represents a job - Hover over a line to see details");
} 