window.$    = window.jQuery = require('jquery');
bootstrap   = require('bootstrap');
highlights  = require('highlights');
diff        = require('diff');
path        = require('path');

// temp for dev
var left  = __dirname + '/sample-left.js';
var right = __dirname + '/sample-right.js';

function loadDiff(left, right) {
  $('title').text(path.basename(left) + ' - ' + path.basename(right));

  Promise.all([
    loadFile(left,  $('.file-left .file-contents')),
    loadFile(right, $('.file-right .file-contents'))
  ]).then(function(values) {
    var i          = 0,
        count      = 0,
        lineLeft   = 0,
        lineRight  = 0,
        isEdit     = false,
        changes    = diff.diffLines(values[0], values[1]),
        linesLeft  = $('.file-left  .file-contents div.line'),
        linesRight = $('.file-right .file-contents div.line');

    for (i = 0; i < changes.length; i++) {
      count = changes[i].count;

      // handle deletes
      if (changes[i].removed) {
        isEdit = Boolean(i+1 < changes.length && changes[i+1].added);

        $(linesLeft.slice(lineLeft, lineLeft + count))
          .addClass('delete').toggleClass('edit', isEdit);

        // pair-up left/right changes
        $(linesLeft.get(lineLeft)).addClass('change change-' + i+ ' line-' + lineLeft);
        $(linesRight.get(lineRight)).addClass('change-' + i);

        // bridge the gap
        drawBridge(changes[i], changes[i+1], lineLeft, lineRight, 0);

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
          drawBridge(changes[i-1], changes[i], lineLeft, lineRight, 0);
        }

        lineRight += count;

      // handle same
      } else {
        // pair-up left/right changes
        $([linesLeft.get(lineLeft), linesRight.get(lineRight)])
          .addClass('change change-' + i);

        lineLeft  += count;
        lineRight += count;
      }
    }
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

function drawBridge(changeLeft, changeRight, lineLeft, lineRight, skew, bridge) {
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

  // adjust lineLeft/Right to account for skew (scroll alignment)
  var lineHeight  = getLineHeight();
  var action      = changeLeft.removed && changeRight.added ? 'edit' : (changeLeft.removed ? 'delete' : 'add');
  // var offsetLeft  = (lineLeft  - lineRight) * lineHeight;
  // var offsetRight = ((lineRight - lineLeft) * lineHeight) + skew;
  var leftHeight  = changeLeft.removed ? (changeLeft.count  * lineHeight) : 0;
  var rightHeight = changeRight.added  ? (changeRight.count * lineHeight) : 0;
  // var height      = Math.max(leftHeight + offsetLeft, rightHeight + offsetRight);

  var top, leftTop, leftBottom, rightTop, rightBottom;


  // we need four points to draw the bridge
  // begin by assuming the canvas is the size of the gutter
  var leftTop     = (lineLeft * lineHeight),
      rightTop    = (lineRight * lineHeight) + skew,
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

var lastSkew = 0;
function updateBridges() {
  var skew = parseInt($('.file-right .file-contents').get(0).style.top, 10);
  if (skew === lastSkew) return;

  $('.bridge').each(function(){
    drawBridge(null, null, null, null, skew, $(this));
  });

  lastSkew = skew;
}

$(function(){
  loadDiff(left, right);

  $(window).on('scroll', function(e){
    // align changes when they scroll to a point 1/3 of the way down the window
    // find the line that corresponds to this point based on line-height
    var scrollTop   = $(window).scrollTop(),
        lineHeight  = getLineHeight(),
        focalPoint  = Math.floor($(window).height() / 3) + scrollTop,
        lineNumber  = Math.floor(focalPoint / lineHeight),
        focalLine   = $('div.line').eq(lineNumber);

    // now that we have the focal line, use that to find the bracketing changes
    var prevChange  = focalLine.is('.change') ? focalLine : focalLine.prevAll('.change').first(),
        nextChange  = focalLine.nextAll('.change').first(),
        prevTop     = prevChange.offset().top,
        nextTop     = nextChange.offset().top;

    var prevChangeClass = prevChange.attr('class').match(/change\-[0-9]+/)[0],
        prevLeftChange  = $('.file-left .'  + prevChangeClass),
        prevRightChange = $('.file-right .' + prevChangeClass),
        prevLeftTop     = prevLeftChange.position().top,
        prevRightTop    = prevRightChange.position().top,
        prevOffset      = prevLeftTop - prevRightTop;

    var nextChangeClass = nextChange.attr('class').match(/change\-[0-9]+/)[0],
        nextLeftChange  = $('.file-left .'  + nextChangeClass),
        nextRightChange = $('.file-right .' + nextChangeClass),
        nextLeftTop     = nextLeftChange.position().top,
        nextRightTop    = nextRightChange.position().top,
        nextOffset      = nextLeftTop - nextRightTop;

    // how far have we scrolled between these two changes in %
    // snap focal point when within close proximity to a change
    // !!! doesn't work for adds or edits from small change to big change
    focalPoint  = focalPoint - prevTop    <= 3 ? prevTop : focalPoint;
    focalPoint  = nextTop    - focalPoint <= 3 ? nextTop : focalPoint;
    var percent = (focalPoint - prevTop) / (nextTop - prevTop);

    // slide between the two offsets using percent to combine them
    var offset = (prevOffset * (1-percent)) + (nextOffset * percent);
    $('.file-right .file-contents').css('top', offset + 'px');

    // redraw connecting svgs
    updateBridges();

    // debug decoration
    // $('.focal-point').css('top', focalPoint);
    // $('.focal-line').removeClass('focal-line');
    // focalLine.addClass('focal-line');
    // $('.prev-change').removeClass('prev-change');
    // prevChange.addClass('prev-change');
    // $('.next-change').removeClass('next-change');
    // nextChange.addClass('next-change');
  });
});
