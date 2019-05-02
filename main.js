var parseMidi = require('midi-file').parseMidi;
var writeMidi = require('midi-file').writeMidi;

var inst_to_track = {"piano":0,"violin":1,"cello":2,"bass":3,"guitar":4,"flute":5,"clarinet":6,"trumpet":7,"harp":8,"drum":9};

var importedMidiTicksPerBeat = 48; // Default value if no MIDI imported

window.copyup = function(elemid) {
	document.getElementById("inbox").value = document.getElementById(elemid).value.trim();
	window.encodingToMidiFile(document.getElementById("inbox").value, "download_inbox");
}

window.importMidi = function() {
	alert("If the tempo sounds very wrong, change the MIDI ticks-per-beat to 48 using your MIDI editor of choice.");
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

		importedMidiTicksPerBeat = midiData.header.ticksPerBeat;

		var allDeltaTimes = new Set();
		allDeltaTimes.add(importedMidiTicksPerBeat);
		
		for (var i=0; i<midiData.tracks.length; i++) {
			for (var j=0; j<midiData.tracks[i].length; j++) {
				allDeltaTimes.add(midiData.tracks[i][j].deltaTime);
			}
		}
		var divideAllDeltaTimesBy = findGCFofList(Array.from(allDeltaTimes));
		console.log(allDeltaTimes, divideAllDeltaTimesBy);
		console.log(importedMidiTicksPerBeat);
		importedMidiTicksPerBeat /= divideAllDeltaTimesBy;
		console.log(importedMidiTicksPerBeat);
		var multiplyAllDeltaTimesBy = 1;
		if (importedMidiTicksPerBeat < 48) {
			multiplyAllDeltaTimesBy = Math.round(48/importedMidiTicksPerBeat);
		}
		importedMidiTicksPerBeat *= multiplyAllDeltaTimesBy;
		console.log(importedMidiTicksPerBeat);

		var mergedTrack = [];
		var originalOrder = 0;
		for (var i=0; i<midiData.tracks.length; i++) {
			var startTime = 0;
			var currentInst = 0;
			for (var j=0; j<midiData.tracks[i].length; j++) {
				var event = midiData.tracks[i][j];
				if (event.type == "programChange") {
					currentInst = event.programNumber;
				}
				startTime += (event.deltaTime / divideAllDeltaTimesBy) * multiplyAllDeltaTimesBy;
				event.startTime = startTime;
				event.originalOrder = originalOrder;
				event.currentInst = currentInst;
				mergedTrack.push(event);
				originalOrder++;
			}
		}
		mergedTrack.sort(function(a, b){
			if(a.startTime < b.startTime) { return -1; }
			if(a.startTime > b.startTime) { return 1; }
			if(a.originalOrder < b.originalOrder) { return -1; }
			if(a.originalOrder > b.originalOrder) { return 1; }
			return 0;
		})

		document.getElementById("piano").checked = false;
		document.getElementById("strings").checked = false;
		document.getElementById("winds").checked = false;
		document.getElementById("drums").checked = false;
		document.getElementById("harp").checked = false;
		document.getElementById("guitar").checked = false;
		document.getElementById("bass").checked = false;

		var encoded = "";
		for (var i=0; i<mergedTrack.length; i++) {
			var event = mergedTrack[i];
			var deltaTime = (i == 0) ? event.startTime : (event.startTime - mergedTrack[i-1].startTime);
			var timeLeftToWait = deltaTime;
			while (timeLeftToWait > 0) {
				var waitTime = timeLeftToWait > 128 ? 128 : timeLeftToWait;
				var token = 3968 + waitTime - 1;
				encoded += token + " ";
				timeLeftToWait -= waitTime;
			}
			var inst;
			var baseNoteOn;
			var baseNoteOff;
			var checkboxID;
			if ([40,41,44,45,48,49,50,51].indexOf(event.currentInst) > -1) {
				inst = "violin";
				var baseNoteOn = 14*128;
				var baseNoteOff = 15*128;
				checkboxID = "strings";
			} else if ([42,43].indexOf(event.currentInst) > -1) {
				inst = "cello";
				var baseNoteOn = 16*128;
				var baseNoteOff = 17*128;
				checkboxID = "strings";
			} else if ([32,33,34,35,36,37,38,39].indexOf(event.currentInst) > -1) {
				inst = "bass";
				var baseNoteOn = 18*128;
				var baseNoteOff = 19*128;
				checkboxID = "bass";
			} else if ([24,25,26,27,28,29,30,31].indexOf(event.currentInst) > -1) {
				inst = "guitar";
				var baseNoteOn = 20*128;
				var baseNoteOff = 21*128;
				checkboxID = "guitar";
			} else if ([72,73,74,75,76,77,78,79].indexOf(event.currentInst) > -1) {
				inst = "flute";
				var baseNoteOn = 22*128;
				var baseNoteOff = 23*128;
				checkboxID = "winds";
			} else if ([64,65,66,67,68,69,70,71].indexOf(event.currentInst) > -1) {
				inst = "clarinet";
				var baseNoteOn = 24*128;
				var baseNoteOff = 25*128;
				checkboxID = "winds";
			} else if ([56,57,58,59,60,61,62,63].indexOf(event.currentInst) > -1) {
				inst = "trumpet";
				var baseNoteOn = 26*128;
				var baseNoteOff = 27*128;
				checkboxID = "winds";
			} else if ([46].indexOf(event.currentInst) > -1) {
				inst = "harp";
				var baseNoteOn = 28*128;
				var baseNoteOff = 29*128;
				checkboxID = "harp";
			} else {
				inst = "piano";
				baseNoteOn = 8*128;
				baseNoteOff = 0*128;
				checkboxID = "piano";
			}

			if (event.channel == 9) {
				inst = "drum";
				var baseNoteOn = 3840;
				var baseNoteOff = null;
				checkboxID = "drums";
			}
			if (event.type == "noteOff" || (event.type == "noteOn" && event.velocity==0)) {
				if (baseNoteOff !== null) {
					token = baseNoteOff + event.noteNumber;
					encoded += token + " ";
				}
			} else if (event.type == "noteOn" && event.velocity > 0) {
				token = baseNoteOn + event.noteNumber;
				encoded += token + " ";
				document.getElementById(checkboxID).checked = true;
			}
		}

		document.getElementById("inbox").value = encoded.trim();
		window.encodingToMidiFile(document.getElementById("inbox").value, "download_inbox");
	}
}

