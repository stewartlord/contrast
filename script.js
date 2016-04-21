'use strict';

window.jQuery    = require('jquery');
window.$         = window.jQuery;
const diff       = require('diff');
const electron   = require('electron');
const fs         = require('fs');
const highlights = require('highlights');
const path       = require('path');
const remote     = require('remote');

// listen for what files to diff
var left, right;
electron.ipcRenderer.on('args', function(event, args) {
  if (args[1] && args[2]) {
    left  = args[1];
    right = args[2];
    loadDiff(left, right);
  }
});

function refresh() {
  chunksByLine    = [];
  lineHeight      = null;
  lastLeftOffset  = 0,
  lastRightOffset = 0;
  $('.file-contents, .file-gutter, .river').html("");
  loadDiff(left, right);
}

var chunksByLine = [];
function loadDiff(left, right) {
  $('title').text(path.basename(left) + ' - ' + path.basename(right));

  Promise.all([
    loadFile(left,  $('.file-left')),
    loadFile(right, $('.file-right'))
  ]).then(function(values) {
    var i,
        isEdit  = false,
        chunks  = [],
        changes = diff.diffLines(values[0], values[1]);

    // make a pass through changes to pair up edits
    for (i = 0; i < changes.length; i++) {
      isEdit = changes[i].removed && i < changes.length && changes[i+1].added;

      chunks.push({
        edit:   isEdit,
        add:    isEdit ? false : changes[i].added,
        delete: isEdit ? false : changes[i].removed,
        same:   changes[i].added || changes[i].removed ? false : true,
        action: isEdit ? 'edit' : (changes[i].added ? 'add' : (changes[i].removed ? 'delete' : 'same')),
        left:   changes[i],
        right:  isEdit ? changes[i+1] : changes[i],
        size:   isEdit ? Math.max(changes[i].count, changes[i+1].count) : changes[i].count
      });

      // skip add half of edits
      if (isEdit) i++;
    }

    // process the diff chunks now that we've paired up edits:
    //  - if you were to take the tallest side of each diff chunk and stack
    //    them on top of each other, that is how tall we want the river to be
    //    that way you can scroll down the river and smoothly scroll past
    //    every line in every diff chunk
    //  - for any given 'river' line number we want to be able to quickly
    //    lookup the chunk and left/right line numbers that we should be
    //    trying to align when scrolled to the top or bottom of the chunk
    //  - identify changed lines with action-add/edit/delete
    //  - draw connecting svg 'bridges' between the left and right side
    var chunk        = null,
        chunkSize    = 0,
        riverLine    = 0,
        leftNumbers  = $('.file-left .file-gutter div.line'),
        leftLines    = $('.file-left .file-contents div.line'),
        leftLine     = 0,
        leftSize     = 0,
        rightNumbers = $('.file-right .file-gutter div.line'),
        rightLines   = $('.file-right .file-contents div.line'),
        rightLine    = 0,
        rightSize    = 0;

    for (i = 0; i < chunks.length; i++) {
      chunk     = chunks[i];
      leftSize  = chunk.add    ? 0 : chunk.left.count;
      rightSize = chunk.delete ? 0 : chunk.right.count;
      chunkSize = chunk.size;

      // prepare line-based alignment data and index by river line number
      chunk.align = {
        left:  { first: leftLine,  last: leftLine  + leftSize,  size: leftSize },
        right: { first: rightLine, last: rightLine + rightSize, size: rightSize },
        river: { first: riverLine, last: riverLine + chunkSize, size: chunkSize }
      };
      for (var j = 0; j < chunk.size; j++) {
        chunksByLine[riverLine + j] = chunk;
      }

      // tag changed lines with add/edit/delete action classes
      // and draw connection between the left and right hand side
      if (!chunk.same) {
        $(leftNumbers.slice(leftLine, leftLine + (leftSize || 1)))
          .addClass('action-' + chunk.action);
        $(leftLines.slice(leftLine, leftLine + (leftSize || 1)))
          .addClass('action-' + chunk.action);
        $(rightNumbers.slice((rightSize ? rightLine : rightLine - 1), rightLine + rightSize))
          .addClass('action-' + chunk.action);
        $(rightLines.slice((rightSize ? rightLine : rightLine - 1), rightLine + rightSize))
          .addClass('action-' + chunk.action);

        drawBridge(chunk, 0, 0);
      }

      // do sub-chunk diffing on edits
      if (chunk.edit) {
        subDiff(
          $(leftLines.slice(leftLine, leftLine + leftSize)),
          $(rightLines.slice(rightLine, rightLine + rightSize))
        );
      }

      leftLine  += leftSize;
      rightLine += rightSize;
      riverLine += chunkSize
    }

    // river should be tall enough to scroll through tallest chunks
    $('.river').css('min-height', (getLineHeight() * riverLine) + 'px');
  });
}

