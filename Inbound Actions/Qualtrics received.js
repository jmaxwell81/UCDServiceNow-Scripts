//qualtrics received inbound action

//template:
//Subject: A User has Completed ServiceNow Basic + Incident Training
//camil  has completed training with a score of 14/18 

// Completion Date=9/20/2017 
// Completion Time=3:26pm 

// RITM =RITM0001276 

// Assignment Group 1= IET Facilities 
// Assignment Group 2=  
// Assignment Group 3=  
// Assignment Group 4=  
// Assignment Group 5=  
// Assignment Group 6=  
// Assignment Group 7=  
// Assignment Group 8=  
// Assignment Group 9=  
// Assignment Group 10=  

//parse email to get user and groups to add
var emailBody = email.body_text.toString().split("\n");
var userName;				//addUserToGroups		- user's name
var userID;					//addUserToGroups		- user's sys_id
var userLogin; 				//parseEmail 			- nexisn4
var userEmail;				//addUserToGroups		- user's email
var groupsToAdd = [];		//parseEmail 			- [g1, g2, ...]
var groupsToAddNames = [];  //parseEmail            - [gname1, gname2, ...]
var ritm;					//parseEmail 			- RITM sys_id
var ritmNum;                //parseEmail            - RITMxxxxx
var primaryContact;			//addInboundEmailToRitm - PC
var primaryContactEmail;	//getPCEmail			- PC email
var completionTime;         //parseEmail            - completion time
var completionDate;         //parseEmail            - completion date
var summary;                //parseEmail            - user login and score


parseEmail();
getGroupsToAdd();
addInboundEmailToRitm();
removeDuplicates();
addUserToGroups();
updateBillTo();
emailUser();
getPCEmail();
//emailPC();
gs.log("INBOUND ACTION\nend of script");

/**
* Emails primary contact that user has been added
*/
function emailPC() {
    var emailNotification = new GlideRecord("sys_email");
    emailNotification.initialize();
    emailNotification.type = 'send-ready';
    emailNotification.recipients = primaryContactEmail;
    emailNotification.subject = userName + "'s access to ServiceNow has been granted";
    var bodyStr =

        '<p>'
        + 'Per your request ' + ritmNum + ', ServiceNow access for ' + userName + ' has been modified.<br><br>'
        + userName + ' has been added to the following group(s):<br>';

    for (var i = 0; i < groupsToAddNames.length; i++) {
        bodyStr += groupsToAddNames[i] + '<br>';
    }
    bodyStr += '<br>';

    bodyStr +=
        'If you have any issues, please contact IT Express at 530-754-HELP (4357).<br><br>'
        + 'Thank you,<br>'
        + 'IT Service Management' +
        '</p>';

    emailNotification.body = bodyStr;
    emailNotification.insert();
    gs.log("INBOUND ACTION--\nemail sent to pc\n" + primaryContactEmail);
}


/**
* Gets primary contact's email
*/
function getPCEmail() {
    var gr = new GlideRecord("sys_user");
    //got pc
    gr.addQuery("name", primaryContact);
    gr.query();

    //got pc's email
    if (gr.next()) {
        primaryContactEmail = gr.email;
    }
}

/**
* Gets groups to add user to
*/
function getGroupsToAdd() {
    var ritmRec = new GlideRecord('sc_req_item');
    if (ritmRec.get('sys_id', ritm)) {
        var groups = ritmRec.variables.u_groups.getValue().split(',');
        for (var i = 0; i < groups.length; i++) {
            groupsToAdd.push(groups[i].trim());
        }
        // get display values of assignment groups
        for (var j = 0; j < groupsToAdd.length; j++) {
            // get group record
            var agRec = new GlideRecord('sys_user_group');
            if (agRec.get('sys_id', groupsToAdd[j])) {
                groupsToAddNames.push(agRec.name);
            }
        }
    }
}

/**
* Adds inbound email to RITM from Qualtrics
*/
function addInboundEmailToRitm() {
    //get ritm -> get pc -> get pc's email
    var gr = new GlideRecord("sc_req_item");
    gr.addQuery("sys_id", ritm);
    gr.query();

    //got ritm
    if (gr.next()) {

        //add inbound email to RITM
        var inbound =
            "Inbound email from Qualtrics:\n\n"
            + "Body:\n" +
            summary + "\n\n"
            + completionDate + "\n"
            + completionTime + "\n\n"
            + "RITM=" + ritmNum + "\n\n";

        // add assignment group names
        for (var i = 0; i < groupsToAddNames.length; i++) {
            inbound += "Assignment Group " + (i + 1) + "=" + groupsToAddNames[i] + "\n";
        }
		/*var inbound =
			"Inbound email from Qualtrics:\n\n"
			+ "Body:\n" + 
			"[code]"
				 + email.body_html +
			"[/code]";*/

        gr.comments = inbound;
        gr.update();

        primaryContact = gr.u_primary_contact.getDisplayValue();
        gs.log("INBOUND ACTION\nend of addInboundEmailToRitm()\n"
            + ritm + "\n" + inbound + "\n" + primaryContact);
    }
}

