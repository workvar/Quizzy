'use client';
import { useState, useEffect, useRef } from 'react';

export default function NotificationBanner() {
  const [notifications, setNotifications] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    const connect = () => {
      if (esRef.current) esRef.current.close();
      const es = new EventSource('/api/notifications/stream');
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'questionReleased') {
            const id = Date.now();
            setNotifications(prev => [...prev, { id, ...data }]);
            setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);
          }
        } catch {}
      };
      es.onerror = () => setTimeout(connect, 3000);
    };
    connect();
    return () => esRef.current?.close();
  }, []);

  if (!notifications.length) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
      {notifications.map(n => (
        <div key={n.id} className="notify-in bg-white border border-apple-gray-2 rounded-apple-md shadow-apple-lg px-4 py-3 flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A8 8 0 0020 12a8 8 0 10-8 8c1.7 0 3.3-.5 4.6-1.4L18 20" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-apple-green uppercase tracking-wide">New Question Released</p>
            <p className="text-sm font-medium text-apple-text truncate">{n.title}</p>
          </div>
          <a href={`/contestant/question?id=${n.id}`} className="text-xs font-semibold text-apple-blue bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors flex-shrink-0">Go to Q</a>
        </div>
      ))}
    </div>
  );
}
