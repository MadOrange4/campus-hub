// src/pages/Calendar.tsx - Transformed & Refined
import { useNavigate } from 'react-router-dom';
import React, { useState, useMemo } from 'react';
import "../calendar.css";
import { CalendarDays } from 'lucide-react'; 

// Define the EventItem type EXACTLY as in App.tsx
export interface EventItem {
  id: string;
  title: string;
  start: string; // ISO string
  end?: string; // ISO string
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string; // Added optional desc
  locationLatLng?: { lat: number; lng: number }; // Added optional locationLatLng
}

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onDateSelect: (date: Date) => void;
  events: EventItem[]; // Prop for all events
  onEventClick: (id: string) => void; 
  showOnlyAttending: boolean;
  onToggleAttending: () => void;
}

// Map event tags to dot classes/colors for the CSS
const TAG_DOT_MAP: { [key: string]: string } = {
  today: 'dot-today',
  career: 'dot-career',
  sports: 'dot-sports',
  holiday: 'dot-holiday',
};

// --- Sub-Component: EventDetailsPopover ---
interface PopoverProps {
  events: EventItem[];
  date: Date;
  onEventClick: (id: string) => void;
}

const EventDetailsPopover: React.FC<PopoverProps> = ({ events, date, onEventClick }) => {
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Simple location/time formatter
  const formatEventTimeLocation = (event: EventItem) => {
    // Check if start is a valid ISO string before creating a Date object
    const startObj = new Date(event.start);
    const endTime = event.end ? new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

    if (isNaN(startObj.getTime())) return `Time unknown · ${event.location}`;

    const startTime = startObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const timeRange = endTime ? `${startTime}-${endTime}` : startTime;
    return `${timeRange} · ${event.location}`;
  };
  
  return (
    <div className="event-popover-wrapper">
      <div className="event-popover">
        <div className="popover-date">{formattedDate}</div>
        {events.map((event) => {
          // Determine the primary dot color based on the first recognized tag
          const primaryTag = event.tags.find(tag => TAG_DOT_MAP[tag.toLowerCase()]);
          const dotClass = primaryTag ? TAG_DOT_MAP[primaryTag.toLowerCase()] : 'dot-career';

          return (
            <div key={event.id} className="popover-event-item" onClick={() => onEventClick(event.id)}>
              <h4>
                <span className={`event-dot ${dotClass}`}></span>
                {event.title}
              </h4>
              <p className="popover-event-details">{formatEventTimeLocation(event)}</p>
              <div className="popover-tags-container">
                {event.tags.map((tag) => (
                  <span key={tag} className="popover-tag">{tag}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Component: FullCalendar ---
export default function Calendar({ 
  currentDate, 
  setCurrentDate, 
  onDateSelect, 
  events, 
  onEventClick, 
  showOnlyAttending,
  onToggleAttending,  
}: CalendarProps) {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  
  // State to manage the popover visibility (date for which the popover is active)
  const [activeDate, setActiveDate] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date): (number | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  // Group events by day of the month for efficient lookup
  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventItem[]>();
    events.forEach(event => {
      const startObj = new Date(event.start);
      // Check if event start date is in the currently viewed month/year
      if (startObj.getMonth() === currentDate.getMonth() && startObj.getFullYear() === currentDate.getFullYear()) {
        const startDay = startObj.getDate();
        const eventsForDay = map.get(startDay) || [];
        map.set(startDay, [...eventsForDay, event]);
      }
    });
    return map;
  }, [events, currentDate]);


  const handlePrevMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number | null): void => {
    if (day) {
      const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      onDateSelect(selectedDate);
    }
  };

  const handleBack = (): void => {
    // Navigate back to the app/feed route
    navigate('/app');
  };

  const handleToday = (): void => {
    setCurrentDate(today);
  };
  
  const handleMouseEnterDay = (day: number | null) => {
    if (day && eventsByDay.get(day)?.length) {
        setActiveDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    }
  }

  const handleMouseLeaveDay = () => {
    setActiveDate(null);
  }

  const days = getDaysInMonth(currentDate);

  const isDayToday = (day: number | null) => {
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  }

  return (
    <div className="full-calendar-container">
      <div className="calendar-header">
        <button className="header-controls" onClick={handleBack}>
          &larr; Back
        </button>
        <div className="header-center-controls"> {/* <-- Center Controls */}
            <div className="month-nav">
                <button onClick={handlePrevMonth}>&lt;</button>
                <h2>
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                </h2>
                <button onClick={handleNextMonth}>&gt;</button>
            </div>
            <button onClick={handleToday}>
                <CalendarDays className="size-4" /> Today
            </button>
        </div>
        <button 
          onClick={onToggleAttending}
          className="header-controls"
          title={showOnlyAttending ? "Show All Events" : "Show Only Attending Events"}
        >
          {showOnlyAttending ? "Show All" : "Attending"}
        </button>
      </div>
      <div className="weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>
      <div className="days-grid">
        {days.map((day, index) => {
            const isTodayCell = isDayToday(day);
            const eventsForDay = day ? eventsByDay.get(day) : [];
            const dayDate = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
            const isActiveDay = activeDate && dayDate && dayDate.toDateString() === activeDate.toDateString();

            return (
                <div
                    key={index}
                    className={`day-cell ${day === null ? 'empty' : ''} ${isTodayCell ? 'today' : ''}`}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => handleMouseEnterDay(day)}
                    onMouseLeave={handleMouseLeaveDay}
                >
                    {day && (
                        <div className="day-number-container">
                            <span className="day-number">{day}</span>
                            {isTodayCell && <span className="today-label">Today</span>}
                        </div>
                    )}

                    {/* Event Dots */}
                    {eventsForDay && eventsForDay.length > 0 && (
                        <div className="event-dots-container">
                            {/* Slice to ensure the dots don't overflow the cell (max 2 shown in the image) */}
                            {eventsForDay.slice(0, 2).map((event, eventIndex) => { 
                                const primaryTag = event.tags.find(tag => TAG_DOT_MAP[tag.toLowerCase()]);
                                const dotClass = primaryTag ? TAG_DOT_MAP[primaryTag.toLowerCase()] : 'dot-career';

                                return <span key={event.id} className={`event-dot ${dotClass}`} />;
                            })}
                        </div>
                    )}
                    
                    {/* Event Popover */}
                    {isActiveDay && eventsForDay && eventsForDay.length > 0 && (
                        <EventDetailsPopover
                            events={eventsForDay}
                            date={dayDate!}
                            onEventClick={onEventClick}
                        />
                    )}
                </div>
            )})}
      </div>

      <div className="calendar-footer">
        {/* Legend from the image */}
        <div className="legend">
            <div className="legend-item"><span className="event-dot dot-today"></span> Today</div>
            <div className="legend-item"><span className="event-dot dot-career"></span> Career</div>
            <div className="legend-item"><span className="event-dot dot-sports"></span> Sports</div>
            <div className="legend-item"><span className="event-dot dot-holiday"></span> Holiday</div>
        </div>
        
        {/* Footer instructions */}
        <div className="footer-instruction">
            Esc to close &nbsp; &bull; &nbsp; &larr; / &rarr; to switch months &nbsp; &bull; &nbsp; Click a day to select
        </div>
      </div>
    </div>
  );
}