var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken, updateActivityLog} = require("./helper.js");

router.post("/addReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const strName = clean(req.body.strName);
	const strDueDate = clean(req.body.strDueDate);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		console.log("Adding reminder " + strName + " for " + strDueDate);
		
		await dbConnection.query("insert into tblReminders (Name, DueDate, IsPaid) values (?, ?, false);", [strName, strDueDate]);
		
		await updateActivityLog(uuidSessionToken, "Added reminder for " + strDueDate + ".", strDueDate);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

router.post("/getReminders", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var reminderQuery = await dbConnection.query("select * from tblReminders;");
		
		console.log("Getting reminders");

		res.status(200).json({"message": "Success.", "Reminders": reminderQuery});

	} finally {
		await dbConnection.close();
	}
});

// toggles the row IsPaid
router.post("/updateReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const intReminderID = clean(req.body.intReminderID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		console.log("Updating reminder " + intReminderID);
		
		await dbConnection.query("update tblReminders set IsPaid = not IsPaid where ReminderID=?;", [intReminderID]);
		
		var infoQuery = await dbConnection.query("select DueDate from tblReminders where ReminderID=?;", [intReminderID]);
		
		await updateActivityLog(uuidSessionToken, "Updated reminder for " + infoQuery[0].DueDate + ".", infoQuery[0].DueDate);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// just in case, i don't see how this would be very useful though
router.delete("/deleteReminder", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const intReminderID = clean(req.body.intReminderID);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		console.log("Deleting reminder " + intReminderID);
		
		var infoQuery = await dbConnection.query("select DueDate from tblReminders where ReminderID=?;", [intReminderID]);
		
		await updateActivityLog(uuidSessionToken, "Deleted reminder for " + infoQuery[0].DueDate + ".", infoQuery[0].DueDate);
		
		await dbConnection.query("delete from tblReminders where ReminderID=?;", [intReminderID]);

		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
