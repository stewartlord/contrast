/**
 * Perforce Swarm
 *
 * @copyright   2012 Perforce Software. All rights reserved.
 * @license     Please see LICENSE.txt in top-level folder of this distribution.
 * @version     <release>/<patch>
 */

swarm.jobs = {
    _loading: false,

    init: function(attachListeners) {
        // load initial results
        var search = $('.jobs-toolbar input[name=query]');
        $('table.jobs').data('query', search.val());
        swarm.jobs.load();

        // wire-up search filter
        var runSearch = function() {
            // if search hasn't changed, return
            if ($('table.jobs').data('query') === search.val()) {
                return;
            }

            // if currently processing another search, abort it.
            if (swarm.jobs._loading) {
                swarm.jobs._loading.abort();
                swarm.jobs._loading = false;
            }

            $('table.jobs').data('query', search.val());
            swarm.jobs.load(true);
        };

        var handleSearch = function() {
            runSearch();
            // push new url into the browser
            var query = '?q=' + encodeURIComponent(search.val());
            if (attachListeners && query !== location.search) {
                swarm.history.pushState(null, null, query);
            }
        };

        $('.jobs-toolbar .btn-search').on('click', handleSearch);

        search.on(
            'keypress',
            function(e) {
                // early exit if not enter key
                var code = (e.keyCode || e.which);
                if (e.type === 'keypress' && code !== 13) {
                    return;
                }

                handleSearch();
            }
        );

        // the rest of the init only happens when this
        // is called with attachListeners passed as true
        if (!attachListeners) {
            return;
        }

        // enable select columns button when table loads
        $('table.jobs').on('loaded', function(){
            $('.jobs-toolbar .btn-select-columns').prop('disabled', false);
        });

        // make table columns sortable
        $('table.jobs.sortable thead tr').sortable({
            containerSelector: 'tr',
            itemSelector:      'th',
            placeholder:       '<th class="placeholder"></th>',
            vertical:          false,
            onDrop: function(item, container, _super) {
                _super(item);

                // get newly re-ordered fields
                var table  = item.closest('table'),
                    fields = item.parent().find('th').map(function(){
                    return $(this).data('field');
                }).get();

                // save changes and refresh the table
                swarm.localStorage.set('jobs.fields', fields);
                swarm.jobs.refresh(table);

                // remove 'sorting' class from the table body to indicate that sorting is done
                table.find('tbody').removeClass('sorting');
            },
            onDragStart: function(item, container, _super) {
                item.appendTo(item.parent());
                _super(item);

                // add class to the table body to assist with styling
                item.closest('table').find('tbody').addClass('sorting');
            },
            onDrag: function(item, position) {
                // lock the dragged item vertically
                item.css({left: position.left + 'px', top: item.closest('tr').top + 'px'});
            }
        });

        // wire-up selecting columns
        var buttonSelector = '.jobs-toolbar .btn-select-columns',
            button         = $(buttonSelector);

        var handleSelect   = function (forceClose) {
            button.toggleClass('active', forceClose ? false : null);

            // if popover is open, close it
            if (button.data('popover')) {
                button.data('popover').destroy();
            }

            // if button is active, open popover to select fields
            if (button.is('.active')) {
                swarm.jobs.openSelectColumns(button);
            }
        };

        // toggle select columns button when user clicks on it
        button.on('click', function() {
            handleSelect();
        });

        // close the popover when user clicks outside
        $(document).on('click', function() {
            handleSelect(true);
        });
        $(document).on('click.job-fields', buttonSelector + ', .popover-job-fields', function (e) {
            e.stopPropagation();
        });

        // wire-up scroll loading
        $(window).scroll(function() {
            if ($.isScrolledToBottom()) {
                swarm.jobs.load();
            }
        });

        // handle popstate events
        swarm.history.onPopState(function(event) {
            var params = $.deparam(location.search.replace(/^\?/, ''), false, true);
            search.val(params.q || '');
            runSearch();
        });
    },

    load: function(reset) {
        if (swarm.jobs._loading) {
            return;
        }

        var table = $('table.jobs'),
            thead = table.find('thead'),
            tbody = table.find('tbody'),
            query = table.data('query');

        if (reset) {
            table.data('page', 0);
            tbody.empty();
        }

        // insert a loading indicator
        tbody.append(
            '<tr class="loading"><td colspan="5">'
          +  '<span class="loading animate muted">' + swarm.te('Loading...') + '</span>'
          + '</td></tr>'
        );

        // determine the current page and increment it
        var page = table.data('page') || 0;
        table.data('page', ++page);

        // only load jobs older than the last loaded row
        var last = table.find('tr').not('.loading').last().attr('id');

        // url varies between project specific and global jobs
        var project = table.data('project'),
            url     = swarm.url((project ? '/projects/' + project : '') + '/jobs');

        swarm.jobs._loading = $.ajax({
            url:        url,
            data:       {q: query, after: last, max: (50 * page), format: 'json'},
            dataType:   'json',
            success:    function(data) {
                var spec = data.spec;

                // remove loading indicator
                tbody.find('.loading').remove();

                // set data for rendering the table headings
                thead.data('spec', spec);

                // refresh the table
                swarm.jobs.refresh(table, data.jobs);

                // if there are no jobs, insert 'no jobs' alert
                // if there was an error, display it in the alert row
                if (data.errors.length) {
                    tbody.find('.no-jobs .alert').text(data.errors.join(', '));
                }

                // manually trigger 'loaded' event on the table to indicate that table has finished loading
                table.trigger('loaded');

                // enforce a minimal delay between requests
                setTimeout(function(){ swarm.jobs._loading = false; }, 500);
            }
        });
    },

    getFields: function(jobSpec) {
        // try to get fields from local storage first
        var storedFields = swarm.localStorage.get('jobs.fields');
        if (storedFields && storedFields.length) {
            // remove fields not present in spec
            return $.grep(storedFields.split(','), function (field) {
                return jobSpec[field] !== undefined;
            });
        }

        // if fields are not stored in local storage, return defaults
        return [
            jobSpec.__id,
            jobSpec.__status,
            jobSpec.__createdBy    || jobSpec.__modifiedBy,
            jobSpec.__description,
            jobSpec.__modifiedDate || jobSpec.__createdDate
        ];
    },

    openSelectColumns: function(element) {
        element = $(element);

        var table  = $('table.jobs'),
            spec   = table.find('thead').data('spec'),
            fields = swarm.jobs.getFields(spec);

        // prepare rendered list with all fields to select and/or order
        var fieldsList = '';

        // add visible fields first
        $.each(fields, function(index, field){
            fieldsList += $.templates(
                  '<li>'
                +  '<label class="checkbox">'
                +   '<input type="checkbox" data-value="{{>field}}" checked="checked">'
                +   '{{>label}}'
                +  '</label>'
                + '</li>'
            ).render({field: field, label: swarm.jobs.getFriendlyLabel(field)});
        });

        // add other available fields
        $.each(spec, function(field){
            // skip special and visible fields
            if (field.indexOf('__') === 0 || fields.indexOf(field) !== -1) {
                return true;
            }

            fieldsList += $.templates(
                  '<li>'
                +  '<label class="checkbox">'
                +   '<input type="checkbox" data-value="{{>field}}">'
                +   '{{>label}}'
                +  '</label>'
                + '</li>'
            ).render({field: field, label: swarm.jobs.getFriendlyLabel(field)});
        });

        // prepare content for the popover
        var content = '<ul class="unstyled pad1 padw0 fields-list">' + fieldsList + '</ul>';

        // show the popover
        element.popover({
            trigger:     'manual',
            html:        true,
            content:     content,
            placement:   'bottom',
            container:   'body',
            customClass: 'popover-job-fields'
        }).popover('show');

        var popover = $(element.data('popover').tip());

        // prepare handler to apply changes in job columns
        var handleApply = function() {
            // collect selected fields in order
            var fields     = [],
                fieldsList = popover.find('.fields-list');

            fieldsList.find(':checked').each(function(){
                fields.push($(this).data('value'));
            });

            // save changes and refresh the table
            swarm.localStorage.set('jobs.fields', fields);
            swarm.jobs.refresh(table);
        };

        // make fields sortable and wire-up events
        popover.find('.fields-list').sortable({
            nested: false,
            onDrop: function(item, container, _super) {
                _super(item);

                // firefox (unlike other browsers) fires click event when item is dropped
                // which would cause changing the state of the checkbox
                // to prevent this, we replace dropped item with its clone, so the click
                // event doesn't affect it
                var cloned = item.clone();
                item.replaceWith(cloned);

                // apply changes when fields order is changed (no need to refresh if
                // the dragged item is not selected)
                if (cloned.find(':checkbox').is(':checked')) {
                    handleApply();
                }
            },
            onDragStart: function(item, container, _super) {
                _super(item);

                // set explicit width and height on the placeholder when the field
                // is dragged to avoid resizing the tooltip
                container.group.placeholder.width(item.width()).height(item.height());
            },
            onDrag: function(item, position) {
                // lock the dragged item inside the fields-list container
                var container      = item.closest('.fields-list'),
                    itemHalfHeight = parseInt(item.height() * 0.5, 10),
                    lowerBound     = itemHalfHeight * 2,
                    upperBound     = container.height() + itemHalfHeight,
                    top            = Math.min(upperBound, Math.max(lowerBound, position.top)) - itemHalfHeight,
                    itemPosition   = {
                        left: '15px',
                        top:  top + 'px'
                    };

                item.css(itemPosition);
            }
        });

        // apply changes when fields are selected/deselected
        popover.on('click', ':checkbox', handleApply);
    },

    refresh: function(table, jobs) {
        var thead  = $(table).find('thead'),
            tbody  = $(table).find('tbody'),
            spec   = thead.data('spec'),
            fields = swarm.jobs.getFields(spec);

        // prepare for rendering jobs
        // if jobs were passed in the argument, convert these into table rows and append to the tbody
        // otherwise try to get the jobs from existing tbody data and refresh rows
        if (jobs) {
            // if we are on the first page, set jobs data on the tbody to allow
            // quick refresh without need to re-fetching the data
            if (table.data('page') === 1) {
                tbody.data('jobs', jobs);
            }
        } else {
            jobs = tbody.data('jobs');
            // if jobs are present on tbody data, we will render these to replace the current rows
            // otherwise reload the table
            if (jobs) {
                tbody.empty();
            } else {
                swarm.jobs.load(true);
                return;
            }
        }

        // refresh table headings
        thead.find('tr').empty();
        $.each(fields, function(){
            var field = this,
                info  = spec[field],
                label = swarm.jobs.getFriendlyLabel(field);

            thead.find('tr').append($.templates(
                '<th class="field-{{>info.code}} type-{{>info.dataType}}" data-field="{{>field}}">'
              +   '<span class="field-label">'
              +     '{{>label}}'
              +   '</span>'
              + '</th>'
            ).render({field: field, info: info, label: label}));
        });

        // refresh table body
        if (jobs) {
            // render rows
            $.each(jobs, function(){
                var job     = this,
                    columns = '';

                // render columns
                $.each(fields, function(){
                    var field = this,
                        info  = spec[field],
                        value = job[field];

                    // note: values are pre-escaped server-side
                    columns += $.templates(
                        '<td class="field-{{>info.code}} type-{{>info.dataType}}">'
                      +  '{{:value}}'
                      + '</td>'
                    ).render({value: value, info: info});
                });

                tbody.append($.templates(
                    '<tr id="{{>job.__id}}">{{:columns}}</tr>'
                ).render({job: this, columns: columns}));
            });
        }

        // if there are no jobs, insert 'no jobs' alert
        if (!tbody.find('tr').length) {
            tbody.append($.templates(
                '<tr class="no-jobs">'
              +  '<td colspan="{{>fields.length}}">'
              +   '<div class="alert border-box pad3">'
              +     '{{if query}}{{te:"No matching jobs."}}{{else}}{{te:"No jobs."}}{{/if}}'
              +   '</div>'
              +  '</td>'
              + '</tr>'
            ).render({fields: fields, query: $(table).data('query')}));
        }

        // convert times to time-ago, scrunch long text
        tbody.find('.timeago').timeago();
        tbody.find('.type-text, .type-bulk').expander({slicePoint: 100});
        tbody.find('.type-word, .type-select, .type-line').expander({slicePoint: 20});
    },

    getFriendlyLabel: function(label) {
        // underscores and dashes become spaces
        label = label.replace(/[_\-]/g, ' ');
        // camel-case conversion algorithm:
        //  - aA gets split into "a A"
        //  - Aa gets a leading space
        //  - aa and AA are left alone
        label = label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z][a-z])/g, ' $1');
        // normalize spacing and trim ends of whitespace
        label = label.replace(/^\s+|\s+$/, '');
        label = label.replace(/\s{2,}/g, ' ');
        // capitalize words
        label = label.replace(/^([a-z])|\s+([a-z])/g, function (match) {
            return match.toUpperCase();
        });

        return label;
    },

    renderFixes: function(wrapper){
        wrapper = $(wrapper);

        var changeInfo = wrapper.find('.change-info'),
            fixChange  = wrapper.data('review') || wrapper.data('change'),
            jobs       = wrapper.data('jobs');

        // remove old change-fixes container
        changeInfo.find('.change-fixes').remove();

        // force re-render on IE by swapping overflow state
        changeInfo.parent().css('overflow', 'hidden').delay(10).queue(function() {
            changeInfo.parent().css('overflow', '').dequeue();
        });

        // render jobs table
        var table = $('<table></table>');
        $.each(jobs, function(){
            table.append($.templates(
                  '<tr data-job="{{>job}}">'
                +   '<td class="job-unlink privileged">'
                +     '<a href="" title="{{te:"Unlink Job"}}"><i class="icon-remove"></i></a>'
                +   '</td>'
                +   '<td class="job-id">'
                +     '<a href="{{:link}}">{{>job}}</a>'
                +   '</td>'
                +   '<td class="description force-wrap">'
                +     '{{:description}}'
                +   '</td>'
                + '</tr>'
            ).render(this));
        });

        // append add jobs row
        table.append($.templates(
              '<tr class="privileged">'
            +   '<td>'
            +     '<a href="#" class="job-add"><i class="icon-plus"></i></a>'
            +   '</td>'
            +   '<td colspan="2">'
            +     '<a href="#" class="job-add">{{te:"Add Job"}}</a>'
            +   '</td>'
            + '</tr>'
        ).render(this));

        // create new change-fixes container with jobs table and place it in the change info
        var container = $('<div class="change-fixes popover-footer"></div>');
        container.append(table)
                 .appendTo(changeInfo);

        // if there are no jobs in the table, add class to the container to assist with styling
        if (!table.find('td.job-id').length) {
            container.addClass('no-jobs');
        }

        // expand descriptions
        container.find('.description').expander({slicePoint: 80});

        // wire-up job-add
        container.on('click.job.add', 'a.job-add', function(e){
            e.preventDefault();
            swarm.jobs.openSelectDialog(
                function(data, dialog){
                    // disable dialog buttons
                    swarm.form.disableButton(dialog.find('.modal-footer .btn-select'));
                    dialog.find('.modal-footer .btn-cancel').prop('disabled', true);

                    // data should contain list of jobs to add
                    // make a request to add them to the change and refresh jobs list afterwards
                    $.ajax('/changes/' + fixChange.id + '/fixes/add', {
                        type:     'POST',
                        data:     {jobs: data},
                        dataType: 'json',
                        success:  function(data) {
                            wrapper.data('jobs', data.jobs);
                            swarm.jobs.renderFixes(wrapper);

                            // close the dialog
                            dialog.modal('hide');
                        }
                    });
                },
                wrapper.data()
            );
        });

        // wire-up job-unlink
        container.on('click.job.unlink', '.job-unlink a', function(e){
            e.preventDefault();

            // clear other popovers as user could click on this link without closing previous one
            $('.job-unlink a').each(function(){
                if ($(this).data('popover')) {
                    $(this).data('popover').destroy();
                }
            });

            // hide the tooltip to avoid interference with the popover
            $(this).tooltip('hide');

            // present the confirmation popover
            var button  = $(this),
                job     = button.closest('tr').data('job'),
                type    = $(wrapper).is('.review-wrapper') ? 'review' : 'change',
                confirm = swarm.tooltip.showConfirm(button, {
                    placement:  'top',
                    content:    swarm.te('Unlink job from ' + type + '?'),
                    buttons:    [
                        '<button type="button" class="btn btn-primary btn-unlink">'+swarm.te('Unlink')+'</button>',
                        '<button type="button" class="btn btn-cancel">'+swarm.te('Cancel')+'</button>'
                    ]
                });

            // wire-up cancel button
            confirm.tip().on('click', '.btn-cancel', function(){
                confirm.destroy();
            });

            // wire-up unlink button
            confirm.tip().on('click', '.btn-unlink', function(){
                // remove links to unlink jobs
                container.find('.job-unlink').each(function(){
                    $(this).html($(this).find('a').html()).css('opacity', 0.5);
                });

                // disable confirm buttons until we get response back
                swarm.form.disableButton(confirm.tip().find('.btn-unlink'));
                confirm.tip().find('.btn').prop('disabled', true);

                $.ajax('/changes/' + fixChange.id + '/fixes/delete', {
                    type:     'POST',
                    data:     {jobs: job},
                    dataType: 'json',
                    success:  function(data) {
                        confirm.destroy();
                        $(wrapper).data('jobs', data.jobs);
                        swarm.jobs.renderFixes(wrapper);
                    },
                    error:    function() {
                        // if there was an error, remove the tooltip - we don't know error details,
                        // but user should see the general alert error
                        confirm.destroy();
                    }
                });
            });
        });
    },

    openSelectDialog: function(callback, data) {
        // remove old dialog if present
        $('.modal.job-select').remove();

        var modal = $(
              '<div class="modal hide fade job-select" tabindex="-1" role="dialog" aria-labelledby="edit-title" aria-hidden="true">'
            +    '<div class="modal-header">'
            +        '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'
            +        '<h3 id="edit-title">' + swarm.te('Select Job') + '</h3>'
            +    '</div>'
            +    '<div class="modal-body">'
            +        '<div class="jobs-browser">'
            +           '<div class="loading animate muted pad3">' + swarm.te('Loading...') + '</div>'
            +        '</div>'
            +    '</div>'
            +    '<div class="modal-footer">'
            +        '<button type="button" class="btn btn-primary btn-select" disabled>'
            +          swarm.te('Select')
            +        '</button>'
            +        '<button type="button" class="btn" data-dismiss="modal">' + swarm.te('Cancel') + '</button>'
            +    '</div>'
            + '</div>'
        ).appendTo('body');

        swarm.modal.show(modal);

        // prepare handler to update select button (disable if there are no jobs selected, enable otherwise)
        var updateSelectButton = function(){
            modal.find('.btn.btn-select').prop('disabled', !modal.find('.jobs-browser tr.selected').length);
        };

        // load dialog content
        $.ajax(data.jobsUrl || '/jobs', {
            dataType:   'html',
            data:       {format: 'partial'},
            success:    function(data) {
                var browser = modal.find('.jobs-browser');
                browser.html(data);

                // move jobs search outside jobs-list so it remains visible while scrolling
                browser.find('.jobs-toolbar').insertBefore(browser);

                // set full-width on the search query input
                modal.find('.jobs-toolbar input[name=query]').removeClass('input-xxlarge').addClass('input-block-level');

                // wire-up clicking on the row to select the associated job
                browser.on('click.job.select', 'tr', function(e) {
                    // don't do anything if user clicked on a link (e.g. to expand job's description) or table header
                    if ($(e.target).is('a') || $(this).closest('thead').length) {
                        return;
                    }

                    var row = $(this);

                    // clear selection on other rows first
                    browser.find('tr.selected').not(row).removeClass('selected');

                    // toggle selection on the clicked row
                    row.toggleClass('selected');

                    // update select button
                    updateSelectButton();
                });

                // wire-up double click to select the job and close the dialog
                browser.dblclick(function(e){
                    // get the row user double clicked on
                    var row = $(e.target).closest('tr');

                    // early exit if its not a jobs row
                    if (!row.length || row.closest('thead').length) {
                        return;
                    }

                    // pass the job to the callback that will handle the rest
                    if (typeof callback === 'function') {
                        callback([row.attr('id')], modal);
                    }
                });

                // whenever jobs table is (re)loaded, we need to do several tweaks:
                //  - update select button
                //  - remove links from job properties
                //  - update character limit on job descriptions
                browser.on('loaded', 'table.jobs', function (){
                    // update select button
                    updateSelectButton();

                    // remove links from job properties
                    $(this).find('td a').replaceWith(function(){
                        return $(this).html();
                    });

                    // expand character limit on jobs descriptions to 70 chars
                    $(this).find('tbody .type-text').expander('destroy').expander({slicePoint: 70});
                });
            }
        });

        // wire up scroll loading
        modal.find('.jobs-browser').scroll(function() {
            if ($.isScrolledToBottom($(this), $(this).find('table.jobs'))) {
                swarm.jobs.load();
            }
        });

        // wire-up select button
        modal.find('.btn.btn-select').on('click', function(e){
            e.preventDefault();

            // collect selected job(s) and pass it/them to the callback
            var jobs = modal.find('.jobs-browser tr.selected').map(function(){
                return $(this).attr('id');
            }).get();

            if (typeof callback === 'function') {
                callback(jobs, modal);
            }
        });
    }
};
