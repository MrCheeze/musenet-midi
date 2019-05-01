var parseMidi = require('midi-file').parseMidi;
var writeMidi = require('midi-file').writeMidi;

var inst_to_track = {"piano":0,"violin":1,"cello":2,"bass":3,"guitar":4,"flute":5,"clarinet":6,"trumpet":7,"harp":8,"drum":9};

window.importMidi = function() {
	alert("MIDI must be format 0, with 48 ticks per quarter note, with instruments mapped as follows:\nChannel 1: Piano\nChannel 2: Violin\nChannel 3: Cello\nChannel 4: Bass\nChannel 5: Guitar\nChannel 6: Flute\nChannel 7: Clarinet\nChannel 8: Trumpet\nChannel 9: Harp\nChannel 10: Drums\n");
	javascript:document.getElementById('file-input').click();
}
window.importMidiFile = function(file) {
	var reader = new FileReader();
	reader.readAsArrayBuffer(file);
	window.file = file;

	reader.onload = readerEvent => {
		var content = new Uint8Array(readerEvent.target.result);
		var midiData = parseMidi(content);
		console.log(midiData);

		if (midiData.header.format != 0) {
			alert("Must be type 0 MIDI. You can convert using Anvil Studio.");
			return;
		}

		var encoded = "";
		for (var i=0; i<midiData.tracks.length; i++) {
			if (i == 0) {
				for (var j=0; j<midiData.tracks[i].length; j++) {
					var event = midiData.tracks[i][j];
					var timeLeftToWait = event.deltaTime;
					while (timeLeftToWait > 0) {
						var waitTime = timeLeftToWait > 128 ? 128 : timeLeftToWait;
						var token = 3968 + waitTime - 1;
						encoded += token + " ";
						timeLeftToWait -= waitTime;
					}
					if (event.channel > 9) {
						alert("Must be no more than ten channels.");
						return;
					}
					if (event.type == "noteOff" || (event.type == "noteOn" && event.velocity==0)) {
						var baseNote = [0*128,15*128,17*128,19*128,21*128,23*128,25*128,27*128,29*128,null][event.channel];
						if (baseNote !== null) {
							token = baseNote + event.noteNumber;
							encoded += token + " ";
						}
					} else if (event.type == "noteOn" && event.velocity > 0) {
						var baseNote = [8*128,14*128,16*128,18*128,20*128,22*128,24*128,26*128,28*128,3840][event.channel];
						token = baseNote + event.noteNumber;
						encoded += token + " ";
					}
				}
			}
		}
		document.getElementById("inbox").value = encoded.trim();
		window.encodingToMidiFile(document.getElementById("inbox").value, "download_inbox");
	}
}

window.extend = function() {
	document.getElementById("button").disabled = true;
	fetch("https://musenet.openai.com/sample", {
		"method": "POST",
		"headers": {
			"Content-Type": "application/json"
		},
		"body": JSON.stringify({
			"genre":document.getElementById("genre").value,
			"instrument":{
				"piano": document.getElementById("piano").checked,
				"strings": document.getElementById("strings").checked,
				"winds": document.getElementById("winds").checked,
				"drums": document.getElementById("drums").checked,
				"harp": document.getElementById("harp").checked,
				"guitar": document.getElementById("guitar").checked,
				"bass": document.getElementById("bass").checked
			},
			"encoding":document.getElementById("inbox").value,
			"temperature":parseFloat(document.getElementById("temperature").value),
			"truncation":parseFloat(document.getElementById("truncation").value),
			"generationLength":parseFloat(document.getElementById("generationLength").value)
		})
	}).then(res => res.json()).then(function (response) {
		document.getElementById("outbox1").value = response.completions[0].encoding;
		document.getElementById("outbox2").value = response.completions[1].encoding;
		document.getElementById("outbox3").value = response.completions[2].encoding;
		document.getElementById("outbox4").value = response.completions[3].encoding;
		document.getElementById('sound1').src="data:audio/ogg;base64,"+response.completions[0].oggFile.substring(2,response.completions[0].oggFile.length-1);
		document.getElementById('sound2').src="data:audio/ogg;base64,"+response.completions[1].oggFile.substring(2,response.completions[1].oggFile.length-1);
		document.getElementById('sound3').src="data:audio/ogg;base64,"+response.completions[2].oggFile.substring(2,response.completions[2].oggFile.length-1);
		document.getElementById('sound4').src="data:audio/ogg;base64,"+response.completions[3].oggFile.substring(2,response.completions[3].oggFile.length-1);
		document.getElementById("button").disabled = false;
		window.encodingToMidiFile(response.completions[0].encoding, "download_outbox1");
		window.encodingToMidiFile(response.completions[1].encoding, "download_outbox2");
		window.encodingToMidiFile(response.completions[2].encoding, "download_outbox3");
		window.encodingToMidiFile(response.completions[3].encoding, "download_outbox4");
	}).catch(error => {
		alert(error);
		document.getElementById("button").disabled = false;
	});
}

