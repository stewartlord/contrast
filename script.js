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
    var scrollTop    = $(window).scrollTop();
    var lineHeight   = getLineHeight();
    var subLineTop   = 0;//scrollTop % lineHeight;
    var focalPoint   = Math.floor($(window).height() / 4);
    var lineNumber   = Math.round((scrollTop + focalPoint) / lineHeight);
    var focalLine    = $('div.line').eq(lineNumber);
    var prevChange   = focalLine.prevAll('.change').first();
    var nextChange   = focalLine.nextAll('.change').first();
    var siblings     = focalLine[0].parentNode.children;
    var focalIndex   = [].indexOf.call(siblings, focalLine[0]);
    var prevDistance = focalIndex - [].indexOf.call(siblings, prevChange[0]);
    var nextDistance = [].indexOf.call(siblings, nextChange[0]) - focalIndex;
    var focalChange  = nextChange; //prevDistance < nextDistance ? prevChange : nextChange;
    focalChange      = focalLine.is('.change') ? focalLine : focalChange;

    if (!focalChange.length) {
      return;
    }
//console.log(subLineTop);
    var change       = focalChange.attr('class').match(/change\-[0-9]+/)[0];
    var leftChange   = $('.file-left .'  + change);
    var rightChange  = $('.file-right .' + change);


    var leftTop  = leftChange.position().top;
    var rightTop = rightChange.position().top;

    var prevTop = prevChange.position().top;
    var nextTop = nextChange.position().top;
//    var nextTop = nextChange.position().top;
    var creep   = scrollTop - prevTop;

    var percentage = (scrollTop + focalPoint - prevTop) / (nextTop - prevTop);
//console.log(percentage);
    var rightPane = $('.file-right .file-contents');
    var newTop    = (leftTop - rightTop); // * percentage;
    // if ((scrollTop + focalPoint) > leftTop) {
    //   newTop += scrollTop + focalPoint - leftTop;
    // };
    rightPane.css('top', newTop + 'px');

// console.log(leftTop, rightTop, prevTop, scrollTop + focalPoint);

// $('.focal-line').removeClass('focal-line');
// focalLine.addClass('focal-line');

    updateBridges();
  });
});
