import React from 'react';
import { User, Zap, Wifi, WifiOff } from 'lucide-react';

const PlayerInfo = ({ player, totalScore, connectionStatus }) => {
  const isConnected = connectionStatus === 'connected';
  
  return (
    <div className="flex items-center gap-4 bg-gray-900/50 p-2 pr-4 rounded-full">
      <div className="flex items-center justify-center w-10 h-10 bg-yellow-500 rounded-full text-gray-900 font-bold text-xl">
        {player?.nickname?.substring(player.nickname.lastIndexOf(' ') + 1) || <User size={24} />}
      </div>
      <div>
        <p className="font-bold text-white whitespace-nowrap">{player?.nickname?.substring(0, player.nickname.lastIndexOf(' ')) || 'Jogador'}</p>
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <Zap size={14} />
          <span className="font-mono">{totalScore}</span>
        </div>
      </div>
       <div title={isConnected ? 'Conectado' : 'Desconectado'} className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-500'}`}>
        {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
      </div>
    </div>
  );
};

export default PlayerInfo;
