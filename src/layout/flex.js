var df = require('./dataFormat.js');

function validateLayoutData(bound, children, fIndex, stateData) {
	var calcsize = (stateData.sizePerElement * stateData.countAdj) + stateData.calculatedOffset;
	if (calcsize !== stateData.sizeAdj && stateData.sizeAdj > 0 && stateData.countAdj > 0) {
		console.error((stateData.sizeAdj < 0 ? 'layout overflow, could be okay' : ''),
			'NOT EQAUAL, review the horizontal layout algorithm: ' + stateData.sizeAdj +
			', ' + calcsize + ', ' + stateData.calculatedOffset);
	}
	if (stateData.remainingOffset > stateData.countAdj) throw 'MATH is BROKEN AAAH';

	if (stateData.sizePerElement <= 0 && stateData.countAdj > 0) {
		console.error('could not fit all elements');
	}

	if (!stateData.needRecalculate) {

		let dyns = 0;
		const all = children.reduce((prev, crnt) => {
			if (crnt.sizeDyn[fIndex]) ++dyns;
			return prev + crnt.size[fIndex];
		}, 0);

		if (bound > all && dyns > 0) {
			console.error('calculation error, elements will not fill total space' +
				': expected total width: ' + bound + ' actual total width:' + all);
		}

	}
}

//prepare element array for processing
const prepareArray = (elementArray) => elementArray.map(e => new df.GenericToLPO(e));


function getWidthOfNonDynamic(elements) {
	let result = {
		size: elements.map(x => 0),
		count: elements.map(x => 0)
	};

	for (let j = 0, el = elements[0]; j < elements.length; j++, el = elements[j]) {
		for (let i = 0, size; i < el.size.length; i++) {
			const size = !el.sizeDyn[i] ? (el.size[i] > 0 ? el.size[i] : 0) : 0;
			result.size[i] += size;
			result.count[i] += size > 0 ? 1 : 0;
		}
	}
	return result;
}

function calculateSize(current, state, fIndex) {
	var couldNotFit = false;
	//Set dynamic or fixed size
	if (current.sizeDyn[fIndex]) {
		current.size[fIndex] = state.sizePerElement * current.sizeWeight[fIndex];
		current.size[fIndex] += (state.remainingOffset | 0) > 0 ? state.adjust[fIndex] : 0;

		if (current.size[fIndex] < state.sizeMin[fIndex]) {
			current.sizeMin[fIndex] = state.sizeMin[fIndex] > current.sizeMin[fIndex] ?
				state.sizeMin[fIndex] : current.sizeMin[fIndex];
			couldNotFit = true;
		} else {
			var sz = current.size[fIndex];
			state.offsetAccumulator += (current.size[fIndex] - (current.size[fIndex] | 0));
			current.size[fIndex] = current.size[fIndex] | 0;

		}
		state.remainingOffset -= state.adjust[fIndex];
	}

	//If minWidth is set, set it as width and recalculate by calling this function again
	if (current.sizeMin[fIndex] > current.size[fIndex]) {
		state.needRecalculate = true;
		current.sizeDyn[fIndex] = false;
		current.size[fIndex] = current.sizeMin[fIndex];
	}

	if (current.sizeMax[fIndex] > 0 && current.sizeMax[fIndex] < current.size[fIndex]) {
		state.needRecalculate = true;
		current.sizeDyn[fIndex] = false;
		current.size[fIndex] = current.sizeMax[fIndex];
	}

	return couldNotFit ? 1 : 0;
}


function calculateLayout(bound, children, fIndex, offsetAccumulator) {
	//TODO add element size 'sizeWeight'
	var fixCalc = getWidthOfNonDynamic(children);
	var stateData = {
		sizePerElement: null,
		remainingOffset: null,
		offsetAccumulator: -offsetAccumulator || 0,
		needRecalculate: false,
		adjust: [1, 1],
		sizeMin: [1, 1],
		sizeAdj: bound - fixCalc.size[fIndex],
		countAdj: children.reduce((prev, next) => prev + next.sizeWeight[fIndex], 0) - fixCalc.count[fIndex]
			//children.length - fixCalc.count[fIndex]
	};

	stateData.sizePerElement = stateData.countAdj > 0 ? (stateData.sizeAdj / stateData.countAdj) : 0;
	if (stateData.sizePerElement < 0) stateData.sizePerElement = 0;
	stateData.remainingOffset = offsetAccumulator || 0;
	stateData.calculatedOffset = stateData.remainingOffset + stateData.offsetAccumulator;

	for (var i = 0; i < children.length; i++) {
		calculateSize(children[i], stateData, fIndex);
	}

	if (stateData.offsetAccumulator > 0 && !stateData.needRecalculate) {
		//deal with rounding errors, six decimals should be enough precision, maybe too much
		stateData.offsetAccumulator = Math.round(stateData.offsetAccumulator * 1000000) / 1000000;
		if (stateData.offsetAccumulator > 0) stateData.needRecalculate = true;
	} else {
		stateData.offsetAccumulator = 0;
	}

	//If the layout does not fill the available space after all calcalutions,
	///than add 1 to the size to correct for that,
	//NOTE this only happens when element weight is a bigger number than the actual layout space
	if (!stateData.needRecalculate) {
		var dyns = children.reduce((prev, crnt) => crnt.sizeDyn[fIndex] ? prev + 1 : prev, 0);
		var all = children.reduce((prev, crnt) => prev + crnt.size[fIndex], 0);

		if (bound > all && dyns > 0) {
			stateData.needRecalculate = true;
			stateData.offsetAccumulator += 1;
		}

	}

	validateLayoutData(bound, children, fIndex, stateData);

	return stateData.needRecalculate ?
		calculateLayout(bound, children, fIndex, stateData.offsetAccumulator) : children;

}
var calculateWidthLayout = (bound, children) => calculateLayout(bound, prepareArray(children), 0);

exports.calculateWidthLayout = calculateWidthLayout;
exports.calculateLayout = calculateLayout;