function GCF(a, b) {
    if (b === 0) return a;
    else         return GCF(b, a % b);
}
function findGCFofList(list) {
    return list.reduce(GCF);
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
		window.oldDuration = Math.min(document.getElementById('sound1').duration,
								   document.getElementById('sound2').duration,
								   document.getElementById('sound3').duration,
								   document.getElementById('sound4').duration);
		if (isNaN(oldDuration) || !isFinite(oldDuration)) {
			oldDuration = 0;
		}
		//need to convert from dataURI to blob to avoid firefox issue
		document.getElementById('sound1').src=URL.createObjectURL(new Blob([convertDataURIToBinary("data:audio/ogg;base64,"+response.completions[0].oggFile.substring(2,response.completions[0].oggFile.length-1))], {type : 'audio/ogg'}));
		document.getElementById('sound2').src=URL.createObjectURL(new Blob([convertDataURIToBinary("data:audio/ogg;base64,"+response.completions[1].oggFile.substring(2,response.completions[1].oggFile.length-1))], {type : 'audio/ogg'}));
		document.getElementById('sound3').src=URL.createObjectURL(new Blob([convertDataURIToBinary("data:audio/ogg;base64,"+response.completions[2].oggFile.substring(2,response.completions[2].oggFile.length-1))], {type : 'audio/ogg'}));
		document.getElementById('sound4').src=URL.createObjectURL(new Blob([convertDataURIToBinary("data:audio/ogg;base64,"+response.completions[3].oggFile.substring(2,response.completions[3].oggFile.length-1))], {type : 'audio/ogg'}));
		document.getElementById("outbox1").value = response.completions[0].encoding;
		document.getElementById("outbox2").value = response.completions[1].encoding;
		document.getElementById("outbox3").value = response.completions[2].encoding;
		document.getElementById("outbox4").value = response.completions[3].encoding;
		window.encodingToMidiFile(response.completions[0].encoding, "download_outbox1");
		window.encodingToMidiFile(response.completions[1].encoding, "download_outbox2");
		window.encodingToMidiFile(response.completions[2].encoding, "download_outbox3");
		window.encodingToMidiFile(response.completions[3].encoding, "download_outbox4");
		document.getElementById('sound1').currentTime = oldDuration;
		document.getElementById('sound2').currentTime = oldDuration;
		document.getElementById('sound3').currentTime = oldDuration;
		document.getElementById('sound4').currentTime = oldDuration;
		document.getElementById("button").disabled = false;
	}).catch(error => {
		alert(error);
		document.getElementById("button").disabled = false;
	});
}

function convertDataURIToBinary(dataURI) {
	var BASE64_MARKER = ';base64,';
	var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
	var base64 = dataURI.substring(base64Index);
	var raw = window.atob(base64);
	var rawLength = raw.length;
	var array = new Uint8Array(new ArrayBuffer(rawLength));

	for(i = 0; i < rawLength; i++) {
		array[i] = raw.charCodeAt(i);
	}
	return array;
}

window.oldDuration = 0;

window.encodingToMidiFile = function(encoding, outlink) {
	var midiData = {
	    header: {
	    	"format": 1,
	    	"numTracks": 10,
	    	"ticksPerBeat": importedMidiTicksPerBeat
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

	var tokens = encoding.trim().split(" ");

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

	for (var i=0; i<midiData.tracks.length; i++) {
		midiData.tracks[i].push({
			"deltaTime": deltaTimes[trackIndex],
			"meta": true,
			"type": "endOfTrack"
		});
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