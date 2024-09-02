var express = require("express");
var cors = require("cors");
var mariadb = require("mariadb");
require("dotenv").config();
var { exec } = require('child_process');
var bodyParser = require("body-parser");
var paginate = require('express-paginate');


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

//This route is called whenever a webhook is triggered from a push to Github
app.post('/build', bodyParser.json(), (req, res) => {
	// Validate the webhook signature
	const secret = process.env["GITHUB_WEBHOOK_SECRET"];
	const signature = req.headers['x-hub-signature'];
	const hash = `sha1=${crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('hex')}`;
	if (signature !== hash) {
	  	return res.status(401).send('Invalid signature');
	}

	const branch = req.body?.ref;
	if (branch != 'refs/heads/dev') {
		return res.status(401).send('Branch was ' + branch + " needs to be dev");
	}
  
	// Parse the webhook payload
	const payload = req.body;
	
	// Deploy app
	console.log("Received new webhook request from Github. Re-Deploying...");
	exec(`bash '/home/admin/Hubble/deploy.sh' ${process.pid} > /home/admin/logs/deploylog`, (error, stdout, stderr) => {
	if (error) {
		console.error(`Error executing script: ${error}`);
		return;
	}
	console.log(`Script output: ${stdout}`);
	if (stderr) {
		console.error(`Script error: ${stderr}`);
	}
	});
  
	res.status(200).send('Webhook received');
});

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

async function getUserNameBySessionToken(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();

	var userID = await getUserIDBySessionToken(uuidSessionToken);
	try {
		const result = await dbConnection.query("SELECT UserName FROM tblUser WHERE EmployeeID=?;", [userID]);
		
		if (result.length == 0) {
			console.log("UserID " + userID + " does not belong to any user.");
			return -1;
		}
		return result[0].UserName;
	} finally {
		await dbConnection.end();
	}
}

/******************************************CRUD REQUESTS******************************************/

// ========================================================
// 						 CREATE
// ========================================================

app.post("/addPO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	const strVendorName = clean(req.body.strVendorName);
	const intStatus = req.body.intStatus;
	const strRequestedFor = clean(req.body.strRequestedFor); 
	const intCreatedBy = req.body.intCreatedBy;
	const strNotes = clean(req.body.strNotes);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		var duplicate = await dbConnection.query("SELECT * FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);
		if (duplicate.length != 0) {
			return res.json({"message": `Purchase Order ${strPurchaseOrderID} already exists.`, "status": 400});
		}

		console.log("Creating a new PO");

		const strRequestedForID = await dbConnection.query("SELECT EmployeeID FROM tblUser WHERE DisplayName=?;", [strRequestedFor]);
		const intVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		await dbConnection.query("INSERT INTO tblPurchaseOrder (PurchaseOrderID, VendorID, Status, RequestedFor, CreatedDateTime, CreatedBy, Notes, Amount) VALUES (?, ?, ?, ?, NOW(), ?, ?, 0);", [strPurchaseOrderID, intVendorID[0].VendorID, intStatus, strRequestedForID[0].EmployeeID, intCreatedBy, strNotes]);

		res.json({"message": "Success.", "status": 200});
	} finally {
		await dbConnection.close();
	}
});

// ========================================================
// 						 READ
// ========================================================

app.post("/getUserName", async (req, res) => {
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const UserName = await getUserNameBySessionToken(uuidSessionToken);
	var userID = await getUserIDBySessionToken(uuidSessionToken);
	
	res.json({"message": "Success.", "status": 200, "UserName": UserName, "UserID": userID});
});

app.post("/login", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const strUserName = clean(req.body.strUserName);
	const strPassword = clean(req.body.strPassword);

	var strHashedPassword = crypto.createHash("sha256").update(strPassword).digest("hex");
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

		const intUserId = usersQuery[0].EmployeeID;

		await dbConnection.query("INSERT INTO tblSessions (UserID, ID, timeIn) VALUE (?, ?, NOW());", [intUserId, uuidSessionToken]);
	} finally {
		await dbConnection.end();
	}
});

