window.$    = window.jQuery = require('jquery');
bootstrap   = require('bootstrap');
highlights  = require('highlights');
diff        = require('diff');
path        = require('path');

// temp for dev
var left  = __dirname + '/sample-left.js';
var right = __dirname + '/sample-right.js';

var alignByLine = [];
function loadDiff(left, right) {
  $('title').text(path.basename(left) + ' - ' + path.basename(right));

  Promise.all([
    loadFile(left,  $('.file-left .file-contents')),
    loadFile(right, $('.file-right .file-contents'))
  ]).then(function(values) {
    var i           = 0,
        count       = 0,
        lineLeft    = 0,
        lineRight   = 0,
        isEdit      = false,
        changes     = diff.diffLines(values[0], values[1]),
        linesLeft   = $('.file-left  .file-contents div.line'),
        linesRight  = $('.file-right .file-contents div.line'),
        chunkSize   = 0;
        gutterLines = 0;

    for (i = 0; i < changes.length; i++) {
      count = changes[i].count;

      // handle deletes
      if (changes[i].removed) {
        isEdit = Boolean(i+1 < changes.length && changes[i+1].added);

        $(linesLeft.slice(lineLeft, lineLeft + count))
          .addClass('delete').toggleClass('edit', isEdit);

        // pair-up left/right changes
        $(linesLeft.get(lineLeft)).addClass('change change-' + i + ' line-' + lineLeft);
        $(linesRight.get(lineRight)).addClass('change-' + i);

        // bridge the gap
        drawBridge(changes[i], changes[i+1], lineLeft, lineRight, 0, 0);

        lineLeft += count;

      // handle adds
      } else if (changes[i].added) {
        isEdit = Boolean(i > 0 && changes[i-1].removed);

        $(linesRight.slice(lineRight, lineRight + count))
          .addClass('add').toggleClass('edit', isEdit);

        // pair-up left/right changes
        $(linesRight.get(lineRight)).addClass('change change-' + i);
        $(linesLeft.get(lineLeft - (isEdit ? changes[i-1].count : 0))).addClass('change-' + i);

        // bridge the gap
        if (!isEdit) {
          drawBridge(changes[i-1], changes[i], lineLeft, lineRight, 0, 0);
        }

        lineRight += count;

      // handle same
      } else {
        isEdit = false;

        // pair-up left/right changes
        $([linesLeft.get(lineLeft), linesRight.get(lineRight)])
          .addClass('change change-' + i);

        lineLeft  += count;
        lineRight += count;
      }
    }

    // make a pass through changes to pair up edits
    var chunks = [];
    for (i = 0; i < changes.length; i++) {
      isEdit = changes[i].removed && i < changes.length && changes[i+1].added;

      chunks.push({
        edit:   isEdit,
        add:    isEdit ? false : changes[i].added,
        delete: isEdit ? false : changes[i].removed,
        left:   changes[i],
        right:  isEdit ? changes[i+1] : changes[i],
        size:   isEdit ? Math.max(changes[i].count, changes[i+1].count) : changes[i].count
      });

      // skip add half of edits
      if (isEdit) i++;
    }

    // if you were to take the tallest side of each diff chunk and stack
    // them on top of each other, that is how tall we want the gutter to be
    // that way you can scroll through the gutter and smoothly scroll past
    // every line in every diff chunk
    // for a given a 'gutter' line number we want to be able to quickly lookup
    // the left/right line numbers that we should be trying to align when
    // scrolled to the top of the chunk vs the bottom of the chunk
    var chunk       = null,
        gutterLine  = 0,
        leftLine    = 0,
        leftSize    = 0,
        rightLine   = 0,
        rightSize   = 0;

    for (i = 0; i < chunks.length; i++) {
      chunk     = chunks[i];
      leftSize  = chunk.add    ? 0 : chunk.left.count;
      rightSize = chunk.delete ? 0 : chunk.right.count;

      var align = {
        left:   { first: leftLine,   last: leftLine   + leftSize,   size: leftSize },
        right:  { first: rightLine,  last: rightLine  + rightSize,  size: rightSize },
        gutter: { first: gutterLine, last: gutterLine + chunk.size, size: chunk.size }
      };
      for (var j = 0; j < chunk.size; j++) {
        alignByLine[gutterLine + j] = align;
      }

      leftLine   += leftSize;
      rightLine  += rightSize;
      gutterLine += chunk.size
    }

    $('.gutter').css('height', (getLineHeight() * gutterLine) + 'px');
  });
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
    var fs = require('fs');
    fs.readFile(file, 'utf8', function (error, data) {
      if (error) reject();

      // syntax highlight
      var html = new highlights().highlightSync({
        fileContents: data,
        scopeName: 'source.js'
      });

      container.html(html);
      resolve(data);
    });
  });
}

