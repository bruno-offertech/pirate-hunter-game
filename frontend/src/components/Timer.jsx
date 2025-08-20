import React, { useState, useEffect } from 'react';
import { Timer as TimerIcon } from 'lucide-react';

const Timer = ({ expiryTimestamp }) => {
  const calculateTimeLeft = () => {
    const difference = new Date(expiryTimestamp) - new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        total: difference,
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const seconds = timeLeft.seconds?.toString().padStart(2, '0');
  const isEnding = timeLeft.total <= 10000; // 10 seconds left

  if (!seconds) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 font-mono text-lg p-2 rounded-lg ${isEnding ? 'text-red-500 animate-pulse' : 'text-white'}`}>
      <TimerIcon size={20} />
      <span>00:{seconds}</span>
    </div>
  );
};

export default Timer;
