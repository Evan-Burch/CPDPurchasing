var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken} = require("./helper.js");

router.post("/addAccount", async (req, res) => {
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

router.post("/fillAccountTable", async (req, res) => {
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

  
	// HB TODO Note: currently fills with many "unknowns" so check if SQL is correct
  router.post("/fillNewAccountModal", async (req, res) => {
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

router.post("/getAccountInfo", async (req, res) => {
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


router.delete("/deleteAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intAccountID = req.body.intAccountID;
	
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

module.exports = router;
