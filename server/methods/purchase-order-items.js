var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, clean_base64, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

// Add PO item
router.post("/addPOItem", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	const intAccountID = clean(req.body.intAccountID);
	const strDescription = clean(req.body.strDescription);
	const intQuantity = clean(req.body.intQuantity);
	const floatPrice = clean(req.body.floatPrice);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}
		
		var lineNumberQuery = await dbConnection.query("select count(*)+1 as LineNumber from tblPurchaseOrderItem where PurchaseOrderID=?;", [strPurchaseOrderID]);
		var lineNumber = Number(lineNumberQuery[0].LineNumber);

		await dbConnection.query("insert into tblPurchaseOrderItem (PurchaseOrderID, LineNumber, AccountID, Description, Quantity, Price) values (?, ?, ?, ?, ?, ?);", [strPurchaseOrderID, lineNumber, intAccountID, strDescription, intQuantity, floatPrice]);

		await updateActivityLog(uuidSessionToken, "Added item to PO " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Update PO item
router.post("/updatePOItem", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const intItemID = clean(req.body.intItemID);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	
	// optionals
	const intAccountID = clean(req.body.intAccountID);
	const strDescription = clean(req.body.strDescription);
	const intQuantity = clean(req.body.intQuantity);
	const floatPrice = clean(req.body.floatPrice);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Editing PO Item " + intItemID);

		if (req.body.intAccountID != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrderItem SET AccountID=? WHERE ID=?;", [intAccountID, intItemID]);
		} 
		if (req.body.strDescription != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrderItem SET Description=? WHERE ID=?;", [strDescription, intItemID]);
		}
		if (req.body.intQuantity != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrderItem SET Quantity=? WHERE ID=?;", [intQuantity, intItemID]);
		}
		if (req.body.floatPrice != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrderItem SET Price=? WHERE ID=?;", [floatPrice, intItemID]);
		}

		await updateActivityLog(uuidSessionToken, "Edited Item " + intItemID + " for " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// Add PO item
router.delete("/deletePOItem", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intItemID = clean(req.body.intItemID);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		await dbConnection.query("delete from tblPurchaseOrderItem where ID=?;", [intItemID]);

		await updateActivityLog(uuidSessionToken, "Deleted item " + intItemID + " from PO " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for filling PO Item table on viewPO page
router.post("/fillPOItemTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the PO Item Table");

		const POItemTable = await dbConnection.query("select poi.ID, poi.AccountID, poi.Description, poi.Quantity, case when poi.Quantity = 0 then poi.Price else round(poi.Price / poi.Quantity, 2) end as PriceEach, poi.Price from tblPurchaseOrderItem poi where poi.PurchaseOrderID=?;", [strPurchaseOrderID]);
		if (POItemTable.length == 0) {
			return res.status(500).json({ "message": "There are no purchase order items." });
		} else { // If there are items, list them
			res.status(200).json({ "message": "Success.", "POItemTable": POItemTable });
		}

	} finally {
		await dbConnection.close();
	}
});

module.exports = router;

