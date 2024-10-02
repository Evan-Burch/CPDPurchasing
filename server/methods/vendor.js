var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken} = require("./helper.js");

router.post("/addVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strVendorName = clean(req.body.strVendorName);
	const strVendorLink = clean(req.body.strVendorLink);
	const strVendorContactName = clean(req.body.strVendorContactName);
	const intCreatedBy = clean(req.body.intCreatedBy);


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

	if(strVendorLink.length > 100) {
	strErrorMessage = strErrorMessage + "<p>link is too long</p>";
	}

	if(strVendorContactName.length > 50) {
	strErrorMessage = strErrorMessage + "<p>contact name is too long</p>";
	}

	if(strVendorContactName == '') {
	strErrorMessage = strErrorMessage + "<p>Please specify a contact name.</p>";
	}

	if(strVendorContactName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a Vendor Contact.</p>";
	}

	if(strVendorContactName.length > 100) {
		strErrorMessage = strErrorMessage + "<p>Vendor Contact is too long</p>";
	}

	if(strErrorMessage.length>0) {
		return res.status(400).json({"message":strErrorMessage});
	}

	//HB TODO: check if vendor already exists

	try {
	  	console.log('backend create vendor: ', strVendorName, ", ", strVendorLink, ", ", strVendorContactName);
  
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Creating new Vendor: " + strVendorName);

		// Figure out what the next auto-increment ID is for tblVendorContact so we can use it for tblVendor
		const intVendorContactID = await dbConnection.query("SELECT MAX(ID) AS maxID FROM tblVendorContact;");
		const insertVendorResult = await dbConnection.query("INSERT INTO tblVendor (VendorName, Website, Status, VendorContactID) VALUES (?, ?, 1, ?);", [strVendorName, strVendorLink, intVendorContactID[0].maxID + 1]);
		
		console.log("Creating new VendorContact: " + strVendorContactName);

		// Get the ID of the newly inserted vendor to use for tblVendorContact
		const intVendorID = insertVendorResult.insertId;
		await dbConnection.query("INSERT INTO tblVendorContact (ID, VendorID, Name, `Primary`, DateAdded, CreatedBy, Status) VALUES (?, ?, ?, 1, NOW(), ?, 1);", [intVendorContactID[0].maxID + 1, intVendorID, strVendorContactName, intCreatedBy]);

    	res.json({"message": "Success.", "status": 200});
	} finally {
		await dbConnection.close();
	}
});


router.post("/fillVendorTable", async (req, res) => {
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

router.post("/getVendorInfo", async (req, res) => {
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

router.post("/fillVendorContactTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		// pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("select VendorID from tblVendor where VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Filling the Vendor Contact Table");

		const VendorContactTable = await dbConnection.query("select vct.Name, CONCAT(TRIM(vct.StreetAddress1), ' ', TRIM(vct.StreetAddress2), ' ', TRIM(vct.City), ', ', TRIM(vct.State), ' ', TRIM(vct.ZipCode)) as Address, vct.OfficePhone, vct.MobilePhone, vct.Email from tblVendorContact vct where vct.VendorID=?;", [strVendorID]);

		if (VendorContactTable.length == 0) {
			return res.status(500).json({"message": "There are no vendor contacts."});
		} else {
			res.status(200).json({"message": "Success.", "VendorContactTable": VendorContactTable});
		}

	} finally {
		await dbConnection.close();
	}
});

router.post("/fillVendorPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		// pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("select VendorID from tblVendor where VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Filling the Vendor POs Table");

		const VendorPOTable = await dbConnection.query("select distinct po.PurchaseOrderID, DATE_FORMAT(po.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDate, usr.DisplayName, actt.FiscalYear from tblPurchaseOrder po left join tblUser usr on po.CreatedBy = usr.EmployeeID left join tblPurchaseOrderItem poi on po.PurchaseOrderID = poi.PurchaseOrderID left join tblAccountTransaction actt on poi.AccountID = actt.AccountID where actt.FiscalYear - YEAR(po.CreatedDateTime) = 1 and po.VendorID=?;", [strVendorID]);

		 if (VendorPOTable.length == 0) {
			return res.status(500).json({"message": "There are no POs for this vendor."});
		} else {
			res.status(200).json({"message": "Success.", "VendorPOTable": VendorPOTable});
		}

	} finally {
		await dbConnection.close();
	}
});

router.delete("/deleteVendor", async (req, res) => {
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

module.exports = router;
