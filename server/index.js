var express = require("express");
var cors = require("cors");
require("dotenv").config();
var { exec } = require('child_process');

const crypto = require("crypto");

var bodyParser = require("body-parser");

var app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

app.use("/", require("./purchase-orders.js"));
app.use("/", require("./vendor.js"));
app.use("/", require("./account.js"));
app.use("/", require("./user.js"));
app.use("/", require("./misc.js"));

var server = app.listen(8000, function() {
	var currentBranch = "missingno";
	
	exec('git branch --show-current', (err, stdout, stderr) => {
		if (err) {
			console.log("I couldn't figure out what branch I'm on!");
	    	}
	    	currentBranch = stdout.trim()
	    	console.log("Backend is live on branch " + currentBranch);
	});
});
