// Piecewise JavaScript that gets loaded when the page loads. Mostly loads map and UI elements.

// If set to 'hex' then GeoJSON files are assumed to be named like
// 'YYYY_MM-<resolution>.json', where 3 files exist for each of resolutions
// 'low', 'medium', 'high'.  If anything other than 'hex', then this value is
// the MMMM_YY- suffix to look for. For example:
// If set to 'city_council_districts', then the system will look for
// GeoJSON files like 'MMMM_YY-city_council_districts.geojson'.

// polygonType is a variable name defining your aggregation regions. 
// Change the name to reflect the aggregated regions you are using if needed.
var polygonType = 'census_block_groups';

// Either 'topojson' or 'geojson'.  The Node.js script creates both TopoJSON and
// GeoJSON files.  TopoJSON files are significantly smaller in size, but need to
// be converted to GeoJSON by the browser.  There may be some balance between
// loading a smaller file across the network and the processing time on the
// client-side to convert the TopJSON to GeoJSON.  I would conjecture that
// the network is the most limiting factor and that generally TopoJSON will be
// the right choice.  TODO: prove this theory.
var jsonType = "topojson";


// The minimum number of data points in any given polygon for a it to be
// considered statistically relevant.  These cells will either not be displayed
// or will be displayed with a different styling.
var minDataPoints = 5;

// Defines how each overlay is treated on load.  If an overlay is enabled, then
// there will be a checkbox for it in the layers control. 'defaultOn' determines
// whether it will be displayed by default. NOTE: If only a single overlay is
// enabled, then no checkbox will be displayed, since it doesn't make much sense
// to disable the only meaningful layer that exists.
var overlays = {
	'polygon': {
		'enabled': true,
		'defaultOn': true
	},
	'plot': {
		'enabled': false,
		'defaultOn': false
	}
};

// Defines the layers that are going to be added to the map.
var geoLayers = {
	'census_block_groups': {
		'name': 'Census block groups',
		'polygonFile': '/seattle_census10_blockgroups.topojson',
		'dataUrl': '/stats/q/by_census_block?format=json&stats=AverageRTT,DownloadCount,MedianDownload,AverageDownload,UploadCount,MedianUpload,AverageUpload,DownloadMax,UploadMax&b.spatial_join=key&b.time_slices=month&f.time_slices=',
		'dbKey': 'geoid10',
		'geoKey': 'GEOID10',
		'cache': null,
		'layer': null
	},
};

// Which of the geoLayers should be the one added to the map by default
var defaultLayer = 'census_block_groups';

// If set to true, then prefetch the GeoJSON files into a local cache.  WARNING:
// You may not want to enable if you expect mobile, low bandwidth, or otherwise
// bandwidth restricted users, as this can pull in many megabytes of data.
var seedCache = false;

// The inteval (in milliseconds) to use when animating the map.
var animateInterval = 1500;

// Center and zoom level of map.  center may be pulled in via js/center.js, but
// if not then just set it to the center of the USA.
if ( typeof center == 'undefined' ) {
	var center = [38.8961302513129,-99.04025268554688]; //USA
}
var zoom = 11;

// These are the labels that will be used for the month slider in the control
// box in the lower left corner.
var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct',
	'Nov','Dec'];

// An object which will hold cached GeoJSON files so that we don't have to fetch
// them from the server more than once.  This could potentially be problematic
// if there are many files and they are large.
var geoJsonCache = {};
var geometryCache = null;

// The oldest year and month for which we have data.
var startYear = 2014;
var startMonth = 1;

// Get current year/month into variables
var currentYear = new Date().getFullYear();
var currentMonth = new Date().getMonth() + 1;
// Zero pad the front of the month
currentMonth = currentMonth < 10 ? '0' + currentMonth : currentMonth;

// Be sure that we actually have data for the current month.  If not, then fall
// back to the previous month.
var start = Date.UTC(currentYear, currentMonth - 1, 1) / 1000;
var end = Math.floor(Date.now() / 1000);
var dataUrl = geoLayers[defaultLayer]['dataUrl'] + start + ',' + end;
$.ajax({
	url: dataUrl,
	dataType: 'json',
	async: false,
	success: function(resp) {
		if ( ! resp.features.length ) {
			if ( currentMonth == '01' ) {
				currentMonth = 12;
				currentYear = currentYear - 1;
			} else {
				currentMonth = currentMonth - 1;
				currentMonth = currentMonth < 10 ?
					'0' + currentMonth : currentMonth;
			}
			console.log("No data for current year/month, using last" +
				" month instead.");
		}
	}
});

// An object with the years and months we have data for.  This will be used to
// auto-generate various form controls.
var dates = {};
var thisYear = startYear;
while (thisYear <= currentYear) {
	if (thisYear == currentYear) {
		var months = [];
		for (i = 1; i <= currentMonth; i++) { months.push(i) };
		dates[thisYear] = months
	} else {
		dates[thisYear] = ['1','2','3','4','5','6','7','8','9','10','11','12'];
	}
	thisYear++;
}

// Create the map
var map = L.map('map', {zoomControl: false}).setView(center, zoom);
map.scrollWheelZoom.disable();
var control = L.control.zoom({position: 'topright'});
map.addControl(control);

// Use Open Street Maps as a base tile layer
// var osmLayer = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
//	attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>' +
//		'contributors'
// });

// Use Mapbox as a base tile layer
// var mapboxLayer = L.tileLayer(
//		'https://{s}.tiles.mapbox.com/v3/newamerica.lcl1jan5/{z}/{x}/{y}.png', {
//	attribution: '&copy; <a href="http://mapbox.com/">Mapbox</a>'
// });
 
// Use Mapbox as a base tile layer
var mapboxLayer = L.tileLayer(
		'https://{s}.tiles.mapbox.com/v3/newamerica.lcl1jan5/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://mapbox.com/">Mapbox</a>'
});

// Set the default base tile layer. 
// If using Open Street Maps: map.addLayer(osmLayer);
// If using Mapbox: map.addLayer(mapboxLayer);
map.addLayer(mapboxLayer);

// Add other base tile layer providers as needed
var baseLayers = {
	 'Mapbox': mapboxLayer
};

var layerCtrl = L.control.layers(baseLayers, null, { collapsed: false, position: 'bottomleft' });
addControls();
layerCtrl.addTo(map);
addLegend();

for (var geoLayer in geoLayers) {
	setupLayer(geoLayer);
}
