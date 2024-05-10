var express = require("express");
var cors = require("cors");
var mariadb = require("mariadb");
require("dotenv").config();
var { exec } = require('child_process');
var bodyParser = require("body-parser");


const crypto = require("crypto");

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
app.use(bodyParser.json());

/******************************************HELPER FUNCTIONS******************************************/

//delete unwanted characters
function clean(str) {
	if (str === undefined || typeof str !== 'string') {
		return "error";
	}
	return str.replace(/[^0-9a-zA-Z_\-@.\s]/gi, "");
}

//This function is used at the start of all requests to make sure a user is logged in.
async function getUserIDBySessionToken(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();
	try {
		const result = await dbConnection.query("SELECT UserID FROM tblSessions WHERE ID=?;", [uuidSessionToken]);
		
		if (result.length == 0) {
			console.log("Session token " + uuidSessionToken + " does not belong to any user.");
			return -1;
		}
		return result[0].UserID;
	} finally {
		await dbConnection.end();
	}
}

/******************************************REQUESTS******************************************/

app.post("/login", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	console.log("username is " + req.body.strUserName);
	console.log("password is " + req.body.strPassword);
	const strUserName = clean(req.body.strUserName);
	const strPassword = clean(req.body.strPassword);

	var strHashedPassword = crypto.createHash("sha256").update(strPassword).digest("hex");
	console.log("hashedpassword is " + strHashedPassword);
	console.log("Got a login attempt from " + strUserName + ", communicating with DB...");

	try {
		var usersQuery = await dbConnection.query("SELECT * FROM tblUser WHERE UserName=? AND password=?;", [strUserName, strHashedPassword]);
			
		if (usersQuery.length == 0) {
			console.error("Failed login attempt for user " + strUserName);
			return res.json({"message": "Incorrect or missing email/password.", "status": 400});
		}
		
		console.info("Successful login for user " + strUserName);

		var uuidSessionToken = crypto.randomUUID();
		console.log("User " + strUserName + "'s session token is " + uuidSessionToken);

		res.json({"message": "Success. Logging you in.", "uuidSessionToken": uuidSessionToken, "status": 200});

		const intUserId = usersQuery[0].ID;

		await dbConnection.query("INSERT INTO tblSessions (UserID, ID, timeIn) VALUE (?, ?, NOW());", [intUserId, uuidSessionToken]);
	} finally {
		await dbConnection.end();
	}
});

app.post("/logout", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Session token " + uuidSessionToken + " wants to log out.");

		await dbConnection.query("DELETE FROM tblSessions where ID=?;", [uuidSessionToken]);

		res.json({"message": "Goodbye!", "status": 200});
	} finally {
		await dbConnection.close();
	}
});

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
