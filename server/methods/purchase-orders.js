var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

const POInfoQuery = "select tblPurchaseOrder.PurchaseOrderID, tblPurchaseOrder.VendorID, tblPurchaseOrder.Status, rf.DisplayName as RequestedFor, DATE_FORMAT(tblPurchaseOrder.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDateTime, cb.DisplayName as CreatedBy, tblPurchaseOrder.Notes, tblPurchaseOrder.Amount, tblVendor.VendorName, IFNULL(tblPOApprovals.IsApproved, 0) as IsApproved, fa.DisplayName as FiscalAuthority from tblPurchaseOrder left join tblUser rf on tblPurchaseOrder.RequestedFor = rf.EmployeeID left join tblUser cb on tblPurchaseOrder.CreatedBy = cb.EmployeeID left join tblVendor on tblPurchaseOrder.VendorID = tblVendor.VendorID left join tblPOApprovals on tblPurchaseOrder.PurchaseOrderID = tblPOApprovals.PurchaseOrderID left join tblUser fa on tblPOApprovals.FiscalAuthority = fa.EmployeeID WHERE tblPurchaseOrder.isArchived=0";
 
// Call for adding a new PO
router.post("/addPO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strVendorName = clean(req.body.strVendorName);
	const intStatus = clean(req.body.intStatus);
	const strRequestedFor = clean(req.body.strRequestedFor);
	const strFiscalAuthority = clean(req.body.strFiscalAuthority);
	const intCreatedBy = clean(req.body.intCreatedBy);
	const strNotes = clean(req.body.strNotes);

	let strErrorMessage = '';

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Error checking
		if (strVendorName == 'Select Vendor') {
			strErrorMessage += "<p>Please specify a vendor.</p>";
		} if (strVendorName.length > 50) {
			strErrorMessage += "<p>vendor name is too long</p>";
		} if (strRequestedFor == 'Select Requested For') {
			strErrorMessage += "<p>Please specify a requestor.</p>";
		} if (strRequestedFor.length > 50) {
			strErrorMessage += "<p>requested for is too long</p>";
		} if (strNotes.length > 100) {
			strErrorMessage += "<p>Woah! That is a long note! please shorten it to a few sentences or less.</p>";
		} if (strErrorMessage.length > 0) { // Error message
			return res.status(400).json({ "message": strErrorMessage });
		}

		console.log("Creating a new PO");

		await dbConnection.query("INSERT INTO tblPurchaseOrder (VendorID, Status, isArchived, RequestedFor, CreatedDateTime, CreatedBy, Notes, Amount) VALUES (?, ?, ?, ?, NOW(), ?, ?, 0);", [strVendorName, intStatus,0, strRequestedFor, intCreatedBy, strNotes]);

		var poIDQuery = await dbConnection.query("select PurchaseOrderID from tblPurchaseOrder where CreatedDateTime=NOW();"); // this might fail

		if (poIDQuery.length != 0) {
			await updateActivityLog(uuidSessionToken, "Added PO " + poIDQuery[0].PurchaseOrderID + ".", poIDQuery[0].PurchaseOrderID);
			
			await dbConnection.query("insert into tblPOApprovals (PurchaseOrderID, FiscalAuthority, IsApproved) values (?, ?, 0);", [poIDQuery[0].PurchaseOrderID, strFiscalAuthority]);
		}

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for filling the PO table on the page
router.post("/fillPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the PO Table");

		const POTable = await dbConnection.query(POInfoQuery + ";");

		if (POTable.length == 0) {
			return res.status(500).json({ "message": "There are no purchase orders." });
		} else { // If there are POs, list them
			res.status(200).json({ "message": "Success.", "POTable": POTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for filling modal dropdown boxes
router.post("/fillNewPOModal", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the New PO Modal");

		const Vendors = await dbConnection.query("select distinct VendorID, VendorName from tblVendor;");
		const Users = await dbConnection.query("select distinct EmployeeID, DisplayName from tblUser;");

		res.status(200).json({ "message": "Success.", "Vendors": Vendors, "Users": Users });

	} finally {
		await dbConnection.close();
	}
});

// Call for getting PO info to display on page
router.post("/getPOInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting PO Info for " + strPurchaseOrderID);

		const POInfo = await dbConnection.query(POInfoQuery + " AND tblPurchaseOrder.PurchaseOrderID=?;", [strPurchaseOrderID]);

		if (POInfo.length == 0) {
			return res.status(500).json({ "message": "There is no purchase order with that ID." });
		} else { // If there is a PO with that ID, list it
			res.status(200).json({ "message": "Success.", "POInfo": POInfo });
		}
	} finally {
		await dbConnection.close();
	}
});

