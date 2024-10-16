var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

router.post("/addVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strVendorName = clean(req.body.strVendorName);
	const strVendorLink = clean(req.body.strVendorLink);
	const strVendorContactName = clean(req.body.strVendorContactName);
	const intCreatedBy = clean(req.body.intCreatedBy);
	let strErrorMessage = '';

	let strVendorID = 123;
	let strVendorContactID = 124;

	if (strVendorName == '') {
		strErrorMessage += "<p>Please specify a vendor name.</p>";
	} if (strVendorName.length > 50) {
		strErrorMessage += "<p>vendor name is too long</p>";
	} if (strVendorLink.length > 100) {
		strErrorMessage += "<p>link is too long</p>";
	} if (strVendorContactName.length > 50) {
		strErrorMessage += "<p>contact name is too long</p>";
	} if (strVendorContactName == '') {
		strErrorMessage += "<p>Please specify a contact name.</p>";
	} if (strVendorContactName == '') {
		strErrorMessage += "<p>Please specify a Vendor Contact.</p>";
	} if (strVendorContactName.length > 100) {
		strErrorMessage += "<p>Vendor Contact is too long</p>";
	} if (strErrorMessage.length > 0) {
		return res.status(400).json({ "message": strErrorMessage });
	}

	//HB TODO: check if vendor already exists

	try {
		console.log('backend create vendor: ', strVendorName, ", ", strVendorLink, ", ", strVendorContactName);

		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Creating new Vendor: " + strVendorName);

		// Figure out what the next auto-increment ID is for tblVendorContact so we can use it for tblVendor
		const intVendorContactID = await dbConnection.query("SELECT MAX(ID) AS maxID FROM tblVendorContact;");
		const insertVendorResult = await dbConnection.query("INSERT INTO tblVendor (VendorName, Website, Status, VendorContactID) VALUES (?, ?, 1, ?);", [strVendorName, strVendorLink, intVendorContactID[0].maxID + 1]);

		console.log("Creating new VendorContact: " + strVendorContactName);

		// Get the ID of the newly inserted vendor to use for tblVendorContact
		const intVendorID = insertVendorResult.insertId;
		await dbConnection.query("INSERT INTO tblVendorContact (ID, VendorID, Name, `Primary`, DateAdded, CreatedBy, Status) VALUES (?, ?, ?, 1, NOW(), ?, 1);", [intVendorContactID[0].maxID + 1, intVendorID, strVendorContactName, intCreatedBy]);

		await updateActivityLog(uuidSessionToken, "Added Vendor " + strVendorName + ".", strVendorName);
		await updateActivityLog(uuidSessionToken, "Added Vendor Contact " + strVendorContactName + ".", strVendorContactName);

		res.json({ "message": "Success.", "status": 200 });
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
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Vendors Table");

		const VendorTable = await dbConnection.query("SELECT * FROM tblVendor;");

		if (VendorTable.length == 0) {
			return res.status(500).json({ "message": "There are no vendors." });
		} else { // If there are Vendors, list them
			res.status(200).json({ "message": "Success.", "VendorTable": VendorTable });
		}

	} finally {
		await dbConnection.close();
	}
});

router.post("/getVendorInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting Vendor Info for " + strVendorName);

		const VendorInfo = await dbConnection.query("SELECT * FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		if (VendorInfo.length == 0) {
			return res.status(500).json({ "message": "There is no vendor with that ID." });
		} else {
			res.status(200).json({ "message": "Success.", "VendorInfo": VendorInfo });
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
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("select VendorID from tblVendor where VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Filling the Vendor Contact Table");

		const VendorContactTable = await dbConnection.query("select vct.Name, CONCAT(TRIM(vct.StreetAddress1), ' ', TRIM(vct.StreetAddress2), ' ', TRIM(vct.City), ', ', TRIM(vct.State), ' ', TRIM(vct.ZipCode)) as Address, vct.OfficePhone, vct.MobilePhone, vct.Email, vct.Primary from tblVendorContact vct where vct.VendorID=?;", [strVendorID]);

		if (VendorContactTable.length == 0) {
			return res.status(500).json({ "message": "There are no vendor contacts." });
		} else {
			res.status(200).json({ "message": "Success.", "VendorContactTable": VendorContactTable });
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
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("select VendorID from tblVendor where VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Filling the Vendor POs Table");

		const VendorPOTable = await dbConnection.query("select distinct po.PurchaseOrderID, DATE_FORMAT(po.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDate, usr.DisplayName, actt.FiscalYear from tblPurchaseOrder po left join tblUser usr on po.CreatedBy = usr.EmployeeID left join tblPurchaseOrderItem poi on po.PurchaseOrderID = poi.PurchaseOrderID left join tblAccountTransaction actt on poi.AccountID = actt.AccountID where actt.FiscalYear - YEAR(po.CreatedDateTime) = 1 and po.VendorID=?;", [strVendorID]);

		if (VendorPOTable.length == 0) {
			return res.status(500).json({ "message": "There are no POs for this vendor." });
		} else {
			res.status(200).json({ "message": "Success.", "VendorPOTable": VendorPOTable });
		}

	} finally {
		await dbConnection.close();
	}
});

