'use strict';

const diff       = require('diff');
const electron   = require('electron');
const fs         = require('fs');
const highlights = require('highlights');
const path       = require('path');

// @todo make this file specific
function refresh(target) {
  chunkIndex      = [];
  lineHeight      = null;
  lastLeftOffset  = 0,
  lastRightOffset = 0;
  target.find('.file-contents, .file-gutter, .river').html("");
  loadDiff(target, left, right);
}

function loadDiff(component, left, right) {
  let target = $(component.$el);
  Promise.all([
    loadFile(left,  target.find('.file-left')),
    loadFile(right, target.find('.file-right'))
  ]).then(function(values) {
    let isEdit     = false;
    let chunks     = [];
    let changes    = diff.diffLines(values[0], values[1]);

    // make a pass through changes to pair up edits
    for (let i = 0; i < changes.length; i++) {
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
    //    that's what the chunkIndex is for
    //  - identify changed lines with action-add/edit/delete
    //  - draw connecting svg 'bridges' between the left and right side
    let chunkIndex   = [];
    let chunk        = null;
    let chunkClass   = '';
    let chunkSize    = 0;
    let riverLine    = 0;
    let leftNumbers  = target.find('.file-left .file-gutter div.line');
    let leftLines    = target.find('.file-left .file-contents div.line');
    let leftLine     = 0;
    let leftSize     = 0;
    let rightNumbers = target.find('.file-right .file-gutter div.line');
    let rightLines   = target.find('.file-right .file-contents div.line');
    let rightLine    = 0;
    let rightSize    = 0;

    for (let i = 0; i < chunks.length; i++) {
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
      for (let j = 0; j < chunk.size; j++) {
        chunkIndex[riverLine + j] = chunk;
      }

      // tag changed lines with add/edit/delete action classes
      // and draw connection between the left and right hand side
      if (!chunk.same) {
        $.each([
          leftNumbers.slice(leftLine, leftLine + (leftSize || 1)),
          leftLines.slice(leftLine,   leftLine + (leftSize || 1)),
          rightNumbers.slice((rightSize ? rightLine : rightLine - 1), rightLine + rightSize),
          rightLines.slice((rightSize   ? rightLine : rightLine - 1), rightLine + rightSize)
        ], function(){
          this.addClass('action-' + chunk.action)
              .first().addClass('chunk-first').end()
              .last().addClass('chunk-last');
        });

        drawBridge(target, chunk, 0, 0);
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
    target.find('.river').css('min-height', (getLineHeight(target) * riverLine) + 'px');

    // save the index on the component for use when scrolling
    component.chunkIndex = chunkIndex;
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
function getLineHeight(target) {
  if (!lineHeight) {
    lineHeight = target.find('div.line:first-child').first().height();
  }
  return lineHeight;
}

function loadFile(file, container) {
  return new Promise(function(resolve, reject) {
    file.then((data) => {
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

function drawBridge(target, chunk, leftOffset, rightOffset, bridge) {
  // if bridge is given we are re-drawing an existing bridge
  // otherwise we need to make the bridge
  if (bridge) {
    chunk  = bridge.data('chunk');
  } else {
    let river = target.find('.river');
    bridge = $('<svg><polygon/><line/><line/></svg>').appendTo(river).data('chunk', chunk);
  }

  // we need four points to draw the bridge plus position and height in the river
  // initially we pretend the svg canvas starts at the top of the river, then we
  // crop off the top and push it down using relative positioning
  // we draw the bridge 1px higher and 2px taller because the first and last lines
  // of each chunk are drawn taller (to line-up with 2px ruler on pure adds/deletes)
  var align       = chunk.align,
      lineHeight  = getLineHeight(target),
      leftTop     = (align.left.first  * lineHeight) + leftOffset  - 1,
      rightTop    = (align.right.first * lineHeight) + rightOffset - 1,
      rightBottom = rightTop + (align.right.size * lineHeight) + 2,
      leftBottom  = leftTop  + (align.left.size  * lineHeight) + 2,
      top         = Math.min(leftTop, rightTop),
      height      = Math.max(leftBottom, rightBottom) - top;

  // if left or right side has zero size, don't allow the points to converge
  // ensure they maintain a distance of 2px so they flow into our 2px ruler
  leftBottom  = Math.max(leftBottom,  leftTop  + 2);
  rightBottom = Math.max(rightBottom, rightTop + 2);
  var points  = [
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

  // draw the body of the connecting shape
  bridge
    .find('polygon')
    .attr('preserveAspectRatio', 'none')
    .attr('points', points.join(' '));

  // draw lines across the top and bottom of the polygon so we can border it
  // offset the line positions by 1px otherwise they get clipped by the canvas
  var lines = bridge.find('line');
  lines.first().attr({x1: 0, y1: (leftTop - top + 1),    x2: 100, y2: (rightTop - top + 1)});
  lines.last().attr({ x1: 0, y1: (leftBottom - top - 1), x2: 100, y2: (rightBottom - top - 1)});
}

// @todo need to move these into component as well, can't be shared!
var lastLeftOffset  = 0,
    lastRightOffset = 0;
function updateBridges(target, leftOffset, rightOffset) {
  if (leftOffset === lastLeftOffset && rightOffset === lastRightOffset)
    return;

  target.find('.bridge').each(function(){
    drawBridge(target, null, leftOffset, rightOffset, $(this));
  });

  lastLeftOffset  = leftOffset;
  lastRightOffset = rightOffset;
}

function scrollY(diff, scrollTop) {
  // adjust scrollTop to account for offset of this diff
  let target     = $(diff.$el);
  let offsetTop  = target.offset().top;
  scrollTop -= offsetTop;

  // align changes when they scroll to a point 1/3 of the way down the window
  // find the line that corresponds to this point based on line-height
  let lineHeight = getLineHeight(target);
  let focalPoint = Math.floor($(window).height() / 3) + scrollTop
  let focalLine  = Math.floor(Math.max(0, focalPoint) / lineHeight);

  // line-up first line in each chunk
  let chunkIndex  = diff.chunkIndex;
  let chunk       = chunkIndex[Math.min(focalLine, chunkIndex.length - 1)];
  let align       = chunk.align;
  let leftOffset  = (align.river.first - align.left.first)  * lineHeight;
  let rightOffset = (align.river.first - align.right.first) * lineHeight;

  // what percentage of the way through this chunk are we?
  // the smaller side should get edged down by % of it's deficit
  let percent     = ((focalPoint/lineHeight) - align.river.first) / align.river.size;
  leftOffset     += percent * (align.river.size - align.left.size)  * lineHeight;
  rightOffset    += percent * (align.river.size - align.right.size) * lineHeight;

  target.find('.file-left  .file-offset').css('top', leftOffset  + 'px');
  target.find('.file-right .file-offset').css('top', rightOffset + 'px');

  // redraw connecting svgs
  updateBridges(target, leftOffset, rightOffset);
}

function getThemeMenu() {
  var Menu = electron.remote.Menu,
      Item = electron.remote.MenuItem,
      menu = new Menu();

  var themes = [
    {label: 'Dark',  file: 'themes/atom-dark-syntax.css'},
    {label: 'Light', file: 'themes/atom-light-syntax.css'}
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

// @todo - this should change state on the application
function switchTheme(theme) {
  var isDark = theme.match(/dark/i) !== null;
  $('html').toggleClass('dark-theme', isDark).toggleClass('light-theme', !isDark);
  $('link.theme').attr('href', theme);
}

function getCurrentTheme() {
  return $('link.theme').attr('href');
}

module.exports = {
  loadDiff,
  scrollX,
  scrollY,
  refresh,
  getThemeMenu
}