function subDiff(left, right) {
  var change,
      changes,
      chunks      = [],
      leftText    = "",
      rightText   = "",
      leftLeaves  = left.find('*').filter(function(){  return !this.childElementCount; }),
      rightLeaves = right.find('*').filter(function(){ return !this.childElementCount; });

  // extract text content from leaf nodes
  leftLeaves.each(function(){  leftText  += $(this).html(); });
  rightLeaves.each(function(){ rightText += $(this).html(); });

  // diff the text (unescaped so we don't split entities)
  changes = diff.diffChars(unescapeHtml(leftText), unescapeHtml(rightText));

  // compose diff chunks and escape text again so it matches the dom
  for (var i = 0; i < changes.length; i++) {
    change       = changes[i];
    change.value = escapeHtml(change.value);
    chunks.push({
      add:    change.added,
      delete: change.removed,
      same:   change.added || change.removed ? false : true,
      action: change.added ? 'add' : (change.removed ? 'delete' : 'same'),
      size:   change.value.length,
      change: change
    });
  }

  applySubDiff(chunks, leftLeaves,  true);
  applySubDiff(chunks, rightLeaves, false);
}

function applySubDiff(chunks, leafNodes, isLeft) {
  var chunk     = null,
      chunkChar = 0,
      applies   = true,
      node      = null,
      nodeIndex = 0,
      nodeChar  = 0,
      available = 0,
      required  = 0,
      consume   = 0,
      html      = "",
      head      = "",
      tail      = "",
      body      = "";

  for (var i = 0; i < chunks.length; i++) {
    chunk     = chunks[i];
    chunkChar = 0;
    applies   = (isLeft && !chunk.add) || (!isLeft && !chunk.delete);

    while (chunkChar < chunk.size) {
      node      = $(leafNodes.get(nodeIndex));
      html      = node.html();
      available = html.length - nodeChar;
      required  = chunk.size - chunkChar;
      consume   = Math.min(required, available);

      // advance the node if we need more space
      if (applies && !available) {
        nodeIndex++;
        nodeChar = 0;
        continue;
      }

      // if this is a changed chunk, span wrap the part of it that resides in the node
      if (!chunk.same) {
        head = html.substring(0, nodeChar);
        tail = html.substring(nodeChar + (applies ? consume : 0));
        body = '<span class="sub-chunk action-' + chunk.action + '">'
             + html.substring(nodeChar, nodeChar + (applies ? consume : 0))
             + '</span>';
        node.html(head + body + tail);
      }

      // move character pointers by the amount we advanced
      chunkChar += applies    ? consume : required;
      nodeChar  += chunk.same ? consume : body.length;
    }
  }
}

function escapeHtml(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;');
}

function unescapeHtml(html) {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g,   '>')
    .replace(/&lt;/g,   '<')
    .replace(/&amp;/g,  '&');
}

var lineHeight;
function getLineHeight() {
  if (!lineHeight) {
    lineHeight = $('div.line:first-child').first().height();
  }
  return lineHeight;
}

function loadFile(file, container) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, 'utf8', function (error, data) {
      if (error) reject();

      // syntax highlight
      var html = new highlights().highlightSync({
        fileContents: data,
        scopeName: 'source.js'
      });
      container.find('.file-contents').html(html);

      // render line numbers
      html = '';
      for (var i = 1; i <= container.find('div.line').length; i++) {
        html += '<div class="line">' + i + '</div>';
      }
      container.find('.file-gutter').html(html);

      resolve(data);
    });
  });
}

