var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog } = require("./helper.js");

// Call for adding calendar reminder
router.post("/addReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strName = clean(req.body.strName);
	const strDueDate = clean(req.body.strDueDate);
	const strNotes = clean(req.body.strNotes);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Adding reminder " + strName + " for " + strDueDate);

		await dbConnection.query("insert into tblReminders (Name, DueDate, IsPaid, Notes) values (?, ?, false, ?);", [strName, strDueDate, strNotes]);

		await updateActivityLog(uuidSessionToken, "Added reminder for " + strDueDate + ".", strDueDate);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

// Call for getting calendar reminders
router.post("/getReminders", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		var reminderQuery = await dbConnection.query("select * from tblReminders;");

		console.log("Getting reminders");

		res.status(200).json({ "message": "Success.", "Reminders": reminderQuery });
	} finally {
		await dbConnection.close();
	}
});


//No Longer Needed, But save incase updated later
// // toggles the row IsPaid
// router.post("/updateReminder", async (req, res) => {
// 	const dbConnection = await db_pool.getConnection();
// 	const uuidSessionToken = clean(req.body.uuidSessionToken);

// 	const intReminderID = clean(req.body.intReminderID);

// 	try {
// 		var userID = await getUserIDBySessionToken(uuidSessionToken);
// 		if (userID == -1) {
// 			return res.status(400).json({"message": "You must be logged in to do that"});
// 		}

// 		console.log("Updating reminder " + intReminderID);

// 		await dbConnection.query("update tblReminders set IsPaid = not IsPaid where ReminderID=?;", [intReminderID]);

// 		var infoQuery = await dbConnection.query("select DueDate from tblReminders where ReminderID=?;", [intReminderID]);
// 		var formattedDate = new Date(infoQuery[0].DueDate).toISOString().split('T')[0];

// 		await updateActivityLog(uuidSessionToken, "Updated reminder for " + formattedDate + ".", formattedDate);

// 		res.status(200).json({"message": "Success."});
// 	} finally {
// 		await dbConnection.close();
// 	}
// });

// Call for deleting reminders
// just in case, i don't see how this would be very useful though

router.put("/updateReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strName = clean(req.body.strName);
	const strDueDate = clean(req.body.strDueDate);
	const strNotes = clean(req.body.strNotes);
	const strID = clean(req.body.strID);

	try{
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Updating reminder " + strName + " for " + strDueDate);

		await dbConnection.query("update tblReminders set Name=?, DueDate=?, Notes=? where ReminderID=?;", [strName, strDueDate, strNotes, strID]);

		await updateActivityLog(uuidSessionToken, "Updated reminder for " + strDueDate + ".", strDueDate);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

router.post("/getReminderInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strID = clean(req.body.strID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting reminder " + strID);

		var reminderQuery = await dbConnection.query("select * from tblReminders where ReminderID=?;", [strID]);

		res.status(200).json({ "message": "Success.", "Reminder": reminderQuery });
	} finally {
		await dbConnection.close();
	}
});

router.delete("/deleteReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intReminderID = clean(req.body.intReminderID);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Deleting reminder " + intReminderID);

		var infoQuery = await dbConnection.query("select DueDate from tblReminders where ReminderID=?;", [intReminderID]);
		var formattedDate = new Date(infoQuery[0].DueDate).toISOString().split('T')[0];

		await updateActivityLog(uuidSessionToken, "Deleted reminder for " + formattedDate + ".", formattedDate);

		await dbConnection.query("delete from tblReminders where ReminderID=?;", [intReminderID]);

		res.status(200).json({ "message": "Success." });
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
