var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

// Call for adding vendor
router.post("/addVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strVendorName = clean(req.body.strVendorName);
	const strVendorLink = clean(req.body.strVendorLink);
	const strVendorContactName = clean(req.body.strVendorContactName);
	const strEmail = clean(req.body.strEmail);
	const strStreetAddress1 = clean(req.body.strStreetAddress1);
	const strStreetAddress2 = clean(req.body.strStreetAddress2);
	const strCity = clean(req.body.strCity);
	const strState = clean(req.body.strState);
	const strZip = clean(req.body.strZip);
	const strOfficePhone = clean(req.body.strOfficePhone);
	const strMobilePhone = clean(req.body.strMobilePhone);
	const strFax = clean(req.body.strFax);
	const intCreatedBy = clean(req.body.intCreatedBy);

	let strErrorMessage = '';

	let strVendorID = 123;
	let strVendorContactID = 124;

	// Error checking
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
	} if (strErrorMessage.length > 0) { // Error message
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
		// Assume that contact is primary contact
		// Notes is inserted as empty string for now
		const intVendorID = insertVendorResult.insertId;
		await dbConnection.query("INSERT INTO tblVendorContact VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, 1, ?);", [intVendorContactID[0].maxID + 1, intVendorID, strVendorContactName, strStreetAddress1, strStreetAddress2, strCity, strState, strZip, strOfficePhone, strMobilePhone, strEmail, '', intCreatedBy, strFax]);

		await updateActivityLog(uuidSessionToken, "Added Vendor " + strVendorName + ".", strVendorName);
		await updateActivityLog(uuidSessionToken, "Added Vendor Contact " + strVendorContactName + ".", strVendorContactName);

		res.json({ "message": "Success.", "status": 200 });
	} finally {
		await dbConnection.close();
	}
});

// Call for filling vendor table on page
router.post("/fillVendorTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Filling the Vendors Table");

		const VendorTable = await dbConnection.query("SELECT * FROM tblVendor;");

		if (VendorTable.length == 0) {
			return res.status(500).json({ "message": "There are no vendors." });
		} else { // If there are vendors, list them
			res.status(200).json({ "message": "Success.", "VendorTable": VendorTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for getting vendor info to display on page
router.post("/getVendorInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting Vendor Info for " + strVendorName);

		const VendorInfo = await dbConnection.query("SELECT * FROM tblVendor WHERE VendorName=?;", [strVendorName]);

		if (VendorInfo.length == 0) {
			return res.status(500).json({ "message": "There is no vendor with that ID." });
		} else { // If there is vendor info, return it
			res.status(200).json({ "message": "Success.", "VendorInfo": VendorInfo });
		}
	} finally {
		await dbConnection.close();
	}
});

