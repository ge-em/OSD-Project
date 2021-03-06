const Discord = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const bot = new Discord.Client();
bot.commands = new Discord.Collection();
let queue = {};
let nowPlaying = {};
var previousSong = {
	"list": []
}; //making a list to save the previous song

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.send(`Add some songs to the queue first with ${tokens.prefix}add`);
		if (!msg.guild.voiceConnection) return commands.join(msg).then(() => commands.play(msg));
		if (queue[msg.guild.id].playing) return msg.channel.send('Already Playing');
		let dispatcher;
		queue[msg.guild.id].playing = true;
		(function play(song) {
			if (song === undefined) return msg.channel.send('Queue is empty').then(() => {
				queue[msg.guild.id].playing = false;
				msg.member.voiceChannel.leave();
			});
			console.log(song);
			msg.channel.send(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			nowPlaying = song;
			previousSong.list.push(song);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });
			let collector = msg.channel.createCollector(m => m);
			collector.on('collect', m => {
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					msg.channel.send('paused').then(() => {dispatcher.pause();});
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					msg.channel.send('resumed').then(() => {dispatcher.resume();});
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					if(m.author.username === tokens.current_bot_name){
						dispatcher.end();
					}
					else
					msg.channel.send('skipped').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+')){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-')){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					msg.channel.send(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				}
			});
			dispatcher.on('end', () => {
				console.log(`${queue[msg.guild.id].songs}-end`)
				collector.stop();
				play(queue[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.send('error: ' + err).then(() => {
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
		if (url == '' || url === undefined) return msg.channel.send(`You must add a YouTube video url, or id after ${tokens.prefix}add`);
		yt.getInfo(url, (err, info) => {
			if(err) return msg.channel.send('Invalid YouTube Link: ' + err);
			if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
			queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username});
			console.log(queue[msg.guild.id])
			if(msg.author.username === tokens.current_bot_name){
				msg.channel.send(`===================`)
			} else {
				msg.channel.send(`added **${info.title}** to the queue`);
			}
		});
	},
	'lyric': (msg) => {
		if (queue[msg.guild.id] === undefined || queue[msg.guild.id].playing == false) return msg.channel.send(`Play a song first`); 
		// ^restrict the user if there are no song playing
		const solenolyrics= require("solenolyrics"); 
		async function runLyric() {
			var lyrics = await solenolyrics.requestLyricsFor(nowPlaying.title);  
			//^use solelyric library and give song title as the argument
			msg.channel.send(lyrics, {split: true}); //send lyric to discord
		}
		runLyric(); //start the function
	},
	'nowplaying': (msg) => {
		if (queue[msg.guild.id] === undefined || queue[msg.guild.id].playing == false) return msg.channel.send(`Play a song first`);
		// ^restrict the user if there are no song playing
		msg.channel.send(nowPlaying.title); //print what song is playing to discord
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.send(`Add some songs to the queue first with "${tokens.prefix}add"`);
		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.send(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'clear': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.send(`Queue Cleared!`); //send message that queue is cleared
		console.log(`queue cleared`) //send identifier that code is running to console
		if (queue.songs != []){	//check if the queue is not empty
		if (queue[msg.guild.id].playing === true) {//clear queue when playing
			queue[msg.guild.id].songs = [];//empty the queue
		} else if (queue[msg.guild.id].playing === false) { //clear queue while not playing
			queue[msg.guild.id].songs = []; //empty the queue
		}
			console.log(queue);	
			console.log(queue[msg.guild.id]);
			console.log(`queue cleared`)
			return msg.channel.send(`Queue Cleared!`);	//give response to discord		
		}
		},
	'lastsong': (msg) => {
		if (previousSong.list.length < 2) return msg.channel.send(`There are no song to be played`);
		//^algorith that tell if there are no songs played before, send error message to user
		commands.join(msg); //bot join voice channel
		commands.clear(msg); //bot clear queue so it will not play the next song
		function skipping() {
			msg.channel.send(`!skip`) //skip the current song if it is playing
		  }	  
		setTimeout(skipping, 100); //wait the song skip
		function adding() {
			msg.channel.send(`!add ${previousSong.list[1].url}`) 
			//^tell user that it add previous song to queue
		  }
		setTimeout(adding, 300); //after the bot response to skip song, add song
		function playing() {
			commands.play(msg); //call play function
		  }	  
		setTimeout(playing, 2000);//give time for bot to load the song
	},
	'help': (msg) => {
		let tosend = ['```xl', 
		tokens.prefix + 'join : "Join Voice channel of msg sender"',	
		tokens.prefix + 'add : "Add a valid youtube link to the queue"', 
		tokens.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', 
		tokens.prefix + 'clear : "Clear the songs queue"',
		tokens.prefix + 'lastsong : "Play previous song, can only be done after playing atleast 2 song in advance"',
		tokens.prefix + 'lyric : "Show the lyric of current song"',
		tokens.prefix + 'nowplaying : "Show information of current song"',
		tokens.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'the following commands only function while the play command is running:'.toUpperCase(), 
		tokens.prefix + 'pause : "pauses the music"',	
		tokens.prefix + 'resume : "resumes the music"', 
		tokens.prefix + 'skip : "skips the playing song"', 
		tokens.prefix + 'time : "Shows the playtime of the song."',	
		'volume+(+++) : "increases volume by 2%/+"',	
		'volume-(---) : "decreases volume by 2%/-"',	'```'];
		msg.channel.send(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == tokens.adminID) process.exit(); //Requires a node module like Forever to work.
	}
};

bot.on('ready', () => {
	console.log('Ready!');
   });

bot.on('message', message => {
	if (!message.content.startsWith(tokens.prefix)) return; //check if there is no prefix in the message	
	if (commands.hasOwnProperty(message.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0])) {
		console.log(`${message.author.username}: ${message.content}`);	//let console to print what command is run
		commands[message.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]](message); //massage from user is read by command function
	};
});
bot.login(tokens.d_token);