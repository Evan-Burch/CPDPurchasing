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
	exec(`bash '/home/admin/Hubble/deploy.sh' ${process.pid}`, (error, stdout, stderr) => {
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

	const strVendorName = clean(req.body.strVendorName);
	const intStatus = req.body.intStatus;
	const strRequestedFor = clean(req.body.strRequestedFor); 
	const intCreatedBy = req.body.intCreatedBy;
	const strNotes = clean(req.body.strNotes);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);

		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		//server side error checking
		let strErrorMessage = '';

		if(strPurchaseOrderID == '') {
			strErrorMessage = strErrorMessage + "<p>Please specify a purchase order ID.</p>";
		}

		if(strPurchaseOrderID.length > 50) {
			strErrorMessage = strErrorMessage + "<p>purchase order id is too long</p>";
		}

		if(strVendorName == 'Select Vendor') {
			strErrorMessage = strErrorMessage + "<p>Please specify a vendor.</p>";
		}

		if(strVendorName.length > 50) {
			strErrorMessage = strErrorMessage + "<p>vendor name is too long</p>";
		}

		if(strRequestedFor == 'Select Requested For') {
			strErrorMessage = strErrorMessage + "<p>Please specify a requestor.</p>";
		}

		if(strRequestedFor.length > 50) {
			strErrorMessage = strErrorMessage + "<p>requested for is too long</p>";
		}

		if(strNotes.length > 100) {
			strErrorMessage = strErrorMessage + "<p>Woah! That is a long note! please shorten it to a few sentences or less.</p>";
		}

		if (strErrorMessage.length>0) {
			return res.status(400).json({"message": strErrorMessage});
		}

		var duplicate = await dbConnection.query("SELECT * FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);
		if (duplicate.length != 0) {
			return res.status(400).json({"message": `Purchase Order ${strPurchaseOrderID} already exists.`});
		}

		console.log("Creating a new PO");

		const intRequestedForID = await dbConnection.query("SELECT EmployeeID FROM tblUser WHERE DisplayName=?;", [strRequestedFor]);
		const intVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		await dbConnection.query("INSERT INTO tblPurchaseOrder (VendorID, Status, RequestedFor, CreatedDateTime, CreatedBy, Notes, Amount) VALUES (?, ?, ?, NOW(), ?, ?, 0);", [intVendorID[0].VendorID, intStatus, intRequestedForID[0].EmployeeID, intCreatedBy, strNotes]);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});


app.post("/addVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strVendorName = clean(req.body.strVendorName);
	const strLink = clean(req.body.strVendorLink);
	const strVendorContactName = clean(req.body.strVendorContactName);
	const intCreatedBy = req.body.intCreatedBy;


	let strVendorID = 123;
	let strVendorContactID = 124;
	
	//server side error checking
	let strErrorMessage = '';

	if(strVendorName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a vendor name.</p>";
	  }

	  if(strVendorName.length > 50) {
		strErrorMessage = strErrorMessage + "<p>vendor name is too long</p>";
	  }

	  if(strVendorLink == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a link.</p>";
	  }

	  if(strVendorLink.length > 100) {
		strErrorMessage = strErrorMessage + "<p>link is too long</p>";
	  }

	  if(strVendorContactName.length > 50) {
		strErrorMessage = strErrorMessage + "<p>contact name is too long</p>";
	  }

	  if(strVendorContactName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a contact name.</p>";
	  }

	if(strErrorMessage.length>0) {
		return res.status(400).json({"message":strErrorMessage});
	}

	//HB TODO: check if vendor already exists
	console.log('backend create vendor: ', strVendorName, ", ", strLink);

	try {
	  console.log('backend create vendor: ', strVendorName, ", ", strLink, ", ", strVendorContactName);
  
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Creating new Vendor: " + strVendorName);

		// Figure out what the next auto-increment ID is for tblVendorContact so we can use it for tblVendor
		const intVendorContactID = await dbConnection.query("SELECT MAX(ID) AS maxID FROM tblVendorContact;");
		const insertVendorResult = await dbConnection.query("INSERT INTO tblVendor (VendorName, Website, Status, VendorContactID) VALUES (?, ?, 1, ?);", [strVendorName, strLink, intVendorContactID[0].maxID + 1]);
		
		console.log("Creating new VendorContact: " + strVendorContactName);

		// Get the ID of the newly inserted vendor to use for tblVendorContact
		const intVendorID = insertVendorResult.insertId;
		await dbConnection.query("INSERT INTO tblVendorContact (ID, VendorID, Name, `Primary`, DateAdded, CreatedBy, Status) VALUES (?, ?, ?, 1, NOW(), ?, 1);", [intVendorContactID[0].maxID + 1, intVendorID, strVendorContactName, intCreatedBy]);

    	res.json({"message": "Success.", "status": 200});
	} finally {
		await dbConnection.close();
	}
});
    
