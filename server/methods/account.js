var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

router.post("/addAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intAccountNumber = clean(req.body.intAccountNumber);
	const strDescription = clean(req.body.strDescription);
	const strFiscalAuthority = clean(req.body.strFiscalAuthority);
	const strDivision = clean(req.body.strDivision);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		let strErrorMessage = '';

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
		} if (strErrorMessage.length > 0) {
			return res.status(400).json({ "message": strErrorMessage });
		}

		var duplicate = await dbConnection.query("SELECT * FROM tblAccount WHERE AccountID=?;", [intAccountNumber]);
		if (duplicate.length != 0) {
			return res.status(400).json({ "message": "Account " + intAccountNumber + " already exists." });
		}

		console.log("Creating a new Account: ", intAccountNumber, ", ", strDescription, ", ", strFiscalAuthority, ", ", strDivision);

		await dbConnection.query("INSERT INTO tblAccount (AccountID, Description, FiscalAuthority, DivisionID, Status) VALUES (?, ?, ?, ?, 1);", [intAccountNumber, strDescription, strFiscalAuthority, strDivision]);

		await updateActivityLog(uuidSessionToken, "Added account " + intAccountNumber + ".", intAccountNumber);

		res.status(200).json({ "message": "Success." });

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

router.post("/fillAccountBudgetTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Accounts Budget Table");

		const AccountBudgetTable = await dbConnection.query("select act.FiscalYear, actt.Description as AccountType, act.Amount, DATE_FORMAT(act.DateCreated, '%m/%d/%Y %h:%i %p') as DateCreated from tblAccountTransaction act left join tblAccountTransactionType actt on actt.ID = act.AccountType where act.AccountID=?;", [strAccountID]);
		if (AccountBudgetTable.length == 0) {
			return res.status(500).json({ "message": "There is no account budget information." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountBudgetTable": AccountBudgetTable });
		}

	} finally {
		await dbConnection.close();
	}
});

router.post("/fillAccountPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Account POs Table");

		const AccountPOTable = await dbConnection.query("select distinct po.PurchaseOrderID, DATE_FORMAT(po.CreatedDateTime, '%m/%d/%Y %h:%i %p') as DateCreated, ven.VendorName, usr.DisplayName as CreatedBy, po.Amount, actt.FiscalYear from tblPurchaseOrder po left join tblPurchaseOrderItem poi on po.PurchaseOrderID = poi.PurchaseOrderID left join tblAccountTransaction actt on poi.AccountID = actt.AccountID left join tblVendor ven on po.VendorID = ven.VendorID left join tblUser usr on po.CreatedBy = usr.EmployeeID where actt.FiscalYear - YEAR(po.CreatedDateTime) = 1 and actt.AccountID=?;", [strAccountID]);

		if (AccountPOTable.length == 0) {
			return res.status(500).json({ "message": "There is no account PO information." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountPOTable": AccountPOTable });
		}

	} finally {
		await dbConnection.close();
	}
});

router.post("/fillNewAccountModal", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	try {
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

router.post("/getAccountInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting Account Info for " + strAccountID);

		const AccountInfo = await dbConnection.query("select tblAccount.AccountID, tblAccount.Description, tblUser.DisplayName as FiscalAuthority, tblAccount.DivisionID, tblAccount.Status from tblAccount left join tblUser on tblAccount.FiscalAuthority = tblUser.EmployeeID where tblAccount.AccountID=?;", [strAccountID]);

		if (AccountInfo.length == 0) {
			return res.status(500).json({ "message": "There is no account with that ID." });
		} else {
			res.status(200).json({ "message": "Success.", "AccountInfo": AccountInfo });
		}
		
	} finally {
		await dbConnection.close();
	}
});


router.delete("/deleteAccount", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intAccountID = clean(req.body.intAccountID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Deleting Account " + intAccountID);

		await dbConnection.query("DELETE FROM tblAccount WHERE AccountID=?;", [intAccountID]);

		await updateActivityLog(uuidSessionToken, "Deleted account " + intAccountID + ".", intAccountID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
