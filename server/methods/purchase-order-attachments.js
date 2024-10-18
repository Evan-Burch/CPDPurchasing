var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, clean_base64, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog} = require("./helper.js");

router.post("/addPOAttachment", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	const strFilename = clean(req.body.strFilename);
	const strFileBody = clean_base64(req.body.strFileBody);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);

		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		var attachmentQuery = await dbConnection.query("insert into tblAttachmentData (AttachmentData) values (?);", [strFileBody]);
		var intAttachmentID = Number(attachmentQuery.insertId);
		
		await dbConnection.query("insert into tblPOAttachments (AttachmentID, PurchaseOrderID, Filename, Added) values (?, ?, ?, NOW());", [intAttachmentID, strPurchaseOrderID, strFilename]);
		
		await updateActivityLog(uuidSessionToken, "Added attachment " + strFilename + " to PO " + strPurchaseOrderID + ".", strPurchaseOrderID);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

router.post("/getPOAttachments", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const strPurchaseOrderID = clean(req.body.strPurchaseOrderID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Returning Attachments for PO " + strPurchaseOrderID);
		
		const attachmentArray = await dbConnection.query("select AttachmentID, Filename, Added from tblPOAttachments where PurchaseOrderID=?;", [strPurchaseOrderID]);

		res.status(200).json({"message": "Success.", POAttachments: attachmentArray});

	} finally {
		await dbConnection.close();
	}
});

router.post("/getAttachment", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const intAttachmentID = clean(req.body.intAttachmentID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Returning data for attachment " + intAttachmentID);

		const attachmentData = await dbConnection.query("select AttachmentData from tblAttachmentData where AttachmentID=?;", [intAttachmentID]);

		if (attachmentData.length == 0) {
			return res.status(400).json({"message": "No such file exists"});
		}

		res.status(200).json({"message": "Success.", AttachmentData: attachmentData[0].AttachmentData});

	} finally {
		await dbConnection.close();
	}
});

router.delete("/deleteAttachment", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const intAttachmentID = clean(req.body.intAttachmentID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Deleting PO Attachment with ID " + intAttachmentID);

		var nameQuery = await dbConnection.query("select PurchaseOrderID, Filename from tblPOAttachments where AttachmentID=?;", [intAttachmentID]);
		var deletedFilename = intAttachmentID.toString();
		var targetedPO = "error";
		if (nameQuery.length != 0) {
			deletedFilename = nameQuery[0].Filename;
			targetedPO = nameQuery[0].PurchaseOrderID;
		}
		
		await dbConnection.query("delete from tblPOAttachments where AttachmentID=?;", [intAttachmentID]);
		await dbConnection.query("delete from tblAttachmentData where AttachmentID=?;", [intAttachmentID]);
		
		await updateActivityLog(uuidSessionToken, "Deleted attachment " + deletedFilename + " from PO " + targetedPO + ".", targetedPO);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;