// Call for filling vendor contact table on viewVendor page
router.post("/fillVendorContactTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try { // Checks to see if user is logged in correctly
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

		const VendorContactTable = await dbConnection.query("select vct.ID, vct.Name, CONCAT(TRIM(vct.StreetAddress1), ' ', TRIM(vct.StreetAddress2), ' ', TRIM(vct.City), ', ', TRIM(vct.State), ' ', TRIM(vct.ZipCode)) as Address, vct.OfficePhone, vct.MobilePhone, vct.Email, vct.Primary from tblVendorContact vct where vct.VendorID=?;", [strVendorID]);

		if (VendorContactTable.length == 0) {
			return res.status(500).json({ "message": "There are no vendor contacts." });
		} else { // If there are contacts, list them
			res.status(200).json({ "message": "Success.", "VendorContactTable": VendorContactTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for filling vendor PO table on viewVendor page
router.post("/fillVendorPOTable", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try { // Checks to see if user is logged in correctly
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

		const VendorPOTable = await dbConnection.query("select distinct po.PurchaseOrderID, DATE_FORMAT(po.CreatedDateTime, '%m/%d/%Y %h:%i %p') as CreatedDate, usr.DisplayName from tblPurchaseOrder po left join tblUser usr on po.CreatedBy = usr.EmployeeID left join tblPurchaseOrderItem poi on po.PurchaseOrderID = poi.PurchaseOrderID left join tblAccountTransaction actt on poi.AccountID = actt.AccountID where po.VendorID=?;", [strVendorID]);

		if (VendorPOTable.length == 0) {
			return res.status(500).json({ "message": "There are no POs for this vendor." });
		} else { // If there are POs, list them
			res.status(200).json({ "message": "Success.", "VendorPOTable": VendorPOTable });
		}

	} finally {
		await dbConnection.close();
	}
});

// Call for updating vendor
router.put("/updateVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);
	const strEditName = clean(req.body.strEditName);
	const strEditLink = clean(req.body.strEditLink);

	try { // Checks to see if user is logged in correctly
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

		// Updates as long as info is present
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

// Call for adding vendor contact
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

	try { // Checks to see if user is logged in correctly
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

		console.log("Adding contact " + strContactName + " for vendor " + strVendorName);

		// Notes column is inserted as empty string for now
		await dbConnection.query("INSERT INTO tblVendorContact VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1, ?)", [intVendorContactID[0].maxID + 1, strVendorID, strContactName, strStreetAddress1, strStreetAddress2, strCity, strState, strZip, strOfficePhone, strMobilePhone, strEmail, '', chkPrimary, intCreatedBy, strFax]);

		await updateActivityLog(uuidSessionToken, "Adding Contact " + strContactName + ".", strContactName);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for updating vendor contact
router.put("/updateContact", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const editID = clean(req.body.editID);
	const strContactName = clean(req.body.strContactName);
	const strStreetAddress1 = clean(req.body.strStreetAddress1);
	const strStreetAddress2 = clean(req.body.strStreetAddress2);
	const strCity = clean(req.body.strCity);
	const strState = clean(req.body.strState);
	const strZip = clean(req.body.strZip);
	const strOfficePhone = clean(req.body.strOfficePhone);
	const strMobilePhone = clean(req.body.strMobilePhone);
	const strEmail = clean(req.body.strEmail);
	const strFax = clean(req.body.strFax);
	const chkPrimary = clean(req.body.chkPrimary);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		if (strContactName != '') {
			await dbConnection.query("UPDATE tblVendorContact SET Name=? WHERE ID=?", [strContactName, editID]);
		} if (strStreetAddress1 != '') {
			await dbConnection.query("UPDATE tblVendorContact SET StreetAddress1=? WHERE ID=?", [strStreetAddress1, editID]);
		} if (strStreetAddress2 != '') {
			await dbConnection.query("UPDATE tblVendorContact SET StreetAddress2=? WHERE ID=?", [strStreetAddress2, editID]);
		} if (strCity != '') {
			await dbConnection.query("UPDATE tblVendorContact SET City=? WHERE ID=?", [strCity, editID]);
		} if (strState != '') {
			await dbConnection.query("UPDATE tblVendorContact SET State=? WHERE ID=?", [strState, editID]);
		} if (strZip != '') {
			await dbConnection.query("UPDATE tblVendorContact SET ZipCode=? WHERE ID=?", [strZip, editID]);
		} if (strOfficePhone != '') {
			await dbConnection.query("UPDATE tblVendorContact SET OfficePhone=? WHERE ID=?", [strOfficePhone, editID]);
		} if (strMobilePhone != '') {
			await dbConnection.query("UPDATE tblVendorContact SET MobilePhone=? WHERE ID=?", [strMobilePhone, editID]);
		} if (strEmail != '') {
			await dbConnection.query("UPDATE tblVendorContact SET Email=? WHERE ID=?", [strEmail, editID]);
		} if (strFax != '') {
			await dbConnection.query("UPDATE tblVendorContact SET Fax=? WHERE ID=?", [strFax, editID]);
		}

		await dbConnection.query("UPDATE tblVendorContact SET `Primary`=? WHERE ID=?", [chkPrimary, editID]);

		await updateActivityLog(uuidSessionToken, "Updating Contact " + strContactName + ".", strContactName);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting a vendor contact
router.delete("/deleteContact", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const editID = clean(req.body.editID);

	try { // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Deleting contact: ID - ", editID);

		await dbConnection.query("DELETE FROM tblVendorContact WHERE ID=?", [editID]);

		await updateActivityLog(uuidSessionToken, "Deleted Contact ", + editID + ".", editID);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for deleting a vendor
router.delete("/deleteVendor", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strVendorName = clean(req.body.strVendorName);

	try { // Checks to see if user is logged in correctly
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

		console.log("Deleting contacts for vendor " + strVendorName);

		// Deleting contacts when vendor is deleted
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
