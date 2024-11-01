var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken } = require("./helper.js");

// Call for filling the reports for account
router.post("/fillReportsTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const intYear = clean(req.body.intYear);

	const strLike = "42-" + intYear % 100 + "%"; // last two digits of year plus 42- prefix

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Reports Table");

		const AccountIDs = await dbConnection.query("select AccountID, Amount from tblAccountTransaction where FiscalYear=?;", [intYear]);

		if (AccountIDs.length == 0) {
			return res.status(500).json({ "message": "There are no accounts for year " + intYear + "." });
		}

		var reports = [];

		for (var i = 0; i < AccountIDs.length; i++) {
			var report = { AccountID: AccountIDs[i].AccountID, Budget: AccountIDs[i].Amount };

			// D the sum of the expenses for this account for this year
			const expensesQuery = await dbConnection.query("select sum(Price) as Expenses from tblPurchaseOrderItem where AccountID=? and PurchaseOrderID like ?;", [report.AccountID, strLike]);
			report.Expenses = expensesQuery[0].Expenses;
			if (report.Expenses == null) {
				report.Expenses = 0.0;
			}
			report.Available = parseFloat(parseFloat(report.Budget) - parseFloat(report.Expenses)).toFixed(2);

			// Find out what this account is all about
			const accountInfoQuery = await dbConnection.query("select tblAccount.Description as AccountDescription, tblDivision.Description as DivisionDescription from tblAccount left join tblDivision on tblAccount.DivisionID = tblDivision.ID where AccountID=?;", [report.AccountID]);

			if (accountInfoQuery.length != 0) {
				report.AccountDescription = accountInfoQuery[0].AccountDescription;
				report.DivisionDescription = accountInfoQuery[0].DivisionDescription;
			} else {
				report.AccountDescription = "";
				report.DivisionDescription = "";
			}

			reports.push(report);
		}

		res.status(200).json({ "message": "Success.", "Reports": reports });

	} finally {
		await dbConnection.close();
	}
});

// Call for getting report
router.post("/getReport", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strAccountID = clean(req.body.strAccountID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting report for " + strAccountID);

		const BudgetInfo = await dbConnection.query("select Amount, FiscalYear from tblAccountTransaction where AccountID=?;", [strAccountID]);

		if (BudgetInfo.length == 0) {
			return res.status(500).json({ "message": "There's no data for account " + strAccountID + "." });
		}

		var report = { Budget: BudgetInfo[BudgetInfo.length - 1].Amount }; // we want the most recent year

		const strLike = "42-" + BudgetInfo[BudgetInfo.length - 1].FiscalYear % 100 + "%"; // last two digits of year plus 42- prefix

		// Do the sum of the expenses for this account for this year
		const expensesQuery = await dbConnection.query("select sum(Price) as Expenses from tblPurchaseOrderItem where AccountID=? and PurchaseOrderID like ?;", [strAccountID, strLike]);
		report.Expenses = expensesQuery[0].Expenses;
		if (report.Expenses == null) {
			report.Expenses = 0.0;
		}
		report.Available = parseFloat(parseFloat(report.Budget) - parseFloat(report.Expenses)).toFixed(2);

		res.status(200).json({ "message": "Success.", "Report": report });

	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
