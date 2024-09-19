var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken} = require("./helper.js");

router.post("/addPO", async (req, res) => {
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

		console.log("Creating a new PO");

		const intRequestedForID = await dbConnection.query("SELECT EmployeeID FROM tblUser WHERE DisplayName=?;", [strRequestedFor]);
		const intVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		await dbConnection.query("INSERT INTO tblPurchaseOrder (VendorID, Status, RequestedFor, CreatedDateTime, CreatedBy, Notes, Amount) VALUES (?, ?, ?, NOW(), ?, ?, 0);", [intVendorID[0].VendorID, intStatus, intRequestedForID[0].EmployeeID, intCreatedBy, strNotes]);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

router.post("/fillPOTable", async (req, res) => {
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

router.post("/fillNewPOModal", async (req, res) => {
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

router.post("/getPOInfo", async (req, res) => {
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

router.delete("/deletePO", async (req, res) => {
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

module.exports = router;
