var express = require("express");
var cors = require("cors");
var mariadb = require("mariadb");
require("dotenv").config();
var { exec } = require('child_process');

const db_pool = mariadb.createPool({
	host: process.env["DB_HOST"],
	user: process.env["MARIADB_USER"],
	password: process.env["MARIADB_PASSWORD"],
	idleTimeout: 5,
	database: "hubble",
	port: 4433
});

var app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
	res.json({"message": "Nothing interesting happens.", "status": 200});
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
