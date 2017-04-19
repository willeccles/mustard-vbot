const discord = require('discord.js'),
	fs = require('fs');

const client = new discord.Client();

var token = "";
var clientID = "";
var debugChannelID = "";

var discordServerID = "";

var lobbyChannel = "";
var memberRole = "304267634759696396";
var verifyChannel = "304266940254519296";

// permissions the bot requests
var perms = 0|
	0x00000008; // just admin, ezpz

// load config
try {
	fs.accessSync("config.json", fs.F_OK);
	var settings = JSON.parse(fs.readFileSync("config.json"));
	if (settings.token) {
		token = settings.token;
	}
	else {
		console.error("No token specified.");
		process.exit(1);
	}
	if (settings.clientID) {
		clientID = settings.clientID;
	} else {
		console.error("No clientID specified.");
		process.exit(2);
	}
	if (settings.debugChannelID) {
		debugChannelID = settings.debugChannelID;
	}
	if (settings.discordServerID) {
		discordServerID = settings.discordServerID;
	}
} catch (error) {
	console.error(`Error reading config.`);
	process.exit(3);
}

function hasPermission(channel, permission, user = client.user) {
	if (channel.type != "dm" && channel.permissionsFor(user).hasPermission(permission))
		return true;
	else if (channel.type == "dm" && permission != "MANAGE_MESSAGES")
		return true;
	else if (channel.type == "dm" && permission == "MANAGE_MESSAGES")
		return false;
	else return false;
}

function debugChannelMessage(priority, message) {
    if (debugChannelID == "") return;
    switch(priority) {
        case 'error':
            client.channels.get(debugChannelID).sendMessage(`:exclamation: **Error:** ${message}\n(cc <@111943010396229632>)`);
            break;
        case 'normal':
            client.channels.get(debugChannelID).sendMessage(`${message}`);
            break;
        case 'status':
            client.channels.get(debugChannelID).sendMessage(`:information_source: **Bot status:** ${message}`);
            break;
        case 'warning':
            client.channels.get(debugChannelID).sendMessage(`:warning: **Warning:** ${message}\n(cc <@111943010396229632>)`);
    }       
}

var hadError = false;
var errorMessage = "";

client.on('ready', () => {
	console.log("Client ready.");
	debugChannelMessage('status', "Ready");
	if (hadError && errorMessage != "") {
		debugChannelMessage('error', `Just recovered from error:\n\`\`\`\n${errorMessage}\n\`\`\``);
		console.error(`Just recovered from error:\n${errorMessage}`);
		hadError = false;
		errorMessage = "";
	}
	console.info(`link:\nhttps://discordapp.com/oauth2/authorize?client_id=${clientID}&scope=bot&permissions=${perms}`);
	client.user.setGame("with mustardbot :3");
});

client.on('message', (message) => {
	if (!hasPermission(message.channel, "SEND_MESSAGES"))
		return;

	if (/^!roles\s+.*/i.test(message.content) && message.author.id == "111943010396229632" && message.mentions.users.array().length) {
		message.channel.sendMessage("<@111943010396229632>: listing user roles (see console)");
		console.log(`Roles for user ${message.mentions.users.first().username}`);
		for (var i = 0; i < message.guild.member(message.mentions.users.first()).roles.keyArray().length; i++) {
			console.log(`RoleName: ${message.guild.member(message.mentions.users.first()).roles.get(message.guild.member(message.mentions.users.first()).roles.keyArray()[i]).name}, Role ID: ${message.guild.member(message.mentions.users.first()).roles.keyArray()[i]}`);
		}
	}

	else if (/^!verifyme/i.test(message.content) && message.channel.id == verifyChannel) {
		message.guild.member(message.author).addRole(memberRole);
		message.delete();
	}
	
	// !delmessages -[fq] <number>
	else if (/^!del(messages)?\s+(-[fq]{1,2}\s+)*\d+(\s+(-[fq]{1,2}\s*)*)?/i.test(message.content)) {
		var force = false;
		var quiet = false;
		var flags = /(-[fq]{1,2})/g;
		var searchResults;
		while ((searchResults = flags.exec(message.content)) != null) {
			if (searchResults[0].includes("q"))
				quiet = true;
			if (searchResults[1].includes("f"))
				force = true;
		}

		// first, find out the if bot has the ability to delete messages in the first place
		if (hasPermission(message.channel, "MANAGE_MESSAGES", message.author)) {
			// the user has the permission, so now we can delete the messages
			var num = parseInt(/\d+/.exec(message.content));
			if (num >= 100 || num < 2) {
				// regect any more than 500 messages
				message.channel.sendMessage(`:warning: I can only delete 2-99 messages. ${num} is ${num>=100?"too many":"too few"}.`);
			} else {
				if (hasPermission(message.channel, "MANAGE_MESSAGES")) {
					if (!quiet) message.channel.sendMessage(`Removing ${num} messages from this channel${force?" (including pins)":" (excluding pins)"}...`)
						.then(msg => {
							// add 1 to num to account for !delmessages <number>
							deleteMessages(num, message.channel, msg, force, quiet);
						});
					else
						deleteMessages(num, message.channel, message, force, quiet);
				} else {
					message.channel.sendMessage(":warning: I don't have permission to do that.");
				}
			}
		} else {
			message.channel.sendMessage(":warning: You don't have permission to use this command.");
		}
	}
});

// num = number of messages to delete [2, 100)
// channel = the channel in which to delete the messages
// message = the message to retrieve messages before
// force = whether or not to delete pinned messages
// quiet = whether the bot should say anything
function deleteMessages(num, channel, message, force, quiet) {
	var lim = num + 1;
	if (quiet)
		lim = num;
	channel.fetchMessages({limit: lim, before: message.id})
		.then(messages => {
			var msgs = messages.array();
			var pinnedCount = 0;
			if (quiet)
				msgs.push(message);
			if (!force)
				for (var i = 0; i < msgs.length; i++) {
					if (msgs[i].pinned) {
						pinnedCount++;
						msgs.splice(i, 1);
						i--;
					}
				}
			if (pinnedCount > 0 && !quiet) channel.sendMessage(`Kept ${pinnedCount} pinned message${pinnedCount>1?"s":""}.`);
			channel.bulkDelete(msgs);
		});
}

client.on('error', (error) => {
	console.error("Encountered error:\n" + error);
	hadError = true;
	errorMessage = error;
});

client.on('warn', (warning) => {
	debugChannelMessage('warning', warning);
});

client.on('disconnect', () => {
	console.info("Disconnected from Discord, attempting to log in...");
});

try {
	client.login(token);
} catch(e) {
	console.error("there was an error logging in.");
}

// gracefully handle the control c
process.on('SIGINT', () => {
	console.info("Destroying bot and exiting...");
	client.destroy();
	process.exit(0);
});
