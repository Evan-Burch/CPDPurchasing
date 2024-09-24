var db_pool = require("./db.js");

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

async function getUserNameBySessionToken(uuidSessionToken) {
	const dbConnection = await db_pool.getConnection();

	var userID = await getUserIDBySessionToken(uuidSessionToken);
	try {
		const result = await dbConnection.query("SELECT UserName FROM tblUser WHERE EmployeeID=?;", [userID]);
		
		if (result.length == 0) {
			console.log("UserID " + userID + " does not belong to any user.");
			return -1;
		}
		return result[0].UserName;
	} finally {
		await dbConnection.end();
	}
}

module.exports = {clean, getUserIDBySessionToken, getUserNameBySessionToken};
