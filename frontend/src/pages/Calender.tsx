// src/components/Calendar.tsx
import { useState } from 'react';
import './Calendar.css';

interface CalendarProps {
  isOpen: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
}

export default function Calendar({ isOpen, onClose, onDateSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  if (!isOpen) {
    return null;
  }

  const getDaysInMonth = (date: Date): (number | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Add all the days of the current month
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

  const days = getDaysInMonth(currentDate);

  return (
    <div className="modal-overlay" onClick={onClose}>
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
        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
