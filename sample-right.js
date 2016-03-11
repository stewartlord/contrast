window.$    = window.jQuery = require('jquery');
bootstrap   = require('bootstrap');
highlights  = require('highlights');
diff        = require('diff');
path        = require('path');

// temp for dev
var left  = __dirname + '/sample-left.js';
var right = __dirname + '/sample-right.js';

var chunksByLine = [];
function loadDiff(left, right) {
  $('title').text(path.basename(left) + ' - ' + path.basename(right));

  Promise.all([
    loadFile(left,  $('.file-left .file-contents')),
    loadFile(right, $('.file-right .file-contents'))
  ]).then(function(values) {
    var i,
        isEdit  = false,
        chunks  = [];
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
    //    them on top of each other, that is how tall we want the gutter to be
    //    that way you can scroll through the gutter and smoothly scroll past
    //    every line in every diff chunk
    //  - for any given 'gutter' line number we want to be able to quickly
    //    lookup the chunk and left/right line numbers that we should be
    //    trying to align when scrolled to the top or bottom of the chunk
    //  - identify changed lines with action-add/edit/delete
    //  - draw connecting svg 'bridges' between the left and right side
    var chunk       = null,
        chunkSize   = 0,
        gutterLine  = 0,
        leftLines   = $('.file-left div.line'),
        leftLine    = 0,
        leftSize    = 0,
        rightLines  = $('.file-right div.line'),
        rightLine   = 0,
        rightSize   = 0;

    for (i = 0; i < chunks.length; i++) {
      chunk     = chunks[i];
      leftSize  = chunk.add    ? 0 : chunk.left.count;
      rightSize = chunk.delete ? 0 : chunk.right.count;
      chunkSize = chunk.size;

      // prepare line-based alignment data and index by gutter line number
      chunk.align = {
        left:   { first: leftLine,   last: leftLine   + leftSize,  size: leftSize },
        right:  { first: rightLine,  last: rightLine  + rightSize, size: rightSize },
        gutter: { first: gutterLine, last: gutterLine + chunkSize, size: chunkSize }
      };
      for (var j = 0; j < chunk.size; j++) {
        chunksByLine[gutterLine + j] = chunk;
      }

      // tag changed lines with add/edit/delete action classes
      // and draw connection between the left and right hand side
      if (!chunk.same) {
        $(leftLines.slice(leftLine, leftLine + leftSize))
          .addClass('action-' + chunk.action);
        $(rightLines.slice(rightLine, rightLine + rightSize))
          .addClass('action-' + chunk.action);
        drawBridge(chunk, 0, 0);
      }

      leftLine   += leftSize;
      rightLine  += rightSize;
      gutterLine += chunkSize
    }

    // gutter should be tall enough to scroll through tallest chunks
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

function drawBridge(chunk, leftOffset, rightOffset, bridge) {
  // if bridge is given we are re-drawing an existing bridge
  // otherwise we need to make the bridge
  if (bridge) {
    chunk  = bridge.data('chunk');
  } else {
    bridge = $('<svg><polygon></polygon></svg>').appendTo('.gutter').data('chunk', chunk);
  }

  // we need four points to draw the bridge plus position and height in the gutter
  var align       = chunk.align,
      lineHeight  = getLineHeight(),
      leftTop     = (align.left.first  * lineHeight) + leftOffset,
      rightTop    = (align.right.first * lineHeight) + rightOffset,
      rightBottom = rightTop + (align.right.size * lineHeight),
      leftBottom  = leftTop  + (align.left.size  * lineHeight),
      top         = Math.min(leftTop, rightTop),
      height      = Math.max(leftBottom, rightBottom),
      points      = [
        '0,'   + leftTop,
        '100,' + rightTop,
        '100,' + rightBottom,
        '0,'   + leftBottom
      ];

  // we pretend the canvas is the size of the gutter, use the viewbox to crop it
  // viewbox and aspect ratio must be set natively or they don't work - weird
  bridge[0].setAttribute('viewBox', '0,' + top + ' 100,' + height);
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
    var chunk       = chunksByLine[focalLine],
        align       = chunk.align,
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
