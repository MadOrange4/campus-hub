// src/pages/Calendar.tsx
import { useNavigate } from 'react-router-dom';
import "../calendar.css";

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onDateSelect: (date: Date) => void;
}

export default function Calendar({ currentDate, setCurrentDate, onDateSelect }: CalendarProps) {
  const navigate = useNavigate();

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

  const handleClose = (): void => {
    navigate('/app');
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <button onClick={handlePrevMonth}>&lt;</button>
          <h2>
            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
          </h2>
          <button onClick={handleNextMonth}>&gt;</button>
        </div>
        <div className="weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="weekday">
              {day}
            </div>
          ))}
        </div>
        <div className="days-grid">
          {days.map((day, index) => (
            <div
              key={index}
              className={`day-cell ${day === null ? 'empty' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day}
            </div>
          ))}
        </div>
        <button className="close-button" onClick={handleClose}>
          Close
        </button>
      </div>
    </div>
  );
}
