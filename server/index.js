var express = require("express");
var cors = require("cors");
require("dotenv").config();
var { exec } = require('child_process');

const crypto = require("crypto");

var bodyParser = require("body-parser");

const corsOptions ={
	origin:'*', 
	methods: 'GET, POST, PUT, DELETE, OPTIONS', // Allowed methods
	allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization, uuidSessionToken', // Allowed headers
	credentials: true // Allow cookies and other credentials to be sent
}

var app = express();
app.use(express.json());
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
app.use(cors());
app.use(bodyParser.json());

app.use("/", require("./methods/purchase-orders.js"));
app.use("/", require("./methods/purchase-order-attachments.js"));
app.use("/", require("./methods/vendor.js"));
app.use("/", require("./methods/account.js"));
app.use("/", require("./methods/reports.js"));
app.use("/", require("./methods/user.js"));
app.use("/", require("./methods/misc.js"));
app.use("/", require("./methods/settings.js"));
app.use("/", require("./methods/home-page.js"));
app.use("/", require("./methods/calendar.js"));
app.use("/", require("./methods/admin.js"));

var server = app.listen(8000, function() {
	var currentBranch = "missingno";
	
	exec('git branch --show-current', (err, stdout, stderr) => {
		if (err) 
			console.log("I couldn't figure out what branch I'm on!");
		else {
	    	currentBranch = stdout.trim()
	    	console.log("Backend is live on branch " + currentBranch);
		}
	});
}).on('error',function(err){
	console.log(err)
});