function drawBridge(changeLeft, changeRight, lineLeft, lineRight, leftOffset, rightOffset, bridge) {
  // if bridge is given we are re-drawing an existing bridge
  // otherwise we need to make the bridge
  if (bridge) {
    changeLeft  = bridge.data('changeLeft');
    changeRight = bridge.data('changeRight');
    lineLeft    = bridge.data('lineLeft');
    lineRight   = bridge.data('lineRight');
  } else {
    bridge = $('<svg><polygon></polygon></svg>')
      .appendTo('.gutter')
      .data('changeLeft',  changeLeft)
      .data('changeRight', changeRight)
      .data('lineLeft',    lineLeft)
      .data('lineRight',   lineRight);
  }

  // adjust lineLeft/Right to account for offset (scroll alignment)
  var lineHeight  = getLineHeight();
  var action      = changeLeft.removed && changeRight.added ? 'edit' : (changeLeft.removed ? 'delete' : 'add');
  var leftHeight  = changeLeft.removed ? (changeLeft.count  * lineHeight) : 0;
  var rightHeight = changeRight.added  ? (changeRight.count * lineHeight) : 0;

  var top, leftTop, leftBottom, rightTop, rightBottom;

  // we need four points to draw the bridge
  // begin by assuming the canvas is the size of the gutter
  var leftTop     = (lineLeft * lineHeight)  + leftOffset,
      rightTop    = (lineRight * lineHeight) + rightOffset,
      rightBottom = rightTop + rightHeight,
      leftBottom  = leftTop  + leftHeight,
      top         = Math.min(leftTop, rightTop),
      height      = Math.max(leftBottom, rightBottom);

  var points = [
    '0,'   + leftTop,
    '100,' + rightTop,
    '100,' + rightBottom,
    '0,'   + leftBottom
  ];

  height = Math.max(leftBottom, rightBottom); // - Math.min(leftTop, rightTop);

  // viewbox and aspect ratio must be set natively or they don't work - weird
  bridge[0].setAttribute('viewBox', '0,' + top + ' 100,' + height);
  bridge[0].setAttribute('preserveAspectRatio', 'none');

  bridge
    .addClass('bridge ' + action)
    .css('top', top + 'px')
    .attr('height', height);

  bridge
    .find('polygon')
    .attr('preserveAspectRatio', 'none')
    .attr('points', points.join(' '));
}

var lastLeftOffset  = 0, lastRightOffset = 0;
function updateBridges(leftOffset, rightOffset) {
  if (leftOffset === lastLeftOffset && rightOffset === lastRightOffset) return;

  $('.bridge').each(function(){
    drawBridge(null, null, null, null, leftOffset, rightOffset, $(this));
  });

  lastLeftOffset  = leftOffset;
  lastRightOffset = rightOffset;
}

$(function(){
  loadDiff(left, right);

  $(window).on('scroll', function(e){
    // align changes when they scroll to a point 1/3 of the way down the window
    // find the line that corresponds to this point based on line-height
    var scrollTop   = $(window).scrollTop(),
        lineHeight  = getLineHeight(),
        focalPoint  = Math.floor($(window).height() / 3) + scrollTop,
        focalLine   = Math.floor(focalPoint / lineHeight);

    // line-up first line in each chunk
    var align       = alignByLine[focalLine],
        leftOffset  = (align.gutter.first - align.left.first)  * lineHeight,
        rightOffset = (align.gutter.first - align.right.first) * lineHeight;

    // what percentage of the way through this chunk are we?
    // the smaller side should get edged down by % of it's deficit
    var percent     = ((focalPoint/lineHeight) - align.gutter.first) / align.gutter.size;
    leftOffset     += percent * (align.gutter.size - align.left.size)  * lineHeight;
    rightOffset    += percent * (align.gutter.size - align.right.size) * lineHeight;

    $('.file-left  .file-contents').css('top', leftOffset  + 'px');
    $('.file-right .file-contents').css('top', rightOffset + 'px');

    // redraw connecting svgs
    updateBridges(leftOffset, rightOffset);
  });
});