window.encodingToMidiFile = function(encoding, outlink) {
	var midiData = {
	    header: {
	    	"format": 1,
	    	"numTracks": 10,
	    	"ticksPerBeat": 48
	    },
	    tracks: [[{"deltaTime":0,"channel":0,"type":"programChange","programNumber":0}],
	             [{"deltaTime":0,"channel":1,"type":"programChange","programNumber":40}],
	             [{"deltaTime":0,"channel":2,"type":"programChange","programNumber":42}],
	             [{"deltaTime":0,"channel":3,"type":"programChange","programNumber":32}],
	             [{"deltaTime":0,"channel":4,"type":"programChange","programNumber":24}],
	             [{"deltaTime":0,"channel":5,"type":"programChange","programNumber":73}],
	             [{"deltaTime":0,"channel":6,"type":"programChange","programNumber":71}],
	             [{"deltaTime":0,"channel":7,"type":"programChange","programNumber":56}],
	             [{"deltaTime":0,"channel":8,"type":"programChange","programNumber":46}],
	             [{"deltaTime":0,"channel":9,"type":"programChange","programNumber":0}]]
	};

	var tokens = encoding.split(" ");

	var deltaTimes = [0,0,0,0,0,0,0,0,0,0];
	for (var i=0; i<tokens.length; i++) {
		var token = tokens[i];
		var parsedToken = parseToken(token);
		if (parsedToken.type == "note") {
			var trackIndex = inst_to_track[parsedToken.instrument];
			midiData.tracks[trackIndex].push({
				"deltaTime": deltaTimes[trackIndex],
				"channel": trackIndex,
				"type": parsedToken.volume > 0 ? "noteOn" : "noteOff",
				"noteNumber": parsedToken.pitch,
				"velocity": parsedToken.volume
			});
			deltaTimes[trackIndex] = 0;
		} else if (parsedToken.type == "wait") {
			for (var j=0; j<10; j++) {
				deltaTimes[j] += parsedToken.delay;
			}
		}
	}

	console.log(midiData);

	var midiBlob = new Blob([new Uint8Array(writeMidi(midiData))], {type: "audio/midi"});
	document.getElementById(outlink).href = URL.createObjectURL(midiBlob);
	document.getElementById(outlink).download = "output.mid";
}
window.encodingToMidiFile(document.getElementById("inbox").value, "download_inbox");
window.encodingToMidiFile(document.getElementById("outbox1").value, "download_outbox1");
window.encodingToMidiFile(document.getElementById("outbox2").value, "download_outbox2");
window.encodingToMidiFile(document.getElementById("outbox3").value, "download_outbox3");
window.encodingToMidiFile(document.getElementById("outbox4").value, "download_outbox4");

function parseToken(token) {
	token = +token;
	if (token >= 0 && token < 3840) {
		var pitch = token % 128;
		var inst_vol_index = token >> 7;
		var instrument = ["piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano",
		                  "violin","violin","cello","cello","bass","bass","guitar","guitar",
		                  "flute","flute","clarinet","clarinet","trumpet","trumpet","harp","harp"][inst_vol_index];
		var volume = [0,24,32,40,48,56,64,72,80,88,96,104,112,120,80,0,80,0,80,0,80,0,80,0,80,0,80,0,80,0][inst_vol_index];
		return {"type":"note","pitch":pitch,"instrument":instrument,"volume":volume};
	} else if (token >= 3840 && token < 3968) {
		var pitch = token % 128;
		return {"type":"note","pitch":pitch,"instrument":"drum","volume":80};
	} else if (token >= 3968 && token < 4096) {
		var delay = (token % 128) + 1;
		return {"type":"wait","delay":delay}
	} else if (token == 4096) {
		return {"type":"start"}
	} else {
		return {"type":"invalid"}
	}

}