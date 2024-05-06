var express = require("express");
var cors = require("cors");
var { exec } = require('child_process');

var app = express();
app.use(express.json());
app.use(cors());

app.get("*", (req, res) => {
	res.json({"message": "Backend Status: Running", "status": 200});
});

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