app.post("/addAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intAccountNumber = req.body.intAccountNumber;
	const strDescription = clean(req.body.strDescription);
	const strFiscalAuthority = clean(req.body.strFiscalAuthority);
	const strDivision = clean(req.body.strDivision);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		//server side error checking
		let strErrorMessage = '';

		if(intAccountNumber=='') {
			strErrorMessage = strErrorMessage + "<p>Please specify an account number</p>";
		}
    
		if(strDescription=='') {
			strErrorMessage = strErrorMessage + "<p>Please specify a description</p>";
		}

		if(strDescription.length > 100) {
			strErrorMessage = strErrorMessage + "<p>Description is too long</p>";
		}

		if(strFiscalAuthority=='Fiscal Authority') {
			strErrorMessage = strErrorMessage + "<p>Please specify a fiscal authority</p>";
		}

		if(strFiscalAuthority>100) {
			strErrorMessage = strErrorMessage + "<p>Fiscal authority is too long</p>";
		}

		if(strDivision=='') {
			strErrorMessage = strErrorMessage + "<p>Please specify a division</p>";
		}

		if(strDivision>100) {
			strErrorMessage = strErrorMessage + "<p>Division is too long</p>";
		}

		if(strErrorMessage.length>0) {
			return res.status(400).json({"message":strErrorMessage});
		}

		var duplicate = await dbConnection.query("SELECT * FROM tblAccount WHERE AccountID=?;", [intAccountNumber]);
		if (duplicate.length != 0) {
			return res.status(400).json({"message": `Account ${intAccountNumber} already exists.`});
		}

		console.log("Creating a new Account: ", intAccountNumber, ", ", strDescription, ", ", strFiscalAuthority, ", ", strDivision);

		const intFiscalAuthorityID = await dbConnection.query("SELECT EmployeeID FROM tblUser WHERE DisplayName=?;", [strFiscalAuthority]);

		await dbConnection.query("INSERT INTO tblAccount (AccountID, Description, FiscalAuthority, DivisionID, Status) VALUES (?, ?, ?, ?, 1);", [intAccountNumber, strDescription, intFiscalAuthorityID[0].EmployeeID, strDivision]);

		res.status(200).json({"message": "Success."});
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
	
	res.status(200).json({"message": "Success.", "UserName": UserName, "UserID": userID});
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
			return res.status(400).json({"message": "Incorrect or missing email/password."});
		}
		
		console.info("Successful login for user " + strUserName);

		var uuidSessionToken = crypto.randomUUID();
		console.log("User " + strUserName + "'s session token is " + uuidSessionToken);

		res.status(200).json({"message": "Success. Logging you in.", "uuidSessionToken": uuidSessionToken});

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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Filling the PO Table");

		POTable = await dbConnection.query("select tblPurchaseOrder.PurchaseOrderID, tblPurchaseOrder.VendorID, tblPurchaseOrder.Status, rf.DisplayName as RequestedFor, DATE_FORMAT(tblPurchaseOrder.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDateTime, cb.DisplayName as CreatedBy, tblPurchaseOrder.Notes, tblPurchaseOrder.Amount, tblVendor.VendorName from tblPurchaseOrder left join tblUser rf on tblPurchaseOrder.RequestedFor = rf.EmployeeID left join tblUser cb on tblPurchaseOrder.CreatedBy = cb.EmployeeID left join tblVendor on tblPurchaseOrder.VendorID = tblVendor.VendorID;");
		if (POTable.length == 0) {
			return res.status(500).json({"message": "There are no purchase orders."});
		}

		res.status(200).json({"message": "Success.", "POTable": POTable});

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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Filling the Accounts Table");

		const AccountTable = await dbConnection.query("select tblAccount.AccountID, tblAccount.Description, tblUser.DisplayName as FiscalAuthority, tblAccount.DivisionID, tblAccount.Status from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID;");

		if (AccountTable.length == 0) {
			return res.status(500).json({"message": "There are no accounts."});
		} else {
			// If there are Accounts, list them
			res.status(200).json({"message": "Success.", "AccountTable": AccountTable});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Filling the Vendors Table");

		const VendorTable = await dbConnection.query("SELECT * FROM tblVendor;");

		if (VendorTable.length == 0) {
			return res.status(500).json({"message": "There are no vendors."});
		} else {
			// If there are Vendors, list them
			res.status(200).json({"message": "Success.", "VendorTable": VendorTable});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Filling the New PO Modal");

		const VendorNames = await dbConnection.query("SELECT VendorName FROM tblVendor;");
		const Users = await dbConnection.query("SELECT DisplayName FROM tblUser;");

		res.status(200).json({"message": "Success.", "VendorNames": VendorNames, "Users": Users});

	} finally {
		await dbConnection.close();
	}
});

  
	// HB TODO Note: currently fills with many "unknowns" so check if SQL is correct
  app.post("/fillNewAccountModal", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Filling the New account Modal");

		const FiscalAuthorities = await dbConnection.query("SELECT FiscalAuthority FROM tblAccount;");

		res.status(200).json({"message": "Success.", "FiscalAuthorities": FiscalAuthorities});
	} finally {
		await dbConnection.close();
	}
});