/**
* Email user that access to ServiceNow has been granted
*/
function emailUser() {
    //send email to user that they have been added
    var emailNotification = new GlideRecord("sys_email");
    emailNotification.initialize();
    emailNotification.type = 'send-ready';
    emailNotification.recipients = userEmail;
    emailNotification.subject = 'Your ServiceNow access has been granted';
    emailNotification.body =

        '<p>'
        + 'Hello ' + userName + ",<br><br>"
        + 'Welcome to ServiceNow!<br>'
        + 'To access ServiceNow go to:<br>'
        + makeLinkString("https://ucdavisit.service-now.com/", "https://ucdavisit.service-now.com/") + '<br><br>'
        + 'If you have any issues, please contact IT Express at 530-754-HELP (4357).<br><br>'
        + 'Thank you,<br>'
        + 'IT Service Management' +
        '</p>';

    emailNotification.insert();
}

/**
* Update user's bill to field to be parent organization
*/
function updateBillTo() {
    //get the name of the group and try 1, 12, 123 ... words to find parent org
    var group = groupsToAddNames[0];
    var new_parent = "";
    for (var i = 1; i <= group.split(" ").length; i++) {
        var str = group.split(" ").slice(0, i).join(" ");
        var user_group_rec = new GlideRecord("sys_user_group");
        user_group_rec.addQuery("parent", "");
        user_group_rec.addQuery("active", "true");
        user_group_rec.addQuery("name", str);
        user_group_rec.query();
        if (user_group_rec.next()) {
            new_parent = str;
            break;
        }
    }

    if (new_parent) {
        var user_record = new GlideRecord("sys_user");
        user_record.addQuery("user_name", userLogin);
        user_record.query();

        //if user exists
        if (user_record.next()) {
            user_record.u_bill_to.setDisplayValue(new_parent);
            user_record.update();
        }
    }
}

/**
* Adds the user to the groups from RITM
*/
function addUserToGroups() {
    //query the user
    var user_record = new GlideRecord("sys_user");
    user_record.addQuery("user_name", userLogin);
    user_record.query();

    //if user exists
    if (user_record.next()) {
        //get user's name, sys-id, email
        userID = user_record.sys_id;
        userEmail = user_record.email;
        userName = user_record.name;

        //add user to all groups in the groups array
        for (var i = 0; i < groupsToAdd.length; i++) {

            //check if user will be duplicating groups
            var grmember_record = new GlideRecord("sys_user_grmember");
            grmember_record.addQuery("user.name", userName);
            grmember_record.addQuery("group.name", groupsToAdd[i]);
            grmember_record.query();

            //if user is already in that group
            if (grmember_record.next()) {
                continue;
            }

            //else user is not in that group
            else {
                var rec1 = new GlideRecord('sys_user_grmember');
                rec1.initialize();
                rec1.user = userID;
                rec1.group.setDisplayValue(groupsToAdd[i]);
                rec1.insert();
            }
        } //for groupsToAdd
    }
}

/**
* Removes duplicate values in an array
*/
function removeDuplicates() {
    var arrayUtil = new ArrayUtil();
    groupsToAdd = arrayUtil.unique(groupsToAdd);
}

/**
* Reads received email and stores selected information as variables
*/
function parseEmail() {
    for (var i = 0; i < emailBody.length; i++) {
        //if line contains the user's name
        if (emailBody[i].indexOf("has completed") >= 0) {
            userLogin = emailBody[i].split("has")[0].trim();
            summary = emailBody[i].trim();
        }

        //if line contains ritm number
        else if (emailBody[i].indexOf("RITM") >= 0) {
            //ritm = emailBody[i].trim().split("=")[1];
            ritm = emailBody[i].split("=")[1].trim();
            // get ritm number
            var ritmGr = new GlideRecord('sc_req_item');
            if (ritmGr.get('sys_id', ritm))
                ritmNum = ritmGr.number;
            else ritmNum = "Could not find RITM record";
        }

        //line contains completion time
        else if (emailBody[i].indexOf("Completion Time") >= 0) {
            completionTime = emailBody[i].trim();
        }

        // line contains completion date
        else if (emailBody[i].indexOf("Completion Date") >= 0) {
            completionDate = emailBody[i].trim();
        }
    }
}

/**
* Creates link
*/
function makeLinkString(url, label) {
    //url = "https://www.google.com"
    //label = <a href=LINK>LABEL HERE</a>

    var finalString = "";
    finalString += "<a href=" + '"' + url + '">' + label + "</a>";
    return finalString;
}