// ==UserScript==
// @name         Madoka ftw
// @namespace    *
// @version      0.1
// @description  Madoka ftw
// @author       pavlukivan
// @match        *://*/*
// ==/UserScript==

//config start
var letterCount = 6; //letters to replace, ordered by usage frequency
var allToUpper = false;
var allToLower = true;
var transformCyrillic = true;

//config that you probably shouldn't change
var finalTransforms = {'v':'V', 'x':'X'}; //v and x letters' modern style is unknown, use archaic instead
var styleContent = "font-family:MadokaRunes!important;";
var tagBlacklist = ["text"]; //script, style and title are there by default
//config end

//       charset: 1234567890qwertyuiopasdfghjklzxcvbnmßüöä. English wikipedia is used for reference. Upper because 'ß'.toUpperCase() == 'SS', not 'ẞ'
//var charFreq = 'EAIOTNRSLDCUHMGPFYB0VW1K23549ZX687JQÜÄÖẞ';
var charFreq = 'EAÄIOÖTNRSLDCUÜHMGPFYB0VW1K23549ZX687JQẞ'; //changed order of umlauted chars

var lowFreq = charFreq.toLowerCase();

var marker = "w17ch_k155"; //a random string used to mark stuff already affected by script

letterCount = Math.min(charFreq.length, letterCount);

var style = document.createElement("style");
style.type = "text/css";
style.innerHTML = (letterCount == charFreq.length ? "*" : "." + marker) + " { " + styleContent + " }";
document.lastChild.appendChild(style);

//https://github.com/greybax/cyrillic-to-translit-js/blob/master/CyrillicToTranslit.js
const cyr2lat = {"а": "a","б": "b","в": "v","ґ": "g","г": "g","д": "d","е": "e","ё": "yo","є": "ye","ж": "zh","з": "z","и": "i","і": "i","ї": "yi","й": "i","к": "k","л": "l","м": "m","н": "n","о": "o","п": "p","р": "r","с": "s","т": "t","у": "u","ф": "f","х": "h","ц": "c","ч": "ch","ш": "sh","щ": "sh'","ъ": "'","ы": "y","ь": "'","э": "e","ю": "yu","я": "ya",};

function shouldRunify(input) {
	var i = lowFreq.indexOf(input.toLowerCase());
	return i >= 0 && i < letterCount;
}

function runifiedSpan(input) {
	var text = "";
    for(var j = 0; j < input.length; ++j) {
        var i = lowFreq.indexOf(input[j].toLowerCase());
        if(i < 0) {
            text += input[j];
        } else {
            var c = ((!allToLower && (input[j] === input.toUpperCase() || allToUpper)) ? charFreq[i] : lowFreq[i]);
            if(finalTransforms[c]) {
            	text += finalTransforms[c];
            } else {
            	text += c;
            }
        }
    }

	var span = document.createElement('span');
	span.classList.add(marker);
	span.innerText = text;
	return span;
}

function translate(input) {
	const normalizedInput = input.normalize();
	let newStr = "";
	let newType = -1;

	let ret = [];

	function addData(data, type) {
		if(type != newType) {
			if(newStr) {
				ret.push([newType, newStr]);
			}
			newType = type;
			newStr = data;
		} else {
			newStr += data;
		}
	}

	for (let i = 0; i < normalizedInput.length; i++) {
		let strLowerCase = normalizedInput[i].toLowerCase();

		var toAdd = "";

		if (!transformCyrillic || !cyr2lat[strLowerCase]) {
			toAdd = normalizedInput[i];
		} else {
			toAdd = cyr2lat[strLowerCase];
		}

		var runifyCount = 0;

		for(let j = 0; j < toAdd.length; ++j) {
			if(shouldRunify(toAdd[j])) {
				++runifyCount;
			}
		}

		if(runifyCount == 0) {
			addData(normalizedInput[i], 0);
		} else {
			for(let k = 0; k < toAdd.length; ++k) {
				addData(toAdd[k], shouldRunify(toAdd[k]) ? 1 : 0);
			}
		}
	}
	addData(null, -1);
	return ret;
}

function runifyNode(node, descend=false) {
	var i = 0;
	if(descend && node.children) {
		for(i = 0; i < node.children.length; ++i) {
			runifyNode(node.children[i], descend);
		}
	}

	if(node.getAttribute && node.getAttribute(marker) != "true") {
		subscribe(node);
		node.setAttribute(marker, "true");
	}

	if((node.classList && node.classList.contains(marker)) || !node.childNodes) { //don't change stuff that IS the changes
		return;
	}

	if(node.tagName) {
		var tag = node.tagName.toLowerCase();

		if(tag == "script" || tag == "style" || tag == "title" || tagBlacklist.indexOf(tag) >= 0) {
			return;
		}
	}

	function toNode(e) {
		if(e[0] == 0) {
			return document.createTextNode(e[1]);
		} else {
			return runifiedSpan(e[1]);
		}
	}

	for(i = 0; i < node.childNodes.length; ++i) {
		if(node.childNodes[i].nodeType == 3) { //text node{
			var upd = translate(node.childNodes[i].nodeValue);
			if(upd.length == 0) { //text node ends up being removed
				node.removeChild(node.childNodes[i]);
				--i;
			} else if(upd.length > 1 || (upd.length >= 1 && upd[0][0] == 1)) { //if we add or change nodes
				var ref = toNode(upd[upd.length - 1]);
				node.replaceChild(ref, node.childNodes[i]);
				for(var j = 0; j < upd.length - 1; ++j) {
					node.insertBefore(toNode(upd[j]), ref);
				}
				i += upd.length - 1; //we added a bunch of nodes, update current index to reflect that
			}
		}
	}
}


function subscriber(mutations) {
	if(!mutations) {
		return;
	}
	for(var i = 0; i < mutations.length; ++i) {
		if(mutations[i].type == 'characterData') {
			runifyNode(mutations[i].target);
		} else if(mutations[i].type == 'childList') {
			runifyNode(mutations[i].target, true);
		}
	}
}

function subscribe(node) {
	// Track innerText changes and the like
	observer.observe(node, config1);
	// Tracks textContent changes and new nodes
	observer.observe(node, config2);
}

var config1 = {
	attributes: false,
	attributeOldValue: false,
	characterData: true,
	characterDataOldValue: false,
	childList: false,
	subtree: true
};

var config2 = {
	attributes: false,
	attributeOldValue: false,
	characterData: false,
	characterDataOldValue: false,
	childList: true,
	subtree: false
};

var observer = new MutationObserver(subscriber);

if(letterCount != charFreq.length)
	runifyNode(document, true);