﻿"use strict";

/* CellEditorView.js
 *
 * Author: Dmitry.Sokolov@avsmedia.net
 * Date:   May 30, 2012
 */
(
	/**
	 * @param {jQuery} $
	 * @param {Window} window
	 * @param {undefined} undefined
	 */
	function($, window, undefined) {


		/*
		 * Import
		 * -----------------------------------------------------------------------------
		 */
		var asc = window["Asc"];

		var asc_calcnpt = asc.calcNearestPt;
		var asc_getcvt  = asc.getCvtRatio;
		var asc_round   = asc.round;
		var asc_search  = asc.search;
		var asc_lastidx = asc.lastIndexOf;

		var asc_HL = asc.HandlersList;
		var asc_incDecFonSize = asc.incDecFonSize;


		/** @const */
		var kLeftAlign = "left";
		/** @const */
		var kRightAlign = "right";
		/** @const */
		var kCenterAlign = "center";

		/** @const */
		var kBeginOfLine = -1;
		/** @const */
		var kBeginOfText = -2;
		/** @const */
		var kEndOfLine   = -3;
		/** @const */
		var kEndOfText   = -4;
		/** @const */
		var kNextChar    = -5;
		/** @const */
		var kNextWord    = -6;
		/** @const */
		var kNextLine    = -7;
		/** @const */
		var kPrevChar    = -8;
		/** @const */
		var kPrevWord    = -9;
		/** @const */
		var kPrevLine    = -10;
		/** @const */
		var kPosition    = -11;	
		/** @const */
		var kPositionLength    = -12;

		/** @const */
		var kNewLine = "\n";


		/**
		 * CellEditor widget
		 * -----------------------------------------------------------------------------
		 * @constructor
		 * @param {Element} elem
		 * @param {Element} input
		 * @param {Array} fmgrGraphics
		 * @param {FontProperties} oFont
		 * @param {HandlersList} handlers
		 * @param {Object} settings
		 */
		function CellEditor(elem, input, fmgrGraphics, oFont, handlers, settings) {
			this.element = elem;
			this.input = input;
			this.handlers = new asc_HL(handlers);
			this.options = {};

			//---declaration---
			this.canvasOuter = undefined;
			this.canvasOuterStyle = undefined;
			this.canvas = undefined;
			this.canvasOverlay = undefined;
			this.cursor = undefined;
			this.cursorStyle = undefined;
			this.cursorTID = undefined;
			this.cursorPos = 0;
			this.topLineIndex = 0;
			this.m_oFont = oFont;
			this.fmgrGraphics = fmgrGraphics;
			this.drawingCtx = undefined;
			this.overlayCtx = undefined;
			this.textRender = undefined;
			this.textFlags = undefined;
			this.kx = 1;
			this.ky = 1;
			this.skipKeyPress = undefined;
			this.undoList = [];
			this.redoList = [];
			this.undoMode = false;
			this.undoAllMode = false;
			this.selectionBegin = -1;
			this.selectionEnd = -1;
			this.isSelectMode = false;
			this.hasCursor = false;
			this.hasFocus = false;
			this.newTextFormat = undefined;
			this.selectionTimer = undefined;
			this.enableKeyEvents = true;
			this.isTopLineActive = false;
			this.skipTLUpdate = true;
			this.isOpened = false;
			this.callTopLineMouseup = false;
			this.lastKeyCode = undefined;
			this.m_nEditorState	= c_oAscCellEditorState.editEnd; // Состояние редактора
			this.isUpdateValue = true;							// Обновлять ли состояние строки при вводе в TextArea

			// Функции, которые будем отключать
			this.fKeyDown		= null;
			this.fKeyPress		= null;
			this.fKeyUp			= null;
			this.fKeyMouseUp	= null;
			this.fKeyMouseMove	= null;
			//-----------------

			this.objAutoComplete = {};

			/** @type RegExp */
			this.reReplaceNL =  /\r?\n|\r/g;
			/** @type RegExp */
			this.reReplaceTab = /[\t\v\f]/g;
			// RegExp с поддержкой рэнджей вида $E1:$F2
			this.reRangeStr = "[^a-z0-9_$!:](\\$?[a-z]+\\$?\\d+:\\$?[a-z]+\\$?\\d+(?=[^a-z0-9_]|$)|\\$?[a-z]+:\\$?[a-z]+(?=[^a-z0-9_]|$)|\\$?\\d+:\\$?\\d+(?=[^a-z0-9_]|$)|\\$?[a-z]+\\$?\\d+(?=[^a-z0-9_]|$))";
			this.rangeChars = "= - + * / ( { , < > ^ ! & : ;".split(' ');
            this.reNotFormula  = new XRegExp( "[^\\p{L}0-9_]", "i" );
            this.reFormula = new XRegExp( "^([\\p{L}][\\p{L}0-9_]*)", "i" );

			this.defaults = {
				padding     : -1,
				selectColor : new CColor(190, 190, 255, 0.5),

				canvasZIndex  : 500,
				blinkInterval : 500,
				cursorShape   : "text",

				selectionTimeout: 20
			};

			this._init(settings);

			return this;
		}

		CellEditor.prototype._init = function (settings) {
			var t = this;
			var z = t.defaults.canvasZIndex;
			this.defaults.padding = settings.padding;

			if (null != this.element) {
				t.canvasOuter = document.createElement('div');
				t.canvasOuter.id = "ce-canvas-outer";
				t.canvasOuter.style.display = "none";
				t.canvasOuter.style.zIndex = z;
				var innerHTML = '<canvas id="ce-canvas" style="z-index: ' + (z+1) + '"></canvas>';
				innerHTML += '<canvas id="ce-canvas-overlay" style="z-index: ' + (z+2) + '; cursor: ' + t.defaults.cursorShape + '"></canvas>';
				innerHTML += '<div id="ce-cursor" style="display: none; z-index: ' + (z+3) + '"></div>';
				t.canvasOuter.innerHTML = innerHTML;
				this.element.appendChild(t.canvasOuter);

				t.canvasOuterStyle = t.canvasOuter.style;
				t.canvas = document.getElementById("ce-canvas");
				t.canvasOverlay = document.getElementById("ce-canvas-overlay");
				t.cursor = document.getElementById("ce-cursor");
				t.cursorStyle = t.cursor.style;
			}

			// create text render
			t.drawingCtx = new asc.DrawingContext({canvas: t.canvas, units: 1/*pt*/, fmgrGraphics: this.fmgrGraphics, font: this.m_oFont});
			t.overlayCtx = new asc.DrawingContext({canvas: t.canvasOverlay, units: 1/*pt*/, fmgrGraphics: this.fmgrGraphics, font: this.m_oFont});
			t.textRender = new asc.CellTextRender(t.drawingCtx);
			t.textRender.setDefaultFont(settings.font.clone());

			// bind event handlers
			if (t.canvasOverlay && t.canvasOverlay.addEventListener) {
				t.canvasOverlay.addEventListener("mousedown"	, function () {return t._onMouseDown.apply(t, arguments);}		, false);
				t.canvasOverlay.addEventListener("mouseup"		, function () {return t._onMouseUp.apply(t, arguments);}		, false);
				t.canvasOverlay.addEventListener("mousemove"	, function () {return t._onMouseMove.apply(t, arguments);}		, false);
				t.canvasOverlay.addEventListener("mouseleave"	, function () {return t._onMouseLeave.apply(t, arguments);}		, false);
				t.canvasOverlay.addEventListener("dblclick"		, function () {return t._onMouseDblClick.apply(t, arguments);}	, false);
			}

			// check input, it may have zero len, for mobile version
			if (t.input && t.input.addEventListener) {
				t.input.addEventListener("focus"	, function () {return t.isOpened ? t._topLineGotFocus.apply(t, arguments) : true;}	, false);
				t.input.addEventListener("mousedown", function () {return t.isOpened ? (t.callTopLineMouseup = true) : true;}			, false);
				t.input.addEventListener("mouseup"	, function () {return t.isOpened ? t._topLineMouseUp.apply(t, arguments) : true;}	, false);
				t.input.addEventListener("input"	, function () {return t._onInputTextArea.apply(t, arguments);}						, false);

				// Не поддерживаем drop на верхнюю строку
				t.input.addEventListener("drop"		, function (e) {e.preventDefault(); return false;}									, false);
			}

			this.fKeyDown		= function (event) {
				if (t.handlers.trigger("popUpSelectorKeyDown", event))
					return t._onWindowKeyDown(event);
				return false;
			};
			this.fKeyPress		= function () {return t._onWindowKeyPress.apply(t, arguments);};
			this.fKeyUp			= function () {return t._onWindowKeyUp.apply(t, arguments);};
			this.fKeyMouseUp	= function () {return t._onWindowMouseUp.apply(t, arguments);};
			this.fKeyMouseMove	= function () {return t._onWindowMouseMove.apply(t, arguments);};
		};

		CellEditor.prototype.destroy = function() {
		};

		/**
		 * @param {Object} options
		 *   cellX - cell x coord (pt)
		 *   cellY - cell y coord (pt)
		 *   leftSide   - array
		 *   rightSide  - array
		 *   bottomSide - array
		 *   fragments  - text fragments
		 *   flags      - text flags (wrapText, textAlign)
		 *   font
		 *   background
		 *   textColor
		 *   saveValueCallback
		 */
		CellEditor.prototype.open = function (options) {
			var b = this.input.selectionStart;
			
			this.isOpened = true;
			if (window.addEventListener) {
				window.addEventListener("keydown"	, this.fKeyDown		, false);
				window.addEventListener("keypress"	, this.fKeyPress	, false);
				window.addEventListener("keyup"		, this.fKeyUp		, false);
				window.addEventListener("mouseup"	, this.fKeyMouseUp	, false);
				window.addEventListener("mousemove"	, this.fKeyMouseMove, false);
			}
			this._setOptions(options);
			this.isTopLineActive = true === this.input.isFocused;

			this._updateFormulaEditMod(/*bIsOpen*/true);
			this._draw();

			if (!(options.cursorPos >= 0)) {
				if (this.isTopLineActive) {
					if (typeof b !== "undefined") {
						if (this.cursorPos !== b) {this._moveCursor(kPosition, b);}
					} else
						this._moveCursor(kEndOfText);
				} else if (options.isClearCell)
					this._selectChars(kEndOfText);
				else
					this._moveCursor(kEndOfText);
			}
			/*
			 * Выставляем фокус при открытии
			 * При нажатии символа, фокус не ставим
			 * При F2 выставляем фокус в редакторе
			 * При dbl клике фокус выставляем в зависимости от наличия текста в ячейке
			 */
			this.setFocus(this.isTopLineActive ? true : (undefined !== options.focus) ? options.focus : this._haveTextInEdit() ? true : false);
			this._updateUndoRedoChanged();
		};

		CellEditor.prototype.close = function (saveValue) {
			var opt = this.options, ret;

			if (saveValue && "function" === typeof opt.saveValueCallback) {
				ret = this._wrapFragments(opt.fragments); // восстанавливаем символы \n
				ret = opt.saveValueCallback(opt.fragments, this.textFlags, /*skip NL check*/ret);
				if (!ret) {
					// При ошибке нужно выставить флаг, чтобы по стрелкам не закрывался редактор
					this.handlers.trigger('setStrictClose', true);
					return false;
				}
			}

			this.isOpened = false;
			if (window.removeEventListener) {
				window.removeEventListener("keydown"	, this.fKeyDown		, false);
				window.removeEventListener("keypress"	, this.fKeyPress	, false);
				window.removeEventListener("keyup"		, this.fKeyUp		, false);
				window.removeEventListener("mouseup"	, this.fKeyMouseUp	, false);
				window.removeEventListener("mousemove"	, this.fKeyMouseMove, false);
			}
			//this.input.blur();
			this.isTopLineActive = false;
			this.input.isFocused = false;
			this._hideCursor();
			// hide
			this._hideCanvas();

			// delete autoComplete
			this.objAutoComplete = {};

			// Сброс состояния редактора
			this.m_nEditorState	= c_oAscCellEditorState.editEnd;
			this.handlers.trigger("closed");
			return true;
		};

		CellEditor.prototype.setTextStyle = function (prop, val) {
			var t = this, opt = t.options, begin, end, i, first, last;

			if (t.selectionBegin !== t.selectionEnd) {
				begin = Math.min(t.selectionBegin, t.selectionEnd);
				end = Math.max(t.selectionBegin, t.selectionEnd);

				// save info to undo/redo
				if (end - begin < 2) {
					t.undoList.push({fn: t._addChars, args: [t.textRender.getChars(begin, 1), begin]});
				} else {
					t.undoList.push({fn: t._addFragments, args: [t._getFragments(begin, end - begin), begin]});
				}

				t._extractFragments(begin, end - begin);

				first = t._findFragment(begin);
				last = t._findFragment(end - 1);

				if (first && last) {
					for (i = first.index; i <= last.index; ++i) {
						var valTmp = t._setFormatProperty(opt.fragments[i].format, prop, val);
						// Только для горячих клавиш
						if (null === val)
							val = valTmp;
					}
					// merge fragments with equal formats
					t._mergeFragments();
					t._update();

					// Обновляем выделение
					t._cleanSelection();
					t._drawSelection();

					// save info to undo/redo
					t.undoList.push({fn: t._removeChars, args: [begin, end - begin]});
					t.redoList = [];
				}

			} else {
				first = t._findFragmentToInsertInto(t.cursorPos);
				if (first) {
					if (!t.newTextFormat) {
						t.newTextFormat = opt.fragments[first.index].format.clone();
					}
					t._setFormatProperty(t.newTextFormat, prop, val);
				}

			}
		};

		CellEditor.prototype.empty = function(options) {
			// Чистка для редактирования только All
			if (c_oAscCleanOptions.All !== options)
				return;

			// Удаляем только selection
			this._removeChars();
		};

		CellEditor.prototype.undo = function () {
			this._performAction(this.undoList, this.redoList);
		};

		CellEditor.prototype.undoAll = function () {
			this.isUpdateValue = false;
			this.undoAllMode = true;
			while (this.undoList.length > 0) {
				this.undo();
			}
			this._update();
			this.undoAllMode = false;
		};

		CellEditor.prototype.redo = function () {
			this._performAction(this.redoList, this.undoList);
		};

		CellEditor.prototype.getZoom = function () {
			return this.drawingCtx.getZoom();
		};

		CellEditor.prototype.changeZoom = function (factor) {
			this.drawingCtx.changeZoom(factor);
			this.overlayCtx.changeZoom(factor);
		};

		CellEditor.prototype.canEnterCellRange = function () {
			var isRange = this._findRangeUnderCursor().range !== null;
			var prevChar = this.textRender.getChars(this.cursorPos-1, 1);
			return isRange || this.rangeChars.indexOf(prevChar) >= 0;
		};

		CellEditor.prototype.activateCellRange = function () {
			var res = this._findRangeUnderCursor();

			res.range ?
					this.handlers.trigger("existedRange", res.range) :
					this.handlers.trigger("newRange");
		};

		CellEditor.prototype.enterCellRange = function (rangeStr) {
			var res = this._findRangeUnderCursor();

			if (res.range) {
				this._moveCursor(kPosition, res.index);
				this._selectChars(kPosition, res.index + res.length);
			}

			var lastAction = this.undoList.length > 0 ? this.undoList[this.undoList.length - 1] : null;

			while (lastAction && lastAction.isRange) {
				this.undoList.pop();
				lastAction = this.undoList.length > 0 ? this.undoList[this.undoList.length - 1] : null;
			}

			var tmp = this.skipTLUpdate;
			this.skipTLUpdate = false;
			this._addChars(rangeStr, undefined, /*isRange*/true);
			this.skipTLUpdate = tmp;
		};

		CellEditor.prototype.changeCellRange = function (range) {
			var t = this;
			t._moveCursor(kPosition, range.cursorePos/* -length */);
			t._selectChars(kPositionLength, range.formulaRangeLength);
			t._addChars(range.getName(), undefined, /*isRange*/true);
			t._moveCursor(kEndOfText);
		};

		CellEditor.prototype.move = function (dx, dy, l, t, r, b) {
			var opt = this.options;

			this.left += dx;
			this.right += dx;
			this.top += dy;
			this.bottom += dy;

			opt.leftSide.forEach(function (e,i,a) {a[i] = e + dx;});
			opt.rightSide.forEach(function (e,i,a) {a[i] = e + dx;});
			opt.bottomSide.forEach(function (e,i,a) {a[i] = e + dy;});

			if (this.left < l || this.top < t || this.left > r || this.top > b) {
				// hide
				this._hideCanvas();
			} else {
				// ToDo выставлять опции (т.к. при scroll редактор должен пересчитываться и уменьшаться размеры)
				this._adjustCanvas();
				this._showCanvas();
				this._renderText();
				this._drawSelection();
			}
		};

		CellEditor.prototype.setFocus = function (hasFocus) {
			this.hasFocus = !!hasFocus;
			this.handlers.trigger("gotFocus", this.hasFocus);
		};

		CellEditor.prototype.restoreFocus = function () {
			if (this.isTopLineActive) {
				this.input.focus();
			}
		};

		CellEditor.prototype.copySelection = function () {
			var t = this;
			var res = null;
			if(t.selectionBegin !== t.selectionEnd)
			{
				var start = t.selectionBegin;
				var end = t.selectionEnd;
				if(start > end)
				{
					var temp = start;
					start = end;
					end = temp;
				}
				res = t._getFragments(start, end - start);
			}
			return res;
		};

		CellEditor.prototype.cutSelection = function () {
			var t = this;
			var f = null;
			if (t.selectionBegin !== t.selectionEnd) {
				var start = t.selectionBegin;
				var end = t.selectionEnd;
				if(start > end)
				{
					var temp = start;
					start = end;
					end = temp;
				}
				f = t._getFragments(start, end - start);
				t._removeChars();
			}
			return f;
		};

		CellEditor.prototype.pasteText = function (text) {
			text = text.replace(/\t/g," ");
			text = text.replace(/\r/g, "");
			text = text.replace(/^\n+|\n+$/g, "");

			var length = text.length;
			if (!(length > 0)) {return;}
			if (!this._checkMaxCellLength(length)) {return;}

			var wrap = text.indexOf("\n") >= 0;
			if (this.selectionBegin !== this.selectionEnd)
				this._removeChars();
			else
				this.undoList.push({fn: "fake", args: []});//фейковый undo(потому что у нас делает undo по 2 действия)

			// save info to undo/redo
			this.undoList.push({fn: this._removeChars, args: [this.cursorPos, length]});
			this.redoList = [];

			var opt = this.options;
			var nInsertPos = this.cursorPos;
			var fr;
			fr = this._findFragmentToInsertInto(nInsertPos - (nInsertPos > 0 ? 1 : 0));
			if (fr) {
				var oCurFragment = opt.fragments[fr.index];
				if(fr.end <= nInsertPos)
					oCurFragment.text += text;
				else {
					var sNewText = oCurFragment.text.substring(0, nInsertPos);
					sNewText += text;
					sNewText += oCurFragment.text.substring(nInsertPos);
					oCurFragment.text = sNewText;
				}
				this.cursorPos = nInsertPos + length;
				this._update();
			}

			if (wrap) {
				this._wrapText();
				this._update();
			}
		};

		CellEditor.prototype.paste = function (fragments, cursorPos) {
			if (!(fragments.length > 0)) {return;}
			var length = this._getFragmentsLength(fragments);
			if (!this._checkMaxCellLength(length)) {return;}

			var wrap = fragments.some(function(val){return val.text.indexOf("\n")>=0;});

			this._cleanFragments(fragments);

			if (this.selectionBegin !== this.selectionEnd) {this._removeChars();}

			// save info to undo/redo
			this.undoList.push({fn: this._removeChars, args: [this.cursorPos, length]});
			this.redoList = [];

			this._addFragments(fragments, this.cursorPos);

			if (wrap) {
				this._wrapText();
				this._update();
			}

			// Сделано только для вставки формулы в ячейку (когда не открыт редактор)
			if (undefined !== cursorPos)
				this._moveCursor(kPosition, cursorPos);
		};

		/** @param flag {Boolean} */
		CellEditor.prototype.enableKeyEventsHandler = function (flag) {
			var oldValue = this.enableKeyEvents;
			this.enableKeyEvents = !!flag;
			if (this.isOpened && oldValue !== this.enableKeyEvents) {
				this.enableKeyEvents ? this.showCursor() : this._hideCursor();
			}
		};

		CellEditor.prototype.isFormula = function() {
			var fragments = this.options.fragments;
			return fragments.length > 0 && fragments[0].text.length > 0 && fragments[0].text.charAt(0) === "=";
		};

		CellEditor.prototype.insertFormula = function (functionName,isDefName) {
			// Проверим форула ли это
			if (false === this.isFormula()) {
				// Может это просто текста нет
				var fragments = this.options.fragments;
				if (1 === fragments.length && 0 === fragments[0].text.length) {
					// Это просто нет текста, добавим форумулу
					functionName = "=" + functionName + "()";
				}
				else {
					// Не смогли добавить...
					return false;
				}
			}
			else {
                if( !isDefName )
                    // Это уже форула, добавляем без '='
                    functionName = functionName + "()";
			}

			this.skipTLUpdate = false;
			// Вставим форумулу в текущую позицию
			this._addChars(functionName);
			// Меняем позицию курсора внутрь скобок
            if( !isDefName )
			    this._moveCursor(kPosition, this.cursorPos - 1);
		};

		CellEditor.prototype.replaceText = function (pos, len, newText) {
			this._moveCursor(kPosition, pos);
			this._selectChars(kPosition, pos + len);
			this._addChars(newText);
		};

		CellEditor.prototype.setFontRenderingMode = function () {
			if (this.isOpened)
				this._draw();
		};

		// Private

		CellEditor.prototype._setOptions = function (options) {
			var opt = this.options = options;
			var ctx = this.drawingCtx;
			var u = ctx.getUnits();

			this.textFlags = opt.flags;
			if (this.textFlags.textAlign.toLowerCase() === "justify" || this.isFormula()) {
				this.textFlags.textAlign = "left";
			}
			if (this.textFlags.wrapText) {
				this.textFlags.wrapOnlyNL = true;
				this.textFlags.wrapText = false;
			}

			this._cleanFragments(opt.fragments);
			this.textRender.setString(opt.fragments, this.textFlags);
			delete this.newTextFormat;

			if (opt.zoom > 0) {
				this.overlayCtx.setFont(this.drawingCtx.getFont());
				this.changeZoom(opt.zoom);
			}

			this.kx = asc_getcvt(u, 0/*px*/, ctx.getPPIX());
			this.ky = asc_getcvt(u, 0/*px*/, ctx.getPPIY());

			opt.leftSide.sort(fSortDescending);
			opt.rightSide.sort(fSortAscending);
			opt.bottomSide.sort(fSortAscending);

			this.left = opt.cellX;
			this.top = opt.cellY;
			this.right = opt.rightSide[0];
			this.bottom = opt.bottomSide[0];

			this.cursorPos = opt.cursorPos !== undefined ? opt.cursorPos : 0;
			this.topLineIndex = 0;
			this.selectionBegin = -1;
			this.selectionEnd = -1;
			this.isSelectMode = false;
			this.hasCursor = false;

			this.undoList = [];
			this.redoList = [];
			this.undoMode = false;
			this.skipKeyPress = false;
		};

		CellEditor.prototype._parseRangeStr = function (s) {
			var range = asc.g_oRangeCache.getActiveRange(s);
			return range ? range.clone() : null;
		};

		CellEditor.prototype._parseFormulaRanges = function () {
			var s = this._getFragmentsText(this.options.fragments);

			// в Chrome 23 есть баг в RegExp с флагом "g" - не обнуляется lastIndex
			// поэтому используем такую хитрую конструкцию re[reIdx]
			var reIdx = 0;
			var re = [new RegExp(this.reRangeStr, "gi")];

			var ret = false;
			var m, range, i;

			if (s.length < 1 || s.charAt(0) !== "=") {
				return ret;
			}

			var fromIndex = 0;
			while (null !== (m = re[reIdx].exec(s))) {
				range = this._parseRangeStr(m[1]);
				if (range) {
					ret = true;
					range.cursorePos = m.input.indexOf(m[0], fromIndex)+1;
					range.formulaRangeLength = m[1].length;
					fromIndex = range.cursorePos + range.formulaRangeLength;
					this.handlers.trigger("newRange", range);
				} else {
					i = m[1].indexOf(":");
					if (i >= 0) {
						s = "(" + s.slice(m.index + 1 + i + 1);
						reIdx = re.length;
						re.push(new RegExp(this.reRangeStr, "gi"));
					}
				}
			}
			return ret;
		};

		CellEditor.prototype._findRangeUnderCursor = function () {
			var t = this;
			var s = t.textRender.getChars(0, t.textRender.getCharsCount());
			var re = new RegExp("^" + this.reRangeStr, "i");
			var reW = /[^a-z0-9_$]/i;
			var beg = t.cursorPos - 1;
			var colon = -1;
			var ch, res, range;

			for (; beg >= 0; --beg) {
				ch = s.charAt(beg);
				if (!reW.test(ch)) {
					continue;
				}
				res = s.slice(beg).match(re);
				if (ch === ":" && colon < 0) {
					if (!res || res[1].indexOf(":") < 0) {
						colon = beg;
						continue;
					}
				}
				if (res && t.cursorPos > beg + res.index && t.cursorPos <= beg + res.index + res[0].length) {
					range = t._parseRangeStr(res[1]);
					if (!range) {
						beg = colon;
						res = s.slice(beg).match(re);
						if (res && t.cursorPos > beg + res.index && t.cursorPos <= beg + res.index + res[0].length) {
							range = t._parseRangeStr(res[1]);
						}
					}
				}
				break;
			}
			return !range ?
					{index: -1, length: 0, range: null} :
					{index: beg + res.index + 1, length: res[1].length, range: range};
		};

		CellEditor.prototype._updateFormulaEditMod = function (bIsOpen) {
			var isFormula = this.isFormula();
			if (!bIsOpen)
				this._updateEditorState(isFormula);
			this.handlers.trigger("updateFormulaEditMod", isFormula);
			var ret1 = this._parseFormulaRanges();
			var ret2 = this.canEnterCellRange();
			this.handlers.trigger("updateFormulaEditModEnd", ret1 || ret2);
		};

		// Обновляем состояние Undo/Redo
		CellEditor.prototype._updateUndoRedoChanged = function () {
			this.handlers.trigger("updateUndoRedoChanged", 0 < this.undoList.length, 0 < this.redoList.length);
		};

		CellEditor.prototype._haveTextInEdit = function () {
			var fragments = this.options.fragments;
			return fragments.length > 0 && fragments[0].text.length > 0;
		};

		CellEditor.prototype._updateEditorState = function (isFormula) {
			if (undefined === isFormula)
				isFormula = this.isFormula();
			var editorState = isFormula ? c_oAscCellEditorState.editFormula :
				"" === this._getFragmentsText(this.options.fragments) ? c_oAscCellEditorState.editEmptyCell :
					c_oAscCellEditorState.editText;

			if (this.m_nEditorState !== editorState) {
				this.m_nEditorState = editorState;
				this.handlers.trigger("updateEditorState", this.m_nEditorState);
			}
		};

		CellEditor.prototype._getRenderFragments = function () {
			var opt = this.options, fragments = opt.fragments, i, j, first, last, val, lengthColors,
				tmpColors, colorIndex, uniqueColorIndex;
			if (this.isFormula()) {
				var arrRanges = this.handlers.trigger("getFormulaRanges");
				if (0 < arrRanges.length) {
					fragments = [];
					for (i = 0; i < opt.fragments.length; ++i)
						fragments.push(opt.fragments[i].clone());

					lengthColors = c_oAscFormulaRangeBorderColor.length;
					tmpColors = [];
					uniqueColorIndex = 0;
					for (i = 0; i < arrRanges.length; ++i) {
						val = arrRanges[i];

						colorIndex = asc.getUniqueRangeColor(arrRanges, i, tmpColors);
						if (null == colorIndex)
							colorIndex = uniqueColorIndex++;
						tmpColors.push(colorIndex);

						this._extractFragments(val.cursorePos, val.formulaRangeLength, fragments);

						first = this._findFragment(val.cursorePos, fragments);
						last = this._findFragment(val.cursorePos + val.formulaRangeLength - 1, fragments);
						if (first && last) {
							for (j = first.index; j <= last.index; ++j)
								fragments[j].format.c = c_oAscFormulaRangeBorderColor[colorIndex % lengthColors];
						}
					}
				}
			}

			return fragments;
		};

		// Rendering

		CellEditor.prototype._draw = function () {

			var canExpW = true, canExpH = true, tm, expW, expH, fragments = this._getRenderFragments();

			if (0 < fragments.length) {
				tm = this.textRender.measureString(fragments, this.textFlags, this._getContentWidth());
				expW = tm.width > this._getContentWidth();
				expH  = tm.height > this._getContentHeight();

				while (expW && canExpW || expH && canExpH) {
					if (expW) { canExpW = this._expandWidth(); }
					if (expH) { canExpH = this._expandHeight(); }

					if (!canExpW) {
						this.textFlags.wrapText = true;
						tm = this.textRender.measureString(fragments, this.textFlags, this._getContentWidth());
					} else {
						tm = this.textRender.measure(this._getContentWidth());
					}
					expW = tm.width > this._getContentWidth();
					expH  = tm.height > this._getContentHeight();
				}
			}

			//this._cleanText();
			//this._cleanSelection();
			//this._adjustCanvas();
			//this._showCanvas();
			this._renderText();
			this.input.value = this._getFragmentsText(fragments);
			this._updateCursorPosition();
			this._showCursor();
		};

		CellEditor.prototype._update = function () {
			this._updateFormulaEditMod(/*bIsOpen*/false);

			var tm, canExpW, canExpH, oldLC, doAjust = false, fragments = this._getRenderFragments();

			if (0 < fragments.length) {
				oldLC = this.textRender.getLinesCount();
				tm = this.textRender.measureString(fragments, this.textFlags, this._getContentWidth());
				if (this.textRender.getLinesCount() < oldLC) {
					this.topLineIndex -= oldLC - this.textRender.getLinesCount();
				}

				canExpW = !this.textFlags.wrapText;
				while (tm.width > this._getContentWidth() && canExpW) {
					canExpW = this._expandWidth();
					if (!canExpW) {
						this.textFlags.wrapText = true;
						tm = this.textRender.measureString(fragments, this.textFlags, this._getContentWidth());
					}
					doAjust = true;
				}

				canExpH = true;
				while (tm.height > this._getContentHeight() && canExpH) {
					canExpH = this._expandHeight();
					doAjust = true;
				}
				if (this.textRender.isLastCharNL() && !doAjust && canExpH) {
					var lm = this.textRender.calcCharHeight(this.textRender.getCharsCount() - 1);
					if (tm.height + lm.th > this._getContentHeight()) {
						this._expandHeight();
						doAjust = true;
					}
				}
			}
			if (doAjust) {this._adjustCanvas();}
			//this._renderText();  // вызов нужен для пересчета поля line.startX, которое используется в _updateCursorPosition
			//this._fireUpdated(); // вызов нужен для обновление текста верхней строки, перед обновлением позиции курсора
			//this._updateCursorPosition(true);
			//this._showCursor();

			this._updateUndoRedoChanged();
		};

		CellEditor.prototype._fireUpdated = function () {
			var t = this;
			var s = t._getFragmentsText(t.options.fragments);
			var isFormula = s.charAt(0) === "=";
			var funcPos, funcName, match;

			if (!t.isTopLineActive || !t.skipTLUpdate || t.undoMode)
				t.input.value = s;

			if (isFormula) {
				funcPos = asc_lastidx(s, t.reNotFormula, t.cursorPos) + 1;
				if (funcPos > 0) {
					match = s.slice(funcPos).match( t.reFormula );
				}
				if (match) {
					funcName = match[1];
				} else {
					funcPos = undefined;
					funcName = undefined;
				}
			}

			if (!t.undoAllMode)
				t.handlers.trigger("updated", s, t.cursorPos, isFormula, funcPos, funcName);
		};

		CellEditor.prototype._expandWidth = function () {
			var t = this, opt = t.options, l = false, r = false;

			function expandLeftSide() {
				var i = asc_search(opt.leftSide, function (v) {return v < t.left;});
				if (i >= 0) {
					t.left = opt.leftSide[i];
					return true;
				}
				var val = opt.leftSide[opt.leftSide.length - 1];
				if (Math.abs(t.left - val) > 0.000001) { // left !== leftSide[len-1]
					t.left = val;
				}
				return false;
			}

			function expandRightSide() {
				var i = asc_search(opt.rightSide, function (v) {return v > t.right;});
				if (i >= 0) {
					t.right = opt.rightSide[i];
					return true;
				}
				var val = opt.rightSide[opt.rightSide.length - 1];
				if (Math.abs(t.right - val) > 0.000001) { // right !== rightSide[len-1]
					t.right = val;
				}
				return false;
			}

			switch (t.textFlags.textAlign) {
				case kRightAlign:r = expandLeftSide();break;
				case kCenterAlign:l = expandLeftSide();r = expandRightSide();break;
				case kLeftAlign:
				default:r = expandRightSide();
			}
			return l || r;
		};

		CellEditor.prototype._expandHeight = function () {
			var t = this, opt = t.options, i = asc_search(opt.bottomSide, function (v) {return v > t.bottom;});
			if (i >= 0) {
				t.bottom = opt.bottomSide[i];
				return true;
			}
			var val = opt.bottomSide[opt.bottomSide.length - 1];
			if (Math.abs(t.bottom - val) > 0.000001) { // bottom !== bottomSide[len-1]
				t.bottom = val;
			}
			return false;
		};

		CellEditor.prototype._cleanText = function () {
			this.drawingCtx.clear();
		};

		CellEditor.prototype._showCanvas = function () {
			this.canvasOuterStyle.display = 'block';
		};
		CellEditor.prototype._hideCanvas = function () {
			this.canvasOuterStyle.display = 'none';
		};

		CellEditor.prototype._adjustCanvas = function () {
			var z = this.defaults.canvasZIndex;
			var left = this.left * this.kx;
			var top = this.top * this.ky;
			var widthStyle = (this.right - this.left) * this.kx - 1; // ToDo разобраться с '-1'
			var heightStyle = (this.bottom - this.top) * this.ky - 1;
			var isRetina = AscBrowser.isRetina;
			var width = widthStyle, height = heightStyle;

			if (isRetina) {
				left >>= 1;
				top >>= 1;

				widthStyle >>= 1;
				heightStyle >>= 1;
			}

			this.canvasOuterStyle.left = left + 'px';
			this.canvasOuterStyle.top = top + 'px';
			this.canvasOuterStyle.width = widthStyle + 'px';
			this.canvasOuterStyle.height = heightStyle + 'px';
			this.canvasOuterStyle.zIndex = this.top <= 0 ? -1 : z;

			this.canvas.width = this.canvasOverlay.width = width;
			this.canvas.height = this.canvasOverlay.height = height;
			if (isRetina) {
				this.canvas.style.width = this.canvasOverlay.style.width = widthStyle + 'px';
				this.canvas.style.height = this.canvasOverlay.style.height = heightStyle + 'px';
			}
		};

		CellEditor.prototype._renderText = function (dy) {
			var t = this, opt = t.options, ctx = t.drawingCtx;

			ctx.setFillStyle(opt.background)
			   .fillRect(0, 0, ctx.getWidth(), ctx.getHeight());

			if (opt.fragments.length > 0) {
				t.textRender.render(t._getContentLeft(), (dy === undefined ? 0 : dy), t._getContentWidth(), opt.textColor);
			}
		};

		CellEditor.prototype._cleanSelection = function () {
			this.overlayCtx.clear();
		};

		CellEditor.prototype._drawSelection = function () {
			var ctx = this.overlayCtx, ppix = ctx.getPPIX(), ppiy = ctx.getPPIY();
			var begPos, endPos, top, top1, top2, begInfo, endInfo, line1, line2, i;

			function drawRect(x, y, w, h) {
				ctx.fillRect(
					asc_calcnpt(x, ppix), asc_calcnpt(y, ppiy),
					asc_calcnpt(w, ppix), asc_calcnpt(h, ppiy));
			}

			begPos = this.selectionBegin;
			endPos = this.selectionEnd;

			ctx.setFillStyle(this.defaults.selectColor).clear();

			if (begPos !== endPos && !this.isTopLineActive) {
				top = this.textRender.calcLineOffset(this.topLineIndex);
				begInfo = this.textRender.calcCharOffset(Math.min(begPos, endPos));
				line1 = this.textRender.getLineInfo(begInfo.lineIndex);
				top1 = this.textRender.calcLineOffset(begInfo.lineIndex);
				endInfo = this.textRender.calcCharOffset(Math.max(begPos, endPos));
				if (begInfo.lineIndex === endInfo.lineIndex) {
					drawRect(begInfo.left, top1 - top, endInfo.left - begInfo.left, line1.th);
				} else {
					line2 = this.textRender.getLineInfo(endInfo.lineIndex);
					top2 = this.textRender.calcLineOffset(endInfo.lineIndex);
					drawRect(begInfo.left, top1 - top, line1.tw - begInfo.left + line1.startX, line1.th);
					if (line2) {drawRect(line2.startX, top2 - top, endInfo.left - line2.startX, line2.th);}
					top = top1 - top + line1.th;
					for (i = begInfo.lineIndex + 1; i < endInfo.lineIndex; ++i, top += line1.th) {
						line1 = this.textRender.getLineInfo(i);
						drawRect(line1.startX, top, line1.tw, line1.th);
					}
				}
			}
		};

		// Cursor

		CellEditor.prototype.showCursor = function () {
			if (!this.options) {this.options = {};}
			this.options.isHideCursor = false;
			this._showCursor();
		};

		CellEditor.prototype._showCursor = function () {
			var t = this;
			if (true === t.options.isHideCursor || t.isTopLineActive === true) {return;}
			window.clearInterval(t.cursorTID);
			t.cursorStyle.display = "block";
			t.cursorTID = window.setInterval(function () {
				t.cursorStyle.display = ("none" === t.cursorStyle.display) ? "block" : "none";
			}, t.defaults.blinkInterval);
		};

		CellEditor.prototype._hideCursor = function () {
			var t = this;
			window.clearInterval(t.cursorTID);
			t.cursorStyle.display = "none";
		};

		CellEditor.prototype._updateCursorPosition = function (redrawText) {
			// ToDo стоит переправить данную функцию
			var h = this.canvas.height;
			var y = - this.textRender.calcLineOffset(this.topLineIndex);
			var cur = this.textRender.calcCharOffset(this.cursorPos);
			var charsCount = this.textRender.getCharsCount();
			var curLeft = asc_round(((kRightAlign !== this.textFlags.textAlign || this.cursorPos !== charsCount) &&
				cur !== null && cur.left !== null ? cur.left : this._getContentPosition()) * this.kx);
			var curTop  = asc_round(((cur !== null ? cur.top : 0) + y) * this.ky);
			var curHeight = asc_round((cur !== null ? cur.height : this._getContentHeight()) * this.ky);
			var i, dy;

			while (this.textRender.getLinesCount() > 1) {
				if (curTop + curHeight - 1 > h) {
					i = i === undefined ? 0 : i + 1;
					dy = this.textRender.getLineInfo(i).th;
					y -= dy;
					curTop -= asc_round(dy * this.ky);
					++this.topLineIndex;
					continue;
				}
				if (curTop < 0) {
					--this.topLineIndex;
					dy = this.textRender.getLineInfo(this.topLineIndex).th;
					y += dy;
					curTop += asc_round(dy * this.ky);
					continue;
				}
				break;
			}

			if (dy !== undefined || redrawText) {this._renderText(y);}

			if (AscBrowser.isRetina) {
				curLeft >>= 1;
				curTop >>= 1;
			}

            this.curLeft = curLeft;
            this.curTop = curTop;
            this.curHeight = curHeight;

			this.cursorStyle.left = curLeft + "px";
			this.cursorStyle.top = curTop + "px";
			this.cursorStyle.height = curHeight + "px";

			if (cur) {this.input.scrollTop = this.input.clientHeight * cur.lineIndex;}
			if (this.isTopLineActive && !this.skipTLUpdate) {this._updateTopLineCurPos();}
			this._updateSelectionInfo();
		};

		CellEditor.prototype._moveCursor = function (kind, pos) {
			var t = this;
			switch (kind) {
				case kPrevChar: t.cursorPos = t.textRender.getPrevChar(t.cursorPos); break;
				case kNextChar: t.cursorPos = t.textRender.getNextChar(t.cursorPos); break;
				case kPrevWord: t.cursorPos = t.textRender.getPrevWord(t.cursorPos); break;
				case kNextWord: t.cursorPos = t.textRender.getNextWord(t.cursorPos); break;
				case kBeginOfLine: t.cursorPos = t.textRender.getBeginOfLine(t.cursorPos); break;
				case kEndOfLine: t.cursorPos = t.textRender.getEndOfLine(t.cursorPos); break;
				case kBeginOfText: t.cursorPos = t.textRender.getBeginOfText(t.cursorPos); break;
				case kEndOfText: t.cursorPos = t.textRender.getEndOfText(t.cursorPos); break;
				case kPrevLine: t.cursorPos = t.textRender.getPrevLine(t.cursorPos); break;
				case kNextLine: t.cursorPos = t.textRender.getNextLine(t.cursorPos); break;
				case kPosition: t.cursorPos = pos; break;
				case kPositionLength: t.cursorPos += pos; break;
				default: return;
			}
			if (t.selectionBegin !== t.selectionEnd) {
				t.selectionBegin = t.selectionEnd = -1;
				t._cleanSelection();
			}
			t._updateCursorPosition();
			t._showCursor();
		};

		CellEditor.prototype._findCursorPosition = function (coord) {
			var t = this;
			var lc = t.textRender.getLinesCount();
			var i, h, w, li, chw;
			for (h = 0, i = Math.max(t.topLineIndex, 0); i < lc; ++i) {
				li = t.textRender.getLineInfo(i);
				h += li.th;
				if (coord.y <= h) {
					for (w = li.startX, i = li.beg; i <= li.end; ++i) {
						chw = t.textRender.getCharWidth(i);
						if (coord.x <= w + chw) {
							return coord.x <= w + chw / 2 ? i : i + 1 > li.end ? kEndOfLine : i + 1;
						}
						w += chw;
					}
					return i < t.textRender.getCharsCount() ? i-1 : kEndOfText;
				}
			}
			return kNextLine;
		};

		CellEditor.prototype._updateTopLineCurPos = function () {
			var t = this;
			var isSelected = t.selectionBegin !== t.selectionEnd;
			var b = isSelected ? t.selectionBegin : t.cursorPos;
			var e = isSelected ? t.selectionEnd : t.cursorPos;
			if (t.input.setSelectionRange) {t.input.setSelectionRange(Math.min(b, e), Math.max(b, e));}
		};

		CellEditor.prototype._topLineGotFocus = function () {
			var t = this;
			t.isTopLineActive = true;
			t.input.isFocused = true;
			t.setFocus(true);
			t._hideCursor();
			t._updateTopLineCurPos();
			t._cleanSelection();
		};

		CellEditor.prototype._topLineMouseUp = function () {
			var t = this;
			this.callTopLineMouseup = false;
			// при такой комбинации ctrl+a, click, ctrl+a, click не обновляется selectionStart
			// поэтому выполняем обработку после обработчика системы
			setTimeout(function () {
				var b = t.input.selectionStart;
				var e = t.input.selectionEnd;
				if (typeof b !== "undefined") {
					if (t.cursorPos !== b) {t._moveCursor(kPosition, b);}
					if (b !== e) {t._selectChars(kPosition, e);}
				}
			});
		};

		CellEditor.prototype._syncEditors = function () {
			var t = this;
			var s1 = t._getFragmentsText(t.options.fragments);
			var s2 = t.input.value;
			var l = Math.min(s1.length, s2.length);
			var i1 = 0, i2 = 0;

			while (i1 < l && s1.charAt(i1) === s2.charAt(i1)) {++i1;}
			i2 = i1 + 1;
			if (i2 >= l) {i2 = Math.max(s1.length, s2.length);}
			else while (i2 < l && s1.charAt(i1) !== s2.charAt(i2)) {++i2;}

			t._addChars(s2.slice(i1, i2), i1);
		};

		// Content

		CellEditor.prototype._getContentLeft = function () {
			return asc_calcnpt(0, this.drawingCtx.getPPIX(), this.defaults.padding/*px*/);
		};

		CellEditor.prototype._getContentWidth = function () {
			return this.right - this.left - asc_calcnpt(0, this.drawingCtx.getPPIX(),
					this.defaults.padding + this.defaults.padding + 1/*px*/);
		};

		CellEditor.prototype._getContentHeight = function () {
			var t = this;
			return t.bottom - t.top;
		};

		CellEditor.prototype._getContentPosition = function () {
			var ppix = this.drawingCtx.getPPIX();

			switch (this.textFlags.textAlign) {
				case kRightAlign:
					return asc_calcnpt(this.right - this.left, ppix, -this.defaults.padding - 1);
				case kCenterAlign:
					return asc_calcnpt(0.5 * (this.right - this.left), ppix, 0);
			}
			return asc_calcnpt(0, ppix, this.defaults.padding);
		};

		CellEditor.prototype._wrapFragments = function (frag) {
			var i, s, ret = false;
			for (i = 0; i < frag.length; ++i) {
				s = frag[i].text;
				if (s.indexOf("\u00B6") >= 0) {
					s = s.replace(/\u00B6/g, "\n");
					ret = true;
				}
				frag[i].text = s;
			}
			return ret;
		};

		CellEditor.prototype._wrapText = function () {
			var t = this;
			t.textFlags.wrapOnlyNL = true;
			t._wrapFragments(t.options.fragments);
		};

		CellEditor.prototype._addChars = function (str, pos, isRange) {
			var opt = this.options, f, l, s, length = str.length;

			if (!this._checkMaxCellLength(length)) {return false;}

			if (this.selectionBegin !== this.selectionEnd) {this._removeChars(undefined, undefined, isRange);}

			if (pos === undefined) {pos = this.cursorPos;}

			if (!this.undoMode) {
				// save info to undo/redo
				this.undoList.push({fn: this._removeChars, args: [pos, length], isRange: isRange});
				this.redoList = [];
			}

			if (this.newTextFormat) {
				var oNewObj = new Fragment({format: this.newTextFormat, text: str});
				this._addFragments([oNewObj], pos);
				delete this.newTextFormat;
			} else {
				f = this._findFragmentToInsertInto(pos);
				if (f) {
					l = pos - f.begin;
					s = opt.fragments[f.index].text;
					opt.fragments[f.index].text = s.slice(0, l) + str + s.slice(l);
				}
			}

			this.cursorPos = pos + str.length;
			if (!this.undoAllMode)
				this._update();
		};

		CellEditor.prototype._addNewLine = function () {
			this._wrapText();
			this._addChars(kNewLine);
		};

		CellEditor.prototype._removeChars = function (pos, length, isRange) {
			var t = this, opt = t.options, b, e, l, first, last;

			if (t.selectionBegin !== t.selectionEnd) {
				b = Math.min(t.selectionBegin, t.selectionEnd);
				e = Math.max(t.selectionBegin, t.selectionEnd);
				t.selectionBegin = t.selectionEnd = -1;
				t._cleanSelection();
			} else if (length === undefined) {
				switch (pos) {
					case kPrevChar: b = t.textRender.getPrevChar(t.cursorPos); e = t.cursorPos; break;
					case kNextChar: b = t.cursorPos; e = t.textRender.getNextChar(t.cursorPos); break;
					case kPrevWord: b = t.textRender.getPrevWord(t.cursorPos); e = t.cursorPos; break;
					case kNextWord: b = t.cursorPos; e = t.textRender.getNextWord(t.cursorPos); break;
					default: return;
				}
			} else {
				b = pos;
				e = pos + length;
			}

			if (b === e) {return;}

			// search for begin and end positions
			first = t._findFragment(b);
			last = t._findFragment(e - 1);

			if (!t.undoMode) {
				// save info to undo/redo
				if (e - b < 2 && opt.fragments[first.index].text.length > 1) {
					t.undoList.push({fn: t._addChars, args: [t.textRender.getChars(b, 1), b], isRange: isRange});
				} else {
					t.undoList.push({fn: t._addFragments, args: [t._getFragments(b, e - b), b], isRange: isRange});
				}
				t.redoList = [];
			}

			if (first && last) {
				// remove chars
				if (first.index === last.index) {
					l = opt.fragments[first.index].text;
					opt.fragments[first.index].text = l.slice(0, b - first.begin) + l.slice(e - first.begin);
				} else {
					opt.fragments[first.index].text = opt.fragments[first.index].text.slice(0, b - first.begin);
					opt.fragments[last.index].text = opt.fragments[last.index].text.slice(e - last.begin);
					l = last.index - first.index;
					if (l > 1) {
						opt.fragments.splice(first.index + 1, l - 1);
					}
				}
				// merge fragments with equal formats
				t._mergeFragments();
			}

			t.cursorPos = b;
			if (!t.undoAllMode) {
				t._update();
			}
		};

		CellEditor.prototype._selectChars = function (kind, pos) {
			var t = this;
			var begPos, endPos;

			begPos = t.selectionBegin === t.selectionEnd ? t.cursorPos : t.selectionBegin;
			t._moveCursor(kind, pos);
			endPos = t.cursorPos;

			t.selectionBegin = begPos;
			t.selectionEnd = endPos;
			t._drawSelection();
			if (t.isTopLineActive && !t.skipTLUpdate) {t._updateTopLineCurPos();}
		};

		CellEditor.prototype._changeSelection = function (coord) {
			var t = this;

			function doChangeSelection(coord) {
				var pos = t._findCursorPosition(coord);
				if (pos !== undefined) {pos >= 0 ? t._selectChars(kPosition, pos) : t._selectChars(pos);}
				if (t.isSelectMode) {
					t.selectionTimer = window.setTimeout(
							function () {doChangeSelection(coord);},
							t.defaults.selectionTimeout);
				}
			}

            doChangeSelection(coord);

			//window.clearTimeout(t.selectionTimer);
			//t.selectionTimer = window.setTimeout(function () {doChangeSelection(coord);}, 0);
		};

		CellEditor.prototype._findFragment = function (pos, fragments) {
			var i, begin, end;
			if (!fragments)
				fragments = this.options.fragments;

			for (i = 0, begin = 0; i < fragments.length; ++i) {
				end = begin + fragments[i].text.length;
				if (pos >= begin && pos < end) {
					return {index: i, begin: begin, end: end};
				}
				if (i < fragments.length - 1) {
					begin = end;
				}
			}
			return pos === end ? {index: i-1, begin: begin, end: end} : undefined;
		};

		CellEditor.prototype._findFragmentToInsertInto = function (pos) {
			var opt = this.options, i, begin, end;

			for (i = 0, begin = 0; i < opt.fragments.length; ++i) {
				end = begin + opt.fragments[i].text.length;
				if (pos >= begin && pos <= end) {
					return {index: i, begin: begin, end: end};
				}
				if (i < opt.fragments.length - 1) {
					begin = end;
				}
			}
			return undefined;
		};

		CellEditor.prototype._isWholeFragment = function (pos, len) {
			var fr = this._findFragment(pos);
			return fr && pos === fr.begin && len === fr.end - fr.begin;
		};

		CellEditor.prototype._splitFragment = function (f, pos, fragments) {
			var fr;
			if (!fragments)
				fragments = this.options.fragments;

			if (pos > f.begin && pos < f.end) {
				fr = fragments[f.index];
				Array.prototype.splice.apply(
					fragments,
					[f.index, 1].concat([
						new Fragment({format: fr.format.clone(), text: fr.text.slice(0, pos - f.begin)}),
						new Fragment({format: fr.format.clone(), text: fr.text.slice(pos - f.begin)})]));
			}
		};

		CellEditor.prototype._getFragments = function (startPos, length) {
			var t = this, opt = t.options, endPos = startPos + length - 1, res = [], fr, i;
			var first = t._findFragment(startPos);
			var last = t._findFragment(endPos);

			if (!first || !last) {throw "Can not extract fragment of text";}

			if (first.index === last.index) {
				fr = opt.fragments[first.index].clone();
				fr.text = fr.text.slice(startPos - first.begin, endPos - first.begin + 1);
				res.push(fr);
			} else {
				fr = opt.fragments[first.index].clone();
				fr.text = fr.text.slice(startPos - first.begin);
				res.push(fr);
				for (i = first.index + 1; i < last.index; ++i) {
					fr = opt.fragments[i].clone();
					res.push(fr);
				}
				fr = opt.fragments[last.index].clone();
				fr.text = fr.text.slice(0, endPos - last.begin + 1);
				res.push(fr);
			}

			return res;
		};

		CellEditor.prototype._extractFragments = function(startPos, length, fragments) {
			var fr;

			fr = this._findFragment(startPos, fragments);
			if (!fr) {throw "Can not extract fragment of text";}
			this._splitFragment(fr, startPos, fragments);

			fr = this._findFragment(startPos + length, fragments);
			if (!fr) {throw "Can not extract fragment of text";}
			this._splitFragment(fr, startPos + length, fragments);
		};

		CellEditor.prototype._addFragments = function (f, pos) {
			var t = this, opt = t.options, fr;

			fr = t._findFragment(pos);
			if (fr && pos < fr.end) {
				t._splitFragment(fr, pos);
				fr = t._findFragment(pos);
				Array.prototype.splice.apply(opt.fragments, [fr.index, 0].concat(f));
			} else {
				opt.fragments = opt.fragments.concat(f);
			}

			// merge fragments with equal formats
			t._mergeFragments();

			t.cursorPos = pos + t._getFragmentsLength(f);
			if (!t.undoAllMode) {
				t._update();
			}
		};

		CellEditor.prototype._mergeFragments = function () {
			var t = this, opt = t.options, i;

			for (i = 0; i < opt.fragments.length; ) {
				if (opt.fragments[i].text.length < 1 && opt.fragments.length > 1) {
					opt.fragments.splice(i, 1);
					continue;
				}
				if (i < opt.fragments.length - 1)
				{
					var fr = opt.fragments[i];
					var nextFr = opt.fragments[i + 1];
				    if(fr.format.isEqual(nextFr.format)) {
						opt.fragments.splice(i, 2, new Fragment({format: fr.format, text: fr.text + nextFr.text}));
						continue;
					}
				}
				++i;
			}
		};

		CellEditor.prototype._cleanFragments = function (fr) {
			var t = this, i, s, f, wrap = t.textFlags.wrapText || t.textFlags.wrapOnlyNL;

			for (i = 0; i < fr.length; ++i) {
				s = fr[i].text;
				if (s.search(t.reNL) >= 0) {s = s.replace(t.reReplaceNL, wrap ? "\n" : "\u00B6");}
				if (s.search(t.reTab) >= 0) {s = s.replace(t.reReplaceTab, "        ");}
				fr[i].text = s;
				f = fr[i].format;
				if (f.fn === "") {f.fn = t.options.font.FontFamily.Name;}
				if (f.fs === 0) {f.fs = t.options.font.FontSize;}
			}
		};

		CellEditor.prototype._getFragmentsLength = function (f) {
			return f.length > 0 ? f.reduce(function(pv, cv){return pv + cv.text.length;}, 0) : 0;
		};

		CellEditor.prototype._getFragmentsText = function (f) {
			return f.length > 0 ? f.reduce(function(pv, cv){return pv + cv.text;}, "") : "";
		};

		CellEditor.prototype._setFormatProperty = function (format, prop, val) {
			switch (prop) {
				case "fn": format.fn = val; format.scheme = Asc.EFontScheme.fontschemeNone; break;
				case "fs": format.fs = val; break;
				case "b":
					val = (null === val) ? ((format.b) ? !format.b : true) : val;
					format.b = val;
					break;
				case "i":
					val = (null === val) ? ((format.i) ? !format.i : true) : val;
					format.i = val;
					break;
				case "u":
					val = (null === val) ? ((Asc.EUnderline.underlineSingle !== format.u) ?
						Asc.EUnderline.underlineSingle : Asc.EUnderline.underlineNone) : val;
					format.u = val;
					break;
				case "s":
					val = (null === val) ? ((format.s) ? !format.s : true) : val;
					format.s = val;
					break;
				case "fa": format.va = val; break;
				case "c":
					format.c = val;
					break;
				case "changeFontSize":
					var newFontSize = asc_incDecFonSize(val, format.fs);
					if (null !== newFontSize)
						format.fs = newFontSize;
					break;
			}
			return val;
		};

		CellEditor.prototype._performAction = function (list1, list2) {
			var t = this, action, str, pos, len;

			if (list1.length < 1) {return;}

			action = list1.pop();

			if (action.fn === t._removeChars) {
				pos = action.args[0];
				len = action.args[1];
				if (len < 2 && !t._isWholeFragment(pos, len)) {
					list2.push({fn: t._addChars, args: [t.textRender.getChars(pos, len), pos], isRange: action.isRange});
				} else {
					list2.push({fn: t._addFragments, args: [t._getFragments(pos, len), pos], isRange: action.isRange});
				}
			} else if (action.fn === t._addChars) {
				str = action.args[0];
				pos = action.args[1];
				list2.push({fn: t._removeChars, args: [pos, str.length], isRange: action.isRange});
			} else if (action.fn === t._addFragments) {
				pos = action.args[1];
				len = t._getFragmentsLength(action.args[0]);
				list2.push({fn: t._removeChars, args: [pos, len], isRange: action.isRange});
			} else {
				return;
			}

			t.undoMode = true;
			if (t.selectionBegin !== t.selectionEnd) {
				t.selectionBegin = t.selectionEnd = -1;
				t._cleanSelection();
			}
			action.fn.apply(t, action.args);
			t.undoMode = false;
		};

		CellEditor.prototype._tryCloseEditor = function (event) {

            event = {
                which: 13,
                shiftKey: false,
                metaKey: false,
                ctrlKey: false
            };

            this.close(true);

			//if (this.close(true))
			//	this.handlers.trigger("applyCloseEvent", event);
		};

		CellEditor.prototype._getAutoComplete = function(str) {
			// ToDo можно ускорить делая поиск каждый раз не в большом массиве, а в уменьшенном (по предыдущим символам)
			var oLastResult = this.objAutoComplete[str];
			if (oLastResult)
				return oLastResult;

			var arrAutoComplete = this.options.autoComplete;
			var arrAutoCompleteLC = this.options.autoCompleteLC;
			var i, length, arrResult = [];
			for (i = 0, length = arrAutoCompleteLC.length; i < length; ++i) {
				if (0 === arrAutoCompleteLC[i].indexOf(str))
					arrResult.push(arrAutoComplete[i]);
			}
			return this.objAutoComplete[str] = arrResult;
		};

		CellEditor.prototype._updateSelectionInfo = function () {
			var tmp = this.cursorPos;
			tmp = this._findFragmentToInsertInto(tmp);
			if (!tmp)
				return;
			tmp = this.options.fragments[tmp.index].format;

			var result = new asc.asc_CFont();
			result.name = tmp.fn;
			result.size = tmp.fs;
			result.bold = tmp.b;
			result.italic = tmp.i;
			result.underline = (Asc.EUnderline.underlineNone !== tmp.u); // ToDo убрать, когда будет реализовано двойное подчеркивание
			result.strikeout = tmp.s;
			result.subscript = tmp.va === "subscript";
			result.superscript = tmp.va === "superscript";
			result.color = (tmp.c ? asc.colorObjToAscColor(tmp.c) : new asc_CColor(this.options.textColor));

			this.handlers.trigger("updateEditorSelectionInfo", result);
		};

		CellEditor.prototype._checkMaxCellLength = function (length) {
			var newLength = this._getFragmentsLength(this.options.fragments) + length;
			// Ограничение на ввод
			if (newLength > c_oAscMaxCellOrCommentLength) {
				if (this.selectionBegin === this.selectionEnd)
					return false;

				var b = Math.min(this.selectionBegin, this.selectionEnd);
				var e = Math.max(this.selectionBegin, this.selectionEnd);
				if (newLength - this._getFragmentsLength(this._getFragments(b, e - b)) > c_oAscMaxCellOrCommentLength)
					return false;
			}
			return true;
		};

		// Event handlers

		/** @param event {KeyboardEvent} */
		CellEditor.prototype._onWindowKeyDown = function (event) {
			var t = this, kind = undefined, hieroglyph = false;
			var ctrlKey = event.metaKey || event.ctrlKey;

			if (!t.isOpened || !t.enableKeyEvents) {return true;}

			// для исправления Bug 15902 - Alt забирает фокус из приложения
			if (event.which === 18) {
				t.lastKeyCode = event.which;
			}

			t.skipKeyPress = true;
			t.skipTLUpdate = false;

			// определение ввода иероглифов
			if (t.isTopLineActive && t._getFragmentsLength(t.options.fragments) !== t.input.value.length) {
				hieroglyph = true;
			}

			switch (event.which) {

				case 27:  // "esc"
					if (t.handlers.trigger("isGlobalLockEditCell"))
						return false;
					t.undoAll();
					t.close();
					return false;

				case 13:  // "enter"
					//if (!t.hasFocus) {t.setFocus(true);}
					//if (!(event.altKey && event.shiftKey)) {
					//	if (event.altKey)
							t._addNewLine();
					//	else {
					//		if (false === t.handlers.trigger("isGlobalLockEditCell"))
					//			t._tryCloseEditor(event);
					//	}
					//}
					return false;

				case 9: // tab
					if (!t.hasFocus) {t.setFocus(true);}
					if (hieroglyph) {t._syncEditors();}

					if (false === t.handlers.trigger("isGlobalLockEditCell"))
						t._tryCloseEditor(event);
					return false;

				case 8:   // "backspace"
					// Отключим стандартную обработку браузера нажатия backspace
					//event.stopPropagation();
					//event.preventDefault();
					//if (hieroglyph) {t._syncEditors();}
					t._removeChars(ctrlKey ? kPrevWord : kPrevChar);
					return false;

				case 46:  // "del"
					if (!t.hasFocus) {t.setFocus(true);}
					if (hieroglyph) {t._syncEditors();}
					event.stopPropagation();
					event.preventDefault();
					t._removeChars(ctrlKey ? kNextWord : kNextChar);
					return true;

				case 37:  // "left"
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					kind = ctrlKey ? kPrevWord : kPrevChar;
					event.shiftKey ? t._selectChars(kind) : t._moveCursor(kind);
					return false;

				case 39:  // "right"
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					kind = ctrlKey ? kNextWord : kNextChar;
					event.shiftKey ? t._selectChars(kind) : t._moveCursor(kind);
					return false;

				case 38:  // "up"
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					event.shiftKey ? t._selectChars(kPrevLine) : t._moveCursor(kPrevLine);
					return false;

				case 40:  // "down"
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					event.shiftKey ? t._selectChars(kNextLine) : t._moveCursor(kNextLine);
					return false;

				case 35:  // "end"
					// Отключим стандартную обработку браузера нажатия end
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					kind = ctrlKey ? kEndOfText : kEndOfLine;
					event.shiftKey ? t._selectChars(kind) : t._moveCursor(kind);
					return false;

				case 36:  // "home"
					// Отключим стандартную обработку браузера нажатия home
					event.stopPropagation();
					event.preventDefault();
					if (!t.hasFocus) {break;}
					if (hieroglyph) {t._syncEditors();}
					kind = ctrlKey ? kBeginOfText : kBeginOfLine;
					event.shiftKey ? t._selectChars(kind) : t._moveCursor(kind);
					return false;

				case 53: // 5
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// Отключим стандартную обработку браузера нажатия ctrl + 5
						event.stopPropagation();
						event.preventDefault();
						if (hieroglyph) {t._syncEditors();}
						t.setTextStyle("s", null);
						return true;
					}
					break;

				case 65: // A
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// Отключим стандартную обработку браузера нажатия ctrl + a
						if (!t.isTopLineActive) {
							event.stopPropagation();
							event.preventDefault();
						}
						t._moveCursor(kBeginOfText);
						t._selectChars(kEndOfText);
						return true;
					}
					break;

				case 66: // B
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// Отключим стандартную обработку браузера нажатия ctrl + b
						event.stopPropagation();
						event.preventDefault();
						if (hieroglyph) {t._syncEditors();}
						t.setTextStyle("b", null);
						return true;
					}
					break;

				case 73: // I
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// Отключим стандартную обработку браузера нажатия ctrl + i
						event.stopPropagation();
						event.preventDefault();
						if (hieroglyph) {t._syncEditors();}
						t.setTextStyle("i", null);
						return true;
					}
					break;

				/*case 83: // S
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						if (hieroglyph) {t._syncEditors();}

						if (false === t.handlers.trigger("isGlobalLockEditCell"))
				 			t._tryCloseEditor(event);
						return false;
					}
					break;*/

				case 85: // U
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// Отключим стандартную обработку браузера нажатия ctrl + u
						event.stopPropagation();
						event.preventDefault();
						if (hieroglyph) {t._syncEditors();}
						t.setTextStyle("u", null);
						return true;
					}
					break;

				case 144://Num Lock
				case 145://Scroll Lock
					if (AscBrowser.isOpera) {
						event.stopPropagation();
						event.preventDefault();
					}
					return false;

				case 80: // print           Ctrl + p
					if (ctrlKey) {
						event.stopPropagation();
						event.preventDefault();
						return false;
					}
					break;

				case 67: // copy  Ctrl + c
				case 86: // paste Ctrl + v
				case 88: // redo  Ctrl + x
					if (ctrlKey) {
						if (!t.hasFocus) {t.setFocus(true);}
						// возвращение фокуса в top line
						if (t.isTopLineActive) {
							// чтобы поставить выполнение в очередь после вставки из клипборда используется двойной setTimeout
							setTimeout(
									function(){setTimeout(function(){t._updateTopLineCurPos(); t.input.focus(); t._topLineMouseUp();}, 0);},
									0);
						}
						switch (event.which) {
							case 67: t.handlers.trigger("copy");break;
							case 86: t.handlers.trigger("paste");break;
							case 88: t.handlers.trigger("cut");break;
						}
						return true;
					}
					break;

				case 89:  // ctrl + y
				case 90:  // ctrl + z
					if (ctrlKey) {
						event.stopPropagation();
						event.preventDefault();
						if (!t.hasFocus) {t.setFocus(true);}
						event.which === 90 ? t.undo() : t.redo();
						return false;
					}
					break;

				case 113: // F2
					if (AscBrowser.isOpera) {
						event.stopPropagation();
						event.preventDefault();
					}
					return false;

			}

			t.skipKeyPress = false;
			t.skipTLUpdate = true;
			return true;
		};

		/** @param event {KeyboardEvent} */
		CellEditor.prototype._onWindowKeyPress = function (event) {
			var t = this;
			var ctrlKey = event.metaKey || event.ctrlKey;

			//if (!t.isOpened || !t.enableKeyEvents) {return true;}

			//if (t.skipKeyPress || event.which < 32 || event.altKey || ctrlKey) {
			//	t.skipKeyPress = true;
			//	return true;
			//}

			// Проверим, есть ли глобальный lock
			//if (t.handlers.trigger("isGlobalLockEditCell"))
			//	return true;

			//if (!t.hasFocus) {t.setFocus(true);}

			// определение ввода иероглифов
			//if (t.isTopLineActive && t._getFragmentsLength(t.options.fragments) !== t.input.value.length) {
			//	t._syncEditors();
			//}

			//t.setFocus(true);
			t.isUpdateValue = false;

			var tmpCursorPos;
			var newChar = String.fromCharCode(event.which);
			t._addChars(newChar);
			// При первом быстром вводе стоит добавить в конце проценты (для процентного формата и только для числа)
			if (t.options.isAddPersentFormat && isNumber(newChar)) {
				t.options.isAddPersentFormat = false;
				tmpCursorPos = t.cursorPos;
				t.undoMode = true;
				t._addChars("%");
				t.cursorPos = tmpCursorPos;
				t.undoMode = false;
				t._updateCursorPosition();
			}
			if (t.textRender.getEndOfText() === t.cursorPos && !t.isFormula()) {
				var s = t._getFragmentsText(t.options.fragments);
				if (!isNumber(s)) {
					var arrAutoComplete = t._getAutoComplete(s.toLowerCase());
					var lengthInput = s.length;
					if (1 === arrAutoComplete.length) {
						var newValue = arrAutoComplete[0];
						tmpCursorPos = t.cursorPos;
						t._addChars(newValue.substring(lengthInput));
						t.selectionBegin = tmpCursorPos;
						t._selectChars(kEndOfText);
					}
				}
			}

			return t.isTopLineActive ? true : false; // prevent event bubbling
		};

		/** @param event {KeyboardEvent} */
		CellEditor.prototype._onWindowKeyUp = function (event) {
			var t = this;

			// для исправления Bug 15902 - Alt забирает фокус из приложения
			if (t.lastKeyCode === 18 && event.which === 18) {
				return false;
			}
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onWindowMouseUp = function (event) {
			this.isSelectMode = false;
			if (this.callTopLineMouseup) {this._topLineMouseUp();}
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onWindowMouseMove = function (event) {
			if (this.isSelectMode && !this.hasCursor) {this._changeSelection(this._getCoordinates(event));}
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onMouseDown = function (event) {
			var t = this;
			var coord = t._getCoordinates(event);
			var pos;

			//this.setFocus(true);

			t.isTopLineActive = false;
			t.input.isFocused = false;
			//t._showCursor();

			if (event.which === 1) {
				if (!event.shiftKey) {
					t.isSelectMode = true;
					pos = t._findCursorPosition(coord);
					if (pos !== undefined) {pos >= 0 ? t._moveCursor(kPosition, pos) : t._moveCursor(pos);}
				} else {
					t._changeSelection(coord);
				}
			}
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onMouseUp = function (event) {
			if (2 === event.button) {
				this.handlers.trigger('onContextMenu', event);
				return true;
			}
			this.isSelectMode = false;
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onMouseMove = function (event) {
			this.hasCursor = true;
			//if (this.isSelectMode) {
				this._changeSelection(this._getCoordinates(event));
			//}
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onMouseLeave = function (event) {
			this.hasCursor = false;
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._onMouseDblClick = function (event) {
			var t = this;
			// Окончание слова
			var endWord = t.textRender.getNextWord(t.cursorPos);
			// Начало слова (ищем по окончанию, т.к. могли попасть в пробел)
			var startWord = t.textRender.getPrevWord(endWord);

			t._moveCursor(kPosition, startWord);
			t._selectChars(kPosition, endWord);
			return true;
		};

		/** @param event {jQuery.Event} */
		CellEditor.prototype._onInputTextArea = function (event) {
			if (this.handlers.trigger("isViewerMode"))
				return true;

			if (this.isUpdateValue) {
				// Для языков с иероглифами не приходят эвенты с клавиатуры, поэтому обработаем здесь
				this.skipTLUpdate = true;
				this.replaceText(0, this.textRender.getEndOfLine(this.cursorPos), this.input.value);
			}
			this.isUpdateValue = true;
			return true;
		};

		/** @param event {MouseEvent} */
		CellEditor.prototype._getCoordinates = function (event) {
            return {x: event.pageX, y: event.pageY};
			//var t = this;
			//var offs = $(t.canvasOverlay).offset();
			//var x = (event.pageX - offs.left) / t.kx;
			//var y = (event.pageY - offs.top) / t.ky;
			//return {x: x, y: y};
		};


		/*
		 * Export
		 * -----------------------------------------------------------------------------
		 */
		window["Asc"].CellEditor = CellEditor;


	}
)(jQuery, window);