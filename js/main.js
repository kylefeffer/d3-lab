//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = [//"Coal", "NaturalGas", "Petroleum", "Nuclear", "Renewable",
        "Coal_pct", "NaturalGas_pct", "Petroleum_pct", "Nuclear_pct", "Renewable_pct"]; //list of attributes
    var expressed = attrArray[1]; //initial attribute

    //begin script when window loads
    window.onload = setMap();

    //Example 1.3 line 4...set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 500;

        //create new svg container for the map
        var map = d3.select("body")
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
        function callback(error, csvData, states){
            
            //translate states TopoJSON
            var usStates = topojson.feature(states, states.objects.collection).features;
            //examine the results
            console.log(usStates);
            //variables for data join

            //join csv data to GeoJSON enumeration units
            usStates = joinData(usStates, csvData);

            //creates graticules
            setGraticule(map, path)

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(usStates, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            createDropdown();
        };
    };


    function joinData(usStates, csvData){
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.State; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<usStates.length; a++){

                var geojsonProps = usStates[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.name; //the geojson primary key

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

    function setGraticule(map, path){
        //Example 2.6 line 1...create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines     
    };

    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#FFFFCC",
            "#C2E699",
            "#78C679",
            "#31A354",
            "#006837"
        ];

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
                return "states " + d.properties.name;
            })
            .attr("d", path)
        //Example 1.7 line 13
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        });
    };

    //Example 2.1 line 11...function to create coordinated bar chart
    function setChart(csvData, colorScale){
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 460;
        //Example 2.1 line 17...create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
       //create a scale to size bars proportionally to frame
        var yScale = d3.scaleLinear()
            .range([0, chartHeight])
            .domain([0, 105]);

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
                return "bars " + d.adm1_code;
            })
            .attr("width", chartWidth / csvData.length - 1)
            .attr("x", function(d, i){
                return i * (chartWidth / csvData.length);
            })
            .attr("height", function(d){
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d){
                return chartHeight - yScale(parseFloat(d[expressed]));

            })
            .on("mouseover", handleMouseOver) 
            .on("mouseout", handleMouseOut)
            //Example 2.5 line 23...end of bars block
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

        // //annotate bars with attribute value text
        // var numbers = chart.selectAll(".numbers")
        //     .data(csvData)
        //     .enter()
        //     .append("text")
        //     .sort(function(a, b){
        //         return a[expressed]-b[expressed]
        //     })
        //     .attr("class", function(d){
        //         return "numbers " + d.adm1_code;
        //     })
        //     .attr("text-anchor", "middle")
        //     .attr("x", function(d, i){
        //         var fraction = chartWidth / csvData.length;
        //         return i * fraction + (fraction - 1) / 2;
        //     })
        //     .attr("y", function(d){
        //         return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        //     })
        //     .text(function(d){
        //         return d[expressed];
        //     });

        //below Example 2.8...create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Percent of " + expressed + " Energy Creation By State");

        //         //create vertical axis generator
        // var yAxis = d3.axisLeft()
        //     .scale(yScale)
        //     .orient("left");

        // //place axis
        // var axis = chart.append("g")
        //     .attr("class", "axis")
        //     .attr("transform", translate)
        //     .call(yAxis);

        // //create frame for chart border
        // var chartFrame = chart.append("rect")
        //     .attr("class", "chartFrame")
        //     .attr("width", chartInnerWidth)
        //     .attr("height", chartInnerHeight)
        //     .attr("transform", translate);




        // Create Event Handlers for mouse
      function handleMouseOver(d, i) {  // Add interactivity



            // Specify where to put label of text
            chart.append("text").attr({
               id: "t" + d.x + "-" + d.y + "-" + i,  // Create an id for text so we can select it later for removing on mouseout
                x: function() { return 20; },
                y: function() { return 60; }
            })
            .text(function() {
              return [ d.State + ": " + Number(Math.round(d[expressed] + 'e3')+ 'e-3').toString() + "%"];  // Value of the text
            });
          }

      function handleMouseOut(d, i) {
            // Use D3 to select element, change color back to normal
            d3.select(this).attr({
              fill: "black"
            });

            // Select text by id and then remove
            d3.select("#t" + d.x + "-" + d.y + "-" + i).remove();  // Remove text location
          }
    };


   




    //function to create a dropdown menu for attribute selection
    function createDropdown(){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown");

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };










})(); //last line of main.js