function drawBridge(chunk, leftOffset, rightOffset, bridge) {
  // if bridge is given we are re-drawing an existing bridge
  // otherwise we need to make the bridge
  if (bridge) {
    chunk  = bridge.data('chunk');
  } else {
    bridge = $('<svg><polygon></polygon></svg>').appendTo('.river').data('chunk', chunk);
  }

  // we need four points to draw the bridge plus position and height in the river
  // initially we pretend the svg canvas starts at the top of the river, then we
  // crop off the top and push it down using relative positioning
  var align       = chunk.align,
      lineHeight  = getLineHeight(),
      leftTop     = (align.left.first  * lineHeight) + leftOffset,
      rightTop    = (align.right.first * lineHeight) + rightOffset,
      rightBottom = rightTop + (align.right.size * lineHeight),
      leftBottom  = leftTop  + (align.left.size  * lineHeight),
      top         = Math.min(leftTop, rightTop),
      height      = Math.max(leftBottom, rightBottom) - top,
      points      = [
        '0,'   + (leftTop     - top),
        '100,' + (rightTop    - top),
        '100,' + (rightBottom - top),
        '0,'   + (leftBottom  - top)
      ];

  // viewbox and aspect ratio must be set natively or they don't work - weird
  bridge[0].setAttribute('viewBox', '0,0 100,' + height);
  bridge[0].setAttribute('preserveAspectRatio', 'none');

  bridge
    .addClass('bridge action-' + chunk.action)
    .css('top', top + 'px')
    .attr('height', height);

  bridge
    .find('polygon')
    .attr('preserveAspectRatio', 'none')
    .attr('points', points.join(' '));
}

var lastLeftOffset  = 0,
    lastRightOffset = 0;
function updateBridges(leftOffset, rightOffset) {
  if (leftOffset === lastLeftOffset && rightOffset === lastRightOffset)
    return;

  $('.bridge').each(function(){
    drawBridge(null, leftOffset, rightOffset, $(this));
  });

  lastLeftOffset  = leftOffset;
  lastRightOffset = rightOffset;
}

function getThemeMenu() {
  var Menu = remote.require('menu'),
      Item = remote.require('menu-item'),
      menu = new Menu();

  var themes = [
    {label: 'Atom Dark',  file: 'themes/atom-dark-syntax.css'},
    {label: 'Atom Light', file: 'themes/atom-light-syntax.css'}
  ];

  for (let i = 0; i < themes.length; i++) {
    menu.append(new Item({
      label:   themes[i].label,
      type:    'checkbox',
      checked: themes[i].file === getCurrentTheme(),
      click:   function(){ switchTheme(themes[i].file); }
    }));
  }

  return menu;
}

function switchTheme(theme) {
  var isDark = theme.match(/dark/i) !== null;
  $('html').toggleClass('dark-theme', isDark).toggleClass('light-theme', !isDark);
  $('link.theme').attr('href', theme);
}

function getCurrentTheme() {
  return $('link.theme').attr('href');
}

$(function(){
  // wire up the toolbar
  $('.toolbar .fa-refresh').click(refresh);
  $('.toolbar .fa-paint-brush').click(function(){
    getThemeMenu().popup(
      remote.getCurrentWindow(),
      Math.round($(this).position().left),
      Math.round($(this).position().top + $(this).outerHeight())
    );
  });

  // align changes when they scroll to a point 1/3 of the way down the window
  // find the line that corresponds to this point based on line-height
  $(window).on('scroll', function(){
    var scrollTop   = $(window).scrollTop(),
        lineHeight  = getLineHeight(),
        focalPoint  = Math.floor($(window).height() / 3) + scrollTop,
        focalLine   = Math.floor(focalPoint / lineHeight);

    // line-up first line in each chunk
    var chunk       = chunksByLine[Math.min(focalLine, chunksByLine.length - 1)],
        align       = chunk.align,
        leftOffset  = (align.river.first - align.left.first)  * lineHeight,
        rightOffset = (align.river.first - align.right.first) * lineHeight;

    // what percentage of the way through this chunk are we?
    // the smaller side should get edged down by % of it's deficit
    var percent     = ((focalPoint/lineHeight) - align.river.first) / align.river.size;
    leftOffset     += percent * (align.river.size - align.left.size)  * lineHeight;
    rightOffset    += percent * (align.river.size - align.right.size) * lineHeight;

    $('.file-left  .file-offset').css('top', leftOffset  + 'px');
    $('.file-right .file-offset').css('top', rightOffset + 'px');

    // redraw connecting svgs
    updateBridges(leftOffset, rightOffset);
  });

  // sync up side-scrolling of left/right file panes
  $('.file .file-contents').on('scroll', function(e){
    var master = $(e.currentTarget),
        other  = master.closest('.file').is('.file-left') ? 'right' : 'left'
        slave  = $('.file-' + other + ' .file-contents');

    slave.scrollLeft(master.scrollLeft());
  });
});
