const Discord = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const bot = new Discord.Client();
bot.commands = new Discord.Collection();
let queue = {};
let loop = false;
let nowPlaying = {};
var previousSong = {
	"list": []
};

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Add some songs to the queue first with ${tokens.prefix}add`);
		if (!msg.guild.voiceConnection) return commands.join(msg).then(() => commands.play(msg));
		if (queue[msg.guild.id].playing) return msg.channel.sendMessage('Already Playing');
		let dispatcher;
		queue[msg.guild.id].playing = true

		console.log(queue[msg.guild.id].playing);
		console.log(queue);
		(function play(song) {
			console.log(song);
			if (song === undefined) return msg.channel.sendMessage('Queue is empty').then(() => {
				queue[msg.guild.id].playing = false;
				msg.member.voiceChannel.leave();
			});
			console.log(song);
			msg.channel.sendMessage(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			nowPlaying = song;
			previousSong.list.push(song);
			console.log(`previous song:`)
			console.log(previousSong)
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });
			let collector = msg.channel.createCollector(m => m);
			collector.on('message', m => {
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					msg.channel.sendMessage('paused').then(() => {dispatcher.pause();});
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					msg.channel.sendMessage('resumed').then(() => {dispatcher.resume();});
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					if(m.author.username === tokens.current_bot_name){
						dispatcher.end();
					}
					else
					msg.channel.sendMessage('skipped').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+')){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-')){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					msg.channel.sendMessage(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				}
			});
			dispatcher.on('end', () => {
				console.log(`${queue[msg.guild.id].songs}-end`)
				collector.stop();
				play(queue[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.sendMessage('error: ' + err).then(() => {
					console.log(`${queue[msg.guild.id].songs}-err`)
					collector.stop();
					play(queue[msg.guild.id].songs.shift());
				});
			});
		})
		(queue[msg.guild.id].songs.shift());
		console.log(`${queue[msg.guild.id].songs}-..`);
	},
	'join': (msg) => {
		return new Promise((resolve, reject) => {
			const voiceChannel = msg.member.voiceChannel;
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply('I couldn\'t connect to your voice channel...');
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'add': (msg) => {
		let url = msg.content.split(' ')[1];
		if (url == '' || url === undefined) return msg.channel.sendMessage(`You must add a YouTube video url, or id after ${tokens.prefix}add`);
		yt.getInfo(url, (err, info) => {
			if(err) return msg.channel.sendMessage('Invalid YouTube Link: ' + err);
			if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
			queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username});
			msg.channel.sendMessage(`added **${info.title}** to the queue`);
		});
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Add some songs to the queue first with ${tokens.prefix}add`);
		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.sendMessage(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'clear': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Queue Cleared!`);
		if (queue.songs != []){	//check if the queue is not empty
		if (queue[msg.guild.id].playing === true) {//clear queue when playing
			queue[msg.guild.id].songs = [];//empty the queue
		} else if (queue[msg.guild.id].playing === false) { //clear queue while not playing
			queue[msg.guild.id].songs = []; //empty the queue
		}
			console.log(queue);	
			console.log(queue[msg.guild.id]);
			return msg.channel.sendMessage(`Queue Cleared!`);	//give response to discord
		}
		},
	'lastsong': (msg) => {
		commands.join(msg);
		commands.clear(msg);
		function skipping() {
			msg.channel.sendMessage(`!skip`)
		  }	  
		setTimeout(skipping, 100);
		function adding() {
			msg.channel.sendMessage(`!add ${previousSong.list[1].url}`)
		  }
		setTimeout(adding, 300);
		function playing() {
			commands.play(msg);
		  }	  
		setTimeout(playing, 2000);
	},
		/*
	'loop': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Can not Loop withour queue`);
		if (loop === false) { 
			loop = true;//change loop permision to true
			console.log(`loop queue => queue`)
			loopQueue = queue
			msg.channel.sendMessage('Looping queue');
			if (!msg.guild.voiceConnection) return commands.join(msg).then(() => commands.play(msg));
		} else if (loop === true) {
			loop = false;//change loop permision to false
			console.log(`loop queue => queue`)
			queue = loopQueue
			msg.channel.sendMessage('Stop looping queue');
			msg.member.voiceChannel.leave();
		}
	},*/
	'help': (msg) => {
		let tosend = ['```xl', 
		tokens.prefix + 'join : "Join Voice channel of msg sender"',	
		tokens.prefix + 'add : "Add a valid youtube link to the queue"', 
		tokens.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', 
		tokens.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'the following commands only function while the play command is running:'.toUpperCase(), 
		tokens.prefix + 'pause : "pauses the music"',	
		tokens.prefix + 'resume : "resumes the music"', 
		tokens.prefix + 'skip : "skips the playing song"', 
		tokens.prefix + 'time : "Shows the playtime of the song."',	
		'volume+(+++) : "increases volume by 2%/+"',	
		'volume-(---) : "decreases volume by 2%/-"',	'```'];
		msg.channel.sendMessage(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == tokens.adminID) process.exit(); //Requires a node module like Forever to work.
	}
};

bot.on('ready', () => {
	console.log('Ready!');
	console.log(bot.token.id);
   });
bot.on('reconnecting', () => {
	console.log('Reconnecting!');
   });
bot.on('disconnect', () => {
	console.log('Disconnect!');
   });

bot.on('message', message => {
	if (!message.content.startsWith(tokens.prefix)) return; //check if there is no prefix in the message	
	if (commands.hasOwnProperty(message.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0])) {
		console.log(`${message.author.username}: ${message.content}`);	//let console to print what command is run
		commands[message.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]](message); //massage from user is read by command function
	};
});
bot.login(tokens.d_token);