router.put("/updateVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	const strEditName = clean(req.body.strEditName);
	const strEditLink = clean(req.body.strEditLink);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		if (strEditName != '') {
			await dbConnection.query("UPDATE tblVendor SET VendorName=? WHERE VendorID=?", [strEditName, strVendorID]);
		} if (strEditLink != '') {
			await dbConnection.query("UPDATE tblVendor SET Website=? WHERE VendorID=?", [strEditLink, strVendorID]);
		}

		await updateActivityLog(uuidSessionToken, "Edited Vendor " + strVendorName + ".", strVendorName);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

router.post("/addVendorContact", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	const strContactName = clean(req.body.strContactName);
	const strStreetAddress1 = clean(req.body.strStreetAddress1);
	const strStreetAddress2 = clean(req.body.strStreetAddress2);
	const strCity = clean(req.body.strCity);
	const strState = clean(req.body.strState);
	const strZip = clean(req.body.strZip);
	const strOfficePhone = clean(req.body.strOfficePhone);
	const strMobilePhone = clean(req.body.strMobilePhone);
	const strEmail = clean(req.body.strEmail);
	const chkPrimary = clean(req.body.chkPrimary);
	const strFax = clean(req.body.strFax);
	const intCreatedBy = clean(req.body.intCreatedBy);
	const intVendorContactID = await dbConnection.query("SELECT MAX(ID) AS maxID FROM tblVendorContact;");

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// Setting primary check to integer
		let intChkPrimary = (chkPrimary == 'true') ? 1 : 0;

		// Pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Adding contact " + strContactName + " for vendor " + strVendorName);

		// Notes column is inserted as empty string for now
		await dbConnection.query("INSERT INTO tblVendorContact VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1, ?)", [intVendorContactID[0].maxID + 1, strVendorID, strContactName, strStreetAddress1, strStreetAddress2, strCity, strState, strZip, strOfficePhone, strMobilePhone, strEmail, '', intChkPrimary, intCreatedBy, strFax]);

		await updateActivityLog(uuidSessionToken, "Adding Contact " + strContactName + ".", strContactName);

		res.status(200).json({ "message": "Success." });
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
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		// pull Vendor ID (vendor name is passed to backend, but using ID is easier for queries)
		strVendorID = await dbConnection.query("SELECT VendorID FROM tblVendor WHERE VendorName=?", [strVendorName]);
		if (strVendorID.length == 0) {
			strVendorID = 0;
		} else {
			strVendorID = strVendorID[0].VendorID;
		}

		console.log("Deleting contacts for vendor " + strVendorName);

		contacts = await dbConnection.query("SELECT ID FROM tblVendorContact WHERE VendorID=?", [strVendorID]);
		if (contacts.length > 0) {
			await dbConnection.query("DELETE FROM tblVendorContact WHERE VendorID=?", [strVendorID]);
		}

		console.log("Deleting Vendor " + strVendorName);

		await dbConnection.query("DELETE FROM tblVendor WHERE VendorID=?;", [strVendorID]);

		await updateActivityLog(uuidSessionToken, "Deleted Vendor " + strVendorName + ".", strVendorName);
		await updateActivityLog(uuidSessionToken, "Deleted Contacts ", + contacts + ".", strVendorName);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