app.post("/getPOInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try{
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Getting PO Info for " + strPurchaseOrderID);

		const POInfo = await dbConnection.query("select tblPurchaseOrder.PurchaseOrderID, tblPurchaseOrder.VendorID, tblPurchaseOrder.Status, rf.DisplayName as RequestedFor, DATE_FORMAT(tblPurchaseOrder.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDateTime, cb.DisplayName as CreatedBy, tblPurchaseOrder.Notes, tblPurchaseOrder.Amount, tblVendor.VendorName from tblPurchaseOrder left join tblUser rf on tblPurchaseOrder.RequestedFor = rf.EmployeeID left join tblUser cb on tblPurchaseOrder.CreatedBy = cb.EmployeeID left join tblVendor on tblPurchaseOrder.VendorID = tblVendor.VendorID where tblPurchaseOrder.PurchaseOrderID=?;", [strPurchaseOrderID]);

		if (POInfo.length == 0) {
			return res.status(500).json({"message": "There is no purchase order with that ID."});
		} else {
			// If there is a PO with that ID, list it
			res.status(200).json({"message": "Success.", "POInfo": POInfo});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Getting Account Info for " + strAccountID);

		const AccountInfo = await dbConnection.query("select tblAccount.AccountID, tblAccount.Description, tblUser.DisplayName as FiscalAuthority, tblAccount.DivisionID, tblAccount.Status from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID where tblAccount.AccountID=?;", [strAccountID]);

		if(AccountInfo.length == 0) {
			return res.status(500).json({"message": "There is no account with that ID."});
		} else {
			res.status(200).json({"message": "Success.", "AccountInfo": AccountInfo});
		}
	} finally {
		await dbConnection.close();
	}
});

