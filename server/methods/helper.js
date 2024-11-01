var db_pool = require("./db.js");

// Clean inputs
function clean(str) {
	if (str === undefined) {
		return "error";
	}
	if (typeof str == 'string') {
		return str.replace(/[^0-9a-zA-Z_\-@.\s]/gi, "");
	} else if (typeof str == 'number') {
		return str;
	} else {
		return "datatype error";
	}
}

// Clean base64 strings
function clean_base64(str) {
	if (typeof str != 'string') return "datatype error";
	if (str.match(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gi) == str) return str;
	return "error";
}

// Get User ID from Sessions
async function getUserIDBySessionToken(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();
	try {
		const result = await dbConnection.query("SELECT UserID FROM tblSessions WHERE ID=?;", [uuidSessionToken]);

		if (result.length == 0) {
			console.log("Session token " + uuidSessionToken + " does not belong to any user.");
			return -1;
		}
		return result[0].UserID;
	} finally {
		await dbConnection.end();
	}
}

// Get Username from Sessions
async function getUserNameBySessionToken(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();

	var userID = await getUserIDBySessionToken(uuidSessionToken);
	try {
		const result = await dbConnection.query("SELECT UserName, IsAdmin FROM tblUser WHERE EmployeeID=?;", [userID]);

		if (result.length == 0) {
			console.log("UserID " + userID + " does not belong to any user.");
			return -1;
		}
		return result[0];
	} finally {
		await dbConnection.end();
	}
}

// Admin check
async function isUserAdmin(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();

	var userID = await getUserIDBySessionToken(uuidSessionToken);
	try {
		const result = await dbConnection.query("select * from tblUser where EmployeeID=? and IsAdmin=1;", [userID]);
		
		if (result.length == 1) { // there should be only one user
			return true;
		} else {
			console.log("User " + result[0].DisplayName + " is not an admin.");
			return false;
		}
	} finally {
		await dbConnection.end();
	}
}

// Updating activities
async function updateActivityLog(uuidSessionToken, description, argument) {
	const dbConnection = await db_pool.getConnection();

	var userID = await getUserIDBySessionToken(uuidSessionToken);
	try {
		await dbConnection.query("insert into tblActivityLog (ActivityDescription, ActivityArgument, Time, ResponsibleUser) values (?, ?, NOW(), ?);", [description, argument, userID]);
	} finally {
		await dbConnection.end();
	}
}

module.exports = { clean, clean_base64, getUserIDBySessionToken, getUserNameBySessionToken, isUserAdmin, updateActivityLog };
