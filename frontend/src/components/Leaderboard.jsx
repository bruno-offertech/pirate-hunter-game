import React from 'react';
import { Trophy, Zap } from 'lucide-react';

const Leaderboard = ({ leaderboard }) => {
  const getTrophy = (index) => {
    if (index === 0) return <Trophy className="text-yellow-400" />;
    if (index === 1) return <Trophy className="text-gray-300" />;
    if (index === 2) return <Trophy className="text-yellow-600" />;
    return <span className="w-6 text-center">{index + 1}</span>;
  };

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-center text-yellow-400 flex items-center justify-center gap-2">
        <Trophy /> Leaderboard
      </h2>
      <ul className="space-y-2 flex-grow">
        {leaderboard.length > 0 ? (
          leaderboard.map((player, index) => (
            <li
              key={player.nickname + index}
              className="flex items-center justify-between p-2 bg-gray-900/50 rounded-md animate-reveal"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                {getTrophy(index)}
                <span className="font-medium">{player.nickname}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-yellow-400">
                <Zap size={14}/>
                {player.score}
              </div>
            </li>
          ))
        ) : (
          <div className="text-center text-gray-400 pt-10">
            <p>Aguardando jogadores...</p>
            <p className="text-sm">Jogue para aparecer aqui!</p>
          </div>
        )}
      </ul>
    </div>
  );
};

export default Leaderboard;