app.post("/getVendorInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try{
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Getting Vendor Info for " + strVendorName);

		const VendorInfo = await dbConnection.query("SELECT * FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		if(VendorInfo.length == 0) {
			return res.status(500).json({"message": "There is no vendor with that ID."});
		} else {
			res.status(200).json({"message": "Success.", "VendorInfo": VendorInfo});
		}
	} finally {
		await dbConnection.close();
	}
});

app.post("/getUserSettings", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		const settingsQuery = await dbConnection.query("SELECT * FROM tblUserSettings WHERE UserID=?;", [userID]);

		if (settingsQuery.length == 0) {
			return res.status(500).json({"message": "The user doesn't have any saved settings."});
		} else {
			var settingsArray = new Array();
			var settingsRaw = settingsQuery[0].Settings.split(",");
			
			if (settingsRaw.length % 2 != 0) {
				return res.status(500).json({"message": "Unable to properly parse user settings."});
			}
			for (var i = 0; i < settingsRaw.length - 1; i += 2) {
				var currentSetting = {};
				currentSetting[settingsRaw[i]] = settingsRaw[i + 1];
				settingsArray.push(currentSetting);
			}
			
			res.status(200).json({"message": "Success.", "user_settings": settingsArray});
		}

	} finally {
		await dbConnection.close();
	}
});

app.post("/updateUserSettings", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strKey = clean(req.body.strKey);
	const strValue = clean(req.body.strValue);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		const settingsQuery = await dbConnection.query("SELECT * FROM tblUserSettings WHERE UserID=?;", [userID]);

		if (settingsQuery.length == 0) {
			// They have no settings, so insert a new row and we're done
			await dbConnection.query("INSERT INTO tblUserSettings (UserID, Settings) VALUES (?, ?);", [userID, strKey + "," + strValue]);
			return res.status(200).json({"message": "Success."}); // created
		} else {
			var currentSettings = settingsQuery[0].Settings;
			var currentSettingsArray = currentSettings.split(",");
			var foundExistingKey = false;
			for (var i = 0; i < currentSettingsArray.length - 1; i++) {
				if (currentSettingsArray[i] == strKey) {
					currentSettingsArray[i + 1] = strValue;
					foundExistingKey = true;
					break;
				}
			}
			
			var newSettings = "";
			if (!foundExistingKey) {
				newSettings = currentSettings + "," + strKey + "," + strValue;
			} else {
				newSettings = currentSettingsArray.join(",");
			}
			
			//console.log(newSettings);
			
			if (currentSettings.split(",").length % 2 != 0) {
				return res.status(500).json({"message": "Unable to properly parse user settings."});
			}
			
			await dbConnection.query("UPDATE tblUserSettings SET Settings=? WHERE UserID=?;", [newSettings, userID]);
			
			res.status(200).json({"message": "Success."});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Session token " + uuidSessionToken + " wants to log out.");

		await dbConnection.query("DELETE FROM tblSessions where ID=?;", [uuidSessionToken]);

		res.status(200).json({"message": "Goodbye!"});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Deleting PO " + strPurchaseOrderID);

		await dbConnection.query("DELETE FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

app.delete("/deleteAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intAccountID = clean(req.body.intAccountID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Deleting Account " + intAccountID);

		await dbConnection.query("DELETE FROM tblAccount WHERE AccountID=?;", [intAccountID]);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

app.delete("/deleteVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Deleting Vendor " + strVendorName);

		await dbConnection.query("DELETE FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		res.status(200).json({"message": "Success."});
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
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var poRows = await dbConnection.query("SELECT COUNT(*) FROM tblPurchaseOrder;");
		var vendorRows = await dbConnection.query("SELECT COUNT(*) FROM tblVendor;");
		var accountRows = await dbConnection.query("SELECT COUNT(*) FROM tblAccount;");

		//console.log(poRows[0]["COUNT(*)"]);

		res.status(200).json({"message": "OK", "poRows": parseInt(poRows[0]["COUNT(*)"]), "vendorRows": parseInt(vendorRows[0]["COUNT(*)"]), "accountRows": parseInt(accountRows[0]["COUNT(*)"])});
	} finally {
		await dbConnection.close();
	}
});