app.post("/fillPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Filling the PO Table");

		POTable = await dbConnection.query("select tblPurchaseOrder.PurchaseOrderID, tblPurchaseOrder.VendorID, tblPurchaseOrder.Status, rf.DisplayName as RequestedFor, tblPurchaseOrder.CreatedDateTime, cb.DisplayName as CreatedBy, tblPurchaseOrder.Notes, tblPurchaseOrder.Amount, tblVendor.VendorName from tblPurchaseOrder inner join tblUser rf on tblPurchaseOrder.RequestedFor = rf.EmployeeID inner join tblUser cb on tblPurchaseOrder.CreatedBy = cb.EmployeeID inner join tblVendor on tblPurchaseOrder.VendorID = tblVendor.VendorID;");
		if (POTable.length == 0) 
			return res.json({"message": "There are no purchase orders.", "status": 500});

		/*
		// Replace the IDs with the actual names for Vendors, CreatedBy, and RequestedFor
		for (let i = 0; i < POTable.length; i++) {
			const VendorQuery = await dbConnection.query("SELECT VendorName FROM tblVendor WHERE VendorID=?;", [POTable[i].VendorID]);
			POTable[i].VendorName = VendorQuery[0].VendorName
		}
		for (let i = 0; i < POTable.length; i++) {
			const CreatedByQuery = await dbConnection.query("SELECT DisplayName FROM tblUser WHERE EmployeeID=?;", [POTable[i].CreatedBy]);
			POTable[i].CreatedBy = CreatedByQuery[0].DisplayName
		}
		for (let i = 0; i < POTable.length; i++) {
			if (POTable[i].RequestedFor == "")
				POTable[i].RequestedFor = "N/A";
			else {
				const RequestedForQuery = await dbConnection.query("SELECT DisplayName FROM tblUser WHERE EmployeeID=?;", [parseInt(POTable[i].RequestedFor, 10)]);
				POTable[i].RequestedFor = RequestedForQuery[0].DisplayName
			}
		}
		*/

		res.json({"message": "Success.", "status": 200, "POTable": POTable});

	} finally {
		await dbConnection.close();
	}
});

app.post("/fillAccountTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Filling the Accounts Table");

		const AccountTable = await dbConnection.query("SELECT * FROM tblAccount;");

		if (AccountTable.length == 0) {
			return res.json({"message": "There are no accounts.", "status": 500});
		} else {
			// If there are Accounts, list them
			res.json({"message": "Success.", "status": 200, "AccountTable": AccountTable});
		}

	} finally {
		await dbConnection.close();
	}
});

app.post("/fillVendorTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Filling the Vendors Table");

		const VendorTable = await dbConnection.query("SELECT * FROM tblVendor;");

		if (VendorTable.length == 0) {
			return res.json({"message": "There are no vendors.", "status": 500});
		} else {
			// If there are Vendors, list them
			res.json({"message": "Success.", "status": 200, "VendorTable": VendorTable});
		}

	} finally {
		await dbConnection.close();
	}
});

app.post("/fillNewPOModal", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Filling the New PO Modal");

		const VendorNames = await dbConnection.query("SELECT VendorName FROM tblVendor;");
		const Users = await dbConnection.query("SELECT DisplayName FROM tblUser;");

		res.json({"message": "Success.", "status": 200, "VendorNames": VendorNames, "Users": Users});

	} finally {
		await dbConnection.close();
	}
});

app.post("/getPOInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Getting PO Info for " + strPurchaseOrderID);

		const POInfo = await dbConnection.query("SELECT * FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

		if (POInfo.length == 0) {
			return res.json({"message": "There is no purchase order with that ID.", "status": 500});
		} else {
			// If there is a PO with that ID, list it
			res.json({"message": "Success.", "status": 200, "POInfo": POInfo});
		}

	} finally {
		await dbConnection.close();
	}
});

app.post("/getAccountInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try{
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Getting Account Info for " + strAccountID);

		const AccountInfo = await dbConnection.query("SELECT * FROM tblAccount WHERE AccountID=?;", [strAccountID]);

		if(AccountInfo.length == 0) {
			return res.json({"message": "There is no account with that ID.", "status": 500});
		} else {
			res.json({"message": "Success.", "status": 200, "AccountInfo": AccountInfo});
		}
	} finally {
		await dbConnection.close();
	}
});

app.post("/getVendorInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorID = clean(req.body.strVendorID);

	try{
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Getting Vendor Info for " + strVendorID);

		const VendorInfo = await dbConnection.query("SELECT * FROM tblVendor WHERE VendorID=?;", [strAccountID]);

		if(VendorInfo.length == 0) {
			return res.json({"message": "There is no vendor with that ID.", "status": 500});
		} else {
			res.json({"message": "Success.", "status": 200, "VendorInfo": VendorInfo});
		}
	} finally {
		await dbConnection.close();
	}
});

// ========================================================
// 						 UPDATE
// ========================================================

// ========================================================
// 						 DELETE
// ========================================================

app.delete("/logout", async (req, res) => {
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

app.delete("/deletePO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}

		console.log("Deleting PO " + strPurchaseOrderID);

		await dbConnection.query("DELETE FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

		res.json({"message": "Success.", "status": 200});
	} finally {
		await dbConnection.close();
	}
});

app.post("/status", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.json({"message": "You must be logged in to do that", "status": 400});
		}
		
		var poRows = await dbConnection.query("SELECT COUNT(*) FROM tblPurchaseOrder;");
		var vendorRows = await dbConnection.query("SELECT COUNT(*) FROM tblVendor;");
		var accountRows = await dbConnection.query("SELECT COUNT(*) FROM tblAccount;");

		//console.log(poRows[0]["COUNT(*)"]);

		res.json({"message": "OK", "status": 200, "poRows": parseInt(poRows[0]["COUNT(*)"]), "vendorRows": parseInt(vendorRows[0]["COUNT(*)"]), "accountRows": parseInt(accountRows[0]["COUNT(*)"])});
	} finally {
		await dbConnection.close();
	}
});
