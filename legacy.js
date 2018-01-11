'use strict';

const diff       = require('diff');
const electron   = require('electron');
const fs         = require('fs');
const highlights = require('highlights');
const path       = require('path');

function loadDiff(component, left, right, context) {
  let target = $(component.$el);
  target.find('.file-left, .file-right').css('display', 'none');
  Promise.all([
    loadFile(component.file.path(), left,  target.find('.file-left')),
    loadFile(component.file.path(), right, target.find('.file-right'))
  ]).then(function(values) {
    target.find('.file-left, .file-right').css('display', '');
    component.chunks = getDiffChunks(values[0], values[1]);
    applyDiff(component);
    adjustContext(component, context);
  });
}

function getDiffChunks(left, right) {
  let changes    = diff.diffLines(left, right);
  let chunks     = [];
  let leftLine   = 0;
  let rightLine  = 0;

  // loop through changes to prepare chunk data
  for (let i = 0; i < changes.length; i++) {
    let isEdit   = changes[i].removed && i < changes.length - 1 && changes[i+1].added;
    let isAdd    = isEdit ? false : changes[i].added;
    let isDelete = isEdit ? false : changes[i].removed;
    let leftSize = isAdd ? 0 : changes[i].count;
    let rightSize = isDelete ? 0 : (isEdit ? changes[i+1] : changes[i]).count;

    let chunk = {
      edit:      isEdit,
      add:       isAdd,
      delete:    isDelete,
      same:      !isAdd && !isDelete && !isEdit,
      action:    isEdit ? 'edit' : (isAdd ? 'add' : (isDelete ? 'delete' : 'same')),
      size:      Math.max(leftSize, rightSize),
      leftSize:  leftSize,
      rightSize: rightSize,
      leftLine:  leftLine,
      rightLine: rightLine,
      isFirst:   i === 0,
      isLast:    i === changes.length - 1
    };

    chunks.push(chunk);

    // advance line counters
    leftLine  += leftSize
    rightLine += rightSize;

    // skip add half of edits
    if (isEdit) i++;
  }

  return chunks;
}

function applyDiff(component) {
  let chunks = component.chunks;
  let target = component.$el

  // apply the data in the diff chunks to the DOM
  // identify changed lines with action-add/edit/delete
  // tag lines that are chunk boundaries
  // apply sub-chunk diffing
  let leftLines    = target.querySelector('.file-left .file-contents pre').childNodes;
  let leftNumbers  = target.querySelector('.file-left .file-gutter').childNodes;
  let rightLines   = target.querySelector('.file-right .file-contents pre').childNodes;
  let rightNumbers = target.querySelector('.file-right .file-gutter').childNodes;

  let applyChunkClasses = function(action, lines, numbers, start, length) {
    if (!lines.length) return;
    let end = Math.min(start + length, lines.length);
    for (let i = start; i < end; i++) {
      let classes = ['action-' + action];
      if (i === start)   classes.push('chunk-start');
      if (i === end - 1) classes.push('chunk-end');
      lines[i].classList.add(...classes);
      numbers[i].classList.add(...classes);
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];

    if (!chunk.same) {
      applyChunkClasses(
        chunk.action,
        leftLines,
        leftNumbers,
        chunk.leftLine,
        chunk.leftSize || 1
      );
      applyChunkClasses(
        chunk.action,
        rightLines,
        rightNumbers,
        chunk.rightSize ? chunk.rightLine : chunk.rightLine - 1,
        chunk.rightSize || 1
      );
    }

    // do sub-chunk diffing on edits
    if (chunk.edit) {
      subDiff(
        $(Array.prototype.slice.call(leftLines, chunk.leftLine, chunk.leftLine + chunk.leftSize)),
        $(Array.prototype.slice.call(rightLines, chunk.rightLine, chunk.rightLine + chunk.rightSize))
      );
    }
  }
}

