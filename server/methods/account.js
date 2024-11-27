var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

// Call for adding account
router.post("/addAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intAccountNumber = clean(req.body.intAccountNumber);
	const strDescription = clean(req.body.strDescription);
	const strFiscalAuthority = clean(req.body.strFiscalAuthority);
	const strDivision = clean(req.body.strDivision);
	const floatBudget = clean(req.body.floatBudget);

	let strErrorMessage = '';

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Error checking
		if (intAccountNumber == '') {
			strErrorMessage += "<p>Please specify an account number</p>";
		} if (strDescription == '') {
			strErrorMessage += "<p>Please specify a description</p>";
		} if (strDescription.length > 100) {
			strErrorMessage += "<p>Description is too long</p>";
		} if (strFiscalAuthority == 'Fiscal Authority') {
			strErrorMessage += "<p>Please specify a fiscal authority</p>";
		} if (strFiscalAuthority.length > 100) {
			strErrorMessage += "<p>Fiscal authority is too long</p>";
		} if (strDivision == null) {
			strErrorMessage += "<p>Please specify a division</p>";
		} if (strDivision.length > 100) {
			strErrorMessage += "<p>Division is too long</p>";
		} if (strErrorMessage.length > 0) { // Error message
			return res.status(400).json({ "message": strErrorMessage });
		}

		// Checking for duplicate account
		var duplicate = await dbConnection.query("SELECT * FROM tblAccount WHERE AccountID=?;", [intAccountNumber]);
		if (duplicate.length != 0) {
			return res.status(400).json({ "message": "Account " + intAccountNumber + " already exists." });
		}

		console.log("Creating a new Account: ", intAccountNumber, ", ", strDescription, ", ", strFiscalAuthority, ", ", strDivision);

		await dbConnection.query("INSERT INTO tblAccount (AccountID, Description, FiscalAuthority, DivisionID, Status) VALUES (?, ?, ?, ?, 1);", [intAccountNumber, strDescription, strFiscalAuthority, strDivision]);
		
		console.log("Adding budget of " + floatBudget + " for Account: " + intAccountNumber);
		await dbConnection.query("insert into tblAccountTransaction (AccountID, DateCreated, AccountType, Amount, FiscalYear, CreatedBy) values (?, NOW(), 1, ?, DATE_FORMAT(NOW(), '%Y'), ?);", [intAccountNumber, floatBudget, userID]);

		await updateActivityLog(uuidSessionToken, "Added account " + intAccountNumber + ".", intAccountNumber);

		res.status(200).json({ "message": "Success." });

	} finally {
		await dbConnection.close();
	}
});

// Call for filling account table on Account page
router.post("/fillAccountTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Accounts Table");

		const AccountTable = await dbConnection.query("select tblAccount.AccountID, tblAccount.Description, tblUser.DisplayName as FiscalAuthority, tblAccount.DivisionID, tblAccount.Status from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID;");

		if (AccountTable.length == 0) {
			return res.status(500).json({ "message": "There are no accounts." });
		} else { // If there are Accounts, list them
			res.status(200).json({ "message": "Success.", "AccountTable": AccountTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for filling account budget table on viewAccount page
router.post("/fillAccountBudgetTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Accounts Budget Table");

		const AccountBudgetTable = await dbConnection.query("select act.FiscalYear, actt.Description as AccountType, act.Amount, DATE_FORMAT(act.DateCreated, '%m/%d/%Y %h:%i %p') as DateCreated from tblAccountTransaction act left join tblAccountTransactionType actt on actt.ID = act.AccountType where act.AccountID=?;", [strAccountID]);

		// Check for available info
		if (AccountBudgetTable.length == 0) {
			return res.status(500).json({ "message": "There is no account budget information." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountBudgetTable": AccountBudgetTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for filling Account PO table on viewAccount page
router.post("/fillAccountPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Account POs Table");

		const AccountPOTable = await dbConnection.query("select distinct po.PurchaseOrderID, DATE_FORMAT(po.CreatedDateTime, '%m/%d/%Y %h:%i %p') as DateCreated, ven.VendorName, usr.DisplayName as CreatedBy, po.Amount from tblPurchaseOrder po left join tblPurchaseOrderItem poi on po.PurchaseOrderID = poi.PurchaseOrderID left join tblAccountTransaction actt on poi.AccountID = actt.AccountID left join tblVendor ven on po.VendorID = ven.VendorID left join tblUser usr on po.CreatedBy = usr.EmployeeID where actt.AccountID=?;", [strAccountID]);

		// Check for available info
		if (AccountPOTable.length == 0) {
			return res.status(500).json({ "message": "There is no account PO information." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountPOTable": AccountPOTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for filling out selection boxes on account modals
router.post("/fillNewAccountModal", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the New account Modal");

		const FiscalAuthorities = await dbConnection.query("select distinct tblAccount.FiscalAuthority as FiscalAuthorityID, tblUser.DisplayName as FiscalAuthority from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID;");
		const Divisions = await dbConnection.query("select * from tblDivision;");

		res.status(200).json({ "message": "Success.", "FiscalAuthorities": FiscalAuthorities, "Divisions": Divisions });
	} finally {
		await dbConnection.close();
	}
});

// Call for getting account info to display on page
router.post("/getAccountInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting Account Info for " + strAccountID);

		const AccountInfo = await dbConnection.query("select tblAccount.AccountID, tblAccount.Description, tblUser.DisplayName as FiscalAuthority, tblAccount.DivisionID, tblAccount.Status from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID where tblAccount.AccountID=?;", [strAccountID]);

		// Check for available info
		if (AccountInfo.length == 0) {
			return res.status(500).json({ "message": "There is no account with that ID." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountInfo": AccountInfo });
		}
		
	} finally {
		await dbConnection.close();
	}
});

// Call for updating account
router.put("/updateAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intAccountID = clean(req.body.intAccountID);
	const strDescription = clean(req.body.strDescription);
	const strFiscal = clean(req.body.strFiscal);
	const strDivision = clean(req.body.strDivision);
	const floatBudget = clean(req.body.floatBudget);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Editing Account " + intAccountID);

		// Update as long as info is present
		if (strDescription != '') {
			await dbConnection.query("UPDATE tblAccount SET Description=? WHERE AccountID=?", [strDescription, intAccountID]);
		} if (strFiscal != 0) {
			await dbConnection.query("UPDATE tblAccount SET FiscalAuthority=? WHERE AccountID=?", [strFiscal, intAccountID]);
		} if (strDivision != 'NA') {
			await dbConnection.query("UPDATE tblAccount SET DivisionID=? WHERE AccountID=?", [strDivision, intAccountID]);
		}
		if (req.body.floatBudget != undefined) {
			await dbConnection.query("UPDATE tblAccountTransaction SET Amount=? WHERE AccountID=? and FiscalYear=DATE_FORMAT(NOW(), '%Y');", [floatBudget, intAccountID]);
		}

		await updateActivityLog(uuidSessionToken, "Edited account " + intAccountID + ".", intAccountID);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting an account
router.delete("/deleteAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intAccountID = clean(req.body.intAccountID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Deleting Account " + intAccountID);

		await dbConnection.query("DELETE FROM tblAccountTransaction WHERE AccountID=?;", [intAccountID]);
		await dbConnection.query("DELETE FROM tblPurchaseOrderItem WHERE AccountID=?;", [intAccountID]);
		await dbConnection.query("DELETE FROM tblAccount WHERE AccountID=?;", [intAccountID]);

		await updateActivityLog(uuidSessionToken, "Deleted account " + intAccountID + ".", intAccountID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