router.put("/updatePO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const PurchaseOrderID = clean(req.body.PurchaseOrderID);

	const intVendorID = clean(req.body.intVendorID);
	const intRequestedFor = clean(req.body.intRequestedFor);
	const intFiscalAuthority = clean(req.body.intFiscalAuthority);
	const strNotes = clean(req.body.strNotes);
	const boolStatus = clean(req.body.boolStatus);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Editing Account " + PurchaseOrderID);

		if (req.body.intVendorID != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrder SET VendorID=? WHERE PurchaseOrderID=?;", [intVendorID, PurchaseOrderID]);
		} 
		if (req.body.intRequestedFor != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrder SET RequestedFor=? WHERE PurchaseOrderID=?;", [intRequestedFor, PurchaseOrderID]);
		}
		if (req.body.intFiscalAuthority != undefined) {
			var existQuery = await dbConnection.query("select * from tblPOApprovals where PurchaseOrderID=?;", [PurchaseOrderID]);
			if (existQuery.length == 0) {
				await dbConnection.query("insert into tblPOApprovals (PurchaseOrderID, FiscalAuthority, IsApproved) values (?, ?, 0);", [PurchaseOrderID, intFiscalAuthority]);
			} else if (existQuery.length == 1) {
				await dbConnection.query("UPDATE tblPOApprovals SET FiscalAuthority=? WHERE PurchaseOrderID=?;", [intFiscalAuthority, PurchaseOrderID]);
			}
		} 
		if (req.body.strNotes != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrder SET Notes=? WHERE PurchaseOrderID=?;", [strNotes, PurchaseOrderID]);
		}
		if (req.body.boolStatus != undefined) {
			await dbConnection.query("UPDATE tblPurchaseOrder SET Status=? WHERE PurchaseOrderID=?;", [(boolStatus ? "1" : "0"), PurchaseOrderID]);
		}

		await updateActivityLog(uuidSessionToken, "Edited PO " + PurchaseOrderID + ".", PurchaseOrderID);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting PO (changed from delete to softDelete archive 
//    to avoid duplicate purchase orders with the same number)
router.post("/approvePO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var approvalQuery = await dbConnection.query("select FiscalAuthority from tblPOApprovals where PurchaseOrderID=?;", [strPurchaseOrderID]);
		
		if (approvalQuery.length == 1) {
			if (approvalQuery[0].FiscalAuthority == userID) {
				console.log("User " + userID + " is approving " + strPurchaseOrderID);
				await dbConnection.query("UPDATE tblPOApprovals SET IsApproved=1 WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

				await updateActivityLog(uuidSessionToken, "Approved PO " + strPurchaseOrderID + ".", strPurchaseOrderID);
			} else {
				console.log("User " + userID + " attempted to approve PO " + strPurchaseOrderID + ", but was not the fiscal authority. User " + approvalQuery[0].FiscalAuthority + " is.");
				return res.status(400).json({"message": "You are not the fiscal authority for this PO."});
			}
		} else {
			return res.status(400).json({"message": "No such approval exists."});
		}

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

router.post("/rejectPO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var approvalQuery = await dbConnection.query("select FiscalAuthority from tblPOApprovals where PurchaseOrderID=?;", [strPurchaseOrderID]);
		
		if (approvalQuery.length == 1) {
			if (approvalQuery[0].FiscalAuthority == userID) {
				console.log("User " + userID + " is rejecting " + strPurchaseOrderID);
				await dbConnection.query("UPDATE tblPOApprovals SET IsApproved=-1 WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

				await updateActivityLog(uuidSessionToken, "Rejected PO " + strPurchaseOrderID + ".", strPurchaseOrderID);
			} else {
				console.log("User " + userID + " attempted to reject PO " + strPurchaseOrderID + ", but was not the fiscal authority. User " + approvalQuery[0].FiscalAuthority + " is.");
				return res.status(400).json({"message": "You are not the fiscal authority for this PO."});
			}
		} else {
			return res.status(400).json({"message": "No such approval exists."});
		}

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting PO
router.delete("/deletePO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

    		console.log("Deleting items for PO " + strPurchaseOrderID);

		// Delete associated items from tblPurchaseOrderItem first
		await dbConnection.query("DELETE FROM tblPurchaseOrderItem WHERE PurchaseOrderID = ?;", [strPurchaseOrderID]);
		
		// delete approval information
		await dbConnection.query("delete from tblPOApprovals where PurchaseOrderID=?;", [strPurchaseOrderID]);
    
		console.log("Archiving PO " + strPurchaseOrderID);

		await dbConnection.query("DELETE FROM tblPurchaseOrder WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

		await updateActivityLog(uuidSessionToken, "Archived PO " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting PO (changed from delete to archive 
//    to avoid duplicate purchase orders with the same number)
router.delete("/softDeletePO", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

    console.log("Deleting items for PO " + strPurchaseOrderID);

		// Delete associated items from tblPurchaseOrderItem first
		await dbConnection.query("DELETE FROM tblPurchaseOrderItem WHERE PurchaseOrderID = ?;", [strPurchaseOrderID]);
    
		console.log("Archiving PO " + strPurchaseOrderID);

		await dbConnection.query("UPDATE tblPurchaseOrder SET isArchived=1 WHERE PurchaseOrderID=?;", [strPurchaseOrderID]);

		await updateActivityLog(uuidSessionToken, "Archived PO " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
