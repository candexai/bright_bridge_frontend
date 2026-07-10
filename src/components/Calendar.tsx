import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';

interface TourBooking {
  id: string;
  parentName: string;
  phone: string;
  email: string;
  scheduledAt: string;
  calendarProvider: string | null;
}

interface CalendarProps {
  bookings: TourBooking[];
}

export const Calendar: React.FC<CalendarProps> = ({ bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const handleDateClick = (day: number) => {
    setSelectedDate(new Date(year, month, day));
  };

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Padding for the first week
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateToCheck = new Date(year, month, day);
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const dayBookings = safeBookings.filter(b => b.scheduledAt.startsWith(dateStr));
    
    const isToday = new Date().toDateString() === dateToCheck.toDateString();
    const isSelected = selectedDate.toDateString() === dateToCheck.toDateString();

    days.push(
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        className={`h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 flex flex-col items-center justify-center rounded-lg relative transition-all ${
          isSelected ? 'bg-blue-600 shadow-md transform scale-105' : 
          isToday ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100' : 'hover:bg-slate-50'
        }`}
      >
        <span className={`text-xs font-bold ${
          isSelected ? 'text-white' : 
          isToday ? 'text-blue-600' : 'text-slate-700'
        }`}>
          {day}
        </span>
        {dayBookings.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {dayBookings.slice(0, 3).map((_, idx) => (
              <div key={idx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'} animate-pulse`} />
            ))}
          </div>
        )}
      </button>
    );
  }

  const selectedDateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
  
  const selectedDateBookings = useMemo(() => {
    return [...safeBookings]
      .filter(b => b.scheduledAt.startsWith(selectedDateStr))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [safeBookings, selectedDateStr]);

  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="bg-white rounded-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-600" />
          School Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <span className="text-xs font-bold text-slate-600 min-w-24 text-center uppercase tracking-tight">
            {monthName} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-8">
        {days}
      </div>

      <div className="mt-auto border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-3 h-3" /> 
            {isSelectedToday ? 'Upcoming Today' : `Bookings on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
          </h4>
          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
            {selectedDateBookings.length} Total
          </span>
        </div>
        
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {selectedDateBookings.length === 0 ? (
            <p className="text-xs text-slate-400 italic font-medium py-2">No tours scheduled for this date.</p>
          ) : (
            selectedDateBookings.map(tour => (
              <div key={tour.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all">
                <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">
                      {tour.parentName || 'Parent'}
                    </p>
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      {new Date(tour.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {new Date(tour.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
