'use client';
import { useState, useEffect } from 'react';

export default function Countdown({ endTime }) {
  const [display, setDisplay] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setDisplay('Ended'); setExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <span className={`font-mono text-sm font-semibold px-3 py-1 rounded-full ${
      expired ? 'bg-red-100 text-apple-red' : 'bg-blue-50 text-apple-blue'
    }`}>
      {display || '--:--:--'}
    </span>
  );
}
