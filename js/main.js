//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function () {

    //pseudo-global variables
    var attrArray = [//"Coal", "NaturalGas", "Petroleum", "Nuclear", "Renewable",
        "Coal", "Natural Gas", "Nuclear", "Petroleum", "Renewable"]; //list of attributes
    var expressed = "Default"; //initial attribute

    var displayArray = ["Equal Interval", "Linear", "Natural Breaks", "Quantile"]; //list of display methods
    var display = "Default"; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 5,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scale.linear()
    .range([0, 420])
    .domain([0, 85]);   

    //begin script when window loads
    window.onload = setMap();

    //Example 1.3 line 4...set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 473;

        //create new svg container for the map
        var map = d3.select("map")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on US
        var projection = d3.geoAlbersUsa()
            .scale(700)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        //use d3.queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/energy_profiles.csv") //load attributes from csv
            .defer(d3.json, "data/states.topojson") //load choropleth spatial data
            .await(callback);

        //Example 1.4 line 10
        function callback(error, csvData, states, display){
            
            //translate states TopoJSON
            var usStates = topojson.feature(states, states.objects.collection).features;

            //variables for data join

            //join csv data to GeoJSON enumeration units
            usStates = joinData(usStates, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData, display);

            //add enumeration units to the map
            setEnumerationUnits(usStates, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            createAttributeDropdown(csvData);

            createDisplayDropdown(csvData);
        };
    };


    function joinData(usStates, csvData){
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.postal; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<usStates.length; a++){

                var geojsonProps = usStates[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.postal; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return usStates
    };


    //function to create color scale generator
    function makeColorScale(data, display){
        var colorClasses = [
            "#FFFFCC",
            "#C2E699",
            "#78C679",
            "#31A354",
            "#006837"
        ];


        if (display == "Equal Interval") {
            //create color scale generator
            var colorScale = d3.scaleQuantile()
                .range(colorClasses);

            //build two-value array of minimum and maximum expressed attribute values
            var minmax = [
                d3.min(data, function(d) { return parseFloat(d[expressed]); }),
                d3.max(data, function(d) { return parseFloat(d[expressed]); })
            ];
            //assign two-value array as scale domain
            colorScale.domain(minmax);

            return colorScale;

        } else if (display == "Linear") {
            //create color scale generator
            var colorScale = d3.scaleLinear()
                .range([
                    colorClasses[0],
                    colorClasses[4]
                ])
                .domain([
                    d3.min(data, function(d) { return parseFloat(d[expressed]); }),
                    d3.max(data, function(d) { return parseFloat(d[expressed]); })
            
                ]);

            return colorScale;

        } else if (display == "Natural Breaks") {
            //create color scale generator
            var colorScale = d3.scaleThreshold()
                .range(colorClasses);

            //build array of all values of the expressed attribute
            var domainArray = [];
            for (var i=0; i<data.length; i++){
                var val = parseFloat(data[i][expressed]);
                domainArray.push(val);
            };

            //cluster data using ckmeans clustering algorithm to create natural breaks
            var clusters = ss.ckmeans(domainArray, 5);
            //reset domain array to cluster minimums
            domainArray = clusters.map(function(d){
                return d3.min(d);
            });
            //remove first value from domain array to create class breakpoints
            domainArray.shift();
         
            //assign array of last 4 cluster minimums as domain
            colorScale.domain(domainArray);

            return colorScale;
        }  else if (display == "Quantile") {
            //create color scale generator
            var colorScale = d3.scaleQuantile()
                .range(colorClasses);

            //build array of all values of the expressed attribute
            var domainArray = [];
            for (var i=0; i<data.length; i++){
                var val = parseFloat(data[i][expressed]);
                domainArray.push(val);
            };

            //assign array of expressed values as scale domain
            colorScale.domain(domainArray);

            return colorScale;

        } else { 
            var colorScale = d3.scaleLinear()
            .range([
                "#ccc",
                "#ccc"
            ])
            .domain([
                0, 
                100
            ]);

            return colorScale;

        }
    };

    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };

    function setEnumerationUnits(usStates, map, path, colorScale){
        //add states to map
        var statesDisplay = map.selectAll(".states")
            .data(usStates)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.postal;
            })
            .attr("d", path)
            //Example 1.7 line 13
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        var desc = statesDisplay.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    };

    //Example 2.1 line 11...function to create coordinated bar chart
    function setChart(csvData, colorScale){

        //Example 2.1 line 17...create a second svg element to hold the bar chart
        var chart = d3.select("map")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");


        //create a scale to size bars proportionally to frame
        var xScale = d3.scaleLinear()
            .range([0, chartWidth])
            .domain([0, 105]);

        //Example 2.4 line 8...set bars for each province
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return a[expressed]-b[expressed]
            })
            .attr("class", function(d){
                return "bars " + d.postal;
            })
            .attr("width", chartWidth / csvData.length - 1)
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d){
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d){
                return chartHeight - yScale(parseFloat(d[expressed]));

            })
            //Example 2.5 line 23...end of bars block
            .style("fill", function(d){
                return choropleth(d, colorScale);
            })
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        var desc = bars.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');


        //below Example 2.8...create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Select Energy Type & Classification");


        // var axisScale = d3.scaleLinear()
        //     .range([450, 50])
        //     .domain([0 , 85]);

        // //create vertical axis generator
        // var yAxis = d3.axisLeft(axisScale);

        // //place axis
        // var axis = chart.append("g")
        //     .attr("class", "axis")
        //     .attr("transform", "translate(50, 0)")
        //     .call(yAxis);

        // //create frame for chart border
        // var chartFrame = chart.append("rect")
        //     .attr("class", "chartFrame")
        //     .attr("width", chartInnerWidth)
        //     .attr("height", chartInnerHeight)
        //     .attr("transform", translate);




      //   // Create Event Handlers for mouse
      // function handleMouseOver(d, i) {  // Add interactivity

      //       // Specify where to put label of text
      //       chart.append("text").attr({
      //           id: "t" + d.x + "-" + d.y + "-" + i,  // Create an id for text so we can select it later for removing on mouseout
      //           x: function() { return 20; },
      //           y: function() { return 60; }
      //       })
      //       .text(function() {
      //         return [ d.name + ": " + Number(Math.round(d[expressed] + 'e3')+ 'e-3').toString() + "%"];  // Value of the text
      //       });
      //     }

      // function handleMouseOut(d, i) {
      //       // Use D3 to select element, change color back to normal
      //       d3.select(this).attr({
      //         fill: "black"
      //       });

      //       // Select text by id and then remove
      //       d3.select("#t" + d.x + "-" + d.y + "-" + i).remove();  // Remove text location
      //     };
    };

    //function to create a dropdown menu for attribute selection
    function createAttributeDropdown(csvData){
        //add select element
        var dropdown = d3.select("map")
            .append("select")
            .attr("class", "attributedropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Energy Type");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };

    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData, display);

        //recolor enumeration units
        var states = d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });

        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bars")
            //re-sort bars
            .sort(function(a, b){
                return a[expressed] - b[expressed];
            })
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            //resize bars
            .attr("height", function(d, i){
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .transition()
            .duration(1000)
            //recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

        var chartTitle = d3.selectAll("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text( expressed + " Consumption (% of total energy)");

    };


    //function to create a dropdown menu for attribute selection
    function createDisplayDropdown(csvData){
        //add select element
        var dropdown = d3.select("map")
            .append("select")
            .attr("class", "displaydropdown")
            .on("change", function(){
                changeDisplayMethod(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Classification");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(displayArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };

    //dropdown change listener handler
    function changeDisplayMethod(method, csvData){
        //change the expressed attribute
        display = method;

        //recreate the color scale
        var colorScale = makeColorScale(csvData, display);

        //recolor enumeration units
        var states = d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });

        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bars")
            //re-sort bars
            .sort(function(a, b){
                return a[expressed] - b[expressed];
            })
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            //resize bars
            .attr("height", function(d, i){
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            //recolor bars
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

        var chartTitle = d3.selectAll("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text( function () {
                if (expressed == "Default") {
                    var tempTitle = "Select Energy Type"
                } else { 
                    var tempTitle = expressed + " Consumption (% of total energy)"
                }
                return tempTitle;
            })
    };


     //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.postal)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        setLabel(props)
    };

    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.postal)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
        
        //below Example 2.4 line 21...remove info label
        d3.select(".infolabel").remove();
    };

    //function to create dynamic label
    function setLabel(props){

        if ( expressed == "Default") {
            var labelAttribute = "<h5>Select Energy Type</h5>";
        } else if (isNaN(props[expressed])) {
            //label content
            var labelAttribute = "<h5>0%</h5>";
        } else {
            //label content
            var labelAttribute = "<h5>" + Number(Math.round(props[expressed] + 'e3')+ 'e-3').toString() +
                "%</h5>";
        }

        //create info label div
        var infolabel = d3.select("map")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.name + "_label")
            .html(labelAttribute);
        
        if ( expressed == "Default") {
            //pass
        } else {
            var energyType = infolabel.append("div")
                .attr("class", "energytype")
                .html("<h6>"+ expressed + " Consumption</h6>");
        }

        var regionName = infolabel.append("div")
            .attr("class", "labelname")
            .html("<h6>" + props.name + "<h6>");
    };

    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

})(); //last line of main.js