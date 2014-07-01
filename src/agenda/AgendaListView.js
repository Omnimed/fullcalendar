var AGENDA_LIST_LIMIT = 1;

fcViews.agendaList = agendaListView;

defaults.agendaDisType   = true;

function agendaListView(element, calendar) {
	var t = this;

	// Export methods
	t.render = render;

	// Import methods
	ListView.call(t, element, calendar);
	var formatDate = calendar.formatDate;
	var opt = t.opt;

	function render(date, delta) {
		if (delta) {
			addDays(date, delta);
			if (!opt('weekends')) {
				skipWeekend(date, delta < 0 ? -1 : 1);
			}
		}
		t.title = formatDate(date, opt('titleFormat'));
		t.start = t.visStart = cloneDate(date, true);
		t.end = t.visEnd = addDays(cloneDate(t.start), AGENDA_LIST_LIMIT);
	}
}

function ListView(element, calendar) {
	var t = this;

	// Export methods
	t.clearEvents = clearEvents;
	t.renderEvents = renderEvents;
	t.setHeight = setHeight;
	t.setWidth = setWidth;
	
	t.cellIsAllDay = function() {
		return true
	};

	t.getColWidth = function() {
		return colWidth
	};
	t.getDaySegmentContainer = function() {
		return daySegmentContainer
	};

	// Import methods
	View.call(t, element, calendar, 'agendaList');
	OverlayManager.call(t);
	SelectionManager.call(t);

	var eventElementHandlers = t.eventElementHandlers;
	var formatDate = calendar.formatDate;
	var getDaySegmentContainer = t.getDaySegmentContainer;
	var opt = t.opt;
	var updateEvents = t.calendar.updateEvents;
	var reportEventClear = t.reportEventClear;
	var trigger = t.trigger;

	// Local variables
	var body;
	var colWidth;
	var firstDay;
	var viewWidth;
	var viewHeight;

	function buildTable() {
		body = false;
	}

	function setHeight(height) {
		viewHeight = height;
		var bodyHeight = viewHeight; 
	}
	
	function setWidth(width) {
		viewWidth = width;	
	}

	function renderEvents(events, modifiedEventId) {
		/*
	 	 Duplicate the list of events to be used during the display
		 For repeating and multi-days events, we wanna make sure we add
		 those days each event happens.
		 For example event that start from 1st to 4th, we will add on our
		 list displayeventlist 1,2,3 and 4th this event
		 We could have used other methods like scanning the dates and
		 checking each event, but this seem to be more efficient
		*/
		var displayeventlist = [];
		var tstart, tend;
		var j = 0;

		for (i in events) {
			displayeventlist[j] = Object.create(events[i]);
			tstart = cloneDate(events[i].start, true);
			tend = cloneDate(events[i].end, true);

			if (tend - tstart > 0) {
				displayeventlist[j].end = cloneDate(tend);
			}

			while ((tend - tstart) > 0) {
				j = j + 1;
				displayeventlist[j] = Object.create(events[i]);
				tstart = addDays(tstart, 1);
				displayeventlist[j].start = cloneDate(tstart);
				
				if (tend - tstart > 0) {
					displayeventlist[j].allDay = true;
				}
			}
			j = j + 1;
		}

		displayeventlist = filter(displayeventlist, t.visStart, t.visEnd);

		// sort our display list, makes easier to display
		displayeventlist.sort(sorting);

		// Start displaying our sorted list
		var eventDisplay, headerClasses, patientId;
		var html = $("<ul class='fc-agendaList'></ul>");
		var mm, dd, tt, dt, lactivity, lcolor, ldescription, lparticipant, lpatient, ltitle, lurl, linwaitingroom, em;
		var temp, i = 0, j = 0;
		var today = clearTime(new Date());

		if (displayeventlist.length > 0) {
			for (i in displayeventlist) {
				allDay = displayeventlist[i].allDay;
				classes = displayeventlist[i].className;
				lactivity = displayeventlist[i].activity;
				lcolor =  displayeventlist[i].source.color;
				lday = formatDate(displayeventlist[i].start, opt('columnFormat'));
				ldescription = (displayeventlist[i].description != undefined) ? displayeventlist[i].description : '';
				ltitle = displayeventlist[i].title;
				linwaitingroom = displayeventlist[i].inWaitingRoom ? '<div class="patientInWaitingRoom" />' : '';
				st = formatDate(displayeventlist[i].start, 'HH:mm');
				et = formatDate(displayeventlist[i].end, 'HH:mm');

				lparticipant = '';
				for (j in displayeventlist[i].participantSet) {
					if (displayeventlist[i].participantSet[j].patient != undefined) {
						patientId = displayeventlist[i].participantSet[j].patient.id;
						lpatient = displayeventlist[i].participantSet[j].patient.firstName 
						+ ' '
						+ displayeventlist[i].participantSet[j].patient.lastName;
						lparticipant = '<a id="patientDetailsShowPatientDetailsLink_' + patientId 
							+  '" class="fc-event-patientDetail float-left" href="javascript:void(0)" onclick="'
							+ '$(\'#hiddenElementClicked\').val(\'#patientDetailsShowPatientDetailsLink_' + patientId + '\');'
							+ '$(\'#hiddenSelectedPatientId\').val(' + patientId + ');patientDetails();\" title="' + opt('patientDetailsText') + '">'
							+ '<div class="patientImage"></div></a>'
							+ '<a class="bold" href="/omnimed/do/dashboard/patientDashboard?patientId=' 
							+ patientId 
							+ '&amp;institutionId=' + $('#hiddenWorkingInstitution').val()
							+ '&amp;mandateId=' + ($('#hiddenWorkingMandate').length != 0 ? $('#hiddenWorkingMandate').val() : '')
							+ '&amp;selectedWaitingRoomId=' + $('#hiddenSelectedWaitingRoom').val() + '" title="'
							+ lpatient + '">'
							+ lpatient
							+ '</a>'
						break;
						
					}
				}

				// Change day
				if (lday != temp) {
					headerClasses = ['fc-agendaList-dayHeader', 'ui-widget-header', 'fc-' + dayIDs[displayeventlist[i].start.getDay()]];
					
					if (+displayeventlist[i].start == +today) {
						headerClasses.push('fc-today');
					}

					$('<li class="' + headerClasses.join(' ') + '">'
						+ "<span class='fc-agendaList-date'>"
						+ lday + "</span>" + "</li>").appendTo(html);
					temp = lday;
				}

				// Event rendering
				if (allDay) {
					eventdisplay = $(
						'<li class="fc-agendaList-item">'
						+ '<div class="fc-agendaList-event fc-eventlist '
						+ classes
						+ '">'
						+ '<div class="activityColor inline-block" style="background-color: ' + (lactivity != undefined ? lactivity.color : '') + ';" title="' + (lactivity != undefined ? lactivity.title : '') + '" />'
						+ '<div class="fc-event-time">'
						+ '<span class="fc-event-all-day">' + opt('allDayText') + '</span>'
						+ '</div>'
						+ '<div class="ellipsedNoFloat fc-event-title" style="color:' + lcolor + ';" title="' + ltitle +'">' + ltitle + '</div>'
						+ '<div class="fc-event-waitingroom">' + linwaitingroom + '</div>'
						+ '<div class="ellipsedNoFloat fc-event-participant">' + lparticipant + '</div>'
						+ '<div class="ellipsedNoFloat fc-event-desc grey small" title="' + ldescription + '">' + ldescription + '</div>'
						+ '</div>').appendTo(html);
				} else {
					eventdisplay = $(
						'<li class="fc-agendaList-item">'
						+ '<div class="fc-agendaList-event fc-eventlist '
						+ classes
						+ '">'
						+ '<div class="activityColor inline-block" style="background-color: ' + (lactivity != undefined ? lactivity.color : '') + ';" title="' + (lactivity != undefined ? lactivity.title : '') + '" />'
						+ '<div class="fc-event-time">' + st + ' — '  + et + '</div>'
						+ '<div class="ellipsedNoFloat fc-event-title" style="color:' + lcolor + ';" title="' + ltitle + '">' + ltitle + '</div>'
						+ '<div class="fc-event-waitingroom">' + linwaitingroom + '</div>'
						+ '<div class="ellipsedNoFloat fc-event-participant">' + lparticipant + '</div>'
						+ '<div class="ellipsedNoFloat fc-event-desc grey small" title="' + ldescription + '">' + ldescription + '</div>'
						+ '</div>').appendTo(html);
				}

				eventElementHandlers(displayeventlist[i], eventdisplay.children().children('div.fc-event-title'));
			}
		} else {
			$('<div>' + opt('emptyEventText') + '</div>').appendTo(html);
		}

		$(element).html(html);
		trigger('eventAfterAllRender');
	}

	function clearEvents() {
		// Implement this in case we wanna do list based display.
	}

	function filter(events, start, end) {
		var filteredEvents = [],
			i, len=events.length, event,
			eventStart, eventEnd;
		for (i=0; i<len; i++) {
			event = events[i];
			eventStart = event.start;
			eventEnd = event.end;
			if (eventStart >= start
					&& ((event.end != null && eventEnd <= end) || (event.allDay && eventStart < end))
					&& !event.isTimeSlotWindow) {
				filteredEvents.push(event);
			}
		}
		return filteredEvents;
	}

	function sorting(a, b) {
		var endDateA = new Date(a.end);
		var endDateB = new Date(b.end);
		var startDateA = new Date(a.start);
		var startDateB = new Date(b.start);
		var result = 0;
		
		if (a.allDay && !b.allDay) {
			result=  -1;
		} else if (!a.allDay && b.allDay) {
			result=  1;
		} else {
			result = startDateA - startDateB;
			
			if (result === 0) {
				result = endDateA - endDateB;
				
				if (result === 0) {
					if (a.title > b.title) {
						result = 1
					} else if (a.title < b.title) {
						result = -1
					} else {
						result = 0;
					}
				}
			}
		}
		return result;
	}
}
;;
