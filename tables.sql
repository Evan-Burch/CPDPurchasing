USE `POModule`;

CREATE TABLE `__EFMigrationsHistory`(
	`MigrationId` nvarchar(150) NOT NULL,
	`ProductVersion` nvarchar(32) NOT NULL
);

CREATE TABLE `Account`(
	`AccountID` nvarchar(50) NOT NULL,
	`Description` Longtext NULL,
	`FiscalAuthority` int NOT NULL,
	`DivisionID` nvarchar(3) NULL,
	`Status` Tinyint NOT NULL
);

CREATE TABLE `AccountTransaction`(
	`ID` int NOT NULL,
	`AccountID` nvarchar(50) NOT NULL,
	`DateCreated` Datetime NOT NULL,
	`Type` int NOT NULL,
	`Amount` decimal(18, 2) NOT NULL,
	`FiscalYear` Longtext NOT NULL,
	`CreatedBy` int NOT NULL
);

CREATE TABLE `AccountTransactionType`(
	`ID` int NOT NULL,
	`Description` nvarchar(100) NOT NULL,
	`Status` Tinyint NOT NULL
);

CREATE TABLE `Division`(
	`DivisionID` nvarchar(3) NOT NULL,
	`Description` nvarchar(100) NOT NULL
);

CREATE TABLE `PurchaseOrder`(
	`PurchaseOrderID` nvarchar(450) NOT NULL,
	`VendorID` int NOT NULL,
	`VendorContactID` int NOT NULL,
	`Status` int NULL,
	`RequestedFor` int NULL,
	`CreatedDateTime` Datetime NOT NULL,
	`CreatedBy` int NOT NULL,
	`Notes` Longtext NULL
);

CREATE TABLE `PurchaseOrderItem`(
	`ID` int NOT NULL,
	`PurchaseOrderID` nvarchar(450) NOT NULL,
	`LineNumber` int NOT NULL,
	`AccountID` nvarchar(50) NOT NULL,
	`Description` nvarchar(250) NULL,
	`Quantity` int NOT NULL,
	`Price` decimal(18, 2) NOT NULL
);

CREATE TABLE `PurchaseOrderRoute`(
	`PurchaseOrderID` nvarchar(50) NOT NULL,
	`TimeStamp` Datetime NOT NULL,
	`RouteFrom` int NULL,
	`RouteTo` int NULL,
	`Notes` Longtext NULL,
	`Completed` Tinyint NULL,
	`CompletedDateTime` Datetime NULL,
    CONSTRAINT `PK_PurchaseOrderRoute` PRIMARY KEY (
	    `PurchaseOrderID` ASC,
	    `TimeStamp` ASC
    ) 
);

CREATE TABLE `User`(
	`EmployeeID` int NOT NULL,
	`FirstName` nvarchar(50) NULL,
	`MiddleName` nvarchar(50) NULL,
	`LastName` nvarchar(50) NULL,
	`DisplayName` nvarchar(100) NULL,
	`UserName` nvarchar(50) NULL
);

CREATE TABLE `Vendor`(
	`VendorID` int NOT NULL,
	`VendorName` nvarchar(100) NOT NULL,
	`Website` nvarchar(100) NULL,
	`Status` Tinyint NOT NULL
);

CREATE TABLE `VendorContact`(
	`ID` int NOT NULL,
	`VendorID` int NOT NULL,
	`Name` nvarchar(100) NULL,
	`StreetAddress1` nvarchar(50) NULL,
	`StreetAddress2` nvarchar(50) NULL,
	`City` nvarchar(100) NULL,
	`State` nvarchar(3) NULL,
	`ZipCode` nvarchar(10) NULL,
	`OfficePhone` nvarchar(12) NULL,
	`MobilePhone` nvarchar(12) NULL,
	`Email` nvarchar(75) NULL,
	`Notes` Longtext NULL,
	`Primary` Tinyint NOT NULL,
	`DateAdded` Datetime NOT NULL,
	`CreatedBy` int NOT NULL,
	`Status` Tinyint NOT NULL,
	`Fax` nvarchar(12) NULL
);