function adjustContext(component, context) {
  let target       = component.$el;
  let chunkIndex   = [];
  let leftLines    = target.querySelector('.file-left .file-contents pre').childNodes;
  let leftNumbers  = target.querySelector('.file-left .file-gutter').childNodes;
  let rightLines   = target.querySelector('.file-right .file-contents pre').childNodes;
  let rightNumbers = target.querySelector('.file-right .file-gutter').childNodes;
  let leftLine     = 0;
  let rightLine    = 0;
  let riverLine    = 0;

  for (let i = 0; i < component.chunks.length; i++) {
    let chunk      = component.chunks[i];
    let leftSize   = chunk.leftSize;
    let rightSize  = chunk.rightSize;
    let chunkSize  = chunk.size;
    let maxSize    = chunk.isFirst || chunk.isLast ? context : context * 2;

    let applyLineClass = function(line, className, toggle) {
        leftLines[chunk.leftLine + line].classList.toggle(className, toggle);
        leftNumbers[chunk.leftLine + line].classList.toggle(className, toggle);
        rightLines[chunk.rightLine + line].classList.toggle(className, toggle);
        rightNumbers[chunk.rightLine + line].classList.toggle(className, toggle);
    }

    // 'same' chunks may have excessive context lines
    if (chunk.same) {
      for (let j = 0; j < chunk.size; j++) {
        let shouldHide = (chunk.isFirst || j >= context) && (chunk.isLast || j < (chunk.size - context));
        let firstHide  = shouldHide && (j === 0 || (!chunk.isFirst && j === context));
        let lastHide   = shouldHide && (j === chunk.size - 1 || (!chunk.isLast && j === (chunk.size - context - 1)));

        applyLineClass(j, 'hide',       shouldHide);
        applyLineClass(j, 'first-hide', firstHide);
        applyLineClass(j, 'last-hide',  lastHide);
      }

      // need to limit sizes to requested amount of context
      // if we hid any lines, add one to chunk size to account for the dividing line
      chunkSize = Math.min(maxSize, chunkSize);
      chunkSize = chunk.size > maxSize ? chunkSize + 1 : chunkSize;
      leftSize  = chunkSize;
      rightSize = chunkSize;
    }

    // prepare line-based alignment data and index by river line number
    // for any given 'river' line number we want to be able to quickly
    // lookup the chunk and left/right line numbers that we should be
    // trying to align when scrolled to the top or bottom of the chunk
    // that's what the chunkIndex is for
    chunk.align = {
      left:  { first: leftLine,  last: leftLine  + leftSize,  size: leftSize },
      right: { first: rightLine, last: rightLine + rightSize, size: rightSize },
      river: { first: riverLine, last: riverLine + chunkSize, size: chunkSize }
    };
    for (let j = 0; j < chunk.size; j++) {
      chunkIndex[riverLine + j] = chunk;
    }

    // if this is a changed chunk, draw connecting bridge
    if (!chunk.same) {
      drawBridge(target, chunk, 0, 0);
    }

    // if we hid lines on a 'same' chunk, draw bridge for the dividing line
    if (chunk.same && chunk.size > maxSize) {
      drawContextBridge(target, chunk, maxSize);
    }

    leftLine  += leftSize;
    rightLine += rightSize;
    riverLine += chunkSize;
  }

  // river should be exactly as tall as all of the chunks stacked on top of
  // each other - that way every line is accounted for and we can smoothly
  // scroll past every line in every chunk
  let river = target.querySelector('.river');
  river.style.minHeight = (getLineHeight(target) * riverLine) + 'px';

  // save the index on the component for use when scrolling
  component.chunkIndex = chunkIndex;
}

function drawContextBridge(target, chunk, maxSize) {
  // determine on which line number the missing context divider appears
  let offset = chunk.isFirst ? 0 : (chunk.isLast ? maxSize : Math.floor(maxSize / 2));

  // draw-bridge expects a chunk object, so mock one up for it
  let fakeChunk = {
    action: 'context',
    align: {
      left:  { first: chunk.align.left.first  + offset, size: 1 },
      right: { first: chunk.align.right.first + offset, size: 1 }
    }
  };
  drawBridge(target, fakeChunk, 0, 0);
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

function loadFile(fileName, fileContents, container) {
  return new Promise(function(resolve, reject) {
    fileContents.then((data) => {
      // syntax highlight
      var html = new highlights().highlightSync({
        fileContents: data,
        scopeName: 'source' + path.extname(fileName)
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
  target = $(target);

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

  // if the offsets are unchanged, all done!
  if (leftOffset === diff.lastOffset.left && rightOffset === diff.lastOffset.right) {
    return;
  }

  // record new offsets for next time
  diff.lastOffset.left  = leftOffset;
  diff.lastOffset.right = rightOffset;

  // nudge left/right files up/down
  target.find('.file-left  .file-offset').css('top', leftOffset  + 'px');
  target.find('.file-right .file-offset').css('top', rightOffset + 'px');

  // redraw connecting svgs
  target.find('.bridge').each(function(){
    drawBridge(target, null, leftOffset, rightOffset, $(this));
  });
}

module.exports = {
  loadDiff,
  scrollY
}