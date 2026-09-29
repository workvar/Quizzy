'use client';
import { useState, useEffect, useRef } from 'react';
import { MdSnackbar } from '@awc-ui/react';

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
            setNotifications(prev => [...prev, { id, questionId: data.id, ...data }]);
            setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);
          }
        } catch {}
      };
      es.onerror = () => setTimeout(connect, 3000);
    };
    connect();
    return () => esRef.current?.close();
  }, []);

  const current = notifications[0];
  if (!current) return null;

  return (
    <MdSnackbar
      open
      position="top"
      action="Open"
      autoHideDuration={6000}
      onMdAction={() => { window.location.href = `/contestant/question?id=${current.questionId}`; }}
      onMdClose={() => setNotifications(prev => prev.filter(n => n.id !== current.id))}
    >
      New question: {current.title}
    </MdSnackbar>
  );
}
